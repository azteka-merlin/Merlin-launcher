const path = require('path');
const { saveFolders } = require('../cloud-sync/cloud-save-folders');
const { exportCloudSave } = require('../cloud-sync/cloud-save-export');
function defaultCloudSaveFilename(gameName, appId, now = new Date()) {
    const name = String(gameName || '').slice(0, 300).normalize('NFKD').replace(/\p{M}/gu, '')
        .toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/g, '') || String(appId);
    const two = value => String(value).padStart(2, '0');
    const stamp = [two(now.getDate()), two(now.getMonth() + 1), String(now.getFullYear()).slice(-2),
        two(now.getHours()), two(now.getMinutes())].join('-');
    return `save-${name}-${stamp}.zip`;
}
const dialogText = {
    ptbr: { folders: 'Pastas de save', choose: 'Este jogo usa mais de uma pasta de save. Qual deseja abrir?', cancel: 'Cancelar', export: 'Exportar save', zip: 'Arquivo ZIP' },
    en: { folders: 'Save folders', choose: 'This game uses more than one save folder. Which one would you like to open?', cancel: 'Cancel', export: 'Export save', zip: 'ZIP archive' },
    es: { folders: 'Carpetas de partidas', choose: 'Este juego usa más de una carpeta de partidas. ¿Cuál quieres abrir?', cancel: 'Cancelar', export: 'Exportar partida', zip: 'Archivo ZIP' },
    fr: { folders: 'Dossiers de sauvegarde', choose: 'Ce jeu utilise plusieurs dossiers de sauvegarde. Lequel ouvrir ?', cancel: 'Annuler', export: 'Exporter la sauvegarde', zip: 'Archive ZIP' },
    de: { folders: 'Spielstandordner', choose: 'Dieses Spiel verwendet mehrere Spielstandordner. Welchen möchtest du öffnen?', cancel: 'Abbrechen', export: 'Spielstand exportieren', zip: 'ZIP-Archiv' }
};

