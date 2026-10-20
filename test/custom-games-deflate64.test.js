const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const yauzl = require('yauzl');
const { path7za } = require('7zip-bin');
const { decodeDeflate64, inflateDeflate64 } = require('../src/main/custom-games/deflate64');
const { extractSafeZip } = require('../src/main/custom-games/safe-zip');
const { normalizeIntegrityManifest } = require('../src/main/custom-games/integrity');
const { stageUpdate } = require('../src/main/custom-games/update-files');

const digest = data => createHash('sha256').update(data).digest('hex');
let fixture;
test.before(async () => {
    const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-deflate64-')));
    const archive = path.join(root, 'fixture.zip');
    const data = Buffer.alloc(3 * 1024 ** 2);
    data.fill('Deflate64 game content with long matches and a bounded decoder.');
    fs.writeFileSync(path.join(root, 'data.pak'), data);
    execFileSync(path7za, ['a', '-tzip', '-mm=Deflate64', '-mx=9', archive, 'data.pak'],
        { cwd: root, windowsHide: true, stdio: 'pipe' });
    const zip = await new Promise((resolve, reject) => yauzl.open(archive,
        { lazyEntries: true, autoClose: false }, (error, value) => error ? reject(error) : resolve(value)));
    try {
        const entry = await new Promise((resolve, reject) => {
            zip.once('error', reject); zip.once('entry', resolve); zip.readEntry();
        });
        assert.equal(entry.compressionMethod, 9);
        const source = await new Promise((resolve, reject) => zip.openReadStream(entry,
            { decodeFileData: false }, (error, value) => error ? reject(error) : resolve(value)));
        const chunks = [];
        for await (const chunk of source) chunks.push(chunk);
        fixture = { root, archive, data, compressed: Buffer.concat(chunks) };
    } finally { zip.close(); }
});
test.after(() => {
    if (fixture) {
        assert.ok(path.basename(fixture.root).startsWith('merlin-deflate64-'));
        assert.equal(path.dirname(fixture.root).toLowerCase(), fs.realpathSync.native(os.tmpdir()).toLowerCase());
        fs.rmSync(fixture.root, { recursive: true, force: true });
    }
});

