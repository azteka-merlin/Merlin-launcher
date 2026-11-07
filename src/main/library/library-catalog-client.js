const DEFAULT_GAMES_CATALOG_URL = 'https://api-merlin.com/api/games/catalog-cache';

function normalizeRemoteGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const appId = String(entry.appid || '').trim();
    if (!/^\d+$/.test(appId)) return null;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const fallbackImage = fallbackCoverForAppId(appId);
    const coverUrl = entry.header_image || fallbackImage;
    const coverSource = entry.header_image ? 'catalog_image' : 'ryuu_image';

    return {
        appId,
        name,
        coverUrl,
        coverSource
    };
}

function createLibraryCatalogClient({ axios, authSession, httpsAgent, url = DEFAULT_GAMES_CATALOG_URL, timeout = 10000 }) {
    async function download() {
        const token = await authSession.getAccessToken();
        const response = await axios.get(url, { timeout, httpsAgent, headers: { Authorization: `Bearer ${token}` } });
        if (!Array.isArray(response.data?.games)) {
            throw new Error('Invalid games catalog payload');
        }
        const games = {};
        for (const entry of response.data.games) {
            const normalized = normalizeRemoteGame(entry);
            if (!normalized) continue;
            games[normalized.appId] = {
                name: normalized.name,
                coverUrl: normalized.coverUrl,
                coverSource: normalized.coverSource
            };
        }
        return {
            games,
            syncedAt: new Date().toISOString()
        };
    }

    return { download };
}

function fallbackCoverForAppId(appId) {
    appId = String(appId || '').trim();
    return /^\d+$/.test(appId)
        ? `https://generator.ryuu.lol/files/images/${appId}.jpg`
        : null;
}

module.exports = {
    DEFAULT_GAMES_CATALOG_URL,
    createLibraryCatalogClient,
    fallbackCoverForAppId
};
