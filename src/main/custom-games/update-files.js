const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { createInflateRaw } = require('node:zlib');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { safeEntryPath, extractSafeZip } = require('./safe-zip');
const { decodeDeflate64 } = require('./deflate64');

const MARKER = '.merlin-install.json';
const RANGE_BYTES = 64 * 1024 ** 2;
const key = value => value.replace(/\\/g, '/').toLowerCase();
const checkCancelled = signal => { if (signal?.aborted) throw new Error('cancelled'); };

async function atomicJson(file, value) {
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
        await fs.promises.writeFile(temp, JSON.stringify(value), { flag: 'wx' });
        await fs.promises.rename(temp, file);
    } finally { await fs.promises.unlink(temp).catch(() => {}); }
}

async function assertDirectory(directory) {
    const stat = await fs.promises.lstat(directory);
    const real = await fs.promises.realpath(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || real.toLowerCase() !== path.resolve(directory).toLowerCase()) {
        throw new Error('unsafe_install_path');
    }
}

async function safeParents(root, target, create = false, replaceableParents = null) {
    await assertDirectory(root);
    let parent = root;
    for (const part of path.relative(root, path.dirname(target)).split(path.sep).filter(Boolean)) {
        parent = path.join(parent, part);
        if (create) await fs.promises.mkdir(parent).catch(error => { if (error.code !== 'EEXIST') throw error; });
        try { await assertDirectory(parent); }
        catch (error) {
            if (!create && error.code === 'ENOENT') return false;
            if (!create && replaceableParents?.has(key(path.relative(root, parent)))) {
                const blocked = await fs.promises.lstat(parent);
                if (blocked.isFile() && !blocked.isSymbolicLink()) return false;
            }
            throw error;
        }
    }
    return true;
}

