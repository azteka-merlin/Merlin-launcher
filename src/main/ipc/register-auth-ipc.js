function getSignupUrl(apiBaseUrl) {
    try {
        const url = new URL(String(apiBaseUrl || ''));
        return url.origin + '/download';
    } catch (_) {
        return 'https://api-merlin.com/download';
    }
}

function getPlansUrl(apiBaseUrl) {
    return `${getSignupUrl(apiBaseUrl)}?focus=planos#planos`;
}

function getAccessUrl(apiBaseUrl) {
    return `${getSignupUrl(apiBaseUrl).replace(/\/download\/?$/, '')}/meu-acesso`;
}

function registerAuthIpc({ ipcMain, authSession, shell, apiBaseUrl, onLogout }) {
    ipcMain.handle('auth:has-session', () => authSession.hasStoredSession());
    ipcMain.handle('auth:status', async () => authSession.status());
    ipcMain.handle('auth:login', async (_event, licenseKey) => authSession.login(licenseKey));
    ipcMain.handle('auth:logout', () => {
        const result = authSession.logout();
        onLogout?.();
        return result;
    });
    ipcMain.handle('auth:manage-subscription', async () => {
        const result = await authSession.createBillingPortalSession();
        if (!result.ok || !result.portalUrl) return result;
        await shell.openExternal(result.portalUrl);
        return { ok: true };
    });
    ipcMain.handle('auth:open-signup', async () => {
        const url = getSignupUrl(apiBaseUrl);
        await shell.openExternal(url);
        return { ok: true, url };
    });
    ipcMain.handle('auth:open-plans', async () => {
        const url = getPlansUrl(apiBaseUrl);
        await shell.openExternal(url);
        return { ok: true, url };
    });
    ipcMain.handle('auth:open-access', async () => {
        let url = getAccessUrl(apiBaseUrl);
        try {
            const handoff = await authSession.createAccessHandoff?.();
            if (handoff?.ok && handoff.token) {
                // Keep the opaque handoff token in the URL fragment. Browsers
                // do not send fragments in HTTP requests or server logs.
                url = `${url}#handoff=${encodeURIComponent(handoff.token)}`;
            }
        } catch (_) {
            // The public page remains available as a safe fallback.
        }
        await shell.openExternal(url);
        return { ok: true, url };
    });
}

module.exports = { getAccessUrl, getPlansUrl, getSignupUrl, registerAuthIpc };
