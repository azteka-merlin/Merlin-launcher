function registerCustomGamesIpc({ ipcMain, service }) {
    ipcMain.handle('custom-games:list', () => service.list());
    ipcMain.handle('custom-games:refresh', () => service.refresh());
    ipcMain.handle('custom-games:drives', () => service.listDrives());
    ipcMain.handle('custom-games:install', (event, { id, drive }) =>
        service.install(id, drive, progress => {
            if (!event.sender.isDestroyed()) event.sender.send('custom-games:progress', progress);
        }));
    ipcMain.handle('custom-games:cancel', () => service.cancel());
    ipcMain.handle('custom-games:play', (_event, id) => service.play(id));
    ipcMain.handle('custom-games:open-folder', (_event, id) => service.openFolder(id));
    ipcMain.handle('custom-games:uninstall', (_event, id) => service.uninstall(id));
}

module.exports = { registerCustomGamesIpc };
