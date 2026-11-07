@echo off
title Liberar Conexao Wi-Fi - Valore Sincronizacao
echo ====================================================
echo    Liberando Porta de Sincronizacao do Valore
echo ====================================================
echo.
netsh advfirewall firewall delete rule name="Valore Sync Server" >nul 2>&1
netsh advfirewall firewall add rule name="Valore Sync Server" dir=in action=allow protocol=TCP localport=45454-45460 profile=any
echo.
if %errorlevel% equ 0 (
    echo [SUCESSO] Porta 45454 liberada no Firewall para Wi-Fi e rede local!
    echo Agora os celulares podem sincronizar com o PC na mesma rede Wi-Fi.
) else (
    echo [AVISO] Execute este arquivo clicando com o BOTAO DIREITO e "Executar como administrador".
)
echo.
pause

