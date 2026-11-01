$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$build = Join-Path $repo 'cods-launchers\build'
$vcvars = 'C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat'
New-Item -ItemType Directory -Force -Path $build | Out-Null
$probe = Join-Path $build 'console_probe_watch.exe'
$sourceProbe = Join-Path $PSScriptRoot 'console_probe.cpp'
$sourceTest = Join-Path $PSScriptRoot 'test_hidden.cpp'
$probeObj = Join-Path $build 'console_probe_watch.obj'
$variants = @(
    @{ Name = 'mw2'; Game = 22; Diagnostic = 'console_probe_diagnostics_mw2.txt' },
    @{ Name = 'mw3'; Game = 23; Diagnostic = 'console_probe_diagnostics_mw3.txt' }
)
$commands = @(
    '@echo off',
    ('call "' + $vcvars + '" >nul'),
    ('cl /nologo /W4 /O2 /MT /EHsc /Fo"' + $probeObj + '" /Fe"' + $probe + '" "' + $sourceProbe + '" /link /SUBSYSTEM:CONSOLE user32.lib'),
    'if errorlevel 1 exit /b %errorlevel%'
)
foreach ($variant in $variants) {
    $test = Join-Path $build ('test_hidden_' + $variant.Name + '.exe')
    $testObj = Join-Path $build ('test_hidden_' + $variant.Name + '.obj')
    $commands += ('cl /nologo /std:c++17 /utf-8 /W4 /O2 /MT /EHsc /DTEST_GAME=' + $variant.Game + ' /Fo"' + $testObj + '" /Fe"' + $test + '" "' + $sourceTest + '" /link /SUBSYSTEM:WINDOWS advapi32.lib shell32.lib user32.lib ole32.lib')
    $commands += 'if errorlevel 1 exit /b %errorlevel%'
}
$commands += 'exit /b 0'
$cmd = Join-Path $build 'test_hidden_watch.cmd'
Set-Content -LiteralPath $cmd -Encoding ASCII -Value $commands
& $env:ComSpec /d /c ('"' + $cmd + '"')
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar teste: $LASTEXITCODE" }
$explanations = @{
    20 = 'havia uma janela de console visível no desktop ao iniciar o processo'
    21 = 'GetConsoleWindow não encontrou um console'
    22 = 'GetConsoleMode falhou para a saída padrão'
    23 = 'SetConsoleTitleW falhou'
    24 = 'WriteConsoleW falhou'
    25 = 'a janela permaneceu visível no desktop por mais de 2 segundos'
    26 = 'a janela reapareceu após o watcher ocultá-la'
    27 = 'GetConsoleMode falhou após ocultar a janela'
    28 = 'WriteConsoleW falhou após ocultar a janela'
    29 = 'SetConsoleTitleW falhou com o título genérico'
    30 = 'o cenário de renomeação não conseguiu mostrar a janela genérica'
    31 = 'SetConsoleTitleW falhou ao definir o título IW9'
    32 = 'a janela continuou visível por 2 segundos após receber o título IW9'
    33 = 'a janela reapareceu após ser ocultada no cenário de renomeação'
    34 = 'GetConsoleMode falhou após a renomeação'
    35 = 'WriteConsoleW falhou após a renomeação'
    36 = 'o teste não recebeu um jogo válido'
}
foreach ($variant in $variants) {
    $test = Join-Path $build ('test_hidden_' + $variant.Name + '.exe')
    $diagnostic = Join-Path $build $variant.Diagnostic
    Remove-Item -LiteralPath $diagnostic -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $test -WorkingDirectory $build -PassThru -Wait
    $detail = if (Test-Path -LiteralPath $diagnostic) {
        (Get-Content -LiteralPath $diagnostic -Raw).TrimEnd()
    } else {
        'O processo de teste não gravou diagnósticos da janela.'
    }
    Write-Output ($variant.Name.ToUpperInvariant() + ':')
    Write-Output $detail
    if ($process.ExitCode -ne 0) {
        $reason = $explanations[[int]$process.ExitCode]
        if (-not $reason) { $reason = 'erro do launcher ou do teste' }
        throw "Teste de console oculto $($variant.Name) falhou (código $($process.ExitCode)): $reason."
    }
    Write-Output ('Teste passou para ' + $variant.Name.ToUpperInvariant() + ': o watcher ocultou o console ao mostrar e ao renomear para IW9; as APIs de console continuaram funcionando.')
}
