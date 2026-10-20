const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createUpdatePlan, applyUpdate, recoverUpdate, stageUpdate } = require('../src/main/custom-games/update-files');
const { Readable } = require('node:stream');
const zlib = require('node:zlib');

const id = '11111111-1111-4111-8111-111111111111';
const hash = data => createHash('sha256').update(data).digest('hex');
const entry = (name, data) => ({ path: name, sizeBytes: Buffer.byteLength(data), sha256: hash(data) });

function fixture() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-update-recovery-'));
    const root = path.join(base, 'Installed');
    const payload = path.join(base, 'Payload');
    fs.mkdirSync(root);
    fs.mkdirSync(payload);
    const marker = { id, archiveKey: 'old-package', executablePath: 'old.exe' };
    fs.writeFileSync(path.join(root, '.merlin-install.json'), JSON.stringify(marker));
    const write = (directory, name, data) => {
        const target = path.join(directory, ...name.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    };
    return { base, root, payload, marker, write,
        read: name => fs.readFileSync(path.join(root, ...name.split('/')), 'utf8'),
        cleanup() { fs.rmSync(base, { recursive: true, force: true }); } };
}

test('planning only reads metadata, replaces packaged game files and preserves configs/saves/extras', async () => {
    const f = fixture();
    try {
        const oldFiles = [entry('same.pak', 'good'), entry('Game/game.iso', 'old ISO'), entry('saves/slot.dat', 'old save'), entry('settings.ini', 'old settings'), entry('obsolete.dll', 'old')];
        for (const file of oldFiles) f.write(f.root, file.path, 'x'.repeat(file.sizeBytes));
        f.write(f.root, 'extra-user-file.txt', 'leave this');
        const nextFiles = [entry('same.pak', 'good'), entry('Game/game.iso', 'new ISO'), entry('new.dll', 'new')];
        const plan = await createUpdatePlan(f.root, { files: oldFiles }, { files: nextFiles }, { origin: 'port' });
        assert.equal(plan.unchangedFiles, 1, 'same-sized files with the same manifest hash are reused without hashing local contents');
        assert.equal(plan.protectedFiles, 0);
        assert.deepEqual(plan.replace.map(file => file.path), ['Game/game.iso', 'new.dll']);
        assert.deepEqual(plan.remove.map(file => file.path), ['obsolete.dll']);
        assert.equal(f.read('extra-user-file.txt'), 'leave this');
        assert.equal(f.read('same.pak'), 'xxxx', 'integrity repair remains an explicit operation');
    } finally { f.cleanup(); }
});

test('file to directory and directory to file transitions install correctly', async () => {
    for (const direction of ['file-to-directory', 'directory-to-file']) {
        const f = fixture();
        try {
            const previous = { files: [entry(direction === 'file-to-directory' ? 'content' : 'content/old.bin', 'old')] };
            const next = { files: [entry(direction === 'file-to-directory' ? 'content/new.bin' : 'content', 'new')] };
            f.write(f.root, previous.files[0].path, 'old');
            f.write(f.payload, next.files[0].path, 'new');
            const plan = await createUpdatePlan(f.root, previous, next);
            await applyUpdate({ root: f.root, id, payload: f.payload, plan, marker: { ...f.marker, archiveKey: 'new-package' } });
            assert.equal(f.read(next.files[0].path), 'new');
            assert.equal(JSON.parse(f.read('.merlin-install.json')).archiveKey, 'new-package');
        } finally { f.cleanup(); }
    }
});

