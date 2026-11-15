const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/cloud-saves/cloud-saves.js'), 'utf8');

function element() {
    const listeners = new Map();
    return {
        hidden: false, value: '', textContent: '', children: [], disabled: false, dataset: {},
        classList: { add() {}, remove() {} },
        addEventListener(name, handler) { listeners.set(name, handler); },
        click() { return listeners.get('click')?.(); },
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
        setAttribute() {}, removeAttribute() {}, focus() {}, remove() {},
    };
}

function renderer(getGame, options = {}) {
    const nodes = new Map();
    const events = new Map();
    let view = 'settings';
    const get = id => {
        if (!nodes.has(id)) nodes.set(id, element());
        return nodes.get(id);
    };
    const document = {
        getElementById: get,
        querySelector: () => element(),
        createElement: () => element(),
        addEventListener(name, handler) { events.set(`document:${name}`, handler); },
    };
    const window = {
        electronAPI: { cloudSync: {
            ...(options.accountStatus ? { accountStatus: options.accountStatus } : {}),
            async cachedGames() { return options.cachedGames ? options.cachedGames() : null; },
            async listGames() { return options.listGames ? options.listGames() : { success: true, games: [{ appId: '4231820', name: 'Castlevania', backupCount: 0 }] }; },
            getGame,
            async export(appId, versionId, gameName) { return options.export(appId, versionId, gameName); },
            async restore(appId, backupId) { return options.restore(appId, backupId); },
        } },
        merlinRestartPrompt: { ask: async () => true },
        showNotification(message, type) { options.notify?.(message, type); },
        merlinI18n: { register() {}, t: key => key, current: () => 'ptbr' },
        merlinView: { get: () => view, set(value) { view = value; events.get('merlin-view-changed')(); } },
        setInterval(handler) { events.set('account-monitor', handler); return 1; },
        clearInterval() { events.delete('account-monitor'); },
        addEventListener(name, handler) { events.set(name, handler); },
    };
    vm.runInNewContext(script, { window, document });
    events.get('document:DOMContentLoaded')();
    return { get, window, events };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('reopening synced saves returns to the complete game list', async () => {
    const ui = renderer(async () => ({ success: true, game: {
        appId: '4231820', name: 'Castlevania', currentVersion: { fileCount: 2, totalSize: 23000 }, backups: [],
    } }));
    ui.window.merlinView.set('cloud-saves');
    await settle();
    ui.get('cloudSavesGameList').children[0].click();
    await settle();
    assert.equal(ui.get('cloudSavesDetailsState').hidden, false);

    ui.window.merlinView.set('settings');
    ui.get('cloudSavesSearchInput').value = 'missing game';
    ui.window.merlinView.set('cloud-saves');
    await settle();
    assert.equal(ui.get('cloudSavesListState').hidden, false);
    assert.equal(ui.get('cloudSavesDetailsState').hidden, true);
    assert.equal(ui.get('cloudSavesSearchInput').value, '');
    assert.equal(ui.get('cloudSavesGameList').children.length, 1);
});

test('a late game detail response cannot reopen details after reentry', async () => {
    let finishDetail;
    const ui = renderer(() => new Promise(resolve => { finishDetail = resolve; }));
    ui.window.merlinView.set('cloud-saves');
    await settle();
    ui.get('cloudSavesGameList').children[0].click();
    ui.window.merlinView.set('settings');
    ui.window.merlinView.set('cloud-saves');
    finishDetail({ success: true, game: { appId: '4231820', name: 'Castlevania', backups: [] } });
    await settle();
    assert.equal(ui.get('cloudSavesListState').hidden, false);
    assert.equal(ui.get('cloudSavesDetailsState').hidden, true);
});

test('shows cached games while the live list loads, then replaces them', async () => {
    let finishList;
    const ui = renderer(async () => ({ success: true, game: {} }), {
        cachedGames: async () => ({ success: true, accountId: '123456', games: [{ appId: '730', name: 'Cached' }] }),
        listGames: () => new Promise(resolve => { finishList = resolve; }),
    });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    assert.equal(ui.get('cloudSavesGameList').children.length, 1);
    assert.equal(ui.get('cloudSavesCacheNotice').hidden, false);
    finishList({ success: true, accountId: '123456', games: [{ appId: '730', name: 'Fresh' }] });
    await settle();
    assert.equal(ui.get('cloudSavesGameList').children.length, 1);
    assert.equal(ui.get('cloudSavesCacheNotice').hidden, true);
});

test('keeps a verified cache on timeout but clears it on logout', async () => {
    const ui = renderer(async () => ({ success: true, game: {} }), {
        cachedGames: async () => ({ success: true, accountId: '123456', games: [{ appId: '730', name: 'Cached' }] }),
        listGames: async () => ({ success: false, code: 'cloud_timeout' }),
    });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    await settle();
    assert.equal(ui.get('cloudSavesGameList').children.length, 1);
    assert.equal(ui.get('cloudSavesCacheNotice').hidden, false);
    ui.events.get('merlin-logout')();
    assert.equal(ui.get('cloudSavesGameList').children.length, 0);
});

test('does not keep cached games if the live Steam account changes during refresh', async () => {
    let calls = 0;
    const ui = renderer(async () => ({ success: true, game: {} }), {
        cachedGames: async () => ({ success: true, accountId: ++calls === 1 ? '123456' : '654321',
            games: [{ appId: '730', name: 'Cached' }] }),
        listGames: async () => ({ success: false, code: 'steam_account_changed' }),
    });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    await settle();
    assert.equal(ui.get('cloudSavesGameList').children.length, 0);
    assert.equal(ui.get('cloudSavesErrorState').hidden, false);
});

test('does not show an empty library when the server response has no games array', async () => {
    const ui = renderer(async () => ({ success: true, game: {} }), {
        listGames: async () => ({ success: true }),
    });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    assert.equal(ui.get('cloudSavesEmptyState').hidden, true);
    assert.equal(ui.get('cloudSavesErrorState').hidden, false);
});

test('refreshes automatically for the new Steam account and clears the old list', async () => {
    let account = '123456';
    let finishSecond;
    const ui = renderer(async () => ({ success: true, game: {} }), {
        accountStatus: async () => ({ steamRunning: true, accountAvailable: true, accountId: account }),
        listGames: () => account === '123456'
            ? Promise.resolve({ success: true, accountId: account, games: [{ appId: '730', name: 'Old' }] })
            : new Promise(resolve => { finishSecond = resolve; }),
    });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    assert.equal(ui.get('cloudSavesGameList').children.length, 1);
    account = '654321';
    ui.events.get('account-monitor')();
    await settle();
    assert.equal(ui.get('cloudSavesGameList').children.length, 0);
    finishSecond({ success: true, accountId: account, games: [{ appId: '440', name: 'New' }] });
    await settle();
    assert.equal(ui.get('cloudSavesGameList').children.length, 1);
    ui.window.merlinView.set('settings');
    assert.equal(ui.events.has('account-monitor'), false);
});

test('V1 and V2 restore send the selected backup directly to the server', async () => {
    for (const version of [undefined, 2]) {
        const calls = [];
        let finishRestore;
        const ui = renderer(async () => {
            calls.push('getGame');
            return { success: true, game: { appId: '730', name: 'Game', historyVersion: 2,
                currentVersion: { fileCount: 1 }, backups: [{ id: 'a'.repeat(64), version, fileCount: 1 }] } };
        }, { restore(appId, backupId) {
            calls.push(['restore', appId, backupId]);
            return new Promise(resolve => { finishRestore = resolve; });
        } });
        ui.window.merlinView.set('cloud-saves');
        await settle();
        ui.get('cloudSavesGameList').children[0].click();
        await settle();
        const card = ui.get('cloudSavesBackups').children[0];
        const restore = card.children[1].children.at(-1);
        restore.click();
        await settle();
        assert.deepEqual(calls, ['getGame', ['restore', '730', 'a'.repeat(64)]]);
        finishRestore({ success: false, code: 'recovery_not_found' });
        await settle();
    }
});

test('a planned Steam restart keeps the save details visible during and after restore', async () => {
    let finishRestore;
    let steamRunning = true;
    const ui = renderer(async () => ({ success: true, game: { appId: '730', name: 'Game',
        historyVersion: 2, currentVersion: { fileCount: 1 },
        backups: [{ id: 'a'.repeat(64), version: 2, fileCount: 1 }] } }), {
        accountStatus: async () => ({ steamRunning, accountAvailable: steamRunning,
            accountId: steamRunning ? '123456' : null }),
        listGames: async () => ({ success: true, accountId: '123456',
            games: [{ appId: '730', name: 'Game' }] }),
        restore: () => new Promise(resolve => { finishRestore = resolve; }),
    });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    ui.get('cloudSavesGameList').children[0].click();
    await settle();
    const restore = ui.get('cloudSavesBackups').children[0].children[1].children.at(-1);
    restore.click();
    await settle();
    steamRunning = false;
    ui.events.get('account-monitor')();
    await settle();
    assert.equal(ui.get('cloudSavesDetailsState').hidden, false);
    assert.equal(ui.get('cloudSavesErrorState').hidden, true);
    finishRestore({ success: true, restartSteam: true, steamRestarted: true });
    await settle();
    ui.events.get('account-monitor')();
    await settle();
    assert.equal(ui.get('cloudSavesDetailsState').hidden, false);
    assert.equal(ui.get('cloudSavesErrorState').hidden, true);
    steamRunning = true;
    ui.events.get('account-monitor')();
    await settle();
    assert.equal(ui.get('cloudSavesDetailsState').hidden, false);
});

test('save export passes the displayed game name to the file dialog', async () => {
    let selected;
    const ui = renderer(async () => ({ success: true, game: { appId: '3483510', name: 'Elliot: The Millennium Tales',
        currentVersion: { fileCount: 1, version: 2 }, backups: [] } }), {
        export: async (...args) => { selected = args; return { success: false, code: 'cancelled' }; },
    });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    ui.get('cloudSavesGameList').children[0].click();
    await settle();
    ui.get('cloudSavesCurrentExport').click();
    await settle();
    assert.deepEqual(selected, ['3483510', 'current', 'Elliot: The Millennium Tales']);
});

test('refreshing a game shows its existing skeleton and updates backups in place', async () => {
    let calls = 0;
    let finishRefresh;
    const ui = renderer(() => ++calls === 1
        ? Promise.resolve({ success: true, game: { appId: '4231820', name: 'Game',
            currentVersion: { fileCount: 1 }, backups: [] } })
        : new Promise(resolve => { finishRefresh = resolve; }));
    ui.window.merlinView.set('cloud-saves');
    await settle();
    ui.get('cloudSavesGameList').children[0].click();
    await settle();
    ui.get('cloudSavesDetailsRefreshBtn').click();
    assert.equal(ui.get('cloudSavesDetailsState').hidden, false);
    assert.equal(ui.get('cloudSavesDetailsLoadingState').hidden, false);
    assert.equal(ui.get('cloudSavesDetailsContent').hidden, true);
    assert.equal(ui.get('cloudSavesDetailsRefreshBtn').disabled, true);
    finishRefresh({ success: true, game: { appId: '4231820', name: 'Game',
        currentVersion: { fileCount: 2 }, backups: [{ id: 'a'.repeat(64), fileCount: 2 }] } });
    await settle();
    assert.equal(ui.get('cloudSavesDetailsState').hidden, false);
    assert.equal(ui.get('cloudSavesDetailsLoadingState').hidden, true);
    assert.equal(ui.get('cloudSavesDetailsContent').hidden, false);
    assert.equal(ui.get('cloudSavesBackups').children.length, 1);
    assert.equal(ui.get('cloudSavesDetailsRefreshBtn').disabled, false);
});

test('a failed game refresh restores the previous details', async () => {
    let calls = 0;
    let notice;
    const ui = renderer(async () => ++calls === 1
        ? { success: true, game: { appId: '4231820', name: 'Game',
            currentVersion: { fileCount: 1 }, backups: [{ id: 'a'.repeat(64), fileCount: 1 }] } }
        : { success: false, code: 'cloud_timeout' },
    { notify: message => { notice = message; } });
    ui.window.merlinView.set('cloud-saves');
    await settle();
    ui.get('cloudSavesGameList').children[0].click();
    await settle();
    ui.get('cloudSavesDetailsRefreshBtn').click();
    await settle();
    assert.equal(ui.get('cloudSavesDetailsState').hidden, false);
    assert.equal(ui.get('cloudSavesDetailsContent').hidden, false);
    assert.equal(ui.get('cloudSavesBackups').children.length, 1);
    assert.equal(notice, 'cloud_saves_error_cloud_timeout');
});
