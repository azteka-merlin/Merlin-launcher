const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/renderer/shared/service-status-v1.js'), 'utf8');

function harness(initial) {
    const nodes = new Map(), timers = new Map(), sockets = [];
    let timerId = 0, fetches = 0;
    function node(id) {
        if (!nodes.has(id)) nodes.set(id, {
            hidden: true, textContent: '', children: [], attrs: {}, listeners: {},
            classList: { toggle() {} },
            setAttribute(key, value) { this.attrs[key] = value; },
            addEventListener(name, fn) { this.listeners[name] = fn; },
            replaceChildren() { this.children = []; },
            append(...children) { this.children.push(...children); }, contains(target) { return target === this; }, focus() {}
        });
        return nodes.get(id);
    }
    const document = { listeners: {}, getElementById: node, createElement: () => node(Symbol()), addEventListener(name, fn) { this.listeners[name] = fn; } };
    const window = { listeners: {}, merlinI18n: { register() {}, t: key => key }, addEventListener(name, fn) { this.listeners[name] = fn; } };
    class Socket {
        static OPEN = 1; static CONNECTING = 0;
        constructor() { this.readyState = 0; sockets.push(this); }
        close() { this.readyState = 3; this.onclose?.(); }
        open() { this.readyState = 1; this.onopen?.(); }
        message(payload) { this.onmessage?.({ data: JSON.stringify(payload) }); }
    }
    vm.runInNewContext(source, { window, document, URL, WebSocket: Socket, AbortController,
        fetch: async () => { fetches++; return { ok: true, json: async () => initial }; },
        setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id), Math, Number, String, Array });
    return { window, document, nodes, timers, sockets, get fetches() { return fetches; } };
}

test('disabled server leaves the legacy monitor in control', async () => {
    const h = harness({ enabled: false });
    assert.equal(await h.window.merlinStatusV1.start('https://example.test/api'), false);
    assert.equal(h.sockets.length, 0);
});

test('snapshot and newer websocket updates render once; stale updates are ignored', async () => {
    const h = harness({ schemaVersion: 1, revision: 0, incidents: [] });
    assert.equal(await h.window.merlinStatusV1.start('https://example.test/api'), true);
    const ws = h.sockets[0]; ws.open();
    ws.message({ schemaVersion: 1, revision: 2, incidents: [{ messageKey: 'corrections_limited' }] });
    assert.equal(h.nodes.get('statusV1Root').hidden, false);
    assert.equal(h.nodes.get('statusV1BadgeText').textContent, 'status_v1_multiple');
    assert.equal(h.nodes.get('statusV1Title').textContent, 'status_v1_corrections_title');
    assert.equal(h.nodes.get('statusV1Items').children[0].children.length, 1);
    ws.message({ schemaVersion: 1, revision: 1, incidents: [] });
    assert.equal(h.nodes.get('statusV1Root').hidden, false);
    assert.equal(h.fetches, 1);
    assert.equal([...h.timers.values()].some(timer => timer.ms === 120000), false);
    ws.close();
    assert.equal([...h.timers.values()].some(timer => timer.ms === 120000), true);
    const reconnect = [...h.timers.entries()].find(([, timer]) => timer.ms < 120000);
    assert.ok(reconnect);
    h.timers.delete(reconnect[0]); reconnect[1].fn();
    assert.equal(h.sockets.length, 2);
    const next = h.sockets[1]; next.open();
    next.message({ schemaVersion: 1, revision: 3, incidents: [] });
    assert.equal(h.nodes.get('statusV1Root').hidden, true);
    assert.equal([...h.timers.values()].some(timer => timer.ms === 120000), false);
});

test('badge opens only on click, stays open on updates, and closes on second click, outside click or Escape', async () => {
    const h = harness({ schemaVersion: 1, revision: 0, incidents: [{ messageKey: 'corrections_catalog_limited', impact: 'limited' }] });
    assert.equal(await h.window.merlinStatusV1.start('https://example.test/api'), true);
    const badge = h.nodes.get('statusV1Badge'), panel = h.nodes.get('statusV1Panel');
    assert.equal(panel.hidden, true);
    assert.equal(badge.listeners.mouseenter, undefined);
    badge.listeners.click();
    assert.equal(panel.hidden, false);
    assert.equal(badge.attrs['aria-expanded'], 'true');
    h.sockets[0].message({ schemaVersion: 1, revision: 1, incidents: [
        { messageKey: 'corrections_catalog_limited', impact: 'limited' },
        { messageKey: 'add_games_limited', impact: 'limited' }
    ] });
    assert.equal(panel.hidden, false);
    assert.equal(h.nodes.get('statusV1BadgeText').textContent, 'status_v1_multiple');
    assert.equal(h.nodes.get('statusV1Title').textContent, 'status_v1_title');
    assert.equal(h.nodes.get('statusV1Items').children.length, 2);
    assert.equal(h.nodes.get('statusV1Items').children[0].children.length, 2);
    badge.listeners.click();
    assert.equal(panel.hidden, true);
    badge.listeners.click();
    h.nodes.get('statusV1Root').contains = target => target === badge || target === panel;
    h.document.listeners.pointerdown({ target: panel });
    assert.equal(panel.hidden, false);
    h.document.listeners.pointerdown({ target: h.nodes.get('pollNoticeBadge') });
    assert.equal(panel.hidden, true);
    assert.equal(badge.attrs['aria-expanded'], 'false');
    badge.listeners.click();
    h.window.listeners.keydown({ key: 'Escape' });
    assert.equal(panel.hidden, true);
    assert.equal(badge.attrs['aria-expanded'], 'false');
});

test('Ryuu source changes refresh the Corrections catalog without changing the badge interaction', async () => {
    const h = harness({ schemaVersion: 1, revision: 0, incidents: [], correctionsSource: { ryuuEnabled: false } });
    const changes = [];
    h.window.merlinCorrections = { onRyuuSourceChanged: enabled => changes.push(enabled) };
    assert.equal(await h.window.merlinStatusV1.start('https://example.test/api'), true);
    assert.deepEqual(changes, [false]);
    h.sockets[0].message({ schemaVersion: 1, revision: 1, incidents: [], correctionsSource: { ryuuEnabled: true } });
    assert.deepEqual(changes, [false, true]);
    assert.equal(h.nodes.get('statusV1Root').hidden, true);
});
