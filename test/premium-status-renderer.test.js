const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../src/renderer/premium/premium.js'), 'utf8');
function element() {
    const listeners = new Map();
    return {
        hidden: true, value: '', textContent: '', children: [], disabled: false, dataset: {}, style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(name, fn) { listeners.set(name, fn); },
        click() { if (!this.disabled) return listeners.get('click')?.({ stopPropagation() {} }); },
        emit(name, event = {}) { return listeners.get(name)?.({ preventDefault() {}, stopPropagation() {}, ...event }); },
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
        querySelectorAll() { return []; }, setAttribute() {}, focus() {},
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    };
}
function harness(api) {
    const nodes = new Map();
    const events = new Map();
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    let view = '';
    const document = { getElementById: get, querySelector: get, createElement: element,
        addEventListener(name, fn) { events.set(`document:${name}`, fn); } };
    const window = {
        electronAPI: { premium: { onProgress() {}, ...api }, getConfig: async () => ({ premiumIntroSeen: true }) },
        merlinI18n: { register() {}, t: key => key, current: () => 'ptbr' },
        libraryModel: { filterItems: items => items, paginate: items => ({ visible: items, totalPages: 1, currentPage: 1 }) },
        merlinView: { get: () => view, set(value) { view = value; events.get('merlin-view-changed')(); } },
        addEventListener(name, fn) { events.set(name, fn); },
    };
    vm.runInNewContext(script, { window, document, setInterval() {}, clearTimeout() {}, setTimeout: fn => fn() });
    events.get('document:DOMContentLoaded')();
    return { get, window, events, button: () => get('premiumGrid').children[0]?.children[5].children[0] };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const item = status => ({ appId: '123', gameName: 'Jogo', archiveAvailable: true, activationLimit: 2,
    availability: { availableSlots: 2, cooldownEntries: [] }, viewer: { status, cooldownUntil: '2099-01-01T00:00:00Z' } });

test('refresh after a failed activation shows the server cooldown', async () => {
    const ui = harness({ list: async () => ({ success: true, online: true, items: [item('available')] }),
        refresh: async () => ({ success: true, online: true, items: [item('cooldown')] }),
        activate: async () => ({ success: false, code: 'activate_failed', statusRequired: true }),
        operationStatus: async () => ({ success: true, status: 'active', cooldownUntil: '2099-01-01T00:00:00Z' }) });
    ui.window.merlinView.set('premium'); await settle();
    ui.button().click(); await settle(); await settle();
    assert.equal(ui.button().textContent, 'premium_in_cooldown');
    assert.equal(ui.button().disabled, true);
});

test('a catalog refresh cannot clear uncertainty until the operation is confirmed', async () => {
    let online = false;
    let outcome = 'pending';
    const ui = harness({ list: async () => ({ success: true, online: true, items: [item('available')] }),
        refresh: async () => ({ success: true, online, stale: !online, items: [item('available')] }),
        activate: async () => ({ success: false, code: 'activate_failed', statusRequired: true }),
        operationStatus: async () => ({ success: true, status: outcome }) });
    ui.window.merlinView.set('premium'); await settle();
    ui.button().click(); await settle(); await settle();
    assert.equal(ui.button().textContent, 'premium_check_status');
    assert.equal(ui.button().disabled, true);
    ui.get('premiumProgressCloseBtn').click();
    online = true; ui.get('premiumRefreshBtn').click(); await settle(); await settle();
    assert.equal(ui.button().textContent, 'premium_check_status');
    outcome = 'failed'; ui.get('premiumRefreshBtn').click(); await settle(); await settle();
    assert.equal(ui.button().textContent, 'premium_activate_now');
});

test('a catalog request started before activation finished is followed by a fresh request', async () => {
    let finishActivation;
    let finishEarlierRefresh;
    let refreshes = 0;
    const ui = harness({
        list: async () => ({ success: true, online: true, items: [item('available')] }),
        activate: () => new Promise(resolve => { finishActivation = resolve; }),
        refresh: () => ++refreshes === 1
            ? new Promise(resolve => { finishEarlierRefresh = resolve; })
            : Promise.resolve({ success: true, online: true, items: [item('cooldown')] }),
    });
    ui.window.merlinView.set('premium'); await settle();
    ui.button().click();
    ui.get('premiumRefreshBtn').click();
    finishActivation({ success: false }); await settle();
    finishEarlierRefresh({ success: true, online: true, items: [item('available')] });
    await settle(); await settle();
    assert.equal(refreshes, 2);
    assert.equal(ui.button().textContent, 'premium_in_cooldown');
});

test('logout closes the progress modal and a new account can activate', async () => {
    let complete;
    let activations = 0;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [item('available')] }),
        refresh: async () => ({ success: true, online: true, items: [item('available')] }),
        cancel: async () => ({ success: true }),
        activate: () => { activations++; return new Promise(resolve => { complete = resolve; }); } });
    ui.window.merlinView.set('premium'); await settle(); ui.button().click();
    assert.equal(ui.get('premiumProgressModal').hidden, false);
    ui.events.get('merlin-logout')();
    assert.equal(ui.get('premiumProgressModal').hidden, true);
    complete({ success: true, cooldownUntil: '2099-01-01T00:00:00Z' }); await settle();
    ui.events.get('merlin-authenticated')(); await settle(); await settle();
    ui.button().click();
    assert.equal(activations, 2);
});

