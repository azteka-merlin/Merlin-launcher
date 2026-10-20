const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setImmediate: tick } = require('node:timers/promises');
const { createCustomGamesInstallRunner, sanitizeInstallProgress } = require('../src/main/custom-games/install-process');
const { startInstallProcess } = require('../src/main/custom-games/install-process-entry');

const item = { id: 'game-123456', name: 'Example', installName: 'Example', archiveKey: 'archive', archiveSize: 4 };
const request = { id: item.id, letter: 'C', catalog: [item] };
class FakeChild extends EventEmitter {
    constructor() { super(); this.messages = []; this.kills = 0; }
    postMessage(message) { this.messages.push(message); }
    kill() { this.kills++; this.emit('exit', 0); return true; }
    ready() { this.emit('message', { type: 'ready' }); }
    send(type, data = {}) {
        const jobId = this.messages.find(message => message.type === 'start')?.jobId;
        this.emit('message', { type, jobId, ...data });
    }
}
function harness(overrides = {}) {
    const children = []; const forkCalls = [];
    const utilityProcess = { fork(...args) { forkCalls.push(args); const child = new FakeChild(); children.push(child); return child; } };
    const runner = createCustomGamesInstallRunner({ utilityProcess,
        app: { isReady: () => true, getPath: () => 'C:\\Users\\Example\\Merlin' },
        authSession: { getAccessToken: async () => 'private-test-token' }, apiBaseUrl: 'https://api.example/api',
        startupTimeoutMs: 2000, cancelTimeoutMs: 30, shutdownTimeoutMs: 30, ...overrides });
    return { runner, children, forkCalls, async child() { await tick(); return children.at(-1); } };
}

test('installer utility process reports bounded progress and a result while leaving the main runner reusable', async () => {
    const h = harness(); const events = [];
    const pending = h.runner.run(request, value => events.push(value));
    assert.equal(h.runner.pending(), true);
    assert.deepEqual(await h.runner.run(request), { success: false, code: 'busy' });
    const child = await h.child(); child.ready();
    assert.equal(h.forkCalls[0][2].stdio, 'ignore');
    assert.equal(h.forkCalls[0][2].serviceName, 'Merlin Game Installer');
    assert.ok(h.forkCalls[0][0].endsWith('install-process-entry.js'));
    child.send('progress', { progress: { id: item.id, stage: 'extracting', name: item.name,
        installedFiles: 10, totalInstallFiles: 20, extractedBytes: 100, extractionTotalBytes: 200,
        extractionSpeedBytesPerSecond: 5, extractionEtaSeconds: 20, files: 2, totalFiles: 3, bytes: 10,
        totalBytes: 30, token: 'do-not-forward', etaSeconds: null, invalid: Infinity } });
    assert.equal(events.length, 1);
    assert.equal(events[0].extractionEtaSeconds, 20);
    assert.equal(events[0].installedFiles, 10);
    assert.equal(events[0].token, undefined);
    assert.equal(events[0].invalid, undefined);
    assert.deepEqual(h.runner.snapshot(), events[0]);
    child.send('result', { result: { success: true, path: 'C:\\Merlin-games\\Example', token: 'ignored' } });
    assert.deepEqual(await pending, { success: true, path: 'C:\\Merlin-games\\Example' });
    assert.equal(h.runner.pending(), false);
    assert.equal(child.kills, 1);
    assert.equal(h.runner.snapshot(), null);
    const second = h.runner.run(request);
    const secondChild = await h.child(); secondChild.ready(); secondChild.send('result', { result: { success: false, code: 'disk_space' } });
    assert.deepEqual(await second, { success: false, code: 'disk_space' });
    await h.runner.dispose();
});

test('installer asks the parent for a fresh token and does not serialize it in startup arguments', async () => {
    let calls = 0;
    const h = harness({ authSession: { getAccessToken: async () => { calls++; return 'private-test-token'; } } });
    const pending = h.runner.run(request); const child = await h.child(); child.ready();
    assert.equal(JSON.stringify(h.forkCalls).includes('private-test-token'), false);
    assert.equal(JSON.stringify(child.messages).includes('private-test-token'), false);
    child.send('access-token-request', { requestId: 'token:1' });
    child.send('access-token-request', { requestId: 'token:1' });
    await tick();
    assert.equal(calls, 1);
    assert.equal(child.messages.find(message => message.type === 'access-token-response').token, 'private-test-token');
    child.send('access-token-request', { requestId: '../bad' }); await tick(); assert.equal(calls, 1);
    child.send('result', { result: { success: false, code: 'cancelled' } }); await pending;
    child.send('access-token-request', { requestId: 'token:2' }); await tick(); assert.equal(calls, 1);
    await h.runner.dispose();
});

