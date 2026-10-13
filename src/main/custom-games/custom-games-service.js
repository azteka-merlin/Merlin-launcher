const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { extractSafeZip, safeEntryPath } = require('./safe-zip');

const CHUNK_SIZE = 64 * 1024 * 1024;
const FOLDER_CHUNK_SIZE = 256 * 1024 * 1024;
const MAX_FOLDER_MANIFEST_FILES = 100000;
const MAX_FOLDER_BUNDLES = 2500;
const MAX_BUNDLE_MEMBER_SIZE = 200 * 1024 * 1024;
const DOWNLOAD_WORKERS = 4;
const SMALL_FILE_WORKERS = 12;
const SMALL_FILE_LIMIT = 64 * 1024 * 1024;
const RATE_WINDOW_MS = 30_000;
const DOWNLOAD_IDLE_TIMEOUT_MS = 45_000;
const INSTALL_SAFETY_BYTES = 512 * 1024 * 1024;
const MARKER = '.merlin-install.json';

function validFolderManifestFileCount(files) {
    return Array.isArray(files) && files.length > 0 && files.length <= MAX_FOLDER_MANIFEST_FILES;
}

function requiredFreeBytes(archiveSize, partialSize = 0, packageType = 'zip') {
    const size = Number(archiveSize);
    if (packageType === 'folder') return Math.max(0, size - Number(partialSize)) + INSTALL_SAFETY_BYTES;
    return Math.max(0, size - Number(partialSize)) + size + INSTALL_SAFETY_BYTES;
}

function moveWithWindowsShellToRecycleBin(targetPath) {
    const encodedPath = Buffer.from(targetPath, 'utf8').toString('base64');
    const command = [
        "$ErrorActionPreference = 'Stop'",
        `$target = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))`,
        "if (-not (Test-Path -LiteralPath $target)) { throw 'Install folder no longer exists' }",
        '$shell = New-Object -ComObject Shell.Application',
        '$recycleBin = $shell.Namespace(10)',
        "if (-not $recycleBin) { throw 'Windows Recycle Bin is unavailable' }",
        '$recycleBin.MoveHere($target, 0x14)',
        '$deadline = [DateTime]::UtcNow.AddSeconds(90)',
        'while ((Test-Path -LiteralPath $target) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200 }',
        "if (Test-Path -LiteralPath $target) { throw 'Windows did not move the install folder to the Recycle Bin' }",
    ].join('; ');

    return new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-Command', command], {
            windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        const append = chunk => { if (output.length < 8192) output += chunk.toString(); };
        child.stdout.on('data', append);
        child.stderr.on('data', append);
        child.once('error', reject);
        child.once('close', code => {
            if (code === 0 && !fs.existsSync(targetPath)) return resolve();
            reject(new Error(output.trim() || `Windows Recycle Bin fallback failed (${code ?? 'unknown exit'})`));
        });
    });
}

