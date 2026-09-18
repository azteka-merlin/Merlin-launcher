(function attachEntitlementMonitor(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.MerlinEntitlementMonitor = api;
})(typeof window !== 'undefined' ? window : globalThis, function createApi() {
    const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

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

    return { DEFAULT_INTERVAL_MS, createEntitlementMonitor };
});
