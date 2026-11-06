# Valore - Regras de Desenvolvimento e Manutenção

## Regra Obrigatória: Plano Detalhado de Implementação
Em toda e qualquer solicitação do usuário, você DEVE OBRIGATORIAMENTE gerar primeiro um plano detalhado de implementação para aprovação do usuário antes de executar quaisquer alterações definitivas no código.

## Regra Obrigatória: Atualização Automática do Instalador
Sempre que qualquer alteração de código, correção de bug, ajuste visual ou nova funcionalidade for finalizada no projeto do Valore, você DEVE OBRIGATORIAMENTE atualizar o Instalador oficial do aplicativo localizado em:
`E:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe`

### Procedimento de Atualização do Instalador:
1. Executar o empacotamento otimizado com electron-packager (ignorando pastas móveis e de scripts):
   `npx electron-packager . Valore --platform=win32 --arch=x64 --out=dist --overwrite --icon="src/ui/assets/Valore_Windows.ico" --prune=true --asar --ignore="^/(dist|Instalador|Android|IOs|scripts|\.git)"`
2. Gerar o payload comprimido `dist/Valore_Payload.zip` com o conteúdo de `dist/Valore-win32-x64/*`.
3. Compilar o instalador C# `src/installer/Installer.cs` utilizando o C# Compiler nativo do Windows:
   `& "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /win32icon:"e:\Gestor Financeiro\src\ui\assets\Valore_Windows.ico" /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /resource:"e:\Gestor Financeiro\dist\Valore_Payload.zip,payload.zip" /resource:"e:\Gestor Financeiro\src\ui\assets\logo_completo.png,logo.png" /out:"e:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe" "e:\Gestor Financeiro\src\installer\Installer.cs"`
4. Garantir que `Instalador Valore Financeiro.exe` e `Instalador_Valore_Financeiro_<versao>.exe` estejam disponíveis exclusivamente na pasta `E:\Gestor Financeiro\Instalador`.

## Regra Obrigatória: Paridade e Sincronização Contínua Desktop & Mobile Android
A partir de agora, qualquer nova funcionalidade, alteração de regras de negócio, correção de bug ou aprimoramento visual implementado no Valore Desktop DEVE OBRIGATORIAMENTE ser refletido, testado e sincronizado no aplicativo Mobile Android localizado em:
`E:\Gestor Financeiro\Android`

O Core financeiro (`financeService.js`), os adaptadores de armazenamento e a camada visual devem manter paridade total entre as plataformas Desktop e Android.

## Regra Obrigatória: Geração e Separação Estrita de Pastas (PC x Mobile Android)
1. **Pasta Exclusiva do PC (`E:\Gestor Financeiro\Instalador`)**:
   - Esta pasta armazena APENAS os instaladores executáveis do Windows (`.exe`).
   - É expressamente proibido duplicar ou copiar arquivos `.apk` para a pasta `Instalador`.
2. **Pasta Exclusiva do Mobile (`E:\Gestor Financeiro\Android`)**:
   - Esta pasta armazena o aplicativo móvel e os arquivos de distribuição Android:
     - `E:\Gestor Financeiro\Android\Valore.apk`
     - `E:\Gestor Financeiro\Android\Valore_<versao>.apk`

O APK para download direto deve permitir que o usuário envie o arquivo via WhatsApp, Google Drive ou cabo USB e instale no smartphone sem complicações.

## Regra Obrigatória: Análise Contínua e Testes de Enquadramento (Mobile & Desktop)
Em todo ajuste visual, criação ou refatoração de telas, componentes, formulários, modais, tabelas ou carrosséis, você DEVE OBRIGATORIAMENTE realizar uma análise e validação minuciosa de enquadramento e responsividade nos dois ambientes:
1. **Mobile Vertical (360px a 430px)**: Garantir que nenhum elemento estoure horizontalmente (`overflow-x: hidden`), botões de ação e rodapés fiquem 100% visíveis e confortáveis ao toque (ergonomia do polegar), e modais caibam na altura da tela respeitando safe areas e barras do sistema Android sem cortar ações primárias.
2. **Desktop & Modo Janela (800px a 1920px)**: Manter proporções harmoniosas, alinhamento flexível e ausência de scrolls horizontais acidentais ou quebras visuais desconexas.

## Regra Obrigatória: Testes e Validação Pré-Commit e Pré-Release
Antes de realizar qualquer `git commit`, criação de tag ou envio de release para o GitHub, você DEVE OBRIGATORIAMENTE executar e validar os seguintes testes de integridade:
1. **Validação Rigorosa de Sintaxe e Parsing:**
   Executar verificação com `node --check` ou `npm run test:verify` em todos os arquivos de script tocados (`src/ui/app.js`, `src/core/financeService.js`, `src/main/main.js`, `Android/www/app.js`, `IOs/www/app.js`).
2. **Teste de Inicialização e Integridade Estrutural:**
   Verificar se o ponto de entrada principal (`DOMContentLoaded` com chamada para `initApp()`), as chaves de fechamento de blocos e estruturas assíncronas (`try/catch/finally`) estão intactos e sem truncamentos.
3. **Auditoria Obrigatória de Enquadramento, Scrollbar & Ergonomia de UI:**
   Garantir a presença de scrollbar de alta visibilidade no `.main-content`, safe bottom clearance (`padding-bottom >= 4.5rem`), suporte a janelas compactas na vertical (`@media max-height`) e ausência de scrolls bloqueados.
4. **Validação Funcional Automatizada de Ponta a Ponta (E2E/DOM & Paridade de IDs):**
   Garantir que todos os componentes interativos, switches, botões, modais e formulários referenciados nos scripts existam com exatidão de IDs no HTML (`index.html`) e possuam as devidas classes CSS ativas e estilizadas em `styles.css`. O teste automatizado deve simular o chaveamento e validar a árvore DOM antes de liberar o commit.
5. **Fluxo de Correção Imediata:**
   Caso qualquer teste ou validação acuse erro ou inconformidade, você DEVE OBRIGATORIAMENTE corrigir o código imediatamente e rodar a bateria de testes novamente até que todos passem com 100% de sucesso (código de retorno 0).
6. **Liberação Somente com Sucesso:**
   É estritamente proibido realizar commit, gerar instalador ou publicar release enquanto houver qualquer pendência ou erro não sanado.


