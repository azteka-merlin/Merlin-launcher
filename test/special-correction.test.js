const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    MAX_LICENSE_FILE_BYTES,
    createSpecialCorrection
} = require('../src/main/corrections/special-correction');

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-special-correction-'));
    const programDataPath = path.join(root, 'ProgramData');
    const extractedPath = path.join(root, 'extracted');
    const licenseDirectory = path.join(programDataPath, 'Electronic Arts', 'EA Services', 'License');
    fs.mkdirSync(licenseDirectory, { recursive: true });
    fs.mkdirSync(extractedPath, { recursive: true });
    fs.writeFileSync(path.join(licenseDirectory, '16425884_sc.dlf'), Buffer.from('license'));
    fs.writeFileSync(path.join(extractedPath, 'token.ini'), '[token]\ntoken=RETORNO_TOKEN_MERLIN\n');
    fs.writeFileSync(path.join(extractedPath, 'anadius.cfg'), '"Token" "RETORNO_TOKEN_MERLIN"\n');
    return { root, programDataPath, extractedPath };
}

test('replaces exactly one placeholder in each extracted template', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    let receivedLicense;
    const special = createSpecialCorrection({
        fs,
        path,
        programDataPath: fixture.programDataPath,
        licenseTokenClient: {
            generate: async payload => {
                receivedLicense = payload;
                return 'generated-token';
            }
        }
    });

    const item = { appId: '4407750', activationType: 'license_token' };
    assert.equal(special.appliesTo(item), true);
    assert.equal(special.appliesTo({ appId: '4407750' }), true);
    assert.equal(special.appliesTo({ appId: '123', activationType: 'license_token' }), false);
    await special.prepare({ item, extractedPath: fixture.extractedPath });

    assert.equal(receivedLicense.appId, '4407750');
    assert.equal(receivedLicense.licenseBytes.toString(), 'license');
    assert.equal(fs.readFileSync(path.join(fixture.extractedPath, 'token.ini'), 'utf8'), '[token]\ntoken=generated-token\n');
    assert.equal(fs.readFileSync(path.join(fixture.extractedPath, 'anadius.cfg'), 'utf8'), '"Token" "generated-token"\n');
});

test('rejects missing license and invalid templates before writing either template', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const special = createSpecialCorrection({
        fs,
        path,
        programDataPath: fixture.programDataPath,
        licenseTokenClient: { generate: async () => 'generated-token' }
    });
    const item = { appId: '4407750', activationType: 'license_token' };

    fs.unlinkSync(path.join(fixture.programDataPath, 'Electronic Arts', 'EA Services', 'License', '16425884_sc.dlf'));
    await assert.rejects(() => special.prepare({ item, extractedPath: fixture.extractedPath }), { code: 'license_file_missing' });

    fs.writeFileSync(path.join(fixture.programDataPath, 'Electronic Arts', 'EA Services', 'License', '16425884_sc.dlf'), 'license');
    fs.writeFileSync(path.join(fixture.extractedPath, 'anadius.cfg'), 'missing placeholder');
    const originalTokenIni = fs.readFileSync(path.join(fixture.extractedPath, 'token.ini'), 'utf8');
    await assert.rejects(() => special.prepare({ item, extractedPath: fixture.extractedPath }), { code: 'token_templates_invalid' });
    assert.equal(fs.readFileSync(path.join(fixture.extractedPath, 'token.ini'), 'utf8'), originalTokenIni);
});

test('rejects license files above the one megabyte request limit', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(
        path.join(fixture.programDataPath, 'Electronic Arts', 'EA Services', 'License', '16425884_sc.dlf'),
        Buffer.alloc(MAX_LICENSE_FILE_BYTES + 1)
    );
    const special = createSpecialCorrection({
        fs,
        path,
        programDataPath: fixture.programDataPath,
        licenseTokenClient: { generate: async () => 'generated-token' }
    });

    await assert.rejects(
        () => special.prepare({
            item: { appId: '4407750', activationType: 'license_token' },
            extractedPath: fixture.extractedPath
        }),
        { code: 'license_file_too_large' }
    );
});
