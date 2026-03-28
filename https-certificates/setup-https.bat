@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  WordPress Studio — HTTPS Setup Launcher
::  Runs setup-https-windows.ps1 with Administrator privileges
::
::  Usage:
::    Double-click setup-https.bat
::    OR from cmd: setup-https.bat webpage.com
:: ============================================================

:: ── Get domain from argument or prompt ──────────────────────
set "DOMAIN=%~1"

if "%DOMAIN%"=="" (
    echo.
    echo   WordPress Studio - HTTPS Setup
    echo   ================================
    echo.
    set /p "DOMAIN=  Enter your local domain (e.g. webpage.com): "
    echo.
)

if "%DOMAIN%"=="" (
    echo   [ERROR] No domain entered. Exiting.
    pause
    exit /b 1
)

:: ── Locate the PS1 script (same folder as this bat) ─────────
set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%setup-https-windows.ps1"

if not exist "%PS1%" (
    echo   [ERROR] Cannot find setup-https-windows.ps1
    echo   Make sure it is in the same folder as this .bat file:
    echo   %SCRIPT_DIR%
    echo.
    pause
    exit /b 1
)

:: ── Check if already running as Administrator ────────────────
net session >nul 2>&1
if %errorlevel% == 0 (
    goto :run_script
)

:: ── Not admin — re-launch self elevated via PowerShell ───────
echo   Requesting Administrator privileges...
echo   Please click YES on the UAC prompt.
echo.

powershell -NoProfile -Command ^
  "Start-Process cmd -ArgumentList '/c ""%~f0"" %DOMAIN%' -Verb RunAs"

exit /b 0

:: ── Run the PowerShell script ────────────────────────────────
:run_script
echo.
echo   Running HTTPS setup for: %DOMAIN%
echo   Script : %PS1%
echo.

powershell -NoProfile -ExecutionPolicy Bypass ^
  -File "%PS1%" ^
  -Domain "%DOMAIN%"

if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Script exited with error code %errorlevel%
    echo   Check the output above for details.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo   ========================================
echo    Done! Now restart the site in Studio.
echo   ========================================
echo.
pause
