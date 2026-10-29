@echo off
setlocal
cd /d "%~dp0"
echo Starting the source-based Echem Plot Studio package...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_source_package.ps1"
set "APP_EXIT=%ERRORLEVEL%"
if not "%APP_EXIT%"=="0" (
  echo.
  echo Startup failed. Error code: %APP_EXIT%
  echo Copy the error above if you need assistance.
  pause
)
exit /b %APP_EXIT%
