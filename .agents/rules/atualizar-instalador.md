# Regra Obrigatória: Atualização Automática do Instalador do Valore

## Diretriz
SEMPRE que qualquer alteração de código, correção de bug, refinamento visual ou nova funcionalidade for implementada no aplicativo **Valore - Gestão Financeira** (seja em `src/`, `index.html`, `app.js`, `financeService.js`, etc.), o assistente de IA **DEVE OBRIGATORIAMENTE** atualizar o instalador executável oficial localizado em:
`E:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe`

## Fluxo Obrigatório de Atualização:
1. Concluir e testar as alterações de código no projeto.
2. Sincronizar as alterações em `dist/FinancasPro-win32-x64/resources/app/` e empacotar a versão mais recente com `npx electron-packager . Valore --platform=win32 --arch=x64 --out=dist --overwrite --icon="src/ui/assets/Valore_Windows.ico" --prune=true --asar`.
3. Compactar o pacote gerado (`dist/Valore-win32-x64/*`) para `dist/Valore_Payload.zip`.
4. Recompilar o executável do instalador com o C# Compiler:
   ```powershell
   & "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /win32icon:"e:\Gestor Financeiro\src\ui\assets\Valore_Windows.ico" /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /resource:"e:\Gestor Financeiro\dist\Valore_Payload.zip,payload.zip" /resource:"e:\Gestor Financeiro\src\ui\assets\logo_completo.png,logo.png" /out:"e:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe" "e:\Gestor Financeiro\src\installer\Installer.cs"
   ```
5. Confirmar que o arquivo `Instalador Valore Financeiro.exe` foi gerado com sucesso.
