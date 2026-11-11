function scoreMatch(game, normalizedQuery) {
    const name = String(game.name || '').toLocaleLowerCase();
    const appId = String(game.appId || '');
    if (!normalizedQuery) return -1;
    if (appId === normalizedQuery) return 4000;
    if (name.startsWith(normalizedQuery)) return 3000 - name.length;
    if (name.includes(normalizedQuery)) return 2000 - name.indexOf(normalizedQuery);
    if (/^\d+$/.test(normalizedQuery) && appId.startsWith(normalizedQuery)) return 1000 - appId.length;
    return -1;
}

function createLibraryCatalogService({ catalogStore, catalogClient, searchClient = null }) {
    let refreshPromise = null;

    function normalizeEntry(appId, entry) {
        if (!entry) return null;
        return {
            name: entry.name,
            coverUrl: entry.coverSource === 'ryuu_image' ? null : entry.coverUrl || null,
            coverSource: entry.coverSource === 'ryuu_image' ? null : entry.coverSource || null
        };
    }

    async function refresh() {
        if (!refreshPromise) {
            refreshPromise = catalogClient.download()
                .then(downloaded => {
                    catalogStore.replace(downloaded.games, downloaded.syncedAt);
                    return downloaded.games;
                })
                .finally(() => {
                    refreshPromise = null;
                });
        }
        return refreshPromise;
    }

    async function ensureLoaded() {
        if (catalogStore.needsBootstrap()) {
            await refresh();
        } else {
            catalogStore.load();
        }
        return catalogStore.load().games;
    }

    async function lookupMetadata(appIds) {
        const games = await catalogClient.downloadForAppIds(appIds);
        const withCovers = Object.fromEntries(Object.entries(games).filter(([, game]) => game.coverSource !== 'ryuu_image' && game.coverUrl));
        if (Object.keys(withCovers).length > 0) catalogStore.upsertMany(withCovers);
        return withCovers;
    }

    function findByAppId(appId) {
        const entry = normalizeEntry(appId, catalogStore.get(appId));
        if (!entry) return null;
        return {
            appId: String(appId),
            name: entry.name,
            coverUrl: entry.coverUrl,
            coverSource: entry.coverSource
        };
    }

    function findMatches(games, normalizedQuery, limit) {
        const matches = [];

        for (const [appId, entry] of Object.entries(games)) {
            const game = { appId, ...normalizeEntry(appId, entry) };
            const score = scoreMatch(game, normalizedQuery);
            if (score < 0) continue;
            matches.push({ ...game, score });
        }

        return matches
            .sort((left, right) => right.score - left.score
                || left.name.localeCompare(right.name)
                || left.appId.localeCompare(right.appId))
            .slice(0, limit)
            .map(({ score, ...game }) => game);
    }

    function normalizeRemoteGame(item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

        const appId = String(item.appId || '').trim();
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        const coverUrl = typeof item.coverUrl === 'string' ? item.coverUrl.trim() : '';
        const coverSource = typeof item.coverSource === 'string' ? item.coverSource.trim() : '';

        if (!/^\d+$/.test(appId) || !name) return null;

        return {
            appId,
            name,
            coverUrl: coverSource === 'ryuu_image' ? null : coverUrl || null,
            coverSource: coverSource === 'ryuu_image' ? null : coverSource || null
        };
    }

    function rememberEntries(items) {
        const entries = Object.fromEntries(
            (items || [])
                .filter(item => item && /^\d+$/.test(String(item.appId || '').trim()))
                .map(item => [String(item.appId).trim(), {
                    name: item.name,
                    coverUrl: item.coverUrl || null,
                    coverSource: item.coverSource || null
                }])
        );

        if (Object.keys(entries).length === 0) return false;
        return catalogStore.upsertMany(entries);
    }

    async function searchRemoteWithStatus(query, { limit = 4, metadataOnly = false } = {}) {
        if (!searchClient?.search) return { items: [], online: false };

        try {
            const items = (await searchClient.search(query, { limit, ...(metadataOnly ? { metadataOnly: true } : {}) }))
                .map(normalizeRemoteGame)
                .filter(Boolean);
            rememberEntries(items);
            return { items, online: true };
        } catch (error) {
            console.warn('Unable to search games using Merlin API:', error.message);
            return { items: [], online: false };
        }
    }

    async function searchRemote(query, options) {
        return (await searchRemoteWithStatus(query, options)).items;
    }

    async function enrichAppIds(appIds, { allowCatalogRefresh = true, metadataOnly = false } = {}) {
        const normalizedAppIds = [...new Set(
            (appIds || [])
                .map(appId => String(appId || '').trim())
                .filter(appId => /^\d+$/.test(appId))
        )];

        const resolved = new Map();
        const unresolved = [];
        const localFallbacks = new Map();

        for (const appId of normalizedAppIds) {
            const localMatch = findByAppId(appId);
            if (localMatch?.coverUrl || (metadataOnly && localMatch?.name)) {
                resolved.set(appId, localMatch);
            } else if (localMatch) {
                localFallbacks.set(appId, localMatch);
                unresolved.push(appId);
            } else {
                unresolved.push(appId);
            }
        }

        if (unresolved.length > 0) {
            const remoteMatches = await Promise.all(
                unresolved.map(async appId => {
                    const remoteMatch = (await searchRemote(appId, { limit: 4, metadataOnly }))
                        .find(item => item.appId === appId) || null;
                    return [appId, remoteMatch];
                })
            );

            for (const [appId, match] of remoteMatches) {
                if (match) {
                    resolved.set(appId, match);
                }
            }
        }

        if (allowCatalogRefresh && !metadataOnly) {
            const stillMissing = normalizedAppIds.filter(appId => !resolved.has(appId));
            if (stillMissing.length > 0) {
                await refresh();
                for (const appId of stillMissing) {
                    const refreshedMatch = findByAppId(appId);
                    if (refreshedMatch) resolved.set(appId, refreshedMatch);
                }
            }
        }

        for (const appId of normalizedAppIds) {
            if (!resolved.has(appId) && localFallbacks.has(appId)) {
                resolved.set(appId, localFallbacks.get(appId));
            }
        }

        return resolved;
    }

    async function resolveByAppId(appId, { allowRefresh = true } = {}) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) return null;
        const matches = await enrichAppIds([appId], { allowCatalogRefresh: allowRefresh });
        return matches.get(appId) || null;
    }

    async function searchWithStatus(query, { limit = 4 } = {}) {
        const rawQuery = String(query || '').trim();
        const normalizedQuery = rawQuery.toLocaleLowerCase();
        if (!normalizedQuery) return { items: [], online: false };

        const remoteResult = await searchRemoteWithStatus(rawQuery, { limit });
        const remoteMatches = remoteResult.items;
        if (remoteMatches.length > 0) {
            const incompleteRemoteMatches = remoteMatches.filter(item => !item.coverUrl);
            if (incompleteRemoteMatches.length === 0) {
                return { items: remoteMatches, online: remoteResult.online };
            }

            const hydrated = await enrichAppIds(
                incompleteRemoteMatches.map(item => item.appId),
                { allowCatalogRefresh: true }
            );

            return {
                items: remoteMatches.map(item => hydrated.get(item.appId) || item),
                online: remoteResult.online
            };
        }

        const needsBootstrap = catalogStore.needsBootstrap();
        const games = await ensureLoaded();
        let matches = findMatches(games, normalizedQuery, limit);
        const online = remoteResult.online || needsBootstrap;
        if (matches.length > 0) {
            const hydrated = await enrichAppIds(
                matches.map(item => item.appId),
                { allowCatalogRefresh: true }
            );
            return {
                items: matches.map(item => hydrated.get(item.appId) || item),
                online
            };
        }

        await refresh();
        matches = findMatches(catalogStore.load().games, normalizedQuery, limit);
        return { items: matches, online: true };
    }

    async function search(query, options) {
        return (await searchWithStatus(query, options)).items;
    }

    return { ensureLoaded, enrichAppIds, findByAppId, lookupMetadata, refresh, rememberEntries, resolveByAppId, search, searchWithStatus };
}

module.exports = { createLibraryCatalogService };
