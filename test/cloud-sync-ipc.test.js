const test = require('node:test');
const assert = require('node:assert/strict');
const { registerCloudSyncIpc } = require('../src/main/ipc/register-cloud-sync-ipc');

function fixture({ running = true, connected = true, installError = null } = {}) {
    const handlers = new Map();
    const events = [];
    let enabled = false;
    let installed = false;
    const cloudSyncService = {
        status: () => ({ available: true, enabled, connected: enabled && connected }),
        async enable() { events.push('connect'); enabled = connected; return this.status(); },
        async disable() { events.push('revoke'); enabled = false; return this.status(); },
        async renew() { events.push('renew'); return this.status(); }
    };
    registerCloudSyncIpc({
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        cloudSyncService,
        dllInstaller: {
            cloudSupportReady: () => installed,
            installCloudSupport: () => {
                events.push('install');
                if (installError) throw installError;
                installed = true;
            }
        },
        getSteamPath: () => 'C:\\Steam',
        getSteamReadiness: () => ({ ok: true, reason: 'required_files_missing' }),
        isSteamRunning: async () => running,
        stopSteam: async () => { events.push('stopSteam'); return true; },
        onStateChanged: () => events.push('stateChanged')
    });
    return { invoke: (channel) => handlers.get(channel)(), events };
}

test('activation connects, stops Steam and installs required files without Repair', async () => {
    const { invoke, events } = fixture();
    const result = await invoke('cloud-sync:enable');
    assert.equal(result.success, true);
    assert.equal(result.connected, true);
    assert.equal(result.filesReady, true);
    assert.equal(result.steamWasRunning, true);
    assert.deepEqual(events, ['connect', 'stopSteam', 'install', 'stateChanged']);
});

test('activation does not touch Steam if connection fails', async () => {
    const { invoke, events } = fixture({ connected: false });
    const result = await invoke('cloud-sync:enable');
    assert.equal(result.success, false);
    assert.deepEqual(events, ['connect']);
});

test('failed install revokes connection and reports that Steam was stopped', async () => {
    const error = new Error('locked');
    error.code = 'EPERM';
    const { invoke, events } = fixture({ installError: error });
    const result = await invoke('cloud-sync:enable');
    assert.equal(result.success, false);
    assert.equal(result.code, 'cloud_files_permission');
    assert.equal(result.steamWasRunning, true);
    assert.deepEqual(events, ['connect', 'stopSteam', 'install', 'revoke', 'stateChanged']);
});

test('deactivation stops Steam before revoking access', async () => {
    const { invoke, events } = fixture();
    await invoke('cloud-sync:enable');
    events.length = 0;
    const result = await invoke('cloud-sync:disable');
    assert.equal(result.success, true);
    assert.equal(result.enabled, false);
    assert.deepEqual(events, ['stopSteam', 'revoke', 'stateChanged']);
});
