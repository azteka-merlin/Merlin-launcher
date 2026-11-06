const REQUIRED_DLLS = ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll', 'merlin_cloud_redirect.dll'];
const REQUIRED_STEAM_FILES = [
    ...REQUIRED_DLLS.map(name => ({ name, sourceName: name, relativeDestination: name })),
    {
        name: 'merlin-helper.dll',
        sourceName: 'merlin-helper.dll',
        relativeDestination: 'merlin-helper.dll'
    }
];

function createSteamService({ fs, path, exec, platform, userProfile }) {
    let lastActiveAccountId = null;
    function parseQuotedVdf(raw) {
        const source = String(raw || '');
        const tokens = [];
        const matcher = /"((?:\\.|[^"])*)"|([{}])/g;
        let match;

        while ((match = matcher.exec(source)) !== null) {
            if (match[2]) {
                tokens.push({ type: match[2] });
            } else {
                tokens.push({
                    type: 'string',
                    value: match[1]
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\')
                });
            }
        }

        let index = 0;

        function parseObject() {
            const result = {};

            while (index < tokens.length) {
                const token = tokens[index];
                if (token.type === '}') {
                    index += 1;
                    break;
                }
                if (token.type !== 'string') {
                    index += 1;
                    continue;
                }

                const key = token.value;
                index += 1;
                const valueToken = tokens[index];

                if (!valueToken) {
                    result[key] = '';
                    break;
                }

                if (valueToken.type === '{') {
                    index += 1;
                    result[key] = parseObject();
                    continue;
                }

                if (valueToken.type === 'string') {
                    result[key] = valueToken.value;
                    index += 1;
                    continue;
                }

                if (valueToken.type === '}') {
                    result[key] = '';
                    break;
                }
            }

            return result;
        }

        return parseObject();
    }

    function safeReadVdf(filePath) {
        try {
            if (!fs.existsSync(filePath)) return null;
            return parseQuotedVdf(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.warn(`Unable to parse Steam VDF ${filePath}:`, error.message);
            return null;
        }
    }

    function getActivationReadiness(steamPath) {
        if (!steamPath || typeof steamPath !== 'string') {
            return { ok: false, reason: 'steam_path_missing', missing: [] };
        }

        const resolvedPath = path.resolve(steamPath);
        if (!fs.existsSync(resolvedPath)
            || !fs.statSync(resolvedPath).isDirectory()
            || !fs.existsSync(path.join(resolvedPath, 'steam.exe'))) {
            return { ok: false, reason: 'steam_path_invalid', missing: [] };
        }

        const missing = REQUIRED_STEAM_FILES.filter(file =>
            !fs.existsSync(path.join(resolvedPath, file.relativeDestination))
        ).map(file => file.name);
        if (missing.length > 0) {
            return { ok: false, reason: 'required_files_missing', missing };
        }

        return { ok: true, reason: null, missing: [] };
    }

    function findDefaultPath() {
        const possiblePaths = [
            'C:\\Program Files (x86)\\Steam',
            'C:\\Program Files\\Steam',
            'D:\\Steam',
            'E:\\Steam',
            path.join(userProfile || '', 'Steam')
        ];

        return possiblePaths.find(steamPath =>
            fs.existsSync(path.join(steamPath, 'steam.exe'))
        ) || null;
    }

    function isRunning() {
        return new Promise(resolve => {
            if (platform === 'win32') {
                exec('tasklist', (error, stdout) => {
                    resolve(!error && stdout.toLowerCase().includes('steam.exe'));
                });
            } else {
                exec('pgrep steam', error => resolve(!error));
            }
        });
    }

    function close(steamPath) {
        return new Promise(resolve => {
            if (platform === 'win32') {
                const steamExe = path.join(steamPath, 'steam.exe');
                exec(`"${steamExe}" -shutdown`, () => {
                    setTimeout(() => {
                        // Steam can leave helper processes alive, which keep its DLLs locked.
                        exec('taskkill /F /T /IM steam.exe', () => {
                            setTimeout(async () => resolve(!(await isRunning())), 500);
                        });
                    }, 3000);
                });
            } else {
                exec('pkill -f steam', error => resolve(!error));
            }
        });
    }

    function start(steamPath) {
        return new Promise(resolve => {
            if (platform === 'win32') {
                exec(`"${path.join(steamPath, 'steam.exe')}"`, error => resolve(!error));
            } else {
                exec('steam', error => resolve(!error));
            }
        });
    }

    function accountFromCurrentSteamLog(steamPath) {
        if (!steamPath) return Promise.resolve(null);
        return new Promise(resolve => {
            const command = `powershell.exe -NoProfile -NonInteractive -Command "$p = @(Get-Process -Name steam -ErrorAction SilentlyContinue); if ($p.Count -eq 1) { $p[0].StartTime.ToUniversalTime().ToString('o') }"`;
            exec(command, (error, stdout) => {
                const start = Date.parse(String(stdout || '').trim());
                if (error || !Number.isFinite(start)) return resolve(null);
                try {
                    const loginUsers = safeReadVdf(path.join(steamPath, 'config', 'loginusers.vdf'));
                    const users = loginUsers?.users;
                    if (!users || typeof users !== 'object') return resolve(null);
                    const log = fs.readFileSync(path.join(steamPath, 'logs', 'connection_log.txt'), 'utf8');
                    let account = null;
                    for (const line of String(log).split(/\r?\n/)) {
                        const match = line.match(/^\[(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)\] \[([^\]]+)\] \[U:1:(\d+)\] (.*)$/);
                        if (!match) continue;
                        const when = Date.parse(`${match[1]}T${match[2]}`);
                        if (!Number.isFinite(when) || when < start - 2000) continue;
                        const status = match[3], id = match[4], message = match[5];
                        if (/^Logged Off|^Logging On/.test(status) || /\bLogOn\(\) called|\bLogOff\b/i.test(message)) account = null;
                        if (/^Logged On/.test(status) && /RecvMsgClientLogOnResponse\(\) : processing complete/.test(message)) {
                            const value = Number(id);
                            const steamId = Number.isSafeInteger(value) && value > 0 ? (76561197960265728n + BigInt(value)).toString() : '';
                            account = steamId && Object.hasOwn(users, steamId) ? id : null;
                        }
                    }
                    resolve(account);
                } catch (_) { resolve(null); }
            });
        });
    }

    function getActiveAccountId({ liveOnly = false, steamPath = null } = {}) {
        if (platform !== 'win32') return Promise.resolve(null);
        return new Promise(resolve => {
            exec('reg query "HKCU\\Software\\Valve\\Steam\\ActiveProcess" /v ActiveUser', (error, stdout) => {
                const match = !error && String(stdout || '').match(/ActiveUser\s+REG_(?:DWORD|QWORD)\s+([^\s]+)/i);
                const raw = match?.[1]?.replace(/^0x/i, '');
                const value = raw ? (/^0x/i.test(match[1]) ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10)) : 0;
                if (Number.isSafeInteger(value) && value > 0) {
                    // Steam can briefly expose a placeholder ActiveUser while switching
                    // accounts. Do not turn that into a valid but empty cloud list.
                    // Only use loginusers to validate the live ID, never to guess one.
                    if (steamPath) {
                        const loginUsers = safeReadVdf(path.join(steamPath, 'config', 'loginusers.vdf'));
                        const users = loginUsers?.users;
                        const ids = users && typeof users === 'object'
                            ? Object.keys(users).filter(id => /^\d{17}$/.test(id)) : [];
                        if (ids.length) {
                            const steamId = (76561197960265728n + BigInt(value)).toString();
                            if (!ids.includes(steamId)) {
                                accountFromCurrentSteamLog(steamPath).then(account => {
                                    if (account) lastActiveAccountId = account;
                                    resolve(account);
                                });
                                return;
                            }
                        }
                    }
                    lastActiveAccountId = String(value);
                    resolve(lastActiveAccountId);
                } else {
                    // After Steam exits, ActiveUser becomes zero. Keep only the
                    // account observed in this Merlin process; loginusers.vdf
                    // cannot tell which profile the user will choose next.
                    if (!liveOnly) return resolve(lastActiveAccountId);
                    accountFromCurrentSteamLog(steamPath).then(account => {
                        if (account) lastActiveAccountId = account;
                        resolve(account);
                    });
                }
            });
        });
    }

    function getFilesStatus(steamPath) {
        if (!steamPath || !fs.existsSync(steamPath)) {
            return { ok: false, reason: 'steam_path_missing', missing: [] };
        }
        const missing = REQUIRED_STEAM_FILES.filter(file =>
            !fs.existsSync(path.join(steamPath, file.relativeDestination))
        ).map(file => file.name);
        return {
            ok: missing.length === 0,
            reason: missing.length === 0 ? null : 'required_files_missing',
            missing
        };
    }

    function getLibraryFolders(steamPath) {
        if (!steamPath || typeof steamPath !== 'string') return [];
        const resolvedSteamPath = path.resolve(steamPath);
        const folders = new Set([resolvedSteamPath]);
        const libraryFoldersPath = path.join(resolvedSteamPath, 'steamapps', 'libraryfolders.vdf');
        const parsed = safeReadVdf(libraryFoldersPath);
        const libraries = parsed?.libraryfolders;

        if (libraries && typeof libraries === 'object') {
            for (const [key, value] of Object.entries(libraries)) {
                if (!/^\d+$/.test(key) || !value || typeof value !== 'object') continue;
                const libraryPath = typeof value.path === 'string'
                    ? path.resolve(value.path)
                    : '';
                if (libraryPath) folders.add(libraryPath);
            }
        }

        return [...folders];
    }

    function findInstalledGame(appId, steamPath) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) {
            return { installed: false, code: 'invalid_app_id' };
        }

        const readiness = getActivationReadiness(steamPath);
        if (readiness.reason === 'steam_path_missing' || readiness.reason === 'steam_path_invalid') {
            return { installed: false, code: readiness.reason };
        }

        for (const libraryPath of getLibraryFolders(steamPath)) {
            const manifestPath = path.join(libraryPath, 'steamapps', `appmanifest_${appId}.acf`);
            if (!fs.existsSync(manifestPath)) continue;

            const parsed = safeReadVdf(manifestPath);
            const appState = parsed?.AppState;
            const manifestAppId = String(appState?.appid || '').trim();
            const installDir = String(appState?.installdir || '').trim();

            if (manifestAppId !== appId || !installDir) continue;

            const gamePath = path.join(libraryPath, 'steamapps', 'common', installDir);
            if (!fs.existsSync(gamePath)) continue;

            try {
                if (!fs.statSync(gamePath).isDirectory()) continue;
            } catch {
                continue;
            }

            return {
                installed: true,
                appId,
                libraryPath,
                manifestPath,
                installDir,
                gamePath
            };
        }

        return { installed: false, code: 'not_installed' };
    }

    return {
        close,
        findInstalledGame,
        findDefaultPath,
        getLibraryFolders,
        getActivationReadiness,
        getActiveAccountId,
        getFilesStatus,
        isRunning,
        start
    };
}

module.exports = { REQUIRED_DLLS, REQUIRED_STEAM_FILES, createSteamService };
