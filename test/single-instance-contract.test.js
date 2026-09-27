const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('a secondary Merlin launch exits before it can create a tray icon', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    const lock = source.indexOf('const hasSingleInstanceLock = app.requestSingleInstanceLock();');
    const exit = source.indexOf('app.exit(0);', lock);
    const ready = source.indexOf('app.whenReady()', lock);
    const tray = source.indexOf('new Tray(', lock);
    assert.ok(lock >= 0);
    assert.ok(exit > lock);
    assert.ok(ready > exit);
    assert.ok(tray > exit);
    assert.match(source, /app\.on\('second-instance', \(\) => openMerlinView\('launcher'\)\)/);
});
