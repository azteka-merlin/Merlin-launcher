param(
    [string]$PackageRoot = 'C:\Users\AZTEKA\Music\MERLIN PORTS\zelda tears to kingdom\TotK-Setup-0.2.8-windows',
    [string]$LauncherRoot = ''
)

$ErrorActionPreference = 'Stop'
$package = (Resolve-Path -LiteralPath $PackageRoot).Path
$target = if ([string]::IsNullOrWhiteSpace($LauncherRoot)) { $package } else { (Resolve-Path -LiteralPath $LauncherRoot).Path }
$source = Join-Path $PSScriptRoot 'Program.cs'
$icon = Join-Path $package 'runtime\totk.ico'
$output = Join-Path $target 'Start_TotK.exe'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

foreach ($file in @($source, $icon, $compiler, (Join-Path $package 'python\pythonw.exe'), (Join-Path $package 'installer\gui.py'))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Arquivo necessario nao encontrado: $file"
    }
}

& $compiler /nologo /target:winexe /platform:x64 /optimize+ `
    /reference:System.Windows.Forms.dll /win32icon:$icon ("/out:" + $output) $source
if ($LASTEXITCODE -ne 0) { throw "Compilacao falhou: $LASTEXITCODE" }

& $output --validate-only
if ($LASTEXITCODE -ne 0) { throw "A validacao do iniciador falhou: $LASTEXITCODE" }
Write-Output $output