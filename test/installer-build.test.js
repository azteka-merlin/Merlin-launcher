const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const installerSource = fs.readFileSync(path.join(root, 'scripts', 'installer.nsh'), 'utf8');
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

test('shared service data paths use all-users APPDATA and uninstall only Merlin-owned entries', () => {
    assert.doesNotMatch(installerSource, /\$COMMONAPPDATA/i,
        'NSIS does not define $COMMONAPPDATA; resolve CommonApplicationData through $APPDATA in all-users context.');

    const install = installerSource.match(/!macro customInstall([\s\S]*?)!macroend/);
    assert.ok(install, 'The customInstall macro must exist.');
    assert.match(install[1], /^\s*SetShellVarContext all\b/m,
        'Installer diagnostics must resolve shared service paths in all-users context.');
    assert.match(install[1], /\$APPDATA\\Merlin\\GameOperations\\operations\.log/i,
        'Installer diagnostics must use the shared Merlin service data path.');
    assert.match(install[1], /SetShellVarContext current\s*$/,
        'Restore the shell variable context after the install macro.');

    const uninstall = installerSource.match(/!macro customUnInstall([\s\S]*?)!macroend/);
    assert.ok(uninstall, 'The customUnInstall macro must exist.');
    assert.match(uninstall[1], /^\s*SetShellVarContext all\b/m,
        'The service is installed for all users, so its path must resolve in all-users shell context.');
    assert.match(uninstall[1], /\$APPDATA\\Merlin\\GameOperations\\MerlinGameOperationsService\.exe/i,
        'Uninstall must invoke the Merlin service from CommonApplicationData.');
    assert.match(uninstall[1], /SetShellVarContext current\s*$/,
        'Restore the shell variable context after the uninstall macro.');

    const removalCommands = uninstall[1].split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^(?:Delete|RMDir|DeleteRegKey)\b/i.test(line));
    assert.deepEqual([...new Set(removalCommands)].sort(), [
        'Delete "$APPDATA\\Merlin\\GameOperations\\MerlinGameOperationsService.exe"',
        'DeleteRegKey HKLM "Software\\Merlin\\GameOperations"',
    ].sort(), 'Uninstall may remove only the service executable and Merlin GameOperations registry key.');
});

test('options page controls fit in the NSIS content area and require the Merlin service', () => {
    assert.match(installerSource, /O serviço auxiliar é obrigatório para instalar o Merlin\./);
    const controls = [...installerSource.matchAll(/\$\{NSD_Create(?:Label|Checkbox)\}\s+\d+u\s+(\d+)u\s+\S+\s+(\d+)u/g)];
    assert.equal(controls.length, 3, 'The options page should contain only the service checkbox and its descriptions.');
    assert.equal((installerSource.match(/\$\{NSD_CreateCheckbox\}/g) || []).length, 1,
        'The auxiliary service should be the only installer option.');
    assert.doesNotMatch(installerSource, /merlinSteamCheckbox|merlinSteamChoice|Instalar os componentes de integração com a Steam/);
    for (const [, top, height] of controls) {
        assert.ok(Number(top) + Number(height) <= 160,
            `NSIS control at ${top}u with height ${height}u extends into the footer.`);
    }
    assert.match(installerSource, /Instalar o serviço auxiliar do Merlin \(obrigatório\)/,
        'The required service must be identified as mandatory in the installer.');

    const leave = installerSource.match(/Function MerlinOptionsPageLeave([\s\S]*?)FunctionEnd/);
    assert.ok(leave, 'The options page leave handler must exist.');
    assert.match(leave[1], /\$merlinServiceChoice\s*!=\s*\$\{BST_CHECKED\}/,
        'The user must not be able to continue with the required service unchecked.');
    assert.match(leave[1], /Abort\b/,
        'Declining the required service must keep the user on the options page.');
});

for (const uninstaller of [false, true]) {
    test(`production NSIS ${uninstaller ? 'uninstaller' : 'installer'} compiles when plugins are registered after custom includes`, { skip: requireCompiler ? false : skip }, () => {
        assert.equal(skip, false, `Installer validation requires the real Windows NSIS toolchain: ${skip}`);
        const base = path.resolve(os.tmpdir());
        const directory = fs.mkdtempSync(path.join(base, 'merlin-nsis-build-order-'));
        try {
            const source = path.join(directory, 'compile-only.nsi');
            fs.writeFileSync(source, `Unicode true
RequestExecutionLevel user
!include "MUI2.nsh"
OutFile "${quote(path.join(directory, 'never-executed.exe'))}"
!define APP_EXECUTABLE_FILENAME "Merlin.exe"
!define PRODUCT_NAME "Merlin"
!define isUpdated "0 == 1"
${uninstaller ? '!define BUILD_UNINSTALLER' : ''}
!addincludedir "${quote(includes)}"
!macro skipPageIfUpdated
!macroend
; Match electron-builder: the custom include precedes plugin registration.
!include "${quote(path.join(root, 'scripts', 'installer.nsh'))}"
${uninstaller ? '' : '!insertmacro customPageAfterChangeDir'}
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
${uninstaller ? '  !insertmacro customUnInstall' : ''}
SectionEnd
`);
            // Compile only. Executing this fixture would invoke production shutdown commands.
            const compiled = spawnSync(compiler, ['/V2', source], {
                encoding: 'utf8', windowsHide: true, timeout: 30000,
            });
            assert.equal(compiled.error, undefined, `NSIS compiler could not start: ${compiled.error}`);
            const compilerOutput = `${compiled.stdout}\n${compiled.stderr}`;
            assert.doesNotMatch(compilerOutput, /warning\s+6000\b|unknown variable\/constant/i,
                `Unknown NSIS variables/constants must be fixed, not ignored:\n${compilerOutput}`);
            assert.equal(compiled.status, 0,
                `Production include/plugin ordering must compile:\n${compilerOutput}`);
        } finally {
            assert.equal(path.dirname(path.resolve(directory)), base);
            assert.ok(path.basename(directory).startsWith('merlin-nsis-build-order-'));
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
}
