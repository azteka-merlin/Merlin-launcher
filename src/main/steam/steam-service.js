const REQUIRED_DLLS = ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll'];
const REQUIRED_STEAM_FILES = [
    ...REQUIRED_DLLS.map(name => ({ name, sourceName: name, relativeDestination: name })),
    {
        name: 'merlin-helper.dll',
        sourceName: 'merlin-helper.dll',
        relativeDestination: 'merlin-helper.dll'
    }
];

function createSteamService({ fs, path, exec, platform, userProfile }) {
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
        getFilesStatus,
        isRunning,
        start
    };
}

module.exports = { REQUIRED_DLLS, REQUIRED_STEAM_FILES, createSteamService };
