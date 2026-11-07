const test = require('node:test');
const assert = require('node:assert/strict');
const { registerGameCoversIpc } = require('../src/main/ipc/register-game-covers-ipc');
test('cover IPC delegates only to the local photo cache service', async () => {
    let handler;
    const calls = [];
    registerGameCoversIpc({ipcMain:{handle:(name,callback)=>{assert.equal(name,'game-covers:load');handler=callback;}},
        gameCoverService:{load:async(...args)=>{calls.push(args);return {url:'file:///cache/400.jpg'};}}});
    assert.deepEqual(await handler({},'400','https://shared.fastly.steamstatic.com/400.jpg'),{url:'file:///cache/400.jpg'});
    assert.deepEqual(calls[0],['400','https://shared.fastly.steamstatic.com/400.jpg']);
    assert.equal(calls.length,1);
});
