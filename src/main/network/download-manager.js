function createDownloadManager({ fs, path, axios, httpsAgent }) {
    const activeDownloads = new Map();

    function serializeProgress(download) {
        const now = Date.now();
        const elapsedMs = Math.max(now - download.startedAt, 1);
        const speedBytesPerSecond = download.transferredBytes > 0
            ? Math.round((download.transferredBytes * 1000) / elapsedMs)
            : 0;
        const remainingBytes = Math.max((download.totalBytes || 0) - download.transferredBytes, 0);
        const remainingSeconds = speedBytesPerSecond > 0 && download.totalBytes
            ? Math.ceil(remainingBytes / speedBytesPerSecond)
            : null;

        return {
            operationId: download.operationId,
            stage: 'downloading',
            percent: download.totalBytes > 0
                ? Math.min(99, Math.round((download.transferredBytes / download.totalBytes) * 100))
                : 0,
            transferredBytes: download.transferredBytes,
            totalBytes: download.totalBytes,
            speedBytesPerSecond,
            remainingSeconds
        };
    }

    function cleanupTemp(download) {
        try {
            if (download.tempPath && fs.existsSync(download.tempPath)) {
                fs.rmSync(download.tempPath, { force: true });
            }
        } catch (error) {
            console.warn('Unable to remove partial download:', error.message);
        }
    }

    async function download({
        operationId,
        url,
        destinationPath,
        headers = {},
        timeout = 120000,
        onProgress = () => {}
    }) {
        operationId = String(operationId || '').trim();
        if (!operationId) {
            return { success: false, code: 'invalid_operation' };
        }
        if (activeDownloads.has(operationId)) {
            return { success: false, code: 'busy' };
        }

        const controller = new AbortController();
        const tempPath = `${destinationPath}.part`;
        const downloadState = {
            operationId,
            controller,
            tempPath,
            destinationPath,
            transferredBytes: 0,
            totalBytes: 0,
            startedAt: Date.now(),
            cancelled: false
        };
        activeDownloads.set(operationId, downloadState);

        try {
            fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
            cleanupTemp(downloadState);

            const response = await axios.get(url, {
                responseType: 'stream',
                timeout,
                httpsAgent,
                headers,
                signal: controller.signal,
                maxRedirects: 5
            });

            downloadState.totalBytes = Number(response.headers?.['content-length']) || 0;
            onProgress(serializeProgress(downloadState));

            const writer = fs.createWriteStream(tempPath);
            const stream = response.data;

            await new Promise((resolve, reject) => {
                const handleError = error => reject(error);
                const handleData = chunk => {
                    downloadState.transferredBytes += chunk.length;
                    onProgress(serializeProgress(downloadState));
                };

                stream.on('data', handleData);
                stream.on('error', handleError);
                writer.on('error', handleError);
                writer.on('finish', resolve);
                stream.pipe(writer);
            });

            if (downloadState.cancelled) {
                cleanupTemp(downloadState);
                return { success: false, code: 'cancelled' };
            }

            if (fs.existsSync(destinationPath)) {
                fs.rmSync(destinationPath, { force: true });
            }
            fs.renameSync(tempPath, destinationPath);

            return {
                success: true,
                filePath: destinationPath,
                bytesWritten: downloadState.transferredBytes
            };
        } catch (error) {
            cleanupTemp(downloadState);
            if (downloadState.cancelled || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                return { success: false, code: 'cancelled' };
            }
            const status = Number(error?.response?.status) || null;
            return {
                success: false,
                code: status === 401
                    ? 'auth_required'
                    : status === 426
                        ? 'launcher_update_required'
                        : 'download_failed',
                status,
                message: error.message
            };
        } finally {
            activeDownloads.delete(operationId);
        }
    }

    function cancel(operationId) {
        const download = activeDownloads.get(String(operationId || '').trim());
        if (!download) return { success: false, code: 'not_found' };
        download.cancelled = true;
        download.controller.abort();
        cleanupTemp(download);
        return { success: true };
    }

    function isActive(operationId) {
        return activeDownloads.has(String(operationId || '').trim());
    }

    return { cancel, download, isActive };
}

module.exports = { createDownloadManager };
