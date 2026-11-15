param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'launcher.cpp'
$icon = (Resolve-Path -LiteralPath $IconPath).Path
$build = Join-Path $PSScriptRoot 'build'
$dist = Join-Path $PSScriptRoot 'dist'
$output = Join-Path $dist 'Play_TotK.exe'
$vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$installation = (& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1).Trim()
$vcvars = Join-Path $installation 'VC\Auxiliary\Build\vcvars64.bat'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Arquivo-fonte não encontrado: $source" }
if (-not (Test-Path -LiteralPath $vcvars -PathType Leaf)) { throw "Compilador C++ não encontrado: $vcvars" }
New-Item -ItemType Directory -Force -Path $build, $dist | Out-Null

$rc = Join-Path $build 'launcher.rc'
$res = Join-Path $build 'launcher.res'
$obj = Join-Path $build 'launcher.obj'
$cmd = Join-Path $build 'compile.cmd'
$resourcePath = $icon.Replace('\', '/')
Set-Content -LiteralPath $rc -Encoding ASCII -Value ('1 ICON "' + $resourcePath + '"')
$commands = @(
    '@echo off',
    ('call "' + $vcvars + '" >nul'),
    ('rc /nologo /fo "' + $res + '" "' + $rc + '"'),
    'if errorlevel 1 exit /b %errorlevel%',
    ('cl /nologo /std:c++17 /utf-8 /EHsc /O2 /MT /W4 /Fo"' + $obj + '" "' + $source + '" "' + $res +
        '" /link /SUBSYSTEM:WINDOWS /MACHINE:X64 /OUT:"' + $output + '" user32.lib'),
    'exit /b %errorlevel%'
)
Set-Content -LiteralPath $cmd -Encoding ASCII -Value $commands
& $env:ComSpec /d /c ('"' + $cmd + '"')
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output -PathType Leaf)) {
    throw "Falha ao compilar Play_TotK.exe: $LASTEXITCODE"
}
Write-Output $output
