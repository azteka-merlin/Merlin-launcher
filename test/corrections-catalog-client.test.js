const test = require('node:test');
const assert = require('node:assert/strict');

const { createCorrectionsCatalogClient } = require('../src/main/corrections/corrections-catalog-client');

test('keeps only the first eligible correction and blocks Hypervisor entries', async () => {
    const client = createCorrectionsCatalogClient({
        axios: {
            get: async () => ({
                data: [
                    {
                        appid: 10,
                        name: 'Example Game',
                        releaseDate: '2026-09-18',
                        hasDrm: true,
                        fixes: [
                            {
                                href: 'https://example.com/hypervisor.zip',
                                filename: 'hypervisor.zip',
                                badges: ['Hypervisor']
                            },
                            {
                                href: 'https://example.com/fix.zip',
                                filename: 'fix.zip',
                                size: '1 GB',
                                badges: ['Recommended']
                            },
                            {
                                href: 'https://example.com/fix-2.zip',
                                filename: 'fix-2.zip'
                            }
                        ]
                    }
                ]
            })
        }
    });

    const result = await client.download();

    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0], {
        appId: '10',
        gameName: 'Example Game',
        releaseDate: '2026-09-18',
        hasDrm: true,
        correction: {
            href: 'https://example.com/fix.zip',
            filename: 'fix.zip',
            size: '1 GB',
            adminNote: undefined,
            upvotes: 0,
            downvotes: 0,
            score: 0,
            viewerVote: null
        }
    });
});

test('keeps corrections without catalog metadata sortable after a cache refresh', async () => {
    const client = createCorrectionsCatalogClient({
        axios: {
            get: async () => ({
                data: [{
                    appid: 20,
                    name: 'Unknown metadata game',
                    fixes: [{ href: 'https://example.com/fix.zip', filename: 'fix.zip' }]
                }]
            })
        }
    });

    const result = await client.download();
    assert.equal(result.items[0].releaseDate, null);
    assert.equal(result.items[0].hasDrm, false);
});
