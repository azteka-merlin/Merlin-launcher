function registerCustomGamesIpc({ ipcMain, service, getMainWindow = () => null }) {
    service.subscribeProgress?.(progress => {
        const window = getMainWindow();
        if (window && !window.isDestroyed?.() && !window.webContents.isDestroyed()) {
            window.webContents.send('custom-games:progress', progress);
        }
    });
    ipcMain.handle('custom-games:list', () => service.list());
    ipcMain.handle('custom-games:refresh', () => service.refresh());
    ipcMain.handle('custom-games:drives', (_event, id) => service.listDrives(id));
    ipcMain.handle('custom-games:install', (_event, { id, drive }) => service.install(id, drive));
    ipcMain.handle('custom-games:verify', (_event, id) => service.verify(id));
    ipcMain.handle('custom-games:update', (_event, id) => service.update(id));
    ipcMain.handle('custom-games:repair', (_event, id) => service.repair(id));
    ipcMain.handle('custom-games:cancel', () => service.cancel());
    ipcMain.handle('custom-games:play', (_event, id) => service.play(id));
    ipcMain.handle('custom-games:open-folder', (_event, id) => service.openFolder(id));
    ipcMain.handle('custom-games:uninstall', (_event, id) => service.uninstall(id));
}

module.exports = { registerCustomGamesIpc };
