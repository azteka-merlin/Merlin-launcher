const test = require('node:test');
const assert = require('node:assert/strict');
const { registerCloudSyncIpc } = require('../src/main/ipc/register-cloud-sync-ipc');

function fixture({ running = true, connected = true, installError = null, startEnabled = false, accountId = '123456' } = {}) {
    const handlers = new Map();
    const events = [];
    let enabled = startEnabled;
    let installed = false;
    const cloudSyncService = {
        status: () => ({ available: true, enabled, connected: enabled && connected }),
        async enable() { events.push('connect'); enabled = connected; return this.status(); },
        async disable() { events.push('revoke'); enabled = false; return this.status(); },
        async renew() { events.push('renew'); return this.status(); },
        async restoreGame(account, appId, recoveryId) {
            events.push(['restore', account, appId, recoveryId]);
            return { success: true };
        },
        async getGame(account, appId) {
            events.push(['getGame', account, appId]);
            return { success: true, game: { appId } };
        }
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
        getSteamAccountId: async () => accountId,
        isSteamRunning: async () => running,
        stopSteam: async () => { events.push('stopSteam'); return true; },
        onStateChanged: () => events.push('stateChanged')
    });
    return { invoke: (channel, ...args) => handlers.get(channel)(null, ...args), events };
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

test('restore works while Steam stays open and never stops it', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: true });
    const result = await invoke('cloud-sync:restore', '730', 'backup-id');
    assert.equal(result.success, true);
    assert.deepEqual(events, [['restore', '123456', '730', 'backup-id']]);
});

test('restore works with Steam closed using the account observed earlier in this Merlin session', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: false, accountId: '987654' });
    const result = await invoke('cloud-sync:restore', '730', 'backup-id');
    assert.equal(result.success, true);
    assert.deepEqual(events, [['restore', '987654', '730', 'backup-id']]);
});

test('the games list is unavailable while Steam is closed, even with a cached account', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: false, accountId: '987654' });
    assert.deepEqual(await invoke('cloud-sync:account-status'), { steamRunning: false, accountAvailable: false });
    assert.equal((await invoke('cloud-sync:list-games')).code, 'steam_closed');
    assert.deepEqual(events, []);
});

test('an already selected game can refresh after restore with Steam closed', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: false, accountId: '987654' });
    const result = await invoke('cloud-sync:get-game', '730');
    assert.equal(result.success, true);
    assert.deepEqual(events, [['getGame', '987654', '730']]);
});

test('restore fails closed when no Steam account can be identified', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: false, accountId: null });
    const result = await invoke('cloud-sync:restore', '730', 'backup-id');
    assert.equal(result.code, 'steam_account_unavailable');
    assert.deepEqual(events, []);
});
