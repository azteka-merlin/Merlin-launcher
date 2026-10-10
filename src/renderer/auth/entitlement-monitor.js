(function attachEntitlementMonitor(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.MerlinEntitlementMonitor = api;
})(typeof window !== 'undefined' ? window : globalThis, function createApi() {
    const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
    const RENEWAL_NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

    function getAccessNotice(sessionData, now = Date.now()) {
        const license = sessionData?.license;
        if (license?.billing?.renewalScheduled) return null;
        if (license?.status === 'expired' || sessionData?.expired === true) return { type: 'expired', urgency: 'urgent' };
        if (license?.status !== 'active') return null;

        const billing = license.billing || {};
        if (!['monthly_subscription', 'semiannual_subscription', 'semiannual_manual', 'annual_subscription', 'annual_manual'].includes(billing.accessType)) return null;
        const rawExpiry = billing.entitlementExpiresAt || billing.currentPeriodEnd || license.expiresAt;
        // The login payload may contain a date without a time. Treat that as
        // the end of the displayed day; paid plans normally include the exact
        // currentPeriodEnd timestamp.
        const expiry = /^\d{4}-\d{2}-\d{2}$/.test(rawExpiry || '')
            ? new Date(`${rawExpiry}T23:59:59.999`).getTime()
            : new Date(rawExpiry || '').getTime();
        if (!Number.isFinite(expiry) || expiry - now > RENEWAL_NOTICE_WINDOW_MS) return null;
        if (expiry < now) return { type: 'expired', urgency: 'urgent' };

        const today = new Date(now);
        const lastDay = new Date(expiry);
        const calendarDays = Math.round((
            Date.UTC(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate())
            - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
        ) / (24 * 60 * 60 * 1000));
        const days = Math.max(0, Math.min(7, calendarDays));
        const stage = days >= 4 ? 'early' : days >= 2 ? 'soon' : days === 1 ? 'tomorrow' : 'today';

        const type = billing.canManageSubscription
            && !billing.cancelAtPeriodEnd
            && ['active', 'trialing'].includes(billing.billingStatus)
            ? 'auto_renewing'
            : 'expiring';
        return { type, urgency: days <= 3 ? 'urgent' : 'warning', stage, days, expiresAt: expiry };
    }

    function getAccessNoticeType(sessionData, now = Date.now()) {
        return getAccessNotice(sessionData, now)?.type || null;
    }

    function createEntitlementMonitor({
        getStatus,
        onAuthenticated,
        intervalMs = DEFAULT_INTERVAL_MS,
        setIntervalFn = setInterval,
        clearIntervalFn = clearInterval
    }) {
        let timer = null;
        let inFlight = false;

        async function check() {
            if (inFlight) return null;
            inFlight = true;
            try {
                const result = await getStatus();
                // A temporary API/network failure must not change a valid local
                // session into an expired or logged-out UI state.
                if (result?.authenticated) onAuthenticated(result);
                return result;
            } catch (_) {
                return null;
            } finally {
                inFlight = false;
            }
        }

        function start() {
            if (timer !== null) return;
            timer = setIntervalFn(check, intervalMs);
        }

        function stop() {
            if (timer === null) return;
            clearIntervalFn(timer);
            timer = null;
        }

        return { check, start, stop };
    }

    return { DEFAULT_INTERVAL_MS, RENEWAL_NOTICE_WINDOW_MS, createEntitlementMonitor, getAccessNotice, getAccessNoticeType };
});
