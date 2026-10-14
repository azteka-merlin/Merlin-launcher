const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const { setTimeout: delay } = require('node:timers/promises');
const AdmZip = require('adm-zip');
const { createCustomGamesService } = require('../src/main/custom-games/custom-games-service');
const { createTransferMeter, createTaskLimiter } = require('../src/main/custom-games/transfer-progress');

const digest = data => createHash('sha256').update(data).digest('hex');
function fixture({ bundles = 3, direct = true } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-pipeline-'));
    const disk = path.join(root, 'disk'); fs.mkdirSync(disk);
    const item = { id: randomUUID(), name: 'Pipeline fixture', installName: 'Pipeline fixture',
        archiveKey: randomUUID(), packageType: 'folder', executablePath: null };
    const objects = new Map();
    const manifest = { gameId: item.id, totalSizeBytes: 0, files: [], bundles: [] };
    if (direct) {
        const data = Buffer.from('direct file'); const id = randomUUID(); objects.set(id, data);
        manifest.files.push({ id, path: 'Data/direct.bin', sizeBytes: data.length, sha256: digest(data) });
        manifest.totalSizeBytes += data.length;
    }
    for (let i = 0; i < bundles; i++) {
        const zip = new AdmZip(); const members = [];
        for (let j = 0; j < 5; j++) {
            const data = Buffer.alloc(32 * 1024, i + j); const relative = `Data/part-${i}-${j}.bin`;
            zip.addFile(relative, data); members.push({ path: relative, sizeBytes: data.length, sha256: digest(data) });
            manifest.totalSizeBytes += data.length;
        }
        const data = zip.toBuffer(); const id = randomUUID(); objects.set(id, data);
        manifest.bundles.push({ id, sizeBytes: data.length, sha256: digest(data), files: members });
    }
    item.archiveSize = manifest.totalSizeBytes;
    const stateFile = path.join(disk, 'Merlin-games', '.merlin-downloads', `${item.id}.folder.json`);
    const staging = path.join(disk, 'Merlin-games', `.merlin-installing-${item.id}`);
    let beforeRequest = async () => {};
    const requests = [];
    const axios = { get: async (url, options = {}) => {
        if (url.endsWith('/manifest')) return { data: manifest };
        if (url.endsWith('/custom-games')) return { data: { games: [item] } };
        const id = url.split('/').at(-1); requests.push(id);
        await beforeRequest(id, options);
        const data = objects.get(id); const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
        return { status: 206, headers: { 'content-range': `bytes ${from}-${to}/${data.length}` },
            data: Readable.from([data.subarray(Number(from), Number(to) + 1)]) };
    } };
    const create = extra => createCustomGamesService({ app: { getPath: () => root }, axios,
        initialCatalog: [item], authSession: { getAccessToken: async () => 'fixture' },
        apiBaseUrl: 'https://example.test/api', shell: {}, testDriveRoot: () => disk, ...extra });
    return { root, item, manifest, objects, stateFile, staging, requests, create,
        intercept: fn => { beforeRequest = fn; }, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
async function waitUntil(predicate) {
    const until = Date.now() + 30000;
    while (!predicate()) {
        if (Date.now() >= until) throw new Error('fixture_timeout');
        await delay(10);
    }
}
const completed = f => {
    try { return JSON.parse(fs.readFileSync(f.stateFile, 'utf8')).extractedBundles || []; } catch { return []; }
};

test('bundle extraction overlaps remaining downloads and counters span all bundles', async () => {
    const f = fixture();
    try {
        let checkpointBeforeLastDownload = false;
        f.intercept(async id => {
            if (id !== f.manifest.files[0].id) return;
            await waitUntil(() => completed(f).length > 0);
            checkpointBeforeLastDownload = true;
            assert.equal(fs.existsSync(path.join(path.dirname(f.staging), f.item.installName)), false);
        });
        const progress = [];
        const result = await f.create().install(f.item.id, 'X', value => progress.push(value));
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(checkpointBeforeLastDownload, true);
        const snapshots = progress.filter(value => Number.isInteger(value.installedFiles));
        assert.ok(snapshots.every(value => value.totalInstallFiles === 16));
        assert.equal(snapshots.at(-1).installedFiles, 16);
        assert.equal(snapshots.at(-1).extractedBytes, 15 * 32 * 1024);
        assert.equal(snapshots.at(-1).extractionTotalBytes, 15 * 32 * 1024);
        assert.ok(snapshots.every((value, i) => i === 0 || value.installedFiles >= snapshots[i - 1].installedFiles));
        assert.equal(fs.existsSync(f.stateFile), false);
        assert.equal(fs.existsSync(f.staging), false);
    } finally { f.cleanup(); }
});

test('suspending keeps validated extracted bundles and resume does not redownload them', async () => {
    const f = fixture({ bundles: 2 });
    try {
        f.intercept(async (id, options) => {
            if (id !== f.manifest.files[0].id) return;
            await new Promise((resolve, reject) => {
                options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
            });
        });
        const service = f.create();
        const pending = service.install(f.item.id, 'X');
        await waitUntil(() => completed(f).length === 2);
        await service.suspend();
        assert.equal((await pending).success, false);
        assert.equal(fs.existsSync(f.staging), true);
        const previous = f.requests.length;
        f.intercept(async () => {});
        const result = await f.create().install(f.item.id, 'X');
        assert.equal(result.success, true, JSON.stringify(result));
        assert.deepEqual(f.requests.slice(previous), [f.manifest.files[0].id]);
    } finally { f.cleanup(); }
});

test('resume revalidates extracted output and redownloads only the damaged bundle', async () => {
    const f = fixture({ bundles: 2 });
    try {
        f.intercept(async (id, options) => {
            if (id !== f.manifest.files[0].id) return;
            await new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
        });
        const service = f.create(); const pending = service.install(f.item.id, 'X');
        await waitUntil(() => completed(f).length === 2);
        await service.suspend(); await pending;
        const damaged = f.manifest.bundles[0];
        fs.writeFileSync(path.join(f.staging, damaged.files[0].path), Buffer.alloc(damaged.files[0].sizeBytes, 255));
        const previous = f.requests.length; f.intercept(async () => {});
        const result = await f.create().install(f.item.id, 'X');
        assert.equal(result.success, true, JSON.stringify(result));
        assert.deepEqual(new Set(f.requests.slice(previous)), new Set([f.manifest.files[0].id, damaged.id]));
    } finally { f.cleanup(); }
});

test('explicit cancellation clears pipelined extraction and resume state', async () => {
    const f = fixture();
    try {
        f.intercept(async (id, options) => {
            if (id !== f.manifest.files[0].id) return;
            await new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
        });
        const service = f.create(); const pending = service.install(f.item.id, 'X');
        await waitUntil(() => completed(f).length > 0);
        assert.deepEqual(await service.cancel(), { success: true }); await pending;
        assert.equal(fs.existsSync(f.staging), false);
        assert.equal(fs.existsSync(f.stateFile), false);
    } finally { f.cleanup(); }
});

test('fresh direct downloads hash during writing without rereading the completed file', async () => {
    const f = fixture({ bundles: 0 }); const original = fs.createReadStream; let rereads = 0;
    try {
        fs.createReadStream = function(filename, ...args) {
            if (String(filename).endsWith('direct.bin')) rereads++;
            return original.call(this, filename, ...args);
        };
        const result = await f.create().install(f.item.id, 'X');
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(rereads, 0);
    } finally { fs.createReadStream = original; f.cleanup(); }
});

test('extraction meter considers the tail of small files and does not reset between bundles', () => {
    const meter = createTransferMeter();
    assert.equal(meter.update(0, 1000, 0, 100, 1000).etaSeconds, null);
    const first = meter.update(900, 1000, 10, 100, 11000);
    assert.equal(first.speedBytesPerSecond, 90);
    assert.equal(first.etaSeconds, 90); // Bytes alone would incorrectly predict two seconds.
    const second = meter.update(950, 1000, 60, 100, 21000);
    assert.ok(second.etaSeconds > 0 && second.etaSeconds < first.etaSeconds);
    assert.equal(meter.update(1000, 1000, 100, 100, 22000).etaSeconds, 0);
});

test('extraction limiter never runs more than two jobs and drains failures safely', async () => {
    const limit = createTaskLimiter(2); let running = 0; let maximum = 0;
    const jobs = Array.from({ length: 8 }, (_, i) => limit(async () => {
        running++; maximum = Math.max(maximum, running);
        try { await delay(5); if (i === 2) throw new Error('fixture'); }
        finally { running--; }
    }));
    const results = await Promise.allSettled(jobs);
    assert.equal(maximum, 2); assert.equal(running, 0);
    assert.equal(results.filter(value => value.status === 'rejected').length, 1);
});

test('main-side service stays responsive, single-install and reports a child crash as terminal', async () => {
    const f = fixture({ bundles: 0 });
    try {
        let finish; let relay;
        const runner = { run: (_args, callback) => { relay = callback; return new Promise(resolve => { finish = resolve; }); },
            cancel: async () => ({ success: true }) };
        const service = f.create({ installRunner: runner }); const progress = [];
        const pending = service.install(f.item.id, 'X', value => progress.push(value));
        relay({ id: f.item.id, stage: 'downloading', received: 1, total: 11 });
        assert.equal((await service.list()).operation.stage, 'downloading');
        assert.equal((await service.install(f.item.id, 'X')).code, 'busy');
        assert.equal((await service.uninstall(f.item.id)).code, 'busy');
        finish({ success: false, code: 'install_process_failed' });
        assert.equal((await pending).code, 'install_process_failed');
        assert.equal(progress.at(-1).stage, 'failed');
        assert.equal((await service.list()).operation, null);
    } finally { f.cleanup(); }
});
