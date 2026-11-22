const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const installer = fs.readFileSync(path.join(root, 'scripts', 'installer.nsh'), 'utf8');
const steamShutdown = fs.readFileSync(path.join(root, 'scripts', 'steam-shutdown.nsh'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'src', 'main', 'custom-games', 'MerlinGameOperationsService.cs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function macro(name) {
    const match = installer.match(new RegExp(`!macro ${name}\\b([\\s\\S]*?)!macroend`));
    assert.ok(match, `Missing NSIS macro: ${name}`);
    return match[1];
}

test('assisted installer requires the service and installs Steam runtime DLLs automatically', () => {
    assert.equal(packageJson.build.nsis.oneClick, false);
    assert.equal(packageJson.build.nsis.perMachine, true);
    assert.match(macro('customPageAfterChangeDir'), /Page custom MerlinOptionsPageCreate MerlinOptionsPageLeave/);
    assert.match(macro('customPageAfterChangeDir'), /skipPageIfUpdated/);
    assert.match(installer, /NSD_Check\} \$merlinServiceCheckbox/);
    assert.match(installer, /Instalar o serviço auxiliar do Merlin \(obrigatório\)/);
    assert.doesNotMatch(installer, /merlinSteamCheckbox|merlinSteamChoice|Instalar os componentes de integração com a Steam/);
    const leave = installer.match(/Function MerlinOptionsPageLeave([\s\S]*?)FunctionEnd/);
    assert.ok(leave);
    assert.match(leave[1], /\$merlinServiceChoice\s*!=\s*\$\{BST_CHECKED\}/);
    assert.match(leave[1], /Abort\b/);
    assert.match(installer, /StrCpy \$merlinServiceChoice \$\{BST_CHECKED\}/);
});
test('required Steam runtime DLLs are copied after Steam shutdown on every install and update', () => {
    const install = macro('customInstall');
    const init = macro('customInit');
    const copy = install.indexOf('--install-steam-dlls');
    assert.ok(copy >= 0, 'The Steam runtime DLL installer must be called.');
    assert.ok(install.lastIndexOf('Call MerlinEnsureSteamClosed', copy) >= 0,
        'Steam must be closed before the required DLL copy.');
    assert.match(install, /\$\{If\}\s+\$\{FileExists\}\s+"\$steamInstallPath\\steam\.exe"[\s\S]*?--install-steam-dlls/,
        'The setup must automatically install the runtime DLLs whenever Steam is detected.');
    assert.match(init, /Call MerlinEnsureSteamClosed[\s\S]*?\$steamCloseReady != "1"[\s\S]*?Quit/,
        'The setup must stop if Steam cannot be closed before installation.');
    assert.doesNotMatch(install, /ReadRegDWORD[^\r\n]*SteamIntegrationEnabled/,
        'Steam runtime installation must not depend on an old opt-in registry value.');
    assert.match(install, /SteamIntegrationEnabled" 1/);
    assert.match(helper, /"OpenSteamTool\.dll", "dwmapi\.dll", "xinput1_4\.dll", "merlin-helper\.dll", "merlin_cloud_redirect\.dll"/);
    assert.match(helper, /HashFile\(copy\.Staged\)/);
    assert.match(helper, /HashFile\(copy\.Destination\)/);
    assert.match(helper, /File\.Replace\(copy\.Staged, copy\.Destination/);
    assert.match(helper, /steam-backups/);
});

test('upgrades install the required helper even without a previous service registration', () => {
    const install = macro('customInstall');
    const service = install.slice(0, install.indexOf('--install-steam-dlls'));
    assert.match(service, /--install-service/);
    assert.doesNotMatch(service, /ReadRegDWORD[^\r\n]*ServiceEnabled/);
    assert.match(service, /--install-service[\s\S]*?\$0 != 0[\s\S]*?SetErrorLevel 1\s+Quit/);
    assert.match(service, /ServiceEnabled" 1/);
});

test('Steam runtime installation preserves safe destination checks', () => {
    assert.match(helper, /isWindowsDirectory/);
    assert.match(helper, /String\.Equals\(root, driveRoot/);
});

test('installer closes Steam automatically before DLL writes', () => {
    assert.match(steamShutdown, /Exec\s+'"\$steamInstallPath\\steam\.exe" -shutdown'/);
    assert.match(steamShutdown, /taskkill\.exe" \/F \/T \/IM steam\.exe/);
    assert.doesNotMatch(steamShutdown, /MB_RETRYCANCEL/);
    assert.match(macro('customInit'), /Call MerlinEnsureSteamClosed/);
    assert.match(macro('customInstall'), /Call MerlinEnsureSteamClosed[\s\S]*?--install-steam-dlls/);
});

test('game folder permissions are granted to the interactive SID with inherited Modify only', () => {
    assert.match(helper, /FileSystemRights\.Modify/);
    assert.match(helper, /ContainerInherit \| InheritanceFlags\.ObjectInherit/);
    assert.match(helper, /BuiltinUsersSid/);
    assert.match(helper, /HasModifyGrant\(gamesRoot, clientSid\)/);
    const userLookup = helper.slice(helper.indexOf('private static string InteractiveUserSid()'),
        helper.indexOf('private static int ConfigureDefaultGameFolder()'));
    assert.doesNotMatch(userLookup, /GetOwner\(/);
    assert.doesNotMatch(helper, /EveryoneSid|WellKnownSidType\.WorldSid/);
});
