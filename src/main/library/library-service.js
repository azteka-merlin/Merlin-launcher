const {
    extractManifestReferences,
    manifestFileName,
    referenceKey
} = require('./manifest-references');

function createLibraryService({
    fs,
    path,
    configStore,
    cacheStore,
    catalogStore,
    catalogService,
    steamService,
    shell
}) {
    let cachedItems = null;
    let metadataRefresh = null;
    let metadataGeneration = 0;
    const coverLookupAttempted = new Set();

    function invalidate() {
        metadataGeneration += 1;
        cachedItems = null;
    }

    function steamPaths() {
        const steamPath = configStore.get().steamPath;
        if (!steamPath || typeof steamPath !== 'string') {
            return { success: false, code: 'steam_path_missing' };
        }
        const root = path.resolve(steamPath);
        if (!fs.existsSync(root) || !fs.existsSync(path.join(root, 'steam.exe'))) {
            return { success: false, code: 'steam_path_invalid' };
        }
        return {
            success: true,
            steamPath: root,
            luaDirectory: path.join(root, 'config', 'stplug-in'),
            manifestDirectory: path.join(root, 'depotcache')
        };
    }

    function managedLuaFiles(luaDirectory) {
        if (!fs.existsSync(luaDirectory)) return [];
        return fs.readdirSync(luaDirectory, { withFileTypes: true })
            .filter(entry => entry.isFile() && /^\d+\.lua$/i.test(entry.name))
            .map(entry => ({
                appId: entry.name.replace(/\.lua$/i, ''),
                filePath: path.join(luaDirectory, entry.name)
            }));
    }

    function shouldResolveFromRemote(entry) {
        // The metadata-only API supplies names; photo loading is independent.
        // An absent photo is never a reason to query names again.
        return !entry?.name;
    }

    function needsMetadata(entry) {
        return !entry || !entry.name || !entry.coverUrl;
    }

    function applyCatalogData(appId, catalogEntry) {
        if (!catalogEntry) return false;
        return cacheStore.merge(appId, {
            name: catalogEntry.name,
            ...(catalogEntry.coverUrl ? {
                coverUrl: catalogEntry.coverUrl,
                coverSource: catalogEntry.coverSource
            } : {}),
            notFoundInCatalog: false
        });
    }

    async function resolveMetadata(appIds, { force = false, generation = metadataGeneration } = {}) {
        cacheStore.load();
        catalogStore.load();
        const unresolved = new Set();

        for (const appId of appIds) {
            const entry = cacheStore.get(appId);
            const localCatalogEntry = catalogStore.get(appId);
            if (localCatalogEntry && needsMetadata(entry)) {
                applyCatalogData(appId, localCatalogEntry);
            }
            if (!shouldResolveFromRemote(cacheStore.get(appId))) continue;
            unresolved.add(appId);
        }

        if (unresolved.size > 0 && appIds.length > 0) {
            const enrichedEntries = await catalogService.enrichAppIds([...unresolved], {
                allowCatalogRefresh: false,
                metadataOnly: true
            });
            if (generation !== metadataGeneration) return;

            for (const appId of unresolved) {
                const resolvedEntry = enrichedEntries.get(appId) || catalogStore.get(appId);
                if (resolvedEntry) {
                    applyCatalogData(appId, resolvedEntry);
                }
            }
        }
    }

    function coverForLibrary(appId, value) {
        if (typeof value === 'string' && value && !value.includes('/api/game-covers/')) return value;
        return /^\d+$/.test(String(appId)) ? `https://generator.ryuu.lol/files/images/${appId}.jpg` : null;
    }

    function buildItems(paths) {
        cacheStore.load();
        catalogStore.load();
        const luaFiles = managedLuaFiles(paths.luaDirectory);
        for (const file of luaFiles) {
            const localEntry = catalogStore.get(file.appId);
            if (localEntry && needsMetadata(cacheStore.get(file.appId))) applyCatalogData(file.appId, localEntry);
        }

        return luaFiles
            .map(file => {
                const metadata = cacheStore.get(file.appId);
                return {
                    appId: file.appId,
                    gameName: metadata?.name || '',
                    coverUrl: coverForLibrary(file.appId, metadata?.coverUrl)
                };
            })
            .sort((left, right) =>
                (left.gameName || left.appId).localeCompare(right.gameName || right.appId));
    }

    async function list({ force = false } = {}) {
        try {
            const paths = steamPaths();
            if (!paths.success) return paths;
            if (!force && cachedItems) {
                return { success: true, items: cachedItems.map(item => ({ ...item })) };
            }
            cachedItems = buildItems(paths);
            return { success: true, items: cachedItems.map(item => ({ ...item })) };
        } catch (error) {
            console.error('Unable to load Library:', error);
            return { success: false, code: 'load_failed' };
        }
    }

    function refreshMetadata({ force = false } = {}) {
        if (metadataRefresh) return metadataRefresh;
        const generation = metadataGeneration;
        const task = (async () => {
            const paths = steamPaths();
            if (!paths.success) return paths;
            const before = JSON.stringify(cachedItems || []);
            const appIds = managedLuaFiles(paths.luaDirectory).map(file => file.appId);
            if (typeof catalogService.lookupMetadata === 'function') {
                const missingCovers = [...new Set(appIds)].filter(appId =>
                    !cacheStore.get(appId)?.coverUrl && !catalogStore.get(appId)?.coverUrl
                    && (force || !coverLookupAttempted.has(appId)));
                if (missingCovers.length > 0) {
                    try {
                        await catalogService.lookupMetadata(missingCovers);
                        missingCovers.forEach(appId => coverLookupAttempted.add(appId));
                    } catch (error) { console.warn('Unable to refresh Library cover metadata:', error.message); }
                }
            }
            // Small batches avoid a request burst for a newly created cache.
            for (let offset = 0; offset < appIds.length; offset += 4) {
                if (generation !== metadataGeneration) return { success: false, code: 'superseded' };
                await resolveMetadata(appIds.slice(offset, offset + 4), { force, generation });
            }
            const currentPaths = steamPaths();
            if (generation !== metadataGeneration || currentPaths.steamPath !== paths.steamPath) {
                return { success: false, code: 'superseded' };
            }
            if (!currentPaths.success) return currentPaths;
            // Read the current files again: a game may have been removed during the request.
            cachedItems = buildItems(currentPaths);
            return { success: true, items: cachedItems.map(item => ({ ...item })), changed: before !== JSON.stringify(cachedItems) };
        })().catch(error => {
            console.warn('Unable to update Library metadata:', error.message);
            return { success: false, code: 'metadata_unavailable' };
        });
        metadataRefresh = task.finally(() => { metadataRefresh = null; });
        return metadataRefresh;
    }

    function recordName(appId, gameNameOrMetadata) {
        const metadata = typeof gameNameOrMetadata === 'string'
            ? { name: gameNameOrMetadata }
            : gameNameOrMetadata;

        cacheStore.merge(String(appId), {
            name: typeof metadata?.name === 'string' ? metadata.name : '',
            coverUrl: metadata?.coverUrl || null,
            coverSource: metadata?.coverSource || null,
            notFoundInCatalog: false
        });

        if (catalogService?.rememberEntries) {
            catalogService.rememberEntries([{
                appId: String(appId),
                name: typeof metadata?.name === 'string' ? metadata.name : '',
                coverUrl: metadata?.coverUrl || null,
                coverSource: metadata?.coverSource || null
            }]);
        }
        invalidate();
    }

    function collectSharedReferences(luaFiles, targetAppId) {
        const shared = new Set();
        let scanComplete = true;
        for (const file of luaFiles) {
            if (file.appId === targetAppId) continue;
            try {
                const content = fs.readFileSync(file.filePath, 'utf8');
                for (const reference of extractManifestReferences(content)) {
                    shared.add(referenceKey(reference));
                }
            } catch (error) {
                scanComplete = false;
                console.warn(`Unable to inspect ${file.filePath}:`, error.message);
            }
        }
        return { scanComplete, shared };
    }

    function stageAndDelete(filePaths) {
        const token = `${process.pid}-${Date.now()}`;
        const staged = [];
        try {
            for (const filePath of filePaths) {
                const stagedPath = `${filePath}.merlin-remove-${token}`;
                fs.renameSync(filePath, stagedPath);
                staged.push({ filePath, stagedPath });
            }
        } catch (error) {
            for (const entry of staged.reverse()) {
                try {
                    fs.renameSync(entry.stagedPath, entry.filePath);
                } catch (rollbackError) {
                    console.error('Library removal rollback failed:', rollbackError);
                }
            }
            throw error;
        }

        for (const entry of staged) {
            fs.rmSync(entry.stagedPath, { force: true });
        }
    }

    async function remove(appId) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) return { success: false, code: 'invalid_app_id' };

        try {
            const paths = steamPaths();
            if (!paths.success) return paths;
            const luaFiles = managedLuaFiles(paths.luaDirectory);
            const target = luaFiles.find(file => file.appId === appId);
            if (!target) return { success: false, code: 'not_found' };

            const content = fs.readFileSync(target.filePath, 'utf8');
            const references = extractManifestReferences(content);
            const { scanComplete, shared } = collectSharedReferences(luaFiles, appId);
            const manifests = scanComplete
                ? references
                    .filter(reference => !shared.has(referenceKey(reference)))
                    .map(reference => path.join(paths.manifestDirectory, manifestFileName(reference)))
                    .filter(filePath => fs.existsSync(filePath))
                : [];

            stageAndDelete([target.filePath, ...new Set(manifests)]);
            if (cachedItems) {
                cachedItems = cachedItems.filter(item => item.appId !== appId);
            }

            return {
                success: true,
                appId,
                removedManifests: manifests.length,
                preservedSharedManifests: references.length - manifests.length,
                steamRunning: await steamService.isRunning()
            };
        } catch (error) {
            console.error(`Unable to remove ${appId} from Library:`, error);
            return { success: false, code: 'remove_failed' };
        }
    }

    async function restartSteam() {
        const paths = steamPaths();
        if (!paths.success) return paths;
        await steamService.close(paths.steamPath);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const success = await steamService.start(paths.steamPath);
        return { success, code: success ? null : 'restart_failed' };
    }

    async function openGameFolder(appId) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) return { success: false, code: 'invalid_app_id' };

        try {
            const paths = steamPaths();
            if (!paths.success) return paths;
            const installation = steamService.findInstalledGame(appId, paths.steamPath);
            if (!installation.installed) {
                return {
                    success: false,
                    code: installation.code === 'not_installed'
                        ? 'game_not_installed'
                        : installation.code
                };
            }

            const error = await shell.openPath(installation.gamePath);
            if (error) return { success: false, code: 'open_folder_failed', message: error };
            return { success: true, gamePath: installation.gamePath };
        } catch (error) {
            console.error(`Unable to open game folder for ${appId}:`, error);
            return { success: false, code: 'open_folder_failed' };
        }
    }

    return { invalidate, list, refreshMetadata, openGameFolder, recordName, remove, restartSteam };
}

module.exports = { createLibraryService };
