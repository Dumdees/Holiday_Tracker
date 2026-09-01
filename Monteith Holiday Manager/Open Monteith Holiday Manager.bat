@echo off
rem Opens the Monteith Holiday Manager in a tidy app-style window (no address bar).
rem If Microsoft Edge is not found, it simply opens the app in your usual web browser.
setlocal
set "APP=%~dp0Monteith Holiday Manager.html"
set "URL=file:///%APP:\=/%"
set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if defined EDGE (
  start "" "%EDGE%" --app="%URL%"
) else (
  start "" "%APP%"
)
endlocal
