const test = require('node:test');
const assert = require('node:assert/strict');

const { registerExistingIpc } = require('../src/main/ipc/register-existing-ipc');

test('preserves every existing IPC channel', () => {
    const channels = [];
    const ipcMain = { handle: channel => channels.push(channel) };
    const noop = () => {};

    registerExistingIpc({
        ipcMain,
        dialog: {},
        configStore: {},
        steamService: {},
        dllInstaller: {},
        gameInstaller: {},
        getMainWindow: noop
    });

    assert.deepEqual(channels, [
        'get-config',
        'validate-activation',
        'find-steam',
        'save-config',
        'select-steam-path',
        'verify-files',
        'detect-steam',
        'is-steam-running',
        'is-steam-detected',
        'check-files-status',
        'close-steam',
        'start-steam',
        'download-game'
    ]);
});

test('saving general settings cannot overwrite cloud opt-in from a stale renderer snapshot', async () => {
    const handlers = new Map();
    const invalidated = [];
    const config = {
        steamPath: 'C:\\Steam',
        language: 'ptbr',
        cloudSync: { enabled: true, startAtLogin: true },
        steamPlugin: { enabled: true },
    };
    registerExistingIpc({
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        configStore: {
            get: () => config,
            update: changes => Object.assign(config, changes),
        },
        libraryService: { invalidate: () => invalidated.push(true) },
    });

    const result = await handlers.get('save-config')(null, {
        steamPath: 'D:\\Steam',
        language: 'en',
        cloudSync: { enabled: false, startAtLogin: false },
        steamPlugin: { enabled: false },
    });

    assert.deepEqual(result, { success: true });
    assert.equal(config.steamPath, 'D:\\Steam');
    assert.equal(config.language, 'en');
    assert.deepEqual(config.cloudSync, { enabled: true, startAtLogin: true });
    assert.deepEqual(config.steamPlugin, { enabled: true });
    assert.equal(invalidated.length, 1);
});
