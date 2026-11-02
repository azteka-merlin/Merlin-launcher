function registerPremiumIpc({ ipcMain, premiumService }) {
    ipcMain.handle('premium:list', async (_event, payload) =>
        premiumService.list({ force: payload?.force === true }));
    ipcMain.handle('premium:refresh', async () => premiumService.refresh());
    for (const kind of ['wishlist', 'slot-watch']) {
        ipcMain.handle(`premium:${kind}`, async (_event, payload) => premiumService.accountAction({
            kind, appId: String(payload?.appId || ''), remove: payload?.remove === true,
            data: { email: payload?.email, ...(kind === 'wishlist' ? { phone: payload?.phone, phoneConsent: payload?.phoneConsent === true } : {}) }
        }));
    }
    ipcMain.handle('premium:operation-status', async (_event, operationId) => premiumService.accountAction({ kind: 'operation-status', operationId: String(operationId || '') }));
    ipcMain.handle('premium:activate', async (event, payload) =>
        premiumService.activate(
            payload?.appId,
            payload?.operationId,
            data => event.sender.send('premium:progress', data),
            { retryGrantId: payload?.retryGrantId }
        ));
    ipcMain.handle('premium:cancel', async (_event, operationId) =>
        premiumService.cancel(operationId));
    ipcMain.handle('premium:open-game-folder', async (_event, appId) =>
        premiumService.openGameFolder(appId));
}

module.exports = { registerPremiumIpc };
