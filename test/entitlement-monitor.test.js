const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULT_INTERVAL_MS, RENEWAL_NOTICE_WINDOW_MS, createEntitlementMonitor, getAccessNotice, getAccessNoticeType } = require('../src/renderer/auth/entitlement-monitor');

test('access notice follows local calendar days and disappears after confirmed Pix renewal', () => {
    const now = new Date(2026, 9, 1, 10).getTime();
    const session = {
        license: {
            status: 'active',
            billing: { accessType: 'monthly_subscription', billingStatus: 'active', canManageSubscription: false }
        }
    };
    for (const [days, stage, urgency] of [
        [7, 'early', 'warning'], [4, 'early', 'warning'],
        [3, 'soon', 'urgent'], [2, 'soon', 'urgent'],
        [1, 'tomorrow', 'urgent'], [0, 'today', 'urgent']
    ]) {
        session.license.billing.entitlementExpiresAt = new Date(2026, 9, 1 + days, days === 0 ? 18 : 10).toISOString();
        const notice = getAccessNotice(session, now);
        assert.equal(notice.stage, stage);
        assert.equal(notice.urgency, urgency);
        assert.equal(notice.days, days);
    }
    session.license.billing.renewalScheduled = true;
    assert.equal(getAccessNotice(session, now), null);
    session.license.status = 'expired';
    assert.equal(getAccessNotice(session, now), null);
});

test('access notice opens at seven days for recurring Pix and prioritizes expired status', () => {
    const now = Date.parse('2026-10-01T12:00:00.000Z');
    const session = {
        license: {
            status: 'active',
            expiresAt: '2026-10-09',
            billing: {
                accessType: 'monthly_subscription',
                billingStatus: 'active',
                entitlementExpiresAt: new Date(now + RENEWAL_NOTICE_WINDOW_MS).toISOString(),
                canManageSubscription: false
            }
        }
    };

    assert.equal(getAccessNoticeType(session, now), 'expiring');
    session.license.billing.entitlementExpiresAt = new Date(now + RENEWAL_NOTICE_WINDOW_MS + 1).toISOString();
    assert.equal(getAccessNoticeType(session, now), null);
    session.license.status = 'expired';
    assert.equal(getAccessNoticeType(session, now), 'expired');
});

test('access notice distinguishes automatic card renewal and excludes non-recurring access', () => {
    const now = Date.parse('2026-10-01T12:00:00.000Z');
    const session = {
        license: {
            status: 'active',
            billing: {
                accessType: 'annual_subscription',
                billingStatus: 'active',
                entitlementExpiresAt: '2026-10-05T12:00:00.000Z',
                canManageSubscription: true,
                cancelAtPeriodEnd: false
            }
        }
    };

    assert.equal(getAccessNoticeType(session, now), 'auto_renewing');
    session.license.billing.cancelAtPeriodEnd = true;
    assert.equal(getAccessNoticeType(session, now), 'expiring');
    session.license.billing.accessType = 'paid_lifetime';
    assert.equal(getAccessNoticeType(session, now), null);
});

test('semiannual card and Pix access receive their respective renewal notices', () => {
    const now = Date.parse('2026-10-01T12:00:00.000Z');
    const session = {
        license: {
            status: 'active',
            billing: {
                accessType: 'semiannual_subscription',
                billingStatus: 'active',
                entitlementExpiresAt: '2026-10-05T12:00:00.000Z',
                canManageSubscription: true,
                cancelAtPeriodEnd: false
            }
        }
    };
    assert.equal(getAccessNoticeType(session, now), 'auto_renewing');
    session.license.billing.accessType = 'semiannual_manual';
    session.license.billing.canManageSubscription = false;
    assert.equal(getAccessNoticeType(session, now), 'expiring');
});

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
