const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path').win32;
const nativePath = require('node:path');
const nativeFs = require('node:fs');
const os = require('node:os');

const { createDllInstaller } = require('../src/main/lumacore/dll-installer');

test('cloud activation updates its two native DLLs and installs missing support files', () => {
    const root = nativeFs.mkdtempSync(nativePath.join(os.tmpdir(), 'merlin-cloud-dll-'));
    try {
        const bundle = nativePath.join(root, 'bundle');
        const steam = nativePath.join(root, 'steam');
        nativeFs.mkdirSync(bundle);
        nativeFs.mkdirSync(steam);
        nativeFs.writeFileSync(nativePath.join(steam, 'steam.exe'), 'steam');
        nativeFs.writeFileSync(nativePath.join(steam, 'OpenSteamTool.dll'), 'old');
        nativeFs.writeFileSync(nativePath.join(steam, 'dwmapi.dll'), 'keep');
        for (const name of ['OpenSteamTool.dll', 'merlin_cloud_redirect.dll', 'dwmapi.dll']) {
            nativeFs.writeFileSync(nativePath.join(bundle, name), `new ${name}`);
        }
        const installer = createDllInstaller({
            fs: nativeFs, path: nativePath, dialog: {}, getMainWindow: () => null,
            requiredFiles: ['OpenSteamTool.dll', 'merlin_cloud_redirect.dll', 'dwmapi.dll']
                .map(name => ({ name, relativeDestination: name })),
            getSourcePath: file => nativePath.join(bundle, file.name)
        });
        assert.equal(installer.cloudSupportReady(steam), false);
        assert.deepEqual(installer.installCloudSupport(steam).updated,
            ['OpenSteamTool.dll', 'merlin_cloud_redirect.dll']);
        assert.equal(installer.cloudSupportReady(steam), true);
        assert.equal(nativeFs.readFileSync(nativePath.join(steam, 'dwmapi.dll'), 'utf8'), 'keep');
    } finally {
        nativeFs.rmSync(root, { recursive: true, force: true });
    }
});

function createFixture({ existing = [], dialogResponse = 0 } = {}) {
    const existingPaths = new Set(existing.map(item => path.normalize(item)));
    const copied = [];
    const removed = [];
    const notifications = [];
    const fs = {
        existsSync(filePath) {
            return existingPaths.has(path.normalize(filePath));
        },
        copyFileSync(srcPath, destPath) {
            copied.push({
                srcPath: path.normalize(srcPath),
                destPath: path.normalize(destPath)
            });
            existingPaths.add(path.normalize(destPath));
        },
        mkdirSync() {},
        rmSync(filePath) {
            const normalized = path.normalize(filePath);
            removed.push(normalized);
            existingPaths.delete(normalized);
        }
    };
    const dialog = {
        async showMessageBox() {
            return { response: dialogResponse };
        }
    };
    const mainWindow = {
        webContents: {
            send(channel, payload) {
                notifications.push({ channel, payload });
            }
        }
    };

    const installer = createDllInstaller({
        fs,
        path,
        dialog,
        requiredFiles: [
            { name: 'OpenSteamTool.dll', sourceName: 'OpenSteamTool.dll', relativeDestination: 'OpenSteamTool.dll' },
            { name: 'dwmapi.dll', sourceName: 'dwmapi.dll', relativeDestination: 'dwmapi.dll' },
            { name: 'xinput1_4.dll', sourceName: 'xinput1_4.dll', relativeDestination: 'xinput1_4.dll' },
            { name: 'merlin-helper.dll', sourceName: 'merlin-helper.dll', relativeDestination: 'merlin-helper.dll' }
        ],
        getSourcePath: file => path.join('C:\\bundle', file.sourceName),
        getMainWindow: () => mainWindow
    });

    return { installer, copied, removed, notifications, existingPaths };
}

