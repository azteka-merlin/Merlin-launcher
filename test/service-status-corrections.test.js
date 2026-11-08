const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { createCorrectionsService } = require('../src/main/corrections/corrections-service');

function fixture(href, downloadResult) {
    const reports = [];
    const item = { appId: '123', gameName: 'Example', correction: { href, filename: 'fix.zip' } };
    const service = createCorrectionsService({
        fs, path, AdmZip, app: {}, dialog: { showSaveDialog: async () => ({ canceled: false, filePath: 'example.zip' }) },
        catalogStore: { list: () => [item] }, catalogClient: {}, apiBaseUrl: 'https://api.example/api',
        downloadManager: { download: async () => downloadResult, cancel() {} },
        authSession: { getAccessToken: async () => 'synthetic' },
        reportStatusEvidence: event => reports.push(event),
    });
    return { service, reports };
}

test('direct Ryuu HTTP failures are reported once after the real operation', async () => {
    const f = fixture('https://generator.ryuu.lol/fixes/example.zip', { success: false, code: 'download_failed', status: 503 });
    assert.equal((await f.service.download('123', 'operation-1')).success, false);
    assert.deepEqual(f.reports, [{ appId: '123', operation: 'operation-1', status: 503 }]);
});

test('missing files, cancellation, and API proxy failures do not produce direct-source reports', async () => {
    for (const [href, result] of [
        ['https://generator.ryuu.lol/fixes/example.zip', { success: false, status: 404 }],
        ['https://generator.ryuu.lol/fixes/example.zip', { success: false, code: 'cancelled' }],
        ['https://api.example/api/fixes/download?appid=123', { success: false, status: 503 }],
    ]) {
        const f = fixture(href, result);
        await f.service.download('123', 'operation-2');
        assert.equal(f.reports.length, 0);
    }
});