async function decode(data, chunkBytes = Math.max(1, data.length)) {
    const chunks = [];
    const input = function* () { for (let offset = 0; offset < data.length; offset += chunkBytes) yield data.subarray(offset, offset + chunkBytes); };
    for await (const chunk of decodeDeflate64(Readable.from(input()))) {
        assert.ok(chunk.length <= 64 * 1024);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
function workspace(t) {
    const root = fs.mkdtempSync(path.join(fixture.root, 'operation-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return root;
}

test('a real 7-Zip Deflate64 payload streams through bounded output chunks', async () => {
    assert.deepEqual(await decode(fixture.compressed), fixture.data);
    assert.ok(fixture.compressed.length < fixture.data.length / 100);
});

test('parallel Deflate64 streams keep independent state across small input boundaries', async () => {
    const decoded = await Promise.all([1, 7, 31, fixture.compressed.length].map(size => decode(fixture.compressed, size)));
    assert.ok(decoded.every(data => digest(data) === digest(fixture.data)));
});

test('Deflate64 rejects truncated streams, corrupt bytes and trailing data', async () => {
    await assert.rejects(decode(fixture.compressed.subarray(0, -2)), /deflate64/);
    await assert.rejects(decode(Buffer.alloc(16, 0xff)), /deflate64/);
    await assert.rejects(decode(Buffer.concat([fixture.compressed, Buffer.from([1])])), /deflate64_trailing_data/);
    assert.deepEqual(await decode(fixture.compressed), fixture.data);
});

test('cancelling a Deflate64 read cancels its input and releases reusable codec state', async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
        let cancelled = false;
        const source = new ReadableStream({
            start(controller) { controller.enqueue(fixture.compressed); },
            cancel() { cancelled = true; },
        });
        const reader = inflateDeflate64(source).getReader();
        assert.equal((await reader.read()).value.length, 64 * 1024);
        await reader.cancel('cancelled');
        assert.equal(cancelled, true);
    }
    assert.deepEqual(await decode(fixture.compressed), fixture.data);
});

test('fresh installation extracts a real Deflate64 ZIP with CRC and optional SHA validation', async t => {
    const base = workspace(t);
    for (const withHashes of [false, true]) {
        const target = path.join(base, withHashes ? 'sha' : 'crc');
        const result = await extractSafeZip(fixture.archive, target, () => {}, () => false,
            withHashes ? new Map([['data.pak', fixture.data.length]]) : null,
            withHashes ? { expectedHashes: new Map([['data.pak', digest(fixture.data)]]) } : {});
        assert.equal(result.files, 1);
        assert.equal(result.bytes, fixture.data.length);
        assert.deepEqual(fs.readFileSync(path.join(target, 'data.pak')), fixture.data);
    }
});

test('Deflate64 CRC corruption fails before a fresh member is reported complete', async t => {
    const base = workspace(t);
    const bytes = fs.readFileSync(fixture.archive);
    const central = bytes.lastIndexOf(Buffer.from('504b0102', 'hex'));
    assert.ok(central >= 0);
    bytes.writeUInt32LE((bytes.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
    const archive = path.join(base, 'corrupt.zip');
    fs.writeFileSync(archive, bytes);
    const progress = [];
    await assert.rejects(extractSafeZip(archive, path.join(base, 'payload'), state => progress.push(state)),
        /archive_integrity_failed/);
    assert.ok(progress.every(state => state.files === 0));
});

test('Deflate64 selective updates verify the SHA and declared output limit before applying', async t => {
    const base = workspace(t);
    const requests = [];
    for (const mode of ['valid', 'bad-hash', 'bad-size']) {
        const file = { path: 'data.pak', sizeBytes: mode === 'bad-size' ? 1 : fixture.data.length,
            sha256: digest(mode === 'bad-hash' ? 'different game' : fixture.data),
            zip: { method: 9, compressedSize: fixture.compressed.length } };
        const id = '00000000-0000-4000-8000-000000000009';
        const manifest = normalizeIntegrityManifest({ version: 1, gameId: id, archiveKey: 'package.zip',
            totalSizeBytes: file.sizeBytes, files: [file] }, id, 'package.zip', base);
        const options = { staging: path.join(base, mode), item: { packageType: 'zip' }, manifest,
            plan: { replace: [{ ...manifest.files[0], entryIndex: 0 }], remove: [], unchangedFiles: 2, protectedFiles: 1 },
            request: async (relative, requestOptions) => {
                requests.push({ relative, range: requestOptions.headers.Range });
                return { status: 206, headers: {
                    'content-range': `bytes 0-${fixture.compressed.length - 1}/${fixture.compressed.length}`,
                }, data: Readable.from([fixture.compressed]) };
            }, onProgress() {} };
        if (mode === 'valid') {
            const result = await stageUpdate(options);
            assert.deepEqual(fs.readFileSync(path.join(result.payload, 'data.pak')), fixture.data);
            assert.equal(result.transferTotal, fixture.compressed.length);
        } else await assert.rejects(stageUpdate(options), /archive_integrity_failed/);
    }
    assert.ok(requests.every(request => request.relative === 'entries/0' &&
        request.range === `bytes=0-${fixture.compressed.length - 1}`));
});

test('Deflate64 extraction rejects encrypted and unsupported methods during inspection', async t => {
    const base = workspace(t);
    for (const mode of ['encrypted', 'unsupported']) {
        const bytes = fs.readFileSync(fixture.archive);
        const central = bytes.lastIndexOf(Buffer.from('504b0102', 'hex'));
        if (mode === 'encrypted') bytes.writeUInt16LE(bytes.readUInt16LE(central + 8) | 1, central + 8);
        else bytes.writeUInt16LE(99, central + 10);
        const archive = path.join(base, `${mode}.zip`);
        fs.writeFileSync(archive, bytes);
        const target = path.join(base, mode);
        await assert.rejects(extractSafeZip(archive, target), /unsupported_archive_compression/);
        assert.equal(fs.existsSync(target), false);
    }
});
