const fs = require('node:fs');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const yauzl = require('yauzl');

const MAX_FILES = 100000;
const MAX_UNCOMPRESSED = 200 * 1024 ** 3;
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    return value >>> 0;
});

function updateCrc(crc, bytes) {
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
        (error, stream) => error ? reject(error) : resolve(stream)));
}

async function inspectArchive(zipPath, destination, isCancelled, expectedEntries = null) {
    const zipfile = await openZip(zipPath);
    const seen = new Set();
    let files = 0;
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
                if (++files > MAX_FILES) throw new Error('archive_file_limit');
                totalBytes += entry.uncompressedSize;
                if (totalBytes > MAX_UNCOMPRESSED) throw new Error('archive_size_limit');
                zipfile.readEntry();
            } catch (error) { fail(error); }
        });
        zipfile.readEntry();
    });
}

async function extractSafeZip(zipPath, destination, onProgress = () => {}, isCancelled = () => false, expectedEntries = null) {
    const archive = await inspectArchive(zipPath, destination, isCancelled, expectedEntries);
    const zipfile = await openZip(zipPath);
    const seen = new Set();
    let files = 0;
    let declaredTotal = 0;
    let extracted = 0;
    await fs.promises.mkdir(destination, { recursive: true });
    return new Promise((resolve, reject) => {
        let finished = false;
        const fail = error => {
            if (finished) return;
            finished = true;
            zipfile.close();
            reject(error);
        };
        zipfile.on('error', fail);
        zipfile.on('end', () => { if (!finished) { finished = true; resolve({ files, bytes: extracted }); } });
        zipfile.on('entry', async entry => {
            try {
                if (isCancelled()) throw new Error('cancelled');
                const target = safeEntryPath(destination, entry.fileName);
                const relative = path.relative(destination, target).toLowerCase();
                if (seen.has(relative)) throw new Error('duplicate_archive_path');
                seen.add(relative);
                const unixMode = entry.externalFileAttributes >>> 16;
                if ((unixMode & 0xf000) === 0xa000) throw new Error('archive_symlink_not_allowed');
                if (++files > MAX_FILES) throw new Error('archive_file_limit');
                declaredTotal += entry.uncompressedSize;
                if (declaredTotal > MAX_UNCOMPRESSED) throw new Error('archive_size_limit');
                if (entry.fileName.endsWith('/')) {
                    await fs.promises.mkdir(target, { recursive: true });
                    if ((await fs.promises.realpath(target)).toLowerCase() !== target.toLowerCase()) {
                        throw new Error('unsafe_install_path');
                    }
                } else {
                    await fs.promises.mkdir(path.dirname(target), { recursive: true });
                    if ((await fs.promises.realpath(path.dirname(target))).toLowerCase() !==
                        path.dirname(target).toLowerCase()) throw new Error('unsafe_install_path');
                    let size = 0;
                    let crc = 0xffffffff;
                    const verifier = new Transform({
                        transform(chunk, _encoding, callback) {
                            if (isCancelled()) return callback(new Error('cancelled'));
                            size += chunk.length;
                            extracted += chunk.length;
                            if (size > entry.uncompressedSize || extracted > MAX_UNCOMPRESSED) return callback(new Error('archive_size_limit'));
                            crc = updateCrc(crc, chunk);
                            onProgress({ files, totalFiles: archive.files, bytes: extracted, totalBytes: archive.totalBytes });
                            callback(null, chunk);
                        }
                    });
                    await pipeline(await openEntryStream(zipfile, entry), verifier,
                        fs.createWriteStream(target, { flags: 'wx' }));
                    if (size !== entry.uncompressedSize || ((crc ^ 0xffffffff) >>> 0) !== entry.crc32) {
                        throw new Error('archive_integrity_failed');
                    }
                }
                onProgress({ files, totalFiles: archive.files, bytes: extracted, totalBytes: archive.totalBytes });
                zipfile.readEntry();
            } catch (error) { fail(error); }
        });
        zipfile.readEntry();
    });
}

module.exports = { extractSafeZip, safeEntryPath };
