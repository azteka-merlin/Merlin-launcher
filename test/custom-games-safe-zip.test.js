const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const zlib = require('node:zlib');
const AdmZip = require('adm-zip');
const { extractSafeZip } = require('../src/main/custom-games/safe-zip');

const digest = data => createHash('sha256').update(data).digest('hex');

async function fixture(entries, run) {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'merlin-safe-zip-'));
    const archive = path.join(root, 'fixture.zip');
    const target = path.join(root, 'staging');
    try {
        const zip = new AdmZip();
        for (const [name, data] of entries) zip.addFile(name, Buffer.from(data));
        await fs.promises.writeFile(archive, zip.toBuffer());
        await run({ root, archive, target });
    } finally {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('merlin-safe-zip-'));
        await fs.promises.rm(root, { recursive: true, force: true });
    }
}

test('inline SHA validates every member before reporting completed files, including empty files', async () => {
    const entries = [['Data/one.bin', 'first file'], ['Data/empty.bin', ''], ['Data/two.bin', 'second file']];
    await fixture(entries, async ({ archive, target }) => {
        const progress = [];
        const sizes = new Map(entries.map(([name, data]) => [name.toLowerCase(), Buffer.byteLength(data)]));
        const hashes = new Map(entries.map(([name, data]) => [name.toLowerCase(), digest(data)]));
        const result = await extractSafeZip(archive, target, value => progress.push(value), () => false,
            sizes, { expectedHashes: hashes });
        assert.deepEqual(result, { files: 3, bytes: 21 });
        assert.equal(progress[0].files, 0);
        assert.equal(progress.at(-1).files, 3);
        assert.equal(progress.at(-1).totalFiles, 3);
        assert.equal(progress.at(-1).bytes, 21);
        assert.ok(progress.every((value, index) => index === 0 || value.files >= progress[index - 1].files));
        for (const [name, data] of entries) assert.equal(await fs.promises.readFile(path.join(target, name), 'utf8'), data);
    });
});

test('a SHA mismatch rejects the member without counting it as completed', async () => {
    await fixture([['Data/game.bin', 'payload']], async ({ archive, target }) => {
        const progress = [];
        await assert.rejects(extractSafeZip(archive, target, value => progress.push(value), () => false,
            new Map([['data/game.bin', 7]]), { expectedHashes: new Map([['data/game.bin', digest('wrong')]]) }),
        /checksum_mismatch/);
        assert.ok(progress.length > 0);
        assert.ok(progress.every(value => value.files === 0));
    });
});

test('an incomplete SHA manifest fails inspection before any member is written', async () => {
    await fixture([['Data/game.bin', 'payload']], async ({ archive, target }) => {
        await assert.rejects(extractSafeZip(archive, target, () => {}, () => false, null,
            { expectedHashes: new Map() }), /archive_manifest_mismatch/);
        assert.equal(fs.existsSync(target), false);
    });
});

test('explicit directory entries do not count as completed files', async () => {
    await fixture([['Data/', ''], ['Data/game.bin', 'payload']], async ({ archive, target }) => {
        const progress = [];
        const result = await extractSafeZip(archive, target, value => progress.push(value));
        assert.equal(result.files, 1);
        assert.equal(progress[0].files, 0);
        assert.equal(progress.at(-1).files, 1);
        assert.ok(progress.every(value => value.totalFiles === 1));
    });
});

test('cancellation during a member rejects without reporting it as completed', async () => {
    await fixture([['Data/game.bin', Buffer.alloc(512 * 1024, 0x61)]], async ({ archive, target }) => {
        let cancelled = false;
        const progress = [];
        await assert.rejects(extractSafeZip(archive, target, value => {
            progress.push(value);
            if (value.bytes > 0) cancelled = true;
        }, () => cancelled), /cancelled/);
        assert.ok(progress.every(value => value.files === 0));
    });
});

test('unsafe paths are rejected during inspection before extracting a valid member', async () => {
    await fixture([['Data/good.bin', 'good'], ['Data/evil.bin', 'evil']], async ({ archive, target }) => {
        const content = await fs.promises.readFile(archive);
        const before = Buffer.from('Data/evil.bin');
        const after = Buffer.from('../escape.bin');
        assert.equal(before.length, after.length);
        for (let index = content.indexOf(before); index !== -1; index = content.indexOf(before, index + after.length)) {
            after.copy(content, index);
        }
        await fs.promises.writeFile(archive, content);
        await assert.rejects(extractSafeZip(archive, target), /invalid relative path|unsafe_archive_path/);
        assert.equal(fs.existsSync(target), false);
    });
});

