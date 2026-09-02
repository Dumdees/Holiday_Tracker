; Inno Setup script for the Monteith Holiday Manager.
; Installs the app (a small Windows program that shows the single-file app in its own window)
; for the current user – no administrator prompt – with Desktop and Start menu icons and an uninstaller.
; The release workflow assembles ..\dist\Monteith Holiday Manager\ first, then runs:
;   ISCC.exe /DAppVersion=1.1.0 installer\MonteithHolidayManager.iss

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppName "Monteith Holiday Manager"
#define AppPublisher "Monteith Personal Care"
#define AppExe "Monteith Holiday Manager.exe"
#define DistFolder "..\dist\Monteith Holiday Manager"
#define WebView2Bootstrapper "MicrosoftEdgeWebview2Setup.exe"

[Setup]
AppId={{7E1D4C0B-5B3E-4B7E-9C1A-2F6B8D3A9E10}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=Monteith-Holiday-Manager-Setup-{#AppVersion}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ShowLanguageDialog=no
CloseApplications=yes
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel1=Welcome to the {#AppName} setup
WelcomeLabel2=This will put {#AppName} on your computer and add an icon to your Desktop and Start menu.%n%nNothing is sent over the internet – everything you enter stays on this computer.%n%nClick Next to continue.
FinishedHeadingLabel=All done
FinishedLabel={#AppName} is ready. You will find it on your Desktop and in the Start menu.

[Tasks]
Name: "desktopicon"; Description: "Put an icon on the Desktop"; GroupDescription: "Shortcuts:"

[Files]
Source: "{#DistFolder}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#WebView2Bootstrapper}"; Flags: dontcopy

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; Comment: "Plan carers' holidays"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Comment: "Plan carers' holidays"; Tasks: desktopicon
Name: "{autoprograms}\Read me first"; Filename: "{app}\READ ME FIRST.txt"
Name: "{autoprograms}\Remove {#AppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#AppExe}"; Description: "Open {#AppName} now"; Flags: postinstall nowait skipifsilent

[Code]
const
  WebView2ClientKey = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2ClientKey64 = 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2ClientKeyUser = 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function VersionPresent(Root: Integer; const Key: String): Boolean;
var
  V: String;
begin
  Result := RegQueryStringValue(Root, Key, 'pv', V) and (V <> '') and (V <> '0.0.0.0');
end;

{ The Edge WebView2 component is part of Windows 11 and up-to-date Windows 10, but not guaranteed. }
function WebView2Installed(): Boolean;
begin
  Result := VersionPresent(HKLM32, WebView2ClientKey) or VersionPresent(HKCU, WebView2ClientKeyUser);
  if (not Result) and IsWin64 then
    Result := VersionPresent(HKLM64, WebView2ClientKey64) or VersionPresent(HKLM64, WebView2ClientKey);
end;

{ .NET Framework 4.8 has been part of Windows 10 since 2019 and of every Windows 11. }
function DotNet48Installed(): Boolean;
var
  Release: Cardinal;
begin
  Result := RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full', 'Release', Release) and (Release >= 528040);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not DotNet48Installed() then
  begin
    MsgBox('This computer needs a Windows update before {#AppName} can be installed.' + #13#10#13#10 +
           'Please run Windows Update, restart, and then run this setup again.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if (CurStep = ssPostInstall) and (not WebView2Installed()) then
  begin
    WizardForm.StatusLabel.Caption := 'Adding a Windows component the app needs (this can take a minute)...';
    ExtractTemporaryFile('{#WebView2Bootstrapper}');
    if not Exec(ExpandConstant('{tmp}\{#WebView2Bootstrapper}'), '/silent /install', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
      MsgBox('The Microsoft Edge WebView2 component could not be added automatically. ' +
             'Please make sure the computer is connected to the internet and run this setup again.', mbInformation, MB_OK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    MsgBox('{#AppName} has been removed. Your holiday records are kept safe on this computer and will still be there if you install it again.', mbInformation, MB_OK);
end;
