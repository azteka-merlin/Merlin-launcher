const test = require('node:test');
const assert = require('node:assert/strict');

const { createPremiumService } = require('../src/main/premium/premium-service');

test('premium catalog refresh renews a rejected access token once', async () => {
    const requestedTokens = [];
    let renewed = false;
    const service = createPremiumService({
        app: {},
        fs: {},
        path: {},
        AdmZip: {},
        shell: {},
        configStore: { get: () => ({}) },
        steamService: {},
        authSession: {
            getAccessToken: async () => renewed ? 'fresh-token' : 'expired-token',
            handleUnauthorized: async () => {
                renewed = true;
            }
        },
        catalogStore: {
            list: () => [],
            replace: () => {}
        },
        catalogClient: {
            requestCatalog: async token => {
                requestedTokens.push(token);
                if (token === 'expired-token') {
                    const error = new Error('Unauthorized');
                    error.response = { status: 401 };
                    throw error;
                }
                return { items: [], syncedAt: '2026-08-25T00:00:00.000Z' };
            }
        },
        downloadManager: {}
    });

    const result = await service.refresh();

    assert.deepEqual(requestedTokens, ['expired-token', 'fresh-token']);
    assert.equal(result.success, true);
    assert.equal(result.stale, false);
    assert.equal(result.online, true);

    const cached = await service.list();
    assert.equal(cached.success, true);
    assert.equal(cached.online, false);
});
