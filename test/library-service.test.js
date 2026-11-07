const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLibraryService } = require('../src/main/library/library-service');

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-library-'));
    const luaDirectory = path.join(root, 'config', 'stplug-in');
    const manifestDirectory = path.join(root, 'depotcache');
    fs.mkdirSync(luaDirectory, { recursive: true });
    fs.mkdirSync(manifestDirectory, { recursive: true });
    fs.writeFileSync(path.join(root, 'steam.exe'), '');
    const cache = {};
    const catalog = {};
    const cacheStore = {
        load: () => cache,
        get: appId => cache[appId] || null,
        hasCompleteMetadata: appId => {
            const entry = cache[appId];
            return Boolean(entry && entry.name && (entry.coverUrl || entry.notFoundInCatalog));
        },
        merge: (appId, data) => {
            const current = cache[appId] || {
                name: '',
                coverUrl: null,
                coverSource: null,
                notFoundInCatalog: false
            };
            cache[appId] = {
                name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : current.name,
                coverUrl: Object.prototype.hasOwnProperty.call(data, 'coverUrl')
                    ? data.coverUrl
                    : current.coverUrl,
                coverSource: Object.prototype.hasOwnProperty.call(data, 'coverSource')
                    ? data.coverSource
                    : current.coverSource,
                notFoundInCatalog: Object.prototype.hasOwnProperty.call(data, 'notFoundInCatalog')
                    ? Boolean(data.notFoundInCatalog)
                    : current.notFoundInCatalog
            };
            return true;
        }
    };
    const catalogStore = {
        load: () => ({ games: catalog }),
        get: appId => catalog[appId] || null,
        replace: entries => {
            for (const key of Object.keys(catalog)) delete catalog[key];
            Object.assign(catalog, entries);
        },
        needsBootstrap: () => Object.keys(catalog).length === 0
    };
    return { root, luaDirectory, manifestDirectory, cache, cacheStore, catalog, catalogStore };
}

function serviceFor(fixture, download, overrides = {}) {
    return createLibraryService({
        fs,
        path,
        configStore: { get: () => ({ steamPath: fixture.root }) },
        cacheStore: fixture.cacheStore,
        catalogStore: fixture.catalogStore,
        catalogService: {
            enrichAppIds: async (appIds, { allowCatalogRefresh = true } = {}) => {
                assert.equal(allowCatalogRefresh, false, 'Library must never download the Ryuu catalog');
                const downloaded = await download();
                Object.assign(fixture.catalog, downloaded.games);

                const resolved = new Map();
                for (const appId of appIds) {
                    const entry = fixture.catalogStore.get(appId);
                    if (entry) resolved.set(appId, entry);
                }
                return resolved;
            },
            rememberEntries: items => {
                for (const item of items || []) {
                    if (!item?.appId) continue;
                    fixture.catalog[item.appId] = {
                        name: item.name,
                        coverUrl: item.coverUrl || null,
                        coverSource: item.coverSource || null
                    };
                }
            }
        },
        steamService: overrides.steamService || { isRunning: async () => true },
        shell: overrides.shell || { openPath: async () => '' }
    });
}

test('reuses cached metadata without downloading the remote catalog', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '1.lua'), 'addappid(1)');
    fixture.cache['1'] = {
        name: 'Cached Game',
        coverUrl: 'https://example.com/cached.jpg',
        coverSource: 'header_image',
        notFoundInCatalog: false
    };
    let downloads = 0;
    const service = serviceFor(fixture, async () => {
        downloads += 1;
        return { games: {}, syncedAt: '2026-06-21T00:00:00Z' };
    });

    const result = await service.list();

    assert.equal(result.success, true);
    assert.equal(downloads, 0);
    assert.deepEqual(result.items[0], {
        appId: '1',
        gameName: 'Cached Game',
        coverUrl: 'https://example.com/cached.jpg'
    });
});

test('uses the local catalog before downloading the remote catalog', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '2.lua'), 'addappid(2)');
    fixture.catalog['2'] = {
        name: 'Catalog Game',
        coverUrl: 'https://example.com/catalog.jpg',
        coverSource: 'header_image'
    };
    let downloads = 0;
    const service = serviceFor(fixture, async () => {
        downloads += 1;
        return { games: {}, syncedAt: '2026-06-21T00:00:00Z' };
    });

    const result = await service.list();

    assert.equal(result.success, true);
    assert.equal(downloads, 0);
    assert.equal(fixture.cache['2'].name, 'Catalog Game');
    assert.equal(fixture.cache['2'].coverUrl, 'https://example.com/catalog.jpg');
});

