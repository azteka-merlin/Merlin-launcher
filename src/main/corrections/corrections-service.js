function createCorrectionsService({
    app,
    fs,
    path,
    AdmZip,
    nodeUnrar,
    dialog,
    shell,
    configStore,
    steamService,
    authSession,
    catalogStore,
    catalogClient,
    apiBaseUrl,
    libraryCatalogService,
    downloadManager,
    specialCorrection,
    launcherVersion
}) {
    const { createZipArchiveTools } = require('../files/zip-archive-tools');
    let cachedItems = null;
    const operations = new Map();
    const zipArchiveTools = createZipArchiveTools({ fs, path, AdmZip });

    function fallbackCoverUrl(appId) {
        return /^\d+$/.test(String(appId || '').trim())
            ? `https://generator.ryuu.lol/files/images/${appId}.jpg`
            : null;
    }

    function cloneItem(item) {
        return {
            ...item,
            correction: { ...item.correction }
        };
    }

    function cloneItems(items) {
        return items.map(cloneItem);
    }

    function persistCachedItems() {
        if (!Array.isArray(cachedItems)) return;
        const snapshot = catalogStore.load();
        catalogStore.replace(cachedItems, snapshot.lastSync || new Date().toISOString());
    }

    async function getCatalogAccessToken() {
        if (!authSession?.getAccessToken) return null;
        try {
            return await authSession.getAccessToken();
        } catch {
            return null;
        }
    }

    function applyVoteResult(appId, result) {
        if (!Array.isArray(cachedItems)) return;
        const item = cachedItems.find(entry => entry.appId === appId);
        if (!item) return;

        item.correction = {
            ...item.correction,
            upvotes: Math.max(0, Math.trunc(Number(result.upvotes) || 0)),
            downvotes: Math.max(0, Math.trunc(Number(result.downvotes) || 0)),
            score: Math.trunc(Number(result.score) || 0),
            viewerVote: result.viewerVote === 'up' || result.viewerVote === 'down'
                ? result.viewerVote
                : item.correction.viewerVote || null
        };

        persistCachedItems();
    }

    function isPathInside(rootPath, candidatePath) {
        const resolvedRoot = path.resolve(rootPath);
        const resolvedCandidate = path.resolve(candidatePath);
        return resolvedCandidate === resolvedRoot
            || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
    }

    function beginOperation(operationId) {
        operationId = String(operationId || '').trim();
        if (!operationId) return { success: false, code: 'invalid_operation' };
        if (operations.size > 0 && !operations.has(operationId)) {
            return { success: false, code: 'busy' };
        }
        const operation = {
            id: operationId,
            cancelled: false,
            tempPaths: new Set()
        };
        operations.set(operationId, operation);
        return { success: true, operation };
    }

    function finishOperation(operationId) {
        const operation = operations.get(String(operationId || '').trim());
        if (!operation) return;
        for (const tempPath of [...operation.tempPaths].reverse()) {
            try {
                if (fs.existsSync(tempPath)) {
                    fs.rmSync(tempPath, { recursive: true, force: true });
                }
            } catch (error) {
                console.warn('Unable to clean correction temp path:', error.message);
            }
        }
        operations.delete(operation.id);
    }

    function trackTempPath(operation, tempPath) {
        if (!operation || !tempPath) return;
        operation.tempPaths.add(tempPath);
    }

    function cancel(operationId) {
        const operation = operations.get(String(operationId || '').trim());
        if (!operation) return { success: false, code: 'not_found' };
        operation.cancelled = true;
        downloadManager.cancel(operation.id);
        return { success: true };
    }

    function throwIfCancelled(operation) {
        if (operation?.cancelled) {
            const error = new Error('Operation cancelled');
            error.code = 'cancelled';
            throw error;
        }
    }

    function emitProgress(onProgress, item, payload) {
        onProgress({
            appId: item.appId,
            gameName: item.gameName,
            fileName: item.correction.filename,
            imageUrl: item.imageUrl || null,
            ...payload
        });
    }

    function isConfiguredApiFixDownloadUrl(value) {
        try {
            const url = new URL(String(value || ''));
            const baseUrl = new URL(String(apiBaseUrl || '').replace(/\/$/, ''));
            const basePath = baseUrl.pathname.replace(/\/$/, '');
            return url.origin === baseUrl.origin
                && url.pathname === `${basePath}/fixes/download`;
        } catch {
            return false;
        }
    }

    async function getDownloadHeaders(url) {
        if (!isConfiguredApiFixDownloadUrl(url)) return {};
        if (!authSession?.getAccessToken) {
            const error = new Error('Authentication is required.');
            error.code = 'auth_required';
            throw error;
        }
        return {
            Authorization: `Bearer ${await authSession.getAccessToken()}`,
            'X-Merlin-Version': launcherVersion
        };
    }

    async function hydrateImages(items) {
        try {
            await libraryCatalogService.ensureLoaded();
        } catch (error) {
            console.warn('Unable to preload game catalog for corrections:', error.message);
        }

        const missingMetadataAppIds = items
            .filter(item => !item.imageUrl)
            .map(item => item.appId);

        let enrichedEntries = new Map();
        if (missingMetadataAppIds.length > 0) {
            try {
                enrichedEntries = await libraryCatalogService.enrichAppIds(missingMetadataAppIds, {
                    allowCatalogRefresh: true
                });
            } catch (error) {
                console.warn('Unable to enrich correction images from game catalog:', error.message);
            }
        }

        return items.map(item => {
            const catalogEntry = enrichedEntries.get(item.appId)
                || libraryCatalogService.findByAppId(item.appId);
            return {
                ...item,
                imageUrl: catalogEntry?.coverUrl || item.imageUrl || fallbackCoverUrl(item.appId) || null
            };
        });
    }

    async function refresh() {
        try {
            const downloaded = await catalogClient.download({
                accessToken: await getCatalogAccessToken()
            });
            const hydrated = await hydrateImages(downloaded.items);
            catalogStore.replace(hydrated, downloaded.syncedAt);
            cachedItems = hydrated;
            return { success: true, items: cloneItems(hydrated), stale: false };
        } catch (error) {
            const fallbackItems = catalogStore.list();
            if (fallbackItems.length > 0) {
                cachedItems = fallbackItems;
                return {
                    success: true,
                    items: cloneItems(fallbackItems),
                    stale: true,
                    code: 'refresh_failed'
                };
            }
            return { success: false, code: 'refresh_failed', message: error.message };
        }
    }

    async function list({ force = false } = {}) {
        if (!force && cachedItems) {
            return { success: true, items: cloneItems(cachedItems), stale: false };
        }

        const storedItems = catalogStore.list();
        if (!force && storedItems.length > 0) {
            cachedItems = storedItems;
            return { success: true, items: cloneItems(storedItems), stale: false };
        }

        return refresh();
    }

    async function ensureItemsLoaded() {
        const result = await list();
        return result.success ? result.items : [];
    }

    async function findItem(appId) {
        appId = String(appId || '').trim();
        const items = cachedItems || await ensureItemsLoaded();
        return items.find(item => item.appId === appId) || null;
    }

    async function vote(appId, voteValue) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) {
            return { success: false, code: 'not_found' };
        }
        if (voteValue !== 'up' && voteValue !== 'down') {
            return { success: false, code: 'vote_failed' };
        }

        const item = await findItem(appId);
        if (!item) return { success: false, code: 'not_found' };
        if (!authSession?.getAccessToken) return { success: false, code: 'auth_required' };

        try {
            let accessToken = await authSession.getAccessToken();

            try {
                const result = await catalogClient.vote({
                    appId,
                    vote: voteValue,
                    accessToken
                });
                applyVoteResult(appId, result);
                return { success: true, ...result };
            } catch (error) {
                if (error?.response?.status !== 401) throw error;
                await authSession.handleUnauthorized();
                accessToken = await authSession.getAccessToken();
                const result = await catalogClient.vote({
                    appId,
                    vote: voteValue,
                    accessToken
                });
                applyVoteResult(appId, result);
                return { success: true, ...result };
            }
        } catch (error) {
            const code = error?.code === 'missing' ? 'auth_required' : (error?.code || 'vote_failed');
            return {
                success: false,
                code,
                message: error?.message || 'Vote failed'
            };
        }
    }

    function configuredSteamPath() {
        const steamPath = configStore.get().steamPath;
        const readiness = steamService.getActivationReadiness(steamPath);
        if (readiness.reason === 'steam_path_missing' || readiness.reason === 'steam_path_invalid') {
            return { success: false, code: readiness.reason };
        }
        return { success: true, steamPath };
    }

    async function prepareInstall(appId) {
        const item = await findItem(appId);
        if (!item) return { success: false, code: 'not_found' };

        const steam = configuredSteamPath();
        if (!steam.success) return steam;

        const installation = steamService.findInstalledGame(item.appId, steam.steamPath);
        if (!installation.installed) {
            return {
                success: false,
                code: installation.code === 'not_installed'
                    ? 'game_not_installed'
                    : installation.code
            };
        }

        return {
            success: true,
            item: cloneItem(item),
            installation
        };
    }

    function safeExtractEntry(pathApi, rootPath, entryName) {
        const normalizedName = String(entryName || '').replace(/\\/g, '/');
        const entryPath = normalizedName.startsWith('/')
            ? normalizedName.slice(1)
            : normalizedName;
        const destinationPath = pathApi.resolve(rootPath, entryPath);

        if (!isPathInside(rootPath, destinationPath)) {
            const error = new Error(`Blocked archive path: ${normalizedName}`);
            error.code = 'invalid_zip';
            throw error;
        }

        return destinationPath;
    }

    function extractNestedZipFiles(rootPath, operation) {
        const pending = [rootPath];
        let extractedNestedCount = 0;
        const maxNestedArchives = 100;

        while (pending.length > 0) {
            throwIfCancelled(operation);
            const current = pending.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {
                throwIfCancelled(operation);
                const entryPath = path.join(current, entry.name);

                if (entry.isDirectory()) {
                    pending.push(entryPath);
                    continue;
                }

                if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.zip') {
                    continue;
                }

                extractedNestedCount += 1;
                if (extractedNestedCount > maxNestedArchives) {
                    const error = new Error('Too many nested ZIP archives');
                    error.code = 'invalid_zip';
                    throw error;
                }

                const targetDirectory = path.dirname(entryPath);
                zipArchiveTools.extract(entryPath, targetDirectory);
                fs.unlinkSync(entryPath);
                pending.push(targetDirectory);
            }
        }
    }

    async function extractRarToDirectory(rarFilePath, destinationRoot, operation) {
        try {
            const archiveData = fs.readFileSync(rarFilePath);
            const extractor = await nodeUnrar.createExtractorFromData({ data: Uint8Array.from(archiveData).buffer });
            const extracted = extractor.extract();
            let extractedFileCount = 0;

            for (const entry of extracted.files) {
                throwIfCancelled(operation);
                const header = entry.fileHeader || {};
                const entryName = header.name || '';
                const destinationPath = safeExtractEntry(path, destinationRoot, entryName);

                if (header.flags?.directory) {
                    fs.mkdirSync(destinationPath, { recursive: true });
                    continue;
                }

                if (!(entry.extraction instanceof Uint8Array)) {
                    const error = new Error(`Unable to extract RAR entry: ${entryName}`);
                    error.code = 'extract_failed';
                    throw error;
                }

                fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
                fs.writeFileSync(destinationPath, Buffer.from(entry.extraction));
                extractedFileCount += 1;
            }

            if (extractedFileCount === 0) {
                const error = new Error('Empty archive');
                error.code = 'invalid_zip';
                throw error;
            }
        } catch (error) {
            if (error.code === 'cancelled' || error.code === 'invalid_zip' || error.code === 'extract_failed') throw error;
            const wrapped = new Error(error.message || 'Extraction failed');
            wrapped.code = 'extract_failed';
            throw wrapped;
        }
    }

    async function extractArchiveToDirectory(archiveFilePath, destinationRoot, operation) {
        const extension = path.extname(String(archiveFilePath || '')).toLowerCase();

        if (extension === '.rar') {
            await extractRarToDirectory(archiveFilePath, destinationRoot, operation);
            extractNestedZipFiles(destinationRoot, operation);
            return;
        }

        if (extension !== '.zip') {
            const error = new Error(`Unsupported archive type: ${extension || 'unknown'}`);
            error.code = 'invalid_zip';
            throw error;
        }

        zipArchiveTools.extract(archiveFilePath, destinationRoot);
        extractNestedZipFiles(destinationRoot, operation);
    }

    function validateArchiveFile(archiveFilePath) {
        const extension = path.extname(String(archiveFilePath || '')).toLowerCase();
        if (extension === '.rar') return;

        try {
            zipArchiveTools.validate(archiveFilePath);
        } catch (error) {
            const wrapped = new Error(error.message || 'Invalid archive');
            wrapped.code = error.code || 'invalid_zip';
            throw wrapped;
        }
    }

    async function extractZipToDirectory(zipFilePath, destinationRoot, operation) {
        try {
            await extractArchiveToDirectory(zipFilePath, destinationRoot, operation);
        } catch (error) {
            if (error.code === 'cancelled' || error.code === 'invalid_zip') throw error;
            const wrapped = new Error(error.message || 'Extraction failed');
            wrapped.code = 'extract_failed';
            throw wrapped;
        }
    }

    function copyDirectoryContents(sourceRoot, destinationRoot, operation) {
        const pending = [sourceRoot];

        while (pending.length > 0) {
            throwIfCancelled(operation);
            const current = pending.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {
                throwIfCancelled(operation);
                const sourcePath = path.join(current, entry.name);
                const relativePath = path.relative(sourceRoot, sourcePath);
                const destinationPath = path.resolve(destinationRoot, relativePath);

                if (!isPathInside(destinationRoot, destinationPath)) {
                    const error = new Error(`Blocked destination path: ${relativePath}`);
                    error.code = 'apply_failed';
                    throw error;
                }

                if (entry.isDirectory()) {
                    fs.mkdirSync(destinationPath, { recursive: true });
                    pending.push(sourcePath);
                    continue;
                }

                fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
                fs.copyFileSync(sourcePath, destinationPath);
            }
        }
    }

    async function performDownload({
        item,
        operation,
        destinationPath,
        onProgress,
        mode
    }) {
        emitProgress(onProgress, item, {
            operationId: operation.id,
            mode,
            stage: 'preparing',
            percent: 2,
            transferredBytes: 0,
            totalBytes: 0,
            speedBytesPerSecond: 0,
            remainingSeconds: null
        });

        const runDownload = async () => downloadManager.download({
            operationId: operation.id,
            url: item.correction.href,
            destinationPath,
            headers: await getDownloadHeaders(item.correction.href),
            onProgress: progress => {
                const percent = mode === 'install'
                    ? 8 + Math.round((progress.percent || 0) * 0.52)
                    : 6 + Math.round((progress.percent || 0) * 0.88);
                emitProgress(onProgress, item, {
                    ...progress,
                    mode,
                    percent
                });
            }
        });

        let result;
        try {
            result = await runDownload();
        } catch (error) {
            return {
                success: false,
                code: error?.code === 'missing' ? 'auth_required' : (error?.code || 'download_failed'),
                message: error?.message || 'Download failed'
            };
        }
        if (result.code === 'auth_required' || result.status === 401) {
            if (!authSession?.handleUnauthorized) return { success: false, code: 'auth_required' };
            try {
                await authSession.handleUnauthorized();
                result = await runDownload();
            } catch (error) {
                return {
                    success: false,
                    code: error?.code === 'missing' ? 'auth_required' : (error?.code || 'auth_required'),
                    message: error?.message || 'Authentication is required.'
                };
            }
        }

        if (!result.success) return result;
        return result;
    }

    async function download(appId, operationId, onProgress = () => {}) {
        const start = beginOperation(operationId);
        if (!start.success) return start;
        const { operation } = start;

        try {
            const item = await findItem(appId);
            if (!item) return { success: false, code: 'not_found' };

            const saveResult = await dialog.showSaveDialog({
                title: item.correction.filename,
                defaultPath: item.correction.filename
            });

            if (saveResult.canceled || !saveResult.filePath) {
                return { success: false, code: 'cancelled' };
            }

            const downloadResult = await performDownload({
                item,
                operation,
                destinationPath: saveResult.filePath,
                onProgress,
                mode: 'download'
            });

            if (!downloadResult.success) return downloadResult;

            emitProgress(onProgress, item, {
                operationId,
                mode: 'download',
                stage: 'completed',
                percent: 100
            });

            return {
                success: true,
                appId: item.appId,
                gameName: item.gameName,
                filePath: downloadResult.filePath,
                folderPath: path.dirname(downloadResult.filePath)
            };
        } finally {
            finishOperation(operationId);
        }
    }

    async function install(appId, operationId, onProgress = () => {}) {
        const start = beginOperation(operationId);
        if (!start.success) return start;
        const { operation } = start;

        try {
            const prepared = await prepareInstall(appId);
            if (!prepared.success) return prepared;

            const item = prepared.item;
            const tempRoot = path.join(app.getPath('temp'), 'merlin-corrections', operation.id);
            const zipPath = path.join(tempRoot, item.correction.filename);
            const extractedPath = path.join(tempRoot, 'extracted');
            trackTempPath(operation, tempRoot);
            fs.mkdirSync(extractedPath, { recursive: true });

            const downloadResult = await performDownload({
                item,
                operation,
                destinationPath: zipPath,
                onProgress,
                mode: 'install'
            });
            if (!downloadResult.success) return downloadResult;

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'validating',
                percent: 68
            });

            try {
                validateArchiveFile(zipPath);
            } catch (error) {
                const wrapped = new Error(error.message || 'Invalid archive');
                wrapped.code = error.code || 'invalid_zip';
                throw wrapped;
            }

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'extracting',
                percent: 80
            });
            await extractZipToDirectory(zipPath, extractedPath, operation);

            throwIfCancelled(operation);
            if (specialCorrection?.appliesTo(item)) {
                emitProgress(onProgress, item, {
                    operationId,
                    mode: 'install',
                    stage: 'preparing_license',
                    percent: 88
                });
                await specialCorrection.prepare({ item, extractedPath });
            }

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'applying',
                percent: 92
            });
            copyDirectoryContents(extractedPath, prepared.installation.gamePath, operation);

            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'cleaning',
                percent: 98
            });

            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'completed',
                percent: 100
            });

            return {
                success: true,
                appId: item.appId,
                gameName: item.gameName,
                gamePath: prepared.installation.gamePath
            };
        } catch (error) {
            if (error.code === 'cancelled') {
                return { success: false, code: 'cancelled' };
            }
            return {
                success: false,
                code: error.code || 'apply_failed',
                message: error.message
            };
        } finally {
            finishOperation(operationId);
        }
    }

    async function openFolder(folderPath) {
        const target = String(folderPath || '').trim();
        if (!target) return { success: false, code: 'invalid_path' };
        const errorMessage = await shell.openPath(target);
        return {
            success: !errorMessage,
            code: errorMessage ? 'open_failed' : null
        };
    }

    return {
        cancel,
        download,
        install,
        list,
        openFolder,
        prepareInstall,
        refresh,
        vote
    };
}

module.exports = { createCorrectionsService };
