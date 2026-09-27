const { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, session, shell, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { exec, execFile } = require('child_process');
const axios = require('axios');
const AdmZip = require('adm-zip');
const nodeUnrar = require('node-unrar-js');

const MERLIN_WINDOW_ICON_PATH = path.join(__dirname, 'assets/merlin-window-icon.png');
const MERLIN_TRAY_ICON_PATH = path.join(__dirname, 'assets/merlin-tray.ico');

const { createConfigStore } = require('./src/main/config/config-store');
const { createCorrectionsCatalogClient } = require('./src/main/corrections/corrections-catalog-client');
const { createCorrectionsCatalogStore } = require('./src/main/corrections/corrections-catalog-store');
const { createCorrectionsService } = require('./src/main/corrections/corrections-service');
const { createLicenseTokenClient } = require('./src/main/corrections/license-token-client');
const { createSpecialCorrection } = require('./src/main/corrections/special-correction');
const { createAuthSession } = require('./src/main/auth/auth-session');
const { createAnnouncementsClient } = require('./src/main/announcements/announcements-client');
const { createAnnouncementsService } = require('./src/main/announcements/announcements-service');
const { installLuaFile } = require('./src/main/files/lua-transformer');
const { createAddGamesService } = require('./src/main/games/add-games-service');
const { createGameNameResolver } = require('./src/main/games/game-name-resolver');
const { createGameQueue } = require('./src/main/games/game-queue');
const { createGameSearchClient } = require('./src/main/games/game-search-client');
const { createGameInstaller } = require('./src/main/games/game-installer');
const { createManifestOverrideService } = require('./src/main/games/manifest-override-service');
const { parseSteamGameLink } = require('./src/main/games/steam-link-parser');
const { registerCorrectionsIpc } = require('./src/main/ipc/register-corrections-ipc');
const { registerExistingIpc } = require('./src/main/ipc/register-existing-ipc');
const { registerAuthIpc } = require('./src/main/ipc/register-auth-ipc');
const { registerAnnouncementsIpc } = require('./src/main/ipc/register-announcements-ipc');
const { registerGamesIpc } = require('./src/main/ipc/register-games-ipc');
const { registerLibraryIpc } = require('./src/main/ipc/register-library-ipc');
const { registerPremiumIpc } = require('./src/main/ipc/register-premium-ipc');
const { registerPollsIpc } = require('./src/main/ipc/register-polls-ipc');
const { registerSteamPluginIpc } = require('./src/main/ipc/register-steam-plugin-ipc');
const { createLibraryCacheStore } = require('./src/main/library/library-cache-store');
const { createLibraryCatalogClient } = require('./src/main/library/library-catalog-client');
const { createLibraryCatalogService } = require('./src/main/library/library-catalog-service');
const { createLibraryCatalogStore } = require('./src/main/library/library-catalog-store');
const { createLibraryService } = require('./src/main/library/library-service');
const { createDllInstaller } = require('./src/main/lumacore/dll-installer');
const { createArchiveClient } = require('./src/main/network/archive-client');
const { createApiAgent } = require('./src/main/network/api-agent');
const { createDownloadManager } = require('./src/main/network/download-manager');
const { createPremiumCatalogClient } = require('./src/main/premium/premium-catalog-client');
const { createPremiumCatalogStore } = require('./src/main/premium/premium-catalog-store');
const { createPremiumService } = require('./src/main/premium/premium-service');
const { createPollsClient } = require('./src/main/polls/polls-client');
const { createPollsService } = require('./src/main/polls/polls-service');
const { createMachineIdentity } = require('./src/main/security/machine-identity');
const { REQUIRED_STEAM_FILES, createSteamService } = require('./src/main/steam/steam-service');
const { createUpdateService } = require('./src/main/updates/update-service');
const { createSteamPluginService } = require('./src/main/steam-plugin/steam-plugin-service');
const { createInstanceGuard } = require('./src/main/process/instance-guard');
const { createDevShutdownRequest } = require('./src/main/process/dev-shutdown-request');

let mainWindow;
let tray;
let isQuitting = false;
let pluginSupervisor;
let devShutdownWatcher;
// Resolved only after the persisted settings are loaded. A desktop/Search
// launch always opens the window; only the opt-in Windows auto-start may hide it.
let startInBackground = false;
const devShutdownRequest = createDevShutdownRequest({ fs, path, appDataPath: app.getPath('appData') });
const instanceGuard = createInstanceGuard({
    fs,
    path,
    appDataPath: app.getPath('appData'),
    isProcessRunning: processId => {
        try {
            process.kill(processId, 0);
            return true;
        } catch (error) {
            return error?.code === 'EPERM';
        }
    }
});
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const hasProcessLock = hasSingleInstanceLock && instanceGuard.acquire();

if (!hasProcessLock || !hasSingleInstanceLock) {
    instanceGuard.release();
    app.exit(0);
}

const menuTranslations = {
    ptbr: { help: 'Ajuda', tutorial: 'Tutorial', faq: 'FAQ' },
    en: { help: 'Help', tutorial: 'Tutorial', faq: 'FAQ' },
    es: { help: 'Ayuda', tutorial: 'Tutorial', faq: 'FAQ' },
    fr: { help: 'Aide', tutorial: 'Tutoriel', faq: 'FAQ' },
    de: { help: 'Hilfe', tutorial: 'Tutorial', faq: 'FAQ' }
};

function setApplicationMenu(language = 'en') {
    const labels = menuTranslations[language] || menuTranslations.en;
    Menu.setApplicationMenu(Menu.buildFromTemplate([
        {
            label: labels.help,
            submenu: [{
                label: labels.tutorial,
                click: () => mainWindow?.webContents.send('tutorial:open')
            }, {
                label: labels.faq,
                click: () => mainWindow?.webContents.send('faq:open')
            }]
        }
    ]));
}

function configureYouTubePlayerRequests() {
    session.defaultSession.webRequest.onBeforeSendHeaders(
        {
            urls: [
                '*://*.youtube.com/*',
                '*://youtube.com/*',
                '*://*.youtube-nocookie.com/*',
                '*://youtube-nocookie.com/*',
                '*://*.googlevideo.com/*'
            ]
        },
        (details, callback) => {
            details.requestHeaders.Referer = 'https://merlin.local/';
            callback({ requestHeaders: details.requestHeaders });
        }
    );
}

function isAllowedSteamUrl(value) {
    try {
        const { protocol, hostname } = new URL(value);
        if (protocol !== 'https:' && protocol !== 'http:') return false;
        return hostname === 'steampowered.com'
            || hostname.endsWith('.steampowered.com')
            || hostname === 'steamcommunity.com'
            || hostname.endsWith('.steamcommunity.com');
    } catch {
        return false;
    }
}

function isAllowedDiscordUrl(value) {
    try {
        const { protocol, hostname } = new URL(value);
        return protocol === 'https:' && (
            hostname === 'discord.gg'
            || hostname === 'discord.com'
            || hostname.endsWith('.discord.com')
        );
    } catch {
        return false;
    }
}

function isAllowedInstagramUrl(value) {
    try {
        const { protocol, hostname, pathname } = new URL(value);
        return protocol === 'https:'
            && (hostname === 'instagram.com' || hostname === 'www.instagram.com')
            && pathname === '/merlin.launcher/';
    } catch {
        return false;
    }
}

function isAllowedWhatsAppCommunityUrl(value) {
    try {
        const { protocol, hostname, pathname } = new URL(value);
        return protocol === 'https:'
            && hostname === 'chat.whatsapp.com'
            && pathname === '/Hl6fuEZfFBTBkoggTUTe87';
    } catch {
        return false;
    }
}

// Development and installed builds must never compete for Chromium cache files.
if (!app.isPackaged) {
    const devDataRoot = path.join(
        process.env.LOCALAPPDATA || app.getPath('appData'),
        'Merlin',
        'Development'
    );
    const devUserData = path.join(devDataRoot, 'User Data');
    const devSessionData = path.join(devDataRoot, 'Session Data');
    fs.mkdirSync(devUserData, { recursive: true });
    fs.mkdirSync(devSessionData, { recursive: true });
    app.setPath('userData', devUserData);
    app.setPath('sessionData', devSessionData);
}

function getConfigFilePath() {
    return app.isPackaged
        ? path.join(app.getPath('userData'), 'config.json')
        : path.join(__dirname, 'config.json');
}

function getLibraryFilePath() {
    return path.join(app.getPath('userData'), 'library.json');
}

function getLibraryCacheFilePath() {
    return path.join(app.getPath('userData'), 'library-cache.json');
}

function getLibraryCatalogFilePath() {
    return path.join(app.getPath('userData'), 'games-catalog.json');
}

function getCorrectionsCatalogFilePath() {
    return path.join(app.getPath('userData'), 'corrections-catalog.json');
}

function getPremiumCatalogFilePath() {
    return path.join(app.getPath('userData'), 'premium-catalog.json');
}

function getBundledSteamRuntimePath(file) {
    const root = app.isPackaged
        ? process.resourcesPath
        : path.join(__dirname, 'assets');

    return path.join(root, 'dlls', file.sourceName);
}

const configStore = createConfigStore({
    fs,
    path,
    getFilePath: getConfigFilePath,
    defaults: {
        steamPath: '',
        language: 'ptbr',
        tutorialPromptSeen: false,
        correctionsDisclaimerSeen: false,
        discordAnnouncementSeen: false,
        steamPlugin: { enabled: false, markerOwned: false, startAtLogin: false }
    }
});

const steamService = createSteamService({
    fs,
    path,
    exec,
    platform: process.platform,
    userProfile: process.env.USERPROFILE
});

const apiBaseUrl = process.env.MERLIN_API_BASE_URL
    || 'https://api-merlin.com/api';
const gameSearchApiUrl = `${apiBaseUrl}/games/search`;
const manifestApiUrl = process.env.MERLIN_API_URL || `${apiBaseUrl}/manifests`;
const manifestStatusUrl = `${manifestApiUrl}/status`;
const correctionsCatalogUrl = `${apiBaseUrl}/fixes/catalog`;
const correctionsVoteUrl = `${apiBaseUrl}/fixes/vote`;
const correctionsLicenseTokenUrl = `${apiBaseUrl}/fixes/license-token`;
const premiumCatalogUrl = `${apiBaseUrl}/premium/catalog`;
const premiumActivateUrl = `${apiBaseUrl}/premium/activate`;
const premiumActivateThirdPartyUrl = `${apiBaseUrl}/premium/activate-third-party`;
const premiumActivationEventUrl = `${apiBaseUrl}/premium/activation-events`;
const pollsActiveUrl = `${apiBaseUrl}/polls/active`;
const pollsVoteUrl = `${apiBaseUrl}/polls`;
const announcementsApiUrl = `${apiBaseUrl}/announcements`;
const updateLatestApiUrl = `${apiBaseUrl}/updates/latest`;
const updateDownloadApiUrl = `${apiBaseUrl}/updates/download`;
const apiAgent = createApiAgent();
const downloadManager = createDownloadManager({ fs, path, axios, httpsAgent: apiAgent });
const machineIdentity = createMachineIdentity({ crypto, execFile, os });
const authSession = createAuthSession({
    app,
    safeStorage,
    fs,
    path,
    axios,
    httpsAgent: apiAgent,
    machineIdentity,
    baseUrl: apiBaseUrl,
    onAuthRequired: code => mainWindow?.webContents.send('auth:required', { code })
});
const archiveClient = createArchiveClient({ axios, httpsAgent: apiAgent });
const manifestOverrideService = createManifestOverrideService({
    axios,
    httpsAgent: apiAgent,
    authSession,
    statusUrl: manifestStatusUrl
});
const updateService = createUpdateService({
    app,
    axios,
    shell,
    path,
    downloadManager,
    latestApiUrl: updateLatestApiUrl,
    downloadApiUrl: updateDownloadApiUrl
});
const libraryCatalogStore = createLibraryCatalogStore({
    fs,
    path,
    getFilePath: getLibraryCatalogFilePath
});
const libraryCatalogService = createLibraryCatalogService({
    catalogStore: libraryCatalogStore,
    catalogClient: createLibraryCatalogClient({ axios }),
    searchClient: createGameSearchClient({
        axios,
        authSession,
        httpsAgent: apiAgent,
        url: gameSearchApiUrl
    })
});

const libraryService = createLibraryService({
    fs,
    path,
    configStore,
    cacheStore: createLibraryCacheStore({
        fs,
        path,
        getFilePath: getLibraryCacheFilePath,
        getLegacyFilePath: getLibraryFilePath
    }),
    catalogStore: libraryCatalogStore,
    catalogService: libraryCatalogService,
    steamService,
    shell
});
const correctionsCatalogStore = createCorrectionsCatalogStore({
    fs,
    path,
    getFilePath: getCorrectionsCatalogFilePath
});
const launcherVersion = app.getVersion();
const correctionsLicenseTokenClient = createLicenseTokenClient({
    axios,
    authSession,
    url: correctionsLicenseTokenUrl,
    launcherVersion
});
const specialCorrection = createSpecialCorrection({
    fs,
    path,
    programDataPath: process.env.ProgramData || process.env.PROGRAMDATA,
    licenseTokenClient: correctionsLicenseTokenClient
});
const correctionsService = createCorrectionsService({
    app,
    fs,
    path,
    AdmZip,
    nodeUnrar,
    dialog,
    shell,
    configStore,
    steamService,
    authSession,
    catalogStore: correctionsCatalogStore,
    catalogClient: createCorrectionsCatalogClient({
        axios,
        url: correctionsCatalogUrl,
        voteUrl: correctionsVoteUrl
    }),
    apiBaseUrl,
    libraryCatalogService,
    downloadManager,
    specialCorrection,
    launcherVersion
});
const premiumCatalogStore = createPremiumCatalogStore({
    fs,
    path,
    getFilePath: getPremiumCatalogFilePath
});
const premiumService = createPremiumService({
    app,
    fs,
    path,
    AdmZip,
    shell,
    configStore,
    steamService,
    authSession,
    catalogStore: premiumCatalogStore,
    catalogClient: createPremiumCatalogClient({
        axios,
        catalogUrl: premiumCatalogUrl,
        activateUrl: premiumActivateUrl,
        activateThirdPartyUrl: premiumActivateThirdPartyUrl,
        activationEventUrl: premiumActivationEventUrl
    }),
    downloadManager
});
const pollsService = createPollsService({
    authSession,
    pollsClient: createPollsClient({
        axios,
        activeUrl: pollsActiveUrl,
        voteUrl: pollsVoteUrl
    })
});
const announcementsService = createAnnouncementsService({
    authSession,
    announcementsClient: createAnnouncementsClient({
        axios,
        baseUrl: announcementsApiUrl
    })
});

const gameInstaller = createGameInstaller({
    app,
    fs,
    path,
    AdmZip,
    archiveClient,
    authSession,
    manifestApiUrl,
    steamService,
    installLuaFile,
    onInstalled: () => libraryService.invalidate()
});

const addGamesService = createAddGamesService({
    parseSteamGameLink,
    nameResolver: createGameNameResolver({ axios }),
    queue: createGameQueue(),
    gameInstaller,
    configStore,
    steamService,
    libraryService,
    catalogService: libraryCatalogService,
    manifestOverrideService
});

function openMerlinView(view) {
    const reveal = () => {
        const window = mainWindow;
        if (!window || window.isDestroyed()) return;
        try {
            const wasVisible = window.isVisible();
            const wasMinimized = window.isMinimized();
            window.setSkipTaskbar(false);
            window.show();
            if (wasMinimized) window.restore();
            updateTray();
            // Same restore sequence used by LuaTools: Windows often ignores a plain focus
            // request for a hidden tray window, while bouncing topmost reliably surfaces it.
            window.setAlwaysOnTop(true, 'screen-saver');
            window.moveTop();
            window.focus();
            // Electron needs one compositor frame with the window topmost; toggling it
            // off immediately can leave a restored tray window behind Steam on Windows.
            setTimeout(() => {
                if (!window.isDestroyed()) window.setAlwaysOnTop(false);
            }, 750);
            console.info(`Merlin window restore: visible ${wasVisible}->${window.isVisible()}, minimized ${wasMinimized}->${window.isMinimized()}`);
        } catch (error) {
            console.error('Merlin window restore failed:', error);
            // Keep the direct show fallback independent from focus/topmost support.
            try { window.show(); } catch (_) {}
        }
        if (view) window.webContents.send('steam-plugin:open', { view });
    };
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        mainWindow.once('ready-to-show', reveal);
        mainWindow.webContents.once('did-finish-load', reveal);
        return;
    }
    reveal();
}

