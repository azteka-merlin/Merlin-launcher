function createArchiveClient({ axios, httpsAgent }) {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
                if (source.getHeaders) {
                    Object.assign(requestOptions.headers, await source.getHeaders());
                }
                const response = await axios.get(source.url, requestOptions);
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