test('removes legacy LumaCore.dll when the new DLLs are already present', async () => {
    const steamRoot = path.normalize('C:\\Steam');
    const fixture = createFixture({
        existing: [
            path.join(steamRoot, 'OpenSteamTool.dll'),
            path.join(steamRoot, 'dwmapi.dll'),
            path.join(steamRoot, 'xinput1_4.dll'),
            path.join(steamRoot, 'merlin-helper.dll'),
            path.join(steamRoot, 'LumaCore.dll')
        ]
    });

    const result = await fixture.installer.checkAndInstall(steamRoot, 'en');

    assert.deepEqual(result, { installed: false, alreadyInstalled: true, cancelled: false });
    assert.deepEqual(fixture.removed, [path.join(steamRoot, 'LumaCore.dll')]);
    assert.equal(fixture.existingPaths.has(path.join(steamRoot, 'LumaCore.dll')), false);
    assert.deepEqual(fixture.notifications, [{ channel: 'files-status', payload: { ok: true } }]);
});

test('installs the new DLLs and removes legacy LumaCore.dll during migration', async () => {
    const steamRoot = path.normalize('C:\\Steam');
    const fixture = createFixture({
        existing: [
            path.join('C:\\bundle', 'OpenSteamTool.dll'),
            path.join('C:\\bundle', 'dwmapi.dll'),
            path.join('C:\\bundle', 'xinput1_4.dll'),
            path.join('C:\\bundle', 'merlin-helper.dll'),
            path.join(steamRoot, 'LumaCore.dll')
        ]
    });

    const result = await fixture.installer.checkAndInstall(steamRoot, 'en');

    assert.deepEqual(result, { installed: true, alreadyInstalled: false, cancelled: false });
    assert.deepEqual(
        fixture.copied.map(entry => path.basename(entry.destPath)),
        ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll', 'merlin-helper.dll']
    );
    assert.deepEqual(fixture.removed, [path.join(steamRoot, 'LumaCore.dll')]);
    assert.equal(fixture.existingPaths.has(path.join(steamRoot, 'LumaCore.dll')), false);
    assert.deepEqual(fixture.notifications, [{ channel: 'files-status', payload: { ok: true } }]);
});

test('reports a friendly error when Steam is locking a DLL during repair', async () => {
    const steamRoot = path.normalize('C:\\Steam');
    const fixture = createFixture({
        existing: [
            path.join('C:\\bundle', 'OpenSteamTool.dll'),
            path.join('C:\\bundle', 'dwmapi.dll'),
            path.join('C:\\bundle', 'xinput1_4.dll'),
            path.join('C:\\bundle', 'merlin-helper.dll')
        ]
    });

    fixture.installer = createDllInstaller({
        fs: {
            ...{
                existsSync: filePath => fixture.existingPaths.has(path.normalize(filePath)),
                rmSync: () => {},
                mkdirSync: () => {},
                copyFileSync(srcPath, destPath) {
                    const normalizedDest = path.normalize(destPath);
                    if (normalizedDest === path.join(steamRoot, 'dwmapi.dll')) {
                        const error = new Error('locked');
                        error.code = 'EBUSY';
                        throw error;
                    }
                    fixture.existingPaths.add(normalizedDest);
                }
            }
        },
        path,
        dialog: { async showMessageBox() { return { response: 0 }; } },
        requiredFiles: [
            { name: 'OpenSteamTool.dll', sourceName: 'OpenSteamTool.dll', relativeDestination: 'OpenSteamTool.dll' },
            { name: 'dwmapi.dll', sourceName: 'dwmapi.dll', relativeDestination: 'dwmapi.dll' },
            { name: 'xinput1_4.dll', sourceName: 'xinput1_4.dll', relativeDestination: 'xinput1_4.dll' },
            { name: 'merlin-helper.dll', sourceName: 'merlin-helper.dll', relativeDestination: 'merlin-helper.dll' }
        ],
        getSourcePath: file => path.join('C:\\bundle', file.sourceName),
        getMainWindow: () => ({
            webContents: { send() {} }
        })
    });

    await assert.rejects(
        fixture.installer.checkAndInstall(steamRoot, 'en'),
        /Steam appears to be using dwmapi\.dll\. Close Steam completely and try Repair again\./
    );
});
