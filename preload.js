const { contextBridge, ipcRenderer } = require('electron');

// direct APIs to renderer in a secure way
contextBridge.exposeInMainWorld('electronAPI', {
    // Development-only QA switches. They are unset in packaged builds and
    // allow staging to reproduce transient UI states without changing APIs.
    qa: {
        simulateServiceIssue: process.env.MERLIN_SIMULATE_SERVICE_ISSUE === '1'
    },
    // settings
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    setMenuLanguage: (language) => ipcRenderer.invoke('app:set-menu-language', language),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
    openUpdateDownload: (downloadUrl) => ipcRenderer.invoke('app:open-update-download', downloadUrl),
    downloadUpdate: (payload) => ipcRenderer.invoke('app:download-update', payload),
    cancelUpdateDownload: (operationId) => ipcRenderer.invoke('app:cancel-update-download', operationId),
    openDownloadedUpdate: (filePath) => ipcRenderer.invoke('app:open-downloaded-update', filePath),
    openDownloadedUpdateFolder: (folderPath) => ipcRenderer.invoke('app:open-downloaded-update-folder', folderPath),
    openDiscordSupport: () => ipcRenderer.invoke('app:open-discord-support'),
    openWhatsAppCommunity: () => ipcRenderer.invoke('app:open-whatsapp-community'),
    openInstagram: () => ipcRenderer.invoke('app:open-instagram'),
    onUpdateDownloadProgress: (callback) => {
        ipcRenderer.on('app:update-download-progress', (_event, progress) => callback(progress));
    },
    removeUpdateDownloadListeners: () => {
        ipcRenderer.removeAllListeners('app:update-download-progress');
    },
    onOpenTutorial: (callback) => ipcRenderer.on('tutorial:open', callback),
    onOpenFaq: (callback) => ipcRenderer.on('faq:open', callback),

    // Authentication
    auth: {
        hasSession: () => ipcRenderer.invoke('auth:has-session'),
        status: () => ipcRenderer.invoke('auth:status'),
        login: (licenseKey) => ipcRenderer.invoke('auth:login', licenseKey),
        resetHwid: (licenseKey) => ipcRenderer.invoke('auth:reset-hwid', licenseKey),
        logout: () => ipcRenderer.invoke('auth:logout'),
        manageSubscription: () => ipcRenderer.invoke('auth:manage-subscription'),
    openSignup: () => ipcRenderer.invoke('auth:open-signup'),
    openPlans: () => ipcRenderer.invoke('auth:open-plans'),
    openAccess: (options) => ipcRenderer.invoke('auth:open-access', options),
        onRequired: (callback) => ipcRenderer.on('auth:required', (_event, data) => callback(data))
    },

    // Steam management
    selectSteamPath: () => ipcRenderer.invoke('select-steam-path'),
    findSteam: () => ipcRenderer.invoke('find-steam'),
    detectSteam: () => ipcRenderer.invoke('detect-steam'),
    isSteamDetected: () => ipcRenderer.invoke('is-steam-detected'),
    isSteamRunning: () => ipcRenderer.invoke('is-steam-running'),
    closeSteam: () => ipcRenderer.invoke('close-steam'),
    startSteam: () => ipcRenderer.invoke('start-steam'),

    // Download and installation
    downloadGame: (appId) => ipcRenderer.invoke('download-game', appId),
    validateActivation: () => ipcRenderer.invoke('validate-activation'),
    checkFilesStatus: () => ipcRenderer.invoke('check-files-status'),
    verifyFiles: () => ipcRenderer.invoke('verify-files'),

    // Events
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (event, data) => callback(data));
    },
    removeDownloadProgressListener: () => {
        ipcRenderer.removeAllListeners('download-progress');
    },
    onFilesStatus: (callback) => {
        ipcRenderer.on('files-status', (event, data) => callback(data));
    },

    // Isolated "Add games" feature
    games: {
        resolveLink: (link) => ipcRenderer.invoke('games:resolve-link', link),
        search: (query) => ipcRenderer.invoke('games:search', query),
        listQueue: () => ipcRenderer.invoke('games:queue:list'),
        addToQueue: (link) => ipcRenderer.invoke('games:queue:add', link),
        removeFromQueue: (appId) => ipcRenderer.invoke('games:queue:remove', appId),
        clearQueue: () => ipcRenderer.invoke('games:queue:clear'),
        installNow: (link) => ipcRenderer.invoke('games:install-now', link),
        installAll: () => ipcRenderer.invoke('games:install-all'),
        restartSteam: () => ipcRenderer.invoke('games:restart-steam'),
        onQueueUpdated: (callback) => {
            ipcRenderer.on('games:queue-updated', (_event, data) => callback(data));
        },
        onInstallProgress: (callback) => {
            ipcRenderer.on('games:install-progress', (_event, data) => callback(data));
        },
        onInstallComplete: (callback) => {
            ipcRenderer.on('games:install-complete', (_event, data) => callback(data));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('games:queue-updated');
            ipcRenderer.removeAllListeners('games:install-progress');
            ipcRenderer.removeAllListeners('games:install-complete');
        }
    },

    // Native Library feature
    library: {
        list: () => ipcRenderer.invoke('library:list'),
        refresh: () => ipcRenderer.invoke('library:refresh'),
        remove: (appId) => ipcRenderer.invoke('library:remove', appId),
        openGameFolder: (appId) => ipcRenderer.invoke('library:open-game-folder', appId),
        restartSteam: () => ipcRenderer.invoke('library:restart-steam'),
        onUpdated: (callback) => {
            ipcRenderer.on('library:updated', (_event, items) => callback(items));
        },
        onOperationProgress: (callback) => {
            ipcRenderer.on('library:operation-progress', (_event, state) => callback(state));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('library:updated');
            ipcRenderer.removeAllListeners('library:operation-progress');
        }
    },

    corrections: {
        list: () => ipcRenderer.invoke('corrections:list'),
        refresh: () => ipcRenderer.invoke('corrections:refresh'),
        prepareInstall: (appId) => ipcRenderer.invoke('corrections:prepare-install', appId),
        vote: (payload) => ipcRenderer.invoke('corrections:vote', payload),
        download: (payload) => ipcRenderer.invoke('corrections:download', payload),
        install: (payload) => ipcRenderer.invoke('corrections:install', payload),
        cancel: (operationId) => ipcRenderer.invoke('corrections:cancel', operationId),
        openFolder: (folderPath) => ipcRenderer.invoke('corrections:open-folder', folderPath),
        onProgress: (callback) => {
            ipcRenderer.on('corrections:progress', (_event, state) => callback(state));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('corrections:progress');
        }
    },

    premium: {
        list: (payload) => ipcRenderer.invoke('premium:list', payload),
        refresh: () => ipcRenderer.invoke('premium:refresh'),
        activate: (payload) => ipcRenderer.invoke('premium:activate', payload),
        cancel: (operationId) => ipcRenderer.invoke('premium:cancel', operationId),
        openGameFolder: (appId) => ipcRenderer.invoke('premium:open-game-folder', appId),
        onProgress: (callback) => {
            ipcRenderer.on('premium:progress', (_event, state) => callback(state));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('premium:progress');
        }
    },

    polls: {
        active: () => ipcRenderer.invoke('polls:active'),
        vote: (payload) => ipcRenderer.invoke('polls:vote', payload)
    },

    announcements: {
        eligible: () => ipcRenderer.invoke('announcements:eligible'),
        recordView: (payload) => ipcRenderer.invoke('announcements:view', payload),
        dismiss: (payload) => ipcRenderer.invoke('announcements:dismiss', payload)
    }
});
