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
exit /b 1

:JAVA_FOUND
echo ✔ Compilador Java detectado com sucesso: %JAVA_HOME%

REM 2. Verifica Android SDK
if not defined ANDROID_HOME (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)
if defined ANDROID_HOME (
    echo ✔ Android SDK localizado em: %ANDROID_HOME%
)

echo.
echo [5/5] Compilando arquivo .APK nativo do Valore...
cd android

if exist "gradlew.bat" (
    call gradlew.bat assembleDebug
) else (
    echo [ERRO] gradlew.bat não encontrado no diretório android.
    exit /b 1
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha na compilação do Gradle. Verifique as mensagens acima.
    exit /b %ERRORLEVEL%
)

cd ..

set "OUTPUT_APK=android\app\build\outputs\apk\debug\app-debug.apk"
set "DEST_APK=Valore.apk"

if exist "%OUTPUT_APK%" (
    echo.
    echo -> Copiando APK para o diretório oficial Android...
    copy /y "%OUTPUT_APK%" "%DEST_APK%" > nul
    copy /y "%OUTPUT_APK%" "Valore_1.3.7.apk" > nul
    echo.
    echo ========================================================
    echo   ✔ APK OFICIAL GERADO COM SUCESSO!
    echo ========================================================
    echo Arquivos prontos para instalação direta no celular:
    echo 1. %CD%\%DEST_APK%
    echo 2. %CD%\Valore_1.3.7.apk
    echo.
    echo Você pode enviar este arquivo via WhatsApp, Drive ou USB
    echo e instalar diretamente em qualquer smartphone Android!
) else (
    echo [AVISO] O processo concluiu mas o APK não foi encontrado em: %OUTPUT_APK%
)

echo.
exit /b 0
