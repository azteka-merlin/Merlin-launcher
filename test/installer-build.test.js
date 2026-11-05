const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis');
const compiler = path.join(cache, 'nsis-3.0.4.1', 'makensis.exe');
const plugins = path.join(cache, 'nsis-resources-3.4.1', 'plugins', 'x86-unicode');
const includes = path.join(root, 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'include');
const skip = process.platform !== 'win32' ? 'The production NSIS compiler check requires Windows.'
    : !fs.existsSync(compiler) || !fs.existsSync(path.join(plugins, 'nsProcess.dll'))
        || !fs.existsSync(path.join(includes, 'allowOnlyOneInstallerInstance.nsh'))
        ? 'The cached NSIS compiler, production plugins or builder includes are unavailable.' : false;
const requireCompiler = process.env.MERLIN_REQUIRE_NSIS_TESTS === '1';
const quote = value => String(value).replace(/\$/g, '$$$$').replace(/"/g, '$\\"');

for (const uninstaller of [false, true]) {
    test(`production NSIS ${uninstaller ? 'uninstaller' : 'installer'} compiles when plugins are registered after custom includes`, { skip: requireCompiler ? false : skip }, () => {
        assert.equal(skip, false, `Installer validation requires the real Windows NSIS toolchain: ${skip}`);
        const base = path.resolve(os.tmpdir());
        const directory = fs.mkdtempSync(path.join(base, 'merlin-nsis-build-order-'));
        try {
            const source = path.join(directory, 'compile-only.nsi');
            fs.writeFileSync(source, `Unicode true
RequestExecutionLevel user
OutFile "${quote(path.join(directory, 'never-executed.exe'))}"
!define APP_EXECUTABLE_FILENAME "Merlin.exe"
!define PRODUCT_NAME "Merlin"
${uninstaller ? '!define BUILD_UNINSTALLER' : ''}
!addincludedir "${quote(includes)}"
; Match electron-builder: the custom include precedes plugin registration.
!include "${quote(path.join(root, 'scripts', 'installer.nsh'))}"
!addplugindir /x86-unicode "${quote(plugins)}"
!include "allowOnlyOneInstallerInstance.nsh"
!ifmacrodef customHeader
  !insertmacro customHeader
!endif
${uninstaller ? '' : `Function .onInit
  \${GetProcessInfo} 0 $pid $1 $2 $3 $4
  Call MerlinEnsureSteamClosed
FunctionEnd`}
Section
${uninstaller ? '' : '  !insertmacro customInstall'}
SectionEnd
`);
            // Compile only. Executing this fixture would invoke production shutdown commands.
            const compiled = spawnSync(compiler, ['/V2', source], {
                encoding: 'utf8', windowsHide: true, timeout: 30000,
            });
            assert.equal(compiled.error, undefined, `NSIS compiler could not start: ${compiled.error}`);
            assert.equal(compiled.status, 0,
                `Production include/plugin ordering must compile:\n${compiled.stdout}\n${compiled.stderr}`);
        } finally {
            assert.equal(path.dirname(path.resolve(directory)), base);
            assert.ok(path.basename(directory).startsWith('merlin-nsis-build-order-'));
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
}