app.on('second-instance', () => openMerlinView('launcher'));

const steamPluginService = createSteamPluginService({
    fs,
    path,
    execFile,
    configStore,
    addGamesService,
    libraryService,
    openView: openMerlinView
});

const dllInstaller = createDllInstaller({
    fs,
    path,
    dialog,
    requiredFiles: REQUIRED_STEAM_FILES,
    getSourcePath: getBundledSteamRuntimePath,
    getMainWindow: () => mainWindow
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 800,
        frame: true,
        show: !startInBackground,
        backgroundColor: '#1a1a2e',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: !app.isPackaged,
            webviewTag: true
        },
        icon: MERLIN_WINDOW_ICON_PATH
    });

    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => { mainWindow = null; });
    mainWindow.on('close', event => {
        if (configStore.get().steamPlugin?.enabled && !isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            updateTray();
        }
    });
    mainWindow.once('ready-to-show', () => {
        updateTray();
        if (!startInBackground) {
            mainWindow.show();
            mainWindow.focus();
        }
        console.info(`Merlin window ready: background=${startInBackground}, visible=${mainWindow.isVisible()}`);
    });
    mainWindow.webContents.once('did-finish-load', updateTray);
    mainWindow.webContents.on('render-process-gone', () => {
        if (!isQuitting && configStore.get().steamPlugin?.enabled) {
            mainWindow?.destroy();
            mainWindow = null;
            setTimeout(() => { if (!mainWindow) createWindow(); }, 500);
        }
    });
}

