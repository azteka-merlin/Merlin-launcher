const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { deflateRawSync } = require('node:zlib');
const { Readable } = require('node:stream');
const AdmZip = require('adm-zip');
const { createCustomGamesService } = require('../src/main/custom-games/custom-games-service');
const { createUpdatePlan } = require('../src/main/custom-games/update-files');

const sha = value => createHash('sha256').update(value).digest('hex');
const GAME_ID = '00000000-0000-4000-8000-000000000001';
const LEASE = '00000000-0000-4000-8000-000000000099';
function fixture(packageType = 'zip') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-update-'));
    const disk = path.join(root, 'disk');
    const item = { id: GAME_ID, name: 'Update Game', installName: 'Update Game', packageType,
        archiveKey: 'archives/version-two', archiveSize: 100, origin: 'port', protectedPaths: ['game'], versionLabel: 'v2' };
    const target = path.join(disk, 'Merlin-games', item.installName);
    fs.mkdirSync(path.join(target, 'game'), { recursive: true });
    const before = new Map([['unchanged.dat', 'same'], ['changed.pak', 'old file'], ['obsolete.dll', 'gone'],
        ['game/disc.iso', 'disc'], ['settings.ini', 'default']]);
    const after = new Map([['unchanged.dat', 'same'], ['changed.pak', 'new file'], ['added.bin', 'added'],
        ['settings.ini', 'new defaults'], ['game/disc.iso', 'disc']]);
    for (const [name, data] of before) fs.writeFileSync(path.join(target, name), data);
    fs.writeFileSync(path.join(target, 'settings.ini'), 'my personalized settings');
    fs.writeFileSync(path.join(target, 'local-mod.dat'), 'extra');
    const marker = { id: GAME_ID, archiveKey: 'archives/version-one', executablePath: null, installedAt: '2026-01-01' };
    fs.writeFileSync(path.join(target, '.merlin-install.json'), JSON.stringify(marker));
    fs.writeFileSync(path.join(root, 'custom-games-installs-example.test.json'), JSON.stringify({
        [GAME_ID]: { drive: 'X', installName: item.installName, name: item.name },
    }));
    const makeManifest = (data, archiveKey, zip) => ({ version: 1, gameId: GAME_ID, archiveKey,
        totalSizeBytes: [...data.values()].reduce((sum, content) => sum + Buffer.byteLength(content), 0),
        files: [...data].map(([file, content], index) => ({ path: file, sizeBytes: Buffer.byteLength(content), sha256: sha(content),
            ...(zip ? { zip: { compressedSize: index % 2 ? Buffer.byteLength(content) : deflateRawSync(content).length, method: index % 2 ? 0 : 8 } } : {}) })) });
    const previous = makeManifest(before, marker.archiveKey, packageType === 'zip');
    const next = makeManifest(after, item.archiveKey, packageType === 'zip');
    const entryObjects = [...after.values()].map((content, index) => index % 2 ? Buffer.from(content) : deflateRawSync(content));
    const oldEntryObjects = [...before.values()].map((content, index) => index % 2 ? Buffer.from(content) : deflateRawSync(content));
    const bundleZip = new AdmZip();
    bundleZip.addFile('unchanged.dat', Buffer.from('same'));
    bundleZip.addFile('changed.pak', Buffer.from('new file'));
    const bundle = bundleZip.toBuffer();
    const objects = new Map([
        ['00000000-0000-4000-8000-000000000010', bundle],
        ['00000000-0000-4000-8000-000000000011', Buffer.from('added')],
        ['00000000-0000-4000-8000-000000000012', Buffer.from('new defaults')],
        ['00000000-0000-4000-8000-000000000013', Buffer.from('disc')],
    ]);
    const folderManifest = { gameId: GAME_ID, totalSizeBytes: next.totalSizeBytes,
        files: [
            { ...next.files[2], id: '00000000-0000-4000-8000-000000000011' },
            { ...next.files[3], id: '00000000-0000-4000-8000-000000000012' },
            { ...next.files[4], id: '00000000-0000-4000-8000-000000000013' },
        ], bundles: [{ id: '00000000-0000-4000-8000-000000000010', sizeBytes: bundle.length, sha256: sha(bundle),
            files: [next.files[0], next.files[1]] }] };
    const requests = [];
    let intercept = null;
    const axios = {
        async post(url, body, options) {
            requests.push({ method: 'POST', url, body, options });
            if (url.endsWith('/download-session')) return { data: { leaseId: LEASE, archiveKey: body.archiveKey,
                packageType, archiveSize: item.archiveSize, origin: item.origin, protectedPaths: item.protectedPaths } };
            return { data: { success: true } };
        },
        async get(url, options) {
            requests.push({ method: 'GET', url, options });
            if (intercept) await intercept(url, options);
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            if (url.endsWith('/integrity')) {
                if (options.params.archiveKey === previous.archiveKey) return { data: previous };
                return { data: next };
            }
            if (url.endsWith('/manifest')) return { data: folderManifest };
            const entry = /\/entries\/(\d+)$/.exec(url);
            const zipObjects = options.params?.archiveKey === previous.archiveKey ? oldEntryObjects : entryObjects;
            const data = entry ? zipObjects[Number(entry[1])] : objects.get(url.split('/').at(-1));
            assert.ok(data, url);
            const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
            return { status: 206, headers: { 'content-range': `bytes ${from}-${to}/${data.length}` },
                data: Readable.from([data.subarray(Number(from), Number(to) + 1)]) };
        },
    };
    const create = extra => createCustomGamesService({ app: { getPath: () => root }, initialCatalog: [item],
        apiBaseUrl: 'https://example.test/api', authSession: { getAccessToken: async () => 'fixture' },
        shell: {}, testDriveRoot: () => disk, axios, isGameRunning: async () => false, ...extra });
    return { root, target, item, marker, previous, next, requests, create, axios, folderManifest,
        intercept: value => { intercept = value; }, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

for (const packageType of ['zip', 'folder']) test(`${packageType} updates only changed files, preserves game/config/extras and removes only tracked obsolete files`, async () => {
    const f = fixture(packageType);
    const originalReader = fs.createReadStream;
    try {
        fs.createReadStream = function (file, options) {
            assert.notEqual(path.resolve(String(file)), path.join(f.target, 'unchanged.dat'), 'unchanged game files must not be rehashed');
            return originalReader.call(this, file, options);
        };
        const service = f.create();
        assert.equal((await service.list()).games[0].updateAvailable, true);
        const result = await service.update(GAME_ID);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(result.updatedFiles, 2);
        assert.equal(result.removedFiles, 1);
        assert.equal(fs.readFileSync(path.join(f.target, 'changed.pak'), 'utf8'), 'new file');
        assert.equal(fs.readFileSync(path.join(f.target, 'added.bin'), 'utf8'), 'added');
        assert.equal(fs.readFileSync(path.join(f.target, 'unchanged.dat'), 'utf8'), 'same');
        assert.equal(fs.readFileSync(path.join(f.target, 'settings.ini'), 'utf8'), 'my personalized settings');
        assert.equal(fs.readFileSync(path.join(f.target, 'game/disc.iso'), 'utf8'), 'disc');
        assert.equal(fs.readFileSync(path.join(f.target, 'local-mod.dat'), 'utf8'), 'extra');
        assert.equal(fs.existsSync(path.join(f.target, 'obsolete.dll')), false);
        assert.equal(JSON.parse(fs.readFileSync(path.join(f.target, '.merlin-install.json'))).archiveKey, f.item.archiveKey);
        const dataRequests = f.requests.filter(request => /\/(entries|files)\//.test(request.url));
        assert.equal(dataRequests.length, 2);
        for (const request of dataRequests) {
            assert.equal(request.options.params.archiveKey, f.item.archiveKey);
            assert.equal(request.options.params.downloadSessionId, LEASE);
            assert.equal(request.options.headers['x-merlin-custom-games-protocol'], '2');
        }
        assert.ok(f.requests.some(request => request.url.endsWith(`/${LEASE}/complete`)));
        assert.equal((await service.list()).games[0].updateAvailable, false);
    } finally { fs.createReadStream = originalReader; f.cleanup(); }
});

test('a missing old index allows replacing new files but never guesses which installed files should be deleted', async () => {
    const f = fixture();
    try {
        f.intercept(async (url, options) => {
            if (url.endsWith('/integrity') && options.params.archiveKey === f.marker.archiveKey) {
                throw Object.assign(new Error('missing'), { response: { status: 409, data: { error: 'integrity_index_unavailable' } } });
            }
        });
        const result = await f.create().update(GAME_ID);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(result.removedFiles, 0);
        assert.equal(fs.readFileSync(path.join(f.target, 'obsolete.dll'), 'utf8'), 'gone');
    } finally { f.cleanup(); }
});

test('running games block updates before opening a download session', async () => {
    const f = fixture();
    try {
        assert.deepEqual(await f.create({ isGameRunning: async () => true }).update(GAME_ID), { success: false, code: 'game_running' });
        assert.equal(f.requests.length, 0);
        assert.equal(fs.readFileSync(path.join(f.target, 'changed.pak'), 'utf8'), 'old file');
    } finally { f.cleanup(); }
});

test('publishing a newer catalog version during update does not change requests or the installed version', async () => {
    const f = fixture();
    try {
        let published = false;
        f.intercept(async url => {
            if (!/\/entries\//.test(url) || published) return;
            published = true;
            f.item.archiveKey = 'archives/version-three';
        });
        const result = await f.create().update(GAME_ID);
        assert.equal(result.success, true, JSON.stringify(result));
        const marker = JSON.parse(fs.readFileSync(path.join(f.target, '.merlin-install.json')));
        assert.equal(marker.archiveKey, 'archives/version-two');
        assert.ok(f.requests.filter(request => /\/entries\//.test(request.url)).every(request =>
            request.options.params.archiveKey === 'archives/version-two'));
    } finally { f.cleanup(); }
});

test('cancelled update downloads leave the installed version intact and release the lease', async () => {
    const f = fixture();
    try {
        const service = f.create();
        let cancellation;
        f.intercept(async (url, options) => {
            if (/\/entries\//.test(url) && !cancellation) {
                cancellation = service.cancel();
                throw new Error('cancelled');
            }
            if (options.signal.aborted) throw new Error('cancelled');
        });
        assert.deepEqual(await service.update(GAME_ID), { success: false, code: 'cancelled' });
        assert.deepEqual(await cancellation, { success: true });
        assert.equal(fs.readFileSync(path.join(f.target, 'changed.pak'), 'utf8'), 'old file');
        assert.equal(fs.existsSync(path.join(f.target, 'added.bin')), false);
        assert.ok(f.requests.some(request => request.url.endsWith(`/${LEASE}/cancel`)));
    } finally { f.cleanup(); }
});

test('a same-hash installed file with the wrong size is downloaded again without scanning other game contents', async () => {
    const f = fixture();
    try {
        fs.writeFileSync(path.join(f.target, 'unchanged.dat'), 'truncated');
        const plan = await createUpdatePlan(f.target, f.previous, f.next, f.item);
        assert.ok(plan.replace.some(file => file.path === 'unchanged.dat'));
        assert.equal(plan.unchangedFiles, 0);
    } finally { f.cleanup(); }
});

test('restarting a partial folder install after publication resumes the retained package and its completed files', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-resume-version-'));
    try {
        const disk = path.join(root, 'disk');
        const games = path.join(disk, 'Merlin-games');
        const downloads = path.join(games, '.merlin-downloads');
        const staging = path.join(games, `.merlin-installing-${GAME_ID}`);
        fs.mkdirSync(downloads, { recursive: true }); fs.mkdirSync(staging);
        const oldKey = 'manifests/version-one';
        const latest = { id: GAME_ID, name: 'Resumed', installName: 'Resumed', packageType: 'folder',
            archiveKey: 'manifests/version-two', archiveSize: 999, executablePath: null };
        const contents = [Buffer.from('first completed'), Buffer.from('second pending')];
        const files = contents.map((data, index) => ({ id: `00000000-0000-4000-8000-00000000001${index}`,
            path: `${index}.dat`, sizeBytes: data.length, sha256: sha(data), etag: null }));
        const total = contents.reduce((sum, data) => sum + data.length, 0);
        fs.writeFileSync(path.join(staging, files[0].path), contents[0]);
        fs.writeFileSync(path.join(downloads, `${GAME_ID}.folder.json`), JSON.stringify({
            id: GAME_ID, packageKey: oldKey, totalBytes: total, files, snapshot: { ...latest, archiveKey: oldKey, archiveSize: total },
        }));
        const requests = [];
        const axios = {
            post: async (url, body) => {
                if (url.endsWith('/download-session')) {
                    assert.equal(body.archiveKey, oldKey);
                    return { data: { leaseId: LEASE, archiveKey: oldKey, packageType: 'folder', archiveSize: total } };
                }
                return { data: { success: true } };
            },
            get: async (url, options) => {
                if (url.endsWith('/custom-games')) return { data: { games: [latest] } };
                assert.equal(options.params.archiveKey, oldKey);
                assert.equal(options.params.downloadSessionId, LEASE);
                if (url.endsWith('/manifest')) return { data: { gameId: GAME_ID, totalSizeBytes: total, files } };
                const file = files.find(entry => url.endsWith(`/files/${entry.id}`));
                assert.ok(file, url);
                requests.push(file.id);
                const data = contents[files.indexOf(file)];
                return { status: 206, headers: { 'content-range': `bytes 0-${data.length - 1}/${data.length}` }, data: Readable.from([data]) };
            },
        };
        const service = createCustomGamesService({ app: { getPath: () => root }, initialCatalog: [latest],
            apiBaseUrl: 'https://example.test/api', authSession: { getAccessToken: async () => 'fixture' },
            shell: {}, testDriveRoot: () => disk, axios });
        const result = await service.install(GAME_ID, 'X');
        assert.equal(result.success, true, JSON.stringify(result));
        assert.deepEqual(requests, [files[1].id]);
        assert.equal(JSON.parse(fs.readFileSync(path.join(result.path, '.merlin-install.json'))).archiveKey, oldKey);
        assert.equal((await service.list()).games[0].updateAvailable, true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('restarting a ZIP install preserves completed ranges from its retained version after a new publication', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-zip-resume-version-'));
    try {
        const zip = new AdmZip();
        zip.addFile('game.dat', Buffer.alloc(65 * 1024 ** 2, 0x61));
        zip.getEntry('game.dat').header.method = 0;
        const archive = zip.toBuffer();
        const chunkBytes = 64 * 1024 ** 2;
        assert.ok(archive.length > chunkBytes);
        const disk = path.join(root, 'disk');
        const downloads = path.join(disk, 'Merlin-games', '.merlin-downloads');
        fs.mkdirSync(downloads, { recursive: true });
        const oldKey = 'archives/old-version.zip';
        const latest = { id: GAME_ID, name: 'Resume ZIP', installName: 'Resume ZIP', packageType: 'zip',
            archiveKey: 'archives/new-version.zip', archiveSize: 123, executablePath: null };
        const partial = path.join(downloads, `${GAME_ID}.zip.part`);
        const descriptor = fs.openSync(partial, 'w');
        fs.ftruncateSync(descriptor, archive.length);
        fs.writeSync(descriptor, archive.subarray(0, chunkBytes)); fs.closeSync(descriptor);
        fs.writeFileSync(path.join(downloads, `${GAME_ID}.json`), JSON.stringify({ id: GAME_ID,
            archiveKey: oldKey, size: archive.length, completed: [true, false],
            snapshot: { ...latest, archiveKey: oldKey, archiveSize: archive.length } }));
        const ranges = [];
        const axios = {
            post: async (url, body) => ({ data: url.endsWith('/download-session')
                ? { leaseId: LEASE, archiveKey: body.archiveKey, packageType: 'zip', archiveSize: archive.length }
                : { success: true } }),
            get: async (url, options) => {
                if (url.endsWith('/integrity')) throw new Error('index pending');
                assert.ok(url.endsWith('/archive'));
                assert.equal(options.params.archiveKey, oldKey);
                assert.equal(options.params.downloadSessionId, LEASE);
                const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
                ranges.push(Number(from));
                return { status: 206, headers: { 'content-range': `bytes ${from}-${to}/${archive.length}` },
                    data: Readable.from([archive.subarray(Number(from), Number(to) + 1)]) };
            },
        };
        const service = createCustomGamesService({ app: { getPath: () => root }, initialCatalog: [latest],
            apiBaseUrl: 'https://example.test/api', authSession: { getAccessToken: async () => 'fixture' },
            shell: {}, testDriveRoot: () => disk, axios });
        const result = await service.install(GAME_ID, 'X');
        assert.equal(result.success, true, JSON.stringify(result));
        assert.deepEqual(ranges, [chunkBytes]);
        assert.equal(fs.statSync(path.join(result.path, 'game.dat')).size, 65 * 1024 ** 2);
        assert.equal(JSON.parse(fs.readFileSync(path.join(result.path, '.merlin-install.json'))).archiveKey, oldKey);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('explicit repair uses the installed version and forces same-size corrupted files while preserving settings', async () => {
    const f = fixture();
    try {
        const service = f.create();
        assert.deepEqual(await service.repair(GAME_ID), { success: false, code: 'integrity_verification_required' });
        fs.writeFileSync(path.join(f.target, 'changed.pak'), 'bad file');
        const verification = await service.verify(GAME_ID);
        assert.equal(verification.corruptFiles, 2); // Runtime settings remain personal and protected.
        const requestsBefore = f.requests.length;
        const result = await service.repair(GAME_ID);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(result.updatedFiles, 1);
        assert.equal(result.protectedFiles, 1);
        assert.equal(fs.readFileSync(path.join(f.target, 'changed.pak'), 'utf8'), 'old file');
        assert.equal(fs.readFileSync(path.join(f.target, 'settings.ini'), 'utf8'), 'my personalized settings');
        assert.equal(fs.readFileSync(path.join(f.target, 'local-mod.dat'), 'utf8'), 'extra');
        assert.equal(JSON.parse(fs.readFileSync(path.join(f.target, '.merlin-install.json'))).archiveKey, f.marker.archiveKey);
        const downloads = f.requests.slice(requestsBefore).filter(request => /\/entries\//.test(request.url));
        assert.equal(downloads.length, 1);
        assert.equal(downloads[0].options.params.archiveKey, f.marker.archiveKey);
        assert.deepEqual(await service.repair(GAME_ID), { success: false, code: 'integrity_verification_required' });
    } finally { f.cleanup(); }
});

test('legacy folder transport manifests without hashes use the indexed integrity hashes', async () => {
    const f = fixture('folder');
    try {
        for (const file of f.folderManifest.files) delete file.sha256;
        const result = await f.create().update(GAME_ID);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(fs.readFileSync(path.join(f.target, 'added.bin'), 'utf8'), 'added');
    } finally { f.cleanup(); }
});

test('a complete port package restores a missing game file while preserving game files already present', async () => {
    const f = fixture();
    try {
        fs.unlinkSync(path.join(f.target, 'game/disc.iso'));
        const result = await f.create().update(GAME_ID);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(result.updatedFiles, 3);
        assert.equal(fs.readFileSync(path.join(f.target, 'game/disc.iso'), 'utf8'), 'disc');
        const entries = f.requests.filter(request => /\/entries\//.test(request.url));
        assert.equal(entries.length, 3);
        assert.ok(entries.some(request => request.url.endsWith('/entries/4')));
    } finally { f.cleanup(); }
});
