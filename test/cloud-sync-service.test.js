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
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), false);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8')).merlin_enabled, false);
        assert.equal((await prod.enable()).connected, true);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'environment.json'), 'utf8')).origin,
            'https://api-merlin.com');
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'credentials.json'), 'utf8')).endpoint,
            'https://api-merlin.com');
        const stageAgain = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://staging.api-merlin.com/api', localAppData: temporary });
        stageAgain.start();
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), false);
        prod.stop();
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});
