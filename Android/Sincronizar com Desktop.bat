@echo off
chcp 65001 > nul
echo ========================================================
echo   VALORE - SINCRONIZADOR DESKTOP -> MOBILE ANDROID
echo ========================================================
echo.
cd /d "%~dp0"
node scripts/sync_from_desktop.js
echo.
pause
