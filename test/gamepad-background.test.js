const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
    const listeners = new Map();
    const addEventListener = (name, fn) => listeners.set(name, fn);
    const removeEventListener = (name, fn) => {
        if (listeners.get(name) === fn) listeners.delete(name);
    };
    const node = (options = {}) => ({
        style: {}, clicks: 0, disabled: false, isConnected: true,
        closest() { return this.hiddenAncestor ? {} : null; },
        getClientRects() { return this.noLayout ? [] : [{}]; },
        click() { this.clicks += 1; }, scrollIntoView() {}, ...options
    });
    const footer = node();
    const hiddenJoin = node({ hiddenAncestor: true });
    const modalButton = node();
    const modal = node({ hiddenAncestor: true, querySelectorAll: () => [modalButton] });
    const document = {
        readyState: 'complete', body: {}, hidden: false, focused: true,
        hasFocus() { return this.focused; }, addEventListener, removeEventListener,
        querySelectorAll(selector) {
            return selector.includes('[role="dialog"]') ? [modal] : [footer, hiddenJoin];
        },
        getElementById() { return null; }
    };
    const pad = { id: 'test-pad', index: 0, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    const navigator = { pads: [pad], getGamepads() { return this.pads; } };
    const window = { addEventListener, removeEventListener, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
    let observerDisconnected = false;
    const context = vm.createContext({
        window, document, navigator, console: { log() {} },
        MutationObserver: class { observe() {} disconnect() { observerDisconnected = true; } },
        requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout: fn => fn()
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../gamepad.js'), 'utf8') + '\nglobalThis.controller = gamepadController;', context);
    const controller = context.controller;
    const poll = () => controller.updateGamepad();
    const press = (index = 0) => { pad.buttons[index].pressed = true; poll(); };
    const release = (index = 0) => { pad.buttons[index].pressed = false; poll(); };
    return { controller, document, listeners, navigator, pad, footer, hiddenJoin, modal, modalButton,
        poll, press, release, observerDisconnected: () => observerDisconnected };
}

test('controller works in the foreground but does not click while hidden or unfocused', () => {
    const ui = harness();
    ui.press();
    assert.equal(ui.footer.clicks, 1);
    ui.release();
    ui.document.focused = false;
    for (let i = 0; i < 400; i += 1) { ui.press(); ui.release(); }
    ui.document.focused = true;
    ui.document.hidden = true;
    for (let i = 0; i < 400; i += 1) { ui.press(); ui.release(); }
    assert.equal(ui.footer.clicks, 1);
});

test('held buttons cannot open a link when returning from a game, including a paused polling loop', () => {
    const ui = harness();
    // Blur may happen between frames; requestAnimationFrame may pause immediately.
    ui.listeners.get('blur')();
    ui.pad.buttons[0].pressed = true;
    ui.poll(); ui.poll();
    assert.equal(ui.footer.clicks, 0);
    ui.release(); ui.press();
    assert.equal(ui.footer.clicks, 1);
});

test('hidden modal buttons are excluded and an open modal confines confirmation to its controls', () => {
    const ui = harness();
    assert.equal(ui.controller.focusableElements.includes(ui.hiddenJoin), false);
    ui.modal.hiddenAncestor = false;
    ui.press();
    assert.equal(ui.footer.clicks, 0);
    assert.equal(ui.modalButton.clicks, 1);
});

test('confirmation rechecks visibility and disabled state before clicking', () => {
    const ui = harness();
    ui.footer.disabled = true;
    ui.press();
    assert.equal(ui.footer.clicks, 0);
    ui.release();
    ui.footer.disabled = false;
    ui.footer.noLayout = true;
    ui.press();
    assert.equal(ui.footer.clicks, 0);
});

test('disconnected pads cannot leave a stale pressed button active', () => {
    const ui = harness();
    ui.navigator.pads = [null];
    ui.press();
    assert.equal(ui.controller.gamepad, null);
    assert.equal(ui.footer.clicks, 0);
    ui.navigator.pads = [ui.pad];
    ui.poll();
    assert.equal(ui.footer.clicks, 0);
    ui.release(); ui.press();
    assert.equal(ui.footer.clicks, 1);
});

test('destroy removes focus, visibility and connection listeners and the DOM observer', () => {
    const ui = harness();
    ui.controller.destroy();
    for (const name of ['blur', 'visibilitychange', 'gamepadconnected', 'gamepaddisconnected']) {
        assert.equal(ui.listeners.has(name), false);
    }
    assert.equal(ui.observerDisconnected(), true);
});