test('a real process exit after file/directory replacement rolls back on restart', async () => {
    for (const direction of ['file-to-directory', 'directory-to-file']) {
        const f = fixture();
        try {
            const previous = { files: [entry(direction === 'file-to-directory' ? 'content' : 'content/old.bin', 'old')] };
            const next = { files: [entry(direction === 'file-to-directory' ? 'content/new.bin' : 'content', 'new')] };
            f.write(f.root, previous.files[0].path, 'old');
            f.write(f.payload, next.files[0].path, 'new');
            const plan = await createUpdatePlan(f.root, previous, next);
            const modulePath = require.resolve('../src/main/custom-games/update-files');
            const args = { root: f.root, id, payload: f.payload, plan, marker: { ...f.marker, archiveKey: 'new-package' } };
            const program = `const {applyUpdate}=require(${JSON.stringify(modulePath)}); applyUpdate({...${JSON.stringify(args)},onProgress(p){if(p.files===2)process.exit(97)}}).catch(e=>{console.error(e);process.exit(1)});`;
            const crashed = spawnSync(process.execPath, ['-e', program], { encoding: 'utf8', timeout: 15000, windowsHide: true });
            assert.equal(crashed.status, 97, crashed.stderr);
            assert.equal(f.read(next.files[0].path), 'new');
            assert.equal(await recoverUpdate(f.root, id), true);
            assert.equal(f.read(previous.files[0].path), 'old');
            assert.deepEqual(JSON.parse(f.read('.merlin-install.json')), f.marker);
            assert.equal(fs.existsSync(path.join(f.base, `.merlin-update-${id}`)), false);
            assert.equal(await recoverUpdate(f.root, id), false);
        } finally { f.cleanup(); }
    }
});

test('unknown local content blocks a directory replacement before downloading', async () => {
    const f = fixture();
    try {
        f.write(f.root, 'content/old.bin', 'old');
        f.write(f.root, 'content/user-data.dat', 'my data');
        await assert.rejects(createUpdatePlan(f.root, { files: [entry('content/old.bin', 'old')] }, { files: [entry('content', 'new')] }), /update_path_conflict/);
        assert.equal(f.read('content/user-data.dat'), 'my data');
        assert.equal(f.read('content/old.bin'), 'old');
    } finally { f.cleanup(); }
});

test('rollback itself can stop after restoring an original parent and resume idempotently', async () => {
    const f = fixture();
    try {
        f.write(f.root, 'content', 'old');
        f.write(f.payload, 'content/new.bin', 'new');
        const plan = await createUpdatePlan(f.root, { files: [entry('content', 'old')] }, { files: [entry('content/new.bin', 'new')] });
        const modulePath = require.resolve('../src/main/custom-games/update-files');
        const args = { root: f.root, id, payload: f.payload, plan, marker: { ...f.marker, archiveKey: 'new-package' } };
        const crashApply = `const {applyUpdate}=require(${JSON.stringify(modulePath)});applyUpdate({...${JSON.stringify(args)},onProgress(p){if(p.files===2)process.exit(97)}}).catch(e=>{console.error(e);process.exit(1)});`;
        assert.equal(spawnSync(process.execPath, ['-e', crashApply], { encoding: 'utf8', timeout: 15000, windowsHide: true }).status, 97);
        const crashRecovery = `const fs=require('node:fs');const {recoverUpdate}=require(${JSON.stringify(modulePath)});const move=fs.promises.rename;fs.promises.rename=async function(source,target){await move(source,target);if(target===${JSON.stringify(path.join(f.root, 'content'))})process.exit(98)};recoverUpdate(${JSON.stringify(f.root)},${JSON.stringify(id)}).catch(e=>{console.error(e);process.exit(1)});`;
        const crashed = spawnSync(process.execPath, ['-e', crashRecovery], { encoding: 'utf8', timeout: 15000, windowsHide: true });
        assert.equal(crashed.status, 98, crashed.stderr);
        assert.equal(f.read('content'), 'old');
        assert.equal(await recoverUpdate(f.root, id), true);
        assert.equal(f.read('content'), 'old');
        assert.deepEqual(JSON.parse(f.read('.merlin-install.json')), f.marker);
    } finally { f.cleanup(); }
});

