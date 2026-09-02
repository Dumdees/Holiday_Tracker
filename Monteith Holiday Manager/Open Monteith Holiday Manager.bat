@echo off
rem Opens the Monteith Holiday Manager in a tidy app-style window (no address bar).
rem Tries Microsoft Edge, then Google Chrome. If neither is found it opens the app in your usual browser.
setlocal
set "APP=%~dp0Monteith Holiday Manager.html"
set "URL=file:///%APP:\=/%"
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if defined BROWSER (
  start "" "%BROWSER%" --app="%URL%"
) else (
  start "" "%APP%"
)
endlocal
