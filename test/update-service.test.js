const test = require('node:test');
const assert = require('node:assert/strict');

const { createUpdateService, isAllowedDownloadUrl } = require('../src/main/updates/update-service');

test('allows release downloads only from the renamed launcher repository', () => {
    assert.equal(isAllowedDownloadUrl('https://github.com/azteka-merlin/Merlin-launcher/releases/download/v1.6.5/Merlin.Setup.1.6.5.exe'), true);
    assert.equal(isAllowedDownloadUrl('https://github.com/azteka-merlin/Merlin-luncher/releases/download/v1.6.5/Merlin.Setup.1.6.5.exe'), false);
});

test('exposes an available update when the explicit development simulation is enabled', async () => {
    const previous = {
        simulate: process.env.MERLIN_SIMULATE_UPDATE,
        version: process.env.MERLIN_SIMULATE_UPDATE_VERSION,
        url: process.env.MERLIN_SIMULATE_UPDATE_URL
    };
    process.env.MERLIN_SIMULATE_UPDATE = '1';
    process.env.MERLIN_SIMULATE_UPDATE_VERSION = '1.6.0';
    process.env.MERLIN_SIMULATE_UPDATE_URL = 'https://api-merlin.com/api/updates/download';

    try {
        const service = createUpdateService({
            app: { getVersion: () => '1.5.91', isPackaged: false },
            axios: { get: async () => { throw new Error('network must not be used'); } },
            shell: {},
            path: require('node:path'),
            downloadManager: {}
        });
        const result = await service.check();
        assert.deepEqual(result, {
            success: true,
            updateAvailable: true,
            currentVersion: '1.5.91',
            latestVersion: '1.6.0',
            downloadUrl: 'https://api-merlin.com/api/updates/download'
        });
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            const envKey = `MERLIN_SIMULATE_UPDATE${key === 'version' ? '_VERSION' : key === 'url' ? '_URL' : ''}`;
            if (value === undefined) delete process.env[envKey];
            else process.env[envKey] = value;
        }
    }
});
