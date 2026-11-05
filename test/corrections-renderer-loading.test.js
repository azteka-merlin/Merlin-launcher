const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../src/renderer/corrections/corrections.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const item = { appId: '123', gameName: 'Example Game', correction: { href: 'https://example.com/fix.zip', filename: 'fix.zip' } };

function harness({ listItems = [], refreshItems = [item] } = {}) {
    const nodes = new Map(); const listeners = new Map(); const translations = {}; const calls = [];
    const on = (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]);
    const emit = (name, event = {}) => (listeners.get(name) || []).forEach(fn => fn(event));
    function element() {
        return { hidden: true, disabled: false, value: '', textContent: '', children: [], dataset: {}, style: {},
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute() {}, addEventListener() {}, focus() {}, replaceWith() {},
            replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); } };
    }
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    let view = 'add-games';
    const document = { getElementById: get, querySelector: get, createElement: element,
        addEventListener: (name, fn) => on(`document:${name}`, fn) };
    const window = { merlinI18n: { register(x) { Object.assign(translations, x.ptbr); }, t(key) { return translations[key] || key; } },
        merlinView: { get: () => view, set(value) { view = value; emit('merlin-view-changed'); } },
        electronAPI: { corrections: {
            async list() { calls.push('list'); return { success: true, items: listItems }; },
            async refresh() { calls.push('refresh'); return { success: true, items: refreshItems }; }, onProgress() {},
        }, async getConfig() { return { correctionsDisclaimerSeen: true }; } }, addEventListener: on };
    vm.runInNewContext(script, { window, document, setTimeout: fn => { fn(); return 0; }, clearTimeout() {}, URL });
    emit('document:DOMContentLoaded');
    return { window, get, calls };
}

test('opening corrections renders a catalog refreshed by a background offer', async () => {
    const ui = harness();
    assert.equal(await ui.window.merlinCorrections.offerFor('456'), 'not-found');
    assert.deepEqual(ui.calls, ['list', 'refresh']);
    assert.equal(ui.get('correctionsGrid').children.length, 0);
    ui.window.merlinView.set('corrections'); await settle();
    assert.equal(ui.get('correctionsGridWrap').hidden, false);
    assert.equal(ui.get('correctionsGrid').children.length, 1);
    assert.deepEqual(ui.calls, ['list', 'refresh']);
});

test('opening corrections normally still loads the catalog', async () => {
    const ui = harness(); ui.window.merlinView.set('corrections'); await settle();
    assert.deepEqual(ui.calls, ['refresh']);
    assert.equal(ui.get('correctionsGridWrap').hidden, false);
    assert.equal(ui.get('correctionsGrid').children.length, 1);
});
