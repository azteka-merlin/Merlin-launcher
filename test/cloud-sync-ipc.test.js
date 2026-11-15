const test = require('node:test');
const assert = require('node:assert/strict');
const { registerCloudSyncIpc, defaultCloudSaveFilename } = require('../src/main/ipc/register-cloud-sync-ipc');

function fixture({ running = true, connected = true, installError = null, startEnabled = false,
    accountId = '123456', getAccountId = null, getGameError = null,
    restoreResult = { success: true }, startResult = true, dialog = undefined } = {}) {
    const handlers = new Map();
    const events = [];
    let enabled = startEnabled;
    let installed = false;
    const cloudSyncService = {
        status: () => ({ available: true, enabled, connected: enabled && connected }),
        async enable() { events.push('connect'); enabled = connected; return this.status(); },
        async disable() { events.push('revoke'); enabled = false; return this.status(); },
        async retry() { events.push('retry'); return this.status(); },
        async restoreGame(account, appId, recoveryId) {
            events.push(['restore', account, appId, recoveryId]);
            return restoreResult;
        },
        async getGame(account, appId) {
            events.push(['getGame', account, appId]);
            if (getGameError) throw getGameError;
            return { success: true, game: { appId } };
        },
        async listGames(account) { events.push(['listGames', account]); return { success: true, games: [] }; },
        cachedGames(account) { events.push(['cachedGames', account]); return { success: true, accountId: account, games: [] }; }
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
        getSteamAccountId: getAccountId || (async () => accountId),
        isSteamRunning: async () => running,
        stopSteam: async () => { events.push('stopSteam'); return true; },
        startSteam: async () => { events.push('startSteam'); return startResult; },
        dialog,
        onStateChanged: () => events.push('stateChanged')
    });
    return { invoke: (channel, ...args) => handlers.get(channel)(null, ...args), events };
}

test('suggests the game name with local date and time for a save ZIP', async () => {
    const now = new Date(2026, 10, 14, 16, 57);
    assert.equal(defaultCloudSaveFilename('The Adventures of Elliot: The Millennium Tales', '3483510', now),
        'save-the-adventures-of-elliot-the-millennium-tales-14-11-26-16-57.zip');
    assert.equal(defaultCloudSaveFilename('  /:*?  ', '3483510', now), 'save-3483510-14-11-26-16-57.zip');
    let suggested;
    const { invoke } = fixture({ startEnabled: true, dialog: { showSaveDialog: async options => {
        suggested = options.defaultPath;
        return { canceled: true };
    } } });
    assert.equal((await invoke('cloud-sync:export', '3483510', 'current', 'Elliot: The Millennium Tales')).code, 'cancelled');
    assert.match(suggested, /^save-elliot-the-millennium-tales-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/);
});

test('activation connects, stops Steam and installs required files without Repair', async () => {
    const { invoke, events } = fixture();
    const result = await invoke('cloud-sync:enable');
    assert.equal(result.success, true);
    assert.equal(result.connected, true);
    assert.equal(result.filesReady, true);
    assert.equal(result.steamWasRunning, true);
    assert.deepEqual(events, ['connect', 'stopSteam', 'install', 'stateChanged']);
});

test('retries a temporarily unavailable Steam account before loading the games list', async () => {
    let reads = 0;
    const { invoke, events } = fixture({ startEnabled: true,
        getAccountId: async () => ++reads === 1 ? null : '123456' });
    assert.deepEqual(await invoke('cloud-sync:list-games'), { success: true, games: [], accountId: '123456' });
    assert.deepEqual(events, [['listGames', '123456']]);
});

test('retry reconnects without toggling cloud sync off or restarting Steam', async () => {
    const { invoke, events } = fixture({ startEnabled: true });
    const result = await invoke('cloud-sync:retry');
    assert.equal(result.enabled, true);
    assert.equal(result.connected, true);
    assert.deepEqual(events, ['retry']);
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

test('a failed runtime installation preserves an existing cloud preference', async () => {
    const error = new Error('locked');
    error.code = 'EPERM';
    const { invoke, events } = fixture({ installError: error, startEnabled: true });
    const result = await invoke('cloud-sync:enable');
    assert.equal(result.success, false);
    assert.equal(result.code, 'cloud_files_permission');
    assert.deepEqual(events, ['connect', 'stopSteam', 'install', 'stateChanged']);
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

test('stage restore restarts Steam only after the cloud restore succeeds', async () => {
    const { invoke, events } = fixture({ startEnabled: true, restoreResult: { success: true, restartSteam: true } });
    const result = await invoke('cloud-sync:restore', '730', 'backup-id');
    assert.equal(result.steamRestarted, true);
    assert.deepEqual(events, [['restore', '123456', '730', 'backup-id'], 'stopSteam', 'startSteam']);
});

test('a failed cloud restore never restarts Steam', async () => {
    const { invoke, events } = fixture({ startEnabled: true, restoreResult: { success: false, restartSteam: true } });
    assert.equal((await invoke('cloud-sync:restore', '730', 'backup-id')).success, false);
    assert.deepEqual(events, [['restore', '123456', '730', 'backup-id']]);
});

test('the games list is unavailable while Steam is closed, even with a cached account', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: false, accountId: '987654' });
    assert.deepEqual(await invoke('cloud-sync:account-status'), { steamRunning: false, accountAvailable: false, accountId: null });
    assert.equal((await invoke('cloud-sync:list-games')).code, 'steam_closed');
    assert.deepEqual(events, []);
});

test('cached games are only exposed for the live connected Steam account', async () => {
    const connected = fixture({ startEnabled: true, accountId: '123456' });
    assert.equal((await connected.invoke('cloud-sync:cached-games')).accountId, '123456');
    assert.deepEqual(connected.events, [['cachedGames', '123456']]);
    const closed = fixture({ startEnabled: true, running: false });
    assert.equal(await closed.invoke('cloud-sync:cached-games'), null);
    assert.deepEqual(closed.events, []);
});

test('an already selected game can refresh after restore with Steam closed', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: false, accountId: '987654' });
    const result = await invoke('cloud-sync:get-game', '730');
    assert.equal(result.success, true);
    assert.deepEqual(events, [['getGame', '987654', '730']]);
});

test('a timed out game detail request reports its actual cause', async () => {
    const { invoke } = fixture({ startEnabled: true,
        getGameError: Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }) });
    assert.equal((await invoke('cloud-sync:get-game', '730')).code, 'cloud_timeout');
});

test('restore fails closed when no Steam account can be identified', async () => {
    const { invoke, events } = fixture({ startEnabled: true, running: false, accountId: null });
    const result = await invoke('cloud-sync:restore', '730', 'backup-id');
    assert.equal(result.code, 'steam_account_unavailable');
    assert.deepEqual(events, []);
});
