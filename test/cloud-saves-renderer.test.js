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

function renderer(getGame) {
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
            async listGames() { return { success: true, games: [{ appId: '4231820', name: 'Castlevania', backupCount: 0 }] }; },
            getGame,
        } },
        merlinI18n: { register() {}, t: key => key, current: () => 'ptbr' },
        merlinView: { get: () => view, set(value) { view = value; events.get('merlin-view-changed')(); } },
        addEventListener(name, handler) { events.set(name, handler); },
    };
    vm.runInNewContext(script, { window, document });
    events.get('document:DOMContentLoaded')();
    return { get, window };
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
