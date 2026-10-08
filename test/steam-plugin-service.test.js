const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const vm = require('node:vm');
const WebSocket = require('ws');
const path = require('path');
const { PLUGIN_VERSION, buildMerlinStoreScript } = require('../src/main/steam-plugin/merlin-store-script');
const { createSteamPluginService } = require('../src/main/steam-plugin/steam-plugin-service');
const { registerSteamPluginIpc } = require('../src/main/ipc/register-steam-plugin-ipc');

function createMemoryFs() {
    const files = new Set();
    return { lstatSync: file => { if (!files.has(file)) throw new Error('missing'); return {}; }, add: file => files.add(file), remove: file => files.delete(file) };
}

test('Steam plugin is opt-in and removes only its own CDP marker', async () => {
    const fs = createMemoryFs();
    const state = { steamPath: 'C:\\Steam', steamPlugin: { enabled: false, markerOwned: false } };
    const service = createSteamPluginService({
        fs, path, fetch: async () => ({ ok: false }), addGamesService: {}, openView: () => {}, logger: {},
        configStore: { get: () => state, update: patch => Object.assign(state, patch) },
        execFile: (_file, args, done) => { if (args[1] === 'mklink') fs.add(args[3]); if (args[1] === 'rmdir') fs.remove(args[2]); done(null); }
    });

    await service.install();
    assert.equal(service.status().enabled, true);
    assert.equal(service.status().markerPresent, true);
    assert.equal(state.steamPlugin.startAtLogin, true);
    await service.uninstall();
    assert.equal(service.status().enabled, false);
    assert.equal(service.status().markerPresent, false);
});

test('Steam store integration is a Merlin-owned bridge without external download features', () => {
    const script = buildMerlinStoreScript();
    assert.match(script, /__merlinSteamPluginRequests/);
    assert.match(script, /__merlinSteamPluginState/);
    assert.match(script, /const applyState=/);
    assert.match(script, /Adicionar com Merlin/);
    assert.match(script, /merlin-denuvo-badge/);
    assert.match(script, /showDenuvoInfo/);
    assert.doesNotMatch(script, /bindDenuvoTooltip|merlin-denuvo-tooltip-portal/);
    assert.doesNotMatch(script, /steamless|remove drm|download source|luatools/i);
});

test('plugin version changes when the page-state recovery contract changes', () => {
    const script = buildMerlinStoreScript();
    assert.match(script, new RegExp(`version="${PLUGIN_VERSION}"`));
    assert.match(script, /__merlinSteamPluginLanguage/);
    assert.match(script, /__merlinSteamPluginReady=true/);
    assert.match(script, /data:image\/png;base64,/);
    assert.match(script, /merlin-denuvo-wrap/);
    assert.match(script, /document\.body\?\.innerText/);
    assert.match(script, /steam_denuvo_info_title/);
    assert.match(script, /Adicionar com Merlin/);
    assert.match(script, /Adicionar mesmo assim/);
    assert.match(script, /Adicionado ao Merlin/);
    assert.match(script, /dataset\.merlinAdded='true'/);
    assert.match(script, /const removal=removals\[key\]/);
    assert.match(script, /Não foi possível adicionar este jogo à Steam agora\. Se ele já foi lançado, entre em contato com o suporte\./);
    const serviceSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'steam-plugin', 'steam-plugin-service.js'), 'utf8');
    assert.match(serviceSource, /getSteamPluginTranslations/);
    assert.match(serviceSource, /buildMerlinStoreScript\(\{ language \}\)/);
    assert.match(serviceSource, /window\.__merlinSteamPluginReady === true/);
});

