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
