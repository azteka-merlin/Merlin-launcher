function normalizeLocale(value) {
    const locale = String(value || 'ptbr').trim().toLowerCase().replace('pt-br', 'ptbr');
    return ['ptbr', 'en', 'es', 'fr', 'de'].includes(locale) ? locale : 'ptbr';
}

function compareVersions(left, right) {
    const parse = (value) => {
        const match = String(value || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
        if (!match) return null;
        return { numbers: match.slice(1, 4).map(Number), prerelease: match[4] || null };
    };
    const a = parse(left);
    const b = parse(right);
    if (!a || !b) return null;
    for (let index = 0; index < a.numbers.length; index += 1) {
        if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] - b.numbers[index];
    }
    if (a.prerelease === b.prerelease) return 0;
    if (!a.prerelease) return 1;
    if (!b.prerelease) return -1;
    return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true });
}

function createReleaseNotesService({ authSession, client, store, configStore, baseUrl, launcherVersion }) {
    const memory = new Map();

    async function accessToken() {
        if (!authSession?.getAccessToken) {
            const error = new Error('Authentication is not available');
            error.code = 'auth_required';
            throw error;
        }
        return authSession.getAccessToken();
    }

    function response(locale, releases, stale) {
        const currentVersion = String(launcherVersion || '').replace(/^v/i, '');
        const lastSeenVersion = String(configStore.get().lastSeenChangelogVersion || '').trim() || null;
        // A patch launcher (for example 2.0.2) must still show the newest
        // published notes it supports (2.0.0). Future notes stay visible in
        // the manual history but never auto-open on an older launcher.
        const compatible = releases
            .filter((release) => (compareVersions(release.version, currentVersion) ?? 1) <= 0)
            .sort((left, right) => (compareVersions(right.version, left.version) ?? 0));
        const current = compatible[0] || null;
        const latest = current;
        return {
            success: true,
            locale,
            releases,
            current,
            latest,
            lastSeenVersion,
            hasUnread: Boolean(latest && latest.version !== lastSeenVersion),
            shouldAutoOpen: Boolean(current && current.version !== lastSeenVersion),
            stale
        };
    }

    async function refresh(localeValue) {
        const locale = normalizeLocale(localeValue);
        try {
            let token = await accessToken();
            let releases;
            try {
                releases = await client.request(token, locale);
            } catch (error) {
                if (error?.response?.status !== 401) throw error;
                await authSession.handleUnauthorized();
                token = await accessToken();
                releases = await client.request(token, locale);
            }
            memory.set(locale, store.save(locale, releases, baseUrl) || releases);
            return response(locale, memory.get(locale), false);
        } catch (error) {
            const fallback = memory.get(locale) || store.load(locale);
            if (fallback) {
                memory.set(locale, fallback);
                return response(locale, fallback, true);
            }
            const code = error?.code === 'auth_required' || error?.response?.status === 401 ? 'auth_required' : 'refresh_failed';
            return { success: false, code, message: error?.message || 'Could not load release notes' };
        }
    }

    async function get({ locale = 'ptbr', force = false } = {}) {
        const normalizedLocale = normalizeLocale(locale);
        if (!force && memory.has(normalizedLocale)) return response(normalizedLocale, memory.get(normalizedLocale), false);
        return refresh(normalizedLocale);
    }

    function markSeen(version) {
        const normalized = String(version || '').trim().replace(/^v/i, '');
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
            return { success: false, code: 'invalid_version' };
        }
        configStore.update({ lastSeenChangelogVersion: normalized });
        return { success: true, lastSeenVersion: normalized };
    }

    return { get, refresh, markSeen };
}

module.exports = { compareVersions, createReleaseNotesService, normalizeLocale };