test('Store script retries when its previous initialization stopped early', () => {
    const script = buildMerlinStoreScript();
    const storage = new Map();
    let observerAttempts = 0;
    const browser = {
        window: { sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } },
        document: {
            documentElement: {}, head: { appendChild: () => {} },
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({})
        },
        location: { pathname: '/', reload: () => assert.fail('same-version recovery must not reload the page') },
        MutationObserver: class { constructor() { if (++observerAttempts === 1) throw new Error('page not ready'); } observe() {} disconnect() {} },
        setInterval: () => 1, clearInterval: () => {}
    };
    const context = vm.createContext(browser);
    assert.throws(() => vm.runInContext(script, context), /page not ready/);
    assert.equal(browser.window.__merlinSteamPluginVersion, PLUGIN_VERSION);
    assert.equal(browser.window.__merlinSteamPluginReady, false);
    vm.runInContext(script, context);
    assert.equal(browser.window.__merlinSteamPluginReady, true);
    assert.equal(observerAttempts, 2);
});

test('bridge removes handled requests in place so the injected script keeps its queue reference', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'steam-plugin', 'steam-plugin-service.js'), 'utf8');
    assert.match(source, /queue\.splice\(index,1\)/);
    assert.doesNotMatch(source, /__merlinSteamPluginRequests\s*=\s*window\.__merlinSteamPluginRequests\.filter/);
});

