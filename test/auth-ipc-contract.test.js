const test = require('node:test');
const assert = require('node:assert/strict');

const { getAccessUrl, getPlansUrl, registerAuthIpc } = require('../src/main/ipc/register-auth-ipc');

test('registers auth IPC channels', () => {
    const channels = [];

    registerAuthIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        authSession: {},
        shell: {},
        apiBaseUrl: 'https://api-merlin.com/api'
    });

    assert.deepEqual(channels, [
        'auth:has-session',
        'auth:remembered-key',
        'auth:forget-remembered-key',
        'auth:status',
        'auth:login',
        'auth:reset-hwid',
        'auth:logout',
        'auth:manage-subscription',
        'auth:open-signup',
        'auth:open-plans',
        'auth:open-access'
    ]);
});

test('passes the remember-key choice to authentication and exposes only the saved key', async () => {
    const handlers = new Map();
    const calls = [];
    registerAuthIpc({
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        authSession: {
            getRememberedKey: () => 'MERLIN-ABCD-EFGH-JKLM',
            forgetRememberedKey: () => { calls.push('forgot'); return true; },
            login: (key, remember) => {
                calls.push({ key, remember });
                return { authenticated: true };
            }
        },
        shell: {},
        apiBaseUrl: 'https://api-merlin.com/api'
    });

    assert.equal(await handlers.get('auth:remembered-key')(), 'MERLIN-ABCD-EFGH-JKLM');
    assert.equal(handlers.get('auth:forget-remembered-key')(), true);
    assert.deepEqual(await handlers.get('auth:login')(null, 'MERLIN-ABCD-EFGH-JKLM', true), { authenticated: true });
    assert.deepEqual(calls, ['forgot', { key: 'MERLIN-ABCD-EFGH-JKLM', remember: true }]);
});

test('opens the public access page', () => {
    assert.equal(
        getAccessUrl('https://staging.api-merlin.com/api'),
        'https://staging.api-merlin.com/meu-acesso'
    );
});

test('opens the public plans section with an explicit focus target', () => {
    assert.equal(
        getPlansUrl('https://staging.api-merlin.com/api'),
        'https://staging.api-merlin.com/download?focus=planos#planos'
    );
});

test('clears account-bound caches when logging out', async () => {
    let logoutHandler;
    let logoutCalls = 0;
    let cacheClears = 0;

    registerAuthIpc({
        ipcMain: {
            handle: (channel, handler) => {
                if (channel === 'auth:logout') {
                    logoutHandler = handler;
                }
            }
        },
        authSession: {
            logout: () => {
                logoutCalls += 1;
                return { success: true };
            }
        },
        shell: {},
        apiBaseUrl: 'https://api-merlin.com/api',
        onLogout: () => {
            cacheClears += 1;
        }
    });

    assert.deepEqual(await logoutHandler(), { success: true });
    assert.equal(logoutCalls, 1);
    assert.equal(cacheClears, 1);
});

test('successful login resumes optional cloud work without blocking account access', async () => {
    const handlers = new Map();
    let releaseCloud;
    const cloudWork = new Promise(resolve => { releaseCloud = resolve; });
    let started = false;
    registerAuthIpc({
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
        authSession: { login: async () => ({ authenticated: true }) },
        shell: {},
        apiBaseUrl: 'https://staging.api-merlin.com/api',
        onAuthenticated: async () => { started = true; await cloudWork; }
    });
    assert.deepEqual(await handlers.get('auth:login')(null, 'KEY', false), { authenticated: true });
    await Promise.resolve();
    assert.equal(started, true);
    releaseCloud();
});
