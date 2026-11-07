const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, 'manual_assets');
const logoPath = path.join(__dirname, '../src/ui/assets/logo_completo.png');
const appIconPath = path.join(__dirname, '../src/ui/assets/Valore_128.png');

function toBase64(filePath) {
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).replace('.', '');
    const data = fs.readFileSync(filePath).toString('base64');
    return `data:image/${ext};base64,${data}`;
  }
  return '';
}

const logoBase64 = toBase64(logoPath);
const appIconBase64 = toBase64(appIconPath);
const pcCardBase64 = toBase64(path.join(assetsDir, 'pc_server_card.png'));
const mobileCardBase64 = toBase64(path.join(assetsDir, 'mobile_sync_card.png'));
const backupFilesBase64 = toBase64(path.join(assetsDir, 'backup_files_card.png'));
const mobileFullBase64 = toBase64(path.join(assetsDir, 'mobile_full_view.png'));

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Manual de Sincronização - Valore Gestor Financeiro</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f19;
      color: #e2e8f0;
      font-size: 9.5pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 100%;
      min-height: 275mm;
      max-height: 275mm;
      position: relative;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      padding-bottom: 2mm;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 12px;
    }

    .logo-badge {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-img {
      height: 30px;
      width: auto;
      object-fit: contain;
    }

    .app-tag {
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(99, 102, 241, 0.18);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.4);
      padding: 3px 8px;
      border-radius: 6px;
    }

    .header-doc-info {
      text-align: right;
    }

    .header-doc-title {
      font-size: 8.5pt;
      font-weight: 700;
      color: #94a3b8;
    }

    .header-version {
      font-size: 7pt;
      color: #64748b;
    }

    /* FOOTER */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 7pt;
      color: #64748b;
      margin-top: auto;
    }

    .footer-highlight {
      color: #10b981;
      font-weight: 600;
    }

    /* TYPOGRAPHY */
    h1 {
      font-size: 16pt;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-bottom: 4px;
    }

    h2 {
      font-size: 11.5pt;
      font-weight: 800;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }

    h3 {
      font-size: 9.5pt;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 3px;
    }

    p {
      color: #cbd5e1;
      margin-bottom: 6px;
      font-size: 8.5pt;
      line-height: 1.4;
    }

    /* CARDS & CONTAINERS */
    .card {
      background: rgba(30, 41, 59, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }

    .card-accent {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(15, 23, 42, 0.7));
      border: 1px solid rgba(99, 102, 241, 0.35);
    }

    .card-success {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.7));
      border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .card-warning {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(15, 23, 42, 0.7));
      border: 1px solid rgba(245, 158, 11, 0.35);
    }

    /* DIAGRAM */
    .flow-diagram {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px;
      background: rgba(15, 23, 42, 0.85);
      border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.25);
      margin: 10px 0;
    }

    .node {
      flex: 1;
      text-align: center;
      padding: 8px 6px;
      border-radius: 8px;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .node-hub {
      flex: 1.25;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(16, 185, 129, 0.2));
      border: 1.5px solid #38bdf8;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
    }

    .node-title {
      font-size: 8pt;
      font-weight: 800;
      color: #f8fafc;
      margin-top: 2px;
    }

    .node-subtitle {
      font-size: 6.8pt;
      color: #94a3b8;
    }

    .node-icon {
      font-size: 16pt;
      line-height: 1;
    }

    .arrow-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }

    .arrow-label {
      font-size: 6.5pt;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
      margin-bottom: 2px;
    }

    .arrow-icon {
      font-size: 12pt;
      color: #38bdf8;
      font-weight: 900;
    }

    /* STEPS */
    .step-box {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
      align-items: flex-start;
    }

    .step-number {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      color: #ffffff;
      font-weight: 900;
      font-size: 8pt;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
    }

    .step-number.green {
      background: linear-gradient(135deg, #10b981, #059669);
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
    }

    .step-content {
      flex: 1;
    }

    .step-title {
      font-size: 9pt;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 2px;
    }

    .step-desc {
      font-size: 8pt;
      color: #cbd5e1;
      line-height: 1.35;
    }

    /* SCREENSHOT DISPLAY */
    .print-frame {
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: #0f172a;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      margin: 6px 0;
      text-align: center;
    }

    .print-frame img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }

    .print-caption {
      font-size: 7pt;
      font-weight: 600;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.95);
      padding: 4px 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .badge-pill {
      font-size: 6.5pt;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-green {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .badge-blue {
      background: rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.4);
    }

    .badge-amber {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    /* 2 COLUMNS LAYOUT */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 8px;
    }

    .grid-2-align {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 12px;
      align-items: center;
    }

    /* TABLE */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin: 6px 0;
    }

    th {
      background: rgba(30, 41, 59, 0.9);
      color: #f1f5f9;
      font-weight: 700;
      text-align: left;
      padding: 5px 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    }

    td {
      padding: 5px 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      color: #cbd5e1;
    }

    tr:nth-child(even) td {
      background: rgba(255, 255, 255, 0.02);
    }

    .highlight-box {
      background: rgba(16, 185, 129, 0.1);
      border-left: 3px solid #10b981;
      padding: 6px 10px;
      border-radius: 0 6px 6px 0;
      margin: 6px 0;
      font-size: 7.8pt;
    }

    .highlight-box b {
      color: #34d399;
    }

    .key-tag {
      display: inline-block;
      font-family: monospace;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.1);
      padding: 1px 4px;
      border-radius: 3px;
      color: #f8fafc;
      font-size: 7.5pt;
    }
  </style>
