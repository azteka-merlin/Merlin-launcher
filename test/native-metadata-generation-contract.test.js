const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'OpenSteamTool');
const helper = fs.readFileSync(path.join(root, 'MerlinHelper', 'MerlinHelper.cpp'), 'utf8');
const fallback = fs.readFileSync(path.join(root, 'Utils', 'SteamMetadata', 'MerlinLocalFallback.cpp'), 'utf8');

test('local helper keeps the Steam root string alive during generation', () => {
  assert.match(fallback, /const auto steamRootPath = steamRoot\.string\(\)/);
  assert.match(fallback, /generateRequest\.steamRoot = steamRootPath\.c_str\(\)/);
  assert.doesNotMatch(fallback, /generateRequest\.steamRoot = steamRoot\.string\(\)\.c_str\(\)/);
});

test('ambiguous Steam pattern RVA is scoped to the exact DLL hash', () => {
  assert.match(helper, /caba4826aa3501039d095aee1843a6bfb270fb43a3ab4455b2d6733223579fee/);
  assert.match(helper, /"CUtlMemoryGrow", 0xE8400, nullptr/);
  assert.match(helper, /cb387adefbbac64a3c1490d4275d00daf3a1e0219b4580726ef7681db7429278/);
  assert.match(helper, /"GetTopManager", 0x611D80, "48 8B 05 C9 2C B1 00 C3"/);
  assert.match(helper, /"RepeatedFieldUint32_Add", 0x6D8340, nullptr/);
  assert.match(helper, /KnownPatternFor\(dllSha256, seed\.name\)/);
  assert.match(helper, /knownPattern \? knownPattern->rva : seed\.preferredRva/);
  assert.match(helper, /GeneratePatterns\(dllPath, seeds, sha\)/);
});
