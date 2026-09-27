const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDevShutdownRequest } = require('../src/main/process/dev-shutdown-request');

test('writes, consumes and clears a development shutdown request', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-dev-shutdown-'));
    try {
        const request = createDevShutdownRequest({ fs, path, appDataPath: root });
        assert.equal(request.consume(), false);
        request.request();
        assert.equal(fs.existsSync(request.requestPath), true);
        assert.equal(request.consume(), true);
        assert.equal(fs.existsSync(request.requestPath), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
