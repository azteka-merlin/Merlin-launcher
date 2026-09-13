function friendlyInstallResult(result) {
    if (result.success) return result;

    const prerequisiteReasons = new Set([
        'steam_path_missing',
        'steam_path_invalid',
        'required_files_missing'
    ]);

    if (prerequisiteReasons.has(result.reason)) {
        return {
            ...result,
            code: result.reason
        };
    }

    if (['rate_limited', 'manifest_unavailable', 'manifest_sources_unavailable'].includes(result.reason)) {
        return {
            ...result,
            code: result.reason
        };
    }
    if (result.reason === 'test_limit_normal') {
        return {
            ...result,
            code: 'test_limit_normal'
        };
    }

    const message = String(result.message || '');
    if (/unable to download/i.test(message)) {
        return {
            ...result,
            code: 'download_unavailable'
        };
    }
    if (/invalid zip|empty zip|archive|no files found|no valid steam files/i.test(message)) {
        return {
            ...result,
            code: 'archive_invalid'
        };
    }
    return {
        ...result,
        code: 'generic'
    };
}

function normalizeSelectedItem(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const appId = String(input.appId || '').trim();
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const coverUrl = typeof input.coverUrl === 'string' ? input.coverUrl.trim() : '';
    const requiresVersionPin = input.requiresVersionPin === true;
    if (!/^\d+$/.test(appId) || !name) return null;
    return {
        appId,
        name,
        coverUrl: coverUrl || null,
        requiresVersionPin,
        autoUpdate: requiresVersionPin ? false : input.autoUpdate !== false
    };
}

function normalizeInputPayload(input) {
    if (typeof input === 'string') {
        return {
            selected: null,
            raw: input,
            autoUpdate: true
        };
    }

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {
            selected: null,
            raw: '',
            autoUpdate: true
        };
    }

    const selected = normalizeSelectedItem(input.selected || input.game || null);
    const selectedFromRoot = normalizeSelectedItem(input);
    return {
        selected: selected || selectedFromRoot,
        raw: typeof input.raw === 'string'
            ? input.raw
            : typeof input.input === 'string'
                ? input.input
                : typeof input.link === 'string'
                    ? input.link
                    : '',
        autoUpdate: input.autoUpdate !== false
    };
}

