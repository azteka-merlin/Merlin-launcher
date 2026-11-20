const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const AdmZip = require('adm-zip');
const { exportCloudSave, validateManifest } = require('../src/main/cloud-sync/cloud-save-export');
const { saveFolders } = require('../src/main/cloud-sync/cloud-save-folders');

test('exports a complete V2 save with verified bytes and a readable ZIP', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-export-test-'));
    try {
        const bytes = Buffer.from('known save bytes');
        const sha = crypto.createHash('sha1').update(bytes).digest('hex');
        const target = path.join(root, 'export.zip');
        const result = await exportCloudSave({ accountId: '123', appId: '730', versionId: 'current', destination: target,
            getManifest: async () => ({ success: true, format: 2, appId: '730', createdAt: '2026-11-14T00:00:00Z',
                files: [{ name: 'WinMyDocuments/game/save.dat', sha, size: bytes.length }] }),
            getFile: async () => Readable.from([bytes]) });
        assert.equal(result.success, true);
        const zip = new AdmZip(target);
        assert.deepEqual(zip.readFile('Arquivos/WinMyDocuments/game/save.dat'), bytes);
        assert.equal(JSON.parse(zip.readAsText('merlin-save.json')).format, 'merlin-cloud-save-v2');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('rejects incomplete files and unsafe archive paths without publishing a ZIP', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-export-test-'));
    try {
        const bytes = Buffer.from('wrong bytes');
        const target = path.join(root, 'export.zip');
        await assert.rejects(exportCloudSave({ accountId: '123', appId: '730', versionId: 'current', destination: target,
            getManifest: async () => ({ success: true, format: 2, appId: '730', files: [
                { name: 'save.dat', sha: 'a'.repeat(40), size: bytes.length }] }),
            getFile: async () => Readable.from([bytes]) }), { code: 'cloud_export_integrity' });
        assert.equal(fs.existsSync(target), false);
        assert.throws(() => validateManifest({ success: true, format: 2, appId: '730', files: [
            { name: '../escape.dat', sha: 'a'.repeat(40), size: 1 }] }, '730'), { code: 'cloud_export_invalid' });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('downloads files concurrently with a fixed limit and verifies all ZIP entries', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-export-test-'));
    try {
        const bytes = Buffer.from('known save bytes');
        const sha = crypto.createHash('sha1').update(bytes).digest('hex');
        const files = Array.from({ length: 9 }, (_, index) => ({ name: `slot${index}.dat`, sha, size: bytes.length }));
        let active = 0;
        let peak = 0;
        const target = path.join(root, 'export.zip');
        await exportCloudSave({
            accountId: '123', appId: '730', versionId: 'current', destination: target,
            getManifest: async () => ({ success: true, format: 2, appId: '730', files }),
            getFile: async () => Readable.from((async function* () {
                peak = Math.max(peak, ++active);
                try {
                    await new Promise(resolve => setTimeout(resolve, 20));
                    yield bytes;
                } finally { active--; }
            })()),
        });
        assert.equal(peak, 4);
        assert.equal(active, 0);
        const archive = new AdmZip(target);
        for (const file of files) assert.deepEqual(archive.readFile('Arquivos/' + file.name), bytes);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('cancels the other downloads and leaves no ZIP when one file fails', { timeout: 3000 }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-export-test-'));
    try {
        const files = Array.from({ length: 6 }, (_, index) => ({ name: `slot${index}.dat`, sha: 'f'.repeat(40), size: 1 }));
        const target = path.join(root, 'export.zip');
        let admitBatch;
        let started = 0;
        let cancelled = 0;
        const batchReady = new Promise(resolve => { admitBatch = resolve; });
        await assert.rejects(exportCloudSave({
            accountId: '123', appId: '730', versionId: 'current', destination: target,
            getManifest: async () => ({ success: true, format: 2, appId: '730', files }),
            getFile: async (_account, _app, _version, name, { signal }) => {
                if (++started === 4) admitBatch();
                await batchReady;
                if (name === 'slot0.dat') return Readable.from([Buffer.from([1])]);
                return new Promise((_resolve, reject) => {
                    const cancel = () => { cancelled++; reject(signal.reason); };
                    if (signal.aborted) cancel();
                    else signal.addEventListener('abort', cancel, { once: true });
                });
            },
        }), { code: 'cloud_export_integrity' });
        assert.equal(started, 4);
        assert.equal(cancelled, 3);
        assert.equal(fs.existsSync(target), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('opens only an existing, validated save folder record', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-folder-test-'));
    try {
        const folder = path.join(root, 'Game Saves');
        fs.mkdirSync(folder);
        const record = path.join(root, 'Merlin', 'cloud', 'save-folders', '123', '730.txt');
        fs.mkdirSync(path.dirname(record), { recursive: true });
        fs.writeFileSync(record, `merlin-save-folders-v1\n${folder}\n`);
        assert.deepEqual(saveFolders(root, '123', '730'), [fs.realpathSync.native(folder)]);
        assert.deepEqual(saveFolders(root, '124', '730'), []);
        fs.rmSync(folder, { recursive: true });
        assert.deepEqual(saveFolders(root, '123', '730'), []);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('finds an existing local save from cloud file paths without a new DLL record', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-folder-test-'));
    try {
        const folder = path.join(root, 'Example Game', 'Steam', '123', 'SaveGames');
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(path.join(folder, 'System.sav'), 'local save');
        const hints = ['Example Game/Steam/123/SaveGames/Game0.sav',
            'Example Game/Steam/123/SaveGames/System.sav', '../other/secret.sav'];
        assert.deepEqual(saveFolders(root, '123', '730', { hints }), [fs.realpathSync.native(folder)]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
