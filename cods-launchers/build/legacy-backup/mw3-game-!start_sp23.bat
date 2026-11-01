@echo off
set "params=%*"
set "vbs=%~dp0getadmin.vbs"
cd /d "%~dp0"
if exist "%vbs%" del "%vbs%"
fsutil dirty query %systemdrive% >nul 2>nul || (
    echo Set UAC = CreateObject^("Shell.Application"^) : UAC.ShellExecute "%~s0", "%params%", "", "runas", 1 >> "%vbs%"
    "%vbs%"
	del "%vbs%"
    exit /B
)

set DRIVERNAME=atvi-sigrun_sr_offline
set EXENAME=sp23-cod.exe
set DIRNAME=sp23

sc query %DRIVERNAME% >nul 2>&1
if %errorlevel%==0 (
	echo AC already installed as %DRIVERNAME%
    goto startgame
) else (
    goto install_ac_driver
)

:install_ac_driver
sc.exe create %DRIVERNAME% type= kernel binPath="%CD%\Randgrid.sys"
sc.exe sdset %DRIVERNAME% D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWRPWPLOCRRC;;;IU)(A;;CCLCSWLOCRRC;;;SU)S:(AU;FA;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;WD)
echo AC installed as %DRIVERNAME%

:startgame
if not exist %DIRNAME%\bootstrapper.exe (
	copy bootstrapper.exe %DIRNAME%\bootstrapper.exe >nul
	copy bootstrapperCrashHandler.exe %DIRNAME%\bootstrapperCrashHandler.exe >nul
)
cd %DIRNAME%
echo Keep this window open to avoid issues!
bootstrapper.exe %EXENAME%
set BOOTSTRAPPERERRORLEVEL=%errorlevel%
sc.exe delete %DRIVERNAME%
taskkill /f /im bootstrapperCrashHandler.exe >nul 2>&1
del bootstrapper.exe
del bootstrapperCrashHandler.exe
if not %BOOTSTRAPPERERRORLEVEL%==0 (
echo.
echo Failed to launch the game, check %DIRNAME%\bootstrapper.log!
pause
exit
)
rd /s /q %APPDATA%\r4v3n_steam_files
timeout 1
exit