test('child crash, V8 error or failed spawn settles one installation and keeps the main process usable', async () => {
    for (const failure of ['exit', 'error']) {
        const h = harness(); const events = [];
        const pending = h.runner.run(request, value => events.push(value)); const child = await h.child(); child.ready();
        child.emit(failure, failure === 'error' ? 'FatalError' : 137);
        assert.deepEqual(await pending, { success: false, code: 'install_process_failed', error: 'install_process_failed' });
        child.send('result', { result: { success: true } });
        child.send('progress', { progress: { id: item.id, stage: 'downloading' } });
        assert.equal(events.length, 0);
        assert.equal(child.kills, 1);
        assert.equal(h.runner.pending(), false);
        await h.runner.dispose();
    }
    const h = harness({ utilityProcess: { fork() { throw new Error('spawn failure'); } } });
    assert.equal((await h.runner.run(request)).code, 'install_process_failed');
    await h.runner.dispose();
});

test('a timed-out child remains a one-installer lock until its exit event arrives', async () => {
    const h = harness();
    const pending = h.runner.run(request);
    const child = await h.child(); child.ready();
    child.kill = () => true;
    child.emit('error', new Error('fixture child failure'));
    assert.deepEqual(await pending, { success: false, code: 'install_process_failed', error: 'install_process_failed' });
    assert.equal(h.runner.pending(), true);
    assert.deepEqual(await h.runner.run(request), { success: false, code: 'busy' });
    child.emit('exit', 1);
    assert.equal(h.runner.pending(), false);
    const next = h.runner.run(request); const nextChild = await h.child(); nextChild.ready();
    nextChild.send('result', { result: { success: false, code: 'game_not_found' } });
    await next; await h.runner.dispose();
});

test('shutdown distinguishes an active install from a child already terminating', async () => {
    const h = harness(); const pending = h.runner.run(request); const child = await h.child(); child.ready();
    child.kill = () => true;
    child.emit('error', new Error('fixture child failure'));
    await pending;
    assert.equal(h.runner.pending(), true);
    assert.equal(h.runner.isRunning(), false);
    await h.runner.dispose();
    child.emit('exit', 1);
    assert.equal(h.runner.pending(), false);
});

test('failed token refresh returns a fixed error without leaking exception contents or keeping a dead child alive', async () => {
    const h = harness({ authSession: { getAccessToken: async () => { throw new Error('secret-token-in-diagnostic'); } } });
    const pending = h.runner.run(request); const child = await h.child(); child.ready();
    child.send('access-token-request', { requestId: 'token:1' }); await tick();
    const response = child.messages.find(message => message.type === 'access-token-response');
    assert.equal(response.error, 'authentication_failed');
    assert.equal(JSON.stringify(child.messages).includes('secret-token-in-diagnostic'), false);
    child.send('result', { result: { success: false, code: 'authentication_failed' } });
    assert.equal((await pending).code, 'authentication_failed'); await h.runner.dispose();
});

test('startup timeout settles an unresponsive utility process', async () => {
    const h = harness({ startupTimeoutMs: 5 });
    const pending = h.runner.run(request); const child = await h.child();
    assert.equal((await pending).code, 'install_process_failed'); assert.equal(child.kills, 1);
    await h.runner.dispose();
});

test('explicit cancellation waits for the child, while disposal requests suspension preserving partial files', async () => {
    const h = harness(); const pending = h.runner.run(request); const child = await h.child(); child.ready();
    const cancel = h.runner.cancel();
    assert.equal(child.messages.at(-1).type, 'cancel');
    child.send('result', { result: { success: false, code: 'cancelled' } });
    assert.deepEqual(await cancel, { success: true }); assert.equal((await pending).code, 'cancelled');
    const next = h.runner.run(request); const another = await h.child(); another.ready();
    const disposing = h.runner.dispose();
    assert.equal(another.messages.at(-1).type, 'shutdown');
    assert.equal(another.messages.some(message => message.type === 'cancel'), false);
    another.send('result', { result: { success: false, code: 'cancelled' } });
    await disposing; await next;
    assert.equal((await h.runner.run(request)).code, 'install_process_failed');
});

test('no utility process forks before app readiness or after an early shutdown', async () => {
    let ready;
    const h = harness({ app: { isReady: () => false, whenReady: () => new Promise(resolve => { ready = resolve; }), getPath: () => '/data' } });
    const pending = h.runner.run(request); await tick(); assert.equal(h.children.length, 0);
    await h.runner.dispose(); assert.equal((await pending).code, 'cancelled');
    ready(); await tick(); assert.equal(h.children.length, 0);
});

test('unresponsive child is killed after bounded shutdown without affecting the parent', async () => {
    const h = harness({ shutdownTimeoutMs: 5 });
    const pending = h.runner.run(request); const child = await h.child(); child.ready();
    await h.runner.dispose(); assert.equal(child.kills, 1); assert.equal((await pending).code, 'install_process_failed');
});

