const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCustomGamesService } = require('../src/main/custom-games/custom-games-service');

function fixture(t, options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-custom-play-'));
    t.after(() => {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('merlin-custom-play-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    const disk = path.join(root, 'disk');
    const item = {
        id: 'play-fixture', name: 'Launch Test', installName: options.installName || 'Launch Test',
        archiveKey: 'archives/launch-test.zip', archiveSize: 1,
        executablePath: options.executablePath || 'START_CODMW4.exe',
    };
    const installedPath = path.join(disk, 'Merlin-games', item.installName);
    fs.mkdirSync(installedPath, { recursive: true });
    fs.writeFileSync(path.join(installedPath, '.merlin-install.json'), JSON.stringify({
        id: item.id, executablePath: options.registryExecutable || item.executablePath,
    }));
    fs.writeFileSync(path.join(root, 'custom-games-installs-staging.api-merlin.com.json'), JSON.stringify({
        [item.id]: {
            drive: 'X', installName: item.installName,
            executablePath: options.registryExecutable || item.executablePath,
        },
    }));
    const executable = path.resolve(installedPath, ...item.executablePath.split('/'));
    if (options.createExecutable !== false) {
        fs.mkdirSync(path.dirname(executable), { recursive: true });
        fs.writeFileSync(executable, 'Inert fixture; never execute.');
    }
    const opened = [];
    const service = createCustomGamesService({
        app: { getPath: () => root }, axios: {}, authSession: {},
        apiBaseUrl: 'https://staging.api-merlin.com/api',
        shell: { openPath: async filename => {
            opened.push(filename);
            return options.openPath ? options.openPath(filename) : '';
        } },
        testDriveRoot: () => disk, initialCatalog: [item],
    });
    return { root, item, installedPath, executable, opened, service };
}

test('Play opens the validated absolute executable through the desktop shell', async t => {
    const setup = fixture(t, {
        installName: 'Call of Duty® HQ', executablePath: 'Launcher files/START_CODMW4.exe',
    });
    assert.deepEqual(await setup.service.play(setup.item.id), { success: true });
    assert.deepEqual(setup.opened, [setup.executable]);
});

test('Play reports a shell failure instead of treating a resolved error string as success', async t => {
    const setup = fixture(t, { openPath: async () => 'Failed to open path' });
    assert.deepEqual(await setup.service.play(setup.item.id), { success: false, code: 'play_failed' });
    assert.deepEqual(setup.opened, [setup.executable]);
});

test('Play normalizes a rejected desktop shell operation', async t => {
    const setup = fixture(t, { openPath: async () => { throw new Error('Shell unavailable'); } });
    assert.deepEqual(await setup.service.play(setup.item.id), { success: false, code: 'play_failed' });
});

test('Play identifies a missing executable before invoking the shell', async t => {
    const setup = fixture(t, { createExecutable: false });
    assert.deepEqual(await setup.service.play(setup.item.id), { success: false, code: 'executable_missing' });
    assert.deepEqual(setup.opened, []);
});

test('Play rejects unsupported file extensions before invoking the shell', async t => {
    const setup = fixture(t, { executablePath: 'START_CODMW4.bat' });
    assert.deepEqual(await setup.service.play(setup.item.id), { success: false, code: 'play_unavailable' });
    assert.deepEqual(setup.opened, []);
});

test('Play rejects an executable path outside the installation', async t => {
    const setup = fixture(t, { executablePath: '../outside.exe', createExecutable: false });
    assert.deepEqual(await setup.service.play(setup.item.id), { success: false, code: 'invalid_executable' });
    assert.deepEqual(setup.opened, []);
});

test('Play rejects a directory link that resolves outside the installation', async t => {
    const setup = fixture(t, { executablePath: 'linked/START_CODMW4.exe', createExecutable: false });
    const outside = path.join(setup.root, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'START_CODMW4.exe'), 'Inert fixture; never execute.');
    try {
        fs.symlinkSync(outside, path.join(setup.installedPath, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
        if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
        t.skip('Directory links are unavailable in this environment');
        return;
    }
    assert.deepEqual(await setup.service.play(setup.item.id), { success: false, code: 'invalid_executable' });
    assert.deepEqual(setup.opened, []);
});

test('Play prefers the current catalog executable over stale installation metadata', async t => {
    const setup = fixture(t, { registryExecutable: 'old-launcher.exe' });
    assert.deepEqual(await setup.service.play(setup.item.id), { success: true });
    assert.deepEqual(setup.opened, [setup.executable]);
});
