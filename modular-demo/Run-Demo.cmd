@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install it from https://nodejs.org/ and retry.
  pause
  exit /b 1
)
cd /d "%~dp0"
if not exist "src\server.js" (
  echo The demo files are missing beside this script.
  echo Do not run Run-Demo.cmd from inside the ZIP preview.
  echo Right-click the ZIP, choose Extract All, then run this script from the extracted modular-demo folder.
  pause
  exit /b 1
)
node src/server.js
echo.
echo Keep this window open while using the demo. The server address is printed above.
pause