test('child entry constructs the existing engine and obtains tokens only through the parent port', async () => {
    const port = new EventEmitter(); const sent = []; port.postMessage = message => sent.push(message);
    let options; let finishInstall; let suspendCalls = 0; let cancelCalls = 0;
    const protocol = startInstallProcess({ parentPort: port, axios: { mocked: true }, exit: () => {},
        createService: value => {
            options = value;
            return { async install(id, letter, onProgress) {
                assert.equal(id, item.id); assert.equal(letter, 'C');
                const token = await value.authSession.getAccessToken(); assert.equal(token, 'child-private-token');
                onProgress({ id, stage: 'verifying', bytes: 2, totalBytes: 4, token: 'must-not-forward' });
                return new Promise(resolve => { finishInstall = resolve; });
            }, async suspend() { suspendCalls++; finishInstall({ success: false, code: 'cancelled' }); },
            async cancel() { cancelCalls++; finishInstall({ success: false, code: 'cancelled' }); } };
        } });
    assert.equal(sent[0].type, 'ready');
    const send = message => port.emit('message', { data: { ...message, jobId: 'job-1' } });
    send({ type: 'start', ...request, userData: '/example/user-data', apiBaseUrl: 'https://api.example/api' });
    await tick();
    assert.equal(options.app.getPath('userData'), '/example/user-data');
    assert.deepEqual(options.initialCatalog, request.catalog);
    assert.equal(options.installRunner, undefined);
    assert.equal(sent[1].type, 'access-token-request');
    send({ type: 'access-token-response', requestId: sent[1].requestId, token: 'child-private-token' });
    await tick();
    const progress = sent.find(message => message.type === 'progress');
    assert.equal(progress.progress.token, undefined);
    send({ type: 'shutdown' }); await tick();
    assert.equal(suspendCalls, 1); assert.equal(cancelCalls, 0);
    assert.deepEqual(sent.find(message => message.type === 'result').result, { success: false, code: 'cancelled' });
    protocol.stop();
});

test('progress sanitizer only accepts fixed serializable fields and bounded values', () => {
    assert.equal(sanitizeInstallProgress(null), null);
    assert.equal(sanitizeInstallProgress({ stage: 'downloading' }), null);
    const value = sanitizeInstallProgress({ id: item.id, stage: 'downloading', received: -1, total: Infinity,
        etaSeconds: null, speedBytesPerSecond: 2, name: 'x'.repeat(300), auth: 'hidden' });
    assert.equal(value.received, undefined); assert.equal(value.total, undefined); assert.equal(value.name.length, 240);
    assert.equal(value.auth, undefined); assert.equal(value.etaSeconds, null);
});

test('repair jobs pass their pinned version and verified paths through the isolated worker without secrets', async () => {
    const h = harness();
    const pending = h.runner.run({ ...request, mode: 'repair', archiveKey: 'archives/installed.zip', repairPaths: ['data/bad.pak'] });
    const child = await h.child(); child.ready();
    const start = child.messages.find(message => message.type === 'start');
    assert.equal(start.mode, 'repair');
    assert.equal(start.archiveKey, 'archives/installed.zip');
    assert.deepEqual(start.repairPaths, ['data/bad.pak']);
    assert.equal(start.token, undefined);
    child.send('result', { result: { success: true, updatedFiles: 1, removedFiles: 0, protectedFiles: 2, secret: 'hidden' } });
    assert.deepEqual(await pending, { success: true, updatedFiles: 1, removedFiles: 0, protectedFiles: 2 });
});

test('worker repair dispatch uses the shared update engine with the exact installed version and forced paths', async () => {
    const port = new EventEmitter(); const sent = []; port.postMessage = message => sent.push(message);
    let received;
    const protocol = startInstallProcess({ parentPort: port, exit() {}, createService: () => ({
        update: async (...args) => { received = args; return { success: true, updatedFiles: 1, protectedFiles: 0 }; },
    }) });
    try {
        port.emit('message', { data: { type: 'start', jobId: 'repair-job', id: item.id, letter: 'C', catalog: [item],
            userData: 'C:\\MerlinData', apiBaseUrl: 'https://example.test/api', mode: 'repair',
            archiveKey: 'archives/installed.zip', repairPaths: ['data/bad.pak'] } });
        await tick();
        assert.equal(received[0], item.id);
        assert.deepEqual(received[2], { repair: true, archiveKey: 'archives/installed.zip', repairPaths: ['data/bad.pak'] });
        assert.equal(sent.find(message => message.type === 'result').result.updatedFiles, 1);
    } finally { protocol.stop(); }
});
