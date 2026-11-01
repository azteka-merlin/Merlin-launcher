@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cl /nologo /W4 /O2 /MT /EHsc /Fo"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\console_probe_watch.obj" /Fe"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\console_probe_watch.exe" "C:\Users\AZTEKA\Videos\Merlin\scripts\start-cods\console_probe.cpp" /link /SUBSYSTEM:CONSOLE user32.lib
if errorlevel 1 exit /b %errorlevel%
cl /nologo /std:c++17 /utf-8 /W4 /O2 /MT /EHsc /DTEST_GAME=22 /Fo"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\test_hidden_mw2.obj" /Fe"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\test_hidden_mw2.exe" "C:\Users\AZTEKA\Videos\Merlin\scripts\start-cods\test_hidden.cpp" /link /SUBSYSTEM:WINDOWS advapi32.lib shell32.lib user32.lib ole32.lib
if errorlevel 1 exit /b %errorlevel%
cl /nologo /std:c++17 /utf-8 /W4 /O2 /MT /EHsc /DTEST_GAME=23 /Fo"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\test_hidden_mw3.obj" /Fe"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\test_hidden_mw3.exe" "C:\Users\AZTEKA\Videos\Merlin\scripts\start-cods\test_hidden.cpp" /link /SUBSYSTEM:WINDOWS advapi32.lib shell32.lib user32.lib ole32.lib
if errorlevel 1 exit /b %errorlevel%
exit /b 0
