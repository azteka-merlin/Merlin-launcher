const test = require('node:test');
const assert = require('node:assert/strict');
const { createArchiveClient } = require('../src/main/network/archive-client');

test('a failed Merlin API request does not delay the next request', async () => {
    let calls = 0;
    const client = createArchiveClient({
        axios: {
            get: async () => {
                calls++;
                if (calls === 1) throw { response: { status: 429, headers: { 'retry-after': '300' } } };
                return { data: Buffer.from('ok') };
            }
        }
    });
    const source = { name: 'merlin-api', url: 'https://example.test/manifests', retries: 1 };

    await assert.rejects(client.request(source));
    const result = await client.request(source);
    assert.equal(result.data.toString(), 'ok');
    assert.equal(calls, 2);
});
