# 💎 Valore - Gestão Financeira Inteligente

[![Plataforma Desktop](https://img.shields.io/badge/Desktop-Windows%2010%20%7C%2011-0078D6?logo=windows&logoColor=white)](file:///e:/Gestor%20Financeiro/Instalador/Instalador%20Valore%20Financeiro.exe)
[![Plataforma Mobile](https://img.shields.io/badge/Mobile-Android%20APK-3DDC84?logo=android&logoColor=white)](file:///e:/Gestor%20Financeiro/Android/Valore.apk)
[![Arquitetura](https://img.shields.io/badge/Architecture-Clean%20%2F%20Hexagonal-6366F1)](file:///e:/Gestor%20Financeiro/docs/ARQUITETURA_TECNICA.md)
[![Privacidade](https://img.shields.io/badge/Privacidade-100%25%20Offline%20%26%20Local-10B981)](#-privacidade-e-segurança-absolutas)

> O ecossistema financeiro definitivo para quem busca controle rigoroso de receitas, despesas, cartões, financiamentos, metas e independência financeira — com privacidade total, funcionamento 100% offline e paridade completa entre **Desktop (Windows)** e **Mobile (Android)**.

---

## 📑 Documentação do Projeto

Para informações completas e detalhadas, consulte os manuais oficiais:

- 📘 [**Documentação Geral do Sistema (DOCUMENTACAO.md)**](file:///e:/Gestor%20Financeiro/DOCUMENTACAO.md): Visão completa, índice funcional, plataformas e políticas de manutenção.
- 📖 [**Manual do Usuário (MANUAL_DO_USUARIO.md)**](file:///e:/Gestor%20Financeiro/docs/MANUAL_DO_USUARIO.md): Passo a passo para cadastrar contas, parcelar compras, gerenciar cofrinhos e simular aposentadoria.
- 🏗️ [**Arquitetura Técnica (ARQUITETURA_TECNICA.md)**](file:///e:/Gestor%20Financeiro/docs/ARQUITETURA_TECNICA.md): Engenharia de software, Clean Architecture, IPC Electron, Capacitor Android e persistência atômica.

---

## ✨ Principais Funcionalidades

- **Dashboard Consolidado & Seletor PF / PJ**: Alterne a qualquer momento entre finanças pessoais, profissionais ou visão integrada.
- **Transações & Parcelamentos Inteligentes**: Distribuição automática de parcelas futuras no cartão de crédito conforme o fechamento da fatura.
- **Agendamentos & Contas a Pagar/Receber**: Cálculo automático do **5º dia útil CLT** e alertas visuais de contas atrasadas ou a vencer.
- **Fluxo de Caixa & Projeção Futura**: Curva diária de saldo projetado para 30, 60, 90 e 365 dias, prevenindo cheques especiais.
- **Bens, Financiamentos & Amortização**: Acompanhamento de imóveis e veículos com cálculo de saldo devedor por tabelas **SAC** e **Price**.
- **Metas & Sonhos**: Planejamento de objetivos com aporte mensal e acompanhamento percentual com previsão de conclusão.
- **Liberdade Financeira (O Norte / Movimento FIRE)**: Simulador de independência financeira com base na taxa segura de retirada (SWR).
- **Orçamentos Mensais por Categoria**: Limites de gastos previstos vs realizados com alertas de 80% e 100%.
- **Cofrinhos & Reservas (Caixinhas)**: Separação de capital com rendimento diário atrelado ao CDI e segurança contra consumo indevido.
- **Centros de Custo (Projetos & Viagens)**: Controle financeiro isolado para reformas, casamentos, viagens ou eventos.
- **Renda Extra & Freela**: Módulo para calcular a rentabilidade real por hora trabalhada em projetos secundários.
- **Importação OFX / Excel**: Leitura de extratos bancários e planilhas em massa, além de exportação para Excel.
- **Temas Inteligentes**: Suporte a modo **Escuro**, **Claro** e **Automático** (com alternância por horário e pelo SO).

---

## 🚀 Como Executar ou Instalar

### 🖥️ No Windows (Desktop)

#### Opção A: Executar em Modo de Desenvolvimento
```bash
# Instalar dependências
npm install

# Iniciar o aplicativo
npm start
```

#### Opção B: Instalar via Instalador Oficial
Execute o instalador oficial de distribuição gerado em:
- [**Instalador Valore Financeiro.exe**](file:///e:/Gestor%20Financeiro/Instalador/Instalador%20Valore%20Financeiro.exe)

---

### 📱 No Celular Android

O aplicativo Android pode ser instalado diretamente sem lojas:
1. Copie o arquivo [**Valore.apk**](file:///e:/Gestor%20Financeiro/Instalador/Valore.apk) para o celular (via WhatsApp, Google Drive ou Cabo USB).
2. Toque no arquivo no smartphone e confirme a instalação.
3. Aproveite o Valore com navegação fluida por gestos e safe areas otimizadas.

---

## 🔒 Privacidade e Segurança Absolutas

- **Zero Cloud Obrigatório**: Seus dados nunca saem do seu computador ou smartphone.
- **Gravação Atômica com Redundância**: O Valore grava os dados em arquivos temporários e mantém backup automático (`.bak`) a cada salvamento, impedindo qualquer perda de dados por queda de energia ou desligamento repentino.

---

## 🛠️ Manutenção e Compilação

Para compilar e empacotar o projeto respeitando as regras de paridade contínua:

### 1. Atualização do Instalador Windows
```powershell
npx electron-packager . Valore --platform=win32 --arch=x64 --out=dist --overwrite --icon="src/ui/assets/Valore_Windows.ico" --prune=true --asar --ignore="^/(dist|Instalador)"
Compress-Archive -Path "dist\Valore-win32-x64\*" -DestinationPath "dist\Valore_Payload.zip" -Force
& "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /win32icon:"e:\Gestor Financeiro\src\ui\assets\Valore_Windows.ico" /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /resource:"e:\Gestor Financeiro\dist\Valore_Payload.zip,payload.zip" /resource:"e:\Gestor Financeiro\src\ui\assets\logo_completo.png,logo.png" /out:"e:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe" "e:\Gestor Financeiro\src\installer\Installer.cs"
```

### 2. Sincronização e Build do Android
- Execute: `Android\Sincronizar com Desktop.bat`
- Execute: `Android\Compilar APK Android.bat`

---
*Valore - Gestão Financeira Inteligente © 2026. Todos os direitos reservados.*
