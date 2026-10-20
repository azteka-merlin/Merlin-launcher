const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const zlib = require('node:zlib');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const yauzl = require('yauzl');
const { decodeDeflate64 } = require('./deflate64');

const MAX_FILES = 100000;
const MAX_UNCOMPRESSED = 200 * 1024 ** 3;
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    return value >>> 0;
});

function updateCrc(crc, bytes) {
    if (typeof zlib.crc32 === 'function') {
        return (zlib.crc32(bytes, (crc ^ 0xffffffff) >>> 0) ^ 0xffffffff) >>> 0;
    }
    let value = crc;
    for (let index = 0; index < bytes.length; index++) {
        value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
    }
    return value >>> 0;
}

function safeEntryPath(root, name) {
    if (!name || name.startsWith('/') || name.includes('\\') || name.includes('\0')) throw new Error('unsafe_archive_path');
    const parts = name.replace(/\/$/, '').split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part)
        || /[. ]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(part))) {
        throw new Error('unsafe_archive_path');
    }
    if (parts.some(part => part.toLowerCase() === '.merlin-install.json')) throw new Error('unsafe_archive_path');
    const target = path.resolve(root, ...parts);
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('unsafe_archive_path');
    return target;
}

function openZip(filename) {
    return new Promise((resolve, reject) => {
        yauzl.open(filename, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
            (error, zipfile) => error ? reject(error) : resolve(zipfile));
    });
}

function openEntryStream(zipfile, entry) {
    return new Promise((resolve, reject) => zipfile.openReadStream(entry,
        entry.compressionMethod === 9 ? { decodeFileData: false } : {},
        (error, stream) => {
            if (error) return reject(error);
            try { resolve(entry.compressionMethod === 9 ? decodeDeflate64(stream) : stream); }
            catch (failure) { reject(failure); }
        }));
}

async function inspectArchive(zipPath, destination, isCancelled, expectedEntries = null, expectedHashes = null) {
    const zipfile = await openZip(zipPath);
    const seen = new Set();
    let files = 0;
    let entries = 0;
    let totalBytes = 0;

    return new Promise((resolve, reject) => {
        let finished = false;
        const fail = error => {
            if (finished) return;
            finished = true;
            zipfile.close();
            reject(error);
        };
        zipfile.on('error', fail);
        zipfile.on('end', () => {
            if (finished) return;
            if (expectedEntries && seen.size !== expectedEntries.size) return fail(new Error('archive_manifest_mismatch'));
            if (expectedHashes && files !== expectedHashes.size) return fail(new Error('archive_manifest_mismatch'));
            finished = true;
            zipfile.close();
            resolve({ files, totalBytes });
        });
        zipfile.on('entry', entry => {
            try {
                if (isCancelled()) throw new Error('cancelled');
                const normalized = entry.fileName.replace(/\\/g, '/');
                safeEntryPath(destination, normalized);
                const relative = normalized.replace(/\/$/, '').toLowerCase();
                if (seen.has(relative)) throw new Error('duplicate_archive_path');
                seen.add(relative);
                if (expectedEntries && (normalized.endsWith('/') ||
                    expectedEntries.get(relative) !== entry.uncompressedSize)) throw new Error('archive_manifest_mismatch');
                const unixMode = entry.externalFileAttributes >>> 16;
                if ((unixMode & 0xf000) === 0xa000) throw new Error('archive_symlink_not_allowed');
                if (entry.isEncrypted() || ![0, 8, 9].includes(entry.compressionMethod)) throw new Error('unsupported_archive_compression');
                if (++entries > MAX_FILES) throw new Error('archive_file_limit');
                if (!normalized.endsWith('/')) {
                    files += 1;
                    if (expectedHashes && !/^[a-f0-9]{64}$/i.test(String(expectedHashes.get(relative) || ''))) {
                        throw new Error('archive_manifest_mismatch');
                    }
                }
                totalBytes += entry.uncompressedSize;
                if (totalBytes > MAX_UNCOMPRESSED) throw new Error('archive_size_limit');
                zipfile.readEntry();
            } catch (error) { fail(error); }
        });
        zipfile.readEntry();
    });
}

