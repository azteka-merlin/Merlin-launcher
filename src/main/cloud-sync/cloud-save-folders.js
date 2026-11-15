const fs = require('fs');
const os = require('os');
const path = require('path');
const { safeCloudPath } = require('./cloud-save-export');

function saveFolders(localAppData, accountId, appId, { hints = [], steamPath = '' } = {}) {
    if (!localAppData || !/^[1-9]\d{0,9}$/.test(String(accountId)) || !/^[1-9]\d{0,9}$/.test(String(appId))) return [];
    const record = path.join(localAppData, 'Merlin', 'cloud', 'save-folders', String(accountId), `${appId}.txt`);
    let lines;
    try { lines = fs.readFileSync(record, 'utf8').split(/\r?\n/); }
    catch { lines = []; }
    const folders = new Map();
    function addFolder(entry) {
        if (!path.win32.isAbsolute(entry) || entry.includes('\0') || entry.includes('\n')) return;
        try {
            const stat = fs.lstatSync(entry);
            if (!stat.isDirectory() || stat.isSymbolicLink()) return;
            const actual = fs.realpathSync.native(entry);
            if (path.win32.normalize(actual).toLowerCase() !== path.win32.normalize(entry).toLowerCase()) return;
            folders.set(actual.toLowerCase(), actual);
        } catch { /* A save folder can disappear between scans. */ }
    }
    if (lines.shift() === 'merlin-save-folders-v1' && lines.length <= 33) {
        for (const entry of lines) if (entry) addFolder(entry);
    }
    const home = os.homedir();
    const roots = [localAppData, process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        path.join(home, 'AppData', 'LocalLow'), path.join(home, 'Documents'),
        path.join(home, 'Saved Games'), process.env.PROGRAMDATA || 'C:\\ProgramData'];
    if (steamPath && path.win32.isAbsolute(steamPath)) {
        roots.push(steamPath, path.join(steamPath, 'userdata', String(accountId), String(appId), 'remote'));
    }
    for (const hint of Array.isArray(hints) ? hints.slice(0, 64) : []) {
        if (!safeCloudPath(hint)) continue;
        for (const root of roots) {
            if (!path.win32.isAbsolute(root)) continue;
            const filePath = path.join(root, ...hint.split('/'));
            try {
                const file = fs.lstatSync(filePath);
                if (!file.isFile() || file.isSymbolicLink()) continue;
                addFolder(path.dirname(filePath));
            } catch { /* The cloud copy may not exist on this PC. */ }
        }
    }
    return [...folders.values()];
}

module.exports = { saveFolders };
