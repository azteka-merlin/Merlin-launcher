const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { migrateConfig } = require('../src/main/config/migrate-config');
const { createConfigStore } = require('../src/main/config/config-store');

function fixture(run) {
    const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'merlin-config-migration-'));
    const source = path.join(root, 'legacy.json');
    const destination = path.join(root, 'profile', 'config.json');
    try { run({ root, source, destination }); }
    finally {
        assert.equal(path.dirname(root), fs.realpathSync.native(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('merlin-config-migration-'));
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('migration preserves the source and unrelated files and is safe to repeat', () => fixture(({ root, source, destination }) => {
    const original = '{"language":"ptbr","customSetting":{"value":42}}';
    fs.writeFileSync(source, original);
    fs.writeFileSync(path.join(root, 'keep.txt'), 'keep');
    assert.equal(migrateConfig(source, destination), true);
    assert.equal(fs.readFileSync(source, 'utf8'), original);
    assert.equal(fs.readFileSync(destination, 'utf8'), original);
    assert.equal(migrateConfig(source, destination), false);
    assert.equal(fs.readFileSync(path.join(root, 'keep.txt'), 'utf8'), 'keep');
    assert.deepEqual(fs.readdirSync(path.dirname(destination)), ['config.json']);
}));

test('migration leaves an existing destination untouched even when the source is different', () => fixture(({ source, destination }) => {
    fs.mkdirSync(path.dirname(destination));
    fs.writeFileSync(source, '{"language":"en"}');
    for (const existing of ['{"language":"ptbr"}', '{"language":', 'unrecognised content']) {
        fs.writeFileSync(destination, existing);
        assert.equal(migrateConfig(source, destination), false);
        assert.equal(fs.readFileSync(destination, 'utf8'), existing);
    }
}));

test('missing, truncated and non-object source configurations are not promoted', () => fixture(({ source, destination }) => {
    assert.equal(migrateConfig(source, destination), false);
    for (const invalid of ['{"language":', 'null', '[]', '"text"', '42']) {
        fs.writeFileSync(source, invalid);
        assert.equal(migrateConfig(source, destination), false);
        assert.equal(fs.existsSync(destination), false);
        assert.equal(fs.readFileSync(source, 'utf8'), invalid);
    }
}));

test('a destination created concurrently wins without being overwritten', () => fixture(({ source, destination }) => {
    fs.writeFileSync(source, '{"language":"en"}');
    const original = fs.linkSync;
    try {
        fs.linkSync = (temporary, target) => {
            fs.writeFileSync(target, '{"language":"de"}');
            return original(temporary, target);
        };
        assert.equal(migrateConfig(source, destination), false);
        assert.equal(fs.readFileSync(destination, 'utf8'), '{"language":"de"}');
        assert.deepEqual(fs.readdirSync(path.dirname(destination)), ['config.json']);
    } finally { fs.linkSync = original; }
}));

test('interrupted publication cleans only its temporary file and a later run succeeds', () => fixture(({ source, destination }) => {
    fs.writeFileSync(source, '{"language":"fr"}');
    fs.mkdirSync(path.dirname(destination));
    const leftover = path.join(path.dirname(destination), 'config.json.interrupted.tmp');
    fs.writeFileSync(leftover, 'previous interrupted write');
    const original = fs.linkSync;
    try {
        fs.linkSync = () => { throw Object.assign(new Error('publication failed'), { code: 'EIO' }); };
        assert.throws(() => migrateConfig(source, destination), { code: 'EIO' });
        assert.equal(fs.existsSync(destination), false);
        assert.deepEqual(fs.readdirSync(path.dirname(destination)), ['config.json.interrupted.tmp']);
    } finally { fs.linkSync = original; }
    assert.equal(migrateConfig(source, destination), true);
    assert.equal(fs.readFileSync(leftover, 'utf8'), 'previous interrupted write');
}));

test('a partial write is never exposed as the destination and can be retried', () => fixture(({ source, destination }) => {
    fs.writeFileSync(source, '{"language":"ptbr"}');
    const original = fs.writeFileSync;
    try {
        fs.writeFileSync = (file, contents, options) => {
            original(file, contents.slice(0, 4), options);
            throw Object.assign(new Error('write interrupted'), { code: 'EIO' });
        };
        assert.throws(() => migrateConfig(source, destination), { code: 'EIO' });
        assert.equal(fs.existsSync(destination), false);
        assert.deepEqual(fs.readdirSync(path.dirname(destination)), []);
    } finally { fs.writeFileSync = original; }
    assert.equal(migrateConfig(source, destination), true);
}));

test('config save preserves the previous file when publication fails and retries without changing the legacy source', () => fixture(({ source, destination }) => {
    const initial = '{"language":"ptbr","customSetting":true}';
    fs.writeFileSync(source, initial);
    migrateConfig(source, destination);
    const store = createConfigStore({ fs, path, getFilePath: () => destination, defaults: { language: 'en' } });
    store.load();
    const originalRename = fs.renameSync;
    const originalError = console.error;
    try {
        fs.renameSync = () => { throw Object.assign(new Error('file locked'), { code: 'EPERM' }); };
        console.error = () => {};
        store.update({ language: 'de' });
        assert.equal(fs.readFileSync(destination, 'utf8'), initial);
        assert.deepEqual(fs.readdirSync(path.dirname(destination)), ['config.json']);
    } finally { fs.renameSync = originalRename; console.error = originalError; }
    store.save();
    assert.deepEqual(JSON.parse(fs.readFileSync(destination)), { language: 'de', customSetting: true });
    assert.equal(fs.readFileSync(source, 'utf8'), initial);
}));
