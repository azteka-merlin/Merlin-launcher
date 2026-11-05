const test = require('node:test');
const assert = require('node:assert/strict');
const { createSocialLinkOpener } = require('../src/main/network/social-link-opener');

function harness(openExternal = async () => {}) {
    const state = { visible: true, focused: true, minimized: false, destroyed: false, time: 0 };
    const window = { webContents: {}, isDestroyed: () => state.destroyed, isVisible: () => state.visible,
        isFocused: () => state.focused, isMinimized: () => state.minimized };
    const calls = [];
    const open = createSocialLinkOpener({ getMainWindow: () => window, now: () => state.time,
        shell: { openExternal: async url => { calls.push(url); return openExternal(url); } } });
    const event = { sender: window.webContents };
    return { state, calls, open: (url = 'https://example.test/community', sender = event) => open(sender, url) };
}

test('social links never open from an inactive window or another renderer', async () => {
    const ui = harness();
    for (const [key, value] of [['visible', false], ['focused', false], ['minimized', true], ['destroyed', true]]) {
        const previous = ui.state[key];
        ui.state[key] = value;
        assert.equal((await ui.open()).code, 'window_inactive');
        ui.state[key] = previous;
    }
    assert.equal((await ui.open(undefined, { sender: {} })).success, false);
    assert.equal(ui.calls.length, 0);
    assert.equal((await ui.open()).success, true);
    assert.equal(ui.calls.length, 1);
});

test('repeated requests open one tab and intentional later requests still work', async () => {
    const ui = harness();
    await Promise.all(Array.from({ length: 400 }, () => ui.open()));
    assert.equal(ui.calls.length, 1);
    assert.equal((await ui.open()).code, 'already_opening');
    ui.state.time = 3000;
    assert.equal((await ui.open()).success, true);
    assert.equal(ui.calls.length, 2);
});

test('a pending browser launch remains deduplicated after the cooldown', async () => {
    let finish;
    const ui = harness(() => new Promise(resolve => { finish = resolve; }));
    const first = ui.open();
    ui.state.time = 10000;
    assert.equal((await ui.open()).code, 'already_opening');
    finish();
    await first;
    assert.equal(ui.calls.length, 1);
});

test('browser failures are contained and allow a later retry', async () => {
    let failed = true;
    const ui = harness(async () => { if (failed) throw new Error('browser unavailable'); });
    assert.equal((await ui.open()).code, 'open_failed');
    failed = false;
    ui.state.time = 3000;
    assert.equal((await ui.open()).success, true);
});
