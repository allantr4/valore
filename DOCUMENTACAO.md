# 💎 Valore - Gestão Financeira Inteligente
## Manual Completo e Documentação Técnica do Sistema

---

### Sumário
1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Módulos e Funcionalidades](#3-módulos-e-funcionalidades)
   - [3.1 Visão Geral (Dashboard Consolidado)](#31-visão-geral-dashboard-consolidado)
   - [3.2 Transações e Parcelamentos](#32-transações-e-parcelamentos)
   - [3.3 Agendamentos e Contas a Pagar/Receber](#33-agendamentos-e-contas-a-pagarreceber)
   - [3.4 Fluxo de Caixa e Projeção Futura](#34-fluxo-de-caixa-e-projeção-futura)
   - [3.5 Bens, Veículos e Financiamentos](#35-bens-veículos-e-financiamentos)
   - [3.6 Metas Financeiras e Sonhos](#36-metas-financeiras-e-sonhos)
   - [3.7 Liberdade Financeira (FIRE)](#37-liberdade-financeira-fire)
   - [3.8 Orçamentos por Categoria](#38-orçamentos-por-categoria)
   - [3.9 Contas Bancárias, Cartões e Cofrinhos](#39-contas-bancárias-cartões-e-cofrinhos)
   - [3.10 Projetos, Viagens e Centros de Custo](#310-projetos-viagens-e-centros-de-custo)
   - [3.11 Renda Extra e Freelas](#311-renda-extra-e-freelas)
   - [3.12 Importação OFX / Excel e Exportação](#312-importação-ofx--excel-e-exportação)
4. [Design System e Temas](#4-design-system-e-temas)
5. [Plataformas Suportadas](#5-plataformas-suportadas)
   - [5.1 Desktop Windows (Electron + Instalador C#)](#51-desktop-windows-electron--instalador-c)
   - [5.2 Mobile Android (Capacitor 6+)](#52-mobile-android-capacitor-6)
6. [Persistência de Dados e Segurança](#6-persistência-de-dados-e-segurança)
7. [Guia de Manutenção e Sincronização](#7-guia-de-manutenção-e-sincronização)
8. [Perguntas Frequentes e Suporte](#8-perguntas-frequentes-e-suporte)

---

## 1. Visão Geral

O **Valore** é um ecossistema financeiro multiplataforma moderno, de alta performance e privacidade absoluta (**Offline-First / Zero-Cloud obrigatório**). O aplicativo foi construído com arquitetura modular desacoplada (**Clean Architecture / Hexagonal**), garantindo paridade perfeita e sincronizada entre as versões **Desktop (Windows)** e **Mobile (Android)**.

### Princípios Norteadores:
- **Privacidade Total**: Seus dados financeiros residem exclusivamente no seu dispositivo (disco local criptografado/atômico), sem envio para servidores de terceiros.
- **Visão Unificada PF / PJ**: Controle pessoal, profissional ou consolidado através de um seletor instantâneo.
- **Experiência Premium**: Design baseado em Glassmorphism, microinterações fluidas, paleta HSL balanceada e temas dinâmicos (Claro, Escuro e Automático sincronizado com o horário e sistema operacional).
- **Precisão Bancária**: Lógica de arredondamento imune a flutuações de ponto flutuante, regras de dias úteis CLT e cálculos financeiros SAC/Price.

---

## 2. Arquitetura do Sistema

A estrutura de código segue rigorosamente o princípio de inversão de dependência e responsabilidade única:

```
Gestor Financeiro/
├── src/
│   ├── core/                        # 🧠 NÚCLEO AGNÓSTICO DE PLATAFORMA
│   │   ├── financeService.js        # Regras de negócio, projeções, cálculos e estado
│   │   └── storage.js               # Adapter Pattern (Desktop / Web / Capacitor Mobile)
│   ├── main/                        # 💻 RUNTIME DESKTOP (Electron)
│   │   ├── main.js                  # Ciclo de vida Windows, single-instance, gravação atômica
│   │   └── preload.js               # ContextBridge seguro e canais IPC
│   ├── ui/                          # 🎨 INTERFACE DE USUÁRIO (Web Standards)
│   │   ├── index.html               # Estrutura modular semântica de todas as views
│   │   ├── styles.css               # Design System com variáveis CSS, Dark/Light Mode
│   │   ├── app.js                   # Controlador de UI, gráficos Chart.js e eventos
│   │   └── assets/                  # Ícones nativos, logos e vetores
│   └── installer/                   # ⚙️ INSTALADOR NATIVO WINDOWS
│       └── Installer.cs             # Instalador C# autônomo com interface Dark Mode
├── Android/                         # 📱 APLICAÇÃO MOBILE NATIVA ANDROID
│   ├── android/                     # Projeto nativo Android Studio / Gradle
│   ├── www/                         # Cópia sincronizada dos assets web e core
│   ├── scripts/                     # Scripts de sincronização contínua
│   ├── Compilar APK Android.bat     # Build em 1 clique do APK oficial
│   └── Valore.apk                   # APK gerado para distribuição direta
├── Instalador/                      # 📦 INSTALADOR DISTRIBUÍVEL WINDOWS
│   ├── Instalador Valore Financeiro.exe # Executável de instalação Windows oficial
│   └── Valore.apk                   # Cópia do APK Android oficial
└── docs/                            # 📚 DOCUMENTAÇÃO DETALHADA DO PROJETO
```

---

## 3. Módulos e Funcionalidades

### 3.1 Visão Geral (Dashboard Consolidado)
O coração da sua rotina financeira. Apresenta de forma resumida e elegante:
- **Cards de Indicadores de Topo com Raio-X Interativo (Drill-down em 1 clique)**:
  - Cada card conta com feedback tátil e visual (`🔍 Detalhar`). Ao clicar, abre o modal de Raio-X correspondente:
    - **Patrimônio Líquido Total**: Abre o balanço patrimonial completo (Ativos Líquidos em bancos e carteiras + Cofrinhos com rendimento CDI + Bens físicos com valor venal - Financiamentos amortizáveis e Faturas abertas de cartão).
    - **Receitas do Mês**: Mostra a origem detalhada do dinheiro por categorias (com barras percentuais), contas bancárias de destino e a lista completa de lançamentos com comparativo percentual em relação ao mês anterior (+% ou -%).
    - **Despesas do Mês**: Divide os gastos em despesas pagas vs boletos/faturas a vencer, categorização por impacto, métodos de pagamento utilizados e ranking das maiores compras do mês.
    - **Contas Pendentes**: Painel de vencimentos segregado em contas em atraso (com botão de quitação imediata em 1 clique), contas vencendo hoje e próximos compromissos do mês.
- **Gráfico de Evolução Financeira**: Linha do tempo visual do fluxo de entradas e saídas ao longo dos meses.
- **Gráfico de Distribuição por Categoria**: Gráfico de rosca/donut destacando onde o dinheiro está sendo gasto.
- **Cofrinhos e Reservas**: Visualização rápida das caixinhas com rendimento CDI e barra de progresso.
- **Filtro de Entidade (Consolidado / PF / PJ)**: Permite alternar instantaneamente para visualizar apenas as finanças pessoais, apenas as da empresa/MEI ou ambas consolidadas.

### 3.2 Transações e Parcelamentos
Gerenciamento de receitas, despesas e transferências com alto nível de detalhe:
- **Desdobramento de Parcelas Inteligente**: Ao registrar uma compra parcelada (ex: 12x no cartão de crédito), o Valore gera automaticamente as 12 parcelas distribuídas mês a mês, respeitando a melhor data de compra e o dia de fechamento da fatura.
- **Transferências entre Contas**: Movimentação entre bancos sem afetar a contabilização de receita ou despesa de consumo.
- **Categorização e Centros de Custo**: Vínculo a categorias personalizadas e projetos específicos (ex: Reforma da Cozinha).
- **Filtros e Busca em Tempo Real**: Localização imediata por descrição, período, categoria, conta ou valor.

### 3.3 Agendamentos e Contas a Pagar/Receber
Planejamento e controle de compromissos futuros:
- **Suporte ao 5º Dia Útil CLT**: Algoritmo que calcula precisamente o quinto dia útil de cada mês para salários, considerando sábados úteis bancários e feriados.
- **Sinalizadores de Status**:
  - 🔴 **Atrasado**: Contas vencidas não pagas, com destaque para evitar multas e juros.
  - 🟡 **Vence Hoje**: Notificação imediata das obrigações do dia.
  - 🔵 **Pendente**: Contas a vencer no período.
  - 🟢 **Concluído / Pago**: Histórico de obrigações liquidadas.
- **Quitação em 1 Clique**: Ao marcar uma conta agendada como paga, o sistema gera automaticamente a transação correspondente na conta bancária informada.

### 3.4 Fluxo de Caixa e Projeção Futura
Previsão analítica de liquidez para 30, 60, 90 ou 365 dias:
- **Curva de Saldo Dia a Dia**: Gráfico que projeta o saldo consolidado de todas as contas no futuro, levando em consideração agendamentos, faturas de cartão e parcelamentos.
- **Prevenção de Inadimplência**: Destaque de dias em que o saldo projetado poderá ficar negativo, permitindo remanejar recursos antes de entrar no cheque especial.

### 3.5 Bens, Veículos e Financiamentos
Acompanhamento do patrimônio imobilizado e dívidas de longo prazo:
- **Cadastro de Bens Físicos**: Casas, apartamentos, veículos, terrenos, computadores e equipamentos.
- **Cálculo de Amortização (SAC e Price)**: Controle de saldo devedor restante, parcelas pagas e juros embutidos em financiamentos habitacionais e automotivos.
- **Patrimônio Líquido do Bem**: Diferença calculada entre o valor de mercado venal atual e o saldo devedor remanescente.

### 3.6 Metas Financeiras e Sonhos
Transformação de objetivos de vida em planos realizáveis:
- Definição de valor alvo, prazo e categoria (Reserva de Emergência, Casamento, Intercâmbio, Carro Novo).
- Aportes mensais com indicador de ritmo e previsão de data de conclusão.
- Celebração visual ao atingir 100% da meta.

### 3.7 Liberdade Financeira (FIRE - Financial Independence, Retire Early)
Calculadora baseada na regra dos 4% e na teoria do Safe Withdrawal Rate (SWR):
- Configuração de **Idade Atual**, **Idade Desejada de Aposentadoria** e **Renda Mensal Passiva Alvo**.
- Simulação com taxa real líquida acima da inflação.
- Projeção do montante de patrimônio financeiro necessário para viver exclusivamente de renda passiva.

### 3.8 Orçamentos por Categoria
Controle orçamentário mensal preventivo:
- Definição de tetos de gastos por categoria (Alimentação, Lazer, Transporte, etc.).
- Acompanhamento visual de **Previsto vs Realizado**.
- Alertas progressivos em 80%, 100% e estouro orçamentário.

### 3.9 Contas Bancárias, Cartões e Cofrinhos
Gestão centralizada de todas as instituições financeiras:
- Suporte visual aos principais bancos do Brasil (Nubank, Itaú, Bradesco, Banco do Brasil, Caixa, Santander, Inter, C6 Bank, XP, BTG Pactual, Mercado Pago, PicPay, Sicoob, Sicredi, Safra, PagBank e Dinheiro Físico).
- **Cartões de Crédito**: Definição de limite total, dia de fechamento da fatura e dia de vencimento.
- **Cofrinhos / Caixinhas**: Separação de reservas de emergência e oportunidade, com cálculo de rendimento baseado no percentual do CDI e isolamento para evitar gastos acidentais.

### 3.10 Projetos, Viagens e Centros de Custo
Isolamento financeiro para projetos temporários:
- Agrupamento de receitas e despesas vinculadas a uma viagem, casamento, reforma residencial ou evento corporativo.
- Visão clara do custo real de cada iniciativa sem distorcer o custo de vida fixo mensal.

### 3.11 Renda Extra e Freelas
Apoio a profissionais liberais, autônomos e fontes secundárias de renda:
- Registro de projetos extras e horas dedicadas.
- Cálculo de rentabilidade real por hora de trabalho.
- Estimativa de retenções fiscais e impostos (DAS-MEI / Carnê-Leão).

### 3.12 Importação OFX / Excel e Exportação
Integração com bancos e ferramentas contábeis:
- **Importador OFX**: Leitura nativa de extratos bancários das principais instituições.
- **Planilhas Excel (XLSX / CSV)**: Importação e exportação de relatórios tabulares completos para declaração de IRPF ou conciliação contábil.

---

## 4. Design System e Temas

A interface do Valore foi construída em Vanilla CSS com Design Tokens modernos:
- **Modo Claro (Light)**: Tons neutros suaves (`#f8fafc`), cartões brancos com sombras sutis e tipografia em ardósia profunda (`#0f172a`).
- **Modo Escuro (Dark)**: Fundo escuro imersivo (`#0b1120`), cartões com efeito Glassmorphism (`rgba(30, 41, 59, 0.7)`), bordas refinadas e contrastes em conformidade com WCAG AA.
- **Modo Automático (Auto)**: Sincroniza com as preferências do SO (`prefers-color-scheme`) e conta com alternador inteligente baseado no relógio (tema escuro a partir das 18h e tema claro após as 06h).

---

## 5. Plataformas Suportadas

### 5.1 Desktop Windows (Electron + Instalador C#)
- **Executável Oficial**: `Instalador\Instalador Valore Financeiro.exe`
- **Tecnologias**: Electron 33, Node.js e C# (.NET Framework 4.0 nativo em todos os Windows 7/8/10/11 sem dependências externas).
- **Recursos Nacionais**:
  - Janela sem bordas personalizada com controles integrados.
  - Notificações nativas do Windows.
  - Bloqueio de instância única (Single Instance Lock).
  - Atalhos na Área de Trabalho e Menu Iniciar.
  - Desinstalador registrado no Painel de Controle do Windows.

### 5.2 Mobile Android (Capacitor 6+)
- **Arquivo Oficial de Distribuição**:
  - `Android\Valore.apk`
  - `Instalador\Valore.apk`
- **Tecnologias**: Capacitor 6, Android SDK 34 / Java 17, Gradle.
- **Recursos Mobile**:
  - Layout totalmente responsivo com suporte a Notch e Safe Areas.
  - Menu lateral retrátil com gestos e botão de fechar.
  - Navegação fluida adaptada ao toque de polegar.
  - Armazenamento em preferências locais do dispositivo.
  - Instalação direta sem necessidade de loja de aplicativos (sideloading via WhatsApp, Drive ou cabo).

---

## 6. Persistência de Dados e Segurança

A persistência do Valore adota o padrão **Gravação Atômica com Redundância Ativa**:
1. Ao salvar qualquer alteração, o sistema gera um arquivo temporário `financial_data.json.tmp`.
2. O arquivo atual é copiado para `financial_data.json.bak` como backup de segurança imediato.
3. O arquivo temporário é renomeado atomicamente para `financial_data.json`.
4. Caso ocorra uma queda brusca de energia ou interrupção no meio da gravação, o sistema detecta a falha e restaura automaticamente os dados a partir do backup `.bak`.
5. Os dados são mantidos localmente na pasta de usuário do sistema operacional (`%APPDATA%\gestor-financeiro` no Windows).

---

## 7. Guia de Manutenção e Sincronização

Conforme definido nas diretrizes oficiais do projeto (`AGENTS.md` e `GEMINI.md`):

### 7.1 Regra de Atualização do Instalador Windows
Sempre que qualquer alteração de código for finalizada, o instalador deve ser regerado com os seguintes comandos:
```powershell
# 1. Empacotar distribuição Electron
npx electron-packager . Valore --platform=win32 --arch=x64 --out=dist --overwrite --icon="src/ui/assets/Valore_Windows.ico" --prune=true --asar --ignore="^/(dist|Instalador)"

# 2. Compactar payload
Compress-Archive -Path "dist\Valore-win32-x64\*" -DestinationPath "dist\Valore_Payload.zip" -Force

# 3. Compilar executável do instalador em C#
& "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /win32icon:"e:\Gestor Financeiro\src\ui\assets\Valore_Windows.ico" /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /resource:"e:\Gestor Financeiro\dist\Valore_Payload.zip,payload.zip" /resource:"e:\Gestor Financeiro\src\ui\assets\logo_completo.png,logo.png" /out:"e:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe" "e:\Gestor Financeiro\src\installer\Installer.cs"
```

### 7.2 Regra de Sincronização e Geração do APK Android
1. Sincronizar as alterações da pasta Desktop para a pasta `Android\www`:
   Execute o arquivo `Android\Sincronizar com Desktop.bat`.
2. Compilar o arquivo `.apk`:
   Execute o arquivo `Android\Compilar APK Android.bat`.
3. Garantir a presença do arquivo compilado nos diretórios:
   - `Android\Valore.apk`
   - `Instalador\Valore.apk`

---

## 8. Perguntas Frequentes e Suporte

**1. Onde ficam salvos os meus dados financeiros?**  
No Windows, os dados ficam em `%APPDATA%\gestor-financeiro\financial_data.json`. No Android, ficam no armazenamento seguro isolado do aplicativo.

**2. Preciso de internet para usar o Valore?**  
Não. O Valore é 100% offline. Todos os cálculos, projeções e cadastros operam sem conexão de rede.

**3. Como transferir meus dados do computador para o celular?**  
Você pode exportar o arquivo de backup `.json` nas configurações do aplicativo no Desktop e importá-lo no celular, ou importar suas planilhas/extratos bancários OFX diretamente.

---
*Valore - Gestão Financeira Inteligente © 2026. Desenvolvido para máxima privacidade e excelência financeira.*
