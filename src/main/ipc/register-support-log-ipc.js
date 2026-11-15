const fs = require('node:fs/promises');
const path = require('node:path');
const { collectRecentSteamIntegrationLog, collectRecentGameAddLog } = require('../support/steam-integration-log');

function registerSupportLogIpc({ ipcMain, clipboard, dialog, getMainWindow, getDownloadsPath, localAppData }) {
    ipcMain.handle('support:export-steam-log', async () => {
        let content;
        try {
            const [steamLog, gameAddLog] = await Promise.all([
                collectRecentSteamIntegrationLog({ localAppData }),
                collectRecentGameAddLog({ localAppData })
            ]);
            content = [
                steamLog && `=== Integração com a Steam ===\n${steamLog}`,
                gameAddLog && `=== Adicionar jogos (reconhecimento pela Steam não verificado) ===\n${gameAddLog}`
            ].filter(Boolean).join('\n');
        } catch {
            return { status: 'read_failed' };
        }
        if (!content) return { status: 'empty' };

        try {
            clipboard.writeText(content);
        } catch {
            return { status: 'copy_failed' };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let saveResult;
        try {
            saveResult = await dialog.showSaveDialog(getMainWindow(), {
                defaultPath: path.join(getDownloadsPath(), `merlin_steam_integration_${timestamp}.txt`),
                filters: [{ name: 'TXT', extensions: ['txt'] }]
            });
        } catch {
            return { status: 'save_failed' };
        }
        if (!saveResult || saveResult.canceled || !saveResult.filePath) return { status: 'copied' };

        const logDirectory = path.join(localAppData, 'Merlin', 'logs');
        const destination = path.resolve(saveResult.filePath).toLowerCase();
        const sourceFiles = ['merlin_steam_integration.log', 'merlin_steam_integration.log.1',
            'merlin_game_add.log', 'merlin_game_add.log.1'];
        if (sourceFiles.some(name => destination === path.resolve(logDirectory, name).toLowerCase())) {
            return { status: 'save_failed' };
        }

        try {
            await fs.writeFile(saveResult.filePath, content, 'utf8');
            return { status: 'saved' };
        } catch {
            return { status: 'save_failed' };
        }
    });
}

module.exports = { registerSupportLogIpc };