async function localFile(root, relative, { allowDirectory = false, replaceableParents = null } = {}) {
    const target = safeEntryPath(root, relative);
    if (!await safeParents(root, target, false, replaceableParents)) return null;
    const stat = await fs.promises.lstat(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (stat && ((!stat.isFile() && !(allowDirectory && stat.isDirectory())) || stat.isSymbolicLink())) throw new Error('unsafe_install_path');
    if (stat?.isDirectory()) await assertDirectory(target);
    return stat;
}

async function directoryEntries(root, relative, allowedFiles = null) {
    const directory = safeEntryPath(root, relative);
    await assertDirectory(directory);
    const directories = [relative];
    for (const name of await fs.promises.readdir(directory)) {
        const child = `${relative}/${name}`;
        const target = safeEntryPath(root, child);
        const stat = await fs.promises.lstat(target);
        if (stat.isSymbolicLink()) throw new Error('unsafe_install_path');
        if (stat.isDirectory()) directories.push(...await directoryEntries(root, child, allowedFiles));
        else if (!stat.isFile() || !allowedFiles?.has(key(child))) throw new Error('update_path_conflict');
    }
    return directories;
}

async function removeEmptyDirectories(root, relative) {
    // rmdir never removes files. Unknown data appearing since planning remains safe.
    const directories = await directoryEntries(root, relative);
    for (const name of directories.reverse()) await fs.promises.rmdir(safeEntryPath(root, name));
}

function protectedFile(relative, origin, protectedPaths, packageHasGame = false) {
    const name = key(relative);
    // Older port metadata may still contain the formerly mandatory `game` entry.
    // For ports, the new package decides whether that directory is replaced.
    const explicit = (Array.isArray(protectedPaths) ? protectedPaths : []).filter(value =>
        !(origin === 'port' && typeof value === 'string' && key(value).replace(/\/$/, '') === 'game'));
    if (origin === 'port' && !packageHasGame) explicit.push('game');
    if (explicit.some(value => typeof value === 'string' && (name === key(value).replace(/\/$/, '') ||
        name.startsWith(`${key(value).replace(/\/$/, '')}/`)))) return true;
    const parts = name.split('/');
    return parts.slice(0, -1).some(part => ['save', 'saves', 'savegames', 'savedata', 'user', 'userdata'].includes(part)) ||
        /\.(ini|cfg|sav)$/i.test(name) || parts.at(-1) === 'settings.json';
}

async function createUpdatePlan(root, previous, next, options = {}, signal = null) {
    const packageHasGame = options.origin === 'port' && next.files.some(file => key(file.path).startsWith('game/'));
    const before = new Map((previous?.files || []).map(file => [key(file.path), file]));
    const after = new Set(next.files.map(file => key(file.path)));
    const removable = new Set((previous?.files || []).filter(file => !after.has(key(file.path)) &&
        !protectedFile(file.path, options.origin, options.protectedPaths, packageHasGame)).map(file => key(file.path)));
    const plan = { replace: [], remove: [], unchangedFiles: 0, protectedFiles: 0 };
    for (let index = 0; index < next.files.length; index++) {
        checkCancelled(signal);
        const file = next.files[index];
        if (protectedFile(file.path, options.origin, options.protectedPaths, packageHasGame)) {
            const target = safeEntryPath(root, file.path);
            const existing = await fs.promises.lstat(target).catch(error => {
                if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
                throw error;
            });
            // A protected game/save may live on another disk via a junction.
            // Existing protected data needs no traversal or writable-path checks.
            if (existing) { plan.protectedFiles++; continue; }
        }
        const local = await localFile(root, file.path, { allowDirectory: true, replaceableParents: removable });
        const old = before.get(key(file.path));
        if (local && protectedFile(file.path, options.origin, options.protectedPaths, packageHasGame)) { plan.protectedFiles++; continue; }
        if (local?.isDirectory()) await directoryEntries(root, file.path, removable);
        if (old?.sha256 === file.sha256 && old?.sizeBytes === file.sizeBytes && local?.isFile() && local.size === file.sizeBytes) {
            plan.unchangedFiles++;
        } else plan.replace.push({ ...file, entryIndex: index });
    }
    for (const file of previous?.files || []) {
        checkCancelled(signal);
        if (after.has(key(file.path)) || protectedFile(file.path, options.origin, options.protectedPaths, packageHasGame)) continue;
        if (await localFile(root, file.path)) plan.remove.push(file);
    }
    return plan;
}

async function downloadObject({ url, sizeBytes, expectedHash, etag, destination, request, signal, onBytes }) {
    await safeParents(path.dirname(destination), destination, true);
    const output = await fs.promises.open(destination, 'wx');
    let hash = createHash('sha256');
    try {
        for (let start = 0; start < sizeBytes; start += RANGE_BYTES) {
            const end = Math.min(sizeBytes - 1, start + RANGE_BYTES - 1);
            let failure;
            for (let attempt = 0; attempt < 4; attempt++) {
                checkCancelled(signal);
                let response;
                let position = start;
                let timer;
                const armTimer = () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => response?.data?.destroy(new Error('download_stalled')), 45000);
                    timer.unref?.();
                };
                try {
                    response = await request(url, { responseType: 'stream', decompress: false, timeout: 60000,
                        signal, headers: { Range: `bytes=${start}-${end}` } });
                    if (response.status !== 206 || response.headers?.['content-range'] !== `bytes ${start}-${end}/${sizeBytes}` ||
                        etag && String(response.headers?.etag || '').replace(/^"|"$/g, '') !== String(etag).replace(/^"|"$/g, '')) {
                        throw new Error('invalid_range_response');
                    }
                    const rangeHash = hash.copy();
                    armTimer();
                    for await (const chunk of response.data) {
                        checkCancelled(signal);
                        armTimer();
                        if (position + chunk.length > end + 1) throw new Error('invalid_range_response');
                        let offset = 0;
                        while (offset < chunk.length) {
                            const written = await output.write(chunk, offset, chunk.length - offset, position + offset);
                            if (!written.bytesWritten) throw new Error('disk_write_failed');
                            offset += written.bytesWritten;
                        }
                        rangeHash.update(chunk);
                        position += chunk.length;
                        onBytes(chunk.length);
                    }
                    if (position !== end + 1) throw new Error('incomplete_range');
                    hash = rangeHash;
                    failure = null;
                    break;
                } catch (error) {
                    onBytes(-(position - start));
                    checkCancelled(signal);
                    failure = error;
                    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
                } finally {
                    clearTimeout(timer);
                    response?.data?.destroy();
                }
            }
            if (failure) throw failure;
        }
        if (expectedHash && hash.digest('hex') !== expectedHash) throw new Error('checksum_mismatch');
    } finally { await output.close(); }
}

async function decodeZipMember(source, target, file, signal) {
    let bytes = 0;
    const hash = createHash('sha256');
    const verify = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > file.sizeBytes) return callback(new Error('archive_integrity_failed'));
        hash.update(chunk);
        callback(null, chunk);
    } });
    const input = fs.createReadStream(source);
    const streams = [file.zip.method === 9 ? decodeDeflate64(input) : input];
    if (file.zip.method === 8) streams.push(createInflateRaw());
    streams.push(verify, fs.createWriteStream(target, { flags: 'wx' }));
    await pipeline(...streams, { signal });
    if (bytes !== file.sizeBytes || hash.digest('hex') !== file.sha256) throw new Error('archive_integrity_failed');
}

