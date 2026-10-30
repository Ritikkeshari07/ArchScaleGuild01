@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set SUPABASE_TELEMETRY_DISABLED=1
echo Starting the local Supabase stack. Docker Desktop must be running.
supabase start
if errorlevel 1 (
  echo.
  echo Supabase could not start. Open Docker Desktop, wait for it to show Running, then try again.
  pause
  exit /b 1
)
if not exist .env.local (
  echo.
  echo Copy the Project URL and Publishable key shown above.
  set /p SUPABASE_URL=Project URL [http://127.0.0.1:54321]:
  if "!SUPABASE_URL!"=="" set SUPABASE_URL=http://127.0.0.1:54321
  set /p SUPABASE_PUBLISHABLE_KEY=Publishable key:
  if "!SUPABASE_PUBLISHABLE_KEY!"=="" (
    echo A publishable key is required.
    pause
    exit /b 1
  )
  >.env.local echo SUPABASE_URL=!SUPABASE_URL!
  >>.env.local echo SUPABASE_PUBLISHABLE_KEY=!SUPABASE_PUBLISHABLE_KEY!
)
node scripts/start-supabase-pilot.mjs
pause