test('a pre-existing symlinked output directory cannot bypass validation', async t => {
    await fixture([['Data/game.bin', 'payload']], async ({ root, archive, target }) => {
        const outside = path.join(root, 'outside');
        await fs.promises.mkdir(target);
        await fs.promises.mkdir(outside);
        try {
            await fs.promises.symlink(outside, path.join(target, 'Data'), process.platform === 'win32' ? 'junction' : 'dir');
        } catch (error) {
            if (error.code === 'EPERM' || error.code === 'EACCES') return t.skip('symlink creation is unavailable');
            throw error;
        }
        await assert.rejects(extractSafeZip(archive, target), /unsafe_install_path/);
        assert.equal(fs.existsSync(path.join(outside, 'game.bin')), false);
    });
});

test('a cached output directory replaced with a symlink is rejected before the next member', async t => {
    await fixture([['Data/first.bin', 'first'], ['Data/second.bin', 'second']], async ({ root, archive, target }) => {
        const outside = path.join(root, 'outside');
        const probe = path.join(root, 'probe-link');
        await fs.promises.mkdir(outside);
        try {
            await fs.promises.symlink(outside, probe, process.platform === 'win32' ? 'junction' : 'dir');
            await fs.promises.unlink(probe);
        } catch (error) {
            if (error.code === 'EPERM' || error.code === 'EACCES') return t.skip('symlink creation is unavailable');
            throw error;
        }
        let changed = false;
        await assert.rejects(extractSafeZip(archive, target, value => {
            if (value.files !== 1 || changed) return;
            changed = true;
            fs.renameSync(path.join(target, 'Data'), path.join(root, 'moved-data'));
            fs.symlinkSync(outside, path.join(target, 'Data'), process.platform === 'win32' ? 'junction' : 'dir');
        }), /unsafe_install_path/);
        assert.equal(changed, true);
        assert.deepEqual(await fs.promises.readdir(outside), []);
    });
});

test('CRC corruption still fails even when no SHA manifest is supplied', async () => {
    await fixture([['Data/game.bin', 'payload']], async ({ archive, target }) => {
        const content = await fs.promises.readFile(archive);
        const central = content.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
        assert.ok(central >= 0);
        content.writeUInt32LE((content.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
        await fs.promises.writeFile(archive, content);
        const progress = [];
        await assert.rejects(extractSafeZip(archive, target, value => progress.push(value)), /archive_integrity_failed/);
        assert.ok(progress.every(value => value.files === 0));
    });
});

test('CRC validation works on Electron runtimes without the native zlib CRC helper', async () => {
    const nativeCrc = zlib.crc32;
    try {
        zlib.crc32 = undefined;
        await fixture([['Data/game.bin', 'payload']], async ({ archive, target }) => {
            const result = await extractSafeZip(archive, target);
            assert.equal(result.files, 1);
            assert.equal(await fs.promises.readFile(path.join(target, 'Data/game.bin'), 'utf8'), 'payload');
        });
    } finally { zlib.crc32 = nativeCrc; }
});

test('bundle SHA-256 verifies extracted content without repeating the per-byte CRC pass', async () => {
    await fixture([['Data/game.bin', 'payload']], async ({ archive, target }) => {
        const content = await fs.promises.readFile(archive);
        const central = content.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
        assert.ok(central >= 0);
        content.writeUInt32LE((content.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
        await fs.promises.writeFile(archive, content);
        const result = await extractSafeZip(archive, target, () => {}, () => false, null,
            { expectedHashes: new Map([['data/game.bin', digest('payload')]]) });
        assert.equal(result.files, 1);
        assert.equal(await fs.promises.readFile(path.join(target, 'Data/game.bin'), 'utf8'), 'payload');
    });
});

test('two distinct bundles may safely create the same output directory concurrently', async () => {
    await fixture([['Data/first.bin', 'first']], async ({ root, archive, target }) => {
        const second = new AdmZip();
        second.addFile('Data/second.bin', Buffer.from('second'));
        const secondArchive = path.join(root, 'second.zip');
        await fs.promises.writeFile(secondArchive, second.toBuffer());
        const results = await Promise.all([
            extractSafeZip(archive, target, () => {}, () => false, null,
                { expectedHashes: new Map([['data/first.bin', digest('first')]]) }),
            extractSafeZip(secondArchive, target, () => {}, () => false, null,
                { expectedHashes: new Map([['data/second.bin', digest('second')]]) }),
        ]);
        assert.equal(results.reduce((total, result) => total + result.files, 0), 2);
        assert.equal(await fs.promises.readFile(path.join(target, 'Data/first.bin'), 'utf8'), 'first');
        assert.equal(await fs.promises.readFile(path.join(target, 'Data/second.bin'), 'utf8'), 'second');
    });
});
