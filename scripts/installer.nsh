!include "getProcessInfo.nsh"
Var pid

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

      ${If} $LANGUAGE == 1046
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "Merlin ja esta aberto.$\r$\nClique em OK para fechar o Merlin e continuar.$\r$\nSe ele nao fechar, feche o Merlin manualmente." /SD IDOK IDOK doStopProcess
      ${Else}
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "Merlin is already open.$\r$\nClick OK to close Merlin and continue.$\r$\nIf it doesn't close, close Merlin manually." /SD IDOK IDOK doStopProcess
      ${EndIf}
      Quit

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
          ${If} $LANGUAGE == 1046
            MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Nao foi possivel fechar o Merlin.$\r$\nFeche o Merlin manualmente e clique em Repetir para continuar." /SD IDCANCEL IDRETRY loop
          ${Else}
            MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Merlin could not be closed.$\r$\nClose Merlin manually and click Retry to continue." /SD IDCANCEL IDRETRY loop
          ${EndIf}
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
!macroend

!macro customInstall
  StrCpy $0 "$PROGRAMFILES32\Steam"

  ${If} ${FileExists} "$0\steam.exe"
    StrCpy $1 "0"

    ; Steam locks the OpenSteamTool files while it is running. Ask for consent before
    ; closing it, then verify that the process really stopped before copying.
    nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -Command "if (Get-Process steam -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"'
    Pop $2
    Pop $3

    ${If} $2 == "0"
      MessageBox MB_ICONEXCLAMATION|MB_OK "Steam is currently open. Merlin needs to close Steam for a moment to finish installing the required files. Click OK to continue. If Steam stays open, close it manually and try again."
      nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /F /T /IM steam.exe'
      Pop $2
      Pop $3
      Sleep 1500

      nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -Command "if (Get-Process steam -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"'
      Pop $2
      Pop $3
      ${If} $2 == "0"
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

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
      MessageBox MB_ICONEXCLAMATION|MB_OK "Merlin was installed, but the OpenSteamTool files could not be copied to the default Steam folder. Make sure Steam is closed and use Repair inside Merlin."
    ${EndIf}
  ${EndIf}
!macroend
