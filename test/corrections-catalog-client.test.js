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
                        manualAddedAt: '2026-09-17',
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
        imageUrl: null,
        releaseDate: '2026-09-18',
        manualAddedAt: '2026-09-17',
        hasDrm: true,
        activationType: null,
        minimumLauncherVersion: null,
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

test('preserves special correction metadata from the API', async () => {
    const client = createCorrectionsCatalogClient({
        axios: {
            get: async () => ({
                data: [{
                    appid: 4407750,
                    name: 'Special game',
                    imageUrl: 'https://generator.ryuu.lol/files/images/4080220.jpg',
                    activationType: 'license_token',
                    minimumLauncherVersion: '1.6.8',
                    fixes: [{ href: 'https://example.com/fix.zip', filename: 'fix.zip' }]
                }]
            })
        }
    });

    const result = await client.download();
    assert.equal(result.items[0].activationType, 'license_token');
    assert.equal(result.items[0].minimumLauncherVersion, '1.6.8');
    assert.equal(result.items[0].imageUrl, 'https://generator.ryuu.lol/files/images/4080220.jpg');
});

test('excludes Online fixes and retains another eligible file for the same game', async () => {
    const online = { href: 'https://example.com/online.zip', filename: 'online.zip', badges: ['Tested', ' oNLiNe '] };
    const regular = { href: 'https://example.com/regular.zip', filename: 'regular.zip' };
    const client = createCorrectionsCatalogClient({
        axios: { get: async () => ({ data: [
            { appid: 10, name: 'Online only', fixes: [online] },
            { appid: 20, name: 'Alternative correction', fixes: [online, regular] },
            { appid: 30, name: 'Regular correction', fixes: [regular] }
        ] }) }
    });
    const result = await client.download();
    assert.deepEqual(result.items.map(item => item.appId), ['20', '30']);
    assert.equal(result.items[0].correction.filename, 'regular.zip');
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
    assert.equal(result.items[0].manualAddedAt, null);
    assert.equal(result.items[0].hasDrm, false);
});
