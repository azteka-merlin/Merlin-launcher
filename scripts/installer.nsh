!include "getProcessInfo.nsh"
Var pid
!ifndef BUILD_UNINSTALLER
Var steamInstallPath
!endif

!macro customCheckAppRunning
  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
    ${if} ${isUpdated}
      Sleep 300
    ${endIf}

    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 == 0
      ${if} ${isUpdated}
        Sleep 1000
        Goto doStopProcess
      ${endIf}

      doStopProcess:

      DetailPrint `Closing running "${PRODUCT_NAME}"...`

      !ifdef INSTALL_MODE_PER_ALL_USERS
        nsExec::Exec `taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid"`
      !else
        nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid" /fi "USERNAME eq %USERNAME%"`
      !endif
      Sleep 300

      StrCpy $R1 0

      loop:
        IntOp $R1 $R1 + 1

        !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          Sleep 1000
          !ifdef INSTALL_MODE_PER_ALL_USERS
            nsExec::Exec `taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid"`
          !else
            nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "PID ne $pid" /fi "USERNAME eq %USERNAME%"`
          !endif
          !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
          ${If} $R0 == 0
            DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
            Sleep 2000
          ${else}
            Goto not_running
          ${endIf}
        ${else}
          Goto not_running
        ${endIf}

        ${if} $R1 > 1
          DetailPrint 'Unable to close Merlin; stopping installation.'
          SetErrorLevel 1
          Quit
        ${else}
          Goto loop
        ${endIf}
      not_running:
    ${endIf}
  ${endIf}
!macroend

!macro customInit
  ; Per-machine installs must never continue without an elevated process.
  ; This also blocks any unexpected non-admin fallback after a denied UAC prompt.
  ${IfNot} ${UAC_IsAdmin}
    MessageBox MB_ICONSTOP|MB_OK "Administrator permission is required to install Merlin. The installation will now close."
    SetErrorLevel 740
    Quit
  ${EndIf}

  ; Resolve the Steam client itself, which can be installed on any drive.
  ReadRegStr $steamInstallPath HKCU "Software\Valve\Steam" "SteamPath"
  ${IfNot} ${FileExists} "$steamInstallPath\steam.exe"
    ReadRegStr $steamInstallPath HKLM "Software\WOW6432Node\Valve\Steam" "InstallPath"
  ${EndIf}
  ${IfNot} ${FileExists} "$steamInstallPath\steam.exe"
    StrCpy $steamInstallPath "$PROGRAMFILES32\Steam"
  ${EndIf}

  ; Shut down Steam before updating its DLLs. First let Steam exit normally,
  ; then terminate it if it has not closed in time.
  !insertmacro FIND_PROCESS "steam.exe" $R0
  ${If} $R0 == 0
    ${If} ${FileExists} "$steamInstallPath\steam.exe"
      Exec '"$steamInstallPath\steam.exe" -shutdown'
      Sleep 3000
    ${EndIf}
    !insertmacro FIND_PROCESS "steam.exe" $R0
    ${If} $R0 == 0
      nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /F /T /IM steam.exe'
      Pop $2
      Pop $3
      Sleep 1500
      !insertmacro FIND_PROCESS "steam.exe" $R0
      ${If} $R0 == 0
        DetailPrint 'Unable to close Steam; stopping installation.'
        SetErrorLevel 1
        Quit
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  StrCpy $0 "$steamInstallPath"

  ${If} ${FileExists} "$0\steam.exe"
    StrCpy $1 "0"

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\OpenSteamTool.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\OpenSteamTool.dll" "$0\OpenSteamTool.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\dwmapi.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\dwmapi.dll" "$0\dwmapi.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\xinput1_4.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\xinput1_4.dll" "$0\xinput1_4.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\merlin_cloud_redirect.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\merlin_cloud_redirect.dll" "$0\merlin_cloud_redirect.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\merlin-helper.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\merlin-helper.dll" "$0\merlin-helper.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "1"
      MessageBox MB_ICONEXCLAMATION|MB_OK "Merlin was installed, but the files could not be copied to the Steam folder. Make sure Steam is closed and use Repair inside Merlin."
    ${EndIf}
  ${EndIf}
!macroend
