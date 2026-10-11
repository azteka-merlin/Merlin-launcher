const SPECIAL_CORRECTION_APP_ID = '4407750';
const SPECIAL_CORRECTION_ACTIVATION_TYPE = 'license_token';
const LICENSE_FILE_NAME = '16425884_sc.dlf';
const PLACEHOLDER = 'RETORNO_TOKEN_MERLIN';
const MAX_LICENSE_FILE_BYTES = 1024 * 1024;
const DEFAULT_EA_APP_GAME_PATH = 'C:\\Program Files\\EA Games\\EA SPORTS FC 27';

function createDomainError(code, message) {
    const error = new Error(message || code);
    error.code = code;
    return error;
}

function countOccurrences(value, needle) {
    return value.split(needle).length - 1;
}

function findTemplate(fs, path, rootPath, filename) {
    const matches = [];
    const pending = [rootPath];

    while (pending.length > 0) {
        const current = pending.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) {
                throw createDomainError('token_templates_invalid', 'Symbolic links are not allowed in this correction.');
            }
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) pending.push(entryPath);
            else if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) matches.push(entryPath);
        }
    }

    if (matches.length !== 1) {
        throw createDomainError('token_templates_invalid', `Expected exactly one ${filename} template.`);
    }
    return matches[0];
}

function replaceTemplate(fs, filePath, token) {
    const original = fs.readFileSync(filePath, 'utf8');
    if (countOccurrences(original, PLACEHOLDER) !== 1) {
        throw createDomainError('token_templates_invalid', 'The correction template is invalid.');
    }
    return original.split(PLACEHOLDER).join(token);
}

function createSpecialCorrection({
    fs,
    path,
    programDataPath,
    licenseTokenClient,
    eaAppGamePath = DEFAULT_EA_APP_GAME_PATH
}) {
    function appliesTo(item) {
        // AppID is the authoritative local guard so an old/stale catalog cache
        // can never install the unprepared templates.
        return item?.appId === SPECIAL_CORRECTION_APP_ID;
    }

    function findInstallations({ item, steamInstallation = null }) {
        if (!appliesTo(item)) {
            return steamInstallation?.installed ? [steamInstallation] : [];
        }

        const installations = [];
        if (steamInstallation?.installed) {
            installations.push({
                ...steamInstallation,
                platform: 'steam'
            });
        }

        try {
            if (eaAppGamePath && fs.existsSync(eaAppGamePath) && fs.statSync(eaAppGamePath).isDirectory()) {
                installations.push({
                    installed: true,
                    appId: SPECIAL_CORRECTION_APP_ID,
                    platform: 'ea_app',
                    gamePath: eaAppGamePath
                });
            }
        } catch {
            // An inaccessible EA App directory is treated as not installed.
        }

        const seenPaths = new Set();
        return installations.filter(installation => {
            const normalizedPath = path.resolve(installation.gamePath).toLowerCase();
            if (seenPaths.has(normalizedPath)) return false;
            seenPaths.add(normalizedPath);
            return true;
        });
    }

    async function prepare({ item, extractedPath }) {
        if (!appliesTo(item)) return { applied: false };

        const licensePath = path.join(
            String(programDataPath || ''),
            'Electronic Arts',
            'EA Services',
            'License',
            LICENSE_FILE_NAME
        );
        if (!programDataPath || !fs.existsSync(licensePath)) {
            throw createDomainError('license_file_missing', 'The required license file was not found.');
        }

        const licenseStats = fs.statSync(licensePath);
        if (!licenseStats.isFile() || licenseStats.size <= 0) {
            throw createDomainError('license_file_invalid', 'The required license file is invalid.');
        }
        if (licenseStats.size > MAX_LICENSE_FILE_BYTES) {
            throw createDomainError('license_file_too_large', 'The required license file is too large.');
        }

        const anadiusConfigPath = findTemplate(fs, path, extractedPath, 'anadius.cfg');
        const licenseBytes = fs.readFileSync(licensePath);
        const token = await licenseTokenClient.generate({
            appId: SPECIAL_CORRECTION_APP_ID,
            licenseBytes
        });
        if (typeof token !== 'string' || !token) {
            throw createDomainError('token_request_failed', 'The API returned an invalid token.');
        }

        const anadiusConfig = replaceTemplate(fs, anadiusConfigPath, token);
        fs.writeFileSync(anadiusConfigPath, anadiusConfig, 'utf8');
        return { applied: true };
    }

    return { appliesTo, findInstallations, prepare };
}

module.exports = {
    DEFAULT_EA_APP_GAME_PATH,
    LICENSE_FILE_NAME,
    MAX_LICENSE_FILE_BYTES,
    PLACEHOLDER,
    SPECIAL_CORRECTION_ACTIVATION_TYPE,
    SPECIAL_CORRECTION_APP_ID,
    createSpecialCorrection
};
