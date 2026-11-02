# 🏗️ Arquitetura Técnica & Engenharia de Software - Valore

Este documento detalha as decisões de engenharia, os padrões arquiteturais e o fluxo de dados do ecossistema **Valore**.

---

## 1. Visão Arquitetural (Hexagonal / Clean Architecture)

O Valore foi projetado para desacoplar a lógica de domínio de qualquer tecnologia ou framework de apresentação:

```
+-------------------------------------------------------------------+
|                           UI LAYER                                |
|  - Desktop Electron Renderer (index.html, styles.css, app.js)     |
|  - Mobile Capacitor WebView (Android Safe Areas, Touch UX)        |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|                        CORE DOMAIN LAYER                          |
|  - FinanceService (Cálculos de precisão, fluxo, SAC/Price, FIRE)   |
|  - State Manager In-Memory (Estrutura única serializável em JSON) |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|                    STORAGE ADAPTERS (PORTS)                       |
|  - LocalStorageAdapter (Padrão Hexagonal / Interface Abstrata)    |
+-------------------------------------------------------------------+
               │                                      │
               ▼                                      ▼
+-----------------------------+        +----------------------------+
|   DESKTOP IPC ADAPTER       |        |   CAPACITOR NATIVE PREFS   |
|   - Electron Main Process   |        |   - SharedPreferences Java |
|   - Gravação Atômica Disco  |        |   - SQLite / LocalStorage  |
+-----------------------------+        +----------------------------+
```

### 1.1 Pure Domain (`src/core/financeService.js`)
- Não depende do DOM, nem de Node.js, nem de APIs proprietárias.
- Cálculos financeiros executados com utilitários de precisão monetária (`round2`), contornando imprecisões do padrão IEEE 754.
- Manipulação de datas no fuso local (`localDateStr`) para evitar desvios de UTC após as 21h no horário de Brasília.
- IDs únicos gerados com entropia síncrona contra colisões (`genId`).

### 1.2 Storage Port (`src/core/storage.js`)
- O `LocalStorageAdapter` detecta automaticamente o ambiente de execução em tempo de execução:
  1. Se `window.electronAPI` estiver presente: despacha para IPC seguro no processo principal do Electron.
  2. Se `window.Capacitor` estiver presente: grava via plugin de preferências nativas do Android.
  3. Fallback: `localStorage` padrão do navegador.

---

## 2. Processo Desktop (Electron Runtime)

Localizado em `src/main/`:

### 2.1 Isolamento de Contexto e Segurança
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` (onde aplicável)
- O arquivo `preload.js` expõe estritamente via `contextBridge` a API `window.electronAPI`:
  - `loadData()`: Leitura assíncrona da base de dados local.
  - `saveData(data)`: Gravação segura com retorno de status.
  - `onThemeChange(callback)`: Notificação reativa de alteração do tema do sistema operacional.

### 2.2 Estratégia de Gravação Atômica (Zero Data Loss)
Para eliminar qualquer risco de corrupção do arquivo JSON em caso de encerramento forçado do processo ou falta de energia:
1. Os dados recebidos são escritos em um arquivo temporário:
   `%APPDATA%\gestor-financeiro\financial_data.json.tmp`
2. O arquivo principal existente é duplicado para:
   `%APPDATA%\gestor-financeiro\financial_data.json.bak`
3. O arquivo temporário é renomeado atomicamente para o destino final:
   `%APPDATA%\gestor-financeiro\financial_data.json`
4. Se na inicialização o arquivo principal não for encontrado ou estiver ilegível, o sistema restaura o último estado íntegro do arquivo `.bak`.

---

## 3. Aplicação Mobile Android (Capacitor 6+)

Localizada em `Android/`:

### 3.1 Pipeline de Sincronização Contínua
- O script `Android/scripts/sync_from_desktop.js` copia o núcleo financeiro e a interface do diretório raiz para `Android/www/`.
- O arquivo `Android/Sincronizar com Desktop.bat` aciona a sincronização em tempo real.
- O arquivo `Android/Compilar APK Android.bat` dispara o build completo:
  ```
  npx cap copy android
  cd android
  gradlew.bat assembleDebug
  ```
- O arquivo APK gerado é disponibilizado em `Android/Valore.apk` e espelhado em `Instalador/Valore.apk`.

### 3.2 Otimizações de Tela e Safe Area
- Variáveis de ambiente CSS `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)` garantem que a interface respeite o entalhe (Notch) e a barra de navegação gestual dos aparelhos Android.
- A barra lateral transforma-se em gaveta móvel com backdrop e fechamento por toque ou botão intuitivo.

---

## 4. Instalador Nativo Windows (`src/installer/Installer.cs`)

O instalador é um executável C# compilado contra o .NET Framework 4.0 (presente nativamente em todos os sistemas operacionais Windows desde o Windows 7):

### 4.1 Características Técnicas
- **Self-Contained**: O payload da aplicação empacotada (`dist/Valore_Payload.zip`) e a logo em alta resolução são incorporados como recursos binários compilados (`/resource`).
- **Sem Dependências**: Não exige Inno Setup, NSIS ou instaladores pesados de terceiros.
- **Interface Dark Mode**: Janela sem bordas personalizada desenhada via GDI+ com cantos arredondados, gradientes e animações de progresso.
- **Integração com o Windows**:
  - Extração limpa para `%LOCALAPPDATA%\Programs\Valore` ou pasta customizada pelo usuário.
  - Criação de atalhos no Desktop e Menu Iniciar via Shell Script WScript COM.
  - Registro de desinstalação completo no registro do Windows:
    `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ValoreFinanceiro`
  - Permite desinstalação nativa com 1 clique pelo menu "Configurações > Aplicativos" do Windows.

---

## 5. Estrutura do Estado Financeiro (JSON Schema)

```typescript
interface FinancialState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  schedules: Schedule[];
  assets: Asset[];
  budgets: Budget[];
  goals: Goal[];
  vaults: Vault[];
  costCenters: CostCenter[];
  sideHustles: SideHustle[];
  firePlanning: FirePlanning;
  settings: {
    currency: "BRL";
    theme: "dark" | "light" | "auto";
    startDayOfMonth: number;
  };
}
```

Cada entidade possui propriedades normalizadas para rápida indexação, busca e serialização de alto desempenho.
