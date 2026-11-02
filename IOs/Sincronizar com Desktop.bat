@echo off
chcp 65001 > nul
echo ========================================================
echo   VALORE FINANCEIRO - SINCRONIZAÇÃO MOBILE iOS
echo ========================================================
echo.
cd /d "%~dp0"

echo 1. Sincronizando arquivos da interface e núcleo...
node scripts/sync_from_desktop.js

echo.
echo 2. Sincronizando com o projeto nativo iOS do Capacitor...
call npx cap sync ios

echo.
echo ========================================================
echo   Sincronização com iOS finalizada com sucesso!
echo ========================================================
pause

