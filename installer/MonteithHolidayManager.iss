; Inno Setup script for the Monteith Holiday Manager.
; Builds a per-user installer (no administrator prompt) that copies the app folder,
; adds Desktop and Start menu icons that open the app in an app-style browser window,
; and registers an uninstaller. Build with: ISCC.exe /DAppVersion=1.0.0 installer\MonteithHolidayManager.iss

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppName "Monteith Holiday Manager"
#define AppPublisher "Monteith Personal Care"
#define AppFolder "..\Monteith Holiday Manager"
#define AppHtml "Monteith Holiday Manager.html"

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
UninstallDisplayIcon={app}\icon.ico
UninstallDisplayName={#AppName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ShowLanguageDialog=no
CloseApplications=no
ArchitecturesInstallIn64BitMode=x64compatible

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
Source: "{#AppFolder}\{#AppHtml}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#AppFolder}\READ ME FIRST.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#AppFolder}\Open Monteith Holiday Manager.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; When Microsoft Edge or Google Chrome is present, the icons open the app in its own window.
Name: "{autoprograms}\{#AppName}"; Filename: "{code:BrowserPath}"; Parameters: "--app=""{code:AppUrl}"""; IconFilename: "{app}\icon.ico"; Comment: "Plan carers' holidays"; Check: BrowserFound
Name: "{autodesktop}\{#AppName}"; Filename: "{code:BrowserPath}"; Parameters: "--app=""{code:AppUrl}"""; IconFilename: "{app}\icon.ico"; Comment: "Plan carers' holidays"; Tasks: desktopicon; Check: BrowserFound
; Otherwise the icons open the app in whatever browser is the default.
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppHtml}"; IconFilename: "{app}\icon.ico"; Comment: "Plan carers' holidays"; Check: NoBrowserFound
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppHtml}"; IconFilename: "{app}\icon.ico"; Comment: "Plan carers' holidays"; Tasks: desktopicon; Check: NoBrowserFound
Name: "{autoprograms}\Read me first"; Filename: "{app}\READ ME FIRST.txt"
Name: "{autoprograms}\Remove {#AppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{code:BrowserPath}"; Parameters: "--app=""{code:AppUrl}"""; Description: "Open {#AppName} now"; Flags: postinstall nowait skipifsilent; Check: BrowserFound
Filename: "{app}\{#AppHtml}"; Description: "Open {#AppName} now"; Flags: postinstall nowait skipifsilent shellexec; Check: NoBrowserFound

[Code]
{ Find Microsoft Edge (on every modern Windows) or Google Chrome. Returns '' if neither exists. }
function FindBrowser(): String;
var
  Paths: TStringList;
  I: Integer;
begin
  Result := '';
  Paths := TStringList.Create;
  try
    Paths.Add(ExpandConstant('{commonpf32}\Microsoft\Edge\Application\msedge.exe'));
    if IsWin64 then Paths.Add(ExpandConstant('{commonpf64}\Microsoft\Edge\Application\msedge.exe'));
    Paths.Add(ExpandConstant('{localappdata}\Microsoft\Edge\Application\msedge.exe'));
    Paths.Add(ExpandConstant('{commonpf32}\Google\Chrome\Application\chrome.exe'));
    if IsWin64 then Paths.Add(ExpandConstant('{commonpf64}\Google\Chrome\Application\chrome.exe'));
    Paths.Add(ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe'));
    for I := 0 to Paths.Count - 1 do
      if FileExists(Paths[I]) then
      begin
        Result := Paths[I];
        exit;
      end;
  finally
    Paths.Free;
  end;
end;

function BrowserFound(): Boolean;
begin
  Result := FindBrowser() <> '';
end;

function NoBrowserFound(): Boolean;
begin
  Result := FindBrowser() = '';
end;

function BrowserPath(Param: String): String;
begin
  Result := FindBrowser();
end;

{ file:///C:/Users/Jo/AppData/Local/Programs/Monteith Holiday Manager/Monteith Holiday Manager.html }
function AppUrl(Param: String): String;
var
  P: String;
begin
  P := ExpandConstant('{app}\{#AppHtml}');
  StringChangeEx(P, '\', '/', True);
  Result := 'file:///' + P;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    MsgBox('{#AppName} has been removed. Your holiday records are kept by your web browser, so they will still be there if you install it again.', mbInformation, MB_OK);
end;
