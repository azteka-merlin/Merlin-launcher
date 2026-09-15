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