function startPluginSupervisor() {
    if (pluginSupervisor || !configStore.get().steamPlugin?.enabled) return;
    pluginSupervisor = setInterval(() => {
        if (isQuitting || !configStore.get().steamPlugin?.enabled) return;
        if (!mainWindow || mainWindow.isDestroyed()) createWindow();
        if (!steamPluginService.status().running) steamPluginService.start();
    }, 5000);
}

function stopPluginSupervisor() {
    if (pluginSupervisor) clearInterval(pluginSupervisor);
    pluginSupervisor = null;
}

function disposeTray() {
    if (!tray) return;
    try {
        tray.destroy();
        console.info('Merlin tray disposed');
    } catch (error) {
        console.warn('Merlin tray disposal failed:', error.message);
    }
    tray = null;
}

function shutdownRuntime(source) {
    if (isQuitting) return;
    isQuitting = true;
    console.info(`Merlin graceful shutdown: ${source}`);
    stopPluginSupervisor();
    if (devShutdownWatcher) clearInterval(devShutdownWatcher);
    devShutdownWatcher = null;
    steamPluginService.stop();
    disposeTray();
    instanceGuard.release();
}

function startDevShutdownWatcher() {
    if (!process.defaultApp || devShutdownWatcher) return;
    devShutdownRequest.clear();
    console.info('Merlin dev controller watcher ready');
    devShutdownWatcher = setInterval(() => {
        if (!devShutdownRequest.consume()) return;
        shutdownRuntime('dev-controller');
        app.quit();
    }, 100);
}

