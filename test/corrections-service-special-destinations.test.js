const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

const { createCorrectionsService } = require('../src/main/corrections/corrections-service');
const { createSpecialCorrection } = require('../src/main/corrections/special-correction');

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-correction-destinations-'));
    const archivePath = path.join(root, 'source.zip');
    const programDataPath = path.join(root, 'ProgramData');
    const licenseDirectory = path.join(programDataPath, 'Electronic Arts', 'EA Services', 'License');
    const steamGamePath = path.join(root, 'SteamLibrary', 'steamapps', 'common', 'EA SPORTS FC 27');
    const eaAppGamePath = path.join(root, 'EA Games', 'EA SPORTS FC 27');

    fs.mkdirSync(licenseDirectory, { recursive: true });
    fs.mkdirSync(steamGamePath, { recursive: true });
    fs.mkdirSync(eaAppGamePath, { recursive: true });
    fs.writeFileSync(path.join(licenseDirectory, '16425884_sc.dlf'), 'license');

    const archive = new AdmZip();
    archive.addFile('anadius.cfg', Buffer.from('"Token" "RETORNO_TOKEN_MERLIN"\n'));
    archive.addFile('data/content.bin', Buffer.from('shared-content'));
    archive.writeZip(archivePath);

    return {
        root,
        archivePath,
        programDataPath,
        steamGamePath,
        eaAppGamePath
    };
}

function createService(fixture, { steamReady = true } = {}) {
    const item = {
        appId: '4407750',
        gameName: 'EA SPORTS FC 27',
        activationType: 'license_token',
        correction: {
            href: 'https://files.example/fc27.zip',
            filename: 'fc27.zip'
        }
    };
    const specialCorrection = createSpecialCorrection({
        fs,
        path,
        programDataPath: fixture.programDataPath,
        eaAppGamePath: fixture.eaAppGamePath,
        licenseTokenClient: { generate: async () => 'api-token' }
    });

    return createCorrectionsService({
        app: { getPath: () => path.join(fixture.root, 'temp') },
        fs,
        path,
        AdmZip,
        nodeUnrar: null,
        dialog: {},
        shell: {},
        configStore: { get: () => ({ steamPath: path.join(fixture.root, 'Steam') }) },
        steamService: {
            getActivationReadiness: () => steamReady
                ? { ok: true, reason: null }
                : { ok: false, reason: 'steam_path_missing' },
            findInstalledGame: () => ({
                installed: true,
                appId: '4407750',
                gamePath: fixture.steamGamePath
            })
        },
        authSession: null,
        catalogStore: {
            list: () => [item],
            load: () => ({ items: [item], lastSync: null }),
            replace: () => {}
        },
        catalogClient: {},
        apiBaseUrl: 'https://api-merlin.com/api',
        libraryCatalogService: {},
        downloadManager: {
            cancel: () => {},
            download: async ({ destinationPath }) => {
                fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
                fs.copyFileSync(fixture.archivePath, destinationPath);
                return { success: true, filePath: destinationPath };
            }
        },
        specialCorrection,
        launcherVersion: '2.1.3'
    });
}

test('fills anadius.cfg and copies the FC 27 correction to Steam and EA App', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const service = createService(fixture);

    const prepared = await service.prepareInstall('4407750');
    assert.equal(prepared.success, true);
    assert.deepEqual(prepared.gamePaths, [fixture.steamGamePath, fixture.eaAppGamePath]);

    const result = await service.install('4407750', 'operation-1');
    assert.equal(result.success, true);
    assert.deepEqual(result.gamePaths, [fixture.steamGamePath, fixture.eaAppGamePath]);
    assert.deepEqual(result.installations, [
        { platform: 'steam', gamePath: fixture.steamGamePath },
        { platform: 'ea_app', gamePath: fixture.eaAppGamePath }
    ]);

    for (const gamePath of result.gamePaths) {
        assert.equal(fs.existsSync(path.join(gamePath, 'token.ini')), false);
        assert.equal(fs.readFileSync(path.join(gamePath, 'anadius.cfg'), 'utf8'), '"Token" "api-token"\n');
        assert.equal(fs.readFileSync(path.join(gamePath, 'data', 'content.bin'), 'utf8'), 'shared-content');
    }
});

test('allows FC 27 installed only through EA App when Steam is not configured', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const service = createService(fixture, { steamReady: false });

    const prepared = await service.prepareInstall('4407750');
    assert.equal(prepared.success, true);
    assert.deepEqual(prepared.gamePaths, [fixture.eaAppGamePath]);
    assert.equal(prepared.installations[0].platform, 'ea_app');
});
