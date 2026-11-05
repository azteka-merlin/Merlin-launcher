!ifndef MERLIN_STEAM_SHUTDOWN_INCLUDED
!define MERLIN_STEAM_SHUTDOWN_INCLUDED
!include "LogicLib.nsh"
!ifndef BUILD_UNINSTALLER
Var steamCloseReady
Var steamCloseError

; Custom includes are compiled before electron-builder defines FIND_PROCESS.
; Use the plugin directly, retaining its distinct absent/error return codes.
!ifmacrondef MerlinFindSteam
!macro MerlinFindSteam OUTPUT
  nsProcess::_FindProcess /NOUNLOAD "steam.exe"
  Pop ${OUTPUT}
!macroend
!endif

; electron-builder registers its plugin directory AFTER loading custom includes.
; Emit this function through customHeader, after plugins become available.
!macro customHeader
; The caller resolves steamInstallPath. Preserve the installer's scratch registers.
; nsProcess: 0 = found, 603 = absent. Every other value is an inspection error.
Function MerlinEnsureSteamClosed
  Push $R0
  Push $R1
  Push $2
  Push $3
  StrCpy $steamCloseReady "0"
  StrCpy $steamCloseError ""
  !insertmacro MerlinFindSteam $R0
  ${If} $R0 == 603
    StrCpy $steamCloseReady "1"
    Goto merlin_steam_close_done
  ${ElseIf} $R0 != 0
    StrCpy $steamCloseError "Process inspection failed ($R0)."
    Goto merlin_steam_close_done
  ${EndIf}

  DetailPrint "Closing Steam before updating its files..."
  ${If} ${FileExists} "$steamInstallPath\steam.exe"
    Exec '"$steamInstallPath\steam.exe" -shutdown'
  ${EndIf}
  StrCpy $R1 0
  merlin_steam_wait_normal:
    Sleep 500
    !insertmacro MerlinFindSteam $R0
    ${If} $R0 == 603
      StrCpy $steamCloseReady "1"
      Goto merlin_steam_close_done
    ${ElseIf} $R0 != 0
      StrCpy $steamCloseError "Process inspection failed ($R0)."
      Goto merlin_steam_close_done
    ${EndIf}
    IntOp $R1 $R1 + 1
    ${If} $R1 < 6
      Goto merlin_steam_wait_normal
    ${EndIf}

  nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /F /T /IM steam.exe'
  Pop $2
  Pop $3
  StrCpy $steamCloseError "Steam did not exit (taskkill=$2)."
  StrCpy $R1 0
  merlin_steam_wait_forced:
    Sleep 250
    !insertmacro MerlinFindSteam $R0
    ${If} $R0 == 603
      StrCpy $steamCloseReady "1"
      StrCpy $steamCloseError ""
      Goto merlin_steam_close_done
    ${ElseIf} $R0 != 0
      StrCpy $steamCloseError "Process inspection failed ($R0)."
      Goto merlin_steam_close_done
    ${EndIf}
    IntOp $R1 $R1 + 1
    ${If} $R1 < 12
      Goto merlin_steam_wait_forced
    ${EndIf}

  merlin_steam_close_done:
  Pop $3
  Pop $2
  Pop $R1
  Pop $R0
FunctionEnd
!macroend
!endif
!endif