function updateTray() {
    if (!app.isReady()) return;
    if (!configStore.get().steamPlugin?.enabled) {
        disposeTray();
        return;
    }
    if (!tray) {
        tray = new Tray(MERLIN_TRAY_ICON_PATH);
        tray.setToolTip('Merlin');
        tray.on('click', () => openMerlinView('launcher'));
    }
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Abrir Merlin', click: () => openMerlinView('launcher') },
        { label: 'Plugin da Steam ativo', enabled: false },
        { type: 'separator' },
        { label: 'Sair', click: () => { shutdownRuntime('tray-menu'); app.quit(); } }
    ]));
}

function applyLoginItemSettings() {
    // Development runs use Electron's generic app identity. Never let them
    // create a Windows startup entry alongside the packaged Merlin app.
    if (process.defaultApp) {
        app.setLoginItemSettings({ openAtLogin: false });
        return;
    }
    const plugin = configStore.get().steamPlugin || {};
    const openAtLogin = plugin.enabled === true && plugin.startAtLogin !== false;
    app.setLoginItemSettings(openAtLogin
        ? { openAtLogin: true, args: ['--background'] }
        : { openAtLogin: false });
}

registerExistingIpc({
    ipcMain,
    dialog,
    configStore,
    steamService,
    dllInstaller,
    gameInstaller,
    libraryService,
    getMainWindow: () => mainWindow
});

