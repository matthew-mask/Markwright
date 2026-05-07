; NSIS include for Markwright.
; - Copies the mw.cmd CLI shim next to the installed exe.
; - Drops the markwright Claude Code skill into %USERPROFILE%\.claude\skills\.
; - Appends install dir to user PATH (idempotent; HKCU\Environment, no admin needed).

!include "WinMessages.nsh"
!include "LogicLib.nsh"
!include "StrFunc.nsh"
${StrStr}

; StrFunc emits its install-scope helper into the uninstaller too, where it's
; unused and triggers warning 6010. electron-builder treats warnings as errors.
!pragma warning disable 6010

!macro customInstall
  ; --- 1. CLI shim ---
  CopyFiles /SILENT "$INSTDIR\resources\mw.cmd" "$INSTDIR\mw.cmd"

  ; --- 2. Claude Code skill (best-effort; skip silently if profile path inaccessible) ---
  CreateDirectory "$PROFILE\.claude\skills"
  CopyFiles /SILENT "$INSTDIR\resources\markwright.md" "$PROFILE\.claude\skills\markwright.md"

  ; --- 3. PATH (user scope, idempotent) ---
  ReadRegStr $R0 HKCU "Environment" "Path"
  ; Wrap haystack and needle with semicolons for safe boundary search.
  ${StrStr} $R2 ";$R0;" ";$INSTDIR;"
  ${If} $R2 == ""
    ${If} $R0 == ""
      WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
    ${Else}
      WriteRegExpandStr HKCU "Environment" "Path" "$R0;$INSTDIR"
    ${EndIf}
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$INSTDIR\mw.cmd"
  Delete "$PROFILE\.claude\skills\markwright.md"
  ; PATH entry is left alone on uninstall — Windows ignores missing dirs in PATH.
!macroend
