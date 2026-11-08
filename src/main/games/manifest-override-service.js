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

    async function decorateGames(games) {
        const items = Array.isArray(games) ? games : [];
        const ids = [...new Set(items.map(game => String(game?.appId || '').trim()).filter(id => /^\d+$/.test(id) && !cache.has(id)))];
        if (ids.length) {
            let fallback = false;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const response = await axios.post(`${statusUrl}-batch`, { appIds: ids }, {
                        timeout: 10000, httpsAgent,
                        headers: { Authorization: `Bearer ${await authSession.getAccessToken()}`, 'User-Agent': 'Merlin/2.0' }
                    });
                    const entries = response?.data?.items;
                    if (!Array.isArray(entries) || ids.some(id => !entries.some(item => item?.appId === id && typeof item.requiresVersionPin === 'boolean'))) {
                        throw new Error('Invalid manifest policy batch response');
                    }
                    for (const entry of entries) if (ids.includes(entry.appId)) cache.set(entry.appId, entry.requiresVersionPin);
                    break;
                } catch (error) {
                    if (error?.response?.status === 401 && attempt === 0) {
                        try { await authSession.handleUnauthorized(); continue; } catch (authError) {
                            if (authError?.code !== 'expired') console.warn('[manifest-override] Unable to refresh session:', authError?.message || 'unknown error');
                        }
                    } else if ([404, 405].includes(error?.response?.status)) fallback = true;
                    else console.warn('[manifest-override] Unable to resolve batch policy:', error?.message || 'unknown error');
                    break;
                }
            }
            // Older API versions still support the existing per-game endpoint.
            if (fallback) return Promise.all(items.map(game => decorateGame(game)));
        }
        return items.map(game => {
            if (!game || !/^\d+$/.test(String(game.appId || '').trim())) return game;
            const pinned = cache.get(String(game.appId).trim()) === true;
            return { ...game, requiresVersionPin: pinned, autoUpdate: pinned ? false : game.autoUpdate !== false };
        });
    }

    function clearCache(appId) {
        if (appId) {
            cache.delete(String(appId).trim());
            return;
        }
        cache.clear();
    }

    return { requiresVersionPin, decorateGame, decorateGames, clearCache };
}

module.exports = { createManifestOverrideService };