registerGamesIpc({ ipcMain, addGamesService });
registerLibraryIpc({ ipcMain, libraryService });
registerCorrectionsIpc({ ipcMain, correctionsService });
registerPremiumIpc({ ipcMain, premiumService });
registerPollsIpc({ ipcMain, pollsService });
registerSteamPluginIpc({
    ipcMain,
    steamPluginService,
    isSteamRunning: () => steamService.isRunning(),
    stopSteam: () => steamService.close(configStore.get().steamPath),
    configStore,
    onStateChanged: enabled => {
        applyLoginItemSettings();
        updateTray();
        if (enabled) {
            startPluginSupervisor();
        } else stopPluginSupervisor();
    },
    onStartAtLoginChanged: applyLoginItemSettings
});
registerAnnouncementsIpc({ ipcMain, announcementsService });
registerAuthIpc({
    ipcMain,
    authSession,
    shell,
    apiBaseUrl,
    onLogout: () => premiumService.clearCache()
});
ipcMain.handle('app:set-menu-language', (_event, language) => {
    setApplicationMenu(language);
    return { success: true };
});
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:check-for-updates', () => updateService.check());
ipcMain.handle('app:open-update-download', (_event, downloadUrl) => updateService.openDownload(downloadUrl));
ipcMain.handle('app:download-update', (event, payload) => updateService.downloadUpdate({
    ...payload,
    onProgress: progress => {
        if (!event.sender.isDestroyed()) {
            event.sender.send('app:update-download-progress', progress);
        }
    }
}));
ipcMain.handle('app:cancel-update-download', (_event, operationId) => updateService.cancelDownload(operationId));
ipcMain.handle('app:open-downloaded-update', (_event, filePath) => updateService.openDownloadedFile(filePath));
ipcMain.handle('app:open-downloaded-update-folder', (_event, folderPath) => updateService.openDownloadedFolder(folderPath));
ipcMain.handle('app:open-discord-support', async () => {
    const url = 'https://discord.gg/6RKFKcGmQZ';
    if (!isAllowedDiscordUrl(url)) return { success: false };
    await shell.openExternal(url);
    return { success: true };
});
ipcMain.handle('app:open-whatsapp-community', async () => {
    const url = 'https://chat.whatsapp.com/Hl6fuEZfFBTBkoggTUTe87';
    if (!isAllowedWhatsAppCommunityUrl(url)) return { success: false };
    await shell.openExternal(url);
    return { success: true };
});
ipcMain.handle('app:open-instagram', async () => {
    const url = 'https://www.instagram.com/merlin.launcher/';
    if (!isAllowedInstagramUrl(url)) return { success: false };
    await shell.openExternal(url);
    return { success: true };
});

