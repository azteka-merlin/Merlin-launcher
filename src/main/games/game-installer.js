function createGameInstaller({
    app,
    fs,
    path,
    AdmZip,
    archiveClient,
    authSession,
    manifestApiUrl,
    steamService,
    installLuaFile,
    onInstalled = () => {}
}) {
    const { createZipArchiveTools } = require('../files/zip-archive-tools');
    const activeDownloads = new Set();
    const zipArchiveTools = createZipArchiveTools({ fs, path, AdmZip });

    function createSources(appId) {
        return [
            {
                name: 'merlin-api',
                url: manifestApiUrl,
                params: { appid: appId },
                headers: { 'User-Agent': 'Merlin/2.0' },
                getHeaders: async () => ({
                    Authorization: `Bearer ${await authSession.getAccessToken()}`
                }),
                onUnauthorized: () => authSession.handleUnauthorized(),
                retries: 2
            }
        ];
    }

    function isZipArchive(archiveData) {
        return archiveData.length >= 4
            && archiveData[0] === 0x50
            && archiveData[1] === 0x4b
            && [0x03, 0x05, 0x07].includes(archiveData[2])
            && [0x04, 0x06, 0x08].includes(archiveData[3]);
    }

    function findExtractedDirectory(tempDir, appId) {
        const possiblePatterns = [
            `SB_manifest_DB-${appId}`,
            `SPIN0ZAi-SB_manifest_DB-${appId}`,
            `SB_manifest_DB-main-${appId}`,
            appId
        ];
        const tempContents = fs.readdirSync(tempDir);

        for (const item of tempContents) {
            const itemPath = path.join(tempDir, item);
            if (!fs.statSync(itemPath).isDirectory()) continue;

            for (const pattern of possiblePatterns) {
                if (item === pattern || item.includes(pattern) || item.endsWith(appId)) {
                    return itemPath;
                }
            }
        }

        const junk = new Set(['__pycache__', 'node_modules', '.git']);
        for (const item of tempContents) {
            const itemPath = path.join(tempDir, item);
            if (fs.statSync(itemPath).isDirectory() && !junk.has(item)) {
                return itemPath;
            }
        }
        return null;
    }

    function installArchiveFiles(extractedDir, depotcachePath, stplugInPath, { autoUpdate = true } = {}) {
        let filesCopied = 0;
        let totalFiles = 0;

        function walkDirectory(dir) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    walkDirectory(filePath);
                    continue;
                }

                totalFiles++;
                try {
                    if (file.endsWith('.manifest')) {
                        const destPath = path.join(depotcachePath, file);
                        fs.copyFileSync(filePath, destPath);
                        filesCopied++;
                        console.log(`Copied manifest: ${file} -> ${destPath}`);
                    } else if (file.endsWith('.lua')) {
                        const destPath = path.join(stplugInPath, file);
                        const commentedLines = installLuaFile(fs, filePath, destPath, { autoUpdate });
                        filesCopied++;
                        console.log(
                            `Installed lua: ${file} -> ${destPath} `
                            + `(${commentedLines} setmanifestid line(s) commented)`
                        );
                    }
                } catch (error) {
                    console.error(`Error copying ${file}:`, error.message);
                }
            }
        }

        walkDirectory(extractedDir);
        return { filesCopied, totalFiles };
    }

    function parseApiErrorData(data) {
        if (!data) return null;
        if (typeof data === 'object' && !Buffer.isBuffer(data) && !(data instanceof ArrayBuffer)) {
            return data;
        }

        try {
            const text = Buffer.isBuffer(data)
                ? data.toString('utf8')
                : data instanceof ArrayBuffer
                    ? Buffer.from(data).toString('utf8')
                    : typeof data === 'string'
                        ? data
                        : '';
            return text ? JSON.parse(text) : null;
        } catch (_error) {
            return null;
        }
    }

    function getApiErrorPayload(error) {
        return parseApiErrorData(error?.response?.data) || {};
    }

    function getApiErrorCode(error) {
        const payload = getApiErrorPayload(error);
        const code = payload.code || error?.code || '';
        const detail = getApiErrorDetail(error).toLowerCase();
        if (error?.response?.status === 401 && detail.includes('license expired')) return 'expired';
        return typeof code === 'string' ? code : '';
    }

    function getApiErrorDetail(error) {
        const payload = getApiErrorPayload(error);
        if (typeof payload.error === 'string') return payload.error;
        if (typeof payload.message === 'string') return payload.message;
        if (typeof error?.response?.data?.error === 'string') return error.response.data.error;
        if (typeof error?.response?.data?.message === 'string') return error.response.data.message;
        return error?.message || '';
    }

    function isNormalTestLimitError(error) {
        return getApiErrorCode(error) === 'TEST_LICENSE_NORMAL_ACTIVATION_LIMIT_REACHED';
    }

    async function install({ appId, steamPath, onProgress, autoUpdate = true }) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) {
            return { success: false, message: 'Invalid App ID.' };
        }

        const readiness = steamService.getActivationReadiness(steamPath);
        if (!readiness.ok) {
            const details = readiness.missing.length > 0
                ? ` Missing: ${readiness.missing.join(', ')}.`
                : '';
            return {
                success: false,
                reason: readiness.reason,
                missing: readiness.missing,
                message: `Steam activation prerequisites are not ready.${details}`
            };
        }

        if (activeDownloads.has(appId)) {
            return {
                success: false,
                message: `A download for App ID ${appId} is already running.`
            };
        }
        activeDownloads.add(appId);

        try {
            const tempDir = path.join(app.getPath('temp'), 'steam-injector');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const depotcachePath = path.join(steamPath, 'depotcache');
            const stplugInPath = path.join(steamPath, 'config', 'stplug-in');
            if (!fs.existsSync(depotcachePath)) fs.mkdirSync(depotcachePath, { recursive: true });
            if (!fs.existsSync(stplugInPath)) fs.mkdirSync(stplugInPath, { recursive: true });

            const sources = createSources(appId);
            const zipPath = path.join(tempDir, `${appId}.zip`);
            let downloaded = false;
            let sourceUsed = null;
            let forceDisableAutoUpdate = false;

            for (let i = 0; i < sources.length; i++) {
                const source = sources[i];
                try {
                    onProgress({
                        stage: 'downloading',
                        message: 'Downloading manifests...',
                        percent: 10 + i * 5
                    });

                    const response = await archiveClient.request(source);
                    const applicationResult = parseApiErrorData(response.data);
                    if (applicationResult?.success === false && typeof applicationResult.code === 'string') {
                        const error = new Error(
                            typeof applicationResult.error === 'string'
                                ? applicationResult.error
                                : 'The manifest source could not complete this request.'
                        );
                        error.code = applicationResult.code;
                        throw error;
                    }
                    const archiveData = Buffer.from(response.data);
                    if (!isZipArchive(archiveData)) {
                        throw new Error(`Invalid ZIP response from ${source.name}`);
                    }
                    fs.writeFileSync(zipPath, archiveData);
                    zipArchiveTools.validate(zipPath);
                    if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0) {
                        downloaded = true;
                        sourceUsed = source.name;
                        forceDisableAutoUpdate = String(
                            response.headers?.['x-merlin-manifest-source'] || ''
                        ).toLowerCase() === 'r2-override';
                        console.log(`Downloaded from ${source.name} (attempt ${i + 1}): ${source.url}`);
                        break;
                    }
                } catch (error) {
                    const apiErrorCode = getApiErrorCode(error);
                    if (apiErrorCode === 'expired') error.code = 'expired';
                    console.error(`Attempt ${i + 1} failed (${source.name}):`, error.message);
                    if (
                        isNormalTestLimitError(error)
                        || (error.code && [
                            'missing',
                            'invalid_key',
                            'expired',
                            'revoked',
                            'hwid_mismatch',
                            'manifest_unavailable',
                            'manifest_sources_unavailable'
                        ].includes(error.code))
                    ) {
                        throw error;
                    }
                }
            }

            if (!downloaded) {
                throw new Error(
                    `Unable to download files for App ID ${appId}. `
                    + 'The game may not exist in any database.'
                );
            }

            onProgress({ message: 'Extracting files...', percent: 60 });
            let extractedDir = null;

            if (sourceUsed === 'merlin-api') {
                extractedDir = path.join(tempDir, `${sourceUsed}-${appId}`);
                fs.rmSync(extractedDir, { recursive: true, force: true });
                if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true });
                zipArchiveTools.extract(zipPath, extractedDir);
            } else {
                zipArchiveTools.extract(zipPath, tempDir);
                extractedDir = findExtractedDirectory(tempDir, appId);
            }

            if (!extractedDir) {
                throw new Error('Extracted folder not found - unexpected archive structure');
            }

            console.log(`Extracted directory: ${extractedDir} (source: ${sourceUsed})`);
            onProgress({ message: 'Installing files...', percent: 75 });
            const effectiveAutoUpdate = forceDisableAutoUpdate ? false : autoUpdate;
            if (forceDisableAutoUpdate) {
                console.log(`Manifest override detected for ${appId}; forcing autoUpdate=false`);
            }
            const result = installArchiveFiles(
                extractedDir,
                depotcachePath,
                stplugInPath,
                { autoUpdate: effectiveAutoUpdate }
            );

            onProgress({ message: 'Cleaning up...', percent: 95 });
            try {
                fs.rmSync(extractedDir, { recursive: true, force: true });
                fs.unlinkSync(zipPath);
            } catch (error) {
                console.warn('Unable to clean up temp folder:', error.message);
            }

            if (result.filesCopied === 0) {
                if (result.totalFiles === 0) {
                    throw new Error(
                        `No files found in the archive for App ID ${appId}. `
                        + 'This game may not be supported.'
                    );
                }
                throw new Error(
                    `No valid Steam files found (${result.totalFiles} files examined). `
                    + 'Supported types: .manifest, .lua'
                );
            }

            onProgress({ message: 'Installation complete!', percent: 100 });
            try {
                onInstalled(appId);
            } catch (error) {
                console.warn('Unable to invalidate Library after installation:', error.message);
            }
            return {
                success: true,
                message: `Installation successful! ${result.filesCopied} file(s) installed `
                    + `out of ${result.totalFiles} examined. (Source: ${sourceUsed})`,
                forcedAutoUpdateOff: forceDisableAutoUpdate
            };
        } catch (error) {
            console.error('Error download-game:', error);
            const status = error?.response?.status;
            const detail = getApiErrorDetail(error);
            const code = isNormalTestLimitError(error)
                ? 'test_limit_normal'
                : status === 429
                    ? 'rate_limited'
                    : error.code;
            return {
                success: false,
                reason: code,
                message: detail
            };
        } finally {
            activeDownloads.delete(appId);
        }
    }

    return { install };
}

module.exports = { createGameInstaller };
