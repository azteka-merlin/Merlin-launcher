const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameSearchClient } = require('../src/main/games/game-search-client');

test('library metadata mode is opt-in and survives an access token refresh', async () => {
    const requests = [];
    let unauthorized = false;
    const client = createGameSearchClient({
        authSession: { getAccessToken: async () => 'test-token', handleUnauthorized: async () => {} },
        axios: { post: async (_url, body) => {
            requests.push(body);
            if (unauthorized) { unauthorized = false; throw { response: { status: 401 } }; }
            return { data: { items: [] } };
        } }
    });
    await client.search('10');
    assert.equal('metadataOnly' in requests[0], false);
    unauthorized = true;
    await client.search('20', { metadataOnly: true });
    assert.equal(requests.length, 3);
    assert.equal(requests[1].metadataOnly, true); assert.equal(requests[2].metadataOnly, true);
});
