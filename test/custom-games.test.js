const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const AdmZip = require('adm-zip');
const { Readable } = require('node:stream');
const { extractSafeZip, safeEntryPath } = require('../src/main/custom-games/safe-zip');
const { registerCustomGamesIpc } = require('../src/main/ipc/register-custom-games-ipc');
const { createCustomGamesService } = require('../src/main/custom-games/custom-games-service');

test('ZIP extraction streams game files into the selected staging folder', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-game-'));
    try {
        const zip = new AdmZip();
        zip.addFile('Game/README.txt', Buffer.from('Merlin test game'));
        zip.addFile('Game/Game.exe', Buffer.from('fixture'));
        const archive = path.join(root, 'game.zip');
        zip.writeZip(archive);
        const target = path.join(root, 'staging');
        const result = await extractSafeZip(archive, target);
        assert.equal(result.files, 2);
        assert.equal(fs.readFileSync(path.join(target, 'Game', 'README.txt'), 'utf8'), 'Merlin test game');
        assert.equal(fs.readFileSync(path.join(target, 'Game', 'Game.exe'), 'utf8'), 'fixture');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('ZIP paths cannot escape Merlin-games or create Windows alternate streams', () => {
    const root = path.resolve('C:\\Merlin-games\\.merlin-installing-test');
    for (const entry of ['../outside.txt', '/absolute.txt', 'C:/Windows/file.txt', 'Game/file:stream',
        'Game/../outside', 'Game/.merlin-install.json', 'Game/CON.txt', 'Game/trailing.']) {
        assert.throws(() => safeEntryPath(root, entry));
    }
});

test('one custom-games IPC service owns list, download, play, folder and uninstall', async () => {
    const handlers = new Map();
    const ipcMain = { handle: (name, fn) => handlers.set(name, fn) };
    let progress;
    const service = {
        list: () => ({ games: [] }), refresh: () => ({ games: [] }), listDrives: () => [],
        install: async (_id, _drive, report) => { report({ stage: 'downloading' }); return { success: true }; },
        cancel: () => ({ success: true }), play: () => ({ success: true }),
        openFolder: () => ({ success: true }), uninstall: () => ({ success: true }),
    };
    registerCustomGamesIpc({ ipcMain, service });
    assert.deepEqual([...handlers.keys()].sort(), [
        'custom-games:cancel', 'custom-games:drives', 'custom-games:install', 'custom-games:list',
        'custom-games:open-folder', 'custom-games:play', 'custom-games:refresh', 'custom-games:uninstall',
    ]);
    const event = { sender: { isDestroyed: () => false, send: (_channel, state) => { progress = state; } } };
    assert.deepEqual(await handlers.get('custom-games:install')(event, { id: 'a', drive: 'D' }), { success: true });
    assert.deepEqual(progress, { stage: 'downloading' });
});

test('all custom-games UI labels exist in five languages', () => {
    const messages = { ptbr: {}, en: {}, es: {}, fr: {}, de: {} };
    const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'custom-games', 'custom-games.js'), 'utf8');
    vm.runInNewContext(script, { translations: messages, document: { addEventListener() {} } });
    const keys = Object.keys(messages.ptbr).sort();
    assert.ok(keys.length > 30);
    for (const language of ['en', 'es', 'fr', 'de']) assert.deepEqual(Object.keys(messages[language]).sort(), keys);
});

test('downloads a ZIP into the chosen Merlin-games drive, resumes metadata and exposes only its own installation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-install-'));
    try {
        const disk = path.join(root, 'disk');
        fs.mkdirSync(disk);
        const zip = new AdmZip();
        zip.addFile('Game/Game.exe', Buffer.from('exe fixture'));
        zip.addFile('Game/readme.txt', Buffer.from('hello'));
        const archive = zip.toBuffer();
        const item = {
            id: 'f8fb0e0e-714c-4cf4-a449-2d57c591edcb', name: 'Test Game', installName: 'Test Game',
            archiveKey: 'archives/f8fb0e0e-714c-4cf4-a449-2d57c591edcb.zip', archiveSize: archive.length,
            executablePath: 'Game/Game.exe', imageUrl: '/api/custom-games/test/image',
        };
        const requests = [];
        const axios = { get: async (url, options) => {
            requests.push({ url, range: options.headers?.Range });
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            const range = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
            const start = Number(range[1]);
            const end = Number(range[2]);
            return { status: 206, headers: { 'content-range': `bytes ${start}-${end}/${archive.length}` },
                data: Readable.from([archive.subarray(start, end + 1)]) };
        } };
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios, authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api', shell: { openPath: async () => '' },
            testDriveRoot: () => disk,
        });
        const first = await service.list();
        assert.equal(first.games[0].installed, null);
        assert.ok(first.games[0].imageUrl.startsWith('https://staging.api-merlin.com/'));
        const result = await service.install(item.id, 'X');
        assert.equal(result.success, true);
        assert.equal(result.path, path.join(disk, 'Merlin-games', 'Test Game'));
        assert.equal(fs.readFileSync(path.join(result.path, 'Game', 'readme.txt'), 'utf8'), 'hello');
        assert.equal(fs.existsSync(path.join(disk, 'Merlin-games', '.merlin-downloads', `${item.id}.zip.part`)), false);
        assert.equal((await service.list()).games[0].installed.path, result.path);
        assert.equal((await service.install(item.id, 'X')).code, 'already_installed');
        assert.equal(requests.filter(request => request.range).length, 1);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
