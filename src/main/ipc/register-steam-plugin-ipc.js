function registerSteamPluginIpc({ ipcMain, steamPluginService, stopSteam, isSteamRunning, configStore, onStateChanged, onStartAtLoginChanged }) {
    ipcMain.handle('steam-plugin:status', () => steamPluginService.status());
    ipcMain.handle('steam-plugin:install', async () => {
        const steamWasRunning = await isSteamRunning();
        if (steamWasRunning && !await stopSteam()) {
            return { success: false, code: 'steam_close_failed', message: 'Não foi possível fechar a Steam para instalar o plugin.' };
        }
        const status = await steamPluginService.install();
        onStateChanged?.(true);
        return { success: true, ...status, steamWasRunning };
    });
    ipcMain.handle('steam-plugin:uninstall', async () => {
        const steamWasRunning = await isSteamRunning();
        if (steamWasRunning && !await stopSteam()) {
            return { success: false, code: 'steam_close_failed', message: 'Não foi possível fechar a Steam para remover o plugin.' };
        }
        const status = await steamPluginService.uninstall();
        onStateChanged?.(false);
        return { success: true, ...status, steamWasRunning };
    });
    ipcMain.handle('steam-plugin:set-start-at-login', (_event, enabled) => {
        const plugin = configStore.get().steamPlugin || {};
        if (!plugin.enabled) return { success: false, code: 'plugin_disabled', enabled: false };
        const startAtLogin = enabled === true;
        configStore.update({ steamPlugin: { ...plugin, startAtLogin } });
        onStartAtLoginChanged?.(startAtLogin);
        return { success: true, enabled: startAtLogin };
    });
}

module.exports = { registerSteamPluginIpc };
