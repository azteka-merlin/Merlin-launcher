const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { collectRecentSteamIntegrationLog } = require('../src/main/support/steam-integration-log');
const { registerSupportLogIpc } = require('../src/main/ipc/register-support-log-ipc');

async function withLogDirectory(t) {
    const localAppData = await fs.mkdtemp(path.join(os.tmpdir(), 'merlin-support-log-'));
    t.after(() => fs.rm(localAppData, { recursive: true, force: true }));
    const logDirectory = path.join(localAppData, 'Merlin', 'logs');
    await fs.mkdir(logDirectory, { recursive: true });
    return { localAppData, logDirectory };
}

function warning(timestamp, message) {
    return `[${timestamp} UTC] [WARN] Steam pattern metadata unavailable\n${message}\n\n`;
}

test('exports only the last 24 hours from the fixed Steam log and its rotation', async t => {
    const { localAppData, logDirectory } = await withLogDirectory(t);
    await fs.writeFile(path.join(logDirectory, 'merlin_steam_integration.log.1'),
        warning('2026-10-05 11:59:59', 'Too old') +
        warning('2026-10-05 12:30:00', 'Previous file\nExpected TOML: C:\\Steam\\missing.toml'));
    await fs.writeFile(path.join(logDirectory, 'merlin_steam_integration.log'),
        warning('2026-10-06 11:00:00', 'Current file\nAuthorization: Bearer secret-value\nx-api-key: stpriv_private') +
        warning('2026-10-06 12:01:00', 'Future entry'));
    await fs.writeFile(path.join(logDirectory, 'other.log'), warning('2026-10-06 11:00:00', 'Unrelated file'));

    const text = await collectRecentSteamIntegrationLog({
        localAppData,
        now: Date.parse('2026-10-06T12:00:00Z')
    });
    assert.match(text, /Previous file\nExpected TOML: C:\\Steam\\missing\.toml/);
    assert.match(text, /Current file/);
    assert.ok(text.indexOf('Previous file') < text.indexOf('Current file'));
    assert.doesNotMatch(text, /Too old|Future entry|Unrelated file|secret-value|stpriv_private/);
    assert.match(text, /Authorization: Bearer \[REDACTED\]/);
    assert.match(text, /x-api-key: \[REDACTED\]/);
});

test('returns no export when both known logs have no recent entries', async t => {
    const { localAppData, logDirectory } = await withLogDirectory(t);
    const now = Date.parse('2026-10-06T12:00:00Z');
    assert.equal(await collectRecentSteamIntegrationLog({ localAppData, now }), null);
    await fs.writeFile(path.join(logDirectory, 'merlin_steam_integration.log'),
        warning('2026-10-04 12:00:00', 'Old entry'));
    assert.equal(await collectRecentSteamIntegrationLog({ localAppData, now }), null);
});

test('uses a rolling UTC interval rather than the local calendar date', async t => {
    const { localAppData, logDirectory } = await withLogDirectory(t);
    await fs.writeFile(path.join(logDirectory, 'merlin_steam_integration.log'),
        warning('2026-10-06 02:00:00', 'Written at 23:00 in Sao Paulo on October 5'));
    const text = await collectRecentSteamIntegrationLog({
        localAppData,
        now: Date.parse('2026-10-06T03:10:00Z')
    });
    assert.match(text, /Written at 23:00 in Sao Paulo on October 5/);
});

test('copies the filtered log and saves a TXT only after the user picks a path', async t => {
    const { localAppData, logDirectory } = await withLogDirectory(t);
    const date = new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace('T', ' ');
    await fs.writeFile(path.join(logDirectory, 'merlin_steam_integration.log'), warning(date, 'Recent issue'));
    const savedPath = path.join(localAppData, 'support.txt');
    const clipboardWrites = [];
    let handler;
    registerSupportLogIpc({
        ipcMain: { handle: (channel, callback) => {
            assert.equal(channel, 'support:export-steam-log');
            handler = callback;
        } },
        clipboard: { writeText: text => clipboardWrites.push(text) },
        dialog: { showSaveDialog: async () => ({ canceled: false, filePath: savedPath }) },
        getMainWindow: () => null,
        getDownloadsPath: () => localAppData,
        localAppData
    });

    assert.deepEqual(await handler(), { status: 'saved' });
    assert.equal(clipboardWrites.length, 1);
    assert.match(clipboardWrites[0], /Recent issue/);
    assert.equal(await fs.readFile(savedPath, 'utf8'), clipboardWrites[0]);
});

test('canceling the save dialog keeps the log on the clipboard', async t => {
    const { localAppData, logDirectory } = await withLogDirectory(t);
    const date = new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace('T', ' ');
    await fs.writeFile(path.join(logDirectory, 'merlin_steam_integration.log'), warning(date, 'Recent issue'));
    const clipboardWrites = [];
    let handler;
    registerSupportLogIpc({
        ipcMain: { handle: (_channel, callback) => { handler = callback; } },
        clipboard: { writeText: text => clipboardWrites.push(text) },
        dialog: { showSaveDialog: async () => ({ canceled: true }) },
        getMainWindow: () => null,
        getDownloadsPath: () => localAppData,
        localAppData
    });

    assert.deepEqual(await handler(), { status: 'copied' });
    assert.equal(clipboardWrites.length, 1);
    assert.match(clipboardWrites[0], /Recent issue/);
});

test('export never overwrites its source log', async t => {
    const { localAppData, logDirectory } = await withLogDirectory(t);
    const sourcePath = path.join(logDirectory, 'merlin_steam_integration.log');
    const date = new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace('T', ' ');
    const original = warning(date, 'Keep original');
    await fs.writeFile(sourcePath, original);
    let handler;
    registerSupportLogIpc({
        ipcMain: { handle: (_channel, callback) => { handler = callback; } },
        clipboard: { writeText: () => {} },
        dialog: { showSaveDialog: async () => ({ canceled: false, filePath: sourcePath }) },
        getMainWindow: () => null,
        getDownloadsPath: () => localAppData,
        localAppData
    });

    assert.deepEqual(await handler(), { status: 'save_failed' });
    assert.equal(await fs.readFile(sourcePath, 'utf8'), original);
});
