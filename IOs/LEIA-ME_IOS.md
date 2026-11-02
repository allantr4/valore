# Valore Financeiro - Versão Mobile iOS (iPhone / iPad) 🍏

Este diretório contém a versão mobile nativa para **Apple iOS (iPhone e iPad)** do **Valore - Gestão Financeira Inteligente**, baseada na arquitetura **Capacitor 6+** e com **100% de paridade contínua** com os ecossistemas Desktop (Windows) e Mobile (Android).

---

## 📁 Estrutura do Projeto

* `www/`: Aplicação web otimizada com suporte ao motor WKWebView da Apple, Safe Areas (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`), Dynamic Island e Notch.
* `www/core/`: Núcleo financeiro agnóstico (`financeService.js` e `storage.js` com persistência nativa via `@capacitor/preferences`).
* `ios/`: Projeto nativo oficial do Xcode:
  * `ios/App/App.xcworkspace`: Workspace principal do Xcode.
  * `ios/App/App.xcodeproj`: Projeto nativo Swift/Capacitor.
  * `ios/App/Podfile`: Dependências CocoaPods do iOS.
  * `ios/App/App/Assets.xcassets/`: Catálogo de ícones nativos (ícone oficial do Valore 1024x1024 aplicado).
  * `ios/App/App/Info.plist`: Metadados e permissões do aplicativo.
* `scripts/sync_from_desktop.js`: Script automatizado que sincroniza qualquer nova funcionalidade, correção ou tela do Desktop diretamente para o iOS.
* `capacitor.config.json`: Configurações nativas do app no ecossistema Apple (`com.valore.financeiro`).
* `Sincronizar com Desktop.bat`: Atalho em 1 clique para atualizar os arquivos web e sincronizar o projeto nativo do Xcode.

---

## 🔄 Como Sincronizar Alterações do Desktop

Sempre que fizer alterações no código do Desktop ou no Android, basta:
1. Dar um duplo clique em `Sincronizar com Desktop.bat`, ou
2. No terminal desta pasta, executar:
   ```bash
   npm run sync
   npm run cap:sync
   ```

---

## 🚀 Como Abrir e Executar o Projeto no Mac (Xcode)

### Pré-requisitos no Mac:
- Computador Apple com macOS
- Xcode instalado (disponível gratuitamente na Mac App Store)
- CocoaPods instalado (`sudo gem install cocoapods` no Terminal do Mac)

### Passo a Passo:
1. Abra o terminal na pasta `E:\Gestor Financeiro\IOs` (ou na cópia do projeto no Mac) e execute:
   ```bash
   npx cap open ios
   ```
   *(Ou dê um duplo clique no arquivo `ios/App/App.xcworkspace`)*
2. No Xcode:
   - No topo da janela, selecione o dispositivo de destino: um **Simulador iOS** (ex: *iPhone 16 Pro*) ou o seu **iPhone físico** conectado via cabo USB / Wi-Fi.
   - Em **Signing & Capabilities**, selecione seu **Team** (sua conta Apple ID / Apple Developer).
3. Clique no botão de **Play (Run)** para compilar e iniciar o aplicativo!

---

## 📲 Como Instalar em um iPhone Físico sem Conta Paga de Desenvolvedor

A Apple permite instalar aplicativos criados por você em até 3 iPhones pessoais gratuitamente:
1. Conecte seu iPhone ao Mac pelo cabo USB.
2. No iPhone, autorize a conexão ("Confiar neste computador").
3. No iPhone, vá em **Ajustes > Privacidade e Segurança > Modo de Desenvolvedor** e ative-o (o aparelho reiniciará).
4. No Xcode, em **Signing & Capabilities**, marque *"Automatically manage signing"* e faça login com seu Apple ID pessoal comum.
5. Selecione seu iPhone no topo do Xcode e clique no botão **Play (Run)**.
6. Na primeira inicialização, vá em **Ajustes > Geral > Gerenciamento de VPN e Dispositivo** no iPhone e clique em "Confiar no certificado". O app abrirá normalmente.

---

## ☁️ Compilação na Nuvem sem Mac Local (GitHub Actions CI/CD)

Caso você utilize apenas o Windows e queira compilar o arquivo instalador `.ipa` do iOS na nuvem, você pode usar um runner macOS gratuito do **GitHub Actions**.

### Exemplo de Workflow (`.github/workflows/build-ios.yml`):
```yaml
name: Build Valore iOS

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-14
    steps:
      - name: Checkout do Repositório
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Instalar Dependências e Sincronizar
        run: |
          cd IOs
          npm install
          npx cap sync ios

      - name: Compilar Projeto Xcode
        run: |
          cd IOs/ios/App
          xcodebuild -workspace App.xcworkspace -scheme App -sdk iphonesimulator -configuration Release CODE_SIGNING_ALLOWED=NO clean build
```

---

## 🛡️ Paridade e Arquitetura

O Valore iOS utiliza os mesmos motores de cálculo e estrutura:
- **Motor Financeiro:** `src/core/financeService.js` idêntico em todas as plataformas.
- **Banco de Dados / Armazenamento:** `storage.js` mapeado nativamente para `@capacitor/preferences`, garantindo persistência isolada e segura na sandbox do iOS (Keychain / UserDefaults).
- **Interface Responsiva:** CSS adaptado com tratamento de áreas seguras (`safe-area-inset`) para que botões inferiores e cabeçalhos fiquem perfeitamente posicionados sem sobrepor a barra de início (Home Indicator) ou a Dynamic Island.

