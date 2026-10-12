const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { extractSafeZip } = require('./safe-zip');

const CHUNK_SIZE = 64 * 1024 * 1024;
const DOWNLOAD_WORKERS = 4;
const MARKER = '.merlin-install.json';

function createCustomGamesService({ app, axios, authSession, apiBaseUrl, shell, testDriveRoot = null }) {
    const dataRoot = app.getPath('userData');
    const source = new URL(apiBaseUrl).hostname.replace(/[^a-z0-9.-]/gi, '_');
    const registryFile = path.join(dataRoot, `custom-games-installs-${source}.json`);
    const cacheFile = path.join(dataRoot, `custom-games-catalog-${source}.json`);
    let active = null;
    let catalog = loadJson(cacheFile, []);
    let registry = loadJson(registryFile, {});

    function loadJson(file, fallback) {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch { return fallback; }
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

    function listDrives() {
        if (testDriveRoot) return [{ letter: 'X', path: path.join(testDriveRoot('X'), 'Merlin-games') }];
        if (process.platform !== 'win32') return [];
        const drives = [];
        for (let code = 67; code <= 90; code++) {
            const letter = String.fromCharCode(code);
            try { if (fs.statSync(`${letter}:\\`).isDirectory()) drives.push({ letter, path: `${letter}:\\Merlin-games` }); }
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
                executablePath: found ? registry[item.id]?.executablePath || null : item.executablePath };
        }),
            drives, offline, operation: active ? { id: active.item.id, stage: active.stage } : null };
    }

    async function list() {
        try { return await refresh(); }
        catch (error) {
            if (!catalog.length && !Object.keys(registry).length) return { success: false, code: 'catalog_unavailable' };
            return listCached(true);
        }
    }

    function emit(operation, onProgress, stage, extra = {}) {
        operation.stage = stage;
        const now = Date.now();
        if (stage === 'downloading' && now - (operation.lastEmit || 0) < 180 && !extra.done) return;
        operation.lastEmit = now;
        onProgress({ id: operation.item.id, stage, ...extra });
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
        const total = Number(item.archiveSize);
        if (!Number.isSafeInteger(total) || total < 1 || total > 30 * 1024 ** 3) throw new Error('invalid_archive_size');
        const statfs = await fs.promises.statfs(gamesRoot);
        const available = Number(statfs.bavail) * Number(statfs.bsize);
        if (available < total + 512 * 1024 ** 2 && !fs.existsSync(partial)) throw new Error('disk_space');
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
        const report = () => emit(operation, onProgress, 'downloading', {
            received: progress.reduce((sum, bytes) => sum + bytes, 0), total,
        });
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
            report();
            return { partial, stateFile, gamesRoot };
        } finally { await handle.close(); }
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
        const operation = { item, stage: 'starting', controller: new AbortController() };
        active = operation;
        const staging = path.join(path.dirname(target), `.merlin-installing-${item.id}-${require('node:crypto').randomUUID()}`);
        try {
            const files = await download(item, letter, operation, onProgress);
            if (operation.controller.signal.aborted) throw new Error('cancelled');
            emit(operation, onProgress, 'extracting');
            await extractSafeZip(files.partial, staging, details => emit(operation, onProgress, 'extracting', details),
                () => operation.controller.signal.aborted);
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
            await fs.promises.unlink(files.partial).catch(() => {});
            await fs.promises.unlink(files.stateFile).catch(() => {});
            emit(operation, onProgress, 'completed', { done: true });
            return { success: true, path: target };
        } catch (error) {
            if (fs.existsSync(staging)) await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => {});
            emit(operation, onProgress, 'failed', { code: error.message || 'install_failed', done: true });
            return { success: false, code: error.message || 'install_failed' };
        } finally { active = null; }
    }

    function cancel() {
        if (!active) return { success: false, code: 'not_running' };
        active.controller.abort();
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
            const relative = registry[id]?.executablePath || item.executablePath;
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
        try {
            const { current } = requireInstalled(id);
            await shell.trashItem(current.path);
            delete registry[id];
            await saveJson(registryFile, registry);
            return { success: true };
        } catch (error) { return { success: false, code: error.message || 'uninstall_failed' }; }
    }

    return { list, refresh, install, cancel, openFolder, play, uninstall, listDrives };
}

module.exports = { createCustomGamesService };
