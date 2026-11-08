const test = require('node:test');
const assert = require('node:assert/strict');
const { createManifestOverrideService } = require('../src/main/games/manifest-override-service');

const games = [{ appId: '1', name: 'A' }, { appId: '2', name: 'B' }, { appId: '3', name: 'C', autoUpdate: false }];
function service(axios, authSession = { getAccessToken: async () => 'synthetic', handleUnauthorized: async () => {} }) {
    return createManifestOverrideService({ axios, authSession, statusUrl: 'https://example.test/api/manifests/status' });
}

test('one batch decorates every game and reuses known policies', async () => {
    const calls = [];
    const s = service({ post: async (url, body) => {
        calls.push({ url, body });
        return { data: { items: body.appIds.map(appId => ({ appId, requiresVersionPin: appId === '2' })) } };
    }, get: async () => { throw Error('unexpected single request'); } });
    const result = await s.decorateGames(games);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.appIds, ['1', '2', '3']);
    assert.deepEqual(result.map(item => [item.requiresVersionPin, item.autoUpdate]), [[false, true], [true, false], [false, false]]);
    await s.decorateGames(games);
    assert.equal(calls.length, 1);
});

test('older API falls back to existing individual policy requests', async () => {
    const calls = [];
    const s = service({ post: async () => { throw Object.assign(Error('missing route'), { response: { status: 404 } }); },
        get: async (_url, options) => { calls.push(options.params.appid); return { data: { requiresVersionPin: options.params.appid === '2' } }; } });
    const result = await s.decorateGames(games);
    assert.deepEqual(calls.sort(), ['1', '2', '3']);
    assert.equal(result[1].requiresVersionPin, true);
});

test('temporary batch failures do not issue a burst of individual retries', async () => {
    let singleCalls = 0;
    const s = service({ post: async () => { throw Error('network failed'); }, get: async () => { singleCalls++; } });
    const result = await s.decorateGames(games);
    assert.equal(singleCalls, 0);
    assert.equal(result.length, 3);
});
