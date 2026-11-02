# Valore Financeiro - Versão Mobile Android 📱

Este diretório contém a versão mobile nativa para Android do **Valore - Gestão Financeira Inteligente**, baseada na arquitetura **Capacitor 6+** e com **paridade contínua total** com o sistema Desktop Windows.

---

## Estrutura do Projeto

* `www/`: Aplicação web otimizada para smartphones (HTML5, CSS3 responsivo com Safe Areas, Lucide Icons, Chart.js e XLSX).
* `www/core/`: Núcleo financeiro agnóstico (`financeService.js` e `storage.js`).
* `scripts/sync_from_desktop.js`: Script automatizado que sincroniza qualquer alteração feita no Desktop para a versão Mobile.
* `capacitor.config.json`: Configurações nativas do aplicativo (`com.valore.financeiro`).
* `Compilar APK Android.bat`: Script em 1 clique para sincronizar, instalar dependências e gerar a base do projeto nativo Gradle/Android.
* `Sincronizar com Desktop.bat`: Atalho para sincronizar imediatamente as últimas alterações visuais e regras de negócio.

---

## Como Gerar o Aplicativo e Instalar no Celular

### Opção 1: Via Android Studio (Recomendado para Debug e APK Oficial)
1. Dê um duplo clique em `Compilar APK Android.bat` para sincronizar os arquivos.
2. No terminal dentro desta pasta, execute:
   ```bash
   npx cap open android
   ```
3. O **Android Studio** será aberto com o projeto nativo.
4. Conecte o seu celular Android via cabo USB (com a "Depuração USB" ativada) ou use um emulador.
5. Clique no botão verde de **Play (Run)** para instalar o Valore diretamente no seu celular.
6. Para gerar o arquivo `.apk` independente para enviar via WhatsApp/Drive:
   No Android Studio, vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

### Opção 2: Compilação Direta via Linha de Comando (Gradle)
Se você já tiver o Android SDK / Java JDK configurado no Windows:
```bash
cd android
.\gradlew.bat assembleDebug
```
O arquivo APK gerado estará em:
`android\app\build\outputs\apk\debug\app-debug.apk`

---

## Regra Obrigatória: Geração do Arquivo .APK para Instalação Direta
Conforme estabelecido nas regras oficiais do projeto (`AGENTS.md` e `GEMINI.md`):
> **Toda e qualquer atualização no Valore deve gerar e disponibilizar o arquivo oficial `Valore.apk` pronto para envio e instalação direta em smartphones Android nos seguintes diretórios:**
> 1. `E:\Gestor Financeiro\Android\Valore.apk`
> 2. `E:\Gestor Financeiro\Instalador\Valore.apk`

---

## Como Obter o APK para Instalação no Celular:
1. Basta executar o script:
   `Compilar APK Android.bat`
2. O script sincroniza todas as alterações recentes e compila automaticamente o arquivo:
   `Valore.apk`
3. Você pode enviar este arquivo via **WhatsApp, Google Drive ou Cabo USB** e clicar nele no seu celular Android para instalar diretamente!
