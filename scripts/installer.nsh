!include "getProcessInfo.nsh"
Var pid
!ifndef BUILD_UNINSTALLER
Var steamInstallPath
Var steamCopyFile
Var steamCopyError
!endif

!include "${__FILEDIR__}\steam-shutdown.nsh"

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

  Call MerlinEnsureSteamClosed
  ${If} $steamCloseReady != "1"
    MessageBox MB_ICONSTOP|MB_OK "Steam could not be closed. No Steam files were changed. $steamCloseError"
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend

!macro customInstall
  ; Extraction and uninstall can take time. Steam may have reopened since .onInit.
  ; Check again at the actual copy boundary, after the old Merlin has been closed.
  Call MerlinEnsureSteamClosed
  ${If} $steamCloseReady != "1"
    MessageBox MB_ICONSTOP|MB_OK "Merlin was installed, but Steam could not be closed. No Steam files were changed. $steamCloseError"
    SetErrorLevel 1
    Quit
  ${EndIf}
  StrCpy $0 "$steamInstallPath"

  ${If} ${FileExists} "$0\steam.exe"
    StrCpy $1 "0"

    ${If} $1 == "0"
      StrCpy $steamCopyFile "OpenSteamTool.dll"
      StrCpy $steamCopyError "2"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\OpenSteamTool.dll"
        System::Call 'kernel32::CopyFileW(w "$INSTDIR\resources\dlls\OpenSteamTool.dll", w "$0\OpenSteamTool.dll", i 0) i.r2 ?e'
        Pop $steamCopyError
        ${If} $2 == 0
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      StrCpy $steamCopyFile "dwmapi.dll"
      StrCpy $steamCopyError "2"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\dwmapi.dll"
        System::Call 'kernel32::CopyFileW(w "$INSTDIR\resources\dlls\dwmapi.dll", w "$0\dwmapi.dll", i 0) i.r2 ?e'
        Pop $steamCopyError
        ${If} $2 == 0
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      StrCpy $steamCopyFile "xinput1_4.dll"
      StrCpy $steamCopyError "2"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\xinput1_4.dll"
        System::Call 'kernel32::CopyFileW(w "$INSTDIR\resources\dlls\xinput1_4.dll", w "$0\xinput1_4.dll", i 0) i.r2 ?e'
        Pop $steamCopyError
        ${If} $2 == 0
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      StrCpy $steamCopyFile "merlin_cloud_redirect.dll"
      StrCpy $steamCopyError "2"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\merlin_cloud_redirect.dll"
        System::Call 'kernel32::CopyFileW(w "$INSTDIR\resources\dlls\merlin_cloud_redirect.dll", w "$0\merlin_cloud_redirect.dll", i 0) i.r2 ?e'
        Pop $steamCopyError
        ${If} $2 == 0
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      StrCpy $steamCopyFile "merlin-helper.dll"
      StrCpy $steamCopyError "2"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\merlin-helper.dll"
        System::Call 'kernel32::CopyFileW(w "$INSTDIR\resources\dlls\merlin-helper.dll", w "$0\merlin-helper.dll", i 0) i.r2 ?e'
        Pop $steamCopyError
        ${If} $2 == 0
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "1"
      FileOpen $2 "$INSTDIR\merlin-steam-install.log" w
      FileWrite $2 "File: $steamCopyFile$\r$\nWindows error: $steamCopyError$\r$\nSteam: $steamInstallPath$\r$\n"
      FileClose $2
      MessageBox MB_ICONEXCLAMATION|MB_OK "Merlin could not copy $steamCopyFile to Steam. Windows error: $steamCopyError.$\r$\nDetails: $INSTDIR\merlin-steam-install.log$\r$\nUse Repair inside Merlin after resolving the error."
    ${EndIf}
  ${EndIf}
!macroend
