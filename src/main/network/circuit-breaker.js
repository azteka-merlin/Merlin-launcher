function createCircuitBreaker({ now = Date.now, pauseMs = 60000 } = {}) {
    let retryAt = 0;
    let probe = false;
    let generation = 0;
    function state() { return { paused: retryAt > now() || probe, retryAt }; }
    async function run(operation) {
        if (state().paused) throw Object.assign(new Error('Source temporarily paused'), { code: 'SOURCE_PAUSED' });
        const testing = retryAt > 0;
        const startedGeneration = generation;
        if (testing) probe = true;
        try {
            const value = await operation();
            // A successful request started before a different request failed
            // cannot cancel that newer pause. Only the recovery probe can.
            if (startedGeneration === generation) retryAt = 0;
            return value;
        } catch (error) {
            // A missing game/image does not mean the provider is down.
            if (error?.status !== 404) {
                generation++;
                retryAt = now() + pauseMs;
            } else if (testing && startedGeneration === generation) retryAt = 0;
            throw error;
        } finally { if (testing) probe = false; }
    }
    return { run, state };
}
module.exports = { createCircuitBreaker };