test('returns the local library first and enriches missing metadata separately', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '3.lua'), 'addappid(3)');
    let downloads = 0;
    const service = serviceFor(fixture, async () => {
        downloads += 1;
        return {
            games: {
                '3': {
                    name: 'Remote Game',
                    coverUrl: 'https://example.com/remote.jpg',
                    coverSource: 'header_image'
                }
            },
            syncedAt: '2026-06-21T00:00:00Z'
        };
    });

    const result = await service.list();

    assert.equal(result.success, true);
    assert.equal(downloads, 0);
    assert.equal(result.items[0].gameName, '');
    const enriched = await service.refreshMetadata();
    assert.equal(downloads, 1);
    assert.equal(enriched.items[0].gameName, 'Remote Game');
    assert.equal(enriched.items[0].coverUrl, 'https://example.com/remote.jpg');
});

test('does not poison missing metadata and allows a later explicit retry', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '4.lua'), 'addappid(4)');
    let downloads = 0;
    const service = serviceFor(fixture, async () => {
        downloads += 1;
        if (downloads === 1) {
            return { games: {}, syncedAt: '2026-06-21T00:00:00Z' };
        }
        return {
            games: {
                '4': {
                    name: 'Found Later',
                    coverUrl: 'https://example.com/found-later.jpg',
                    coverSource: 'header_image'
                }
            },
            syncedAt: '2026-06-22T00:00:00Z'
        };
    });

    const first = await service.list();

    assert.equal(first.success, true);
    assert.equal(first.items[0].gameName, '');
    assert.equal(first.items[0].coverUrl, 'https://generator.ryuu.lol/files/images/4.jpg');
    assert.equal(downloads, 0);
    await service.refreshMetadata();

    const second = await service.list();

    assert.equal(second.success, true);
    assert.notEqual(fixture.cache['4']?.notFoundInCatalog, true);
    assert.equal(downloads, 1);

    const refreshed = await service.refreshMetadata({ force: true });

    assert.equal(refreshed.success, true);
    assert.equal(downloads, 2);
    assert.equal(refreshed.items[0].gameName, 'Found Later');
    assert.equal(refreshed.items[0].coverUrl, 'https://example.com/found-later.jpg');
    assert.equal(fixture.cache['4'].notFoundInCatalog, false);
});

test('keeps original local photo hints for the persistent cover service', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '1736800.lua'), 'addappid(1736800)');
    fixture.cache['1736800'] = {
        name: 'PRAGMATA',
        coverUrl: null,
        coverSource: null,
        notFoundInCatalog: true
    };
    fixture.catalog['1736800'] = {
        name: 'PRAGMATA',
        coverUrl: 'https://generator.ryuu.lol/files/images/1736800.jpg',
        coverSource: 'ryuu_image'
    };
    let downloads = 0;
    const service = serviceFor(fixture, async () => {
        downloads += 1;
        return { games: {}, syncedAt: '2026-06-21T00:00:00Z' };
    });

    const result = await service.list();

    assert.equal(result.success, true);
    assert.equal(downloads, 0);
    assert.equal(result.items[0].coverUrl, 'https://generator.ryuu.lol/files/images/1736800.jpg');
    assert.equal(fixture.cache['1736800'].coverUrl, 'https://generator.ryuu.lol/files/images/1736800.jpg');
    assert.equal(fixture.cache['1736800'].notFoundInCatalog, false);
});

test('a hanging metadata provider never blocks list or refresh and concurrent lookups are coalesced', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '3.lua'), 'addappid(3)');
    let finish;
    const service = serviceFor(fixture, () => new Promise(resolve => { finish = resolve; }));
    const pending = service.refreshMetadata();
    assert.equal(service.refreshMetadata(), pending);
    const result = await Promise.race([service.list({ force: true }), new Promise(resolve => setImmediate(() => resolve('blocked')))]);
    assert.notEqual(result, 'blocked');
    assert.equal(result.success, true); assert.equal(result.items[0].appId, '3');
    finish({ games: {} }); await pending;
});

test('a known name without a photo needs no network lookup even while the provider is offline', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '3.lua'), 'addappid(3)');
    fixture.cache['3'] = { name: 'Local name', coverUrl: null };
    const service = serviceFor(fixture, async () => { assert.fail('Photo absence must not trigger name lookups'); });
    const initial = await service.list();
    assert.equal(initial.items[0].gameName, 'Local name');
    const background = await service.refreshMetadata();
    assert.equal(background.success, true);
    const after = await service.list();
    assert.equal(after.success, true); assert.equal(after.items[0].gameName, 'Local name');
    assert.notEqual(fixture.cache['3'].notFoundInCatalog, true);
});

