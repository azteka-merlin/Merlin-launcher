const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCloudSyncService } = require('../src/main/cloud-sync/cloud-sync-service');

test('cloud sync supports stage and production without inheriting the other environment, and keeps secrets out of configStore', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-cloud-test-'));
    try {
        const config = { cloudSync: { enabled: false, startAtLogin: false } };
        const configStore = {
            get: () => config,
            update: values => Object.assign(config, values)
        };
        const calls = [];
        let networkDown = false;
        const axios = { post: async (url, body) => {
            calls.push({ url, body });
            if (url.endsWith('/revoke')) return { data: { success: true } };
            if (networkDown) throw new Error('offline');
            return { data: {
                success: true,
                accessKeyId: `MCL${'a'.repeat(40)}`,
                secretAccessKey: 'b'.repeat(64),
                endpoint: new URL(url).origin,
                bucket: 'merlin-cloud',
                keyPrefix: 'steam/',
                region: 'us-east-1',
                expiresAt: new Date(Date.now() + 1_200_000).toISOString()
            } };
        } };
        const authSession = { getAccessToken: async () => 'test-token' };
        const service = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://staging.api-merlin.com/api', localAppData: temporary });
        assert.equal((await service.enable()).connected, true);
        assert.equal(config.cloudSync.enabled, true);
        assert.equal(JSON.stringify(config).includes('b'.repeat(64)), false);
        const cloudPath = path.join(temporary, 'Merlin', 'cloud');
        const nativeConfig = JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8'));
        const credentials = JSON.parse(fs.readFileSync(path.join(cloudPath, 'credentials.json'), 'utf8'));
        assert.equal(nativeConfig.merlin_enabled, true);
        assert.equal(nativeConfig.provider, 's3');
        assert.equal(nativeConfig.auto_update_dll, false);
        assert.equal(credentials.key_prefix, 'steam/');
        assert.equal(credentials.secret_access_key, 'b'.repeat(64));
        // The native DLL transparently encrypts plaintext credentials with
        // DPAPI. Renewal must keep using the current key after that rewrite.
        fs.writeFileSync(path.join(cloudPath, 'credentials.json'), Buffer.from([1, 0, 0, 0, 208, 140]));
        assert.equal((await service.renew()).connected, true);
        assert.equal(calls.filter(call => call.url.endsWith('/credentials')).at(-1).body.accessKeyId,
            `MCL${'a'.repeat(40)}`);
        fs.writeFileSync(path.join(cloudPath, 'credentials.json'), Buffer.from([1, 0, 0, 0, 208, 140]));
        const restarted = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://staging.api-merlin.com/api', localAppData: temporary });
        assert.equal((await restarted.renew()).connected, true);
        assert.equal(calls.filter(call => call.url.endsWith('/credentials')).at(-1).body.accessKeyId,
            `MCL${'a'.repeat(40)}`);
        networkDown = true;
        assert.equal((await service.renew()).connected, false);
        assert.equal(service.status().enabled, true);
        networkDown = false;
        assert.equal((await service.renew()).connected, true);
        fs.writeFileSync(path.join(cloudPath, 'credentials.json'), Buffer.from([1, 0, 0, 0, 208, 140]));
        await service.suspendForLogout();
        assert.equal(config.cloudSync.enabled, true);
        assert.equal(service.status().connected, false);
        assert.equal(service.status().restartSteamRequired, true);
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), false);
        assert.equal(fs.existsSync(path.join(cloudPath, 'key-id.json')), false);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8')).merlin_enabled, false);
        assert.equal((await service.resumeAfterLogin()).connected, true);
        assert.equal(service.status().restartSteamRequired, true);
        assert.equal(service.acknowledgeSteamRestart().restartSteamRequired, false);
        await service.disable();
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), false);
        assert.equal(fs.existsSync(path.join(cloudPath, 'key-id.json')), false);
        assert.equal(calls.filter(call => call.url.endsWith('/revoke')).length, 2);
        assert.equal(calls.filter(call => call.url.endsWith('/revoke'))[0].body.accessKeyId,
            `MCL${'a'.repeat(40)}`);
        service.start();
        await service.resumeAfterLogin();
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(service.status().enabled, false);
        service.stop();

        const prod = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://api-merlin.com/api', localAppData: temporary });
        assert.equal(prod.status().available, true);
        config.cloudSync = { enabled: true, startAtLogin: true };
        fs.writeFileSync(path.join(cloudPath, 'credentials.json'), JSON.stringify(credentials));
        prod.start();
        assert.equal(config.cloudSync.enabled, true);
        assert.equal(config.cloudSync.startAtLogin, true);
        assert.equal(prod.status().connected, false);
        assert.equal(prod.status().errorCode, 'environment_mismatch');
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), true);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8')).merlin_enabled, false);
        assert.equal((await prod.resumeAfterLogin()).connected, false);
        assert.equal((await prod.retry()).connected, true);
        assert.equal(calls.filter(call => call.url.endsWith('/credentials')).at(-1).body.accessKeyId, null);
        assert.equal(config.cloudSync.enabled, true);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'environment.json'), 'utf8')).origin,
            'https://api-merlin.com');
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'credentials.json'), 'utf8')).endpoint,
            'https://api-merlin.com');
        const stageAgain = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://staging.api-merlin.com/api', localAppData: temporary });
        stageAgain.start();
        assert.equal(config.cloudSync.enabled, true);
        assert.equal(stageAgain.status().errorCode, 'environment_mismatch');
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), true);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8')).merlin_enabled, false);
        networkDown = true;
        assert.equal((await stageAgain.retry()).connected, false);
        assert.equal(config.cloudSync.enabled, true);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8')).merlin_enabled, false);
        networkDown = false;
        assert.equal((await stageAgain.retry()).connected, true);
        assert.equal(calls.filter(call => call.url.endsWith('/credentials')).at(-1).body.accessKeyId, null);
        assert.equal(config.cloudSync.enabled, true);
        prod.stop();
        stageAgain.stop();
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});

