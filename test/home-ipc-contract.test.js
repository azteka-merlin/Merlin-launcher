const test = require('node:test');
const assert = require('node:assert/strict');
const { registerHomeIpc } = require('../src/main/ipc/register-home-ipc');

test('registers isolated Home IPC handlers', async () => {
    const handlers = new Map();
    const ipcMain = { handle(name, callback) { handlers.set(name, callback); } };
    const calls = [];
    registerHomeIpc({
        ipcMain,
        homeContentService: {
            get(options) { calls.push(['get', options]); return { success: true }; },
            refresh() { calls.push(['refresh']); return { success: true }; }
        }
    });
    assert.deepEqual(await handlers.get('home:get')({}, { force: true }), { success: true });
    assert.deepEqual(await handlers.get('home:refresh')(), { success: true });
    assert.deepEqual(calls, [['get', { force: true }], ['refresh']]);
});
