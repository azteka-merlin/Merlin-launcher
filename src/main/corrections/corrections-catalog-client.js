const DEFAULT_CORRECTIONS_CATALOG_URL = 'https://api-merlin.com/api/fixes/catalog';

function firstEligibleCorrection(fixes) {
    if (!Array.isArray(fixes)) return null;

    for (const fix of fixes) {
        if (!fix || typeof fix !== 'object' || Array.isArray(fix)) continue;
        const badges = Array.isArray(fix.badges)
            ? fix.badges.map(value => String(value || '').trim().toLocaleLowerCase())
            : [];
        if (badges.includes('hypervisor')) continue;

        const href = typeof fix.href === 'string' ? fix.href.trim() : '';
        const filename = typeof fix.filename === 'string' ? fix.filename.trim() : '';
        const size = typeof fix.size === 'string' ? fix.size.trim() : '';
        if (!href || !filename) continue;

        return {
            href,
            filename,
            size: size || undefined,
            adminNote: typeof fix.adminNote === 'string' ? fix.adminNote.trim() || undefined : undefined,
            upvotes: Number.isFinite(Number(fix.upvotes)) ? Math.max(0, Math.trunc(Number(fix.upvotes))) : 0,
            downvotes: Number.isFinite(Number(fix.downvotes)) ? Math.max(0, Math.trunc(Number(fix.downvotes))) : 0,
            score: Number.isFinite(Number(fix.score)) ? Math.trunc(Number(fix.score)) : 0,
            viewerVote: fix.viewerVote === 'up' || fix.viewerVote === 'down' ? fix.viewerVote : null
        };
    }

    return null;
}

function normalizeRemoteGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const appId = String(entry.appid || '').trim();
    const gameName = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!/^\d+$/.test(appId) || !gameName) return null;

    const correction = firstEligibleCorrection(entry.fixes);
    if (!correction) return null;
    const releaseDate = typeof entry.releaseDate === 'string' && !Number.isNaN(Date.parse(entry.releaseDate))
        ? entry.releaseDate
        : null;

    return {
        appId,
        gameName,
        releaseDate,
        hasDrm: entry.hasDrm === true,
        correction
    };
}

function createCorrectionsCatalogClient({
    axios,
    url = DEFAULT_CORRECTIONS_CATALOG_URL,
    voteUrl = DEFAULT_CORRECTIONS_CATALOG_URL.replace(/\/catalog$/, '/vote'),
    timeout = 20000
}) {
    async function download({ accessToken = null } = {}) {
        const requestConfig = {
            timeout,
            headers: accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : undefined
        };

        let response;
        try {
            response = await axios.get(url, requestConfig);
        } catch (error) {
            if (accessToken && error?.response?.status === 401) {
                response = await axios.get(url, { timeout });
            } else {
                throw error;
            }
        }

        if (!Array.isArray(response.data)) {
            throw new Error('Invalid corrections catalog payload');
        }

        return {
            items: response.data
                .map(normalizeRemoteGame)
                .filter(Boolean),
            syncedAt: new Date().toISOString()
        };
    }

    async function vote({ appId, vote, accessToken }) {
        return (await axios.post(
            voteUrl,
            { appId, vote },
            {
                timeout,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        )).data;
    }

    return { download, vote };
}

module.exports = {
    DEFAULT_CORRECTIONS_CATALOG_URL,
    createCorrectionsCatalogClient
};
