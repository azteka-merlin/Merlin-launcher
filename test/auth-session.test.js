const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createAuthSession } = require('../src/main/auth/auth-session');

function createMemoryFs() {
    const files = new Map();

    return {
        existsSync(filePath) {
            return files.has(filePath);
        },
        readFileSync(filePath) {
            const value = files.get(filePath);
            if (value === undefined) throw new Error(`File not found: ${filePath}`);
            return value;
        },
        writeFileSync(filePath, contents) {
            files.set(filePath, String(contents));
        },
        mkdirSync() {},
        rmSync(filePath) {
            files.delete(filePath);
        }
    };
}

function createSafeStorage() {
    return {
        isEncryptionAvailable: () => true,
        encryptString: value => Buffer.from(value, 'utf8'),
        decryptString: buffer => Buffer.from(buffer).toString('utf8')
    };
}

test('auth session allows retry after transient server validation failure', async () => {
    let attempts = 0;
    const fs = createMemoryFs();
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs,
        path,
        axios: {
            post: async () => {
                attempts += 1;
                if (attempts === 1) {
                    const error = new Error('temporary failure');
                    error.response = { status: 500, data: { message: 'Database update failed' } };
                    throw error;
                }

                return {
                    data: {
                        accessToken: 'token-123',
                        expiresIn: 3600,
                        license: {
                            name: 'Azteka',
                            expiresAt: '2026-12-31',
                            status: 'active'
                        }
                    }
                };
            }
        },
        httpsAgent: {},
        machineIdentity: {
            getHwid: async () => 'merlin-hwid-123'
        },
        baseUrl: 'https://merlin-api.example.com'
    });

    const firstAttempt = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(firstAttempt.authenticated, false);
    assert.equal(firstAttempt.code, 'server_error');
    assert.equal(session.hasStoredSession(), false);

    const secondAttempt = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(secondAttempt.authenticated, true);
    assert.equal(secondAttempt.license.name, 'Azteka');
    assert.equal(secondAttempt.license.billing.canManageSubscription, false);
    assert.equal(session.hasStoredSession(), true);

    const accessToken = await session.getAccessToken();
    assert.equal(accessToken, 'token-123');
    assert.equal(attempts, 2);
});

test('auth session returns rate_limited when the API throttles license attempts', async () => {
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs: createMemoryFs(),
        path,
        axios: {
            post: async () => {
                const error = new Error('too many requests');
                error.response = {
                    status: 429,
                    data: 'O limite temporario de tentativas de acesso foi atingido.'
                };
                throw error;
            }
        },
        httpsAgent: {},
        machineIdentity: {
            getHwid: async () => 'merlin-hwid-123'
        },
        baseUrl: 'https://api-merlin.com/api'
    });

    const result = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(result.authenticated, false);
    assert.equal(result.code, 'rate_limited');
});

test('auth session opens billing portal for manageable monthly subscriptions', async () => {
    const requests = [];
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs: createMemoryFs(),
        path,
        axios: {
            post: async (url, body, options) => {
                requests.push({ url, body, options });
                if (url.endsWith('/auth/login')) {
                    return {
                        data: {
                            accessToken: 'token-billing',
                            expiresIn: 3600,
                            license: {
                                name: 'Azteka',
                                expiresAt: '2026-12-31',
                                status: 'active',
                                billing: {
                                    accessType: 'monthly_subscription',
                                    billingStatus: 'active',
                                    currentPeriodEnd: '2026-09-01T00:00:00.000Z',
                                    cancelAtPeriodEnd: false,
                                    canManageSubscription: true
                                }
                            }
                        }
                    };
                }

                assert.equal(url, 'https://api-merlin.com/api/launcher/billing-portal');
                assert.equal(options.headers.Authorization, 'Bearer token-billing');
                return { data: { success: true, portalUrl: 'https://billing.stripe.com/session/test' } };
            }
        },
        httpsAgent: {},
        machineIdentity: {
            getHwid: async () => 'merlin-hwid-123'
        },
        baseUrl: 'https://api-merlin.com/api'
    });

    const login = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(login.authenticated, true);
    assert.equal(login.license.billing.canManageSubscription, true);

    const portal = await session.createBillingPortalSession();
    assert.deepEqual(portal, { ok: true, portalUrl: 'https://billing.stripe.com/session/test' });
    assert.equal(requests.length, 2);
});

test('auth session logout clears persisted access', async () => {
    let authRequiredCode = null;
    const fs = createMemoryFs();
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs,
        path,
        axios: {
            post: async () => ({
                data: {
                    accessToken: 'token-logout',
                    expiresIn: 3600,
                    license: {
                        name: 'Azteka',
                        expiresAt: '2026-12-31',
                        status: 'active'
                    }
                }
            })
        },
        httpsAgent: {},
        machineIdentity: {
            getHwid: async () => 'merlin-hwid-123'
        },
        baseUrl: 'https://api-merlin.com/api',
        onAuthRequired: code => {
            authRequiredCode = code;
        }
    });

    const login = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(login.authenticated, true);
    assert.equal(session.hasStoredSession(), true);

    assert.deepEqual(session.logout(), { ok: true });
    assert.equal(authRequiredCode, 'missing');
    assert.equal(session.hasStoredSession(), false);
    await assert.rejects(() => session.getAccessToken(), { code: 'missing' });
});

test('expired license keeps the local launcher session but blocks token refresh', async () => {
    let loginAttempts = 0;
    const fs = createMemoryFs();
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs,
        path,
        axios: {
            post: async () => {
                loginAttempts += 1;
                if (loginAttempts === 1) {
                    return {
                        data: {
                            accessToken: 'token-expired',
                            expiresIn: 0,
                            license: { name: 'Azteka', expiresAt: '2026-09-01', status: 'active' }
                        }
                    };
                }
                const error = new Error('License expired');
                error.response = { status: 401, data: { message: 'License expired' } };
                throw error;
            }
        },
        httpsAgent: {},
        machineIdentity: { getHwid: async () => 'merlin-hwid-123' },
        baseUrl: 'https://api-merlin.com/api'
    });

    await session.login('MERLIN-ABCD-EFGH-JKLM');
    const status = await session.status();
    assert.equal(status.authenticated, true);
    assert.equal(status.expired, true);
    assert.equal(status.license.status, 'expired');
    assert.equal(session.hasStoredSession(), true);

    await assert.rejects(() => session.getAccessToken(), { code: 'expired' });
    assert.equal(session.hasStoredSession(), true);
});

test('a protected request reports expired when its session refresh returns an expired license', async () => {
    let loginAttempts = 0;
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs: createMemoryFs(),
        path,
        axios: {
            post: async () => {
                loginAttempts += 1;
                return {
                    data: {
                        accessToken: loginAttempts === 1 ? 'token-active' : 'token-expired',
                        expiresIn: 3600,
                        license: {
                            name: 'Azteka',
                            expiresAt: '2026-09-01',
                            status: loginAttempts === 1 ? 'active' : 'expired'
                        }
                    }
                };
            }
        },
        httpsAgent: {},
        machineIdentity: { getHwid: async () => 'merlin-hwid-123' },
        baseUrl: 'https://api-merlin.com/api'
    });

    await session.login('MERLIN-ABCD-EFGH-JKLM');
    await assert.rejects(() => session.handleUnauthorized(), { code: 'expired' });
    assert.equal((await session.status()).license.status, 'expired');
});
