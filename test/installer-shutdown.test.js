const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const includePath = path.join(project, 'scripts', 'steam-shutdown.nsh');
const installerPath = path.join(project, 'scripts', 'installer.nsh');
const compiler = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache',
    'nsis', 'nsis-3.0.4.1', 'makensis.exe');
const integrationSkip = process.platform !== 'win32'
    ? 'The NSIS runtime check requires Windows.'
    : !fs.existsSync(compiler) ? 'The cached NSIS compiler is unavailable.' : false;

const scenarios = [
    { name: 'absent', states: [603], ready: '1', graceful: 0, forced: 0, queries: 1 },
    { name: 'normal', states: [0, 603], ready: '1', graceful: 1, forced: 0, queries: 2 },
    { name: 'forced', states: [...Array(7).fill(0), 603], ready: '1', graceful: 1, forced: 1, queries: 8 },
    { name: 'enumeration-error', states: [604], ready: '0', graceful: 0, forced: 0, queries: 1 },
    { name: 'error-during-wait', states: [0, 604], ready: '0', graceful: 1, forced: 0, queries: 2 },
    { name: 'still-running', states: Array(19).fill(0), ready: '0', graceful: 1, forced: 1, queries: 19 },
    { name: 'reappeared', states: [603, 0, 603], calls: 2, ready: '1', graceful: 1, forced: 0, queries: 3 },
];

let execution;

