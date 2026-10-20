const path = require('node:path');
const { randomUUID } = require('node:crypto');

const FAILURE = Object.freeze({ success: false, code: 'install_process_failed', error: 'install_process_failed' });
const PROGRESS_NUMBERS = ['received', 'total', 'completedFiles', 'totalFiles', 'files', 'bytes', 'totalBytes',
    'installedFiles', 'totalInstallFiles', 'extractedBytes', 'extractionTotalBytes',
    'speedBytesPerSecond', 'etaSeconds', 'extractionSpeedBytesPerSecond', 'extractionEtaSeconds', 'retryAttempt', 'maxAttempts',
    'updatedFiles', 'removedFiles', 'unchangedFiles', 'protectedFiles'];
const PROGRESS_STRINGS = ['id', 'name', 'drive', 'stage', 'code', 'kind'];

function sanitizeInstallProgress(value) {
    if (!value || typeof value !== 'object') return null;
    const result = {};
    for (const key of PROGRESS_STRINGS) {
        if (typeof value[key] === 'string') result[key] = value[key].slice(0, key === 'name' ? 240 : 120);
    }
    if (!result.id || !result.stage) return null;
    for (const key of PROGRESS_NUMBERS) {
        if (value[key] === null) result[key] = null;
        else if (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0) result[key] = value[key];
    }
    if (typeof value.done === 'boolean') result.done = value.done;
    return result;
}

function sanitizeInstallResult(value) {
    if (!value || typeof value !== 'object' || typeof value.success !== 'boolean') return { ...FAILURE };
    if (value.success) {
        const result = { success: true, ...(typeof value.path === 'string' ? { path: value.path.slice(0, 32768) } : {}) };
        for (const field of ['updatedFiles', 'removedFiles', 'protectedFiles']) {
            if (Number.isSafeInteger(value[field]) && value[field] >= 0 && value[field] <= 100000) result[field] = value[field];
        }
        return result;
    }
    const code = typeof value.code === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value.code)
        ? value.code : 'install_process_failed';
    return { success: false, code, ...(code === 'install_process_failed' ? { error: code } : {}) };
}

