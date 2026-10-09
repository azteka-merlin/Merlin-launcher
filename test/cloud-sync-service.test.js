const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCloudSyncService } = require('../src/main/cloud-sync/cloud-sync-service');

test('cloud sync is stage-only, stores no gateway secret in configStore, and revokes on disable', async () => {
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
                endpoint: 'https://staging.api-merlin.com',
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
        networkDown = true;
        assert.equal((await service.renew()).connected, false);
        assert.equal(service.status().enabled, true);
        networkDown = false;
        assert.equal((await service.renew()).connected, true);
        await service.suspendForLogout();
        assert.equal(config.cloudSync.enabled, true);
        assert.equal(service.status().connected, false);
        assert.equal(service.status().restartSteamRequired, true);
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), false);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8')).merlin_enabled, false);
        assert.equal((await service.resumeAfterLogin()).connected, true);
        assert.equal(service.status().restartSteamRequired, true);
        assert.equal(service.acknowledgeSteamRestart().restartSteamRequired, false);
        await service.disable();
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), false);
        assert.equal(calls.filter(call => call.url.endsWith('/revoke')).length, 2);
        service.start();
        await service.resumeAfterLogin();
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(service.status().enabled, false);
        service.stop();

        const prod = createCloudSyncService({ axios, authSession, configStore,
            apiBaseUrl: 'https://api-merlin.com/api', localAppData: temporary });
        assert.equal((await prod.enable()).errorCode, 'stage_only');
        config.cloudSync = { enabled: true, startAtLogin: true };
        fs.writeFileSync(path.join(cloudPath, 'credentials.json'), JSON.stringify(credentials));
        prod.start();
        assert.equal(config.cloudSync.enabled, false);
        assert.equal(fs.existsSync(path.join(cloudPath, 'credentials.json')), false);
        assert.equal(JSON.parse(fs.readFileSync(path.join(cloudPath, 'config.json'), 'utf8')).merlin_enabled, false);
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});
