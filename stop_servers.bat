@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Walmus Pharma ERP - Stopping Services
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Stop reported an error with exit code %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%