test('a local catalog name without a cover is complete for metadata-only mode', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '3.lua'), 'addappid(3)');
    fixture.catalog['3'] = { name: 'Local name', coverUrl: null };
    let lookups = 0;
    const service = serviceFor(fixture, async () => {
        lookups++;
        return { games: { '3': { name: 'Local name', coverUrl: 'https://example.test/cover.jpg' } } };
    });
    assert.equal((await service.list()).items[0].gameName, 'Local name');
    assert.equal(lookups, 0);
    const result = await service.refreshMetadata();
    assert.equal(lookups, 0); assert.equal(result.items[0].coverUrl, 'https://generator.ryuu.lol/files/images/3.jpg');
});

test('a game removed during enrichment does not reappear in the result', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '3.lua'), 'addappid(3)');
    let finish;
    const service = serviceFor(fixture, () => new Promise(resolve => { finish = resolve; }));
    await service.list(); const pending = service.refreshMetadata();
    await service.remove('3');
    finish({ games: { '3': { name: 'Old response', coverUrl: null } } });
    const result = await pending;
    assert.equal(result.items.length, 0);
});

test('name-only catalog metadata preserves a photo already stored locally and does not repeat name queries',async t=>{
    const fixture=createFixture();
    t.after(()=>fs.rmSync(fixture.root,{recursive:true,force:true}));
    fs.writeFileSync(path.join(fixture.luaDirectory,'3.lua'),'addappid(3)');
    fixture.cache['3']={name:'',coverUrl:'https://shared.fastly.steamstatic.com/steam/apps/3/header.jpg',coverSource:'header_image'};
    fixture.catalog['3']={name:'Known game',coverUrl:null,coverSource:null};
    const service=serviceFor(fixture,async()=>assert.fail('The name is already known'));
    const first=await service.list();
    assert.equal(first.items[0].gameName,'Known game');
    assert.equal(first.items[0].coverUrl,'https://shared.fastly.steamstatic.com/steam/apps/3/header.jpg');
    await service.refreshMetadata();await service.refreshMetadata({force:true});
    assert.equal(fixture.cache['3'].coverUrl,'https://shared.fastly.steamstatic.com/steam/apps/3/header.jpg');
});

test('old metadata cannot overwrite a newly remembered game name', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '3.lua'), 'addappid(3)');
    let finish;
    const service = serviceFor(fixture, () => new Promise(resolve => { finish = resolve; }));
    const pending = service.refreshMetadata();
    service.recordName('3', { name: 'New name', coverUrl: 'https://example.test/cover.jpg' });
    finish({ games: { '3': { name: 'Old name', coverUrl: null } } });
    assert.equal((await pending).code, 'superseded');
    assert.equal((await service.list()).items[0].gameName, 'New name');
});

test('removes the Lua and exclusive manifests but preserves shared manifests', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const targetLua = path.join(fixture.luaDirectory, '10.lua');
    const otherLua = path.join(fixture.luaDirectory, '20.lua');
    const exclusiveManifest = path.join(fixture.manifestDirectory, '100_1000.manifest');
    const sharedManifest = path.join(fixture.manifestDirectory, '200_2000.manifest');
    fs.writeFileSync(targetLua, '--setmanifestid(100,"1000")\n--setmanifestid(200,"2000")');
    fs.writeFileSync(otherLua, '--setmanifestid(200,"2000")');
    fs.writeFileSync(exclusiveManifest, 'exclusive');
    fs.writeFileSync(sharedManifest, 'shared');
    fixture.cache['10'] = {
        name: 'Remembered Game',
        coverUrl: null,
        coverSource: null,
        notFoundInCatalog: true
    };
    const service = serviceFor(fixture, async () => ({ games: {}, syncedAt: '2026-06-21T00:00:00Z' }));

    const result = await service.remove('10');

    assert.equal(result.success, true);
    assert.equal(result.removedManifests, 1);
    assert.equal(result.steamRunning, true);
    assert.equal(fs.existsSync(targetLua), false);
    assert.equal(fs.existsSync(exclusiveManifest), false);
    assert.equal(fs.existsSync(sharedManifest), true);
    assert.equal(fs.existsSync(otherLua), true);
    assert.equal(fixture.cache['10'].name, 'Remembered Game');
});

test('opens the installed game root resolved from the Steam libraries', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const gamePath = path.join(fixture.root, 'steamapps', 'common', 'Example Game');
    fs.mkdirSync(gamePath, { recursive: true });
    let openedPath = null;
    const service = serviceFor(
        fixture,
        async () => ({ games: {}, syncedAt: '2026-06-21T00:00:00Z' }),
        {
            steamService: {
                findInstalledGame: appId => ({ installed: appId === '42', gamePath })
            },
            shell: {
                openPath: async targetPath => {
                    openedPath = targetPath;
                    return '';
                }
            }
        }
    );

    const result = await service.openGameFolder('42');

    assert.equal(result.success, true);
    assert.equal(result.gamePath, gamePath);
    assert.equal(openedPath, gamePath);
});
