function encodePowerShell(command) {
    return Buffer.from(command, 'utf16le').toString('base64');
}

function createElevatedDirectoryCopy({ execFile, platform = process.platform }) {
    async function copy({ sourcePath, destinationPath }) {
        if (platform !== 'win32') {
            const error = new Error('Elevated file copy is only available on Windows.');
            error.code = 'apply_permission_denied';
            throw error;
        }

        const sourceBase64 = Buffer.from(String(sourcePath), 'utf8').toString('base64');
        const destinationBase64 = Buffer.from(String(destinationPath), 'utf8').toString('base64');
        const elevatedCommand = [
            `$source = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${sourceBase64}'))`,
            `$destination = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${destinationBase64}'))`,
            `if (-not (Test-Path -LiteralPath $source -PathType Container)) { exit 2 }`,
            `New-Item -ItemType Directory -Path $destination -Force -ErrorAction Stop | Out-Null`,
            `Get-ChildItem -LiteralPath $source -Force | ForEach-Object {`,
            `    Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force -ErrorAction Stop`,
            `}`
        ].join('\n');
        const encodedCommand = encodePowerShell(elevatedCommand);
        const powershellPath = `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
        const launcherCommand = [
            `$process = Start-Process`,
            `-FilePath '${powershellPath.replace(/'/g, "''")}'`,
            `-Verb RunAs`,
            `-WindowStyle Hidden`,
            `-ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','${encodedCommand}')`,
            `-Wait -PassThru;`,
            `exit $process.ExitCode`
        ].join(' ');

        await new Promise((resolve, reject) => {
            execFile(
                powershellPath,
                ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', launcherCommand],
                { windowsHide: true },
                error => {
                    if (!error) {
                        resolve();
                        return;
                    }
                    const wrapped = new Error('Administrator permission is required to update the EA App game files.');
                    wrapped.code = 'apply_permission_denied';
                    wrapped.cause = error;
                    reject(wrapped);
                }
            );
        });
    }

    return { copy };
}

module.exports = { createElevatedDirectoryCopy };
