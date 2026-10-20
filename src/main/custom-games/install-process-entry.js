const { sanitizeInstallProgress, sanitizeInstallResult } = require('./install-process');

/** Exported for protocol tests; production uses Electron's process.parentPort. */
function startInstallProcess({ parentPort = process.parentPort, createService,
    axios, exit = code => process.exit(code), tokenTimeoutMs = 20000 } = {}) {
    if (!parentPort) throw new Error('install_process_parent_missing');
    let activeJob = null;
    let service = null;
    let stopping = false;
    let nextRequest = 0;
    let exitTimer;
    const tokenRequests = new Map();
    const post = message => { try { parentPort.postMessage(message); } catch { /* Parent may already be closing. */ } };
    const failTokenRequests = () => {
        for (const pending of tokenRequests.values()) { clearTimeout(pending.timer); pending.reject(new Error('authentication_failed')); }
        tokenRequests.clear();
    };
    const finish = (jobId, result) => {
        failTokenRequests();
        post({ type: 'result', jobId, result: sanitizeInstallResult(result) });
        activeJob = null;
        // Give the message port time to dispatch the result before exiting.
        exitTimer = setTimeout(() => exit(0), 250);
    };
    const getAccessToken = () => {
        if (!activeJob || stopping) return Promise.reject(new Error('authentication_failed'));
        const jobId = activeJob;
        const requestId = `token:${++nextRequest}`;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { tokenRequests.delete(requestId); reject(new Error('authentication_failed')); }, tokenTimeoutMs);
            tokenRequests.set(requestId, { resolve, reject, timer });
            post({ type: 'access-token-request', jobId, requestId });
        });
    };
    const receive = async event => {
        const message = event?.data;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'start') {
            if (activeJob || stopping) return;
            if (typeof message.jobId !== 'string' || typeof message.id !== 'string' ||
                !/^[C-Z]$/i.test(String(message.letter || '')) || typeof message.userData !== 'string' ||
                !message.userData || !Array.isArray(message.catalog) ||
                (message.mode != null && !['install', 'update', 'repair'].includes(message.mode)) ||
                message.mode === 'repair' && (typeof message.archiveKey !== 'string' || !message.archiveKey ||
                    !Array.isArray(message.repairPaths) || !message.repairPaths.length || message.repairPaths.length > 100000 ||
                    message.repairPaths.some(relative => typeof relative !== 'string' || relative.length > 32767))) {
                return finish(message.jobId, { success: false, code: 'invalid_install_request' });
            }
            let api;
            try { api = new URL(message.apiBaseUrl); }
            catch { return finish(message.jobId, { success: false, code: 'invalid_install_request' }); }
            if (!['https:', 'http:'].includes(api.protocol) || api.username || api.password) {
                return finish(message.jobId, { success: false, code: 'invalid_install_request' });
            }
            activeJob = message.jobId;
            try {
                const factory = createService || require('./custom-games-service').createCustomGamesService;
                service = factory({ app: { getPath: name => {
                    if (name !== 'userData') throw new Error('unsupported_app_path');
                    return message.userData;
                } }, axios: axios || require('axios'), authSession: { getAccessToken }, apiBaseUrl: message.apiBaseUrl,
                initialCatalog: message.catalog,
                // Opening folders, launching games and uninstalling stay in the
                // main process. This child owns installation only.
                shell: {
                    openPath: async () => { throw new Error('unsupported_install_operation'); },
                    trashItem: async () => { throw new Error('unsupported_install_operation'); },
                } });
                const jobId = activeJob;
                const progress = value => {
                    const progress = sanitizeInstallProgress(value);
                    if (progress) post({ type: 'progress', jobId, progress });
                };
                const result = ['update', 'repair'].includes(message.mode)
                    ? await service.update(message.id, progress, message.mode === 'repair'
                        ? { repair: true, archiveKey: message.archiveKey, repairPaths: message.repairPaths } : {})
                    : await service.install(message.id, message.letter, progress);
                finish(jobId, result);
            } catch { finish(message.jobId, { success: false, code: 'install_process_failed' }); }
        } else if (message.jobId === activeJob && message.type === 'access-token-response') {
            const pending = tokenRequests.get(message.requestId);
            if (!pending) return;
            tokenRequests.delete(message.requestId); clearTimeout(pending.timer);
            if (!message.error && typeof message.token === 'string' && message.token) pending.resolve(message.token);
            else pending.reject(new Error('authentication_failed'));
        } else if (message.jobId === activeJob && message.type === 'cancel') {
            try { await service?.cancel(); } catch { /* install() reports its final result separately. */ }
        } else if (message.type === 'shutdown' && (!activeJob || message.jobId === activeJob)) {
            stopping = true;
            failTokenRequests();
            // suspend() aborts I/O without setting cancelRequested, preserving
            // downloaded parts for the next app launch.
            try { await service?.suspend?.(); } catch { /* Parent has a bounded shutdown fallback. */ }
            if (!activeJob) exit(0);
        }
    };
    parentPort.on('message', event => { void receive(event).catch(() => {
        if (activeJob) finish(activeJob, { success: false, code: 'install_process_failed' });
    }); });
    post({ type: 'ready' });
    return { stop: () => { stopping = true; clearTimeout(exitTimer); failTokenRequests(); } };
}

if (require.main === module && process.parentPort) startInstallProcess();
module.exports = { startInstallProcess };
