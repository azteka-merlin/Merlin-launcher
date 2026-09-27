const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createInstanceGuard } = require('../src/main/process/instance-guard');

test('prevents a second Merlin process and releases its own lock on exit', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-instance-'));
    try {
        const running = new Set([100]);
        const first = createInstanceGuard({ fs, path, appDataPath: root, pid: 100, isProcessRunning: processId => running.has(processId) });
        const second = createInstanceGuard({ fs, path, appDataPath: root, pid: 200, isProcessRunning: processId => running.has(processId) });
        assert.equal(first.acquire(), true);
        assert.equal(second.acquire(), false);
        first.release();
        assert.equal(second.acquire(), true);
        second.release();
        assert.equal(fs.existsSync(second.lockPath), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('recovers a stale Merlin process lock', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-instance-'));
    try {
        const stale = createInstanceGuard({ fs, path, appDataPath: root, pid: 100, isProcessRunning: () => false });
        fs.mkdirSync(path.dirname(stale.lockPath), { recursive: true });
        fs.writeFileSync(stale.lockPath, JSON.stringify({ pid: 999 }));
        assert.equal(stale.acquire(), true);
        stale.release();
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('can replace only the Merlin process registered in its lock', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-instance-'));
    try {
        const running = new Set([100]);
        const first = createInstanceGuard({ fs, path, appDataPath: root, pid: 100, isProcessRunning: processId => running.has(processId) });
        const replacement = createInstanceGuard({
            fs,
            path,
            appDataPath: root,
            pid: 200,
            isProcessRunning: processId => running.has(processId),
            terminateProcess: processId => { running.delete(processId); return true; }
        });
        assert.equal(first.acquire(), true);
        assert.equal(replacement.acquire({ replaceExisting: true }), true);
        assert.equal(JSON.parse(fs.readFileSync(replacement.lockPath, 'utf8')).pid, 200);
        replacement.release();
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
