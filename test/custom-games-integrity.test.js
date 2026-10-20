const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createCustomGamesService } = require('../src/main/custom-games/custom-games-service');
const { normalizeIntegrityManifest } = require('../src/main/custom-games/integrity');

const hash = data => createHash('sha256').update(data).digest('hex');
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-integrity-'));
    const disk = path.join(root, 'disk');
    const item = { id: '00000000-0000-4000-8000-000000000001', name: 'Integrity Game',
        installName: 'Integrity Game', archiveKey: 'archives/version-one.zip', archiveSize: 100 };
    const target = path.join(disk, 'Merlin-games', item.installName);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, '.merlin-install.json'), JSON.stringify({ id: item.id, archiveKey: item.archiveKey }));
    fs.writeFileSync(path.join(root, 'custom-games-installs-example.test.json'), JSON.stringify({
        [item.id]: { drive: 'X', installName: item.installName, name: item.name },
    }));
    const content = [['game.exe', 'original'], ['data.pak', 'payload'], ['empty.dat', '']];
    const manifest = { version: 1, gameId: item.id, archiveKey: item.archiveKey,
        totalSizeBytes: 15, files: content.map(([file, data]) => ({ path: file, sizeBytes: Buffer.byteLength(data), sha256: hash(data) })) };
    for (const [file, data] of content) fs.writeFileSync(path.join(target, file), data);
    const requests = [];
    const create = extra => createCustomGamesService({ app: { getPath: () => root },
        initialCatalog: [item], testDriveRoot: () => disk, shell: {}, apiBaseUrl: 'https://example.test/api',
        authSession: { getAccessToken: async () => 'fixture' },
        axios: { get: async (url, options) => {
            requests.push({ url, options }); return { data: manifest };
        } }, ...extra });
    return { root, target, item, manifest, requests, create, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('integrity detects missing files and same-size corruption while leaving all local files untouched', async () => {
    const f = fixture();
    try {
        fs.writeFileSync(path.join(f.target, 'game.exe'), 'modified');
        fs.unlinkSync(path.join(f.target, 'data.pak'));
        fs.writeFileSync(path.join(f.target, 'save.dat'), 'my save');
        const progress = [];
        const result = await f.create().verify(f.item.id, value => progress.push(value));
        assert.equal(result.success, true);
        assert.equal(result.healthy, false);
        assert.equal(result.corruptFiles, 1);
        assert.equal(result.missingFiles, 1);
        assert.equal(result.checkedFiles, 3);
        assert.deepEqual(result.issues, [{ path: 'game.exe', reason: 'changed' }, { path: 'data.pak', reason: 'missing' }]);
        assert.equal(fs.readFileSync(path.join(f.target, 'game.exe'), 'utf8'), 'modified');
        assert.equal(fs.readFileSync(path.join(f.target, 'save.dat'), 'utf8'), 'my save');
        assert.equal(f.requests[0].options.params.archiveKey, f.item.archiveKey);
        assert.equal(f.requests[0].options.headers.Authorization, 'Bearer fixture');
        assert.equal(progress.at(-1).kind, 'integrity');
        assert.equal(progress.at(-1).stage, 'completed');
    } finally { f.cleanup(); }
});

test('the installed manifest remains available offline after the catalog changes to a newer package', async () => {
    const f = fixture();
    try {
        assert.equal((await f.create().verify(f.item.id)).healthy, true);
        let requests = 0;
        const offline = f.create({ initialCatalog: [{ ...f.item, archiveKey: 'archives/version-two.zip' }],
            axios: { get: async () => { requests++; throw new Error('offline'); } } });
        const result = await offline.verify(f.item.id);
        assert.equal(result.success, true);
        assert.equal(result.healthy, true);
        assert.equal(requests, 0);
    } finally { f.cleanup(); }
});

test('legacy installs never verify against a manifest belonging to another package', async () => {
    const f = fixture();
    try {
        f.manifest.archiveKey = 'archives/version-two.zip';
        assert.equal((await f.create().verify(f.item.id)).code, 'invalid_integrity_manifest');
        const changed = f.create({ axios: { get: async () => {
            throw Object.assign(new Error('conflict'), { response: { status: 409, data: { error: 'package_changed' } } });
        } } });
        assert.equal((await changed.verify(f.item.id)).code, 'package_changed');
    } finally { f.cleanup(); }
});

test('index queue status is returned without creating a baseline from local files', async () => {
    const f = fixture();
    try {
        const service = f.create({ axios: { get: async () => {
            throw Object.assign(new Error('pending'), { response: { status: 409, data: { error: 'integrity_index_pending' } } });
        } } });
        assert.deepEqual(await service.verify(f.item.id), { success: false, code: 'integrity_index_pending' });
        assert.equal(fs.existsSync(path.join(f.root, 'custom-games-integrity-example.test')), false);
    } finally { f.cleanup(); }
});

test('verification can be cancelled and excludes concurrent game changes', async () => {
    const f = fixture();
    try {
        const service = f.create();
        let concurrent;
        let cancellation;
        const result = await service.verify(f.item.id, state => {
            if (!concurrent) concurrent = service.uninstall(f.item.id);
            if (state.totalFiles === 3 && !cancellation) cancellation = service.cancel();
        });
        assert.deepEqual(await concurrent, { success: false, code: 'busy' });
        assert.deepEqual(result, { success: false, code: 'cancelled' });
        assert.deepEqual(await cancellation, { success: true });
        assert.equal((await service.verify(f.item.id)).healthy, true);
    } finally { f.cleanup(); }
});

test('integrity validation rejects unsafe, conflicting and incomplete entries before opening any file', () => {
    const f = fixture();
    try {
        for (const badFiles of [
            [{ path: '../escape', sizeBytes: 0, sha256: hash('') }],
            [{ path: 'CON.exe', sizeBytes: 0, sha256: hash('') }],
            [{ path: '.merlin-install.json', sizeBytes: 0, sha256: hash('') }],
            [{ path: 'A', sizeBytes: 0, sha256: hash('') }, { path: 'a', sizeBytes: 0, sha256: hash('') }],
            [{ path: 'A', sizeBytes: 0, sha256: hash('') }, { path: 'a/b', sizeBytes: 0, sha256: hash('') }],
            [{ path: 'game.exe', sizeBytes: 0, sha256: null }],
        ]) assert.throws(() => normalizeIntegrityManifest({ ...f.manifest, totalSizeBytes: 0, files: badFiles },
            f.item.id, f.item.archiveKey, f.target), /invalid_integrity_manifest/);
    } finally { f.cleanup(); }
});

test('verification rejects junction paths even when external file contents match the expected hash', async () => {
    const f = fixture();
    try {
        const external = path.join(f.root, 'external');
        fs.mkdirSync(external);
        fs.writeFileSync(path.join(external, 'external.dat'), 'outside');
        fs.symlinkSync(external, path.join(f.target, 'redirected'), process.platform === 'win32' ? 'junction' : 'dir');
        f.manifest.files = [{ path: 'redirected/external.dat', sizeBytes: 7, sha256: hash('outside') }];
        f.manifest.totalSizeBytes = 7;
        const result = await f.create().verify(f.item.id);
        assert.equal(result.healthy, false);
        assert.equal(result.unreadableFiles, 1);
        assert.equal(fs.readFileSync(path.join(external, 'external.dat'), 'utf8'), 'outside');
    } finally { f.cleanup(); }
});
