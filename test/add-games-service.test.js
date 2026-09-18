const test = require('node:test');
const assert = require('node:assert/strict');

const { createAddGamesService } = require('../src/main/games/add-games-service');
const { createGameQueue } = require('../src/main/games/game-queue');

test('installs queued games sequentially, removing successes and retaining failures', async () => {
    let active = 0;
    let maximumActive = 0;
    const autoUpdateByAppId = {};
    const gameInstaller = {
        install: async ({ appId, onProgress, autoUpdate }) => {
            active++;
            maximumActive = Math.max(maximumActive, active);
            autoUpdateByAppId[appId] = autoUpdate;
            onProgress({ message: 'Installing', percent: 50 });
            await new Promise(resolve => setTimeout(resolve, 5));
            active--;
            return appId === '2'
                ? { success: false, message: 'Unavailable' }
                : { success: true, message: 'Installed' };
        }
    };
    const queue = createGameQueue();
    const service = createAddGamesService({
        parseSteamGameLink: link => ({ appId: link, fallbackName: `Game ${link}` }),
        nameResolver: { resolve: async (_appId, fallback) => fallback },
        catalogService: {
            resolveByAppId: async appId => ({ appId, name: `Game ${appId}`, coverUrl: `https://example.com/${appId}.jpg` }),
            search: async () => []
        },
        queue,
        gameInstaller,
        configStore: { get: () => ({ steamPath: 'C:\\Steam' }) },
        steamService: {}
    });

    await service.add({ raw: '1', autoUpdate: true });
    await service.add({ raw: '2', autoUpdate: false });
    await service.add({ raw: '3', autoUpdate: true });
    const progress = [];
    const result = await service.installAll({ progress: item => progress.push(item) });

    assert.equal(maximumActive, 1);
    assert.deepEqual(result.installed.map(item => item.appId), ['1', '3']);
    assert.deepEqual(result.failed.map(item => item.appId), ['2']);
    assert.deepEqual(service.queueState().items.map(item => item.appId), ['2']);
    assert.equal(service.queueState().items[0].coverUrl, 'https://example.com/2.jpg');
    assert.equal(service.queueState().items[0].autoUpdate, false);
    assert.deepEqual(autoUpdateByAppId, { '1': true, '2': false, '3': true });
    assert.deepEqual(progress.map(item => item.current), [1, 2, 3]);
});

test('blocks install now while the queue contains any game', async () => {
    const queue = createGameQueue();
    const service = createAddGamesService({
        parseSteamGameLink: link => ({ appId: link, fallbackName: `Game ${link}` }),
        nameResolver: { resolve: async (_appId, fallback) => fallback },
        catalogService: {
            resolveByAppId: async appId => ({ appId, name: `Game ${appId}`, coverUrl: `https://example.com/${appId}.jpg` }),
            search: async () => []
        },
        queue,
        gameInstaller: { install: async () => ({ success: true }) },
        configStore: { get: () => ({ steamPath: 'C:\\Steam' }) },
        steamService: {}
    });

    await service.add({ raw: '1', autoUpdate: true });
    const result = await service.installNow('2');

    assert.equal(result.success, false);
    assert.equal(result.code, 'queue_not_empty');
});

test('searches the catalog and installs a selected game with cover metadata', async () => {
    let receivedAutoUpdate = null;
    const service = createAddGamesService({
        parseSteamGameLink: link => ({ appId: link, fallbackName: `Game ${link}` }),
        nameResolver: { resolve: async (_appId, fallback) => fallback },
        catalogService: {
            resolveByAppId: async appId => ({ appId, name: `Catalog ${appId}`, coverUrl: `https://example.com/${appId}.jpg` }),
            search: async query => query === 'final fantasy'
                ? [
                    { appId: '10', name: 'Final Fantasy', coverUrl: 'https://example.com/10.jpg' },
                    { appId: '20', name: 'Final Fantasy II', coverUrl: 'https://example.com/20.jpg' }
                ]
                : []
        },
        queue: createGameQueue(),
        gameInstaller: {
            install: async ({ autoUpdate }) => {
                receivedAutoUpdate = autoUpdate;
                return { success: true, message: 'Installed' };
            }
        },
        configStore: { get: () => ({ steamPath: 'C:\\Steam' }) },
        steamService: {}
    });

    const search = await service.searchCatalog('final fantasy');
    const install = await service.installNow({ selected: search.items[0], autoUpdate: false });

    assert.equal(search.success, true);
    assert.equal(search.items.length, 2);
    assert.equal(install.success, true);
    assert.equal(install.item.coverUrl, 'https://example.com/10.jpg');
    assert.equal(install.item.autoUpdate, false);
    assert.equal(receivedAutoUpdate, false);
});

test('preserves test license normal activation limit errors', async () => {
    const service = createAddGamesService({
        parseSteamGameLink: link => ({ appId: link, fallbackName: `Game ${link}` }),
        nameResolver: { resolve: async (_appId, fallback) => fallback },
        catalogService: {
            resolveByAppId: async appId => ({ appId, name: `Catalog ${appId}`, coverUrl: `https://example.com/${appId}.jpg` }),
            search: async () => []
        },
        queue: createGameQueue(),
        gameInstaller: {
            install: async () => ({
                success: false,
                reason: 'test_limit_normal',
                message: 'O limite de ativacoes normais desta licenca de teste foi atingido.'
            })
        },
        configStore: { get: () => ({ steamPath: 'C:\\Steam' }) },
        steamService: {}
    });

    const install = await service.installNow({ selected: { appId: '10', name: 'God of War' } });

    assert.equal(install.success, false);
    assert.equal(install.code, 'test_limit_normal');
    assert.equal(install.message, 'O limite de ativacoes normais desta licenca de teste foi atingido.');
});

test('preserves an expired license error instead of reducing it to a generic installation failure', async () => {
    const service = createAddGamesService({
        parseSteamGameLink: link => ({ appId: link, fallbackName: `Game ${link}` }),
        nameResolver: { resolve: async (_appId, fallback) => fallback },
        catalogService: {
            resolveByAppId: async appId => ({ appId, name: `Catalog ${appId}`, coverUrl: null }),
            search: async () => []
        },
        queue: createGameQueue(),
        gameInstaller: {
            install: async () => ({ success: false, reason: 'expired', message: 'License expired' })
        },
        configStore: { get: () => ({ steamPath: 'C:\\Steam' }) },
        steamService: {}
    });

    const install = await service.installNow({ selected: { appId: '10', name: 'God of War' } });

    assert.equal(install.success, false);
    assert.equal(install.code, 'expired');
});