test('a successful activation keeps the known cooldown if catalog refresh fails', async () => {
    const ui = harness({ list: async () => ({ success: true, online: true, items: [item('available')] }),
        refresh: async () => ({ success: true, online: false, stale: true, items: [item('available')] }),
        activate: async () => ({ success: true, cooldownUntil: '2099-01-01T00:00:00Z' }) });
    ui.window.merlinView.set('premium'); await settle(); ui.button().click(); await settle(); await settle();
    assert.equal(ui.get('premiumProgressCard').dataset.state, 'success');
    ui.get('premiumProgressCloseBtn').click();
    assert.equal(ui.button().textContent, 'premium_in_cooldown');
    assert.equal(ui.button().disabled, true);
});

test('support retry reuses its private slot and forwards the grant id', async () => {
    const game = item('available'); game.availability.availableSlots = 0;
    game.viewer.canActivate = true;
    game.viewer.retry = { id: '37', status: 'available', expiresAt: '2099-01-01T00:00:00Z' };
    let request;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }),
        refresh: async () => ({ success: true, online: true, items: [item('cooldown')] }),
        activate: async payload => { request = payload; return { success: true, cooldownUntil: '2099-01-01T00:00:00Z' }; } });
    ui.window.merlinView.set('premium'); await settle();
    assert.equal(ui.button().textContent, 'premium_retry_action'); assert.equal(ui.button().disabled, false);
    ui.button().click(); await settle(); await settle();
    assert.equal(request.retryGrantId, '37'); assert.ok(request.operationId);
});

test('wishlist prefills email and requires consent only when a phone is supplied', async () => {
    const game = item('locked'); game.comingSoon = true; game.viewer.contactEmail = 'owner@example.com';
    let saved;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }),
        wishlist: async payload => { saved = payload; return { success: true }; } });
    ui.window.merlinView.set('premium'); await settle(); ui.button().click();
    assert.equal(ui.get('premiumInterestModal').hidden, false);
    assert.equal(ui.get('premiumInterestEmail').value, 'owner@example.com');
    assert.equal(ui.get('premiumInterestPhoneGroup').hidden, false);
    ui.get('premiumInterestPhone').value = '11999999999';
    await ui.get('premiumInterestForm').emit('submit');
    assert.equal(saved, undefined); assert.equal(ui.get('premiumInterestError').textContent, 'premium_consent_required');
    ui.get('premiumInterestConsent').checked = true; await ui.get('premiumInterestForm').emit('submit');
    assert.equal(saved.phoneConsent, true); assert.equal(saved.email, 'owner@example.com');
    assert.equal(ui.get('premiumInterestModal').hidden, true);
    assert.equal(ui.get('premiumWishlistGrid').children.length, 1);
});

test('slot notification opens an email-only dialog without activation', async () => {
    const game = item('unavailable'); game.availability.availableSlots = 0;
    let saved;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }),
        slotWatch: async payload => { saved = payload; return { success: true }; } });
    ui.window.merlinView.set('premium'); await settle();
    const availability = ui.get('premiumGrid').children[0].children[3];
    availability.children[2].click();
    assert.equal(ui.get('premiumInterestPhoneGroup').hidden, true);
    assert.equal(ui.get('premiumInterestEmail').value, '');
    ui.get('premiumInterestEmail').value = 'alert@example.com';
    await ui.get('premiumInterestForm').emit('submit');
    assert.equal(saved.email, 'alert@example.com'); assert.equal(saved.phone, undefined);
    assert.equal(game.viewer.slotWatching, true);
});

test('server-side pending and review states are explicit even without a local operation id', async () => {
    const game = item('reserved'); game.viewer.operationStatus = 'review';
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }) });
    ui.window.merlinView.set('premium'); await settle();
    assert.equal(ui.button().disabled, true); assert.equal(ui.button().textContent, 'premium_support_review');
    game.viewer.operationStatus = 'pending'; ui.events.get('merlin-language-changed')();
    assert.equal(ui.button().textContent, 'premium_pending_confirmation');
});