async function stageUpdate({ staging, item, manifest, folderManifest, plan, request, signal, onProgress }) {
    await fs.promises.mkdir(staging, { recursive: false });
    await assertDirectory(staging);
    const payload = path.join(staging, 'payload');
    const objects = path.join(staging, 'objects');
    await fs.promises.mkdir(payload);
    await fs.promises.mkdir(objects);
    const downloads = [];
    if (item.packageType === 'folder') {
        const declared = new Map(manifest.files.map(file => [key(file.path), file]));
        const needed = new Set(plan.replace.map(file => key(file.path)));
        const covered = new Set();
        const seenIds = new Set();
        for (const file of folderManifest?.files || []) {
            const expected = declared.get(key(file.path || ''));
            if (!expected || !/^[a-f0-9-]{36}$/i.test(file.id || '') || seenIds.has(file.id.toLowerCase()) ||
                covered.has(key(file.path)) || expected.sizeBytes !== file.sizeBytes ||
                (file.sha256 != null && expected.sha256 !== file.sha256)) {
                throw new Error('invalid_folder_manifest');
            }
            seenIds.add(file.id.toLowerCase()); covered.add(key(file.path));
            if (needed.has(key(file.path))) downloads.push({ ...expected, id: file.id, etag: file.etag, kind: 'file' });
        }
        for (const bundle of folderManifest?.bundles || []) {
            if (!/^[a-f0-9-]{36}$/i.test(bundle.id || '') || seenIds.has(bundle.id.toLowerCase()) ||
                !Number.isSafeInteger(bundle.sizeBytes) || bundle.sizeBytes < 1 || bundle.sizeBytes > 1024 ** 3 ||
                !/^[a-f0-9]{64}$/i.test(bundle.sha256 || '') || !Array.isArray(bundle.files) || !bundle.files.length) {
                throw new Error('invalid_folder_manifest');
            }
            seenIds.add(bundle.id.toLowerCase());
            for (const member of bundle.files) {
                const expected = declared.get(key(member.path || ''));
                if (!expected || covered.has(key(member.path)) || expected.sizeBytes !== member.sizeBytes || expected.sha256 !== member.sha256) {
                    throw new Error('invalid_folder_manifest');
                }
                covered.add(key(member.path));
            }
            if (bundle.files.some(file => needed.has(key(file.path)))) downloads.push({ ...bundle, kind: 'bundle' });
        }
        if (covered.size !== declared.size) throw new Error('invalid_folder_manifest');
    } else {
        for (const file of plan.replace) {
            if (!file.zip || ![0, 8, 9].includes(file.zip.method) || !Number.isSafeInteger(file.zip.compressedSize) ||
                file.zip.compressedSize < 0 || file.zip.compressedSize > 100 * 1024 ** 3) throw new Error('integrity_index_unavailable');
            downloads.push({ ...file, sizeBytes: file.zip.compressedSize, kind: 'zip-entry' });
        }
    }
    const transferTotal = downloads.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    const installedBytes = plan.replace.reduce((sum, file) => sum + file.sizeBytes, 0);
    const available = await fs.promises.statfs(staging);
    if (Number(available.bavail) * Number(available.bsize) < transferTotal + installedBytes + 512 * 1024 ** 2) throw new Error('disk_space');
    let received = 0;
    let completedFiles = 0;
    const report = () => onProgress({ received, total: transferTotal, completedFiles, totalFiles: downloads.length,
        unchangedFiles: plan.unchangedFiles, protectedFiles: plan.protectedFiles });
    report();
    let cursor = 0;
    const download = async entry => {
        checkCancelled(signal);
        const object = path.join(objects, `${entry.kind}-${entry.id || entry.entryIndex}`);
        const url = entry.kind === 'zip-entry' ? `entries/${entry.entryIndex}` : `files/${entry.id}`;
        await downloadObject({ url, sizeBytes: entry.sizeBytes,
            expectedHash: entry.kind === 'zip-entry' ? null : entry.sha256, etag: entry.etag,
            destination: object, request, signal, onBytes: value => { received += value; report(); } });
        if (entry.kind === 'bundle') {
            await extractSafeZip(object, payload, () => {}, () => signal?.aborted,
                new Map(entry.files.map(file => [key(file.path), file.sizeBytes])),
                { expectedHashes: new Map(entry.files.map(file => [key(file.path), file.sha256])) });
        } else {
            const target = safeEntryPath(payload, entry.path);
            await safeParents(payload, target, true);
            if (entry.kind === 'zip-entry') {
                const expected = plan.replace.find(file => file.entryIndex === entry.entryIndex);
                await decodeZipMember(object, target, expected, signal);
            } else await fs.promises.rename(object, target);
        }
        await fs.promises.unlink(object).catch(error => { if (error.code !== 'ENOENT') throw error; });
        completedFiles++;
        report();
    };
    // A bounded pool keeps many small files fast without saturating the disk.
    const results = await Promise.allSettled(Array.from({ length: Math.min(4, downloads.length) }, async () => {
        while (cursor < downloads.length) await download(downloads[cursor++]);
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    return { payload, transferTotal };
}

function backupPath(root, id) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('invalid_game_id');
    return path.join(path.dirname(root), `.merlin-update-${id}`);
}

async function removeWorkspace(directory, parent) {
    if (path.dirname(path.resolve(directory)).toLowerCase() !== path.resolve(parent).toLowerCase()) throw new Error('unsafe_install_path');
    if (!await fs.promises.lstat(directory).catch(() => null)) return;
    await assertDirectory(directory);
    await fs.promises.rm(directory, { recursive: true, force: true });
}

async function finishUpdateWorkspace(backup, journal) {
    // Keep the finalized header until backup data and the operations log are gone.
    // An interrupted cleanup must never make a committed update look unfinished.
    await atomicJson(path.join(backup, 'journal.json'), {
        format: 2, id: journal.id, root: journal.root, marker: journal.marker, committed: true, entries: [],
    });
    await removeWorkspace(path.join(backup, 'files'), backup);
    for (const name of await fs.promises.readdir(backup)) {
        if (name === 'journal.json') continue;
        if (name !== 'operations.ndjson' && !/^journal\.json\.[a-f0-9-]{36}\.tmp$/i.test(name)) throw new Error('update_recovery_required');
        const target = path.join(backup, name);
        const stat = await fs.promises.lstat(target);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe_install_path');
        await fs.promises.unlink(target);
    }
    await fs.promises.unlink(path.join(backup, 'journal.json'));
    await fs.promises.rmdir(backup);
}

async function recoverUpdate(root, id) {
    const backup = backupPath(root, id);
    if (!await fs.promises.lstat(backup).catch(() => null)) return false;
    await assertDirectory(backup);
    let journal;
    try { journal = JSON.parse(await fs.promises.readFile(path.join(backup, 'journal.json'), 'utf8')); }
    catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const names = await fs.promises.readdir(backup);
        // Older launchers could stop after mkdir but before writing their initial
        // journal. No installation writes happened if the workspace is pristine.
        if (!names.every(name => name === 'files') || (names.includes('files') &&
            (await fs.promises.readdir(path.join(backup, 'files'))).length)) throw new Error('update_recovery_required');
        if (names.includes('files')) await assertDirectory(path.join(backup, 'files'));
        await removeWorkspace(backup, path.dirname(root));
        return true;
    }
    if (journal.id !== id || journal.root !== path.resolve(root) || !Array.isArray(journal.entries) ||
        journal.entries.length > 200000 || !journal.marker || journal.marker.id !== id) throw new Error('update_recovery_required');
    if (journal.format === 2 && !journal.committed) {
        const operations = path.join(backup, 'operations.ndjson');
        const stat = await fs.promises.lstat(operations).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024 ** 2)) throw new Error('update_recovery_required');
        const text = stat ? await fs.promises.readFile(operations, 'utf8') : '';
        // Only complete records can precede file mutations. A torn final append
        // was never acknowledged to applyUpdate and can safely be ignored.
        for (const line of text.slice(0, text.lastIndexOf('\n') + 1).split('\n')) {
            if (!line) continue;
            let record;
            try { record = JSON.parse(line); } catch { throw new Error('update_recovery_required'); }
            if (record.type === 'intent' && record.entry && !journal.committed) journal.entries.push(record.entry);
            else if (record.type === 'committed') journal.committed = true;
            else throw new Error('update_recovery_required');
            if (journal.entries.length > 200000) throw new Error('update_recovery_required');
        }
    }
    if (!journal.committed) {
        await assertDirectory(root);
        const originalParents = new Set(journal.entries.filter(entry => entry.hadOriginal).map(entry => key(`files/${entry.path}`)));
        const restoredParents = new Set(journal.entries.filter(entry => entry.hadOriginal).map(entry => key(entry.path)));
        for (const entry of [...journal.entries].reverse()) {
            const target = safeEntryPath(root, entry.path);
            const original = safeEntryPath(backup, `files/${entry.path}`);
            const saved = await localFile(backup, `files/${entry.path}`, { allowDirectory: true, replaceableParents: originalParents });
            if (saved?.isFile()) {
                const current = await localFile(root, entry.path, { allowDirectory: true });
                if (current?.isDirectory()) await removeEmptyDirectories(root, entry.path);
                await safeParents(root, target, true);
                if (current?.isFile()) await fs.promises.unlink(target);
                await fs.promises.rename(original, target);
            } else if (!entry.hadOriginal && entry.applied) {
                const current = await localFile(root, entry.path, { allowDirectory: Boolean(entry.removedDirectories), replaceableParents: restoredParents });
                if (current?.isFile()) await fs.promises.unlink(target);
            }
            for (const directory of entry.removedDirectories || []) {
                const restore = safeEntryPath(root, directory);
                await safeParents(root, restore, true);
                await fs.promises.mkdir(restore).catch(error => { if (error.code !== 'EEXIST') throw error; });
                await assertDirectory(restore);
            }
        }
        await atomicJson(path.join(root, MARKER), journal.marker);
    }
    await finishUpdateWorkspace(backup, journal);
    return true;
}