test('bridge accepts two open commands from the same injected page queue', async () => {
    const browser = { window: { __merlinSteamPluginRequests: [], __merlinSteamPluginReplies: {} } };
    const queueReference = browser.window.__merlinSteamPluginRequests;
    const context = vm.createContext(browser);
    const server = http.createServer((request, response) => {
        if (request.url !== '/json') return response.writeHead(404).end();
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify([{ id: 'store-page', url: 'https://store.steampowered.com/app/10/', webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}` }]));
    });
    const socketServer = new WebSocket.Server({ noServer: true });
    server.on('upgrade', (request, socket, head) => socketServer.handleUpgrade(request, socket, head, client => socketServer.emit('connection', client)));
    socketServer.on('connection', client => client.on('message', raw => {
        const message = JSON.parse(String(raw));
        const expression = message.params.expression;
        let value;
        if (expression.includes(`window.__merlinSteamPluginVersion === "${PLUGIN_VERSION}"`)) value = 'true';
        else value = vm.runInContext(expression, context);
        client.send(JSON.stringify({ id: message.id, result: { result: { value } } }));
    }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    const opened = [];
    const removed = [];
    const memoryFs = { existsSync: () => false, lstatSync: () => ({}) };
    const service = createSteamPluginService({
        fs: memoryFs, path, fetch: async () => ({ ok: false }), execFile: () => {},
        addGamesService: {}, libraryService: { remove: async appId => { removed.push(appId); return { success: true, appId }; } }, logger: { debug: () => {}, error: () => {} }, openView: view => opened.push(view),
        configStore: { get: () => ({ steamPath: 'C:\\Steam', steamPlugin: { enabled: true, markerOwned: false } }), update: () => {} },
        cdpUrl: `http://127.0.0.1:${server.address().port}/json`
    });
    try {
        queueReference.push({ id: 'first-open', kind: 'open', payload: { view: 'launcher' } });
        await service.tick();
        await new Promise(resolve => setTimeout(resolve, 160));
        assert.deepEqual(opened, ['launcher']);
        assert.strictEqual(browser.window.__merlinSteamPluginRequests, queueReference);
        assert.equal(queueReference.length, 0);

        queueReference.push({ id: 'second-open', kind: 'open', payload: { view: 'launcher' } });
        await service.tick();
        await new Promise(resolve => setTimeout(resolve, 160));
        assert.deepEqual(opened, ['launcher', 'launcher']);
        assert.equal(queueReference.length, 0);

        queueReference.push({ id: 'remove-game', kind: 'remove', payload: { appId: '10' } });
        await service.tick();
        await new Promise(resolve => setTimeout(resolve, 160));
        assert.deepEqual(removed, ['10']);
        assert.equal(browser.window.__merlinSteamPluginReplies['remove-game'].success, true);
        assert.equal(queueReference.length, 0);
    } finally {
        service.stop();
        for (const client of socketServer.clients) client.terminate();
        await new Promise(resolve => server.close(resolve));
    }
});

test('a broken Steam Store tab does not block injection into another tab', async () => {
    const server = http.createServer((request, response) => {
        if (request.url !== '/json') return response.writeHead(404).end();
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify([
            { id: 'stale-store-page', url: 'https://store.steampowered.com/app/10/', webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/stale` },
            { id: 'healthy-store-page', url: 'https://store.steampowered.com/', webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/healthy` }
        ]));
    });
    const socketServer = new WebSocket.Server({ noServer: true });
    let healthyEvaluations = 0;
    server.on('upgrade', (request, socket, head) => {
        if (request.url === '/stale') return socket.destroy();
        socketServer.handleUpgrade(request, socket, head, client => socketServer.emit('connection', client));
    });
    socketServer.on('connection', client => client.on('message', raw => {
        const message = JSON.parse(String(raw));
        healthyEvaluations++;
        const value = message.params.expression.includes('__merlinSteamPluginVersion') ? 'true' : '[]';
        client.send(JSON.stringify({ id: message.id, result: { result: { value } } }));
    }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    const service = createSteamPluginService({
        fs: { lstatSync: () => ({}) }, path, execFile: () => {},
        addGamesService: {}, logger: { debug: () => {} }, openView: () => {},
        configStore: { get: () => ({ steamPath: 'C:\\Steam', steamPlugin: { enabled: true, markerOwned: false } }) },
        cdpUrl: `http://127.0.0.1:${server.address().port}/json`
    });
    try {
        await service.tick();
        assert.equal(service.status().targetCount, 2);
        assert.equal(healthyEvaluations, 2);
        assert.ok(service.status().lastError);
    } finally {
        service.stop();
        for (const client of socketServer.clients) client.terminate();
        await new Promise(resolve => server.close(resolve));
    }
});

test('Steam plugin IPC stays separate from the launcher IPC contracts', () => {
    const channels = [];
    registerSteamPluginIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        steamPluginService: {}, restartSteam: () => {}, isSteamRunning: () => false, configStore: { get: () => ({ steamPlugin: {} }), update: () => {} }, onStateChanged: () => {}
    });
    assert.deepEqual(channels, ['steam-plugin:status', 'steam-plugin:install', 'steam-plugin:uninstall', 'steam-plugin:set-start-at-login']);
});

test('main supplies the plugin IPC with the shared configuration store', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    assert.match(source, /registerSteamPluginIpc\(\{[\s\S]*?configStore,/);
});

test('plugin install and uninstall leave Steam closed when it was already closed', async () => {
    const handlers = new Map();
    let stopped = 0;
    const state = { steamPlugin: { enabled: false, markerOwned: false } };
    registerSteamPluginIpc({
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        steamPluginService: {
            install: async () => ({ enabled: true }),
            uninstall: async () => ({ enabled: false }),
            status: () => ({ enabled: false })
        },
        stopSteam: async () => { stopped += 1; return true; },
        isSteamRunning: async () => false,
        configStore: { get: () => state, update: patch => Object.assign(state, patch) },
        onStateChanged: () => {}
    });

    const installed = await handlers.get('steam-plugin:install')();
    const uninstalled = await handlers.get('steam-plugin:uninstall')();
    assert.equal(stopped, 0);
    assert.equal(installed.steamWasRunning, false);
    assert.equal(uninstalled.steamWasRunning, false);
});

test('plugin operations stop an open Steam and let the renderer choose whether to start it again', async () => {
    const handlers = new Map();
    let stopped = 0;
    registerSteamPluginIpc({
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        steamPluginService: { install: async () => ({ success: true }), uninstall: async () => ({ success: true }), status: () => ({}) },
        stopSteam: async () => { stopped += 1; return true; },
        isSteamRunning: async () => true,
        configStore: { get: () => ({ steamPlugin: {} }), update: () => {} }, onStateChanged: () => {}
    });

    const installed = await handlers.get('steam-plugin:install')();
    const uninstalled = await handlers.get('steam-plugin:uninstall')();
    assert.equal(stopped, 2);
    assert.equal(installed.steamWasRunning, true);
    assert.equal(uninstalled.steamWasRunning, true);
});