test('a crash during committed backup cleanup keeps the new version on restart', async () => {
    const f = fixture();
    try {
        f.write(f.root, 'game.exe', 'old');
        f.write(f.payload, 'game.exe', 'new');
        const plan = await createUpdatePlan(f.root, { files: [entry('game.exe', 'old')] }, { files: [entry('game.exe', 'new')] });
        const modulePath = require.resolve('../src/main/custom-games/update-files');
        const args = { root: f.root, id, payload: f.payload, plan, marker: { ...f.marker, archiveKey: 'new-package' } };
        const files = path.join(f.base, `.merlin-update-${id}`, 'files');
        const program = `const fs=require('node:fs');const {applyUpdate}=require(${JSON.stringify(modulePath)});const remove=fs.promises.rm;fs.promises.rm=async function(target,options){await remove(target,options);if(target===${JSON.stringify(files)})process.exit(99)};applyUpdate(${JSON.stringify(args)}).catch(e=>{console.error(e);process.exit(1)});`;
        const crashed = spawnSync(process.execPath, ['-e', program], { encoding: 'utf8', timeout: 15000, windowsHide: true });
        assert.equal(crashed.status, 99, crashed.stderr);
        assert.equal(f.read('game.exe'), 'new');
        assert.equal(JSON.parse(f.read('.merlin-install.json')).archiveKey, 'new-package');
        assert.equal(await recoverUpdate(f.root, id), true);
        assert.equal(f.read('game.exe'), 'new');
        assert.equal(JSON.parse(f.read('.merlin-install.json')).archiveKey, 'new-package');
    } finally { f.cleanup(); }
});

test('a torn final operations record is ignored and known completed changes roll back', async () => {
    const f = fixture();
    try {
        const backup = path.join(f.base, `.merlin-update-${id}`);
        fs.mkdirSync(path.join(backup, 'files'), { recursive: true });
        fs.writeFileSync(path.join(backup, 'journal.json'), JSON.stringify({ format: 2, id, root: f.root, marker: f.marker, committed: false, entries: [] }));
        fs.writeFileSync(path.join(backup, 'operations.ndjson'), `${JSON.stringify({ type: 'intent', entry: { path: 'new.bin', hadOriginal: false, applied: true } })}\n{"type":"intent","entry":`);
        f.write(f.root, 'new.bin', 'new');
        assert.equal(await recoverUpdate(f.root, id), true);
        assert.equal(fs.existsSync(path.join(f.root, 'new.bin')), false);
        assert.deepEqual(JSON.parse(f.read('.merlin-install.json')), f.marker);
    } finally { f.cleanup(); }
});

test('new local data appearing during download survives a failed apply and rollback', async () => {
    const f = fixture();
    try {
        const previous = { files: [entry('content/old.bin', 'old')] };
        const next = { files: [entry('content', 'new')] };
        f.write(f.root, 'content/old.bin', 'old');
        f.write(f.payload, 'content', 'new');
        const plan = await createUpdatePlan(f.root, previous, next);
        f.write(f.root, 'content/user-data.dat', 'my data');
        await assert.rejects(applyUpdate({ root: f.root, id, payload: f.payload, plan, marker: { ...f.marker, archiveKey: 'new-package' } }), /update_path_conflict/);
        assert.equal(f.read('content/user-data.dat'), 'my data');
        assert.equal(f.read('content/old.bin'), 'old');
        assert.deepEqual(JSON.parse(f.read('.merlin-install.json')), f.marker);
    } finally { f.cleanup(); }
});

test('pristine interrupted journal initialization recovers, but unknown backup data is retained', async () => {
    const f = fixture();
    try {
        const backup = path.join(f.base, `.merlin-update-${id}`);
        fs.mkdirSync(path.join(backup, 'files'), { recursive: true });
        assert.equal(await recoverUpdate(f.root, id), true);
        assert.equal(fs.existsSync(backup), false);
        fs.mkdirSync(path.join(backup, 'files'), { recursive: true });
        fs.writeFileSync(path.join(backup, 'files', 'unexpected.bin'), 'only copy');
        await assert.rejects(recoverUpdate(f.root, id), /update_recovery_required/);
        assert.equal(fs.readFileSync(path.join(backup, 'files', 'unexpected.bin'), 'utf8'), 'only copy');
    } finally { f.cleanup(); }
});

