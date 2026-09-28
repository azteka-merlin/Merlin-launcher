const DEFAULT_HOME_URL = 'https://api-merlin.com/api/home';

function normalizePercent(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.min(100, Math.max(0, numberValue)) : 50;
}

function normalizeZoom(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return 1;
    return Math.min(4, Math.max(1, numberValue));
}

function normalizeItem(value, slotType, baseUrl) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = Number(value.id);
    const position = Number(value.position);
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    let imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl.trim() : '';
    if (imageUrl.startsWith('/')) imageUrl = new URL(imageUrl, baseUrl).toString();
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(position) || position <= 0 || !title || !imageUrl) return null;
    return {
        id,
        slotType,
        position,
        appId: /^\d+$/.test(String(value.appId || '').trim()) ? String(value.appId).trim() : null,
        title,
        description: typeof value.description === 'string' ? value.description.trim() || null : null,
        secondaryText: typeof value.secondaryText === 'string' ? value.secondaryText.trim() || null : null,
        displayLabel: typeof value.displayLabel === 'string' ? value.displayLabel.trim() || null : null,
        imageUrl,
        imagePositionX: normalizePercent(value.imagePositionX),
        imagePositionY: normalizePercent(value.imagePositionY),
        imageZoom: normalizeZoom(value.imageZoom),
        primaryAction: ['premium', 'add_game'].includes(value.primaryAction) ? value.primaryAction : 'none',
        secondaryAction: ['premium', 'add_game'].includes(value.secondaryAction) ? value.secondaryAction : 'none'
    };
}

function normalizeHomeContent(value, baseUrl = DEFAULT_HOME_URL) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const normalizeList = (key, limit) => Array.isArray(value[key])
        ? value[key].map(item => normalizeItem(item, key, baseUrl)).filter(Boolean).slice(0, limit)
        : [];
    const home = {
        hero: normalizeList('hero', 30),
        side: normalizeList('side', 2),
        showcase: normalizeList('showcase', 4),
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null
    };
    if (!home.hero.length) return null;
    const fallbackRevision = `${home.hero.length + home.side.length + home.showcase.length}:${home.updatedAt || ''}`;
    home.revision = typeof value.revision === 'string' && value.revision.trim()
        ? value.revision.trim()
        : fallbackRevision;
    return home;
}

function createHomeContentClient({ axios, url = DEFAULT_HOME_URL, timeout = 12000 }) {
    async function request(accessToken) {
        const response = await axios.get(url, {
            timeout,
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
        });
        const home = normalizeHomeContent(response.data?.home, url);
        if (!home) throw new Error('Invalid Home content payload');
        return home;
    }

    async function requestRevision(accessToken) {
        const response = await axios.get(`${url.replace(/\/+$/, '')}/revision`, {
            timeout,
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
        });
        const revision = typeof response.data?.revision === 'string' ? response.data.revision.trim() : '';
        if (!revision) throw new Error('Invalid Home revision payload');
        return revision;
    }

    return { request, requestRevision };
}

module.exports = { DEFAULT_HOME_URL, createHomeContentClient, normalizeHomeContent };
