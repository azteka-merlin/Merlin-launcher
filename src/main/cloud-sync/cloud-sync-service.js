const fs = require('fs');
const path = require('path');

const RENEW_INTERVAL_MS = 5 * 60 * 1000;
const STAGE_HOST = 'staging.api-merlin.com';

function createCloudSyncService({ axios, authSession, configStore, apiBaseUrl, localAppData, httpsAgent }) {
    const cloudDir = path.join(localAppData || '', 'Merlin', 'cloud');
    const configPath = path.join(cloudDir, 'config.json');
    const credentialsPath = path.join(cloudDir, 'credentials.json');
    let timer = null;
    let connecting = null;
    let lastConnectedAt = null;
    let expiresAt = null;
    let errorCode = null;
    let stateEpoch = 0;
    let suspended = false;
    let restartSteamRequired = false;

    function isStage() {
        try { return new URL(apiBaseUrl).hostname === STAGE_HOST; }
        catch (_) { return false; }
    }

    function enabled() {
        return configStore.get().cloudSync?.enabled === true;
    }

    function writeJsonAtomic(filePath, payload) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const temporary = `${filePath}.${process.pid}.tmp`;
        try {
            fs.writeFileSync(temporary, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600, flag: 'w' });
            fs.renameSync(temporary, filePath);
        } catch (error) {
            try { fs.rmSync(temporary, { force: true }); } catch (_) {}
            throw error;
        }
    }

    function existingKeyId() {
        try {
            const value = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            return /^MCL[a-f0-9]{40}$/.test(value.access_key_id || '') ? value.access_key_id : null;
        } catch (_) { return null; }
    }

    function writeDisabledConfig() {
        writeJsonAtomic(configPath, { merlin_enabled: false, provider: 'local', auto_update_dll: false });
    }

    function writeEnabledConfig(credentials) {
        // CloudRedirect reads these only at Steam startup. Never write real R2
        // credentials: these keys work solely against Merlin's stage gateway.
        writeJsonAtomic(credentialsPath, {
            access_key_id: credentials.accessKeyId,
            secret_access_key: credentials.secretAccessKey,
            bucket: credentials.bucket,
            key_prefix: credentials.keyPrefix,
            endpoint: credentials.endpoint,
            region: credentials.region,
            multipart_threshold: String(16 * 1024 * 1024),
            part_size: String(8 * 1024 * 1024),
            checksum_integrity: true,
            sign_payload: false
        });
        writeJsonAtomic(configPath, {
            merlin_enabled: true,
            provider: 's3',
            token_path: credentialsPath,
            auto_update_dll: false,
            sync_luas: false,
            sync_achievements: false,
            sync_playtime: false,
            show_non_steam_game: false
        });
    }

    function status() {
        return {
            available: isStage(),
            enabled: enabled(),
            connected: enabled() && !suspended && !errorCode && Boolean(expiresAt && Date.parse(expiresAt) > Date.now()),
            lastConnectedAt,
            expiresAt,
            errorCode,
            restartSteamRequired: enabled() && restartSteamRequired
        };
    }

    async function renew() {
        if (!enabled() || !isStage() || suspended) return status();
        if (connecting) return connecting;
        const epoch = stateEpoch;
        connecting = (async () => {
            try {
                const token = await authSession.getAccessToken();
                const response = await axios.post(`${apiBaseUrl}/launcher/cloud/credentials`,
                    { accessKeyId: existingKeyId() }, {
                        timeout: 15_000,
                        httpsAgent,
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
                    });
                const data = response.data || {};
                const expectedOrigin = new URL(apiBaseUrl).origin;
                if (data.success !== true || data.endpoint !== expectedOrigin
                    || data.bucket !== 'merlin-cloud' || data.keyPrefix !== 'steam/'
                    || !/^MCL[a-f0-9]{40}$/.test(data.accessKeyId || '')
                    || !/^[a-f0-9]{64}$/.test(data.secretAccessKey || '')) {
                    throw new Error('invalid_cloud_gateway_response');
                }
                if (epoch !== stateEpoch || !enabled()) return status();
                writeEnabledConfig(data);
                lastConnectedAt = new Date().toISOString();
                expiresAt = data.expiresAt;
                errorCode = null;
            } catch (error) {
                errorCode = error.response?.status === 401 ? 'auth_required' : 'connection_failed';
                // A failed renewal never overwrites a working local save or
                // replaces a valid credential with a partial response.
            }
            return status();
        })();
        try { return await connecting; }
        finally { connecting = null; }
    }

    async function requestCloudApi(method, pathname, data) {
        if (!isStage() || !enabled()) throw Object.assign(new Error('cloud_unavailable'), { code: 'cloud_unavailable' });
        const token = await authSession.getAccessToken();
        const response = await axios.request({
            method,
            url: `${apiBaseUrl}${pathname}`,
            data,
            timeout: 15_000,
            httpsAgent,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }
        });
        return response.data || {};
    }

    async function listGames(accountId) {
        const value = String(accountId || '').trim();
        if (!/^\d{1,10}$/.test(value) || value === '0') throw Object.assign(new Error('invalid_steam_account'), { code: 'invalid_steam_account' });
        return requestCloudApi('GET', `/launcher/cloud/games?accountId=${encodeURIComponent(value)}`);
    }

    async function getGame(accountId, appId) {
        const account = String(accountId || '').trim();
        const app = String(appId || '').trim();
        if (!/^\d{1,10}$/.test(account) || account === '0' || !/^\d{1,10}$/.test(app) || app === '0') {
            throw Object.assign(new Error('invalid_cloud_game'), { code: 'invalid_cloud_game' });
        }
        return requestCloudApi('GET', `/launcher/cloud/games/${encodeURIComponent(app)}?accountId=${encodeURIComponent(account)}`);
    }

    async function restoreGame(accountId, appId, recoveryId) {
        const account = String(accountId || '').trim();
        const app = String(appId || '').trim();
        const recovery = String(recoveryId || '').trim();
        if (!/^\d{1,10}$/.test(account) || account === '0' || !/^\d{1,10}$/.test(app) || app === '0' || !/^[a-f0-9]{64}$/.test(recovery)) {
            throw Object.assign(new Error('invalid_recovery'), { code: 'invalid_recovery' });
        }
        return requestCloudApi('POST', '/launcher/cloud/restore', { accountId: account, appId: app, recoveryId: recovery });
    }

    async function enable() {
        if (!isStage()) return { ...status(), errorCode: 'stage_only' };
        suspended = false;
        configStore.update({ cloudSync: { enabled: true, startAtLogin: true } });
        const current = await renew();
        if (!current.connected) {
            configStore.update({ cloudSync: { enabled: false, startAtLogin: false } });
            writeDisabledConfig();
            return status();
        }
        startTimer();
        return current;
    }

    async function revokeCredentials() {
        const accessKeyId = existingKeyId();
        if (isStage() && accessKeyId) {
            try {
                const token = await authSession.getAccessToken();
                await axios.post(`${apiBaseUrl}/launcher/cloud/revoke`, { accessKeyId }, {
                    timeout: 5_000, httpsAgent, headers: { Authorization: `Bearer ${token}` }
                });
            } catch (_) { /* The gateway lease expires even if revocation cannot be delivered. */ }
        }
    }

    function clearLocalConnection() {
        writeDisabledConfig();
        try { fs.rmSync(credentialsPath, { force: true }); } catch (_) {}
        expiresAt = null;
    }

    async function suspendForLogout() {
        if (!enabled()) return status();
        stateEpoch += 1;
        stopTimer();
        suspended = true;
        restartSteamRequired = true;
        await revokeCredentials();
        clearLocalConnection();
        errorCode = 'auth_required';
        return status();
    }

    async function resumeAfterLogin() {
        if (!enabled() || !isStage()) return status();
        if (connecting) await connecting;
        suspended = false;
        if (!status().connected) await renew();
        if (!suspended) startTimer();
        return status();
    }

    async function disable() {
        stateEpoch += 1;
        stopTimer();
        await revokeCredentials();
        suspended = false;
        restartSteamRequired = false;
        configStore.update({ cloudSync: { enabled: false, startAtLogin: false } });
        clearLocalConnection();
        errorCode = null;
        return status();
    }

    function startTimer() {
        if (timer) return;
        timer = setInterval(() => { void renew(); }, RENEW_INTERVAL_MS);
        timer.unref?.();
    }

    function stopTimer() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    function start() {
        if (!isStage()) {
            // Stage and production share the Windows profile. Production must
            // never inherit a stage gateway configuration left by a pilot run.
            if (enabled()) configStore.update({ cloudSync: { enabled: false, startAtLogin: false } });
            writeDisabledConfig();
            try { fs.rmSync(credentialsPath, { force: true }); } catch (_) {}
            return;
        }
        if (!enabled()) {
            // Keep the opt-in state authoritative even after a failed previous run.
            writeDisabledConfig();
            return;
        }
        try {
            restartSteamRequired = !JSON.parse(fs.readFileSync(configPath, 'utf8')).merlin_enabled;
        } catch (_) { restartSteamRequired = true; }
        startTimer();
        void renew();
    }

    function stop() { stopTimer(); }

    function acknowledgeSteamRestart() {
        restartSteamRequired = false;
        return status();
    }

    return {
        acknowledgeSteamRestart,
        disable,
        enable,
        getGame,
        listGames,
        renew,
        restoreGame,
        resumeAfterLogin,
        start,
        status,
        stop,
        suspendForLogout
    };
}

module.exports = { createCloudSyncService };
