const crypto = require('crypto');

const MESSAGES = {
    ptbr: {
        msg: 'Arquivos necessários não encontrados. Deseja instalá-los agora?',
        detail: 'Se a Steam estiver aberta, ela será fechada antes da instalação.',
        closeFailed: 'Não foi possível fechar a Steam. Feche-a e tente novamente.',
        yes: 'Sim',
        no: 'Não'
    },
    en: {
        msg: 'Required files not found. Would you like to install them now?',
        detail: 'If Steam is open, it will be closed before installation.',
        closeFailed: 'Steam could not be closed. Close Steam and try again.',
        yes: 'Yes',
        no: 'No'
    },
    es: {
        msg: 'Archivos necesarios no encontrados. ¿Desea instalarlos ahora?',
        detail: 'Si Steam está abierto, se cerrará antes de la instalación.',
        closeFailed: 'No se pudo cerrar Steam. Ciérralo e inténtalo de nuevo.',
        yes: 'Sí',
        no: 'No'
    },
    fr: {
        msg: 'Fichiers requis introuvables. Voulez-vous les installer maintenant ?',
        detail: 'Si Steam est ouvert, il sera fermé avant l’installation.',
        closeFailed: 'Impossible de fermer Steam. Fermez-le et réessayez.',
        yes: 'Oui',
        no: 'Non'
    },
    de: {
        msg: 'Erforderliche Dateien nicht gefunden. Möchten Sie diese jetzt installieren?',
        detail: 'Falls Steam geöffnet ist, wird es vor der Installation geschlossen.',
        closeFailed: 'Steam konnte nicht geschlossen werden. Schließe Steam und versuche es erneut.',
        yes: 'Ja',
        no: 'Nein'
    }
};

const LEGACY_DLLS = ['LumaCore.dll'];

function createDllInstaller({ fs, path, dialog, requiredFiles, getSourcePath, getMainWindow, isSteamRunning = async () => false, closeSteam = async () => false }) {
    const cloudRuntimeNames = new Set(['OpenSteamTool.dll', 'merlin_cloud_redirect.dll']);

    function sameContents(source, destination) {
        if (!fs.existsSync(source) || !fs.existsSync(destination)) return false;
        const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        try { return digest(source) === digest(destination); }
        catch (_) { return false; }
    }

    function cloudSupportReady(steamPath) {
        if (!steamPath || !fs.existsSync(path.join(steamPath, 'steam.exe'))) return false;
        return requiredFiles.every(file => {
            const destination = path.join(steamPath, file.relativeDestination);
            if (!fs.existsSync(destination)) return false;
            return !cloudRuntimeNames.has(file.name) || sameContents(getSourcePath(file), destination);
        });
    }

    function installCloudSupport(steamPath) {
        if (!steamPath || !fs.existsSync(path.join(steamPath, 'steam.exe'))) {
            const error = new Error('Steam installation not configured');
            error.code = 'steam_path_invalid';
            throw error;
        }
        // Validate every bundled file before changing the Steam directory.
        for (const file of requiredFiles) {
            if (!fs.existsSync(getSourcePath(file))) {
                const error = new Error(`Missing bundled Steam file: ${file.name}`);
                error.code = 'cloud_files_missing';
                throw error;
            }
        }
        const updated = [];
        for (const file of requiredFiles) {
            const source = getSourcePath(file);
            const destination = path.join(steamPath, file.relativeDestination);
            if (cloudRuntimeNames.has(file.name) ? sameContents(source, destination) : fs.existsSync(destination)) continue;
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(source, destination);
            updated.push(file.name);
        }
        if (!cloudSupportReady(steamPath)) {
            const error = new Error('Cloud runtime files could not be verified');
            error.code = 'cloud_files_install_failed';
            throw error;
        }
        notify(true);
        return { updated };
    }

    function notify(ok) {
        const mainWindow = getMainWindow();
        if (mainWindow?.webContents) {
            mainWindow.webContents.send('files-status', { ok });
        }
    }

    function removeLegacyDlls(steamPath) {
        for (const dll of LEGACY_DLLS) {
            const legacyPath = path.join(steamPath, dll);
            if (!fs.existsSync(legacyPath)) continue;
            fs.rmSync(legacyPath, { force: true });
            console.log(`Removed legacy DLL: ${legacyPath}`);
        }
    }

    function copyRequiredDlls(steamPath) {
        for (const file of requiredFiles) {
            const srcPath = getSourcePath(file);
            const destPath = path.join(steamPath, file.relativeDestination);
            // A repair should not reopen an already correct DLL for writing.
            // Windows may deny replacement even when that file needs no change.
            if (sameContents(srcPath, destPath)) continue;
            try {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
            } catch (error) {
                if (error && ['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) {
                    throw new Error(
                        `Merlin could not replace ${file.name} (${error.code}). The file may be in use or access may be denied.`,
                        { cause: error }
                    );
                }
                throw error;
            }
            console.log(`Installed: ${file.name} -> ${destPath}`);
        }
    }

    async function checkAndInstall(steamPath, lang = 'en') {
        const message = MESSAGES[lang] || MESSAGES.en;
        const missing = requiredFiles.filter(file => {
            const destination = path.join(steamPath, file.relativeDestination);
            return !sameContents(getSourcePath(file), destination);
        });

        if (missing.length === 0) {
            // A read-only check must not close Steam or try to remove a loaded DLL.
            if (!await isSteamRunning()) removeLegacyDlls(steamPath);
            notify(true);
            return { installed: false, alreadyInstalled: true, cancelled: false };
        }

        const { response } = await dialog.showMessageBox(getMainWindow(), {
            type: 'question',
            buttons: [message.yes, message.no],
            defaultId: 0,
            title: 'Merlin',
            message: message.msg,
            detail: message.detail
        });

        if (response === 0) {
            for (const file of requiredFiles) {
                const srcPath = getSourcePath(file);
                if (!fs.existsSync(srcPath)) {
                    throw new Error(`Native DLL build output not found: ${srcPath}`);
                }
            }

            if (await isSteamRunning()) {
                if (!await closeSteam(steamPath) || await isSteamRunning()) {
                    const error = new Error(message.closeFailed);
                    error.code = 'steam_close_failed';
                    throw error;
                }
            }

            copyRequiredDlls(steamPath);

            removeLegacyDlls(steamPath);
            notify(true);
            return { installed: true, alreadyInstalled: false, cancelled: false };
        }

        notify(false);
        return { installed: false, alreadyInstalled: false, cancelled: true };
    }

    return { checkAndInstall, cloudSupportReady, installCloudSupport };
}

module.exports = { LEGACY_DLLS, createDllInstaller };
