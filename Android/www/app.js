// Inicialização do Core Valore
const storage = new LocalStorageAdapter();
const finance = new FinanceService(storage);

// --- ACELERADOR GLOBAL MOBILE (MOTO Z2 PLAY E DISPOSITIVOS TOUCH) ---
const isTouchMobile = (typeof window !== 'undefined') && (
  window.innerWidth <= 900 ||
  !!window.Capacitor ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
);

// 1. Otimização do Chart.js: No mobile, desliga animações contínuas de canvas para renderização instantânea a 60 FPS
if (typeof Chart !== 'undefined') {
  if (isTouchMobile) {
    Chart.defaults.animation = false;
    Chart.defaults.transitions.active.animation.duration = 0;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  }
}

// 2. Otimizador Global do Lucide Icons: Agrupa chamadas via requestAnimationFrame para evitar layout thrashing
if (typeof window !== 'undefined' && window.lucide && window.lucide.createIcons) {
  const _origCreateIcons = window.lucide.createIcons.bind(window.lucide);
  let _lucideScheduled = false;

  window.lucide.createIcons = function(options) {
    if (options && options.root) {
      return _origCreateIcons(options);
    }
    if (_lucideScheduled) return;
    _lucideScheduled = true;
    requestAnimationFrame(() => {
      _lucideScheduled = false;
      _origCreateIcons();
    });
  };
}

// Utilitário de escape de HTML para evitar XSS e erros de referência
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inteligência de categorização automática baseada em palavras-chave do extrato
function detectCategoryFromDescription(description, txType = 'expense') {
  if (!description) return null;
  const desc = description.toLowerCase();

  // Categorias de Entrada / Renda
  if (txType === 'income') {
    if (/seguro[\s-]?desemprego|beneficio|benefício|auxilio|auxílio|fgts|inss|previdencia|previdência|pensao|pensão|restituicao|restituição|rescisao|rescisão|pis|pasep|indeniz/.test(desc)) {
      const benCat = finance.state.categories.find(c => c.type === 'income' && (c.name.toLowerCase().includes('benefício') || c.name.toLowerCase().includes('beneficio') || c.name.toLowerCase().includes('auxílio')));
      if (benCat) return benCat.id;
    }
    if (/salario|salário|folha|provent|vencimento|ordenado|remunerac|pro-labore|prolabore/.test(desc)) {
      return finance.state.categories.find(c => c.name.toLowerCase().includes('salário') || c.type === 'income')?.id;
    }
    if (/rendiment|dividendo|jcp|cdi|selic|aplicac|resgate|fundos|tesouro|b3|invest/.test(desc)) {
      return finance.state.categories.find(c => c.name.toLowerCase().includes('invest') || c.type === 'income')?.id;
    }
    const anyIncome = finance.state.categories.find(c => c.type === 'income');
    return anyIncome ? anyIncome.id : 'cat-1';
  }

  // Despesas: Alimentação e Mercado
  if (/mercado|supermercado|hiper|atacad|hortifruti|acougue|açougue|padaria|panificadora|carrefour|extra|pao de acucar|pão de açúcar|dia%|assai|assaí|atadadao|atacadão|sonda|mambo|ifood|rappi|ubereats|restaurante|lanchonete|bar|burger|pizza|mcdonald|burguer king|habib|subway|starbucks|cafe|café|churrascaria|pizzaria|sushi|delivery/.test(desc)) {
    const cat = finance.state.categories.find(c => c.name.toLowerCase().includes('aliment') || c.name.toLowerCase().includes('mercado'));
    if (cat) return cat.id;
  }

  // Despesas: Transporte e Veículo
  if (/uber|99app|99pop|taxi|combustivel|combustível|posto|ipiranga|shell|petrobras|br branca|auto posto|gasolina|etanol|diesel|estacionamento|parking|estapar|sem parar|veloe|conectcar|pedagio|pedágio|oficina|mecanica|mecânica|pneu|autozone|revisao|revisão|detran|ipva|multa/.test(desc)) {
    const cat = finance.state.categories.find(c => c.name.toLowerCase().includes('transporte') || c.name.toLowerCase().includes('veículo') || c.name.toLowerCase().includes('veiculo'));
    if (cat) return cat.id;
  }

  // Despesas: Moradia, Energia, Água e Contas Fixas
  if (/aluguel|condominio|condomínio|imobiliaria|enel|cpfl|cemig|light|energia|eletropaulo|sabesp|copasa|sanepar|sanasa|agua|água|gas|gás|comgas|ultragaz|internet|claro|vivo|tim|oi fibra|net virtua|iptu|seguro residencial|pagamentoconta/.test(desc)) {
    const cat = finance.state.categories.find(c => c.name.toLowerCase().includes('moradia') || c.name.toLowerCase().includes('aluguel') || c.name.toLowerCase().includes('contas'));
    if (cat) return cat.id;
  }

  // Despesas: Transporte, Veículo e Seguro Auto
  if (/uber|99app|99pop|taxi|combustivel|combustível|posto|ipiranga|shell|petrobras|br branca|auto posto|gasolina|etanol|diesel|estacionamento|parking|estapar|sem parar|veloe|conectcar|pedagio|pedágio|oficina|mecanica|mecânica|pneu|autozone|revisao|revisão|detran|ipva|multa|portoseg|porto seguro/.test(desc)) {
    const cat = finance.state.categories.find(c => c.name.toLowerCase().includes('transporte') || c.name.toLowerCase().includes('veículo') || c.name.toLowerCase().includes('veiculo'));
    if (cat) return cat.id;
  }

  // Despesas: Saúde, Farmácia e Cuidados
  if (/farmacia|farmácia|drogaria|drogasil|droga raia|pacheco|sao paulo|panvel|medic|hospital|clinica|clínica|consulta|laboratorio|laboratório|fleury|delboni|exame|dentista|odonto|psicolog|psicólog|terapia|unimed|amil|bradesco saude|sulamerica|sul américa|otica|ótica/.test(desc)) {
    const cat = finance.state.categories.find(c => c.name.toLowerCase().includes('saúde') || c.name.toLowerCase().includes('saude') || c.name.toLowerCase().includes('cuidados'));
    if (cat) return cat.id;
  }

  // Despesas: Lazer, Viagens e Assinaturas
  if (/netflix|spotify|amazon prime|disney|hbo|youtube|globo|cinema|ingresso|show|teatro|hotel|booking|airbnb|decolar|latam|gol|azul|viagem|passagem|livraria|jogos|steam|playstation|xbox|nintendo|combinaqui/.test(desc)) {
    const cat = finance.state.categories.find(c => c.name.toLowerCase().includes('lazer') || c.name.toLowerCase().includes('viagen') || c.name.toLowerCase().includes('viagens'));
    if (cat) return cat.id;
  }

  // Despesas: Transferência, TED, Cartão, Tarifas Bancárias
  if (/ted|doc|pix transf|transferencia|transf\.|fatura paga|cartao|seguro cartao|iof|tarifa/.test(desc)) {
    const cat = finance.state.categories.find(c => c.name.toLowerCase().includes('transferência') || c.name.toLowerCase().includes('transferencia'));
    if (cat) return cat.id;
  }

  // Fallback padrão: primeira categoria de despesa cadastrada
  const firstExpense = finance.state.categories.find(c => c.type === 'expense');
  return firstExpense ? firstExpense.id : 'cat-3';
}

// Estado da UI
let currentTab = 'dashboard';
let currentTxType = 'expense';
let selectedAccountId = null;
let currentSelectedCardInvoiceKey = null;
let monthlyChartInstance = null;
let categoryChartInstance = null;
let forecastChartInstance = null;
let incomeCommitmentChartInstance = null;
let currentDistributionMode = 'category';
let currentThemeSetting = 'auto';
let currentEntityFilter = 'all'; // 'all' | 'pf' | 'pj' (Modo Dual Pessoal vs Negócio)
let fireChartInstance = null; // Gráfico de Curva de Liberdade Financeira

// Estado do Período do Dashboard (Mês e Ano)
const initialNow = new Date();
let currentDashboardPeriod = {
  month: initialNow.getMonth() + 1,
  year: initialNow.getFullYear()
};

const monthNamesLong = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Funções de Controle do Período do Dashboard
window.populateDashboardYearSelect = function() {
  const yearSelect = document.getElementById('dashSelectYear');
  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();
  let minYear = currentYear - 3;
  let maxYear = currentYear + 2;

  // Descobre menor e maior ano existente nas transações com trava de sanidade (evita loop infinito com datas como 9999)
  if (finance.state.transactions && finance.state.transactions.length > 0) {
    finance.state.transactions.forEach(t => {
      if (t.date) {
        const y = parseInt(t.date.split('-')[0], 10);
        if (!isNaN(y) && y >= currentYear - 20 && y <= currentYear + 10) {
          if (y < minYear) minYear = y;
          if (y > maxYear) maxYear = y;
        }
      }
    });
  }

  // Trava de amplitude máxima para prevenir gargalo de DOM
  minYear = Math.max(currentYear - 25, minYear);
  maxYear = Math.min(currentYear + 10, maxYear);

  let html = '';
  for (let y = minYear; y <= maxYear; y++) {
    html += `<option value="${y}" ${y === currentDashboardPeriod.year ? 'selected' : ''}>${y}</option>`;
  }
  yearSelect.innerHTML = html;
};

window.syncDashboardPeriodControls = function() {
  const monthSelect = document.getElementById('dashSelectMonth');
  const yearSelect = document.getElementById('dashSelectYear');
  const labelEl = document.getElementById('dashPeriodCurrentLabel');

  if (monthSelect) monthSelect.value = currentDashboardPeriod.month;
  if (yearSelect) yearSelect.value = currentDashboardPeriod.year;
  if (labelEl) {
    const monthName = monthNamesLong[currentDashboardPeriod.month - 1] || '';
    labelEl.textContent = `${monthName} de ${currentDashboardPeriod.year}`;
  }
};

window.navigateDashboardPeriod = function(step) {
  let m = currentDashboardPeriod.month + step;
  let y = currentDashboardPeriod.year;

  if (m > 12) {
    m = 1;
    y++;
  } else if (m < 1) {
    m = 12;
    y--;
  }

  currentDashboardPeriod.month = m;
  currentDashboardPeriod.year = y;

  window.populateDashboardYearSelect();
  window.syncDashboardPeriodControls();
  renderDashboard();
};

window.handleDashboardPeriodChange = function() {
  const monthSelect = document.getElementById('dashSelectMonth');
  const yearSelect = document.getElementById('dashSelectYear');

  if (monthSelect) currentDashboardPeriod.month = parseInt(monthSelect.value, 10);
  if (yearSelect) currentDashboardPeriod.year = parseInt(yearSelect.value, 10);

  window.syncDashboardPeriodControls();
  renderDashboard();
};

window.resetDashboardToCurrentMonth = function() {
  const n = new Date();
  currentDashboardPeriod.month = n.getMonth() + 1;
  currentDashboardPeriod.year = n.getFullYear();

  window.populateDashboardYearSelect();
  window.syncDashboardPeriodControls();
  renderDashboard();
};

// Formatador Monetário
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

// ========================================================
// SISTEMA DE NOTIFICAÇÕES VISUAIS RÁPIDAS (TOAST NOTIFICATIONS)
// ========================================================
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toastNotificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastNotificationContainer';
    container.style.cssText = 'position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 99999; display: flex; flex-direction: column; gap: 0.65rem; pointer-events: none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : (type === 'error' || type === 'danger' ? '#ef4444' : (type === 'warning' ? '#f59e0b' : '#3b82f6'));
  const icon = type === 'success' ? '✓' : (type === 'error' || type === 'danger' ? '✕' : 'ℹ');

  toast.style.cssText = `
    background: var(--bg-surface, #1e293b);
    color: var(--text-main, #f8fafc);
    border: 1px solid var(--border-color, rgba(255,255,255,0.1));
    border-left: 4px solid ${bg};
    padding: 0.75rem 1.15rem;
    border-radius: 10px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    font-size: 0.88rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(12px) scale(0.96);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  toast.innerHTML = `<span style="background: ${bg}; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; flex-shrink: 0;">${icon}</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px) scale(0.95)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}
window.showToast = showToast;

// ========================================================
// SISTEMA PADRONIZADO DE ALERTAS & CONFIRMAÇÕES (PADRÃO TRANSAÇÕES)
// ========================================================
let appAlertResolve = null;

function showAppAlert({ title = 'Aviso', message = '', icon = 'alert-circle', type = 'info', confirmText = 'Entendido' } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('appAlertModal');
    if (!modal) {
      window.nativeAlert ? window.nativeAlert(message) : alert(message);
      return resolve(true);
    }

    const titleEl = document.getElementById('appAlertTitle');
    const msgEl = document.getElementById('appAlertMessage');
    const badgeEl = document.getElementById('appAlertIconBadge');
    const iconEl = document.getElementById('appAlertIcon');
    const cancelBtn = document.getElementById('btnAppAlertCancel');
    const confirmBtn = document.getElementById('btnAppAlertConfirm');
    const confirmTextEl = document.getElementById('appAlertConfirmBtnText');
    const confirmIconEl = document.getElementById('appAlertConfirmBtnIcon');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = message.replace(/\n/g, '<br>');

    // Estilos do badge e botão conforme o tipo
    let badgeBg = 'rgba(59, 130, 246, 0.15)';
    let badgeColor = 'var(--primary)';
    let btnBg = 'var(--primary)';
    let iconName = icon;

    if (type === 'danger' || type === 'error') {
      badgeBg = 'rgba(239, 68, 68, 0.15)';
      badgeColor = 'var(--danger)';
      btnBg = 'var(--danger)';
      if (icon === 'alert-circle') iconName = 'alert-triangle';
    } else if (type === 'success') {
      badgeBg = 'rgba(16, 185, 129, 0.15)';
      badgeColor = 'var(--success)';
      btnBg = 'var(--success)';
      if (icon === 'alert-circle') iconName = 'check-circle';
    } else if (type === 'warning') {
      badgeBg = 'rgba(245, 158, 11, 0.15)';
      badgeColor = 'var(--warning)';
      btnBg = 'var(--warning)';
      if (icon === 'alert-circle') iconName = 'alert-circle';
    }

    if (badgeEl) {
      badgeEl.style.background = badgeBg;
      badgeEl.style.color = badgeColor;
    }
    if (iconEl) {
      iconEl.setAttribute('data-lucide', iconName);
    }
    if (confirmBtn) {
      confirmBtn.style.background = btnBg;
      confirmBtn.style.borderColor = btnBg;
    }
    if (confirmTextEl) confirmTextEl.textContent = confirmText;
    if (confirmIconEl) confirmIconEl.setAttribute('data-lucide', type === 'success' ? 'check' : 'check');

    if (cancelBtn) cancelBtn.style.display = 'none';

    appAlertResolve = resolve;
    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  });
}

function showAppConfirm({ title = 'Confirmação', message = '', icon = 'trash-2', type = 'danger', confirmText = 'Confirmar', cancelText = 'Cancelar' } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('appAlertModal');
    if (!modal) {
      const ok = window.nativeConfirm ? window.nativeConfirm(message) : confirm(message);
      return resolve(ok);
    }

    const titleEl = document.getElementById('appAlertTitle');
    const msgEl = document.getElementById('appAlertMessage');
    const badgeEl = document.getElementById('appAlertIconBadge');
    const iconEl = document.getElementById('appAlertIcon');
    const cancelBtn = document.getElementById('btnAppAlertCancel');
    const confirmBtn = document.getElementById('btnAppAlertConfirm');
    const confirmTextEl = document.getElementById('appAlertConfirmBtnText');
    const confirmIconEl = document.getElementById('appAlertConfirmBtnIcon');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = message.replace(/\n/g, '<br>');

    let badgeBg = 'rgba(239, 68, 68, 0.15)';
    let badgeColor = 'var(--danger)';
    let btnBg = 'var(--danger)';
    let iconName = icon;

    if (type === 'primary' || type === 'info') {
      badgeBg = 'rgba(59, 130, 246, 0.15)';
      badgeColor = 'var(--primary)';
      btnBg = 'var(--primary)';
    } else if (type === 'success') {
      badgeBg = 'rgba(16, 185, 129, 0.15)';
      badgeColor = 'var(--success)';
      btnBg = 'var(--success)';
    }

    if (badgeEl) {
      badgeEl.style.background = badgeBg;
      badgeEl.style.color = badgeColor;
    }
    if (iconEl) {
      iconEl.setAttribute('data-lucide', iconName);
    }
    if (confirmBtn) {
      confirmBtn.style.background = btnBg;
      confirmBtn.style.borderColor = btnBg;
    }
    if (confirmTextEl) confirmTextEl.textContent = confirmText;
    if (confirmIconEl) confirmIconEl.setAttribute('data-lucide', iconName === 'trash-2' ? 'trash-2' : 'check');

    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
      cancelBtn.style.display = 'inline-flex';
    }

    appAlertResolve = resolve;
    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  });
}

function closeAppAlertModal(result = false) {
  const modal = document.getElementById('appAlertModal');
  if (modal) modal.classList.remove('open');
  if (appAlertResolve) {
    const resolve = appAlertResolve;
    appAlertResolve = null;
    resolve(result);
  }
}

// Configura listeners do modal universal
function setupAppAlertListeners() {
  const closeBtn = document.getElementById('btnAppAlertClose');
  const cancelBtn = document.getElementById('btnAppAlertCancel');
  const confirmBtn = document.getElementById('btnAppAlertConfirm');
  const modal = document.getElementById('appAlertModal');

  if (closeBtn) closeBtn.addEventListener('click', () => closeAppAlertModal(false));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeAppAlertModal(false));
  if (confirmBtn) confirmBtn.addEventListener('click', () => closeAppAlertModal(true));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAppAlertModal(false);
    });
  }
}

// Override do alert() e confirm() para que nenhum ponto do app abra diálogos feios do navegador
window.nativeAlert = window.alert;
window.nativeConfirm = window.confirm;

window.alert = function(msg) {
  let type = 'info';
  let title = 'Aviso';
  let icon = 'alert-circle';
  const str = String(msg || '');

  if (str.toLowerCase().includes('erro') || str.toLowerCase().includes('falha')) {
    type = 'danger';
    title = 'Atenção';
    icon = 'alert-triangle';
  } else if (str.toLowerCase().includes('sucesso') || str.toLowerCase().includes('parabéns') || str.toLowerCase().includes('conquistado')) {
    type = 'success';
    title = 'Sucesso';
    icon = 'check-circle';
  } else if (str.toLowerCase().includes('por favor') || str.toLowerCase().includes('informe') || str.toLowerCase().includes('atenção')) {
    type = 'warning';
    title = 'Informação Necessária';
    icon = 'alert-circle';
  }

  showAppAlert({
    title,
    message: str,
    type,
    icon,
    confirmText: 'Entendido'
  });
};

window.confirm = function(msg) {
  // Para manter compatibilidade síncrona se algum script chamar diretamente,
  // mas recomendamos usar await showAppConfirm()
  return window.nativeConfirm(msg);
};


// ========================================================
// CATÁLOGO DE BANCOS & INSTITUIÇÕES FINANCEIRAS BRASILEIRAS
// ========================================================
const BRAZILIAN_BANKS = {
  nubank: {
    name: 'Nubank',
    defaultColor: '#820ad1',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M13 29V18.5C13 16 15 14.5 17.5 14.5C20 14.5 22 16 22 18.5V29" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/><path d="M26 18.5V28.5C26 31 28 32.5 30.5 32.5C33 32.5 35 31 35 28.5V18.5" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/></svg>`
  },
  itau: {
    name: 'Itaú',
    defaultColor: '#ec7000',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><rect x="8" y="10" width="32" height="28" rx="7" fill="#003399"/><text x="24" y="29" fill="#EC7000" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="14" font-style="italic" text-anchor="middle">itaú</text></svg>`
  },
  bradesco: {
    name: 'Bradesco',
    defaultColor: '#cc092f',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M18 34V24C18 21.8 19.8 20 22 20H26C28.2 20 30 21.8 30 24V34" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M12 21C12 16 17 12 24 12C31 12 36 16 36 21" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M15 25C17 22.5 20.3 21 24 21C27.7 21 31 22.5 33 25" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>`
  },
  bb: {
    name: 'Banco do Brasil',
    defaultColor: '#0038a8',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><g stroke="#FCDB00" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M14 24L24 14L34 24L24 34Z"/><path d="M18 20L28 30"/><path d="M30 18L20 28"/></g></svg>`
  },
  caixa: {
    name: 'Caixa Econômica',
    defaultColor: '#0066b3',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M12 14L22 24L12 34" stroke="#FFFFFF" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 14L26 24L36 34" stroke="#F39200" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  santander: {
    name: 'Santander',
    defaultColor: '#ec0000',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M24 12C24 12 27 16 27 19C27 21 25.5 23 24 23C22.5 23 21 21 21 19C21 16 24 12 24 12Z" fill="#ffffff"/><path d="M17 21C17 21 19.5 24 19.5 26.5C19.5 28.5 18 30 16.5 30C15 30 13.5 28.5 13.5 26.5C13.5 24 17 21 17 21Z" fill="#ffffff"/><path d="M31 21C31 21 34.5 24 34.5 26.5C34.5 28.5 33 30 31.5 30C30 30 28.5 28.5 28.5 26.5C28.5 24 31 21 31 21Z" fill="#ffffff"/><ellipse cx="24" cy="33" rx="12" ry="2.5" fill="#ffffff" opacity="0.9"/></svg>`
  },
  inter: {
    name: 'Banco Inter',
    defaultColor: '#ff7a00',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><text x="24" y="29" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" text-anchor="middle" letter-spacing="-0.5">inter</text><circle cx="36" cy="19" r="2" fill="#FFFFFF"/></svg>`
  },
  c6: {
    name: 'C6 Bank',
    defaultColor: '#242424',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><rect x="6" y="6" width="36" height="36" rx="9" fill="none" stroke="#4a4a4a" stroke-width="1.5"/><text x="24" y="29" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="15" text-anchor="middle" letter-spacing="-0.5">C6</text></svg>`
  },
  xp: {
    name: 'XP Investimentos',
    defaultColor: '#000000',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><rect x="2" y="2" width="44" height="44" rx="11" fill="none" stroke="#333333" stroke-width="1"/><text x="19" y="30" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" text-anchor="middle">X</text><text x="31" y="30" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" text-anchor="middle">P</text><line x1="12" y1="34" x2="36" y2="34" stroke="#FDB913" stroke-width="2.5" stroke-linecap="round"/></svg>`
  },
  btg: {
    name: 'BTG Pactual',
    defaultColor: '#001e62',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><text x="24" y="27" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" text-anchor="middle" letter-spacing="1">BTG</text><text x="24" y="34" fill="#C5A059" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="6.5" text-anchor="middle" letter-spacing="1.5">PACTUAL</text></svg>`
  },
  mercadopago: {
    name: 'Mercado Pago',
    defaultColor: '#009ee3',
    imageSrc: 'assets/mercadopago.png',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="48" height="48" rx="12" fill="#ffffff"/><image href="assets/mercadopago.png" xlink:href="assets/mercadopago.png" x="2" y="2" width="44" height="44" preserveAspectRatio="xMidYMid meet"/></svg>`
  },
  picpay: {
    name: 'PicPay',
    defaultColor: '#11c76f',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M18 34V16H25C28.3 16 31 18.7 31 22C31 25.3 28.3 28 25 28H18" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="33" cy="16" r="2.5" fill="#FFFFFF"/></svg>`
  },
  sicoob: {
    name: 'Sicoob',
    defaultColor: '#003641',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><g fill="#71B328"><circle cx="19" cy="19" r="5"/><circle cx="29" cy="19" r="5"/><circle cx="19" cy="29" r="5"/><circle cx="29" cy="29" r="5"/><circle cx="24" cy="24" r="3" fill="#FFFFFF"/></g></svg>`
  },
  sicredi: {
    name: 'Sicredi',
    defaultColor: '#008237',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><g fill="#FFFFFF"><path d="M24 13C24 13 28 17 28 21H24V13Z"/><path d="M35 24C35 24 31 28 27 28V24H35Z"/><path d="M24 35C24 35 20 31 20 27H24V35Z"/><path d="M13 24C13 24 17 20 21 20V24H13Z"/></g><circle cx="24" cy="24" r="2.5" fill="#A4D854"/></svg>`
  },
  safra: {
    name: 'Banco Safra',
    defaultColor: '#0c2340',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M24 12L34 16V25C34 30.5 29.5 35 24 36.5C18.5 35 14 30.5 14 25V16L24 12Z" fill="none" stroke="#C5A059" stroke-width="2.5"/><text x="24" y="28" fill="#C5A059" font-family="system-ui, serif" font-weight="900" font-size="11" text-anchor="middle">S</text></svg>`
  },
  pagbank: {
    name: 'PagBank',
    defaultColor: '#00a868',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M17 33V16H25C28 16 30.5 18.2 30.5 21C30.5 23.8 28 26 25 26H17" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="28" cy="30" r="3" fill="#FFD100"/></svg>`
  },
  cash: {
    name: 'Dinheiro / Carteira',
    defaultColor: '#059669',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><rect x="12" y="17" width="24" height="15" rx="3" stroke="#FFFFFF" stroke-width="2.5" fill="none"/><circle cx="24" cy="24.5" r="3.5" stroke="#FFFFFF" stroke-width="2.2" fill="none"/><line x1="16" y1="21" x2="16" y2="21.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/><line x1="32" y1="28" x2="32" y2="28.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/></svg>`
  },
  bills: {
    name: 'Boletos & Contas',
    defaultColor: '#f59e0b',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M14 12H34C35.1 12 36 12.9 36 14V34C36 35.1 35.1 36 34 36H14C12.9 36 12 35.1 12 34V14C12 12.9 12.9 12 14 12Z" stroke="#ffffff" stroke-width="2.5"/><line x1="18" y1="18" x2="18" y2="30" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/><line x1="22" y1="18" x2="22" y2="30" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/><line x1="26" y1="18" x2="26" y2="30" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/><line x1="30" y1="18" x2="30" y2="30" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },
  other: {
    name: 'Outro Banco',
    defaultColor: '#4f46e5',
    svg: (c) => `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${c}"/><path d="M12 19L24 13L36 19H12Z" fill="#FFFFFF"/><rect x="15" y="22" width="3" height="9" fill="#FFFFFF" rx="0.5"/><rect x="22.5" y="22" width="3" height="9" fill="#FFFFFF" rx="0.5"/><rect x="30" y="22" width="3" height="9" fill="#FFFFFF" rx="0.5"/><rect x="11" y="32" width="26" height="3" fill="#FFFFFF" rx="1"/></svg>`
  }
};

function getBankBadgeHtml(bankId, size = 42, customColor = null) {
  const bank = BRAZILIAN_BANKS[bankId] || BRAZILIAN_BANKS.other;
  const color = customColor || bank.defaultColor;

  if (bank.imageSrc) {
    return `
      <div class="bank-badge-logo" style="width: ${size}px; height: ${size}px; min-width: ${size}px; background: #ffffff; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; padding: 2px; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12); overflow: hidden;" title="${bank.name}">
        <img src="${bank.imageSrc}" alt="${bank.name}" style="width: 100%; height: 100%; object-fit: contain; display: block;" onerror="this.onerror=null; this.src='assets/mercadopago.png';" />
      </div>
    `;
  }

  return `
    <div class="bank-badge-logo" style="width: ${size}px; height: ${size}px; min-width: ${size}px;" title="${bank.name}">
      ${bank.svg(color)}
    </div>
  `;
}

// Retorna o ícone Lucide moderno para categorias com fallback semântico
function resolveCategoryIcon(name, existingIcon = '') {
  if (existingIcon && existingIcon !== 'tag') return existingIcon;
  const n = (name || '').toLowerCase();
  if (n.includes('moradia') || n.includes('aluguel') || n.includes('condom') || n.includes('casa') || n.includes('imovel') || n.includes('imóvel')) return 'home';
  if (n.includes('alimenta') || n.includes('mercado') || n.includes('supermercado') || n.includes('feira') || n.includes('compras do mês')) return 'shopping-cart';
  if (n.includes('restaurante') || n.includes('lanche') || n.includes('refeição') || n.includes('refeicao') || n.includes('comida') || n.includes('ifood') || n.includes('pizza') || n.includes('bar')) return 'utensils';
  if (n.includes('transporte') || n.includes('veículo') || n.includes('veiculo') || n.includes('carro') || n.includes('uber') || n.includes('táxi') || n.includes('taxi') || n.includes('gasolina') || n.includes('combust')) return 'car';
  if (n.includes('streaming') || n.includes('digital') || n.includes('netflix') || n.includes('spotify') || n.includes('assinatura') || n.includes('tv')) return 'tv';
  if (n.includes('lazer') || n.includes('viagen') || n.includes('viagem') || n.includes('passeio') || n.includes('hotel') || n.includes('turismo') || n.includes('praia')) return 'plane';
  if (n.includes('anuidade') || n.includes('taxa') || n.includes('tarifa') || n.includes('imposto') || n.includes('tributo') || n.includes('iof') || n.includes('juros')) return 'badge-percent';
  if (n.includes('saúde') || n.includes('saude') || n.includes('cuidado') || n.includes('farmácia') || n.includes('farmacia') || n.includes('médic') || n.includes('medic') || n.includes('hospital') || n.includes('exame') || n.includes('dentista')) return 'heart-pulse';
  if (n.includes('educa') || n.includes('escola') || n.includes('faculdade') || n.includes('curso') || n.includes('livro') || n.includes('treinamento')) return 'graduation-cap';
  if (n.includes('vestuário') || n.includes('vestuario') || n.includes('roupa') || n.includes('calçado') || n.includes('calcado') || n.includes('moda')) return 'shirt';
  if (n.includes('pet') || n.includes('veterin') || n.includes('animal') || n.includes('ração') || n.includes('racao')) return 'dog';
  if (n.includes('boleto') || n.includes('conta')) return 'receipt';
  if (n.includes('invest') || n.includes('dividendo') || n.includes('rendimento')) return 'trending-up';
  if (n.includes('salário') || n.includes('salario') || n.includes('renda') || n.includes('provento')) return 'wallet';
  return existingIcon || 'tag';
}

function getCategoryIconBoxHtml(cat, size = 34) {
  const catColor = cat.color || '#3b82f6';
  const catAccent = typeof getReadableAccentColor === 'function' ? getReadableAccentColor(catColor) : catColor;
  const iconName = resolveCategoryIcon(cat.name, cat.icon);
  const iconSize = Math.round(size * 0.52);

  return `
    <div class="category-badge-box" style="width: ${size}px; height: ${size}px; min-width: ${size}px; border-radius: 9px; background: ${catAccent}15; border: 1px solid ${catAccent}30; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px ${catAccent}15;" title="${cat.name || 'Categoria'}">
      <i data-lucide="${iconName}" style="width: ${iconSize}px; height: ${iconSize}px; color: ${catAccent}; stroke-width: 2.2;"></i>
    </div>
  `;
}

// Retorna badge visual de titularidade da conta/cartão (Finanças do Casal)
const AVAILABLE_COUPLE_AVATARS = [
  { id: 'user', label: 'Rapaz', icon: 'user' },
  { id: 'user-round', label: 'Moça', icon: 'user-round' },
  { id: 'heart', label: 'Coração', icon: 'heart' },
  { id: 'sparkles', label: 'Brilho', icon: 'sparkles' },
  { id: 'smile', label: 'Sorriso', icon: 'smile' },
  { id: 'heart-handshake', label: 'Parceria', icon: 'heart-handshake' },
  { id: 'crown', label: 'Coroa', icon: 'crown' },
  { id: 'gem', label: 'Joia', icon: 'gem' }
];

const AVAILABLE_COUPLE_COLORS = [
  '#3b82f6', // Azul
  '#ec4899', // Rosa
  '#10b981', // Verde Esmeralda
  '#8b5cf6', // Roxo
  '#f59e0b', // Âmbar
  '#06b6d4', // Ciano
  '#6366f1', // Índigo
  '#f43f5e'  // Coral
];

function getAvatarEmoji(avatarId) {
  const map = {
    'user': '👤',
    'user-round': '👩',
    'heart': '❤️',
    'sparkles': '✨',
    'smile': '😊',
    'heart-handshake': '🤝',
    'crown': '👑',
    'gem': '💎'
  };
  return map[avatarId] || '👤';
}

function getAccountOwnerBadgeHtml(ownerRole) {
  const isCouple = (typeof finance !== 'undefined' && finance.isCoupleEnabled) ? finance.isCoupleEnabled() : true;
  if (!isCouple) return '';
  const couple = (typeof finance !== 'undefined' && finance.getCoupleSettings) ? finance.getCoupleSettings() : null;
  const p1Name = (couple && couple.partner1 && couple.partner1.name) ? couple.partner1.name : 'Você';
  const p2Name = (couple && couple.partner2 && couple.partner2.name) ? couple.partner2.name : 'Parceiro(a)';
  const p1Color = (couple && couple.partner1 && couple.partner1.color) ? couple.partner1.color : '#3b82f6';
  const p2Color = (couple && couple.partner2 && couple.partner2.color) ? couple.partner2.color : '#ec4899';
  const p1Avatar = (couple && couple.partner1 && couple.partner1.avatar) ? couple.partner1.avatar : 'user';
  const p2Avatar = (couple && couple.partner2 && couple.partner2.avatar) ? couple.partner2.avatar : 'heart';

  if (ownerRole === 'p2') {
    return `<span class="badge" style="background: ${p2Color}22; color: ${p2Color}; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; display: inline-flex; align-items: center; gap: 4px;" title="Titular: ${escapeHtml(p2Name)}"><i data-lucide="${p2Avatar}" style="width: 11px; height: 11px;"></i> ${escapeHtml(p2Name)}</span>`;
  }
  if (ownerRole === 'joint') {
    return `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; display: inline-flex; align-items: center; gap: 4px;" title="Conta Conjunta / Casa"><i data-lucide="home" style="width: 11px; height: 11px;"></i> Conjunta</span>`;
  }
  return `<span class="badge" style="background: ${p1Color}22; color: ${p1Color}; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem; display: inline-flex; align-items: center; gap: 4px;" title="Titular: ${escapeHtml(p1Name)}"><i data-lucide="${p1Avatar}" style="width: 11px; height: 11px;"></i> ${escapeHtml(p1Name)}</span>`;
}

function getAccountOwnerLabel(ownerRole) {
  const isCouple = (typeof finance !== 'undefined' && finance.isCoupleEnabled) ? finance.isCoupleEnabled() : true;
  if (!isCouple) return '';
  const couple = (typeof finance !== 'undefined' && finance.getCoupleSettings) ? finance.getCoupleSettings() : null;
  const p1Name = (couple && couple.partner1 && couple.partner1.name) ? couple.partner1.name : 'Você';
  const p2Name = (couple && couple.partner2 && couple.partner2.name) ? couple.partner2.name : 'Parceiro(a)';
  const p1Avatar = (couple && couple.partner1 && couple.partner1.avatar) ? couple.partner1.avatar : 'user';
  const p2Avatar = (couple && couple.partner2 && couple.partner2.avatar) ? couple.partner2.avatar : 'heart';
  if (ownerRole === 'p2') return ` [${getAvatarEmoji(p2Avatar)} ${p2Name}]`;
  if (ownerRole === 'joint') return ` [🏠 Conjunta]`;
  return ` [${getAvatarEmoji(p1Avatar)} ${p1Name}]`;
}

// Sistema de Gerenciamento de Temas (Claro, Escuro e Automático por Horário/SO)
function setupThemeManager() {
  const themeBtns = document.querySelectorAll('.theme-btn');
  const savedTheme = localStorage.getItem('app_theme_mode') || 'auto';
  applyTheme(savedTheme);

  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themeVal);
    });
  });

  if (window.electronAPI && window.electronAPI.onSystemThemeChanged) {
    window.electronAPI.onSystemThemeChanged((sysTheme) => {
      if (currentThemeSetting === 'auto') applyResolvedTheme(sysTheme);
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (currentThemeSetting === 'auto') applyResolvedTheme(e.matches ? 'dark' : 'light');
    });
  }

  // Checagem automática a cada 60s pelo relógio do SO
  setInterval(() => {
    if (currentThemeSetting === 'auto') evaluateAutoTheme();
  }, 60000);
}

function evaluateAutoTheme() {
  const hour = new Date().getHours();
  const isNight = hour >= 18 || hour < 6;
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyResolvedTheme((isNight || prefersDark) ? 'dark' : 'light');
}

function applyTheme(mode) {
  currentThemeSetting = mode;
  localStorage.setItem('app_theme_mode', mode);

  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.themeVal === mode);
  });

  if (mode === 'auto') {
    evaluateAutoTheme();
  } else {
    applyResolvedTheme(mode);
  }
}

function applyResolvedTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateCharts();
}

// Inicialização da Aplicação

// =========================================================================
// --- SUGESTÃO PREDITIVA INTELIGENTE DE CATEGORIAS E AUTOCOMPLETE ---
// =========================================================================
window.applyTxSuggestion = function(desc, catId, accId) {
  const inDesc = document.getElementById('txDesc');
  const inCat = document.getElementById('txCategory');
  const inAcc = document.getElementById('txAccount');
  const cont = document.getElementById('txSuggestionsContainer');
  const badge = document.getElementById('txAutoCategoryBadge');

  if (inDesc) inDesc.value = desc;
  if (inCat && catId) inCat.value = catId;
  if (inAcc && accId) inAcc.value = accId;
  if (cont) cont.style.display = 'none';
  if (badge) {
    badge.innerHTML = '✨ Preenchido com base no histórico!';
    badge.style.display = 'inline-flex';
    setTimeout(() => { if (badge) badge.style.display = 'none'; }, 2400);
  }
  const amt = document.getElementById('txAmount') || document.getElementById('txInstallmentAmount');
  if (amt) amt.focus();
};

window.applySchSuggestion = function(desc, catId, accId) {
  const inDesc = document.getElementById('schDesc');
  const inCat = document.getElementById('schCategory');
  const inAcc = document.getElementById('schAccount');
  const cont = document.getElementById('schSuggestionsContainer');
  const badge = document.getElementById('schAutoCategoryBadge');

  if (inDesc) inDesc.value = desc;
  if (inCat && catId) inCat.value = catId;
  if (inAcc && accId) inAcc.value = accId;
  if (cont) cont.style.display = 'none';
  if (badge) {
    badge.innerHTML = '✨ Preenchido com base no histórico!';
    badge.style.display = 'inline-flex';
    setTimeout(() => { if (badge) badge.style.display = 'none'; }, 2400);
  }
  const amt = document.getElementById('schAmount');
  if (amt) amt.focus();
};

function setupSmartCategorySuggestions() {
  const txDescInput = document.getElementById('txDesc');
  const txSuggestions = document.getElementById('txSuggestionsContainer');
  const txCatBadge = document.getElementById('txAutoCategoryBadge');
  let txDebounce = null;

  if (txDescInput) {
    txDescInput.addEventListener('input', () => {
      clearTimeout(txDebounce);
      txDebounce = setTimeout(() => {
        const query = txDescInput.value.trim();
        if (query.length < 2) {
          if (txSuggestions) txSuggestions.style.display = 'none';
          if (txCatBadge) txCatBadge.style.display = 'none';
          return;
        }

        if (finance && typeof finance.getRecentDescriptionSuggestions === 'function') {
          const suggestions = finance.getRecentDescriptionSuggestions(query, currentTxType, 4);
          if (suggestions.length > 0 && txSuggestions) {
            txSuggestions.innerHTML = suggestions.map(s => {
              const safeDesc = s.description.replace(/"/g, '&quot;').replace(/'/g, "\'");
              return `
                <button type="button" class="tx-suggestion-chip" onclick="window.applyTxSuggestion('${safeDesc}', '${s.categoryId || ''}', '${s.accountId || ''}')" title="Auto-preencher: Categoria ${escapeHtml(s.categoryName)}">
                  <i data-lucide="${s.categoryIcon}"></i>
                  <span>${escapeHtml(s.description)}</span>
                  <span style="color: ${s.categoryColor}; font-size: 0.68rem; opacity: 0.85;">(${escapeHtml(s.categoryName)})</span>
                </button>
              `;
            }).join('');
            txSuggestions.style.display = 'flex';
            if (window.lucide) lucide.createIcons({ root: txSuggestions });
          } else if (txSuggestions) {
            txSuggestions.style.display = 'none';
          }
        }

        if (finance && typeof finance.predictCategoryAndAccount === 'function') {
          const pred = finance.predictCategoryAndAccount(query, currentTxType);
          if (pred && pred.categoryId) {
            const catSelect = document.getElementById('txCategory');
            if (catSelect && catSelect.value !== pred.categoryId) {
              catSelect.value = pred.categoryId;
              if (txCatBadge) {
                txCatBadge.innerHTML = `✨ Categoria "${escapeHtml(pred.categoryName)}" sugerida automaticamente`;
                txCatBadge.style.display = 'inline-flex';
              }
            }
            const accSelect = document.getElementById('txAccount');
            if (accSelect && pred.accountId && (!accSelect.value || accSelect.selectedIndex === 0)) {
              accSelect.value = pred.accountId;
            }
          }
        }
      }, 120);
    });
  }

  const schDescInput = document.getElementById('schDesc');
  const schSuggestions = document.getElementById('schSuggestionsContainer');
  const schCatBadge = document.getElementById('schAutoCategoryBadge');
  let schDebounce = null;

  if (schDescInput) {
    schDescInput.addEventListener('input', () => {
      clearTimeout(schDebounce);
      schDebounce = setTimeout(() => {
        const query = schDescInput.value.trim();
        const schTypeSelect = document.getElementById('schType');
        const schType = schTypeSelect ? schTypeSelect.value : 'expense';

        if (query.length < 2) {
          if (schSuggestions) schSuggestions.style.display = 'none';
          if (schCatBadge) schCatBadge.style.display = 'none';
          return;
        }

        if (finance && typeof finance.getRecentDescriptionSuggestions === 'function') {
          const suggestions = finance.getRecentDescriptionSuggestions(query, schType, 4);
          if (suggestions.length > 0 && schSuggestions) {
            schSuggestions.innerHTML = suggestions.map(s => {
              const safeDesc = s.description.replace(/"/g, '&quot;').replace(/'/g, "\'");
              return `
                <button type="button" class="tx-suggestion-chip" onclick="window.applySchSuggestion('${safeDesc}', '${s.categoryId || ''}', '${s.accountId || ''}')" title="Auto-preencher: Categoria ${escapeHtml(s.categoryName)}">
                  <i data-lucide="${s.categoryIcon}"></i>
                  <span>${escapeHtml(s.description)}</span>
                  <span style="color: ${s.categoryColor}; font-size: 0.68rem; opacity: 0.85;">(${escapeHtml(s.categoryName)})</span>
                </button>
              `;
            }).join('');
            schSuggestions.style.display = 'flex';
            if (window.lucide) lucide.createIcons({ root: schSuggestions });
          } else if (schSuggestions) {
            schSuggestions.style.display = 'none';
          }
        }

        if (finance && typeof finance.predictCategoryAndAccount === 'function') {
          const pred = finance.predictCategoryAndAccount(query, schType);
          if (pred && pred.categoryId) {
            const catSelect = document.getElementById('schCategory');
            if (catSelect && catSelect.value !== pred.categoryId) {
              catSelect.value = pred.categoryId;
              if (schCatBadge) {
                schCatBadge.innerHTML = `✨ Categoria "${escapeHtml(pred.categoryName)}" sugerida automaticamente`;
                schCatBadge.style.display = 'inline-flex';
              }
            }
            const accSelect = document.getElementById('schAccount');
            if (accSelect && pred.accountId && (!accSelect.value || accSelect.selectedIndex === 0)) {
              accSelect.value = pred.accountId;
            }
          }
        }
      }, 120);
    });
  }
}


async function initApp() {
  setupThemeManager();
  setupAppAlertListeners();
  await finance.init();

  setupNavigation();
  setupEntityFilter();
  setupModals();
  setupSmartCategorySuggestions();
  setupOFXImporter();
  setupBackupManager();
  setupCostCentersAndSideHustlesModals();
  setupCoupleModule();
  if (window.syncDeviceIdentityUI) window.syncDeviceIdentityUI();
  populateFormDropdowns();
  window.populateDashboardYearSelect();
  window.syncDashboardPeriodControls();
  renderDashboard();

  if (window.lucide) lucide.createIcons();

  // Auto-exibição do Onboarding na primeira instalação
  setTimeout(() => {
    try {
      const onboardingCompleted = localStorage.getItem('valore_onboarding_completed');
      if (onboardingCompleted !== 'true') {
        if (typeof window.openWelcomeModal === 'function') {
          window.openWelcomeModal(false);
        }
      }
    } catch (e) {
      console.warn('Erro ao verificar status do onboarding:', e);
    }
  }, 450);
}

// Configuração do Seletor de Entidade (Consolidado / PF / PJ)
function setupEntityFilter() {
  const buttons = document.querySelectorAll('.entity-toggle-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const entity = btn.dataset.entity || 'all';
      if (currentEntityFilter === entity) return;
      currentEntityFilter = entity;
      buttons.forEach(b => b.classList.toggle('active', b.dataset.entity === entity));

      const labels = { all: 'Visão Consolidada (PF + PJ)', pf: 'Finanças Pessoais (PF)', pj: 'Negócio / Freela (PJ)' };
      showToast(`Alternado para: ${labels[entity] || entity}`, 'info', 2000);

      renderDashboard();
      if (currentTab === 'transactions') renderTransactionsView();
      if (currentTab === 'accounts') renderAccountsView();
      if (currentTab === 'freedom') renderFreedomView();
      if (currentTab === 'forecast') renderForecastView();
    });
  });
}

// Navegação entre Telas
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn[data-tab]');
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const btnOpenMenu = document.getElementById('btnMobileMenu');
  const btnCloseMenu = document.getElementById('btnCloseMobileSidebar');

  const viewTitles = {
    dashboard: { title: 'Dashboard Financeiro', sub: 'Acompanhamento consolidado de patrimônio e indicadores' },
    transactions: { title: 'Histórico de Transações', sub: 'Extrato completo, transferências e despesas parceladas' },
    schedules: { title: 'Contas Agendadas', sub: 'Calendário de contas a pagar e receber com alertas de vencimento' },
    forecast: { title: 'Projeção de Fluxo de Caixa', sub: 'Simulação diária de saldo futuro para os próximos 30 dias' },
    assets: { title: 'Bens & Financiamentos', sub: 'Controle de patrimônio imobilizado e dívidas de longo prazo' },
    goals: { title: 'Metas & Sonhos', sub: 'Planejamento de objetivos com aportes e progresso visual' },
    freedom: { title: 'Liberdade Financeira (O Norte)', sub: 'Simulador patrimonial e termômetro da sua independência financeira' },
    budgets: { title: 'Planejamento Orçamentário', sub: 'Acompanhamento do teto mensal por categoria (Previsto vs. Realizado)' },
    categories: { title: 'Gestão de Categorias', sub: 'Personalização completa de tipos de receitas e despesas' },
    accounts: { title: 'Bancos & Cartões', sub: 'Gerenciamento de contas correntes, investimentos e faturas' },
    'cost-centers': { title: 'Projetos, Viagens & Eventos', sub: 'Centros de custo dedicados para não misturar com o orçamento fixo' },
    'side-hustles': { title: 'Renda Extra & Projetos Paralelos', sub: 'DRE simplificado para freelas, e-commerce e pequenos negócios' },
    couple: { title: 'Finanças a Dois', sub: 'Gestão de despesas compartilhadas, divisão proporcional e harmonia do lar' }
  };

  function switchTab(tab) {
    currentTab = tab;

    // Atualiza links desktop
    navItems.forEach(i => i.classList.toggle('active', i.dataset.tab === tab));

    // Atualiza barra inferior mobile
    mobileNavBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    // Fecha menu lateral se estiver aberto no celular
    closeMobileDrawer();

    // Fecha gavetas de extrato/detalhes abertas no mobile ao trocar de aba
    if (typeof window.closeAllMobileDetailSheets === 'function') {
      window.closeAllMobileDetailSheets();
    }

    document.querySelectorAll('.view-container').forEach(v => v.style.display = 'none');
    const targetView = document.getElementById(`view-${tab}`);
    if (targetView) targetView.style.display = 'flex';

    const headerInfo = viewTitles[tab] || { title: 'Valore', sub: '' };
    document.getElementById('viewTitle').textContent = headerInfo.title;
    document.getElementById('viewSubtitle').textContent = headerInfo.sub;

    if (tab === 'dashboard') renderDashboard();
    if (tab === 'transactions') renderTransactionsView();
    if (tab === 'schedules') renderSchedulesView();
    if (tab === 'forecast') renderForecastView();
    if (tab === 'assets') renderAssetsView();
    if (tab === 'goals') renderGoalsView();
    if (tab === 'freedom') renderFreedomView();
    if (tab === 'budgets') renderBudgetsView();
    if (tab === 'categories') renderCategoriesView();
    if (tab === 'accounts') renderAccountsView();
    if (tab === 'cost-centers') renderCostCentersView();
    if (tab === 'side-hustles') renderSideHustlesView();
    if (tab === 'couple') renderCoupleView();

    if (window.lucide) lucide.createIcons();
    // Scroll para o topo suavemente ao trocar de tela no mobile
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
  }
  window.switchTab = switchTab;

  navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  mobileNavBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Drawer Mobile (Abrir / Fechar)
  function openMobileDrawer() {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('active');
  }

  function closeMobileDrawer() {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  if (btnOpenMenu) btnOpenMenu.addEventListener('click', openMobileDrawer);
  if (btnCloseMenu) btnCloseMenu.addEventListener('click', closeMobileDrawer);
  if (backdrop) backdrop.addEventListener('click', closeMobileDrawer);

  // Botão "Mais" na barra inferior mobile abre o menu completo
  const btnMobileMore = document.getElementById('btnMobileMore');
  if (btnMobileMore) btnMobileMore.addEventListener('click', openMobileDrawer);

  // Botão Central de Nova Transação no Mobile
  const btnMobileQuickAdd = document.getElementById('btnMobileQuickAdd');
  if (btnMobileQuickAdd) {
    btnMobileQuickAdd.addEventListener('click', () => {
      const btnOpenTx = document.getElementById('btnOpenNewTxModal');
      if (btnOpenTx) btnOpenTx.click();
    });
  }

  const btnViewAll = document.getElementById('btnViewAllTx');
  if (btnViewAll) {
    btnViewAll.addEventListener('click', () => switchTab('transactions'));
  }
}

// Renderização: Dashboard
function renderDashboard() {
  const m = currentDashboardPeriod.month;
  const y = currentDashboardPeriod.year;

  window.syncDashboardPeriodControls();

  const summary = finance.getFinancialSummary(m, y, currentEntityFilter);

  document.getElementById('totalNetWorth').textContent = currencyFormatter.format(summary.netWorth);
  document.getElementById('totalIncome').textContent = currencyFormatter.format(summary.totalIncome);
  document.getElementById('totalExpense').textContent = currencyFormatter.format(summary.totalExpense);
  document.getElementById('pendingAlertsValue').textContent = summary.pendingSchedulesCount;

  // Atualiza badge de Liberdade Financeira no card de Patrimônio
  const freedomBadge = document.getElementById('netWorthFreedomBadge');
  if (freedomBadge) {
    try {
      const fire = finance.getFireCalculation();
      freedomBadge.textContent = `🎯 ${fire.progressPercent}% Rumo à Liberdade ➔`;
    } catch (e) {
      freedomBadge.textContent = '🎯 Rumo à Liberdade ➔';
    }
  }

  const expenseSubtitle = document.getElementById('expenseFooterSubtitle');
  if (expenseSubtitle) {
    if (summary.pendingBillsExpense > 0) {
      expenseSubtitle.innerHTML = `<span style="color: var(--text-main); font-weight: 600;">${currencyFormatter.format(summary.paidExpense)}</span> pagos • <span style="color: #f59e0b; font-weight: 600;">${currencyFormatter.format(summary.pendingBillsExpense)}</span> em boletos a vencer`;
    } else {
      expenseSubtitle.textContent = `${currencyFormatter.format(summary.paidExpense)} em compras e saídas`;
    }
  }

  const overdueBadge = document.getElementById('overdueBadgeText');
  if (summary.overdueCount > 0) {
    overdueBadge.textContent = `⚠️ ${summary.overdueCount} conta(s) em atraso!`;
    overdueBadge.style.color = 'var(--danger)';
  } else {
    overdueBadge.textContent = `✅ Todas as contas em dia`;
    overdueBadge.style.color = 'var(--success)';
  }

  renderSalaryAlerts();
  renderRecentTransactions();
  updateCharts();
  renderMonthlyAuditReport();
}

function renderRecentTransactions() {
  const tbody = document.getElementById('recentTxTableBody');
  if (!tbody) return;

  const m = currentDashboardPeriod.month;
  const y = currentDashboardPeriod.year;
  const monthName = monthNamesLong[m - 1] || '';

  // Filtra as transações correspondentes ao mês/ano e ao filtro de entidade (PF / PJ / Consolidado)
  const monthTxs = finance.state.transactions.filter(t => {
    const inM = finance._inMonth(t.date, m, y);
    if (!inM) return false;
    if (currentEntityFilter === 'all') return true;
    return (t.entityType || 'pf') === currentEntityFilter;
  });

  if (monthTxs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.25rem 1rem;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.45rem;">
        <span style="font-size: 1.6rem;">📅</span>
        <span style="font-weight: 600; color: var(--text-main);">Nenhuma transação registrada em ${monthName} de ${y}</span>
        <span style="font-size: 0.82rem;">Clique no botão "+ Nova Transação" acima para lançar despesas ou receitas neste período.</span>
      </div>
    </td></tr>`;
    return;
  }

  // Exibe as movimentações mais recentes do período selecionado
  const recent = monthTxs.slice(0, 7);
  tbody.innerHTML = recent.map(tx => renderTransactionRow(tx)).join('');
  if (window.lucide) lucide.createIcons();
}

let currentTxDisplayLimit = 50;
let currentTxAuthorFilter = 'all';

window.setTxAuthorFilter = function(author) {
  currentTxAuthorFilter = author || 'all';
  currentTxDisplayLimit = 50;
  document.querySelectorAll('#txAuthorFilterGroup button').forEach(btn => {
    const isAct = btn.getAttribute('data-author-filter') === currentTxAuthorFilter;
    btn.classList.toggle('active', isAct);
    if (isAct) {
      if (currentTxAuthorFilter === 'p2') {
        btn.style.background = '#ec4899';
        btn.style.color = '#fff';
      } else {
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text-secondary)';
    }
  });
  renderTransactionsView();
};

function renderTransactionsView() {
  const tbody = document.getElementById('allTxTableBody');
  const searchInput = document.getElementById('txSearchInput');
  const btnClear = document.getElementById('btnClearTxSearch');
  const searchRaw = searchInput ? (searchInput.value || '') : '';
  const search = searchRaw.toLowerCase().trim();

  if (btnClear) {
    btnClear.style.display = search ? 'inline-flex' : 'none';
  }

  // Sincroniza nomes dos parceiros nos botões de filtro de autor
  const couple = finance.getCoupleSettings();
  const p1Name = (couple && couple.partner1 && couple.partner1.name) ? couple.partner1.name : 'Você';
  const p2Name = (couple && couple.partner2 && couple.partner2.name) ? couple.partner2.name : 'Esposa / Parceiro(a)';
  const btnFilterP1 = document.getElementById('btnFilterAuthorP1');
  const btnFilterP2 = document.getElementById('btnFilterAuthorP2');
  if (btnFilterP1) btnFilterP1.textContent = `👤 ${p1Name}`;
  if (btnFilterP2) btnFilterP2.textContent = `❤️ ${p2Name}`;

  let p1Count = 0, p2Count = 0, p1Total = 0, p2Total = 0;
  finance.state.transactions.forEach(t => {
    const matchEntity = currentEntityFilter === 'all' || (t.entityType || 'pf') === currentEntityFilter;
    if (!matchEntity) return;
    const author = finance.getEntityAuthorInfo(t);
    if (author.role === 'p2') {
      p2Count++;
      if (t.type === 'expense') p2Total += Number(t.amount || 0);
    } else {
      p1Count++;
      if (t.type === 'expense') p1Total += Number(t.amount || 0);
    }
  });

  const summarySub = document.getElementById('txAuthorSummarySub');
  if (summarySub) {
    summarySub.innerHTML = `<span style="color: #3b82f6; font-weight: 700;">● ${escapeHtml(p1Name)}:</span> ${p1Count} lançamentos &nbsp;|&nbsp; <span style="color: #ec4899; font-weight: 700;">● ${escapeHtml(p2Name)}:</span> ${p2Count} lançamentos`;
  }

  const filtered = finance.state.transactions.filter(t => {
    const matchEntity = currentEntityFilter === 'all' || (t.entityType || 'pf') === currentEntityFilter;
    if (!matchEntity) return false;
    if (currentTxAuthorFilter !== 'all') {
      const author = finance.getEntityAuthorInfo(t);
      if (author.role !== currentTxAuthorFilter) return false;
    }
    return t.description.toLowerCase().includes(search) || (t.notes && t.notes.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    currentTxDisplayLimit = 50;
    if (search) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">Nenhuma movimentação localizada para <b>"${searchRaw}"</b>.<br><button type="button" class="btn btn-outline" style="margin-top: 0.75rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.4rem;" onclick="document.getElementById('txSearchInput').value=''; currentTxDisplayLimit=50; renderTransactionsView();"><i data-lucide='x'></i> Limpar Busca</button></td></tr>`;
      if (window.lucide) lucide.createIcons({ root: tbody });
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma transação cadastrada${currentEntityFilter !== 'all' ? ` para este contexto (${currentEntityFilter.toUpperCase()})` : ''}.</td></tr>`;
    }
    return;
  }

  const visibleList = filtered.slice(0, currentTxDisplayLimit);
  let rowsHtml = visibleList.map(tx => renderTransactionRow(tx)).join('');

  if (filtered.length > currentTxDisplayLimit) {
    rowsHtml += `
      <tr class="tx-load-more-row">
        <td colspan="6" style="text-align: center; padding: 1.25rem; background: var(--bg-surface);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem;">
            <span style="font-size: 0.78rem; color: var(--text-muted);">Exibindo <b>${visibleList.length}</b> de <b>${filtered.length}</b> lançamentos</span>
            <button type="button" class="btn btn-outline" style="font-size: 0.82rem; padding: 0.45rem 1.15rem; gap: 0.45rem;" onclick="window.loadMoreTransactions()">
              <i data-lucide="chevron-down" style="width: 15px; height: 15px;"></i>
              <span>Carregar mais lançamentos (+50)</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = rowsHtml;
  if (window.lucide) lucide.createIcons({ root: tbody });
}

window.loadMoreTransactions = function() {
  currentTxDisplayLimit += 50;
  renderTransactionsView();
};

function getCategoryBadgeHtml(cat) {
  if (!cat) return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted); font-weight: 600;">Geral</span>`;
  const iconName = cat.icon || 'tag';
  const color = cat.color || '#6366f1';
  return `
    <span class="badge badge-cat" style="background: ${color}18; color: ${color}; border: 1px solid ${color}35; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; padding: 0.22rem 0.6rem; border-radius: 999px;">
      <i data-lucide="${iconName}" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
      <span>${escapeHtml(cat.name)}</span>
    </span>
  `;
}

function renderTransactionRow(tx) {
  const isTransfer = tx.type === 'transfer';
  const isIncome = tx.type === 'income';

  let accountLabel = '';
  let acc = null;
  if (isTransfer) {
    const from = finance.state.accounts.find(a => a.id === tx.fromAccountId) || { name: 'Conta' };
    const to = finance.state.accounts.find(a => a.id === tx.toAccountId) || { name: 'Conta' };
    accountLabel = `${from.name} ➔ ${to.name}`;
  } else {
    acc = finance.state.accounts.find(a => a.id === tx.accountId) || { name: 'Principal' };
    accountLabel = acc.name;
  }

  const cat = finance.state.categories.find(c => c.id === tx.categoryId) || { name: isTransfer ? 'Transferência' : 'Geral', color: '#8b5cf6' };

  const cleanDescription = (tx.installmentTotal > 1) 
    ? (tx.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '') 
    : tx.description;

  const isVaultTx = tx.isVaultAllocation || (tx.description && tx.description.startsWith('[Cofrinho'));
  const authorInfo = finance.getEntityAuthorInfo(tx);

  return `
    <tr class="tx-row">
      <td class="tx-cell-desc">
        <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
          <span style="font-weight: 600;">${cleanDescription}</span>
          <span class="author-badge ${authorInfo.role === 'p2' ? 'author-p2' : 'author-p1'}" title="Inserido por ${escapeHtml(authorInfo.name)} via ${authorInfo.deviceLabel}">
            ${authorInfo.deviceIcon} ${escapeHtml(authorInfo.name)}
          </span>
          ${tx.installmentTotal > 1 ? `
            <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #a855f7; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Compra parcelada em ${tx.installmentTotal}x">
              <i data-lucide="credit-card" style="width: 10px; height: 10px;"></i> ${tx.installmentIndex}/${tx.installmentTotal}
            </span>
          ` : ''}
          ${(acc && acc.type === 'credit') ? `
            <span class="badge" style="background: rgba(99, 102, 241, 0.12); color: #818cf8; font-size: 0.68rem; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.25);" title="Fatura de vencimento">
              <i data-lucide="receipt" style="width: 10px; height: 10px;"></i> ${finance.getInvoiceInfoForDate(tx.date, acc.closingDay, acc.dueDay).label}
            </span>
          ` : ''}
          ${(tx.recurring === 'monthly' || tx.recurring === 'yearly') ? `
            <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: var(--primary); font-size: 0.68rem; padding: 0.1rem 0.4rem;" title="Assinatura / Despesa Recorrente na Fatura">
              ↻ ${tx.recurring === 'monthly' ? 'Mensal' : 'Anual'}
            </span>
          ` : ''}
          ${tx.isShared ? `
            <span class="couple-badge-tag ${tx.paidBy === 'p1' ? 'couple-badge-p1' : 'couple-badge-p2'}" title="Despesa compartilhada do casal (${tx.settled ? 'Já quitada' : 'Pendente de acerto'})">
              💍 Casal ${tx.settled ? '✔' : '⏳'}
            </span>
          ` : ''}
        </div>
        ${tx.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">${tx.notes}</div>` : ''}
      </td>
      <td class="tx-cell-cat">
        ${isVaultTx ? `
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="piggy-bank" style="width: 12px; height: 12px;"></i> Cofrinho / Reserva
          </span>
        ` : getCategoryBadgeHtml(cat)}
      </td>
      <td class="tx-cell-acc">
        <span class="tx-account-name">${accountLabel}</span>
      </td>
      <td class="tx-cell-date">${formatDateBR(tx.date)}</td>
      <td class="tx-cell-amount ${isVaultTx ? '' : (isTransfer ? '' : (isIncome ? 'amount-income' : 'amount-expense'))}" style="text-align: right; ${isVaultTx ? 'color: #10b981; font-weight: 600;' : ''}">
        ${isVaultTx ? '🔒 ' : (isTransfer ? '' : (isIncome ? '+' : '-'))} ${currencyFormatter.format(tx.amount)}
      </td>
      <td class="tx-cell-actions td-actions">
        <div class="table-actions-container">
          ${isIncome && !tx.isVaulted ? `
            <button onclick="handleCreateVaultFromTx('${tx.id}')" class="btn-action-icon" style="color: var(--success);" title="Separar este valor e criar Cofrinho com o nome '${(tx.description || '').replace(/'/g, "\\'")}'">
              <i data-lucide="piggy-bank" style="width: 16px; height: 16px;"></i>
            </button>
          ` : (tx.isVaulted ? `
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.65rem; padding: 0.12rem 0.35rem; display: inline-flex; align-items: center; gap: 3px;" title="Saldo guardado no Cofrinho">
              <i data-lucide="piggy-bank" style="width: 11px; height: 11px;"></i> Cofrinho
            </span>
          ` : '')}
          <button onclick="handleToggleReconciled('${tx.id}')" class="btn-action-icon" style="color: ${tx.reconciled ? 'var(--success)' : 'var(--text-muted)'};" title="${tx.reconciled ? 'Transação Conciliada no Banco' : 'Marcar como Conciliada (Conferida)'}">
            <i data-lucide="${tx.reconciled ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px;"></i>
          </button>
          <button onclick="handleEditTx('${tx.id}')" class="btn-action-icon" style="color: var(--primary);" title="Editar Transação">
            <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
          </button>
          <button onclick="handleDeleteTx('${tx.id}')" class="btn-action-icon" style="color: var(--danger);" title="Excluir">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Renderização: Agendamentos (Contas a Pagar & Receber)
function renderSchedulesView() {
  const tbody = document.getElementById('schedulesTableBody');
  const schedules = finance.state.schedules;
  const today = localDateStr();

  if (schedules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma conta agendada. Cadastre seus boletos, faturas e recebimentos futuros.</td></tr>`;
    return;
  }

  tbody.innerHTML = schedules.map(s => {
    const isPaid = s.status === 'paid';
    const isOverdue = !isPaid && s.dueDate < today;
    const isIncome = s.type === 'income';

    let statusBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success);">Pago</span>';
    if (!isPaid) {
      if (isOverdue) {
        statusBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger);">Atrasado</span>';
      } else {
        statusBadge = '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--warning);">Pendente</span>';
      }
    }

    const actionBtnText = isIncome ? 'Confirmar Recebimento' : 'Pagar';
    const actionBtnIcon = isIncome ? 'arrow-down-left' : 'check';
    let recurrenceLabel = 'Única';
    if (s.dayRule === '5th_business_clt') recurrenceLabel = '5º Dia Útil CLT (Mensal)';
    else if (s.dayRule === '5th_business') recurrenceLabel = '5º Dia Útil Bancário (Mensal)';
    else if (s.dayRule === '1st_business') recurrenceLabel = '1º Dia Útil (Mensal)';
    else if (s.dayRule === 'last_business') recurrenceLabel = 'Último Dia Útil (Mensal)';
    else if (s.recurring === 'monthly') recurrenceLabel = 'Mensal';
    else if (s.recurring === 'yearly') recurrenceLabel = 'Anual';

    const sAuthorInfo = finance.getEntityAuthorInfo(s);
    const sCat = finance.state.categories.find(c => c.id === s.categoryId);

    return `
      <tr class="tx-row">
        <td>
          <div style="font-weight: 600; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span>${s.description}</span>
            ${sCat ? getCategoryBadgeHtml(sCat) : ''}
            <span class="author-badge ${sAuthorInfo.role === 'p2' ? 'author-p2' : 'author-p1'}" title="Inserido por ${escapeHtml(sAuthorInfo.name)} via ${sAuthorInfo.deviceLabel}">
              ${sAuthorInfo.deviceIcon} ${escapeHtml(sAuthorInfo.name)}
            </span>
            ${isIncome ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.68rem; padding: 0.1rem 0.4rem;">Receita</span>` : ''}
          </div>
        </td>
        <td>${isIncome ? 'Recebimento (Proventos)' : 'Pagamento (Despesa)'}</td>
        <td>${formatDateBR(s.dueDate)}</td>
        <td>${recurrenceLabel}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right; font-weight: 700;" class="${isIncome ? 'amount-income' : 'amount-expense'}">
          ${isIncome ? '+ ' : '- '}${currencyFormatter.format(s.amount)}
        </td>
        <td class="td-actions">
          <div class="table-actions-container">
            ${!isPaid ? `
              <button onclick="handleOpenPayBill('${s.id}')" class="btn btn-outline" style="padding: 0.3rem 0.55rem; font-size: 0.75rem; color: ${isIncome ? 'var(--success)' : 'inherit'}; border-color: ${isIncome ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'};" title="${isIncome ? 'Confirmar entrada do recebimento na conta' : 'Pagar e dar baixa'}">
                <i data-lucide="${actionBtnIcon}" style="width: 14px; height: 14px;"></i> ${actionBtnText}
              </button>
            ` : ''}
            <button onclick="handleEditSchedule('${s.id}')" class="btn-action-icon" style="color: var(--primary);" title="Editar Agendamento">
              <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
            </button>
            <button onclick="handleDeleteSchedule('${s.id}')" class="btn-action-icon" style="color: var(--danger);" title="Excluir">
              <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderSalaryAlerts();
  if (window.lucide) lucide.createIcons();
}

// Renderização e Inteligência de Alertas de Salário / Recebimentos
const dismissedSalaryAlerts = new Set();

function renderSalaryAlerts() {
  const alerts = finance.getSalaryIncomeInsights ? finance.getSalaryIncomeInsights() : [];
  const activeAlerts = alerts.filter(a => (a.isToday || a.isPast || a.isSoon) && !dismissedSalaryAlerts.has(a.id));

  const dashContainer = document.getElementById('salaryAlertsDashboardContainer');
  const schContainer = document.getElementById('salaryAlertsScheduleContainer');

  const buildHtml = (isDashboard = true) => {
    if (activeAlerts.length === 0) return '';

    return activeAlerts.map(a => {
      const isToday = a.isToday;
      const isPast = a.isPast;
      const alertClass = isToday ? 'salary-alert-today' : (isPast ? 'salary-alert-past' : 'salary-alert-soon');
      const badgeColor = isToday ? 'var(--success)' : (isPast ? 'var(--warning)' : 'var(--primary)');
      const badgeText = isToday ? 'Previsto Para HOJE' : (isPast ? 'Pendente de Confirmação' : `Em ${a.daysUntilDue} dias`);

      return `
        <div class="salary-alert-banner ${alertClass}">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: center; color: var(--success); font-size: 1.35rem; flex-shrink: 0;">
                💰
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-main);">${a.alertTitle}</h4>
                  <span class="badge" style="background: var(--bg-tertiary); color: ${badgeColor}; font-size: 0.72rem; font-weight: 700; border: 1px solid var(--border-color);">${badgeText}</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted); background: var(--bg-tertiary); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-color);">${a.ruleDesc}</span>
                </div>
                <p style="margin: 0.25rem 0 0; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.4;">
                  ${a.alertMessage}
                </p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="text-align: right;">
                <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Valor Previsto</span>
                <span style="font-size: 1.3rem; font-weight: 800; color: var(--success);">${currencyFormatter.format(a.amount)}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: var(--text-muted);">
              <i data-lucide="building-2" style="width: 14px; height: 14px;"></i>
              <span>Destino: <strong>${a.accountName}</strong></span>
              <span>•</span>
              <span>Data de cálculo: <strong>${a.dueDateFormatted}</strong></span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <button onclick="handleDismissSalaryAlert('${a.id}')" class="btn btn-outline" style="padding: 0.35rem 0.8rem; font-size: 0.78rem;">
                Ainda não recebi
              </button>
              <button onclick="handleOpenPayBill('${a.id}')" class="btn btn-success" style="padding: 0.35rem 1rem; font-size: 0.82rem; gap: 0.45rem; font-weight: 600;">
                <i data-lucide="check-circle-2" style="width: 15px; height: 15px;"></i>
                <span>Sim, já recebi! (Lançar na Conta)</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  if (dashContainer) {
    dashContainer.innerHTML = buildHtml(true);
  }
  if (schContainer) {
    schContainer.innerHTML = buildHtml(false);
  }

  if (window.lucide) lucide.createIcons();
}

window.handleDismissSalaryAlert = function(id) {
  dismissedSalaryAlerts.add(id);
  renderSalaryAlerts();
};

// Renderização: Projeção de Fluxo de Caixa Futuro
function renderForecastView() {
  const forecastData = finance.getCashFlowForecast(30);
  const ctx = document.getElementById('cashFlowForecastChart');
  if (!ctx) return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

  if (forecastChartInstance) forecastChartInstance.destroy();

  forecastChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: forecastData.map(f => f.dayLabel),
      datasets: [{
        label: 'Saldo Projetado (R$)',
        data: forecastData.map(f => f.balance),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      },
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Saldo Previsto: ${currencyFormatter.format(ctx.raw)}`
          }
        }
      }
    }
  });

  // Renderiza Inteligência de Comprometimento de Renda & Parcelamentos Futuros
  renderIncomeCommitmentSection(isDark, textColor, gridColor);
}

function renderIncomeCommitmentSection(isDark, textColor, gridColor) {
  const commitmentData = finance.getIncomeCommitmentForecast(12);

  // 1. Atualiza Métricas Numéricas
  const estIncEl = document.getElementById('cmmtEstimatedIncome');
  const totalCmmtEl = document.getElementById('cmmtTotalCommitted');
  const avgCmmtEl = document.getElementById('cmmtAvgCommitment');
  const peakMonthEl = document.getElementById('cmmtPeakMonth');
  const peakAmountEl = document.getElementById('cmmtPeakAmount');
  const riskBadgeEl = document.getElementById('commitmentRiskSummaryBadge');
  const activeBadgeEl = document.getElementById('activeInstallmentsBadge');

  if (estIncEl) estIncEl.textContent = currencyFormatter.format(commitmentData.estimatedMonthlyIncome);
  if (totalCmmtEl) totalCmmtEl.textContent = currencyFormatter.format(commitmentData.totalFutureCommitted);
  if (avgCmmtEl) {
    avgCmmtEl.textContent = `${commitmentData.avg6MonthsCommitment}%`;
    if (commitmentData.avg6MonthsCommitment > 50) avgCmmtEl.style.color = 'var(--danger)';
    else if (commitmentData.avg6MonthsCommitment >= 30) avgCmmtEl.style.color = '#f59e0b';
    else avgCmmtEl.style.color = 'var(--primary)';
  }
  if (peakMonthEl) peakMonthEl.textContent = commitmentData.peakCommitmentMonth || 'Nenhum';
  if (peakAmountEl) peakAmountEl.textContent = commitmentData.peakCommitmentAmount > 0 
    ? `Fatura pico: ${currencyFormatter.format(commitmentData.peakCommitmentAmount)}`
    : 'Sem parcelamentos pendentes';

  if (riskBadgeEl) {
    if (!commitmentData.hasCreditCards) {
      riskBadgeEl.innerHTML = `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted); font-size: 0.78rem;">Nenhum cartão cadastrado</span>`;
    } else if (commitmentData.avg6MonthsCommitment > 50) {
      riskBadgeEl.innerHTML = `<span class="badge" style="background: rgba(239, 68, 68, 0.18); color: var(--danger); font-size: 0.8rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px;">⚠️ Alto Comprometimento (>50% da Renda)</span>`;
    } else if (commitmentData.avg6MonthsCommitment >= 30) {
      riskBadgeEl.innerHTML = `<span class="badge" style="background: rgba(245, 158, 11, 0.18); color: #f59e0b; font-size: 0.8rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px;">⚡ Nível de Atenção (30% - 50% da Renda)</span>`;
    } else {
      riskBadgeEl.innerHTML = `<span class="badge" style="background: rgba(16, 185, 129, 0.18); color: var(--success); font-size: 0.8rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px;">✅ Renda Sob Controle (<30% Comprometido)</span>`;
    }
  }

  // 2. Renderiza Gráfico Misto (Barras de Faturas + Linha de % da Renda)
  const chartCanvas = document.getElementById('incomeCommitmentChart');
  if (chartCanvas) {
    if (incomeCommitmentChartInstance) incomeCommitmentChartInstance.destroy();

    const labels = commitmentData.monthlyProjection.map(p => p.label);
    const invoicesAmounts = commitmentData.monthlyProjection.map(p => p.totalInvoiceAmount);
    const commitmentPercents = commitmentData.monthlyProjection.map(p => p.commitmentPercent);

    incomeCommitmentChartInstance = new Chart(chartCanvas, {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: 'Total Faturas (R$)',
            data: invoicesAmounts,
            backgroundColor: commitmentData.monthlyProjection.map(p => {
              if (p.commitmentPercent > 50) return 'rgba(239, 68, 68, 0.75)';
              if (p.commitmentPercent >= 30) return 'rgba(245, 158, 11, 0.75)';
              return 'rgba(168, 85, 247, 0.75)';
            }),
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: '% Renda Comprometida',
            data: commitmentPercents,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: 2.5,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: {
            type: 'linear',
            position: 'left',
            ticks: {
              color: textColor,
              callback: (val) => currencyFormatter.format(val)
            },
            grid: { color: gridColor }
          },
          y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            ticks: {
              color: textColor,
              callback: (val) => `${val}%`
            },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === 'y1') {
                  return ` % Comprometido: ${ctx.raw}% da renda`;
                }
                return ` Faturas Previstas: ${currencyFormatter.format(ctx.raw)}`;
              }
            }
          }
        }
      }
    });
  }

  // 3. Renderiza Tabela de Compras Parceladas Ativas
  const tableBody = document.getElementById('activeInstallmentsTableBody');
  if (tableBody) {
    if (activeBadgeEl) activeBadgeEl.textContent = `${commitmentData.activeInstallmentPlans.length} ativas`;

    if (commitmentData.activeInstallmentPlans.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.75rem;">
            Nenhuma compra parcelada ativa no momento. Você está livre de parcelamentos futuros! 🎉
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = commitmentData.activeInstallmentPlans.map(plan => {
        const remainingMonths = plan.totalInstallments - plan.paidInstallments;
        return `
          <tr class="tx-installment-card" style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 0.55rem 0.75rem; font-weight: 600; color: var(--text-main);">
              <span>${escapeHtml(plan.description)}</span>
            </td>
            <td style="padding: 0.55rem 0.75rem; color: var(--text-secondary); white-space: nowrap;">
              <span class="mobile-only-inline" style="font-size: 0.75rem; color: var(--text-muted);">Cartão:</span>
              <span>💳 ${escapeHtml(plan.accountName)}</span>
            </td>
            <td style="padding: 0.55rem 0.75rem; min-width: 140px; flex-direction: column; align-items: stretch !important;">
              <div style="display: flex; justify-content: space-between; font-size: 0.73rem; margin-bottom: 0.2rem; color: var(--text-muted); width: 100%;">
                <span>Parcela <b>${plan.paidInstallments} de ${plan.totalInstallments}</b></span>
                <span>${plan.progressPercent}%</span>
              </div>
              <div style="height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 999px; overflow: hidden; width: 100%;">
                <div style="width: ${plan.progressPercent}%; height: 100%; background: #a855f7; border-radius: 999px;"></div>
              </div>
            </td>
            <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 600; color: var(--text-main); white-space: nowrap;">
              <span class="mobile-only-inline" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Valor / Mês:</span>
              <span>${currencyFormatter.format(plan.amountPerInstallment)}</span>
            </td>
            <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; color: #a855f7; white-space: nowrap;">
              <span class="mobile-only-inline" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Saldo Restante:</span>
              <div style="text-align: right;">
                ${currencyFormatter.format(plan.remainingAmount)}
                <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 400;">(${remainingMonths}x restantes)</div>
              </div>
            </td>
            <td style="padding: 0.55rem 0.75rem; text-align: center; color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">
              <span class="mobile-only-inline" style="font-size: 0.75rem; color: var(--text-muted);">Término:</span>
              <span>${plan.endMonthLabel ? `Até ${plan.endMonthLabel}` : '-'}</span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

// Renderização: Bens Patrimoniais & Financiamentos
function renderAssetsView() {
  const container = document.getElementById('assetsGridContainer');
  const assets = finance.state.assets;

  if (assets.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum bem cadastrado. Clique em "+ Cadastrar Bem" para acompanhar imóveis, carros ou dívidas.</div>`;
    return;
  }

  container.innerHTML = assets.map(a => {
    const equity = a.estimatedValue - a.financedValue;
    const progress = a.installmentsTotal > 0 ? Math.round((a.installmentsPaid / a.installmentsTotal) * 100) : 100;

    return `
      <div class="goal-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h4 style="font-size: 1.1rem; font-weight: 700;">${a.name}</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${a.type === 'property' ? 'Imóvel' : 'Veículo'}</span>
          </div>
          <button onclick="handleDeleteAsset('${a.id}')" style="background: none; border: none; cursor: pointer; color: var(--danger);">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Valor de Mercado:</span>
            <b>${currencyFormatter.format(a.estimatedValue)}</b>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Saldo Financiado:</span>
            <span style="color: var(--danger); font-weight: 600;">- ${currencyFormatter.format(a.financedValue)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 0.35rem;">
            <span style="color: var(--text-secondary);">Patrimônio Líquido:</span>
            <span style="color: var(--success); font-weight: 700;">${currencyFormatter.format(equity)}</span>
          </div>
        </div>

        ${a.installmentsTotal > 0 ? `
          <div style="margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.25rem;">
              <span>Amortização das parcelas:</span>
              <span>${a.installmentsPaid} de ${a.installmentsTotal} (${progress}%)</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${progress}%;"></div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Estado de Filtro e Histórico de Metas
let currentGoalsFilter = 'all'; // 'all' | 'active' | 'completed'
const expandedGoalHistorySet = new Set();

// Renderização: Metas & Sonhos (Com métricas consolidadas, cálculo de ritmo, filtros e ações)
function renderGoalsView() {
  const container = document.getElementById('goalsGridContainer');
  if (!container) return;

  // Atualiza métricas consolidadas no topo
  const summary = finance.getGoalsSummary();
  const elSaved = document.getElementById('goalsTotalSaved');
  const elSavedSub = document.getElementById('goalsTotalSavedSub');
  const elTarget = document.getElementById('goalsTotalTarget');
  const elTargetSub = document.getElementById('goalsTotalTargetSub');
  const elPct = document.getElementById('goalsOverallPct');
  const elBar = document.getElementById('goalsOverallBar');
  const elCompCount = document.getElementById('goalsCompletedCount');
  const elActiveCount = document.getElementById('goalsActiveCountText');

  if (elSaved) elSaved.textContent = currencyFormatter.format(summary.totalSaved);
  if (elSavedSub) elSavedSub.textContent = `Faltam ${currencyFormatter.format(summary.totalRemaining)} para a meta global`;
  if (elTarget) elTarget.textContent = currencyFormatter.format(summary.totalTarget);
  if (elTargetSub) elTargetSub.textContent = `${summary.totalGoals} sonhos planejados no total`;
  if (elPct) elPct.textContent = `${summary.overallPercentage}%`;
  if (elBar) elBar.style.width = `${summary.overallPercentage}%`;
  if (elCompCount) elCompCount.textContent = `${summary.completedCount}`;
  if (elActiveCount) elActiveCount.textContent = `${summary.activeCount} meta(s) em andamento`;

  // Atualiza estado visual dos botões de filtro
  const btnAll = document.getElementById('btnFilterAllGoals');
  const btnActive = document.getElementById('btnFilterActiveGoals');
  const btnCompleted = document.getElementById('btnFilterCompletedGoals');
  if (btnAll) btnAll.className = currentGoalsFilter === 'all' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnActive) btnActive.className = currentGoalsFilter === 'active' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnCompleted) btnCompleted.className = currentGoalsFilter === 'completed' ? 'btn btn-primary' : 'btn btn-outline';

  // Aplica filtro ativo
  let goals = finance.state.goals || [];
  if (currentGoalsFilter === 'active') {
    goals = goals.filter(g => !g.completed && g.currentAmount < g.targetAmount);
  } else if (currentGoalsFilter === 'completed') {
    goals = goals.filter(g => g.completed || g.currentAmount >= g.targetAmount);
  }

  // Estado Vazio Amigável
  if (goals.length === 0) {
    let emptyMsg = 'Nenhuma meta ou sonho cadastrado. Comece a planejar seus objetivos!';
    if (currentGoalsFilter === 'active') emptyMsg = 'Nenhuma meta em andamento no momento.';
    if (currentGoalsFilter === 'completed') emptyMsg = 'Nenhum sonho concluído ainda. Continue aportando para conquistar suas metas!';

    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem 1.5rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
        <div style="font-size: 2.2rem; margin-bottom: 0.6rem;">🎯</div>
        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">${emptyMsg}</div>
        <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">Defina objetivos com valor alvo, prazo e acompanhe o ritmo de poupança necessário.</p>
        <button class="btn btn-primary" onclick="handleOpenNewGoalModal()" style="margin: 0 auto;">
          <i data-lucide="plus-circle"></i> Criar Nova Meta
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const categoryEmojiMap = {
    travel: '✈️',
    vehicle: '🚗',
    house: '🏠',
    education: '🎓',
    wedding: '💍',
    emergency: '🛡️',
    tech: '💻',
    retirement: '📈',
    other: '🎯'
  };

  const categoryNameMap = {
    travel: 'Viagem & Férias',
    vehicle: 'Carro / Veículo',
    house: 'Casa / Reforma',
    education: 'Estudos / Formação',
    wedding: 'Casamento / Família',
    emergency: 'Reserva de Emergência',
    tech: 'Equipamentos & Tech',
    retirement: 'Aposentadoria / Investimentos',
    other: 'Outro Objetivo'
  };

  container.innerHTML = goals.map(g => {
    const pace = finance.calculateGoalPace(g);
    const percent = pace.progressPercent;
    const isCompleted = pace.isCompleted;
    const emoji = categoryEmojiMap[g.category || 'other'] || '🎯';
    const catName = categoryNameMap[g.category || 'other'] || 'Objetivo';
    const goalColor = g.color || '#3b82f6';
    const linkedAcc = g.accountId ? finance.state.accounts.find(a => a.id === g.accountId) : null;
    const history = Array.isArray(g.history) ? g.history : [];
    const isHistoryExpanded = expandedGoalHistorySet.has(g.id);

    let paceBadgeHtml = '';
    if (isCompleted) {
      paceBadgeHtml = `
        <div class="goal-pace-badge pace-completed">
          <i data-lucide="trophy" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
          <span><b>100% Concluído!</b> Parabéns pela conquista deste sonho!</span>
        </div>
      `;
    } else if (pace.isExpired) {
      paceBadgeHtml = `
        <div class="goal-pace-badge pace-expired">
          <i data-lucide="alert-triangle" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
          <span><b>Prazo Expirado!</b> Faltam ${currencyFormatter.format(pace.remainingAmount)}. Ajuste a data ou conclua a meta.</span>
        </div>
      `;
    } else {
      paceBadgeHtml = `
        <div class="goal-pace-badge">
          <i data-lucide="sparkles" style="width: 18px; height: 18px; color: var(--primary); flex-shrink: 0;"></i>
          <div>
            <span>💡 Ritmo sugerido: <b>${currencyFormatter.format(pace.recommendedMonthlyPace)}/mês</b> (~${currencyFormatter.format(pace.recommendedDailyPace)}/dia)</span>
            <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 0.15rem;">
              ⏳ Restam <b>${pace.daysRemaining} dias</b> (${pace.monthsRemaining} meses) até ${formatDateBR(g.deadline)}
            </div>
          </div>
        </div>
      `;
    }

    const historyItemsHtml = history.length > 0 ? `
      <div style="margin-top: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.35rem;">
          <span>Histórico de Movimentações (${history.length}):</span>
          <button onclick="handleToggleGoalHistory('${g.id}')" style="background: none; border: none; cursor: pointer; color: var(--primary); font-size: 0.75rem; text-decoration: underline;">
            ${isHistoryExpanded ? 'Ocultar' : 'Ver Detalhes'}
          </button>
        </div>
        ${isHistoryExpanded ? `
          <div class="goal-history-list">
            ${history.slice(-6).reverse().map(h => {
              const isDeposit = h.type === 'deposit';
              return `
                <div class="goal-history-item">
                  <div>
                    <span style="font-weight: 600; color: ${isDeposit ? 'var(--success)' : 'var(--danger)'};">
                      ${isDeposit ? '+ ' : '- '}${currencyFormatter.format(h.amount)}
                    </span>
                    <span style="color: var(--text-muted); margin-left: 0.4rem; font-size: 0.72rem;">${formatDateBR(h.date)}</span>
                  </div>
                  <div style="color: var(--text-muted); font-size: 0.72rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${h.notes || (isDeposit ? 'Aporte' : 'Resgate')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    ` : '';

    return `
      <div class="goal-card ${isCompleted ? 'goal-completed-card' : ''}" style="border-left: 4px solid ${goalColor};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="goal-icon-badge" style="background: ${goalColor}18; color: ${goalColor};">
              <span>${emoji}</span>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                <h4 style="font-size: 1.1rem; font-weight: 700; margin: 0;">${g.title}</h4>
                ${isCompleted ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success); font-size: 0.72rem;">🏆 Conquistada!</span>` : ''}
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.45rem; margin-top: 0.2rem; flex-wrap: wrap;">
                <span>${catName}</span>
                ${linkedAcc ? `<span>• Conta: <b>${linkedAcc.name}</b></span>` : ''}
                <span>• Prazo: <b>${formatDateBR(g.deadline)}</b></span>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <button onclick="handleEditGoal('${g.id}')" class="btn-action-icon" style="color: var(--primary);" title="Editar Meta">
              <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
            </button>
            <button onclick="handleDeleteGoal('${g.id}')" class="btn-action-icon" style="color: var(--danger);" title="Excluir Meta">
              <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em;">Progresso:</span>
            <span class="badge" style="background: ${isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)'}; color: ${isCompleted ? 'var(--success)' : 'var(--primary)'}; font-size: 0.9rem; font-weight: 800;">
              ${percent}%
            </span>
          </div>
          <div class="progress-bar-bg" style="height: 10px;">
            <div class="progress-bar-fill" style="width: ${percent}%; background: ${isCompleted ? 'linear-gradient(90deg, #10b981, #059669)' : `linear-gradient(90deg, ${goalColor}, #10b981)`};"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-top: 0.15rem;">
            <span style="color: var(--text-secondary);">Poupado: <b style="color: var(--success);">${currencyFormatter.format(g.currentAmount)}</b></span>
            <span style="color: var(--text-secondary);">Alvo: <b>${currencyFormatter.format(g.targetAmount)}</b></span>
          </div>
        </div>

        ${paceBadgeHtml}
        ${historyItemsHtml}

        <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.6rem; margin-top: 0.25rem;">
          <button class="btn btn-primary" style="justify-content: center; font-size: 0.84rem;" onclick="handleAporteGoal('${g.id}', 'deposit')">
            <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Fazer Aporte
          </button>
          <button class="btn btn-outline" style="justify-content: center; font-size: 0.84rem; padding: 0.6rem 0.85rem;" onclick="handleAporteGoal('${g.id}', 'withdraw')" title="Resgatar valor da meta">
            <i data-lucide="arrow-up-right" style="width: 16px; height: 16px;"></i> Resgatar
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// --- RENDERIZAÇÃO: LIBERDADE FINANCEIRA & O NORTE (FIRE - FINANCIAL INDEPENDENCE) ---
// =========================================================================
let isFireListenersSetup = false;

function renderFreedomView() {
  const container = document.getElementById('view-freedom');
  if (!container) return;

  const plan = finance.state.firePlanning || {
    currentAge: 32,
    targetAge: 55,
    desiredMonthlyIncome: 10000,
    safeWithdrawalRate: 5.0,
    monthlyContribution: 2500,
    includePhysicalAssets: false
  };

  // 1. Inicializa inputs com os dados salvos se não tiverem valor ativo
  const inputCurrentAge = document.getElementById('fireInputCurrentAge');
  const inputTargetAge = document.getElementById('fireInputTargetAge');
  const inputDesiredIncome = document.getElementById('fireInputDesiredIncome');
  const inputContribution = document.getElementById('fireInputMonthlyContribution');
  const inputSafeRate = document.getElementById('fireInputSafeRate');
  const inputIncludePhysical = document.getElementById('fireInputIncludePhysical');

  if (inputCurrentAge && (!inputCurrentAge.value || document.activeElement !== inputCurrentAge)) {
    inputCurrentAge.value = plan.currentAge || 32;
  }
  if (inputTargetAge && (!inputTargetAge.value || document.activeElement !== inputTargetAge)) {
    inputTargetAge.value = plan.targetAge || 55;
  }
  if (inputDesiredIncome && (!inputDesiredIncome.value || document.activeElement !== inputDesiredIncome)) {
    inputDesiredIncome.value = formatCurrencyInput(plan.desiredMonthlyIncome || 10000);
  }
  if (inputContribution && (!inputContribution.value || document.activeElement !== inputContribution)) {
    inputContribution.value = formatCurrencyInput(plan.monthlyContribution || 2500);
  }
  if (inputSafeRate && document.activeElement !== inputSafeRate) {
    inputSafeRate.value = plan.safeWithdrawalRate || 5.0;
  }
  if (inputIncludePhysical && document.activeElement !== inputIncludePhysical) {
    inputIncludePhysical.checked = !!plan.includePhysicalAssets;
  }

  // 2. Extrai parâmetros da simulação em tempo real
  const customParams = {
    currentAge: parseInt(inputCurrentAge?.value || plan.currentAge, 10),
    targetAge: parseInt(inputTargetAge?.value || plan.targetAge, 10),
    desiredMonthlyIncome: parseCurrencyInput(inputDesiredIncome?.value || plan.desiredMonthlyIncome),
    monthlyContribution: parseCurrencyInput(inputContribution?.value || plan.monthlyContribution),
    safeWithdrawalRate: parseFloat(inputSafeRate?.value || plan.safeWithdrawalRate),
    includePhysicalAssets: !!inputIncludePhysical?.checked
  };

  // 3. Executa cálculo financeiro com o Core
  const fire = finance.getFireCalculation(customParams);

  // 4. Atualiza Hero e Barra Progressiva
  const percentBadge = document.getElementById('freedomPercentBadge');
  const heroSubtitle = document.getElementById('freedomHeroSubtitle');
  const currentNetWorthDisplay = document.getElementById('freedomCurrentNetWorthDisplay');
  const assetModeTag = document.getElementById('freedomAssetModeTag');
  const progressBarFill = document.getElementById('freedomProgressBarFill');
  const targetLabel = document.getElementById('freedomTargetLabel');
  const progressStatusLabel = document.getElementById('freedomProgressStatusLabel');
  const rateDisplayVal = document.getElementById('fireRateDisplayVal');

  if (percentBadge) percentBadge.textContent = `${fire.progressPercent}%`;
  if (heroSubtitle) {
    heroSubtitle.innerHTML = `Seu patrimônio líquido atual de <b>${currencyFormatter.format(fire.currentNetWorth)}</b> já gera <b>${currencyFormatter.format(fire.currentPassiveIncome)} / mês</b> de renda passiva perpétua sem que você precise trabalhar.`;
  }
  if (currentNetWorthDisplay) currentNetWorthDisplay.textContent = currencyFormatter.format(fire.currentNetWorth);
  if (assetModeTag) assetModeTag.textContent = fire.includePhysicalAssets ? 'Liquidez + Bens Imóveis e Veículos' : 'Apenas liquidez e aplicações';
  if (progressBarFill) progressBarFill.style.width = `${Math.min(100, fire.progressPercent)}%`;
  if (targetLabel) targetLabel.textContent = `Meta FIRE: ${currencyFormatter.format(fire.targetNetWorth)}`;
  if (rateDisplayVal) rateDisplayVal.textContent = `${fire.safeWithdrawalRate.toFixed(1)}% a.a.`;
  if (progressStatusLabel) {
    progressStatusLabel.textContent = fire.progressPercent >= 100 
      ? '🎉 Liberdade Conquistada!' 
      : (fire.progressPercent >= 50 ? '⚡ Ponto de Inflexão Superado!' : `${fire.progressPercent}% Conquistado`);
  }

  // 5. Atualiza os 4 Cards Principais
  const targetAmountEl = document.getElementById('fireTargetAmountDisplay');
  const targetFormulaEl = document.getElementById('fireTargetFormulaSubtitle');
  const desiredIncomeEl = document.getElementById('fireDesiredIncomeDisplay');
  const requiredContributionEl = document.getElementById('fireRequiredContributionDisplay');
  const contributionStatusEl = document.getElementById('fireContributionStatusSubtitle');
  const projectedAgeEl = document.getElementById('fireProjectedAgeDisplay');
  const projectedYearEl = document.getElementById('fireProjectedYearSubtitle');

  if (targetAmountEl) targetAmountEl.textContent = currencyFormatter.format(fire.targetNetWorth);
  if (targetFormulaEl) targetFormulaEl.textContent = `Retirada Segura de ${fire.safeWithdrawalRate.toFixed(1)}% a.a.`;
  if (desiredIncomeEl) desiredIncomeEl.textContent = currencyFormatter.format(fire.desiredMonthlyIncome);
  if (requiredContributionEl) requiredContributionEl.textContent = currencyFormatter.format(fire.requiredMonthlyContribution);
  if (contributionStatusEl) {
    const diff = fire.monthlyContribution - fire.requiredMonthlyContribution;
    if (fire.monthlyContribution >= fire.requiredMonthlyContribution) {
      contributionStatusEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">+ ${currencyFormatter.format(diff)} acima da meta</span>`;
    } else {
      contributionStatusEl.innerHTML = `<span style="color: #f59e0b; font-weight: 700;">Déficit de ${currencyFormatter.format(Math.abs(diff))}/mês</span>`;
    }
  }
  if (projectedAgeEl) {
    projectedAgeEl.textContent = fire.projectedFreedomAge === 'Acima de 80' ? '+ 80 anos' : `${fire.projectedFreedomAge} anos`;
  }
  if (projectedYearEl) {
    projectedYearEl.textContent = fire.projectedFreedomYear === 'Ajustar aporte' ? 'Aumente o aporte' : `No ano de ${fire.projectedFreedomYear}`;
  }

  // 6. Renderiza os 5 Marcos / Degraus de Conquista
  const milestonesContainer = document.getElementById('fireMilestonesContainer');
  if (milestonesContainer) {
    milestonesContainer.innerHTML = fire.milestones.map(m => {
      const isReached = m.reached;
      return `
        <div class="milestone-item-card ${isReached ? 'reached' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: ${isReached ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; color: ${isReached ? 'var(--success)' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
                ${isReached ? '🏆' : '🎯'}
              </div>
              <div>
                <span style="font-size: 0.76rem; font-weight: 700; color: ${isReached ? 'var(--success)' : 'var(--text-main)'}; display: block;">${m.label}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">${m.percent}% da Meta</span>
              </div>
            </div>
            <span class="badge" style="background: ${isReached ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; color: ${isReached ? 'var(--success)' : 'var(--text-muted)'}; font-size: 0.7rem; font-weight: 700;">
              ${isReached ? 'Alcançado ✓' : 'Em Busca'}
            </span>
          </div>

          <div style="margin: 0.35rem 0;">
            <div style="font-size: 1.15rem; font-weight: 800; color: ${isReached ? 'var(--success)' : 'var(--text-main)'};">
              ${currencyFormatter.format(m.amount)}
            </div>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0.35rem 0 0; line-height: 1.4;">
              ${m.desc}
            </p>
          </div>
        </div>
      `;
    }).join('');
  }

  // 7. Diagnóstico Inteligente & Recomendações de IA
  const diagContainer = document.getElementById('fireDiagnosisContent');
  if (diagContainer) {
    let paceBadgeColor = '#10b981';
    let paceIcon = 'check-circle';
    if (fire.paceStatus === 'behind') {
      paceBadgeColor = '#f59e0b';
      paceIcon = 'alert-triangle';
    } else if (fire.paceStatus === 'ahead') {
      paceBadgeColor = '#38bdf8';
      paceIcon = 'rocket';
    }

    diagContainer.innerHTML = `
      <div style="margin-bottom: 0.85rem; padding: 0.75rem 1rem; border-radius: 8px; background: rgba(255, 255, 255, 0.04); border-left: 4px solid ${paceBadgeColor};">
        <p style="margin: 0; font-weight: 600; color: var(--text-main);">
          ${fire.paceMessage}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem; margin-top: 0.75rem;">
        <div style="background: var(--bg-card); padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="font-weight: 700; font-size: 0.82rem; color: var(--primary); margin-bottom: 0.25rem;">🚀 1. O Efeito Bola de Neve</div>
          <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted); line-height: 1.4;">
            Ao atingir 50% da meta, o rendimento dos juros compostos passará a render mais a cada mês do que o seu próprio aporte pessoal de ${currencyFormatter.format(fire.monthlyContribution)}.
          </p>
        </div>

        <div style="background: var(--bg-card); padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="font-weight: 700; font-size: 0.82rem; color: #10b981; margin-bottom: 0.25rem;">💰 2. Alavancagem com Renda Extra</div>
          <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted); line-height: 1.4;">
            Se você destinar R$ 500 adicionais por mês oriundos de projetos paralelos ou freelances (aba Renda Extra), sua aposentadoria será antecipada em aproximadamente 3 a 4 anos.
          </p>
        </div>

        <div style="background: var(--bg-card); padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="font-weight: 700; font-size: 0.82rem; color: #f59e0b; margin-bottom: 0.25rem;">🛡️ 3. Blindagem contra Inflação</div>
          <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted); line-height: 1.4;">
            A taxa adotada (${fire.safeWithdrawalRate}% a.a.) já desconta a inflação brasileira. Isso garante que seus ${currencyFormatter.format(fire.desiredMonthlyIncome)} do futuro terão exatamente o mesmo poder de compra de hoje.
          </p>
        </div>
      </div>
    `;
  }

  // 8. Renderiza Gráfico Chart.js
  renderFireGrowthChart(fire);

  // 9. Configura listeners interativos uma única vez
  if (!isFireListenersSetup) {
    setupFireInteractiveListeners();
    isFireListenersSetup = true;
  }

  if (window.lucide) lucide.createIcons();
}

function renderFireGrowthChart(fire) {
  const canvas = document.getElementById('fireGrowthChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const labels = fire.projectionYears.map(p => `${p.year} (${p.age}a)`);
  const dataTotal = fire.projectionYears.map(p => p.totalAccumulated);
  const dataContributed = fire.projectionYears.map(p => p.totalContributed);
  const dataTarget = fire.projectionYears.map(() => fire.targetNetWorth);

  // Resumo footer
  const footerEl = document.getElementById('fireSimulationSummaryFooter');
  if (footerEl && fire.projectionYears.length > 0) {
    const lastPoint = fire.projectionYears[fire.projectionYears.length - 1];
    const interestTotal = Math.max(0, lastPoint.totalAccumulated - lastPoint.totalContributed);
    footerEl.innerHTML = `
      <span>Capital Aportado do Bolso: <b style="color: #3b82f6;">${currencyFormatter.format(lastPoint.totalContributed)}</b></span>
      <span>Juros Compostos Gerados: <b style="color: #10b981;">+ ${currencyFormatter.format(interestTotal)}</b></span>
      <span>Patrimônio no Ponto Máximo: <b style="color: var(--text-main);">${currencyFormatter.format(lastPoint.totalAccumulated)}</b></span>
    `;
  }

  if (fireChartInstance) {
    fireChartInstance.destroy();
  }

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  fireChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Patrimônio Total Acumulado (R$)',
          data: dataTotal,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 6
        },
        {
          label: 'Capital Aportado (Do seu bolso)',
          data: dataContributed,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          fill: true,
          tension: 0.1,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4
        },
        {
          label: 'Meta FIRE (Liberdade Financeira)',
          data: dataTarget,
          borderColor: '#f59e0b',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${currencyFormatter.format(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, maxTicksLimit: 10, font: { size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: function(value) {
              if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
              return `R$ ${value}`;
            }
          }
        }
      }
    }
  });
}

function setupFireInteractiveListeners() {
  const inputs = [
    'fireInputCurrentAge',
    'fireInputTargetAge',
    'fireInputDesiredIncome',
    'fireInputMonthlyContribution',
    'fireInputSafeRate',
    'fireInputIncludePhysical'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        renderFreedomView();
      });
      el.addEventListener('change', () => {
        renderFreedomView();
      });
    }
  });

  const btnSave = document.getElementById('btnSaveFirePlan');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const customParams = {
        currentAge: parseInt(document.getElementById('fireInputCurrentAge')?.value || 32, 10),
        targetAge: parseInt(document.getElementById('fireInputTargetAge')?.value || 55, 10),
        desiredMonthlyIncome: parseCurrencyInput(document.getElementById('fireInputDesiredIncome')?.value || '10000'),
        monthlyContribution: parseCurrencyInput(document.getElementById('fireInputMonthlyContribution')?.value || '2500'),
        safeWithdrawalRate: parseFloat(document.getElementById('fireInputSafeRate')?.value || '5.0'),
        includePhysicalAssets: !!document.getElementById('fireInputIncludePhysical')?.checked
      };

      await finance.saveFirePlanning(customParams);
      showToast('Plano de Liberdade Financeira salvo com sucesso!', 'success');
      renderDashboard();
    });
  }
}

// Renderização: Orçamentos (Previsto vs. Realizado)
function renderBudgetsView() {
  const container = document.getElementById('budgetsGridContainer');
  const comparisons = finance.getBudgetComparison();

  if (comparisons.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma categoria de despesa cadastrada.</div>`;
    return;
  }

  container.innerHTML = comparisons.map(b => {
    const hasLimit = b.hasLimit && b.limit > 0;
    const statusText = hasLimit
      ? (b.isOver ? '⚠️ Limite Ultrapassado!' : (b.percent >= 80 ? '⚡ Próximo do Limite' : '✅ Dentro do Previsto'))
      : (b.actual > 0 ? '📊 Em Andamento (Sem teto definido)' : '⚪ Sem gastos registrados');

    const statusColor = hasLimit
      ? (b.isOver ? 'var(--danger)' : (b.percent >= 80 ? '#f59e0b' : 'var(--success)'))
      : 'var(--text-muted)';

    const percentBadge = hasLimit
      ? `<span class="badge" style="background: ${b.isOver ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-tertiary)'}; color: ${b.isOver ? 'var(--danger)' : 'var(--primary)'}; font-size: 0.85rem; font-weight: 700;">${b.percent}%</span>`
      : `<span class="badge" style="background: var(--bg-tertiary); color: var(--text-muted); font-size: 0.75rem;">Sem Teto</span>`;

    const barFill = hasLimit
      ? `<div class="progress-bar-fill" style="width: ${Math.min(100, b.percent)}%; background: ${b.isOver ? '#ef4444' : (b.percent >= 80 ? '#f59e0b' : 'linear-gradient(90deg, #3b82f6, #10b981)')};"></div>`
      : `<div class="progress-bar-fill" style="width: ${b.actual > 0 ? '100%' : '0%'}; background: rgba(59, 130, 246, 0.35);"></div>`;

    return `
      <div class="goal-card" style="border-color: ${b.isOver ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="metric-icon-badge" style="background: ${b.categoryColor}22; color: ${b.categoryColor}; width: 34px; height: 34px;">
              <i data-lucide="${b.categoryIcon}"></i>
            </div>
            <div>
              <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0;">${b.categoryName}</h4>
              <span style="font-size: 0.78rem; font-weight: 600; color: ${statusColor};">
                ${statusText}
              </span>
            </div>
          </div>
          ${percentBadge}
        </div>

        <div class="progress-bar-bg" style="margin-top: 0.4rem;">
          ${barFill}
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
          <span style="color: var(--text-secondary);">Gasto Atual: <b style="color: ${b.actual > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">${currencyFormatter.format(b.actual)}</b></span>
          <span style="color: var(--text-secondary);">Teto Mensal: <b>${hasLimit ? currencyFormatter.format(b.limit) : 'Não definido'}</b></span>
        </div>

        <button class="btn btn-outline" style="width: 100%; justify-content: center; font-size: 0.82rem; margin-top: 0.25rem;" onclick="handleEditBudget('${b.categoryId}', ${b.limit || 0})">
          <i data-lucide="sliders-horizontal"></i> ${hasLimit ? 'Ajustar Teto de Gastos' : 'Definir Teto de Gastos'}
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Catálogo Completo de Ícones para Categorias Financeiras
const CATEGORY_ICON_CATALOG = [
  // Finanças & Renda
  { name: 'wallet', label: 'Carteira', keywords: 'carteira dinheiro salario pagamento proventos renda' },
  { name: 'trending-up', label: 'Investimentos', keywords: 'investimentos acoes dividendos bolsa rendimento' },
  { name: 'landmark', label: 'Banco', keywords: 'banco instituicao agencia transferencia conta' },
  { name: 'coins', label: 'Moedas', keywords: 'moedas troco centavos dinheiro cash' },
  { name: 'badge-dollar-sign', label: 'Bônus', keywords: 'bonus lucro extra comissao salario' },
  { name: 'piggy-bank', label: 'Cofrinho', keywords: 'cofrinho reserva poupanca guardar economia' },
  { name: 'receipt', label: 'Recibo', keywords: 'recibo nota comprovante fatura' },

  // Alimentação & Compras
  { name: 'shopping-cart', label: 'Supermercado', keywords: 'supermercado mercado compras feira alimento comida' },
  { name: 'shopping-bag', label: 'Compras', keywords: 'compras shopping roupas acessorios presentes' },
  { name: 'utensils', label: 'Restaurante', keywords: 'restaurante almoco jantar comida refeicao gourmet' },
  { name: 'coffee', label: 'Café & Lanche', keywords: 'cafe lanche padaria cafezinho coffee' },
  { name: 'pizza', label: 'Fast Food', keywords: 'pizza lanches delivery ifood hamburguer' },
  { name: 'store', label: 'Comércio', keywords: 'loja comercio mercearia farmacia' },

  // Moradia & Despesas Fixas
  { name: 'home', label: 'Moradia', keywords: 'casa moradia aluguel condominio iptu lar' },
  { name: 'zap', label: 'Energia Elétrica', keywords: 'luz energia eletricidade conta enel cemig cpfl' },
  { name: 'droplet', label: 'Água & Saneamento', keywords: 'agua saneamento sabesp conta esgoto' },
  { name: 'wifi', label: 'Internet & TV', keywords: 'internet wifi rede banda larga tv fibra claro vivo' },
  { name: 'wrench', label: 'Manutenção', keywords: 'manutencao conserto reforma reparo obras' },
  { name: 'sofa', label: 'Móveis', keywords: 'moveis decoracao quarto sala conforto' },
  { name: 'baby', label: 'Filhos / Bebê', keywords: 'filhos bebe crianca fraldas escola brinquedos' },

  // Transporte & Veículo
  { name: 'car', label: 'Automóvel', keywords: 'carro veiculo automovel seguro ipva mecanica' },
  { name: 'fuel', label: 'Combustível', keywords: 'combustivel gasolina etanol diesel posto abastecer' },
  { name: 'bus', label: 'Transporte Público', keywords: 'onibus transporte metro trem passagem conducao' },
  { name: 'plane', label: 'Viagem / Voo', keywords: 'viagem aviao voo turismo ferias voos' },
  { name: 'bike', label: 'Bicicleta', keywords: 'bicicleta bike pedal ciclovia esporte' },
  { name: 'navigation', label: 'Estacionamento / Pedágio', keywords: 'pedagio estacionamento gps pedagios rota' },

  // Saúde & Bem-Estar
  { name: 'activity', label: 'Saúde', keywords: 'saude medico consulta exames hospital clinica' },
  { name: 'heart-pulse', label: 'Plano de Saúde', keywords: 'plano de saude convenio hospitalar vital' },
  { name: 'pill', label: 'Farmácia', keywords: 'farmacia remedio medicamentos drogaria pilula' },
  { name: 'dumbbell', label: 'Academia', keywords: 'academia treino musculacao esporte fitness crossfit' },
  { name: 'smile', label: 'Cuidados Pessoais', keywords: 'beleza cabelo salao estetica barba spa' },

  // Educação & Trabalho
  { name: 'graduation-cap', label: 'Educação', keywords: 'faculdade escola universidade curso graduacao' },
  { name: 'book-open', label: 'Estudos', keywords: 'livros leitura material escolar apostilas' },
  { name: 'briefcase', label: 'Trabalho', keywords: 'trabalho emprego escritorio servico profissao' },
  { name: 'laptop', label: 'Tecnologia / Hardware', keywords: 'computador notebook celular software equipamento eletronicos' },

  // Lazer & Assinaturas
  { name: 'gamepad-2', label: 'Jogos / Games', keywords: 'jogos videogame games playstation xbox steam' },
  { name: 'tv', label: 'Streaming', keywords: 'streaming netflix prime video tv filmes canais' },
  { name: 'film', label: 'Cinema / Lazer', keywords: 'cinema teatro filme pipoca passeio' },
  { name: 'ticket', label: 'Ingressos', keywords: 'ingresso show evento teatro festa festival' },
  { name: 'music', label: 'Música', keywords: 'musica spotify show instrumento audio' },

  // Geral & Tags
  { name: 'tag', label: 'Geral', keywords: 'tag outros diversos etiqueta geral diversos' },
  { name: 'file-text', label: 'Impostos / Tributos', keywords: 'impostos tributos ir taxas darf taxas boleto' },
  { name: 'gift', label: 'Presentes', keywords: 'presente doacao aniversario natal mimo' },
  { name: 'repeat', label: 'Transferência', keywords: 'transferencia entre contas pix ted doc' }
];

// Estado do filtro de categorias ('all' | 'expense' | 'income' | 'transfer')
let currentCategoryFilter = 'all';

// Renderização: Categorias (Com filtros, contadores, ícones personalizados e ações de edição/exclusão)
function renderCategoriesView() {
  const container = document.getElementById('categoriesGridContainer');
  if (!container) return;

  const allCats = finance.state.categories || [];
  const expenseCount = allCats.filter(c => c.type === 'expense').length;
  const incomeCount = allCats.filter(c => c.type === 'income').length;
  const transferCount = allCats.filter(c => c.type === 'transfer').length;

  // Atualiza indicadores de resumo
  const counterEl = document.getElementById('catCountersSummary');
  if (counterEl) {
    counterEl.innerHTML = `Total: <b>${allCats.length}</b> • Despesas: <b>${expenseCount}</b> • Receitas: <b>${incomeCount}</b>${transferCount > 0 ? ` • Transf: <b>${transferCount}</b>` : ''}`;
  }

  // Atualiza botões de filtro
  const btnAll = document.getElementById('btnFilterAllCats');
  const btnExp = document.getElementById('btnFilterExpenseCats');
  const btnInc = document.getElementById('btnFilterIncomeCats');
  const btnTrf = document.getElementById('btnFilterTransferCats');

  if (btnAll) btnAll.className = currentCategoryFilter === 'all' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnExp) btnExp.className = currentCategoryFilter === 'expense' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnInc) btnInc.className = currentCategoryFilter === 'income' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnTrf) btnTrf.className = currentCategoryFilter === 'transfer' ? 'btn btn-primary' : 'btn btn-outline';

  let filtered = allCats;
  if (currentCategoryFilter !== 'all') {
    filtered = allCats.filter(c => c.type === currentCategoryFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem 1.5rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
        <div style="font-size: 2.2rem; margin-bottom: 0.6rem;">🏷️</div>
        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Nenhuma categoria encontrada para este filtro</div>
        <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">Clique no botão abaixo para adicionar uma nova categoria personalizada.</p>
        <button class="btn btn-primary" onclick="handleOpenNewCategoryModal()" style="margin: 0 auto;">
          <i data-lucide="plus-circle"></i> Criar Categoria
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(c => {
    const usage = finance.getCategoryUsage ? finance.getCategoryUsage(c.id) : { transactionsCount: 0, hasBudget: false };
    const typeLabel = c.type === 'income' ? 'Receita' : (c.type === 'transfer' ? 'Transferência' : 'Despesa');
    const typeBadgeColor = c.type === 'income' ? 'var(--success)' : (c.type === 'transfer' ? '#8b5cf6' : 'var(--danger)');
    const typeBadgeBg = c.type === 'income' ? 'rgba(16, 185, 129, 0.12)' : (c.type === 'transfer' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)');
    const iconName = c.icon || 'tag';
    const catColor = c.color || '#3b82f6';

    return `
      <div class="category-item-card" style="border-left: 4px solid ${catColor};">
        <!-- Linha Superior: Ícone da Categoria e Botões de Ação Isolados -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="metric-icon-badge" style="background: ${catColor}18; color: ${catColor}; width: 44px; height: 44px; flex-shrink: 0;">
            <i data-lucide="${iconName}"></i>
          </div>
          <div class="category-actions-group">
            <button onclick="handleEditCategory('${c.id}')" class="btn-action-icon" style="color: var(--primary);" title="Editar Categoria">
              <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
            </button>
            <button onclick="handleDeleteCategory('${c.id}')" class="btn-action-icon" style="color: var(--danger);" title="Excluir Categoria">
              <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </div>

        <!-- Linha Central: Título com 100% da Largura Disponível (Livre de Espremer) -->
        <div style="margin: 0.75rem 0 0.6rem;">
          <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--text-main); line-height: 1.35; word-break: break-word;">
            ${c.name}
          </h4>
        </div>

        <!-- Rodapé do Card: Badges Informativos e Vínculos -->
        <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-top: auto; padding-top: 0.55rem; border-top: 1px dashed var(--border-color);">
          <span class="badge" style="background: ${typeBadgeBg}; color: ${typeBadgeColor}; font-size: 0.72rem; padding: 0.15rem 0.5rem; font-weight: 600;">
            ${typeLabel}
          </span>
          ${usage.transactionsCount > 0 ? `
            <span style="font-size: 0.72rem; color: var(--text-muted); background: var(--bg-tertiary); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-color);">
              ${usage.transactionsCount} lançamento(s)
            </span>
          ` : ''}
          ${usage.hasBudget ? `
            <span style="font-size: 0.72rem; color: var(--primary); background: rgba(59, 130, 246, 0.12); padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">
              Com teto
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Estado do filtro de contas ('all' | 'checking' | 'credit' | 'bills')
let currentAccountFilter = 'all';
let isMobileAccountSheetOpen = false;

function isMobileViewport() {
  return window.innerWidth <= 900;
}

function syncMobileDetailsSheetBackdrop() {
  const backdrop = document.getElementById('mobileDetailsSheetBackdrop');
  if (!backdrop) return;
  if (!isMobileViewport()) {
    backdrop.classList.remove('active');
    return;
  }
  const accCard = document.getElementById('accountDetailsCard');
  const ccCard = document.getElementById('costCenterDetailsCard');
  const shCard = document.getElementById('sideHustleDetailsCard');
  const anyOpen =
    (accCard && accCard.classList.contains('mobile-sheet-open') && accCard.style.display !== 'none') ||
    (ccCard && ccCard.classList.contains('mobile-sheet-open') && ccCard.style.display !== 'none') ||
    (shCard && shCard.classList.contains('mobile-sheet-open') && shCard.style.display !== 'none');
  backdrop.classList.toggle('active', Boolean(anyOpen));
}

function triggerDesktopDetailsScrollAndPulse(cardEl) {
  if (!cardEl || isMobileViewport()) return;
  setTimeout(() => {
    cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    cardEl.classList.remove('details-card-pulse');
    void cardEl.offsetWidth;
    cardEl.classList.add('details-card-pulse');
  }, 40);
}

window.closeAllMobileDetailSheets = function() {
  if (typeof closeAccountDetails === 'function') closeAccountDetails();
  if (typeof closeCostCenterDetails === 'function') closeCostCenterDetails();
  if (typeof closeSideHustleDetails === 'function') closeSideHustleDetails();
  syncMobileDetailsSheetBackdrop();
};

// Renderização: Contas & Bancos (Com seleção, extrato e ações integradas)
function renderAccountsView() {
  const container = document.getElementById('accountsGridContainer');
  if (!container) return;

  // Renderiza Monitor Inteligente de Cartões e Faturas
  renderCreditCardsSmartMonitor();

  // Renderiza Monitor Inteligente de Boletos & Contas Recorrentes
  renderBillsSmartMonitor();

  // Visualização especial quando filtro for exclusivamente "Boletos & Contas Fixas"
  if (currentAccountFilter === 'bills') {
    closeAccountDetails();
    const bills = finance.getBillsInsights();
    if (bills.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🧾</div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--text-main);">Nenhum boleto ou conta fixa pendente no momento!</div>
          <p style="font-size: 0.85rem; margin: 0.4rem 0 1.25rem;">Cadastre contas de internet, água, luz ou aluguel para ter controle e renovação automática todo mês.</p>
          <button class="btn btn-primary" onclick="handleOpenNewBill()" style="margin: 0 auto;">
            <i data-lucide="plus"></i> Cadastrar Primeiro Boleto
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = bills.map(b => {
      const isUrgent = b.reminderLevel === 'urgent';
      const isWarning = b.reminderLevel === 'warning';
      const badgeColor = isUrgent ? '#ef4444' : (isWarning ? '#f59e0b' : 'var(--success)');
      const badgeBg = isUrgent ? 'rgba(239, 68, 68, 0.15)' : (isWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)');

      return `
        <div class="metric-card" style="border-color: ${b.daysUntilDue <= 1 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'};">
          <div class="metric-header" style="align-items: flex-start; gap: 0.5rem;">
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                <span class="metric-title" style="display: block; font-weight: 700; word-break: break-word;">${b.description}</span>
                <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: var(--primary); font-size: 0.68rem; padding: 0.15rem 0.45rem;">
                  ${b.recurring === 'monthly' ? '↻ Mensal' : (b.recurring === 'yearly' ? '↻ Anual' : 'Único')}
                </span>
              </div>
              <span style="font-size: 0.74rem; color: var(--text-muted); display: block; margin-top: 0.15rem; word-break: break-word;">
                Débito: <b>${b.accountName}</b> • Vencimento: <b>${b.dueDateFormatted}</b>
              </span>
            </div>
            <div class="metric-icon-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; flex-shrink: 0;">
              <i data-lucide="receipt"></i>
            </div>
          </div>

          <div style="margin: 0.5rem 0 0.35rem;">
            <span style="font-size: 0.74rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em;">Valor do Boleto:</span>
            <div class="metric-value" style="color: var(--danger); margin: 0.15rem 0 0;">
              ${currencyFormatter.format(b.amount)}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0;">
            <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.74rem; font-weight: 700; white-space: normal; word-break: break-word;">
              ${b.reminderMessage}
            </span>
            ${b.barcode ? `
              <button onclick="navigator.clipboard.writeText('${b.barcode}').then(() => alert('Código copiado com sucesso!'))" class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" title="Copiar código de barras">
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copiar Código
              </button>
            ` : ''}
          </div>

          <div class="metric-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 0.55rem; margin-top: 0.45rem;">
            <button onclick="handleOpenPayBill('${b.id}')" class="btn btn-primary" style="padding: 0.4rem 0.85rem; font-size: 0.78rem; width: 100%; justify-content: center;">
              <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i>
              <span>Pagar Boleto & Renovar</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
    return;
  }

  let accountsToShow = finance.state.accounts;
  if (currentAccountFilter === 'checking') {
    accountsToShow = accountsToShow.filter(a => a.type !== 'credit');
  } else if (currentAccountFilter === 'credit') {
    accountsToShow = accountsToShow.filter(a => a.type === 'credit');
  }

  if (accountsToShow.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2.5rem;">Nenhuma conta ou cartão encontrado para este filtro. Clique em "+ Nova Conta / Cartão" para começar.</div>`;
    closeAccountDetails();
    return;
  }

  // Se não houver conta selecionada ou a selecionada não existir mais, seleciona a primeira da lista
  if (!selectedAccountId || !accountsToShow.some(a => a.id === selectedAccountId)) {
    selectedAccountId = accountsToShow[0].id;
  }

  function renderAccountCardHtml(acc) {
    const isCredit = acc.type === 'credit';
    const isSelected = isMobileViewport()
      ? (acc.id === selectedAccountId && isMobileAccountSheetOpen)
      : (acc.id === selectedAccountId);
    const brandLabel = {
      mastercard: 'Mastercard',
      visa: 'Visa',
      elo: 'Elo',
      amex: 'American Express',
      hipercard: 'Hipercard',
      other: 'Cartão'
    }[acc.cardBrand || 'mastercard'] || 'Cartão';

    if (isCredit) {
      // Cartão de Crédito: Fatura Atual, Limite Total, Limite Disponível
      const invData = finance.getCardInvoices(acc.id) || {
        currentInvoice: { total: 0, label: 'Fatura Atual' },
        futureInvoicesTotal: 0,
        availableLimit: acc.limit || 0,
        totalCommittedLimit: Math.abs(Math.min(0, acc.balance || 0))
      };
      const invoiceAmount = invData.currentInvoice ? invData.currentInvoice.total : 0;
      const futureInvoicesTotal = invData.futureInvoicesTotal || 0;
      const totalLimit = acc.limit || 0;
      const availableLimit = invData.availableLimit;
      const totalDebt = invData.totalCommittedLimit;
      const usedPercent = totalLimit > 0 ? Math.min(100, Math.round((totalDebt / totalLimit) * 100)) : 0;

      return `
        <div class="metric-card account-card-interactive ${isSelected ? 'selected-account' : ''}" onclick="handleSelectAccount('${acc.id}')" title="Clique para abrir detalhes e extrato deste cartão">
          <div class="metric-header">
            <div>
              <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                <span class="metric-title" style="display: block; font-weight: 700;">${acc.name}</span>
                <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem;">💳 Cartão • ${brandLabel}</span>
                ${acc.isDefault ? `<span class="account-default-tag" title="Cartão padrão para lançamentos">★ Padrão</span>` : ''}
              </div>
              <span style="font-size: 0.72rem; color: var(--text-muted);">
                ${acc.entityType === 'pj' ? '🏢 Negócio (PJ)' : '👤 Pessoal (PF)'} • Fecha dia ${acc.closingDay || 25} • Vence dia ${acc.dueDay || 5}
              </span>
            </div>
            ${getBankBadgeHtml(acc.bankId || 'other', 42, acc.color)}
          </div>

          <div style="margin: 0.5rem 0 0.4rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem; gap: 0.35rem; flex-wrap: wrap;">
              <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: ${invData.hasUnpaidClosedInvoice ? 'var(--danger)' : 'var(--text-muted)'}; letter-spacing: 0.04em;">
                ${invData.hasUnpaidClosedInvoice ? 'Fatura Fechada (A Pagar)' : 'Fatura Aberta'}
              </span>
              <div style="display: flex; gap: 0.3rem; align-items: center;">
                ${invData.hasUnpaidClosedInvoice && invData.openCycleAmount > 0 ? `
                  <span style="font-size: 0.7rem; font-weight: 600; color: var(--primary); background: rgba(59, 130, 246, 0.12); padding: 0.1rem 0.45rem; border-radius: 4px;" title="Compras novas já computadas para a próxima fatura">
                    Novo Ciclo: ${currencyFormatter.format(invData.openCycleAmount)}
                  </span>
                ` : ''}
                ${futureInvoicesTotal > 0 ? `
                  <span style="font-size: 0.7rem; font-weight: 600; color: #a855f7; background: rgba(168, 85, 247, 0.12); padding: 0.1rem 0.45rem; border-radius: 4px;" title="Total de parcelas futuras deste cartão">
                    Futuro: ${currencyFormatter.format(futureInvoicesTotal)}
                  </span>
                ` : ''}
              </div>
            </div>
            <div style="color: ${invoiceAmount > 0 ? 'var(--danger)' : 'var(--success)'}; font-size: 1.55rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; margin-bottom: 0.35rem;">
              ${currencyFormatter.format(invoiceAmount)}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; margin-top: 0.35rem; flex-wrap: wrap; gap: 0.35rem;">
              <span style="color: var(--text-secondary); display: inline-flex; align-items: center; gap: 0.35rem;">
                <span>Limite Disponível:</span>
                ${invData.closingBadgeText ? `
                  <span class="badge" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: 600; background: ${invData.isInvoiceClosed ? 'rgba(148, 163, 184, 0.15)' : (invData.daysUntilClosing <= 2 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.12)')}; color: ${invData.isInvoiceClosed ? 'var(--text-muted)' : (invData.daysUntilClosing <= 2 ? '#f59e0b' : 'var(--primary)')};">
                    ${invData.closingBadgeText}
                  </span>
                ` : ''}
              </span>
              <b style="color: ${availableLimit <= (totalLimit * 0.2) && totalLimit > 0 ? '#f59e0b' : 'var(--text-main)'}; font-size: 0.88rem;">${currencyFormatter.format(availableLimit)}</b>
            </div>
          </div>

          <!-- Barra de consumo do limite -->
          <div class="progress-bar-bg" style="height: 6px; margin: 0.5rem 0; background: rgba(255, 255, 255, 0.08); border-radius: 999px; overflow: hidden;" title="Total de compras em aberto: ${currencyFormatter.format(totalDebt)} (${usedPercent}%)">
            <div class="progress-bar-fill" style="width: ${usedPercent}%; height: 100%; background: ${usedPercent >= 85 ? 'var(--danger)' : (usedPercent >= 60 ? '#f59e0b' : 'var(--primary)')}; border-radius: 999px;"></div>
          </div>

          <div class="metric-footer" style="display: flex; flex-direction: column; gap: 0.45rem; border-top: 1px dashed var(--border-color); padding-top: 0.45rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 0.73rem; color: var(--text-muted);">
              <span>Fecha dia <b>${acc.closingDay || 25}</b> • Vence dia <b>${acc.dueDay || 5}</b>${invData.currentInvoice && invData.currentInvoice.dueDateStr ? ` <span style="font-weight: 600; color: ${invData.hasUnpaidClosedInvoice ? 'var(--danger)' : 'var(--text-muted)'};">(${invData.currentInvoice.dueDateStr.slice(0, 5)})</span>` : ''}</span>
              <span>Limite: <b>${currencyFormatter.format(totalLimit)}</b></span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 0.4rem; flex-wrap: wrap;">
              <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                <button onclick="event.stopPropagation(); handleSelectAccount('${acc.id}')" class="btn-open-statement-pill ${isSelected ? 'active-pill' : ''}" title="Abrir faturas e extrato completo deste cartão">
                  <i data-lucide="file-text" style="width: 12px; height: 12px;"></i>
                  <span>${isSelected ? '● Fatura Aberta' : 'Ver Faturas & Extrato ➔'}</span>
                </button>
                ${invoiceAmount > 0 ? `
                  <button onclick="event.stopPropagation(); handleOpenPayInvoice('${acc.id}')" class="btn btn-outline" style="padding: 0.2rem 0.55rem; font-size: 0.72rem; color: var(--success); border-color: rgba(16, 185, 129, 0.4);" title="Pagar fatura deste cartão">
                    Pagar Fatura
                  </button>
                ` : `
                  <span style="font-size: 0.72rem; color: var(--success); font-weight: 600; padding: 0.2rem 0.2rem;">
                    ✓ Em Dia
                  </span>
                `}
                <button onclick="event.stopPropagation(); window.switchTab('forecast')" class="btn btn-outline" style="padding: 0.2rem 0.45rem; font-size: 0.72rem; color: #a855f7; border-color: rgba(168, 85, 247, 0.4);" title="Ver impacto das parcelas e comprometimento de renda futura">
                  <i data-lucide="layers" style="width: 12px; height: 12px;"></i>
                  <span>Impacto Futuro</span>
                </button>
              </div>
              <div style="display: flex; gap: 0.35rem; align-items: center;" onclick="event.stopPropagation()">
                <button onclick="handleEditAccount('${acc.id}')" style="background: none; border: none; cursor: pointer; color: var(--primary); padding: 3px;" title="Editar dados da conta/cartão">
                  <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                </button>
                <button onclick="handleDeleteAccount('${acc.id}')" style="background: none; border: none; cursor: pointer; color: var(--danger); padding: 3px;" title="Excluir Conta">
                  <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Contas Correntes / Investimentos / Dinheiro
    const vaultedAmount = acc.vaulted || 0;
    const freeBalance = acc.balance || 0;
    const totalConsolidated = freeBalance + vaultedAmount;

    return `
      <div class="metric-card account-card-interactive ${isSelected ? 'selected-account' : ''}" onclick="handleSelectAccount('${acc.id}')" title="Clique para abrir e ver o extrato desta conta">
        <div class="metric-header">
          <div>
            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              <span class="metric-title" style="display: block; font-weight: 700;">${acc.name}</span>
              <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: var(--primary); font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem;">
                🏦 ${acc.type === 'investment' ? 'Investimento' : (acc.type === 'cash' ? 'Dinheiro' : 'Conta Corrente')}
              </span>
              ${acc.isDefault ? `<span class="account-default-tag" title="Conta padrão para lançamentos">★ Padrão</span>` : ''}
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">
              ${acc.entityType === 'pj' ? '🏢 Negócio (PJ)' : '👤 Pessoal (PF)'} • ${acc.type === 'investment' ? 'Reserva & Rendimentos' : (acc.type === 'cash' ? 'Dinheiro em Espécie' : 'Conta Bancária')}
            </span>
          </div>
          ${getBankBadgeHtml(acc.bankId || 'other', 42, acc.color)}
        </div>

        <div style="margin: 0.5rem 0 0.4rem;">
          <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em; display: block; margin-bottom: 0.15rem;">
            Saldo Livre (Gastar)
          </span>
          <div style="color: ${freeBalance < 0 ? 'var(--danger)' : 'var(--text-main)'}; font-size: 1.55rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; margin-bottom: 0.35rem;">
            ${currencyFormatter.format(freeBalance)}
          </div>

          <!-- Cofrinho / Reserva da Conta -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; margin-top: 0.45rem; padding: 0.4rem 0.65rem; background: rgba(16, 185, 129, 0.08); border: 1px dashed rgba(16, 185, 129, 0.3); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 0.35rem; color: var(--success); font-weight: 600;">
              <i data-lucide="piggy-bank" style="width: 14px; height: 14px;"></i>
              <span>No Cofrinho:</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <b style="color: var(--success); font-size: 0.88rem;">${currencyFormatter.format(vaultedAmount)}</b>
              <button onclick="event.stopPropagation(); handleOpenVaultModal('${acc.id}')" class="btn btn-outline" style="padding: 0.15rem 0.5rem; font-size: 0.68rem; color: var(--success); border-color: rgba(16, 185, 129, 0.4);" title="Guardar ou resgatar no cofrinho">
                ${vaultedAmount > 0 ? 'Ajustar' : '+ Guardar'}
              </button>
            </div>
          </div>

          ${vaultedAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.74rem; color: var(--text-muted); margin-top: 0.4rem;">
              <span>Total na Instituição:</span>
              <b style="color: var(--text-main);">${currencyFormatter.format(totalConsolidated)}</b>
            </div>
          ` : ''}
        </div>

        <div class="metric-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 0.45rem; margin-top: 0.2rem; gap: 0.4rem; flex-wrap: wrap;">
          <button onclick="event.stopPropagation(); handleSelectAccount('${acc.id}')" class="btn-open-statement-pill ${isSelected ? 'active-pill' : ''}" title="Abrir extrato completo desta conta">
            <i data-lucide="file-text" style="width: 12px; height: 12px;"></i>
            <span>${isSelected ? '● Extrato Aberto' : 'Ver Extrato ➔'}</span>
          </button>
          <div style="display: flex; gap: 0.35rem;" onclick="event.stopPropagation()">
            <button onclick="handleEditAccount('${acc.id}')" style="background: none; border: none; cursor: pointer; color: var(--primary); padding: 3px;" title="Editar dados da conta/cartão">
              <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
            </button>
            <button onclick="handleDeleteAccount('${acc.id}')" style="background: none; border: none; cursor: pointer; color: var(--danger); padding: 3px;" title="Excluir Conta">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (currentAccountFilter === 'checking' || currentAccountFilter === 'credit') {
    container.innerHTML = accountsToShow.map(renderAccountCardHtml).join('');
  } else {
    // Modo "Todas": agrupa elegantemente em Contas Bancárias & Dinheiro vs Cartões de Crédito
    const bankAccounts = accountsToShow.filter(a => a.type !== 'credit');
    const creditAccounts = accountsToShow.filter(a => a.type === 'credit');

    let gridHtml = '';
    if (bankAccounts.length > 0) {
      if (creditAccounts.length > 0) {
        gridHtml += `
          <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; margin: 0.25rem 0 0.2rem; padding-bottom: 0.45rem; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">🏦 Contas Bancárias & Dinheiro</span>
              <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: var(--primary); font-size: 0.7rem; font-weight: 700;">${bankAccounts.length}</span>
            </div>
          </div>
        `;
      }
      gridHtml += bankAccounts.map(renderAccountCardHtml).join('');
    }

    if (creditAccounts.length > 0) {
      if (bankAccounts.length > 0) {
        gridHtml += `
          <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; margin: 1.25rem 0 0.2rem; padding-bottom: 0.45rem; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">💳 Cartões de Crédito</span>
              <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; font-size: 0.7rem; font-weight: 700;">${creditAccounts.length}</span>
            </div>
          </div>
        `;
      }
      gridHtml += creditAccounts.map(renderAccountCardHtml).join('');
    }

    container.innerHTML = gridHtml;
  }
  renderSelectedAccountDetails();

  if (window.lucide) lucide.createIcons();
}

// Renderiza o painel inteligente de faturas de cartão próximas a vencer
function renderCreditCardsSmartMonitor() {
  const monitor = document.getElementById('creditCardsSmartMonitor');
  const listContainer = document.getElementById('creditCardsSmartList');
  const alertSummary = document.getElementById('smartCardsAlertSummary');
  if (!monitor || !listContainer) return;

  const cards = finance.getCreditCardInsights();
  if (!cards || cards.length === 0) {
    monitor.style.display = 'none';
    return;
  }

  monitor.style.display = 'block';

  // Contagem de alertas ativos
  const activeAlerts = cards.filter(c => c.reminderActive);
  if (alertSummary) {
    alertSummary.textContent = activeAlerts.length > 0 
      ? `🔔 ${activeAlerts.length} ${activeAlerts.length === 1 ? 'fatura requer atenção' : 'faturas requerem atenção'}`
      : `✓ Faturas monitoradas em dia (${cards.length})`;
    alertSummary.style.background = activeAlerts.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    alertSummary.style.color = activeAlerts.length > 0 ? 'var(--danger)' : 'var(--success)';
  }

  listContainer.innerHTML = cards.map(c => {
    const isUrgent = c.reminderLevel === 'urgent';
    const isWarning = c.reminderLevel === 'warning';
    const badgeColor = isUrgent ? '#ef4444' : (isWarning ? '#f59e0b' : 'var(--text-muted)');
    const badgeBg = isUrgent ? 'rgba(239, 68, 68, 0.15)' : (isWarning ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-tertiary)');

    const closingInfo = c.hasUnpaidClosedInvoice
      ? `Fatura Fechada • Vence dia ${c.dueDay} (${c.dueDateStr.slice(0, 5)})`
      : (c.closingBadgeText 
          ? `Fecha dia ${c.closingDay} <span style="font-size: 0.68rem; color: ${c.isInvoiceClosed ? 'var(--text-muted)' : (c.daysUntilClosing <= 2 ? '#f59e0b' : 'var(--primary)')}; font-weight: 600;">(${c.closingBadgeText})</span> • Vence dia ${c.dueDay}`
          : `Fecha dia ${c.closingDay} • Vence dia ${c.dueDay}`);

    return `
      <div class="smart-monitor-item" style="border-color: ${c.reminderActive ? (isUrgent ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)') : 'var(--border-color)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.45rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.55rem; min-width: 0; flex: 1 1 160px;">
            ${getBankBadgeHtml(c.bankId || 'other', 34, c.color)}
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main); line-height: 1.25; word-break: break-word;" title="${c.name}">${c.name}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.35; margin-top: 2px; word-break: break-word;">${closingInfo}</div>
            </div>
          </div>
          <span class="badge" title="Data de vencimento: ${c.dueDateStr}" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.68rem; font-weight: 700; white-space: normal; word-break: break-word; padding: 0.18rem 0.45rem; max-width: 100%;">
            ${c.reminderMessage}
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.35rem;">
          <span style="font-size: 0.76rem; color: var(--text-muted);">${c.hasUnpaidClosedInvoice ? 'Fatura Fechada a Pagar:' : 'Fatura Atual:'}</span>
          <b style="font-size: 1.12rem; color: ${c.invoiceAmount > 0 ? 'var(--danger)' : 'var(--success)'};">${currencyFormatter.format(c.invoiceAmount)}</b>
        </div>
        ${c.hasUnpaidClosedInvoice && c.openCycleAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.25rem; font-size: 0.73rem; color: var(--text-muted); margin-top: 0.15rem;">
            <span>Novo Ciclo (Próx. Mês):</span>
            <span style="font-weight: 600; color: var(--primary);">${currencyFormatter.format(c.openCycleAmount)}</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.25rem; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; min-height: 18px; ${c.futureInvoicesTotal > 0 ? '' : 'opacity: 0.45;'}">
          <span>Parcelas Futuras:</span>
          ${c.futureInvoicesTotal > 0 ? `
            <span style="font-weight: 600; color: #a855f7;">${currencyFormatter.format(c.futureInvoicesTotal)}</span>
          ` : `
            <span>—</span>
          `}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.25rem; font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.35rem;">
          <span>Disp: <b>${currencyFormatter.format(c.availableLimit)}</b></span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Total: ${currencyFormatter.format(c.totalLimit)}</span>
        </div>

        <div class="smart-progress-track">
          <div class="progress-bar-fill" style="width: ${c.usedPercent}%; height: 100%; background: ${c.usedPercent >= 85 ? '#ef4444' : (c.usedPercent >= 60 ? '#f59e0b' : '#3b82f6')}; border-radius: 999px;"></div>
        </div>

        <div class="smart-monitor-actions" style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
          <button onclick="handleSelectAccount('${c.id}')" class="btn btn-outline" style="padding: 0.38rem 0.65rem; font-size: 0.76rem; flex: 1 1 115px; justify-content: center; min-height: 34px; color: var(--primary); border-color: rgba(59, 130, 246, 0.35);" title="Ver lançamentos e faturas deste cartão">
            <i data-lucide="file-text" style="width: 13px; height: 13px;"></i>
            <span>Ver Fatura</span>
          </button>
          ${c.invoiceAmount > 0 ? `
            <button onclick="handleOpenPayInvoice('${c.id}')" class="btn btn-primary" style="padding: 0.38rem 0.7rem; font-size: 0.76rem; flex: 1 1 135px; justify-content: center; min-height: 34px;">
              <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i>
              <span>Pagar Agora</span>
            </button>
          ` : `
            <div style="flex: 1 1 120px; min-height: 34px; padding: 0.25rem 0.5rem; display: flex; align-items: center; justify-content: center; background: rgba(16, 185, 129, 0.08); border-radius: var(--radius-sm); border: 1px dashed rgba(16, 185, 129, 0.3); box-sizing: border-box;">
              <span style="font-size: 0.74rem; color: var(--success); font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; text-align: center;">
                <i data-lucide="check" style="width: 13px; height: 13px; flex-shrink: 0;"></i> Em dia
              </span>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Renderiza o painel inteligente de boletos e contas recorrentes do mês
function renderBillsSmartMonitor() {
  const monitor = document.getElementById('billsSmartMonitor');
  const listContainer = document.getElementById('billsSmartList');
  const alertSummary = document.getElementById('smartBillsAlertSummary');
  if (!monitor || !listContainer) return;

  const bills = finance.getBillsInsights();
  if (!bills || bills.length === 0) {
    monitor.style.display = 'none';
    return;
  }

  monitor.style.display = 'block';

  const urgentBills = bills.filter(b => b.daysUntilDue <= 3);
  if (alertSummary) {
    alertSummary.textContent = urgentBills.length > 0 
      ? `⏰ ${urgentBills.length} ${urgentBills.length === 1 ? 'boleto vence em breve' : 'boletos vencem em breve'}`
      : `✓ ${bills.length} contas programadas`;
    alertSummary.style.background = urgentBills.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    alertSummary.style.color = urgentBills.length > 0 ? 'var(--danger)' : 'var(--success)';
  }

  // Exibe até os 3 boletos mais urgentes no banner de topo
  listContainer.innerHTML = bills.slice(0, 3).map(b => {
    const isUrgent = b.reminderLevel === 'urgent';
    const isWarning = b.reminderLevel === 'warning';
    const badgeColor = isUrgent ? '#ef4444' : (isWarning ? '#f59e0b' : 'var(--success)');
    const badgeBg = isUrgent ? 'rgba(239, 68, 68, 0.15)' : (isWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)');

    return `
      <div class="smart-monitor-item" style="border-color: ${b.daysUntilDue <= 1 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.4rem;">
          <div style="min-width: 0; flex: 1 1 150px;">
            <div style="font-weight: 700; font-size: 0.90rem; color: var(--text-main); line-height: 1.25; word-break: break-word;" title="${b.description}">${b.description}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.35; margin-top: 2px; word-break: break-word;">Vencimento: <b>${b.dueDateFormatted}</b> • Débito: ${b.accountName}</div>
          </div>
          <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.68rem; font-weight: 700; white-space: normal; word-break: break-word; padding: 0.2rem 0.45rem; max-width: 100%;">
            ${b.reminderMessage}
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.25rem; margin: 0.35rem 0 0.55rem;">
          <span style="font-size: 0.76rem; color: var(--text-muted);">Valor do Boleto:</span>
          <b style="font-size: 1.15rem; color: var(--danger);">${currencyFormatter.format(b.amount)}</b>
        </div>

        <div class="smart-monitor-actions" style="display: flex; gap: 0.4rem; flex-wrap: wrap; min-height: 34px; align-items: center;">
          ${b.barcode ? `
            <button onclick="navigator.clipboard.writeText('${b.barcode}').then(() => alert('Código de barras copiado com sucesso!'))" class="btn btn-outline" style="padding: 0.35rem 0.55rem; font-size: 0.73rem; min-height: 34px;" title="Copiar código">
              <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copiar
            </button>
          ` : ''}
          <button onclick="handleOpenPayBill('${b.id}')" class="btn btn-primary" style="padding: 0.35rem 0.65rem; font-size: 0.76rem; flex: 1 1 130px; justify-content: center; min-height: 34px;">
            <i data-lucide="check-circle" style="width: 14px; height: 14px; flex-shrink: 0;"></i>
            <span>Pagar & Renovar</span>
          </button>
          <button onclick="handleEditSchedule('${b.id}')" class="btn btn-outline" style="padding: 0.35rem 0.55rem; font-size: 0.74rem; color: var(--primary); border-color: rgba(59, 130, 246, 0.4); min-height: 34px;" title="Editar este agendamento">
            <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
          </button>
          <button onclick="handleDeleteSchedule('${b.id}')" class="btn btn-outline" style="padding: 0.35rem 0.55rem; font-size: 0.74rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.4); min-height: 34px;" title="Excluir este boleto">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Alternar filtro de visualização das contas
window.handleFilterAccounts = function(filter) {
  currentAccountFilter = filter;
  const btnAll = document.getElementById('btnFilterAllAccounts');
  const btnChecking = document.getElementById('btnFilterCheckingOnly');
  const btnCredit = document.getElementById('btnFilterCreditOnly');
  const btnBills = document.getElementById('btnFilterBillsOnly');

  if (btnAll) btnAll.className = filter === 'all' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnChecking) btnChecking.className = filter === 'checking' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnCredit) btnCredit.className = filter === 'credit' ? 'btn btn-primary' : 'btn btn-outline';
  if (btnBills) btnBills.className = filter === 'bills' ? 'btn btn-primary' : 'btn btn-outline';

  renderAccountsView();
};

// Selecionar conta e exibir seu extrato
window.handleSelectAccount = function(accId) {
  if (selectedAccountId !== accId) {
    currentSelectedCardInvoiceKey = null;
  }
  selectedAccountId = accId;
  isMobileAccountSheetOpen = true;
  renderAccountsView();

  const detailsCard = document.getElementById('accountDetailsCard');
  if (detailsCard) {
    if (isMobileViewport()) {
      detailsCard.scrollTop = 0;
    } else {
      triggerDesktopDetailsScrollAndPulse(detailsCard);
    }
  }
};

window.handleSelectCardInvoiceTab = function(invKey) {
  currentSelectedCardInvoiceKey = invKey;
  renderSelectedAccountDetails();
};

function closeAccountDetails() {
  isMobileAccountSheetOpen = false;
  const detailsCard = document.getElementById('accountDetailsCard');
  if (detailsCard) {
    detailsCard.classList.remove('mobile-sheet-open');
    detailsCard.style.display = 'none';
  }
  syncMobileDetailsSheetBackdrop();
  // Remove o destaque de seleção nos cards do mobile quando a gaveta é fechada
  if (isMobileViewport()) {
    document.querySelectorAll('#accountsGridContainer .account-card-interactive.selected-account')
      .forEach(el => el.classList.remove('selected-account'));
    document.querySelectorAll('#accountsGridContainer .btn-open-statement-pill.active-pill')
      .forEach(btn => {
        btn.classList.remove('active-pill');
        const span = btn.querySelector('span');
        if (span) {
          span.textContent = span.textContent.includes('Fatura') ? 'Ver Faturas & Extrato ➔' : 'Ver Extrato ➔';
        }
      });
  }
}

// Renderizar o Extrato e Histórico da Conta Selecionada
function renderSelectedAccountDetails() {
  const detailsCard = document.getElementById('accountDetailsCard');
  if (!detailsCard) return;

  const account = finance.state.accounts.find(a => a.id === selectedAccountId);
  if (!account) {
    detailsCard.classList.remove('mobile-sheet-open');
    detailsCard.style.display = 'none';
    syncMobileDetailsSheetBackdrop();
    return;
  }

  // No Mobile, só exibe a gaveta de extrato quando o usuário clicou em uma conta/cartão
  if (isMobileViewport() && !isMobileAccountSheetOpen) {
    detailsCard.classList.remove('mobile-sheet-open');
    detailsCard.style.display = 'none';
    syncMobileDetailsSheetBackdrop();
    return;
  }

  detailsCard.style.display = 'block';
  if (isMobileViewport()) {
    detailsCard.classList.add('mobile-sheet-open');
  } else {
    detailsCard.classList.remove('mobile-sheet-open');
  }
  syncMobileDetailsSheetBackdrop();

  // Atualiza cabeçalho do extrato
  const nameEl = document.getElementById('accDetailName');
  const subEl = document.getElementById('accDetailSub');
  const badgeEl = document.getElementById('accDetailBadge');
  const iconEl = document.getElementById('accDetailIcon');

  const btnVaultAccount = document.getElementById('btnVaultAccountBtn');
  const invNav = document.getElementById('creditCardInvoiceNav');
  const invTabsContainer = document.getElementById('invoiceFilterTabsContainer');
  const invSummaryBadge = document.getElementById('invoiceSummaryBadge');

  if (nameEl) nameEl.textContent = `Extrato: ${account.name}`;

  const isCredit = account.type === 'credit';
  let invData = null;

  if (isCredit) {
    invData = finance.getCardInvoices(account.id) || {
      invoices: [],
      cardTransactions: [],
      currentInvoice: null,
      currentInvoiceKey: null,
      futureInvoicesTotal: 0,
      availableLimit: account.limit || 0,
      totalCommittedLimit: Math.abs(Math.min(0, account.balance || 0))
    };
    const curInv = invData.currentInvoice;
    const curTotal = curInv ? curInv.total : 0;
    const futureTotal = invData.futureInvoicesTotal || 0;
    const avail = invData.availableLimit;
    const totalLimit = account.limit || 0;

    const pastPendingTotal = invData.invoices
      .filter(i => i.key !== invData.currentInvoiceKey && !i.isFuture && i.total > 0)
      .reduce((sum, i) => sum + i.total, 0);

    if (subEl) {
      subEl.innerHTML = `
        <span style="font-weight: 600; color: ${curTotal > 0 ? 'var(--danger)' : 'var(--success)'};">Fatura Aberta: ${currencyFormatter.format(curTotal)}</span>
        ${pastPendingTotal > 0 ? ` • <span style="color: #f59e0b; font-weight: 500;">Faturas Anteriores: ${currencyFormatter.format(pastPendingTotal)}</span>` : ''}
        ${futureTotal > 0 ? ` • <span style="color: #a855f7; font-weight: 500;">Parcelas Futuras: ${currencyFormatter.format(futureTotal)}</span>` : ''}
        • <span>Limite Disponível: <b style="color: var(--text-main);">${currencyFormatter.format(avail)}</b> de ${currencyFormatter.format(totalLimit)}</span>
        • <span style="color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.3rem;">
            <span>Fecha dia <b>${account.closingDay || 25}</b></span>
            ${invData.closingBadgeText ? `<span class="badge" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 4px; font-weight: 600; background: ${invData.isInvoiceClosed ? 'rgba(148, 163, 184, 0.15)' : (invData.daysUntilClosing <= 2 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.12)')}; color: ${invData.isInvoiceClosed ? 'var(--text-muted)' : (invData.daysUntilClosing <= 2 ? '#f59e0b' : 'var(--primary)')};">(${invData.closingBadgeText})</span>` : ''}
            <span>• Vence dia <b>${account.dueDay || 5}</b></span>
          </span>
      `;
    }
    if (btnVaultAccount) btnVaultAccount.style.display = 'none';

    // Renderiza a navegação de faturas do cartão
    if (invNav && invTabsContainer && invSummaryBadge) {
      invNav.style.display = 'flex';

      // Se a aba selecionada for inválida ou nula, seleciona a fatura atual (ou a primeira existente)
      if (!currentSelectedCardInvoiceKey) {
        currentSelectedCardInvoiceKey = invData.currentInvoiceKey || (invData.invoices.length > 0 ? invData.invoices[0].key : 'all');
      } else if (currentSelectedCardInvoiceKey !== 'all' && !invData.invoices.some(i => i.key === currentSelectedCardInvoiceKey)) {
        currentSelectedCardInvoiceKey = invData.currentInvoiceKey || (invData.invoices.length > 0 ? invData.invoices[0].key : 'all');
      }

      // Cria botões das abas
      let tabsHtml = '';

      invData.invoices.forEach(inv => {
        const isActive = currentSelectedCardInvoiceKey === inv.key;
        let statusBadge = '';
        if (inv.isCurrent) {
          statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.65rem; margin-left: 0.35rem; padding: 0.1rem 0.35rem; border-radius: 4px;">Atual</span>`;
        } else if (inv.isFuture) {
          statusBadge = `<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #a855f7; font-size: 0.65rem; margin-left: 0.35rem; padding: 0.1rem 0.35rem; border-radius: 4px;">Futura</span>`;
        } else {
          statusBadge = `<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: var(--text-muted); font-size: 0.65rem; margin-left: 0.35rem; padding: 0.1rem 0.35rem; border-radius: 4px;">Anterior</span>`;
        }

        tabsHtml += `
          <button type="button" 
            class="btn invoice-tab-btn ${isActive ? 'active' : ''}" 
            onclick="handleSelectCardInvoiceTab('${inv.key}')"
            style="${isActive ? 'background: var(--primary); color: #ffffff; border-color: var(--primary); font-weight: 700; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);' : 'background: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-color);'}; padding: 0.4rem 0.8rem; font-size: 0.78rem; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.3rem; transition: all 0.2s ease; cursor: pointer;">
            <i data-lucide="receipt" style="width: 13px; height: 13px;"></i>
            <span>${inv.label}</span>
            ${statusBadge}
            <span style="font-weight: 700; margin-left: 0.25rem; opacity: 0.95;">(${currencyFormatter.format(inv.total)})</span>
          </button>
        `;
      });

      // Aba: Todas as Compras
      const isAllActive = currentSelectedCardInvoiceKey === 'all';
      tabsHtml += `
        <button type="button" 
          class="btn invoice-tab-btn ${isAllActive ? 'active' : ''}" 
          onclick="handleSelectCardInvoiceTab('all')"
          style="${isAllActive ? 'background: var(--primary); color: #ffffff; border-color: var(--primary); font-weight: 700; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);' : 'background: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-color);'}; padding: 0.4rem 0.8rem; font-size: 0.78rem; border-radius: 20px; display: inline-flex; align-items: center; gap: 0.3rem; transition: all 0.2s ease; cursor: pointer;">
          <i data-lucide="layers" style="width: 13px; height: 13px;"></i>
          <span>Todas as Compras</span>
        </button>
      `;

      invTabsContainer.innerHTML = tabsHtml;

      // Resumo da fatura ativa no badge à direita
      if (currentSelectedCardInvoiceKey === 'all') {
        invSummaryBadge.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); padding: 0.35rem 0.75rem; border-radius: 8px;">
            <i data-lucide="info" style="width: 14px; height: 14px; color: #818cf8;"></i>
            <span>Histórico consolidado: <b>todas as faturas</b> (${invData.cardTransactions.length} lançamentos)</span>
          </div>
        `;
      } else {
        const selectedInv = invData.invoices.find(i => i.key === currentSelectedCardInvoiceKey);
        if (selectedInv) {
          const statusColor = selectedInv.isCurrent ? '#10b981' : (selectedInv.isFuture ? '#a855f7' : 'var(--text-muted)');
          invSummaryBadge.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.8rem; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color); padding: 0.35rem 0.75rem; border-radius: 8px; flex-wrap: wrap;">
              <span>Status: <b style="color: ${statusColor};">${selectedInv.statusLabel}</b></span>
              <span>• Fecha: <b>${formatDateBR(selectedInv.closingDateStr)}</b> ${selectedInv.closingBadgeText ? `<span class="badge" style="font-size: 0.65rem; padding: 0.08rem 0.3rem; border-radius: 4px; background: rgba(59, 130, 246, 0.12); color: var(--primary);">${selectedInv.closingBadgeText}</span>` : ''}</span>
              <span>• Vence: <b>${formatDateBR(selectedInv.dueDateStr)}</b></span>
              <span style="margin-left: 0.25rem;">Total Fatura: <b style="font-size: 0.95rem; color: ${selectedInv.total > 0 ? 'var(--danger)' : 'var(--success)'};">${currencyFormatter.format(selectedInv.total)}</b></span>
              ${selectedInv.total > 0 ? `
                <button type="button" onclick="handleOpenPayInvoice('${account.id}', '${selectedInv.key}')" class="btn btn-outline" style="padding: 0.2rem 0.55rem; font-size: 0.72rem; color: var(--success); border-color: rgba(16, 185, 129, 0.4); margin-left: 0.4rem;">
                  Pagar Esta Fatura
                </button>
              ` : `
                <span style="font-size: 0.72rem; color: var(--success); font-weight: 600; margin-left: 0.3rem;">✓ Paga / Zerada</span>
              `}
            </div>
          `;
        } else {
          invSummaryBadge.innerHTML = '';
        }
      }
    }
  } else {
    // Conta corrente ou investimento
    if (invNav) invNav.style.display = 'none';

    const freeBal = account.balance || 0;
    const vaultedBal = account.vaulted || 0;
    const totalCons = freeBal + vaultedBal;
    if (subEl) {
      subEl.textContent = `Saldo Livre: ${currencyFormatter.format(freeBal)} | No Cofrinho: ${currencyFormatter.format(vaultedBal)} | Total: ${currencyFormatter.format(totalCons)}`;
    }
    if (btnVaultAccount) {
      btnVaultAccount.style.display = 'inline-flex';
      btnVaultAccount.onclick = () => handleOpenVaultModal(account.id);
    }
  }

  if (badgeEl) {
    badgeEl.style.background = 'transparent';
    badgeEl.style.boxShadow = 'none';
    badgeEl.innerHTML = getBankBadgeHtml(account.bankId || 'other', 30, account.color);
  }

  // Filtra transações vinculadas a esta conta (diretas ou transferências)
  const txTableBody = document.getElementById('accountTxTableBody');
  if (!txTableBody) return;

  let accountTransactions = finance.state.transactions.filter(t => 
    t.accountId === account.id || t.fromAccountId === account.id || t.toAccountId === account.id
  );

  // Se for cartão de crédito e houver uma fatura específica selecionada, filtra por essa fatura!
  if (isCredit && currentSelectedCardInvoiceKey && currentSelectedCardInvoiceKey !== 'all') {
    accountTransactions = accountTransactions.filter(t => {
      const invInfo = finance.getInvoiceInfoForDate(t.date, account.closingDay, account.dueDay);
      return invInfo.invoiceKey === currentSelectedCardInvoiceKey;
    });
  }

  // Ordena por data decrescente
  accountTransactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (accountTransactions.length === 0) {
    const emptyMsg = isCredit && currentSelectedCardInvoiceKey && currentSelectedCardInvoiceKey !== 'all'
      ? `Nenhuma compra registrada nesta fatura selecionada.<br><span style="font-size: 0.8rem; opacity: 0.8;">Selecione outra fatura nas abas acima ou realize uma nova compra neste cartão.</span>`
      : `Nenhuma movimentação registrada nesta conta.<br><span style="font-size: 0.8rem; opacity: 0.8;">Clique no botão "Nova Movimentação Nesta Conta" acima para adicionar uma transação.</span>`;

    txTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          ${emptyMsg}
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  txTableBody.innerHTML = accountTransactions.map(tx => {
    const isTransfer = tx.type === 'transfer';
    const isIncome = isTransfer ? (tx.toAccountId === account.id) : (tx.type === 'income');
    const cat = finance.state.categories.find(c => c.id === tx.categoryId) || { name: isTransfer ? 'Transferência' : 'Geral', color: '#8b5cf6' };

    let displayAmount = currencyFormatter.format(tx.amount);
    let amountClass = 'amount-expense';
    let prefix = '- ';

    if (isTransfer) {
      if (tx.toAccountId === account.id) {
        amountClass = 'amount-income';
        prefix = '+ ';
      } else {
        amountClass = 'amount-expense';
        prefix = '- ';
      }
    } else if (isIncome) {
      amountClass = 'amount-income';
      prefix = '+ ';
    }

    let invoiceTagHtml = '';
    if (isCredit) {
      const invInfo = finance.getInvoiceInfoForDate(tx.date, account.closingDay, account.dueDay);
      invoiceTagHtml = `
        <span class="badge" style="background: rgba(99, 102, 241, 0.12); color: #818cf8; font-size: 0.68rem; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.25); display: inline-flex; align-items: center; gap: 3px;" title="Vencimento da fatura: ${formatDateBR(invInfo.dueDateStr)}">
          <i data-lucide="receipt" style="width: 10px; height: 10px;"></i> ${invInfo.label}
        </span>
      `;
    }

    const cleanDescription = (tx.installmentTotal > 1) 
      ? (tx.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '') 
      : tx.description;

    const isVaultTx = tx.isVaultAllocation || (tx.description && tx.description.startsWith('[Cofrinho'));
    const accTxAuthor = finance.getEntityAuthorInfo(tx);

    return `
      <tr class="tx-row">
        <td class="tx-cell-desc">
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span style="font-weight: 600;">${cleanDescription}</span>
            <span class="author-badge ${accTxAuthor.role === 'p2' ? 'author-p2' : 'author-p1'}" title="Inserido por ${escapeHtml(accTxAuthor.name)} via ${accTxAuthor.deviceLabel}">
              ${accTxAuthor.deviceIcon} ${escapeHtml(accTxAuthor.name)}
            </span>
            ${tx.installmentTotal > 1 ? `
              <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #a855f7; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Compra parcelada em ${tx.installmentTotal}x">
                <i data-lucide="credit-card" style="width: 10px; height: 10px;"></i> Parcela ${tx.installmentIndex || 1}/${tx.installmentTotal}
              </span>
            ` : ''}
            ${invoiceTagHtml}
          </div>
          ${tx.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">${tx.notes}</div>` : ''}
        </td>
        <td class="tx-cell-cat">
          ${isVaultTx ? `
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="piggy-bank" style="width: 12px; height: 12px;"></i> Cofrinho / Reserva
            </span>
          ` : `
            <span class="badge badge-cat">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${cat.color}"></span>
              ${cat.name}
            </span>
          `}
        </td>
        <td class="tx-cell-date">${formatDateBR(tx.date)}</td>
        <td style="text-align: right; ${isVaultTx ? 'color: #10b981; font-weight: 600;' : ''}" class="tx-cell-amount ${isVaultTx ? '' : amountClass}">
          ${isVaultTx ? '🔒 ' : prefix}${displayAmount}
        </td>
        <td class="td-actions tx-cell-actions">
          <div class="table-actions-container">
            ${isIncome && !tx.isVaulted ? `
              <button onclick="handleCreateVaultFromTx('${tx.id}')" class="btn-action-icon" style="color: var(--success);" title="Separar este valor e criar Cofrinho com o nome '${(tx.description || '').replace(/'/g, "\\'")}'">
                <i data-lucide="piggy-bank" style="width: 16px; height: 16px;"></i>
              </button>
            ` : (tx.isVaulted ? `
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.65rem; padding: 0.12rem 0.35rem; display: inline-flex; align-items: center; gap: 3px;" title="Saldo guardado no Cofrinho">
                <i data-lucide="piggy-bank" style="width: 11px; height: 11px;"></i> Cofrinho
              </span>
            ` : '')}
            <button onclick="handleToggleReconciled('${tx.id}')" class="btn-action-icon" style="color: ${tx.reconciled ? 'var(--success)' : 'var(--text-muted)'};" title="${tx.reconciled ? 'Conciliada' : 'Marcar como Conciliada'}">
              <i data-lucide="${tx.reconciled ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px;"></i>
            </button>
            <button onclick="handleEditTx('${tx.id}')" class="btn-action-icon" style="color: var(--primary);" title="Editar Transação">
              <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
            </button>
            <button onclick="handleDeleteTx('${tx.id}')" class="btn-action-icon" style="color: var(--danger);" title="Excluir Transação">
              <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Gráficos (Chart.js)
function updateCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

  // 1. Fluxo Mensal contextualizado no período selecionado
  const flowData = finance.getMonthlyFlow(currentDashboardPeriod.month, currentDashboardPeriod.year);
  const flowCtx = document.getElementById('monthlyFlowChart');

  if (flowCtx) {
    if (monthlyChartInstance) monthlyChartInstance.destroy();

    monthlyChartInstance = new Chart(flowCtx, {
      type: 'bar',
      data: {
        labels: flowData.map(f => f.period),
        datasets: [
          { label: 'Receitas', data: flowData.map(f => f.income), backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'Despesas', data: flowData.map(f => f.expense), backgroundColor: '#ef4444', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor } }
        },
        plugins: { legend: { position: 'top', labels: { color: textColor } } }
      }
    });
  }

  // 2. Gráfico de Distribuição (Por Categoria ou Por Cartão/Método)
  const pieCtx = document.getElementById('categoryPieChart');
  const m = currentDashboardPeriod.month;
  const y = currentDashboardPeriod.year;
  const monthName = monthNamesLong[m - 1] || '';

  // Atualiza subtítulo do gráfico com o período
  const subEl = document.getElementById('distributionChartSubtitle');
  if (subEl) {
    subEl.textContent = currentDistributionMode === 'category' 
      ? `${monthName}/${y} • Categorias consolidadas` 
      : `${monthName}/${y} • Cartões e boletos`;
  }

  if (pieCtx) {
    if (categoryChartInstance) categoryChartInstance.destroy();

    let labels = [];
    let dataVals = [];
    let bgColors = [];

    if (currentDistributionMode === 'account') {
      const accData = finance.getExpensesByAccount(m, y);
      const nonZeroItems = accData.list.filter(item => item.total > 0);
      labels = nonZeroItems.map(item => item.name);
      dataVals = nonZeroItems.map(item => item.total);
      bgColors = nonZeroItems.map(item => item.color);
    } else {
      const catData = finance.getExpensesByCategory(m, y);
      const catKeys = Object.keys(catData).filter(k => catData[k].total > 0);
      labels = catKeys;
      dataVals = catKeys.map(k => catData[k].total);
      bgColors = catKeys.map(k => catData[k].color);
    }

    const hasData = dataVals.length > 0;

    categoryChartInstance = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: hasData ? labels : [`Sem despesas em ${monthName}/${y}`],
        datasets: [{
          data: hasData ? dataVals : [1],
          backgroundColor: hasData ? bgColors : ['#64748b'],
          borderWidth: 2,
          borderColor: isDark ? '#0f172a' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: window.innerWidth <= 768 ? 'bottom' : 'right',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (!hasData) return 'Nenhuma despesa registrada';
                const val = context.raw || 0;
                const total = dataVals.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                return ` ${context.label}: ${currencyFormatter.format(val)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }
}

// Alternância do Gráfico de Distribuição ('category' | 'account')
window.switchDistributionChart = function(mode) {
  currentDistributionMode = mode;
  const btnCat = document.getElementById('btnChartTabCategory');
  const btnAcc = document.getElementById('btnChartTabAccount');
  const titleEl = document.getElementById('distributionChartTitle');

  if (btnCat) btnCat.classList.toggle('active', mode === 'category');
  if (btnAcc) btnAcc.classList.toggle('active', mode === 'account');

  if (titleEl) {
    titleEl.textContent = mode === 'category' ? 'Despesas por Categoria' : 'Despesas por Cartão & Método';
  }

  updateCharts();
};

// Renderização da Auditoria Ponto a Ponto e Raio-X de Despesas do Mês (100% Preciso)
// Garante contraste legível de cores de bancos/cartões (ex: C6 #242424, XP #000000) no tema escuro
function getReadableAccentColor(hexColor, fallback = 'var(--primary)') {
  if (!hexColor || typeof hexColor !== 'string') return fallback;
  const clean = hexColor.trim().replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
    if (!isLightTheme && luminance < 0.25) {
      return '#94a3b8'; // Prata/Cinza claro de alto contraste para C6/XP/Safra no modo escuro
    }
  }
  return hexColor;
}

function renderMonthlyAuditReport() {
  const container = document.getElementById('monthlyAuditContent');
  const badgeContainer = document.getElementById('auditBadgeReconciled');
  if (!container) return;

  const m = currentDashboardPeriod.month;
  const y = currentDashboardPeriod.year;
  const report = finance.getMonthlyAuditReport(m, y);

  const integrityIssues = report.integrityIssues || [];
  if (badgeContainer) {
    if (!report.isExactMatch || !report.categoriesMatch) {
      badgeContainer.innerHTML = `
        <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; border: 1px solid rgba(239, 68, 68, 0.3);">
          <i data-lucide="alert-octagon" style="width: 15px; height: 15px;"></i> Divergência na Conciliação
        </span>
      `;
    } else if (integrityIssues.length > 0) {
      badgeContainer.innerHTML = `
        <button type="button" id="btnAuditIssuesBadge" onclick="document.getElementById('auditIntegrityPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })" class="badge" style="cursor: pointer; background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; border: 1px solid rgba(245, 158, 11, 0.35);">
          <i data-lucide="alert-triangle" style="width: 15px; height: 15px;"></i> ${integrityIssues.length} ${integrityIssues.length === 1 ? 'ponto a revisar' : 'pontos a revisar'}
        </button>
      `;
    } else {
      badgeContainer.innerHTML = `
        <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; border: 1px solid rgba(16, 185, 129, 0.3);">
          <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i> 100% Conciliado e Íntegro
        </span>
      `;
    }
  }

  const grandTotal = report.totalExpense;
  const activeCards = report.cards.filter(c => c.total > 0);
  const activeChecking = report.checkingAccounts.filter(c => c.total > 0);
  const totalCardsSpend = report.creditTotal;
  const totalBillsSpend = report.billsTotal;
  const totalCheckingSpend = report.checkingTotal;
  const billsPaidCount = report.paidBills.length;
  const billsPendingCount = report.pendingBills.length;
  const billsSubtitle = (billsPaidCount + billsPendingCount) === 0
    ? (report.nextBill ? `Próximo: ${report.nextBill.description} • ${formatDateBR(report.nextBill.dueDate)}` : 'Nenhum boleto no mês')
    : `${billsPaidCount} ${billsPaidCount === 1 ? 'pago' : 'pagos'} • ${billsPendingCount} ${billsPendingCount === 1 ? 'pendente' : 'pendentes'}`;

  const curMonthName = (monthNamesLong && monthNamesLong[m - 1]) || 'Atual';
  const curMonthShort = curMonthName.substring(0, 3);
  const nextTargetM = (report.nextMonth && report.nextMonth.month) ? report.nextMonth.month : (m === 12 ? 1 : m + 1);
  const nextMonthName = (monthNamesLong && monthNamesLong[nextTargetM - 1]) || 'Seguinte';
  const nextMonthShort = nextMonthName.substring(0, 3);
  const nextMonthBillsTotal = (report.nextMonth && report.nextMonth.total) || 0;
  const nextMonthItems = (report.nextMonth && report.nextMonth.items) || [];

  // 1. Grid Superior de KPIs Auditados
  const kpiHtml = `
    <div class="audit-kpi-grid">
      <div class="audit-kpi-card">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Total Consolidado</span>
          <div style="font-size: 1.35rem; font-weight: 800; color: var(--danger); margin-top: 0.2rem;">${currencyFormatter.format(grandTotal)}</div>
          <span style="font-size: 0.72rem; color: var(--text-muted);">100% das saídas do mês</span>
        </div>
        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); display: flex; align-items: center; justify-content: center; color: var(--danger); font-size: 1.1rem;">
          📊
        </div>
      </div>

      <div class="audit-kpi-card">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Cartões de Crédito</span>
          <div style="font-size: 1.35rem; font-weight: 800; color: #818cf8; margin-top: 0.2rem;">${currencyFormatter.format(totalCardsSpend)}</div>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${activeCards.length} ${activeCards.length === 1 ? 'cartão utilizado' : 'cartões utilizados'}</span>
        </div>
        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(99, 102, 241, 0.12); display: flex; align-items: center; justify-content: center; color: #818cf8; font-size: 1.1rem;">
          💳
        </div>
      </div>

      <div class="audit-kpi-card">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.15rem;">
            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Boletos &amp; Contas</span>
            <span style="font-size: 0.64rem; font-weight: 700; color: #f59e0b; background: rgba(245, 158, 11, 0.12); padding: 1px 6px; border-radius: 999px;">
              ${curMonthShort} &bull; ${nextMonthShort}
            </span>
          </div>

          <div style="display: flex; align-items: baseline; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.15rem;">
            <div style="font-size: 1.35rem; font-weight: 800; color: #f59e0b; line-height: 1.2;">${currencyFormatter.format(totalBillsSpend)}</div>
            <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-secondary); background: var(--bg-card); padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 0.25rem;" title="Previsão para o próximo mês (${nextMonthName}/${report.nextMonth ? report.nextMonth.year : ''})">
              <span style="color: var(--text-muted); font-size: 0.66rem; font-weight: 600;">${nextMonthShort}:</span>
              <span style="color: #f59e0b;">${currencyFormatter.format(nextMonthBillsTotal)}</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.71rem; color: var(--text-muted); margin-top: 0.22rem; flex-wrap: wrap; line-height: 1.35;">
            <span><b style="color: var(--text-main); font-weight: 600;">${curMonthShort}:</b> ${billsSubtitle}</span>
            <span>&bull;</span>
            <span><b style="color: var(--text-main); font-weight: 600;">${nextMonthShort}:</b> ${nextMonthItems.length} ${nextMonthItems.length === 1 ? 'agendado' : 'agendados'}</span>
          </div>
        </div>
        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(245, 158, 11, 0.12); display: flex; align-items: center; justify-content: center; color: #f59e0b; font-size: 1.1rem; flex-shrink: 0; margin-left: 0.4rem;">
          📄
        </div>
      </div>

      <div class="audit-kpi-card">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Débito / PIX / Conta</span>
          <div style="font-size: 1.35rem; font-weight: 800; color: #10b981; margin-top: 0.2rem;">${currencyFormatter.format(totalCheckingSpend)}</div>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${activeChecking.length} ${activeChecking.length === 1 ? 'conta com saídas' : 'contas com saídas'}</span>
        </div>
        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); display: flex; align-items: center; justify-content: center; color: #10b981; font-size: 1.1rem;">
          🏦
        </div>
      </div>
    </div>
  `;

  // 2. Coluna da Esquerda: Detalhamento por Cartão e Boletos
  let accountsDetailHtml = '';
  if (activeCards.length === 0 && report.bills.length === 0 && activeChecking.length === 0 && nextMonthItems.length === 0) {
    accountsDetailHtml = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma despesa ou fatura encontrada no mês.</div>`;
  } else {
    // Renderiza Cartões de Crédito (Faturas com vencimento no mês selecionado)
    const cardsRows = activeCards.map(c => {
      const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : '0.0';
      const dueLabel = c.dueDay ? `Vence dia ${c.dueDay}` : 'Fatura do Mês';
      const accentColor = getReadableAccentColor(c.color);
      return `
        <div class="audit-item-row">
          <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 0; width: 100%;">
            ${getBankBadgeHtml(c.bankId || 'other', 32, c.color)}
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem;">
                <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${c.name}</span>
                <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-main); flex-shrink: 0; white-space: nowrap;">${currencyFormatter.format(c.total)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-size: 0.74rem; color: var(--text-muted); margin-top: 0.12rem;">
                <span style="line-height: 1.3;">Fatura de ${curMonthName} • ${dueLabel} (${c.count} ${c.count === 1 ? 'lançamento' : 'lançamentos'})</span>
                <span style="font-weight: 700; color: ${accentColor}; flex-shrink: 0;">${pct}%</span>
              </div>
              <div class="audit-progress-track">
                <div class="audit-progress-fill" style="width: ${pct}%; background: ${accentColor};"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Renderiza Boletos & Contas do Mês (pagos + pendentes) + Previsão do Mês Seguinte
    let billsRows = '';
    if (report.bills.length > 0) {
      const billsPct = grandTotal > 0 ? ((totalBillsSpend / grandTotal) * 100).toFixed(1) : '0.0';
      billsRows = `
        <div class="audit-item-row audit-bills-group" style="background: rgba(245, 158, 11, 0.05); border-radius: 10px; padding: 0.7rem 0.75rem; margin: 0.35rem 0; flex-direction: column; align-items: stretch;">
          <div style="display: flex; align-items: center; gap: 0.65rem; width: 100%; min-width: 0;">
            ${getBankBadgeHtml('bills', 32, '#f59e0b')}
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem;">
                <span style="font-weight: 700; font-size: 0.9rem; color: #f59e0b; min-width: 0;">Boletos &amp; Contas (${curMonthName})</span>
                <span style="font-weight: 800; font-size: 0.92rem; color: #f59e0b; flex-shrink: 0; white-space: nowrap;">${currencyFormatter.format(totalBillsSpend)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-size: 0.73rem; color: var(--text-muted); margin-top: 0.12rem;">
                <span style="line-height: 1.3;">${currencyFormatter.format(report.billsPaidTotal)} pagos • ${currencyFormatter.format(report.billsPendingTotal)} a vencer</span>
                <span style="font-weight: 700; color: #f59e0b; flex-shrink: 0;">${billsPct}%</span>
              </div>
              <div class="audit-progress-track">
                <div class="audit-progress-fill" style="width: ${billsPct}%; background: #f59e0b;"></div>
              </div>
            </div>
          </div>

          <div style="margin-top: 0.55rem; display: flex; flex-direction: column; gap: 0.45rem; width: 100%;">
            ${report.bills.map(b => {
              const isPaid = b.status === 'paid';
              const billDesc = (b.description && b.description.trim()) ? escapeHtml(b.description.trim()) : 'Conta / Boleto';
              return `
              <div class="audit-bill-pill" style="${isPaid ? 'opacity: 0.88;' : ''}; padding: 0.55rem 0.65rem; border-radius: 9px; background: var(--bg-card); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.35rem; width: 100%; box-sizing: border-box;">
                <!-- Linha 1: Status + Nome (Esquerda) e Valor (Direita) -->
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%;">
                  <div style="display: flex; align-items: center; gap: 0.4rem; min-width: 0; flex: 1;">
                    <span style="font-size: 0.64rem; font-weight: 800; padding: 2px 7px; border-radius: 999px; flex-shrink: 0; ${isPaid ? 'background: rgba(16,185,129,0.16); color: var(--success);' : 'background: rgba(245,158,11,0.16); color: #f59e0b;'}">${isPaid ? 'PAGO' : 'A VENCER'}</span>
                    <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${billDesc}</span>
                  </div>
                  <span style="font-weight: 800; font-size: 0.88rem; color: ${isPaid ? 'var(--success)' : '#f59e0b'}; white-space: nowrap; flex-shrink: 0; margin-left: auto;">${currencyFormatter.format(b.amount)}</span>
                </div>
                <!-- Linha 2: Data (Esquerda) e Botões de Ação (Direita) -->
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.25rem;">
                  <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.25rem;">
                    <span>📅 ${isPaid ? 'Pago em' : 'Vencimento:'} <b>${formatDateBR(isPaid ? b.date : b.dueDate)}</b></span>
                  </div>
                  ${isPaid ? '' : `
                  <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                    <button type="button" onclick="handleOpenPayBill('${b.id}')" class="btn-action-icon" style="color: var(--success); padding: 3px 6px; border-radius: 6px; background: rgba(16,185,129,0.12);" title="Pagar este boleto">
                      <i data-lucide="check" style="width: 13px; height: 13px;"></i>
                    </button>
                    <button type="button" onclick="handleEditSchedule('${b.id}')" class="btn-action-icon" style="color: var(--primary); padding: 3px 6px; border-radius: 6px; background: rgba(99,102,241,0.12);" title="Editar dados deste boleto">
                      <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
                    </button>
                    <button type="button" onclick="handleDeleteSchedule('${b.id}')" class="btn-action-icon" style="color: var(--danger); padding: 3px 6px; border-radius: 6px; background: rgba(239,68,68,0.12);" title="Excluir este boleto">
                      <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                  </div>`}
                </div>
              </div>`;
            }).join('')}
          </div>

          <!-- Boletos do Mês Seguinte (Previsão) -->
          ${nextMonthItems.length > 0 ? `
          <div style="margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px dashed rgba(245, 158, 11, 0.28); width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
              <span style="font-size: 0.7rem; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.02em;">
                📅 Seguinte: ${nextMonthName}/${report.nextMonth.year}
              </span>
              <span style="font-size: 0.78rem; font-weight: 800; color: #f59e0b; white-space: nowrap;">
                ${currencyFormatter.format(nextMonthBillsTotal)}
              </span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.45rem;">
              ${nextMonthItems.map(b => {
                const nextDesc = (b.description && b.description.trim()) ? escapeHtml(b.description.trim()) : 'Conta / Boleto';
                return `
                <div class="audit-bill-pill" style="padding: 0.55rem 0.65rem; border-radius: 9px; background: var(--bg-card); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.35rem; width: 100%; box-sizing: border-box;">
                  <!-- Linha 1: Status + Nome (Esquerda) e Valor (Direita) -->
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 0.4rem; min-width: 0; flex: 1;">
                      <span style="font-size: 0.64rem; font-weight: 800; padding: 2px 7px; border-radius: 999px; background: rgba(99, 102, 241, 0.16); color: #818cf8; flex-shrink: 0;">SEGUINTE</span>
                      <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${nextDesc}</span>
                    </div>
                    <span style="font-weight: 800; font-size: 0.88rem; color: #f59e0b; white-space: nowrap; flex-shrink: 0; margin-left: auto;">${currencyFormatter.format(b.amount)}</span>
                  </div>
                  <!-- Linha 2: Data (Esquerda) e Botão Pagar (Direita) -->
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.25rem;">
                    <div style="font-size: 0.7rem; color: var(--text-muted);">
                      📅 Vencimento: <b>${formatDateBR(b.dueDate)}</b>
                    </div>
                    <button type="button" onclick="handleOpenPayBill('${b.id}')" class="btn-action-icon" style="color: var(--success); padding: 3px 6px; border-radius: 6px; background: rgba(16,185,129,0.12);" title="Pagar este boleto antecipado">
                      <i data-lucide="check" style="width: 13px; height: 13px;"></i>
                    </button>
                  </div>
                </div>
              `;}).join('')}
            </div>
          </div>` : (report.nextBill && billsPendingCount === 0 ? `
          <div style="margin-top: 0.45rem; font-size: 0.72rem; color: var(--text-muted); line-height: 1.35;">
            ✅ Mês quitado. Próximo: <b style="color: var(--text-secondary);">${escapeHtml(report.nextBill.description)}</b> • ${formatDateBR(report.nextBill.dueDate)} • ${currencyFormatter.format(report.nextBill.amount)}
          </div>` : '')}
        </div>
      `;
    } else if (nextMonthItems.length > 0 || report.nextBill) {
      billsRows = `
        <div class="audit-item-row audit-bills-group" style="background: rgba(245, 158, 11, 0.05); border-radius: 10px; padding: 0.7rem 0.75rem; margin: 0.35rem 0; flex-direction: column; align-items: stretch;">
          <div style="display: flex; align-items: center; gap: 0.65rem; width: 100%; min-width: 0;">
            ${getBankBadgeHtml('bills', 32, '#f59e0b')}
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem;">
                <span style="font-weight: 700; font-size: 0.9rem; color: #f59e0b; min-width: 0;">Boletos &amp; Contas (${curMonthName})</span>
                <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-muted); flex-shrink: 0; white-space: nowrap;">${currencyFormatter.format(0)}</span>
              </div>
              <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 0.12rem; line-height: 1.35;">
                Nenhum boleto em ${curMonthName} • Próximo mês (${nextMonthName}): <b style="color: #f59e0b;">${currencyFormatter.format(nextMonthBillsTotal)}</b>
              </div>
            </div>
          </div>
          ${nextMonthItems.length > 0 ? `
          <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; width: 100%;">
            ${nextMonthItems.map(b => `
              <div class="audit-bill-pill">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; width: 100%; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 0.35rem; min-width: 0; flex: 1;">
                    <span style="font-size: 0.62rem; font-weight: 800; padding: 2px 6px; border-radius: 999px; background: rgba(99, 102, 241, 0.16); color: #818cf8; flex-shrink: 0;">SEGUINTE</span>
                    <span style="font-weight: 700; font-size: 0.78rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${escapeHtml(b.description || 'Conta / Boleto')}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                    <span style="font-weight: 800; font-size: 0.8rem; color: #f59e0b; white-space: nowrap;">${currencyFormatter.format(b.amount)}</span>
                    <button type="button" onclick="handleOpenPayBill('${b.id}')" class="btn-action-icon" style="color: var(--success); padding: 2px;" title="Pagar este boleto antecipado">
                      <i data-lucide="check" style="width: 13px; height: 13px;"></i>
                    </button>
                  </div>
                </div>
                <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.14rem;">
                  📅 Vencimento: <b>${formatDateBR(b.dueDate)}</b>
                </div>
              </div>
            `).join('')}
          </div>` : ''}
        </div>
      `;
    }

    // Renderiza Contas Correntes com Saídas (Débito/PIX)
    let checkingRows = '';
    if (activeChecking.length > 0) {
      checkingRows = activeChecking.map(c => {
        const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : '0.0';
        const accentColor = getReadableAccentColor(c.color);
        return `
          <div class="audit-item-row">
            <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 0; width: 100%;">
              ${getBankBadgeHtml(c.bankId || 'other', 32, c.color)}
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem;">
                  <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.name} (Débito/PIX)</span>
                  <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-main); flex-shrink: 0; white-space: nowrap;">${currencyFormatter.format(c.total)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-size: 0.74rem; color: var(--text-muted); margin-top: 0.12rem;">
                  <span>${c.count} ${c.count === 1 ? 'saída' : 'saídas'}</span>
                  <span style="font-weight: 700; color: ${accentColor}; flex-shrink: 0;">${pct}%</span>
                </div>
                <div class="audit-progress-track">
                  <div class="audit-progress-fill" style="width: ${pct}%; background: ${accentColor};"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    accountsDetailHtml = cardsRows + billsRows + checkingRows;
  }

  // 3. Coluna da Direita: Detalhamento por Categoria
  let categoriesDetailHtml = '';
  const activeCategories = report.categories.filter(c => c.total > 0);
  if (activeCategories.length === 0) {
    categoriesDetailHtml = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma categoria com gastos no mês.</div>`;
  } else {
    categoriesDetailHtml = activeCategories.map(cat => {
      const pct = grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : '0.0';
      const catAccent = getReadableAccentColor(cat.color);
      return `
        <div class="audit-item-row">
          <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 0; width: 100%;">
            ${getCategoryIconBoxHtml(cat, 34)}
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem;">
                <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${cat.name}</span>
                <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-main); flex-shrink: 0; white-space: nowrap;">${currencyFormatter.format(cat.total)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-size: 0.74rem; color: var(--text-muted); margin-top: 0.12rem;">
                <span>${cat.count} ${cat.count === 1 ? 'item' : 'itens'}</span>
                <span style="font-weight: 700; color: ${catAccent}; flex-shrink: 0;">${pct}%</span>
              </div>
              <div class="audit-progress-track">
                <div class="audit-progress-fill" style="width: ${pct}%; background: ${catAccent};"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Banner de Auditoria Matemática
  const mathOk = report.isExactMatch && report.categoriesMatch;
  const mathBannerHtml = `
    <div class="audit-reconciled-banner" style="${mathOk ? '' : 'border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.06);'}">
      <div style="display: flex; align-items: center; gap: 0.65rem;">
        <div style="width: 28px; height: 28px; border-radius: 8px; background: ${mathOk ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0;">
          ${mathOk ? '🛡️' : '⚠️'}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
          <b>Auditoria Matemática:</b> Cartões (<b>${currencyFormatter.format(totalCardsSpend)}</b>) + Boletos (<b>${currencyFormatter.format(totalBillsSpend)}</b>) + Contas Correntes (<b>${currencyFormatter.format(totalCheckingSpend)}</b>) = <b style="color: var(--danger);">${currencyFormatter.format(report.reconciledSum)}</b>
          ${mathOk ? '' : ` ≠ Total <b>${currencyFormatter.format(report.totalExpense)}</b> (categorias: ${currencyFormatter.format(report.categoriesSum)})`}
        </div>
      </div>
      <div style="font-size: 0.74rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px; ${mathOk ? 'color: var(--success); background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3);' : 'color: var(--danger); background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3);'}">
        ${mathOk ? '✓ Nenhuma Discrepância' : '✗ Discrepância'}
      </div>
    </div>
  `;

  // 5. Painel de Integridade dos Dados (dupla contagem, transferências próprias, vínculos quebrados)
  const integrityHtml = integrityIssues.length === 0 ? '' : `
    <div id="auditIntegrityPanel" style="margin-top: 0.85rem; border: 1px solid rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.06); border-radius: 12px; padding: 0.85rem 1rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
        <i data-lucide="scan-search" style="width: 16px; height: 16px; color: #f59e0b;"></i>
        <h4 style="margin: 0; font-size: 0.92rem; font-weight: 700;">Integridade dos Dados • ${integrityIssues.length} ${integrityIssues.length === 1 ? 'ponto' : 'pontos'} a revisar</h4>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 280px; overflow-y: auto;">
        ${integrityIssues.map(issue => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; flex-wrap: wrap; background: var(--bg-card); border: 1px solid var(--border-color); border-left: 3px solid ${issue.level === 'error' ? 'var(--danger)' : '#f59e0b'}; border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.76rem; color: var(--text-secondary);">
            <span style="line-height: 1.4; flex: 1 1 200px; min-width: 0;">${issue.message}</span>
            <div style="display: flex; gap: 0.35rem; flex-shrink: 0; flex-wrap: wrap;">
              ${issue.fix === 'internal' && issue.txId ? `<button type="button" class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 0.7rem;" onclick="handleAuditMarkInternal('${issue.txId}')" title="Reclassificar como Transferência Interna">⇄ É transferência</button>` : ''}
              <button type="button" class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 0.7rem;" onclick="handleAuditDismiss('${issue.id}')" title="Está correto, ignorar este alerta">Está correto</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = `
    ${kpiHtml}
    <div class="audit-detail-grid">
      <div class="audit-detail-box">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.85rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.6rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; min-width: 0;">
            <i data-lucide="credit-card" style="width: 16px; height: 16px; color: var(--primary); flex-shrink: 0;"></i>
            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700;">Gastos por Cartão & Contas a Pagar</h4>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; white-space: nowrap;">Soma: ${currencyFormatter.format(grandTotal)}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.45rem;">
          ${accountsDetailHtml}
        </div>
      </div>

      <div class="audit-detail-box">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.85rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.6rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; min-width: 0;">
            <i data-lucide="pie-chart" style="width: 16px; height: 16px; color: #10b981; flex-shrink: 0;"></i>
            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700;">Gastos por Categoria</h4>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; white-space: nowrap;">Soma: ${currencyFormatter.format(grandTotal)}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.45rem;">
          ${categoriesDetailHtml}
        </div>
      </div>
    </div>
    ${mathBannerHtml}
    ${integrityHtml}
  `;

  if (window.lucide) lucide.createIcons();
}

// Ações do Painel de Integridade
window.handleAuditMarkInternal = async function(txId) {
  await finance.markAsInternalTransfer(txId);
  if (typeof showToast === 'function') showToast('Lançamento reclassificado como Transferência Interna.', 'success');
  renderDashboard();
};

window.handleAuditDismiss = async function(issueId) {
  await finance.dismissAuditIssue(issueId);
  renderDashboard();
};

// Configuração de Modais e Ações
// --- SISTEMA UNIVERSAL DE IDENTIDADE DO CASAL & MODO DE GESTÃO ---
function renderAvatarPickers(p1Selected = 'user', p2Selected = 'heart', p1Color = '#3b82f6', p2Color = '#ec4899') {
  const c1 = document.getElementById('avatarPickerP1');
  const c2 = document.getElementById('avatarPickerP2');
  if (c1) {
    c1.innerHTML = AVAILABLE_COUPLE_AVATARS.map(av => {
      const isSel = av.id === p1Selected;
      return `<button type="button" class="avatar-opt-btn" onclick="window.selectAvatar('p1', '${av.id}')" style="width: 28px; height: 28px; border-radius: 8px; border: ${isSel ? `2px solid ${p1Color}` : '1px solid var(--border-color)'}; background: ${isSel ? `${p1Color}25` : 'var(--bg-surface)'}; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;" title="${av.label}"><i data-lucide="${av.icon}" style="width: 14px; height: 14px; color: ${isSel ? p1Color : 'var(--text-muted)'};"></i></button>`;
    }).join('');
  }
  if (c2) {
    c2.innerHTML = AVAILABLE_COUPLE_AVATARS.map(av => {
      const isSel = av.id === p2Selected;
      return `<button type="button" class="avatar-opt-btn" onclick="window.selectAvatar('p2', '${av.id}')" style="width: 28px; height: 28px; border-radius: 8px; border: ${isSel ? `2px solid ${p2Color}` : '1px solid var(--border-color)'}; background: ${isSel ? `${p2Color}25` : 'var(--bg-surface)'}; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;" title="${av.label}"><i data-lucide="${av.icon}" style="width: 14px; height: 14px; color: ${isSel ? p2Color : 'var(--text-muted)'};"></i></button>`;
    }).join('');
  }
  if (window.lucide) lucide.createIcons();
}

function renderColorPickers(p1Selected = '#3b82f6', p2Selected = '#ec4899') {
  const c1 = document.getElementById('colorPickerP1');
  const c2 = document.getElementById('colorPickerP2');
  if (c1) {
    c1.innerHTML = AVAILABLE_COUPLE_COLORS.map(col => {
      const isSel = col.toLowerCase() === p1Selected.toLowerCase();
      return `<button type="button" onclick="window.selectColor('p1', '${col}')" style="width: 22px; height: 22px; border-radius: 50%; background: ${col}; border: ${isSel ? '2px solid #fff' : '2px solid transparent'}; outline: ${isSel ? `2px solid ${col}` : 'none'}; cursor: pointer; padding: 0; transition: transform 0.15s ease; ${isSel ? 'transform: scale(1.15);' : ''}"></button>`;
    }).join('');
  }
  if (c2) {
    c2.innerHTML = AVAILABLE_COUPLE_COLORS.map(col => {
      const isSel = col.toLowerCase() === p2Selected.toLowerCase();
      return `<button type="button" onclick="window.selectColor('p2', '${col}')" style="width: 22px; height: 22px; border-radius: 50%; background: ${col}; border: ${isSel ? '2px solid #fff' : '2px solid transparent'}; outline: ${isSel ? `2px solid ${col}` : 'none'}; cursor: pointer; padding: 0; transition: transform 0.15s ease; ${isSel ? 'transform: scale(1.15);' : ''}"></button>`;
    }).join('');
  }
}

window.selectAvatar = function(partner, avatarId) {
  const hiddenInput = document.getElementById(partner === 'p1' ? 'coupleP1Avatar' : 'coupleP2Avatar');
  if (hiddenInput) hiddenInput.value = avatarId;
  const p1Av = document.getElementById('coupleP1Avatar')?.value || 'user';
  const p2Av = document.getElementById('coupleP2Avatar')?.value || 'heart';
  const p1Col = document.getElementById('coupleP1Color')?.value || '#3b82f6';
  const p2Col = document.getElementById('coupleP2Color')?.value || '#ec4899';
  renderAvatarPickers(p1Av, p2Av, p1Col, p2Col);
};

window.selectColor = function(partner, colorHex) {
  const hiddenInput = document.getElementById(partner === 'p1' ? 'coupleP1Color' : 'coupleP2Color');
  if (hiddenInput) hiddenInput.value = colorHex;
  const p1Av = document.getElementById('coupleP1Avatar')?.value || 'user';
  const p2Av = document.getElementById('coupleP2Avatar')?.value || 'heart';
  const p1Col = document.getElementById('coupleP1Color')?.value || '#3b82f6';
  const p2Col = document.getElementById('coupleP2Color')?.value || '#ec4899';
  renderColorPickers(p1Col, p2Col);
  renderAvatarPickers(p1Av, p2Av, p1Col, p2Col);

  const box1 = document.getElementById('boxCouplePartner1');
  const box2 = document.getElementById('boxCouplePartner2');
  if (partner === 'p1' && box1) {
    box1.style.borderColor = `${colorHex}40`;
    box1.style.background = `${colorHex}08`;
  } else if (partner === 'p2' && box2) {
    box2.style.borderColor = `${colorHex}40`;
    box2.style.background = `${colorHex}08`;
  }
};

window.applyCouplePresetUI = function(presetKey) {
  let p1Av = 'user', p2Av = 'heart', p1Col = '#3b82f6', p2Col = '#ec4899';

  if (presetKey === 'hetero') {
    p1Av = 'user'; p1Col = '#3b82f6';
    p2Av = 'heart'; p2Col = '#ec4899';
  } else if (presetKey === 'gay_male') {
    p1Av = 'user'; p1Col = '#3b82f6';
    p2Av = 'sparkles'; p2Col = '#10b981';
  } else if (presetKey === 'lesbian_female') {
    p1Av = 'user-round'; p1Col = '#a855f7';
    p2Av = 'heart'; p2Col = '#ec4899';
  }

  const elP1Av = document.getElementById('coupleP1Avatar');
  const elP2Av = document.getElementById('coupleP2Avatar');
  const elP1Col = document.getElementById('coupleP1Color');
  const elP2Col = document.getElementById('coupleP2Color');

  if (elP1Av) elP1Av.value = p1Av;
  if (elP2Av) elP2Av.value = p2Av;
  if (elP1Col) elP1Col.value = p1Col;
  if (elP2Col) elP2Col.value = p2Col;

  ['Hetero', 'GayMale', 'LesbianFemale', 'Custom'].forEach(k => {
    const btn = document.getElementById(`btnPreset${k}`);
    if (btn) btn.classList.toggle('active', k.toLowerCase() === presetKey.replace('_', '').toLowerCase());
  });

  renderAvatarPickers(p1Av, p2Av, p1Col, p2Col);
  renderColorPickers(p1Col, p2Col);
};

window.applyCoupleModeVisibility = function() {
  const isCouple = (typeof finance !== 'undefined' && finance.isCoupleEnabled) ? finance.isCoupleEnabled() : true;

  const navCouple = document.getElementById('navItemCouple');
  const navSectionCouple = document.getElementById('navSectionTitleCouple');
  const navActivateCouple = document.getElementById('navItemActivateCouple');

  if (navCouple) navCouple.style.display = isCouple ? 'flex' : 'none';
  if (navSectionCouple) navSectionCouple.textContent = isCouple ? 'Gestão & Casal' : 'Gestão Pessoal';
  if (navActivateCouple) navActivateCouple.style.display = !isCouple ? 'flex' : 'none';

  const btnHeaderDevice = document.getElementById('btnHeaderDeviceOwner');
  if (btnHeaderDevice) btnHeaderDevice.style.display = isCouple ? 'inline-flex' : 'none';

  const txCoupleGroup = document.getElementById('txCoupleSplitGroup');
  const txAuthorGroup = document.getElementById('txAuthorFieldGroup');
  if (txCoupleGroup) txCoupleGroup.style.display = isCouple ? 'block' : 'none';
  if (txAuthorGroup) txAuthorGroup.style.display = isCouple ? 'block' : 'none';

  const accOwnerGroup = document.getElementById('accOwnerGroup');
  if (accOwnerGroup) accOwnerGroup.style.display = isCouple ? 'block' : 'none';

  const coupleFields = document.getElementById('coupleSettingsFieldsContainer');
  if (coupleFields) coupleFields.style.display = isCouple ? 'flex' : 'none';

  const btnModeInd = document.getElementById('btnModeIndividual');
  const btnModeCpl = document.getElementById('btnModeCouple');
  if (btnModeInd && btnModeCpl) {
    btnModeInd.className = !isCouple ? 'btn btn-primary' : 'btn btn-outline';
    btnModeCpl.className = isCouple ? 'btn btn-primary' : 'btn btn-outline';
  }

  if (isCouple && window.syncDeviceIdentityUI) {
    window.syncDeviceIdentityUI();
  }
};

window.setAppManagementMode = async function(mode) {
  const isCouple = mode === 'couple';
  await finance.setCoupleEnabled(isCouple);
  window.applyCoupleModeVisibility();
  if (!isCouple && currentTab === 'couple') {
    switchTab('dashboard');
  } else if (isCouple && currentTab === 'couple') {
    renderCoupleView();
  }
  if (currentTab === 'accounts') renderAccountsView();
  showToast(isCouple ? 'Modo Casal ativado com sucesso!' : 'Modo Individual ativado! Interface simplificada.', 'success');
  if (window.lucide) lucide.createIcons();
};

window.openCoupleSettingsModalDirect = function() {
  const btnOpen = document.getElementById('btnOpenCoupleSettingsModal');
  if (btnOpen) btnOpen.click();
};

function setupModals() {
  // Modal Transação
  const txModal = document.getElementById('txModal');
  const btnOpenTx = document.getElementById('btnOpenNewTxModal');
  const btnCloseTx = document.getElementById('btnCloseTxModal');
  const btnCancelTx = document.getElementById('btnCancelTx');
  const txForm = document.getElementById('txForm');

  const toggleExpense = document.getElementById('toggleExpense');
  const toggleIncome = document.getElementById('toggleIncome');
  const toggleTransfer = document.getElementById('toggleTransfer');
  const normalTxFields = document.getElementById('normalTxFields');
  const transferTxFields = document.getElementById('transferTxFields');
  const installmentsGroup = document.getElementById('installmentsGroup');

  let lastEditedAmountField = 'installment'; // 'installment' | 'total' | 'single'
  let activeCalcTargetInputRef = null;

  const txAmountInput = document.getElementById('txAmount');
  const txInstallmentAmountInput = document.getElementById('txInstallmentAmount');
  const txTotalAmountInput = document.getElementById('txTotalAmount');
  const txDateInput = document.getElementById('txDate');
  const txDateMirroredInput = document.getElementById('txDateMirrored');
  const singleAmountGroup = document.getElementById('singleAmountGroup');
  const mirroredAmountGroup = document.getElementById('mirroredAmountGroup');
  const mirroredSummary = document.getElementById('mirroredCalculationSummary');
  const txInstSelect = document.getElementById('txInstallments');

  function syncMirroredAmounts(triggerField) {
    const instVal = parseInt(txInstSelect?.value || '1', 10);
    if (instVal <= 1) {
      if (triggerField === 'single' && txAmountInput) {
        const val = txAmountInput.value;
        if (txInstallmentAmountInput) txInstallmentAmountInput.value = val;
        if (txTotalAmountInput) txTotalAmountInput.value = val;
      }
      return;
    }

    if (triggerField === 'installment') {
      lastEditedAmountField = 'installment';
      const parsedInst = parseCurrencyInput(txInstallmentAmountInput?.value || '');
      if (parsedInst > 0) {
        const totalCalc = +(parsedInst * instVal).toFixed(2);
        if (txTotalAmountInput) txTotalAmountInput.value = formatCurrencyInput(totalCalc);
        if (txAmountInput) txAmountInput.value = txInstallmentAmountInput.value;
        if (mirroredSummary) {
          mirroredSummary.innerHTML = `💡 <b>${instVal}x de ${currencyFormatter.format(parsedInst)}</b> = Total <b>${currencyFormatter.format(totalCalc)}</b>`;
        }
      } else {
        if (txTotalAmountInput) txTotalAmountInput.value = '';
        if (txAmountInput) txAmountInput.value = '';
        if (mirroredSummary) {
          mirroredSummary.innerHTML = `💡 Digite o valor da parcela ou o total da compra`;
        }
      }
    } else if (triggerField === 'total') {
      lastEditedAmountField = 'total';
      const parsedTotal = parseCurrencyInput(txTotalAmountInput?.value || '');
      if (parsedTotal > 0) {
        const perInst = +(parsedTotal / instVal).toFixed(2);
        if (txInstallmentAmountInput) txInstallmentAmountInput.value = formatCurrencyInput(perInst);
        if (txAmountInput) txAmountInput.value = formatCurrencyInput(perInst);
        if (mirroredSummary) {
          mirroredSummary.innerHTML = `💡 Total <b>${currencyFormatter.format(parsedTotal)}</b> = <b>${instVal}x de ${currencyFormatter.format(perInst)}</b>`;
        }
      } else {
        if (txInstallmentAmountInput) txInstallmentAmountInput.value = '';
        if (txAmountInput) txAmountInput.value = '';
        if (mirroredSummary) {
          mirroredSummary.innerHTML = `💡 Digite o valor da parcela ou o total da compra`;
        }
      }
    } else if (triggerField === 'installments_change') {
      if (lastEditedAmountField === 'total') {
        const parsedTotal = parseCurrencyInput(txTotalAmountInput?.value || '');
        if (parsedTotal > 0) {
          const perInst = +(parsedTotal / instVal).toFixed(2);
          if (txInstallmentAmountInput) txInstallmentAmountInput.value = formatCurrencyInput(perInst);
          if (txAmountInput) txAmountInput.value = formatCurrencyInput(perInst);
          if (mirroredSummary) {
            mirroredSummary.innerHTML = `💡 Total <b>${currencyFormatter.format(parsedTotal)}</b> = <b>${instVal}x de ${currencyFormatter.format(perInst)}</b>`;
          }
        }
      } else {
        const parsedInst = parseCurrencyInput(txInstallmentAmountInput?.value || '');
        if (parsedInst > 0) {
          const totalCalc = +(parsedInst * instVal).toFixed(2);
          if (txTotalAmountInput) txTotalAmountInput.value = formatCurrencyInput(totalCalc);
          if (txAmountInput) txAmountInput.value = txInstallmentAmountInput.value;
          if (mirroredSummary) {
            mirroredSummary.innerHTML = `💡 <b>${instVal}x de ${currencyFormatter.format(parsedInst)}</b> = Total <b>${currencyFormatter.format(totalCalc)}</b>`;
          }
        }
      }
    }
  }

  function updateInstallmentHelperUI() {
    const instVal = parseInt(txInstSelect?.value || '1', 10);
    const isMirrored = instVal > 1 && currentTxType === 'expense';

    if (isMirrored) {
      if (singleAmountGroup) singleAmountGroup.style.display = 'none';
      if (mirroredAmountGroup) mirroredAmountGroup.style.display = 'block';

      // Sincroniza campos se o valor unitário estava preenchido mas os espelhados ainda não
      const currentInstRaw = txInstallmentAmountInput?.value || '';
      const currentTotRaw = txTotalAmountInput?.value || '';
      const singleRaw = txAmountInput?.value || '';

      if (!currentInstRaw && !currentTotRaw && singleRaw) {
        if (lastEditedAmountField === 'total') {
          if (txTotalAmountInput) txTotalAmountInput.value = singleRaw;
          syncMirroredAmounts('total');
        } else {
          if (txInstallmentAmountInput) txInstallmentAmountInput.value = singleRaw;
          syncMirroredAmounts('installment');
        }
      } else {
        syncMirroredAmounts('installments_change');
      }

      // Sincroniza data
      if (txDateInput && txDateMirroredInput && txDateInput.value && !txDateMirroredInput.value) {
        txDateMirroredInput.value = txDateInput.value;
      }
    } else {
      if (singleAmountGroup) singleAmountGroup.style.display = 'grid';
      if (mirroredAmountGroup) mirroredAmountGroup.style.display = 'none';

      // Ao voltar para 1x, passa o valor correspondente de volta para o campo único
      const currentInstRaw = txInstallmentAmountInput?.value || '';
      const currentTotRaw = txTotalAmountInput?.value || '';
      if (currentInstRaw && (!txAmountInput.value || lastEditedAmountField === 'installment')) {
        txAmountInput.value = currentInstRaw;
      } else if (currentTotRaw && !txAmountInput.value) {
        txAmountInput.value = currentTotRaw;
      }

      if (txDateMirroredInput && txDateInput && txDateMirroredInput.value) {
        txDateInput.value = txDateMirroredInput.value;
      }
    }
    if (window.lucide) lucide.createIcons();
  }

  window.selectTxAuthor = function(role) {
    const cleanRole = role === 'p2' ? 'p2' : 'p1';
    const createdByInput = document.getElementById('txCreatedBy');
    const btnA1 = document.getElementById('btnTxAuthorP1');
    const btnA2 = document.getElementById('btnTxAuthorP2');
    if (createdByInput) createdByInput.value = cleanRole;
    if (btnA1 && btnA2) {
      btnA1.classList.toggle('active', cleanRole === 'p1');
      btnA2.classList.toggle('active', cleanRole === 'p2');
    }
  };

  btnOpenTx.addEventListener('click', () => {
    document.getElementById('txEditId').value = '';
    txForm.reset();
    lastEditedAmountField = 'installment';
    activeCalcTargetInputRef = null;
    if (txInstSelect) txInstSelect.value = '1';
    const todayStr = localDateStr();
    if (txDateInput) txDateInput.value = todayStr;
    if (txDateMirroredInput) txDateMirroredInput.value = todayStr;
    if (txAmountInput) txAmountInput.value = '';
    if (txInstallmentAmountInput) txInstallmentAmountInput.value = '';
    if (txTotalAmountInput) txTotalAmountInput.value = '';
    document.querySelector('#txModal h3').textContent = 'Registrar Transação';
    document.querySelector('#txModal button[type="submit"]').textContent = 'Salvar Lançamento';
    document.getElementById('installmentsGroup').style.display = 'grid';
    toggleExpense.click();
    updateInstallmentHelperUI();

    const devId = finance.getDeviceIdentity();
    if (window.syncDeviceIdentityUI) window.syncDeviceIdentityUI();
    window.selectTxAuthor(devId.ownerRole);

    // Reseta campos do casal (pré-selecionando quem é o dono deste aparelho)
    const isSharedCheck = document.getElementById('txIsShared');
    const sharedDetails = document.getElementById('txSharedDetailsContainer');
    const paidByInput = document.getElementById('txPaidBy');
    const splitRuleSelect = document.getElementById('txSplitRule');
    const coupleNoteInput = document.getElementById('txCoupleNote');
    const btnP1 = document.getElementById('btnTxPayerP1');
    const btnP2 = document.getElementById('btnTxPayerP2');
    if (isSharedCheck) isSharedCheck.checked = false;
    if (sharedDetails) sharedDetails.style.display = 'none';
    if (paidByInput) paidByInput.value = devId.ownerRole;
    if (splitRuleSelect) splitRuleSelect.value = 'default';
    if (coupleNoteInput) coupleNoteInput.value = '';
    if (btnP1 && btnP2) {
      btnP1.classList.toggle('active', devId.ownerRole === 'p1');
      btnP2.classList.toggle('active', devId.ownerRole === 'p2');
    }

    // Popula seletores de Projetos e Side Hustles
    const ccSelect = document.getElementById('txCostCenterSelect');
    if (ccSelect) {
      ccSelect.innerHTML = '<option value="">Nenhum (Gasto Pessoal Comum)</option>' +
        (finance.state.costCenters || []).map(cc => `<option value="${cc.id}">${cc.name} (${cc.isolateFromMonthlyBudget ? 'Isolado do Fixo' : 'Orçamento Fixo'})</option>`).join('');
    }

    const shSelect = document.getElementById('txSideHustleSelect');
    if (shSelect) {
      shSelect.innerHTML = '<option value="">Nenhum (Pessoal)</option>' +
        (finance.state.sideHustles || []).map(sh => `<option value="${sh.id}">⚡ ${sh.name}</option>`).join('');
    }

    txModal.classList.add('open');
    if (window.lucide) lucide.createIcons({ root: txModal });
    setTimeout(() => {
      const descInput = document.getElementById('txDesc');
      if (descInput) {
        descInput.focus();
        if (typeof descInput.select === 'function') descInput.select();
      }
    }, 70);
  });

  const closeTx = () => {
    txModal.classList.remove('open');
    document.getElementById('txEditId').value = '';
    txForm.reset();
    lastEditedAmountField = 'installment';
    activeCalcTargetInputRef = null;
    if (txAmountInput) txAmountInput.value = '';
    if (txInstallmentAmountInput) txInstallmentAmountInput.value = '';
    if (txTotalAmountInput) txTotalAmountInput.value = '';
    const isSharedCheck = document.getElementById('txIsShared');
    const sharedDetails = document.getElementById('txSharedDetailsContainer');
    if (isSharedCheck) isSharedCheck.checked = false;
    if (sharedDetails) sharedDetails.style.display = 'none';
    updateInstallmentHelperUI();
  };
  btnCloseTx.addEventListener('click', closeTx);
  btnCancelTx.addEventListener('click', closeTx);

  if (txInstSelect) txInstSelect.addEventListener('change', updateInstallmentHelperUI);

  if (txAmountInput) {
    txAmountInput.addEventListener('input', () => {
      lastEditedAmountField = 'single';
      syncMirroredAmounts('single');
    });
  }

  if (txInstallmentAmountInput) {
    txInstallmentAmountInput.addEventListener('input', () => {
      syncMirroredAmounts('installment');
    });
  }

  if (txTotalAmountInput) {
    txTotalAmountInput.addEventListener('input', () => {
      syncMirroredAmounts('total');
    });
  }

  if (txDateInput && txDateMirroredInput) {
    txDateInput.addEventListener('change', () => {
      txDateMirroredInput.value = txDateInput.value;
    });
    txDateMirroredInput.addEventListener('change', () => {
      txDateInput.value = txDateMirroredInput.value;
    });
  }

  // Função universal para aplicar máscara de Moeda Brasileira (R$) em qualquer campo
  function attachCurrencyMask(inputEl) {
    if (!inputEl) return;
    try {
      inputEl.type = 'text';
      inputEl.inputMode = 'numeric';
      inputEl.removeAttribute('pattern');
      inputEl.setAttribute('autocomplete', 'off');
    } catch (e) {
      // Ignora erro de tipo se o navegador restringir troca em runtime
    }

    inputEl.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (!val) {
        e.target.value = '';
        if (e.target === txInstallmentAmountInput) syncMirroredAmounts('installment');
        else if (e.target === txTotalAmountInput) syncMirroredAmounts('total');
        else if (e.target === txAmountInput) syncMirroredAmounts('single');
        return;
      }
      const num = (parseInt(val, 10) / 100).toFixed(2);
      e.target.value = formatCurrencyInput(num);
      
      // Sincroniza espelhamento apenas se for estritamente um dos campos de parcelamento de transação
      if (e.target === txInstallmentAmountInput) {
        syncMirroredAmounts('installment');
      } else if (e.target === txTotalAmountInput) {
        syncMirroredAmounts('total');
      } else if (e.target === txAmountInput) {
        syncMirroredAmounts('single');
      }
    });

    // Sanitização inteligente ao colar valores com prefixo R$, espaços ou separador decimal
    inputEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const rawPasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const parsed = parseCurrencyInput(rawPasted);
      inputEl.value = formatCurrencyInput(parsed);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  // Função universal para garantir que o texto inicie com letra Maiúscula (em mobile e desktop)
  function applyAutoCapitalizeFirstLetter(inputEl) {
    if (!inputEl) return;
    inputEl.setAttribute('autocapitalize', 'sentences');
    inputEl.setAttribute('autocorrect', 'on');
    inputEl.setAttribute('autocomplete', 'on');
    inputEl.setAttribute('spellcheck', 'true');

    const handleCapitalize = () => {
      const val = inputEl.value;
      if (!val) return;
      // Se começa com espaços e depois uma letra minúscula (ex: "casa" ou "   casa")
      const match = val.match(/^(\s*)([a-zà-ÿ])/);
      if (match) {
        const leadingSpaces = match[1];
        const firstChar = match[2];
        const start = inputEl.selectionStart;
        const end = inputEl.selectionEnd;
        inputEl.value = leadingSpaces + firstChar.toUpperCase() + val.slice(leadingSpaces.length + 1);
        if (inputEl.setSelectionRange && start !== null) {
          inputEl.setSelectionRange(start, end);
        }
      }
    };

    inputEl.addEventListener('input', handleCapitalize);
    inputEl.addEventListener('blur', handleCapitalize);
    inputEl.addEventListener('change', handleCapitalize);
  }

  // Aplica máscara automática em todos os campos de valor do app
  document.querySelectorAll('.mask-money-input').forEach(attachCurrencyMask);

  // Aplica auto-capitalização inicial em todos os campos de texto comuns
  document.querySelectorAll('input:not([readonly]):not([type="tel"]):not([type="number"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):not([type="date"]):not(.mask-money-input), textarea').forEach((el) => {
    if (el.id && (el.id.toLowerCase().includes('pix') || el.id.toLowerCase().includes('search') || el.id.toLowerCase().includes('pass') || el.id.toLowerCase().includes('barcode') || el.id.toLowerCase().includes('color'))) {
      return;
    }
    applyAutoCapitalizeFirstLetter(el);
  });

  toggleExpense.addEventListener('click', () => {
    currentTxType = 'expense';
    toggleExpense.className = 'type-toggle-btn active-expense';
    toggleIncome.className = 'type-toggle-btn';
    toggleTransfer.className = 'type-toggle-btn';
    normalTxFields.style.display = 'grid';
    transferTxFields.style.display = 'none';
    if (!document.getElementById('txEditId').value) {
      installmentsGroup.style.display = 'grid';
    }
    updateInstallmentHelperUI();
    filterCategoriesByType('expense');
    updateTxAccountDropdown('expense');
  });

  toggleIncome.addEventListener('click', () => {
    currentTxType = 'income';
    toggleIncome.className = 'type-toggle-btn active-income';
    toggleExpense.className = 'type-toggle-btn';
    toggleTransfer.className = 'type-toggle-btn';
    normalTxFields.style.display = 'grid';
    transferTxFields.style.display = 'none';
    installmentsGroup.style.display = 'none';
    updateInstallmentHelperUI();
    filterCategoriesByType('income');
    updateTxAccountDropdown('income');
  });

  toggleTransfer.addEventListener('click', () => {
    currentTxType = 'transfer';
    toggleTransfer.className = 'type-toggle-btn active-income';
    toggleExpense.className = 'type-toggle-btn';
    toggleIncome.className = 'type-toggle-btn';
    normalTxFields.style.display = 'none';
    transferTxFields.style.display = 'grid';
    installmentsGroup.style.display = 'none';
    updateInstallmentHelperUI();
    updateTxAccountDropdown('transfer');
  });

  let isSubmittingTx = false;

  txForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmittingTx) return; // Prevenção ativa contra cliques duplos

    const editId = document.getElementById('txEditId').value;
    const instVal = parseInt(document.getElementById('txInstallments')?.value || '1', 10);
    const isMirrored = instVal > 1 && currentTxType === 'expense' && !editId;

    let parsedAmount = 0;
    let parsedInstallmentAmount = 0;
    let parsedTotalAmount = 0;
    let txDateVal = document.getElementById('txDate').value;

    if (isMirrored) {
      parsedInstallmentAmount = parseCurrencyInput(document.getElementById('txInstallmentAmount')?.value || '');
      parsedTotalAmount = parseCurrencyInput(document.getElementById('txTotalAmount')?.value || '');
      txDateVal = document.getElementById('txDateMirrored')?.value || txDateVal;

      if (isNaN(parsedInstallmentAmount) || parsedInstallmentAmount <= 0) {
        showAppAlert({
          title: 'Valor Inválido',
          message: 'Por favor, informe o valor de cada parcela ou o valor total da compra.',
          type: 'warning'
        });
        document.getElementById('txInstallmentAmount')?.focus();
        return;
      }
      parsedAmount = parsedInstallmentAmount;
      if (isNaN(parsedTotalAmount) || parsedTotalAmount <= 0) {
        parsedTotalAmount = round2(parsedInstallmentAmount * instVal);
      }
    } else {
      const rawAmount = document.getElementById('txAmount').value;
      parsedAmount = parseCurrencyInput(rawAmount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        showAppAlert({
          title: 'Valor Obrigatório',
          message: 'Por favor, informe um valor válido maior que zero.',
          type: 'warning'
        });
        document.getElementById('txAmount')?.focus();
        return;
      }
      parsedInstallmentAmount = parsedAmount;
      parsedTotalAmount = round2(parsedAmount * instVal);
    }

    const fromAcc = document.getElementById('txFromAccount')?.value;
    const toAcc = document.getElementById('txToAccount')?.value;
    const singleAcc = document.getElementById('txAccount')?.value;

    // Validação rígida: Transferências não podem ter mesma conta na origem e destino
    if (currentTxType === 'transfer') {
      if (!fromAcc || !toAcc) {
        showAppAlert({
          title: 'Contas Obrigatórias',
          message: 'Selecione a conta de origem e a conta de destino para a transferência.',
          type: 'warning'
        });
        return;
      }
      if (fromAcc === toAcc) {
        showAppAlert({
          title: 'Transferência Inválida',
          message: 'A conta de origem e a conta de destino não podem ser iguais.',
          type: 'warning'
        });
        return;
      }
    } else {
      // Validação rígida: Conta bancária ou cartão deve existir e estar selecionada
      if (!singleAcc) {
        showAppAlert({
          title: 'Conta Obrigatória',
          message: 'Você precisa ter pelo menos uma conta bancária ou cartão cadastrado para salvar o lançamento.',
          type: 'warning'
        });
        return;
      }
    }

    const isSharedVal = !!document.getElementById('txIsShared')?.checked;
    const paidByVal = document.getElementById('txPaidBy')?.value || 'p1';
    const splitRuleVal = document.getElementById('txSplitRule')?.value || 'default';
    let customSplitVal = null;
    if (splitRuleVal === 'custom') {
      const p1Range = parseInt(document.getElementById('txCustomSplitRange')?.value || 50, 10);
      customSplitVal = { p1: p1Range, p2: 100 - p1Range };
    }
    const coupleNoteVal = document.getElementById('txCoupleNote')?.value || '';

    const data = {
      description: (document.getElementById('txDesc').value || '').trim(),
      amount: parsedAmount,
      installmentAmount: parsedInstallmentAmount,
      totalPurchaseAmount: parsedTotalAmount,
      type: currentTxType,
      categoryId: document.getElementById('txCategory').value,
      accountId: singleAcc,
      fromAccountId: fromAcc,
      toAccountId: toAcc,
      installments: instVal,
      installmentValueType: lastEditedAmountField === 'total' ? 'total' : 'installment',
      recurring: document.getElementById('txRecurring') ? document.getElementById('txRecurring').value : 'none',
      date: txDateVal || localDateStr(),
      notes: document.getElementById('txNotes').value,
      costCenterId: document.getElementById('txCostCenterSelect') ? document.getElementById('txCostCenterSelect').value || null : null,
      sideHustleId: document.getElementById('txSideHustleSelect') ? document.getElementById('txSideHustleSelect').value || null : null,
      entityType: document.querySelector('input[name="txEntityType"]:checked')?.value || (currentEntityFilter !== 'all' ? currentEntityFilter : 'pf'),
      createdBy: document.getElementById('txCreatedBy')?.value || finance.getDeviceIdentity().ownerRole,
      isShared: isSharedVal,
      paidBy: paidByVal,
      splitRule: splitRuleVal,
      customSplit: customSplitVal,
      coupleNote: coupleNoteVal
    };

    if (!data.description) {
      showAppAlert({
        title: 'Descrição Obrigatória',
        message: 'Por favor, informe uma descrição para identificar o lançamento.',
        type: 'warning'
      });
      document.getElementById('txDesc')?.focus();
      return;
    }

    // Feedback visual imediato e bloqueio de cliques duplos
    isSubmittingTx = true;
    const submitBtn = txForm.querySelector('button[type="submit"]');
    const origBtnText = submitBtn ? submitBtn.innerHTML : 'Salvar';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span style="display:inline-flex; align-items:center; gap:6px;">Gravando...</span>';
    }

    try {
      if (editId) {
        await finance.updateTransaction(editId, data);
        showToast('Transação atualizada com sucesso!', 'success');
      } else {
        await finance.addTransaction(data);
        showToast(instVal > 1 ? `Compra parcelada em ${instVal}x registrada com sucesso!` : 'Transação registrada com sucesso!', 'success');
      }

      closeTx();

      // Sincroniza Dashboard e demais visões em tempo real
      renderDashboard();
      renderTransactionsView();
      renderAccountsView();
      if (selectedAccountId) renderSelectedAccountDetails();
      if (currentTab === 'budgets') renderBudgetsView();
      if (currentTab === 'forecast') renderForecastView();
      if (currentTab === 'cost-centers') renderCostCentersView();
      if (currentTab === 'side-hustles') renderSideHustlesView();
      if (currentTab === 'couple') renderCoupleView();
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Erro ao salvar transação:', err);
      showAppAlert({
        title: 'Erro de Gravação',
        message: `Não foi possível salvar os dados: ${err.message || 'Falha de comunicação com o armazenamento local.'}`,
        type: 'error'
      });
    } finally {
      isSubmittingTx = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnText;
      }
    }
  });

  // Modal Agendamento (Contas a Pagar / Receber / Salário)
  const schModal = document.getElementById('schModal');
  const btnOpenSch = document.getElementById('btnOpenNewScheduleModal');
  const btnCloseSch = document.getElementById('btnCloseSchModal');
  const btnCancelSch = document.getElementById('btnCancelSch');
  const schForm = document.getElementById('schForm');
  const schTypeSelect = document.getElementById('schType');
  const schDayRuleSelect = document.getElementById('schDayRule');
  const schDueDateContainer = document.getElementById('schDueDateContainer');
  const schBarcodeGroup = document.getElementById('schBarcodeGroup');
  const schIncomeAlertBanner = document.getElementById('schIncomeAlertBanner');
  const schAccountLabel = document.getElementById('schAccountLabel');
  const schCategoryLabel = document.getElementById('schCategoryLabel');
  const schCategorySelect = document.getElementById('schCategory');

  const populateScheduleCategories = (type, selectedId = null) => {
    if (!schCategorySelect) return;
    const cats = finance.state.categories.filter(c => c.type === type);
    schCategorySelect.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (selectedId && cats.some(c => c.id === selectedId)) {
      schCategorySelect.value = selectedId;
    } else if (cats.length > 0) {
      schCategorySelect.value = cats[0].id;
    }
  };

  const updateSchTypeUI = (selectedCatId = null) => {
    const isIncome = schTypeSelect ? schTypeSelect.value === 'income' : false;
    if (schBarcodeGroup) schBarcodeGroup.style.display = isIncome ? 'none' : 'block';
    if (schIncomeAlertBanner) schIncomeAlertBanner.style.display = isIncome ? 'block' : 'none';
    if (schAccountLabel) schAccountLabel.textContent = isIncome ? 'Conta Bancária de Depósito (Destino)' : 'Conta Bancária para Débito (Saída)';
    if (schCategoryLabel) schCategoryLabel.textContent = isIncome ? 'Categoria do Recebimento' : 'Categoria da Despesa / Conta';
    populateScheduleCategories(isIncome ? 'income' : 'expense', selectedCatId);
    if (document.getElementById('schDesc') && !document.getElementById('schDesc').value) {
      document.getElementById('schDesc').placeholder = isIncome ? 'Ex: Seguro Desemprego, Salário Mensal, Freela' : 'Ex: Claro Internet, Enel Energia, Aluguel';
    }
    const btnSubmit = document.getElementById('btnSubmitSch');
    if (btnSubmit) {
      btnSubmit.textContent = isIncome ? 'Agendar Recebimento' : 'Agendar Conta / Boleto';
    }
  };

  const updateDayRuleUI = () => {
    const rule = schDayRuleSelect ? schDayRuleSelect.value : 'fixed';
    if (rule === 'fixed') {
      if (schDueDateContainer) schDueDateContainer.style.display = 'block';
    } else {
      // Pega o ano e mês atualmente no input de data (se houver), ou a data atual
      const curVal = document.getElementById('schDueDate')?.value;
      let targetYear, targetMonth;
      if (curVal && curVal.includes('-')) {
        const parts = curVal.split('-').map(Number);
        targetYear = parts[0];
        targetMonth = parts[1];
      } else {
        const now = new Date();
        targetYear = now.getFullYear();
        targetMonth = now.getMonth() + 1;
      }
      const calcDate = finance.calculateBusinessDayDate(targetYear, targetMonth, rule);
      const yStr = calcDate.getFullYear();
      const mStr = String(calcDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(calcDate.getDate()).padStart(2, '0');
      document.getElementById('schDueDate').value = `${yStr}-${mStr}-${dStr}`;
      if (schDueDateContainer) schDueDateContainer.style.display = 'block';
    }
  };

  if (schTypeSelect) {
    schTypeSelect.addEventListener('change', () => {
      updateSchTypeUI();
      // Não sobrescreve forçadamente a regra nem a data digitada pelo usuário
    });
  }

  // Auto-detecção inteligente de categoria no Agendamento enquanto o usuário digita
  const schDescInput = document.getElementById('schDesc');
  if (schDescInput) {
    schDescInput.addEventListener('input', () => {
      const isIncome = schTypeSelect ? schTypeSelect.value === 'income' : false;
      const detectedCatId = detectCategoryFromDescription(schDescInput.value, isIncome ? 'income' : 'expense');
      if (detectedCatId && schCategorySelect) {
        if (schCategorySelect.querySelector(`option[value="${detectedCatId}"]`)) {
          schCategorySelect.value = detectedCatId;
        }
      }
    });
  }

  if (schDayRuleSelect) {
    schDayRuleSelect.addEventListener('change', updateDayRuleUI);
  }

  // Se o usuário selecionou ou digitou uma data manualmente, a regra passa imediatamente a ser 'Data Fixa' (fixed)
  const schDueDateInput = document.getElementById('schDueDate');
  if (schDueDateInput) {
    const onManualDateChange = () => {
      if (schDayRuleSelect && schDayRuleSelect.value !== 'fixed') {
        schDayRuleSelect.value = 'fixed';
      }
    };
    schDueDateInput.addEventListener('change', onManualDateChange);
    schDueDateInput.addEventListener('input', onManualDateChange);
  }

  if (btnOpenSch) {
    btnOpenSch.addEventListener('click', () => {
      schForm.reset();
      document.getElementById('schEditId').value = '';
      const titleEl = document.querySelector('#schModal h3');
      if (titleEl) titleEl.textContent = 'Novo Agendamento';
      const submitBtn = document.getElementById('btnSubmitSch');
      if (submitBtn) submitBtn.textContent = 'Salvar Agendamento';
      document.getElementById('schAmount').value = '0,00';
      document.getElementById('schDueDate').value = localDateStr();
      if (schDayRuleSelect) schDayRuleSelect.value = 'fixed';
      updateSchTypeUI();
      updateDayRuleUI();
      schModal.classList.add('open');
    });
  }

  const closeSch = () => {
    schModal.classList.remove('open');
    document.getElementById('schEditId').value = '';
    schForm.reset();
  };
  if (btnCloseSch) btnCloseSch.addEventListener('click', closeSch);
  if (btnCancelSch) btnCancelSch.addEventListener('click', closeSch);

  if (schForm) {
    let isSubmittingSch = false;
    schForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingSch) return;

      const editId = document.getElementById('schEditId')?.value;
      const barcodeVal = document.getElementById('schBarcode') ? document.getElementById('schBarcode').value.trim() : '';
      let dayRuleVal = document.getElementById('schDayRule') ? document.getElementById('schDayRule').value : 'fixed';
      const typedDueDate = document.getElementById('schDueDate')?.value || localDateStr();

      // Garantia absoluta: se o usuário digitou ou escolheu uma data cujo dia difere do dia da regra útil,
      // respeita a data digitada como data fixa ('fixed')!
      if (dayRuleVal !== 'fixed' && typedDueDate) {
        const [y, m, d] = typedDueDate.split('-').map(Number);
        const expDate = finance.calculateBusinessDayDate(y, m, dayRuleVal);
        if (d && d !== expDate.getDate()) {
          dayRuleVal = 'fixed';
          if (schDayRuleSelect) schDayRuleSelect.value = 'fixed';
        }
      }

      const scheduleData = {
        description: (document.getElementById('schDesc')?.value || '').trim(),
        amount: parseCurrencyInput(document.getElementById('schAmount')?.value || '0'),
        type: document.getElementById('schType')?.value || 'expense',
        categoryId: document.getElementById('schCategory')?.value,
        dueDate: typedDueDate,
        dayRule: dayRuleVal,
        recurring: document.getElementById('schRecurring')?.value || 'monthly',
        accountId: document.getElementById('schAccount')?.value,
        barcode: barcodeVal,
        isBill: document.getElementById('schType')?.value === 'expense'
      };

      if (!scheduleData.description) {
        showAppAlert({
          title: 'Descrição Obrigatória',
          message: 'Por favor, informe uma descrição para o agendamento.',
          type: 'warning'
        });
        document.getElementById('schDesc')?.focus();
        return;
      }

      if (isNaN(scheduleData.amount) || scheduleData.amount <= 0) {
        showAppAlert({
          title: 'Valor Inválido',
          message: 'Por favor, informe um valor válido maior que zero.',
          type: 'warning'
        });
        document.getElementById('schAmount')?.focus();
        return;
      }

      if (!scheduleData.accountId) {
        showAppAlert({
          title: 'Conta Obrigatória',
          message: 'Por favor, selecione uma conta bancária para o débito/crédito deste agendamento.',
          type: 'warning'
        });
        return;
      }

      isSubmittingSch = true;
      const submitBtn = document.getElementById('btnSubmitSch');
      const origText = submitBtn ? submitBtn.textContent : 'Salvar';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gravando...';
      }

      try {
        if (editId) {
          await finance.updateSchedule(editId, scheduleData);
          showToast('Agendamento atualizado com sucesso!', 'success');
        } else {
          await finance.addSchedule(scheduleData);
          showToast('Agendamento cadastrado com sucesso!', 'success');
        }

        closeSch();
        renderSchedulesView();
        renderAccountsView();
        renderDashboard();
      } catch (err) {
        console.error('Erro ao salvar agendamento:', err);
        showAppAlert({
          title: 'Erro de Gravação',
          message: `Não foi possível salvar o agendamento: ${err.message || 'Falha de gravação local.'}`,
          type: 'error'
        });
      } finally {
        isSubmittingSch = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
        }
      }
    });
  }

  // Modal Bens & Financiamentos
  const assetModal = document.getElementById('assetModal');
  const btnOpenAsset = document.getElementById('btnOpenNewAssetModal');
  const btnCloseAsset = document.getElementById('btnCloseAssetModal');
  const btnCancelAsset = document.getElementById('btnCancelAsset');
  const assetForm = document.getElementById('assetForm');

  if (btnOpenAsset) {
    btnOpenAsset.addEventListener('click', () => {
      assetForm.reset();
      document.getElementById('assetValue').value = '0,00';
      document.getElementById('assetFinanced').value = '0,00';
      assetModal.classList.add('open');
    });
  }
  const closeAsset = () => assetModal.classList.remove('open');
  if (btnCloseAsset) btnCloseAsset.addEventListener('click', closeAsset);
  if (btnCancelAsset) btnCancelAsset.addEventListener('click', closeAsset);

  if (assetForm) {
    assetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await finance.addAsset({
        name: document.getElementById('assetName').value,
        type: document.getElementById('assetType').value,
        estimatedValue: parseCurrencyInput(document.getElementById('assetValue').value),
        financedValue: parseCurrencyInput(document.getElementById('assetFinanced').value),
        installmentsPaid: document.getElementById('assetPaid').value,
        installmentsTotal: document.getElementById('assetTotal').value
      });
      assetForm.reset();
      closeAsset();
      renderAssetsView();
      renderDashboard();
    });
  }

  // Filtros da View de Categorias
  const btnFilterAllCats = document.getElementById('btnFilterAllCats');
  const btnFilterExpenseCats = document.getElementById('btnFilterExpenseCats');
  const btnFilterIncomeCats = document.getElementById('btnFilterIncomeCats');
  const btnFilterTransferCats = document.getElementById('btnFilterTransferCats');

  if (btnFilterAllCats) btnFilterAllCats.addEventListener('click', () => handleFilterCategories('all'));
  if (btnFilterExpenseCats) btnFilterExpenseCats.addEventListener('click', () => handleFilterCategories('expense'));
  if (btnFilterIncomeCats) btnFilterIncomeCats.addEventListener('click', () => handleFilterCategories('income'));
  if (btnFilterTransferCats) btnFilterTransferCats.addEventListener('click', () => handleFilterCategories('transfer'));

  // Modal Nova / Editar Categoria
  const catModal = document.getElementById('categoryModal');
  const btnOpenCat = document.getElementById('btnOpenNewCategoryModal');
  const btnCloseCat = document.getElementById('btnCloseCategoryModal');
  const btnCancelCat = document.getElementById('btnCancelCategory');
  const catForm = document.getElementById('categoryForm');
  const catNameInput = document.getElementById('catName');
  const catTypeSelect = document.getElementById('catType');
  const catColorInput = document.getElementById('catColor');
  const iconSearchInput = document.getElementById('iconSearchInput');

  if (btnOpenCat) {
    btnOpenCat.addEventListener('click', () => {
      window.handleOpenNewCategoryModal();
    });
  }

  const closeCat = () => {
    if (catModal) catModal.classList.remove('open');
  };
  if (btnCloseCat) btnCloseCat.addEventListener('click', closeCat);
  if (btnCancelCat) btnCancelCat.addEventListener('click', closeCat);

  // Reatividade do Live Preview ao digitar ou alterar campos
  if (catNameInput) catNameInput.addEventListener('input', () => window.updateCategoryLivePreview());
  if (catTypeSelect) catTypeSelect.addEventListener('change', () => window.updateCategoryLivePreview());
  if (catColorInput) catColorInput.addEventListener('input', () => {
    document.querySelectorAll('#colorPalettePresets .color-preset-dot').forEach(d => {
      d.classList.toggle('selected', d.dataset.color.toLowerCase() === catColorInput.value.toLowerCase());
    });
    window.updateCategoryLivePreview();
  });

  // Paleta de Cores Rápidas
  document.querySelectorAll('#colorPalettePresets .color-preset-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const color = dot.dataset.color;
      if (catColorInput) catColorInput.value = color;
      document.querySelectorAll('#colorPalettePresets .color-preset-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      window.updateCategoryLivePreview();
    });
  });

  // Busca / Filtro rápido no Pacote de Ícones
  if (iconSearchInput) {
    iconSearchInput.addEventListener('input', (e) => {
      window.renderIconGrid(e.target.value);
    });
  }

  if (catForm) {
    catForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('catEditId').value;
      const name = document.getElementById('catName').value.trim();
      const type = document.getElementById('catType').value;
      const color = document.getElementById('catColor').value;
      const icon = document.getElementById('catIcon').value || 'tag';

      if (!name) {
        alert('Por favor, informe o nome da categoria.');
        return;
      }

      try {
        if (editId) {
          await finance.updateCategory(editId, { name, type, color, icon });
        } else {
          await finance.addCategory({ name, type, color, icon });
        }

        catForm.reset();
        closeCat();
        populateFormDropdowns();
        renderCategoriesView();
        if (currentTab === 'budgets') renderBudgetsView();
        renderDashboard();
      } catch (err) {
        alert('Erro ao salvar categoria: ' + err.message);
      }
    });
  }

  // Modal Nova Conta / Cartão
  const accModal = document.getElementById('accountModal');
  const btnOpenAcc = document.getElementById('btnOpenNewAccountModal');
  const btnCloseAcc = document.getElementById('btnCloseAccountModal');
  const btnCancelAcc = document.getElementById('btnCancelAccount');
  const accForm = document.getElementById('accountForm');
  const accTypeSelect = document.getElementById('accType');
  const accModeBankBtn = document.getElementById('accModeBank');
  const accModeCardBtn = document.getElementById('accModeCard');
  const bankFieldsRow = document.getElementById('bankAccountFieldsRow');
  const cardContextRow = document.getElementById('cardContextRow');
  const creditCardFields = document.getElementById('creditCardExtraFields');
  const accBankLabelTitle = document.getElementById('accBankLabelTitle');
  const accNameLabel = document.getElementById('accNameLabel');
  const accNameInput = document.getElementById('accName');
  const accDefaultLabel = document.getElementById('accDefaultLabel');
  const accModalTitle = document.getElementById('accountModalTitle');
  const btnSubmitAcc = document.getElementById('btnSubmitAccount');
  const accBankSelect = document.getElementById('accBank');
  const accColorInput = document.getElementById('accColor');
  const accBankPreview = document.getElementById('accBankBadgePreview');

  let currentAccountModalMode = 'bank'; // 'bank' | 'card'

  window.setAccountModalMode = function(mode) {
    currentAccountModalMode = mode;
    const isCard = mode === 'card';
    if (accModeBankBtn) accModeBankBtn.className = !isCard ? 'type-toggle-btn active-income' : 'type-toggle-btn';
    if (accModeCardBtn) accModeCardBtn.className = isCard ? 'type-toggle-btn active-income' : 'type-toggle-btn';

    if (bankFieldsRow) bankFieldsRow.style.display = !isCard ? 'grid' : 'none';
    if (cardContextRow) cardContextRow.style.display = isCard ? 'block' : 'none';
    if (creditCardFields) creditCardFields.style.display = isCard ? 'grid' : 'none';

    const editId = document.getElementById('accEditId') ? document.getElementById('accEditId').value : '';

    if (isCard) {
      if (accBankLabelTitle) accBankLabelTitle.textContent = 'Emissor / Banco do Cartão';
      if (accNameLabel) accNameLabel.textContent = 'Nome do Cartão de Crédito';
      if (accNameInput) accNameInput.placeholder = 'Ex: Itaú Mastercard Black, Nubank Ultravioleta...';
      if (accDefaultLabel) accDefaultLabel.textContent = 'Definir como Cartão Padrão para novas despesas';
      if (accModalTitle) accModalTitle.textContent = editId ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito';
      if (btnSubmitAcc) btnSubmitAcc.textContent = editId ? 'Salvar Alterações' : 'Salvar Cartão';
      if (accTypeSelect) accTypeSelect.value = 'credit';
    } else {
      if (accBankLabelTitle) accBankLabelTitle.textContent = 'Banco / Instituição da Conta';
      if (accNameLabel) accNameLabel.textContent = 'Nome da Conta Bancária';
      if (accNameInput) accNameInput.placeholder = 'Ex: Itaú Conta Corrente, Nubank PJ...';
      if (accDefaultLabel) accDefaultLabel.textContent = 'Definir como Conta Padrão para novos lançamentos';
      if (accModalTitle) accModalTitle.textContent = editId ? 'Editar Conta Bancária' : 'Nova Conta Bancária';
      if (btnSubmitAcc) btnSubmitAcc.textContent = editId ? 'Salvar Alterações' : 'Salvar Conta';
      if (accTypeSelect && accTypeSelect.value === 'credit') accTypeSelect.value = 'checking';
    }
  };

  if (accModeBankBtn) accModeBankBtn.addEventListener('click', () => window.setAccountModalMode('bank'));
  if (accModeCardBtn) accModeCardBtn.addEventListener('click', () => window.setAccountModalMode('card'));

  const updateAccBankUI = () => {
    const bankId = accBankSelect ? accBankSelect.value : 'nubank';
    const color = accColorInput ? accColorInput.value : '#820ad1';
    if (accBankPreview) {
      accBankPreview.innerHTML = getBankBadgeHtml(bankId, 44, color);
    }
  };

  if (accBankSelect) {
    accBankSelect.addEventListener('change', () => {
      const selectedBankId = accBankSelect.value;
      const bankConfig = BRAZILIAN_BANKS[selectedBankId] || BRAZILIAN_BANKS.other;
      if (accColorInput) {
        accColorInput.value = bankConfig.defaultColor;
      }
      if (accNameInput) {
        const curName = accNameInput.value.trim();
        const isAutoGenerated = !curName || Object.values(BRAZILIAN_BANKS).some(b => 
          b.name === curName || 
          curName === `${b.name} (Conta)` || 
          curName === `Cartão ${b.name}` || 
          curName.toLowerCase().startsWith(b.name.toLowerCase())
        );
        if (isAutoGenerated) {
          accNameInput.value = currentAccountModalMode === 'card' 
            ? `Cartão ${bankConfig.name}` 
            : bankConfig.name;
        }
      }
      updateAccBankUI();
    });
  }

  if (accColorInput) {
    accColorInput.addEventListener('change', () => {
      updateAccBankUI();
    });
  }

  if (btnOpenAcc) {
    btnOpenAcc.addEventListener('click', () => {
      document.getElementById('accEditId').value = '';
      accForm.reset();
      window.setAccountModalMode('bank');
      if (accBankSelect) accBankSelect.value = 'nubank';
      if (accColorInput) accColorInput.value = '#820ad1';
      document.getElementById('accName').value = 'Nubank';
      document.getElementById('accBalance').value = '0,00';
      document.getElementById('accLimit').value = '0,00';
      document.getElementById('accCardBrand').value = 'mastercard';
      document.getElementById('accReminderDays').value = '3';
      document.getElementById('accIsDefault').checked = false;
      if (window.selectAccountOwner) window.selectAccountOwner('p1');
      updateAccBankUI();
      accModal.classList.add('open');
      if (window.lucide) lucide.createIcons();
    });
  }
  const closeAcc = () => accModal.classList.remove('open');
  if (btnCloseAcc) btnCloseAcc.addEventListener('click', closeAcc);
  if (btnCancelAcc) btnCancelAcc.addEventListener('click', closeAcc);

  if (accForm) {
    accForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const editId = document.getElementById('accEditId').value;
        const isCard = currentAccountModalMode === 'card';
        const rawName = document.getElementById('accName').value.trim();
        if (!rawName) {
          showAppAlert({
            title: 'Nome Obrigatório',
            message: 'Por favor, informe um nome para identificar a conta ou cartão.',
            type: 'warning'
          });
          return;
        }

        const accountData = {
          name: rawName,
          bankId: accBankSelect ? accBankSelect.value : 'other',
          color: accColorInput ? accColorInput.value : '#820ad1',
          type: isCard ? 'credit' : (accTypeSelect ? accTypeSelect.value : 'checking'),
          balance: isCard 
            ? (editId ? (finance.state.accounts.find(a => a.id === editId)?.balance || 0) : 0) 
            : parseCurrencyInput(document.getElementById('accBalance').value),
          limit: isCard && document.getElementById('accLimit') ? parseCurrencyInput(document.getElementById('accLimit').value) : 0,
          closingDay: isCard && document.getElementById('accClosingDay') ? parseInt(document.getElementById('accClosingDay').value, 10) : 25,
          dueDay: isCard && document.getElementById('accDueDay') ? parseInt(document.getElementById('accDueDay').value, 10) : 5,
          reminderDays: isCard && document.getElementById('accReminderDays') ? parseInt(document.getElementById('accReminderDays').value, 10) : 3,
          cardBrand: isCard && document.getElementById('accCardBrand') ? document.getElementById('accCardBrand').value : 'mastercard',
          entityType: isCard ? (document.getElementById('accCardEntityType')?.value || 'pf') : (document.getElementById('accEntityType')?.value || 'pf'),
          ownerRole: document.getElementById('accOwnerRole') ? document.getElementById('accOwnerRole').value : 'p1',
          isDefault: document.getElementById('accIsDefault') ? document.getElementById('accIsDefault').checked : false
        };

        if (editId) {
          await finance.updateAccount(editId, accountData);
          showToast('Conta / Cartão atualizado com sucesso!', 'success');
        } else {
          const created = await finance.addAccount(accountData);
          selectedAccountId = created.id;
          showToast(isCard ? 'Cartão de crédito cadastrado com sucesso!' : 'Conta bancária cadastrada com sucesso!', 'success');
        }

        accForm.reset();
        closeAcc();
        populateFormDropdowns();
        try { renderAccountsView(); } catch(errView) { console.error('Erro renderAccountsView:', errView); }
        try { renderDashboard(); } catch(errDash) { console.error('Erro renderDashboard:', errDash); }
      } catch (err) {
        console.error('Erro ao salvar conta:', err);
        showAppAlert({
          title: 'Erro ao Salvar Conta',
          message: 'Ocorreu um erro ao registrar a conta: ' + (err.message || err),
          type: 'danger',
          icon: 'alert-triangle'
        });
      }
    });
  }

  // Modal Pagar Fatura do Cartão de Crédito
  const payModal = document.getElementById('payInvoiceModal');
  const btnClosePayModal = document.getElementById('btnClosePayInvoiceModal');
  const btnCancelPayModal = document.getElementById('btnCancelPayInvoice');
  const payForm = document.getElementById('payInvoiceForm');

  const closePayInvoice = () => {
    if (payModal) payModal.classList.remove('open');
  };
  if (btnClosePayModal) btnClosePayModal.addEventListener('click', closePayInvoice);
  if (btnCancelPayModal) btnCancelPayModal.addEventListener('click', closePayInvoice);

  if (payForm) {
    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cardId = document.getElementById('payInvoiceCardId').value;
      const targetInvoiceKey = document.getElementById('payInvoiceKey').value;
      const amount = parseCurrencyInput(document.getElementById('payInvoiceAmount').value);
      const sourceAccId = document.getElementById('payInvoiceSourceAccount').value;
      const date = document.getElementById('payInvoiceDate').value;

      if (!cardId || !sourceAccId || amount <= 0) {
        alert('Por favor, informe um valor válido e a conta bancária para débito.');
        return;
      }

      // Verifica se a fatura ainda não fechou para avisar o usuário
      const card = finance.state.accounts.find(a => a.id === cardId);
      const invData = finance.getCardInvoices(cardId);
      const targetInv = (invData && invData.invoices) ? invData.invoices.find(i => i.key === targetInvoiceKey) : (invData ? invData.currentInvoice : null);

      if (targetInv && !targetInv.isClosed) {
        const daysLeft = targetInv.daysUntilClosing !== undefined ? targetInv.daysUntilClosing : 0;
        const daysMsg = daysLeft === 0 
          ? 'A fatura deste cartão fecha hoje.' 
          : `A fatura deste cartão ainda está aberta e faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} para o fechamento oficial (dia ${card.closingDay || 25}).`;

        const confirmed = await showAppConfirm({
          title: 'Pagamento Antes do Fechamento',
          message: `${daysMsg}\n\nTem certeza que deseja pagar a fatura antes do fechamento?`,
          icon: 'alert-triangle',
          type: 'warning',
          confirmText: 'Sim, Pagar Antes',
          cancelText: 'Aguardar Fechamento'
        });

        if (!confirmed) {
          return;
        }
      }

      try {
        const payResult = await finance.payCreditCardInvoice(cardId, amount, sourceAccId, date, targetInvoiceKey);
        closePayInvoice();
        renderAccountsView();
        renderDashboard();
        if (currentTab === 'transactions') renderTransactionsView();

        const renewedCount = payResult && payResult.renewedTxs ? payResult.renewedTxs.length : 0;
        const subMsg = renewedCount > 0 
          ? `\n\n↻ Foram identificadas e renovadas automaticamente ${renewedCount} assinatura(s)/despesa(s) recorrente(s) na próxima fatura!`
          : '';

        alert(`Fatura paga com sucesso! O limite disponível do seu cartão foi restabelecido e a conta foi debitada.${subMsg}`);
      } catch (err) {
        alert('Erro ao processar pagamento de fatura: ' + err.message);
      }
    });
  }

  // Modal Pagar Boleto / Conta Recorrente
  const payBillModal = document.getElementById('payBillModal');
  const btnClosePayBillModal = document.getElementById('btnClosePayBillModal');
  const btnCancelPayBill = document.getElementById('btnCancelPayBill');
  const payBillForm = document.getElementById('payBillForm');
  const btnCopyBarcode = document.getElementById('btnCopyBarcode');
  const btnOpenNewBill = document.getElementById('btnOpenNewBillModal');

  const closePayBill = () => {
    if (payBillModal) payBillModal.classList.remove('open');
  };
  if (btnClosePayBillModal) btnClosePayBillModal.addEventListener('click', closePayBill);
  if (btnCancelPayBill) btnCancelPayBill.addEventListener('click', closePayBill);

  if (btnCopyBarcode) {
    btnCopyBarcode.addEventListener('click', () => {
      const barcode = document.getElementById('payBillBarcode').value;
      if (barcode) {
        navigator.clipboard.writeText(barcode).then(() => {
          alert('Código de barras copiado com sucesso!');
        });
      }
    });
  }

  if (btnOpenNewBill) {
    btnOpenNewBill.addEventListener('click', () => {
      window.handleOpenNewBill();
    });
  }

  if (payBillForm) {
    payBillForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const scheduleId = document.getElementById('payBillScheduleId').value;
      const amount = parseCurrencyInput(document.getElementById('payBillAmount').value);
      const sourceAccId = document.getElementById('payBillSourceAccount').value;
      const date = document.getElementById('payBillDate').value;

      if (!scheduleId || !sourceAccId || amount <= 0) {
        alert('Por favor, informe um valor válido e a conta bancária para débito.');
        return;
      }

      try {
        const result = await finance.paySchedule(scheduleId, {
          amount,
          accountId: sourceAccId,
          date
        });
        closePayBill();
        renderAccountsView();
        renderSchedulesView();
        renderDashboard();
        if (currentTab === 'transactions') renderTransactionsView();

        const renewalMsg = result && result.nextSchedule 
          ? ` e o próximo vencimento para ${formatDateBR(result.nextSchedule.dueDate)} já foi gerado automaticamente!`
          : '!';
        alert(`Boleto pago com sucesso! O valor foi debitado da sua conta${renewalMsg}`);
      } catch (err) {
        alert('Erro ao processar pagamento do boleto: ' + err.message);
      }
    });
  }

  // Filtros de Conta e Cartão
  const btnFilterAll = document.getElementById('btnFilterAllAccounts');
  const btnFilterChecking = document.getElementById('btnFilterCheckingOnly');
  const btnFilterCredit = document.getElementById('btnFilterCreditOnly');
  const btnFilterBills = document.getElementById('btnFilterBillsOnly');

  if (btnFilterAll) btnFilterAll.addEventListener('click', () => handleFilterAccounts('all'));
  if (btnFilterChecking) btnFilterChecking.addEventListener('click', () => handleFilterAccounts('checking'));
  if (btnFilterCredit) btnFilterCredit.addEventListener('click', () => handleFilterAccounts('credit'));
  if (btnFilterBills) btnFilterBills.addEventListener('click', () => handleFilterAccounts('bills'));

  // Filtros da View de Metas & Sonhos
  const btnFilterAllGoals = document.getElementById('btnFilterAllGoals');
  const btnFilterActiveGoals = document.getElementById('btnFilterActiveGoals');
  const btnFilterCompletedGoals = document.getElementById('btnFilterCompletedGoals');

  if (btnFilterAllGoals) btnFilterAllGoals.addEventListener('click', () => handleFilterGoals('all'));
  if (btnFilterActiveGoals) btnFilterActiveGoals.addEventListener('click', () => handleFilterGoals('active'));
  if (btnFilterCompletedGoals) btnFilterCompletedGoals.addEventListener('click', () => handleFilterGoals('completed'));

  // Modal Nova / Editar Meta Financeira
  const goalModal = document.getElementById('goalModal');
  const btnOpenGoal = document.getElementById('btnOpenNewGoalModal');
  const btnCloseGoal = document.getElementById('btnCloseGoalModal');
  const btnCancelGoal = document.getElementById('btnCancelGoal');
  const goalForm = document.getElementById('goalForm');

  if (btnOpenGoal) {
    btnOpenGoal.addEventListener('click', () => {
      window.handleOpenNewGoalModal();
    });
  }

  const closeGoal = () => {
    if (goalModal) goalModal.classList.remove('open');
  };
  if (btnCloseGoal) btnCloseGoal.addEventListener('click', closeGoal);
  if (btnCancelGoal) btnCancelGoal.addEventListener('click', closeGoal);

  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('goalEditId').value;
      const targetAmount = parseCurrencyInput(document.getElementById('goalTarget').value);
      const title = document.getElementById('goalTitle').value.trim();
      const deadline = document.getElementById('goalDeadline').value;
      const color = document.getElementById('goalColor').value;
      const category = document.getElementById('goalCategory').value;
      const accountId = document.getElementById('goalAccountSelect').value || null;

      if (!title) {
        alert('Por favor, informe o título do seu objetivo.');
        return;
      }
      if (isNaN(targetAmount) || targetAmount <= 0) {
        alert('Por favor, informe um valor alvo válido maior que zero.');
        return;
      }
      if (!deadline) {
        alert('Por favor, informe a data limite para esta meta.');
        return;
      }

      try {
        if (editId) {
          await finance.updateGoal(editId, {
            title,
            targetAmount,
            deadline,
            color,
            category,
            accountId
          });
        } else {
          const currentAmount = parseCurrencyInput(document.getElementById('goalCurrent').value) || 0;
          await finance.addGoal({
            title,
            targetAmount,
            currentAmount,
            deadline,
            color,
            category,
            accountId
          });
        }

        goalForm.reset();
        closeGoal();
        renderGoalsView();
        renderDashboard();
      } catch (err) {
        alert('Erro ao salvar meta: ' + err.message);
      }
    });
  }

  // Modal Aporte / Resgate em Meta Financeira
  const goalContribModal = document.getElementById('goalContributionModal');
  const btnCloseGoalContribModal = document.getElementById('btnCloseGoalContribModal');
  const btnCancelGoalContrib = document.getElementById('btnCancelGoalContrib');
  const goalContribForm = document.getElementById('goalContribForm');
  const btnGoalTabDeposit = document.getElementById('btnGoalTabDeposit');
  const btnGoalTabWithdraw = document.getElementById('btnGoalTabWithdraw');
  const goalContribActionType = document.getElementById('goalContribActionType');
  const goalContribAmountLabel = document.getElementById('goalContribAmountLabel');
  const goalContribAccountLabel = document.getElementById('goalContribAccountLabel');
  const goalContribDebitCheckLabel = document.getElementById('goalContribDebitCheckLabel');
  const btnSubmitGoalContrib = document.getElementById('btnSubmitGoalContrib');
  const goalContribModalTitle = document.getElementById('goalContribModalTitle');

  const closeGoalContrib = () => {
    if (goalContribModal) goalContribModal.classList.remove('open');
  };

  if (btnCloseGoalContribModal) btnCloseGoalContribModal.addEventListener('click', closeGoalContrib);
  if (btnCancelGoalContrib) btnCancelGoalContrib.addEventListener('click', closeGoalContrib);

  const setContribActionType = (type) => {
    if (goalContribActionType) goalContribActionType.value = type;
    if (type === 'deposit') {
      if (btnGoalTabDeposit) btnGoalTabDeposit.className = 'type-toggle-btn active-expense';
      if (btnGoalTabWithdraw) btnGoalTabWithdraw.className = 'type-toggle-btn';
      if (goalContribModalTitle) goalContribModalTitle.textContent = 'Fazer Aporte na Meta';
      if (goalContribAmountLabel) goalContribAmountLabel.textContent = 'Valor do Aporte (R$)';
      if (goalContribAccountLabel) goalContribAccountLabel.textContent = 'Conta Bancária de Origem';
      if (goalContribDebitCheckLabel) goalContribDebitCheckLabel.textContent = 'Debitar do saldo da conta (gera lançamento no extrato)';
      if (btnSubmitGoalContrib) btnSubmitGoalContrib.textContent = 'Confirmar Aporte';
    } else {
      if (btnGoalTabWithdraw) btnGoalTabWithdraw.className = 'type-toggle-btn active-income';
      if (btnGoalTabDeposit) btnGoalTabDeposit.className = 'type-toggle-btn';
      if (goalContribModalTitle) goalContribModalTitle.textContent = 'Resgatar Valor da Meta';
      if (goalContribAmountLabel) goalContribAmountLabel.textContent = 'Valor do Resgate (R$)';
      if (goalContribAccountLabel) goalContribAccountLabel.textContent = 'Conta Bancária de Destino';
      if (goalContribDebitCheckLabel) goalContribDebitCheckLabel.textContent = 'Creditar no saldo da conta selecionada (gera lançamento no extrato)';
      if (btnSubmitGoalContrib) btnSubmitGoalContrib.textContent = 'Confirmar Resgate';
    }
  };

  if (btnGoalTabDeposit) {
    btnGoalTabDeposit.addEventListener('click', () => setContribActionType('deposit'));
  }
  if (btnGoalTabWithdraw) {
    btnGoalTabWithdraw.addEventListener('click', () => setContribActionType('withdraw'));
  }

  if (goalContribForm) {
    goalContribForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const goalId = document.getElementById('goalContribGoalId').value;
      const actionType = goalContribActionType ? goalContribActionType.value : 'deposit';
      const rawAmount = document.getElementById('goalContribAmount').value;
      const amount = parseCurrencyInput(rawAmount);
      const date = document.getElementById('goalContribDate').value;
      const accountId = document.getElementById('goalContribAccount').value;
      const checkDebit = document.getElementById('goalContribDebitCheck');
      const shouldSyncAccount = checkDebit ? checkDebit.checked : false;
      const notes = document.getElementById('goalContribNotes').value;

      if (!goalId) {
        alert('Meta não identificada.');
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        alert('Por favor, informe um valor válido maior que zero.');
        return;
      }
      if (!date) {
        alert('Por favor, informe a data da operação.');
        return;
      }

      try {
        if (actionType === 'deposit') {
          const res = await finance.contributeToGoal(goalId, {
            amount,
            date,
            accountId,
            debitFromAccount: shouldSyncAccount,
            notes
          });
          closeGoalContrib();
          renderGoalsView();
          renderDashboard();
          if (currentTab === 'accounts') renderAccountsView();
          if (currentTab === 'transactions') renderTransactionsView();

          if (res && res.pace && res.pace.isCompleted) {
            alert('🎉 PARABÉNS! Você atingiu 100% da sua meta! Seu sonho foi conquistado!');
          } else {
            alert('Aporte de ' + currencyFormatter.format(amount) + ' registrado com sucesso!');
          }
        } else {
          await finance.withdrawFromGoal(goalId, {
            amount,
            date,
            accountId,
            creditToAccount: shouldSyncAccount,
            notes
          });
          closeGoalContrib();
          renderGoalsView();
          renderDashboard();
          if (currentTab === 'accounts') renderAccountsView();
          if (currentTab === 'transactions') renderTransactionsView();

          alert('Resgate de ' + currencyFormatter.format(amount) + ' efetuado com sucesso!');
        }
      } catch (err) {
        alert('Erro ao processar movimentação: ' + err.message);
      }
    });
  }

  // Modal Novo Orçamento por Categoria
  const budgetModal = document.getElementById('budgetModal');
  const btnOpenBudget = document.getElementById('btnOpenNewBudgetModal');
  const btnCloseBudget = document.getElementById('btnCloseBudgetModal');
  const btnCancelBudget = document.getElementById('btnCancelBudget');
  const budgetForm = document.getElementById('budgetForm');

  if (btnOpenBudget) {
    btnOpenBudget.addEventListener('click', () => {
      populateBudgetCategoryDropdown();
      document.getElementById('budgetLimitInput').value = '0,00';
      budgetModal.classList.add('open');
    });
  }
  const closeBudget = () => budgetModal.classList.remove('open');
  if (btnCloseBudget) btnCloseBudget.addEventListener('click', closeBudget);
  if (btnCancelBudget) btnCancelBudget.addEventListener('click', closeBudget);

  if (budgetForm) {
    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const catId = document.getElementById('budgetCategorySelect').value;
      const limitVal = parseCurrencyInput(document.getElementById('budgetLimitInput').value);
      if (catId) {
        await finance.setBudget(catId, limitVal);
        closeBudget();
        renderBudgetsView();
      }
    });
  }

  // Busca rápida de transações
  const searchInput = document.getElementById('txSearchInput');
  const btnClearSearch = document.getElementById('btnClearTxSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderTransactionsView());
  }
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      renderTransactionsView();
    });
  }

  // Modal de Confirmação de Exclusão de Transações
  const btnCloseConfirmDel = document.getElementById('btnCloseConfirmDeleteTxModal');
  const btnCancelConfirmDel = document.getElementById('btnCancelDeleteTx');
  const btnConfirmDel = document.getElementById('btnConfirmDeleteTx');

  if (btnCloseConfirmDel) btnCloseConfirmDel.addEventListener('click', () => closeConfirmDeleteTxModal());
  if (btnCancelConfirmDel) btnCancelConfirmDel.addEventListener('click', () => closeConfirmDeleteTxModal());

  if (btnConfirmDel) {
    btnConfirmDel.addEventListener('click', async () => {
      try {
        if (!txPendingDeletionId) return;
        const tx = finance.state.transactions.find(t => t.id === txPendingDeletionId);
        const isInstallment = tx && ((tx.installmentTotal && tx.installmentTotal > 1) || !!tx.installmentGroupId);

        const scopeRadio = document.querySelector('input[name="deleteInstallmentScope"]:checked');
        const deleteScope = scopeRadio ? scopeRadio.value : 'all';

        if (isInstallment && deleteScope === 'all') {
          await finance.deleteTransactionGroup(tx.installmentGroupId || tx.id);
        } else {
          await finance.deleteTransaction(txPendingDeletionId);
        }

        closeConfirmDeleteTxModal();

        // Atualização imediata e segura das telas
        try { renderAccountsView(); } catch(e) { console.error('Erro em renderAccountsView:', e); }
        if (selectedAccountId) {
          try { renderSelectedAccountDetails(); } catch(e) { console.error('Erro em renderSelectedAccountDetails:', e); }
        }
        try { renderTransactionsView(); } catch(e) { console.error('Erro em renderTransactionsView:', e); }
        try { renderDashboard(); } catch(e) { console.error('Erro em renderDashboard:', e); }
        if (currentTab === 'budgets') {
          try { renderBudgetsView(); } catch(e) { console.error('Erro em renderBudgetsView:', e); }
        }
        if (window.lucide) lucide.createIcons();
      } catch (err) {
        console.error('Erro geral ao confirmar exclusão de transação:', err);
      }
    });
  }
}

// Importador Multiformato de Extratos (OFX, PDF, Excel, CSV)
let importedStagingTransactions = [];

function setupOFXImporter() {
  const btnOpen = document.getElementById('btnOpenImportModal');
  const modal = document.getElementById('importModal');
  const btnClose = document.getElementById('btnImportModalClose');
  const btnCancel = document.getElementById('btnCancelImport');
  const btnConfirm = document.getElementById('btnConfirmImport');
  const btnConfirmText = document.getElementById('btnConfirmImportText');
  const dropZone = document.getElementById('importDropZone');
  const fileInput = document.getElementById('importFileInput');
  const feedback = document.getElementById('importFileFeedback');
  const previewContainer = document.getElementById('importPreviewContainer');
  const tableBody = document.getElementById('importPreviewTableBody');
  const selectAllCheckbox = document.getElementById('importSelectAll');
  const itemsCountBadge = document.getElementById('importItemsCountBadge');
  const duplicateWarning = document.getElementById('importDuplicateWarning');
  const accountSelect = document.getElementById('importAccountSelect');
  const categorySelect = document.getElementById('importExpenseCategorySelect');
  const balanceSyncContainer = document.getElementById('importBalanceSyncContainer');
  const syncBalanceCheckbox = document.getElementById('importSyncBalanceCheckbox');
  const detectedBalanceSpan = document.getElementById('importDetectedBalanceSpan');
  let currentDetectedStatementBalance = null;

  if (!btnOpen || !modal) return;

  function populateAccountsAndCategories() {
    // Preenche Contas
    accountSelect.innerHTML = buildAccountSelectOptionsHtml('all');

    // Preenche Categorias de Despesa se existir seletor global
    if (categorySelect) {
      categorySelect.innerHTML = '';
      const expenseCats = finance.state.categories.filter(c => c.type === 'expense');
      expenseCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.icon || '🏷️'} ${cat.name}`;
        categorySelect.appendChild(opt);
      });
    }
  }

  function resetImportModal() {
    fileInput.value = '';
    feedback.textContent = '';
    previewContainer.style.display = 'none';
    tableBody.innerHTML = '';
    importedStagingTransactions = [];
    currentDetectedStatementBalance = null;
    if (balanceSyncContainer) balanceSyncContainer.style.display = 'none';
    btnConfirm.disabled = true;
    btnConfirmText.textContent = 'Confirmar Importação (0)';
    selectAllCheckbox.checked = true;
    duplicateWarning.style.display = 'none';
  }

  btnOpen.addEventListener('click', () => {
    populateAccountsAndCategories();
    resetImportModal();
    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  });

  const closeModal = () => {
    modal.classList.remove('open');
    resetImportModal();
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Drag & drop e clique no dropzone
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.background = 'rgba(59, 130, 246, 0.08)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border-color)';
      dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processSelectedFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processSelectedFile(e.target.files[0]);
      }
    });
  }

  async function processSelectedFile(file) {
    if (!file) return;
    const fileName = file.name;
    const ext = fileName.split('.').pop().toLowerCase();
    feedback.textContent = `Carregando arquivo: ${fileName}...`;

    try {
      let parsed = [];

      if (ext === 'ofx') {
        const text = await file.text();
        parsed = finance.parseOFX(text);
      } else if (ext === 'csv') {
        const text = await file.text();
        parsed = finance.parseCSV(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const binaryStr = new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '');
        parsed = finance.parseExcel(binaryStr);
      } else if (ext === 'pdf') {
        if (window.electronAPI && window.electronAPI.parsePdfBuffer) {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const res = await window.electronAPI.parsePdfBuffer(uint8Array);
          if (res && res.success && res.text) {
            parsed = finance.parsePDFText(res.text);
          } else {
            throw new Error((res && res.error) || 'Não foi possível ler o arquivo PDF.');
          }
        } else {
          throw new Error('Leitor de PDF não disponível nesta versão do Electron.');
        }
      } else {
        throw new Error('Formato de arquivo não suportado. Utilize OFX, PDF, Excel (.xlsx/.xls) ou CSV.');
      }

      if (!parsed || parsed.length === 0) {
        feedback.textContent = `Nenhuma transação foi identificada no arquivo ${fileName}. Verifique se o formato é suportado.`;
        feedback.style.color = 'var(--danger)';
        previewContainer.style.display = 'none';
        btnConfirm.disabled = true;
        return;
      }

      // Detecta e exibe opção de conciliação com o saldo final do extrato
      if (typeof parsed.detectedStatementBalance === 'number') {
        currentDetectedStatementBalance = parsed.detectedStatementBalance;
        if (balanceSyncContainer && detectedBalanceSpan) {
          detectedBalanceSpan.textContent = currentDetectedStatementBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          balanceSyncContainer.style.display = 'flex';
          if (syncBalanceCheckbox) syncBalanceCheckbox.checked = true;
        }
      } else {
        currentDetectedStatementBalance = null;
        if (balanceSyncContainer) balanceSyncContainer.style.display = 'none';
      }

      renderPreviewTable(parsed);

    } catch (err) {
      console.error('Erro ao processar arquivo de extrato:', err);
      feedback.textContent = `Erro ao ler arquivo: ${err.message}`;
      feedback.style.color = 'var(--danger)';
      previewContainer.style.display = 'none';
      btnConfirm.disabled = true;
    }
  }

  function renderPreviewTable(transactions) {
    const targetAccountId = accountSelect.value;
    const existingTxs = finance.state.transactions.filter(t => t.accountId === targetAccountId);

    let hasDuplicates = false;

    importedStagingTransactions = transactions.map((t, idx) => {
      // Verifica possível duplicata (mesma data, mesmo valor aproximado e descrição parecida)
      const isDuplicate = existingTxs.some(ex => {
        const sameDate = ex.date === t.date;
        const sameAmount = Math.abs(ex.amount - t.amount) < 0.01;
        const sameType = ex.type === t.type;
        return sameDate && sameAmount && sameType;
      });

      if (isDuplicate) hasDuplicates = true;

      // Detecta categoria automaticamente pelo nome da transação
      const autoCatId = detectCategoryFromDescription(t.description, t.type);

      return {
        id: 'staging-' + idx,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        categoryId: autoCatId,
        isDuplicate: isDuplicate,
        selected: !isDuplicate // Se for duplicado, por padrão vem desmarcado
      };
    });

    duplicateWarning.style.display = hasDuplicates ? 'inline-block' : 'none';
    tableBody.innerHTML = '';

    const allCategories = finance.state.categories || [];

    importedStagingTransactions.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';
      if (item.isDuplicate) {
        tr.style.background = 'rgba(245, 158, 11, 0.08)';
      }

      const formattedAmount = item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const isExpense = item.type === 'expense';
      const typeBadge = isExpense 
        ? '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); font-size: 0.72rem;">Saída</span>'
        : '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.72rem;">Entrada</span>';

      const statusBadge = item.isDuplicate
        ? '<span class="badge" title="Já existe transação idêntica nesta conta" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-size: 0.7rem;">Repetido?</span>'
        : '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.7rem;">Novo</span>';

      // Format date DD/MM/AAAA
      const parts = item.date.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.date;

      // Monta as opções do select de categoria desta linha
      const availableCats = allCategories.filter(c => isExpense ? (c.type === 'expense' || c.type === 'transfer') : c.type === 'income');
      let catOptionsHtml = '';
      availableCats.forEach(cat => {
        catOptionsHtml += `<option value="${cat.id}" ${cat.id === item.categoryId ? 'selected' : ''}>${cat.name}</option>`;
      });

      tr.innerHTML = `
        <td style="padding: 0.45rem 0.75rem; text-align: center;">
          <input type="checkbox" class="staging-checkbox" data-index="${index}" ${item.selected ? 'checked' : ''}>
        </td>
        <td style="padding: 0.45rem 0.75rem; white-space: nowrap; color: var(--text-secondary); font-size: 0.8rem;">${formattedDate}</td>
        <td style="padding: 0.45rem 0.75rem; font-weight: 500; color: var(--text-main); font-size: 0.82rem;" title="${escapeHtml(item.description)}">
          ${escapeHtml(item.description)}
        </td>
        <td style="padding: 0.35rem 0.5rem;">
          <select class="form-control staging-category-select" data-index="${index}" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; height: auto;">
            ${catOptionsHtml}
          </select>
        </td>
        <td style="padding: 0.45rem 0.75rem;">${typeBadge}</td>
        <td style="padding: 0.45rem 0.75rem; text-align: right; font-weight: 600; font-size: 0.82rem; color: ${isExpense ? 'var(--danger)' : 'var(--success)'};">
          ${isExpense ? '-' : '+'}${formattedAmount}
        </td>
        <td style="padding: 0.45rem 0.75rem; text-align: center;">${statusBadge}</td>
      `;
      tableBody.appendChild(tr);
    });

    previewContainer.style.display = 'flex';
    updateSelectedCount();

    // Eventos dos checkboxes individuais
    const cbs = tableBody.querySelectorAll('.staging-checkbox');
    cbs.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        importedStagingTransactions[i].selected = e.target.checked;
        updateSelectedCount();
      });
    });

    // Eventos de alteração individual de categoria
    const selects = tableBody.querySelectorAll('.staging-category-select');
    selects.forEach(sel => {
      sel.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        importedStagingTransactions[i].categoryId = e.target.value;
      });
    });
  }

  function updateSelectedCount() {
    const selectedCount = importedStagingTransactions.filter(t => t.selected).length;
    const totalCount = importedStagingTransactions.length;
    itemsCountBadge.textContent = `${selectedCount} de ${totalCount} selecionados`;
    btnConfirmText.textContent = `Confirmar Importação (${selectedCount})`;
    btnConfirm.disabled = selectedCount === 0;
    selectAllCheckbox.checked = selectedCount === totalCount && totalCount > 0;
  }

  // Checkbox Selecionar Todos
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      importedStagingTransactions.forEach(t => t.selected = isChecked);
      const cbs = tableBody.querySelectorAll('.staging-checkbox');
      cbs.forEach(cb => cb.checked = isChecked);
      updateSelectedCount();
    });
  }

  // Recalcular duplicados se o usuário alterar a conta de destino
  accountSelect.addEventListener('change', () => {
    if (importedStagingTransactions.length > 0) {
      const rawData = importedStagingTransactions.map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type
      }));
      renderPreviewTable(rawData);
    }
  });

  // Confirmar Importação
  btnConfirm.addEventListener('click', async () => {
    const selectedTransactions = importedStagingTransactions.filter(t => t.selected);
    if (selectedTransactions.length === 0) return;

    const targetAccountId = accountSelect.value;
    const incomeCat = finance.state.categories.find(c => c.type === 'income')?.id || 'cat-1';
    const fallbackExpenseCat = finance.state.categories.find(c => c.type === 'expense')?.id || 'cat-3';

    let count = 0;
    for (const t of selectedTransactions) {
      const assignedCat = t.categoryId || (t.type === 'income' ? incomeCat : fallbackExpenseCat);
      await finance.addTransaction({
        description: t.description,
        amount: t.amount,
        type: t.type,
        categoryId: assignedCat,
        accountId: targetAccountId,
        date: t.date,
        notes: 'Importado via Extrato Bancário'
      });
      count++;
    }

    // Se a conciliação de saldo estiver ativa e foi detectado o saldo real no extrato, ajusta o saldo da conta para refletir a realidade bancária
    if (syncBalanceCheckbox && syncBalanceCheckbox.checked && typeof currentDetectedStatementBalance === 'number') {
      const acc = finance.state.accounts.find(a => a.id === targetAccountId);
      if (acc) {
        acc.balance = currentDetectedStatementBalance;
        await finance.save();
      }
    }

    closeModal();

    showAppAlert({
      title: 'Importação Concluída',
      message: `<b>${count} transações</b> foram categorizadas e importadas com sucesso!` + 
               (syncBalanceCheckbox && syncBalanceCheckbox.checked && typeof currentDetectedStatementBalance === 'number' 
                ? `<br><span style="font-size: 0.85rem; color: var(--success); font-weight: 600;">Saldo da conta conciliado para ${currentDetectedStatementBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>` 
                : ''),
      type: 'success',
      icon: 'check-circle'
    });

    renderDashboard();
    if (currentTab === 'transactions') renderTransactionsView();
    if (currentTab === 'accounts') renderAccountsView();
  });
}

// =========================================================================
// --- VALORE SYNC HUB & CENTRAL DE BACKUP (PC ⇄ MOBILE + AES-256 E2EE) ---
// =========================================================================
window.switchSyncHubTab = function(tabName) {
  const panes = {
    wifi: document.getElementById('syncHubPaneWifi'),
    vault: document.getElementById('syncHubPaneVault'),
    files: document.getElementById('syncHubPaneFiles')
  };
  const btns = {
    wifi: document.getElementById('btnSyncTabWifi'),
    vault: document.getElementById('btnSyncTabVault'),
    files: document.getElementById('btnSyncTabFiles')
  };

  Object.keys(panes).forEach(k => {
    if (panes[k]) panes[k].style.display = (k === tabName) ? 'flex' : 'none';
    if (btns[k]) btns[k].classList.toggle('active', k === tabName);
  });
};

function refreshAllViewsAfterSync() {
  if (window.syncDeviceIdentityUI) try { window.syncDeviceIdentityUI(); } catch (_) {}
  try { populateFormDropdowns(); } catch (_) {}
  try { renderDashboard(); } catch (_) {}
  if (currentTab === 'transactions') try { renderTransactionsView(); } catch (_) {}
  if (currentTab === 'accounts') try { renderAccountsView(); } catch (_) {}
  if (currentTab === 'schedules') try { renderSchedulesView(); } catch (_) {}
  if (currentTab === 'assets') try { renderAssetsView(); } catch (_) {}
  if (currentTab === 'goals') try { renderGoalsView(); } catch (_) {}
  if (currentTab === 'budgets') try { renderBudgetsView(); } catch (_) {}
  if (currentTab === 'categories') try { renderCategoriesView(); } catch (_) {}
  if (currentTab === 'cost-centers') try { renderCostCentersView(); } catch (_) {}
  if (currentTab === 'side-hustles') try { renderSideHustlesView(); } catch (_) {}
  if (currentTab === 'forecast') try { renderForecastView(); } catch (_) {}
  if (currentTab === 'freedom') try { renderFreedomView(); } catch (_) {}
  if (currentTab === 'couple') try { renderCoupleView(); } catch (_) {}
  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// --- IDENTIDADE DO APARELHO & AUTOR DOS LANÇAMENTOS (4 DISPOSITIVOS) ---
// =========================================================================
function renderDeviceIdentityPickers(p1Selected = 'user', p2Selected = 'heart', p1Color = '#3b82f6', p2Color = '#ec4899') {
  const c1Av = document.getElementById('deviceAvatarPickerP1');
  const c2Av = document.getElementById('deviceAvatarPickerP2');
  const c1Col = document.getElementById('deviceColorPickerP1');
  const c2Col = document.getElementById('deviceColorPickerP2');

  if (c1Av) {
    c1Av.innerHTML = AVAILABLE_COUPLE_AVATARS.map(av => {
      const isSel = av.id === p1Selected;
      return `<button type="button" class="avatar-opt-btn" onclick="window.selectDeviceAvatar('p1', '${av.id}')" style="width: 25px; height: 25px; border-radius: 6px; border: ${isSel ? `2px solid ${p1Color}` : '1px solid var(--border-color)'}; background: ${isSel ? `${p1Color}25` : 'var(--bg-surface)'}; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;" title="${av.label}"><i data-lucide="${av.icon}" style="width: 13px; height: 13px; color: ${isSel ? p1Color : 'var(--text-muted)'};"></i></button>`;
    }).join('');
  }
  if (c2Av) {
    c2Av.innerHTML = AVAILABLE_COUPLE_AVATARS.map(av => {
      const isSel = av.id === p2Selected;
      return `<button type="button" class="avatar-opt-btn" onclick="window.selectDeviceAvatar('p2', '${av.id}')" style="width: 25px; height: 25px; border-radius: 6px; border: ${isSel ? `2px solid ${p2Color}` : '1px solid var(--border-color)'}; background: ${isSel ? `${p2Color}25` : 'var(--bg-surface)'}; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;" title="${av.label}"><i data-lucide="${av.icon}" style="width: 13px; height: 13px; color: ${isSel ? p2Color : 'var(--text-muted)'};"></i></button>`;
    }).join('');
  }

  if (c1Col) {
    c1Col.innerHTML = AVAILABLE_COUPLE_COLORS.map(col => {
      const isSel = col.toLowerCase() === p1Color.toLowerCase();
      return `<button type="button" onclick="window.selectDeviceColor('p1', '${col}')" style="width: 19px; height: 19px; border-radius: 50%; background: ${col}; border: ${isSel ? '2px solid #fff' : '2px solid transparent'}; outline: ${isSel ? `2px solid ${col}` : 'none'}; cursor: pointer; padding: 0; transition: transform 0.15s ease; ${isSel ? 'transform: scale(1.18);' : ''}"></button>`;
    }).join('');
  }
  if (c2Col) {
    c2Col.innerHTML = AVAILABLE_COUPLE_COLORS.map(col => {
      const isSel = col.toLowerCase() === p2Color.toLowerCase();
      return `<button type="button" onclick="window.selectDeviceColor('p2', '${col}')" style="width: 19px; height: 19px; border-radius: 50%; background: ${col}; border: ${isSel ? '2px solid #fff' : '2px solid transparent'}; outline: ${isSel ? `2px solid ${col}` : 'none'}; cursor: pointer; padding: 0; transition: transform 0.15s ease; ${isSel ? 'transform: scale(1.18);' : ''}"></button>`;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

window.selectDeviceAvatar = function(partner, avatarId) {
  const hiddenInput = document.getElementById(partner === 'p1' ? 'inputIdentityP1Avatar' : 'inputIdentityP2Avatar');
  if (hiddenInput) hiddenInput.value = avatarId;
  const p1Av = document.getElementById('inputIdentityP1Avatar')?.value || 'user';
  const p2Av = document.getElementById('inputIdentityP2Avatar')?.value || 'heart';
  const p1Col = document.getElementById('inputIdentityP1Color')?.value || '#3b82f6';
  const p2Col = document.getElementById('inputIdentityP2Color')?.value || '#ec4899';

  renderDeviceIdentityPickers(p1Av, p2Av, p1Col, p2Col);

  const prevIcon = document.getElementById(partner === 'p1' ? 'devicePreviewIconP1' : 'devicePreviewIconP2');
  if (prevIcon) prevIcon.textContent = getAvatarEmoji(avatarId);

  const btnIcon = document.getElementById(partner === 'p1' ? 'iconDeviceOwnerP1' : 'iconDeviceOwnerP2');
  if (btnIcon) btnIcon.textContent = getAvatarEmoji(avatarId);
};

window.selectDeviceColor = function(partner, colorHex) {
  const hiddenInput = document.getElementById(partner === 'p1' ? 'inputIdentityP1Color' : 'inputIdentityP2Color');
  if (hiddenInput) hiddenInput.value = colorHex;
  const p1Av = document.getElementById('inputIdentityP1Avatar')?.value || 'user';
  const p2Av = document.getElementById('inputIdentityP2Avatar')?.value || 'heart';
  const p1Col = document.getElementById('inputIdentityP1Color')?.value || '#3b82f6';
  const p2Col = document.getElementById('inputIdentityP2Color')?.value || '#ec4899';

  renderDeviceIdentityPickers(p1Av, p2Av, p1Col, p2Col);

  const box = document.getElementById(partner === 'p1' ? 'deviceCardBoxP1' : 'deviceCardBoxP2');
  const lbl = document.getElementById(partner === 'p1' ? 'lblInputIdentityP1' : 'lblInputIdentityP2');
  if (box) {
    box.style.borderColor = `${colorHex}45`;
    box.style.background = `${colorHex}08`;
  }
  if (lbl) lbl.style.color = colorHex;

  const btn = document.getElementById(partner === 'p1' ? 'btnDeviceOwnerP1' : 'btnDeviceOwnerP2');
  if (btn && btn.classList.contains('active')) {
    btn.style.border = `2px solid ${colorHex}`;
    btn.style.background = `${colorHex}22`;
    btn.style.color = colorHex;
  }
};

window.syncDeviceIdentityUI = function() {
  const info = finance.getDeviceIdentity();
  const couple = (typeof finance !== 'undefined' && finance.getCoupleSettings) ? finance.getCoupleSettings() : null;
  const isCouple = (couple && couple.enabled !== false);
  const p1Avatar = (couple && couple.partner1 && couple.partner1.avatar) ? couple.partner1.avatar : 'user';
  const p2Avatar = (couple && couple.partner2 && couple.partner2.avatar) ? couple.partner2.avatar : 'heart';
  const p1Color = (couple && couple.partner1 && couple.partner1.color) ? couple.partner1.color : '#3b82f6';
  const p2Color = (couple && couple.partner2 && couple.partner2.color) ? couple.partner2.color : '#ec4899';

  // 1. Atualiza pílula no cabeçalho
  const headerBtn = document.getElementById('btnHeaderDeviceOwner');
  const headerIcon = document.getElementById('headerDeviceOwnerIcon');
  const headerName = document.getElementById('headerDeviceOwnerName');
  if (headerIcon) headerIcon.textContent = info.deviceIcon;
  if (headerName) headerName.textContent = info.ownerName;
  if (headerBtn) {
    headerBtn.style.background = `${info.ownerColor}20`;
    headerBtn.style.borderColor = `${info.ownerColor}60`;
    headerBtn.style.color = info.ownerColor;
    headerBtn.title = `Aparelho configurado como: ${info.deviceIcon} ${info.ownerName} (${info.deviceType === 'mobile' ? 'Celular' : 'PC'}). Clique para gerenciar.`;
  }

  // 2. Atualiza card de identidade dentro do Valore Sync Hub
  const btnP1 = document.getElementById('btnDeviceOwnerP1');
  const btnP2 = document.getElementById('btnDeviceOwnerP2');
  const boxP2 = document.getElementById('deviceCardBoxP2');
  const lblP1 = document.getElementById('lblDeviceOwnerP1Name');
  const lblP2 = document.getElementById('lblDeviceOwnerP2Name');
  const iconP1 = document.getElementById('iconDeviceOwnerP1');
  const iconP2 = document.getElementById('iconDeviceOwnerP2');
  const inP1 = document.getElementById('inputIdentityP1Name');
  const inP2 = document.getElementById('inputIdentityP2Name');
  const inP1Av = document.getElementById('inputIdentityP1Avatar');
  const inP2Av = document.getElementById('inputIdentityP2Avatar');
  const inP1Col = document.getElementById('inputIdentityP1Color');
  const inP2Col = document.getElementById('inputIdentityP2Color');
  const prevIcon1 = document.getElementById('devicePreviewIconP1');
  const prevIcon2 = document.getElementById('devicePreviewIconP2');
  const badgeDev = document.getElementById('deviceIdentityCurrentBadge');

  if (lblP1) lblP1.textContent = info.p1Name;
  if (lblP2) lblP2.textContent = info.p2Name;
  if (iconP1) iconP1.textContent = getAvatarEmoji(p1Avatar);
  if (iconP2) iconP2.textContent = getAvatarEmoji(p2Avatar);
  if (prevIcon1) prevIcon1.textContent = getAvatarEmoji(p1Avatar);
  if (prevIcon2) prevIcon2.textContent = getAvatarEmoji(p2Avatar);

  if (inP1Av) inP1Av.value = p1Avatar;
  if (inP2Av) inP2Av.value = p2Avatar;
  if (inP1Col) inP1Col.value = p1Color;
  if (inP2Col) inP2Col.value = p2Color;

  if (badgeDev) {
    badgeDev.textContent = `${info.deviceIcon} Este aparelho: ${info.ownerName}`;
    badgeDev.style.background = `${info.ownerColor}22`;
    badgeDev.style.color = info.ownerColor;
  }
  if (inP1 && document.activeElement !== inP1) inP1.value = info.p1Name;
  if (inP2 && document.activeElement !== inP2) inP2.value = info.p2Name;

  // Adapta visibilidade se for Modo Individual ou Casal
  if (btnP2) btnP2.style.display = isCouple ? 'inline-flex' : 'none';
  if (boxP2) boxP2.style.display = isCouple ? 'block' : 'none';

  if (btnP1 && btnP2) {
    const isP2 = info.ownerRole === 'p2';
    btnP1.style.border = !isP2 ? `2px solid ${p1Color}` : '1px solid var(--border-color)';
    btnP1.style.background = !isP2 ? `${p1Color}22` : 'var(--bg-surface)';
    btnP1.style.color = !isP2 ? p1Color : 'var(--text-secondary)';

    btnP2.style.border = isP2 ? `2px solid ${p2Color}` : '1px solid var(--border-color)';
    btnP2.style.background = isP2 ? `${p2Color}22` : 'var(--bg-surface)';
    btnP2.style.color = isP2 ? p2Color : 'var(--text-secondary)';
  }

  // Renderiza seletores visuais de avatar e cores no card
  renderDeviceIdentityPickers(p1Avatar, p2Avatar, p1Color, p2Color);

  // 3. Atualiza botões de Autor no modal de Nova Transação (#txModal)
  const btnTxAuthorP1 = document.getElementById('btnTxAuthorP1');
  const btnTxAuthorP2 = document.getElementById('btnTxAuthorP2');
  const lblTxAuthorP1 = document.getElementById('lblTxAuthorP1');
  const lblTxAuthorP2 = document.getElementById('lblTxAuthorP2');
  const iconTxAuthorP1 = document.getElementById('iconTxAuthorP1');
  const iconTxAuthorP2 = document.getElementById('iconTxAuthorP2');

  if (lblTxAuthorP1) lblTxAuthorP1.textContent = info.p1Name;
  if (lblTxAuthorP2) lblTxAuthorP2.textContent = info.p2Name;
  if (iconTxAuthorP1) iconTxAuthorP1.textContent = getAvatarEmoji(p1Avatar);
  if (iconTxAuthorP2) iconTxAuthorP2.textContent = getAvatarEmoji(p2Avatar);

  // 4. Atualiza botões de Quem Pagou no modal de Nova Transação (#txModal)
  const lblTxPayerP1 = document.getElementById('lblTxPayerP1');
  const lblTxPayerP2 = document.getElementById('lblTxPayerP2');
  const iconTxPayerP1 = document.getElementById('iconTxPayerP1');
  const iconTxPayerP2 = document.getElementById('iconTxPayerP2');
  if (lblTxPayerP1) lblTxPayerP1.textContent = info.p1Name;
  if (lblTxPayerP2) lblTxPayerP2.textContent = info.p2Name;
  if (iconTxPayerP1) iconTxPayerP1.textContent = getAvatarEmoji(p1Avatar);
  if (iconTxPayerP2) iconTxPayerP2.textContent = getAvatarEmoji(p2Avatar);

  // 5. Atualiza botões no modal de Contas e Cartões
  const lblAccP1 = document.getElementById('labelAccOwnerP1');
  const lblAccP2 = document.getElementById('labelAccOwnerP2');
  const iconAccP1 = document.getElementById('iconAccOwnerP1');
  const iconAccP2 = document.getElementById('iconAccOwnerP2');
  if (lblAccP1) lblAccP1.textContent = info.p1Name;
  if (lblAccP2) lblAccP2.textContent = info.p2Name;
  if (iconAccP1) iconAccP1.textContent = getAvatarEmoji(p1Avatar);
  if (iconAccP2) iconAccP2.textContent = getAvatarEmoji(p2Avatar);
};

window.handleSelectDeviceOwner = async function(role) {
  const cleanRole = role === 'p2' ? 'p2' : 'p1';
  const inP1 = document.getElementById('inputIdentityP1Name');
  const inP2 = document.getElementById('inputIdentityP2Name');
  const inP1Av = document.getElementById('inputIdentityP1Avatar');
  const inP2Av = document.getElementById('inputIdentityP2Avatar');
  const inP1Col = document.getElementById('inputIdentityP1Color');
  const inP2Col = document.getElementById('inputIdentityP2Color');

  const info = await finance.setDeviceIdentity({
    ownerRole: cleanRole,
    p1Name: inP1 && inP1.value.trim() ? inP1.value.trim() : undefined,
    p2Name: inP2 && inP2.value.trim() ? inP2.value.trim() : undefined,
    p1Avatar: inP1Av ? inP1Av.value : undefined,
    p2Avatar: inP2Av ? inP2Av.value : undefined,
    p1Color: inP1Col ? inP1Col.value : undefined,
    p2Color: inP2Col ? inP2Col.value : undefined
  });
  window.syncDeviceIdentityUI();
  if (currentTab === 'transactions') renderTransactionsView();
  if (currentTab === 'schedules') renderSchedulesView();
  if (currentTab === 'accounts') renderAccountsView();
  showToast(`Aparelho identificado como: ${info.deviceIcon} ${info.ownerName}!`, 'success');
};

window.handleSaveIdentityProfile = async function() {
  const inP1 = document.getElementById('inputIdentityP1Name');
  const inP2 = document.getElementById('inputIdentityP2Name');
  const inP1Av = document.getElementById('inputIdentityP1Avatar');
  const inP2Av = document.getElementById('inputIdentityP2Avatar');
  const inP1Col = document.getElementById('inputIdentityP1Color');
  const inP2Col = document.getElementById('inputIdentityP2Color');

  const p1Name = inP1 && inP1.value.trim() ? inP1.value.trim() : 'Você';
  const p2Name = inP2 && inP2.value.trim() ? inP2.value.trim() : 'Esposa';
  const p1Avatar = inP1Av ? inP1Av.value : 'user';
  const p2Avatar = inP2Av ? inP2Av.value : 'heart';
  const p1Color = inP1Col ? inP1Col.value : '#3b82f6';
  const p2Color = inP2Col ? inP2Col.value : '#ec4899';

  const cur = finance.getDeviceIdentity();
  await finance.setDeviceIdentity({
    ownerRole: cur.ownerRole,
    p1Name,
    p2Name,
    p1Avatar,
    p1Color,
    p2Avatar,
    p2Color
  });

  await finance.updateCoupleSettings({
    partner1: { name: p1Name, avatar: p1Avatar, color: p1Color },
    partner2: { name: p2Name, avatar: p2Avatar, color: p2Color }
  });

  window.syncDeviceIdentityUI();
  if (typeof renderAvatarPickers === 'function') {
    renderAvatarPickers(p1Avatar, p2Avatar, p1Color, p2Color);
    renderColorPickers(p1Color, p2Color);
  }

  if (currentTab === 'transactions') renderTransactionsView();
  if (currentTab === 'schedules') renderSchedulesView();
  if (currentTab === 'accounts') renderAccountsView();
  if (currentTab === 'couple') renderCoupleView();
  showToast(`Perfil e cores atualizados: ${p1Name} & ${p2Name}!`, 'success');
};

window.handleSaveIdentityNames = window.handleSaveIdentityProfile;

window.openDeviceIdentityConfig = function() {
  const btnExport = document.getElementById('btnExportData');
  if (btnExport) {
    btnExport.click();
    window.switchSyncHubTab('wifi');
    setTimeout(() => {
      const card = document.getElementById('deviceIdentityConfigCard');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.45)';
        setTimeout(() => { card.style.boxShadow = ''; }, 1800);
      }
    }, 120);
  }
};

function updateSyncStatusUI() {
  const badge = document.getElementById('syncLastTimestampBadge');
  const autoBadge = document.getElementById('autoSyncLiveStateBadge');
  const chkAuto = document.getElementById('chkWifiAutoSync');
  const lastSync = finance.state && finance.state.syncMeta && finance.state.syncMeta.lastSyncAt;
  if (badge) {
    if (lastSync) {
      const d = new Date(lastSync);
      badge.textContent = `Última sinc: ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      badge.textContent = 'Pronto para sincronizar';
    }
  }
  try {
    const autoEnabled = localStorage.getItem('valore_wifi_auto_sync') !== 'false';
    const hasPending = localStorage.getItem('valore_sync_pending_changes') === 'true';
    const hasPairedPc = !!(localStorage.getItem('valore_sync_last_ip') && localStorage.getItem('valore_sync_last_pin'));
    const isDesktopServer = !!(window.electronAPI && window.electronAPI.getSyncServerStatus);
    if (chkAuto) chkAuto.checked = autoEnabled;
    if (autoBadge) {
      if (!autoEnabled) {
        autoBadge.textContent = '○ Auto-Sync Pausado';
        autoBadge.style.background = 'rgba(148, 163, 184, 0.14)';
        autoBadge.style.color = '#94a3b8';
        autoBadge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      } else if (hasPending && !isDesktopServer) {
        autoBadge.textContent = '⏳ Aguardando Wi-Fi do PC';
        autoBadge.style.background = 'rgba(245, 158, 11, 0.15)';
        autoBadge.style.color = '#f59e0b';
        autoBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      } else if (isDesktopServer || hasPairedPc) {
        autoBadge.textContent = '● Auto-Sync Ativo';
        autoBadge.style.background = 'rgba(16, 185, 129, 0.14)';
        autoBadge.style.color = '#10b981';
        autoBadge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      } else {
        autoBadge.textContent = '📷 Escaneie o QR 1x p/ ativar';
        autoBadge.style.background = 'rgba(59, 130, 246, 0.14)';
        autoBadge.style.color = '#38bdf8';
        autoBadge.style.borderColor = 'rgba(59, 130, 246, 0.35)';
      }
    }
  } catch (_) {}
}

function renderSyncServerQrCode(primaryIp, port, pin) {
  const qrContainer = document.getElementById('syncServerQrCodeContainer');
  if (!qrContainer) return;
  try {
    const qrFactory = window.qrcode || (typeof qrcode !== 'undefined' ? qrcode : null);
    if (!qrFactory) {
      qrContainer.innerHTML = `<span style="font-size: 0.7rem; color: #64748b; text-align: center;">QR Code indisponível</span>`;
      return;
    }
    const payload = `VALORE_SYNC|${primaryIp}:${port}|${pin}`;
    const qr = qrFactory(0, 'M');
    qr.addData(payload);
    qr.make();
    const svgTag = qr.createSvgTag({ cellSize: 3, margin: 1, scalable: true });
    qrContainer.innerHTML = svgTag;
    const svgEl = qrContainer.querySelector('svg');
    if (svgEl) {
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
      svgEl.style.display = 'block';
    }
  } catch (err) {
    console.warn('Erro ao gerar QR Code de sincronização:', err);
  }
}

async function refreshDesktopSyncServerCard() {
  const desktopCard = document.getElementById('syncDesktopServerCard');
  const clientTitle = document.getElementById('syncClientCardTitle');
  if (window.electronAPI && window.electronAPI.getSyncServerStatus) {
    if (desktopCard) desktopCard.style.display = 'block';
    if (clientTitle) clientTitle.textContent = 'Conectar a Outro PC na Rede (Opcional)';
    try {
      const status = await window.electronAPI.getSyncServerStatus();
      const ipEl = document.getElementById('syncServerIpDisplay');
      const allIpsEl = document.getElementById('syncServerAllIpsDisplay');
      const pinEl = document.getElementById('syncServerPinDisplay');
      if (ipEl) ipEl.textContent = `${status.primaryIp}:${status.port}`;
      if (allIpsEl) {
        allIpsEl.textContent = status.ips && status.ips.length > 1
          ? `Outras interfaces: ${status.ips.slice(1).join(', ')} (Porta ${status.port})`
          : `Computador: ${status.hostname || 'PC'} • Porta ${status.port}`;
      }
      if (pinEl) pinEl.textContent = status.pin;
      renderSyncServerQrCode(status.primaryIp, status.port, status.pin);
    } catch (err) {
      console.warn('Erro ao consultar servidor LAN Sync:', err);
    }
  } else {
    if (desktopCard) desktopCard.style.display = 'none';
    if (clientTitle) clientTitle.textContent = 'Conectar e Sincronizar com o Meu PC via Wi-Fi';
  }
}

function showWifiSyncFeedback(message, type = 'info') {
  const banner = document.getElementById('syncWifiFeedbackBanner');
  if (!banner) return;
  banner.style.display = 'block';
  if (type === 'success') {
    banner.style.background = 'rgba(16, 185, 129, 0.15)';
    banner.style.border = '1px solid rgba(16, 185, 129, 0.4)';
    banner.style.color = '#10b981';
  } else if (type === 'danger') {
    banner.style.background = 'rgba(239, 68, 68, 0.15)';
    banner.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    banner.style.color = '#f87171';
  } else {
    banner.style.background = 'rgba(59, 130, 246, 0.12)';
    banner.style.border = '1px solid rgba(59, 130, 246, 0.35)';
    banner.style.color = 'var(--primary)';
  }
  banner.innerHTML = message;
}

// Gerenciador Central de Backup, Sincronização e Exportação
function setupBackupManager() {
  const btnExport = document.getElementById('btnExportData');
  const backupModal = document.getElementById('backupModal');
  const btnCloseModal = document.getElementById('btnCloseBackupModal');
  const btnDismissModal = document.getElementById('btnDismissBackupModal');
  const btnDownloadJson = document.getElementById('btnDownloadJsonBackup');
  const btnExportXLSX = document.getElementById('btnExportAllTransactionsXLSX');
  const restoreInput = document.getElementById('restoreBackupInput');
  const mergeInput = document.getElementById('mergeBackupInput');

  // Elementos LAN Sync, QR Code Scanner e E2EE
  const btnRegenPin = document.getElementById('btnRegenerateSyncPin');
  const remoteIpInput = document.getElementById('syncRemoteIpInput');
  const remotePinInput = document.getElementById('syncRemotePinInput');
  const btnTestWifi = document.getElementById('btnTestWifiSyncConnection');
  const btnExecWifi = document.getElementById('btnExecuteWifiSyncNow');
  const btnOpenQrScanner = document.getElementById('btnOpenQrScanner');
  const btnCloseQrScanner = document.getElementById('btnCloseQrScanner');
  const qrScannerContainer = document.getElementById('qrScannerContainer');
  const qrScannerVideo = document.getElementById('qrScannerVideo');
  const qrScannerCanvas = document.getElementById('qrScannerCanvas');
  const qrScannerStatusText = document.getElementById('qrScannerStatusText');
  const qrScannerFileInput = document.getElementById('qrScannerFileInput');
  const masterPassInput = document.getElementById('syncMasterPasswordInput');
  const btnExportEncrypted = document.getElementById('btnExportEncryptedVault');
  const importEncryptedInput = document.getElementById('importEncryptedVaultInput');

  let qrStream = null;
  let qrScanTimer = null;

  const stopQrScanner = () => {
    if (qrScanTimer) {
      clearInterval(qrScanTimer);
      qrScanTimer = null;
    }
    if (qrStream) {
      try {
        qrStream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      qrStream = null;
    }
    if (qrScannerVideo) {
      qrScannerVideo.srcObject = null;
    }
    if (qrScannerContainer) {
      qrScannerContainer.style.display = 'none';
    }
  };
  window.stopQrScanner = stopQrScanner;

  // Interpreta o conteúdo lido do QR Code e dispara a sincronização automática
  const handleQrCodeDecoded = (rawText) => {
    if (!rawText) return false;
    const text = String(rawText).trim();
    let parsedIp = '';
    let parsedPin = '';

    // Formato oficial: VALORE_SYNC|192.168.15.14:45454|531362
    if (text.startsWith('VALORE_SYNC|')) {
      const parts = text.split('|');
      if (parts.length >= 3) {
        parsedIp = parts[1].trim();
        parsedPin = parts[2].trim();
      }
    } else if (text.startsWith('{')) {
      try {
        const obj = JSON.parse(text);
        if (obj.ip && obj.pin) {
          parsedIp = obj.port ? `${obj.ip}:${obj.port}` : obj.ip;
          parsedPin = String(obj.pin);
        }
      } catch (_) {}
    }

    if (!parsedIp || !parsedPin) {
      return false;
    }

    stopQrScanner();

    if (remoteIpInput) remoteIpInput.value = parsedIp;
    if (remotePinInput) remotePinInput.value = parsedPin;

    try {
      localStorage.setItem('valore_sync_last_ip', parsedIp);
      localStorage.setItem('valore_sync_last_pin', parsedPin);
    } catch (_) {}

    showToast('📷 QR Code lido com sucesso! Sincronizando com o PC...', 'success');

    // Dispara a sincronização bidirecional imediatamente!
    if (btnExecWifi && !btnExecWifi.disabled) {
      btnExecWifi.click();
    }
    return true;
  };

  const startQrScanner = async () => {
    if (!qrScannerContainer || !qrScannerVideo || !qrScannerCanvas) return;
    stopQrScanner();
    qrScannerContainer.style.display = 'flex';
    if (window.lucide) lucide.createIcons();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (qrScannerStatusText) {
        qrScannerStatusText.textContent = 'Câmera direta indisponível. Toque em "Ou Tirar Foto do QR Code" abaixo.';
      }
      return;
    }

    try {
      if (qrScannerStatusText) qrScannerStatusText.textContent = 'Iniciando câmera traseira em alta definição...';
      qrStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      qrScannerVideo.srcObject = qrStream;
      await qrScannerVideo.play();
      if (qrScannerStatusText) qrScannerStatusText.textContent = 'Aponte para o QR Code na tela do PC...';

      const ctx = qrScannerCanvas.getContext('2d', { willReadFrequently: true });
      const nativeDetector = ('BarcodeDetector' in window)
        ? new window.BarcodeDetector({ formats: ['qr_code'] })
        : null;

      qrScanTimer = setInterval(async () => {
        if (!qrScannerVideo || qrScannerVideo.readyState < 2) return;
        const w = qrScannerVideo.videoWidth;
        const h = qrScannerVideo.videoHeight;
        if (!w || !h) return;

        // 1. Tenta decodificador JS puro offline (jsQR)
        const jsQrFn = window.jsQR || (typeof jsQR !== 'undefined' ? jsQR : null);
        if (jsQrFn && ctx) {
          qrScannerCanvas.width = w;
          qrScannerCanvas.height = h;
          ctx.drawImage(qrScannerVideo, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQrFn(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code && code.data && handleQrCodeDecoded(code.data)) {
            return;
          }
        }

        // 2. Fallback para BarcodeDetector nativo do Android WebView
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(qrScannerVideo);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleQrCodeDecoded(barcodes[0].rawValue);
            }
          } catch (_) {}
        }
      }, 180);
    } catch (err) {
      console.warn('Aviso ao abrir câmera para QR Code:', err);
      if (qrScannerStatusText) {
        qrScannerStatusText.textContent = 'Permissão de câmera pendente. Use "Capturar Foto do QR" ao lado.';
      }
    }
  };

  if (btnOpenQrScanner) {
    btnOpenQrScanner.addEventListener('click', () => {
      if (qrScannerContainer && qrScannerContainer.style.display !== 'none') {
        stopQrScanner();
      } else {
        startQrScanner();
      }
    });
  }

  if (btnCloseQrScanner) {
    btnCloseQrScanner.addEventListener('click', stopQrScanner);
  }

  // Fallback para leitura de foto do QR Code via câmera nativa do sistema
  if (qrScannerFileInput) {
    qrScannerFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = qrScannerCanvas || document.createElement('canvas');
          const maxDim = 900;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const jsQrFn = window.jsQR || (typeof jsQR !== 'undefined' ? jsQR : null);
          if (jsQrFn) {
            const code = jsQrFn(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
            if (code && code.data && handleQrCodeDecoded(code.data)) {
              qrScannerFileInput.value = '';
              return;
            }
          }
          showWifiSyncFeedback('❌ Não foi possível identificar um QR Code do Valore na imagem. Tente aproximar mais da tela do PC.', 'danger');
          qrScannerFileInput.value = '';
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Carrega último IP e PIN salvos no aparelho (para sincronização com 1 toque e Auto-Sync em segundo plano)
  try {
    const savedIp = localStorage.getItem('valore_sync_last_ip');
    const savedPin = localStorage.getItem('valore_sync_last_pin');
    if (remoteIpInput && savedIp) remoteIpInput.value = savedIp;
    if (remotePinInput && savedPin) remotePinInput.value = savedPin;
  } catch (_) {}

  const chkWifiAutoSync = document.getElementById('chkWifiAutoSync');
  if (chkWifiAutoSync) {
    try {
      chkWifiAutoSync.checked = localStorage.getItem('valore_wifi_auto_sync') !== 'false';
    } catch (_) {}
    chkWifiAutoSync.addEventListener('change', () => {
      try {
        localStorage.setItem('valore_wifi_auto_sync', chkWifiAutoSync.checked ? 'true' : 'false');
      } catch (_) {}
      updateSyncStatusUI();
      if (chkWifiAutoSync.checked) {
        showToast('⚡ Auto-Sync Wi-Fi ativado! Seus dados sincronizarão sozinhos em segundo plano.', 'success');
        triggerSilentWifiAutoSync('toggle_on');
      } else {
        showToast('Auto-Sync em segundo plano pausado.', 'info');
      }
    });
  }

  const getSyncDeviceLabel = () => {
    try {
      const id = finance.getDeviceIdentity ? finance.getDeviceIdentity() : null;
      if (id) {
        const ownerName = id.ownerRole === 'p2' ? (id.p2Name || 'Esposa') : (id.p1Name || 'Você');
        return `${id.deviceIcon || '📱'} ${id.deviceLabel || 'Celular'} de ${ownerName}`;
      }
    } catch (_) {}
    return (window.electronAPI && window.electronAPI.getSyncServerStatus) ? '💻 Valore Desktop' : '📱 Valore Mobile Android';
  };

  // Escuta notificações quando um celular sincronizar com este PC em segundo plano
  if (window.electronAPI && window.electronAPI.onRemoteSyncCompleted) {
    window.electronAPI.onRemoteSyncCompleted(async (info) => {
      await finance.init();
      refreshAllViewsAfterSync();
      updateSyncStatusUI();
      const s = info.stats || {};
      const totalChanges =
        (s.addedTransactions || 0) +
        (s.updatedTransactions || 0) +
        (s.addedAccounts || 0) +
        (s.updatedAccounts || 0) +
        (s.addedSchedules || 0) +
        (s.updatedSchedules || 0) +
        (s.deletedItems || 0);
      if (!info.silentAutoSync || totalChanges > 0 || info.autoSyncReason === 'mutation') {
        const detailText = (s.addedTransactions || 0) > 0
          ? ` (+${s.addedTransactions} novo(s) lançamento(s))`
          : (s.updatedTransactions || 0) > 0
            ? ` (${s.updatedTransactions} lançamento(s) atualizado(s))`
            : '';
        showToast(`🔄 Sincronizado automaticamente com ${info.deviceName}${detailText}!`, 'success');
      }
    });
  }

  const closeBackup = () => {
    stopQrScanner();
    if (backupModal) backupModal.classList.remove('open');
  };

  if (btnExport && backupModal) {
    btnExport.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.syncDeviceIdentityUI) window.syncDeviceIdentityUI();
      updateSyncStatusUI();
      refreshDesktopSyncServerCard();
      backupModal.classList.add('open');
      if (window.lucide) lucide.createIcons();
    });
  }

  const btnRestorePcBackup = document.getElementById('btnRestorePcManualBackup');
  if (btnRestorePcBackup && window.electronAPI && window.electronAPI.restorePcBackup) {
    btnRestorePcBackup.addEventListener('click', async () => {
      const res = await window.electronAPI.restorePcBackup();
      if (res && res.success) {
        await finance.init();
        refreshAllViewsAfterSync();
        updateSyncStatusUI();
        showToast(`✅ Base original do PC restaurada com sucesso (${finance.state.accounts.length} contas e ${finance.state.transactions.length} lançamentos)!`, 'success');
      } else {
        showToast(res && res.error ? res.error : 'Não foi possível restaurar o backup.', 'danger');
      }
    });
  }

  if (btnRegenPin && window.electronAPI && window.electronAPI.regenerateSyncPin) {
    btnRegenPin.addEventListener('click', async () => {
      const status = await window.electronAPI.regenerateSyncPin();
      const pinEl = document.getElementById('syncServerPinDisplay');
      if (pinEl && status) pinEl.textContent = status.pin;
      if (status) renderSyncServerQrCode(status.primaryIp, status.port, status.pin);
      showToast('Novo PIN e QR Code gerados!', 'info');
    });
  }

  // Normaliza URL de destino do PC na rede local
  const buildTargetUrl = (rawIp) => {
    let clean = String(rawIp || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!clean) throw new Error('Informe o endereço IP exibido na tela do seu PC (ex: 192.168.1.15).');
    if (!clean.includes(':')) clean = `${clean}:45454`;
    return `http://${clean}`;
  };

  if (btnTestWifi) {
    btnTestWifi.addEventListener('click', async () => {
      try {
        const baseUrl = buildTargetUrl(remoteIpInput ? remoteIpInput.value : '');
        const pin = String(remotePinInput ? remotePinInput.value : '').trim();
        showWifiSyncFeedback('⏳ Testando comunicação com o PC na rede Wi-Fi...', 'info');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${baseUrl}/valore-sync/ping`, {
          method: 'GET',
          headers: { 'X-Valore-Pin': pin },
          signal: controller.signal
        });
        clearTimeout(timer);

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Falha de autenticação com o PC.');
        }

        localStorage.setItem('valore_sync_last_ip', remoteIpInput.value.trim());
        if (pin) localStorage.setItem('valore_sync_last_pin', pin);
        showWifiSyncFeedback(`✅ Conectado com sucesso ao computador <b>${escapeHtml(data.hostname || 'Valore PC')}</b>! Pronto para sincronizar.`, 'success');
      } catch (err) {
        const msg = err.name === 'AbortError'
          ? 'Tempo esgotado. Verifique se o PC e o celular estão no mesmo Wi-Fi e se o Valore está aberto no PC.'
          : err.message;
        showWifiSyncFeedback(`❌ Não foi possível conectar: ${msg}`, 'danger');
      }
    });
  }

  let lastKnownRemoteModifiedAt = (finance.state && finance.state.syncMeta && finance.state.syncMeta.lastModifiedAt) || 0;
  let autoSyncDebounceTimer = null;
  let autoSyncInFlight = false;

  if (btnExecWifi) {
    btnExecWifi.addEventListener('click', async () => {
      try {
        const baseUrl = buildTargetUrl(remoteIpInput ? remoteIpInput.value : '');
        const pin = String(remotePinInput ? remotePinInput.value : '').trim();
        if (pin.length < 4) {
          throw new Error('Digite o PIN de Segurança de 6 dígitos que aparece no Valore do seu PC.');
        }

        const modeSelect = document.getElementById('syncWifiModeSelect');
        const syncMode = modeSelect ? modeSelect.value : 'smart_merge';

        btnExecWifi.disabled = true;
        const modeDesc = syncMode === 'pc_to_mobile'
          ? '💻 ➔ 📱 Copiando base oficial do PC para o Celular...'
          : syncMode === 'mobile_to_pc'
            ? '📱 ➔ 💻 Enviando base do Celular para o PC...'
            : '🔄 Sincronizando e unindo lançamentos entre Celular e PC (Smart Merge)...';
        showWifiSyncFeedback(modeDesc, 'info');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`${baseUrl}/valore-sync/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Valore-Pin': pin
          },
          body: JSON.stringify({
            deviceName: getSyncDeviceLabel(),
            syncMode,
            exportedAt: new Date().toISOString(),
            state: finance.state
          }),
          signal: controller.signal
        });
        clearTimeout(timer);

        const data = await res.json();
        if (!res.ok || !data.ok || !data.mergedState) {
          throw new Error(data.error || 'Erro ao sincronizar dados com o PC.');
        }

        // Adota integralmente o estado oficial retornado pelo servidor do PC (garante 100% de paridade e exclusão de dados de fábrica)
        await finance.restoreBackup(data.mergedState, { skipAutoSync: true, preserveModifiedTimestamp: true });
        localStorage.setItem('valore_sync_last_ip', remoteIpInput.value.trim());
        localStorage.setItem('valore_sync_last_pin', pin);
        localStorage.removeItem('valore_sync_pending_changes');
        if (data.mergedState.syncMeta && data.mergedState.syncMeta.lastModifiedAt) {
          lastKnownRemoteModifiedAt = data.mergedState.syncMeta.lastModifiedAt;
        }

        updateSyncStatusUI();
        refreshAllViewsAfterSync();

        showWifiSyncFeedback(
          `🎉 <b>Sincronização Concluída com Sucesso!</b><br>` +
          `PC (${escapeHtml(data.hostname || 'Desktop')}) e Celular estão 100% idênticos. ` +
          `Total: <b>${finance.state.transactions.length} lançamentos</b> e <b>${finance.state.accounts.length} contas</b>.`,
          'success'
        );
        showToast('Sincronização PC ⇄ Celular concluída com sucesso!', 'success');
      } catch (err) {
        const msg = err.name === 'AbortError'
          ? 'Conexão interrompida ou tempo esgotado. Certifique-se de que ambos estão na mesma rede Wi-Fi.'
          : err.message;
        showWifiSyncFeedback(`❌ Falha na sincronização: ${msg}`, 'danger');
      } finally {
        btnExecWifi.disabled = false;
      }
    });
  }

  // =========================================================================
  // --- MOTOR DE AUTO-SYNC SILENCIOSO EM SEGUNDO PLANO (WI-FI DIRECT) ---
  // =========================================================================
  async function executeSilentWifiAutoSync(reason = 'mutation') {
    if (autoSyncInFlight) return;
    try {
      if (localStorage.getItem('valore_wifi_auto_sync') === 'false') return;
      const savedIp = (localStorage.getItem('valore_sync_last_ip') || '').trim();
      const savedPin = (localStorage.getItem('valore_sync_last_pin') || '').trim();
      if (!savedIp || savedPin.length < 4) return;

      // Evita que o próprio PC tente sincronizar consigo mesmo como cliente
      if (window.electronAPI && window.electronAPI.getSyncServerStatus) {
        try {
          const st = await window.electronAPI.getSyncServerStatus();
          const cleanSavedHost = savedIp.split(':')[0];
          if (st && Array.isArray(st.ips) && (st.ips.includes(cleanSavedHost) || cleanSavedHost === '127.0.0.1' || cleanSavedHost === 'localhost')) {
            return;
          }
        } catch (_) {}
      }

      autoSyncInFlight = true;
      const baseUrl = buildTargetUrl(savedIp);
      const prevTxCount = (finance.state && Array.isArray(finance.state.transactions)) ? finance.state.transactions.length : 0;
      const prevModifiedAt = (finance.state && finance.state.syncMeta && finance.state.syncMeta.lastModifiedAt) || 0;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`${baseUrl}/valore-sync/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Valore-Pin': savedPin
        },
        body: JSON.stringify({
          deviceName: getSyncDeviceLabel(),
          syncMode: 'smart_merge',
          silentAutoSync: true,
          autoSyncReason: reason,
          exportedAt: new Date().toISOString(),
          state: finance.state
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data || !data.ok || !data.mergedState) {
        throw new Error('Payload inválido');
      }

      const hadPending = localStorage.getItem('valore_sync_pending_changes') === 'true';
      localStorage.removeItem('valore_sync_pending_changes');

      await finance.restoreBackup(data.mergedState, { skipAutoSync: true, preserveModifiedTimestamp: true });
      if (data.mergedState.syncMeta && data.mergedState.syncMeta.lastModifiedAt) {
        lastKnownRemoteModifiedAt = data.mergedState.syncMeta.lastModifiedAt;
      }

      const newTxCount = (finance.state && Array.isArray(finance.state.transactions)) ? finance.state.transactions.length : 0;
      const s = data.stats || {};
      const remoteBroughtChanges =
        newTxCount !== prevTxCount ||
        (s.addedTransactions || 0) > 0 ||
        (s.updatedTransactions || 0) > 0 ||
        (s.addedAccounts || 0) > 0 ||
        (s.updatedAccounts || 0) > 0 ||
        (s.addedSchedules || 0) > 0 ||
        (s.deletedItems || 0) > 0 ||
        reason === 'remote_change';

      updateSyncStatusUI();
      if (remoteBroughtChanges || reason === 'mutation' || hadPending) {
        refreshAllViewsAfterSync();
      }

      if (reason === 'mutation' || hadPending) {
        showToast(`🔄 Sincronizado automaticamente com o PC (${data.hostname || 'Wi-Fi'})!`, 'success');
      } else if (reason === 'remote_change') {
        showToast(`💻 Atualizações do PC recebidas automaticamente via Wi-Fi!`, 'info');
      }
    } catch (_) {
      // Falha silenciosa se estiver fora do Wi-Fi de casa ou PC desligado; mantém na fila p/ sincronizar assim que conectar
      if (reason === 'mutation') {
        try { localStorage.setItem('valore_sync_pending_changes', 'true'); } catch (e) {}
        updateSyncStatusUI();
      }
    } finally {
      autoSyncInFlight = false;
    }
  }

  function triggerSilentWifiAutoSync(reason = 'mutation') {
    if (autoSyncDebounceTimer) clearTimeout(autoSyncDebounceTimer);
    const delay = reason === 'mutation' ? 950 : 300;
    autoSyncDebounceTimer = setTimeout(() => {
      executeSilentWifiAutoSync(reason);
    }, delay);
  }

  // 1. Dispara Auto-Sync sempre que o usuário criar, editar ou excluir qualquer dado local
  window.addEventListener('valore-local-data-changed', () => {
    try {
      if (localStorage.getItem('valore_sync_last_ip') && localStorage.getItem('valore_sync_last_pin')) {
        localStorage.setItem('valore_sync_pending_changes', 'true');
        updateSyncStatusUI();
      }
    } catch (_) {}
    triggerSilentWifiAutoSync('mutation');
  });

  // 2. Dispara Auto-Sync ao abrir/voltar para o aplicativo ou reconectar no Wi-Fi (descarrega fila offline)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerSilentWifiAutoSync('resume');
    }
  });
  window.addEventListener('online', () => {
    triggerSilentWifiAutoSync('online');
  });
  setTimeout(() => {
    updateSyncStatusUI();
    triggerSilentWifiAutoSync('startup');
  }, 1800);

  // 3. Monitoramento leve em segundo plano (detecta se houve alteração feita no PC enquanto o celular está aberto)
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || autoSyncInFlight) return;
    try {
      if (localStorage.getItem('valore_wifi_auto_sync') === 'false') return;
      const savedIp = (localStorage.getItem('valore_sync_last_ip') || '').trim();
      const savedPin = (localStorage.getItem('valore_sync_last_pin') || '').trim();
      if (!savedIp || savedPin.length < 4) return;
      if (window.electronAPI && window.electronAPI.getSyncServerStatus) return;

      const hasPending = localStorage.getItem('valore_sync_pending_changes') === 'true';
      if (hasPending) {
        executeSilentWifiAutoSync('pending_flush');
        return;
      }

      const baseUrl = buildTargetUrl(savedIp);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${baseUrl}/valore-sync/ping`, {
        method: 'GET',
        headers: { 'X-Valore-Pin': savedPin },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) return;
      const pingData = await res.json();
      if (pingData && pingData.ok) {
        const localMod = (finance.state && finance.state.syncMeta && finance.state.syncMeta.lastModifiedAt) || 0;
        const localTxCount = (finance.state && Array.isArray(finance.state.transactions)) ? finance.state.transactions.length : 0;
        if (
          (pingData.lastModifiedAt && pingData.lastModifiedAt > Math.max(lastKnownRemoteModifiedAt, localMod)) ||
          (typeof pingData.transactionsCount === 'number' && pingData.transactionsCount !== localTxCount)
        ) {
          lastKnownRemoteModifiedAt = pingData.lastModifiedAt || Date.now();
          executeSilentWifiAutoSync('remote_change');
        }
      }
    } catch (_) {}
  }, 15000);

  // Criptografia Ponta a Ponta (AES-256-GCM) - Exportar / Compartilhar Cofre
  if (btnExportEncrypted) {
    btnExportEncrypted.addEventListener('click', async () => {
      try {
        const pass = masterPassInput ? masterPassInput.value : '';
        if (!pass || pass.trim().length < 4) {
          showAppAlert({
            title: 'Senha Mestra Necessária',
            message: 'Defina uma <b>Senha Mestra</b> de pelo menos 4 caracteres para criptografar seu cofre em AES-256-GCM.',
            type: 'warning',
            icon: 'lock'
          });
          return;
        }

        const backupObj = finance.exportBackup();
        const encryptedEnvelope = await window.ValoreCrypto.encryptState(backupObj, pass);
        const jsonStr = JSON.stringify(encryptedEnvelope, null, 2);
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const filename = `Cofre_Valore_E2EE_${dateStr}.valore`;

        const blob = new Blob([jsonStr], { type: 'application/json' });

        // Se estiver no celular e suportar Web Share API de arquivos, oferece compartilhamento direto
        if (navigator.canShare && typeof File !== 'undefined') {
          const fileObj = new File([blob], filename, { type: 'application/json' });
          if (navigator.canShare({ files: [fileObj] })) {
            try {
              await navigator.share({
                title: 'Cofre Criptografado Valore (AES-256)',
                text: 'Pacote de sincronização criptografado do Valore Financeiro.',
                files: [fileObj]
              });
              showToast('Cofre AES-256 compartilhado com sucesso!', 'success');
              return;
            } catch (_) {}
          }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Cofre criptografado (.valore) gerado com sucesso!', 'success');
      } catch (err) {
        showAppAlert({
          title: 'Erro ao Criptografar',
          message: err.message,
          type: 'danger',
          icon: 'alert-triangle'
        });
      }
    });
  }

  // Importar & Mesclar Cofre Criptografado (AES-256-GCM)
  if (importEncryptedInput) {
    importEncryptedInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          let targetPayload = parsed;

          if (parsed.valoreEncrypted) {
            const pass = masterPassInput ? masterPassInput.value : '';
            if (!pass) {
              throw new Error('Digite a Senha Mestra do Cofre no campo acima antes de importar um arquivo criptografado (.valore).');
            }
            targetPayload = await window.ValoreCrypto.decryptState(parsed, pass);
          }

          const result = await finance.mergeExternalState(targetPayload);
          updateSyncStatusUI();
          refreshAllViewsAfterSync();
          closeBackup();

          await showAppAlert({
            title: 'Cofre Descriptografado e Sincronizado!',
            message: `União inteligente (Smart Merge) concluída com sucesso!<br><br>` +
                     `• Novos lançamentos adicionados: <b>${result.stats.addedTransactions}</b><br>` +
                     `• Lançamentos atualizados: <b>${result.stats.updatedTransactions}</b><br>` +
                     `• Total consolidado no aparelho: <b>${result.transactionsCount} transações</b> e <b>${result.accountsCount} contas</b>.`,
            type: 'success',
            icon: 'shield-check'
          });
        } catch (err) {
          showAppAlert({
            title: 'Falha ao Abrir Cofre',
            message: err.message,
            type: 'danger',
            icon: 'lock'
          });
        } finally {
          importEncryptedInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  // Mesclar Backup JSON (Smart Merge sem substituir/perder lançamentos)
  if (mergeInput) {
    mergeInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let parsed = JSON.parse(event.target.result);
          if (parsed.valoreEncrypted) {
            const pass = masterPassInput && masterPassInput.value ? masterPassInput.value : prompt('Este arquivo é criptografado. Digite a Senha Mestra:');
            parsed = await window.ValoreCrypto.decryptState(parsed, pass);
          }

          const result = await finance.mergeExternalState(parsed);
          updateSyncStatusUI();
          refreshAllViewsAfterSync();
          closeBackup();

          await showAppAlert({
            title: 'Sincronização (Smart Merge) Concluída',
            message: `Os dados do arquivo foram unidos aos seus dados atuais sem perder nenhum lançamento!<br><br>` +
                     `• <b>+${result.stats.addedTransactions}</b> transações novas adicionadas<br>` +
                     `• <b>${result.stats.updatedTransactions}</b> transações atualizadas<br>` +
                     `• Total: <b>${result.transactionsCount} transações</b> e <b>${result.accountsCount} contas</b>.`,
            type: 'success',
            icon: 'check-circle'
          });
        } catch (err) {
          showAppAlert({
            title: 'Erro ao Mesclar Arquivo',
            message: err.message,
            type: 'danger',
            icon: 'alert-triangle'
          });
        } finally {
          mergeInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', (e) => {
      e.preventDefault();
      closeBackup();
    });
  }

  if (btnDismissModal) {
    btnDismissModal.addEventListener('click', (e) => {
      e.preventDefault();
      closeBackup();
    });
  }

  if (backupModal) {
    backupModal.addEventListener('click', (e) => {
      if (e.target === backupModal) closeBackup();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backupModal && backupModal.classList.contains('open')) {
      closeBackup();
    }
  });

  // 1. Download de Backup JSON
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      const backupData = finance.exportBackup();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `Valore_Backup_${dateStr}_${timeStr}.json`;

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // 2. Exportação de Extrato Geral em Excel (.xlsx)
  if (btnExportXLSX) {
    btnExportXLSX.addEventListener('click', () => {
      const txs = finance.state.transactions || [];
      if (txs.length === 0) {
        alert('Nenhuma transação registrada para exportar.');
        return;
      }

      const currentDateStr = localDateStr();
      const filename = `Extrato_Geral_Valore_${currentDateStr}.xlsx`;

      if (window.XLSX) {
        const rows = [
          ['VALORE - EXTRATO FINANCEIRO CONSOLIDADO'],
          [`Exportado em: ${new Date().toLocaleString('pt-BR')}`],
          [],
          ['Data', 'Descrição', 'Categoria', 'Conta / Cartão', 'Tipo', 'Valor (R$)', 'Status', 'Recorrência', 'Observações']
        ];

        txs.forEach(t => {
          let catName = 'Geral';
          const cat = finance.state.categories.find(c => c.id === t.categoryId);
          if (cat) catName = cat.name;

          let accName = 'Conta';
          if (t.type === 'transfer') {
            const from = finance.state.accounts.find(a => a.id === t.fromAccountId) || { name: 'Conta Origem' };
            const to = finance.state.accounts.find(a => a.id === t.toAccountId) || { name: 'Conta Destino' };
            accName = `${from.name} -> ${to.name}`;
          } else {
            const acc = finance.state.accounts.find(a => a.id === t.accountId);
            if (acc) accName = acc.name;
          }

          const typeLabel = t.type === 'income' ? 'Receita' : (t.type === 'expense' ? 'Despesa' : 'Transferência');

          rows.push([
            formatDateBR(t.date),
            t.description,
            catName,
            accName,
            typeLabel,
            t.amount,
            t.status === 'paid' ? 'Efetivado' : 'Pendente',
            t.recurring || 'none',
            t.notes || ''
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
          { wch: 12 }, // Data
          { wch: 30 }, // Descrição
          { wch: 22 }, // Categoria
          { wch: 24 }, // Conta
          { wch: 14 }, // Tipo
          { wch: 15 }, // Valor
          { wch: 12 }, // Status
          { wch: 14 }, // Recorrência
          { wch: 30 }  // Observações
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transações');
        XLSX.writeFile(wb, filename);
      } else {
        let csvContent = '\uFEFFData;Descrição;Categoria;Conta;Tipo;Valor;Status;Observações\r\n';
        txs.forEach(t => {
          const cat = finance.state.categories.find(c => c.id === t.categoryId);
          const acc = finance.state.accounts.find(a => a.id === t.accountId);
          csvContent += `"${formatDateBR(t.date)}";"${(t.description || '').replace(/"/g, '""')}";"${cat ? cat.name : ''}";"${acc ? acc.name : ''}";"${t.type}";"${t.amount}";"${t.status}";"${(t.notes || '').replace(/"/g, '""')}"\r\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Extrato_Valore_${currentDateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    });
  }

  // 3. Restaurar Backup
  if (restoreInput) {
    restoreInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          const confirmed = await showAppConfirm({
            title: 'Restaurar Cópia de Segurança',
            message: '<b>Atenção:</b> A restauração substituirá os registros atuais por aqueles contidos no arquivo de backup.<br><br>Deseja realmente prosseguir com a restauração?',
            icon: 'alert-triangle',
            type: 'danger',
            confirmText: 'Confirmar Restauração'
          });

          if (confirmed) {
            const result = await finance.restoreBackup(parsed);
            await showAppAlert({
              title: 'Restauração Concluída',
              message: `Cópia de segurança restaurada com sucesso!<br><br><b>${result.transactionsCount} transações</b> e <b>${result.accountsCount} contas</b> recuperadas.`,
              type: 'success',
              icon: 'check-circle'
            });
            closeBackup();
            populateFormDropdowns();
            renderDashboard();
            if (currentTab === 'transactions') renderTransactionsView();
            if (currentTab === 'accounts') renderAccountsView();
            if (currentTab === 'schedules') renderSchedulesView();
            if (currentTab === 'assets') renderAssetsView();
            if (currentTab === 'goals') renderGoalsView();
            if (currentTab === 'budgets') renderBudgetsView();
            if (currentTab === 'categories') renderCategoriesView();
            if (currentTab === 'cost-centers') renderCostCentersView();
            if (currentTab === 'side-hustles') renderSideHustlesView();
            if (currentTab === 'forecast') renderForecastView();
            if (window.lucide) lucide.createIcons();
          }
        } catch (err) {
          showAppAlert({
            title: 'Erro na Restauração',
            message: 'Erro ao restaurar arquivo: ' + err.message,
            type: 'danger',
            icon: 'alert-triangle'
          });
        } finally {
          restoreInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }
}


// --- FORMATADORES INTELIGENTES E SELETORES DE CONTAS & CARTÕES ---
function formatAccountOptionLabel(acc) {
  const brandLabel = {
    mastercard: 'Mastercard',
    visa: 'Visa',
    elo: 'Elo',
    amex: 'American Express',
    hipercard: 'Hipercard',
    other: 'Cartão'
  }[acc.cardBrand || 'mastercard'] || 'Cartão';

  if (acc.type === 'credit') {
    return `💳 ${acc.name} (Cartão • ${brandLabel})${acc.isDefault ? ' ★ Padrão' : ''}`;
  } else if (acc.type === 'investment') {
    return `📈 ${acc.name} (Investimento - Saldo: ${currencyFormatter.format(acc.balance || 0)})${acc.isDefault ? ' ★ Padrão' : ''}`;
  } else if (acc.type === 'cash') {
    return `💵 ${acc.name} (Dinheiro Físico - Saldo: ${currencyFormatter.format(acc.balance || 0)})${acc.isDefault ? ' ★ Padrão' : ''}`;
  } else {
    return `🏦 ${acc.name} (Conta Corrente - Saldo: ${currencyFormatter.format(acc.balance || 0)})${acc.isDefault ? ' ★ Padrão' : ''}`;
  }
}

function buildAccountSelectOptionsHtml(filterType = 'all') {
  // filterType: 'all' | 'non-credit' | 'credit-only'
  const accounts = (finance && finance.state && finance.state.accounts) ? finance.state.accounts : [];
  const banks = accounts.filter(a => a.type !== 'credit');
  const cards = accounts.filter(a => a.type === 'credit');

  if (filterType === 'non-credit') {
    return banks.map(a => `<option value="${a.id}">${formatAccountOptionLabel(a)}</option>`).join('');
  }

  if (filterType === 'credit-only') {
    return cards.map(a => `<option value="${a.id}">${formatAccountOptionLabel(a)}</option>`).join('');
  }

  let html = '';
  if (banks.length > 0) {
    html += `<optgroup label="🏦 Contas Bancárias & Dinheiro">` +
      banks.map(a => `<option value="${a.id}">${formatAccountOptionLabel(a)}</option>`).join('') +
      `</optgroup>`;
  }
  if (cards.length > 0) {
    html += `<optgroup label="💳 Cartões de Crédito">` +
      cards.map(a => `<option value="${a.id}">${formatAccountOptionLabel(a)}</option>`).join('') +
      `</optgroup>`;
  }
  return html;
}

function updateTxAccountDropdown(txType = currentTxType) {
  const accSelect = document.getElementById('txAccount');
  const fromSelect = document.getElementById('txFromAccount');
  const toSelect = document.getElementById('txToAccount');

  if (accSelect) {
    const currentVal = accSelect.value;
    const filter = (txType === 'income') ? 'non-credit' : 'all';
    accSelect.innerHTML = buildAccountSelectOptionsHtml(filter);
    if (currentVal && accSelect.querySelector(`option[value="${currentVal}"]`)) {
      accSelect.value = currentVal;
    } else {
      const defaultAcc = (txType === 'income')
        ? (finance.state.accounts.find(a => a.isDefault && a.type !== 'credit') || finance.state.accounts.find(a => a.type !== 'credit'))
        : (finance.state.accounts.find(a => a.isDefault) || finance.state.accounts[0]);
      if (defaultAcc) accSelect.value = defaultAcc.id;
    }
  }

  if (fromSelect) {
    const currentVal = fromSelect.value;
    fromSelect.innerHTML = buildAccountSelectOptionsHtml('non-credit');
    if (currentVal && fromSelect.querySelector(`option[value="${currentVal}"]`)) {
      fromSelect.value = currentVal;
    } else {
      const defaultBank = finance.state.accounts.find(a => a.isDefault && a.type !== 'credit') || finance.state.accounts.find(a => a.type !== 'credit');
      if (defaultBank) fromSelect.value = defaultBank.id;
    }
  }

  if (toSelect) {
    const currentVal = toSelect.value;
    toSelect.innerHTML = buildAccountSelectOptionsHtml('non-credit');
    if (currentVal && toSelect.querySelector(`option[value="${currentVal}"]`)) {
      toSelect.value = currentVal;
    } else {
      const banks = finance.state.accounts.filter(a => a.type !== 'credit');
      if (banks.length > 1) toSelect.value = banks[1].id;
      else if (banks.length > 0) toSelect.value = banks[0].id;
    }
  }
}

function populateFormDropdowns() {
  const schAccSelect = document.getElementById('schAccount');
  const goalAccSelect = document.getElementById('goalAccountSelect');
  const goalContribAccSelect = document.getElementById('goalContribAccount');

  const defaultAcc = finance.state.accounts.find(a => a.isDefault) || finance.state.accounts[0];

  updateTxAccountDropdown(currentTxType);

  if (schAccSelect) {
    const curVal = schAccSelect.value;
    schAccSelect.innerHTML = buildAccountSelectOptionsHtml('all');
    if (curVal && schAccSelect.querySelector(`option[value="${curVal}"]`)) {
      schAccSelect.value = curVal;
    } else if (defaultAcc) {
      schAccSelect.value = defaultAcc.id;
    }
  }

  if (goalAccSelect) {
    const curVal = goalAccSelect.value;
    goalAccSelect.innerHTML = '<option value="">Nenhuma conta vinculada</option>' + buildAccountSelectOptionsHtml('all');
    if (curVal) goalAccSelect.value = curVal;
  }

  if (goalContribAccSelect) {
    const curVal = goalContribAccSelect.value;
    goalContribAccSelect.innerHTML = buildAccountSelectOptionsHtml('non-credit');
    if (curVal) goalContribAccSelect.value = curVal;
  }

  filterCategoriesByType('expense');
}

function filterCategoriesByType(type) {
  const catSelect = document.getElementById('txCategory');
  if (!catSelect) return;
  const cats = finance.state.categories.filter(c => c.type === type);
  catSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// Manipuladores de Metas & Sonhos
window.handleFilterGoals = function(filter) {
  currentGoalsFilter = filter;
  renderGoalsView();
};

window.handleOpenNewGoalModal = function() {
  const goalModal = document.getElementById('goalModal');
  const goalForm = document.getElementById('goalForm');
  if (!goalModal || !goalForm) return;

  goalForm.reset();
  document.getElementById('goalEditId').value = '';
  document.getElementById('goalModalTitle').textContent = 'Nova Meta Financeira';
  document.getElementById('goalModalSub').textContent = 'Defina seu objetivo com prazo e acompanhe a evolução';
  document.getElementById('btnSubmitGoal').textContent = 'Salvar Meta';

  const initialGroup = document.getElementById('goalInitialAmountGroup');
  if (initialGroup) initialGroup.style.display = 'block';

  document.getElementById('goalTarget').value = '0,00';
  document.getElementById('goalCurrent').value = '0,00';
  document.getElementById('goalColor').value = '#3b82f6';
  document.getElementById('goalCategory').value = 'travel';

  populateFormDropdowns();

  // Data padrão: 180 dias à frente (6 meses)
  const targetDate = new Date(Date.now() + 180 * 86400000);
  document.getElementById('goalDeadline').value = localDateStr(targetDate);

  goalModal.classList.add('open');
};

window.handleEditGoal = function(id) {
  const goal = finance.state.goals.find(g => g.id === id);
  if (!goal) return;

  const goalModal = document.getElementById('goalModal');
  if (!goalModal) return;

  populateFormDropdowns();

  document.getElementById('goalEditId').value = goal.id;
  document.getElementById('goalModalTitle').textContent = `Editar: ${goal.title}`;
  document.getElementById('goalModalSub').textContent = 'Atualize valor alvo, prazo ou detalhes desta meta';
  document.getElementById('btnSubmitGoal').textContent = 'Salvar Alterações';

  document.getElementById('goalTitle').value = goal.title || '';
  document.getElementById('goalTarget').value = formatCurrencyInput(goal.targetAmount || 0);
  document.getElementById('goalDeadline').value = goal.deadline || '';
  document.getElementById('goalColor').value = goal.color || '#3b82f6';
  document.getElementById('goalCategory').value = goal.category || 'other';

  const goalAccSelect = document.getElementById('goalAccountSelect');
  if (goalAccSelect) goalAccSelect.value = goal.accountId || '';

  const initialGroup = document.getElementById('goalInitialAmountGroup');
  if (initialGroup) initialGroup.style.display = 'none';

  goalModal.classList.add('open');
};

window.handleDeleteGoal = async function(id) {
  const goal = finance.state.goals.find(g => g.id === id);
  const name = goal ? goal.title : 'esta meta';
  const confirmed = await showAppConfirm({
    title: 'Excluir Meta',
    message: `Tem certeza que deseja realmente excluir a meta <b>"${name}"</b>?<br><br><span style="color: var(--text-muted); font-size: 0.8rem;">(O histórico e saldo vinculado a esta meta serão removidos)</span>`,
    icon: 'trash-2',
    type: 'danger',
    confirmText: 'Confirmar Exclusão'
  });
  if (confirmed) {
    await finance.deleteGoal(id);
    renderGoalsView();
    renderDashboard();
  }
};

window.handleAporteGoal = function(goalId, defaultType = 'deposit') {
  const goal = finance.state.goals.find(g => g.id === goalId);
  if (!goal) return;

  const modal = document.getElementById('goalContributionModal');
  const form = document.getElementById('goalContribForm');
  if (!modal || !form) return;

  form.reset();
  populateFormDropdowns();

  document.getElementById('goalContribGoalId').value = goal.id;
  document.getElementById('goalContribAmount').value = '0,00';
  document.getElementById('goalContribDate').value = localDateStr();
  document.getElementById('goalContribNotes').value = '';

  const subEl = document.getElementById('goalContribModalSub');
  if (subEl) {
    const pace = finance.calculateGoalPace(goal);
    subEl.textContent = `Meta: ${goal.title} | Saldo Atual: ${currencyFormatter.format(goal.currentAmount)} de ${currencyFormatter.format(goal.targetAmount)} (${pace.progressPercent}%)`;
  }

  // Pré-seleciona conta vinculada se houver
  const contribAccSelect = document.getElementById('goalContribAccount');
  if (contribAccSelect && goal.accountId) {
    contribAccSelect.value = goal.accountId;
  }

  // Ativa a aba solicitada (deposit ou withdraw)
  const tabBtn = defaultType === 'withdraw' ? document.getElementById('btnGoalTabWithdraw') : document.getElementById('btnGoalTabDeposit');
  if (tabBtn) tabBtn.click();

  modal.classList.add('open');
};

window.handleToggleGoalHistory = function(goalId) {
  if (expandedGoalHistorySet.has(goalId)) {
    expandedGoalHistorySet.delete(goalId);
  } else {
    expandedGoalHistorySet.add(goalId);
  }
  renderGoalsView();
};

// Manipuladores Globais
let txPendingDeletionId = null;

window.closeConfirmDeleteTxModal = function() {
  const modal = document.getElementById('confirmDeleteTxModal');
  if (modal) modal.classList.remove('open');
  txPendingDeletionId = null;
};

window.handleDeleteTx = function(id) {
  const tx = finance.state.transactions.find(t => t.id === id);
  if (!tx) {
    console.warn('Transação não encontrada para exclusão:', id);
    return;
  }

  txPendingDeletionId = id;
  const modal = document.getElementById('confirmDeleteTxModal');
  const msgEl = document.getElementById('confirmDeleteTxMessage');
  const instOpt = document.getElementById('confirmDeleteTxInstallmentOptions');

  const isInstallment = (tx.installmentTotal && tx.installmentTotal > 1) || !!tx.installmentGroupId;

  if (msgEl) {
    msgEl.innerHTML = `Tem certeza que deseja excluir a transação <b>"${tx.description}"</b> no valor de <b style="color: var(--danger);">${currencyFormatter.format(tx.amount)}</b>?`;
  }

  if (instOpt) {
    if (isInstallment) {
      instOpt.style.display = 'block';
      const defaultRadio = document.querySelector('input[name="deleteInstallmentScope"][value="all"]');
      if (defaultRadio) defaultRadio.checked = true;
    } else {
      instOpt.style.display = 'none';
    }
  }

  if (modal) {
    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  } else {
    showAppConfirm({
      title: 'Excluir Transação',
      message: `Tem certeza que deseja excluir a transação <b>"${tx.description}"</b> no valor de <b style="color: var(--danger);">${currencyFormatter.format(tx.amount)}</b>?`,
      icon: 'trash-2',
      type: 'danger',
      confirmText: 'Confirmar Exclusão'
    }).then((confirmed) => {
      if (confirmed) {
        finance.deleteTransaction(id).then(() => {
          try { renderAccountsView(); } catch(e) {}
          if (selectedAccountId) {
            try { renderSelectedAccountDetails(); } catch(e) {}
          }
          try { renderTransactionsView(); } catch(e) {}
          try { renderDashboard(); } catch(e) {}
          if (window.lucide) lucide.createIcons();
        });
      }
    });
  }
};

window.handlePaySchedule = async function(id) {
  const sch = finance.state.schedules.find(s => s.id === id);
  const title = sch ? sch.title : 'esta conta';
  const confirmed = await showAppConfirm({
    title: 'Confirmar Pagamento / Recebimento',
    message: `Deseja confirmar a baixa da conta agendada <b>"${title}"</b>?`,
    icon: 'check-circle',
    type: 'success',
    confirmText: 'Confirmar Baixa'
  });
  if (confirmed) {
    await finance.paySchedule(id);
    renderSchedulesView();
    renderDashboard();
    if (currentTab === 'accounts') renderAccountsView();
  }
};

window.handleEditSchedule = function(id) {
  const sch = finance.state.schedules.find(s => s.id === id);
  if (!sch) return;

  const schModal = document.getElementById('schModal');
  const schForm = document.getElementById('schForm');
  if (!schModal || !schForm) return;

  schForm.reset();

  document.getElementById('schEditId').value = sch.id;
  document.getElementById('schDesc').value = sch.description || '';
  document.getElementById('schAmount').value = formatCurrencyInput(sch.amount);

  const schTypeSelect = document.getElementById('schType');
  if (schTypeSelect) schTypeSelect.value = sch.type || 'expense';

  const schDayRuleSelect = document.getElementById('schDayRule');
  if (schDayRuleSelect) schDayRuleSelect.value = sch.dayRule || 'fixed';

  document.getElementById('schDueDate').value = sch.dueDate || localDateStr();

  const schRecurringSelect = document.getElementById('schRecurring');
  if (schRecurringSelect) schRecurringSelect.value = sch.recurring || 'monthly';

  const schAccountSelect = document.getElementById('schAccount');
  if (schAccountSelect && sch.accountId) schAccountSelect.value = sch.accountId;

  const schBarcode = document.getElementById('schBarcode');
  if (schBarcode) schBarcode.value = sch.barcode || '';

  // Configura a visualização contextual do tipo de agendamento (receita vs despesa)
  const isIncome = sch.type === 'income';
  const schBarcodeGroup = document.getElementById('schBarcodeGroup');
  const schIncomeAlertBanner = document.getElementById('schIncomeAlertBanner');
  const schAccountLabel = document.getElementById('schAccountLabel');
  const schCategoryLabel = document.getElementById('schCategoryLabel');
  const schCategorySelect = document.getElementById('schCategory');

  if (schBarcodeGroup) schBarcodeGroup.style.display = isIncome ? 'none' : 'block';
  if (schIncomeAlertBanner) schIncomeAlertBanner.style.display = isIncome ? 'block' : 'none';
  if (schAccountLabel) schAccountLabel.textContent = isIncome ? 'Conta Bancária de Depósito (Destino)' : 'Conta Bancária para Débito (Saída)';
  if (schCategoryLabel) schCategoryLabel.textContent = isIncome ? 'Categoria do Recebimento' : 'Categoria da Despesa / Conta';

  if (schCategorySelect) {
    const cats = finance.state.categories.filter(c => c.type === (sch.type || 'expense'));
    schCategorySelect.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (sch.categoryId) {
      schCategorySelect.value = sch.categoryId;
    }
  }

  const titleEl = document.querySelector('#schModal h3');
  if (titleEl) titleEl.textContent = isIncome ? 'Editar Recebimento Agendado' : 'Editar Conta / Boleto Agendado';
  const submitBtn = document.getElementById('btnSubmitSch');
  if (submitBtn) submitBtn.textContent = 'Salvar Alterações';

  schModal.classList.add('open');
  if (window.lucide) lucide.createIcons();
};

window.handleDeleteSchedule = async function(id) {
  const sch = finance.state.schedules.find(s => s.id === id);
  const title = sch ? (sch.description || sch.title || 'este boleto/agendamento') : 'este agendamento';
  const confirmed = await showAppConfirm({
    title: 'Excluir Boleto / Agendamento',
    message: `Tem certeza que deseja excluir o boleto <b>"${title}"</b>?`,
    icon: 'trash-2',
    type: 'danger',
    confirmText: 'Confirmar Exclusão',
    cancelText: 'Cancelar'
  });
  if (confirmed) {
    await finance.deleteSchedule(id);
    renderSchedulesView();
    renderDashboard();
    if (typeof renderAccountsView === 'function') renderAccountsView();
  }
};

window.handleDeleteAsset = async function(id) {
  const asset = finance.state.assets.find(a => a.id === id);
  const name = asset ? asset.name : 'este bem patrimonial';
  const confirmed = await showAppConfirm({
    title: 'Excluir Bem Patrimonial',
    message: `Tem certeza que deseja excluir o bem <b>"${name}"</b>?`,
    icon: 'trash-2',
    type: 'danger',
    confirmText: 'Confirmar Exclusão'
  });
  if (confirmed) {
    await finance.deleteAsset(id);
    renderAssetsView();
    renderDashboard();
  }
};

window.handleToggleReconciled = async function(txId) {
  await finance.toggleReconciled(txId);
  renderTransactionsView();
  if (currentTab === 'accounts') renderAccountsView();
  renderDashboard();
};

function populateBudgetCategoryDropdown() {
  const sel = document.getElementById('budgetCategorySelect');
  if (!sel) return;
  const expenseCats = finance.state.categories.filter(c => c.type === 'expense');
  sel.innerHTML = expenseCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

window.handleEditBudget = function(catId, currentLimit) {
  const budgetModal = document.getElementById('budgetModal');
  if (!budgetModal) return;
  populateBudgetCategoryDropdown();
  const sel = document.getElementById('budgetCategorySelect');
  if (sel) sel.value = catId;
  const input = document.getElementById('budgetLimitInput');
  if (input) {
    input.value = formatCurrencyInput(currentLimit || 0);
  }
  budgetModal.classList.add('open');
};

// Manipuladores de Categorias
window.handleFilterCategories = function(filter) {
  currentCategoryFilter = filter;
  renderCategoriesView();
};

window.renderIconGrid = function(searchQuery = '') {
  const container = document.getElementById('iconGridContainer');
  if (!container) return;

  const currentSelectedIcon = (document.getElementById('catIcon') ? document.getElementById('catIcon').value : 'tag') || 'tag';
  const query = (searchQuery || '').toLowerCase().trim();

  let iconsToShow = CATEGORY_ICON_CATALOG;
  if (query) {
    iconsToShow = CATEGORY_ICON_CATALOG.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.label.toLowerCase().includes(query) || 
      item.keywords.toLowerCase().includes(query)
    );
  }

  if (iconsToShow.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.78rem; padding: 1rem;">Nenhum ícone encontrado para "${searchQuery}".</div>`;
    return;
  }

  container.innerHTML = iconsToShow.map(item => {
    const isSelected = item.name === currentSelectedIcon;
    return `
      <button type="button" class="icon-option-btn ${isSelected ? 'selected' : ''}" data-icon="${item.name}" title="${item.label}">
        <i data-lucide="${item.name}"></i>
      </button>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();

  container.querySelectorAll('.icon-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const iconName = btn.dataset.icon;
      const catIconInput = document.getElementById('catIcon');
      if (catIconInput) catIconInput.value = iconName;

      const labelEl = document.getElementById('selectedIconLabel');
      const itemInfo = CATEGORY_ICON_CATALOG.find(i => i.name === iconName);
      if (labelEl) labelEl.textContent = `Ícone: ${itemInfo ? itemInfo.label : iconName}`;

      container.querySelectorAll('.icon-option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      window.updateCategoryLivePreview();
    });
  });
};

window.updateCategoryLivePreview = function() {
  const nameInput = document.getElementById('catName');
  const typeSelect = document.getElementById('catType');
  const colorInput = document.getElementById('catColor');
  const iconInput = document.getElementById('catIcon');

  const name = nameInput ? nameInput.value.trim() : '';
  const type = typeSelect ? typeSelect.value : 'expense';
  const color = colorInput ? colorInput.value : '#3b82f6';
  const icon = iconInput ? (iconInput.value || 'tag') : 'tag';

  const previewName = document.getElementById('previewCatName');
  const previewType = document.getElementById('previewCatType');
  const previewBadge = document.getElementById('previewIconBadge');
  const previewIcon = document.getElementById('previewIconElement');

  if (previewName) previewName.textContent = name || 'Nova Categoria';

  if (previewType) {
    const typeLabel = type === 'income' ? 'Tipo: Receita (+)' : (type === 'transfer' ? 'Tipo: Transferência (⇆)' : 'Tipo: Despesa (-)');
    const typeBadgeColor = type === 'income' ? 'var(--success)' : (type === 'transfer' ? '#8b5cf6' : 'var(--danger)');
    const typeBadgeBg = type === 'income' ? 'rgba(16, 185, 129, 0.15)' : (type === 'transfer' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)');
    previewType.textContent = typeLabel;
    previewType.style.color = typeBadgeColor;
    previewType.style.backgroundColor = typeBadgeBg;
  }

  if (previewBadge) {
    previewBadge.style.backgroundColor = `${color}22`;
    previewBadge.style.color = color;
  }

  if (previewIcon) {
    previewIcon.setAttribute('data-lucide', icon);
    if (window.lucide) lucide.createIcons();
  }
};

window.handleOpenNewCategoryModal = function() {
  const modal = document.getElementById('categoryModal');
  const form = document.getElementById('categoryForm');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('catEditId').value = '';
  document.getElementById('catIcon').value = 'tag';
  document.getElementById('categoryModalTitle').textContent = 'Nova Categoria';
  document.getElementById('categoryModalSub').textContent = 'Defina o nome, tipo, cor e escolha o ícone ideal';
  document.getElementById('btnSubmitCategory').textContent = 'Salvar Categoria';
  document.getElementById('catColor').value = '#3b82f6';
  document.getElementById('selectedIconLabel').textContent = 'Ícone: Geral';
  document.getElementById('iconSearchInput').value = '';

  // Seleciona a cor azul nos presets
  document.querySelectorAll('#colorPalettePresets .color-preset-dot').forEach(d => {
    d.classList.toggle('selected', d.dataset.color.toLowerCase() === '#3b82f6');
  });

  window.renderIconGrid('');
  window.updateCategoryLivePreview();

  modal.classList.add('open');
};

window.handleEditCategory = function(catId) {
  const cat = finance.state.categories.find(c => c.id === catId);
  if (!cat) return;

  const modal = document.getElementById('categoryModal');
  const form = document.getElementById('categoryForm');
  if (!modal || !form) return;

  document.getElementById('catEditId').value = cat.id;
  document.getElementById('catName').value = cat.name || '';
  document.getElementById('catType').value = cat.type || 'expense';
  document.getElementById('catColor').value = cat.color || '#3b82f6';
  document.getElementById('catIcon').value = cat.icon || 'tag';
  document.getElementById('iconSearchInput').value = '';

  document.getElementById('categoryModalTitle').textContent = `Editar: ${cat.name}`;
  document.getElementById('categoryModalSub').textContent = 'Atualize nome, tipo, cor e ícone desta categoria';
  document.getElementById('btnSubmitCategory').textContent = 'Salvar Alterações';

  const itemInfo = CATEGORY_ICON_CATALOG.find(i => i.name === (cat.icon || 'tag'));
  document.getElementById('selectedIconLabel').textContent = `Ícone: ${itemInfo ? itemInfo.label : (cat.icon || 'tag')}`;

  // Atualiza preset selecionado se houver match
  document.querySelectorAll('#colorPalettePresets .color-preset-dot').forEach(d => {
    d.classList.toggle('selected', d.dataset.color.toLowerCase() === (cat.color || '#3b82f6').toLowerCase());
  });

  window.renderIconGrid('');
  window.updateCategoryLivePreview();

  modal.classList.add('open');
};

window.handleDeleteCategory = async function(catId) {
  const cat = finance.state.categories.find(c => c.id === catId);
  if (!cat) return;

  const usage = finance.getCategoryUsage ? finance.getCategoryUsage(catId) : { totalLinked: 0 };
  let confirmMsg = `Tem certeza que deseja excluir a categoria <b>"${cat.name}"</b>?`;

  if (usage.totalLinked > 0) {
    confirmMsg = `Atenção: A categoria <b>"${cat.name}"</b> possui <b>${usage.transactionsCount} lançamento(s)</b> e <b>${usage.schedulesCount} agendamento(s)</b> vinculados!<br><br><span style="color: var(--text-muted); font-size: 0.82rem;">Ao excluir, essas movimentações serão preservadas e reatribuídas para outra categoria para não afetar seus cálculos e saldo.</span><br><br>Deseja confirmar a exclusão?`;
  }

  const confirmed = await showAppConfirm({
    title: 'Excluir Categoria',
    message: confirmMsg,
    icon: 'trash-2',
    type: 'danger',
    confirmText: 'Confirmar Exclusão'
  });

  if (confirmed) {
    await finance.deleteCategory(catId);
    populateFormDropdowns();
    renderCategoriesView();
    if (currentTab === 'budgets') renderBudgetsView();
    if (currentTab === 'transactions') renderTransactionsView();
    renderDashboard();
  }
};

window.handleDeleteAccount = async function(accId) {
  const acc = finance.state.accounts.find(a => a.id === accId);
  const accName = acc ? acc.name : 'esta conta/cartão';
  const confirmed = await showAppConfirm({
    title: 'Excluir Conta / Cartão',
    message: `Tem certeza que deseja excluir a conta <b>"${accName}"</b>?`,
    icon: 'trash-2',
    type: 'danger',
    confirmText: 'Confirmar Exclusão'
  });

  if (confirmed) {
    await finance.deleteAccount(accId);
    if (selectedAccountId === accId) {
      selectedAccountId = finance.state.accounts.length > 0 ? finance.state.accounts[0].id : null;
    }
    populateFormDropdowns();
    renderAccountsView();
    renderDashboard();
  }
};

window.handleEditAccount = function(accId) {
  const account = finance.state.accounts.find(a => a.id === accId);
  if (!account) return;

  const accModal = document.getElementById('accountModal');
  const isCredit = account.type === 'credit';

  document.getElementById('accEditId').value = account.id;
  if (window.setAccountModalMode) {
    window.setAccountModalMode(isCredit ? 'card' : 'bank');
  }

  document.getElementById('accountModalTitle').textContent = isCredit ? `Editar Cartão: ${account.name}` : `Editar Conta: ${account.name}`;
  document.getElementById('btnSubmitAccount').textContent = 'Salvar Alterações';

  const bId = account.bankId || 'other';
  const accBankSelect = document.getElementById('accBank');
  const accColorInput = document.getElementById('accColor');
  const accBankPreview = document.getElementById('accBankBadgePreview');

  if (accBankSelect) accBankSelect.value = bId;
  const activeColor = account.color || (BRAZILIAN_BANKS[bId] ? BRAZILIAN_BANKS[bId].defaultColor : '#3b82f6');
  if (accColorInput) accColorInput.value = activeColor;
  if (accBankPreview) {
    accBankPreview.innerHTML = getBankBadgeHtml(bId, 44, activeColor);
  }

  document.getElementById('accName').value = account.name || '';
  if (isCredit) {
    if (document.getElementById('accCardEntityType')) {
      document.getElementById('accCardEntityType').value = account.entityType || 'pf';
    }
    if (document.getElementById('accCardBrand')) {
      document.getElementById('accCardBrand').value = account.cardBrand || 'mastercard';
    }
    if (document.getElementById('accLimit')) {
      document.getElementById('accLimit').value = formatCurrencyInput(account.limit !== undefined ? account.limit : 0);
    }
    if (document.getElementById('accClosingDay')) {
      document.getElementById('accClosingDay').value = account.closingDay || 25;
    }
    if (document.getElementById('accDueDay')) {
      document.getElementById('accDueDay').value = account.dueDay || 5;
    }
    if (document.getElementById('accReminderDays')) {
      document.getElementById('accReminderDays').value = account.reminderDays !== undefined ? account.reminderDays : 3;
    }
  } else {
    if (document.getElementById('accType')) {
      document.getElementById('accType').value = account.type || 'checking';
    }
    if (document.getElementById('accEntityType')) {
      document.getElementById('accEntityType').value = account.entityType || 'pf';
    }
    if (document.getElementById('accBalance')) {
      document.getElementById('accBalance').value = formatCurrencyInput(account.balance !== undefined ? account.balance : 0);
    }
  }

  const isDefaultCheck = document.getElementById('accIsDefault');
  if (isDefaultCheck) {
    isDefaultCheck.checked = !!account.isDefault;
  }

  accModal.classList.add('open');
  if (window.lucide) lucide.createIcons();
};

// Abrir modal de pagamento de fatura do cartão
window.handleOpenPayInvoice = function(cardId, targetInvoiceKey = null) {
  const card = finance.state.accounts.find(a => a.id === cardId);
  if (!card) return;

  const payModal = document.getElementById('payInvoiceModal');
  const cardNameInput = document.getElementById('payInvoiceCardName');
  const cardIdInput = document.getElementById('payInvoiceCardId');
  const invKeyInput = document.getElementById('payInvoiceKey');
  const amountInput = document.getElementById('payInvoiceAmount');
  const dateInput = document.getElementById('payInvoiceDate');
  const sourceSelect = document.getElementById('payInvoiceSourceAccount');
  const modalSub = document.getElementById('payInvoiceModalSub');

  if (!payModal) return;

  const invData = finance.getCardInvoices(card.id);
  const targetInv = (targetInvoiceKey && invData && invData.invoices) 
    ? invData.invoices.find(i => i.key === targetInvoiceKey) 
    : (invData ? invData.currentInvoice : null);

  const curTotal = targetInv ? targetInv.total : 0;
  const invoiceAmount = curTotal > 0 ? curTotal : Math.abs(Math.min(0, card.balance || 0));

  cardIdInput.value = card.id;
  if (invKeyInput) invKeyInput.value = targetInv ? targetInv.key : (targetInvoiceKey || '');
  cardNameInput.value = `${card.name}${targetInv ? ` (${targetInv.label})` : ''}`;
  amountInput.value = formatCurrencyInput(invoiceAmount > 0 ? invoiceAmount : 0);
  dateInput.value = localDateStr();

  if (modalSub && targetInv) {
    const closingTxt = targetInv.closingBadgeText ? ` • ${targetInv.closingBadgeText}` : '';
    modalSub.textContent = `Quitar ${targetInv.label} (Vence ${formatDateBR(targetInv.dueDateStr)})${closingTxt}`;
  }

  // Preenche contas elegíveis para débito (apenas contas bancárias / investimentos com saldo líquido, excluindo cartões de crédito)
  const sourceAccounts = finance.state.accounts.filter(a => a.type !== 'credit');
  if (sourceAccounts.length === 0) {
    alert('Nenhuma conta bancária disponível para debitar o pagamento.');
    return;
  }

  sourceSelect.innerHTML = sourceAccounts.map(a => 
    `<option value="${a.id}">${a.name} (Saldo: ${currencyFormatter.format(a.balance)})</option>`
  ).join('');

  payModal.classList.add('open');
};

// Abrir modal para pagar e dar baixa em boleto com renovação automática
window.handleOpenPayBill = function(billId) {
  const bill = finance.state.schedules.find(s => s.id === billId);
  if (!bill) return;

  const payBillModal = document.getElementById('payBillModal');
  const descInput = document.getElementById('payBillDesc');
  const idInput = document.getElementById('payBillScheduleId');
  const amountInput = document.getElementById('payBillAmount');
  const dateInput = document.getElementById('payBillDate');
  const sourceSelect = document.getElementById('payBillSourceAccount');
  const barcodeGroup = document.getElementById('payBillBarcodeGroup');
  const barcodeInput = document.getElementById('payBillBarcode');
  const renewalNote = document.getElementById('payBillRenewalNote');

  if (!payBillModal) return;

  idInput.value = bill.id;
  descInput.value = bill.description;
  amountInput.value = formatCurrencyInput(bill.amount);
  dateInput.value = localDateStr();

  if (bill.barcode) {
    barcodeGroup.style.display = 'block';
    barcodeInput.value = bill.barcode;
  } else {
    barcodeGroup.style.display = 'none';
    barcodeInput.value = '';
  }

  const isIncome = bill.type === 'income';

  const modalTitle = document.getElementById('payBillModalTitle');
  const modalSub = document.getElementById('payBillModalSub');
  const submitBtn = document.querySelector('#payBillForm button[type="submit"]');

  if (modalTitle) modalTitle.textContent = isIncome ? 'Confirmar Recebimento de Salário / Proventos' : 'Pagar Boleto / Conta Fixa';
  if (modalSub) modalSub.textContent = isIncome ? 'Confirmar entrada do valor na conta bancária' : 'Baixar pagamento e renovar automaticamente para o próximo mês';
  if (submitBtn) {
    submitBtn.innerHTML = isIncome 
      ? `<i data-lucide="check-circle-2"></i><span>Confirmar Recebimento na Conta</span>`
      : `<i data-lucide="check-circle-2"></i><span>Confirmar Pagamento & Renovar</span>`;
  }

  if (renewalNote) {
    if (isIncome) {
      renewalNote.textContent = (bill.dayRule === '5th_business_clt' || bill.dayRule === '5th_business')
        ? 'Ao confirmar, o valor será depositado no saldo da conta e a previsão para o 5º dia útil do próximo mês será calculada automaticamente!'
        : 'Ao confirmar, o valor será lançado na sua conta e o agendamento do próximo mês será renovado.';
    } else {
      renewalNote.textContent = bill.recurring === 'monthly'
        ? 'Ao confirmar o pagamento, este boleto será quitado e a cobrança do mês seguinte será gerada automaticamente.'
        : (bill.recurring === 'yearly' ? 'Ao confirmar, será renovado para o próximo ano.' : 'Esta conta não possui recorrência configurada (pagamento único).');
    }
  }

  // Preenche contas elegíveis (destino para receita, origem para despesa)
  const sourceAccounts = finance.state.accounts.filter(a => a.type !== 'credit');
  sourceSelect.innerHTML = sourceAccounts.map(a => 
    `<option value="${a.id}" ${a.id === bill.accountId ? 'selected' : ''}>${a.name} (Saldo: ${currencyFormatter.format(a.balance)})</option>`
  ).join('');

  payBillModal.classList.add('open');
  if (window.lucide) lucide.createIcons();
};

// Abrir modal para cadastrar novo boleto / conta fixa recorrente
window.handleOpenNewBill = function() {
  const schModal = document.getElementById('schModal');
  const schForm = document.getElementById('schForm');
  if (!schModal || !schForm) return;

  schForm.reset();
  document.getElementById('schEditId').value = '';
  document.getElementById('schDesc').placeholder = 'Ex: Internet Fibra, Energia Elétrica, Água, Aluguel';
  document.getElementById('schType').value = 'expense';
  document.getElementById('schAmount').value = '0,00';
  document.getElementById('schDueDate').value = localDateStr();
  document.getElementById('schRecurring').value = 'monthly';
  if (document.getElementById('schBarcode')) document.getElementById('schBarcode').value = '';

  document.querySelector('#schModal h3').textContent = 'Novo Boleto / Conta Recorrente';
  const btnSubmit = document.getElementById('btnSubmitSch');
  if (btnSubmit) btnSubmit.textContent = 'Salvar Conta Recorrente';

  schModal.classList.add('open');
};

// Ações dos botões internos do Extrato da Conta Selecionada
// ==========================================
// MÓDULO DE BOAS-VINDAS & DICAS (ONBOARDING)
// ==========================================
let currentWelcomeSlide = 0;
const totalWelcomeSlides = 5;

window.goToWelcomeSlide = function(index) {
  if (index < 0) index = 0;
  if (index >= totalWelcomeSlides) index = totalWelcomeSlides - 1;
  currentWelcomeSlide = index;

  const slides = document.querySelectorAll('.welcome-slide');
  slides.forEach((slide) => {
    const sIdx = parseInt(slide.getAttribute('data-slide-index'), 10);
    if (sIdx === currentWelcomeSlide) {
      slide.style.display = 'block';
      slide.classList.add('active');
    } else {
      slide.style.display = 'none';
      slide.classList.remove('active');
    }
  });

  const dots = document.querySelectorAll('.welcome-dot');
  dots.forEach((dot) => {
    const dIdx = parseInt(dot.getAttribute('data-index'), 10);
    if (dIdx === currentWelcomeSlide) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });

  const btnPrev = document.getElementById('btnPrevWelcomeSlide');
  const btnNext = document.getElementById('btnNextWelcomeSlide');
  const btnConnect = document.getElementById('btnWelcomeConnectDevice');
  const btnStart = document.getElementById('btnWelcomeStartApp');
  const footer = document.getElementById('welcomeModalFooter');

  if (footer) {
    if (currentWelcomeSlide === totalWelcomeSlides - 1) {
      footer.classList.add('is-last-slide');
    } else {
      footer.classList.remove('is-last-slide');
    }
  }

  if (currentWelcomeSlide === 0) {
    if (btnPrev) btnPrev.style.display = 'none';
    if (btnNext) btnNext.style.display = 'inline-flex';
    if (btnConnect) btnConnect.style.display = 'none';
    if (btnStart) btnStart.style.display = 'none';
  } else if (currentWelcomeSlide === totalWelcomeSlides - 1) {
    if (btnPrev) btnPrev.style.display = 'inline-flex';
    if (btnNext) btnNext.style.display = 'none';
    if (btnConnect) btnConnect.style.display = 'inline-flex';
    if (btnStart) btnStart.style.display = 'inline-flex';
  } else {
    if (btnPrev) btnPrev.style.display = 'inline-flex';
    if (btnNext) btnNext.style.display = 'inline-flex';
    if (btnConnect) btnConnect.style.display = 'none';
    if (btnStart) btnStart.style.display = 'none';
  }

  if (window.lucide) {
    lucide.createIcons();
  }
};

window.nextWelcomeSlide = function() {
  if (currentWelcomeSlide < totalWelcomeSlides - 1) {
    window.goToWelcomeSlide(currentWelcomeSlide + 1);
  }
};

window.prevWelcomeSlide = function() {
  if (currentWelcomeSlide > 0) {
    window.goToWelcomeSlide(currentWelcomeSlide - 1);
  }
};

window.openWelcomeModal = function(force = false) {
  try {
    if (!force && localStorage.getItem('valore_onboarding_completed') === 'true') {
      return;
    }
  } catch (e) {
    console.warn(e);
  }

  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.classList.add('open');
    window.goToWelcomeSlide(0);
    setupWelcomeTouchGestures();
  }
};

window.finishWelcomeOnboarding = function(action = 'dismiss') {
  try {
    localStorage.setItem('valore_onboarding_completed', 'true');
  } catch (e) {
    console.warn('Erro ao salvar flag de onboarding no localStorage:', e);
  }

  const modal = document.getElementById('welcomeModal');
  if (modal) {
    modal.classList.remove('open');
  }

  if (action === 'connect') {
    const btnExport = document.getElementById('btnExportData');
    if (btnExport) {
      btnExport.click();
    }
  }
};

let welcomeTouchGesturesConfigured = false;
function setupWelcomeTouchGestures() {
  if (welcomeTouchGesturesConfigured) return;
  const container = document.getElementById('welcomeCarouselContainer');
  if (!container) return;

  welcomeTouchGesturesConfigured = true;
  modal.addEventListener("click", (e) => { if (e.target === modal) window.finishWelcomeOnboarding("dismiss"); });
  let startX = 0;
  let startY = 0;

  container.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;

      // Se o movimento for predominantemente horizontal e maior que 45px
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
        if (diffX < 0) {
          // Swipe para esquerda -> Avançar
          window.nextWelcomeSlide();
        } else {
          // Swipe para direita -> Voltar
          window.prevWelcomeSlide();
        }
      }
    }
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  const btnAddTxToAcc = document.getElementById('btnAddTxToAccountBtn');
  if (btnAddTxToAcc) {
    btnAddTxToAcc.addEventListener('click', () => {
      if (!selectedAccountId) return;
      const txModal = document.getElementById('txModal');
      document.getElementById('txEditId').value = '';
      document.getElementById('txForm').reset();
      document.getElementById('txDate').value = localDateStr();
      document.getElementById('txAccount').value = selectedAccountId;
      document.getElementById('txModalTitle').textContent = 'Nova Movimentação';
      document.querySelector('#txModal button[type="submit"]').textContent = 'Salvar Transação';
      txModal.classList.add('open');
    });
  }

  const btnEditCurrentAcc = document.getElementById('btnEditCurrentAccountBtn');
  if (btnEditCurrentAcc) {
    btnEditCurrentAcc.addEventListener('click', () => {
      if (selectedAccountId) handleEditAccount(selectedAccountId);
    });
  }

  const btnCloseAccDetails = document.getElementById('btnCloseAccountDetailsBtn');
  if (btnCloseAccDetails) {
    btnCloseAccDetails.addEventListener('click', () => {
      closeAccountDetails();
    });
  }

  // --- MODAIS E CONTROLES DE COFRINHOS ESTILO MERCADO PAGO ---
  const vaultModal = document.getElementById('vaultModal');
  const btnCloseVault = document.getElementById('btnCloseVaultModal');
  const createVaultModal = document.getElementById('createVaultModal');
  const btnCloseCreateVault = document.getElementById('btnCloseCreateVaultModal');
  const btnCancelCreateVault = document.getElementById('btnCancelCreateVault');
  const btnOpenCreateVault = document.getElementById('btnOpenCreateVaultModal');
  const createVaultForm = document.getElementById('createVaultForm');

  const vaultActionPanel = document.getElementById('vaultActionPanel');
  const vaultActionForm = document.getElementById('vaultActionForm');
  const btnCancelVaultAction = document.getElementById('btnCancelVaultAction');
  const btnDismissVaultAction = document.getElementById('btnDismissVaultAction');
  const btnVaultTabDeposit = document.getElementById('btnVaultTabDeposit');
  const btnVaultTabWithdraw = document.getElementById('btnVaultTabWithdraw');
  const vaultSelectedType = document.getElementById('vaultSelectedType');
  const vaultActionAmountLabel = document.getElementById('vaultActionAmountLabel');
  const btnSubmitVaultAction = document.getElementById('btnSubmitVaultAction');

  const closeVault = () => {
    if (vaultModal) vaultModal.classList.remove('open');
    if (vaultActionPanel) vaultActionPanel.style.display = 'none';
  };
  if (btnCloseVault) btnCloseVault.addEventListener('click', closeVault);

  const closeCreateVault = () => {
    if (createVaultModal) createVaultModal.classList.remove('open');
  };
  if (btnCloseCreateVault) btnCloseCreateVault.addEventListener('click', closeCreateVault);
  if (btnCancelCreateVault) btnCancelCreateVault.addEventListener('click', closeCreateVault);

  if (btnOpenCreateVault) {
    btnOpenCreateVault.addEventListener('click', () => {
      if (!currentVaultAccountId) return;
      if (createVaultForm) createVaultForm.reset();
      document.getElementById('newVaultAccountId').value = currentVaultAccountId;
      const originTxEl = document.getElementById('newVaultOriginTxId');
      if (originTxEl) originTxEl.value = '';
      const titleEl = document.getElementById('createVaultModalTitle');
      const subEl = document.getElementById('createVaultModalSub');
      if (titleEl) titleEl.textContent = 'Criar Cofrinho / Reserva';
      if (subEl) subEl.textContent = 'Defina seu objetivo e comece a render 105% do CDI';
      document.getElementById('newVaultTarget').value = '5.000,00';
      document.getElementById('newVaultInitial').value = '0,00';
      createVaultModal.classList.add('open');
      if (window.lucide) lucide.createIcons();
    });
  }

  // Criação de novo Cofrinho
  if (createVaultForm) {
    createVaultForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const originTxId = document.getElementById('newVaultOriginTxId') ? document.getElementById('newVaultOriginTxId').value : '';
      const accountId = document.getElementById('newVaultAccountId').value;
      const name = document.getElementById('newVaultName').value.trim();
      const target = parseCurrencyInput(document.getElementById('newVaultTarget').value);
      const initialDeposit = parseCurrencyInput(document.getElementById('newVaultInitial').value);
      const yieldRate = parseFloat(document.getElementById('newVaultYieldRate').value);
      const icon = document.getElementById('newVaultIcon').value;

      try {
        if (originTxId) {
          await finance.createVaultFromTransaction(originTxId, {
            name,
            target,
            amount: initialDeposit,
            yieldRate,
            icon
          });
        } else {
          await finance.createVault({
            accountId,
            name,
            target,
            initialDeposit,
            yieldRate,
            icon
          });
        }
        closeCreateVault();
        if (accountId) renderVaultHub(accountId);
        renderAccountsView();
        renderDashboard();
        renderTransactionsView();
        if (selectedAccountId) renderSelectedAccountDetails(selectedAccountId);
      } catch (err) {
        alert(err.message || 'Erro ao criar cofrinho.');
      }
    });
  }

  // Ações do painel rápido de Guardar / Resgatar
  const setVaultActionTab = (action) => {
    if (!vaultSelectedType) return;
    vaultSelectedType.value = action;
    if (action === 'deposit') {
      btnVaultTabDeposit.className = 'type-toggle-btn active-expense';
      btnVaultTabWithdraw.className = 'type-toggle-btn';
      vaultActionAmountLabel.textContent = 'Valor a Guardar no Cofrinho (R$)';
      btnSubmitVaultAction.className = 'btn btn-primary';
      btnSubmitVaultAction.innerHTML = `<i data-lucide="piggy-bank"></i><span>Confirmar e Guardar</span>`;
    } else {
      btnVaultTabWithdraw.className = 'type-toggle-btn active-income';
      btnVaultTabDeposit.className = 'type-toggle-btn';
      vaultActionAmountLabel.textContent = 'Valor a Resgatar para Conta Livre (R$)';
      btnSubmitVaultAction.className = 'btn btn-success';
      btnSubmitVaultAction.innerHTML = `<i data-lucide="arrow-up-right"></i><span>Confirmar e Resgatar</span>`;
    }
    if (window.lucide) lucide.createIcons();
  };

  if (btnVaultTabDeposit) btnVaultTabDeposit.addEventListener('click', () => setVaultActionTab('deposit'));
  if (btnVaultTabWithdraw) btnVaultTabWithdraw.addEventListener('click', () => setVaultActionTab('withdraw'));

  const hideVaultActionPanel = () => {
    if (vaultActionPanel) vaultActionPanel.style.display = 'none';
  };
  if (btnCancelVaultAction) btnCancelVaultAction.addEventListener('click', hideVaultActionPanel);
  if (btnDismissVaultAction) btnDismissVaultAction.addEventListener('click', hideVaultActionPanel);

  if (vaultActionForm) {
    vaultActionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const vaultId = document.getElementById('vaultSelectedId').value;
      const action = document.getElementById('vaultSelectedType').value;
      const amount = parseCurrencyInput(document.getElementById('vaultActionAmount').value);

      if (!vaultId || amount <= 0) {
        alert('Por favor, informe um valor válido.');
        return;
      }

      try {
        if (action === 'deposit') {
          await finance.depositToVault(vaultId, amount);
        } else {
          await finance.withdrawFromVault(vaultId, amount);
        }
        hideVaultActionPanel();
        renderVaultHub(currentVaultAccountId);
        renderAccountsView();
        renderDashboard();
      } catch (err) {
        alert(err.message || 'Erro ao movimentar cofrinho.');
      }
    });
  }
});

let currentVaultAccountId = null;

// Renderização do Hub de Cofrinhos estilo Mercado Pago
function renderVaultHub(accountId) {
  const account = finance.state.accounts.find(a => a.id === accountId);
  if (!account) return;
  currentVaultAccountId = accountId;

  const modal = document.getElementById('vaultModal');
  const nameDisplay = document.getElementById('vaultAccountNameDisplay');
  const freeBalEl = document.getElementById('vaultCurrentFreeBalance');
  const vaultBalEl = document.getElementById('vaultCurrentVaultedBalance');
  const yieldSummaryEl = document.getElementById('vaultEstimatedYieldSummary');
  const listContainer = document.getElementById('vaultListContainer');

  nameDisplay.textContent = account.name;
  freeBalEl.textContent = currencyFormatter.format(account.balance || 0);

  const vaults = finance.getAccountVaults(accountId);
  const totalVaulted = vaults.reduce((sum, v) => sum + (v.balance || 0), 0);
  vaultBalEl.textContent = currencyFormatter.format(totalVaulted);

  // Estimativa de rendimento CDI consolidada
  const overallYield = finance.calculateVaultYield(totalVaulted, 105);
  yieldSummaryEl.textContent = `~ ${currencyFormatter.format(overallYield.monthly)} / mês (${overallYield.rateLabel})`;

  if (vaults.length === 0) {
    listContainer.innerHTML = `
      <div class="vault-empty-card">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🐷</div>
        <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">Você ainda não tem nenhum Cofrinho nesta conta</div>
        <p style="font-size: 0.8rem; margin: 0.35rem 0 1rem; color: var(--text-secondary);">
          Crie caixinhas para metas como Reserva de Emergência, Viagens ou IPVA e faça seu dinheiro render 105% do CDI com resgate diário.
        </p>
        <button type="button" class="btn btn-primary" onclick="document.getElementById('btnOpenCreateVaultModal').click()" style="font-size: 0.8rem;">
          <i data-lucide="plus"></i> Criar Meu Primeiro Cofrinho
        </button>
      </div>
    `;
  } else {
    listContainer.innerHTML = vaults.map(v => {
      const balance = v.balance || 0;
      const target = v.target || 0;
      const pct = target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0;
      const yieldInfo = finance.calculateVaultYield(balance, v.yieldRate || 105);

      const iconMap = {
        'shield-check': 'shield-check',
        'plane': 'plane',
        'car': 'car',
        'home': 'home',
        'gift': 'gift',
        'trending-up': 'trending-up'
      };
      const iconName = iconMap[v.icon] || 'piggy-bank';

      return `
        <div class="vault-item-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: var(--success); display: flex; align-items: center; justify-content: center;">
                <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${v.name}</div>
                <div style="font-size: 0.73rem; color: var(--text-muted);">
                  Meta: <b>${target > 0 ? currencyFormatter.format(target) : 'Livre'}</b> • ${v.yieldRate || 105}% CDI
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">Guardado</span>
              <b style="font-size: 1.15rem; color: var(--success);">${currencyFormatter.format(balance)}</b>
            </div>
          </div>

          <!-- Barra de progresso da meta -->
          ${target > 0 ? `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                <span>Progresso da meta</span>
                <span>${pct}% atingido</span>
              </div>
              <div class="progress-bar-bg" style="height: 6px; background: rgba(255, 255, 255, 0.08);">
                <div class="progress-bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, #10b981, #06b6d4);"></div>
              </div>
            </div>
          ` : ''}

          <!-- Estimativa de rendimento diário e mensal estilo MP -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.74rem; background: rgba(56, 189, 248, 0.08); border-radius: 6px; padding: 0.35rem 0.6rem; color: #38bdf8;">
            <span>📈 Rendimento estimado:</span>
            <b>+ ${currencyFormatter.format(yieldInfo.monthly)} / mês (~ ${currencyFormatter.format(yieldInfo.daily)}/dia útil)</b>
          </div>

          <!-- Botões de Ação estilo MP: Guardar, Resgatar e Excluir -->
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; margin-top: 0.2rem; border-top: 1px dashed var(--border-color); padding-top: 0.55rem;">
            <button onclick="handleDeleteVault('${v.id}')" style="background: none; border: none; cursor: pointer; color: var(--danger); padding: 4px; font-size: 0.75rem;" title="Encerrar Cofrinho">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
            <button onclick="handleOpenVaultAction('${v.id}', 'withdraw')" class="btn btn-outline" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;" ${balance <= 0 ? 'disabled style="opacity: 0.5;"' : ''}>
              <i data-lucide="arrow-up-right" style="width: 13px; height: 13px;"></i> Resgatar
            </button>
            <button onclick="handleOpenVaultAction('${v.id}', 'deposit')" class="btn btn-primary" style="padding: 0.3rem 0.85rem; font-size: 0.75rem; background: var(--success); border-color: var(--success);">
              <i data-lucide="plus" style="width: 13px; height: 13px;"></i> Guardar
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('open');
  if (window.lucide) lucide.createIcons();
}

// Abrir painel de Guardar ou Resgatar em um Cofrinho específico
window.handleOpenVaultAction = function(vaultId, defaultAction = 'deposit') {
  const vault = (finance.state.vaults || []).find(v => v.id === vaultId);
  if (!vault) return;

  const panel = document.getElementById('vaultActionPanel');
  const titleEl = document.getElementById('vaultActionTitle');
  const selectedIdInput = document.getElementById('vaultSelectedId');
  const amountInput = document.getElementById('vaultActionAmount');
  const btnTabDeposit = document.getElementById('btnVaultTabDeposit');
  const btnTabWithdraw = document.getElementById('btnVaultTabWithdraw');

  selectedIdInput.value = vault.id;
  titleEl.textContent = `Movimentar: ${vault.name} (Saldo no Cofre: ${currencyFormatter.format(vault.balance || 0)})`;
  amountInput.value = '0,00';

  if (defaultAction === 'deposit') {
    if (btnTabDeposit) btnTabDeposit.click();
  } else {
    if (btnTabWithdraw) btnTabWithdraw.click();
  }

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth' });
  amountInput.focus();
};

window.handleDeleteVault = async function(vaultId) {
  const vault = (finance.state.vaults || []).find(v => v.id === vaultId);
  if (!vault) return;

  const msg = vault.balance > 0 
    ? `Deseja encerrar o Cofrinho <b>"${vault.name}"</b>?<br><br>O saldo guardado de <b style="color: var(--success);">${currencyFormatter.format(vault.balance)}</b> será estornado imediatamente para o saldo livre da sua conta.`
    : `Tem certeza que deseja excluir o Cofrinho <b>"${vault.name}"</b>?`;

  const confirmed = await showAppConfirm({
    title: vault.balance > 0 ? 'Encerrar Cofrinho' : 'Excluir Cofrinho',
    message: msg,
    icon: 'trash-2',
    type: 'danger',
    confirmText: vault.balance > 0 ? 'Confirmar Encerramento' : 'Confirmar Exclusão'
  });

  if (confirmed) {
    await finance.deleteVault(vaultId);
    renderVaultHub(currentVaultAccountId);
    renderAccountsView();
    renderDashboard();
  }
};

// Abertura do Modal Cofrinho (Redireciona para o Hub estilo Mercado Pago)
window.handleOpenVaultModal = function(accId) {
  renderVaultHub(accId);
};

// Criar Cofrinho isolando o saldo a partir de uma movimentação selecionada
window.handleCreateVaultFromTx = function(txId) {
  const tx = finance.state.transactions.find(t => t.id === txId);
  if (!tx) {
    alert('Transação não encontrada.');
    return;
  }

  if (tx.isVaulted) {
    alert(`O valor desta entrada já foi separado no cofrinho!`);
    return;
  }

  const accId = tx.accountId || tx.toAccountId || selectedAccountId || (finance.state.accounts.find(a => a.type !== 'credit') || {}).id;
  const account = finance.state.accounts.find(a => a.id === accId);
  if (!account) {
    alert('Conta bancária associada não encontrada para vincular o Cofrinho.');
    return;
  }
  if (account.type === 'credit') {
    alert('Cofrinhos não podem ser associados a contas de cartão de crédito.');
    return;
  }

  const createVaultModal = document.getElementById('createVaultModal');
  const createVaultForm = document.getElementById('createVaultForm');
  if (createVaultForm) createVaultForm.reset();

  currentVaultAccountId = account.id;
  document.getElementById('newVaultAccountId').value = account.id;

  const originTxInput = document.getElementById('newVaultOriginTxId');
  if (originTxInput) originTxInput.value = tx.id;

  // Preenche automaticamente com o nome da movimentação e o saldo/valor dela
  document.getElementById('newVaultName').value = tx.description;
  document.getElementById('newVaultInitial').value = formatCurrencyInput(tx.amount);
  document.getElementById('newVaultTarget').value = formatCurrencyInput(tx.amount * 2);

  const titleEl = document.getElementById('createVaultModalTitle');
  const subEl = document.getElementById('createVaultModalSub');
  if (titleEl) titleEl.textContent = `Separar no Cofrinho: ${tx.description}`;
  if (subEl) subEl.textContent = `Isolar ${currencyFormatter.format(tx.amount)} do saldo livre de [${account.name}] e criar caixinha de rendimento`;

  createVaultModal.classList.add('open');
  if (window.lucide) lucide.createIcons();
};

window.handleEditTx = function(txId) {
  const tx = finance.state.transactions.find(t => t.id === txId);
  if (!tx) return;

  const txModal = document.getElementById('txModal');
  const txForm = document.getElementById('txForm');
  txForm.reset();

  document.getElementById('txEditId').value = tx.id;
  
  // Se for compra parcelada, remove o sufixo (ex: " (1/10)") para o usuário editar de forma limpa
  const isInstallment = !!(tx.installmentGroupId || (tx.installmentTotal && tx.installmentTotal > 1));
  let cleanDesc = tx.description || '';
  if (isInstallment) {
    cleanDesc = cleanDesc.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim();
  }
  document.getElementById('txDesc').value = cleanDesc;
  document.getElementById('txAmount').value = formatCurrencyInput(tx.amount);
  document.getElementById('txDate').value = tx.date;
  document.getElementById('txNotes').value = tx.notes || '';

  // Configura recorrência na edição
  const recSelect = document.getElementById('txRecurring');
  if (recSelect) {
    recSelect.value = tx.recurring || 'none';
  }
  const instGroup = document.getElementById('installmentsGroup');
  if (instGroup) {
    instGroup.style.display = 'grid';
  }

  if (tx.type === 'expense') {
    document.getElementById('toggleExpense').click();
    document.getElementById('txCategory').value = tx.categoryId;
    document.getElementById('txAccount').value = tx.accountId;
  } else if (tx.type === 'income') {
    document.getElementById('toggleIncome').click();
    document.getElementById('txCategory').value = tx.categoryId;
    document.getElementById('txAccount').value = tx.accountId;
  } else if (tx.type === 'transfer') {
    document.getElementById('toggleTransfer').click();
    document.getElementById('txFromAccount').value = tx.fromAccountId;
    document.getElementById('txToAccount').value = tx.toAccountId;
  }

  // Preenche Quem Inseriu (Autor da Transação)
  if (window.syncDeviceIdentityUI) window.syncDeviceIdentityUI();
  if (window.selectTxAuthor) {
    const authorInfo = finance.getEntityAuthorInfo(tx);
    window.selectTxAuthor(authorInfo.role);
  }

  // Preenche dados de Despesa do Casal
  const isSharedCheck = document.getElementById('txIsShared');
  const sharedDetails = document.getElementById('txSharedDetailsContainer');
  const paidByInput = document.getElementById('txPaidBy');
  const splitRuleSelect = document.getElementById('txSplitRule');
  const coupleNoteInput = document.getElementById('txCoupleNote');
  const btnP1 = document.getElementById('btnTxPayerP1');
  const btnP2 = document.getElementById('btnTxPayerP2');

  if (isSharedCheck) {
    isSharedCheck.checked = !!tx.isShared;
    if (sharedDetails) sharedDetails.style.display = tx.isShared ? 'block' : 'none';
    if (paidByInput) paidByInput.value = tx.paidBy || 'p1';
    if (btnP1 && btnP2) {
      btnP1.classList.toggle('active', (tx.paidBy || 'p1') === 'p1');
      btnP2.classList.toggle('active', tx.paidBy === 'p2');
    }
    if (splitRuleSelect) splitRuleSelect.value = tx.splitRule || 'default';
    if (coupleNoteInput) coupleNoteInput.value = tx.coupleNote || '';
  }

  if (tx.entityType === 'pj') {
    const r = document.getElementById('txEntityPj');
    if (r) r.checked = true;
  } else {
    const r = document.getElementById('txEntityPf');
    if (r) r.checked = true;
  }

  document.querySelector('#txModal h3').textContent = 'Editar Transação';
  document.querySelector('#txModal button[type="submit"]').textContent = 'Salvar Alterações';
  txModal.classList.add('open');
};

function formatCurrencyInput(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrencyInput(str) {
  if (str === null || str === undefined || str === '') return 0;
  if (typeof str === 'number') return isNaN(str) ? 0 : round2(str);
  
  // Remove prefixos como R$, letras e espaços laterais
  let clean = str.toString().replace(/[^\d,\.-]/g, '').trim();
  if (!clean) return 0;

  // Lógica de desambiguação de formato (BR: 1.250,50 vs US: 1,250.50)
  if (clean.includes(',') && clean.includes('.')) {
    // Se a vírgula vier depois do ponto, assume padrão BR
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const val = parseFloat(clean);
  return isNaN(val) ? 0 : round2(val);
}

// --- CALCULADORA COMPLETA FLUTUANTE COM TECLADO NUMÉRICO E EXPORTAÇÃO XLSX ---
let calcCurrentVal = '0';
let calcPrevVal = '';
let calcOperator = null;
let calcResetOnNext = false;

function setupCalculator() {
  const btnFloating = document.getElementById('btnFloatingCalc');
  const overlay = document.getElementById('calcOverlay');
  const btnClose = document.getElementById('btnCloseCalc');
  const display = document.getElementById('calcDisplay');
  const history = document.getElementById('calcHistory');
  const btnApply = document.getElementById('btnApplyCalcVal');
  const btnApplyText = document.getElementById('btnApplyCalcValText');
  const btnTxOpen = document.getElementById('btnTxOpenCalc');
  const btnTxOpenInstallment = document.getElementById('btnTxOpenCalcInstallment');
  const btnTxOpenTotal = document.getElementById('btnTxOpenCalcTotal');
  let explicitCalcTarget = null;

  if (!btnFloating || !overlay) return;

  // Lista de histórico de cálculos persistida no localStorage
  let calcHistoryItems = JSON.parse(localStorage.getItem('valore_calc_history') || '[]');

  // Detecta se existe algum campo de valor aberto em qualquer modal
  function getActiveModalTargetInput() {
    if (explicitCalcTarget && explicitCalcTarget.input && explicitCalcTarget.input.offsetParent !== null) {
      return explicitCalcTarget;
    }
    const txModal = document.getElementById('txModal');
    if (txModal && txModal.classList.contains('open')) {
      const instVal = parseInt(document.getElementById('txInstallments')?.value || '1', 10);
      if (instVal > 1) {
        if (typeof lastEditedAmountField !== 'undefined' && lastEditedAmountField === 'total') {
          return { input: document.getElementById('txTotalAmount'), label: 'Total da Compra', isCurrency: true };
        }
        return { input: document.getElementById('txInstallmentAmount'), label: 'Parcela', isCurrency: true };
      }
      return { input: document.getElementById('txAmount'), label: 'Transação', isCurrency: true };
    }
    const schModal = document.getElementById('schModal');
    if (schModal && schModal.classList.contains('open')) {
      return { input: document.getElementById('schAmount'), label: 'Agendamento', isCurrency: true };
    }
    const accModal = document.getElementById('accountModal');
    if (accModal && accModal.classList.contains('open')) {
      return { input: document.getElementById('accBalance'), label: 'Conta/Cartão', isCurrency: true };
    }
    const goalModal = document.getElementById('goalModal');
    if (goalModal && goalModal.classList.contains('open')) {
      return { input: document.getElementById('goalTarget'), label: 'Meta', isCurrency: true };
    }
    const assetModal = document.getElementById('assetModal');
    if (assetModal && assetModal.classList.contains('open')) {
      return { input: document.getElementById('assetValue'), label: 'Patrimônio', isCurrency: true };
    }
    const budgetModal = document.getElementById('budgetModal');
    if (budgetModal && budgetModal.classList.contains('open')) {
      return { input: document.getElementById('budgetLimitInput'), label: 'Orçamento', isCurrency: true };
    }
    return null;
  }

  const openCalc = () => {
    overlay.classList.add('open');
    renderCalcHistory();
    const activeTarget = getActiveModalTargetInput();
    if (btnApply && btnApplyText) {
      if (activeTarget && activeTarget.input) {
        btnApply.style.display = 'inline-flex';
        btnApplyText.textContent = `Inserir valor na ${activeTarget.label}`;
      } else {
        btnApply.style.display = 'none';
      }
    }
    if (window.lucide) lucide.createIcons();
  };

  const closeCalc = () => {
    overlay.classList.remove('open');
    const activeTarget = getActiveModalTargetInput();
    if (activeTarget && activeTarget.input) {
      try { activeTarget.input.focus(); } catch (err) {}
    }
    explicitCalcTarget = null;
  };
  window.closeCalculator = closeCalc;

  btnFloating.addEventListener('click', () => {
    explicitCalcTarget = null;
    openCalc();
  });
  if (btnTxOpen) {
    btnTxOpen.addEventListener('click', () => {
      explicitCalcTarget = { input: document.getElementById('txAmount'), label: 'Transação', isCurrency: true };
      openCalc();
    });
  }
  if (btnTxOpenInstallment) {
    btnTxOpenInstallment.addEventListener('click', () => {
      explicitCalcTarget = { input: document.getElementById('txInstallmentAmount'), label: 'Parcela', isCurrency: true };
      openCalc();
    });
  }
  if (btnTxOpenTotal) {
    btnTxOpenTotal.addEventListener('click', () => {
      explicitCalcTarget = { input: document.getElementById('txTotalAmount'), label: 'Total da Compra', isCurrency: true };
      openCalc();
    });
  }
  if (btnClose) btnClose.addEventListener('click', closeCalc);

  if (btnApply) {
    btnApply.addEventListener('click', () => {
      const activeTarget = getActiveModalTargetInput();
      if (activeTarget && activeTarget.input) {
        const numVal = parseFloat(calcCurrentVal);
        if (!isNaN(numVal)) {
          if (activeTarget.isCurrency) {
            activeTarget.input.value = formatCurrencyInput(numVal);
          } else {
            activeTarget.input.value = numVal.toFixed(2);
          }
          activeTarget.input.dispatchEvent(new Event('input', { bubbles: true }));
          activeTarget.input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      closeCalc();
    });
  }

  // Fechar com clique fora
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCalc();
  });

  function updateDisplay() {
    display.textContent = calcCurrentVal.replace('.', ',');
    if (calcOperator && calcPrevVal) {
      const opSymbol = calcOperator === '*' ? '×' : (calcOperator === '/' ? '÷' : calcOperator);
      history.textContent = `${calcPrevVal.replace('.', ',')} ${opSymbol}`;
    } else {
      history.innerHTML = '&nbsp;';
    }
  }

  function handleInputDigit(digit) {
    if (calcCurrentVal === '0' || calcResetOnNext) {
      calcCurrentVal = digit;
      calcResetOnNext = false;
    } else {
      calcCurrentVal += digit;
    }
    updateDisplay();
  }

  function handleInputDecimal() {
    if (calcResetOnNext) {
      calcCurrentVal = '0.';
      calcResetOnNext = false;
    } else if (!calcCurrentVal.includes('.')) {
      calcCurrentVal += '.';
    }
    updateDisplay();
  }

  function handleInputOperator(op) {
    if (calcOperator && !calcResetOnNext) {
      computeCalc();
    }
    calcOperator = op;
    calcPrevVal = calcCurrentVal;
    calcResetOnNext = true;
    updateDisplay();
  }

  function handleInputCalculate() {
    if (calcOperator && calcPrevVal) {
      const expression = `${calcPrevVal.replace('.', ',')} ${calcOperator === '*' ? '×' : (calcOperator === '/' ? '÷' : calcOperator)} ${calcCurrentVal.replace('.', ',')}`;
      computeCalc();
      const result = calcCurrentVal.replace('.', ',');

      // Adiciona ao histórico com nome padrão baseado na hora
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const item = {
        id: 'calc-' + Date.now(),
        title: `Cálculo ${timeStr}`,
        expression: expression,
        result: result,
        timestamp: now.toISOString()
      };

      calcHistoryItems.unshift(item);
      localStorage.setItem('valore_calc_history', JSON.stringify(calcHistoryItems));
      renderCalcHistory();

      calcOperator = null;
      calcPrevVal = '';
      calcResetOnNext = true;
      updateDisplay();
    }
  }

  function handleInputClear() {
    calcCurrentVal = '0';
    calcPrevVal = '';
    calcOperator = null;
    calcResetOnNext = false;
    updateDisplay();
  }

  function handleInputBackspace() {
    if (calcCurrentVal.length > 1) {
      calcCurrentVal = calcCurrentVal.slice(0, -1);
    } else {
      calcCurrentVal = '0';
    }
    updateDisplay();
  }

  function handleInputPercent() {
    const val = parseFloat(calcCurrentVal);
    if (!isNaN(val)) {
      calcCurrentVal = (val / 100).toString();
      updateDisplay();
    }
  }

  function flashButton(selector) {
    const btn = document.querySelector(`.calc-keyboard ${selector}`);
    if (btn) {
      btn.classList.add('calc-key-active');
      setTimeout(() => btn.classList.remove('calc-key-active'), 120);
    }
  }

  // --- SUPORTE COMPLETO AO TECLADO FÍSICO DO PC (NUMPAD & TECLAS PRINCIPAIS) ---
  document.addEventListener('keydown', (e) => {
    // Só atua quando o modal da calculadora estiver visível
    if (!overlay.classList.contains('open')) return;

    // Se estiver digitando no campo de nomear o cálculo, não intercepta teclas numéricas
    if (e.target && (e.target.classList.contains('calc-history-tag-input') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      if (e.key === 'Escape') {
        e.target.blur();
      } else if (e.key === 'Enter') {
        e.target.blur();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeCalc();
      return;
    }

    // Mapeamento direto de Numpad físico (com ou sem NumLock ativo)
    const numpadDigits = {
      'Numpad0': '0', 'Numpad1': '1', 'Numpad2': '2', 'Numpad3': '3', 'Numpad4': '4',
      'Numpad5': '5', 'Numpad6': '6', 'Numpad7': '7', 'Numpad8': '8', 'Numpad9': '9'
    };

    let digit = null;
    if (numpadDigits[e.code]) {
      digit = numpadDigits[e.code];
    } else if (e.key >= '0' && e.key <= '9') {
      digit = e.key;
    }

    if (digit !== null) {
      e.preventDefault();
      handleInputDigit(digit);
      flashButton(`[data-num="${digit}"]`);
      return;
    }

    // Ponto / Vírgula Decimal (incluindo NumpadDecimal)
    if (e.code === 'NumpadDecimal' || e.key === ',' || e.key === '.') {
      e.preventDefault();
      handleInputDecimal();
      flashButton('[data-action="decimal"]');
      return;
    }

    // Operadores matemáticos (Numpad + Teclado Superior)
    if (e.code === 'NumpadAdd' || e.key === '+') {
      e.preventDefault();
      handleInputOperator('+');
      flashButton('[data-op="+"]');
      return;
    }

    if (e.code === 'NumpadSubtract' || e.key === '-') {
      e.preventDefault();
      handleInputOperator('-');
      flashButton('[data-op="-"]');
      return;
    }

    if (e.code === 'NumpadMultiply' || e.key === '*') {
      e.preventDefault();
      handleInputOperator('*');
      flashButton('[data-op="*"]');
      return;
    }

    if (e.code === 'NumpadDivide' || e.key === '/') {
      e.preventDefault();
      handleInputOperator('/');
      flashButton('[data-op="/"]');
      return;
    }

    // Igualdade / Cálculo (NumpadEnter, Enter, '=')
    if (e.code === 'NumpadEnter' || e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      handleInputCalculate();
      flashButton('[data-action="calculate"]');
      return;
    }

    // Backspace (Apagar último dígito)
    if (e.key === 'Backspace') {
      e.preventDefault();
      handleInputBackspace();
      flashButton('[data-action="backspace"]');
      return;
    }

    // Limpar Display (Delete ou letra C)
    if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
      e.preventDefault();
      handleInputClear();
      flashButton('[data-action="clear"]');
      return;
    }

    // Porcentagem
    if (e.key === '%') {
      e.preventDefault();
      handleInputPercent();
      flashButton('[data-action="percent"]');
      return;
    }
  }, true);

  // Eventos de clique nos botões virtuais da calculadora
  document.querySelectorAll('.calc-key').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.num;
      const op = btn.dataset.op;
      const action = btn.dataset.action;

      if (num !== undefined) handleInputDigit(num);
      if (action === 'decimal') handleInputDecimal();
      if (action === 'clear') handleInputClear();
      if (action === 'backspace') handleInputBackspace();
      if (action === 'percent') handleInputPercent();
      if (op) handleInputOperator(op);
      if (action === 'calculate') handleInputCalculate();
    });
  });

  function computeCalc() {
    const prev = parseFloat(calcPrevVal);
    const cur = parseFloat(calcCurrentVal);
    if (isNaN(prev) || isNaN(cur)) return;

    let res = 0;
    if (calcOperator === '+') res = prev + cur;
    if (calcOperator === '-') res = prev - cur;
    if (calcOperator === '*') res = prev * cur;
    if (calcOperator === '/') res = cur !== 0 ? prev / cur : 0;

    calcCurrentVal = (+res.toFixed(6)).toString();
  }

  // Renderizar lista de histórico lateral
  function renderCalcHistory() {
    const listEl = document.getElementById('calcHistoryList');
    if (!listEl) return;

    if (calcHistoryItems.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 2.5rem 0.5rem;">Nenhum cálculo registrado ainda.<br><span style="font-size: 0.74rem; opacity: 0.7;">Faça cálculos e pressione = para registrar aqui.</span></div>`;
      return;
    }

    listEl.innerHTML = calcHistoryItems.map(item => {
      const d = new Date(item.timestamp);
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `
        <div class="calc-history-item" id="item-${item.id}">
          <div class="calc-history-item-top">
            <input type="text" class="calc-history-tag-input" value="${item.title}" onchange="handleRenameCalcItem('${item.id}', this.value)" placeholder="Nomear cálculo..." title="Clique para nomear ou renomear este cálculo">
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <span class="calc-history-time">${timeStr}</span>
              <button onclick="handleDeleteCalcItem('${item.id}')" style="background:none; border:none; cursor:pointer; color:var(--text-muted); padding:2px;" title="Excluir este cálculo">
                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              </button>
            </div>
          </div>
          <div class="calc-history-calc-row">
            <span class="calc-history-expr">${item.expression}</span>
            <span class="calc-history-res" onclick="handleUseCalcResult('${item.result}')" title="Clique para carregar resultado na calculadora">= ${item.result}</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // Renomear item do histórico
  window.handleRenameCalcItem = function(id, newTitle) {
    const item = calcHistoryItems.find(i => i.id === id);
    if (item) {
      item.title = newTitle.trim() || 'Cálculo';
      localStorage.setItem('valore_calc_history', JSON.stringify(calcHistoryItems));
    }
  };

  // Excluir item individual do histórico
  window.handleDeleteCalcItem = function(id) {
    calcHistoryItems = calcHistoryItems.filter(i => i.id !== id);
    localStorage.setItem('valore_calc_history', JSON.stringify(calcHistoryItems));
    renderCalcHistory();
  };

  // Carregar resultado do histórico de volta para o display
  window.handleUseCalcResult = function(resStr) {
    calcCurrentVal = resStr.replace(',', '.');
    calcResetOnNext = true;
    updateDisplay();
  };

  // Limpar histórico completo
  const btnClearHist = document.getElementById('btnClearCalcHistory');
  if (btnClearHist) {
    btnClearHist.addEventListener('click', async () => {
      const confirmed = await showAppConfirm({
        title: 'Limpar Histórico de Cálculos',
        message: 'Tem certeza que deseja apagar todo o histórico registrado da calculadora?',
        icon: 'trash-2',
        type: 'danger',
        confirmText: 'Limpar Histórico'
      });
      if (confirmed) {
        calcHistoryItems = [];
        localStorage.removeItem('valore_calc_history');
        renderCalcHistory();
      }
    });
  }

  // Exportar histórico para Excel (.xlsx) nativo
  const btnExportXLSX = document.getElementById('btnExportCalcXLSX');
  if (btnExportXLSX) {
    btnExportXLSX.addEventListener('click', () => {
      if (calcHistoryItems.length === 0) {
        alert('O histórico está vazio para exportar.');
        return;
      }

      const currentDateStr = localDateStr();
      const filename = `Historico_Calculadora_Valore_${currentDateStr}.xlsx`;

      // Se a biblioteca XLSX (SheetJS) estiver carregada, gera arquivo binário nativo .xlsx
      if (window.XLSX) {
        const rows = [
          ['VALORE - HISTÓRICO DE CÁLCULOS'],
          [`Exportado em: ${new Date().toLocaleString('pt-BR')}`],
          [],
          ['Data/Hora', 'Nome / Descrição', 'Expressão Matemática', 'Resultado Final']
        ];

        calcHistoryItems.forEach(item => {
          const d = new Date(item.timestamp);
          const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          rows.push([dateFormatted, item.title, item.expression, item.result]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
          { wch: 18 }, // Data/Hora
          { wch: 28 }, // Nome / Descrição
          { wch: 26 }, // Expressão
          { wch: 18 }  // Resultado
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Cálculos');
        XLSX.writeFile(wb, filename);
      } else {
        // Fallback: CSV com delimitador brasileiro ';' e BOM UTF-8 que abre direto no Excel
        let csvContent = '\uFEFF';
        csvContent += 'Data/Hora;Nome/Descrição;Expressão Matemática;Resultado Final\r\n';

        calcHistoryItems.forEach(item => {
          const d = new Date(item.timestamp);
          const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          const titleEscaped = `"${item.title.replace(/"/g, '""')}"`;
          const exprEscaped = `"${item.expression.replace(/"/g, '""')}"`;
          const resultEscaped = `"${item.result}"`;
          csvContent += `${dateFormatted};${titleEscaped};${exprEscaped};${resultEscaped}\r\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', url);
        downloadAnchor.setAttribute('download', filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        URL.revokeObjectURL(url);
      }
    });
  }
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// =========================================================================
// --- GERENCIAMENTO DE PROJETOS, VIAGENS & CENTROS DE CUSTO (ETAPA 2) ---
// =========================================================================
let selectedCostCenterId = null;

function renderCostCentersView() {
  const container = document.getElementById('costCentersGridContainer');
  if (!container) return;

  const insightsList = finance.getAllCostCentersInsights();

  if (insightsList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🧳</div>
        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">Nenhum projeto ou viagem cadastrado!</div>
        <p style="font-size: 0.85rem; margin: 0.4rem 0 1.25rem;">
          Crie centros de custo dedicados para acompanhar viagens de moto, reformas, casamento ou compra de equipamentos sem misturar com suas despesas fixas.
        </p>
        <button class="btn btn-primary" onclick="handleOpenNewCostCenter()" style="margin: 0 auto;">
          <i data-lucide="plus"></i> Cadastrar Primeiro Projeto
        </button>
      </div>
    `;
    closeCostCenterDetails();
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = insightsList.map(ins => {
    const cc = ins.costCenter;
    const isSelected = cc.id === selectedCostCenterId;
    const iconName = cc.icon || 'briefcase';

    return `
      <div class="metric-card account-card-interactive ${isSelected ? 'selected-account' : ''}" onclick="handleSelectCostCenter('${cc.id}')" style="cursor: pointer; padding: 1.1rem; border-left: 4px solid ${cc.color || 'var(--primary)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="metric-icon-badge" style="background: rgba(59, 130, 246, 0.12); color: ${cc.color || 'var(--primary)'}; width: 36px; height: 36px;">
              <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--text-main);">${escapeHtml(cc.name)}</h4>
              <span style="font-size: 0.72rem; color: var(--text-muted);">
                ${cc.isolateFromMonthlyBudget ? '🛡️ Isolado do Orçamento Fixo' : '📊 Soma no Mês'}
              </span>
            </div>
          </div>
          <span class="badge" style="background: ${ins.isOverBudget ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${ins.isOverBudget ? 'var(--danger)' : 'var(--success)'}; font-size: 0.72rem; font-weight: 700;">
            ${ins.isOverBudget ? 'Estourou Teto' : 'No Teto'}
          </span>
        </div>

        <div style="margin: 0.5rem 0;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 0.74rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Gasto Acumulado:</span>
            <span class="metric-value" style="font-size: 1.3rem; margin: 0; color: ${ins.isOverBudget ? 'var(--danger)' : 'var(--text-main)'};">
              ${currencyFormatter.format(ins.netCost)}
            </span>
          </div>

          ${ins.budget > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted); margin-top: 0.35rem;">
              <span>Teto: <b>${currencyFormatter.format(ins.budget)}</b></span>
              <span>${ins.budgetUsedPercent}% consumido</span>
            </div>
            <div class="progress-bar-bg" style="height: 6px; margin: 0.3rem 0; background: rgba(255, 255, 255, 0.08); border-radius: 999px; overflow: hidden;">
              <div class="progress-bar-fill" style="width: ${ins.budgetUsedPercent}%; height: 100%; background: ${ins.isOverBudget ? 'var(--danger)' : (ins.budgetUsedPercent >= 75 ? '#f59e0b' : 'var(--primary)')}; border-radius: 999px;"></div>
            </div>
          ` : `
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.35rem;">Sem teto definido</div>
          `}
        </div>

        <div class="metric-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 0.45rem; margin-top: 0.5rem; gap: 0.4rem; flex-wrap: wrap;">
          <button onclick="event.stopPropagation(); handleSelectCostCenter('${cc.id}')" class="btn-open-statement-pill ${isSelected ? 'active-pill' : ''}" title="Ver extrato de lançamentos deste projeto">
            <i data-lucide="file-text" style="width: 12px; height: 12px;"></i>
            <span>${isSelected ? `● Extrato Aberto (${ins.transactions.length})` : `Ver Extrato (${ins.transactions.length}) ➔`}</span>
          </button>
          <div style="display: flex; gap: 0.35rem; align-items: center;" onclick="event.stopPropagation()">
            <button onclick="handleEditCostCenter('${cc.id}')" style="background: none; border: none; cursor: pointer; color: var(--primary); padding: 2px;" title="Editar projeto">
              <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
            </button>
            <button onclick="handleDeleteCostCenter('${cc.id}')" style="background: none; border: none; cursor: pointer; color: var(--danger); padding: 2px;" title="Excluir projeto">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (selectedCostCenterId) {
    renderSelectedCostCenterDetails();
  }

  if (window.lucide) lucide.createIcons();
}

function handleSelectCostCenter(id) {
  selectedCostCenterId = id;
  renderCostCentersView();
  const card = document.getElementById('costCenterDetailsCard');
  if (card) {
    if (isMobileViewport()) {
      card.scrollTop = 0;
    } else {
      triggerDesktopDetailsScrollAndPulse(card);
    }
  }
}

function closeCostCenterDetails() {
  selectedCostCenterId = null;
  const card = document.getElementById('costCenterDetailsCard');
  if (card) {
    card.classList.remove('mobile-sheet-open');
    card.style.display = 'none';
  }
  syncMobileDetailsSheetBackdrop();
  if (isMobileViewport()) {
    document.querySelectorAll('#costCentersGridContainer .account-card-interactive.selected-account')
      .forEach(el => el.classList.remove('selected-account'));
    document.querySelectorAll('#costCentersGridContainer .btn-open-statement-pill.active-pill')
      .forEach(btn => btn.classList.remove('active-pill'));
  }
}

function renderSelectedCostCenterDetails() {
  const card = document.getElementById('costCenterDetailsCard');
  if (!card || !selectedCostCenterId) return;

  const ins = finance.getCostCenterInsights(selectedCostCenterId);
  if (!ins) {
    closeCostCenterDetails();
    return;
  }

  card.style.display = 'block';
  if (isMobileViewport()) {
    card.classList.add('mobile-sheet-open');
  } else {
    card.classList.remove('mobile-sheet-open');
  }
  syncMobileDetailsSheetBackdrop();
  document.getElementById('ccDetailName').textContent = ins.costCenter.name;
  document.getElementById('ccDetailSub').textContent = `Total acumulado: ${currencyFormatter.format(ins.netCost)} • ${ins.transactions.length} lançamento(s)`;

  const tableBody = document.getElementById('costCenterTxTableBody');
  if (tableBody) {
    if (ins.transactions.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma transação lançada neste projeto ainda.</td></tr>`;
    } else {
      tableBody.innerHTML = ins.transactions.map(t => {
        const cat = finance.state.categories.find(c => c.id === t.categoryId);
        const acc = finance.state.accounts.find(a => a.id === t.accountId);
        const isExpense = t.type === 'expense';
        return `
          <tr class="tx-row" style="border-bottom: 1px solid var(--border-color);">
            <td class="tx-cell-desc" style="padding: 0.55rem 0.75rem; font-weight: 600; color: var(--text-main);">${escapeHtml(t.description)}</td>
            <td class="tx-cell-cat" style="padding: 0.55rem 0.75rem; color: var(--text-secondary); font-size: 0.78rem;">
              ${cat ? cat.name : 'Geral'} • ${acc ? acc.name : 'Conta'}
            </td>
            <td class="tx-cell-date" style="padding: 0.55rem 0.75rem; white-space: nowrap; color: var(--text-muted);">${formatDateBR(t.date)}</td>
            <td class="tx-cell-amount" style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; color: ${isExpense ? 'var(--danger)' : 'var(--success)'};">
              ${isExpense ? '-' : '+'}${currencyFormatter.format(t.amount)}
            </td>
            <td class="td-actions tx-cell-actions" style="padding: 0.55rem 0.75rem; text-align: center;">
              <div class="table-actions-container">
                <button onclick="handleEditTransaction('${t.id}')" class="btn-action-icon" style="background: none; border: none; cursor: pointer; color: var(--primary); padding: 2px;" title="Editar"><i data-lucide="edit-3" style="width: 14px; height: 14px;"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (window.lucide) lucide.createIcons();
}

window.handleOpenNewCostCenter = function() {
  document.getElementById('costCenterEditId').value = '';
  document.getElementById('costCenterForm').reset();
  document.getElementById('costCenterModalTitle').textContent = 'Novo Projeto / Viagem';
  document.getElementById('ccStartDateInput').value = localDateStr();
  document.getElementById('ccIsolateCheckbox').checked = true;
  document.getElementById('costCenterModal').classList.add('open');
  if (window.lucide) lucide.createIcons();
};

window.handleEditCostCenter = function(id) {
  const cc = (finance.state.costCenters || []).find(c => c.id === id);
  if (!cc) return;

  document.getElementById('costCenterEditId').value = cc.id;
  document.getElementById('ccNameInput').value = cc.name;
  document.getElementById('ccBudgetInput').value = cc.budget > 0 ? cc.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  document.getElementById('ccIconSelect').value = cc.icon || 'briefcase';
  document.getElementById('ccStartDateInput').value = cc.startDate || '';
  document.getElementById('ccEndDateInput').value = cc.endDate || '';
  document.getElementById('ccIsolateCheckbox').checked = !!cc.isolateFromMonthlyBudget;
  document.getElementById('ccNotesInput').value = cc.notes || '';
  document.getElementById('costCenterModalTitle').textContent = 'Editar Projeto';

  document.getElementById('costCenterModal').classList.add('open');
  if (window.lucide) lucide.createIcons();
};

window.handleDeleteCostCenter = async function(id) {
  const confirmed = await showAppConfirm({
    title: 'Excluir Projeto / Centro de Custo',
    message: 'Tem certeza que deseja excluir este projeto? As transações vinculadas serão mantidas, mas desvinculadas do projeto.',
    icon: 'trash-2',
    type: 'danger'
  });
  if (confirmed) {
    await finance.deleteCostCenter(id);
    closeCostCenterDetails();
    renderCostCentersView();
  }
};

// =========================================================================
// --- GERENCIAMENTO DE RENDA EXTRA & PROJETOS PARALELOS (ETAPA 3) ---
// =========================================================================
let selectedSideHustleId = null;

function renderSideHustlesView() {
  const container = document.getElementById('sideHustlesGridContainer');
  if (!container) return;

  const insightsList = finance.getAllSideHustlesInsights();

  if (insightsList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">⚡</div>
        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">Nenhum projeto de renda extra cadastrado!</div>
        <p style="font-size: 0.85rem; margin: 0.4rem 0 1.25rem;">
          Separe faturamentos, custos e retiradas de pró-labore para freelas, e-commerce ou pequenas atividades sem misturar com sua conta corrente pessoal.
        </p>
        <button class="btn btn-primary" onclick="handleOpenNewSideHustle()" style="margin: 0 auto;">
          <i data-lucide="plus"></i> Cadastrar Primeiro Projeto de Renda Extra
        </button>
      </div>
    `;
    closeSideHustleDetails();
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = insightsList.map(ins => {
    const sh = ins.sideHustle;
    const isSelected = sh.id === selectedSideHustleId;

    return `
      <div class="metric-card account-card-interactive ${isSelected ? 'selected-account' : ''}" onclick="handleSelectSideHustle('${sh.id}')" style="cursor: pointer; padding: 1.1rem; border-left: 4px solid ${sh.color || '#10b981'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="metric-icon-badge" style="background: rgba(16, 185, 129, 0.12); color: ${sh.color || '#10b981'}; width: 36px; height: 36px;">
              <i data-lucide="zap" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--text-main);">${escapeHtml(sh.name)}</h4>
              <span style="font-size: 0.72rem; color: var(--text-muted);">
                Margem: <b>${ins.profitMargin}%</b> • Faturamento: ${currencyFormatter.format(ins.grossRevenue)}
              </span>
            </div>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.72rem; font-weight: 700;">
            Lucro: ${currencyFormatter.format(ins.netProfit)}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.65rem 0; background: var(--bg-surface); padding: 0.55rem; border-radius: 8px;">
          <div>
            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Custos/Insumos:</span>
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--danger);">${currencyFormatter.format(ins.operationalCosts)}</div>
          </div>
          <div>
            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Pró-Labore Retirado:</span>
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--primary);">${currencyFormatter.format(ins.proLaboreWithdrawals)}</div>
          </div>
        </div>

        <div class="metric-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 0.45rem; gap: 0.4rem; flex-wrap: wrap;">
          <button onclick="event.stopPropagation(); handleSelectSideHustle('${sh.id}')" class="btn-open-statement-pill ${isSelected ? 'active-pill' : ''}" title="Ver extrato de lançamentos desta renda extra">
            <i data-lucide="file-text" style="width: 12px; height: 12px;"></i>
            <span>${isSelected ? `● Extrato Aberto (${ins.transactions.length})` : `Ver Extrato (${ins.transactions.length}) ➔`}</span>
          </button>
          <div style="display: flex; gap: 0.35rem; align-items: center;" onclick="event.stopPropagation()">
            <button onclick="handleEditSideHustle('${sh.id}')" style="background: none; border: none; cursor: pointer; color: var(--primary); padding: 2px;" title="Editar negócio">
              <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
            </button>
            <button onclick="handleDeleteSideHustle('${sh.id}')" style="background: none; border: none; cursor: pointer; color: var(--danger); padding: 2px;" title="Excluir negócio">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (selectedSideHustleId) {
    renderSelectedSideHustleDetails();
  }

  if (window.lucide) lucide.createIcons();
}

function handleSelectSideHustle(id) {
  selectedSideHustleId = id;
  renderSideHustlesView();
  const card = document.getElementById('sideHustleDetailsCard');
  if (card) {
    if (isMobileViewport()) {
      card.scrollTop = 0;
    } else {
      triggerDesktopDetailsScrollAndPulse(card);
    }
  }
}

function closeSideHustleDetails() {
  selectedSideHustleId = null;
  const card = document.getElementById('sideHustleDetailsCard');
  if (card) {
    card.classList.remove('mobile-sheet-open');
    card.style.display = 'none';
  }
  syncMobileDetailsSheetBackdrop();
  if (isMobileViewport()) {
    document.querySelectorAll('#sideHustlesGridContainer .account-card-interactive.selected-account')
      .forEach(el => el.classList.remove('selected-account'));
    document.querySelectorAll('#sideHustlesGridContainer .btn-open-statement-pill.active-pill')
      .forEach(btn => btn.classList.remove('active-pill'));
  }
}

function renderSelectedSideHustleDetails() {
  const card = document.getElementById('sideHustleDetailsCard');
  if (!card || !selectedSideHustleId) return;

  const ins = finance.getSideHustleInsights(selectedSideHustleId);
  if (!ins) {
    closeSideHustleDetails();
    return;
  }

  card.style.display = 'block';
  if (isMobileViewport()) {
    card.classList.add('mobile-sheet-open');
  } else {
    card.classList.remove('mobile-sheet-open');
  }
  syncMobileDetailsSheetBackdrop();
  document.getElementById('shDetailName').textContent = ins.sideHustle.name;
  document.getElementById('shDetailSub').textContent = `Faturamento: ${currencyFormatter.format(ins.grossRevenue)} | Custos: ${currencyFormatter.format(ins.operationalCosts)} | Lucro Líquido: ${currencyFormatter.format(ins.netProfit)}`;

  const tableBody = document.getElementById('sideHustleTxTableBody');
  if (tableBody) {
    if (ins.transactions.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma receita ou custo lançado neste projeto ainda.</td></tr>`;
    } else {
      tableBody.innerHTML = ins.transactions.map(t => {
        const isIncome = t.type === 'income';
        const isProLabore = t.isProLabore || (t.description && t.description.toLowerCase().includes('pró-labore'));
        const typeBadge = isIncome 
          ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.72rem;">Receita Bruta</span>'
          : (isProLabore 
              ? '<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: var(--primary); font-size: 0.72rem;">Pró-Labore</span>'
              : '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); font-size: 0.72rem;">Custo / Insumo</span>');

        return `
          <tr class="tx-row" style="border-bottom: 1px solid var(--border-color);">
            <td class="tx-cell-desc" style="padding: 0.55rem 0.75rem; font-weight: 600; color: var(--text-main);">${escapeHtml(t.description)}</td>
            <td class="tx-cell-cat" style="padding: 0.55rem 0.75rem;">${typeBadge}</td>
            <td class="tx-cell-date" style="padding: 0.55rem 0.75rem; white-space: nowrap; color: var(--text-muted);">${formatDateBR(t.date)}</td>
            <td class="tx-cell-amount" style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 700; color: ${isIncome ? 'var(--success)' : 'var(--danger)'};">
              ${isIncome ? '+' : '-'}${currencyFormatter.format(t.amount)}
            </td>
            <td class="td-actions tx-cell-actions" style="padding: 0.55rem 0.75rem; text-align: center;">
              <div class="table-actions-container">
                <button onclick="handleEditTransaction('${t.id}')" class="btn-action-icon" style="background: none; border: none; cursor: pointer; color: var(--primary); padding: 2px;" title="Editar"><i data-lucide="edit-3" style="width: 14px; height: 14px;"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (window.lucide) lucide.createIcons();
}

window.handleOpenNewSideHustle = function() {
  document.getElementById('sideHustleEditId').value = '';
  document.getElementById('sideHustleForm').reset();
  document.getElementById('sideHustleModalTitle').textContent = 'Novo Projeto de Renda Extra';

  const accSelect = document.getElementById('shAccountSelect');
  if (accSelect) {
    accSelect.innerHTML = '<option value="">Nenhuma (Utiliza contas normais)</option>' +
      finance.state.accounts.map(a => `<option value="${a.id}">${a.name} (${a.type === 'credit' ? 'Cartão' : 'Conta'})</option>`).join('');
  }

  document.getElementById('sideHustleModal').classList.add('open');
  if (window.lucide) lucide.createIcons();
};

window.handleEditSideHustle = function(id) {
  const sh = (finance.state.sideHustles || []).find(s => s.id === id);
  if (!sh) return;

  document.getElementById('sideHustleEditId').value = sh.id;
  document.getElementById('shNameInput').value = sh.name;
  document.getElementById('shCategorySelect').value = sh.category || 'freelance';
  document.getElementById('shMonthlyTargetInput').value = sh.monthlyTarget > 0 ? sh.monthlyTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';

  const accSelect = document.getElementById('shAccountSelect');
  if (accSelect) {
    accSelect.innerHTML = '<option value="">Nenhuma (Utiliza contas normais)</option>' +
      finance.state.accounts.map(a => `<option value="${a.id}" ${a.id === sh.linkedAccountId ? 'selected' : ''}>${a.name}</option>`).join('');
  }

  document.getElementById('shNotesInput').value = sh.notes || '';
  document.getElementById('sideHustleModalTitle').textContent = 'Editar Projeto de Renda Extra';

  document.getElementById('sideHustleModal').classList.add('open');
  if (window.lucide) lucide.createIcons();
};

window.handleDeleteSideHustle = async function(id) {
  const confirmed = await showAppConfirm({
    title: 'Excluir Projeto de Renda Extra',
    message: 'Tem certeza que deseja excluir este projeto? Os lançamentos continuarão no seu histórico, mas desvinculados do projeto.',
    icon: 'trash-2',
    type: 'danger'
  });
  if (confirmed) {
    await finance.deleteSideHustle(id);
    closeSideHustleDetails();
    renderSideHustlesView();
  }
};

// Configura listeners para os formulários de Projetos e Renda Extra
function setupCostCentersAndSideHustlesModals() {
  // Modal Centros de Custo
  const btnOpenCc = document.getElementById('btnOpenNewCostCenterModal');
  const btnCloseCc = document.getElementById('btnCostCenterModalClose');
  const btnCancelCc = document.getElementById('btnCancelCostCenter');
  const ccModal = document.getElementById('costCenterModal');
  const ccForm = document.getElementById('costCenterForm');
  const btnCloseCcDetails = document.getElementById('btnCloseCostCenterDetailsBtn');
  const btnAddTxToCc = document.getElementById('btnAddTxToCostCenterBtn');
  const btnEditCurrentCc = document.getElementById('btnEditCurrentCostCenterBtn');

  if (btnOpenCc) btnOpenCc.addEventListener('click', window.handleOpenNewCostCenter);
  if (btnCloseCc) btnCloseCc.addEventListener('click', () => ccModal.classList.remove('open'));
  if (btnCancelCc) btnCancelCc.addEventListener('click', () => ccModal.classList.remove('open'));
  if (btnCloseCcDetails) btnCloseCcDetails.addEventListener('click', closeCostCenterDetails);
  if (btnEditCurrentCc) btnEditCurrentCc.addEventListener('click', () => {
    if (selectedCostCenterId) window.handleEditCostCenter(selectedCostCenterId);
  });
  if (btnAddTxToCc) btnAddTxToCc.addEventListener('click', () => {
    const btnOpenTx = document.getElementById('btnOpenNewTxModal');
    if (btnOpenTx) {
      btnOpenTx.click();
      setTimeout(() => {
        const ccSelect = document.getElementById('txCostCenterSelect');
        if (ccSelect && selectedCostCenterId) ccSelect.value = selectedCostCenterId;
      }, 50);
    }
  });

  if (ccForm) {
    ccForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('costCenterEditId').value;
      const budgetVal = parseCurrencyInput(document.getElementById('ccBudgetInput').value || '0');

      const data = {
        name: document.getElementById('ccNameInput').value,
        budget: isNaN(budgetVal) ? 0 : budgetVal,
        icon: document.getElementById('ccIconSelect').value,
        startDate: document.getElementById('ccStartDateInput').value,
        endDate: document.getElementById('ccEndDateInput').value,
        isolateFromMonthlyBudget: document.getElementById('ccIsolateCheckbox').checked,
        notes: document.getElementById('ccNotesInput').value
      };

      if (editId) {
        await finance.updateCostCenter(editId, data);
      } else {
        await finance.addCostCenter(data);
      }

      ccModal.classList.remove('open');
      renderCostCentersView();
      renderDashboard();
    });
  }

  // Modal Side Hustles / Renda Extra
  const btnOpenSh = document.getElementById('btnOpenNewSideHustleModal');
  const btnCloseSh = document.getElementById('btnSideHustleModalClose');
  const btnCancelSh = document.getElementById('btnCancelSideHustle');
  const shModal = document.getElementById('sideHustleModal');
  const shForm = document.getElementById('sideHustleForm');
  const btnCloseShDetails = document.getElementById('btnCloseSideHustleDetailsBtn');
  const btnAddTxToSh = document.getElementById('btnAddTxToSideHustleBtn');
  const btnEditCurrentSh = document.getElementById('btnEditCurrentSideHustleBtn');

  if (btnOpenSh) btnOpenSh.addEventListener('click', window.handleOpenNewSideHustle);
  if (btnCloseSh) btnCloseSh.addEventListener('click', () => shModal.classList.remove('open'));
  if (btnCancelSh) btnCancelSh.addEventListener('click', () => shModal.classList.remove('open'));
  if (btnCloseShDetails) btnCloseShDetails.addEventListener('click', closeSideHustleDetails);
  if (btnEditCurrentSh) btnEditCurrentSh.addEventListener('click', () => {
    if (selectedSideHustleId) window.handleEditSideHustle(selectedSideHustleId);
  });
  if (btnAddTxToSh) btnAddTxToSh.addEventListener('click', () => {
    const btnOpenTx = document.getElementById('btnOpenNewTxModal');
    if (btnOpenTx) {
      btnOpenTx.click();
      setTimeout(() => {
        const shSelect = document.getElementById('txSideHustleSelect');
        if (shSelect && selectedSideHustleId) shSelect.value = selectedSideHustleId;
      }, 50);
    }
  });

  if (shForm) {
    shForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('sideHustleEditId').value;
      const targetVal = parseCurrencyInput(document.getElementById('shMonthlyTargetInput').value || '0');

      const data = {
        name: document.getElementById('shNameInput').value,
        category: document.getElementById('shCategorySelect').value,
        monthlyTarget: isNaN(targetVal) ? 0 : targetVal,
        linkedAccountId: document.getElementById('shAccountSelect').value || null,
        notes: document.getElementById('shNotesInput').value
      };

      if (editId) {
        await finance.updateSideHustle(editId, data);
      } else {
        await finance.addSideHustle(data);
      }

      shModal.classList.remove('open');
      renderSideHustlesView();
    });
  }

  // Modal: Raio-X Detalhado de Métricas (Drill-down)
  const btnCloseMetric = document.getElementById('btnMetricDetailClose');
  const metricModal = document.getElementById('metricDetailModal');
  if (btnCloseMetric) btnCloseMetric.addEventListener('click', closeMetricDetail);
  if (metricModal) {
    metricModal.addEventListener('click', (e) => {
      if (e.target === metricModal) closeMetricDetail();
    });
  }
}

// =============================================================================
// MÓDULO DE RAIO-X / DRILL-DOWN DAS MÉTRICAS DO DASHBOARD (Valore Intelligence)
// =============================================================================

let currentMetricDetailType = 'income';
let currentMetricDetailTab = 'summary'; // 'summary' | 'list'
let currentMetricDetailData = null;

function openMetricDetail(metricType) {
  const m = currentDashboardPeriod.month;
  const y = currentDashboardPeriod.year;
  const entity = currentEntityFilter || 'all';

  currentMetricDetailType = metricType;
  currentMetricDetailTab = 'summary';

  const data = finance.getMetricBreakdown(metricType, m, y, entity);
  currentMetricDetailData = data;

  const modal = document.getElementById('metricDetailModal');
  if (!modal) return;

  const btnSummary = document.getElementById('btnMetricTabSummary');
  const btnList = document.getElementById('btnMetricTabList');
  if (btnSummary) btnSummary.classList.add('active');
  if (btnList) btnList.classList.remove('active');

  const monthName = monthNamesLong[m - 1] || 'Mês Atual';
  const entityLabel = entity === 'pf' ? ' • Pessoa Física (PF)' : entity === 'pj' ? ' • Pessoa Jurídica (PJ)' : ' • Consolidado';
  const periodBadge = document.getElementById('metricDetailPeriodBadge');
  if (periodBadge) periodBadge.textContent = `${monthName}/${y}${entityLabel}`;

  renderMetricDetailModalContent();

  modal.classList.add('open');
  if (window.lucide) lucide.createIcons();
}
window.openMetricDetail = openMetricDetail;

function closeMetricDetail() {
  const modal = document.getElementById('metricDetailModal');
  if (modal) modal.classList.remove('open');
}
window.closeMetricDetail = closeMetricDetail;

function switchMetricDetailTab(tab) {
  currentMetricDetailTab = tab;
  const btnSummary = document.getElementById('btnMetricTabSummary');
  const btnList = document.getElementById('btnMetricTabList');
  if (btnSummary) btnSummary.classList.toggle('active', tab === 'summary');
  if (btnList) btnList.classList.toggle('active', tab === 'list');
  renderMetricDetailModalContent();
  if (window.lucide) lucide.createIcons();
}
window.switchMetricDetailTab = switchMetricDetailTab;

function renderMetricDetailModalContent() {
  const data = currentMetricDetailData;
  if (!data) return;

  const iconBadge = document.getElementById('metricDetailIconBadge');
  const icon = document.getElementById('metricDetailIcon');
  const title = document.getElementById('metricDetailTitle');
  const subtitle = document.getElementById('metricDetailSubtitle');
  const hero = document.getElementById('metricDetailHero');
  const body = document.getElementById('metricDetailBody');
  const footer = document.getElementById('metricDetailFooter');
  const tabListLabel = document.getElementById('metricDetailTabListLabel');

  if (data.type === 'income') {
    if (iconBadge) {
      iconBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      iconBadge.style.color = 'var(--success)';
    }
    if (icon) icon.setAttribute('data-lucide', 'arrow-down-left');
    if (title) title.textContent = 'Raio-X de Receitas do Mês';
    if (subtitle) subtitle.textContent = 'Origem das entradas, categorias e destino bancário';
    if (tabListLabel) tabListLabel.textContent = `Lançamentos (${data.transactions.length})`;

    let compBadge = '';
    if (data.comparison && data.comparison.diffPercent !== null) {
      const isUp = data.comparison.diff >= 0;
      const compClass = isUp ? 'badge-comparison-positive' : 'badge-comparison-negative';
      const arrowIcon = isUp ? 'trending-up' : 'trending-down';
      const sign = isUp ? '+' : '';
      compBadge = `
        <div class="${compClass}">
          <i data-lucide="${arrowIcon}" style="width: 14px; height: 14px;"></i>
          <span>${sign}${data.comparison.diffPercent}% em relação ao mês anterior</span>
        </div>
      `;
    }

    if (hero) {
      hero.innerHTML = `
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700; display: block;">Total Recebido no Período</span>
          <div style="font-size: 1.85rem; font-weight: 800; color: var(--success); margin: 0.2rem 0;">
            ${currencyFormatter.format(data.total)}
          </div>
          <span style="font-size: 0.78rem; color: var(--text-muted);">${data.count} entrada(s) contabilizada(s)</span>
        </div>
        <div>${compBadge}</div>
      `;
    }

    if (currentMetricDetailTab === 'summary') {
      let categoriesHtml = '';
      if (data.categories.length === 0) {
        categoriesHtml = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1.5rem 0;">Nenhuma receita registrada neste mês.</p>`;
      } else {
        categoriesHtml = data.categories.map(c => `
          <div class="breakdown-row">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${c.color}; display: inline-block;"></span>
                <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main);">${escapeHtml(c.name)}</span>
                <span style="font-size: 0.72rem; color: var(--text-muted);">(${c.count} ${c.count === 1 ? 'entrada' : 'entradas'})</span>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 0.92rem; font-weight: 800; color: var(--text-main);">${currencyFormatter.format(c.total)}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.35rem; font-weight: 700;">${c.percent}%</span>
              </div>
            </div>
            <div class="breakdown-bar-bg">
              <div class="breakdown-bar-fill" style="width: ${c.percent}%; background: ${c.color};"></div>
            </div>
          </div>
        `).join('');
      }

      let accountsHtml = data.accounts.map(a => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="landmark" style="width: 16px; height: 16px; color: ${a.color};"></i>
            <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-main);">${escapeHtml(a.name)}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${currencyFormatter.format(a.total)}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 0.25rem;">(${a.percent}%)</span>
          </div>
        </div>
      `).join('');

      if (body) {
        body.innerHTML = `
          <div>
            <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="tag" style="width: 15px; height: 15px; color: var(--primary);"></i>
              De onde veio o dinheiro (Por Categoria)
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.45rem;">
              ${categoriesHtml}
            </div>
          </div>

          <div style="margin-top: 0.5rem;">
            <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="credit-card" style="width: 15px; height: 15px; color: var(--primary);"></i>
              Onde o dinheiro entrou (Destino Bancário)
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem;">
              ${accountsHtml || '<p style="color: var(--text-muted); font-size: 0.82rem;">Nenhuma conta listada.</p>'}
            </div>
          </div>
        `;
      }
    } else {
      let listHtml = '';
      if (data.transactions.length === 0) {
        listHtml = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 2rem 0;">Nenhuma receita encontrada para o período.</p>`;
      } else {
        listHtml = data.transactions.map(t => {
          const dateFmt = formatDateBR(t.date);
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; flex-wrap: wrap; padding: 0.65rem 0.85rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 180px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); color: var(--success); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <i data-lucide="arrow-down-left" style="width: 16px; height: 16px;"></i>
                </div>
                <div style="min-width: 0; flex: 1;">
                  <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); display: block; word-break: break-word;">${escapeHtml(t.description)}</span>
                  <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; font-size: 0.73rem; color: var(--text-muted); margin-top: 0.15rem;">
                    <span>📅 ${dateFmt}</span>
                    <span>•</span>
                    <span style="color: ${t.categoryColor}; font-weight: 600;">${escapeHtml(t.categoryName)}</span>
                    <span>•</span>
                    <span>🏦 ${escapeHtml(t.accountName)}</span>
                  </div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.55rem; flex-shrink: 0; margin-left: auto;">
                <div style="font-size: 0.95rem; font-weight: 800; color: var(--success); text-align: right; white-space: nowrap;">
                  + ${currencyFormatter.format(t.amount)}
                </div>
                <button type="button" class="btn-action-icon" onclick="window.closeMetricDetail(); handleEditTransaction('${t.id}');" style="padding: 0.35rem; border-radius: 6px; color: var(--text-muted); cursor: pointer; border: 1px solid var(--border-color); background: var(--bg-secondary);" title="Editar transação e alterar categoria">
                  <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      if (body) {
        body.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${listHtml}
          </div>
        `;
      }
    }

    if (footer) {
      footer.innerHTML = `
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Período: <strong>${monthNamesLong[data.targetMonth - 1]} / ${data.targetYear}</strong>
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <button type="button" class="btn btn-outline" onclick="window.navigateAndFilterTransactions('income')" style="font-size: 0.82rem;">
            <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
            <span>Ver na Tabela Completa</span>
          </button>
          <button type="button" class="btn btn-primary" onclick="window.openNewTransactionFromModal('income')" style="font-size: 0.82rem; background: var(--success); border-color: var(--success);">
            <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
            <span>Nova Receita</span>
          </button>
        </div>
      `;
    }
  } else if (data.type === 'expense') {
    if (iconBadge) {
      iconBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      iconBadge.style.color = 'var(--danger)';
    }
    if (icon) icon.setAttribute('data-lucide', 'arrow-up-right');
    if (title) title.textContent = 'Raio-X de Despesas do Mês';
    if (subtitle) subtitle.textContent = 'Auditoria completa de gastos, categorias e comprometimento';
    if (tabListLabel) tabListLabel.textContent = `Maiores Gastos (${data.transactions.length})`;

    let compBadge = '';
    if (data.comparison && data.comparison.diffPercent !== null) {
      const isUp = data.comparison.diff > 0;
      const compClass = isUp ? 'badge-comparison-negative' : 'badge-comparison-positive';
      const arrowIcon = isUp ? 'trending-up' : 'trending-down';
      const sign = isUp ? '+' : '';
      compBadge = `
        <div class="${compClass}">
          <i data-lucide="${arrowIcon}" style="width: 14px; height: 14px;"></i>
          <span>${sign}${data.comparison.diffPercent}% em relação ao mês anterior</span>
        </div>
      `;
    }

    if (hero) {
      hero.innerHTML = `
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700; display: block;">Total de Despesas no Período</span>
          <div style="font-size: 1.85rem; font-weight: 800; color: var(--danger); margin: 0.2rem 0;">
            ${currencyFormatter.format(data.total)}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <span>✅ <strong>${currencyFormatter.format(data.paidTotal)}</strong> pagas</span>
            <span>•</span>
            <span style="color: #f59e0b;">⏳ <strong>${currencyFormatter.format(data.pendingTotal)}</strong> a vencer (${data.pendingCount} boletos)</span>
          </div>
        </div>
        <div>${compBadge}</div>
      `;
    }

    if (currentMetricDetailTab === 'summary') {
      let categoriesHtml = data.categories.map(c => `
        <div class="breakdown-row">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${c.color}; display: inline-block;"></span>
              <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main);">${escapeHtml(c.name)}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">(${c.count} ${c.count === 1 ? 'gasto' : 'gastos'})</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.92rem; font-weight: 800; color: var(--text-main);">${currencyFormatter.format(c.total)}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.35rem; font-weight: 700;">${c.percent}%</span>
            </div>
          </div>
          <div class="breakdown-bar-bg">
            <div class="breakdown-bar-fill" style="width: ${c.percent}%; background: ${c.color};"></div>
          </div>
        </div>
      `).join('');

      let accountsHtml = data.accounts.map(a => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="${a.type === 'credit' ? 'credit-card' : 'landmark'}" style="width: 16px; height: 16px; color: ${a.color};"></i>
            <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-main);">${escapeHtml(a.name)}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${currencyFormatter.format(a.total)}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 0.25rem;">(${a.percent}%)</span>
          </div>
        </div>
      `).join('');

      if (body) {
        body.innerHTML = `
          <div>
            <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="pie-chart" style="width: 15px; height: 15px; color: var(--danger);"></i>
              Distribuição por Categoria
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.45rem;">
              ${categoriesHtml || '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhuma despesa registrada.</p>'}
            </div>
          </div>

          <div style="margin-top: 0.5rem;">
            <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="wallet" style="width: 15px; height: 15px; color: var(--primary);"></i>
              Método de Pagamento Utilizado
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem;">
              ${accountsHtml}
            </div>
          </div>
        `;
      }
    } else {
      let listHtml = data.transactions.map((t, idx) => {
        const dateFmt = formatDateBR(t.date);
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; flex-wrap: wrap; padding: 0.65rem 0.85rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 180px;">
              <span style="width: 24px; height: 24px; border-radius: 6px; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); flex-shrink: 0;">#${idx + 1}</span>
              <div style="min-width: 0; flex: 1;">
                <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); display: block; word-break: break-word;">${escapeHtml(t.description)}</span>
                <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; font-size: 0.73rem; color: var(--text-muted); margin-top: 0.15rem;">
                  <span>📅 ${dateFmt}</span>
                  <span>•</span>
                  <span style="color: ${t.categoryColor}; font-weight: 600;">${escapeHtml(t.categoryName)}</span>
                  <span>•</span>
                  <span>${escapeHtml(t.accountName)}</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.55rem; flex-shrink: 0; margin-left: auto;">
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--danger); text-align: right; white-space: nowrap;">
                - ${currencyFormatter.format(t.amount)}
              </div>
              <button type="button" class="btn btn-icon btn-ghost" onclick="window.closeXRayModal(); window.handleEditTransaction('${t.id}')" title="Editar lançamento e categoria" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; color: var(--text-muted); border: 1px solid var(--border-color);">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      if (body) {
        body.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${listHtml || '<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 2rem 0;">Nenhuma despesa encontrada.</p>'}
          </div>
        `;
      }
    }

    if (footer) {
      footer.innerHTML = `
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Período: <strong>${monthNamesLong[data.targetMonth - 1]} / ${data.targetYear}</strong>
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <button type="button" class="btn btn-outline" onclick="window.navigateAndFilterTransactions('expense')" style="font-size: 0.82rem;">
            <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
            <span>Ver Todas na Tabela</span>
          </button>
          <button type="button" class="btn btn-primary" onclick="window.openNewTransactionFromModal('expense')" style="font-size: 0.82rem; background: var(--danger); border-color: var(--danger);">
            <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
            <span>Nova Despesa</span>
          </button>
        </div>
      `;
    }
  } else if (data.type === 'networth') {
    if (iconBadge) {
      iconBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      iconBadge.style.color = 'var(--success)';
    }
    if (icon) icon.setAttribute('data-lucide', 'compass');
    if (title) title.textContent = 'Balanço Patrimonial Detalhado';
    if (subtitle) subtitle.textContent = 'Composição precisa de Ativos, Bens Materiais e Dívidas';
    if (tabListLabel) tabListLabel.textContent = 'Bens & Dívidas';

    if (hero) {
      hero.innerHTML = `
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700; display: block;">Patrimônio Líquido Consolidado</span>
          <div style="font-size: 1.85rem; font-weight: 800; color: var(--success); margin: 0.2rem 0;">
            ${currencyFormatter.format(data.netWorth)}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <span>📈 Ativos Brutos: <strong>${currencyFormatter.format(data.totalGrossAssets)}</strong></span>
            <span>•</span>
            <span style="color: var(--danger);">📉 Passivos/Dívidas: <strong>${currencyFormatter.format(data.totalDebts)}</strong></span>
          </div>
        </div>
        <div>
          <button type="button" class="btn btn-outline" onclick="window.closeMetricDetail(); window.switchTab('freedom');" style="font-size: 0.82rem; color: var(--primary); border-color: rgba(99, 102, 241, 0.4);">
            <i data-lucide="target" style="width: 14px; height: 14px;"></i>
            <span>Ver Meta FIRE ➔</span>
          </button>
        </div>
      `;
    }

    if (currentMetricDetailTab === 'summary') {
      let accountsHtml = data.accounts.map(a => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="landmark" style="width: 16px; height: 16px; color: var(--primary);"></i>
            <div>
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); display: block;">${escapeHtml(a.name)}</span>
              ${a.vaulted > 0 ? `<span style="font-size: 0.7rem; color: var(--success);">🔒 ${currencyFormatter.format(a.vaulted)} em reservas</span>` : ''}
            </div>
          </div>
          <div style="font-size: 0.92rem; font-weight: 800; color: var(--success);">
            ${currencyFormatter.format(a.total)}
          </div>
        </div>
      `).join('');

      let vaultsHtml = data.vaults.map(v => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0.75rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <i data-lucide="shield-check" style="width: 15px; height: 15px; color: var(--success);"></i>
            <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-main);">${escapeHtml(v.name)}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.85rem; font-weight: 800; color: var(--success);">${currencyFormatter.format(v.balance)}</span>
            <span style="font-size: 0.68rem; color: var(--text-muted); display: block;">${v.yieldRate || 100}% CDI</span>
          </div>
        </div>
      `).join('');

      if (body) {
        body.innerHTML = `
          <div>
            <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="wallet" style="width: 15px; height: 15px; color: var(--success);"></i>
              Contas Correntes, Carteiras & Liquidez Imediata (${currencyFormatter.format(data.liquidAssets)})
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.45rem;">
              ${accountsHtml || '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhuma conta cadastrada.</p>'}
            </div>
          </div>

          ${data.vaults.length > 0 ? `
            <div style="margin-top: 0.5rem;">
              <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                <i data-lucide="shield-check" style="width: 15px; height: 15px; color: var(--success);"></i>
                Cofrinhos & Caixinhas com Rendimento CDI
              </h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem;">
                ${vaultsHtml}
              </div>
            </div>
          ` : ''}
        `;
      }
    } else {
      let physicalHtml = data.assets.map(a => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <div>
            <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); display: block;">${escapeHtml(a.name)}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Valor Venal: ${currencyFormatter.format(a.estimatedValue)} • Financiado: ${currencyFormatter.format(a.financedValue)}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.92rem; font-weight: 800; color: var(--primary);">${currencyFormatter.format(a.netValue)}</span>
            <span style="font-size: 0.68rem; color: var(--text-muted); display: block;">Patrimônio Líquido</span>
          </div>
        </div>
      `).join('');

      let debtsHtml = data.creditDebts.map(c => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0.75rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px;">
          <div>
            <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); display: block;">${escapeHtml(c.name)}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">Limite Total: ${currencyFormatter.format(c.limit)}</span>
          </div>
          <div style="font-size: 0.9rem; font-weight: 800; color: var(--danger);">
            - ${currencyFormatter.format(c.invoiceBalance)}
          </div>
        </div>
      `).join('');

      if (body) {
        body.innerHTML = `
          <div>
            <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="home" style="width: 15px; height: 15px; color: var(--primary);"></i>
              Bens Físicos (Imóveis, Veículos e Equipamentos)
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.45rem;">
              ${physicalHtml || '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">Nenhum bem físico cadastrado.</p>'}
            </div>
          </div>

          <div style="margin-top: 0.75rem;">
            <h4 style="margin: 0 0 0.65rem; font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="credit-card" style="width: 15px; height: 15px; color: var(--danger);"></i>
              Faturas Abertas de Cartão de Crédito
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.5rem;">
              ${debtsHtml || '<p style="color: var(--text-muted); font-size: 0.85rem;">Nenhuma fatura de cartão aberta.</p>'}
            </div>
          </div>
        `;
      }
    }

    if (footer) {
      footer.innerHTML = `
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Equação: <strong>Ativos Líquidos + Bens Físicos - Dívidas = Patrimônio Líquido</strong>
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <button type="button" class="btn btn-outline" onclick="window.closeMetricDetail(); window.switchTab('assets');" style="font-size: 0.82rem;">
            <i data-lucide="landmark" style="width: 14px; height: 14px;"></i>
            <span>Gerenciar Bens & Financiamentos</span>
          </button>
        </div>
      `;
    }
  } else if (data.type === 'pending') {
    if (iconBadge) {
      iconBadge.style.background = 'rgba(245, 158, 11, 0.15)';
      iconBadge.style.color = 'var(--warning)';
    }
    if (icon) icon.setAttribute('data-lucide', 'calendar-clock');
    if (title) title.textContent = 'Obrigações e Contas a Pagar';
    if (subtitle) subtitle.textContent = 'Controle preventivo de vencimentos para evitar multas e juros';
    if (tabListLabel) tabListLabel.textContent = `Todos (${data.totalPendingCount})`;

    if (hero) {
      hero.innerHTML = `
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700; display: block;">Total Pendente no Período</span>
          <div style="font-size: 1.85rem; font-weight: 800; color: ${data.overdue.length > 0 ? 'var(--danger)' : '#f59e0b'}; margin: 0.2rem 0;">
            ${currencyFormatter.format(data.totalPendingMonth + data.totalOverdue)}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <span style="color: var(--danger);">🔴 ${data.overdue.length} em atraso (${currencyFormatter.format(data.totalOverdue)})</span>
            <span>•</span>
            <span style="color: #f59e0b;">🟡 ${data.dueToday.length} vencendo hoje</span>
            <span>•</span>
            <span>🔵 ${data.upcomingThisMonth.length} a vencer este mês</span>
          </div>
        </div>
        <div>
          <button type="button" class="btn btn-outline" onclick="window.closeMetricDetail(); window.switchTab('schedules');" style="font-size: 0.82rem;">
            <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
            <span>Abrir Agendamentos ➔</span>
          </button>
        </div>
      `;
    }

    const renderScheduleList = (items, isOverdue = false, isToday = false) => {
      if (!items || items.length === 0) return '';
      return items.map(s => {
        const dateFmt = formatDateBR(s.dueDate);
        const badgeColor = isOverdue ? 'var(--danger)' : isToday ? '#f59e0b' : 'var(--primary)';
        const badgeText = isOverdue ? `${Math.abs(s.daysDiff)} dia(s) atrasado` : isToday ? 'VENCE HOJE' : `em ${s.daysDiff} dia(s)`;
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; flex-wrap: wrap; padding: 0.65rem 0.85rem; background: var(--bg-card); border: 1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'}; border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 180px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: ${isOverdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${isOverdue ? 'var(--danger)' : '#f59e0b'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="${isOverdue ? 'alert-triangle' : 'clock'}" style="width: 16px; height: 16px;"></i>
              </div>
              <div style="min-width: 0; flex: 1;">
                <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); display: block; word-break: break-word;">${escapeHtml(s.description)}</span>
                <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; font-size: 0.73rem; color: var(--text-muted); margin-top: 0.15rem;">
                  <span style="color: ${badgeColor}; font-weight: 700;">${badgeText}</span>
                  <span>•</span>
                  <span>📅 Vencimento: ${dateFmt}</span>
                  <span>•</span>
                  <span>🏦 ${escapeHtml(s.accountName)}</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; margin-left: auto;">
              <span style="font-size: 0.95rem; font-weight: 800; color: ${s.type === 'expense' ? 'var(--danger)' : 'var(--success)'}; white-space: nowrap;">
                ${s.type === 'expense' ? '-' : '+'} ${currencyFormatter.format(s.amount)}
              </span>
              <button type="button" class="btn btn-outline" onclick="window.payScheduleFromMetricModal('${s.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.76rem; font-weight: 700; color: var(--success); border-color: rgba(16, 185, 129, 0.4);" title="Marcar como pago e lançar transação">
                <i data-lucide="check" style="width: 12px; height: 12px;"></i>
                <span>Pagar</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    };

    let contentHtml = '';

    if (data.overdue.length > 0) {
      contentHtml += `
        <div>
          <h4 style="margin: 0 0 0.5rem; font-size: 0.88rem; font-weight: 800; color: var(--danger); display: flex; align-items: center; gap: 0.4rem;">
            <i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i>
            Contas em Atraso (Urgente)
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${renderScheduleList(data.overdue, true, false)}
          </div>
        </div>
      `;
    }

    if (data.dueToday.length > 0) {
      contentHtml += `
        <div style="margin-top: 0.5rem;">
          <h4 style="margin: 0 0 0.5rem; font-size: 0.88rem; font-weight: 800; color: #f59e0b; display: flex; align-items: center; gap: 0.4rem;">
            <i data-lucide="bell" style="width: 16px; height: 16px;"></i>
            Vencem Hoje
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${renderScheduleList(data.dueToday, false, true)}
          </div>
        </div>
      `;
    }

    if (data.upcomingThisMonth.length > 0) {
      contentHtml += `
        <div style="margin-top: 0.5rem;">
          <h4 style="margin: 0 0 0.5rem; font-size: 0.88rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
            <i data-lucide="calendar" style="width: 16px; height: 16px; color: var(--primary);"></i>
            Próximos Vencimentos deste Mês
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${renderScheduleList(data.upcomingThisMonth, false, false)}
          </div>
        </div>
      `;
    }

    if (!contentHtml) {
      contentHtml = `<p style="color: var(--success); font-size: 0.95rem; text-align: center; padding: 2.5rem 0; font-weight: 700;">🎉 Parabéns! Todas as contas do período estão em dia!</p>`;
    }

    if (body) body.innerHTML = contentHtml;

    if (footer) {
      footer.innerHTML = `
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Clique em <strong>Pagar</strong> para quitar o compromisso em 1 clique.
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <button type="button" class="btn btn-outline" onclick="window.closeMetricDetail(); window.switchTab('schedules');" style="font-size: 0.82rem;">
            <i data-lucide="calendar-plus" style="width: 14px; height: 14px;"></i>
            <span>Gerenciar Agendamentos</span>
          </button>
        </div>
      `;
    }
  }
}

window.navigateAndFilterTransactions = function(type) {
  closeMetricDetail();
  switchTab('transactions');
  const typeFilter = document.getElementById('txTypeFilter');
  if (typeFilter) {
    typeFilter.value = type;
    typeFilter.dispatchEvent(new Event('change'));
  }
};

window.openNewTransactionFromModal = function(type) {
  closeMetricDetail();
  const btnOpenTx = document.getElementById('btnOpenNewTxModal');
  if (btnOpenTx) btnOpenTx.click();
  setTimeout(() => {
    if (type === 'income') {
      const toggleInc = document.getElementById('toggleIncome');
      if (toggleInc) toggleInc.click();
    } else if (type === 'expense') {
      const toggleExp = document.getElementById('toggleExpense');
      if (toggleExp) toggleExp.click();
    }
  }, 60);
};

window.payScheduleFromMetricModal = async function(scheduleId) {
  if (window.handlePaySchedule) {
    await window.handlePaySchedule(scheduleId);
    if (currentMetricDetailType) {
      const m = currentDashboardPeriod.month;
      const y = currentDashboardPeriod.year;
      const entity = currentEntityFilter || 'all';
      currentMetricDetailData = finance.getMetricBreakdown(currentMetricDetailType, m, y, entity);
      renderMetricDetailModalContent();
      if (window.lucide) lucide.createIcons();
    }
  }
};

// =========================================================================
// --- MÓDULO DE INTERFACE: FINANÇAS A DOIS & DESPESAS DO CASAL (VALORE COUPLE) ---
// =========================================================================

let currentCouplePeriod = {
  month: initialNow.getMonth() + 1,
  year: initialNow.getFullYear()
};
let coupleCategoryChartInstance = null;

function setupCoupleModule() {
  const coupleMonthSelect = document.getElementById('coupleSelectMonth');
  const coupleYearSelect = document.getElementById('coupleSelectYear');
  const btnSettings = document.getElementById('btnOpenCoupleSettingsModal');
  const btnCloseSettings = document.getElementById('btnCloseCoupleSettingsModal');
  const btnCancelSettings = document.getElementById('btnCancelCoupleSettings');
  const settingsModal = document.getElementById('coupleSettingsModal');
  const settingsForm = document.getElementById('coupleSettingsForm');

  const btnOpenSettle = document.getElementById('btnOpenCoupleSettleModal');
  const btnQuickSettle = document.getElementById('btnQuickSettleHero');
  const btnCloseSettle = document.getElementById('btnCloseCoupleSettleModal');
  const btnCancelSettle = document.getElementById('btnCancelCoupleSettle');
  const settleModal = document.getElementById('coupleSettleModal');
  const btnConfirmSettle = document.getElementById('btnConfirmCoupleSettle');
  const btnCopyPix = document.getElementById('btnCopyCouplePixKey');

  const btnNewCoupleTx = document.getElementById('btnNewCoupleTxShortcut');
  const btnNewCoupleGoal = document.getElementById('btnOpenNewCoupleGoalModal');
  const searchInput = document.getElementById('coupleTxSearchInput');

  // Seletores de período do casal
  if (coupleMonthSelect) {
    coupleMonthSelect.value = currentCouplePeriod.month;
    coupleMonthSelect.addEventListener('change', () => {
      currentCouplePeriod.month = parseInt(coupleMonthSelect.value, 10);
      renderCoupleView();
    });
  }

  if (coupleYearSelect) {
    populateCoupleYearSelect();
    coupleYearSelect.addEventListener('change', () => {
      currentCouplePeriod.year = parseInt(coupleYearSelect.value, 10);
      renderCoupleView();
    });
  }

  // Modal de Configurações do Casal
  if (btnSettings && settingsModal) {
    btnSettings.addEventListener('click', () => {
      const couple = finance.getCoupleSettings();
      document.getElementById('coupleP1Name').value = couple.partner1.name;
      document.getElementById('coupleP1Income').value = formatCurrencyInput(couple.partner1.monthlyIncome);
      document.getElementById('coupleP1Pix').value = couple.partner1.pixKey || '';

      document.getElementById('coupleP2Name').value = couple.partner2.name;
      document.getElementById('coupleP2Income').value = formatCurrencyInput(couple.partner2.monthlyIncome);
      document.getElementById('coupleP2Pix').value = couple.partner2.pixKey || '';

      const p1Av = couple.partner1.avatar || 'user';
      const p2Av = couple.partner2.avatar || 'heart';
      const p1Col = couple.partner1.color || '#3b82f6';
      const p2Col = couple.partner2.color || '#ec4899';

      const elP1Av = document.getElementById('coupleP1Avatar');
      const elP2Av = document.getElementById('coupleP2Avatar');
      const elP1Col = document.getElementById('coupleP1Color');
      const elP2Col = document.getElementById('coupleP2Color');
      if (elP1Av) elP1Av.value = p1Av;
      if (elP2Av) elP2Av.value = p2Av;
      if (elP1Col) elP1Col.value = p1Col;
      if (elP2Col) elP2Col.value = p2Col;

      renderAvatarPickers(p1Av, p2Av, p1Col, p2Col);
      renderColorPickers(p1Col, p2Col);

      const preset = couple.preset || 'hetero';
      ['Hetero', 'GayMale', 'LesbianFemale', 'Custom'].forEach(k => {
        const btn = document.getElementById(`btnPreset${k}`);
        if (btn) btn.classList.toggle('active', k.toLowerCase() === preset.replace('_', '').toLowerCase());
      });

      window.applyCoupleModeVisibility();

      document.getElementById('coupleSplitModeSelect').value = couple.splitMode || 'proportional';
      updateCoupleRatioPreview();
      settingsModal.classList.add('open');
      if (window.lucide) lucide.createIcons();
    });
  }

  const closeSettings = () => { if (settingsModal) settingsModal.classList.remove('open'); };
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
  if (btnCancelSettings) btnCancelSettings.addEventListener('click', closeSettings);

  // Atualização em tempo real da prévia do Equity Split enquanto digita rendas
  const incP1Input = document.getElementById('coupleP1Income');
  const incP2Input = document.getElementById('coupleP2Income');
  function updateCoupleRatioPreview() {
    const inc1 = parseCurrencyInput(incP1Input ? incP1Input.value : '0');
    const inc2 = parseCurrencyInput(incP2Input ? incP2Input.value : '0');
    const total = inc1 + inc2;
    let p1Pct = 50, p2Pct = 50;
    if (total > 0) {
      p1Pct = Math.round((inc1 / total) * 100);
      p2Pct = 100 - p1Pct;
    }
    const name1 = (document.getElementById('coupleP1Name')?.value || 'Você').trim();
    const name2 = (document.getElementById('coupleP2Name')?.value || 'Parceiro(a)').trim();
    const el1 = document.getElementById('couplePreviewP1Ratio');
    const el2 = document.getElementById('couplePreviewP2Ratio');
    if (el1) el1.textContent = `${name1}: ${p1Pct}%`;
    if (el2) el2.textContent = `${name2}: ${p2Pct}%`;
  }

  if (incP1Input) incP1Input.addEventListener('input', updateCoupleRatioPreview);
  if (incP2Input) incP2Input.addEventListener('input', updateCoupleRatioPreview);

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1Name = (document.getElementById('coupleP1Name').value || 'Você').trim();
      const p1Income = parseCurrencyInput(document.getElementById('coupleP1Income').value);
      const p1Pix = (document.getElementById('coupleP1Pix').value || '').trim();
      const p1Av = document.getElementById('coupleP1Avatar')?.value || 'user';
      const p1Col = document.getElementById('coupleP1Color')?.value || '#3b82f6';

      const p2Name = (document.getElementById('coupleP2Name').value || 'Parceiro(a)').trim();
      const p2Income = parseCurrencyInput(document.getElementById('coupleP2Income').value);
      const p2Pix = (document.getElementById('coupleP2Pix').value || '').trim();
      const p2Av = document.getElementById('coupleP2Avatar')?.value || 'heart';
      const p2Col = document.getElementById('coupleP2Color')?.value || '#ec4899';

      const splitMode = document.getElementById('coupleSplitModeSelect').value;

      await finance.updateCoupleSettings({
        enabled: true,
        splitMode: splitMode,
        partner1: { name: p1Name, monthlyIncome: p1Income, pixKey: p1Pix, avatar: p1Av, color: p1Col },
        partner2: { name: p2Name, monthlyIncome: p2Income, pixKey: p2Pix, avatar: p2Av, color: p2Col }
      });

      showToast('Configurações do casal atualizadas com sucesso!', 'success');
      window.applyCoupleModeVisibility();
      if (window.syncDeviceIdentityUI) window.syncDeviceIdentityUI();
      closeSettings();
      renderCoupleView();
    });
  }

  // Modal de Acerto de Contas & Quitação Pix
  const openSettleModal = () => {
    const summary = finance.getCoupleSummary(currentCouplePeriod.year, currentCouplePeriod.month);
    if (summary.balanceAmount <= 0.01) {
      showToast('Não há despesas pendentes de acerto neste mês. Tudo já está equilibrado!', 'info');
      return;
    }

    const amountEl = document.getElementById('coupleSettleAmountDisplay');
    const dirEl = document.getElementById('coupleSettleDirectionDisplay');
    const pixInput = document.getElementById('coupleSettlePixKeyInput');
    const accSelect = document.getElementById('coupleSettleAccountSelect');

    if (amountEl) amountEl.textContent = currencyFormatter.format(summary.balanceAmount);
    if (dirEl) {
      dirEl.innerHTML = `<strong>${escapeHtml(summary.debtorName)}</strong> transfere para <strong>${escapeHtml(summary.creditorName)}</strong>`;
    }

    if (pixInput) {
      pixInput.value = summary.creditorPixKey || 'Chave Pix não informada nas configurações';
    }

    // Popula contas correntes/carteiras do titular
    if (accSelect) {
      const validAccounts = finance.state.accounts.filter(a => a.type !== 'credit');
      accSelect.innerHTML = validAccounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${currencyFormatter.format(a.balance || 0)})</option>`).join('');
    }

    if (settleModal) settleModal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  };

  if (btnOpenSettle) btnOpenSettle.addEventListener('click', openSettleModal);
  if (btnQuickSettle) btnQuickSettle.addEventListener('click', openSettleModal);

  const closeSettle = () => { if (settleModal) settleModal.classList.remove('open'); };
  if (btnCloseSettle) btnCloseSettle.addEventListener('click', closeSettle);
  if (btnCancelSettle) btnCancelSettle.addEventListener('click', closeSettle);

  // Copiar Chave Pix
  if (btnCopyPix) {
    btnCopyPix.addEventListener('click', () => {
      const pixInput = document.getElementById('coupleSettlePixKeyInput');
      if (pixInput && pixInput.value && !pixInput.value.includes('não informada')) {
        navigator.clipboard.writeText(pixInput.value).then(() => {
          showToast('Chave Pix copiada com sucesso!', 'success');
        }).catch(() => {
          pixInput.select();
          document.execCommand('copy');
          showToast('Chave Pix copiada!', 'success');
        });
      } else {
        showToast('Nenhuma chave Pix cadastrada para o favorecido.', 'warning');
      }
    });
  }

  // Confirmar Quitação
  if (btnConfirmSettle) {
    btnConfirmSettle.addEventListener('click', async () => {
      const recordTx = !!document.getElementById('coupleSettleRecordTxCheckbox')?.checked;
      const accountId = recordTx ? document.getElementById('coupleSettleAccountSelect')?.value : null;

      try {
        btnConfirmSettle.disabled = true;
        await finance.settleCoupleExpenses({
          year: currentCouplePeriod.year,
          month: currentCouplePeriod.month,
          accountId: accountId
        });

        showToast('Acerto de contas realizado com sucesso! Despesas marcadas como quitadas.', 'success');
        closeSettle();
        renderCoupleView();
        renderTransactionsView();
        renderAccountsView();
        renderDashboard();
      } catch (err) {
        console.error('Erro ao liquidar acerto de contas:', err);
        showToast(err.message || 'Erro ao realizar quitação.', 'error');
      } finally {
        btnConfirmSettle.disabled = false;
      }
    });
  }

  // Interações no Formulário de Transação (Nova Transação)
  const isSharedCheck = document.getElementById('txIsShared');
  const sharedDetails = document.getElementById('txSharedDetailsContainer');
  const btnP1 = document.getElementById('btnTxPayerP1');
  const btnP2 = document.getElementById('btnTxPayerP2');
  const paidByInput = document.getElementById('txPaidBy');
  const splitRuleSelect = document.getElementById('txSplitRule');
  const customSplitSliderContainer = document.getElementById('txCustomSplitSliderContainer');
  const customSplitRange = document.getElementById('txCustomSplitRange');
  const previewText = document.getElementById('txSplitCalcPreview');

  if (isSharedCheck && sharedDetails) {
    isSharedCheck.addEventListener('change', () => {
      sharedDetails.style.display = isSharedCheck.checked ? 'block' : 'none';
      const badge = document.getElementById('txSharedRatioBadge');
      if (badge) badge.style.display = isSharedCheck.checked ? 'inline-flex' : 'none';
    });
  }

  if (btnP1 && btnP2 && paidByInput) {
    btnP1.addEventListener('click', () => {
      btnP1.classList.add('active');
      btnP2.classList.remove('active');
      paidByInput.value = 'p1';
    });
    btnP2.addEventListener('click', () => {
      btnP2.classList.add('active');
      btnP1.classList.remove('active');
      paidByInput.value = 'p2';
    });
  }

  if (splitRuleSelect) {
    splitRuleSelect.addEventListener('change', () => {
      if (customSplitSliderContainer) {
        customSplitSliderContainer.style.display = splitRuleSelect.value === 'custom' ? 'block' : 'none';
      }
      if (previewText) {
        const couple = finance.getCoupleSettings();
        if (splitRuleSelect.value === 'default') {
          previewText.textContent = `Divisão Proporcional ativa: ${couple.partner1.name} (${couple.proportionalRatio.p1}%) e ${couple.partner2.name} (${couple.proportionalRatio.p2}%).`;
        } else if (splitRuleSelect.value === 'equal') {
          previewText.textContent = `Divisão 50% / 50%: Metade para cada um.`;
        } else if (splitRuleSelect.value === '100_p1') {
          previewText.textContent = `100% pago e assumido por ${couple.partner1.name}.`;
        } else if (splitRuleSelect.value === '100_p2') {
          previewText.textContent = `100% pago e assumido por ${couple.partner2.name}.`;
        }
      }
    });
  }

  if (customSplitRange) {
    customSplitRange.addEventListener('input', () => {
      const p1 = parseInt(customSplitRange.value, 10);
      const p2 = 100 - p1;
      const couple = finance.getCoupleSettings();
      const l1 = document.getElementById('txCustomP1Label');
      const l2 = document.getElementById('txCustomP2Label');
      if (l1) l1.textContent = `${couple.partner1.name}: ${p1}%`;
      if (l2) l2.textContent = `${couple.partner2.name}: ${p2}%`;
    });
  }

  // Atalhos de Nova Transação do Casal e Novo Sonho
  if (btnNewCoupleTx) {
    btnNewCoupleTx.addEventListener('click', () => {
      const btnOpen = document.getElementById('btnOpenNewTxModal');
      if (btnOpen) btnOpen.click();
      setTimeout(() => {
        const toggleExp = document.getElementById('toggleExpense');
        if (toggleExp) toggleExp.click();
        const check = document.getElementById('txIsShared');
        if (check) {
          check.checked = true;
          check.dispatchEvent(new Event('change'));
        }
      }, 50);
    });
  }

  if (btnNewCoupleGoal) {
    btnNewCoupleGoal.addEventListener('click', () => {
      const btnOpen = document.getElementById('btnOpenNewGoalModal');
      if (btnOpen) btnOpen.click();
      setTimeout(() => {
        const check = document.getElementById('goalIsCouple');
        if (check) check.checked = true;
        const titleEl = document.getElementById('goalTitle');
        if (titleEl && !titleEl.value) titleEl.placeholder = 'Ex: Viagem romântica, Casamento, Reforma';
      }, 50);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderCoupleTransactionsTable(searchInput.value);
    });
  }
}

function populateCoupleYearSelect() {
  const yearSelect = document.getElementById('coupleSelectYear');
  if (!yearSelect) return;
  const currentYear = new Date().getFullYear();
  let html = '';
  for (let y = currentYear - 3; y <= currentYear + 2; y++) {
    html += `<option value="${y}" ${y === currentCouplePeriod.year ? 'selected' : ''}>${y}</option>`;
  }
  yearSelect.innerHTML = html;
}

// Renderização Principal da Tela: Finanças a Dois
function renderCoupleView() {
  const couple = finance.getCoupleSettings();
  const summary = finance.getCoupleSummary(currentCouplePeriod.year, currentCouplePeriod.month);
  const mName = monthNamesLong[currentCouplePeriod.month - 1] || 'Mês';

  // Sincroniza controles de período no topo
  const periodLabel = document.getElementById('couplePeriodCurrentLabel');
  if (periodLabel) periodLabel.textContent = `${mName} de ${currentCouplePeriod.year}`;

  const monthSelect = document.getElementById('coupleSelectMonth');
  const yearSelect = document.getElementById('coupleSelectYear');
  if (monthSelect) monthSelect.value = currentCouplePeriod.month;
  if (yearSelect) yearSelect.value = currentCouplePeriod.year;

  // Atualiza Nomes dos Parceiros nas Etiquetas
  const labelP1 = document.getElementById('coupleLabelPaidP1');
  const labelP2 = document.getElementById('coupleLabelPaidP2');
  if (labelP1) labelP1.textContent = `Pago por ${couple.partner1.name}`;
  if (labelP2) labelP2.textContent = `Pago por ${couple.partner2.name}`;

  const btnP1Payer = document.getElementById('btnTxPayerP1');
  const btnP2Payer = document.getElementById('btnTxPayerP2');
  if (btnP1Payer) btnP1Payer.textContent = couple.partner1.name;
  if (btnP2Payer) btnP2Payer.textContent = couple.partner2.name;

  // Atualiza Hero Card de Balanço & Compensação
  const balanceTitle = document.getElementById('coupleBalanceMainTitle');
  const balanceSub = document.getElementById('coupleBalanceSubtitle');
  const quickSettleContainer = document.getElementById('coupleSettleQuickActionContainer');
  const quickSettleBtnText = document.getElementById('btnQuickSettleHeroText');

  if (summary.balanceAmount > 0.01) {
    if (balanceTitle) {
      balanceTitle.innerHTML = `
        <span style="color: ${summary.creditor === 'p1' ? '#3b82f6' : '#ec4899'};">${escapeHtml(summary.debtorName)}</span> 
        <span style="font-size: 1.15rem; font-weight: 600; color: var(--text-muted);">deve transferir</span> 
        <span style="color: #10b981; font-weight: 900;">${currencyFormatter.format(summary.balanceAmount)}</span>
        <span style="font-size: 1.15rem; font-weight: 600; color: var(--text-muted);">para ${escapeHtml(summary.creditorName)}</span>
      `;
    }
    if (balanceSub) {
      balanceSub.textContent = `Balanço líquido de ${summary.transactions.filter(t => !t.settled).length} compras conjuntas pendentes no mês de ${mName}.`;
    }
    if (quickSettleContainer) quickSettleContainer.style.display = 'block';
    if (quickSettleBtnText) {
      quickSettleBtnText.textContent = `Fazer Pix de ${currencyFormatter.format(summary.balanceAmount)}`;
    }
  } else {
    if (balanceTitle) {
      balanceTitle.innerHTML = `<span style="color: #10b981;">Tudo Equilibrado e Quitado! 🎉</span>`;
    }
    if (balanceSub) {
      balanceSub.textContent = `Todas as despesas compartilhadas deste período estão perfeitamente divididas e compensadas.`;
    }
    if (quickSettleContainer) quickSettleContainer.style.display = 'none';
  }

  // Barra Visual de Proporção (Equity Split)
  const ratioP1Label = document.getElementById('coupleRatioP1Label');
  const ratioP2Label = document.getElementById('coupleRatioP2Label');
  const ratioBarP1 = document.getElementById('coupleRatioBarP1');
  const ratioBarP2 = document.getElementById('coupleRatioBarP2');
  const splitModeBadge = document.getElementById('coupleSplitModeBadge');

  const p1Pct = couple.proportionalRatio.p1;
  const p2Pct = couple.proportionalRatio.p2;

  if (ratioP1Label) ratioP1Label.textContent = `${couple.partner1.name}: ${p1Pct}%`;
  if (ratioP2Label) ratioP2Label.textContent = `${couple.partner2.name}: ${p2Pct}%`;
  if (ratioBarP1) ratioBarP1.style.width = `${p1Pct}%`;
  if (ratioBarP2) ratioBarP2.style.width = `${p2Pct}%`;
  if (splitModeBadge) {
    splitModeBadge.textContent = couple.splitMode === 'equal' ? '50% / 50% Meio a Meio' : (couple.splitMode === 'fixed_quota' ? 'Cota Fixa Mensal' : 'Proporcional à Renda (Equity Split)');
  }

  // Cards de Métricas
  const totalExpEl = document.getElementById('coupleMetricTotalExpenses');
  const expCountEl = document.getElementById('coupleMetricExpensesCount');
  const paidP1El = document.getElementById('coupleMetricPaidP1');
  const dueP1El = document.getElementById('coupleMetricDueP1');
  const paidP2El = document.getElementById('coupleMetricPaidP2');
  const dueP2El = document.getElementById('coupleMetricDueP2');
  const balanceAmtEl = document.getElementById('coupleMetricBalanceAmount');
  const balanceStatEl = document.getElementById('coupleMetricBalanceStatus');

  if (totalExpEl) totalExpEl.textContent = currencyFormatter.format(summary.totalSharedExpenses);
  if (expCountEl) expCountEl.textContent = `${summary.transactions.length} ${summary.transactions.length === 1 ? 'compra compartilhada' : 'compras compartilhadas'}`;

  if (paidP1El) paidP1El.textContent = currencyFormatter.format(summary.paidByP1);
  if (dueP1El) dueP1El.textContent = `Cota devida: ${currencyFormatter.format(summary.dueByP1)}`;

  if (paidP2El) paidP2El.textContent = currencyFormatter.format(summary.paidByP2);
  if (dueP2El) dueP2El.textContent = `Cota devida: ${currencyFormatter.format(summary.dueByP2)}`;

  if (balanceAmtEl) balanceAmtEl.textContent = currencyFormatter.format(summary.balanceAmount);
  if (balanceStatEl) {
    balanceStatEl.textContent = summary.balanceAmount > 0.01 ? summary.statusLabel : 'Contas equilibradas';
  }

  // Gráfico de Categoria do Casal
  renderCoupleCategoryChart(summary.categories);

  // Metas do Casal
  renderCoupleGoals(summary.coupleGoals);

  // Painel DR Financeira Positiva
  renderCoupleAlignmentReport();

  // Tabela de Despesas Compartilhadas
  renderCoupleTransactionsTable();

  // Histórico de Acertos de Contas
  renderCoupleSettlementsHistory(summary.settlements);

  if (window.lucide) lucide.createIcons();
}

function renderCoupleCategoryChart(categories) {
  const canvas = document.getElementById('coupleCategoryChart');
  if (!canvas) return;

  if (coupleCategoryChartInstance) {
    coupleCategoryChartInstance.destroy();
    coupleCategoryChartInstance = null;
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';

  let labels = [];
  let dataVals = [];
  let bgColors = [];

  if (categories && categories.length > 0) {
    labels = categories.map(c => c.name);
    dataVals = categories.map(c => c.total);
    bgColors = categories.map(c => c.color || '#ec4899');
  } else {
    labels = ['Nenhuma despesa compartilhada'];
    dataVals = [1];
    bgColors = [isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'];
  }

  coupleCategoryChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataVals,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: window.innerWidth <= 768 ? 'bottom' : 'right',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11 },
            boxWidth: 12,
            padding: 8
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (categories.length === 0) return 'Sem dados';
              const val = ctx.raw || 0;
              const total = dataVals.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
              return ` ${ctx.label}: ${currencyFormatter.format(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

function renderCoupleGoals(coupleGoals) {
  const container = document.getElementById('coupleGoalsListContainer');
  if (!container) return;

  if (!coupleGoals || coupleGoals.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
        <i data-lucide="heart" style="width: 32px; height: 32px; color: #ec4899; opacity: 0.6; margin-bottom: 0.5rem;"></i>
        <p style="font-size: 0.85rem; margin: 0;">Nenhum sonho planejado a dois ainda.</p>
        <span style="font-size: 0.74rem; color: var(--text-muted); display: block; margin-top: 0.25rem;">Planejem uma viagem, reforma ou casamento juntos!</span>
      </div>
    `;
    return;
  }

  const couple = finance.getCoupleSettings();

  container.innerHTML = coupleGoals.map(g => {
    const cur = parseFloat(g.currentAmount || 0);
    const tgt = parseFloat(g.targetAmount || 1);
    const pct = Math.min(100, Math.round((cur / tgt) * 100));

    // Calcula contribuição de cada parceiro a partir do histórico de depósitos
    let contribP1 = 0;
    let contribP2 = 0;
    (g.history || []).forEach(h => {
      if (h.type === 'deposit') {
        const amt = parseFloat(h.amount || 0);
        if (h.contributor === 'p2') contribP2 += amt;
        else contribP1 += amt;
      }
    });

    const totalContrib = contribP1 + contribP2;
    const p1SharePct = totalContrib > 0 ? Math.round((contribP1 / totalContrib) * 100) : 50;
    const p2SharePct = 100 - p1SharePct;

    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.85rem 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 28px; height: 28px; border-radius: 8px; background: rgba(236, 72, 153, 0.15); display: flex; align-items: center; justify-content: center; color: #ec4899;">
              <i data-lucide="${g.icon || 'heart'}" style="width: 15px; height: 15px;"></i>
            </div>
            <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(g.title)}</span>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 800; font-size: 0.76rem;">${pct}%</span>
        </div>

        <!-- Barra de Progresso Bicolor do Casal -->
        <div class="couple-goal-bicolor-bar">
          <div style="height: 100%; width: ${(pct * (p1SharePct / 100))}%; background: #3b82f6;" title="${couple.partner1.name}: ${currencyFormatter.format(contribP1)}"></div>
          <div style="height: 100%; width: ${(pct * (p2SharePct / 100))}%; background: #ec4899;" title="${couple.partner2.name}: ${currencyFormatter.format(contribP2)}"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted); margin-top: 0.35rem;">
          <span>Poupado: <strong style="color: var(--text-main);">${currencyFormatter.format(cur)}</strong> de ${currencyFormatter.format(tgt)}</span>
          <span><span style="color: #3b82f6;">●</span> ${p1SharePct}% | <span style="color: #ec4899;">●</span> ${p2SharePct}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderCoupleAlignmentReport() {
  const container = document.getElementById('coupleAlignmentInsightsContainer');
  const scoreBadge = document.getElementById('coupleHarmonyScoreBadge');
  if (!container) return;

  const report = finance.getCoupleAlignmentReport(currentCouplePeriod.year, currentCouplePeriod.month);

  if (scoreBadge) {
    scoreBadge.textContent = `${report.harmonyScore} / 100`;
    if (report.harmonyScore >= 85) {
      scoreBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      scoreBadge.style.color = '#34d399';
    } else if (report.harmonyScore >= 70) {
      scoreBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      scoreBadge.style.color = '#f59e0b';
    } else {
      scoreBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      scoreBadge.style.color = '#f87171';
    }
  }

  if (report.insights.length === 0) {
    container.innerHTML = `<div>Nenhum alerta registrado. As finanças do casal estão em plena harmonia!</div>`;
    return;
  }

  container.innerHTML = report.insights.map(txt => `
    <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
      <i data-lucide="check-circle" style="width: 16px; height: 16px; color: #a78bfa; flex-shrink: 0; margin-top: 2px;"></i>
      <span>${escapeHtml(txt)}</span>
    </div>
  `).join('');
}

function renderCoupleTransactionsTable(searchFilter = '') {
  const tbody = document.getElementById('coupleTxTableBody');
  if (!tbody) return;

  const summary = finance.getCoupleSummary(currentCouplePeriod.year, currentCouplePeriod.month);
  const couple = summary.couple;
  const search = String(searchFilter || '').toLowerCase().trim();

  let txs = summary.transactions;
  if (search) {
    txs = txs.filter(t => (t.description || '').toLowerCase().includes(search) || (t.coupleNote || '').toLowerCase().includes(search));
  }

  if (txs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          Nenhuma despesa compartilhada registrada para este mês.
          <br>
          <button class="btn btn-primary" onclick="document.getElementById('btnNewCoupleTxShortcut')?.click()" style="margin-top: 0.75rem; font-size: 0.8rem;">
            + Lançar Primeira Despesa do Casal
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = txs.map(t => {
    const isP1 = t.paidBy === 'p1';
    const payerName = isP1 ? couple.partner1.name : couple.partner2.name;
    const cat = finance.state.categories.find(c => c.id === t.categoryId) || { name: 'Outros', color: '#64748b' };
    const acc = finance.state.accounts.find(a => a.id === t.accountId) || { name: 'Conta' };

    let ruleLabel = 'Proporcional';
    if (t.splitRule === 'equal') ruleLabel = '50/50';
    else if (t.splitRule === '100_p1') ruleLabel = '100% ' + couple.partner1.name;
    else if (t.splitRule === '100_p2') ruleLabel = '100% ' + couple.partner2.name;
    else if (t.splitRule === 'custom' && t.customSplit) ruleLabel = `${t.customSplit.p1}% / ${t.customSplit.p2}%`;

    const statusBadge = t.settled
      ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700; font-size: 0.7rem;">Quitado</span>`
      : `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 700; font-size: 0.7rem;">Pendente</span>`;

    return `
      <tr class="tx-row">
        <td class="tx-cell-desc">
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(t.description)}</div>
          ${t.coupleNote ? `<div style="font-size: 0.74rem; color: #ec4899; display: flex; align-items: center; gap: 3px;">❤️ ${escapeHtml(t.coupleNote)}</div>` : ''}
        </td>
        <td class="tx-cell-cat">
          <span class="couple-badge-tag ${isP1 ? 'couple-badge-p1' : 'couple-badge-p2'}">
            ${escapeHtml(payerName)}
          </span>
          <span class="badge mobile-only-inline" style="background: var(--bg-tertiary); font-size: 0.72rem; color: var(--text-secondary);">${ruleLabel}</span>
          <span class="mobile-only-inline">${statusBadge}</span>
        </td>
        <td class="tx-cell-acc">
          <div style="font-size: 0.8rem; font-weight: 600;">${escapeHtml(cat.name)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(acc.name)}</div>
        </td>
        <td class="tx-cell-date" style="font-size: 0.8rem;">${formatDateBR(t.date)}</td>
        <td class="desktop-only-cell">
          <span class="badge" style="background: var(--bg-tertiary); font-size: 0.72rem; color: var(--text-secondary);">${ruleLabel}</span>
        </td>
        <td class="tx-cell-amount" style="text-align: right; font-weight: 700; color: var(--text-main);">
          ${currencyFormatter.format(t.amount)}
          <div class="mobile-only-block" style="font-size: 0.72rem; font-weight: 600; color: #3b82f6;">Sua parte: ${currencyFormatter.format(t._computedDueP1 || 0)}</div>
        </td>
        <td class="desktop-only-cell" style="text-align: right; font-weight: 700; color: #3b82f6;">
          ${currencyFormatter.format(t._computedDueP1 || 0)}
        </td>
        <td class="desktop-only-cell" style="text-align: center;">${statusBadge}</td>
        <td class="td-actions tx-cell-actions">
          <div class="table-actions-container">
            <button onclick="handleEditTx('${t.id}')" class="btn-action-icon" style="color: var(--primary);" title="Editar">
              <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
            </button>
            <button onclick="handleDeleteTx('${t.id}')" class="btn-action-icon" style="color: var(--danger);" title="Excluir">
              <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderCoupleSettlementsHistory(settlements) {
  const tbody = document.getElementById('coupleSettlementsTableBody');
  const card = document.getElementById('coupleSettlementsHistoryCard');
  if (!tbody || !card) return;

  if (!settlements || settlements.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  tbody.innerHTML = settlements.map(s => `
    <tr class="tx-settlement-card">
      <td style="font-size: 0.82rem; font-weight: 600;">
        <span class="mobile-only-inline" style="font-size: 0.74rem; color: var(--text-muted);">Data:</span>
        <span>${formatDateBR(s.date)}</span>
      </td>
      <td style="font-size: 0.82rem;">
        <span class="mobile-only-inline" style="font-size: 0.74rem; color: var(--text-muted);">Ref:</span>
        <span>${escapeHtml(s.note || 'Acerto mensal')}</span>
      </td>
      <td>
        <span class="mobile-only-inline" style="font-size: 0.74rem; color: var(--text-muted);">Pagador:</span>
        <span class="couple-badge-tag couple-badge-p2">${escapeHtml(s.debtorName)}</span>
      </td>
      <td>
        <span class="mobile-only-inline" style="font-size: 0.74rem; color: var(--text-muted);">Recebedor:</span>
        <span class="couple-badge-tag couple-badge-p1">${escapeHtml(s.creditorName)}</span>
      </td>
      <td style="text-align: right; font-weight: 800; color: #10b981;">
        <span class="mobile-only-inline" style="font-size: 0.74rem; color: var(--text-muted); font-weight: 500;">Compensado:</span>
        <span>${currencyFormatter.format(s.amount)}</span>
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">
        <span class="mobile-only-inline">Itens:</span>
        <span>${s.transactionsCount} despesas</span>
      </td>
      <td class="td-actions">
        <button onclick="handleDeleteCoupleSettlement('${s.id}')" class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.72rem; color: var(--danger); margin-left: auto;" title="Desfazer Acerto e reabrir pendências">
          <i data-lucide="rotate-ccw" style="width: 12px; height: 12px;"></i> Desfazer
        </button>
      </td>
    </tr>
  `).join('');
}

window.handleDeleteCoupleSettlement = async function(settlementId) {
  if (confirm('Deseja realmente desfazer este acerto de contas? As despesas voltarão ao status de pendentes.')) {
    await finance.deleteCoupleSettlement(settlementId);
    showToast('Acerto de contas desfeito com sucesso.', 'info');
    renderCoupleView();
  }
};

window.renderCoupleView = renderCoupleView;

// --- PÍLULAS DE PARCELAMENTO RÁPIDO (REDUÇÃO DE CLIQUES) ---
window.selectQuickInstallment = function(n) {
  const select = document.getElementById('txInstallments');
  if (select) {
    select.value = String(n);
    select.dispatchEvent(new Event('change'));
  }
  const pills = document.querySelectorAll('.btn-pill-installment');
  pills.forEach(p => {
    p.classList.toggle('active', parseInt(p.getAttribute('data-inst'), 10) === n);
  });
};

// --- MODO LEVE / BAIXO CONSUMO (32-BITS E HARDWARE LIMITADO) ---
window.togglePerformanceMode = function() {
  const html = document.documentElement;
  const isLow = html.getAttribute('data-performance') === 'low';
  const newMode = isLow ? 'standard' : 'low';
  html.setAttribute('data-performance', newMode);
  localStorage.setItem('valore_perf_mode', newMode);
  updatePerformanceModeUI(newMode);
};

function updatePerformanceModeUI(mode) {
  const btn = document.getElementById('btnToggleLiteMode');
  const txt = document.getElementById('liteModeText');
  if (!btn || !txt) return;
  if (mode === 'low') {
    btn.classList.add('active-lite');
    txt.textContent = '⚡ Modo Leve Ativo';
    btn.title = 'Modo Leve Ativo: Blur e sombras desativados para máxima fluidez e economia de RAM/CPU. Clique para voltar ao Padrão.';
  } else {
    btn.classList.remove('active-lite');
    txt.textContent = 'Modo Padrão';
    btn.title = 'Ativar Modo Leve para computadores fracos (Desativa blur e sombras para economizar CPU e RAM)';
  }
}

function initPerformanceMode() {
  const savedMode = localStorage.getItem('valore_perf_mode') || 'standard';
  document.documentElement.setAttribute('data-performance', savedMode);
  updatePerformanceModeUI(savedMode);
}

// =========================================================================
// --- GERENCIAMENTO GLOBAL DO BOTÃO VOLTAR (ANDROID / WEB / DESKTOP) ---
// =========================================================================
let lastBackPressTime = 0;

function handleGlobalBackAction() {
  // 0. Modal de Boas-Vindas / Onboarding aberto? (#welcomeModal)
  const welcomeModal = document.getElementById('welcomeModal');
  if (welcomeModal && welcomeModal.classList.contains('open')) {
    if (typeof window.finishWelcomeOnboarding === 'function') {
      window.finishWelcomeOnboarding('dismiss');
    } else {
      welcomeModal.classList.remove('open');
    }
    return true;
  }

  // 1. Scanner de QR Code ativo?
  const qrScannerContainer = document.getElementById('qrScannerContainer');
  if (qrScannerContainer && qrScannerContainer.style.display !== 'none') {
    if (typeof window.stopQrScanner === 'function') {
      window.stopQrScanner();
    } else {
      qrScannerContainer.style.display = 'none';
    }
    return true;
  }

  // 2. Calculadora Flutuante aberta? (#calcOverlay)
  const calcOverlay = document.getElementById('calcOverlay');
  if (calcOverlay && (calcOverlay.classList.contains('open') || calcOverlay.classList.contains('active'))) {
    if (typeof window.closeCalculator === 'function') {
      window.closeCalculator();
    } else {
      calcOverlay.classList.remove('open');
      calcOverlay.classList.remove('active');
    }
    return true;
  }

  // 3. Modal universal de confirmação/alerta aberto? (#appAlertModal)
  const appAlertModal = document.getElementById('appAlertModal');
  if (appAlertModal && appAlertModal.classList.contains('open')) {
    if (typeof closeAppAlertModal === 'function') {
      closeAppAlertModal(false);
    } else {
      appAlertModal.classList.remove('open');
    }
    return true;
  }

  // 4. Modal de confirmação de exclusão de transação? (#confirmDeleteTxModal)
  const confirmDelModal = document.getElementById('confirmDeleteTxModal');
  if (confirmDelModal && confirmDelModal.classList.contains('open')) {
    if (typeof window.closeConfirmDeleteTxModal === 'function') {
      window.closeConfirmDeleteTxModal();
    } else {
      confirmDelModal.classList.remove('open');
    }
    return true;
  }

  // 5. Raio-X de métricas aberto? (#metricDetailModal)
  const metricDetailModal = document.getElementById('metricDetailModal');
  if (metricDetailModal && (metricDetailModal.classList.contains('open') || metricDetailModal.style.display === 'flex' || metricDetailModal.style.display === 'block')) {
    if (typeof window.closeMetricDetail === 'function') {
      window.closeMetricDetail();
    } else {
      metricDetailModal.classList.remove('open');
      metricDetailModal.style.display = 'none';
    }
    return true;
  }

  // 6. Demais Modais Overlays abertos (.modal-overlay.open)
  const openModals = Array.from(document.querySelectorAll('.modal-overlay.open'));
  if (openModals.length > 0) {
    const topModal = openModals[openModals.length - 1];
    // Tenta encontrar botão de fechar ou cancelar daquele modal
    const closeBtn = topModal.querySelector('[id^="btnClose"], [id^="btnCancel"], [id$="Close"], [id$="ModalClose"], .btn-close, .card-title-row button');
    if (closeBtn && typeof closeBtn.click === 'function') {
      closeBtn.click();
    } else {
      topModal.classList.remove('open');
    }
    return true;
  }

  // 7. Gaveta Deslizante Mobile (Bottom Sheet de Contas, Projetos ou Renda Extra)
  const accCard = document.getElementById('accountDetailsCard');
  const ccCard = document.getElementById('costCenterDetailsCard');
  const shCard = document.getElementById('sideHustleDetailsCard');
  const hasMobileSheetOpen =
    (accCard && accCard.classList.contains('mobile-sheet-open') && accCard.style.display !== 'none') ||
    (ccCard && ccCard.classList.contains('mobile-sheet-open') && ccCard.style.display !== 'none') ||
    (shCard && shCard.classList.contains('mobile-sheet-open') && shCard.style.display !== 'none');

  if (hasMobileSheetOpen) {
    if (typeof window.closeAllMobileDetailSheets === 'function') {
      window.closeAllMobileDetailSheets();
    }
    return true;
  }

  // 8. Menu Lateral Mobile aberto?
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    if (typeof closeMobileDrawer === 'function') {
      closeMobileDrawer();
    } else {
      sidebar.classList.remove('mobile-open');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (backdrop) backdrop.classList.remove('active');
    }
    return true;
  }

  // 9. Se estiver em uma tela secundária (≠ dashboard / Início), volta para a tela inicial
  if (currentTab && currentTab !== 'dashboard') {
    if (typeof switchTab === 'function') {
      switchTab('dashboard');
    }
    return true;
  }

  // 10. Se já estiver na tela de Início sem nenhuma janela flutuante aberta:
  // Duplo toque no botão voltar em até 2.2 segundos para sair do app (evita saída acidental)
  const now = Date.now();
  if (now - lastBackPressTime < 2200) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && typeof window.Capacitor.Plugins.App.exitApp === 'function') {
      window.Capacitor.Plugins.App.exitApp();
    }
    return false;
  }

  lastBackPressTime = now;
  showToast('Toque em voltar novamente para sair do Valore', 'info');
  return true;
}
window.handleGlobalBackAction = handleGlobalBackAction;

// Registra o ouvinte nativo do botão Voltar do Android (Capacitor App Plugin)
function initMobileBackButtonListener() {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      window.Capacitor.Plugins.App.addListener('backButton', () => {
        handleGlobalBackAction();
      });
    } catch (err) {
      console.warn('Não foi possível registrar backButton do Capacitor:', err);
    }
  }

  // Suporte ao histórico de navegação
  window.addEventListener('popstate', () => {
    handleGlobalBackAction();
  });
}

// --- ATALHOS GLOBAIS DE TECLADO (PRODUTIVIDADE & ERGONOMIA) ---
window.addEventListener('keydown', (e) => {
  const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';
  const txModal = document.getElementById('txModal');
  const isTxModalOpen = txModal && txModal.classList.contains('open');

  // 1. Tecla Escape: Fecha qualquer modal ou painel aberto
  if (e.key === 'Escape') {
    handleGlobalBackAction();
    return;
  }

  // 2. Atalho 'Ctrl+N' / 'Cmd+N' ou Tecla 'N' livre: Abre Nova Transação e foca no Valor
  const isCtrlN = (e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N');
  const isFreeN = (e.key === 'n' || e.key === 'N') && !isInput && !e.ctrlKey && !e.altKey && !e.metaKey;

  if (isCtrlN || isFreeN) {
    if (!isTxModalOpen) {
      e.preventDefault();
      const btnOpenTx = document.getElementById('btnOpenNewTxModal');
      if (btnOpenTx) btnOpenTx.click();
    }
    return;
  }

  // 3. Tecla Enter dentro do Modal de Transação: Submete se não for um textarea
  if (e.key === 'Enter' && isTxModalOpen && targetTag !== 'textarea') {
    const txForm = document.getElementById('txForm');
    if (txForm) {
      e.preventDefault();
      const submitBtn = txForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    }
  }
});


// =========================================================================
// SISTEMA DE VERSÃO E VERIFICAÇÃO DE ATUALIZAÇÕES ONLINE (OTA & DESKTOP)
// =========================================================================

function compareSemanticVersions(v1, v2) {
  const parts1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

let latestUpdateData = null;

window.checkAppUpdates = async function(isManualClick = false) {
  const currentVer = (typeof finance !== 'undefined' && finance.getAppVersion) ? finance.getAppVersion() : '1.0.0';
  const pillText = document.getElementById('sidebarVersionText');
  const pillDot = document.getElementById('sidebarVersionDot');
  const pillBadge = document.getElementById('sidebarVersionBadge');

  if (pillText) pillText.textContent = `Valore v${currentVer}`;

  if (isManualClick && pillBadge) {
    pillBadge.textContent = 'Verificando...';
  }

  // Endpoints de verificação: 
  // 1. Repositório oficial GitHub (produção)
  // 2. Fallback relativo local /version.json
  const endpoints = [
    'https://raw.githubusercontent.com/allantr4/valore/main/version.json',
    'version.json'
  ];

  let updateInfo = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (res.ok) {
        updateInfo = await res.json();
        break;
      }
    } catch (e) {
      // Tenta próximo endpoint
    }
  }

  if (!updateInfo || !updateInfo.version) {
    if (pillBadge) pillBadge.textContent = 'Atualizado';
    if (isManualClick) {
      showToast('Não foi possível conectar ao servidor de atualizações. Verifique sua conexão à internet.', 'warning');
    }
    return;
  }

  latestUpdateData = updateInfo;
  const isNewer = compareSemanticVersions(updateInfo.version, currentVer) > 0;

  if (isNewer) {
    if (pillDot) pillDot.className = 'version-dot has-update';
    if (pillBadge) {
      pillBadge.textContent = 'Novo!';
      pillBadge.className = 'version-badge has-update';
    }
    window.openUpdateModal(updateInfo, currentVer);
  } else {
    if (pillDot) pillDot.className = 'version-dot';
    if (pillBadge) {
      pillBadge.textContent = 'Atualizado';
      pillBadge.className = 'version-badge';
    }
    if (isManualClick) {
      showToast(`Você já está usando a versão mais recente do Valore (v${currentVer})!`, 'success');
    }
  }
};


// ==========================================
// CENTRAL DE NOTIFICAÇÕES & LEMBRETES DE VENCIMENTO
// ==========================================

window.renderDashboardDueAlertBanner = function() {
  const banner = document.getElementById('dashboardDueAlertBanner');
  if (!banner) return;

  const alerts = (typeof finance !== 'undefined' && finance.getPendingDueAlerts) ? finance.getPendingDueAlerts() : [];
  if (!alerts || alerts.length === 0) {
    banner.style.display = 'none';
    return;
  }

  const listEl = document.getElementById('dashboardDueAlertList');
  const countEl = document.getElementById('dashboardDueAlertCount');
  if (countEl) countEl.textContent = `${alerts.length} lembrete(s)`;

  if (listEl) {
    listEl.innerHTML = alerts.map(a => {
      let icon = 'clock';
      let badgeColor = 'var(--primary)';
      let badgeBg = 'rgba(59, 130, 246, 0.15)';
      let label = 'Vence em breve';

      if (a.type === 'overdue') {
        icon = 'alert-triangle';
        badgeColor = '#ef4444';
        badgeBg = 'rgba(239, 68, 68, 0.15)';
        label = 'Em Atraso';
      } else if (a.type === 'today') {
        icon = 'bell-ring';
        badgeColor = '#f59e0b';
        badgeBg = 'rgba(245, 158, 11, 0.15)';
        label = 'Vence Hoje';
      } else if (a.type === 'card_closing') {
        icon = 'credit-card';
        badgeColor = '#8b5cf6';
        badgeBg = 'rgba(139, 92, 246, 0.15)';
        label = 'Fatura Fechando';
      }

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.6rem 0.85rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: ${badgeBg}; color: ${badgeColor}; flex-shrink: 0;">
              <i data-lucide="${icon}" style="width: 15px; height: 15px;"></i>
            </span>
            <div style="min-width: 0;">
              <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.title}</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">${a.detail}</div>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${typeof currencyFormatter !== 'undefined' ? currencyFormatter.format(a.amount || 0) : 'R$ ' + (a.amount || 0)}</div>
            <span style="display: inline-block; font-size: 0.68rem; font-weight: 600; padding: 0.15rem 0.4rem; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor};">${label}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  banner.style.display = 'block';
  if (window.lucide) lucide.createIcons();
};

window.updateHeaderNotificationBadge = function() {
  const badgeHeader = document.getElementById('headerNotificationBadge');
  const badgeSidebar = document.getElementById('sidebarNotificationBadge');
  const settings = (typeof finance !== 'undefined' && finance.getNotificationSettings) ? finance.getNotificationSettings() : { enabled: true };

  if (!settings.enabled) {
    if (badgeHeader) badgeHeader.style.display = 'none';
    if (badgeSidebar) badgeSidebar.style.display = 'none';
    return;
  }

  const alerts = (typeof finance !== 'undefined' && finance.getPendingDueAlerts) ? finance.getPendingDueAlerts() : [];
  const count = alerts.length;

  if (count > 0) {
    if (badgeHeader) {
      badgeHeader.textContent = count > 99 ? '99+' : count;
      badgeHeader.style.display = 'flex';
    }
    if (badgeSidebar) {
      badgeSidebar.textContent = count > 99 ? '99+' : count;
      badgeSidebar.style.display = 'inline-block';
    }
  } else {
    if (badgeHeader) badgeHeader.style.display = 'none';
    if (badgeSidebar) badgeSidebar.style.display = 'none';
  }
};

window.openNotificationSettingsModal = function() {
  const modal = document.getElementById('notificationSettingsModal');
  if (!modal) return;

  const settings = (typeof finance !== 'undefined' && finance.getNotificationSettings) ? finance.getNotificationSettings() : {};

  const masterEl = document.getElementById('notifyMasterSwitch');
  const dueDayEl = document.getElementById('notifyOnDueDay');
  const dueTimeEl = document.getElementById('notifyDueDayTime');
  const daysBeforeEl = document.getElementById('notifyDaysBeforeSelect');
  const overdueEl = document.getElementById('notifyOverdue');
  const cardClosingEl = document.getElementById('notifyCreditCardClosing');
  const bankReaderEl = document.getElementById('notifyBankReader');

  if (masterEl) masterEl.checked = settings.enabled !== false;
  if (dueDayEl) dueDayEl.checked = settings.notifyOnDueDay !== false;
  if (dueTimeEl) dueTimeEl.value = settings.dueDayTime || '09:00';
  if (daysBeforeEl) daysBeforeEl.value = String(settings.notifyDaysBefore !== undefined ? settings.notifyDaysBefore : 2);
  if (overdueEl) overdueEl.checked = settings.notifyOverdue !== false;
  if (cardClosingEl) cardClosingEl.checked = settings.notifyCreditCardClosing !== false;
  if (bankReaderEl) bankReaderEl.checked = !!settings.bankNotificationReader;

  modal.classList.add('open');
  if (window.lucide) lucide.createIcons();
};

window.closeNotificationSettingsModal = function() {
  const modal = document.getElementById('notificationSettingsModal');
  if (modal) modal.classList.remove('open');
};

window.saveNotificationSettingsFromModal = function() {
  const masterEl = document.getElementById('notifyMasterSwitch');
  const dueDayEl = document.getElementById('notifyOnDueDay');
  const dueTimeEl = document.getElementById('notifyDueDayTime');
  const daysBeforeEl = document.getElementById('notifyDaysBeforeSelect');
  const overdueEl = document.getElementById('notifyOverdue');
  const cardClosingEl = document.getElementById('notifyCreditCardClosing');
  const bankReaderEl = document.getElementById('notifyBankReader');

  const newSettings = {
    enabled: masterEl ? masterEl.checked : true,
    notifyOnDueDay: dueDayEl ? dueDayEl.checked : true,
    dueDayTime: dueTimeEl ? dueTimeEl.value : '09:00',
    notifyDaysBefore: daysBeforeEl ? parseInt(daysBeforeEl.value, 10) : 2,
    notifyOverdue: overdueEl ? overdueEl.checked : true,
    notifyCreditCardClosing: cardClosingEl ? cardClosingEl.checked : true,
    bankNotificationReader: bankReaderEl ? bankReaderEl.checked : false
  };

  if (typeof finance !== 'undefined' && finance.saveNotificationSettings) {
    finance.saveNotificationSettings(newSettings);
  }

  if (newSettings.enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  if (typeof showToast === 'function') {
    showToast('Configurações de notificações e lembretes salvas com sucesso!', 'success');
  }

  window.closeNotificationSettingsModal();
  window.updateHeaderNotificationBadge();
  window.renderDashboardDueAlertBanner();
};

window.testNotificationTrigger = function() {
  const title = 'Lembrete Valore Financeiro';
  const body = 'Você tem um alerta de teste: lembrete de vencimento configurado com sucesso!';

  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          icon: 'assets/logo_completo.png'
        });
      } catch (e) {
        console.warn('Erro ao disparar Web Notification:', e);
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body: body, icon: 'assets/logo_completo.png' });
        }
      });
    }
  }

  if (typeof showToast === 'function') {
    showToast('🔔 Notificação de teste emitida com sucesso!', 'info');
  }
};

function setupNotificationListeners() {
  const btnHeader = document.getElementById('btnOpenNotificationSettings');
  const btnSidebar = document.getElementById('btnSidebarNotifications');
  const btnClose = document.getElementById('btnCloseNotificationSettingsModal');
  const btnCancel = document.getElementById('btnCancelNotificationSettings');
  const btnSave = document.getElementById('btnSaveNotificationSettings');
  const btnTest = document.getElementById('btnTestNotification');
  const btnViewBills = document.getElementById('btnDashboardViewPendingBills');

  if (btnHeader) btnHeader.addEventListener('click', window.openNotificationSettingsModal);
  if (btnSidebar) btnSidebar.addEventListener('click', window.openNotificationSettingsModal);
  if (btnClose) btnClose.addEventListener('click', window.closeNotificationSettingsModal);
  if (btnCancel) btnCancel.addEventListener('click', window.closeNotificationSettingsModal);
  if (btnSave) btnSave.addEventListener('click', window.saveNotificationSettingsFromModal);
  if (btnTest) btnTest.addEventListener('click', window.testNotificationTrigger);

  if (btnViewBills) {
    btnViewBills.addEventListener('click', () => {
      if (typeof switchTab === 'function') {
        switchTab('transactions');
      }
    });
  }
}

window.openUpdateModal = function(info, currentVer) {
  const modal = document.getElementById('updateModal');
  if (!modal) return;

  const titleEl = document.getElementById('updateModalTitle');
  const curVerEl = document.getElementById('updateCurrentVersion');
  const newVerEl = document.getElementById('updateNewVersion');
  const changelogEl = document.getElementById('updateChangelogList');
  const actionBtnText = document.getElementById('btnActionUpdateText');
  const btnAction = document.getElementById('btnActionUpdate');
  const btnDismiss = document.getElementById('btnDismissUpdate');
  const btnClose = document.getElementById('btnCloseUpdateModal');
  const progressContainer = document.getElementById('updateProgressContainer');
  const progressBar = document.getElementById('updateProgressBar');
  const progressPercent = document.getElementById('updateProgressPercent');
  const progressStatus = document.getElementById('updateProgressStatus');
  const progressDetail = document.getElementById('updateProgressDetail');

  if (titleEl) titleEl.textContent = info.title || 'Nova Atualização Disponível!';
  if (curVerEl) curVerEl.textContent = `v${currentVer}`;
  if (newVerEl) newVerEl.textContent = `v${info.version}`;

  // Reseta estado do progresso embutido
  if (progressContainer) progressContainer.style.display = 'none';
  if (progressBar) progressBar.style.width = '0%';
  if (progressPercent) progressPercent.textContent = '0%';
  if (progressStatus) {
    progressStatus.textContent = 'Baixando atualização...';
    progressStatus.style.color = 'var(--primary)';
  }
  if (progressDetail) progressDetail.textContent = 'Conectando aos servidores do Valore...';

  // Habilita controles
  if (btnAction) btnAction.disabled = false;
  if (btnDismiss) btnDismiss.disabled = false;
  if (btnClose) btnClose.disabled = false;
  const btnUpdateViaBrowser = document.getElementById('btnUpdateViaBrowser');
  if (btnUpdateViaBrowser) btnUpdateViaBrowser.style.display = 'inline-flex';

  if (changelogEl) {
    if (Array.isArray(info.notes) && info.notes.length > 0) {
      changelogEl.innerHTML = '<ul style="margin: 0; padding-left: 1.15rem; display: flex; flex-direction: column; gap: 0.35rem;">' +
        info.notes.map(note => `<li>${note}</li>`).join('') +
        '</ul>';
    } else {
      changelogEl.innerHTML = '<p style="margin: 0;">Melhorias contínuas de estabilidade, desempenho e interface.</p>';
    }
  }

  // Define texto do botão conforme a plataforma
  const isDesktop = (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.downloadAndInstallUpdate === 'function');
  const isAndroid = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android');

  if (actionBtnText) {
    if (isDesktop || (typeof window !== 'undefined' && window.AndroidAppUpdater) || isAndroid) {
      actionBtnText.textContent = 'Atualizar Agora (1-Clique)';
    } else {
      actionBtnText.textContent = 'Ver Atualização no GitHub';
    }
  }

  modal.classList.add('open');
  if (window.lucide) lucide.createIcons();
};

function setupUpdateModalListeners() {
  const modal = document.getElementById('updateModal');
  const btnClose = document.getElementById('btnCloseUpdateModal');
  const btnDismiss = document.getElementById('btnDismissUpdate');
  const btnAction = document.getElementById('btnActionUpdate');

  const closeUpdate = () => {
    if (modal) modal.classList.remove('open');
  };

  if (btnClose) btnClose.addEventListener('click', closeUpdate);

  // Blindagem anti-travamento de foco e retorno de configurações do Android
  const unlockUpdateControls = () => {
    const bAction = document.getElementById('btnActionUpdate');
    const bDismiss = document.getElementById('btnDismissUpdate');
    const bClose = document.getElementById('btnCloseUpdateModal');
    if (bDismiss) bDismiss.disabled = false;
    if (bClose) bClose.disabled = false;
    if (bAction) bAction.disabled = false;
  };

  window.addEventListener('focus', unlockUpdateControls);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockUpdateControls();
  });

  const btnUpdateViaBrowser = document.getElementById('btnUpdateViaBrowser');
  if (btnUpdateViaBrowser) {
    btnUpdateViaBrowser.addEventListener('click', () => {
      const targetUrl = (latestUpdateData && (latestUpdateData.downloadUrlApk || latestUpdateData.githubReleaseUrl)) || 'https://github.com/allantr4/valore/releases';
      try {
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(targetUrl);
        } else {
          window.open(targetUrl, '_blank');
        }
      } catch (e) {
        window.open(targetUrl, '_blank');
      }
      closeUpdate();
    });
  }

  if (btnDismiss) btnDismiss.addEventListener('click', closeUpdate);

  // Registra ouvintes para download e progresso no Mobile Android
  window.onAndroidUpdateProgress = function(percent, transferredMb, totalMb) {
    const progressContainer = document.getElementById('updateProgressContainer');
    const progressBar = document.getElementById('updateProgressBar');
    const progressPercent = document.getElementById('updateProgressPercent');
    const progressDetail = document.getElementById('updateProgressDetail');
    const progressStatus = document.getElementById('updateProgressStatus');
    const actionBtnText = document.getElementById('btnActionUpdateText');

    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressDetail) {
      progressDetail.textContent = totalMb > 0
        ? `${transferredMb} MB de ${totalMb} MB baixados`
        : `${transferredMb} MB baixados`;
    }

    if (percent >= 100) {
      if (progressStatus) {
        progressStatus.textContent = 'Download concluído! Abrindo instalador...';
        progressStatus.style.color = '#10b981';
      }
      if (actionBtnText) actionBtnText.textContent = 'Instalando...';
    }
  };

  window.onAndroidUpdateError = function(errMsg) {
    const progressStatus = document.getElementById('updateProgressStatus');
    const progressDetail = document.getElementById('updateProgressDetail');
    const actionBtnText = document.getElementById('btnActionUpdateText');
    if (progressStatus) {
      progressStatus.textContent = 'Falha no download da atualização.';
      progressStatus.style.color = '#ef4444';
    }
    if (progressDetail) progressDetail.textContent = errMsg || 'Erro de conexão ou arquivo inacessível.';
    if (actionBtnText) actionBtnText.textContent = 'Baixar no Navegador';

    const btnAction = document.getElementById('btnActionUpdate');
    const btnDismiss = document.getElementById('btnDismissUpdate');
    const btnClose = document.getElementById('btnCloseUpdateModal');
    if (btnAction) btnAction.disabled = false;
    if (btnDismiss) btnDismiss.disabled = false;
    if (btnClose) btnClose.disabled = false;
    if (typeof showToast === 'function') showToast('Não foi possível concluir o download automático. Você pode baixar pelo navegador.', 'warning');
  };

  window.onAndroidPermissionPending = function() {
    const progressContainer = document.getElementById('updateProgressContainer');
    const progressStatus = document.getElementById('updateProgressStatus');
    const progressDetail = document.getElementById('updateProgressDetail');
    const actionBtnText = document.getElementById('btnActionUpdateText');
    const btnAction = document.getElementById('btnActionUpdate');
    const btnDismiss = document.getElementById('btnDismissUpdate');
    const btnClose = document.getElementById('btnCloseUpdateModal');

    if (progressContainer) progressContainer.style.display = 'block';
    if (progressStatus) {
      progressStatus.textContent = 'Permissão necessária nas Configurações';
      progressStatus.style.color = '#f59e0b';
    }
    if (progressDetail) {
      progressDetail.textContent = 'Ative "Permitir desta fonte" para o Valore e retorne ao aplicativo.';
    }
    if (actionBtnText) actionBtnText.textContent = 'Concluir Instalação';

    if (btnAction) btnAction.disabled = false;
    if (btnDismiss) btnDismiss.disabled = false;
    if (btnClose) btnClose.disabled = false;
  };

  window.onAndroidInstallReady = function() {
    const progressContainer = document.getElementById('updateProgressContainer');
    const progressStatus = document.getElementById('updateProgressStatus');
    const progressDetail = document.getElementById('updateProgressDetail');
    const actionBtnText = document.getElementById('btnActionUpdateText');
    const btnAction = document.getElementById('btnActionUpdate');
    const btnDismiss = document.getElementById('btnDismissUpdate');
    const btnClose = document.getElementById('btnCloseUpdateModal');

    if (progressContainer) progressContainer.style.display = 'block';
    if (progressStatus) {
      progressStatus.textContent = 'Instalador pronto!';
      progressStatus.style.color = '#10b981';
    }
    if (progressDetail) {
      progressDetail.textContent = 'Confirme a atualização na tela do Android.';
    }
    if (actionBtnText) actionBtnText.textContent = 'Abrir Instalador';

    if (btnAction) btnAction.disabled = false;
    if (btnDismiss) btnDismiss.disabled = false;
    if (btnClose) btnClose.disabled = false;
  };

  // Registra ouvintes IPC para download e progresso em tempo real no Desktop
  if (typeof window !== 'undefined' && window.electronAPI) {
    if (typeof window.electronAPI.onUpdateProgress === 'function') {
      window.electronAPI.onUpdateProgress((data) => {
        const progressContainer = document.getElementById('updateProgressContainer');
        const progressBar = document.getElementById('updateProgressBar');
        const progressPercent = document.getElementById('updateProgressPercent');
        const progressDetail = document.getElementById('updateProgressDetail');
        const progressStatus = document.getElementById('updateProgressStatus');
        const actionBtnText = document.getElementById('btnActionUpdateText');

        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = `${data.percent}%`;
        if (progressPercent) progressPercent.textContent = `${data.percent}%`;
        if (progressDetail) {
          progressDetail.textContent = data.totalMb !== '?'
            ? `${data.transferredMb} MB de ${data.totalMb} MB baixados`
            : `${data.transferredMb} MB baixados`;
        }

        if (data.percent >= 100) {
          if (progressStatus) {
            progressStatus.textContent = 'Download concluído! Iniciando instalação...';
            progressStatus.style.color = '#10b981';
          }
          if (actionBtnText) actionBtnText.textContent = 'Reiniciando o Valore...';
        }
      });
    }

    if (typeof window.electronAPI.onUpdateError === 'function') {
      window.electronAPI.onUpdateError((errMsg) => {
        const progressStatus = document.getElementById('updateProgressStatus');
        const progressDetail = document.getElementById('updateProgressDetail');
        const actionBtnText = document.getElementById('btnActionUpdateText');
        if (progressStatus) {
          progressStatus.textContent = 'Falha no download da atualização.';
          progressStatus.style.color = '#ef4444';
        }
        if (progressDetail) progressDetail.textContent = errMsg || 'Erro de conexão ou arquivo inacessível.';
        if (actionBtnText) actionBtnText.textContent = 'Baixar no Navegador';

        if (btnAction) btnAction.disabled = false;
        if (btnDismiss) btnDismiss.disabled = false;
        if (btnClose) btnClose.disabled = false;
        showToast('Não foi possível concluir o download automático. Você pode baixar pelo navegador.', 'warning');
      });
    }
  }

  if (btnAction) {
    btnAction.addEventListener('click', () => {
      if (!latestUpdateData) return;
      const isDesktop = (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.downloadAndInstallUpdate === 'function');
      const isAndroid = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android');

      let targetUrl = latestUpdateData.githubReleaseUrl || 'https://github.com/allantr4/valore/releases';
      if (isDesktop && latestUpdateData.downloadUrlDesktop) {
        targetUrl = latestUpdateData.downloadUrlDesktop;
      } else if (isAndroid && latestUpdateData.downloadUrlApk) {
        targetUrl = latestUpdateData.downloadUrlApk;
      }

      // Se estiver no Desktop e o instalador suportar download nativo
      if (isDesktop && latestUpdateData.downloadUrlDesktop) {
        const actionBtnText = document.getElementById('btnActionUpdateText');
        // Se o botão já falhou e virou fallback para o navegador
        if (actionBtnText && actionBtnText.textContent.includes('Navegador')) {
          if (window.electronAPI.openExternal) window.electronAPI.openExternal(targetUrl);
          else window.open(targetUrl, '_blank');
          closeUpdate();
          return;
        }

        const progressContainer = document.getElementById('updateProgressContainer');
        const progressStatus = document.getElementById('updateProgressStatus');
        const progressDetail = document.getElementById('updateProgressDetail');
        const progressBar = document.getElementById('updateProgressBar');
        const progressPercent = document.getElementById('updateProgressPercent');

        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressStatus) {
          progressStatus.textContent = 'Baixando atualização...';
          progressStatus.style.color = 'var(--primary)';
        }
        if (progressDetail) progressDetail.textContent = 'Conectando ao GitHub Releases...';

        btnAction.disabled = true;
        if (btnDismiss) btnDismiss.disabled = true;
        if (btnClose) btnClose.disabled = true;
        if (actionBtnText) actionBtnText.textContent = 'Baixando atualização...';

        window.electronAPI.downloadAndInstallUpdate(targetUrl).then((res) => {
          if (res && res.success) {
            if (progressStatus) {
              progressStatus.textContent = 'Instalando atualização e reiniciando o Valore...';
              progressStatus.style.color = '#10b981';
            }
          }
        }).catch((err) => {
          console.error('Erro ao acionar atualizador:', err);
        });
        return;
      }

      // Se for Mobile Android com suporte a atualizador embutido
      if (typeof window !== 'undefined' && window.AndroidAppUpdater && latestUpdateData.downloadUrlApk) {
        const actionBtnText = document.getElementById('btnActionUpdateText');
        if (actionBtnText && actionBtnText.textContent.includes('Navegador')) {
          window.open(targetUrl, '_blank');
          closeUpdate();
          return;
        }

        // Se o arquivo já foi baixado ou requer apenas retry de instalação
        if (actionBtnText && (actionBtnText.textContent.includes('Concluir') || actionBtnText.textContent.includes('Instalador'))) {
          try {
            window.AndroidAppUpdater.retryInstall();
          } catch (e) {
            window.AndroidAppUpdater.downloadAndInstall(latestUpdateData.downloadUrlApk);
        setTimeout(unlockUpdateControls, 12000);
          }
          return;
        }

        const progressContainer = document.getElementById('updateProgressContainer');
        const progressStatus = document.getElementById('updateProgressStatus');
        const progressDetail = document.getElementById('updateProgressDetail');
        const progressBar = document.getElementById('updateProgressBar');
        const progressPercent = document.getElementById('updateProgressPercent');

        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressStatus) {
          progressStatus.textContent = 'Baixando atualização...';
          progressStatus.style.color = 'var(--primary)';
        }
        if (progressDetail) progressDetail.textContent = 'Conectando ao servidor do Valore...';

        btnAction.disabled = true;
        if (btnDismiss) btnDismiss.disabled = true;
        if (btnClose) btnClose.disabled = true;
        if (actionBtnText) actionBtnText.textContent = 'Baixando APK...';

        try {
          window.AndroidAppUpdater.downloadAndInstall(latestUpdateData.downloadUrlApk);
        } catch (err) {
          console.error('Falha ao acionar AndroidAppUpdater:', err);
          window.open(targetUrl, '_blank');
          closeUpdate();
        }
        return;
      }

      // No Mobile Android ou fallback Web
      try {
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(targetUrl);
        } else {
          window.open(targetUrl, '_blank');
        }
      } catch (err) {
        window.open(targetUrl, '_blank');
      }
      closeUpdate();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupCalculator();
  initPerformanceMode();
  initMobileBackButtonListener();
  setupUpdateModalListeners();
  setupNotificationListeners();
  setTimeout(() => { if (window.updateHeaderNotificationBadge) window.updateHeaderNotificationBadge(); }, 1000);
  setTimeout(() => {
    window.checkAppUpdates(false);
  }, 3000);
});
