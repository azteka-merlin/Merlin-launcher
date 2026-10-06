const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceDir = path.resolve(__dirname, '..', 'OpenSteamTool', 'Utils', 'SteamMetadata');
const diagnostics = fs.readFileSync(path.join(sourceDir, 'SteamDiagnostics.cpp'), 'utf8');
const patternLoader = fs.readFileSync(path.join(sourceDir, 'PatternLoader.cpp'), 'utf8');
const ipcLoader = fs.readFileSync(path.join(sourceDir, 'IPCLoader.cpp'), 'utf8');
const remoteToml = fs.readFileSync(path.join(sourceDir, 'RemoteToml.cpp'), 'utf8');

test('Steam compatibility failures are recorded without native warning popups', () => {
  for (const source of [patternLoader, ipcLoader]) {
    assert.match(source, /SteamDiagnostics::RecordWarning\(/);
    assert.doesNotMatch(source, /SteamDiagnostics::ShowWarning\(/);
  }
  assert.match(diagnostics, /WriteWarning\(title, AppendSnapshot\(std::move\(message\)\)\)/);
  assert.doesNotMatch(diagnostics, /Dialog::ShowWarning\(/);
});

test('Release diagnostics use a bounded Merlin log independent of debug logging', () => {
  assert.match(diagnostics, /GetEnvironmentVariableW\(L"LOCALAPPDATA"/);
  assert.match(diagnostics, /L"Merlin"\s*\/\s*L"logs"\s*\//);
  assert.match(diagnostics, /L"merlin_steam_integration\.log"/);
  assert.match(diagnostics, /kMaxWarningLogBytes\s*=\s*1024\s*\*\s*1024/);
  assert.match(diagnostics, /std::filesystem::rename\(path, previous, ec\)/);
  assert.match(diagnostics, /std::ios::binary\s*\|\s*std::ios::app/);
  assert.doesNotMatch(diagnostics, /OPENSTEAMTOOL_LOGGING_ENABLED/);
});

test('each metadata failure records the exact TOML path supplied by the fetcher', () => {
  assert.match(remoteToml, /out\.cachePath\s*=\s*cachePathText/);
  assert.match(patternLoader, /Expected TOML: /);
  assert.match(patternLoader, /Expected TOMLs:\\n/);
  assert.match(patternLoader, /g_moduleTomlPaths\[module\]\s*=\s*r\.cachePath/);
  assert.match(patternLoader, /TOML parse error:/);
  assert.match(ipcLoader, /Expected TOML: /);
  assert.match(ipcLoader, /RecordMetadataFailure\(r\.sha256, r\.cachePath/);
  assert.match(ipcLoader, /TOML parse error:/);
});
