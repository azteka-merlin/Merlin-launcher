const WebSocket = require('ws');
const http = require('http');
const { PLUGIN_VERSION, buildMerlinStoreScript, getSteamPluginTranslations } = require('./merlin-store-script');

const CDP_URL = 'http://127.0.0.1:8080/json';
const MARKER_NAME = '.cef-enable-remote-debugging';

function createSteamPluginService({ fs, path, execFile, configStore, addGamesService, libraryService, openView, logger = console, cdpUrl = CDP_URL }) {
    let interval = null;
    let running = false;
    let ticking = false;
    let lastError = null;
    let targetCount = 0;
    let pendingOpenTimer = null;
    const sockets = new Map();
    const addOperations = new Map();
    const config = () => configStore.get().steamPlugin || {};
    const enabled = () => config().enabled === true;
    const markerPath = () => configStore.get().steamPath ? path.join(configStore.get().steamPath, MARKER_NAME) : null;
    const markerExists = file => { try { return Boolean(file && fs.lstatSync(file)); } catch { return false; } };
    const isInstalled = appId => {
        const steamPath = configStore.get().steamPath;
        return Boolean(steamPath && fs.existsSync(path.join(steamPath, 'config', 'stplug-in', `${appId}.lua`)));
    };
    const closeSockets = () => { for (const client of sockets.values()) client.ws.terminate(); sockets.clear(); };
    const appIdFromUrl = url => (String(url || '').match(/\/app\/(\d+)/) || [])[1] || null;

    function readCdpTabs() {
        return new Promise((resolve, reject) => {
            const request = http.get(cdpUrl, { timeout: 3000 }, response => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', chunk => { body += chunk; });
                response.on('end', () => {
                    if (response.statusCode !== 200) return reject(new Error(`CDP respondeu ${response.statusCode}.`));
                    try { resolve(JSON.parse(body)); } catch { reject(new Error('A resposta do CDP da Steam é inválida.')); }
                });
            });
            request.once('timeout', () => request.destroy(new Error('O CDP da Steam não respondeu a tempo.')));
            request.once('error', reject);
        });
    }

    const status = () => ({ enabled: enabled(), running, markerPresent: markerExists(markerPath()), targetCount, lastError });

    async function createMarker() {
        const marker = markerPath();
        if (!marker) throw new Error('Configure a pasta da Steam antes de instalar o plugin.');
        if (markerExists(marker)) return false;
        const target = path.join(path.dirname(marker), '.merlin-cdp-target');
        await new Promise((resolve, reject) => execFile('cmd.exe', ['/c', 'mklink', '/j', marker, target], error => error ? reject(error) : resolve()));
        return true;
    }

    async function removeOwnedMarker() {
        const marker = markerPath();
        if (!config().markerOwned || !markerExists(marker)) return;
        await new Promise(resolve => execFile('cmd.exe', ['/c', 'rmdir', marker], () => resolve()));
    }

    function getSocket(tab) {
        const existing = sockets.get(tab.id);
        if (existing?.ws.readyState === WebSocket.OPEN) return Promise.resolve(existing);
        existing?.ws.terminate();
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(tab.webSocketDebuggerUrl);
            const client = { ws, sequence: 0, pending: new Map() };
            sockets.set(tab.id, client);
            ws.once('open', () => resolve(client));
            ws.once('error', error => { if (sockets.get(tab.id) === client) sockets.delete(tab.id); reject(error); });
            ws.on('close', () => { if (sockets.get(tab.id) === client) sockets.delete(tab.id); for (const item of client.pending.values()) { clearTimeout(item.timeout); item.reject(new Error('A conexão com a Steam foi encerrada.')); } client.pending.clear(); });
            ws.on('message', message => { try { const response = JSON.parse(String(message)); const pending = client.pending.get(response.id); if (!pending) return; client.pending.delete(response.id); clearTimeout(pending.timeout); if (response.error || response.result?.exceptionDetails) pending.reject(new Error(response.error?.message || response.result?.exceptionDetails?.text || 'A Steam não conseguiu executar o plugin.')); else pending.resolve(response.result?.result?.value); } catch (_) {} });
        });
    }

    async function evaluate(tab, expression) {
        const client = await getSocket(tab);
        return new Promise((resolve, reject) => {
            const id = ++client.sequence;
            const timeout = setTimeout(() => { client.pending.delete(id); reject(new Error('A Steam demorou para responder.')); }, 8000);
            client.pending.set(id, { resolve, reject, timeout });
            client.ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }), error => { if (error) { clearTimeout(timeout); client.pending.delete(id); reject(error); } });
        });
    }

    function steamPluginProgress(update) {
        const translations = getSteamPluginTranslations(configStore.get().language);
        const labels = translations.progress;
        const stage = String(update?.stage || '').toLowerCase();
        const normalizedStage = stage === 'downloading-manifests' ? 'downloading' : stage;
        return {
            message: labels[normalizedStage] || translations.adding,
            progress: Number.isFinite(update?.percent) ? update.percent : null
        };
    }

    function startAdd(appId, name) {
        if (isInstalled(appId)) return { success: true, installed: true };
        const existing = addOperations.get(appId);
        if (existing?.pending) return { success: true, pending: true, message: existing.message, progress: existing.progress };
        const operation = { pending: true, result: null, message: getSteamPluginTranslations(configStore.get().language).adding, progress: null };
        addOperations.set(appId, operation);
        Promise.resolve(addGamesService.installNow({ selected: { appId, name: String(name || 'Jogo Steam').trim() } }, {
            progress: update => {
                const progress = steamPluginProgress(update);
                operation.message = progress.message;
                operation.progress = progress.progress;
            }
        }))
            .then(result => { operation.pending = false; operation.result = result; })
            .catch(error => { operation.pending = false; operation.result = { success: false, code: 'install_failed', message: error.message }; });
        return { success: true, pending: true, message: operation.message, progress: operation.progress };
    }

    function scheduleOpenView(view) {
        if (pendingOpenTimer) clearTimeout(pendingOpenTimer);
        // The Store CEF regains focus after a CDP command completes. Run the window
        // restore after its response has been returned, matching LuaTools' local
        // bridge behavior instead of competing with the originating page event.
        pendingOpenTimer = setTimeout(() => {
            pendingOpenTimer = null;
            try { openView(view); } catch (error) { logger.error?.('Merlin Steam plugin open:', error); }
        }, 120);
    }

    async function dispatch(command) {
        if (!command || (!/^[0-9]+$/.test(String(command.payload?.appId || '')) && (command.kind === 'add' || command.kind === 'status' || command.kind === 'remove'))) return { success: false, code: 'invalid_request' };
        if (command.kind === 'open') { scheduleOpenView(command.payload?.view); return { success: true }; }
        if (command.kind === 'add') return startAdd(String(command.payload.appId), command.payload.name);
        if (command.kind === 'remove') return libraryService?.remove
            ? libraryService.remove(String(command.payload.appId))
            : { success: false, code: 'remove_unavailable' };
        if (command.kind === 'status') {
            const appId = String(command.payload.appId);
            const operation = addOperations.get(appId);
            if (isInstalled(appId)) {
                if (operation) {
                    operation.pending = false;
                    operation.result = { success: true, installed: true };
                }
                return { success: true, installed: true };
            }
            if (operation?.result?.success) {
                return { success: false, code: 'not_installed' };
            }
            if (!operation) return isInstalled(appId)
                ? { success: true, installed: true }
                : { success: false, code: 'operation_not_found' };
            return operation.pending
                ? { success: true, pending: true, message: operation.message, progress: operation.progress }
                : operation.result;
        }
        return { success: false, code: 'invalid_request' };
    }

    async function synchronizePageState(tab) {
        const appId = appIdFromUrl(tab.url);
        if (!appId) return;
        const operation = addOperations.get(appId);
        const state = isInstalled(appId)
            ? { installed: true }
            : operation?.result?.success
                ? { installed: false }
                : operation && !operation.pending
                    ? { result: operation.result }
                    : null;
        if (!state) return;
        await evaluate(tab,
            'window.__merlinSteamPluginState=window.__merlinSteamPluginState||{};'
            + 'window.__merlinSteamPluginState[' + JSON.stringify(appId) + ']=' + JSON.stringify(state) + ';'
        );
    }

    async function tick() {
        if (!enabled() || ticking) return;
        ticking = true;
        const recordError = error => {
            const message = error?.message || String(error);
            const waitingForSteam = error?.code === 'ECONNREFUSED' || error?.code === 'ECONNRESET'
                || /ECONNREFUSED|ECONNRESET|CDP da Steam não respondeu/i.test(message);
            if (!waitingForSteam && lastError !== message) logger.debug?.('Merlin Steam plugin:', message);
            lastError = message;
        };
        try {
            if (!markerExists(markerPath()) && config().markerOwned) await createMarker();
            const tabs = await readCdpTabs(); const active = new Set(); targetCount = 0;
            let tabError = null;
            for (const tab of tabs) {
                if (!/store\.steampowered\.com/i.test(tab.url || '') || !tab.webSocketDebuggerUrl) continue;
                active.add(tab.id); targetCount++;
                try {
                    const language = configStore.get().language || 'ptbr';
                    const alive = await evaluate(tab, `String(window.__merlinSteamPluginVersion === ${JSON.stringify(PLUGIN_VERSION)} && window.__merlinSteamPluginLanguage === ${JSON.stringify(language)} && window.__merlinSteamPluginReady === true)`);
                    if (alive !== 'true') await evaluate(tab, buildMerlinStoreScript({ language }));
                    await synchronizePageState(tab);
                    const queued = await evaluate(tab, 'JSON.stringify(window.__merlinSteamPluginRequests || [])');
                    for (const command of JSON.parse(queued || '[]')) {
                        const result = await dispatch(command);
                        await evaluate(tab, `(()=>{window.__merlinSteamPluginReplies[${JSON.stringify(command.id)}]=${JSON.stringify(result)};const queue=window.__merlinSteamPluginRequests||[];for(let index=queue.length-1;index>=0;index--){if(queue[index]&&queue[index].id===${JSON.stringify(command.id)})queue.splice(index,1);}})()`);
                        logger.debug?.(`Merlin Steam plugin: processed ${command.kind} request ${command.id}.`);
                    }
                } catch (error) {
                    sockets.get(tab.id)?.ws.terminate();
                    sockets.delete(tab.id);
                    tabError ||= error;
                }
            }
            for (const [id, client] of sockets) if (!active.has(id)) client.ws.terminate();
            if (tabError) recordError(tabError);
            else lastError = null;
        } catch (error) {
            closeSockets();
            recordError(error);
        } finally { ticking = false; }
    }

    async function install() { const markerOwned = await createMarker(); configStore.update({ steamPlugin: { ...config(), enabled: true, markerOwned, startAtLogin: config().enabled ? config().startAtLogin !== false : true } }); start(); return status(); }
    async function uninstall() { stop(); await removeOwnedMarker(); configStore.update({ steamPlugin: { ...config(), enabled: false, markerOwned: false, startAtLogin: false } }); return status(); }
    function start() { if (!interval && enabled()) { running = true; interval = setInterval(() => void tick(), 200); void tick(); } }
    function stop() { if (interval) clearInterval(interval); if (pendingOpenTimer) clearTimeout(pendingOpenTimer); interval = null; pendingOpenTimer = null; running = false; ticking = false; targetCount = 0; closeSockets(); addOperations.clear(); }
    return { install, uninstall, status, start, stop, tick };
}

module.exports = { CDP_URL, MARKER_NAME, createSteamPluginService };
