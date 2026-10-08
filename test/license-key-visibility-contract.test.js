const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src/renderer/auth/license-gate.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('manual entry starts visible and remembered keys start masked', () => {
    assert.match(html, /id="licenseKeyInput"\s+type="text"/);
    assert.match(renderer, /input\.value = formatLicenseKey\(saved\);\s+setKeyVisible\(false\)/);
    assert.match(renderer, /input\.value = '';\s+setKeyVisible\(true\)/);
});

test('eye button changes its accessible state and animated icon with visibility', () => {
    assert.match(html, /id="licenseKeyVisibility"[^>]*aria-pressed="true"[^>]*data-visible="true"/);
    assert.match(html, /class="license-key-eye-open"[^>]*eye\.svg/);
    assert.match(html, /class="license-key-eye-closed"[^>]*eye-off\.svg/);
    assert.match(renderer, /input\.type = visible \? 'text' : 'password'/);
    assert.match(renderer, /visibilityButton\.dataset\.visible = String\(visible\)/);
    assert.match(renderer, /visibilityButton\.setAttribute\('aria-pressed', String\(visible\)\)/);
    assert.match(css, /\.license-key-visibility\[data-visible='false'\] \.license-key-eye-closed/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});
