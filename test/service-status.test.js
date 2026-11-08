const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '../src/renderer/shared/service-status.js'),
    'utf8'
);

function response(status, body) {
    return {
        ok: status >= 200 && status < 300,
        json: async () => body
    };
}

function createHarness(outcomes, options = {}) {
    const elements = new Map();
    const documentListeners = new Map();
    const intervalCallbacks = [];
    const timeouts = [];

    function element(id) {
        if (!elements.has(id)) {
            elements.set(id, {
                hidden: id === 'serviceStatusBadge' || id === 'serviceStatusModal',
                textContent: '',
                classList: { toggle() {} },
                addEventListener() {}
            });
        }
        return elements.get(id);
    }

    const document = {
        getElementById: element,
        addEventListener(name, callback) {
            documentListeners.set(name, callback);
        }
    };
    const window = {
        merlinI18n: { register() {}, t: key => key },
        electronAPI: { qa: { simulateServiceIssue: false }, serviceStatusV1: options.v1Enabled ? { enabled: true, apiBaseUrl: 'https://staging.example/api' } : undefined },
        setTimeout(callback, delay) {
            timeouts.push({ callback, delay });
            return timeouts.length;
        },
        clearTimeout() {},
        setInterval(callback) {
            intervalCallbacks.push(callback);
            return intervalCallbacks.length;
        },
        addEventListener() {}
    };

    if (options.v1Enabled) window.merlinStatusV1 = { start: options.startV1 };

    vm.runInNewContext(source, {
        window,
        document,
        fetch: async () => {
            const outcome = outcomes.shift();
            if (outcome instanceof Error) throw outcome;
            return outcome;
        },
        AbortController: undefined
    });

    return {
        elements,
        intervalCallbacks,
        timeouts,
        status: window.merlinServiceStatus,
        start() {
            documentListeners.get('DOMContentLoaded')();
        },
        runRetry() {
            const index = timeouts.findIndex(timer => timer.delay === 1500);
            assert.notEqual(index, -1, 'confirmation retry should be scheduled');
            timeouts.splice(index, 1)[0].callback();
        }
    };
}

async function flushPromises() {
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

test('a transient service probe failure does not show the instability badge', async () => {
    const harness = createHarness([new Error('temporary network failure'), response(200, {
        status: 'ok',
        downloads_available: true
    })]);

    harness.start();
    await flushPromises();
    assert.equal(harness.elements.get('serviceStatusBadge').hidden, true);

    harness.runRetry();
    await flushPromises();

    assert.equal(harness.elements.get('serviceStatusBadge').hidden, true);
    assert.equal(harness.elements.get('serviceStatusModal').hidden, true);
});

test('two failed probes show the service warning, which clears after recovery', async () => {
    const harness = createHarness([
        new Error('first network failure'),
        new Error('confirmed network failure'),
        response(200, { status: 'ok', downloads_available: true })
    ]);

    harness.start();
    await flushPromises();
    harness.runRetry();
    await flushPromises();

    assert.equal(harness.elements.get('serviceStatusBadge').hidden, false);
    assert.equal(harness.elements.get('serviceStatusModal').hidden, false);

    harness.intervalCallbacks[0]();
    await flushPromises();

    assert.equal(harness.elements.get('serviceStatusBadge').hidden, true);
    assert.equal(harness.elements.get('serviceStatusModal').hidden, true);
});

test('a successful online feature request clears the service warning immediately', async () => {
    const harness = createHarness([
        new Error('first network failure'),
        new Error('confirmed network failure')
    ]);

    harness.start();
    await flushPromises();
    harness.runRetry();
    await flushPromises();
    assert.equal(harness.elements.get('serviceStatusBadge').hidden, false);

    harness.status.markServiceResponsive();

    assert.equal(harness.elements.get('serviceStatusBadge').hidden, true);
    assert.equal(harness.elements.get('serviceStatusModal').hidden, true);
});

test('V1 staging starts the new monitor without the old health checks or modal', async () => {
    const calls = [];
    const harness = createHarness([], { v1Enabled: true, startV1: async url => { calls.push(url); return true; } });
    harness.start();
    await flushPromises();
    assert.deepEqual(calls, ['https://staging.example/api']);
    assert.equal(harness.intervalCallbacks.length, 0);
    assert.equal(harness.timeouts.length, 0);
    assert.equal(harness.elements.has('serviceStatusModal'), false);
});
