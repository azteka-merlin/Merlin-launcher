param(
    [switch]$Deploy,
    [ValidateSet('start_mw2_campanha','start_mw2_multiplayer','start_mw3_campanha','start_mw3_multiplayer')]
    [string]$Only
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$assets = Join-Path $repo 'cods-launchers\assets'
$build = Join-Path $repo 'cods-launchers\build'
$dist = Join-Path $repo 'cods-launchers\dist'
$source = Join-Path $PSScriptRoot 'launcher.cpp'
$manifest = Join-Path $PSScriptRoot 'launcher.manifest'
$vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$installation = (& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1).Trim()
$vcvars = Join-Path $installation 'VC\Auxiliary\Build\vcvars64.bat'
if (-not (Test-Path -LiteralPath $vcvars -PathType Leaf)) { throw "Compilador C++ não encontrado: $vcvars" }
New-Item -ItemType Directory -Force -Path $build, $dist | Out-Null

$variants = @(
    @{ Name='start_mw2_multiplayer'; Game=22; Sp=0; Icon='mwii.ico'; Fix='D:\games\CODS\mw2\fix' },
    @{ Name='start_mw2_campanha';    Game=22; Sp=1; Icon='mwii.ico'; Fix='D:\games\CODS\mw2\fix' },
    @{ Name='start_mw3_multiplayer'; Game=23; Sp=0; Icon='mwiii-placeholder.ico'; Fix='D:\games\CODS\mw3\Fix' },
    @{ Name='start_mw3_campanha';    Game=23; Sp=1; Icon='mwiii-placeholder.ico'; Fix='D:\games\CODS\mw3\Fix' }
)

foreach ($variant in $variants) {
    if ($Only -and $variant.Name -ne $Only) { continue }
    $icon = Join-Path $assets $variant.Icon
    if (-not (Test-Path -LiteralPath $icon -PathType Leaf)) { throw "Ícone não encontrado: $icon" }
    $rc = Join-Path $build ($variant.Name + '.rc')
    $res = Join-Path $build ($variant.Name + '.res')
    $exe = Join-Path $dist ($variant.Name + '.exe')
    $obj = Join-Path $build ($variant.Name + '.obj')
    $resourcePath = $icon.Replace('\', '/')
    Set-Content -LiteralPath $rc -Encoding ASCII -Value ('1 ICON "' + $resourcePath + '"')
    $commands = @(
        '@echo off',
        ('call "' + $vcvars + '" >nul'),
        ('rc /nologo /fo "' + $res + '" "' + $rc + '"'),
        'if errorlevel 1 exit /b %errorlevel%',
        ('cl /nologo /std:c++17 /utf-8 /EHsc /O2 /MT /W4 /D COD_GAME=' + $variant.Game +
            ' /D COD_SP=' + $variant.Sp + ' /Fo"' + $obj + '" "' + $source + '" "' + $res +
            '" /link /SUBSYSTEM:WINDOWS /MACHINE:X64 /OUT:"' +
            $exe + '" advapi32.lib shell32.lib user32.lib ole32.lib'),
        'if errorlevel 1 exit /b %errorlevel%',
        ('mt /nologo -manifest "' + $manifest + '" -outputresource:"' + $exe + ';#1"'),
        'exit /b %errorlevel%'
    )
    $cmd = Join-Path $build ($variant.Name + '.cmd')
    Set-Content -LiteralPath $cmd -Encoding ASCII -Value $commands
    & $env:ComSpec /d /c ('"' + $cmd + '"')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exe -PathType Leaf)) {
        throw "Falha ao compilar $($variant.Name): $LASTEXITCODE"
    }
    Write-Output $exe
    if ($Deploy) {
        if (-not (Test-Path -LiteralPath $variant.Fix -PathType Container)) {
            throw "Pasta do fix não encontrada: $($variant.Fix)"
        }
        Copy-Item -LiteralPath $exe -Destination (Join-Path $variant.Fix ($variant.Name + '.exe')) -Force
        if ($variant.Game -eq 22) {
            $mw2Install = 'D:\SteamLibrary\steamapps\common\Call of Duty Modern Warfare II'
            if (Test-Path -LiteralPath (Join-Path $mw2Install 'cod22-cod.exe') -PathType Leaf) {
                Copy-Item -LiteralPath $exe -Destination (Join-Path $mw2Install ($variant.Name + '.exe')) -Force
            }
        } elseif ($variant.Game -eq 23) {
            $mw3Install = 'C:\Program Files (x86)\Steam\steamapps\common\Call of Duty Modern Warfare III'
            if (Test-Path -LiteralPath (Join-Path $mw3Install 'cod23-cod.exe') -PathType Leaf) {
                Copy-Item -LiteralPath $exe -Destination (Join-Path $mw3Install ($variant.Name + '.exe')) -Force
            }
        }
    }
}