async function extractSafeZip(zipPath, destination, onProgress = () => {}, isCancelled = () => false, expectedEntries = null, options = {}) {
    const expectedHashes = options?.expectedHashes ?? null;
    if (expectedHashes !== null && !(expectedHashes instanceof Map)) throw new Error('archive_manifest_mismatch');
    const archive = await inspectArchive(zipPath, destination, isCancelled, expectedEntries, expectedHashes);
    const seen = new Set();
    const directoryCache = new Map();
    const destinationRoot = path.resolve(destination);
    let files = 0;
    let entries = 0;
    let declaredTotal = 0;
    let extracted = 0;
    await fs.promises.mkdir(destination, { recursive: true });
    const ensureDirectory = async directory => {
        const relative = path.relative(destinationRoot, directory);
        if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
            throw new Error('unsafe_install_path');
        }
        if (directory !== destinationRoot) await ensureDirectory(path.dirname(directory));
        // Recheck the directory's identity so replacing a cached directory with a
        // symlink cannot make a later entry skip the realpath validation.
        let stat = await fs.promises.lstat(directory).catch(error => {
            if (error.code !== 'ENOENT') throw error;
            return null;
        });
        if (!stat) {
            await fs.promises.mkdir(directory).catch(error => { if (error.code !== 'EEXIST') throw error; });
            stat = await fs.promises.lstat(directory);
        }
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_install_path');
        const cached = directoryCache.get(directory);
        if (!cached || cached.dev !== stat.dev || cached.ino !== stat.ino) {
            if ((await fs.promises.realpath(directory)).toLowerCase() !== directory.toLowerCase()) {
                throw new Error('unsafe_install_path');
            }
            directoryCache.set(directory, { dev: stat.dev, ino: stat.ino });
        }
    };
    await ensureDirectory(destinationRoot);
    const zipfile = await openZip(zipPath);
    const report = () => onProgress({ files, totalFiles: archive.files, bytes: extracted, totalBytes: archive.totalBytes });
    return new Promise((resolve, reject) => {
        let finished = false;
        const fail = error => {
            if (finished) return;
            finished = true;
            zipfile.close();
            reject(error);
        };
        zipfile.on('error', fail);
        zipfile.on('end', () => {
            if (finished) return;
            try {
                if (isCancelled()) throw new Error('cancelled');
                report();
                finished = true;
                resolve({ files, bytes: extracted });
            } catch (error) { fail(error); }
        });
        zipfile.on('entry', async entry => {
            try {
                if (isCancelled()) throw new Error('cancelled');
                const target = safeEntryPath(destination, entry.fileName);
                const relative = path.relative(destination, target).toLowerCase();
                if (seen.has(relative)) throw new Error('duplicate_archive_path');
                seen.add(relative);
                const unixMode = entry.externalFileAttributes >>> 16;
                if ((unixMode & 0xf000) === 0xa000) throw new Error('archive_symlink_not_allowed');
                if (++entries > MAX_FILES) throw new Error('archive_file_limit');
                declaredTotal += entry.uncompressedSize;
                if (declaredTotal > MAX_UNCOMPRESSED) throw new Error('archive_size_limit');
                if (entry.fileName.endsWith('/')) {
                    await ensureDirectory(target);
                } else {
                    await ensureDirectory(path.dirname(target));
                    let size = 0;
                    const hash = expectedHashes ? createHash('sha256') : null;
                    let crc = hash ? null : 0xffffffff;
                    const verifier = new Transform({
                        transform(chunk, _encoding, callback) {
                            try {
                                if (isCancelled()) throw new Error('cancelled');
                                size += chunk.length;
                                extracted += chunk.length;
                                if (size > entry.uncompressedSize || extracted > MAX_UNCOMPRESSED) throw new Error('archive_size_limit');
                                if (crc !== null) crc = updateCrc(crc, chunk);
                                hash?.update(chunk);
                                report();
                                callback(null, chunk);
                            } catch (error) { callback(error); }
                        }
                    });
                    await pipeline(await openEntryStream(zipfile, entry), verifier,
                        fs.createWriteStream(target, { flags: 'wx' }));
                    if (isCancelled()) throw new Error('cancelled');
                    if (size !== entry.uncompressedSize ||
                        (crc !== null && ((crc ^ 0xffffffff) >>> 0) !== entry.crc32)) {
                        throw new Error('archive_integrity_failed');
                    }
                    const memberKey = entry.fileName.toLowerCase();
                    if (hash && hash.digest('hex') !== String(expectedHashes.get(memberKey)).toLowerCase()) {
                        throw new Error('checksum_mismatch');
                    }
                    files += 1;
                }
                report();
                zipfile.readEntry();
            } catch (error) { fail(error); }
        });
        try {
            report();
            zipfile.readEntry();
        } catch (error) { fail(error); }
    });
}

module.exports = { extractSafeZip, safeEntryPath };