function registerCloudSyncIpc({ ipcMain, cloudSyncService, dllInstaller, getSteamPath, getSteamReadiness,
    getSteamAccountId, isSteamRunning, stopSteam, startSteam, onStateChanged, localAppData, dialog, shell, getLanguage }) {
    let busy = false;
    let exportBusy = false;
    const labels = () => dialogText[getLanguage?.()] || dialogText.ptbr;
    const status = () => ({
        ...cloudSyncService.status(),
        filesReady: dllInstaller.cloudSupportReady(getSteamPath())
    });
    ipcMain.handle('cloud-sync:status', status);
    ipcMain.handle('cloud-sync:account-status', async () => {
        const steamRunning = await isSteamRunning();
        const accountId = steamRunning ? await getSteamAccountId?.({ liveOnly: true }) : null;
        return { steamRunning, accountAvailable: Boolean(accountId), accountId: accountId || null };
    });
    ipcMain.handle('cloud-sync:enable', async () => {
        if (busy) return { success: false, code: 'busy' };
        busy = true;
        let steamWasRunning = false;
        let steamStopped = false;
        const wasEnabled = cloudSyncService.status().enabled;
        try {
            if (!cloudSyncService.status().available) return { success: false, code: 'unavailable' };
            const readiness = getSteamReadiness();
            if (readiness.reason === 'steam_path_missing' || readiness.reason === 'steam_path_invalid') {
                return { success: false, code: 'steam_path_invalid' };
            }
            const connection = await cloudSyncService.enable();
            if (!connection.connected) return { success: false, code: connection.errorCode || 'connection_failed' };
            steamWasRunning = await isSteamRunning();
            if (steamWasRunning) {
                if (!await stopSteam()) {
                    if (!wasEnabled) await cloudSyncService.disable();
                    return { success: false, code: 'steam_close_failed' };
                }
                steamStopped = true;
            }
            dllInstaller.installCloudSupport(getSteamPath());
            onStateChanged?.();
            return { success: true, steamWasRunning, ...status() };
        } catch (error) {
            if (!wasEnabled && cloudSyncService.status().enabled) {
                try { await cloudSyncService.disable(); } catch (_) {}
            }
            onStateChanged?.();
            return {
                success: false,
                code: error.code === 'cloud_files_missing' ? 'cloud_files_missing'
                    : ['EACCES', 'EPERM'].includes(error.code) ? 'cloud_files_permission'
                    : 'activation_failed',
                steamWasRunning: steamStopped
            };
        } finally { busy = false; }
    });
    ipcMain.handle('cloud-sync:disable', async () => {
        if (busy) return { success: false, code: 'busy' };
        busy = true;
        let steamWasRunning = false;
        let steamStopped = false;
        try {
            steamWasRunning = await isSteamRunning();
            if (steamWasRunning && !await stopSteam()) {
                return { success: false, code: 'steam_close_failed' };
            }
            steamStopped = steamWasRunning;
            const result = await cloudSyncService.disable();
            onStateChanged?.();
            return { success: true, steamWasRunning, ...result };
        } catch (_) {
            return { success: false, code: 'deactivation_failed', steamWasRunning: steamStopped };
        } finally { busy = false; }
    });
    ipcMain.handle('cloud-sync:retry', async () => {
        const result = await cloudSyncService.retry();
        return { ...result, filesReady: dllInstaller.cloudSupportReady(getSteamPath()) };
    });
    ipcMain.handle('cloud-sync:cached-games', async () => {
        if (!cloudSyncService.status().connected || !await isSteamRunning()) return null;
        const accountId = await getSteamAccountId?.({ liveOnly: true });
        return accountId ? cloudSyncService.cachedGames(accountId) : null;
    });
    ipcMain.handle('cloud-sync:list-games', async () => {
        if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
        if (!await isSteamRunning()) return { success: false, code: 'steam_closed' };
        let accountId = await getSteamAccountId?.({ liveOnly: true });
        // Steam may publish its live account a moment after the process starts.
        // Retry briefly instead of treating that transition as an empty library.
        for (let attempt = 0; !accountId && attempt < 2; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 400));
            if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
            if (!await isSteamRunning()) return { success: false, code: 'steam_closed' };
            accountId = await getSteamAccountId?.({ liveOnly: true });
        }
        if (!accountId) return { success: false, code: 'steam_account_unavailable' };
        try {
            const result = await cloudSyncService.listGames(accountId);
            if (accountId !== await getSteamAccountId?.({ liveOnly: true })) {
                return { success: false, code: 'steam_account_changed' };
            }
            return { ...result, accountId };
        } catch (error) {
            return { success: false, code: error.response?.status === 401 ? 'auth_required' : error.code || 'cloud_games_failed' };
        }
    });
    ipcMain.handle('cloud-sync:get-game', async (_event, appId) => {
        if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
        // An already opened game can still refresh after a restore even if
        // Steam was closed in the meantime. The account is process-cached.
        const accountId = await getSteamAccountId?.();
        if (!accountId) return { success: false, code: 'steam_account_unavailable' };
        try {
            const result = await cloudSyncService.getGame(accountId, appId);
            return { ...result, accountId,
                saveFolderAvailable: saveFolders(localAppData, accountId, appId,
                    { hints: result.game?.localSaveHints, steamPath: getSteamPath() }).length > 0 };
        } catch (error) {
            return { success: false, code: error.response?.status === 401 ? 'auth_required'
                : error.code === 'ECONNABORTED' ? 'cloud_timeout'
                    : error.response?.status >= 500 ? 'cloud_server_error'
                        : error.response?.data?.code || error.code || 'cloud_game_failed' };
        }
    });
    ipcMain.handle('cloud-sync:open-save-folder', async (_event, appId) => {
        const accountId = await getSteamAccountId?.({ liveOnly: true });
        if (!accountId) return { success: false, code: 'steam_account_unavailable' };
        let folders = saveFolders(localAppData, accountId, appId);
        if (cloudSyncService.status().connected) {
            try {
                const details = await cloudSyncService.getGame(accountId, appId);
                folders = saveFolders(localAppData, accountId, appId,
                    { hints: details.game?.localSaveHints, steamPath: getSteamPath() });
            } catch { /* Keep the local-only result. */ }
        }
        if (!folders.length) return { success: false, code: 'save_folder_unavailable' };
        let selected = folders[0];
        if (folders.length > 1) {
            const wording = labels();
            const result = await dialog.showMessageBox({ type: 'question', title: wording.folders,
                message: wording.choose,
                buttons: [...folders, wording.cancel], cancelId: folders.length, noLink: true });
            if (result.response >= folders.length) return { success: false, code: 'cancelled' };
            selected = folders[result.response];
        }
        const error = await shell.openPath(selected);
        return error ? { success: false, code: 'save_folder_open_failed' } : { success: true };
    });
    ipcMain.handle('cloud-sync:export', async (_event, appId, versionId, gameName) => {
        if (exportBusy) return { success: false, code: 'busy' };
        if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
        const accountId = await getSteamAccountId?.({ liveOnly: true });
        if (!accountId || !/^[1-9]\d{0,9}$/.test(String(appId))
            || !(versionId === 'current' || /^[a-f0-9]{64}$/.test(String(versionId)))) {
            return { success: false, code: 'cloud_export_invalid' };
        }
        exportBusy = true;
        try {
            const wording = labels();
            const result = await dialog.showSaveDialog({ title: wording.export,
                defaultPath: defaultCloudSaveFilename(gameName, appId),
                filters: [{ name: wording.zip, extensions: ['zip'] }] });
            if (result.canceled || !result.filePath) return { success: false, code: 'cancelled' };
            const destination = path.extname(result.filePath).toLowerCase() === '.zip'
                ? result.filePath : `${result.filePath}.zip`;
            return await exportCloudSave({ accountId, appId, versionId, destination,
                getManifest: cloudSyncService.getExportManifest,
                getFile: cloudSyncService.getExportFile });
        } catch (error) {
            return { success: false, code: error.response?.data?.code || error.code || 'cloud_export_failed' };
        } finally { exportBusy = false; }
    });
    ipcMain.handle('cloud-sync:restore', async (_event, appId, recoveryId) => {
        if (busy) return { success: false, code: 'busy' };
        if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
        const accountId = await getSteamAccountId?.();
        if (!accountId) return { success: false, code: 'steam_account_unavailable' };
        busy = true;
        try {
            const result = await cloudSyncService.restoreGame(accountId, appId, recoveryId);
            if (!result?.success) {
                console.warn('[cloud-sync:restore] rejected', { code: result?.code || 'unknown' });
                return result;
            }
            if (!result.restartSteam) return result;
            try {
                const running = await isSteamRunning();
                if (running && !await stopSteam()) {
                    return { ...result, steamRestarted: false, steamRestartCode: 'steam_close_failed' };
                }
                const started = await startSteam();
                const steamRestarted = Boolean(started || await isSteamRunning());
                return { ...result, steamRestarted,
                    ...(!steamRestarted ? { steamRestartCode: 'steam_start_failed' } : {}) };
            } catch {
                return { ...result, steamRestarted: false, steamRestartCode: 'steam_restart_failed' };
            }
        } catch (error) {
            const status = error.response?.status;
            console.warn('[cloud-sync:restore] request failed', {
                status: status || null, code: error.response?.data?.code || error.code || 'unknown'
            });
            return {
                success: false,
                code: status === 401 ? 'auth_required'
                    : error.response?.data?.code
                        || (status === 404 ? 'recovery_not_found'
                            : status === 409 ? 'recovery_conflict'
                                : status >= 500 ? 'cloud_server_error'
                                    : error.code === 'ECONNABORTED' ? 'cloud_timeout'
                                        : error.code || 'cloud_restore_failed')
            };
        } finally { busy = false; }
    });
    ipcMain.handle('cloud-sync:ack-steam-restart', () => cloudSyncService.acknowledgeSteamRestart());
}

module.exports = { registerCloudSyncIpc, defaultCloudSaveFilename };
