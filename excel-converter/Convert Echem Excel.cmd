@echo off
setlocal
set "PYTHONUTF8=1"
chcp 65001 >nul
if "%~1"=="" (
  powershell.exe -NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0converter-ui.ps1"
  exit /b
)
where py.exe >nul 2>&1
if not errorlevel 1 (
  py.exe -3 "%~dp0convert_excel.py" %*
  goto done
)
for %%V in (314 313 312 311 310 39) do (
  if exist "%LocalAppData%\Programs\Python\Python%%V\python.exe" (
    "%LocalAppData%\Programs\Python\Python%%V\python.exe" "%~dp0convert_excel.py" %*
    goto done
  )
)
python.exe "%~dp0convert_excel.py" %*
:done
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
