function registerReleaseNotesIpc({ ipcMain, releaseNotesService }) {
    ipcMain.handle('release-notes:get', (_event, payload) => releaseNotesService.get(payload));
    ipcMain.handle('release-notes:refresh', (_event, payload) => releaseNotesService.refresh(payload?.locale));
    ipcMain.handle('release-notes:mark-seen', (_event, version) => releaseNotesService.markSeen(version));
}

module.exports = { registerReleaseNotesIpc };
