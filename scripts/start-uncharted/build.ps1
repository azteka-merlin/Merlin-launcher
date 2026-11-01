param(
    [Parameter(Mandatory = $true)]
    [string]$GameRoot
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $GameRoot).Path
$source = Join-Path $PSScriptRoot 'Program.cs'
$icon = Join-Path $root 'launcher\uncharted.ico'
$output = Join-Path $root 'start_uncharted.exe'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

foreach ($file in @($source, $icon, $compiler)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Arquivo necessário não encontrado: $file"
    }
}

& $compiler /nologo /target:winexe /platform:x64 /optimize+ `
    /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll `
    ("/win32icon:" + $icon) ("/out:" + $output) $source
if ($LASTEXITCODE -ne 0) { throw "Compilação falhou: $LASTEXITCODE" }
Write-Output $output
