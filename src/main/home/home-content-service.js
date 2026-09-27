function createHomeContentService({ authSession, client, store, baseUrl }) {
    let memory = null;

    async function getAccessToken() {
        if (!authSession?.getAccessToken) {
            const error = new Error('Authentication is not available');
            error.code = 'auth_required';
            throw error;
        }
        return authSession.getAccessToken();
    }

    async function refresh() {
        try {
            let accessToken = await getAccessToken();
            let home;
            try {
                home = await client.request(accessToken);
            } catch (error) {
                if (error?.response?.status !== 401) throw error;
                await authSession.handleUnauthorized();
                accessToken = await getAccessToken();
                home = await client.request(accessToken);
            }
            memory = store.save(home, baseUrl) || home;
            return { success: true, home: memory, stale: false };
        } catch (error) {
            const fallback = memory || store.load();
            if (fallback) {
                memory = fallback;
                return { success: true, home: fallback, stale: true, code: 'refresh_failed' };
            }
            const code = error?.code === 'missing' || error?.code === 'auth_required' || error?.response?.status === 401
                ? 'auth_required'
                : 'refresh_failed';
            return { success: false, code, message: error?.message || 'Could not load Home content' };
        }
    }

    async function get({ force = false } = {}) {
        if (!force && memory) return { success: true, home: memory, stale: false };
        return refresh();
    }

    return { get, refresh };
}

module.exports = { createHomeContentService };
