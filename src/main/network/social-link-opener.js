function createSocialLinkOpener({ shell, getMainWindow, now = () => performance.now(), cooldownMs = 3000 }) {
    let pending = false;
    let lastOpenedAt = -Infinity;

    return async (event, url) => {
        const window = getMainWindow();
        if (!window || window.isDestroyed() || !window.isVisible() || window.isMinimized()
            || !window.isFocused() || event?.sender !== window.webContents) {
            return { success: false, code: 'window_inactive' };
        }
        const timestamp = now();
        if (pending || timestamp - lastOpenedAt < cooldownMs) {
            return { success: false, code: 'already_opening' };
        }
        pending = true;
        lastOpenedAt = timestamp;
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch {
            return { success: false, code: 'open_failed' };
        } finally {
            pending = false;
        }
    };
}

module.exports = { createSocialLinkOpener };
