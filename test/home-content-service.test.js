const test = require('node:test');
const assert = require('node:assert/strict');
const { createHomeContentService } = require('../src/main/home/home-content-service');

function home(revision) {
    return { hero: [{ id: 1 }], side: [], showcase: [], revision };
}

test('checks only the revision and reports an unchanged Home without downloading it again', async () => {
    const calls = [];
    const service = createHomeContentService({
        authSession: { getAccessToken: async () => 'token' },
        client: {
            request: async () => { calls.push('request'); return home('1:current'); },
            requestRevision: async () => { calls.push('revision'); return '1:current'; }
        },
        store: { save: value => value, load: () => null },
        baseUrl: 'https://api-merlin.com/api/home'
    });

    await service.get();
    const result = await service.checkForUpdate();

    assert.deepEqual(result, { success: true, changed: false });
    assert.deepEqual(calls, ['request', 'revision']);
});

test('reports a changed Home so the renderer can show skeletons before refreshing', async () => {
    const service = createHomeContentService({
        authSession: { getAccessToken: async () => 'token' },
        client: {
            request: async () => home('1:current'),
            requestRevision: async () => '2:updated'
        },
        store: { save: value => value, load: () => null },
        baseUrl: 'https://api-merlin.com/api/home'
    });

    await service.get();
    assert.deepEqual(await service.checkForUpdate(), { success: true, changed: true });
});
