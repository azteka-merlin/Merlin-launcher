const PROVIDER_MIN_INTERVAL_MS = 1500;
const PROVIDER_FAILURE_COOLDOWN_MS = 60000;

function createArchiveClient({ axios, httpsAgent }) {
    const providerRuntime = new Map();
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function getProviderState(name) {
        if (!providerRuntime.has(name)) {
            providerRuntime.set(name, { lastRequestAt: 0, failures: 0, cooldownUntil: 0 });
        }
        return providerRuntime.get(name);
    }

    async function waitForProviderSlot(name) {
        const state = getProviderState(name);
        const now = Date.now();
        const waitUntil = Math.max(
            state.cooldownUntil,
            state.lastRequestAt + PROVIDER_MIN_INTERVAL_MS
        );
        if (waitUntil > now) await sleep(waitUntil - now);
        state.lastRequestAt = Date.now();
    }

    function recordFailure(name, error) {
        const state = getProviderState(name);
        state.failures++;
        const status = error.response?.status;

        if (status === 429) {
            const retryAfter = Number(error.response?.headers?.['retry-after']);
            const cooldown = Number.isFinite(retryAfter)
                ? Math.min(Math.max(retryAfter * 1000, 10000), 300000)
                : PROVIDER_FAILURE_COOLDOWN_MS;
            state.cooldownUntil = Date.now() + cooldown;
        } else if (state.failures >= 3) {
            state.cooldownUntil = Date.now() + PROVIDER_FAILURE_COOLDOWN_MS;
        }
    }

    function recordSuccess(name) {
        const state = getProviderState(name);
        state.failures = 0;
        state.cooldownUntil = 0;
    }

    function isRetryable(error) {
        const status = error.response?.status;
        return !status || status >= 500;
    }

    async function request(source) {
        let lastError;
        const maxAttempts = source.retries || 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const requestOptions = {
                responseType: 'arraybuffer',
                timeout: source.timeout || 60000,
                httpsAgent,
                headers: { ...(source.headers || {}) },
                params: { ...(source.params || {}) }
            };

            try {
                await waitForProviderSlot(source.name);
                if (source.getHeaders) {
                    Object.assign(requestOptions.headers, await source.getHeaders());
                }
                const response = await axios.get(source.url, requestOptions);
                recordSuccess(source.name);
                return response;
            } catch (error) {
                lastError = error;
                const shouldRefreshAuth = error.response?.status === 401
                    && source.onUnauthorized
                    && attempt < maxAttempts - 1;
                if (shouldRefreshAuth) {
                    await source.onUnauthorized();
                    continue;
                }
                recordFailure(source.name, error);
                if (!isRetryable(error) || attempt === maxAttempts - 1) break;
                await sleep(1500 * (2 ** attempt));
            } finally {
                if (requestOptions.headers) delete requestOptions.headers.Authorization;
            }
        }

        throw lastError;
    }

    return { request };
}

module.exports = { createArchiveClient };
