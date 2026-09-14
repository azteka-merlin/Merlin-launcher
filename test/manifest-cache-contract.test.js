const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const httpSource = fs.readFileSync(
  path.join(root, 'OpenSteamTool', 'OSTPlatform', 'Windows', 'Http.cpp'),
  'utf8',
);
const hookSource = fs.readFileSync(
  path.join(root, 'OpenSteamTool', 'Hook', 'Hooks_Manifest.cpp'),
  'utf8',
);
const cacheSource = fs.readFileSync(
  path.join(root, 'OpenSteamTool', 'Utils', 'SteamMetadata', 'ManifestCache.cpp'),
  'utf8',
);

test('manifest HTTP reads are bounded before buffer growth', () => {
  assert.match(httpSource, /maxBodyBytes\s*==\s*0\s*\|\|\s*r\.body\.size\(\)\s*>=\s*maxBodyBytes/);
  assert.match(httpSource, /const DWORD toRead\s*=\s*static_cast<DWORD>\(std::min<size_t>\(avail, remaining\)\)/);
  assert.doesNotMatch(httpSource, /r\.body\.resize\(off \+ avail\)/);
});

test('manifest responses do not log binary payloads or spawn detached work', () => {
  assert.doesNotMatch(httpSource, /response body=\{\}/);
  assert.doesNotMatch(hookSource, /StartDetached/);
  assert.match(hookSource, /kPreseedBudgetMs\s*=\s*5000/);
});

test('manifest cache keeps validation, negative cache and atomic writes', () => {
  assert.match(cacheSource, /kMaxBodyBytes\s*=\s*64u\s*\*\s*1024u\s*\*\s*1024u/);
  assert.match(cacheSource, /kNegativeCacheTtl\s*=\s*std::chrono::minutes\(10\)/);
  assert.match(cacheSource, /LooksLikeManifest\(response\.body\)/);
  assert.match(cacheSource, /MoveFileExA\(/);
});
