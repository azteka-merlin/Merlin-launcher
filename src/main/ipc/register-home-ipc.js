function registerHomeIpc({ ipcMain, homeContentService }) {
    ipcMain.handle('home:get', async (_event, payload) => homeContentService.get({ force: payload?.force === true }));
    ipcMain.handle('home:refresh', async () => homeContentService.refresh());
    ipcMain.handle('home:check-for-update', async () => homeContentService.checkForUpdate());
}

module.exports = { registerHomeIpc };
