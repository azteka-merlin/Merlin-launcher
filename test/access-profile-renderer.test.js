const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/renderer/access/access-profile.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const waitForDrawerClose = () => new Promise(resolve => setTimeout(resolve, 200));

function setup({ phone = null, deliveryMode = 'staging_test' } = {}) {
    const nodes = new Map();
    const handlers = new Map();
    const calls = { start: [], update: [] };
    let messages;
    const listen = (name, callback) => {
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(callback);
    };
    const emit = (name, detail) => (handlers.get(name) || []).forEach(callback => callback({ type: name, detail, target: detail?.target, key: detail?.key, preventDefault() {} }));
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, {
            id, hidden: false, readOnly: true, disabled: false, value: '', type: id === 'accessProfileKey' ? 'password' : 'text',
            textContent: '', dataset: {}, attributes: {},
            addEventListener(name, callback) { listen(`${id}:${name}`, callback); },
            setAttribute(name, value) { this.attributes[name] = value; },
            querySelector(selector) { return node(`${id}:${selector}`); },
            focus() { this.focused = true; document.activeElement = this; },
            click() { emit(`${id}:click`, { target: this }); },
        });
        return nodes.get(id);
    };
    const window = {
        merlinI18n: { register(value) { messages = value.ptbr; }, t: key => messages[key] },
        electronAPI: { auth: {
            async getProfile() { return { ok: true, profile: { licenseKey: 'MERLIN-ABCD-EFGH-IJKL', name: 'Original Name', email: 'old@example.com', phone } }; },
            async startProfileEmailVerification(email) { calls.start.push(email); return { ok: true, deliveryMode }; },
            async updateProfile(profile) { calls.update.push(profile); return { ok: true, profile: { licenseKey: 'MERLIN-ABCD-EFGH-IJKL', ...profile } }; },
        } },
        addEventListener: listen,
        dispatchEvent(event) { emit(event.type, event.detail); },
    };
    const document = {
        getElementById: node,
        activeElement: null,
        addEventListener: (name, callback) => listen(`document:${name}`, callback),
    };
    class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    vm.runInNewContext(source, { window, document, CustomEvent, setTimeout, clearTimeout });
    emit('document:DOMContentLoaded');
    node('accessView').hidden = false;
    node('accessProfileOverlay').hidden = true;
    return { node, calls, emit, async open() { emit('merlin-view-changed', { view: 'access' }); await settle(); } };
}

test('license key starts hidden and the eye reveals it only on click', async () => {
    const ui = setup();
    await ui.open();
    assert.equal(ui.node('accessProfileCard').hidden, false);
    assert.equal(ui.node('accessProfileKey').type, 'password');
    ui.node('accessProfileEye').click();
    assert.equal(ui.node('accessProfileKey').type, 'text');
    ui.emit('merlin-view-changed', { view: 'home' });
    assert.equal(ui.node('accessProfileKey').type, 'password');
});

test('drawer opens with current details and cancel discards edits', async () => {
    const ui = setup();
    await ui.open();
    ui.node('accessProfileEdit').click();
    assert.equal(ui.node('accessProfileOverlay').hidden, false);
    assert.equal(ui.node('accessProfileName').value, 'Original Name');
    assert.equal(ui.node('accessProfileEmail').value, 'old@example.com');
    ui.node('accessProfileName').value = 'Changed Name';
    ui.node('accessProfileCancel').click();
    assert.equal(ui.node('accessProfileOverlay').dataset.state, 'closing');
    assert.equal(ui.node('accessProfileOverlay').hidden, false);
    await waitForDrawerClose();
    assert.equal(ui.node('accessProfileOverlay').hidden, true);
    ui.node('accessProfileEdit').click();
    assert.equal(ui.node('accessProfileName').value, 'Original Name');
});

test('changing email requests a code before saving the profile', async () => {
    const ui = setup();
    await ui.open();
    ui.node('accessProfileEdit').click();
    ui.node('accessProfileEmail').value = 'new@example.com';
    ui.node('accessProfileSave').click();
    await settle();
    assert.deepEqual(ui.calls.start, ['new@example.com']);
    assert.equal(ui.calls.update.length, 0);
    for (const digit of '12345') {
        const index = '12345'.indexOf(digit);
        ui.node(`accessProfileCodeDigit${index}`).value = digit;
        ui.emit(`accessProfileCodeDigit${index}:input`);
    }
    assert.equal(ui.node('accessProfileCode').value, '12345');
    ui.node('accessProfileSave').click();
    await settle();
    assert.equal(ui.calls.update.length, 1);
    assert.equal(ui.calls.update[0].email, 'new@example.com');
    assert.equal(ui.calls.update[0].emailCode, '12345');
    await waitForDrawerClose();
    assert.equal(ui.node('accessProfileOverlay').hidden, true);
    assert.equal(ui.node('accessProfileSummaryEmail').textContent, 'new@example.com');
});

test('Brazilian mobile numbers are formatted for display and while editing', async () => {
    const ui = setup({ phone: '11987654321' });
    await ui.open();
    assert.equal(ui.node('accessProfileSummaryPhone').textContent, '(11) 98765-4321');
    ui.node('accessProfileEdit').click();
    assert.equal(ui.node('accessProfilePhone').value, '(11) 98765-4321');
    ui.node('accessProfilePhone').value = '21999998888';
    ui.emit('accessProfilePhone:input');
    assert.equal(ui.node('accessProfilePhone').value, '(21) 99999-8888');
});

test('invalid email shows a simple field error without requesting a code', async () => {
    const ui = setup();
    await ui.open();
    ui.node('accessProfileEdit').click();
    ui.node('accessProfileEmail').value = 'aaa@aaa.a';
    ui.node('accessProfileSave').click();
    assert.equal(ui.node('accessProfileEmailError').textContent, 'Formato do e-mail inválido.');
    assert.equal(ui.node('accessProfileEmailError').hidden, false);
    assert.equal(ui.node('accessProfileEmail').attributes['aria-invalid'], 'true');
    assert.equal(ui.calls.start.length, 0);
    ui.node('accessProfileClose').click();
    await waitForDrawerClose();
    assert.equal(ui.node('accessProfileOverlay').hidden, true);
});

test('six-digit email code fills the six boxes and is sent unchanged', async () => {
    const ui = setup({ deliveryMode: 'email' });
    await ui.open();
    ui.node('accessProfileEdit').click();
    ui.node('accessProfileEmail').value = 'new@example.com';
    ui.node('accessProfileSave').click();
    await settle();
    for (let index = 0; index < 6; index++) {
        ui.node(`accessProfileCodeDigit${index}`).value = String(index + 1);
        ui.emit(`accessProfileCodeDigit${index}:input`);
    }
    assert.equal(ui.node('accessProfileCode').value, '123456');
    ui.node('accessProfileSave').click();
    await settle();
    assert.equal(ui.calls.update[0].emailCode, '123456');
});
