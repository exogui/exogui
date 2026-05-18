!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; Skip the multiuser page — our ExoPathPage handles install location selection.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!ifndef BUILD_UNINSTALLER

Var ExoRootDir
Var ExoDialog
Var ExoLabel
Var ExoDirRequest
Var ExoBrowseBtn

!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  Page custom ExoPathPage_Show ExoPathPage_Leave
!macroend

!macro customInit
  ; Pre-populate ExoRootDir from an existing installation (registry-sourced $INSTDIR).
  ${If} $INSTDIR != ""
    ${GetBaseName} $INSTDIR $0
    StrCmp $0 "${APP_FILENAME}" 0 init_done
    ${GetParent} $INSTDIR $ExoRootDir
    IfFileExists "$ExoRootDir\Data\Platforms.xml" 0 clear_root
    IfFileExists "$ExoRootDir\eXo\*.*" init_done clear_root
    clear_root:
      StrCpy $ExoRootDir ""
    init_done:
  ${EndIf}
!macroend

; setInstallModePerUser (invoked when customInstallMode skips the multiuser page)
; overrides $INSTDIR with the AppData default. This dummy page's creation function
; restores our eXo project path and immediately aborts (invisible to the user).
!macro customPageAfterChangeDir
  Page custom RestoreInstDir ""
!macroend

Function RestoreInstDir
  StrCpy $INSTDIR "$ExoRootDir\exogui"
  Abort
FunctionEnd

Function ExoPathPage_Show
  nsDialogs::Create 1018
  Pop $ExoDialog
  ${If} $ExoDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 40u "Select the root folder of your eXo project (e.g. C:\eXoDOS, C:\eXoScummVM).$\r$\nExogui will be installed in an 'exogui' subfolder inside the selected folder."
  Pop $ExoLabel

  ${NSD_CreateDirRequest} 0 50u 78% 14u "$ExoRootDir"
  Pop $ExoDirRequest

  ${NSD_CreateBrowseButton} 80% 50u 20% 14u "Browse..."
  Pop $ExoBrowseBtn
  ${NSD_OnClick} $ExoBrowseBtn OnBrowseExoPath

  nsDialogs::Show
FunctionEnd

Function OnBrowseExoPath
  ${NSD_GetText} $ExoDirRequest $0
  nsDialogs::SelectFolderDialog "Select your eXo project folder" $0
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $ExoDirRequest $0
  ${EndIf}
FunctionEnd

Function ExoPathPage_Leave
  ${NSD_GetText} $ExoDirRequest $ExoRootDir

  ; Strip trailing backslash if present
  StrLen $0 $ExoRootDir
  StrCmp $0 0 require_path
  IntOp $0 $0 - 1
  StrCpy $1 $ExoRootDir 1 $0
  StrCmp $1 "\" 0 check_empty
  StrCpy $ExoRootDir $ExoRootDir $0

check_empty:
  StrCmp $ExoRootDir "" 0 validate
require_path:
  MessageBox MB_OK|MB_ICONEXCLAMATION "Please select your eXo project folder."
  Abort

validate:
  IfFileExists "$ExoRootDir\Data\Platforms.xml" 0 path_invalid
  IfFileExists "$ExoRootDir\eXo\*.*" path_valid path_invalid

path_valid:
  StrCpy $INSTDIR "$ExoRootDir\exogui"
  Return

path_invalid:
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "The selected folder does not appear to be a valid eXo project. Data\Platforms.xml or eXo directory was not found.$\r$\nInstall anyway?" IDYES do_force
  Abort
do_force:
  StrCpy $INSTDIR "$ExoRootDir\exogui"
  Return
FunctionEnd

!endif