async function applyUpdate({ root, id, payload, plan, marker, signal, onProgress = () => {}, beforeWrite = null }) {
    await recoverUpdate(root, id);
    const backup = backupPath(root, id);
    const preparedBackup = `${backup}.preparing-${randomUUID()}`;
    let journal;
    try {
        await fs.promises.mkdir(preparedBackup);
        await fs.promises.mkdir(path.join(preparedBackup, 'files'));
        const oldMarker = JSON.parse(await fs.promises.readFile(path.join(root, MARKER), 'utf8'));
        journal = { format: 2, id, root: path.resolve(root), marker: oldMarker, committed: false, entries: [] };
        await atomicJson(path.join(preparedBackup, 'journal.json'), journal);
        // Publish a recoverable journal before any installed file can be moved.
        await fs.promises.rename(preparedBackup, backup);
    } catch (error) {
        await removeWorkspace(preparedBackup, path.dirname(root)).catch(() => {});
        throw error;
    }
    const operationsPath = path.join(backup, 'operations.ndjson');
    let completedFiles = 0;
    try {
        const changes = [...plan.remove.map(file => ({ ...file, remove: true })), ...plan.replace];
        for (const file of changes) {
            checkCancelled(signal);
            const target = safeEntryPath(root, file.path);
            const existing = await localFile(root, file.path, { allowDirectory: !file.remove });
            const saved = safeEntryPath(backup, `files/${file.path}`);
            const entry = { path: file.path, hadOriginal: Boolean(existing?.isFile()), applied: !file.remove,
                ...(existing?.isDirectory() ? { removedDirectories: await directoryEntries(root, file.path) } : {}) };
            // Appending one bounded intent per file keeps journal work linear for
            // large games. Intent is durable to process exits before either move.
            await fs.promises.appendFile(operationsPath, `${JSON.stringify({ type: 'intent', entry })}\n`);
            if (beforeWrite) await beforeWrite(file, completedFiles + 1);
            if (existing?.isDirectory()) await removeEmptyDirectories(root, file.path);
            if (existing?.isFile()) {
                await safeParents(backup, saved, true);
                await fs.promises.rename(target, saved);
            }
            if (!file.remove) {
                await safeParents(root, target, true);
                const staged = safeEntryPath(payload, file.path);
                if (!await localFile(payload, file.path)) throw new Error('incomplete_download');
                await fs.promises.rename(staged, target);
            }
            completedFiles++;
            onProgress({ files: completedFiles, totalFiles: changes.length });
        }
        checkCancelled(signal);
        await atomicJson(path.join(root, MARKER), marker);
        await fs.promises.appendFile(operationsPath, `${JSON.stringify({ type: 'committed' })}\n`);
    } catch (error) {
        try { await recoverUpdate(root, id); }
        catch { throw new Error('update_recovery_required'); }
        throw error;
    }
    await finishUpdateWorkspace(backup, journal);
}

module.exports = { createUpdatePlan, stageUpdate, applyUpdate, recoverUpdate, protectedFile, removeWorkspace };
