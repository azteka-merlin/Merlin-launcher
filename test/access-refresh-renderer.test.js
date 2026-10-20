const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/renderer/access/access.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function setupAccess() {
    const nodes = new Map();
    const handlers = new Map();
    const emitted = [];
    const statusCalls = [];
    const catalogCalls = [];
    const state = { tier: 'prata', request: null };
    let messages;
    const listen = (name, handler) => {
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(handler);
    };
    const emit = (name, detail) => {
        for (const handler of handlers.get(name) || []) handler({ type: name, detail });
    };
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, {
            hidden: false, textContent: '', dataset: {}, children: [],
            classList: { add() {}, remove() {}, toggle() {} },
            removeAttribute() {}, addEventListener() {},
            replaceChildren(...children) { this.children = children; }
        });
        return nodes.get(id);
    };
    const session = tier => ({ authenticated: true, license: {
        name: 'Test account', status: 'active', planTier: tier, expiresAt: '2030-12-31',
        billing: { canManageSubscription: true }
    } });
    const window = {
        merlinI18n: { register(value) { messages = value.ptbr; }, t: key => messages[key], current: () => 'ptbr' },
        electronAPI: {
            auth: { async status(options) {
                statusCalls.push(options);
                return state.request ? state.request() : session(state.tier);
            } },
            premium: { async list(options) {
                catalogCalls.push(options);
                return { success: true, items: [] };
            } }
        },
        addEventListener: listen,
        dispatchEvent(event) { emitted.push(event); emit(event.type, event.detail); }
    };
    const document = {
        getElementById: node, createElement: () => node(Symbol()),
        addEventListener: (name, handler) => listen(`document:${name}`, handler)
    };
    class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    vm.runInNewContext(source, { window, document, CustomEvent });
    emit('document:DOMContentLoaded');
    node('accessView').hidden = true;
    return {
        node, state, emitted, statusCalls, catalogCalls, session, emit,
        async open() { node('accessView').hidden = false; emit('merlin-view-changed', { view: 'access' }); await settle(); },
        leave() { node('accessView').hidden = true; emit('merlin-view-changed', { view: 'home' }); }
    };
}

test('each account access visit fetches the current plan and catalog without logging out', async () => {
    const ui = setupAccess();
    await ui.open();
    assert.equal(ui.node('accessPlanName').textContent, 'Plano Prata');
    ui.leave();
    ui.state.tier = 'ouro';
    await ui.open();
    assert.equal(ui.node('accessPlanName').textContent, 'Plano Ouro');
    assert.equal(ui.node('sidePlanLabel').dataset.tier, 'ouro');
    ui.leave();
    ui.state.tier = 'bronze';
    await ui.open();
    assert.equal(ui.node('accessPlanName').textContent, 'Plano Bronze');
    assert.equal(ui.statusCalls.length, 3);
    assert.ok(ui.statusCalls.every(options => options.forceRefresh === true));
    assert.ok(ui.catalogCalls.every(options => options.force === true));
    assert.deepEqual(ui.emitted.filter(event => event.type === 'merlin-session-updated')
        .map(event => event.detail.license.planTier), ['prata', 'ouro', 'bronze']);
});

test('opening access during an earlier request queues a fresh check instead of losing the visit', async () => {
    const ui = setupAccess();
    let finishFirst;
    ui.state.request = () => ui.statusCalls.length === 1
        ? new Promise(resolve => { finishFirst = resolve; })
        : ui.session(ui.state.tier);
    await ui.open();
    ui.state.tier = 'ouro';
    ui.leave();
    await ui.open();
    finishFirst(ui.session('prata'));
    await settle();
    await settle();
    assert.equal(ui.statusCalls.length, 2);
    assert.equal(ui.node('accessPlanName').textContent, 'Plano Ouro');
});

test('a refresh failure keeps existing access details visible and shows an update error', async () => {
    const ui = setupAccess();
    await ui.open();
    const eventsBefore = ui.emitted.length;
    ui.leave();
    ui.state.request = async () => { throw new Error('Offline'); };
    await ui.open();
    assert.equal(ui.node('accessPlanName').textContent, 'Plano Prata');
    assert.equal(ui.node('accessDetails').hidden, false);
    assert.equal(ui.node('accessError').hidden, false);
    assert.equal(ui.emitted.length, eventsBefore);
});

test('a pending access response cannot repaint the old account after logout', async () => {
    const ui = setupAccess();
    let finishRequest;
    ui.state.request = () => new Promise(resolve => { finishRequest = resolve; });
    await ui.open();
    ui.emit('merlin-logout');
    finishRequest(ui.session('prata'));
    await settle();
    assert.equal(ui.node('sidePlanLabel').textContent, '');
    assert.equal(ui.node('accessDetails').hidden, true);
    assert.equal(ui.emitted.length, 0);
});

test('preload forwards only the explicit access refresh flag and preserves existing status calls', async () => {
    const calls = [];
    let api;
    const electron = {
        contextBridge: { exposeInMainWorld(_name, value) { api = value; } },
        ipcRenderer: { invoke(...args) { calls.push(args); } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), {
        require: name => { assert.equal(name, 'electron'); return electron; }, process: { env: {} }
    });
    api.auth.status();
    api.auth.status({ forceRefresh: true, ignored: 'value' });
    api.auth.status({ forceRefresh: 'true' });
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
        ['auth:status'], ['auth:status', { forceRefresh: true }], ['auth:status']
    ]);
});
