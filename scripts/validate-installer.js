const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = [
    'installer-build.test.js',
    'installer-shutdown.test.js',
    'installer-copy.test.js',
    'dll-installer.test.js',
    'steam-service.test.js'
];

// Require the real compiler/plugin checks. A skipped compilation test cannot
// approve an installer for release. Build once first to populate the NSIS cache.
const result = spawnSync(process.execPath, ['--test', ...files.map(file => path.join(root, 'test', file))], {
    cwd: root,
    env: { ...process.env, MERLIN_REQUIRE_NSIS_TESTS: '1' },
    stdio: 'inherit',
    windowsHide: true
});

if (result.error) console.error(`Installer validation could not run: ${result.error.message}`);
process.exit(result.status ?? 1);
