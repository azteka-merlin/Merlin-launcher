const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULT_INTERVAL_MS, createEntitlementMonitor } = require('../src/renderer/auth/entitlement-monitor');

test('entitlement monitor checks every five minutes and forwards a confirmed expired session', async () => {
    let scheduled = null;
    const received = [];
    const monitor = createEntitlementMonitor({
        getStatus: async () => ({ authenticated: true, expired: true, license: { status: 'expired' } }),
        onAuthenticated: result => received.push(result),
        setIntervalFn: (callback, delay) => {
            scheduled = { callback, delay };
            return 'timer';
        },
        clearIntervalFn: () => {}
    });

    monitor.start();
    assert.equal(scheduled.delay, DEFAULT_INTERVAL_MS);
    await scheduled.callback();
    assert.deepEqual(received, [{ authenticated: true, expired: true, license: { status: 'expired' } }]);
});

test('entitlement monitor preserves the existing UI on a transient failure and prevents overlapping checks', async () => {
    let calls = 0;
    const received = [];
    const monitor = createEntitlementMonitor({
        getStatus: async () => {
            calls += 1;
            throw new Error('network unavailable');
        },
        onAuthenticated: result => received.push(result)
    });

    const first = monitor.check();
    const second = monitor.check();
    assert.equal(calls, 1);
    assert.equal(await second, null);
    await first;
    assert.deepEqual(received, []);
});