</head>
<body>

  <!-- ========================================== -->
  <!-- PÁGINA 1: ARQUITETURA E CONCEITO GERAL     -->
  <!-- ========================================== -->
  <div class="page">
    <div>
      <div class="header">
        <div class="logo-badge">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Valore">` : `<span style="font-weight:900; font-size:14pt; color:#38bdf8;">VALORE</span>`}
          <span class="app-tag">Guia Oficial do Usuário</span>
        </div>
        <div class="header-doc-info">
          <div class="header-doc-title">Manual de Sincronização e Compartilhamento</div>
          <div class="header-version">Edição Casal & Família • Rede Wi-Fi Local & Offline</div>
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <span class="badge-pill badge-blue" style="margin-bottom: 4px; display: inline-block;">Privacidade Máxima • Sem Nuvem de Terceiros</span>
        <h1>Como Funciona a Sincronização no Valore</h1>
        <p style="font-size: 9pt;">
          O Valore foi desenvolvido para garantir que seus dados financeiros sejam <b>estritamente seus</b>. 
          Não utilizamos servidores externos na nuvem que cobram mensalidades ou acessam o seu extrato. 
          Toda a sincronização ocorre diretamente dentro da sua rede <b>Wi-Fi doméstica</b> ou através de <b>arquivos blindados</b>.
        </p>
      </div>

      <!-- DIAGRAMA VISUAL DE FLUXO -->
      <div class="card card-accent" style="margin-bottom: 12px; padding: 10px 14px;">
        <h2 style="font-size: 10.5pt; color: #38bdf8; margin-bottom: 6px;">
          <span>🌐</span> A Dinâmica entre os Celulares e o Computador
        </h2>
        <p style="font-size: 8.2pt; color: #94a3b8; margin-bottom: 10px;">
          Por regras de segurança dos sistemas Android e iOS, smartphones não conseguem criar servidores diretos entre si. 
          Por isso, o <b>computador (PC) atua como a Ponte Segura (Hub)</b> que une os dois aparelhos:
        </p>

        <div class="flow-diagram">
          <!-- Celular Esposa -->
          <div class="node">
            <div class="node-icon">📱</div>
            <div class="node-title">Celular da Esposa</div>
            <div class="node-subtitle">Lança uma despesa</div>
          </div>

          <!-- Seta 1 -->
          <div class="arrow-container">
            <div class="arrow-label">1. Envia ao PC</div>
            <div class="arrow-icon">➔</div>
          </div>

          <!-- PC Hub -->
          <div class="node node-hub">
            <div class="node-icon">💻</div>
            <div class="node-title">Valore no Computador (PC)</div>
            <div class="node-subtitle">Servidor Local Ativo (Porta 45454)</div>
            <div style="margin-top: 4px;">
              <span class="badge-pill badge-green">Smart Merge Unifica Tudo</span>
            </div>
          </div>

          <!-- Seta 2 -->
          <div class="arrow-container">
            <div class="arrow-label">2. Recebe Tudo</div>
            <div class="arrow-icon">➔</div>
          </div>

          <!-- Seu Celular -->
          <div class="node">
            <div class="node-icon">📱</div>
            <div class="node-title">Seu Celular</div>
            <div class="node-subtitle">Puxa a base atualizada</div>
          </div>
        </div>
      </div>

      <!-- SMART MERGE: COMO OS DADOS SÃO TRATADOS -->
      <div class="grid-2">
        <div class="card card-success" style="padding: 10px;">
          <h3 style="color: #34d399; display: flex; align-items: center; gap: 5px;">
            <span>🛡️</span> O que é o Smart Merge?
          </h3>
          <p style="font-size: 8pt; margin-top: 4px;">
            O Valore <b>nunca apaga os lançamentos de um celular</b> para colocar os do outro. 
            O motor inteligente compara os IDs e horários de cada registro:
          </p>
          <ul style="padding-left: 14px; font-size: 7.8pt; color: #cbd5e1; line-height: 1.4;">
            <li>Lançamentos novos da esposa são <b>adicionados</b> ao seu celular.</li>
            <li>Seus lançamentos novos são <b>adicionados</b> ao celular dela.</li>
            <li>Edições feitas em categorias ou valores são <b>atualizadas</b> sem duplicar.</li>
          </ul>
        </div>

        <div class="card card-warning" style="padding: 10px;">
          <h3 style="color: #fbbf24; display: flex; align-items: center; gap: 5px;">
            <span>⚡</span> Resumo do porquê não sincronizou hoje
          </h3>
          <p style="font-size: 8pt; margin-top: 4px;">
            Para os dois celulares conversarem através da rede Wi-Fi:
          </p>
          <ul style="padding-left: 14px; font-size: 7.8pt; color: #cbd5e1; line-height: 1.4;">
            <li>O <b>Valore no PC precisa estar aberto</b> enquanto sincronizam.</li>
            <li>Ambos os celulares precisam ter feito o <b>emparelhamento via QR Code pelo menos 1 vez</b>.</li>
            <li>Caso o PC esteja desligado, usa-se a <b>Opção 2 (Arquivo no WhatsApp)</b>.</li>
          </ul>
        </div>
      </div>

      <!-- CHECKLIST VISUAL RÁPIDO -->
      <div class="highlight-box">
        <b>💡 Regra Prática para o Casal:</b> Quando sua esposa fizer novos lançamentos no celular dela, 
        basta abrir o Valore no PC por alguns segundos. O celular dela descarrega os dados no PC e o seu celular puxa tudo automaticamente!
      </div>
    </div>

    <div class="footer">
      <span>Valore Gestão Financeira • Manual de Uso & Sincronização</span>
      <span>Página 1 de 4</span>
    </div>
  </div>


  <!-- ======================================================== -->
  <!-- PÁGINA 2: MÉTODO 1 - SINCRONIZAÇÃO WI-FI COM PRINTS REAIS -->
  <!-- ======================================================== -->
  <div class="page">
    <div>
      <div class="header">
        <div class="logo-badge">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Valore">` : `<span style="font-weight:900; font-size:14pt; color:#38bdf8;">VALORE</span>`}
          <span class="app-tag">Método 1 • Automático</span>
        </div>
        <div class="header-doc-info">
          <div class="header-doc-title">Sincronização Direta na Rede Wi-Fi</div>
          <div class="header-version">Pareamento Instantâneo via QR Code</div>
        </div>
      </div>

      <h2><span>📲</span> Passo a Passo Ilustrado: Sincronizando com o PC Aberto</h2>
      <p style="font-size: 8.5pt;">
        Este é o método mais rápido e elegante. Você só precisa ler o QR Code <b>uma única vez em cada celular</b>. 
        Depois disso, os aparelhos sincronizam sozinhos.
      </p>

      <!-- PASSO 1: PC -->
      <div class="step-box" style="margin-top: 8px;">
        <div class="step-number">1</div>
        <div class="step-content">
          <div class="step-title">No Computador (PC): Abra o Valore e visualize a Central de Sincronização</div>
          <div class="step-desc">
            Abra o Valore no Windows e clique no botão <b>Backup / Sincronizar</b> (no topo ou menu lateral). 
            A janela abaixo será exibida com o <b>Endereço IP</b>, o <b>PIN de Segurança</b> e o <b>QR Code de Conexão</b>:
          </div>

          <div class="print-frame" style="max-width: 530px; margin: 8px auto;">
            ${pcCardBase64 ? `<img src="${pcCardBase64}" alt="Servidor PC">` : `<div style="padding: 20px; color: #fff;">Print do Servidor PC</div>`}
            <div class="print-caption">
              <span><b>Figura 1:</b> Painel do Servidor Wi-Fi no Valore Desktop (PC)</span>
              <span class="badge-pill badge-green">● Servidor Ativo</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PASSO 2: CELULAR ESPOSA -->
      <div class="step-box" style="margin-top: 6px;">
        <div class="step-number green">2</div>
        <div class="step-content">
          <div class="step-title">No Celular da Esposa: Ler QR Code do PC</div>
          <div class="step-desc">
            No aplicativo do celular dela, vá no menu <b>Backup & Sincronização</b> e toque no botão azul 
            <b>"Ler QR Code do PC"</b>. Aponte a câmera para a tela do computador. 
            O app preenche o IP e o PIN e sincroniza imediatamente!
          </div>

          <div class="print-frame" style="max-width: 530px; margin: 8px auto;">
            ${mobileCardBase64 ? `<img src="${mobileCardBase64}" alt="Card Mobile">` : `<div style="padding: 20px; color: #fff;">Print Mobile</div>`}
            <div class="print-caption">
              <span><b>Figura 2:</b> Tela do Celular conectada ao computador com sucesso</span>
              <span class="badge-pill badge-blue">1-Toque p/ Sincronizar</span>
            </div>
          </div>
        </div>
      </div>

      <!-- PASSO 3: SEU CELULAR & AUTO-SYNC -->
      <div class="card card-accent" style="padding: 8px 12px; margin-top: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <h3 style="color: #38bdf8; font-size: 8.8pt;">
            <span>⚡</span> Como Deixar no Automático (Auto-Sync em Segundo Plano)
          </h3>
          <span class="badge-pill badge-green">● Auto-Sync Ativo</span>
        </div>
        <p style="font-size: 8pt; margin-bottom: 2px;">
          Repita o <b>Passo 2</b> uma vez no seu próprio celular. Em seguida, certifique-se de que a opção 
          <span class="key-tag">⚡ Auto-Sync em segundo plano via Wi-Fi</span> esteja marcada.
        </p>
        <p style="font-size: 8pt; color: #94a3b8; margin: 0;">
          <b>O que acontece a partir daí?</b> Sempre que qualquer um de vocês criar ou editar um gasto em casa 
          (com o PC ligado), o celular enviará e receberá as novidades sem você precisar tocar em nenhum botão!
        </p>
      </div>
    </div>

    <div class="footer">
      <span>Valore Gestão Financeira • Manual de Uso & Sincronização</span>
      <span>Página 2 de 4</span>
    </div>
  </div>


  <!-- ======================================================== -->
  <!-- PÁGINA 3: MÉTODO 2 - VIA WHATSAPP (SEM O PC LIGADO)      -->
  <!-- ======================================================== -->
  <div class="page">
    <div>
      <div class="header">
        <div class="logo-badge">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Valore">` : `<span style="font-weight:900; font-size:14pt; color:#38bdf8;">VALORE</span>`}
          <span class="app-tag">Método 2 • Sem Computador</span>
        </div>
        <div class="header-doc-info">
          <div class="header-doc-title">Sincronização Direta Celular ⇄ Celular</div>
          <div class="header-version">Compartilhamento Seguro via WhatsApp</div>
        </div>
      </div>

      <h2><span>💬</span> Método Alternativo: Quando o Computador estiver Desligado</h2>
      <p style="font-size: 8.5pt;">
        Se você e sua esposa estiverem na rua, viajando ou simplesmente não quiserem ligar o computador, 
        vocês podem sincronizar os aparelhos enviando o arquivo pelo <b>WhatsApp</b> em menos de 30 segundos!
      </p>

      <div class="grid-2" style="margin-top: 8px;">
        <!-- LADO A: QUEM ENVIA -->
        <div class="card card-accent" style="padding: 10px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <div class="step-number" style="width: 20px; height: 20px; font-size: 7.5pt;">A</div>
            <h3 style="color: #818cf8; font-size: 9pt;">Sua Esposa (Quem fez os lançamentos)</h3>
          </div>
          <ol style="padding-left: 16px; font-size: 8pt; color: #cbd5e1; line-height: 1.45;">
            <li style="margin-bottom: 4px;">Abre o Valore no celular e vai em <b>Backup</b>.</li>
            <li style="margin-bottom: 4px;">Toca na aba <b>Arquivos / Backup</b>.</li>
            <li style="margin-bottom: 4px;">Clica no botão <b>"Exportar Backup Completo (.json)"</b>.</li>
            <li>Envia o arquivo baixado para você pelo <b>WhatsApp</b>.</li>
          </ol>
        </div>

        <!-- LADO B: QUEM RECEBE -->
        <div class="card card-success" style="padding: 10px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <div class="step-number green" style="width: 20px; height: 20px; font-size: 7.5pt;">B</div>
            <h3 style="color: #34d399; font-size: 9pt;">Você (Quem recebe as novidades)</h3>
          </div>
          <ol style="padding-left: 16px; font-size: 8pt; color: #cbd5e1; line-height: 1.45;">
            <li style="margin-bottom: 4px;">No WhatsApp, toca no arquivo recebido para salvar no celular.</li>
            <li style="margin-bottom: 4px;">Abre o Valore ➔ Menu <b>Backup</b> ➔ Aba <b>Arquivos</b>.</li>
            <li style="margin-bottom: 4px;">Clica em <b>"Mesclar Backup (.json) sem Perder Dados"</b>.</li>
            <li>Seleciona o arquivo recebido. <b>Pronto!</b></li>
          </ol>
        </div>
      </div>

      <!-- PRINT DA SEÇÃO DE ARQUIVOS -->
      <div style="margin-top: 6px;">
        <div class="print-frame" style="max-width: 530px; margin: 0 auto;">
          ${backupFilesBase64 ? `<img src="${backupFilesBase64}" alt="Aba Arquivos">` : `<div style="padding: 20px; color: #fff;">Print de Arquivos</div>`}
          <div class="print-caption">
            <span><b>Figura 3:</b> Seção de Arquivos — O botão verde <b>Mesclar</b> realiza a fusão sem apagar nada</span>
            <span class="badge-pill badge-green">Proteção Anti-Perda</span>
          </div>
        </div>
      </div>

      <!-- ALERTA IMPORTANTE SOBRE RESTAURAR X MESCLAR -->
      <div class="card card-warning" style="margin-top: 10px; padding: 10px 14px;">
        <h3 style="color: #fbbf24; font-size: 8.8pt; display: flex; align-items: center; gap: 6px;">
          <span>⚠️</span> ATENÇÃO: Use sempre "Mesclar", nunca "Restaurar"
        </h3>
        <p style="font-size: 8pt; margin-top: 4px; margin-bottom: 0;">
          No modal de arquivos existem duas opções parecidas. Fique atento à diferença:
          <br>
          • <b style="color: #34d399;">Mesclar Backup (Smart Merge):</b> <b>CORRETO!</b> Junta os lançamentos do arquivo com os que você já tem no celular. NADA É APAGADO.
          <br>
          • <b style="color: #f87171;">Restaurar Backup Completo:</b> Esta opção <b>substitui</b> toda a base atual pelo arquivo. Use apenas se você quiser apagar tudo e recomeçar do zero.
        </p>
      </div>
    </div>

    <div class="footer">
      <span>Valore Gestão Financeira • Manual de Uso & Sincronização</span>
      <span>Página 3 de 4</span>
    </div>
  </div>


  <!-- ======================================================== -->
  <!-- PÁGINA 4: GUIA RÁPIDO E TROUBLESHOOTING                  -->
  <!-- ======================================================== -->
  <div class="page">
    <div>
      <div class="header">
        <div class="logo-badge">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Valore">` : `<span style="font-weight:900; font-size:14pt; color:#38bdf8;">VALORE</span>`}
          <span class="app-tag">Guia de Soluções</span>
        </div>
        <div class="header-doc-info">
          <div class="header-doc-title">Resolução Rápida de Dúvidas & Dicas</div>
          <div class="header-version">Checklist de Rede & Suporte Técnico</div>
        </div>
      </div>

      <h2><span>🛠️</span> Guia de Resolução Rápida (Troubleshooting)</h2>
      <p style="font-size: 8.5pt;">
        Se ao tocar em <b>"Testar Conexão"</b> ou <b>"Sincronizar Agora"</b> aparecer mensagem de falha, 
        consulte a tabela abaixo para resolver em segundos:
      </p>

      <table>
        <thead>
          <tr>
            <th style="width: 28%;">Problema</th>
            <th style="width: 32%;">Possível Causa</th>
            <th style="width: 40%;">Como Resolver</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>"Tempo Esgotado"</b> ou <b>"Não foi possível conectar"</b></td>
            <td>O computador está desligado ou o app Valore está fechado no PC.</td>
            <td>Ligue o PC e deixe o Valore aberto na tela. Certifique-se de que ambos estão no mesmo Wi-Fi.</td>
          </tr>
          <tr>
            <td><b>"Celular no 4G/5G"</b></td>
            <td>O smartphone está usando os dados móveis da operadora.</td>
            <td>Ligue o Wi-Fi no celular e conecte-se na mesma rede do PC da casa.</td>
          </tr>
          <tr>
            <td><b>"PIN de Segurança Inválido"</b></td>
            <td>O PIN mudou no PC ou foi digitado com erro.</td>
            <td>Toque em <b>"Ler QR Code"</b> novamente ou digite o PIN de 6 dígitos exibido atualmente na tela do PC.</td>
          </tr>
          <tr>
            <td><b>"O IP do PC mudou"</b></td>
            <td>O roteador reiniciou e atribuiu um IP diferente ao computador.</td>
            <td>No PC, olhe o endereço atual (ex: <span class="key-tag">192.168.1.20</span>) e atualize no celular ou escaneie o QR Code novo.</td>
          </tr>
          <tr>
            <td><b>"Rede Visitante (Guest)"</b></td>
            <td>O roteador tem isolamento de clientes ativado (bloqueia conexões locais).</td>
            <td>Conecte ambos os aparelhos na rede Wi-Fi principal da casa (não na rede "Visitas").</td>
          </tr>
        </tbody>
      </table>

      <!-- RESUMO VISUAL: COMPARATIVO DOS MÉTODOS -->
      <h2 style="font-size: 10.5pt; margin-top: 10px; margin-bottom: 6px;">
        <span>📋</span> Tabela de Bolso: Qual método devo usar?
      </h2>

      <table>
        <thead>
          <tr>
            <th>Situação</th>
            <th>Método Recomendado</th>
            <th>Tempo Necessário</th>
            <th>Vantagem</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Em Casa (Dia a Dia)</b></td>
            <td>Wi-Fi com PC Ligado (Auto-Sync)</td>
            <td>Instantâneo (0 segundos)</td>
            <td>100% automático, sincroniza sozinho ao abrir o app.</td>
          </tr>
          <tr>
            <td><b>Fora de Casa / Rua</b></td>
            <td>Exportar & Mesclar no WhatsApp</td>
            <td>30 segundos</td>
            <td>Funciona em qualquer lugar do mundo sem depender do PC.</td>
          </tr>
          <tr>
            <td><b>Novo Celular Comprado</b></td>
            <td>Restaurar Base Completa (.json)</td>
            <td>1 minuto</td>
            <td>Transfere o histórico completo de anos para o novo aparelho.</td>
          </tr>
        </tbody>
      </table>

      <!-- DICAS PARA GESTÃO EM CASAL -->
      <div class="card card-accent" style="margin-top: 8px; padding: 10px 12px;">
        <h3 style="color: #38bdf8; font-size: 8.8pt; display: flex; align-items: center; gap: 5px;">
          <span>💑</span> Dica Bônus para Gestão Financeira em Casal
        </h3>
        <p style="font-size: 8pt; margin: 4px 0 0; color: #cbd5e1; line-height: 1.4;">
          No Valore, cada um de vocês pode definir a <b>Identidade do Aparelho</b> em <i>Configurações ➔ Gestão em Casal</i>. 
          Dessa forma, cada lançamento recebe a tag de quem fez a compra (ex: <i>"Allan"</i> ou <i>"Esposa"</i>), 
          permitindo ver nos relatórios exatamente o percentual de gastos de cada um no mês, divisão proporcional 50/50 e acertos de contas com um clique!
        </p>
      </div>
    </div>

    <div class="footer">
      <span>Valore Gestão Financeira • Desenvolvido com foco em Privacidade & Controle Total</span>
      <span>Página 4 de 4</span>
    </div>
  </div>

</body>
</html>
`;

const htmlFilePath = path.join(__dirname, 'manual_sincronizacao.html');
fs.writeFileSync(htmlFilePath, htmlContent, 'utf-8');
console.log('✅ HTML do manual gerado com sucesso em:', htmlFilePath);

// Compilação com Edge Headless para PDF
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputPdfPath = path.join(__dirname, '../Manual_Sincronizacao_Valore.pdf');

if (fs.existsSync(edgePath)) {
  console.log('⏳ Renderizando PDF de alta definição com Microsoft Edge...');
  const cmd = `& "${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${outputPdfPath}" "file:///${htmlFilePath.replace(/\\\\/g, '/')}"`;
  
  execSync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });

  if (fs.existsSync(outputPdfPath)) {
    const stats = fs.statSync(outputPdfPath);
    console.log(`🎉 PDF gerado com sucesso! Arquivo: ${outputPdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error('❌ Erro: O arquivo PDF não foi encontrado após o comando.');
  }
} else {
  console.error('❌ Microsoft Edge não encontrado no caminho padrão.');
}

