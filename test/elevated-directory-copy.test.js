const test = require('node:test');
const assert = require('node:assert/strict');

const { createElevatedDirectoryCopy } = require('../src/main/files/elevated-directory-copy');

test('requests an elevated hidden PowerShell copy without interpolating paths', async () => {
    let invocation;
    const copier = createElevatedDirectoryCopy({
        platform: 'win32',
        execFile: (file, args, options, callback) => {
            invocation = { file, args, options };
            callback(null);
        }
    });

    await copier.copy({
        sourcePath: 'C:\\Temp\\source with spaces',
        destinationPath: 'C:\\Program Files\\EA Games\\EA SPORTS FC 27'
    });

    assert.match(invocation.file, /powershell\.exe$/i);
    assert.equal(invocation.options.windowsHide, true);
    const command = invocation.args.at(-1);
    assert.match(command, /Start-Process/);
    assert.match(command, /-Verb RunAs/);
    assert.match(command, /-WindowStyle Hidden/);
    assert.match(command, /-Wait -PassThru; exit \$process\.ExitCode/);
    assert.doesNotMatch(command, /EA SPORTS FC 27/);
    assert.doesNotMatch(command, /source with spaces/);
});

test('maps a cancelled or failed elevation prompt to an apply permission error', async () => {
    const copier = createElevatedDirectoryCopy({
        platform: 'win32',
        execFile: (_file, _args, _options, callback) => {
            const error = new Error('The operation was canceled by the user.');
            error.code = 1;
            callback(error);
        }
    });

    await assert.rejects(
        () => copier.copy({ sourcePath: 'C:\\source', destinationPath: 'C:\\destination' }),
        { code: 'apply_permission_denied' }
    );
});
