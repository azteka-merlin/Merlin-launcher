const DEFAULT_GAMES_SEARCH_URL = 'https://api-merlin.com/api/games/search';

function normalizeRemoteGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

    const appId = String(entry.appId || '').trim();
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const coverUrl = typeof entry.coverUrl === 'string' ? entry.coverUrl.trim() : '';
    const coverSource = typeof entry.coverSource === 'string' ? entry.coverSource.trim() : '';

    if (!/^\d+$/.test(appId) || !name) return null;

    return {
        appId,
        name,
        coverUrl: coverUrl || null,
        coverSource: coverSource || null
    };
}

function createGameSearchClient({
    axios,
    authSession,
    httpsAgent,
    url = DEFAULT_GAMES_SEARCH_URL,
    timeout = 10000
}) {
    async function execute(accessToken, query, limit, metadataOnly) {
        return axios.post(
            url,
            { searchTerm: query, limit, ...(metadataOnly ? { metadataOnly: true } : {}) },
            {
                timeout,
                httpsAgent,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                    'User-Agent': 'Merlin/2.0'
                }
            }
        );
    }

    async function search(query, { limit = 4, metadataOnly = false } = {}) {
        const normalizedQuery = String(query || '').trim();
        if (!normalizedQuery) return [];

        const accessToken = await authSession.getAccessToken();
        let response;

        try {
            response = await execute(accessToken, normalizedQuery, limit, metadataOnly);
        } catch (error) {
            if (error?.response?.status === 401) {
                await authSession.handleUnauthorized();
                response = await execute(await authSession.getAccessToken(), normalizedQuery, limit, metadataOnly);
            } else {
                throw error;
            }
        }

        if (!response?.data || !Array.isArray(response.data.items)) {
            throw new Error('Invalid games search payload');
        }

        return response.data.items
            .map(normalizeRemoteGame)
            .filter(Boolean);
    }

    return { search };
}

module.exports = {
    DEFAULT_GAMES_SEARCH_URL,
    createGameSearchClient
};
