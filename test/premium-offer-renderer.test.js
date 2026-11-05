const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'src/renderer/premium/premium-offer.js'), 'utf8');
const addScript = fs.readFileSync(path.join(root, 'src/renderer/add-games/add-games.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const game = (appId = '123', overrides = {}) => ({ appId, gameName: `Jogo ${appId}`, enabled: true, comingSoon: false, ...overrides });

function harness(options = {}) {
    const nodes = new Map();
    const handlers = new Map();
    const calls = [];
    const messages = {};
    const listen = (name, fn) => handlers.set(name, [...(handlers.get(name) || []), fn]);
    const emit = (name, value = {}) => Promise.all((handlers.get(name) || []).map(fn => fn(value)));
    let document;
    function element(tag = 'div') {
        const listeners = new Map();
        return {
            tag, hidden: true, disabled: false, value: '', checked: false, textContent: '', children: [], dataset: {}, style: {}, attributes: {},
            classList: { add() {}, remove() {}, toggle() {} },
            addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
            emit(name, event = {}) { return Promise.all((listeners.get(name) || []).map(fn => fn({ target: this, ...event }))); },
            click() { if (!this.disabled) return this.emit('click'); },
            dispatchEvent(event) { return this.emit(event.type, event); },
            setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; },
            replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
            focus() { document.activeElement = this; }, blur() {}, querySelectorAll() { return []; }
        };
    }
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    document = { activeElement: null, getElementById: get, querySelector: get, createElement: element,
        addEventListener: (name, fn) => listen(`document:${name}`, fn) };
    const window = {
        merlinI18n: { register(translations) { for (const [locale, entries] of Object.entries(translations)) messages[locale] = { ...messages[locale], ...entries }; }, t: key => messages.ptbr?.[key] || key },
        merlinView: { get: () => 'add-games', set(view) { calls.push(`view:${view}`); } },
        merlinCorrections: { async offerFor(id) { calls.push(`correction:${id}`); } },
        merlinRestartPrompt: { async ask() { calls.push('restart'); return false; } },
        addEventListener: listen,
        electronAPI: {
            premium: {
                async list() { calls.push('catalog'); return options.list ? options.list() : { success: true, online: true, items: [game()] }; },
                async refresh() { calls.push('refresh'); return options.refresh ? options.refresh() : { success: true, online: true, items: [] }; },
                activate() { throw new Error('An informational notice must never activate a game.'); }
            },
            games: {
                async listQueue() { return { items: [], count: 0, locked: false, installing: false }; },
                async installNow() { calls.push('install'); return options.installResult || { success: true, item: { appId: '123', name: 'Jogo 123' } }; },
                async installAll() { calls.push('batch'); return options.batchResult || { installed: [{ appId: '123', name: 'Jogo 123' }], failed: [] }; },
                onQueueUpdated() {}, onInstallProgress() {}
            }
        }
    };
    class Event { constructor(type, init) { this.type = type; Object.assign(this, init); } }
    const context = { window, document, URL, Event, requestAnimationFrame: fn => fn(), setTimeout() {}, clearTimeout() {} };
    vm.runInNewContext(script, context);
    if (options.addGames) vm.runInNewContext(addScript, context);
    return { get, window, calls, document, emit, start: () => emit('document:DOMContentLoaded') };
}

test('notice opens Premium filtered to the game without activating it', async () => {
    const ui = harness(); await ui.start();
    const pending = ui.window.merlinPremiumOffer.showForGames([{ appId: '123' }]); await settle();
    assert.equal(ui.get('premiumAvailableModal').hidden, false);
    assert.equal(ui.get('premiumAvailableTitle').textContent, 'Este jogo possui ativação Premium');
    await ui.get('premiumAvailableOpenBtn').click();
    assert.equal(await pending, 'open');
    assert.equal(ui.get('premiumAvailableModal').hidden, true);
    assert.equal(ui.get('premiumSearchInput').value, 'Jogo 123');
    assert.deepEqual(ui.calls, ['catalog', 'view:premium']);
});

test('batch notice refreshes a partial cache, deduplicates games and skips disabled or upcoming entries', async () => {
    const ui = harness({ list: () => ({ success: true, online: false, items: [game()] }),
        refresh: () => ({ success: true, online: true, items: [game(), game('456'), game('123'), game('789', { comingSoon: true }), game('111', { enabled: false })] }) });
    await ui.start();
    const pending = ui.window.merlinPremiumOffer.showForGames(['123', '456', '789', '111'].map(appId => ({ appId }))); await settle();
    assert.equal(ui.get('premiumAvailableGames').children.length, 2);
    assert.equal(ui.get('premiumAvailableTitle').textContent, 'Estes jogos possuem ativação Premium');
    assert.deepEqual(ui.calls, ['catalog', 'refresh']);
    ui.get('premiumSearchInput').value = 'Busca antiga';
    await ui.get('premiumAvailableOpenBtn').click(); await pending;
    assert.equal(ui.get('premiumSearchInput').value, '');
});

test('an ordinary game or invalid input does not show a Premium notice', async () => {
    const ui = harness(); await ui.start();
    assert.equal(await ui.window.merlinPremiumOffer.showForGames([{ appId: 'not-an-id' }]), 'not-found');
    assert.deepEqual(ui.calls, []);
    assert.equal(await ui.window.merlinPremiumOffer.showForGames([{ appId: '456' }]), 'not-found');
    assert.deepEqual(ui.calls, ['catalog']);
    assert.equal(ui.get('premiumAvailableModal').hidden, true);
});

test('Escape dismisses the notice and focus stays inside it while open', async () => {
    const ui = harness(); await ui.start();
    const previous = ui.get('installNowBtn'); previous.focus();
    const pending = ui.window.merlinPremiumOffer.showForGames([{ appId: '123' }]); await settle();
    assert.equal(ui.document.activeElement, ui.get('premiumAvailableOpenBtn'));
    await ui.emit('document:keydown', { key: 'Tab', preventDefault() {} });
    assert.equal(ui.document.activeElement, ui.get('premiumAvailableLaterBtn'));
    await ui.emit('document:keydown', { key: 'Escape', preventDefault() {} });
    assert.equal(await pending, 'later');
    assert.equal(ui.document.activeElement, previous);
    assert.ok(!ui.calls.some(x => x.startsWith('view:')));
});

test('logout cancels a pending lookup and closes an already visible notice', async () => {
    let finish;
    const ui = harness({ list: () => new Promise(resolve => { finish = resolve; }) }); await ui.start();
    const pending = ui.window.merlinPremiumOffer.showForGames([{ appId: '123' }]);
    await ui.emit('merlin-logout');
    finish({ success: true, items: [game()] });
    assert.equal(await pending, 'cancelled');
    assert.equal(ui.get('premiumAvailableModal').hidden, true);
    ui.window.electronAPI.premium.list = async () => ({ success: true, online: true, items: [game()] });
    const visible = ui.window.merlinPremiumOffer.showForGames([{ appId: '123' }]); await settle();
    await ui.emit('merlin-logout');
    assert.equal(await visible, 'cancelled');
    assert.equal(ui.get('premiumAvailableModal').hidden, true);
});

test('a catalog outage does not turn a successful single installation into an error', async () => {
    const ui = harness({ addGames: true, list() { throw new Error('offline'); } }); await ui.start();
    const pending = ui.get('installNowBtn').emit('click');
    await pending;
    assert.deepEqual(ui.calls, ['install', 'correction:123', 'restart', 'catalog']);
    assert.equal(ui.get('addGamesFeedback').dataset.type, 'success');
    assert.equal(ui.get('premiumAvailableModal').hidden, true);
});

test('a failed single installation never requests or displays Premium offers', async () => {
    const ui = harness({ addGames: true, installResult: { success: false, code: 'manifest_unavailable' } }); await ui.start();
    await ui.get('installNowBtn').emit('click');
    assert.deepEqual(ui.calls, ['install']);
    assert.equal(ui.get('premiumAvailableModal').hidden, true);
});

test('batch installation only offers successfully added games after corrections and the restart prompt', async () => {
    const ui = harness({ addGames: true,
        list: () => ({ success: true, online: true, items: [game(), game('456')] }),
        batchResult: { installed: [{ appId: '123', name: 'Jogo 123' }], failed: [{ appId: '456', name: 'Jogo 456' }] } });
    await ui.start();
    const pending = ui.get('installAllBtn').emit('click'); await settle();
    assert.deepEqual(ui.calls, ['batch', 'correction:123', 'restart', 'catalog']);
    assert.equal(ui.get('premiumAvailableGames').children.length, 1);
    assert.equal(ui.get('premiumAvailableGames').children[0].children[1].textContent, 'Jogo 123');
    await ui.get('premiumAvailableLaterBtn').click(); await pending;
});
