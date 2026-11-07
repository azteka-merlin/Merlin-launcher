const test = require('node:test');
const assert = require('node:assert/strict');

const { registerLibraryIpc } = require('../src/main/ipc/register-library-ipc');

test('registers isolated Library IPC channels', () => {
    const channels = [];
    registerLibraryIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        libraryService: {}
    });

    assert.deepEqual(channels, [
        'library:list',
        'library:refresh',
        'library:remove',
        'library:restart-steam',
        'library:open-game-folder'
    ]);
});

test('list responds while metadata is pending and publishes the update when it arrives', async () => {
    const handlers = new Map(), sent = [];
    let finish;
    registerLibraryIpc({ ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) }, libraryService: {
        list: async () => ({ success: true, items: [{ appId: '10', gameName: '' }] }),
        refreshMetadata: () => new Promise(resolve => { finish = resolve; })
    } });
    const result = await handlers.get('library:list')({ sender: { send: (...args) => sent.push(args), isDestroyed: () => false } });
    assert.equal(result.success, true); assert.equal(sent.length, 0);
    finish({ success: true, changed: true, items: [{ appId: '10', gameName: 'Updated name' }] });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sent, [['library:updated', [{ appId: '10', gameName: 'Updated name' }]]]);
});
