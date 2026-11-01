@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
rc /nologo /fo "C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\start_cod23.res" "C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\start_cod23.rc"
if errorlevel 1 exit /b %errorlevel%
cl /nologo /std:c++17 /utf-8 /EHsc /O2 /MT /W4 /D COD_GAME=23 /D COD_SP=0 /Fo"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\start_cod23.obj" "C:\Users\AZTEKA\Videos\Merlin\scripts\start-cods\launcher.cpp" "C:\Users\AZTEKA\Videos\Merlin\cods-launchers\build\start_cod23.res" /link /SUBSYSTEM:WINDOWS /MACHINE:X64 /OUT:"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\dist\start_cod23.exe" advapi32.lib shell32.lib user32.lib ole32.lib
if errorlevel 1 exit /b %errorlevel%
mt /nologo -manifest "C:\Users\AZTEKA\Videos\Merlin\scripts\start-cods\launcher.manifest" -outputresource:"C:\Users\AZTEKA\Videos\Merlin\cods-launchers\dist\start_cod23.exe;#1"
exit /b %errorlevel%
