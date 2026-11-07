function registerGameCoversIpc({ ipcMain, gameCoverService }) {
    ipcMain.handle('game-covers:load', (_event, appId, sourceUrl) => gameCoverService.load(appId,sourceUrl));
}
module.exports = { registerGameCoversIpc };