test('a game with no slot does not claim it is available now', async () => {
    const game = item('unavailable'); game.availability.availableSlots = 0;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }) });
    ui.window.merlinView.set('premium'); await settle();
    assert.equal(ui.get('premiumGrid').children[0].children[4].textContent, 'premium_no_slots_hint');
});

test('terminal confirmation replaces the stale pending catalog and retry state', async () => {
    const game = item('reserved');
    game.viewer.pendingOperationId = 'older-operation'; game.viewer.operationStatus = 'pending';
    game.viewer.retry = { id: '7', status: 'processing', expiresAt: '2099-01-01T00:00:00Z' };
    let refreshes = 0;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }),
        operationStatus: async () => ({ success: true, status: 'active', cooldownUntil: '2099-01-01T00:00:00Z' }),
        refresh: async () => { refreshes++; return { success: true, online: true, items: [item('cooldown')] }; } });
    ui.window.merlinView.set('premium'); await settle(); await settle();
    assert.equal(ui.button().textContent, 'premium_in_cooldown'); assert.equal(refreshes, 1);
});


test('wishlist phone formats typing, pasted numbers and middle edits while preserving the caret', async () => {
    const game = item('locked'); game.comingSoon = true;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }) });
    ui.window.merlinView.set('premium'); await settle(); ui.button().click();
    const phone = ui.get('premiumInterestPhone');
    const input = (value, caret = value.length) => { phone.value = value; phone.setSelectionRange(caret, caret); phone.emit('input'); };
    input('1'); assert.equal(phone.value, '(1'); assert.equal(phone.selectionStart, 2);
    input('(11'); assert.equal(phone.value, '(11');
    input('(11) 33334444'); assert.equal(phone.value, '(11) 3333-4444');
    input('11999999999'); assert.equal(phone.value, '(11) 99999-9999');
    input('+55 11 99999 9999'); assert.equal(phone.value, '+55 (11) 99999-9999');
    input('5511999999999'); assert.equal(phone.value, '+55 (11) 99999-9999');
    input('(11) 93999-9999', 7); assert.equal(phone.value, '(11) 93999-9999'); assert.equal(phone.selectionStart, 7);
    input('1193999999', 4); assert.equal(phone.value, '(11) 9399-9999'); assert.equal(phone.selectionStart, 7);
    input(''); assert.equal(phone.value, ''); assert.equal(phone.selectionStart, 0);
});

test('wishlist phone preserves international numbers and a reopened dialog has no old contact or consent', async () => {
    const game = item('locked'); game.comingSoon = true;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }) });
    ui.window.merlinView.set('premium'); await settle(); ui.button().click();
    const phone = ui.get('premiumInterestPhone');
    for (const value of ['+351 912 345 678', '+1 212 555 1234', '123456789012345']) {
        phone.value = value; phone.emit('input'); assert.equal(phone.value, value);
    }
    ui.get('premiumInterestConsent').checked = true;
    ui.get('premiumInterestCancelBtn').click(); ui.button().click();
    assert.equal(phone.value, ''); assert.equal(ui.get('premiumInterestConsent').checked, false);
});

test('wishlist phone is optional and a formatted phone still requires contact consent', async () => {
    const game = item('locked'); game.comingSoon = true; game.viewer.contactEmail = 'owner@example.com';
    let saved;
    const ui = harness({ list: async () => ({ success: true, online: true, items: [game] }),
        wishlist: async payload => { saved = payload; return { success: true }; } });
    ui.window.merlinView.set('premium'); await settle(); ui.button().click();
    const phone = ui.get('premiumInterestPhone');
    phone.value = '11999999999'; phone.emit('input');
    await ui.get('premiumInterestForm').emit('submit'); assert.equal(saved, undefined);
    ui.get('premiumInterestConsent').checked = true;
    await ui.get('premiumInterestForm').emit('submit');
    assert.equal(saved.phone, '(11) 99999-9999'); assert.equal(saved.phoneConsent, true);
    const blankGame = item('locked'); blankGame.comingSoon = true; blankGame.viewer.contactEmail = 'owner@example.com';
    const blank = harness({ list: async () => ({ success: true, online: true, items: [blankGame] }),
        wishlist: async payload => { saved = payload; return { success: true }; } });
    blank.window.merlinView.set('premium'); await settle(); blank.button().click();
    await blank.get('premiumInterestForm').emit('submit');
    assert.equal(saved.phone, undefined); assert.equal(saved.phoneConsent, undefined);
});
