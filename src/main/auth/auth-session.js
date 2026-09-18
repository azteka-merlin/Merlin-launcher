const LICENSE_KEY_PATTERN = /^MERLIN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

class AuthError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
    }
}

function createAuthSession({
    app,
    safeStorage,
    fs,
    path,
    axios,
    httpsAgent,
    machineIdentity,
    baseUrl,
    onAuthRequired = () => {}
}) {
    let session = null;
    let refreshPromise = null;

    function sessionFilePath() {
        return path.join(app.getPath('userData'), 'auth-session.json');
    }

    function clearStoredSession() {
        session = null;
        try {
            fs.rmSync(sessionFilePath(), { force: true });
        } catch (error) {
            console.warn('Unable to clear the authentication cache:', error.message);
        }
    }

    function loadStoredSession() {
        if (session) return session;
        if (!safeStorage.isEncryptionAvailable()) return null;

        try {
            const filePath = sessionFilePath();
            if (!fs.existsSync(filePath)) return null;
            const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const decrypted = safeStorage.decryptString(Buffer.from(envelope.payload, 'base64'));
            const stored = JSON.parse(decrypted);

            if (!LICENSE_KEY_PATTERN.test(stored.licenseKey) || !stored.accessToken) {
                throw new Error('Invalid authentication cache');
            }

            session = stored;
            return session;
        } catch (error) {
            console.warn('Authentication cache could not be read:', error.message);
            clearStoredSession();
            return null;
        }
    }

    function persistSession() {
        if (!session || !safeStorage.isEncryptionAvailable()) return;

        try {
            const filePath = sessionFilePath();
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            const encrypted = safeStorage.encryptString(JSON.stringify(session));
            fs.writeFileSync(
                filePath,
                JSON.stringify({ version: 1, payload: encrypted.toString('base64') }),
                { encoding: 'utf8', mode: 0o600 }
            );
        } catch (error) {
            console.warn('Authentication session will remain in memory only:', error.message);
        }
    }

    function errorFromResponse(error) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        const detail = typeof responseData === 'string'
            ? responseData
            : responseData?.message || responseData?.error || error.message || '';
        const normalized = detail.toLowerCase();

        if (status === 401 && normalized.includes('hwid')) {
            return new AuthError('hwid_mismatch', 'This license is linked to another computer.');
        }
        if (status === 401 && normalized.includes('expired')) {
            return new AuthError('expired', 'This license has expired.');
        }
        if (status === 401 && normalized.includes('not active')) {
            return new AuthError('revoked', 'This license has been revoked.');
        }
        const looksRateLimited = normalized.includes('rate limit')
            || normalized.includes('too many')
            || normalized.includes('limite tempor')
            || normalized.includes('tentativas de acesso');

        if (status === 429 || looksRateLimited) {
            return new AuthError('rate_limited', 'The temporary access attempt limit was reached. Wait about 1 minute and try again.');
        }
        if (status === 401) {
            return new AuthError('invalid_key', 'Invalid license key.');
        }
        if (!error.response) {
            return new AuthError('unavailable', 'The Merlin API is unavailable.');
        }
        return new AuthError('server_error', 'The Merlin API could not validate this license.');
    }

    function publicSession() {
        return {
            authenticated: true,
            license: session.license
        };
    }

    // An expired entitlement must block server operations, but it is not a
    // device-security event. Keeping the local session lets the user see the
    // launcher and renew through their account without entering the key again.
    function preserveExpiredSession() {
        const stored = loadStoredSession();
        if (!stored) return null;
        stored.license = { ...stored.license, status: 'expired' };
        session = stored;
        persistSession();
        return { ...publicSession(), expired: true };
    }

    function normalizeBilling(rawBilling) {
        return {
            accessType: rawBilling?.accessType || 'free',
            billingStatus: rawBilling?.billingStatus || 'none',
            currentPeriodEnd: rawBilling?.currentPeriodEnd || null,
            cancelAtPeriodEnd: Boolean(rawBilling?.cancelAtPeriodEnd),
            canManageSubscription: Boolean(rawBilling?.canManageSubscription)
        };
    }

    async function performLogin(licenseKey) {
        if (!LICENSE_KEY_PATTERN.test(licenseKey)) {
            throw new AuthError('invalid_key', 'Invalid license key format.');
        }

        try {
            let hwid;
            try {
                hwid = await machineIdentity.getHwid();
            } catch (error) {
                console.error('Unable to generate the machine identifier:', error.message);
                throw new AuthError('device_error', 'This computer could not be identified.');
            }
            const response = await axios.post(
                `${baseUrl}/auth/login`,
                { licenseKey, hwid },
                {
                    timeout: 15_000,
                    httpsAgent,
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Merlin/2.0'
                    }
                }
            );
            const data = response.data;

            if (!data?.accessToken || !Number.isFinite(data.expiresIn) || !data.license) {
                throw new AuthError('invalid_response', 'The Merlin API returned an invalid session.');
            }

            session = {
                licenseKey,
                accessToken: data.accessToken,
                accessTokenExpiresAt: Date.now() + data.expiresIn * 1000,
                license: {
                    name: data.license.name,
                    expiresAt: data.license.expiresAt,
                    status: data.license.status,
                    planTier: data.license.planTier || null,
                    billing: normalizeBilling(data.license.billing || data.billing)
                }
            };
            persistSession();
            return publicSession();
        } catch (error) {
            if (error instanceof AuthError) throw error;
            throw errorFromResponse(error);
        }
    }

    async function refresh() {
        const stored = loadStoredSession();
        if (!stored?.licenseKey) {
            throw new AuthError('missing', 'No saved license was found.');
        }

        if (!refreshPromise) {
            refreshPromise = performLogin(stored.licenseKey).finally(() => {
                refreshPromise = null;
            });
        }
        return refreshPromise;
    }

    function hasStoredSession() {
        return Boolean(loadStoredSession());
    }

    async function status() {
        if (!loadStoredSession()) return { authenticated: false, code: 'missing' };

        try {
            return await refresh();
        } catch (error) {
            if (error.code === 'expired') {
                return preserveExpiredSession() || { authenticated: false, code: 'expired' };
            }
            if (['invalid_key', 'revoked', 'hwid_mismatch'].includes(error.code)) {
                clearStoredSession();
            }
            return { authenticated: false, code: error.code || 'server_error' };
        }
    }

    async function login(rawLicenseKey) {
        const licenseKey = String(rawLicenseKey || '').trim().toUpperCase();
        try {
            return await performLogin(licenseKey);
        } catch (error) {
            return { authenticated: false, code: error.code || 'server_error' };
        }
    }

    async function resetHwid(rawLicenseKey) {
        const licenseKey = String(rawLicenseKey || '').trim().toUpperCase();
        if (!LICENSE_KEY_PATTERN.test(licenseKey)) return { ok: false, code: 'invalid_key' };
        try {
            const hwid = await machineIdentity.getHwid();
            const response = await axios.post(`${baseUrl}/auth/reset-hwid`, { licenseKey, hwid }, {
                timeout: 15_000,
                httpsAgent,
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Merlin/2.0' }
            });
            clearStoredSession();
            return { ok: true, ...response.data };
        } catch (error) {
            if (error?.response?.status === 409) return { ok: false, code: 'hwid_reset_unavailable', retryAt: error.response.data?.retryAt || null };
            return { ok: false, code: errorFromResponse(error).code || 'server_error' };
        }
    }

    function logout() {
        refreshPromise = null;
        clearStoredSession();
        onAuthRequired('missing');
        return { ok: true };
    }

    async function getAccessToken() {
        const stored = loadStoredSession();
        if (!stored) {
            onAuthRequired('missing');
            throw new AuthError('missing', 'Authentication is required.');
        }

        if (stored.accessTokenExpiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
            return stored.accessToken;
        }

        try {
            await refresh();
            return session.accessToken;
        } catch (error) {
            if (error.code === 'expired') {
                preserveExpiredSession();
                throw error;
            }
            if (['invalid_key', 'revoked', 'hwid_mismatch'].includes(error.code)) {
                clearStoredSession();
                onAuthRequired(error.code);
            }
            throw error;
        }
    }

    async function createBillingPortalSession() {
        const accessToken = await getAccessToken();
        try {
            const response = await axios.post(
                `${baseUrl}/launcher/billing-portal`,
                {},
                {
                    timeout: 15_000,
                    httpsAgent,
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                        'User-Agent': 'Merlin/2.0'
                    }
                }
            );
            const portalUrl = response.data?.portalUrl;
            if (!portalUrl) {
                throw new AuthError('invalid_response', 'The Merlin API returned an invalid billing portal session.');
            }
            return { ok: true, portalUrl };
        } catch (error) {
            if (error instanceof AuthError) throw error;
            if (error?.response?.status === 401) {
                await handleUnauthorized();
                return createBillingPortalSession();
            }
            if (error?.response?.status === 409) {
                return { ok: false, code: 'billing_unavailable' };
            }
            return { ok: false, code: 'billing_portal_failed' };
        }
    }

    async function createAccessHandoff() {
        const accessToken = await getAccessToken();
        try {
            const response = await axios.post(
                `${baseUrl}/public/access/launcher-handoff`,
                {},
                {
                    timeout: 15_000,
                    httpsAgent,
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                        'User-Agent': 'Merlin/2.0'
                    }
                }
            );
            const token = String(response.data?.token || '').trim();
            if (!token) return { ok: false, code: 'invalid_handoff' };
            return { ok: true, token, expiresAt: response.data?.expiresAt || null };
        } catch (error) {
            if (error?.response?.status === 401) {
                await handleUnauthorized();
                return createAccessHandoff();
            }
            return { ok: false, code: 'handoff_failed' };
        }
    }

    async function handleUnauthorized() {
        if (session) session.accessTokenExpiresAt = 0;
        try {
            const refreshed = await refresh();
            // Login is intentionally allowed for an expired license so it can
            // browse and renew. A protected endpoint must still stop here,
            // rather than retrying the request and disguising expiry as 401.
            if (refreshed?.license?.status === 'expired') {
                preserveExpiredSession();
                throw new AuthError('expired', 'This license has expired.');
            }
        } catch (error) {
            if (error.code === 'expired') {
                preserveExpiredSession();
                throw error;
            }
            if (['invalid_key', 'revoked', 'hwid_mismatch'].includes(error.code)) {
                clearStoredSession();
            }
            onAuthRequired(error.code || 'invalid_key');
            throw error;
        }
    }

    return { createAccessHandoff, createBillingPortalSession, getAccessToken, handleUnauthorized, hasStoredSession, login, logout, resetHwid, status };
}

module.exports = { AuthError, createAuthSession };
