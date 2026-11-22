const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src', 'main', 'custom-games', 'MerlinGameOperationsService.cs');
const outputDirectory = path.join(root, 'assets', 'game-operations');
const output = path.join(outputDirectory, 'MerlinGameOperationsService.exe');
const framework = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
const compiler = path.join(framework, 'csc.exe');

if (process.platform !== 'win32') throw new Error('The Merlin game operations service can only be built on Windows.');
if (!fs.existsSync(compiler)) throw new Error(`The Windows .NET Framework compiler was not found: ${compiler}`);
if (!fs.existsSync(source)) throw new Error(`The service source file was not found: ${source}`);

fs.mkdirSync(outputDirectory, { recursive: true });
execFileSync(compiler, [
    '/nologo', '/target:winexe', '/platform:x64', '/optimize+', `/out:${output}`,
    `/reference:${path.join(framework, 'System.Core.dll')}`,
    `/reference:${path.join(framework, 'System.ServiceProcess.dll')}`,
    `/reference:${path.join(framework, 'System.Runtime.Serialization.dll')}`,
    `/reference:${path.join(framework, 'System.Security.dll')}`,
    source,
], { cwd: root, stdio: 'inherit', windowsHide: true });

console.log(`Built Merlin game operations service: ${output}`);
