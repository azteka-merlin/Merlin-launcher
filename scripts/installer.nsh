!include "getProcessInfo.nsh"
!include "MUI2.nsh"
Var pid
!ifndef BUILD_UNINSTALLER
Var steamInstallPath
Var merlinServiceCheckbox
Var merlinServiceChoice
!include "nsDialogs.nsh"
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

!macro customPageAfterChangeDir
  !insertmacro skipPageIfUpdated
  Page custom MerlinOptionsPageCreate MerlinOptionsPageLeave
!macroend

!ifndef BUILD_UNINSTALLER
Function MerlinOptionsPageCreate
  !insertmacro MUI_HEADER_TEXT "Opções do Merlin" "O serviço auxiliar é obrigatório para instalar o Merlin."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0u 0u 100% 28u "O Merlin configura a pasta de jogos para você instalar, atualizar e remover jogos sem pedidos repetidos de permissão."
  Pop $0
  ${NSD_CreateCheckbox} 0u 36u 100% 18u "Instalar o serviço auxiliar do Merlin (obrigatório)"
  Pop $merlinServiceCheckbox
  ${NSD_Check} $merlinServiceCheckbox
  ${NSD_CreateLabel} 18u 56u 90% 28u "Necessário para preparar outras unidades e fechar jogos que o Windows bloquearia para o Launcher."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function MerlinOptionsPageLeave
  ${NSD_GetState} $merlinServiceCheckbox $merlinServiceChoice
  ${If} $merlinServiceChoice != ${BST_CHECKED}
    MessageBox MB_ICONEXCLAMATION|MB_OK "O serviço auxiliar é obrigatório para instalar o Merlin. Marque essa opção para continuar."
    Abort
  ${EndIf}
FunctionEnd
!endif

!macro customInit
  StrCpy $merlinServiceChoice ${BST_CHECKED}

  ${IfNot} ${UAC_IsAdmin}
    MessageBox MB_ICONSTOP|MB_OK "A instalação do Merlin precisa de permissão de administrador. O instalador será fechado."
    SetErrorLevel 740
    Quit
  ${EndIf}

  ; The Steam runtime DLLs are required by Merlin, so close Steam before install.
  ReadRegStr $steamInstallPath HKCU "Software\Valve\Steam" "SteamPath"
  ${IfNot} ${FileExists} "$steamInstallPath\steam.exe"
    ReadRegStr $steamInstallPath HKLM "Software\WOW6432Node\Valve\Steam" "InstallPath"
  ${EndIf}
  ${IfNot} ${FileExists} "$steamInstallPath\steam.exe"
    StrCpy $steamInstallPath "$PROGRAMFILES32\Steam"
  ${EndIf}

  Call MerlinEnsureSteamClosed
  ${If} $steamCloseReady != "1"
    MessageBox MB_ICONSTOP|MB_OK "A Steam precisa estar fechada para instalar os componentes necessários do Merlin. $steamCloseError"
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend

!macro customInstall
  SetShellVarContext all
  ; Configure only the default game root. The helper grants inherited Modify to
  ; the interactive user's SID and preserves the rest of the NTFS ACL.
  nsExec::ExecToStack '"$INSTDIR\resources\game-operations\MerlinGameOperationsService.exe" --configure-game-folders'
  Pop $0
  Pop $1
  ${If} $0 != 0
    ${If} ${isUpdated}
      DetailPrint "Could not refresh Merlin-games permissions ($0). See $APPDATA\Merlin\GameOperations\operations.log."
    ${Else}
      MessageBox MB_ICONSTOP|MB_OK "Não foi possível configurar permissões de Modificar para C:\Merlin-games. A instalação foi interrompida. Detalhes: $APPDATA\Merlin\GameOperations\operations.log"
      SetErrorLevel 1
      Quit
    ${EndIf}
  ${EndIf}

  ; The service is required for fresh installs and upgrades from older versions.
  nsExec::ExecToStack '"$INSTDIR\resources\game-operations\MerlinGameOperationsService.exe" --install-service'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "Falha ao instalar o serviço auxiliar obrigatório ($0). Consulte $APPDATA\Merlin\GameOperations\operations.log." /SD IDOK
    SetErrorLevel 1
    Quit
  ${Else}
    WriteRegDWORD HKLM "Software\Merlin\GameOperations" "ServiceEnabled" 1
  ${EndIf}

  ${If} ${FileExists} "$steamInstallPath\steam.exe"
    ; Steam may have reopened during extraction. Close it again before copying.
    Call MerlinEnsureSteamClosed
    ${If} $steamCloseReady != "1"
      MessageBox MB_ICONSTOP|MB_OK "A Steam não pôde ser fechada. Nenhum arquivo da Steam foi alterado. $steamCloseError"
      SetErrorLevel 1
      Quit
    ${EndIf}

    nsExec::ExecToStack '"$INSTDIR\resources\game-operations\MerlinGameOperationsService.exe" --install-steam-dlls "$steamInstallPath" "$INSTDIR\resources\dlls"'
    Pop $0
    Pop $1
    ${If} $0 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "O Merlin foi instalado, mas não foi possível copiar e verificar os componentes da Steam ($0). Consulte $APPDATA\Merlin\GameOperations\operations.log e use Verificar/Repair."
      WriteRegDWORD HKLM "Software\Merlin\GameOperations" "SteamIntegrationEnabled" 0
    ${Else}
      WriteRegDWORD HKLM "Software\Merlin\GameOperations" "SteamIntegrationEnabled" 1
    ${EndIf}
  ${EndIf}
  SetShellVarContext current
!macroend

!macro customUnInstall
  SetShellVarContext all
  ${IfNot} ${isUpdated}
    ReadRegDWORD $2 HKLM "Software\Merlin\GameOperations" "ServiceEnabled"
    ${If} $2 == 1
      nsExec::ExecToStack '"$APPDATA\Merlin\GameOperations\MerlinGameOperationsService.exe" --remove-service'
      Pop $0
      Pop $1
      ${If} $0 == 0
        Delete "$APPDATA\Merlin\GameOperations\MerlinGameOperationsService.exe"
        DeleteRegKey HKLM "Software\Merlin\GameOperations"
      ${Else}
        MessageBox MB_ICONEXCLAMATION|MB_OK "O serviço auxiliar do Merlin não pôde ser removido ($0). Consulte $APPDATA\Merlin\GameOperations\operations.log."
      ${EndIf}
    ${Else}
      DeleteRegKey HKLM "Software\Merlin\GameOperations"
    ${EndIf}
  ${EndIf}
  SetShellVarContext current
!macroend
