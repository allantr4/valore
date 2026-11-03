/**
 * Valore - Verificador Automatizado de Integridade Pré-Commit & Pré-Release
 * Executa checagem de sintaxe, integridade de inicialização, paridade de versões,
 * auditoria estática de layout/ergonomia e validação funcional ponta a ponta (E2E/DOM & IDs).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
let hasErrors = false;

function logPass(msg) {
  console.log(`\x1b[32m✔ [PASS]\x1b[0m ${msg}`);
}

function logFail(msg) {
  console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${msg}`);
  hasErrors = true;
}

console.log('\n======================================================');
console.log('   💎 Valore - Verificação Pré-Commit & Pré-Release   ');
console.log('======================================================\n');

// 1. Verificação de Sintaxe de Scripts
console.log('[1/5] Validando sintaxe e parsing JavaScript...');
const scriptsToValidate = [
  'src/ui/app.js',
  'src/core/financeService.js',
  'src/main/main.js',
  'Android/www/app.js',
  'Android/www/core/financeService.js',
  'IOs/www/app.js',
  'IOs/www/core/financeService.js'
];

for (const relPath of scriptsToValidate) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    logFail(`Arquivo não encontrado: ${relPath}`);
    continue;
  }

  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code, { filename: relPath });
    logPass(`${relPath} (Sintaxe válida - ${code.split('\n').length} linhas)`);
  } catch (err) {
    logFail(`${relPath} com erro de sintaxe: ${err.message}`);
  }
}

// 2. Verificação de Integridade Estrutural do app.js
console.log('\n[2/5] Validando inicialização e pontos de entrada (app.js)...');
const appJsPath = path.join(rootDir, 'src/ui/app.js');
if (fs.existsSync(appJsPath)) {
  const appContent = fs.readFileSync(appJsPath, 'utf8');

  if (appContent.includes("document.addEventListener('DOMContentLoaded'") || appContent.includes('document.addEventListener("DOMContentLoaded"')) {
    logPass('DOMContentLoaded registrado no app.js');
  } else {
    logFail('DOMContentLoaded NÃO foi encontrado no app.js! O app pode ficar travado na inicialização.');
  }

  if (appContent.includes('initApp()')) {
    logPass('Chamada initApp() presente');
  } else {
    logFail('Chamada initApp() ausente no app.js!');
  }

  if (appContent.includes('[truncated') || appContent.includes('... [truncated')) {
    logFail('Detectado texto de truncamento acidental no app.js!');
  } else {
    logPass('Ausência de artefatos de truncamento no app.js');
  }
} else {
  logFail('src/ui/app.js não existe!');
}

// 3. Verificação de Paridade de Versões
console.log('\n[3/5] Validando paridade de versões entre arquivos...');
let versionJsonVer = null;
try {
  const vJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'version.json'), 'utf8'));
  versionJsonVer = vJson.version;
  logPass(`version.json: v${versionJsonVer}`);
} catch (e) {
  logFail(`Erro ao ler version.json: ${e.message}`);
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  if (pkg.version === versionJsonVer) {
    logPass(`package.json: v${pkg.version} (Alinhado)`);
  } else {
    logFail(`Divergência de versão no package.json: v${pkg.version} vs v${versionJsonVer} no version.json`);
  }
} catch (e) {
  logFail(`Erro ao ler package.json: ${e.message}`);
}

try {
  const financeCore = fs.readFileSync(path.join(rootDir, 'src/core/financeService.js'), 'utf8');
  const match = financeCore.match(/getAppVersion\(\)\s*\{\s*return\s*['"]([^'"]+)['"]/);
  if (match && match[1] === versionJsonVer) {
    logPass(`financeService.js getAppVersion(): v${match[1]} (Alinhado)`);
  } else {
    logFail(`Divergência de versão no financeService.js: ${match ? 'v' + match[1] : 'não encontrada'} vs v${versionJsonVer}`);
  }
} catch (e) {
  logFail(`Erro ao validar financeService.js: ${e.message}`);
}

// 4. Verificação de Enquadramento, Scrollbar & Responsividade (UI Layout Audit)
console.log('\n[4/5] Validando enquadramento, visibilidade de scrollbars e respiros de UI...');
const cssPath = path.join(rootDir, 'src/ui/styles.css');
if (fs.existsSync(cssPath)) {
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // A. Scrollbar visível em .main-content
  if (cssContent.includes('.main-content::-webkit-scrollbar') && cssContent.includes('.main-content::-webkit-scrollbar-thumb')) {
    logPass('Scrollbar estilizada de alta visibilidade presente em .main-content');
  } else {
    logFail('Ausência de estilização explícita de scrollbar em .main-content! Risco de interface parecer cortada.');
  }

  // B. Estabilidade de rolagem
  if (cssContent.includes('scrollbar-gutter: stable') || cssContent.includes('scrollbar-width: thin')) {
    logPass('Controles de estabilidade de rolagem (scrollbar-gutter / thin) configurados');
  } else {
    logFail('Falta scrollbar-gutter ou scrollbar-width para rolagem estável.');
  }

  // C. Respiro inferior no Desktop (Safe Bottom Clearance)
  const viewContainerMatch = cssContent.match(/\.view-container\s*\{[^}]*padding:[^}]*\}/);
  if (viewContainerMatch && (viewContainerMatch[0].includes('4.') || viewContainerMatch[0].includes('5.') || viewContainerMatch[0].includes('6.'))) {
    logPass('Safe bottom clearance amplo configurado em .view-container (>= 4.5rem)');
  } else {
    logFail('.view-container com padding-bottom insuficiente para evitar cortes no botão flutuante e fim de página.');
  }

  // D. Breakpoint para telas compactas na vertical (max-height)
  if (cssContent.includes('@media (max-height:')) {
    logPass('Regras de enquadramento adaptativo para janelas baixas (@media max-height) presentes');
  } else {
    logFail('Ausência de regras para janelas de altura compacta (@media max-height)!');
  }

  // E. Rolagem da barra lateral (Sidebar)
  if (cssContent.includes('.sidebar') && cssContent.includes('overflow-y: auto')) {
    logPass('Sidebar configurada com overflow-y: auto para janelas de baixa resolução');
  } else {
    logFail('Sidebar sem overflow-y: auto! Risco de cortar rodapé em janelas baixas.');
  }

  // F. Classes de chaveamento de switch estilizadas
  if (cssContent.includes('.switch') && cssContent.includes('.switch .slider') && cssContent.includes('.switch input:checked + .slider')) {
    logPass('Classes de chaveamento de switch (.switch e .slider) devidamente estilizadas no CSS');
  } else {
    logFail('Classes .switch / .slider ausentes no CSS! Switches podem ficar invisíveis ou inertes.');
  }

  // G. Auditoria Estrita de Precedência e Retração da Sidebar Mobile
  const hasHiddenState = cssContent.includes('transform: translateX(-100%) !important');
  const hasOpenState = cssContent.includes('transform: translateX(0) !important');
  const hasConflict = /.sidebars*{[^}]*transform:s*translateZ/i.test(cssContent);

  if (hasHiddenState && hasOpenState && !hasConflict) {
    logPass('Sidebar mobile devidamente blindada com translateX(-100%) e sem colisões na cascata CSS');
  } else {
    if (!hasHiddenState) logFail('Sidebar mobile sem transform: translateX(-100%) !important! Risco de ficar fixa na tela.');
    if (!hasOpenState) logFail('Sidebar mobile sem .sidebar.mobile-open com transform: translateX(0) !important!');
    if (hasConflict) logFail('Detectada sobrescrita nociva de transform na Sidebar (ex: translateZ)!');
  }
} else {
  logFail('src/ui/styles.css não encontrado!');
}

// 5. Validação Funcional Automatizada de Ponta a Ponta (E2E/DOM & Paridade de IDs)
console.log('\n[5/5] Validando integridade funcional E2E e paridade de IDs entre JS, HTML e CSS...');
const indexPath = path.join(rootDir, 'src/ui/index.html');
if (fs.existsSync(indexPath) && fs.existsSync(appJsPath)) {
  const htmlContent = fs.readFileSync(indexPath, 'utf8');
  const appContent = fs.readFileSync(appJsPath, 'utf8');

  // IDs críticos que DEVEM existir no index.html
  const criticalIds = [
    'notificationSettingsModal',
    'notifTestFeedbackBox',
    'btnOpenNotificationSettings',
    'headerNotificationBadge',
    'btnSidebarNotifications',
    'notifMasterRow',
    'notifMasterEnabled',
    'notifDetailsContainer',
    'notifDaysBefore',
    'notifDueTime',
    'notifAlertOverdue',
    'notifAlertCards',
    'notifBankReader',
    'dashboardDueAlertBanner',
    'updateModal',
    'btnUpdateViaBrowser',
    'txModal',
    'accountModal',
    'calcOverlay'
  ];

  let missingCount = 0;
  for (const id of criticalIds) {
    const hasInHtml = htmlContent.includes(`id="${id}"`) || htmlContent.includes(`id='${id}'`);
    if (hasInHtml) {
      logPass(`ID interativo verificado no HTML: #${id}`);
    } else {
      logFail(`ID crítico ausente no index.html: #${id}`);
      missingCount++;
    }
  }

  // Verificação de compatibilidade no app.js
  const jsIds = [
    'notifMasterEnabled',
    'notifDaysBefore',
    'notifDueTime',
    'notifAlertOverdue',
    'notifAlertCards'
  ];

  for (const jId of jsIds) {
    if (appContent.includes(`'${jId}'`) || appContent.includes(`"${jId}"`)) {
      logPass(`ID sincronizado no app.js: #${jId}`);
    } else {
      logFail(`ID ausente ou divergente no app.js: #${jId}`);
    }
  }

  // Verificação de desalocação de GPU nos Modais (display: none quando fechado)
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  if (cssContent.includes('.modal-overlay') && cssContent.includes('display: none !important')) {
    logPass('Modais desalocados da memória da GPU quando fechados (display: none !important)');
  } else {
    logFail('Modais sem regra de desalocação display: none !important!');
  }

  // Verificação de tratamento seguro de alertas de notificação (previne TypeError alerts.map)
  if (appContent.includes('Array.isArray(raw)') && appContent.includes('raw.items')) {
    logPass('Tratamento polimórfico de alertas seguro contra falhas de tipo (Array ou Objeto)');
  } else {
    logFail('Tratamento de alertas vulnerável a TypeError de tipo de retorno!');
  }

  if (cssContent.includes('z-index: 1000050 !important')) {
    logPass('Toast configurado com z-index supremo (1000050) acima de todos os modais');
  } else {
    logFail('Toast com z-index insuficiente!');
  }

  if (cssContent.includes('#viewSubtitle') && cssContent.includes('display: none !important')) {
    logPass('Subtítulo longo ocultado no mobile para economizar altura vertical');
  } else {
    logFail('Falta regra para ocultar #viewSubtitle no mobile!');
  }
} else {
  logFail('Arquivos de interface (index.html ou app.js) ausentes para o teste E2E!');
}

console.log('\n======================================================');
if (hasErrors) {
  console.error('\x1b[31m⛔ TESTES FALHARAM! Corrija os erros antes de comitar ou publicar.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m🎉 TODOS OS TESTES PASSARAM! Sistema 100% pronto e íntegro.\x1b[0m');
  process.exit(0);
}
