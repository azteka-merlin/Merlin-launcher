const test = require('node:test');
const assert = require('node:assert/strict');
const { createTransferMeter } = require('../src/main/custom-games/transfer-progress');

const MiB = 1024 ** 2;

test('a large transfer reported after a long silence retains its measured rate and ETA', () => {
    const meter = createTransferMeter();
    meter.update(0, 20000 * MiB, 0, 0, 0);
    const result = meter.update(8300 * MiB, 20000 * MiB, 0, 0, 166000);
    assert.equal(result.speedBytesPerSecond, 50 * MiB);
    assert.equal(result.etaSeconds, 234);
});

test('a long slower interval replaces an earlier fast rate', () => {
    const meter = createTransferMeter();
    meter.update(0, 20000 * MiB, 0, 0, 0);
    assert.equal(meter.update(1000 * MiB, 20000 * MiB, 0, 0, 10000).speedBytesPerSecond, 100 * MiB);
    assert.equal(meter.update(9300 * MiB, 20000 * MiB, 0, 0, 176000).speedBytesPerSecond, 50 * MiB);
});

test('rapid completions after a sparse interval do not divide all bytes by the burst duration', () => {
    const meter = createTransferMeter();
    meter.update(0, 20000 * MiB, 0, 0, 0);
    meter.update(8300 * MiB, 20000 * MiB, 0, 0, 166000);
    let result;
    for (let index = 1; index <= 8; index++) {
        result = meter.update((8300 + index) * MiB, 20000 * MiB, 0, 0, 166000 + index * 10);
    }
    assert.ok(result.speedBytesPerSecond > 49 * MiB && result.speedBytesPerSecond < 51 * MiB);
});

test('an actual pause ages the earlier rate out and leaves ETA unknown', () => {
    const meter = createTransferMeter();
    meter.update(0, 1000, 0, 0, 0);
    meter.update(500, 1000, 0, 0, 10000);
    assert.deepEqual(meter.update(500, 1000, 0, 0, 60000), { speedBytesPerSecond: 0, etaSeconds: null });
    assert.equal(meter.update(600, 1000, 0, 0, 70000).speedBytesPerSecond, 100 / 60);
});

test('reset counters start a new measurement without inheriting the previous attempt', () => {
    const meter = createTransferMeter();
    meter.update(0, 1000, 0, 0, 0);
    meter.update(500, 1000, 0, 0, 10000);
    assert.deepEqual(meter.update(0, 1000, 0, 0, 11000), { speedBytesPerSecond: 0, etaSeconds: null });
    assert.equal(meter.update(100, 1000, 0, 0, 21000).speedBytesPerSecond, 10);
});

test('notifications in the same millisecond are coalesced without losing bytes', () => {
    const meter = createTransferMeter();
    meter.update(0, 1000, 0, 0, 0);
    meter.update(100, 1000, 0, 0, 0);
    meter.update(200, 1000, 0, 0, 0);
    assert.equal(meter.update(300, 1000, 0, 0, 10000).speedBytesPerSecond, 30);
});

test('clock rollback resets the timing baseline and completion still reports zero ETA', () => {
    const meter = createTransferMeter();
    meter.update(0, 1000, 0, 0, 10000);
    meter.update(100, 1000, 0, 0, 20000);
    assert.equal(meter.update(200, 1000, 0, 0, 15000).speedBytesPerSecond, 0);
    assert.equal(meter.update(1000, 1000, 0, 0, 25000).etaSeconds, 0);
});
