const fs = require('node:fs/promises');
const path = require('node:path');

const LOG_NAME = 'merlin_steam_integration.log';
const LOG_FILES = [`${LOG_NAME}.1`, LOG_NAME];
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_HEADER = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC\] \[WARN\]/gm;

function redactSecrets(text) {
    return text
        .replace(/\b(Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
        .replace(/\b((?:x-api-key|api[_-]?key|access[_-]?token|refresh[_-]?token|auth_code|license[_-]?key)\s*[:=]\s*)[^\s&]+/gi, '$1[REDACTED]')
        .replace(/\bstpriv_[A-Za-z0-9_-]+\b/g, '[REDACTED]');
}

function extractRecentEntries(content, cutoffMs, nowMs) {
    const headers = [...content.matchAll(ENTRY_HEADER)];
    const entries = [];
    for (let index = 0; index < headers.length; index += 1) {
        const header = headers[index];
        const timestamp = Date.parse(`${header[1]}T${header[2]}Z`);
        if (!Number.isFinite(timestamp) || timestamp < cutoffMs || timestamp > nowMs) continue;
        const end = headers[index + 1]?.index ?? content.length;
        entries.push({ timestamp, text: content.slice(header.index, end).trim() });
    }
    return entries;
}

async function readKnownLog(filePath, fileSystem) {
    let stats;
    try {
        stats = await fileSystem.lstat(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw error;
    }
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_FILE_BYTES) {
        throw new Error('Steam integration log is not a bounded regular file');
    }
    return fileSystem.readFile(filePath, 'utf8');
}

async function collectRecentSteamIntegrationLog({ localAppData, now = Date.now(), fileSystem = fs }) {
    if (!localAppData || !Number.isFinite(now)) return null;
    const logDirectory = path.join(localAppData, 'Merlin', 'logs');
    const entries = [];
    for (const fileName of LOG_FILES) {
        const content = await readKnownLog(path.join(logDirectory, fileName), fileSystem);
        entries.push(...extractRecentEntries(content, now - ONE_DAY_MS, now));
    }
    if (entries.length === 0) return null;
    entries.sort((left, right) => left.timestamp - right.timestamp);
    return `${redactSecrets(entries.map(entry => entry.text).join('\n\n'))}\n`;
}

module.exports = { collectRecentSteamIntegrationLog };