test('cloud games cache is scoped to Steam account and environment, and cleared on logout', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-cloud-games-'));
    try {
        const config = { cloudSync: { enabled: false, startAtLogin: false } };
        const configStore = { get: () => config, update: values => Object.assign(config, values) };
        const axios = {
            post: async url => ({ data: {
                success: true, accessKeyId: `MCL${'a'.repeat(40)}`, secretAccessKey: 'b'.repeat(64),
                endpoint: new URL(url).origin, bucket: 'merlin-cloud', keyPrefix: 'steam/', region: 'us-east-1',
                expiresAt: new Date(Date.now() + 1_200_000).toISOString()
            } }),
            request: async () => ({ data: { success: true, games: [{ appId: '730', name: 'Game' }] } })
        };
        const authSession = { getAccessToken: async () => 'token' };
        const stage = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://staging.api-merlin.com/api', localAppData: temporary });
        await stage.enable();
        assert.equal(stage.cachedGames('123456'), null);
        await stage.listGames('123456');
        assert.equal(stage.cachedGames('123456').games[0].name, 'Game');
        assert.equal(stage.cachedGames('654321'), null);
        const restarted = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://staging.api-merlin.com/api', localAppData: temporary });
        await restarted.renew();
        assert.equal(restarted.cachedGames('123456').games[0].name, 'Game');
        const production = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://api-merlin.com/api', localAppData: temporary });
        assert.equal(production.cachedGames('123456'), null);
        await stage.suspendForLogout();
        assert.equal(stage.cachedGames('123456'), null);
        assert.equal(fs.existsSync(path.join(temporary, 'Merlin', 'cloud', 'games-list-cache.json')), false);
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});

test('a fresh production profile connects automatically and retains a later opt-out', async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-cloud-default-'));
    const config = { cloudSync: { enabled: true, startAtLogin: true, defaultMigration: 1 } };
    const configStore = { get: () => config, update: patch => Object.assign(config, patch) };
    const service = createCloudSyncService({
        configStore, localAppData: temporary, apiBaseUrl: 'https://api-merlin.com/api',
        authSession: { getAccessToken: async () => 'token' },
        axios: { post: async url => ({ data: {
            success: true, accessKeyId: `MCL${'a'.repeat(40)}`, secretAccessKey: 'b'.repeat(64),
            endpoint: new URL(url).origin, bucket: 'merlin-cloud', keyPrefix: 'steam/',
            region: 'us-east-1', expiresAt: new Date(Date.now() + 1_200_000).toISOString()
        } }) }
    });
    try {
        service.start();
        assert.equal((await service.renew()).connected, true);
        await service.disable();
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(config.cloudSync.defaultMigration, 1);
    } finally {
        service.stop();
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});
