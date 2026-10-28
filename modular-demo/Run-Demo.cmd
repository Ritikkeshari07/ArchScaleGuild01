@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install it from https://nodejs.org/ and retry.
  pause
  exit /b 1
)
cd /d "%~dp0"
node src/server.js
echo.
echo Keep this window open while using the demo. The server address is printed above.
pause
