const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPremiumService } = require('../src/main/premium/premium-service');
const { createPremiumCatalogClient } = require('../src/main/premium/premium-catalog-client');
const { createPremiumCatalogStore } = require('../src/main/premium/premium-catalog-store');
const game = () => ({ appId: '123', gameName: 'Game', activationType: 'steam_ticket', archiveAvailable: true,
    availability: { availableSlots: 0, cooldownEntries: [] }, viewer: { status: 'available', canActivate: true } });
const token = account => `header.${Buffer.from(JSON.stringify({ sub: account })).toString('base64url')}.signature`;
function harness(t, options = {}) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-premium-test-')); t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    let config = options.config || {};
    let stored = [game()];
    let account = '7';
    const service = createPremiumService({ app: { getPath: () => temp }, fs, path, AdmZip: {}, shell: {},
        configStore: { get: () => config, update: values => { config = { ...config, ...values }; } },
        steamService: { getActivationReadiness: () => ({}), findInstalledGame: () => ({ installed: true, gamePath: temp }) },
        authSession: { getAccessToken: async () => token(account), handleUnauthorized: async () => {} },
        catalogStore: { list: () => structuredClone(stored), replace: items => { stored = structuredClone(items); }, clear: () => { stored = []; } },
        catalogClient: { requestCatalog: async () => ({ items: [game()] }),
            activate: options.activate || (async () => ({ activation: { archiveDownloadUrl: 'https://example.com/archive.zip', configIni: 'config' } })),
            authenticatedAction: options.action || (async () => ({ success: true, status: 'pending' })), logActivationEvent: async () => {}, ...options.client },
        downloadManager: { download: async () => ({ success: false, code: 'download_failed' }), cancel() {} }
    });
    return { service, config: () => config, stored: () => stored, account: value => { account = value; } };
}

test('an uncertain local failure persists its operation by account and catalog caching preserves it', async t => {
    const ctx = harness(t);
    const result = await ctx.service.activate('123', 'op-1');
    assert.equal(result.success, false); assert.equal(result.statusRequired, true);
    assert.equal(ctx.config().premiumPendingOperations[0].account, '7');
    assert.equal(ctx.stored()[0].viewer.pendingOperationId, 'op-1');
    const refreshed = await ctx.service.refresh();
    assert.equal(refreshed.items[0].viewer.pendingOperationId, 'op-1');
    ctx.account('8');
    const otherAccount = await ctx.service.refresh();
    assert.equal(otherAccount.items[0].viewer.pendingOperationId, null);
});

test('a terminal operation result removes only the authenticated account pending entry', async t => {
    const ctx = harness(t, { config: { premiumPendingOperations: [
        { account: '7', appId: '123', operationId: 'op-1' }, { account: '8', appId: '123', operationId: 'op-1' }
    ] }, action: async () => ({ success: true, status: 'active', cooldownUntil: '2099-01-01T00:00:00Z' }) });
    await ctx.service.accountAction({ kind: 'operation-status', operationId: 'op-1' });
    assert.deepEqual(ctx.config().premiumPendingOperations, [{ account: '8', appId: '123', operationId: 'op-1' }]);
});

test('definite rejected activation clears pending status while network loss preserves it', async t => {
    const rejected = harness(t, { activate: async () => { throw Object.assign(new Error('No slots'), { response: { status: 409, data: { error: 'No slots' } } }); } });
    assert.equal((await rejected.service.activate('123', 'reject-1')).statusRequired, false);
    const uncertain = harness(t, { activate: async () => { throw new Error('Network timeout'); } });
    assert.equal((await uncertain.service.activate('123', 'timeout-1')).statusRequired, true);
});

test('catalog refresh after logout cannot write the previous account cache', async t => {
    let finish;
    const ctx = harness(t, { client: { requestCatalog: () => new Promise(resolve => { finish = resolve; }) } });
    const refreshing = ctx.service.refresh(); await new Promise(resolve => setImmediate(resolve));
    ctx.service.clearCache(); finish({ items: [game()] });
    assert.equal((await refreshing).code, 'auth_required'); assert.deepEqual(ctx.stored(), []);
});

test('wishlist and retry fields survive persisted catalog normalization', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-catalog-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'catalog.json');
    const store = () => createPremiumCatalogStore({ fs, path, getFilePath: () => file });
    const upcoming = game(); upcoming.comingSoon = true; Object.assign(upcoming.viewer, { wishlisted: true, slotWatching: true, contactEmail: 'owner@example.com', retry: { id: '9', status: 'available', expiresAt: '2099-01-01T00:00:00Z' }, pendingOperationId: 'op-2' });
    store().replace([upcoming]); const read = store().list()[0];
    assert.equal(read.comingSoon, true); assert.equal(read.viewer.wishlisted, true); assert.equal(read.viewer.slotWatching, true);
    assert.equal(read.viewer.retry.id, '9'); assert.equal(read.viewer.pendingOperationId, 'op-2'); assert.equal(read.viewer.contactEmail, 'owner@example.com');
});

test('catalog client sends one operation id with the exclusive retry and scoped contact routes', async () => {
    const calls = [];
    const axios = { post: async (...args) => { calls.push(args); return { data: { success: true } }; },
        get: async (...args) => { calls.push(args); return { data: { success: true, status: 'pending' } }; },
        delete: async (...args) => { calls.push(args); return { data: { success: true } }; } };
    const client = createPremiumCatalogClient({ axios, activateUrl: 'https://staging.api-merlin.com/api/premium/activate' });
    await client.activate({ appId: '123', accessToken: 'token', operationId: 'op-1', retryGrantId: '7' });
    assert.deepEqual(calls[0][1], { appId: '123', operationId: 'op-1', retryGrantId: '7' });
    await client.authenticatedAction({ kind: 'wishlist', appId: '123', data: { email: 'test@example.com' }, accessToken: 'token' });
    assert.equal(calls[1][0], 'https://staging.api-merlin.com/api/premium/wishlist/123');
    await client.authenticatedAction({ kind: 'operation-status', operationId: 'op-1', accessToken: 'token' });
    assert.equal(calls[2][0], 'https://staging.api-merlin.com/api/premium/operation-status?operationId=op-1');
});

test('confirmed server cooldown settles the persisted marker as well as memory', async t => {
    const ctx = harness(t, { action: async () => ({ success: true, status: 'active', cooldownUntil: '2099-01-01T00:00:00Z' }) });
    await ctx.service.activate('123', 'op-1');
    await ctx.service.accountAction({ kind: 'operation-status', operationId: 'op-1' });
    assert.equal(ctx.stored()[0].viewer.pendingOperationId, null);
    assert.equal(ctx.stored()[0].viewer.status, 'cooldown');
    assert.equal(ctx.stored()[0].viewer.cooldownUntil, '2099-01-01T00:00:00Z');
    assert.deepEqual(ctx.config().premiumPendingOperations, []);
});

test('a restart restores an uncertain operation even with an offline catalog', async t => {
    const ctx = harness(t, { config: { premiumPendingOperations: [{ account: '7', appId: '123', operationId: 'restore-1' }] },
        client: { requestCatalog: async () => { throw new Error('offline'); } } });
    const result = await ctx.service.list();
    assert.equal(result.online, false); assert.equal(result.items[0].viewer.pendingOperationId, 'restore-1');
});
