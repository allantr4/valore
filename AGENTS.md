# Valore - Regras de Desenvolvimento e Manutenção

## Regra Obrigatória: Plano Detalhado de Implementação
Em toda e qualquer solicitação do usuário, você DEVE OBRIGATORIAMENTE gerar primeiro um plano detalhado de implementação para aprovação do usuário antes de executar quaisquer alterações definitivas no código.

## Regra Obrigatória: Atualização Automática do Instalador
Sempre que qualquer alteração de código, correção de bug, ajuste visual ou nova funcionalidade for finalizada no projeto do Valore, você DEVE OBRIGATORIAMENTE atualizar o Instalador oficial do aplicativo localizado em:
`E:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe`

### Procedimento de Atualização do Instalador:
1. Executar o empacotamento com electron-packager:
   `npx electron-packager . Valore --platform=win32 --arch=x64 --out=dist --overwrite --icon="src/ui/assets/Valore_Windows.ico" --prune=true --asar --ignore="^/(dist|Instalador)"`
2. Gerar o payload comprimido `dist/Valore_Payload.zip` com o conteúdo de `dist/Valore-win32-x64/*`.
3. Compilar o instalador C# `src/installer/Installer.cs` utilizando o C# Compiler nativo do Windows:
   `& "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /win32icon:"e:\Gestor Financeiro\src\ui\assets\Valore_Windows.ico" /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /resource:"e:\Gestor Financeiro\dist\Valore_Payload.zip,payload.zip" /resource:"e:\Gestor Financeiro\src\ui\assets\logo_completo.png,logo.png" /out:"e:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe" "e:\Gestor Financeiro\src\installer\Installer.cs"`
4. Garantir que `Instalador Valore Financeiro.exe` esteja atualizado e disponível para distribuição.

## Regra Obrigatória: Paridade e Sincronização Contínua Desktop & Mobile Android
A partir de agora, qualquer nova funcionalidade, alteração de regras de negócio, correção de bug ou aprimoramento visual implementado no Valore Desktop DEVE OBRIGATORIAMENTE ser refletido, testado e sincronizado no aplicativo Mobile Android localizado em:
`E:\Gestor Financeiro\Android`

O Core financeiro (`financeService.js`), os adaptadores de armazenamento e a camada visual devem manter paridade total entre as plataformas Desktop e Android.

## Regra Obrigatória: Geração do Arquivo .APK para Instalação Direta
Sempre que o aplicativo for atualizado ou compilado, deve-se gerar e disponibilizar o arquivo `.apk` oficial pronto para instalação direta no celular Android nos seguintes locais:
- `E:\Gestor Financeiro\Android\Valore.apk`
- `E:\Gestor Financeiro\Instalador\Valore.apk`

O APK para download direto deve permitir que o usuário envie o arquivo via WhatsApp, Google Drive ou cabo USB e instale no smartphone sem complicações.

## Regra Obrigatória: Análise Contínua e Testes de Enquadramento (Mobile & Desktop)
Em todo ajuste visual, criação ou refatoração de telas, componentes, formulários, modais, tabelas ou carrosséis, você DEVE OBRIGATORIAMENTE realizar uma análise e validação minuciosa de enquadramento e responsividade nos dois ambientes:
1. **Mobile Vertical (360px a 430px)**: Garantir que nenhum elemento estoure horizontalmente (`overflow-x: hidden`), botões de ação e rodapés fiquem 100% visíveis e confortáveis ao toque (ergonomia do polegar), e modais caibam na altura da tela respeitando safe areas e barras do sistema Android sem cortar ações primárias.
2. **Desktop & Modo Janela (800px a 1920px)**: Manter proporções harmoniosas, alinhamento flexível e ausência de scrolls horizontais acidentais ou quebras visuais desconexas.

