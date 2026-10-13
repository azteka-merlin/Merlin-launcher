const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const AdmZip = require('adm-zip');
const { Readable } = require('node:stream');
const { extractSafeZip, safeEntryPath } = require('../src/main/custom-games/safe-zip');
const { registerCustomGamesIpc } = require('../src/main/ipc/register-custom-games-ipc');
const { createCustomGamesService, requiredFreeBytes } = require('../src/main/custom-games/custom-games-service');

test('installation checks room for the ZIP, extraction and a safety margin', () => {
    const gib = 1024 ** 3;
    assert.equal(requiredFreeBytes(8 * gib), 16 * gib + 512 * 1024 ** 2);
    assert.equal(requiredFreeBytes(8 * gib, 8 * gib), 8 * gib + 512 * 1024 ** 2);
    assert.equal(requiredFreeBytes(8 * gib, 0, 'folder'), 8 * gib + 512 * 1024 ** 2);
    assert.equal(requiredFreeBytes(8 * gib, 2 * gib, 'folder'), 6 * gib + 512 * 1024 ** 2);
});

test('ZIP extraction streams game files into the selected staging folder', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-game-'));
    try {
        const zip = new AdmZip();
        zip.addFile('Game/README.txt', Buffer.from('Merlin test game'));
        zip.addFile('Game/Game.exe', Buffer.from('fixture'));
        const archive = path.join(root, 'game.zip');
        zip.writeZip(archive);
        const target = path.join(root, 'staging');
        const progress = [];
        const result = await extractSafeZip(archive, target, update => progress.push(update));
        assert.equal(result.files, 2);
        assert.ok(progress.length > 0);
        assert.ok(progress.every(update => update.totalFiles === 2 && update.totalBytes === Buffer.byteLength('Merlin test game') + Buffer.byteLength('fixture')));
        assert.equal(progress.at(-1).bytes, Buffer.byteLength('Merlin test game') + Buffer.byteLength('fixture'));
        assert.equal(fs.readFileSync(path.join(target, 'Game', 'README.txt'), 'utf8'), 'Merlin test game');
        assert.equal(fs.readFileSync(path.join(target, 'Game', 'Game.exe'), 'utf8'), 'fixture');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('extraction progress is throttled so large archives do not flood the renderer', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-progress-'));
    const originalNow = Date.now;
    try {
        const disk = path.join(root, 'disk');
        fs.mkdirSync(disk);
        const zip = new AdmZip();
        zip.addFile('Game/data.bin', Buffer.alloc(32 * 1024 * 1024, 0x61));
        const archive = zip.toBuffer();
        const item = {
            id: 'a8fb0e0e-714c-4cf4-a449-2d57c591edcb', name: 'Progress Test', installName: 'Progress Test',
            archiveKey: 'archives/progress-test.zip', archiveSize: archive.length,
        };
        const axios = { get: async (url, options) => {
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            const [, startText, endText] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
            const start = Number(startText);
            const end = Number(endText);
            return { status: 206, headers: { 'content-range': `bytes ${start}-${end}/${archive.length}` },
                data: Readable.from([archive.subarray(start, end + 1)]) };
        } };
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios, authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api', shell: { openPath: async () => '' },
            testDriveRoot: () => disk,
        });
        const progress = [];
        service.subscribeProgress(state => progress.push(state));
        await service.list();
        let clock = 1_000;
        Date.now = () => { const value = clock; clock += 10; return value; };
        const result = await service.install(item.id, 'C');
        assert.equal(result.success, true, JSON.stringify(result));
        const extractionUpdates = progress.filter(state => state.stage === 'extracting');
        assert.ok(extractionUpdates.length > 0);
        assert.ok(extractionUpdates.length < 100, `expected throttled updates, got ${extractionUpdates.length}`);
        assert.ok(extractionUpdates.at(-1).bytes > 30 * 1024 * 1024);
        assert.ok(extractionUpdates.at(-1).bytes <= 32 * 1024 * 1024);
    } finally {
        Date.now = originalNow;
        fs.rmSync(root, { recursive: true, force: true });
    }
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
    let progressListener;
    const window = { isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (_channel, state) => { progress = state; } } };
    const service = {
        list: () => ({ games: [] }), refresh: () => ({ games: [] }), listDrives: () => [],
        subscribeProgress: listener => { progressListener = listener; return () => {}; },
        install: async () => { progressListener({ stage: 'downloading' }); return { success: true }; },
        cancel: () => ({ success: true }), play: () => ({ success: true }),
        openFolder: () => ({ success: true }), uninstall: () => ({ success: true }),
    };
    registerCustomGamesIpc({ ipcMain, service, getMainWindow: () => window });
    assert.deepEqual([...handlers.keys()].sort(), [
        'custom-games:cancel', 'custom-games:drives', 'custom-games:install', 'custom-games:list',
        'custom-games:open-folder', 'custom-games:play', 'custom-games:refresh', 'custom-games:uninstall',
    ]);
    assert.deepEqual(await handlers.get('custom-games:install')({}, { id: 'a', drive: 'D' }), { success: true });
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

