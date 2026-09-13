const test = require('node:test');
const assert = require('node:assert/strict');

const { createGameInstaller } = require('../src/main/games/game-installer');

function createInstallerWithManifestError(manifestError) {
    return createGameInstaller({
        app: { getPath: () => 'C:\\Temp' },
        fs: {
            existsSync: () => true,
            mkdirSync: () => {},
            statSync: () => ({ size: 0, isDirectory: () => false }),
            readdirSync: () => [],
            copyFileSync: () => {},
            rmSync: () => {},
            unlinkSync: () => {}
        },
        path: require('node:path'),
        AdmZip: class {},
        archiveClient: {
            request: async () => {
                throw manifestError;
            }
        },
        authSession: { getAccessToken: async () => 'token', handleUnauthorized: async () => {} },
        manifestApiUrl: 'https://staging.api-merlin.com/api/manifests',
        steamService: { getActivationReadiness: () => ({ ok: true, missing: [] }) },
        installLuaFile: () => 0
    });
}

async function installWithManifestError(manifestError) {
    const installer = createInstallerWithManifestError(manifestError);

    return installer.install({
        appId: '1350390',
        steamPath: 'C:\\Steam',
        onProgress: () => {}
    });
}

async function installWithManifestResponse(payload) {
    const installer = createGameInstaller({
        app: { getPath: () => 'C:\\Temp' },
        fs: {
            existsSync: () => true,
            mkdirSync: () => {},
            statSync: () => ({ size: 0, isDirectory: () => false }),
            readdirSync: () => [],
            copyFileSync: () => {},
            rmSync: () => {},
            unlinkSync: () => {}
        },
        path: require('node:path'),
        AdmZip: class {},
        archiveClient: { request: async () => ({ data: Buffer.from(JSON.stringify(payload)) }) },
        authSession: { getAccessToken: async () => 'token', handleUnauthorized: async () => {} },
        manifestApiUrl: 'https://staging.api-merlin.com/api/manifests',
        steamService: { getActivationReadiness: () => ({ ok: true, missing: [] }) },
        installLuaFile: () => 0
    });

    return installer.install({ appId: '1350390', steamPath: 'C:\\Steam', onProgress: () => {} });
}

test('maps explicit test license normal limit responses to test limit feedback', async () => {
    const error = new Error('Request failed with status code 403');
    error.response = {
        status: 403,
        data: Buffer.from(JSON.stringify({
            success: false,
            error: 'Limite de ativacoes normais da licenca de teste atingido.',
            code: 'TEST_LICENSE_NORMAL_ACTIVATION_LIMIT_REACHED'
        }))
    };

    const result = await installWithManifestError(error);

    assert.equal(result.success, false);
    assert.equal(result.reason, 'test_limit_normal');
});

test('does not treat a generic merlin-api 403 manifest failure as a test license limit', async () => {
    const error = new Error('Request failed with status code 403');
    error.response = { status: 403, data: { success: false, error: 'Forbidden' } };

    const result = await installWithManifestError(error);

    assert.equal(result.success, false);
    assert.notEqual(result.reason, 'test_limit_normal');
});

test('maps a successful API response with an unavailable manifest result', async () => {
    const result = await installWithManifestResponse({
        success: false,
        error: 'No manifest source has this game',
        code: 'manifest_unavailable'
    });

    assert.equal(result.success, false);
    assert.equal(result.reason, 'manifest_unavailable');
});

test('maps a successful API response with unavailable manifest sources', async () => {
    const result = await installWithManifestResponse({
        success: false,
        error: 'No manifest source returned a valid ZIP',
        code: 'manifest_sources_unavailable'
    });

    assert.equal(result.success, false);
    assert.equal(result.reason, 'manifest_sources_unavailable');
});

test('keeps missing manifests as the regular unsupported game failure', async () => {
    const installer = createGameInstaller({
        app: { getPath: () => 'C:\\Temp' },
        fs: {
            existsSync: () => true,
            mkdirSync: () => {},
            statSync: () => ({ size: 0, isDirectory: () => false }),
            readdirSync: () => [],
            copyFileSync: () => {},
            rmSync: () => {},
            unlinkSync: () => {}
        },
        path: require('node:path'),
        AdmZip: class {},
        archiveClient: { request: async () => ({ data: Buffer.from('not-a-zip') }) },
        authSession: { getAccessToken: async () => 'token', handleUnauthorized: async () => {} },
        manifestApiUrl: 'https://staging.api-merlin.com/api/manifests',
        steamService: { getActivationReadiness: () => ({ ok: true, missing: [] }) },
        installLuaFile: () => 0
    });

    const result = await installer.install({
        appId: '1350390',
        steamPath: 'C:\\Steam',
        onProgress: () => {}
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Unable to download files for App ID 1350390/);
});
