function registerLibraryIpc({ ipcMain, libraryService }) {
    function refreshMetadata(event, force = false) {
        if (!libraryService.refreshMetadata) return;
        void libraryService.refreshMetadata({ force }).then(result => {
            if (result.success && result.changed && !event.sender.isDestroyed?.()) {
                event.sender.send('library:updated', result.items);
            }
        }).catch(error => console.warn('Unable to publish Library metadata:', error.message));
    }
    ipcMain.handle('library:list', async event => {
        const result = await libraryService.list();
        if (result.success) refreshMetadata(event);
        return result;
    });

    ipcMain.handle('library:refresh', async event => {
        event.sender.send('library:operation-progress', { operation: 'refresh', active: true });
        try {
            const result = await libraryService.list({ force: true });
            if (result.success) event.sender.send('library:updated', result.items);
            if (result.success) refreshMetadata(event, true);
            return result;
        } finally {
            event.sender.send('library:operation-progress', { operation: 'refresh', active: false });
        }
    });

    ipcMain.handle('library:remove', async (event, appId) => {
        event.sender.send('library:operation-progress', { operation: 'remove', active: true });
        try {
            const result = await libraryService.remove(appId);
            if (result.success) {
                const refreshed = await libraryService.list();
                if (refreshed.success) {
                    event.sender.send('library:updated', refreshed.items);
                    return { ...result, items: refreshed.items };
                }
            }
            return result;
        } finally {
            event.sender.send('library:operation-progress', { operation: 'remove', active: false });
        }
    });

    ipcMain.handle('library:restart-steam', async () => libraryService.restartSteam());
    ipcMain.handle('library:open-game-folder', async (_event, appId) =>
        libraryService.openGameFolder(appId));
}

module.exports = { registerLibraryIpc };