function nsisString(value) {
    return String(value).replace(/\$/g, '$$$$').replace(/"/g, '$\\"');
}

function runCompiledScenarios() {
    if (execution) return execution;
    const original = fs.readFileSync(includePath, 'utf8');
    // Only the operating-system actions are replaced. All decisions, retries,
    // delays and error handling come from the production function itself.
    let gracefulStubs = 0;
    let forcedStubs = 0;
    const safeInclude = original.split(/\r?\n/).map(line => {
        if (/^\s*Exec\s/.test(line)) {
            gracefulStubs += 1;
            return 'IntOp $testGraceful $testGraceful + 1';
        }
        if (/^\s*nsExec::ExecToStack\s/.test(line)) {
            forcedStubs += 1;
            return 'IntOp $testForced $testForced + 1\nPush "stubbed taskkill output"\nPush "0"';
        }
        return line;
    }).join('\n');
    assert.equal(gracefulStubs, 1, 'Stub exactly the real graceful Steam shutdown.');
    assert.equal(forcedStubs, 1, 'Stub exactly the real forced Steam shutdown.');
    assert.doesNotMatch(safeInclude, /^\s*(?:Exec(?:Wait|Shell)?|nsExec::Exec\w*)\s/gm,
        'The harness must never execute the real Steam or taskkill commands.');

    const tempBase = path.resolve(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(tempBase, 'merlin-nsis-shutdown-test-'));
    const executable = path.join(directory, 'shutdown-test.exe');
    const resultsFile = path.join(directory, 'results.txt');
    const sourceFile = path.join(directory, 'shutdown-test.nsi');
    try {
        const queries = scenarios.flatMap((scenario, index) => [
            `\${If} $testScenario == ${index}`,
            ...scenario.states.flatMap((state, stateIndex) => [
                `  \${If} $testQuery == ${stateIndex + 1}`,
                `    StrCpy $testState ${state}`,
                '  ${EndIf}',
            ]),
            '${EndIf}',
        ]).join('\n');
        const sections = scenarios.map((scenario, index) => `
StrCpy $testScenario ${index}
StrCpy $testQuery 0
StrCpy $testGraceful 0
StrCpy $testForced 0
${Array(scenario.calls || 1).fill('Call MerlinEnsureSteamClosed').join('\n')}
FileWrite $testResults "${scenario.name}|$steamCloseReady|$testGraceful|$testForced|$testQuery|$steamCloseError$\\r$\\n"
`).join('\n');
        const harness = `Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "${nsisString(executable)}"
!include "LogicLib.nsh"
Var steamInstallPath
Var testScenario
Var testQuery
Var testState
Var testGraceful
Var testForced
Var testResults
!macro MerlinFindSteam result
  Call MerlinTestFindProcess
  Pop \${result}
!macroend
Function MerlinTestFindProcess
  IntOp $testQuery $testQuery + 1
  StrCpy $testState 999
${queries}
  Push $testState
FunctionEnd
${safeInclude}
!insertmacro customHeader
Section
CreateDirectory "$EXEDIR\\fake-steam"
FileOpen $0 "$EXEDIR\\fake-steam\\steam.exe" w
FileWrite $0 "This is test data and is never executed."
FileClose $0
StrCpy $steamInstallPath "$EXEDIR\\fake-steam"
FileOpen $testResults "${nsisString(resultsFile)}" w
${sections}
FileClose $testResults
SetErrorLevel 0
SectionEnd
`;
        fs.writeFileSync(sourceFile, harness);
        const compiled = spawnSync(compiler, ['/V2', sourceFile], {
            encoding: 'utf8', windowsHide: true, timeout: 30000,
        });
        assert.equal(compiled.error, undefined, `NSIS compiler failed to start: ${compiled.error}`);
        assert.equal(compiled.status, 0, `NSIS compilation failed:\n${compiled.stdout}\n${compiled.stderr}`);
        const executed = spawnSync(executable, [], {
            encoding: 'utf8', windowsHide: true, timeout: 45000,
        });
        assert.equal(executed.error, undefined, `NSIS scenario execution failed: ${executed.error}`);
        assert.equal(executed.status, 0, 'The isolated NSIS scenario runner must finish successfully.');
        execution = new Map(fs.readFileSync(resultsFile, 'utf8').trim().split(/\r?\n/).map(line => {
            const [name, ready, graceful, forced, queries, error] = line.split('|');
            return [name, { ready, graceful: Number(graceful), forced: Number(forced), queries: Number(queries), error }];
        }));
        assert.equal(execution.size, scenarios.length, 'Every shutdown scenario must execute.');
        return execution;
    } finally {
        const resolved = path.resolve(directory);
        assert.equal(path.dirname(resolved), tempBase, 'Delete only the test directory created inside the system temp folder.');
        assert.ok(path.basename(resolved).startsWith('merlin-nsis-shutdown-test-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
}

test('installer rechecks Steam after extraction and before copying any DLL', () => {
    const installer = fs.readFileSync(installerPath, 'utf8');
    const install = installer.match(/!macro customInstall\b([\s\S]*?)!macroend/);
    assert.ok(install, 'The production installer must define customInstall.');
    const shutdown = install[1].indexOf('Call MerlinEnsureSteamClosed');
    const firstCopy = install[1].indexOf('CopyFileW');
    assert.ok(shutdown >= 0, 'customInstall must recheck and close Steam.');
    assert.ok(firstCopy > shutdown, 'Steam must close immediately before destination DLL writes.');
    const beforeCopy = install[1].slice(shutdown, firstCopy);
    assert.match(beforeCopy, /steamCloseReady/);
    assert.match(beforeCopy, /(?:Quit|Abort|Goto)/, 'Failed Steam shutdown must prevent copying.');
});

for (const scenario of scenarios) {
    test(`compiled installer shutdown: ${scenario.name}`, { skip: integrationSkip }, () => {
        const result = runCompiledScenarios().get(scenario.name);
        assert.equal(result.ready, scenario.ready);
        assert.equal(result.graceful, scenario.graceful);
        assert.equal(result.forced, scenario.forced);
        assert.equal(result.queries, scenario.queries);
        if (scenario.ready === '0') assert.ok(result.error, 'A failed close must preserve a diagnostic.');
        else assert.equal(result.error, '', 'A successful close must clear the failure diagnostic.');
    });
}