app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
        if (contents.getType() === 'webview' && isAllowedSteamUrl(url)) {
            setImmediate(() => {
                if (!contents.isDestroyed()) contents.loadURL(url);
            });
        }
        return { action: 'deny' };
    });

    contents.on('devtools-opened', () => {
        if (app.isPackaged) contents.closeDevTools();
    });
});

app.whenReady().then(() => {
    if (!hasProcessLock) return;
    // Remove the short-lived protocol registration from the prior development build.
    if (process.defaultApp) app.removeAsDefaultProtocolClient('merlin', process.execPath, [path.resolve(process.argv[1])]);
    else app.removeAsDefaultProtocolClient('merlin');
    configStore.load();
    const plugin = configStore.get().steamPlugin || {};
    startInBackground = !process.defaultApp
        && process.argv.includes('--background')
        && plugin.enabled === true
        && plugin.startAtLogin !== false;
    applyLoginItemSettings();
    console.info(`Merlin startup: development=${Boolean(process.defaultApp)}, background=${startInBackground}`);
    configureYouTubePlayerRequests();
    setApplicationMenu(configStore.get().language);
    createWindow();
    startDevShutdownWatcher();
    if (configStore.get().steamPlugin?.enabled) {
        steamPluginService.start();
        startPluginSupervisor();
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (!configStore.get().steamPlugin?.enabled && process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    shutdownRuntime('before-quit');
});

const handleProcessSignal = signal => {
    shutdownRuntime(signal);
    app.quit();
};

process.once('SIGINT', () => handleProcessSignal('SIGINT'));
process.once('SIGTERM', () => handleProcessSignal('SIGTERM'));
process.on('exit', () => {
    disposeTray();
    instanceGuard.release();
});
