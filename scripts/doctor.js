const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const requiredDlls = [
    'OpenSteamTool.dll',
    'dwmapi.dll',
    'xinput1_4.dll',
    'merlin-helper.dll'
];

const requireNativeBuildTools = process.argv.includes('--build');
let hasError = false;

function log(status, message) {
    console.log(`[${status}] ${message}`);
}

function commandExists(command) {
    const lookupCommand = process.platform === 'win32' ? 'where.exe' : 'where';
    const result = spawnSync(lookupCommand, [command], { stdio: 'ignore' });
    return result.status === 0;
}

function commandOutput(command, args) {
    const result = spawnSync(command, args, {
        encoding: 'utf8'
    });

    if (result.status !== 0) return null;
    return (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0];
}

function fail(message) {
    hasError = true;
    log('ERROR', message);
}

function warn(message) {
    log('WARN', message);
}

function ok(message) {
    log('OK', message);
}

function checkSymlinkSupport(required) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-symlink-check-'));
    const targetPath = path.join(tempDir, 'target.txt');
    const linkPath = path.join(tempDir, 'link.txt');

    try {
        fs.writeFileSync(targetPath, 'merlin');
        fs.symlinkSync(targetPath, linkPath, 'file');
        ok('Windows symlink creation is available.');
    } catch (error) {
        if (required && process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
            // Use the same artifact resolver as the installed electron-builder.
            const probe = spawnSync(process.execPath, ['-e', `
                const fs = require('node:fs');
                const path = require('node:path');
                require('app-builder-lib/out/codeSign/windowsCodeSign').getSignVendorPath().then(dir => {
                    for (const file of ['rcedit-x64.exe', 'windows-10/x64/signtool.exe']) {
                        if (!fs.statSync(path.join(dir, file)).size) process.exitCode = 1;
                    }
                }).catch(() => { process.exitCode = 1; });
            `], { cwd: rootDir, timeout: 30000, windowsHide: true, stdio: 'ignore' });
            if (probe.status === 0) {
                ok('Electron Builder resolved the Windows build tools despite restricted symlink creation.');
                return;
            }
        }
        const message = 'Windows symlink creation is blocked. Electron Builder needs this while extracting winCodeSign. Enable Windows Developer Mode or run the build terminal as Administrator.';
        if (required) {
            fail(message);
        } else {
            warn(message);
        }
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
    }
}

function checkNode() {
    const versionText = process.versions.node;
    const major = Number(versionText.split('.')[0]);

    if (major < 18) {
        fail(`Node.js ${versionText} found. Install Node.js 18 or newer.`);
        return;
    }

    ok(`Node.js ${versionText} found.`);
}

function checkCommand(command, label, requiredForBuild) {
    if (!commandExists(command)) {
        const message = `${label} was not found in PATH.`;
        if (requiredForBuild) {
            warn(`${message} Required only when rebuilding the native DLLs or installer.`);
        } else {
            fail(message);
        }
        return;
    }

    const version = commandOutput(command, ['--version']);
    ok(`${label} found${version ? ` (${version})` : ''}.`);
}

function checkVisualStudio(required) {
    const candidates = [
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise'
    ];

    if (candidates.some(fs.existsSync)) {
        ok('Visual Studio Build Tools 2022 found.');
        return;
    }

    const message = 'Visual Studio Build Tools 2022 was not found. Required when rebuilding OpenSteamTool DLLs.';
    if (required) {
        fail(message);
    } else {
        warn(message);
    }
}

function checkProjectFiles() {
    const packageLockPath = path.join(rootDir, 'package-lock.json');
    if (fs.existsSync(packageLockPath)) {
        ok('package-lock.json found locally.');
    } else {
        warn('package-lock.json was not found. Run npm install once if dependencies are missing.');
    }

    const nodeModulesPath = path.join(rootDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        ok('node_modules found.');
    } else {
        warn('node_modules was not found. Run npm install before starting Merlin.');
    }

    for (const dll of requiredDlls) {
        const dllPath = path.join(rootDir, 'assets', 'dlls', dll);
        if (fs.existsSync(dllPath)) {
            ok(`${dll} found.`);
        } else {
            fail(`${dll} was not found in assets/dlls.`);
        }
    }
}

checkNode();
checkCommand('npm', 'npm', false);
checkCommand('git', 'Git', true);
checkCommand('cmake', 'CMake', requireNativeBuildTools);
checkVisualStudio(requireNativeBuildTools);
checkSymlinkSupport(requireNativeBuildTools);
checkProjectFiles();

if (hasError) {
    console.log('\nMerlin is not ready yet. Fix the errors above and run npm run doctor again.');
    process.exit(1);
}

console.log(requireNativeBuildTools
    ? '\nMerlin looks ready for a local release build.'
    : '\nMerlin looks ready for local development.');
