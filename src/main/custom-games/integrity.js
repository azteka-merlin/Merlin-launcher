const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { safeEntryPath } = require('./safe-zip');

const MAX_FILES = 100000;
const MAX_BYTES = 200 * 1024 ** 3;
const MAX_ISSUES = 100;

function normalizeIntegrityManifest(value, gameId, archiveKey, root) {
    if (value?.version !== 1 || value.gameId !== gameId || value.archiveKey !== archiveKey ||
        !Array.isArray(value.files) || value.files.length < 1 || value.files.length > MAX_FILES ||
        !Number.isSafeInteger(value.totalSizeBytes) || value.totalSizeBytes < 0 || value.totalSizeBytes > MAX_BYTES) {
        throw new Error('invalid_integrity_manifest');
    }
    let total = 0;
    const seen = new Set();
    const files = value.files.map(file => {
        if (!file || typeof file.path !== 'string' || file.path.length > 32767 ||
            !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0 || file.sizeBytes > MAX_BYTES ||
            typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(file.sha256)) throw new Error('invalid_integrity_manifest');
        let target;
        try { target = safeEntryPath(root, file.path); }
        catch { throw new Error('invalid_integrity_manifest'); }
        const relative = path.relative(root, target).toLowerCase();
        if (seen.has(relative)) throw new Error('invalid_integrity_manifest');
        seen.add(relative);
        total += file.sizeBytes;
        let zip;
        if (file.zip != null) {
            if (![0, 8, 9].includes(file.zip.method) || !Number.isSafeInteger(file.zip.compressedSize) ||
                file.zip.compressedSize < 0 || file.zip.compressedSize > 100 * 1024 ** 3) throw new Error('invalid_integrity_manifest');
            zip = { method: file.zip.method, compressedSize: file.zip.compressedSize };
        }
        return { path: file.path, sizeBytes: file.sizeBytes, sha256: file.sha256.toLowerCase(), ...(zip ? { zip } : {}) };
    });
    if (total !== value.totalSizeBytes) throw new Error('invalid_integrity_manifest');
    for (const relative of seen) {
        const parts = relative.split(path.sep);
        for (let index = 1; index < parts.length; index++) {
            if (seen.has(parts.slice(0, index).join(path.sep))) throw new Error('invalid_integrity_manifest');
        }
    }
    return { version: 1, gameId, archiveKey, totalSizeBytes: total, files };
}

async function verifyInstalledFiles(root, manifest, onProgress = () => {}, signal = null, onIssue = () => {}) {
    const result = { healthy: true, totalFiles: manifest.files.length, checkedFiles: 0,
        totalBytes: manifest.totalSizeBytes, bytes: 0, missingFiles: 0, corruptFiles: 0, unreadableFiles: 0, issues: [] };
    const cancelled = () => { if (signal?.aborted) throw new Error('cancelled'); };
    const reportIssue = (file, reason) => {
        result.healthy = false;
        result[reason === 'missing' ? 'missingFiles' : reason === 'changed' ? 'corruptFiles' : 'unreadableFiles']++;
        if (result.issues.length < MAX_ISSUES) result.issues.push({ path: file.path, reason });
        onIssue(file.path);
    };
    const report = fileBytes => onProgress({ ...result, issues: undefined, bytes: result.bytes + fileBytes });
    const rootReal = await fs.promises.realpath(root);
    if (rootReal.toLowerCase() !== path.resolve(root).toLowerCase()) throw new Error('unsafe_install_path');
    for (const file of manifest.files) {
        cancelled();
        const target = safeEntryPath(root, file.path);
        try {
            const stat = await fs.promises.lstat(target);
            const real = await fs.promises.realpath(target);
            if (!stat.isFile() || stat.isSymbolicLink() || real.toLowerCase() !== target.toLowerCase()) {
                reportIssue(file, 'unreadable');
            } else if (stat.size !== file.sizeBytes) {
                reportIssue(file, 'changed');
            } else {
                const hash = createHash('sha256');
                let bytes = 0;
                const stream = fs.createReadStream(target, { highWaterMark: 4 * 1024 * 1024, signal });
                for await (const chunk of stream) {
                    cancelled();
                    hash.update(chunk);
                    bytes += chunk.length;
                    report(Math.min(file.sizeBytes, bytes));
                }
                if (bytes !== file.sizeBytes || hash.digest('hex') !== file.sha256) reportIssue(file, 'changed');
            }
        } catch (error) {
            cancelled();
            reportIssue(file, error.code === 'ENOENT' ? 'missing' : 'unreadable');
        }
        result.bytes += file.sizeBytes;
        result.checkedFiles++;
        report(0);
    }
    cancelled();
    return result;
}

module.exports = { normalizeIntegrityManifest, verifyInstalledFiles };
