const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path').win32;

const { createSteamService } = require('../src/main/steam/steam-service');

function createService(existingPaths, fileContents = {}) {
    const fs = {
        existsSync: filePath => existingPaths.has(path.normalize(filePath)),
        statSync: () => ({ isDirectory: () => true }),
        readFileSync: filePath => fileContents[path.normalize(filePath)] || ''
    };
    return createSteamService({
        fs,
        path,
        exec: () => {},
        platform: 'win32',
        userProfile: 'C:\\Users\\Test'
    });
}

test('reports a valid Steam installation only when exe and DLLs exist', () => {
    const root = path.normalize('C:\\Steam');
    const service = createService(new Set([
        root,
        path.join(root, 'steam.exe'),
        path.join(root, 'OpenSteamTool.dll'),
        path.join(root, 'dwmapi.dll'),
        path.join(root, 'xinput1_4.dll'),
        path.join(root, 'merlin_cloud_redirect.dll'),
        path.join(root, 'merlin-helper.dll')
    ]));

    assert.deepEqual(service.getActivationReadiness(root), {
        ok: true,
        reason: null,
        missing: []
    });
});

test('reports missing OpenSteamTool files without changing the path', () => {
    const root = path.normalize('C:\\Steam');
    const service = createService(new Set([root, path.join(root, 'steam.exe')]));
    const result = service.getActivationReadiness(root);

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'required_files_missing');
    assert.deepEqual(result.missing, [
        'OpenSteamTool.dll',
        'dwmapi.dll',
        'xinput1_4.dll',
        'merlin_cloud_redirect.dll',
        'merlin-helper.dll'
    ]);
});

test('reports merlin-helper.dll as missing in file status checks', () => {
    const root = path.normalize('C:\\Steam');
    const service = createService(new Set([
        root,
        path.join(root, 'steam.exe'),
        path.join(root, 'OpenSteamTool.dll'),
        path.join(root, 'dwmapi.dll'),
        path.join(root, 'xinput1_4.dll'),
        path.join(root, 'merlin_cloud_redirect.dll')
    ]));

    assert.deepEqual(service.getFilesStatus(root), {
        ok: false,
        reason: 'required_files_missing',
        missing: ['merlin-helper.dll']
    });
});

test('finds an installed game by validating libraryfolders and the appmanifest', () => {
    const root = path.normalize('C:\\Steam');
    const secondaryLibrary = path.normalize('D:\\SteamLibrary');
    const libraryFoldersPath = path.join(root, 'steamapps', 'libraryfolders.vdf');
    const manifestPath = path.join(secondaryLibrary, 'steamapps', 'appmanifest_4704690.acf');
    const gamePath = path.join(secondaryLibrary, 'steamapps', 'common', 'PastaDoJogo');

    const service = createService(new Set([
        root,
        path.join(root, 'steam.exe'),
        path.join(root, 'OpenSteamTool.dll'),
        path.join(root, 'dwmapi.dll'),
        path.join(root, 'xinput1_4.dll'),
        path.join(root, 'merlin-helper.dll'),
        libraryFoldersPath,
        manifestPath,
        gamePath
    ]), {
        [libraryFoldersPath]: `"libraryfolders"
{
  "0"
  {
    "path" "C:\\\\Program Files (x86)\\\\Steam"
  }
  "1"
  {
    "path" "D:\\\\SteamLibrary"
    "apps"
    {
      "4704690" "0"
    }
  }
}`,
        [manifestPath]: `"AppState"
{
  "appid" "4704690"
  "installdir" "PastaDoJogo"
}`
    });

    const result = service.findInstalledGame('4704690', root);

    assert.equal(result.installed, true);
    assert.equal(result.libraryPath, secondaryLibrary);
    assert.equal(result.manifestPath, manifestPath);
    assert.equal(result.gamePath, gamePath);
});
