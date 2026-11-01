const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateCloudDefault } = require('../src/main/cloud-sync/cloud-default');

test('cloud is enabled once for an upgrade and a later opt-out persists', () => {
    const config = { cloudSync: { enabled: false, startAtLogin: false } };
    const store = { get: () => config, update: changes => Object.assign(config, changes) };
    assert.equal(migrateCloudDefault(store), true);
    assert.equal(config.cloudSync.enabled, true);
    assert.equal(config.cloudSync.startAtLogin, true);
    config.cloudSync.enabled = false;
    config.cloudSync.startAtLogin = false;
    assert.equal(migrateCloudDefault(store), false);
    assert.equal(config.cloudSync.enabled, false);
});

test('a new installation receives the cloud default', () => {
    const config = {};
    const store = { get: () => config, update: changes => Object.assign(config, changes) };
    migrateCloudDefault(store);
    assert.equal(config.cloudSync.enabled, true);
    assert.equal(config.cloudSync.defaultMigration, 1);
});
