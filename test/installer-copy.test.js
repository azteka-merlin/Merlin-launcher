const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const compiler = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache',
    'nsis', 'nsis-3.0.4.1', 'makensis.exe');
const includeDirectory = path.join(project, 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'include');
const integrationSkip = process.platform !== 'win32'
    ? 'The NSIS runtime check requires Windows.'
    : !fs.existsSync(compiler) || !fs.existsSync(path.join(includeDirectory, 'getProcessInfo.nsh'))
        ? 'The cached NSIS compiler or electron-builder includes are unavailable.' : false;
const names = ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll', 'merlin_cloud_redirect.dll', 'merlin-helper.dll'];
let execution;

function nsisString(value) {
    return String(value).replace(/\$/g, '$$$$').replace(/"/g, '$\\"');
}

function runCopyScenarios() {
    if (execution) return execution;
    const tempBase = path.resolve(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(tempBase, 'merlin-nsis-copy-test-'));
    const readonlyFile = path.join(directory, 'readonly', 'steam', names[0]);
    try {
        const scenarios = ['fresh', 'missing', 'readonly'].map(name => {
            const root = path.join(directory, name);
            const app = path.join(root, 'app');
            const steam = path.join(root, 'steam');
            const bundle = path.join(app, 'resources', 'dlls');
            fs.mkdirSync(bundle, { recursive: true });
            fs.mkdirSync(steam, { recursive: true });
            fs.writeFileSync(path.join(steam, 'steam.exe'), 'Test data only; this file is never executed.');
            for (const dll of names) {
                if (name !== 'missing' || dll !== names[0]) {
                    fs.writeFileSync(path.join(bundle, dll), Buffer.from(`Bundled bytes for ${dll}\0\x01\xff`, 'latin1'));
                }
                if (name !== 'fresh') fs.writeFileSync(path.join(steam, dll), `Existing bytes for ${dll}`);
            }
            return { name, app, steam, bundle };
        });
        fs.chmodSync(readonlyFile, 0o444);

        const original = fs.readFileSync(path.join(project, 'scripts', 'installer.nsh'), 'utf8');
        // Execute the production copy code, replacing only its user-facing dialogs.
        const quietHook = original.replace(/^(\s*)MessageBox\s+\S+\s+/gm, '$1DetailPrint ');
        assert.notEqual(quietHook, original, 'The harness must suppress installer dialogs.');
        assert.doesNotMatch(quietHook, /^\s*MessageBox\b/gm, 'No modal dialog may block this test.');
        fs.writeFileSync(path.join(directory, 'installer.nsh'), quietHook);
        fs.copyFileSync(path.join(project, 'scripts', 'steam-shutdown.nsh'), path.join(directory, 'steam-shutdown.nsh'));

        const executable = path.join(directory, 'copy-test.exe');
        const resultsFile = path.join(directory, 'results.txt');
        const sourceFile = path.join(directory, 'copy-test.nsi');
        const scenarioSections = scenarios.map(scenario => `
StrCpy $INSTDIR "${nsisString(scenario.app)}"
StrCpy $steamInstallPath "${nsisString(scenario.steam)}"
!insertmacro customInstall
FileWrite $testResults "${scenario.name}|$steamCopyFile|$steamCopyError|$steamCloseReady$\\r$\\n"
`).join('\n');
        fs.writeFileSync(sourceFile, `Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "${nsisString(executable)}"
!include "LogicLib.nsh"
!addincludedir "${nsisString(includeDirectory)}"
!define APP_EXECUTABLE_FILENAME "Merlin.exe"
!define PRODUCT_NAME "Merlin"
Var testResults
; This guard guarantees every real shutdown call returns before Exec/taskkill.
!macro MerlinFindSteam OUTPUT
  StrCpy \${OUTPUT} 603
!macroend
!include "${nsisString(path.join(directory, 'installer.nsh'))}"
!insertmacro customHeader
Section
FileOpen $testResults "${nsisString(resultsFile)}" w
${scenarioSections}
FileClose $testResults
SetErrorLevel 0
SectionEnd
`);
        const compiled = spawnSync(compiler, ['/V2', sourceFile], {
            encoding: 'utf8', windowsHide: true, timeout: 30000,
        });
        assert.equal(compiled.error, undefined, `NSIS compiler failed to start: ${compiled.error}`);
        assert.equal(compiled.status, 0, `NSIS compilation failed:\n${compiled.stdout}\n${compiled.stderr}`);
        const executed = spawnSync(executable, [], {
            encoding: 'utf8', windowsHide: true, timeout: 15000,
        });
        assert.equal(executed.error, undefined, `NSIS copy test failed: ${executed.error}`);
        assert.equal(executed.status, 0, 'The isolated installer copy runner must finish successfully.');
        const results = new Map(fs.readFileSync(resultsFile, 'utf8').trim().split(/\r?\n/).map(line => {
            const [name, file, error, ready] = line.split('|');
            return [name, { file, error, ready }];
        }));
        execution = new Map(scenarios.map(scenario => [scenario.name, {
            ...results.get(scenario.name),
            sources: new Map(names.filter(dll => fs.existsSync(path.join(scenario.bundle, dll)))
                .map(dll => [dll, fs.readFileSync(path.join(scenario.bundle, dll))])),
            destinations: new Map(names.filter(dll => fs.existsSync(path.join(scenario.steam, dll)))
                .map(dll => [dll, fs.readFileSync(path.join(scenario.steam, dll))])),
            log: fs.existsSync(path.join(scenario.app, 'merlin-steam-install.log'))
                ? fs.readFileSync(path.join(scenario.app, 'merlin-steam-install.log'), 'utf8') : null,
            steam: scenario.steam,
        }]));
        assert.equal(results.size, scenarios.length, 'Every production copy scenario must execute.');
        return execution;
    } finally {
        const resolved = path.resolve(directory);
        assert.equal(path.dirname(resolved), tempBase, 'Delete only the fixture created inside the system temp directory.');
        assert.ok(path.basename(resolved).startsWith('merlin-nsis-copy-test-'));
        if (fs.existsSync(readonlyFile)) fs.chmodSync(readonlyFile, 0o666);
        fs.rmSync(resolved, { recursive: true, force: true });
    }
}

test('compiled installer copies all five DLLs on a first installation', { skip: integrationSkip }, () => {
    const result = runCopyScenarios().get('fresh');
    assert.equal(result.ready, '1');
    assert.equal(result.destinations.size, names.length);
    for (const dll of names) assert.deepEqual(result.destinations.get(dll), result.sources.get(dll), dll);
    assert.equal(result.log, null, 'A successful first installation must not produce a copy failure log.');
});

test('compiled installer reports a missing source and leaves all installed DLLs unchanged', { skip: integrationSkip }, () => {
    const result = runCopyScenarios().get('missing');
    assert.equal(result.ready, '1');
    assert.equal(result.file, 'OpenSteamTool.dll');
    assert.equal(result.error, '2');
    for (const dll of names) assert.equal(result.destinations.get(dll).toString(), `Existing bytes for ${dll}`, dll);
    assert.match(result.log, /File: OpenSteamTool\.dll\r?\nWindows error: 2\r?\n/);
    assert.ok(result.log.includes(`Steam: ${result.steam}`), 'Failure details must include the exact destination.');
});

test('compiled installer preserves a read-only DLL and reports Windows access denied', { skip: integrationSkip }, () => {
    const result = runCopyScenarios().get('readonly');
    assert.equal(result.ready, '1');
    assert.equal(result.file, 'OpenSteamTool.dll');
    assert.equal(result.error, '5');
    for (const dll of names) assert.equal(result.destinations.get(dll).toString(), `Existing bytes for ${dll}`, dll);
    assert.match(result.log, /File: OpenSteamTool\.dll\r?\nWindows error: 5\r?\n/);
    assert.ok(result.log.includes(`Steam: ${result.steam}`), 'Failure details must include the exact destination.');
});