/** One disposable utility process owns installation work; the Electron main process only bridges IPC. */
function createCustomGamesInstallRunner({ utilityProcess, app, authSession, apiBaseUrl,
    startupTimeoutMs = 20000, cancelTimeoutMs = 30000, shutdownTimeoutMs = 5000 } = {}) {
    let active = null;
    let disposed = false;
    let disposing = null;
    const terminatingChildren = new Set();

    const stopChild = child => { try { child?.kill(); } catch { /* Already exited. */ } };
    const post = (job, message) => {
        if (!job.child || job.settled) return false;
        try { job.child.postMessage({ ...message, jobId: job.jobId }); return true; }
        catch { settle(job, FAILURE); return false; }
    };
    function settle(job, result) {
        if (job.settled) return;
        job.settled = true;
        clearTimeout(job.startupTimer);
        clearTimeout(job.stopTimer);
        if (active === job) active = null;
        // Ignore late token refresh completions and late child messages.
        job.pendingTokenRequests.clear();
        if (job.child && !job.childExited) terminatingChildren.add(job.child);
        stopChild(job.child);
        job.resolve(sanitizeInstallResult(result));
    }

    function run({ id, letter, catalog, mode = 'install', archiveKey, repairPaths } = {}, onProgress = () => {}) {
        if (disposed) return Promise.resolve({ ...FAILURE });
        if (active || terminatingChildren.size) return Promise.resolve({ success: false, code: 'busy' });
        if (typeof id !== 'string' || !id || id.length > 120 || !/^[C-Z]$/i.test(String(letter || '')) || !Array.isArray(catalog) ||
            !['install', 'update', 'repair'].includes(mode) || mode === 'repair' &&
                (typeof archiveKey !== 'string' || !archiveKey || !Array.isArray(repairPaths) || !repairPaths.length ||
                    repairPaths.length > 100000 || repairPaths.some(relative => typeof relative !== 'string' || relative.length > 32767))) {
            return Promise.resolve({ success: false, code: 'invalid_install_request' });
        }
        const job = { jobId: randomUUID(), id, letter: letter.toUpperCase(), child: null, settled: false,
            started: false, cancelRequested: false, progress: null, pendingTokenRequests: new Set() };
        job.promise = new Promise(resolve => { job.resolve = resolve; });
        active = job;
        const handleMessage = message => {
            if (job.settled || !message || typeof message !== 'object') return;
            if (message.type === 'ready' && !job.started) {
                clearTimeout(job.startupTimer);
                if (disposed || job.cancelRequested) return settle(job, { success: false, code: 'cancelled' });
                job.started = true;
                post(job, { type: 'start', id, letter: job.letter, catalog, mode,
                    ...(mode === 'repair' ? { archiveKey, repairPaths } : {}),
                    userData: app.getPath('userData'), apiBaseUrl });
                return;
            }
            if (!job.started || message.jobId !== job.jobId) return;
            if (message.type === 'progress') {
                const progress = sanitizeInstallProgress(message.progress);
                if (!progress || progress.id !== id) return;
                job.progress = progress;
                try { onProgress(progress); } catch { /* A reloading renderer must not stop the installer. */ }
            } else if (message.type === 'result') {
                settle(job, message.result);
            } else if (message.type === 'access-token-request') {
                const requestId = message.requestId;
                if (typeof requestId !== 'string' || !/^[A-Za-z0-9_:-]{1,100}$/.test(requestId) ||
                    job.pendingTokenRequests.has(requestId) || job.pendingTokenRequests.size >= 32) return;
                job.pendingTokenRequests.add(requestId);
                Promise.resolve().then(() => authSession.getAccessToken()).then(token => {
                    if (!job.settled && !disposed && job.pendingTokenRequests.has(requestId)) {
                        post(job, { type: 'access-token-response', requestId,
                            ...(typeof token === 'string' && token.length > 0 && token.length <= 65536
                                ? { token } : { error: 'authentication_failed' }) });
                    }
                }, () => {
                    if (!job.settled && !disposed) post(job, { type: 'access-token-response', requestId, error: 'authentication_failed' });
                }).finally(() => job.pendingTokenRequests.delete(requestId));
            }
        };
        Promise.resolve().then(async () => {
            if (app.isReady?.() !== true && typeof app.whenReady === 'function') await app.whenReady();
            if (job.settled || disposed) return settle(job, { success: false, code: 'cancelled' });
            job.child = utilityProcess.fork(path.join(__dirname, 'install-process-entry.js'), [], {
                stdio: 'ignore', serviceName: 'Merlin Game Installer',
            });
            job.child.on('message', handleMessage);
            job.child.on('error', () => settle(job, FAILURE));
            job.child.once('exit', () => {
                job.childExited = true;
                terminatingChildren.delete(job.child);
                settle(job, FAILURE);
            });
            job.startupTimer = setTimeout(() => settle(job, FAILURE), startupTimeoutMs);
        }).catch(() => settle(job, FAILURE));
        return job.promise;
    }

    async function cancel() {
        const job = active;
        if (!job) return { success: false, code: 'not_running' };
        if (!job.cancelRequested) {
            job.cancelRequested = true;
            if (!job.started) settle(job, { success: false, code: 'cancelled' });
            else {
                post(job, { type: 'cancel' });
                if (!job.settled) job.stopTimer = setTimeout(() => settle(job, FAILURE), cancelTimeoutMs);
            }
        }
        const result = await job.promise;
        return result.success || result.code === 'cancelled' ? { success: true } : result;
    }

    function dispose() {
        if (disposing) return disposing;
        disposed = true;
        disposing = (async () => {
            const job = active;
            if (!job) return;
            if (!job.started) return settle(job, { success: false, code: 'cancelled' });
            // Shutdown preserves partial files. Explicit user cancellation uses the
            // separate cancel message and intentionally removes partial files.
            post(job, { type: 'shutdown' });
            clearTimeout(job.stopTimer);
            if (!job.settled) job.stopTimer = setTimeout(() => settle(job, FAILURE), shutdownTimeoutMs);
            await job.promise;
        })();
        return disposing;
    }

    return { run, cancel, dispose, pending: () => Boolean(active || terminatingChildren.size),
        isRunning: () => Boolean(active), snapshot: () => active?.progress ? { ...active.progress } : null };
}

module.exports = { createCustomGamesInstallRunner, sanitizeInstallProgress, sanitizeInstallResult };
