const test = require('node:test');
const assert = require('node:assert/strict');

const { createLicenseTokenClient } = require('../src/main/corrections/license-token-client');

test('sends the launcher version, appid and raw license bytes', async () => {
    let captured;
    const client = createLicenseTokenClient({
        axios: {
            post: async (...args) => {
                captured = args;
                return { data: { success: true, token: 'token-value' } };
            }
        },
        authSession: { getAccessToken: async () => 'access-token' },
        url: 'https://staging.example/api/fixes/license-token',
        launcherVersion: '1.6.8'
    });

    const bytes = Buffer.from('license');
    assert.equal(await client.generate({ appId: '4407750', licenseBytes: bytes }), 'token-value');
    assert.equal(captured[0], 'https://staging.example/api/fixes/license-token');
    assert.equal(captured[1], bytes);
    assert.equal(captured[2].params.appid, '4407750');
    assert.equal(captured[2].headers.Authorization, 'Bearer access-token');
    assert.equal(captured[2].headers['X-Merlin-Version'], '1.6.8');
});

test('refreshes authentication once after a 401', async () => {
    let requests = 0;
    let refreshes = 0;
    const client = createLicenseTokenClient({
        axios: {
            post: async () => {
                requests += 1;
                if (requests === 1) {
                    const error = new Error('unauthorized');
                    error.response = { status: 401 };
                    throw error;
                }
                return { data: { success: true, token: 'renewed-token' } };
            }
        },
        authSession: {
            getAccessToken: async () => requests === 0 ? 'old' : 'new',
            handleUnauthorized: async () => { refreshes += 1; }
        },
        url: 'https://staging.example/api/fixes/license-token',
        launcherVersion: '1.6.8'
    });

    assert.equal(await client.generate({ appId: '4407750', licenseBytes: Buffer.from('x') }), 'renewed-token');
    assert.equal(requests, 2);
    assert.equal(refreshes, 1);
});
