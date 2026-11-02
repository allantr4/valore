@echo off
chcp 65001 > nul
echo ========================================================
echo   VALORE FINANCEIRO - GERADOR OFICIAL DE APK ANDROID
echo ========================================================
echo.

cd /d "%~dp0.."

echo [1/4] Sincronizando código atualizado do Desktop...
node scripts/sync_from_desktop.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao sincronizar arquivos do Desktop.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Verificando dependências do Capacitor Mobile...
if not exist "node_modules\@capacitor\core" (
    echo Instalando dependências nativas do Capacitor...
    call npm install
)

echo.
echo [3/4] Sincronizando assets com o projeto nativo Android...
call npx cap sync android

echo.
echo [4/5] Verificando ambiente Java JDK e Android SDK...

REM 1. Verifica ou localiza o JDK 17
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javac.exe" goto JAVA_FOUND
where javac >nul 2>nul
if %ERRORLEVEL% EQU 0 goto JAVA_FOUND

for /d %%D in ("C:\Program Files\Microsoft\jdk-17*") do (
    if exist "%%D\bin\javac.exe" (
        set "JAVA_HOME=%%D"
        set "PATH=%%D\bin;%PATH%"
        goto JAVA_FOUND
    )
)

echo [AVISO] Compilador Java (JDK 17) não foi encontrado no sistema.
echo Para instalar automaticamente pelo Windows, execute no terminal:
echo winget install Microsoft.OpenJDK.17
echo.
pause
exit /b 1

:JAVA_FOUND
echo ✔ Compilador Java detectado com sucesso: %JAVA_HOME%

REM 2. Verifica se o Android SDK está configurado
set "SDK_FOUND=0"
if defined ANDROID_HOME if exist "%ANDROID_HOME%" set "SDK_FOUND=1"
if exist "%LOCALAPPDATA%\Android\Sdk" (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    set "SDK_FOUND=1"
)
if exist "android\local.properties" set "SDK_FOUND=1"

if "%SDK_FOUND%"=="0" (
    echo.
    echo ========================================================
    echo   [AVISO] ANDROID SDK NÃO ENCONTRADO
    echo ========================================================
    echo Para gerar o arquivo .APK, o Windows precisa do Android SDK
    echo instalado no computador.
    echo.
    echo Como resolver em 1 passo:
    echo 1. Instale o Android Studio:
    echo    Execute: winget install Google.AndroidStudio
    echo    ou baixe em: https://developer.android.com/studio
    echo.
    echo 2. Abra o Android Studio uma vez para concluir a instalação do SDK.
    echo 3. Em seguida, dê 2 cliques neste mesmo script para gerar o APK!
    echo ========================================================
    echo.
    pause
    exit /b 0
)

echo.
echo [5/5] Compilando arquivo .APK nativo do Valore...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao compilar com Gradle Wrapper.
    pause
    exit /b %ERRORLEVEL%
)

cd ..

set "OUTPUT_APK=android\app\build\outputs\apk\debug\app-debug.apk"
set "DEST_APK=Valore.apk"
set "INSTALLER_APK=..\Instalador\Valore.apk"

if exist "%OUTPUT_APK%" (
    echo.
    echo -> Copiando APK para os diretórios oficiais de distribuição...
    copy /y "%OUTPUT_APK%" "%DEST_APK%" > nul
    copy /y "%OUTPUT_APK%" "%INSTALLER_APK%" > nul
    echo.
    echo ========================================================
    echo   ✔ APK OFICIAL GERADO COM SUCESSO!
    echo ========================================================
    echo Arquivos prontos para instalação direta no celular:
    echo 1. %CD%\%DEST_APK%
    echo 2. %CD%\%INSTALLER_APK%
    echo.
    echo Você pode enviar este arquivo via WhatsApp, Drive ou USB
    echo e instalar diretamente em qualquer smartphone Android!
) else (
    echo [AVISO] O processo concluiu mas o APK não foi encontrado em: %OUTPUT_APK%
)

echo.
pause
