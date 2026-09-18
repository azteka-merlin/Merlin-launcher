function createManifestOverrideService({
    axios,
    httpsAgent,
    authSession,
    statusUrl
}) {
    const cache = new Map();

    async function requiresVersionPin(appId, { forceRefresh = false } = {}) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) return false;
        if (!forceRefresh && cache.has(appId)) {
            return cache.get(appId) === true;
        }

        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            const headers = {
                Authorization: `Bearer ${await authSession.getAccessToken()}`,
                'User-Agent': 'Merlin/2.0'
            };

            try {
                const response = await axios.get(statusUrl, {
                    params: { appid: appId },
                    timeout: 10000,
                    httpsAgent,
                    headers
                });
                const value = response?.data?.requiresVersionPin === true;
                cache.set(appId, value);
                return value;
            } catch (error) {
                lastError = error;
                if (error?.response?.status === 401 && attempt === 0) {
                    try {
                        await authSession.handleUnauthorized();
                    } catch (authError) {
                        // An expired license can browse games, but the manifest
                        // policy is an activation-only detail. Keep search
                        // results visible and let the install flow block it.
                        if (authError?.code === 'expired') return false;
                        throw authError;
                    }
                    continue;
                }
                break;
            } finally {
                delete headers.Authorization;
            }
        }

        console.warn(
            `[manifest-override] Unable to resolve version policy for ${appId}:`,
            lastError?.message || 'unknown error'
        );
        return cache.get(appId) === true;
    }

    async function decorateGame(game, options) {
        if (!game || !/^\d+$/.test(String(game.appId || '').trim())) return game;
        const pinned = await requiresVersionPin(game.appId, options);
        return {
            ...game,
            requiresVersionPin: pinned,
            autoUpdate: pinned ? false : game.autoUpdate !== false
        };
    }

    function clearCache(appId) {
        if (appId) {
            cache.delete(String(appId).trim());
            return;
        }
        cache.clear();
    }

    return { requiresVersionPin, decorateGame, clearCache };
}

module.exports = { createManifestOverrideService };
