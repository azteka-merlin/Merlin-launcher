function registerGameCoversIpc({ ipcMain, gameCoverService }) {
    ipcMain.handle('game-covers:load', (_event, appId, sourceUrl, allowRyuu) => gameCoverService.load(appId, sourceUrl, { allowRyuu: allowRyuu !== false }));
}
module.exports = { registerGameCoversIpc };