function createAddGamesService({
    parseSteamGameLink,
    nameResolver,
    queue,
    gameInstaller,
    configStore,
    steamService,
    libraryService,
    catalogService,
    manifestOverrideService
}) {
    let installing = false;

    function queueState() {
        const items = queue.list();
        return { items, count: items.length, locked: queue.isLocked(), installing };
    }

    async function resolveLink(link) {
        try {
            const parsed = parseSteamGameLink(link);
            const catalogMatch = await catalogService?.resolveByAppId(parsed.appId, { allowRefresh: true });
            const name = catalogMatch?.name || await nameResolver.resolve(parsed.appId, parsed.fallbackName);
            const item = await applyManifestPolicy({
                appId: parsed.appId,
                name,
                coverUrl: catalogMatch?.coverUrl || null
            });
            return {
                success: true,
                item
            };
        } catch (error) {
            return {
                success: false,
                code: error.code || 'resolve_failed',
                message: error.message
            };
        }
    }

    async function resolveCatalogGame(query) {
        const term = String(query || '').trim();
        if (!term) {
            return {
                success: false,
                code: 'selection_required'
            };
        }
        const match = /^\d+$/.test(term)
            ? await catalogService?.resolveByAppId(term, { allowRefresh: true })
            : null;

        if (!match) {
            return {
                success: false,
                code: 'catalog_not_found'
            };
        }

        return { success: true, item: await applyManifestPolicy(match) };
    }

    async function applyManifestPolicy(item, options) {
        if (!item) return item;
        if (!manifestOverrideService?.decorateGame) return item;
        return manifestOverrideService.decorateGame(item, options);
    }

    async function resolveInput(input) {
        const payload = normalizeInputPayload(input);
        if (payload.selected) {
            const selected = await applyManifestPolicy(payload.selected);
            return {
                success: true,
                item: {
                    ...selected,
                    autoUpdate: selected.requiresVersionPin ? false : payload.autoUpdate
                }
            };
        }
        const raw = String(payload.raw || '').trim();
        if (!raw) {
            return {
                success: false,
                code: 'selection_required'
            };
        }
        const resolved = /^https?:\/\//i.test(raw)
            ? await resolveLink(raw)
            : await resolveCatalogGame(raw);
        if (!resolved.success) return resolved;
        return {
            ...resolved,
            item: {
                ...resolved.item,
                autoUpdate: resolved.item.requiresVersionPin ? false : payload.autoUpdate
            }
        };
    }

    async function searchCatalog(query) {
        const term = String(query || '').trim();
        if (!term) return { success: true, items: [] };
        try {
            const items = await Promise.all(
                (await catalogService.search(term, { limit: 4 }))
                    .map(item => applyManifestPolicy(item))
            );
            return { success: true, items };
        } catch (error) {
            return {
                success: false,
                code: 'search_failed',
                message: error.message,
                items: []
            };
        }
    }

    async function add(input, onQueueUpdated = () => {}) {
        const resolved = await resolveInput(input);
        if (!resolved.success) return resolved;

        const result = queue.add(resolved.item);
        if (!result.success) {
            return result;
        }

        onQueueUpdated(queueState());
        return { success: true, item: result.item, queue: queueState() };
    }

    function remove(appId, onQueueUpdated = () => {}) {
        const result = queue.remove(String(appId || ''));
        if (!result.success) return result;
        onQueueUpdated(queueState());
        return { success: true, queue: queueState() };
    }

    function clear(onQueueUpdated = () => {}) {
        const result = queue.clear();
        if (!result.success) return result;
        onQueueUpdated(queueState());
        return { success: true, queue: queueState() };
    }

    async function installNow(input, events = {}) {
        if (installing) {
            return { success: false, code: 'install_busy' };
        }
        if (queue.list().length > 0) {
            return {
                success: false,
                code: 'queue_not_empty'
            };
        }

        const resolved = await resolveInput(input);
        if (!resolved.success) return resolved;
        if (queue.list().length > 0) {
            return {
                success: false,
                code: 'queue_not_empty'
            };
        }
        if (queue.has(resolved.item.appId)) {
            return { success: false, code: 'duplicate' };
        }

        const added = queue.add(resolved.item);
        if (!added.success) {
            return added;
        }

        installing = true;
        queue.setLocked(true);
        events.queueUpdated?.(queueState());

        try {
            const result = friendlyInstallResult(await gameInstaller.install({
                appId: resolved.item.appId,
                steamPath: configStore.get().steamPath,
                autoUpdate: resolved.item.autoUpdate !== false,
                onProgress: progress => events.progress?.({
                    ...progress,
                    appId: resolved.item.appId,
                    name: resolved.item.name,
                    coverUrl: resolved.item.coverUrl || null,
                    current: 1,
                    total: 1
                })
            }));
            if (result.success) {
                libraryService?.recordName(resolved.item.appId, resolved.item);
            }
            return { ...result, item: resolved.item };
        } finally {
            queue.remove(resolved.item.appId, true);
            queue.setLocked(false);
            installing = false;
            events.queueUpdated?.(queueState());
        }
    }

    async function installAll(events = {}) {
        if (installing) {
            return { success: false, code: 'install_busy' };
        }

        const snapshot = queue.list();
        if (snapshot.length === 0) {
            return { success: false, code: 'empty_queue' };
        }

        installing = true;
        queue.setLocked(true);
        events.queueUpdated?.(queueState());
        const installed = [];
        const failed = [];

        try {
            for (let index = 0; index < snapshot.length; index++) {
                const item = snapshot[index];
                const result = friendlyInstallResult(await gameInstaller.install({
                    appId: item.appId,
                    steamPath: configStore.get().steamPath,
                    autoUpdate: item.autoUpdate !== false,
                    onProgress: progress => events.progress?.({
                        ...progress,
                        appId: item.appId,
                        name: item.name,
                        coverUrl: item.coverUrl || null,
                        current: index + 1,
                        total: snapshot.length
                    })
                }));

                if (result.success) {
                    libraryService?.recordName(item.appId, item);
                    installed.push(item);
                    queue.remove(item.appId, true);
                    events.queueUpdated?.(queueState());
                } else {
                    failed.push({ ...item, error: result.message });
                }
            }

            return { success: failed.length === 0, installed, failed };
        } finally {
            queue.setLocked(false);
            installing = false;
            events.queueUpdated?.(queueState());
        }
    }

    async function restartSteam() {
        const steamPath = configStore.get().steamPath;
        const readiness = steamService.getActivationReadiness(steamPath);
        if (!readiness.ok) {
            return {
                success: false,
                code: readiness.reason
            };
        }

        await steamService.close(steamPath);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const started = await steamService.start(steamPath);
        return {
            success: started,
            code: started ? 'restart_success' : 'restart_failed'
        };
    }

    return {
        add,
        clear,
        installAll,
        installNow,
        queueState,
        remove,
        resolveInput,
        resolveLink,
        restartSteam,
        searchCatalog
    };
}

module.exports = { createAddGamesService };
