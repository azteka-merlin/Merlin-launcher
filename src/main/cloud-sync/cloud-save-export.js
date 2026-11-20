const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const execFileAsync = promisify(execFile);
const MAX_PARALLEL_DOWNLOADS = 4;

function safeCloudPath(name) {
    if (typeof name !== 'string' || !name || name.length > 2048 || name.includes('\\')
        || name.startsWith('/') || path.posix.normalize(name) !== name
        || name.split('/').some(part => !part || part === '.' || part === '..'
            || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part)
            || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) return false;
    return true;
}

function validateManifest(manifest, appId) {
    if (manifest?.success !== true || manifest.format !== 2 || String(manifest.appId) !== String(appId)
        || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 10000) {
        throw Object.assign(new Error('Invalid save export'), { code: 'cloud_export_invalid' });
    }
    const names = new Set();
    for (const file of manifest.files) {
        if (!safeCloudPath(file.name) || !/^[a-f0-9]{40}$/.test(file.sha)
            || !Number.isSafeInteger(file.size) || file.size < 0
            || names.has(file.name.toLowerCase())) {
            throw Object.assign(new Error('Invalid save file'), { code: 'cloud_export_invalid' });
        }
        names.add(file.name.toLowerCase());
    }
    return manifest.files;
}

async function zipDirectory(source, destination) {
    const binary = require('7zip-bin').path7za;
    // Electron resolves an executable inside app.asar for execFile.
    try {
        await execFileAsync(binary, ['a', '-tzip', '-mx=5', '-bd', '-bso0', destination, '.'], {
            cwd: source, windowsHide: true
        });
    } catch (error) {
        throw Object.assign(new Error('Could not create the save archive', { cause: error }), {
            code: 'cloud_export_zip_failed'
        });
    }
}

async function downloadFiles(files, download) {
    let next = 0;
    const controller = new AbortController();
    const { signal } = controller;
    const workers = Array.from({ length: Math.min(files.length, MAX_PARALLEL_DOWNLOADS) }, async () => {
        try {
            while (!signal.aborted && next < files.length) {
                const file = files[next++];
                await download(file, signal);
            }
        } catch (error) {
            controller.abort(error);
        }
    });
    // Wait for every stream to close before deleting the temporary folder.
    await Promise.all(workers);
    signal.throwIfAborted();
}

async function exportCloudSave({ accountId, appId, versionId, destination, getManifest, getFile }) {
    const manifest = await getManifest(accountId, appId, versionId);
    const files = validateManifest(manifest, appId);
    const temporary = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'merlin-save-export-'));
    try {
        const contents = path.join(temporary, 'contents');
        await fs.promises.mkdir(contents);
        await downloadFiles(files, async (file, signal) => {
            const target = path.join(contents, 'Arquivos', ...file.name.split('/'));
            await fs.promises.mkdir(path.dirname(target), { recursive: true });
            signal.throwIfAborted();
            const input = await getFile(accountId, appId, versionId, file.name, { signal });
            const hash = crypto.createHash('sha1');
            let bytes = 0;
            const inspect = new Transform({ transform(chunk, _encoding, callback) {
                bytes += chunk.length;
                hash.update(chunk);
                callback(null, chunk);
            } });
            await pipeline(input, inspect, fs.createWriteStream(target, { flags: 'wx' }), { signal });
            if (bytes !== file.size || hash.digest('hex') !== file.sha) {
                throw Object.assign(new Error('Save file integrity failed'), { code: 'cloud_export_integrity' });
            }
        });
        await fs.promises.writeFile(path.join(contents, 'merlin-save.json'), JSON.stringify({
            format: 'merlin-cloud-save-v2', appId: String(appId), createdAt: manifest.createdAt,
            files: files.map(file => ({ path: file.name, sha1: file.sha, size: file.size }))
        }, null, 2), 'utf8');
        const archive = path.join(temporary, 'save.zip');
        await zipDirectory(contents, archive);
        await fs.promises.copyFile(archive, destination);
        return { success: true, filePath: destination, fileCount: files.length };
    } finally {
        await fs.promises.rm(temporary, { recursive: true, force: true });
    }
}

module.exports = { exportCloudSave, safeCloudPath, validateManifest };