function createCustomGamesService({ app, axios, authSession, apiBaseUrl, shell, testDriveRoot = null,
    windowsRecycleBinMove = moveWithWindowsShellToRecycleBin, downloadIdleTimeoutMs = DOWNLOAD_IDLE_TIMEOUT_MS }) {
    const dataRoot = app.getPath('userData');
    const source = new URL(apiBaseUrl).hostname.replace(/[^a-z0-9.-]/gi, '_');
    const registryFile = path.join(dataRoot, `custom-games-installs-${source}.json`);
    const cacheFile = path.join(dataRoot, `custom-games-catalog-${source}.json`);
    let active = null;
    const progressListeners = new Set();
    let catalog = loadJson(cacheFile, []);
    let registry = loadJson(registryFile, {});

    function loadJson(file, fallback) {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch { return fallback; }
    }

    async function sha256File(filePath, onProgress = () => {}, signal = null) {
        const hash = createHash('sha256');
        let bytesRead = 0;
        for await (const chunk of fs.createReadStream(filePath, { highWaterMark: 8 * 1024 * 1024 })) {
            if (signal?.aborted) throw new Error('cancelled');
            hash.update(chunk);
            bytesRead += chunk.length;
            onProgress(bytesRead);
        }
        return hash.digest('hex');
    }

    async function saveJson(file, value) {
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        const temp = `${file}.${process.pid}.tmp`;
        await fs.promises.writeFile(temp, JSON.stringify(value), 'utf8');
        await fs.promises.rename(temp, file);
    }

    function driveRoot(letter) {
        if (!/^[C-Z]$/i.test(String(letter || ''))) throw new Error('invalid_drive');
        if (testDriveRoot) return testDriveRoot(letter.toUpperCase());
        const root = `${letter.toUpperCase()}:\\`;
        if (!fs.existsSync(root)) throw new Error('drive_unavailable');
        return root;
    }

    function assertRealDirectory(directory) {
        const actual = fs.realpathSync.native(directory);
        if (actual.toLowerCase() !== path.resolve(directory).toLowerCase()) throw new Error('unsafe_install_path');
    }

    function listDrives(gameId = null) {
        const item = gameId ? catalog.find(game => game.id === gameId) : null;
        const describe = (letter, root) => {
            const stats = fs.statfsSync(root);
            const partial = item && path.join(root, 'Merlin-games', '.merlin-downloads', `${item.id}.zip.part`);
            let partialSize = 0;
            if (partial) {
                try { const file = fs.statSync(partial); if (file.isFile()) partialSize = file.size; }
                catch { /* This game has no partial download on this drive. */ }
            }
            return {
                letter, path: path.join(root, 'Merlin-games'),
                freeBytes: Number(stats.bavail) * Number(stats.bsize),
                requiredFreeBytes: item ? requiredFreeBytes(item.archiveSize, partialSize, item.packageType) : null,
            };
        };
        if (testDriveRoot) return [describe('X', testDriveRoot('X'))];
        if (process.platform !== 'win32') return [];
        const drives = [];
        for (let code = 67; code <= 90; code++) {
            const letter = String.fromCharCode(code);
            try { if (fs.statSync(`${letter}:\\`).isDirectory()) drives.push(describe(letter, `${letter}:\\`)); }
            catch { /* Drive absent or inaccessible. */ }
        }
        return drives;
    }

    function installPath(letter, installName) {
        const root = path.join(driveRoot(letter), 'Merlin-games');
        if (!installName || installName === '.' || installName === '..' ||
            /[<>:"/\\|?*\x00-\x1f]/.test(installName) || /[. ]$/.test(installName)) throw new Error('invalid_install_name');
        const target = path.resolve(root, installName);
        if (path.dirname(target).toLowerCase() !== path.resolve(root).toLowerCase()) throw new Error('invalid_install_path');
        return target;
    }

    function markerFor(item, letter) {
        const target = installPath(letter, item.installName);
        try {
            const root = fs.realpathSync.native(target);
            if (root.toLowerCase() !== target.toLowerCase()) return null;
            const marker = loadJson(path.join(target, MARKER), null);
            return marker?.id === item.id ? { path: target, marker } : null;
        } catch { return null; }
    }

    function installed(item, drives = listDrives()) {
        const record = registry[item.id];
        if (record) {
            const match = markerFor({ ...item, installName: record.installName }, record.drive);
            if (match) return { drive: record.drive, path: match.path };
        }
        for (const { letter } of drives) {
            const match = markerFor(item, letter);
            if (match) {
                registry[item.id] = { drive: letter, installName: item.installName, name: item.name,
                    executablePath: match.marker.executablePath || null };
                void saveJson(registryFile, registry);
                return { drive: letter, path: match.path };
            }
        }
        return null;
    }

    async function refresh() {
        const token = await authSession.getAccessToken();
        const response = await axios.get(`${apiBaseUrl}/custom-games`, {
            headers: { Authorization: `Bearer ${token}` }, timeout: 30000,
        });
        if (!Array.isArray(response.data?.games)) throw new Error('catalog_unavailable');
        catalog = response.data.games.map(game => ({
            ...game,
            imageUrl: game.imageUrl ? new URL(game.imageUrl, apiBaseUrl).href : null,
        }));
        await saveJson(cacheFile, catalog);
        return listCached(false);
    }

    function listCached(offline) {
        const drives = listDrives();
        const merged = [...catalog];
        for (const [id, record] of Object.entries(registry)) {
            if (!merged.some(item => item.id === id)) merged.push({
                id, name: record.name || record.installName, installName: record.installName,
                executablePath: record.executablePath || null, imageUrl: null, archiveSize: 0,
            });
        }
        return { success: true, games: merged.map(item => {
            const found = installed(item, drives);
            return { ...item, installed: found,
                requiredFreeBytes: requiredFreeBytes(item.archiveSize, 0, item.packageType),
                // Admin metadata can be updated after a game was installed. Prefer the catalog value
                // so an old local registry entry (including null) cannot hide the Play action.
                executablePath: item.executablePath || (found ? registry[item.id]?.executablePath : null) || null };
        }),
            drives, offline, operation: active ? { ...active.snapshot } : null };
    }

    async function list() {
        try { return await refresh(); }
        catch (error) {
            if (!catalog.length && !Object.keys(registry).length) return { success: false, code: 'catalog_unavailable' };
            return listCached(true);
        }
    }

    function emit(operation, onProgress, stage, extra = {}, force = false) {
        operation.stage = stage;
        const now = Date.now();
        const progressValue = stage === 'downloading' ? Number(extra.received) : Number(extra.bytes);
        const progressTotal = stage === 'downloading' ? Number(extra.total) : Number(extra.totalBytes);
        const terminal = ['completed', 'failed', 'cancelled'].includes(stage);
        const stageChanged = stage !== operation.rateStage;
        operation.rateStage = stage;
        operation.rateStats ||= Object.create(null);
        const rate = operation.rateStats[stage] ||= { samples: [], last: null };

        // Extraction can report once per decompressed stream chunk. Keep the same
        // bounded IPC cadence for every stage and do rate math only when publishing.
        const shouldPublish = force || terminal || stageChanged || now - (operation.lastEmit || 0) >= 400;
        if (shouldPublish && Number.isFinite(progressValue) && Number.isFinite(progressTotal)) {
            const previous = rate.last;
            if (previous && (now - previous.at > RATE_WINDOW_MS || progressValue < previous.value)) {
                rate.samples = [];
            } else if (previous && now > previous.at) {
                rate.samples.push({ from: previous.at, at: now, bytes: progressValue - previous.value });
            }
            rate.samples = rate.samples.filter(sample => now - sample.at <= RATE_WINDOW_MS);
            rate.last = { at: now, value: progressValue };
        }
        let speedBytesPerSecond = operation.snapshot?.speedBytesPerSecond || 0;
        let etaSeconds = operation.snapshot?.etaSeconds ?? null;
        if (shouldPublish) {
            const sampleBytes = rate.samples.reduce((sum, sample) => sum + sample.bytes, 0);
            const firstSampleAt = rate.samples[0]?.from;
            const elapsedMs = firstSampleAt == null ? 0 : Math.max(0, now - firstSampleAt);
            speedBytesPerSecond = elapsedMs > 0 ? sampleBytes * 1000 / elapsedMs : 0;
            etaSeconds = elapsedMs >= 8_000 && speedBytesPerSecond > 0 && Number.isFinite(progressValue) && Number.isFinite(progressTotal)
                ? Math.max(0, Math.ceil((progressTotal - progressValue) / speedBytesPerSecond)) : null;
        }
        operation.snapshot = {
            id: operation.item.id, name: operation.item.name, drive: operation.drive,
            stage, ...extra, speedBytesPerSecond, etaSeconds,
            retryAttempt: operation.retrying?.size ? Math.max(...operation.retrying.values()) : null,
            maxAttempts: 4,
        };
        if (!shouldPublish) return;
        operation.lastEmit = now;
        try { onProgress(operation.snapshot); } catch { /* UI may be reloading while the install continues. */ }
        for (const listener of progressListeners) {
            try { listener(operation.snapshot); } catch { /* One disconnected window must not interrupt the install. */ }
        }
    }

    function subscribeProgress(listener) {
        progressListeners.add(listener);
        return () => progressListeners.delete(listener);
    }

    async function cleanupTemporaryFiles(gamesRoot) {
        const rootStat = await fs.promises.lstat(gamesRoot).catch(() => null);
        if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) return;
        const realRoot = await fs.promises.realpath(gamesRoot).catch(() => null);
        if (!realRoot || realRoot.toLowerCase() !== path.resolve(gamesRoot).toLowerCase()) return;
        const downloads = path.join(gamesRoot, '.merlin-downloads');
        try {
            const stat = await fs.promises.lstat(downloads);
            if (!stat.isDirectory() || stat.isSymbolicLink()) return;
            const names = await fs.promises.readdir(downloads);
            for (const name of names) {
                const match = /^([a-z0-9-]{8,80})\.zip\.part$/i.exec(name);
                if (match) {
                    const partial = path.join(downloads, name);
                    const partialStat = await fs.promises.lstat(partial).catch(() => null);
                    if (partialStat?.isFile() && !partialStat.isSymbolicLink()) await fs.promises.unlink(partial).catch(() => {});
                }
                const stateMatch = /^([a-z0-9-]{8,80})(?:\.folder)?\.json$/i.exec(name);
                const id = match?.[1] || stateMatch?.[1];
                if (!id) continue;
                const stateFile = path.join(downloads, `${id}.json`);
                const stateStat = await fs.promises.lstat(stateFile).catch(() => null);
                const partialPath = path.join(downloads, `${id}.zip.part`);
                const remainingPartial = await fs.promises.lstat(partialPath).catch(() => null);
                if (!remainingPartial && stateStat?.isFile() && !stateStat.isSymbolicLink()) {
                    await fs.promises.unlink(stateFile).catch(() => {});
                } else if (match && stateStat?.isFile() && !stateStat.isSymbolicLink()) {
                    await fs.promises.unlink(stateFile).catch(() => {});
                }
            }
            if (!(await fs.promises.readdir(downloads)).length) await fs.promises.rmdir(downloads).catch(() => {});
        } catch { /* Drive absent or no Merlin download folder. */ }
    }

    async function cleanupStaleInstallStages(gamesRoot) {
        try {
            const rootStat = await fs.promises.lstat(gamesRoot);
            if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return;
            for (const name of await fs.promises.readdir(gamesRoot)) {
                if (!/^\.merlin-installing-[a-z0-9-]{8,80}(?:-[a-f0-9-]{36})?$/i.test(name)) continue;
                const staging = path.join(gamesRoot, name);
                const stat = await fs.promises.lstat(staging).catch(() => null);
                if (stat?.isDirectory() && !stat.isSymbolicLink() && path.dirname(path.resolve(staging)) === path.resolve(gamesRoot)) {
                    await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => {});
                }
            }
        } catch { /* Drive absent or inaccessible. */ }
    }

    async function cleanupAllTemporaryFiles() {
        const letters = testDriveRoot ? ['X'] : process.platform === 'win32'
            ? Array.from({ length: 24 }, (_, index) => String.fromCharCode(67 + index)) : [];
        await Promise.all(letters.map(async letter => {
            let gamesRoot;
            try {
                gamesRoot = path.join(driveRoot(letter), 'Merlin-games');
                await cleanupTemporaryFiles(gamesRoot);
                await cleanupStaleInstallStages(gamesRoot);
            } catch { /* Only clean reachable drives. */ }
        }));
    }

    async function download(item, letter, operation, onProgress) {
        const gamesRoot = path.join(driveRoot(letter), 'Merlin-games');
        const downloads = path.join(gamesRoot, '.merlin-downloads');
        await fs.promises.mkdir(gamesRoot, { recursive: true });
        assertRealDirectory(gamesRoot);
        await fs.promises.mkdir(downloads, { recursive: true });
        assertRealDirectory(downloads);
        const partial = path.join(downloads, `${item.id}.zip.part`);
        const stateFile = path.join(downloads, `${item.id}.json`);
        operation.files = { partial, stateFile };
        const total = Number(item.archiveSize);
        if (!Number.isSafeInteger(total) || total < 1 || total > 30 * 1024 ** 3) throw new Error('invalid_archive_size');
        const statfs = await fs.promises.statfs(gamesRoot);
        const available = Number(statfs.bavail) * Number(statfs.bsize);
        const partialSize = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
        if (available < Math.max(0, total - partialSize) + total + INSTALL_SAFETY_BYTES) {
            throw new Error('disk_space');
        }
        const count = Math.ceil(total / CHUNK_SIZE);
        let state = loadJson(stateFile, null);
        if (!state || state.id !== item.id || state.archiveKey !== item.archiveKey || state.size !== total ||
            !Array.isArray(state.completed) || state.completed.length !== count || !fs.existsSync(partial)) {
            state = { id: item.id, archiveKey: item.archiveKey, size: total, completed: Array(count).fill(false) };
            await saveJson(stateFile, state);
        }
        if (fs.existsSync(partial) && !fs.lstatSync(partial).isFile()) throw new Error('unsafe_install_path');
        const handle = await fs.promises.open(partial, fs.existsSync(partial) ? 'r+' : 'w+');
        await handle.truncate(total);
        const progress = state.completed.map((done, index) => done ? Math.min(CHUNK_SIZE, total - index * CHUNK_SIZE) : 0);
        let next = 0;
        let writeState = Promise.resolve();
        const report = (force = false) => emit(operation, onProgress, 'downloading', {
            received: progress.reduce((sum, bytes) => sum + bytes, 0), total,
        }, force);
        report();
        const downloadChunk = async index => {
            const start = index * CHUNK_SIZE;
            const end = Math.min(total - 1, start + CHUNK_SIZE - 1);
            for (let attempt = 0; attempt < 4; attempt++) {
                if (operation.controller.signal.aborted) throw new Error('cancelled');
                try {
                    const token = await authSession.getAccessToken();
                    const response = await axios.get(`${apiBaseUrl}/custom-games/${item.id}/archive`, {
                        responseType: 'stream', decompress: false, timeout: 600000,
                        signal: operation.controller.signal,
                        headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` },
                    });
                    if (response.status !== 206 || response.headers['content-range'] !== `bytes ${start}-${end}/${total}`) {
                        response.data.destroy();
                        throw new Error('invalid_range_response');
                    }
                    let position = start;
                    for await (const chunk of response.data) {
                        if (operation.controller.signal.aborted) throw new Error('cancelled');
                        if (position + chunk.length > end + 1) throw new Error('invalid_range_response');
                        let offset = 0;
                        while (offset < chunk.length) {
                            const result = await handle.write(chunk, offset, chunk.length - offset, position + offset);
                            if (!result.bytesWritten) throw new Error('disk_write_failed');
                            offset += result.bytesWritten;
                        }
                        position += chunk.length;
                        progress[index] = position - start;
                        report();
                    }
                    if (position !== end + 1) throw new Error('incomplete_range');
                    state.completed[index] = true;
                    writeState = writeState.then(() => saveJson(stateFile, state));
                    await writeState;
                    return;
                } catch (error) {
                    progress[index] = 0;
                    report();
                    if (operation.controller.signal.aborted) throw new Error('cancelled');
                    if (attempt === 3) throw error;
                    await new Promise(resolve => setTimeout(resolve, 900 * (attempt + 1)));
                }
            }
        };
        try {
            const worker = async () => {
                while (next < count) {
                    const index = next++;
                    if (!state.completed[index]) {
                        try { await downloadChunk(index); }
                        catch (error) { operation.controller.abort(); throw error; }
                    }
                }
            };
            const results = await Promise.allSettled(Array.from({ length: Math.min(DOWNLOAD_WORKERS, count) }, worker));
            const failure = results.find(result => result.status === 'rejected');
            if (failure) throw failure.reason;
            await handle.sync();
            report(true);
            return { partial, stateFile, gamesRoot };
        } finally { await handle.close(); }
    }

    async function downloadFolder(item, letter, operation, staging, onProgress) {
        const gamesRoot = path.join(driveRoot(letter), 'Merlin-games');
        const downloads = path.join(gamesRoot, '.merlin-downloads');
        const stateFile = path.join(downloads, `${item.id}.folder.json`);
        operation.files = { staging, stateFile, gamesRoot, folder: true };
        const manifestUrl = `${apiBaseUrl}/custom-games/${item.id}/manifest`;
        await fs.promises.mkdir(gamesRoot, { recursive: true });
        assertRealDirectory(gamesRoot);
        await fs.promises.mkdir(downloads, { recursive: true });
        assertRealDirectory(downloads);
        const token = await authSession.getAccessToken();
        const response = await axios.get(manifestUrl, {
            headers: { Authorization: `Bearer ${token}` }, timeout: 60000,
            signal: operation.controller.signal,
        });
        const manifest = response.data;
        const files = manifest?.files;
        const bundles = manifest?.bundles || [];
        const total = Number(manifest?.totalSizeBytes);
        const finalFileCount = (Array.isArray(files) ? files.length : 0) +
            (Array.isArray(bundles) ? bundles.reduce((sum, bundle) => sum + (Array.isArray(bundle.files) ? bundle.files.length : 0), 0) : 0);
        if (manifest?.gameId !== item.id || !Array.isArray(files) || !Array.isArray(bundles) ||
            finalFileCount < 1 || finalFileCount > 20000 || bundles.length > MAX_FOLDER_BUNDLES ||
            !Number.isSafeInteger(total) || total < 1 || total > 200 * 1024 ** 3 || total !== Number(item.archiveSize)) {
            throw new Error('invalid_folder_manifest');
        }

        let declared = 0;
        const seen = new Set();
        const normalizedFiles = files.map(file => {
            if (!/^[a-f0-9-]{36}$/i.test(String(file.id || '')) || !Number.isSafeInteger(file.sizeBytes) ||
                file.sizeBytes < 0 || file.sizeBytes > 30 * 1024 ** 3 || typeof file.path !== 'string' ||
                (file.sha256 != null && !/^[a-f0-9]{64}$/i.test(String(file.sha256)))) {
                throw new Error('invalid_folder_manifest');
            }
            if (file.sizeBytes === 0 && String(file.sha256).toLowerCase() !==
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') {
                throw new Error('invalid_folder_manifest');
            }
            const target = safeEntryPath(staging, file.path);
            const relative = path.relative(staging, target).toLocaleLowerCase();
            if (seen.has(relative)) throw new Error('invalid_folder_manifest');
            seen.add(relative);
            declared += file.sizeBytes;
            return { id: file.id, path: file.path, sizeBytes: file.sizeBytes, etag: file.etag || null,
                sha256: file.sha256 ? String(file.sha256).toLowerCase() : null,
                target, count: Math.ceil(file.sizeBytes / FOLDER_CHUNK_SIZE) };
        });
        const normalizedBundles = bundles.map(bundle => {
            if (!/^[a-f0-9-]{36}$/i.test(String(bundle.id || '')) ||
                !Number.isSafeInteger(bundle.sizeBytes) || bundle.sizeBytes < 1 || bundle.sizeBytes > 1024 ** 3 ||
                !/^[a-f0-9]{64}$/i.test(String(bundle.sha256 || '')) ||
                !Array.isArray(bundle.files) || bundle.files.length < 1 || bundle.files.length > 3000 ||
                normalizedFiles.some(file => file.id.toLowerCase() === bundle.id.toLowerCase())) {
                throw new Error('invalid_folder_manifest');
            }
            const members = bundle.files.map(member => {
                if (!Number.isSafeInteger(member.sizeBytes) || member.sizeBytes < 0 || member.sizeBytes > MAX_BUNDLE_MEMBER_SIZE ||
                    typeof member.path !== 'string' || !/^[a-f0-9]{64}$/i.test(String(member.sha256 || ''))) {
                    throw new Error('invalid_folder_manifest');
                }
                const target = safeEntryPath(staging, member.path);
                const relative = path.relative(staging, target).toLocaleLowerCase();
                if (seen.has(relative)) throw new Error('invalid_folder_manifest');
                seen.add(relative);
                declared += member.sizeBytes;
                return { path: member.path, target, sizeBytes: member.sizeBytes,
                    sha256: String(member.sha256).toLowerCase() };
            });
            const virtualPath = `.merlin-bundle-${bundle.id}.zip`;
            if (seen.has(virtualPath.toLowerCase())) throw new Error('invalid_folder_manifest');
            seen.add(virtualPath.toLowerCase());
            return { id: bundle.id, path: virtualPath, sizeBytes: bundle.sizeBytes,
                etag: bundle.etag || null, sha256: String(bundle.sha256).toLowerCase(),
                target: safeEntryPath(staging, virtualPath), members,
                count: Math.ceil(bundle.sizeBytes / FOLDER_CHUNK_SIZE) };
        });
        const bundleIds = new Set(normalizedBundles.map(bundle => bundle.id.toLowerCase()));
        if (bundleIds.size !== normalizedBundles.length ||
            normalizedBundles.some(bundle => normalizedFiles.some(file => file.id.toLowerCase() === bundle.id.toLowerCase()))) {
            throw new Error('invalid_folder_manifest');
        }
        normalizedFiles.push(...normalizedBundles);
        if (declared !== total) throw new Error('invalid_folder_manifest');
        for (const relative of seen) {
            const parts = relative.split(path.sep);
            for (let index = 1; index < parts.length; index++) {
                if (seen.has(parts.slice(0, index).join(path.sep))) throw new Error('invalid_folder_manifest');
            }
        }

        const gamesRootPath = path.join(gamesRoot, item.installName);
        const existingState = loadJson(stateFile, null);
        let state = existingState;
        const stateMatches = state?.id === item.id && state.packageKey === item.archiveKey &&
            state.totalBytes === total && Array.isArray(state.files) && state.files.length === normalizedFiles.length &&
            normalizedFiles.every((file, index) => {
                const saved = state.files[index];
                return saved?.id === file.id && saved.path === file.path && saved.sizeBytes === file.sizeBytes &&
                    (saved.etag || null) === file.etag && (saved.sha256 || null) === file.sha256;
            });
        if (!stateMatches) {
            const stageStat = await fs.promises.lstat(staging).catch(() => null);
            if (stageStat) {
                if (!stageStat.isDirectory() || stageStat.isSymbolicLink()) throw new Error('unsafe_install_path');
                if (path.dirname(path.resolve(staging)) !== path.resolve(gamesRoot)) throw new Error('unsafe_install_path');
                await fs.promises.rm(staging, { recursive: true, force: true });
            }
            await fs.promises.mkdir(staging, { recursive: false });
            assertRealDirectory(staging);
            state = { id: item.id, packageKey: item.archiveKey, totalBytes: total,
                files: normalizedFiles.map(({ id, path: relativePath, sizeBytes, etag, sha256 }) =>
                    ({ id, path: relativePath, sizeBytes, etag, sha256 })) };
        } else {
            const stageStat = await fs.promises.lstat(staging).catch(() => null);
            if (!stageStat || !stageStat.isDirectory() || stageStat.isSymbolicLink()) {
                state = { id: item.id, packageKey: item.archiveKey, totalBytes: total,
                    files: normalizedFiles.map(({ id, path: relativePath, sizeBytes, etag, sha256 }) =>
                        ({ id, path: relativePath, sizeBytes, etag, sha256 })) };
                await fs.promises.mkdir(staging, { recursive: false });
            }
            assertRealDirectory(staging);
        }

        const localSizes = new Map();
        for (const file of normalizedFiles) {
            const parent = path.dirname(file.target);
            const parentRelative = path.relative(staging, parent);
            let current = staging;
            for (const segment of parentRelative.split(path.sep).filter(Boolean)) {
                current = path.join(current, segment);
                await fs.promises.mkdir(current).catch(error => { if (error.code !== 'EEXIST') throw error; });
                const stat = await fs.promises.lstat(current);
                if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_install_path');
                const real = await fs.promises.realpath(current);
                if (real.toLowerCase() !== current.toLowerCase()) throw new Error('unsafe_install_path');
            }
            const existing = await fs.promises.lstat(file.target).catch(() => null);
            if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error('unsafe_install_path');
            if (!existing && file.sizeBytes === 0) await fs.promises.writeFile(file.target, Buffer.alloc(0), { flag: 'wx' });
            if (existing && existing.size > file.sizeBytes) {
                await fs.promises.rm(file.target, { force: true });
                localSizes.set(file.id, 0);
            } else localSizes.set(file.id, existing?.size || 0);
        }
        let verifiedExistingBytes = 0;
        const resumableFiles = normalizedFiles.filter(file => file.sha256 && localSizes.get(file.id) === file.sizeBytes);
        for (const file of resumableFiles) {
            const verifyTotal = resumableFiles.reduce((sum, entry) => sum + entry.sizeBytes, 0);
            const actualHash = await sha256File(file.target, bytes => emit(operation, onProgress, 'verifying', {
                bytes: verifiedExistingBytes + bytes, totalBytes: verifyTotal,
            }), operation.controller.signal);
            if (actualHash !== file.sha256) {
                await fs.promises.unlink(file.target);
                localSizes.set(file.id, 0);
            } else verifiedExistingBytes += file.sizeBytes;
            emit(operation, onProgress, 'verifying', { bytes: verifiedExistingBytes, totalBytes: verifyTotal });
        }
        const alreadyDownloaded = [...localSizes.values()].reduce((sum, bytes) => sum + bytes, 0);
        const transferTotal = normalizedFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
        const statfs = await fs.promises.statfs(gamesRoot);
        const available = Number(statfs.bavail) * Number(statfs.bsize);
        if (available < total + normalizedBundles.reduce((sum, bundle) => sum + bundle.sizeBytes, 0) -
            alreadyDownloaded + INSTALL_SAFETY_BYTES) throw new Error('disk_space');
        await saveJson(stateFile, state);

        let received = alreadyDownloaded;
        let completedFiles = normalizedFiles.filter(file => localSizes.get(file.id) === file.sizeBytes).length;
        const inFlight = new Map();
        operation.retrying = new Map();
        const report = (force = false) => emit(operation, onProgress, 'downloading', {
            received, total: transferTotal, completedFiles, totalFiles: normalizedFiles.length,
        }, force);
        report();

        const downloadFile = async (file, integrityAttempt = 0) => {
            let offset = localSizes.get(file.id) || 0;
            let output;
            try {
                output = await fs.promises.open(file.target, offset ? 'r+' : 'w+');
                while (offset < file.sizeBytes) {
                    if (operation.controller.signal.aborted) throw new Error('cancelled');
                    const start = offset;
                    const end = Math.min(file.sizeBytes - 1, start + FOLDER_CHUNK_SIZE - 1);
                    let lastError;
                    for (let attempt = 0; attempt < 4; attempt++) {
                        if (operation.controller.signal.aborted) throw new Error('cancelled');
                        let rangeResponse;
                        const requestController = new AbortController();
                        const abortRequest = () => requestController.abort();
                        operation.controller.signal.addEventListener('abort', abortRequest, { once: true });
                        let idleTimer;
                        let stalled = false;
                        const armIdleTimer = () => {
                            clearTimeout(idleTimer);
                            idleTimer = setTimeout(() => {
                                stalled = true;
                                requestController.abort();
                                rangeResponse?.data?.destroy(new Error('download_stalled'));
                            }, downloadIdleTimeoutMs);
                            idleTimer.unref?.();
                        };
                        try {
                            const accessToken = await authSession.getAccessToken();
                            armIdleTimer();
                            rangeResponse = await axios.get(`${apiBaseUrl}/custom-games/${item.id}/files/${file.id}`, {
                                responseType: 'stream', decompress: false, timeout: 600000,
                                signal: requestController.signal,
                                headers: { Authorization: `Bearer ${accessToken}`, Range: `bytes=${start}-${end}` },
                            });
                            if (rangeResponse.status !== 206 || rangeResponse.headers['content-range'] !==
                                `bytes ${start}-${end}/${file.sizeBytes}` ||
                                (file.etag && String(rangeResponse.headers.etag || '').replace(/^"|"$/g, '') !== file.etag)) {
                                rangeResponse.data.destroy();
                                throw new Error('invalid_range_response');
                            }
                            let position = start;
                            for await (const chunk of rangeResponse.data) {
                                if (operation.controller.signal.aborted) throw new Error('cancelled');
                                clearTimeout(idleTimer);
                                if (operation.retrying.delete(file.id)) report(true);
                                if (position + chunk.length > end + 1) throw new Error('invalid_range_response');
                                let written = 0;
                                while (written < chunk.length) {
                                    const result = await output.write(chunk, written, chunk.length - written, position + written);
                                    if (!result.bytesWritten) throw new Error('disk_write_failed');
                                    written += result.bytesWritten;
                                }
                                position += chunk.length;
                                inFlight.set(file.id, position - start);
                                emit(operation, onProgress, 'downloading', {
                                    received: received + [...inFlight.values()].reduce((sum, bytes) => sum + bytes, 0),
                                    total: transferTotal, completedFiles, totalFiles: normalizedFiles.length,
                                });
                                armIdleTimer();
                            }
                            clearTimeout(idleTimer);
                            if (position !== end + 1) throw new Error('incomplete_range');
                            offset = end + 1;
                            received += end + 1 - start;
                            inFlight.delete(file.id);
                            operation.retrying.delete(file.id);
                            localSizes.set(file.id, offset);
                            lastError = null;
                            report();
                            break;
                        } catch (error) {
                            lastError = stalled ? new Error('download_stalled') : error;
                            inFlight.delete(file.id);
                            if (operation.controller.signal.aborted) throw new Error('cancelled');
                            if (attempt === 3) break;
                            operation.retrying.set(file.id, attempt + 2);
                            report(true);
                            await new Promise(resolve => setTimeout(resolve, 900 * (attempt + 1)));
                        } finally {
                            clearTimeout(idleTimer);
                            operation.controller.signal.removeEventListener('abort', abortRequest);
                            rangeResponse?.data?.destroy();
                        }
                    }
                    if (lastError) {
                        operation.retrying.delete(file.id);
                        report(true);
                        console.warn('[CustomGames] Download range failed', {
                            gameId: item.id, fileId: file.id, start, end,
                            reason: lastError.message === 'download_stalled' ? 'idle_timeout' : lastError.code || 'stream_error',
                        });
                        const actual = await fs.promises.stat(file.target).then(value => value.size).catch(() => 0);
                        if (actual > offset) {
                            received += actual - offset;
                            offset = actual;
                            localSizes.set(file.id, actual);
                        }
                        throw lastError;
                    }
                }
                await output.sync();
            } finally { await output?.close().catch(() => {}); }
            if (file.sha256) {
                const actualHash = await sha256File(file.target, bytes => emit(operation, onProgress, 'verifying', {
                    bytes, totalBytes: file.sizeBytes,
                }), operation.controller.signal);
                if (actualHash !== file.sha256) {
                    await fs.promises.unlink(file.target).catch(() => {});
                    received = Math.max(0, received - file.sizeBytes);
                    localSizes.set(file.id, 0);
                    if (integrityAttempt >= 1) throw new Error('checksum_mismatch');
                    return downloadFile(file, integrityAttempt + 1);
                }
            }
            completedFiles += 1;
            report();
        };
        const orderedFiles = normalizedFiles.filter(file => localSizes.get(file.id) !== file.sizeBytes)
            .sort((a, b) => b.sizeBytes - a.sizeBytes);
        const runQueue = async (queue, workers) => {
            let next = 0;
            const worker = async () => {
                while (next < queue.length) {
                    const file = queue[next++];
                    try { await downloadFile(file); }
                    catch (error) { operation.controller.abort(); throw error; }
                }
            };
            const results = await Promise.allSettled(Array.from({ length: Math.min(workers, queue.length) }, worker));
            const failure = results.find(result => result.status === 'rejected');
            if (failure) throw failure.reason;
        };
        await runQueue(orderedFiles.filter(file => file.sizeBytes >= SMALL_FILE_LIMIT), DOWNLOAD_WORKERS);
        await runQueue(orderedFiles.filter(file => file.sizeBytes < SMALL_FILE_LIMIT), SMALL_FILE_WORKERS);
        if (normalizedFiles.some(file => localSizes.get(file.id) !== file.sizeBytes)) throw new Error('incomplete_download');
        for (const bundle of normalizedBundles) {
            const expected = new Map(bundle.members.map(member => [member.path.toLowerCase(), member.sizeBytes]));
            // A previous run may have stopped halfway through extraction. Keep its ZIP
            // for resume, but discard only that bundle's incomplete output before retry.
            for (const member of bundle.members) {
                const existing = await fs.promises.lstat(member.target).catch(() => null);
                if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error('unsafe_install_path');
                if (existing) await fs.promises.unlink(member.target);
            }
            emit(operation, onProgress, 'extracting', { files: 0, totalFiles: bundle.members.length,
                bytes: 0, totalBytes: bundle.members.reduce((sum, member) => sum + member.sizeBytes, 0) });
            await extractSafeZip(bundle.target, staging,
                details => emit(operation, onProgress, 'extracting', details),
                () => operation.controller.signal.aborted, expected);
            for (const member of bundle.members) {
                const actual = await sha256File(member.target, bytes => emit(operation, onProgress, 'verifying', {
                    bytes, totalBytes: member.sizeBytes,
                }), operation.controller.signal);
                if (actual !== member.sha256) throw new Error('checksum_mismatch');
            }
            await fs.promises.unlink(bundle.target);
        }
        await saveJson(stateFile, state);
        if (!normalizedBundles.length) report(true);
        return { staging, stateFile, gamesRoot, folder: true, gamesRootPath };
    }

    async function install(id, letter, onProgress = () => {}) {
        if (active) return { success: false, code: 'busy' };
        const item = catalog.find(game => game.id === id);
        if (!item || !item.archiveKey) return { success: false, code: 'game_not_found' };
        if (installed(item)) return { success: false, code: 'already_installed' };
        let target;
        try { target = installPath(letter, item.installName); }
        catch (error) { return { success: false, code: error.message }; }
        if (fs.existsSync(target)) return { success: false, code: 'folder_exists' };
        const operation = { item, drive: letter.toUpperCase(), stage: 'starting', controller: new AbortController() };
        operation.snapshot = { id: item.id, name: item.name, drive: operation.drive, stage: 'starting',
            received: 0, total: Number(item.archiveSize) || 0, speedBytesPerSecond: 0, etaSeconds: null };
        let finishOperation;
        operation.finished = new Promise(resolve => { finishOperation = resolve; });
        active = operation;
        const folderPackage = item.packageType === 'folder';
        const staging = path.join(path.dirname(target), folderPackage
            ? `.merlin-installing-${item.id}` : `.merlin-installing-${item.id}-${require('node:crypto').randomUUID()}`);
        let folderDownloadComplete = false;
        try {
            const files = folderPackage
                ? await downloadFolder(item, letter, operation, staging, onProgress)
                : await download(item, letter, operation, onProgress);
            folderDownloadComplete = folderPackage;
            if (operation.controller.signal.aborted) throw new Error('cancelled');
            if (!folderPackage) {
                emit(operation, onProgress, 'extracting');
                await extractSafeZip(files.partial, staging, details => emit(operation, onProgress, 'extracting', details),
                    () => operation.controller.signal.aborted);
            }
            if (operation.controller.signal.aborted) throw new Error('cancelled');
            if (item.executablePath) {
                const executable = path.resolve(staging, ...item.executablePath.split('/'));
                if (!executable.startsWith(`${staging}${path.sep}`) || !fs.existsSync(executable)) throw new Error('executable_missing');
            }
            await fs.promises.writeFile(path.join(staging, MARKER), JSON.stringify({
                id: item.id, archiveKey: item.archiveKey, executablePath: item.executablePath,
                installedAt: new Date().toISOString(),
            }), { flag: 'wx' });
            if (fs.existsSync(target)) throw new Error('folder_exists');
            await fs.promises.rename(staging, target);
            registry[item.id] = { drive: letter.toUpperCase(), installName: item.installName,
                name: item.name, executablePath: item.executablePath };
            await saveJson(registryFile, registry);
            if (files.partial) await fs.promises.unlink(files.partial).catch(() => {});
            if (files.stateFile) await fs.promises.unlink(files.stateFile).catch(() => {});
            await cleanupAllTemporaryFiles();
            active = null;
            emit(operation, onProgress, 'completed', { done: true });
            return { success: true, path: target };
        } catch (error) {
            if ((!folderPackage || folderDownloadComplete || operation.cancelRequested) && fs.existsSync(staging)) {
                await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => {});
            }
            if (operation.cancelRequested) {
                if (operation.files?.partial) await fs.promises.unlink(operation.files.partial).catch(() => {});
                if (operation.files?.stateFile) await fs.promises.unlink(operation.files.stateFile).catch(() => {});
                if (operation.files?.partial) await fs.promises.rmdir(path.dirname(operation.files.partial)).catch(() => {});
            }
            const code = error.code === 'ENOSPC' ? 'disk_space' : error.code === 'EACCES' || error.code === 'EPERM'
                ? error.code : error.message || 'install_failed';
            active = null;
            emit(operation, onProgress, 'failed', { code, done: true });
            return { success: false, code };
        } finally { active = null; finishOperation(); }
    }

    async function cancel() {
        if (!active) return { success: false, code: 'not_running' };
        const operation = active;
        operation.cancelRequested = true;
        operation.controller.abort();
        await operation.finished;
        return { success: true };
    }

    function requireInstalled(id) {
        const item = catalog.find(game => game.id === id) || {
            id, installName: registry[id]?.installName, executablePath: registry[id]?.executablePath,
        };
        const current = item.installName && installed(item);
        if (!current) throw new Error('not_installed');
        return { item, current };
    }

    async function openFolder(id) {
        try {
            const { current } = requireInstalled(id);
            const error = await shell.openPath(current.path);
            return error ? { success: false, code: 'open_failed' } : { success: true };
        } catch (error) { return { success: false, code: error.message }; }
    }

    async function play(id) {
        try {
            const { item, current } = requireInstalled(id);
            const relative = item.executablePath || registry[id]?.executablePath;
            if (!relative || !/\.exe$/i.test(relative)) throw new Error('play_unavailable');
            const executable = path.resolve(current.path, ...relative.split('/'));
            if (!executable.startsWith(`${current.path}${path.sep}`)) throw new Error('invalid_executable');
            const real = await fs.promises.realpath(executable);
            if (!real.toLowerCase().startsWith(`${current.path.toLowerCase()}${path.sep}`)) throw new Error('invalid_executable');
            await new Promise((resolve, reject) => {
                const child = spawn(executable, [], { cwd: path.dirname(executable), detached: true, stdio: 'ignore' });
                child.once('error', reject);
                child.once('spawn', () => { child.unref(); resolve(); });
            });
            return { success: true };
        } catch (error) { return { success: false, code: error.message || 'play_failed' }; }
    }

    async function uninstall(id) {
        if (active) return { success: false, code: 'busy' };
        let movedToTrash = false;
        try {
            const { current } = requireInstalled(id);
            try { await shell.trashItem(current.path); }
            catch (electronError) {
                if (process.platform !== 'win32') throw electronError;
                try { await windowsRecycleBinMove(current.path); }
                catch (fallbackError) {
                    const combined = new Error(fallbackError.message || electronError.message || 'trash_failed');
                    combined.code = electronError.code || 'trash_failed';
                    combined.electronMessage = electronError.message || String(electronError);
                    throw combined;
                }
            }
            movedToTrash = true;
            delete registry[id];
            try { await saveJson(registryFile, registry); }
            catch (error) {
                // The game is already in the Recycle Bin; stale registry data cannot make it appear installed
                // because installation markers are checked on disk.
                console.warn('[CustomGames] Uninstall completed, but the local registry could not be saved', {
                    id, code: error.code || null, message: error.message || String(error),
                });
            }
            return { success: true };
        } catch (error) {
            const message = error.message || String(error);
            const code = error.code || (/failed to perform delete operation/i.test(message)
                ? 'trash_failed' : message || 'uninstall_failed');
            console.error('[CustomGames] Uninstall failed', {
                id, movedToTrash, code: error.code || null, message,
                electronMessage: error.electronMessage || null,
            });
            return { success: false, code };
        }
    }

    return { list, refresh, install, cancel, openFolder, play, uninstall, listDrives, subscribeProgress };
}

module.exports = { createCustomGamesService, requiredFreeBytes, validFolderManifestFileCount,
    moveWithWindowsShellToRecycleBin };
