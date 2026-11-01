const CLOUD_DEFAULT_MIGRATION = 1;

function migrateCloudDefault(configStore) {
    const cloud = configStore.get().cloudSync || {};
    if (cloud.defaultMigration >= CLOUD_DEFAULT_MIGRATION) return false;
    configStore.update({ cloudSync: {
        ...cloud,
        enabled: true,
        startAtLogin: true,
        defaultMigration: CLOUD_DEFAULT_MIGRATION
    } });
    return true;
}

module.exports = { migrateCloudDefault };
