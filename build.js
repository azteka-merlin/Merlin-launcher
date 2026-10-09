const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = __dirname;
const nativeProjectDir = path.join(rootDir, 'OpenSteamTool');
const cloudRedirectProjectDir = path.join(rootDir, 'vendor', 'CloudRedirect');
const cloudRedirectBuildDir = path.join(cloudRedirectProjectDir, 'build');
const nativeBuildDir = path.join(nativeProjectDir, 'build');
const nativeReleaseDir = path.join(nativeBuildDir, 'Release');
const nativeSourceDir = nativeProjectDir;
const appDllDir = path.join(rootDir, 'assets', 'dlls');
const distDir = path.join(rootDir, 'dist');
const requiredDlls = ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll', 'merlin_cloud_redirect.dll'];
const helperDll = 'merlin-helper.dll';
const requestedGenerator = process.env.MERLIN_CMAKE_GENERATOR?.trim();

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeIntegrityManifest() {
    const files = [
        ...fs.readdirSync(distDir)
            .filter(file => file.toLowerCase().endsWith('.exe'))
            .map(file => path.join(distDir, file)),
        ...requiredDlls.map(dll => path.join(appDllDir, dll))
    ].filter(fs.existsSync);

    const manifest = {
        generatedAt: new Date().toISOString(),
        algorithm: 'SHA-256',
        files: files.map(file => ({
            path: path.relative(rootDir, file).replace(/\\/g, '/'),
            size: fs.statSync(file).size,
            sha256: sha256(file)
        }))
    };

    fs.writeFileSync(
        path.join(distDir, 'integrity.json'),
        JSON.stringify(manifest, null, 2)
    );
}

function cleanBuildDirectory(buildDir) {
    try {
        fs.rmSync(buildDir, {
            recursive: true,
            force: true,
            maxRetries: 20,
            retryDelay: 500
        });
        return;
    } catch (error) {
        if (!['EBUSY', 'EPERM'].includes(error.code) || !fs.existsSync(buildDir)) {
            throw error;
        }

        console.warn(`Build directory is locked; cleaning its contents instead: ${buildDir}`);
        for (const entry of fs.readdirSync(buildDir)) {
            fs.rmSync(path.join(buildDir, entry), {
                recursive: true,
                force: true,
                maxRetries: 20,
                retryDelay: 500
            });
        }
    }
}

// Prevent MSBuild worker processes from surviving a completed build and
// briefly locking files when the next clean build removes OpenSteamTool/build.
process.env.MSBUILDDISABLENODEREUSE = '1';

if (!fs.existsSync(path.join(nativeProjectDir, 'CMakeLists.txt'))) {
    throw new Error(
        `OpenSteamTool source tree not found: ${nativeProjectDir}`
    );
}
if (!fs.existsSync(path.join(cloudRedirectProjectDir, 'CMakeLists.txt'))) {
    throw new Error(`Vendored CloudRedirect source tree not found: ${cloudRedirectProjectDir}`);
}

function hasCommand(command) {
    try {
        execSync(`where ${command}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

const hasNinja = hasCommand('ninja');
const hasVisualStudio = fs.existsSync('C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe')
    || fs.existsSync('C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools')
    || fs.existsSync('C:\\Program Files\\Microsoft Visual Studio\\2022\\Community')
    || fs.existsSync('C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional')
    || fs.existsSync('C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise');

let generator = requestedGenerator;
if (!generator) {
    if (process.platform === 'win32' && hasVisualStudio) {
        generator = 'Visual Studio 17 2022';
    } else if (hasNinja) {
        generator = 'Ninja Multi-Config';
    } else {
        generator = 'Visual Studio 17 2022';
    }
}

console.log(`Building OpenSteamTool DLLs from ${nativeProjectDir} (Release) using ${generator}...`);
console.log(`Building Merlin CloudRedirect DLL from ${cloudRedirectProjectDir}...`);
cleanBuildDirectory(cloudRedirectBuildDir);
const cloudConfigureArgs = ['-S', cloudRedirectProjectDir, '-B', cloudRedirectBuildDir, '-G', generator];
if (generator.startsWith('Visual Studio')) cloudConfigureArgs.push('-A', 'x64');
execFileSync('cmake', cloudConfigureArgs, { cwd: cloudRedirectProjectDir, stdio: 'inherit', env: { ...process.env } });
execFileSync('cmake', ['--build', cloudRedirectBuildDir, '--config', 'Release', '--target', 'cloud_redirect'], {
    cwd: cloudRedirectProjectDir, stdio: 'inherit', env: { ...process.env }
});
const cloudDll = path.join(cloudRedirectBuildDir, 'Release', 'cloud_redirect.dll');
if (!fs.existsSync(cloudDll)) throw new Error(`CloudRedirect did not produce ${cloudDll}`);

cleanBuildDirectory(nativeBuildDir);
const configureArgs = ['-S', nativeSourceDir, '-B', nativeBuildDir, '-G', generator];
if (generator.startsWith('Visual Studio')) {
    configureArgs.push('-A', 'x64');
}
execFileSync('cmake', configureArgs, {
    cwd: nativeProjectDir,
    stdio: 'inherit',
    env: { ...process.env }
});
execFileSync('cmake', ['--build', nativeBuildDir, '--config', 'Release'], {
    cwd: nativeProjectDir,
    stdio: 'inherit',
    env: { ...process.env }
});

for (const dll of requiredDlls) {
    if (dll === 'merlin_cloud_redirect.dll') continue;
    const output = path.join(nativeReleaseDir, dll);
    if (!fs.existsSync(output)) {
        throw new Error(`OpenSteamTool did not produce ${output}`);
    }
}

fs.mkdirSync(appDllDir, { recursive: true });
for (const dll of requiredDlls) {
    if (dll === 'merlin_cloud_redirect.dll') continue;
    fs.copyFileSync(
        path.join(nativeReleaseDir, dll),
        path.join(appDllDir, dll)
    );
}
fs.copyFileSync(cloudDll, path.join(appDllDir, 'merlin_cloud_redirect.dll'));
console.log(`OpenSteamTool DLLs copied to ${appDllDir}`);

const helperOutput = path.join(nativeReleaseDir, helperDll);
if (fs.existsSync(helperOutput)) {
    fs.copyFileSync(helperOutput, path.join(appDllDir, helperDll));
    console.log(`Merlin helper DLL copied to ${appDllDir}`);
}

const dllsOnly = process.argv.includes('--opensteamtool-only') || process.argv.includes('--lumacore-only');

if (dllsOnly) {
    console.log('OpenSteamTool Release DLLs are ready.');
} else {
    console.log('Cleaning previous Electron build artifacts...');
    cleanBuildDirectory(distDir);
    console.log('Building transparent Electron package...');
    execSync('electron-builder --publish never', { cwd: rootDir, stdio: 'inherit' });
    writeIntegrityManifest();
    console.log('Obfuscated package and integrity manifest generated.');
}
