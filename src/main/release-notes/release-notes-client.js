const DEFAULT_RELEASE_NOTES_URL = 'https://api-merlin.com/api/release-notes';
const SUPPORTED_TYPES = new Set(['major', 'standard']);
const SUPPORTED_ICONS = new Set(['home', 'steam', 'library', 'settings', 'sparkles', 'wrench', 'gift', 'megaphone', 'cloud', 'database-backup', 'refresh-cw', 'credit-card', 'shield-check']);

function normalizeRelease(value, baseUrl = DEFAULT_RELEASE_NOTES_URL) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = Number(value.id);
    const version = String(value.version || '').trim().replace(/^v/i, '');
    if (!Number.isInteger(id) || id <= 0 || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) return null;
    const title = String(value.title || '').trim();
    const subtitle = String(value.subtitle || '').trim();
    const summary = String(value.summary || '').trim();
    if (!title || !subtitle || !summary) return null;
    let heroAssetUrl = String(value.heroAssetUrl || '').trim() || null;
    if (heroAssetUrl?.startsWith('/')) heroAssetUrl = new URL(heroAssetUrl, baseUrl).toString();
    const highlights = Array.isArray(value.highlights) ? value.highlights.map((item) => ({
        icon: SUPPORTED_ICONS.has(String(item?.icon || '')) ? String(item.icon) : 'sparkles',
        title: String(item?.title || '').trim(),
        description: String(item?.description || '').trim()
    })).filter((item) => item.title && item.description).slice(0, 8) : [];
    const fullContent = Array.isArray(value.fullContent)
        ? value.fullContent.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 80)
        : [];
    if (!highlights.length || !fullContent.length) return null;
    return {
        id,
        version,
        type: SUPPORTED_TYPES.has(value.type) ? value.type : 'standard',
        title,
        subtitle,
        summary,
        highlights,
        fullContent,
        heroAssetUrl,
        publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : null,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null
    };
}

function normalizeReleaseList(value, baseUrl = DEFAULT_RELEASE_NOTES_URL) {
    return Array.isArray(value) ? value.map((item) => normalizeRelease(item, baseUrl)).filter(Boolean) : [];
}

function createReleaseNotesClient({ axios, url = DEFAULT_RELEASE_NOTES_URL, timeout = 12000 }) {
    async function request(accessToken, locale) {
        const response = await axios.get(url, {
            timeout,
            params: { locale },
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
        });
        return normalizeReleaseList(response.data?.releases, url);
    }
    return { request };
}

module.exports = { DEFAULT_RELEASE_NOTES_URL, createReleaseNotesClient, normalizeRelease, normalizeReleaseList };
