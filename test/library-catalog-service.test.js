const test = require('node:test');
const assert = require('node:assert/strict');

const { createLibraryCatalogService } = require('../src/main/library/library-catalog-service');

function createFixture(initialGames = {}) {
    const state = {
        games: { ...initialGames },
        syncedAt: null
    };

    return {
        catalogStore: {
            needsBootstrap: () => Object.keys(state.games).length === 0,
            load: () => ({ games: state.games, syncedAt: state.syncedAt }),
            replace: (games, syncedAt) => {
                state.games = { ...games };
                state.syncedAt = syncedAt || null;
            },
            get: appId => state.games[appId] || null
        }
    };
}

test('search refreshes the catalog once when no local name match is found', async () => {
    let downloads = 0;
    const fixture = createFixture({
        '10': { name: 'Dead Cells', coverUrl: null, coverSource: null }
    });

    const service = createLibraryCatalogService({
        catalogStore: fixture.catalogStore,
        catalogClient: {
            download: async () => {
                downloads += 1;
                return {
                    games: {
                        '10': { name: 'Dead Cells', coverUrl: null, coverSource: null },
                        '20': { name: 'Final Fantasy XVI', coverUrl: 'https://example.com/20.jpg', coverSource: 'capsule_image' }
                    },
                    syncedAt: '2026-06-21T00:00:00Z'
                };
            }
        }
    });

    const results = await service.search('final fantasy');

    assert.equal(downloads, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].appId, '20');
    assert.equal(results[0].name, 'Final Fantasy XVI');
});

test('search does not refresh when the local catalog already has name matches', async () => {
    let downloads = 0;
    const fixture = createFixture({
        '20': { name: 'Final Fantasy XVI', coverUrl: 'https://example.com/20.jpg', coverSource: 'capsule_image' }
    });

    const service = createLibraryCatalogService({
        catalogStore: fixture.catalogStore,
        catalogClient: {
            download: async () => {
                downloads += 1;
                return {
                    games: {},
                    syncedAt: '2026-06-21T00:00:00Z'
                };
            }
        }
    });

    const results = await service.search('final fantasy');

    assert.equal(downloads, 0);
    assert.equal(results.length, 1);
    assert.equal(results[0].appId, '20');
});

test('remote search success is distinguishable from a local cache result', async () => {
    const fixture = createFixture({
        '20': { name: 'Final Fantasy XVI', coverUrl: 'https://example.com/20.jpg', coverSource: 'capsule_image' }
    });
    const service = createLibraryCatalogService({
        catalogStore: fixture.catalogStore,
        catalogClient: { download: async () => ({ games: {}, syncedAt: null }) },
        searchClient: { search: async () => [] }
    });

    const result = await service.searchWithStatus('final fantasy');

    assert.equal(result.items.length, 1);
    assert.equal(result.online, true);
});

test('local search results do not count as an online service response', async () => {
    const fixture = createFixture({
        '20': { name: 'Final Fantasy XVI', coverUrl: 'https://example.com/20.jpg', coverSource: 'capsule_image' }
    });
    const service = createLibraryCatalogService({
        catalogStore: fixture.catalogStore,
        catalogClient: { download: async () => ({ games: {}, syncedAt: null }) }
    });

    const result = await service.searchWithStatus('final fantasy');

    assert.equal(result.items.length, 1);
    assert.equal(result.online, false);
});

test('reuses old local catalog entries and strips the ryuu fallback image', async () => {
    const fixture = createFixture({
        '1736800': { name: 'PRAGMATA', coverUrl: null, coverSource: null }
    });

    const service = createLibraryCatalogService({
        catalogStore: fixture.catalogStore,
        catalogClient: {
            download: async () => ({
                games: {},
                syncedAt: '2026-06-21T00:00:00Z'
            })
        }
    });

    const results = await service.search('pragmata');

    assert.equal(results.length, 1);
    assert.equal(results[0].appId, '1736800');
    assert.equal(results[0].coverUrl, null);
    assert.equal(results[0].coverSource, null);
});
