@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cl /nologo /W4 /O2 /MT /EHsc /Fo"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\console_probe.obj" /Fe"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\console_probe.exe" "C:\Users\AZTEKA\Videos\Merlin\scripts\start-cods\console_probe.cpp" /link /SUBSYSTEM:CONSOLE user32.lib
if errorlevel 1 exit /b %errorlevel%
cl /nologo /std:c++17 /utf-8 /W4 /O2 /MT /EHsc /Fo"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\test_hidden.obj" /Fe"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\test_hidden.exe" "C:\Users\AZTEKA\Videos\Merlin\scripts\start-cods\test_hidden.cpp" /link /SUBSYSTEM:WINDOWS advapi32.lib shell32.lib user32.lib ole32.lib
exit /b %errorlevel%
