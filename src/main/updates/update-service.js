const UPDATE_LATEST_API_URL = 'https://api-merlin.com/api/updates/latest';
const UPDATE_DOWNLOAD_API_URL = 'https://api-merlin.com/api/updates/download';

function normalizeVersion(value) {
    return String(value || '').trim().replace(/^v/i, '').split('-')[0];
}

function compareVersions(left, right) {
    const a = normalizeVersion(left).split('.').map(part => Number.parseInt(part, 10) || 0);
    const b = normalizeVersion(right).split('.').map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(a.length, b.length);

    for (let index = 0; index < length; index += 1) {
        const difference = (a[index] || 0) - (b[index] || 0);
        if (difference !== 0) return Math.sign(difference);
    }
    return 0;
}

function isAllowedDownloadUrl(value, allowedApiDownloadUrl = UPDATE_DOWNLOAD_API_URL) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return false;
        const apiDownloadUrl = new URL(allowedApiDownloadUrl);
        if (url.hostname === apiDownloadUrl.hostname && url.pathname === apiDownloadUrl.pathname) {
            return true;
        }
        return url.hostname === 'github.com'
            && url.pathname.startsWith('/azteka-merlin/Merlin-launcher/releases/download/');
    } catch {
        return false;
    }
}

function getDownloadFileName(downloadUrl, fallbackVersion) {
    try {
        const url = new URL(downloadUrl);
        const name = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (/\.exe$/i.test(name)) return name;
    } catch {}
    return `Merlin-Setup-${normalizeVersion(fallbackVersion) || 'latest'}.exe`;
}

function createUpdateService({
    app,
    axios,
    shell,
    path,
    downloadManager,
    latestApiUrl = UPDATE_LATEST_API_URL,
    downloadApiUrl = UPDATE_DOWNLOAD_API_URL
}) {
    async function check() {
        const currentVersion = app.getVersion();
        if (!app.isPackaged && process.env.MERLIN_SIMULATE_UPDATE === '1') {
            const downloadUrl = process.env.MERLIN_SIMULATE_UPDATE_URL || '';
            if (!isAllowedDownloadUrl(downloadUrl, downloadApiUrl)) {
                console.warn('[updates] MERLIN_SIMULATE_UPDATE_URL must be an allowed Merlin update URL.');
                return { success: false, currentVersion };
            }

            return {
                success: true,
                updateAvailable: true,
                currentVersion,
                latestVersion: normalizeVersion(process.env.MERLIN_SIMULATE_UPDATE_VERSION || '99.0.0'),
                downloadUrl
            };
        }

        try {
            const response = await axios.get(latestApiUrl, {
                timeout: 10000,
                headers: {
                    Accept: 'application/json',
                    'User-Agent': `Merlin/${currentVersion}`
                }
            });
            const release = response.data || {};
            const latestVersion = normalizeVersion(release.version);
            const downloadUrl = String(release.downloadUrl || downloadApiUrl).trim();

            if (!release.success || !latestVersion || !isAllowedDownloadUrl(downloadUrl, downloadApiUrl)) {
                return { success: false, currentVersion };
            }

            return {
                success: true,
                updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
                currentVersion,
                latestVersion,
                downloadUrl
            };
        } catch (error) {
            console.warn('[updates] Could not check Merlin updates:', error.message);
            return { success: false, currentVersion };
        }
    }

    async function openDownload(downloadUrl) {
        if (!isAllowedDownloadUrl(downloadUrl, downloadApiUrl)) {
            return { success: false, error: 'INVALID_DOWNLOAD_URL' };
        }
        await shell.openExternal(downloadUrl);
        return { success: true };
    }

    async function downloadUpdate({ operationId, downloadUrl, latestVersion, onProgress = () => {} }) {
        if (!isAllowedDownloadUrl(downloadUrl, downloadApiUrl)) {
            return { success: false, code: 'invalid_download_url' };
        }

        const fileName = getDownloadFileName(downloadUrl, latestVersion);
        const destinationPath = path.join(app.getPath('downloads'), fileName);
        const result = await downloadManager.download({
            operationId,
            url: downloadUrl,
            destinationPath,
            headers: {
                Accept: 'application/octet-stream',
                'User-Agent': `Merlin/${app.getVersion()}`
            },
            onProgress
        });

        if (!result.success) return result;
        return {
            ...result,
            fileName,
            folderPath: path.dirname(result.filePath)
        };
    }

    function cancelDownload(operationId) {
        return downloadManager.cancel(operationId);
    }

    async function openDownloadedFile(filePath) {
        if (!filePath || !/\.exe$/i.test(filePath)) {
            return { success: false, code: 'invalid_file' };
        }
        const error = await shell.openPath(filePath);
        return error ? { success: false, code: 'open_failed', message: error } : { success: true };
    }

    async function openDownloadedFolder(folderPath) {
        if (!folderPath) return { success: false, code: 'invalid_folder' };
        const error = await shell.openPath(folderPath);
        return error ? { success: false, code: 'open_failed', message: error } : { success: true };
    }

    return { cancelDownload, check, downloadUpdate, openDownload, openDownloadedFile, openDownloadedFolder };
}

module.exports = { createUpdateService, compareVersions, isAllowedDownloadUrl, normalizeVersion };
