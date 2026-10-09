function registerCloudSyncIpc({ ipcMain, cloudSyncService, dllInstaller, getSteamPath, getSteamReadiness, getSteamAccountId, isSteamRunning, stopSteam, onStateChanged }) {
    let busy = false;
    const status = () => ({
        ...cloudSyncService.status(),
        filesReady: dllInstaller.cloudSupportReady(getSteamPath())
    });
    ipcMain.handle('cloud-sync:status', status);
    ipcMain.handle('cloud-sync:enable', async () => {
        if (busy) return { success: false, code: 'busy' };
        busy = true;
        let steamWasRunning = false;
        let steamStopped = false;
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
                    await cloudSyncService.disable();
                    return { success: false, code: 'steam_close_failed' };
                }
                steamStopped = true;
            }
            dllInstaller.installCloudSupport(getSteamPath());
            onStateChanged?.();
            return { success: true, steamWasRunning, ...status() };
        } catch (error) {
            if (cloudSyncService.status().enabled) {
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
        const result = await cloudSyncService.renew();
        return { ...result, filesReady: dllInstaller.cloudSupportReady(getSteamPath()) };
    });
    ipcMain.handle('cloud-sync:list-games', async () => {
        if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
        const accountId = await getSteamAccountId?.();
        if (!accountId) return { success: false, code: 'steam_account_unavailable' };
        try {
            const result = await cloudSyncService.listGames(accountId);
            return { ...result, accountId };
        } catch (error) {
            return { success: false, code: error.response?.status === 401 ? 'auth_required' : error.code || 'cloud_games_failed' };
        }
    });
    ipcMain.handle('cloud-sync:get-game', async (_event, appId) => {
        if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
        const accountId = await getSteamAccountId?.();
        if (!accountId) return { success: false, code: 'steam_account_unavailable' };
        try {
            return { ...(await cloudSyncService.getGame(accountId, appId)), accountId };
        } catch (error) {
            return { success: false, code: error.response?.status === 401 ? 'auth_required' : error.code || 'cloud_game_failed' };
        }
    });
    ipcMain.handle('cloud-sync:restore', async (_event, appId, recoveryId) => {
        if (busy) return { success: false, code: 'busy' };
        if (!cloudSyncService.status().connected) return { success: false, code: 'cloud_disconnected' };
        if (await isSteamRunning()) return { success: false, code: 'steam_running' };
        const accountId = await getSteamAccountId?.();
        if (!accountId) return { success: false, code: 'steam_account_unavailable' };
        busy = true;
        try {
            return await cloudSyncService.restoreGame(accountId, appId, recoveryId);
        } catch (error) {
            return { success: false, code: error.response?.status === 401 ? 'auth_required' : error.code || 'cloud_restore_failed' };
        } finally { busy = false; }
    });
    ipcMain.handle('cloud-sync:ack-steam-restart', () => cloudSyncService.acknowledgeSteamRestart());
}

module.exports = { registerCloudSyncIpc };