test('a junction in an installed parent or backup is rejected without touching the target', async () => {
    const f = fixture();
    try {
        const outside = path.join(f.base, 'Outside');
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, 'keep.dat'), 'outside');
        fs.symlinkSync(outside, path.join(f.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(createUpdatePlan(f.root, { files: [] }, { files: [entry('linked/keep.dat', 'new')] }), /unsafe_install_path/);
        const backup = path.join(f.base, `.merlin-update-${id}`);
        fs.symlinkSync(outside, backup, process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(recoverUpdate(f.root, id), /unsafe_install_path/);
        assert.equal(fs.readFileSync(path.join(outside, 'keep.dat'), 'utf8'), 'outside');
    } finally { f.cleanup(); }
});

test('selective ZIP transfer verifies decompressed bytes before apply and refuses a corrupt payload', async () => {
    for (const corrupt of [false, true]) {
        const f = fixture();
        try {
            const content = Buffer.from('the new game data');
            const compressed = zlib.deflateRawSync(corrupt ? Buffer.from('wrong game data') : content);
            const file = { ...entry('data.pak', content), zip: { method: 8, compressedSize: compressed.length } };
            const plan = { replace: [{ ...file, entryIndex: 0 }], remove: [], unchangedFiles: 1, protectedFiles: 0 };
            const requests = [];
            const options = { staging: path.join(f.base, 'Staging'), item: { packageType: 'zip' }, manifest: { files: [file] }, plan,
                request: async (relative, requestOptions) => {
                    requests.push({ relative, range: requestOptions.headers.Range });
                    return { status: 206, headers: { 'content-range': `bytes 0-${compressed.length - 1}/${compressed.length}` }, data: Readable.from([compressed]) };
                }, onProgress() {} };
            if (corrupt) await assert.rejects(stageUpdate(options), /archive_integrity_failed/);
            else {
                const staged = await stageUpdate(options);
                assert.equal(fs.readFileSync(path.join(staged.payload, 'data.pak'), 'utf8'), content.toString());
                assert.equal(staged.transferTotal, compressed.length);
                assert.deepEqual(requests, [{ relative: 'entries/0', range: `bytes=0-${compressed.length - 1}` }]);
            }
            assert.deepEqual(JSON.parse(f.read('.merlin-install.json')), f.marker);
        } finally { f.cleanup(); }
    }
});

test('an omitted game and protected saves can remain on another drive through junctions', async () => {
    const f = fixture();
    try {
        const outside = path.join(f.base, 'Outside');
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, 'keep.dat'), 'personal data');
        for (const directory of ['Game', 'saves']) {
            fs.symlinkSync(outside, path.join(f.root, directory), process.platform === 'win32' ? 'junction' : 'dir');
        }
        const files = [entry('Game/keep.dat', 'release'), entry('saves/keep.dat', 'release')];
        const plan = await createUpdatePlan(f.root, { files }, { files: [files[1]] }, { origin: 'port' });
        assert.equal(plan.replace.length, 0);
        assert.equal(plan.remove.length, 0);
        assert.equal(plan.protectedFiles, 1);
        assert.equal(fs.readFileSync(path.join(outside, 'keep.dat'), 'utf8'), 'personal data');
        // A package that includes game must never follow a junction outside the installation.
        await assert.rejects(createUpdatePlan(f.root, { files }, { files: [entry('Game/missing.dat', 'new')] },
            { origin: 'port' }), /unsafe_install_path/);
    } finally { f.cleanup(); }
});