test('drive selection lives in the install modal and defaults to C when available', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'custom-games', 'custom-games.js'), 'utf8');
    assert.doesNotMatch(html, /customGamesPreferredDrive/);
    assert.match(html, /id="customGamesDriveList"/);
    assert.match(html, /id="customGamesInstallSpace"/);
    assert.match(script, /drives\.find\(drive => drive\.letter === 'C'\)/);
    assert.match(script, /customGamesInstallConfirm\.disabled = !enough/);
});

test('refresh button shares the library and corrections icon, styles and loading state', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'custom-games', 'custom-games.js'), 'utf8');
    const button = id => html.match(new RegExp(`<button id="${id}"[^>]*>([\\s\\S]*?)<\\/button>`))?.[1];
    const icon = id => button(id)?.match(/<svg[\s\S]*?<\/svg>/)?.[0].replace(/>\s+</g, '><');
    assert.equal(icon('customGamesRefresh'), icon('libraryRefreshBtn'));
    assert.equal(icon('customGamesRefresh'), icon('correctionsRefreshBtn'));
    assert.match(css, /#correctionsView \.library-refresh-btn,\s*#correctionsView \.library-retry-btn,\s*#premiumView \.library-refresh-btn,\s*#customGamesView \.library-refresh-btn/);
    assert.match(css, /#correctionsView \.library-refresh-btn:hover:not\(:disabled\),\s*#correctionsView \.library-retry-btn:hover:not\(:disabled\),\s*#premiumView \.library-refresh-btn:hover:not\(:disabled\),\s*#customGamesView \.library-refresh-btn:hover:not\(:disabled\)/);
    assert.match(script, /customGamesRefresh\.classList\.toggle\('loading', force\)/);
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
        assert.ok(first.drives[0].freeBytes >= first.games[0].requiredFreeBytes);
        assert.equal(service.listDrives(item.id)[0].requiredFreeBytes, requiredFreeBytes(archive.length));
        const partialDir = path.join(disk, 'Merlin-games', '.merlin-downloads');
        fs.mkdirSync(partialDir, { recursive: true });
        fs.writeFileSync(path.join(partialDir, `${item.id}.zip.part`), archive.subarray(0, 20));
        const staleId = '11111111-1111-4111-8111-111111111111';
        fs.writeFileSync(path.join(partialDir, `${staleId}.zip.part`), 'stale partial');
        fs.writeFileSync(path.join(partialDir, `${staleId}.json`), '{"stale":true}');
        const orphanId = '33333333-3333-4333-8333-333333333333';
        fs.writeFileSync(path.join(partialDir, `${orphanId}.json`), '{"orphan":true}');
        const staleStage = path.join(disk, 'Merlin-games', `.merlin-installing-${staleId}-22222222-2222-4222-8222-222222222222`);
        fs.mkdirSync(staleStage);
        fs.writeFileSync(path.join(staleStage, 'partial.txt'), 'stale extraction');
        assert.equal(service.listDrives(item.id)[0].requiredFreeBytes, requiredFreeBytes(archive.length, 20));
        assert.ok(first.games[0].imageUrl.startsWith('https://staging.api-merlin.com/'));
        const result = await service.install(item.id, 'X');
        assert.equal(result.success, true);
        assert.equal(result.path, path.join(disk, 'Merlin-games', 'Test Game'));
        assert.equal(fs.readFileSync(path.join(result.path, 'Game', 'readme.txt'), 'utf8'), 'hello');
        assert.equal(fs.existsSync(path.join(disk, 'Merlin-games', '.merlin-downloads', `${item.id}.zip.part`)), false);
        assert.equal(fs.existsSync(path.join(partialDir, `${staleId}.zip.part`)), false);
        assert.equal(fs.existsSync(path.join(partialDir, `${staleId}.json`)), false);
        assert.equal(fs.existsSync(path.join(partialDir, `${orphanId}.json`)), false);
        assert.equal(fs.existsSync(staleStage), false);
        assert.equal((await service.list()).games[0].installed.path, result.path);
        assert.equal((await service.install(item.id, 'X')).code, 'already_installed');
        assert.equal(requests.filter(request => request.range).length, 1);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('folder packages download files directly without ZIP extraction', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-folder-install-'));
    try {
        const disk = path.join(root, 'disk');
        fs.mkdirSync(disk);
        const id = '35b22b86-7c0a-4a68-b845-f1807277995a';
        const firstId = 'ad35e85d-86ac-4ed2-8c27-2c891a6717c1';
        const secondId = '97ab9873-99ea-49d4-bfab-7a80002744cb';
        const contents = new Map([
            [firstId, Buffer.from('game executable fixture')],
            [secondId, Buffer.from('nested data fixture')],
        ]);
        const totalSizeBytes = [...contents.values()].reduce((sum, data) => sum + data.length, 0);
        const item = { id, name: 'Folder Game', installName: 'Folder Game', packageType: 'folder',
            archiveKey: 'manifests/35b22b86-7c0a-4a68-b845-f1807277995a.json', archiveSize: totalSizeBytes,
            executablePath: 'Bin/Game.exe' };
        const manifest = { success: true, gameId: id, totalSizeBytes, files: [
            { id: firstId, path: 'Bin/Game.exe', sizeBytes: contents.get(firstId).length, etag: 'etag-one' },
            { id: secondId, path: 'Data/level.dat', sizeBytes: contents.get(secondId).length, etag: 'etag-two' },
        ] };
        const requests = [];
        const axios = { get: async (url, options = {}) => {
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            if (url.endsWith('/manifest')) return { data: manifest };
            const match = /\/files\/([a-f0-9-]+)$/i.exec(url);
            assert.ok(match);
            const data = contents.get(match[1]);
            const range = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
            const start = Number(range[1]);
            const end = Number(range[2]);
            requests.push({ fileId: match[1], range: options.headers.Range });
            return { status: 206, headers: {
                'content-range': `bytes ${start}-${end}/${data.length}`,
                etag: match[1] === firstId ? 'etag-one' : 'etag-two',
            }, data: Readable.from([data.subarray(start, end + 1)]) };
        } };
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios, authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api', shell: { openPath: async () => '' },
            testDriveRoot: () => disk,
        });
        await service.list();
        const progress = [];
        const result = await service.install(id, 'X', state => progress.push(state));
        assert.equal(result.success, true);
        assert.equal(fs.readFileSync(path.join(result.path, 'Bin', 'Game.exe'), 'utf8'), 'game executable fixture');
        assert.equal(fs.readFileSync(path.join(result.path, 'Data', 'level.dat'), 'utf8'), 'nested data fixture');
        assert.equal(fs.readFileSync(path.join(result.path, '.merlin-install.json'), 'utf8').includes(item.archiveKey), true);
        assert.equal(progress.some(state => state.stage === 'extracting'), false);
        assert.equal(progress.at(-1).stage, 'completed');
        assert.equal(requests.length, 2);
        assert.equal(fs.existsSync(path.join(disk, 'Merlin-games', '.merlin-downloads', `${id}.folder.json`)), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('folder package retries an interrupted range without double-counting progress', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-folder-resume-'));
    try {
        const disk = path.join(root, 'disk');
        fs.mkdirSync(disk);
        const id = '9e5e1abd-0354-46b8-bc28-d93134ad743f';
        const fileId = '9c2509f8-d494-4c02-ad5d-8790ad1a57e0';
        const data = Buffer.from('folder download can resume safely');
        const item = { id, name: 'Resume Game', installName: 'Resume Game', packageType: 'folder',
            archiveKey: `manifests/${id}.json`, archiveSize: data.length, executablePath: null };
        const manifest = { success: true, gameId: id, totalSizeBytes: data.length,
            files: [{ id: fileId, path: 'data.bin', sizeBytes: data.length, etag: 'stable-etag' }] };
        let attempts = 0;
        const axios = { get: async url => {
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            if (url.endsWith('/manifest')) return { data: manifest };
            attempts++;
            if (attempts === 1) return { status: 206, headers: {
                'content-range': `bytes 0-${data.length - 1}/${data.length}`, etag: 'stable-etag',
            }, data: Readable.from((async function* () {
                yield data.subarray(0, 8);
                throw new Error('connection interrupted');
            })()) };
            return { status: 206, headers: {
                'content-range': `bytes 0-${data.length - 1}/${data.length}`, etag: 'stable-etag',
            }, data: Readable.from([data]) };
        } };
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios, authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api', shell: { openPath: async () => '' },
            testDriveRoot: () => disk,
        });
        await service.list();
        const progress = [];
        const result = await service.install(id, 'X', state => progress.push(state));
        assert.equal(result.success, true);
        assert.equal(attempts, 2);
        assert.deepEqual(fs.readFileSync(path.join(result.path, 'data.bin')), data);
        assert.equal(Math.max(...progress.filter(state => state.stage === 'downloading').map(state => state.received)), data.length);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('folder package detects a corrupt file and retries only that file before atomic install', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-folder-checksum-'));
    try {
        const disk = path.join(root, 'disk');
        fs.mkdirSync(disk);
        const id = '7d3887b8-a721-4fb9-91ce-ff987c400001';
        const corruptId = '7d3887b8-a721-4fb9-91ce-ff987c400002';
        const validId = '7d3887b8-a721-4fb9-91ce-ff987c400003';
        const contents = new Map([[corruptId, Buffer.from('verified executable data')], [validId, Buffer.from('valid data file')]]);
        const checksum = data => createHash('sha256').update(data).digest('hex');
        const totalSizeBytes = [...contents.values()].reduce((sum, data) => sum + data.length, 0);
        const item = { id, name: 'Integrity Game', installName: 'Integrity Game', packageType: 'folder',
            archiveKey: `manifests/${id}.json`, archiveSize: totalSizeBytes, executablePath: null };
        const manifest = { success: true, gameId: id, totalSizeBytes, files: [
            { id: corruptId, path: 'bin/game.exe', sizeBytes: contents.get(corruptId).length, etag: 'same', sha256: checksum(contents.get(corruptId)) },
            { id: validId, path: 'data/level.dat', sizeBytes: contents.get(validId).length, etag: 'same', sha256: checksum(contents.get(validId)) },
        ] };
        const fileRequests = new Map();
        const axios = { get: async (url, options = {}) => {
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            if (url.endsWith('/manifest')) return { data: manifest };
            const fileId = /\/files\/([a-f0-9-]+)$/i.exec(url)?.[1];
            const data = contents.get(fileId);
            const range = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
            const start = Number(range[1]);
            const end = Number(range[2]);
            const attempt = (fileRequests.get(fileId) || 0) + 1;
            fileRequests.set(fileId, attempt);
            let payload = data.subarray(start, end + 1);
            if (fileId === corruptId && attempt === 1) {
                payload = Buffer.from(payload);
                payload[0] ^= 0xff;
            }
            return { status: 206, headers: { 'content-range': `bytes ${start}-${end}/${data.length}`, etag: 'same' },
                data: Readable.from([payload]) };
        } };
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios, authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api', shell: { openPath: async () => '' },
            testDriveRoot: () => disk,
        });
        await service.list();
        const progress = [];
        const result = await service.install(id, 'X', state => progress.push(state));
        assert.equal(result.success, true);
        assert.equal(fileRequests.get(corruptId), 2);
        assert.equal(fileRequests.get(validId), 1);
        assert.equal(fs.readFileSync(path.join(result.path, 'bin', 'game.exe')).toString(), contents.get(corruptId).toString());
        assert.equal(fs.readFileSync(path.join(result.path, 'data', 'level.dat')).toString(), contents.get(validId).toString());
        assert.equal(progress.some(state => state.stage === 'verifying'), true);
        assert.equal(fs.existsSync(path.join(disk, 'Merlin-games', item.installName)), true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('large folder files use streamed SHA-256 verification without a full-file buffer', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-folder-large-hash-'));
    try {
        const disk = path.join(root, 'disk');
        fs.mkdirSync(disk);
        const id = 'a8d90578-35b1-4ec5-9cea-2d14b0170001';
        const fileId = 'a8d90578-35b1-4ec5-9cea-2d14b0170002';
        const chunk = Buffer.alloc(1024 * 1024, 0x5a);
        const chunkCount = 128;
        const fileSize = chunk.length * chunkCount;
        const hash = createHash('sha256');
        for (let index = 0; index < chunkCount; index++) hash.update(chunk);
        const item = { id, name: 'Large Stream Game', installName: 'Large Stream Game', packageType: 'folder',
            archiveKey: `manifests/${id}.json`, archiveSize: fileSize, executablePath: null };
        const manifest = { success: true, gameId: id, totalSizeBytes: fileSize, files: [
            { id: fileId, path: 'data/large.bin', sizeBytes: fileSize, etag: 'large-etag', sha256: hash.digest('hex') },
        ] };
        let rangeRequests = 0;
        const axios = { get: async (url, options = {}) => {
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            if (url.endsWith('/manifest')) return { data: manifest };
            rangeRequests++;
            const range = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
            const start = Number(range[1]);
            const end = Number(range[2]);
            return { status: 206, headers: { 'content-range': `bytes ${start}-${end}/${fileSize}`, etag: 'large-etag' },
                data: Readable.from((async function* () { for (let index = 0; index < chunkCount; index++) yield chunk; })()) };
        } };
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios, authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api', shell: { openPath: async () => '' },
            testDriveRoot: () => disk,
        });
        await service.list();
        const progress = [];
        const baselineRss = process.memoryUsage.rss();
        let peakRss = baselineRss;
        const memorySampler = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage.rss()); }, 20);
        let result;
        try { result = await service.install(id, 'X', state => progress.push(state)); }
        finally { clearInterval(memorySampler); }
        const installedFile = path.join(result.path, 'data', 'large.bin');
        assert.equal(result.success, true);
        assert.equal((await fs.promises.stat(installedFile)).size, fileSize);
        assert.equal(rangeRequests, 1);
        assert.ok(peakRss - baselineRss < fileSize, 'verification should not allocate a buffer as large as the file');
        assert.equal(progress.some(state => state.stage === 'verifying'), true);
        assert.equal(fs.existsSync(path.join(disk, 'Merlin-games', item.installName, '.merlin-install.json')), true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('explicit cancellation removes the partial ZIP and resume metadata while the operation can be observed', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-cancel-'));
    try {
        const disk = path.join(root, 'disk');
        fs.mkdirSync(disk);
        const item = {
            id: 'f8fb0e0e-714c-4cf4-a449-2d57c591edcb', name: 'Cancel Game', installName: 'Cancel Game',
            archiveKey: 'archives/cancel-game.zip', archiveSize: 1024, executablePath: null,
        };
        let requestStarted;
        const started = new Promise(resolve => { requestStarted = resolve; });
        const axios = { get: async (url, options) => {
            if (url.endsWith('/custom-games')) return { data: { games: [item] } };
            return new Promise((_resolve, reject) => {
                requestStarted();
                options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
            });
        } };
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios, authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api', shell: { openPath: async () => '' },
            testDriveRoot: () => disk,
        });
        await service.list();
        const install = service.install(item.id, 'X');
        await started;
        const operation = (await service.list()).operation;
        assert.equal(operation.id, item.id);
        assert.equal(operation.name, item.name);
        assert.equal(operation.stage, 'downloading');
        assert.equal(operation.total, item.archiveSize);
        assert.deepEqual(await service.cancel(), { success: true });
        assert.deepEqual(await install, { success: false, code: 'cancelled' });
        const downloads = path.join(disk, 'Merlin-games', '.merlin-downloads');
        assert.equal(fs.existsSync(path.join(downloads, `${item.id}.zip.part`)), false);
        assert.equal(fs.existsSync(path.join(downloads, `${item.id}.json`)), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('failed move to the Recycle Bin preserves the installation and returns the Windows error code', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-uninstall-'));
    const id = 'f8fb0e0e-714c-4cf4-a449-2d57c591edcb';
    const item = { id, name: 'Locked Game', installName: 'Locked Game', archiveKey: 'archives/locked.zip', archiveSize: 1 };
    const disk = path.join(root, 'disk');
    const installedPath = path.join(disk, 'Merlin-games', item.installName);
    const registryFile = path.join(root, 'custom-games-installs-staging.api-merlin.com.json');
    let trashError = Object.assign(new Error('Access is denied'), { code: 'EPERM' });
    try {
        fs.mkdirSync(installedPath, { recursive: true });
        fs.writeFileSync(path.join(installedPath, '.merlin-install.json'), JSON.stringify({ id }));
        fs.writeFileSync(registryFile, JSON.stringify({ [id]: { drive: 'X', installName: item.installName } }));
        const service = createCustomGamesService({
            app: { getPath: () => root },
            axios: { get: async () => ({ data: { games: [item] } }) },
            authSession: { getAccessToken: async () => 'test-token' },
            apiBaseUrl: 'https://staging.api-merlin.com/api',
            shell: { trashItem: async () => { throw trashError; } },
            windowsRecycleBinMove: async () => { throw new Error('Recycle Bin fallback failed'); },
            testDriveRoot: () => disk,
        });
        await service.list();
        const originalConsoleError = console.error;
        let permissionResult;
        let trashResult;
        try {
            console.error = () => {};
            permissionResult = await service.uninstall(id);
            trashError = new Error('Failed to perform delete operation');
            trashResult = await service.uninstall(id);
        } finally { console.error = originalConsoleError; }
        assert.deepEqual(permissionResult, { success: false, code: 'EPERM' });
        assert.deepEqual(trashResult, { success: false, code: 'trash_failed' });
        assert.equal(fs.existsSync(path.join(installedPath, '.merlin-install.json')), true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Windows Recycle Bin fallback completes uninstall after Electron trash operation fails', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-uninstall-fallback-'));
    const id = 'f8fb0e0e-714c-4cf4-a449-2d57c591edcb';
    const item = { id, name: 'Nested Game', installName: 'Nested Game', archiveKey: 'archives/nested.zip', archiveSize: 1 };
    const disk = path.join(root, 'disk');
    const installedPath = path.join(disk, 'Merlin-games', item.installName);
    try {
        fs.mkdirSync(path.join(installedPath, 'Data', 'Nested'), { recursive: true });
        fs.writeFileSync(path.join(installedPath, '.merlin-install.json'), JSON.stringify({ id }));
        fs.writeFileSync(path.join(installedPath, 'Data', 'Nested', 'save.dat'), 'fixture');
        fs.writeFileSync(path.join(root, 'custom-games-installs-staging.api-merlin.com.json'), JSON.stringify({
            [id]: { drive: 'X', installName: item.installName },
        }));
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios: { get: async () => ({ data: { games: [item] } }) },
            authSession: { getAccessToken: async () => 'test-token' }, apiBaseUrl: 'https://staging.api-merlin.com/api',
            shell: { trashItem: async () => { throw new Error('Failed to perform delete operation'); } },
            windowsRecycleBinMove: async source => fs.promises.rename(source, path.join(root, 'recycle-bin-fixture')),
            testDriveRoot: () => disk,
        });
        await service.list();
        assert.deepEqual(await service.uninstall(id), { success: true });
        assert.equal(fs.existsSync(installedPath), false);
        assert.equal(fs.existsSync(path.join(root, 'recycle-bin-fixture', 'Data', 'Nested', 'save.dat')), true);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a catalog executable added after installation enables Play despite an old null local value', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-play-metadata-'));
    const id = 'f8fb0e0e-714c-4cf4-a449-2d57c591edcb';
    const item = {
        id, name: 'Sons of Sparta', installName: 'Sons of Sparta', archiveKey: 'archives/sparta.zip',
        archiveSize: 1, executablePath: 'SonsOfSparta-PS5.exe',
    };
    const disk = path.join(root, 'disk');
    const installedPath = path.join(disk, 'Merlin-games', item.installName);
    try {
        fs.mkdirSync(installedPath, { recursive: true });
        fs.writeFileSync(path.join(installedPath, '.merlin-install.json'), JSON.stringify({ id, executablePath: null }));
        fs.writeFileSync(path.join(root, 'custom-games-installs-staging.api-merlin.com.json'), JSON.stringify({
            [id]: { drive: 'X', installName: item.installName, executablePath: null },
        }));
        const service = createCustomGamesService({
            app: { getPath: () => root }, axios: { get: async () => ({ data: { games: [item] } }) },
            authSession: { getAccessToken: async () => 'test-token' }, apiBaseUrl: 'https://staging.api-merlin.com/api',
            shell: {}, testDriveRoot: () => disk,
        });

        const result = await service.list();
        assert.equal(result.games[0].installed.path, installedPath);
        assert.equal(result.games[0].executablePath, 'SonsOfSparta-PS5.exe');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
