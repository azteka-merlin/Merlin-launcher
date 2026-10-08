const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/shared/update-checker.js'), 'utf8');

function setupUpdateChecker(checkForUpdates, { hidden = false } = {}) {
    const events = new Map();
    const elements = new Map();
    const intervals = [];
    let now = 0;
    const element = id => {
        if (!elements.has(id)) {
            const handlers = new Map();
            elements.set(id, {
                hidden: id === 'updateNoticeBadge' || id === 'updateAvailableModal',
                disabled: false,
                style: {},
                addEventListener: (name, handler) => handlers.set(name, handler),
                click: () => handlers.get('click')?.()
            });
        }
        return elements.get(id);
    };
    const document = {
        hidden,
        getElementById: element,
        addEventListener: (name, handler) => events.set(`document:${name}`, handler)
    };
    const window = {
        electronAPI: {
            getVersion: async () => '2.0.8',
            checkForUpdates,
            onUpdateDownloadProgress: () => {}
        },
        addEventListener: (name, handler) => events.set(name, handler),
        setInterval: (handler, delay) => { intervals.push({ handler, delay }); return intervals.length; }
    };
    const FakeDate = class extends Date { static now() { return now; } };
    vm.runInNewContext(source, { window, document, Date: FakeDate });
    return {
        events, intervals, document, element,
        start: () => events.get('document:DOMContentLoaded')(),
        setTime: value => { now = value; }
    };
}

const available = version => ({ success: true, updateAvailable: true, currentVersion: '2.0.8', latestVersion: version, downloadUrl: 'https://api-merlin.com/api/updates/download' });
const none = { success: true, updateAvailable: false };
const drain = () => new Promise(resolve => setImmediate(resolve));

test('navigation checks for a newly published update without reopening a dismissed version', async () => {
    const results = [none, available('2.0.9'), available('2.0.9'), available('2.0.10')];
    let checks = 0;
    const app = setupUpdateChecker(async () => { checks++; return results.shift(); });
    await app.start();
    assert.equal(checks, 1);
    assert.equal(app.element('updateAvailableModal').hidden, true);

    app.setTime(20_000);
    app.events.get('merlin-view-changed')();
    await drain();
    assert.equal(checks, 2);
    assert.equal(app.element('updateNoticeBadge').hidden, false);
    assert.equal(app.element('updateAvailableModal').hidden, false);
    assert.match(app.element('updateAvailableMessage').textContent, /2\.0\.9/);

    app.element('updateLaterBtn').click();
    assert.equal(app.element('updateAvailableModal').hidden, true);
    app.setTime(21_000);
    app.events.get('merlin-view-changed')();
    await drain();
    assert.equal(checks, 2);

    app.setTime(40_000);
    app.events.get('merlin-view-changed')();
    await drain();
    assert.equal(checks, 3);
    assert.equal(app.element('updateAvailableModal').hidden, true);

    app.setTime(60_000);
    app.events.get('merlin-view-changed')();
    await drain();
    assert.equal(checks, 4);
    assert.equal(app.element('updateAvailableModal').hidden, false);
    assert.match(app.element('updateAvailableMessage').textContent, /2\.0\.10/);
});

test('the background interval detects a release and foreground checks respect the throttle', async () => {
    const results = [none, available('2.0.9'), available('2.0.9')];
    let checks = 0;
    const app = setupUpdateChecker(async () => { checks++; return results.shift(); }, { hidden: true });
    await app.start();
    assert.equal(app.intervals.length, 1);
    assert.equal(app.intervals[0].delay, 5 * 60 * 1000);

    app.setTime(5 * 60 * 1000);
    app.intervals[0].handler();
    await drain();
    assert.equal(checks, 2);
    assert.equal(app.element('updateAvailableModal').hidden, false);

    app.document.hidden = false;
    app.events.get('document:visibilitychange')();
    app.events.get('focus')();
    await drain();
    assert.equal(checks, 2);

    app.setTime(5 * 60 * 1000 + 16_000);
    app.events.get('focus')();
    await drain();
    assert.equal(checks, 3);
});

test('overlapping and failed checks do not erase a known update', async () => {
    let finishCheck;
    let checks = 0;
    const app = setupUpdateChecker(() => {
        checks++;
        if (checks === 1) return Promise.resolve(available('2.0.9'));
        return new Promise(resolve => { finishCheck = resolve; });
    });
    await app.start();
    app.setTime(20_000);
    app.events.get('merlin-view-changed')();
    app.events.get('focus')();
    assert.equal(checks, 2);
    finishCheck({ success: false });
    await drain();
    assert.equal(app.element('updateNoticeBadge').hidden, false);
    assert.equal(app.element('updateAvailableModal').hidden, false);
});
