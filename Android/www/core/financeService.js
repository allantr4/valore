/**
 * Valore - Core FinanceService (Agnóstico de Plataforma)
 * Suporte completo:
 * - Receitas, Despesas, Transferências entre Contas
 * - Compras Parceladas com Desdobramento Mensal Automático
 * - Agendamentos de Contas (A Pagar / A Receber) com Alertas e Status (pendente, pago, atrasado)
 * - Projeção de Fluxo de Caixa Futuro (Saldo dia a dia)
 * - Cartões de Crédito (Fechamento de Fatura, Vencimento e Limite)
 * - Bens & Financiamentos (Imóveis, Veículos, Dívidas Amortizáveis)
 * - Orçamentos (Previsto vs Realizado)
 * - Metas Financeiras com Aportes
 * - Importador OFX / CSV
 */

// --- UTILITÁRIOS DE PRECISÃO ---
// Data no fuso local (Brasília). Nunca usar toISOString() para "hoje": ele usa UTC e,
// a partir das 21h, retornaria o dia seguinte.
function localDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Arredondamento monetário seguro para 2 casas (evita resíduos como 103.49000000000001)
function round2(n) {
  const v = Number(n) || 0;
  return Math.round((v + (v >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100;
}

// Gerador de ID único com proteção contra colisões síncronas em lote
let _entityIdCounter = 0;
function genId(prefix = 'id') {
  _entityIdCounter = (_entityIdCounter + 1) % 1000000;
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${Date.now()}-${_entityIdCounter}-${rand}`;
}

class FinanceService {
  constructor(storageAdapter) {
    this.storage = storageAdapter;
    this._saveQueue = Promise.resolve();
    this.state = {
      accounts: [],
      categories: [],
      transactions: [],
      schedules: [], // Agendamentos / Contas a Pagar e Receber
      assets: [],    // Bens & Financiamentos
      budgets: [],   // Orçamentos por categoria
      goals: [],     // Metas & Sonhos
      vaults: [],    // Cofrinhos / Caixinhas / Reservas estilo Mercado Pago
      costCenters: [], // Centros de Custo para Viagens, Reformas e Eventos
      sideHustles: [], // Módulo de Renda Extra / Projetos Paralelos
      firePlanning: {  // Módulo de Liberdade Financeira (O Norte / FIRE)
        currentAge: 32,
        targetAge: 55,
        desiredMonthlyIncome: 10000,
        safeWithdrawalRate: 5.0, // % real a.a. acima da inflação
        monthlyContribution: 2500,
        includePhysicalAssets: false
      },
      couple: {
        enabled: true,
        partner1: { name: 'Você', monthlyIncome: 6000, color: '#3b82f6', pixKey: '', avatar: 'user' },
        partner2: { name: 'Parceiro(a)', monthlyIncome: 4000, color: '#ec4899', pixKey: '', avatar: 'heart' },
        splitMode: 'proportional', // 'proportional' | 'equal' | 'fixed_quota' | 'custom'
        proportionalRatio: { p1: 60, p2: 40 },
        fixedQuotaAmount: 2000,
        jointHouseAccountName: 'Despesas do Lar'
      },
      coupleSettlements: [],
      syncMeta: {
        deviceId: genId('dev'),
        lastSyncAt: null,
        lastModifiedAt: Date.now(),
        deletedIds: {}
      },
      settings: {
        currency: 'BRL',
        theme: 'auto',
        startDayOfMonth: 1
      }
    };
  }

  // --- IDENTIDADE POR DISPOSITIVO (4 APARELHOS: PC E CELULAR DE CADA PARCEIRO) ---
  getDeviceIdentity() {
    let saved = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('valore_device_identity_v1');
        if (raw) saved = JSON.parse(raw);
      }
    } catch (_) {}

    const isMobileEnv = (typeof window !== 'undefined')
      ? (!window.electronAPI && (window.innerWidth <= 900 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '')))
      : false;

    const ownerRole = (saved && (saved.ownerRole === 'p1' || saved.ownerRole === 'p2')) ? saved.ownerRole : 'p1';
    const deviceType = (saved && (saved.deviceType === 'pc' || saved.deviceType === 'mobile'))
      ? saved.deviceType
      : (isMobileEnv ? 'mobile' : 'pc');

    const couple = (this.state && this.state.couple) ? this.state.couple : null;
    const p1Name = (couple && couple.partner1 && couple.partner1.name) ? couple.partner1.name : 'Você';
    const p2Name = (couple && couple.partner2 && couple.partner2.name) ? couple.partner2.name : 'Parceiro(a)';
    const p1Color = (couple && couple.partner1 && couple.partner1.color) ? couple.partner1.color : '#3b82f6';
    const p2Color = (couple && couple.partner2 && couple.partner2.color) ? couple.partner2.color : '#ec4899';
    const p1Avatar = (couple && couple.partner1 && couple.partner1.avatar) ? couple.partner1.avatar : 'user';
    const p2Avatar = (couple && couple.partner2 && couple.partner2.avatar) ? couple.partner2.avatar : 'heart';

    const ownerName = ownerRole === 'p2' ? p2Name : p1Name;
    const ownerColor = ownerRole === 'p2' ? p2Color : p1Color;
    const ownerAvatar = ownerRole === 'p2' ? p2Avatar : p1Avatar;
    const deviceIcon = deviceType === 'mobile' ? '📱' : '💻';
    const deviceLabel = deviceType === 'mobile' ? 'Celular' : 'PC';

    return {
      ownerRole,
      ownerName,
      ownerColor,
      ownerAvatar,
      deviceType,
      deviceIcon,
      deviceLabel,
      p1Name,
      p2Name,
      p1Color,
      p2Color,
      p1Avatar,
      p2Avatar,
      coupleEnabled: couple ? couple.enabled !== false : true
    };
  }

  async setDeviceIdentity(options = {}) {
    const current = this.getDeviceIdentity();
    const nextRole = (options.ownerRole === 'p1' || options.ownerRole === 'p2') ? options.ownerRole : current.ownerRole;
    const nextDeviceType = (options.deviceType === 'pc' || options.deviceType === 'mobile') ? options.deviceType : current.deviceType;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('valore_device_identity_v1', JSON.stringify({
          ownerRole: nextRole,
          deviceType: nextDeviceType,
          updatedAt: Date.now()
        }));
      }
    } catch (_) {}

    let stateChanged = false;
    if (!this.state.couple) {
      this.state.couple = {
        enabled: true,
        partner1: { name: 'Você', monthlyIncome: 6000, color: '#3b82f6', pixKey: '', avatar: 'user' },
        partner2: { name: 'Parceiro(a)', monthlyIncome: 4000, color: '#ec4899', pixKey: '', avatar: 'heart' },
        splitMode: 'proportional',
        proportionalRatio: { p1: 60, p2: 40 },
        fixedQuotaAmount: 2000,
        jointHouseAccountName: 'Despesas do Lar'
      };
      stateChanged = true;
    }

    if (typeof options.p1Name === 'string' && options.p1Name.trim()) {
      this.state.couple.partner1.name = options.p1Name.trim();
      stateChanged = true;
    }
    if (typeof options.p1Avatar === 'string' && options.p1Avatar.trim()) {
      this.state.couple.partner1.avatar = options.p1Avatar.trim();
      stateChanged = true;
    }
    if (typeof options.p1Color === 'string' && options.p1Color.trim()) {
      this.state.couple.partner1.color = options.p1Color.trim();
      stateChanged = true;
    }
    if (typeof options.p2Name === 'string' && options.p2Name.trim()) {
      this.state.couple.partner2.name = options.p2Name.trim();
      stateChanged = true;
    }
    if (typeof options.p2Avatar === 'string' && options.p2Avatar.trim()) {
      this.state.couple.partner2.avatar = options.p2Avatar.trim();
      stateChanged = true;
    }
    if (typeof options.p2Color === 'string' && options.p2Color.trim()) {
      this.state.couple.partner2.color = options.p2Color.trim();
      stateChanged = true;
    }

    if (stateChanged) {
      await this.save();
    }

    return this.getDeviceIdentity();
  }

  getEntityAuthorInfo(entity) {
    const identity = this.getDeviceIdentity();
    const role = (entity && (entity.createdBy === 'p2' || (!entity.createdBy && entity.paidBy === 'p2'))) ? 'p2' : 'p1';
    const deviceType = (entity && (entity.createdDevice === 'mobile' || entity.createdDevice === 'pc'))
      ? entity.createdDevice
      : 'pc';
    return {
      role,
      name: role === 'p2' ? identity.p2Name : identity.p1Name,
      color: role === 'p2' ? identity.p2Color : identity.p1Color,
      avatar: role === 'p2' ? identity.p2Avatar : identity.p1Avatar,
      deviceType,
      deviceIcon: deviceType === 'mobile' ? '📱' : '💻',
      deviceLabel: deviceType === 'mobile' ? 'Celular' : 'PC'
    };
  }

  _touchEntity(entity, authorOverride = null) {
    if (entity && typeof entity === 'object') {
      const identity = this.getDeviceIdentity();
      const role = (authorOverride === 'p1' || authorOverride === 'p2')
        ? authorOverride
        : (entity.createdBy || identity.ownerRole || 'p1');
      if (!entity.createdBy || authorOverride === 'p1' || authorOverride === 'p2') {
        entity.createdBy = role;
        entity.createdByName = role === 'p2' ? identity.p2Name : identity.p1Name;
      }
      if (!entity.createdDevice) {
        entity.createdDevice = identity.deviceType;
      }
      entity.updatedBy = (authorOverride === 'p1' || authorOverride === 'p2') ? authorOverride : identity.ownerRole;
      entity.updatedDevice = identity.deviceType;
      entity.updatedAt = Date.now();
    }
    if (!this.state.syncMeta) {
      this.state.syncMeta = { deviceId: genId('dev'), lastSyncAt: null, lastModifiedAt: Date.now(), deletedIds: {} };
    }
    this.state.syncMeta.lastModifiedAt = Date.now();
    return entity;
  }

  _recordDeletion(id) {
    if (!id) return;
    if (!this.state.syncMeta) {
      this.state.syncMeta = { deviceId: genId('dev'), lastSyncAt: null, lastModifiedAt: Date.now(), deletedIds: {} };
    }
    if (!this.state.syncMeta.deletedIds) {
      this.state.syncMeta.deletedIds = {};
    }
    this.state.syncMeta.deletedIds[id] = Date.now();
    this.state.syncMeta.lastModifiedAt = Date.now();
  }

  getAppVersion() {
    return '1.1.1';
  }

  getAppBuildDate() {
    return 'Novembro/2026';
  }

  async init() {
    const saved = await this.storage.get();
    if (saved && saved.transactions) {
      this.state = saved;
      if (!this.state.schedules) this.state.schedules = [];
      if (!this.state.assets) this.state.assets = [];
      if (!this.state.vaults) this.state.vaults = [];
      if (!this.state.costCenters) this.state.costCenters = [];
      if (!this.state.sideHustles) this.state.sideHustles = [];
      if (!this.state.couple) {
        this.state.couple = {
          enabled: true,
          partner1: { name: 'Você', monthlyIncome: 6000, color: '#3b82f6', pixKey: '', avatar: 'user' },
          partner2: { name: 'Parceiro(a)', monthlyIncome: 4000, color: '#ec4899', pixKey: '', avatar: 'heart' },
          splitMode: 'proportional',
          proportionalRatio: { p1: 60, p2: 40 },
          fixedQuotaAmount: 2000,
          jointHouseAccountName: 'Despesas do Lar'
        };
      }
      if (!this.state.coupleSettlements) {
        this.state.coupleSettlements = [];
      }
      if (!this.state.syncMeta) {
        this.state.syncMeta = {
          deviceId: genId('dev'),
          lastSyncAt: null,
          lastModifiedAt: Date.now(),
          deletedIds: {}
        };
      }
      if (!this.state.syncMeta.deletedIds) {
        this.state.syncMeta.deletedIds = {};
      }
      if (!this.state.firePlanning) {
        this.state.firePlanning = {
          currentAge: 32,
          targetAge: 55,
          desiredMonthlyIncome: 10000,
          safeWithdrawalRate: 5.0,
          monthlyContribution: 2500,
          includePhysicalAssets: false
        };
      }

      // Retrocompatibilidade: garante campo vaulted para contas
      this.state.accounts.forEach(a => {
        if (a.vaulted === undefined) a.vaulted = 0;
      });

      // Se houver saldo em a.vaulted mas nenhum cofrinho em this.state.vaults, cria uma Reserva Padrão automática
      this.state.accounts.forEach(a => {
        if (a.type !== 'credit' && a.vaulted > 0) {
          const hasVault = this.state.vaults.some(v => v.accountId === a.id);
          if (!hasVault) {
            this.state.vaults.push({
              id: genId('vault') + '-' + a.id,
              accountId: a.id,
              name: 'Reserva de Emergência',
              icon: 'shield-check',
              color: '#10b981',
              balance: a.vaulted,
              target: Math.max(a.vaulted * 2, 5000),
              yieldRate: 105, // 105% do CDI
              createdAt: localDateStr()
            });
          }
        }
      });

      // Retrocompatibilidade: atualiza regras de agendamento de salário existentes
      this.state.schedules.forEach(s => {
        if (s.type === 'income' && !s.dayRule) {
          if (s.description && (s.description.toLowerCase().includes('salário') || s.description.toLowerCase().includes('salario'))) {
            s.dayRule = '5th_business_clt';
          }
        }
      });

      // Retrocompatibilidade: define bankId para contas existentes baseado no nome ou tipo
      this.state.accounts.forEach(a => {
        if (!a.bankId) {
          const n = (a.name || '').toLowerCase();
          if (n.includes('nubank') || n.includes('nu ')) a.bankId = 'nubank';
          else if (n.includes('itaú') || n.includes('itau')) a.bankId = 'itau';
          else if (n.includes('bradesco')) a.bankId = 'bradesco';
          else if (n.includes('brasil') || n.includes('bb')) a.bankId = 'bb';
          else if (n.includes('caixa') || n.includes('cef')) a.bankId = 'caixa';
          else if (n.includes('santander')) a.bankId = 'santander';
          else if (n.includes('inter')) a.bankId = 'inter';
          else if (n.includes('c6')) a.bankId = 'c6';
          else if (n.includes('xp')) a.bankId = 'xp';
          else if (n.includes('btg')) a.bankId = 'btg';
          else if (n.includes('mercado pago') || n.includes('mercadopago')) a.bankId = 'mercadopago';
          else if (n.includes('picpay')) a.bankId = 'picpay';
          else if (n.includes('sicoob')) a.bankId = 'sicoob';
          else if (n.includes('sicredi')) a.bankId = 'sicredi';
          else if (n.includes('safra')) a.bankId = 'safra';
          else if (n.includes('pagbank') || n.includes('pagseguro')) a.bankId = 'pagbank';
          else if (a.type === 'cash' || n.includes('dinheiro') || n.includes('carteira')) a.bankId = 'cash';
          else a.bankId = 'other';
        }
      });

      // Retrocompatibilidade: garante que aportes em cofrinho não sejam considerados despesas de consumo
      this.state.transactions.forEach(t => {
        if (t.description && (t.description.startsWith('[Cofrinho') || t.description.toLowerCase().includes('cofrinho criado'))) {
          t.isVaultAllocation = true;
          t.type = 'transfer';
        }
      });

      // Integridade: elimina resíduos de ponto flutuante em valores e saldos
      this.state.transactions.forEach(t => { if (typeof t.amount === 'number') t.amount = round2(t.amount); });
      this.state.accounts.forEach(a => {
        if (typeof a.balance === 'number') a.balance = round2(a.balance);
        if (typeof a.vaulted === 'number') a.vaulted = round2(a.vaulted);
      });
      this.state.vaults.forEach(v => { if (typeof v.balance === 'number') v.balance = round2(v.balance); });
      this.state.schedules.forEach(s => { if (typeof s.amount === 'number') s.amount = round2(s.amount); });

      // Integridade: vincula baixas antigas de boletos ao agendamento de origem (scheduleId)
      this.state.transactions.forEach(t => {
        if (t.scheduleId || t.type !== 'expense') return;
        const m = /^\[(Boleto Pago|Baixa)\]\s*(.*)$/.exec(t.description || '');
        if (!m) return;
        const sch = this.state.schedules.find(s => s.status === 'paid' && s.description === m[2] && (s.paidAt === t.date || Math.abs((s.paidAmount || s.amount) - t.amount) < 0.009));
        if (sch) t.scheduleId = sch.id;
      });

      // Retrocompatibilidade: Garante categorias essenciais de Receita (Benefícios & Auxílios, Outras Receitas)
      let benefitsCat = this.state.categories.find(c => c.type === 'income' && (c.name.toLowerCase().includes('benefício') || c.name.toLowerCase().includes('beneficio') || c.name.toLowerCase().includes('auxílio') || c.name.toLowerCase().includes('auxilio')));
      if (!benefitsCat) {
        benefitsCat = {
          id: 'cat-income-benefits',
          name: 'Benefícios & Auxílios (Seguro Desemprego, FGTS, INSS)',
          type: 'income',
          icon: 'shield-check',
          color: '#10b981'
        };
        this.state.categories.push(benefitsCat);
      }

      const hasOtherIncome = this.state.categories.some(c => c.type === 'income' && (c.name.toLowerCase().includes('outras receitas') || c.name.toLowerCase().includes('outras entradas')));
      if (!hasOtherIncome) {
        this.state.categories.push({
          id: 'cat-income-other',
          name: 'Outras Receitas & Reembolsos',
          type: 'income',
          icon: 'wallet',
          color: '#06b6d4'
        });
      }

      // Correção Automática Inteligente: Se houver transações de entrada (income) associadas indevidamente
      // a categorias de despesa (ex: Moradia & Aluguel), remaneja para Benefícios ou Salário
      this.state.transactions.forEach(t => {
        if (t.type === 'income') {
          const currentCat = this.state.categories.find(c => c.id === t.categoryId);
          const isAssignedToExpense = !currentCat || currentCat.type === 'expense';
          const desc = (t.description || '').toLowerCase();
          const isBenefit = /seguro[\s-]?desemprego|beneficio|benefício|auxilio|auxílio|fgts|inss|previdencia|previdência|pensao|pensão|restituicao|restituição|rescisao|rescisão|pis|pasep|indeniz/.test(desc);
          const isSalary = /salario|salário|folha|provent|vencimento|ordenado|remunerac|pro-labore|prolabore/.test(desc);

          if (isAssignedToExpense) {
            if (isBenefit) {
              t.categoryId = benefitsCat.id;
            } else if (isSalary) {
              const salaryCat = this.state.categories.find(c => c.type === 'income' && (c.name.toLowerCase().includes('salário') || c.name.toLowerCase().includes('salario')));
              t.categoryId = salaryCat ? salaryCat.id : 'cat-1';
            } else {
              t.categoryId = benefitsCat.id;
            }
          } else if (isBenefit && currentCat && !currentCat.name.toLowerCase().includes('benefício') && !currentCat.name.toLowerCase().includes('beneficio')) {
            // Se foi associado a 'Moradia' ou outra despesa mesmo com categoryId válido
            t.categoryId = benefitsCat.id;
          }
        }
      });

      // Correção Automática em agendamentos existentes
      this.state.schedules.forEach(s => {
        if (s.type === 'income') {
          const currentCat = this.state.categories.find(c => c.id === s.categoryId);
          const isAssignedToExpense = !currentCat || currentCat.type === 'expense';
          const desc = (s.description || '').toLowerCase();
          const isBenefit = /seguro[\s-]?desemprego|beneficio|benefício|auxilio|auxílio|fgts|inss|previdencia|previdência|pensao|pensão|restituicao|restituição|rescisao|rescisão|pis|pasep|indeniz/.test(desc);

          if (isAssignedToExpense || isBenefit) {
            s.categoryId = benefitsCat.id;
          }
        }
      });

      // Sincronização inteligente: garante que o saldo devedor do cartão reflita todas as despesas parceladas pendentes
      this.state.accounts.forEach(card => {
        if (card.type === 'credit') {
          const cardTxs = this.state.transactions.filter(t => t.accountId === card.id && t.type === 'expense');
          const totalExpenses = cardTxs.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
          const totalPayments = this.state.transactions.filter(t => t.toAccountId === card.id || (t.type === 'income' && t.accountId === card.id)).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
          const netDebt = Math.max(0, +(totalExpenses - totalPayments).toFixed(2));
          if (netDebt > 0 && Math.abs(card.balance || 0) < netDebt) {
            card.balance = -netDebt;
          }
        }
      });

      // Auto-limpeza de dados demonstrativos de fábrica caso o usuário já possua contas reais cadastradas
      if (this.purgeFactoryDemoIfRealDataExists(this.state)) {
        await this.save({ skipAutoSync: true });
      }
    } else {
      this.loadSeedData();
      await this.save({ skipAutoSync: true });
    }
    return this.state;
  }

  /**
   * Remove automaticamente dados demonstrativos de fábrica (seed inicial) caso o banco
   * já contenha contas reais criadas pelo usuário (evita contaminação ao sincronizar com app recém-instalado).
   */
  purgeFactoryDemoIfRealDataExists(targetState = this.state) {
    if (!targetState || !Array.isArray(targetState.accounts)) return false;
    const seedAccIds = new Set(['acc-1', 'acc-2', 'acc-3']);
    const seedNames = new Set(['conta principal (nubank)', 'reserva de emergência (itaú)', 'cartão black xp']);
    const hasRealAccounts = targetState.accounts.some(a => a && a.id && !seedAccIds.has(a.id));
    if (!hasRealAccounts) return false;

    const hasSeedContamination =
      targetState.accounts.some(a => a && (seedAccIds.has(a.id) || seedNames.has((a.name || '').trim().toLowerCase()))) ||
      (targetState.transactions || []).some(t => t && ['tx-1', 'tx-2', 'tx-3'].includes(t.id)) ||
      (targetState.schedules || []).some(s => s && ['sch-1', 'sch-2', 'sch-3'].includes(s.id)) ||
      (targetState.assets || []).some(as => as && ['ast-1', 'ast-2'].includes(as.id)) ||
      (targetState.goals || []).some(g => g && ['goal-1', 'goal-2'].includes(g.id));

    if (!targetState.syncMeta) {
      targetState.syncMeta = { deviceId: genId('dev'), lastSyncAt: null, lastModifiedAt: Date.now(), deletedIds: {} };
    }
    if (!targetState.syncMeta.deletedIds) targetState.syncMeta.deletedIds = {};

    const nowTs = Date.now() + 5000;
    const demoIds = ['acc-1', 'acc-2', 'acc-3', 'tx-1', 'tx-2', 'tx-3', 'sch-1', 'sch-2', 'sch-3', 'vault-1', 'ast-1', 'ast-2', 'goal-1', 'goal-2'];
    demoIds.forEach(id => {
      targetState.syncMeta.deletedIds[id] = nowTs;
    });

    if (!hasSeedContamination) return false;

    targetState.accounts = (targetState.accounts || []).filter(a => a && !seedAccIds.has(a.id));
    targetState.transactions = (targetState.transactions || []).filter(t => t && !['tx-1', 'tx-2', 'tx-3'].includes(t.id) && !seedAccIds.has(t.accountId));
    targetState.schedules = (targetState.schedules || []).filter(s => s && !['sch-1', 'sch-2', 'sch-3'].includes(s.id) && !seedAccIds.has(s.accountId));
    targetState.vaults = (targetState.vaults || []).filter(v => {
      if (!v) return false;
      if (v.id === 'vault-1' || seedAccIds.has(v.accountId) || String(v.id).endsWith('-acc-1')) {
        targetState.syncMeta.deletedIds[v.id] = nowTs;
        return false;
      }
      return true;
    });
    targetState.assets = (targetState.assets || []).filter(as => as && !['ast-1', 'ast-2'].includes(as.id));
    targetState.goals = (targetState.goals || []).filter(g => g && !['goal-1', 'goal-2'].includes(g.id));
    return true;
  }

  loadSeedData() {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = String(today.getMonth() + 1).padStart(2, '0');

    this.state.accounts = [
      { id: 'acc-1', name: 'Conta Principal (Nubank)', bankId: 'nubank', type: 'checking', balance: 6420.50, vaulted: 1500.00, color: '#820ad1' },
      { id: 'acc-2', name: 'Reserva de Emergência (Itaú)', bankId: 'itau', type: 'investment', balance: 22500.00, vaulted: 0, color: '#ec7000' },
      { id: 'acc-3', name: 'Cartão Black XP', bankId: 'xp', type: 'credit', balance: -1850.00, limit: 15000, closingDay: 25, dueDay: 5, color: '#000000' }
    ];

    this.state.categories = [
      { id: 'cat-1', name: 'Salário & Pro-labore', type: 'income', icon: 'wallet', color: '#10b981' },
      { id: 'cat-2', name: 'Investimentos & Dividendos', type: 'income', icon: 'trending-up', color: '#06b6d4' },
      { id: 'cat-3', name: 'Alimentação & Mercado', type: 'expense', icon: 'shopping-cart', color: '#f59e0b' },
      { id: 'cat-4', name: 'Moradia & Aluguel', type: 'expense', icon: 'home', color: '#ef4444' },
      { id: 'cat-5', name: 'Transporte & Veículo', type: 'expense', icon: 'car', color: '#6366f1' },
      { id: 'cat-6', name: 'Lazer & Viagens', type: 'expense', icon: 'coffee', color: '#ec4899' },
      { id: 'cat-7', name: 'Saúde & Cuidados', type: 'expense', icon: 'activity', color: '#14b8a6' },
      { id: 'cat-8', name: 'Transferência Interna', type: 'transfer', icon: 'repeat', color: '#8b5cf6' }
    ];

    this.state.transactions = [
      {
        id: 'tx-1',
        description: 'Salário Mensal',
        amount: 9200.00,
        type: 'income',
        categoryId: 'cat-1',
        accountId: 'acc-1',
        date: `${curYear}-${curMonth}-05`,
        status: 'paid',
        notes: 'Depósito em conta corrente'
      },
      {
        id: 'tx-2',
        description: 'Supermercado Mensal',
        amount: 980.50,
        type: 'expense',
        categoryId: 'cat-3',
        accountId: 'acc-3',
        date: `${curYear}-${curMonth}-06`,
        status: 'paid',
        notes: 'Alimentação'
      },
      {
        id: 'tx-3',
        description: 'Aluguel & Condomínio',
        amount: 2150.00,
        type: 'expense',
        categoryId: 'cat-4',
        accountId: 'acc-1',
        date: `${curYear}-${curMonth}-10`,
        status: 'paid',
        notes: 'Pagamento de moradia'
      }
    ];

    // Contas Agendadas (A pagar e a receber com alertas)
    this.state.schedules = [
      {
        id: 'sch-1',
        description: 'Fatura Cartão Black XP',
        amount: 1850.00,
        type: 'expense',
        dueDate: `${curYear}-${curMonth}-25`,
        categoryId: 'cat-8',
        accountId: 'acc-1',
        status: 'pending', // 'pending' | 'paid' | 'overdue'
        recurring: 'monthly'
      },
      {
        id: 'sch-2',
        description: 'Assinaturas & Softwares',
        amount: 149.90,
        type: 'expense',
        dueDate: `${curYear}-${curMonth}-20`,
        categoryId: 'cat-6',
        accountId: 'acc-1',
        status: 'pending',
        recurring: 'monthly'
      },
      {
        id: 'sch-3',
        description: 'Recebimento de Freelance / Consultoria',
        amount: 3500.00,
        type: 'income',
        dueDate: `${curYear}-${curMonth}-28`,
        categoryId: 'cat-1',
        accountId: 'acc-1',
        status: 'pending',
        recurring: 'none'
      }
    ];

    // Bens Patrimoniais & Financiamentos
    this.state.assets = [
      {
        id: 'ast-1',
        name: 'Apartamento Jardins',
        type: 'property',
        estimatedValue: 450000.00,
        financedValue: 180000.00,
        installmentsPaid: 48,
        installmentsTotal: 360,
        monthlyRate: 0.75
      },
      {
        id: 'ast-2',
        name: 'Veículo SUV Turbo',
        type: 'vehicle',
        estimatedValue: 125000.00,
        financedValue: 35000.00,
        installmentsPaid: 24,
        installmentsTotal: 48,
        monthlyRate: 1.15
      }
    ];

    this.state.budgets = [
      { id: 'bg-1', categoryId: 'cat-3', limit: 1400.00, period: 'monthly' },
      { id: 'bg-2', categoryId: 'cat-6', limit: 800.00, period: 'monthly' },
      { id: 'bg-3', categoryId: 'cat-5', limit: 650.00, period: 'monthly' }
    ];

    this.state.goals = [
      { id: 'goal-1', title: 'Viagem de Férias Europa', targetAmount: 20000, currentAmount: 11400, deadline: '2027-01-15', color: '#3b82f6' },
      { id: 'goal-2', title: 'Reserva para 12 Meses', targetAmount: 60000, currentAmount: 22500, deadline: '2027-12-31', color: '#10b981' }
    ];
  }

  async save(options = {}) {
    return new Promise((resolve, reject) => {
      this._saveQueue = this._saveQueue.then(async () => {
        try {
          if (!this.state.syncMeta) {
            this.state.syncMeta = { deviceId: genId('dev'), lastSyncAt: null, lastModifiedAt: Date.now(), deletedIds: {} };
          }
          if (!options || !options.preserveModifiedTimestamp) {
            this.state.syncMeta.lastModifiedAt = Date.now();
          }
          const res = await this.storage.save(this.state);
          if ((!options || !options.skipAutoSync) && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            try {
              window.dispatchEvent(new CustomEvent('valore-local-data-changed', {
                detail: { lastModifiedAt: this.state.syncMeta.lastModifiedAt }
              }));
            } catch (_) {}
          }
          resolve(res);
        } catch (err) {
          console.error('Erro na gravação atômica do Valore:', err);
          reject(err);
        }
      }).catch(err => {
        console.error('Falha na fila de persistência:', err);
        reject(err);
      });
    });
  }

  // --- BACKUP & RESTAURAÇÃO DE DADOS ---
  exportBackup() {
    return {
      version: '1.0',
      appName: 'Valore',
      exportedAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(this.state))
    };
  }

  async restoreBackup(backupObject, options = {}) {
    if (!backupObject || typeof backupObject !== 'object') {
      throw new Error('Arquivo de backup inválido.');
    }

    const incomingState = backupObject.state || backupObject;

    if (!Array.isArray(incomingState.accounts) || !Array.isArray(incomingState.transactions)) {
      throw new Error('O arquivo selecionado não contém uma estrutura de dados válida do Valore.');
    }

    this.state = {
      accounts: incomingState.accounts,
      categories: Array.isArray(incomingState.categories) ? incomingState.categories : this.state.categories,
      transactions: incomingState.transactions,
      schedules: Array.isArray(incomingState.schedules) ? incomingState.schedules : [],
      assets: Array.isArray(incomingState.assets) ? incomingState.assets : [],
      budgets: Array.isArray(incomingState.budgets) ? incomingState.budgets : [],
      goals: Array.isArray(incomingState.goals) ? incomingState.goals : [],
      vaults: Array.isArray(incomingState.vaults) ? incomingState.vaults : [],
      costCenters: Array.isArray(incomingState.costCenters) ? incomingState.costCenters : (this.state.costCenters || []),
      sideHustles: Array.isArray(incomingState.sideHustles) ? incomingState.sideHustles : (this.state.sideHustles || []),
      firePlanning: incomingState.firePlanning || this.state.firePlanning || {
        currentAge: 32,
        targetAge: 55,
        desiredMonthlyIncome: 10000,
        safeWithdrawalRate: 5.0,
        monthlyContribution: 2500,
        includePhysicalAssets: false
      },
      couple: incomingState.couple || this.state.couple || {
        enabled: true,
        partner1: { name: 'Você', monthlyIncome: 6000, color: '#3b82f6', pixKey: '', avatar: 'user' },
        partner2: { name: 'Parceiro(a)', monthlyIncome: 4000, color: '#ec4899', pixKey: '', avatar: 'heart' },
        splitMode: 'proportional',
        proportionalRatio: { p1: 60, p2: 40 },
        fixedQuotaAmount: 2000,
        jointHouseAccountName: 'Despesas do Lar'
      },
      coupleSettlements: Array.isArray(incomingState.coupleSettlements) ? incomingState.coupleSettlements : (this.state.coupleSettlements || []),
      syncMeta: incomingState.syncMeta || this.state.syncMeta || {
        deviceId: genId('dev'),
        lastSyncAt: new Date().toISOString(),
        lastModifiedAt: Date.now(),
        deletedIds: {}
      },
      settings: incomingState.settings || { currency: 'BRL', theme: 'auto', startDayOfMonth: 1 }
    };

    await this.save({
      skipAutoSync: options.skipAutoSync !== undefined ? options.skipAutoSync : true,
      preserveModifiedTimestamp: !!options.preserveModifiedTimestamp
    });
    return {
      success: true,
      transactionsCount: this.state.transactions.length,
      accountsCount: this.state.accounts.length
    };
  }

  async importBackup(backupObject, options = {}) {
    return await this.restoreBackup(backupObject, options);
  }

  // --- TRANSAÇÕES, PARCELAMENTO & TRANSFERÊNCIAS ---
  async addTransaction(data) {
    const isTransfer = data.type === 'transfer';
    const installments = parseInt(data.installments) || 1;
    const baseAmount = round2(parseFloat(data.amount));

    if (isTransfer) {
      // Débito na origem, crédito no destino
      const tx = {
        id: genId('tx'),
        description: data.description || 'Transferência entre Contas',
        amount: baseAmount,
        type: 'transfer',
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        date: data.date || localDateStr(),
        status: 'paid',
        entityType: data.entityType || 'pf',
        createdBy: data.createdBy || undefined,
        notes: data.notes || ''
      };

      this._touchEntity(tx, data.createdBy);
      this.updateAccountBalance(data.fromAccountId, baseAmount, 'expense', 'add');
      this.updateAccountBalance(data.toAccountId, baseAmount, 'income', 'add');
      this.state.transactions.unshift(tx);
      await this.save();
      return tx;
    }

    if (installments > 1) {
      // Determina o valor de cada parcela e o valor total comprometido
      const isTotal = data.installmentValueType === 'total';
      const baseInstAmount = (data.installmentAmount !== undefined && !isNaN(data.installmentAmount) && parseFloat(data.installmentAmount) > 0)
        ? round2(parseFloat(data.installmentAmount))
        : (isTotal ? round2(baseAmount / installments) : round2(baseAmount));

      const totalPurchaseAmount = (data.totalPurchaseAmount !== undefined && !isNaN(data.totalPurchaseAmount) && parseFloat(data.totalPurchaseAmount) > 0)
        ? round2(parseFloat(data.totalPurchaseAmount))
        : (isTotal ? round2(baseAmount) : round2(baseInstAmount * installments));

      // Compensação contábil de dízima/centavo (Penny Rounding):
      // A soma de todas as parcelas deve totalizar EXATAMENTE o totalPurchaseAmount
      const standardSum = round2(baseInstAmount * installments);
      const centDifference = round2(totalPurchaseAmount - standardSum);

      const [year, month, day] = (data.date || localDateStr()).split('-').map(Number);
      const installmentGroupId = genId('inst');
      const targetAccount = this.state.accounts.find(a => a.id === data.accountId);
      const isCreditCard = targetAccount && targetAccount.type === 'credit';

      const createdTxList = [];
      for (let i = 0; i < installments; i++) {
        // Cálculo seguro de virada de mês e ano (evita estouro de 31/01 para março)
        const targetMonthZeroIndex = (month - 1) + i;
        const tempDate = new Date(year, targetMonthZeroIndex, 1);
        const yNum = tempDate.getFullYear();
        const mNum = tempDate.getMonth() + 1;
        const daysInTargetMonth = new Date(yNum, mNum, 0).getDate();
        const safeDay = Math.min(day, daysInTargetMonth);

        const yStr = String(yNum);
        const mStr = String(mNum).padStart(2, '0');
        const dStr = String(safeDay).padStart(2, '0');

        // A última parcela absorve o centavo residual para fechar o valor exato da compra
        const currentAmount = (i === installments - 1) ? round2(baseInstAmount + centDifference) : baseInstAmount;

        const tx = {
          id: genId('tx'),
          description: `${data.description} (${i + 1}/${installments})`,
          amount: currentAmount,
          type: data.type,
          categoryId: data.categoryId,
          accountId: data.accountId,
          date: `${yStr}-${mStr}-${dStr}`,
          status: (!isCreditCard && i === 0) ? 'paid' : 'pending',
          installmentIndex: i + 1,
          installmentTotal: installments,
          installmentGroupId: installmentGroupId,
          installmentValueType: isTotal ? 'total' : 'installment',
          totalPurchaseAmount: totalPurchaseAmount,
          costCenterId: data.costCenterId || null,
          sideHustleId: data.sideHustleId || null,
          entityType: data.entityType || 'pf',
          createdBy: data.createdBy || undefined,
          isShared: !!data.isShared,
          paidBy: data.paidBy || data.createdBy || 'p1',
          splitRule: data.splitRule || 'default',
          customSplit: data.customSplit || null,
          coupleNote: data.coupleNote || '',
          settled: !!data.settled,
          settlementId: data.settlementId || null,
          notes: data.notes || ''
        };

        this._touchEntity(tx, data.createdBy);
        this.state.transactions.unshift(tx);
        createdTxList.push(tx);
      }

      // No cartão de crédito, o limite total é comprometido no valor integral da compra
      if (isCreditCard) {
        this.updateAccountBalance(data.accountId, totalPurchaseAmount, data.type, 'add');
      } else {
        // Se for débito/dinheiro parcelado (ex: carnê), debita a primeira parcela
        this.updateAccountBalance(data.accountId, createdTxList[0].amount, data.type, 'add');
      }

      this.syncCreditCardBalances();
      await this.save();
      return createdTxList[0];
    }

    // Transação simples
    const transaction = {
      id: genId('tx'),
      description: data.description,
      amount: baseAmount,
      type: data.type,
      categoryId: data.categoryId,
      accountId: data.accountId,
      date: data.date || localDateStr(),
      status: data.status || 'paid',
      recurring: data.recurring || 'none', // 'monthly' | 'yearly' | 'none' (para assinaturas e despesas fixas)
      reconciled: !!data.reconciled, // Reconciliação bancária / conferência
      ...(data.scheduleId ? { scheduleId: data.scheduleId } : {}), // Vínculo com o boleto/agendamento de origem
      costCenterId: data.costCenterId || null,
      sideHustleId: data.sideHustleId || null,
      entityType: data.entityType || 'pf',
      createdBy: data.createdBy || undefined,
      isShared: !!data.isShared,
      paidBy: data.paidBy || data.createdBy || 'p1',
      splitRule: data.splitRule || 'default',
      customSplit: data.customSplit || null,
      coupleNote: data.coupleNote || '',
      settled: !!data.settled,
      settlementId: data.settlementId || null,
      notes: data.notes || ''
    };

    this._touchEntity(transaction, data.createdBy);
    this.state.transactions.unshift(transaction);
    this.updateAccountBalance(transaction.accountId, transaction.amount, transaction.type, 'add');
    await this.save();
    return transaction;
  }

  // Atualizar transação existente
  async updateTransaction(id, data) {
    const idx = this.state.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const oldTx = this.state.transactions[idx];

    // Reverte impacto de saldo anterior
    if (oldTx.type === 'transfer') {
      this.updateAccountBalance(oldTx.fromAccountId, oldTx.amount, 'income', 'add');
      this.updateAccountBalance(oldTx.toAccountId, oldTx.amount, 'expense', 'add');
    } else {
      this.updateAccountBalance(oldTx.accountId, oldTx.amount, oldTx.type, 'remove');
    }

    // Aplica novos valores
    const newAmount = parseFloat(data.amount);
    const updatedTx = {
      ...oldTx,
      description: data.description,
      amount: newAmount,
      type: data.type,
      categoryId: data.categoryId,
      accountId: data.accountId,
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      date: data.date,
      recurring: data.recurring !== undefined ? data.recurring : (oldTx.recurring || 'none'),
      costCenterId: data.costCenterId !== undefined ? data.costCenterId : (oldTx.costCenterId || null),
      sideHustleId: data.sideHustleId !== undefined ? data.sideHustleId : (oldTx.sideHustleId || null),
      entityType: data.entityType !== undefined ? data.entityType : (oldTx.entityType || 'pf'),
      createdBy: data.createdBy !== undefined ? data.createdBy : (oldTx.createdBy || 'p1'),
      isShared: data.isShared !== undefined ? !!data.isShared : !!oldTx.isShared,
      paidBy: data.paidBy !== undefined ? data.paidBy : (oldTx.paidBy || 'p1'),
      splitRule: data.splitRule !== undefined ? data.splitRule : (oldTx.splitRule || 'default'),
      customSplit: data.customSplit !== undefined ? data.customSplit : (oldTx.customSplit || null),
      coupleNote: data.coupleNote !== undefined ? data.coupleNote : (oldTx.coupleNote || ''),
      settled: data.settled !== undefined ? !!data.settled : !!oldTx.settled,
      settlementId: data.settlementId !== undefined ? data.settlementId : (oldTx.settlementId || null),
      notes: data.notes || ''
    };

    // Aplica novo impacto de saldo
    if (updatedTx.type === 'transfer') {
      this.updateAccountBalance(updatedTx.fromAccountId, newAmount, 'expense', 'add');
      this.updateAccountBalance(updatedTx.toAccountId, newAmount, 'income', 'add');
    } else {
      this.updateAccountBalance(updatedTx.accountId, newAmount, updatedTx.type, 'add');
    }

    this._touchEntity(updatedTx, data.createdBy);
    this.state.transactions[idx] = updatedTx;

    // Se for uma compra parcelada (possui installmentGroupId), sincroniza o nome/descrição base em todos os demais meses
    if (updatedTx.installmentGroupId) {
      // Extrai a descrição base digitada pelo usuário, removendo qualquer sufixo de parcela (ex: " (1/10)")
      const baseCleanDesc = (data.description || updatedTx.description || '')
        .replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '')
        .trim();

      if (baseCleanDesc) {
        this.state.transactions.forEach(t => {
          if (t.installmentGroupId === updatedTx.installmentGroupId && t.id !== updatedTx.id) {
            const idxNum = t.installmentIndex || 1;
            const totNum = t.installmentTotal || updatedTx.installmentTotal || 1;
            t.description = `${baseCleanDesc} (${idxNum}/${totNum})`;
            if (data.categoryId) t.categoryId = data.categoryId;
            if (data.createdBy) {
              t.createdBy = data.createdBy;
              this._touchEntity(t, data.createdBy);
            }
          }
        });
        // Atualiza também a parcela atual para manter o formato padronizado
        if (updatedTx.installmentIndex && updatedTx.installmentTotal) {
          updatedTx.description = `${baseCleanDesc} (${updatedTx.installmentIndex}/${updatedTx.installmentTotal})`;
        }
      }
    }

    await this.save();
    return updatedTx;
  }

  // Alternar reconciliação bancária
  async toggleReconciled(txId) {
    const tx = this.state.transactions.find(t => t.id === txId);
    if (tx) {
      tx.reconciled = !tx.reconciled;
      await this.save();
      return tx;
    }
    return null;
  }


  // --- GESTÃO DE CONTAS & BANCOS (CRUD) ---
  async addAccount(data) {
    if (data.isDefault) {
      this.state.accounts.forEach(a => { a.isDefault = false; });
    }

    const isCredit = data.type === 'credit';
    const rawVal = parseFloat(data.balance || 0);
    // Para cartões de crédito, o valor informado é a Fatura Atual (débito, representado negativamente no saldo contábil)
    const initialBalance = isCredit ? -Math.abs(rawVal) : rawVal;

    const account = {
      id: genId('acc'),
      name: data.name,
      bankId: data.bankId || 'other',
      type: data.type, // 'checking' | 'investment' | 'credit' | 'cash'
      balance: initialBalance,
      limit: parseFloat(data.limit || 0),
      closingDay: parseInt(data.closingDay || 25),
      dueDay: parseInt(data.dueDay || 5),
      reminderDays: parseInt(data.reminderDays !== undefined ? data.reminderDays : 3),
      cardBrand: data.cardBrand || 'mastercard',
      isDefault: !!data.isDefault,
      ownerRole: data.ownerRole || 'p1', // 'p1' | 'p2' | 'joint'
      color: data.color || '#3b82f6'
    };
    this._touchEntity(account);
    this.state.accounts.push(account);
    await this.save();
    return account;
  }

  async updateAccount(id, data) {
    const account = this.state.accounts.find(a => a.id === id);
    if (!account) return null;

    if (data.isDefault) {
      this.state.accounts.forEach(a => { a.isDefault = false; });
    }

    account.name = data.name !== undefined ? data.name : account.name;
    if (data.bankId !== undefined) {
      account.bankId = data.bankId;
    }
    account.type = data.type !== undefined ? data.type : account.type;
    const isCredit = account.type === 'credit';

    if (data.balance !== undefined && data.balance !== '') {
      const parsedVal = parseFloat(data.balance);
      account.balance = isCredit ? -Math.abs(parsedVal) : parsedVal;
    }
    if (data.limit !== undefined && data.limit !== '') {
      account.limit = parseFloat(data.limit);
    }
    if (data.closingDay !== undefined) {
      account.closingDay = parseInt(data.closingDay);
    }
    if (data.dueDay !== undefined) {
      account.dueDay = parseInt(data.dueDay);
    }
    if (data.reminderDays !== undefined) {
      account.reminderDays = parseInt(data.reminderDays);
    }
    if (data.cardBrand !== undefined) {
      account.cardBrand = data.cardBrand;
    }
    if (data.isDefault !== undefined) {
      account.isDefault = !!data.isDefault;
    }
    if (data.color !== undefined) {
      account.color = data.color;
    }
    if (data.ownerRole !== undefined) {
      account.ownerRole = data.ownerRole;
    }
    this._touchEntity(account);
    await this.save();
    return account;
  }

  // --- GESTÃO DE COFRINHOS / RESERVAS ESTILO MERCADO PAGO ---
  getAccountVaults(accountId) {
    if (!this.state.vaults) this.state.vaults = [];
    return this.state.vaults.filter(v => v.accountId === accountId);
  }

  // Sincroniza o total guardado na conta somando os seus cofrinhos
  syncAccountVaultedBalance(accountId) {
    const acc = this.state.accounts.find(a => a.id === accountId);
    if (!acc) return;
    const accountVaults = this.getAccountVaults(accountId);
    acc.vaulted = +accountVaults.reduce((sum, v) => sum + (v.balance || 0), 0).toFixed(2);
  }

  // Criar novo Cofrinho na conta
  async createVault(data) {
    const account = this.state.accounts.find(a => a.id === data.accountId);
    if (!account) throw new Error('Conta bancária não encontrada.');
    if (account.type === 'credit') throw new Error('Cartões de crédito não possuem cofrinho.');

    if (!this.state.vaults) this.state.vaults = [];

    const initialDeposit = Math.abs(parseFloat(data.initialDeposit || 0));
    if (initialDeposit > 0 && account.balance < initialDeposit) {
      throw new Error(`Saldo livre insuficiente para o aporte inicial (Disponível: R$ ${account.balance.toFixed(2)}).`);
    }

    const vault = {
      id: genId('vault'),
      accountId: account.id,
      name: data.name || 'Meu Cofrinho',
      icon: data.icon || 'shield-check',
      color: data.color || '#10b981',
      balance: 0,
      target: Math.abs(parseFloat(data.target || 0)),
      yieldRate: parseFloat(data.yieldRate || 105), // % do CDI (Padrão Mercado Pago: 105% do CDI)
      createdAt: localDateStr()
    };

    this.state.vaults.push(vault);

    if (initialDeposit > 0) {
      account.balance = +(account.balance - initialDeposit).toFixed(2);
      vault.balance = initialDeposit;

      const tx = {
        id: genId('tx'),
        description: `[Cofrinho Criado] ${vault.name}`,
        amount: initialDeposit,
        type: 'transfer',
        isVaultAllocation: true,
        categoryId: 'cat-2',
        accountId: account.id,
        date: localDateStr(),
        status: 'paid',
        notes: `Aporte inicial no Cofrinho "${vault.name}"`
      };
      this.state.transactions.unshift(tx);
    }

    this.syncAccountVaultedBalance(account.id);
    await this.save();
    return vault;
  }

  // Criar Cofrinho diretamente a partir de uma movimentação/recebimento existente
  // Isola o valor do saldo livre e cria o cofrinho com o nome da transação
  async createVaultFromTransaction(txId, options = {}) {
    const tx = this.state.transactions.find(t => t.id === txId);
    if (!tx) throw new Error('Transação não encontrada.');

    // Determina a conta de origem da transação
    const accId = tx.accountId || tx.toAccountId || (this.state.accounts.find(a => a.type !== 'credit') || {}).id;
    const account = this.state.accounts.find(a => a.id === accId);
    if (!account) throw new Error('Conta bancária associada não encontrada.');
    if (account.type === 'credit') throw new Error('Cofrinhos não podem ser associados a cartões de crédito.');

    const amount = (options.amount !== undefined && !isNaN(parseFloat(options.amount)) && parseFloat(options.amount) > 0)
      ? Math.abs(parseFloat(options.amount))
      : Math.abs(parseFloat(tx.amount));
    if (isNaN(amount) || amount <= 0) throw new Error('Valor inválido da transação.');

    // Verifica se a conta tem saldo suficiente para separar esse valor
    if (account.balance < amount) {
      throw new Error(`Saldo livre insuficiente na conta para separar todo o valor (Disponível: R$ ${account.balance.toFixed(2)}, Valor: R$ ${amount.toFixed(2)}).`);
    }

    if (!this.state.vaults) this.state.vaults = [];

    const vaultName = options.name || tx.description || 'Cofrinho';
    const target = options.target ? Math.abs(parseFloat(options.target)) : (amount * 2);
    const yieldRate = parseFloat(options.yieldRate || 105);
    const icon = options.icon || (vaultName.toLowerCase().includes('reserva') ? 'shield-check' : 'trending-up');

    // Debita do saldo livre da conta e adiciona no cofrinho
    account.balance = +(account.balance - amount).toFixed(2);

    const vault = {
      id: genId('vault'),
      accountId: account.id,
      name: vaultName,
      icon: icon,
      color: '#10b981',
      balance: amount,
      target: target,
      yieldRate: yieldRate,
      originTxId: tx.id,
      createdAt: localDateStr()
    };

    this.state.vaults.push(vault);

    // Marca a transação de origem para indicar que ela foi guardada em cofrinho
    tx.vaultId = vault.id;
    tx.isVaulted = true;

    // Registra a transação de separação no extrato para controle contábil
    const sepTx = {
      id: genId('tx'),
      description: `[Cofrinho Criado] ${vault.name}`,
      amount: amount,
      type: 'transfer',
      isVaultAllocation: true,
      categoryId: 'cat-2',
      accountId: account.id,
      date: localDateStr(),
      status: 'paid',
      notes: `Separado da entrada "${tx.description}" para o Cofrinho "${vault.name}"`
    };
    this.state.transactions.unshift(sepTx);

    this.syncAccountVaultedBalance(account.id);
    await this.save();
    return { vault, account, sepTx };
  }

  // Guardar dinheiro em um cofrinho específico
  async depositToVault(vaultId, amount) {
    const vault = (this.state.vaults || []).find(v => v.id === vaultId);
    if (!vault) throw new Error('Cofrinho não encontrado.');

    const account = this.state.accounts.find(a => a.id === vault.accountId);
    if (!account) throw new Error('Conta bancária de origem não encontrada.');

    const numAmount = Math.abs(parseFloat(amount));
    if (isNaN(numAmount) || numAmount <= 0) throw new Error('Valor inválido para guardar.');

    if (account.balance < numAmount) {
      throw new Error(`Saldo livre insuficiente na conta (Disponível: R$ ${account.balance.toFixed(2)}).`);
    }

    account.balance = +(account.balance - numAmount).toFixed(2);
    vault.balance = +(vault.balance + numAmount).toFixed(2);

    const tx = {
      id: genId('tx'),
      description: `[Cofrinho Guardado] ${vault.name}`,
      amount: numAmount,
      type: 'expense',
      categoryId: 'cat-2',
      accountId: account.id,
      date: localDateStr(),
      status: 'paid',
      notes: `Valor transferido para o Cofrinho "${vault.name}"`
    };
    this.state.transactions.unshift(tx);

    this.syncAccountVaultedBalance(account.id);
    await this.save();
    return { vault, account, tx };
  }

  // Resgatar dinheiro de um cofrinho para o saldo livre da conta
  async withdrawFromVault(vaultId, amount) {
    const vault = (this.state.vaults || []).find(v => v.id === vaultId);
    if (!vault) throw new Error('Cofrinho não encontrado.');

    const account = this.state.accounts.find(a => a.id === vault.accountId);
    if (!account) throw new Error('Conta bancária de destino não encontrada.');

    const numAmount = Math.abs(parseFloat(amount));
    if (isNaN(numAmount) || numAmount <= 0) throw new Error('Valor inválido para resgate.');

    if (vault.balance < numAmount) {
      throw new Error(`Saldo insuficiente no cofrinho (Disponível no cofre: R$ ${vault.balance.toFixed(2)}).`);
    }

    vault.balance = +(vault.balance - numAmount).toFixed(2);
    account.balance = +(account.balance + numAmount).toFixed(2);

    const tx = {
      id: genId('tx'),
      description: `[Cofrinho Resgatado] ${vault.name}`,
      amount: numAmount,
      type: 'income',
      categoryId: 'cat-2',
      accountId: account.id,
      date: localDateStr(),
      status: 'paid',
      notes: `Resgate do Cofrinho "${vault.name}" para saldo livre`
    };
    this.state.transactions.unshift(tx);

    this.syncAccountVaultedBalance(account.id);
    await this.save();
    return { vault, account, tx };
  }

  // Excluir cofrinho (se tiver saldo, estorna para o saldo livre da conta)
  async deleteVault(vaultId) {
    const idx = (this.state.vaults || []).findIndex(v => v.id === vaultId);
    if (idx === -1) return false;

    const vault = this.state.vaults[idx];
    const account = this.state.accounts.find(a => a.id === vault.accountId);

    if (account && vault.balance > 0) {
      // Estorna saldo de volta para a conta
      account.balance = +(account.balance + vault.balance).toFixed(2);

      const tx = {
        id: genId('tx'),
        description: `[Cofrinho Encerrado] ${vault.name}`,
        amount: vault.balance,
        type: 'income',
        categoryId: 'cat-2',
        accountId: account.id,
        date: localDateStr(),
        status: 'paid',
        notes: `Estorno total por encerramento do Cofrinho "${vault.name}"`
      };
      this.state.transactions.unshift(tx);
    }

    this.state.vaults.splice(idx, 1);
    if (account) this.syncAccountVaultedBalance(account.id);
    await this.save();
    return true;
  }

  // Cálculo de projeção de rendimento estilo Mercado Pago (ex: 105% do CDI)
  // Taxa Selic de referência ~ 10,75% a.a. -> CDI ~ 10,65% a.a.
  calculateVaultYield(balance, yieldRatePercent = 105) {
    if (!balance || balance <= 0) return { daily: 0, monthly: 0, yearly: 0, rateLabel: `${yieldRatePercent}% do CDI` };
    const cdiAnnual = 0.1065; // ~10.65% a.a.
    const effectiveAnnual = cdiAnnual * (yieldRatePercent / 100);
    // Rendimento líquido estimado após IR médio (17,5%)
    const netAnnual = effectiveAnnual * 0.825;
    const yearly = +(balance * netAnnual).toFixed(2);
    const monthly = +(balance * (Math.pow(1 + netAnnual, 1 / 12) - 1)).toFixed(2);
    const daily = +(monthly / 22).toFixed(2); // 22 dias úteis médios por mês
    return {
      daily,
      monthly,
      yearly,
      rateLabel: `${yieldRatePercent}% do CDI (Líquido estimado)`
    };
  }

  // Retrocompatibilidade simples para chamadas genéricas
  async transferVault(accountId, amount, action = 'deposit', notes = '') {
    const vaults = this.getAccountVaults(accountId);
    let targetVault = vaults[0];
    if (!targetVault) {
      targetVault = await this.createVault({
        accountId,
        name: notes || 'Cofrinho Principal',
        target: 5000,
        yieldRate: 105
      });
    }
    if (action === 'deposit') {
      return await this.depositToVault(targetVault.id, amount);
    } else {
      return await this.withdrawFromVault(targetVault.id, amount);
    }
  }

  // Quitar fatura do cartão de crédito debitando conta corrente, restabelecendo limite
  // E RENOVANDO AUTOMATICAMENTE assinaturas e operações recorrentes vinculadas a este cartão!
  // Quitar fatura do cartão de crédito debitando conta corrente, restabelecendo limite
  // E RENOVANDO AUTOMATICAMENTE assinaturas e operações recorrentes vinculadas a este cartão!
  async payCreditCardInvoice(cardId, amount, sourceAccountId, date = null, targetInvoiceKey = null) {
    const card = this.state.accounts.find(a => a.id === cardId);
    const sourceAcc = this.state.accounts.find(a => a.id === sourceAccountId);
    const payAmount = Math.abs(parseFloat(amount));

    if (!card || !sourceAcc || payAmount <= 0) {
      throw new Error('Dados de pagamento da fatura inválidos.');
    }

    const payDate = date || localDateStr();

    // Identifica qual fatura está sendo paga (se não for especificada, utiliza a fatura atual do cartão)
    const invDataBefore = this.getCardInvoices(card.id);
    const resolvedInvoiceKey = targetInvoiceKey || (invDataBefore && invDataBefore.currentInvoice ? invDataBefore.currentInvoice.key : null);

    // 1. Debita o valor da conta de origem (conta corrente / investimento)
    this.updateAccountBalance(sourceAcc.id, payAmount, 'expense', 'add');

    // 2. Registra a transação de despesa na conta de origem para controle do extrato
    const payTx = {
      id: genId('tx'),
      description: `[Pagamento de Fatura] ${card.name}`,
      amount: payAmount,
      type: 'expense',
      categoryId: 'cat-8', // Categoria de transferência/pagamento interno
      accountId: sourceAcc.id,
      date: payDate,
      status: 'paid',
      notes: `Quitação de fatura do cartão ${card.name}. Limite restabelecido.`
    };
    this.state.transactions.unshift(payTx);

    // 3. Registra crédito compensatório no cartão para abater a fatura e zerar o saldo devedor
    const creditTx = {
      id: genId('tx') + '-crd',
      description: `[Quitação de Fatura] Pagamento recebido`,
      amount: payAmount,
      type: 'income',
      categoryId: 'cat-8',
      accountId: card.id,
      date: payDate,
      status: 'paid',
      invoiceKey: resolvedInvoiceKey,
      notes: `Crédito de pagamento referente à fatura ${resolvedInvoiceKey || ''} debitado de ${sourceAcc.name}.`
    };
    this.state.transactions.unshift(creditTx);

    // 4. Marca as compras da fatura quitada no cartão como paid
    if (resolvedInvoiceKey) {
      const closingDay = card.closingDay || 25;
      const dueDay = card.dueDay || 5;
      this.state.transactions.forEach(t => {
        if (t.accountId === card.id && t.type === 'expense') {
          const tInvInfo = this.getInvoiceInfoForDate(t.date, closingDay, dueDay);
          if (tInvInfo.invoiceKey === resolvedInvoiceKey) {
            t.status = 'paid';
          }
        }
      });
    }

    // 5. Sincroniza os saldos do cartão de crédito (recalculando limite disponível e saldo devedor)
    this.syncCreditCardBalances();

    // 6. Se houver agendamento pendente referente a este cartão, marca como pago automaticamente
    const relatedSchedule = this.state.schedules.find(s => 
      s.status === 'pending' && 
      (s.description.toLowerCase().includes(card.name.toLowerCase()) || s.description.toLowerCase().includes('fatura'))
    );
    if (relatedSchedule) {
      relatedSchedule.status = 'paid';
    }

    // 7. RENOVAÇÃO AUTOMÁTICA DE OPERAÇÕES RECORRENTES DO CARTÃO (Assinaturas: Netflix, Amazon, Spotify, etc.)
    // Localiza despesas do cartão que foram marcadas com recorrência (monthly ou yearly)
    const recurringCardTxs = this.state.transactions.filter(t => 
      t.accountId === card.id && 
      t.type === 'expense' && 
      (t.recurring === 'monthly' || t.recurring === 'yearly')
    );

    const renewedTxs = [];
    if (recurringCardTxs.length > 0) {
      const [payY, payM, payD] = payDate.split('-').map(Number);

      for (const recTx of recurringCardTxs) {
        // Evita duplicidade se já existir uma transação com o mesmo identificador neste novo mês
        const [origY, origM, origD] = recTx.date.split('-').map(Number);
        let nextDate;

        if (recTx.recurring === 'monthly') {
          // Próximo mês
          nextDate = new Date(origY, origM, origD);
          if (nextDate.getDate() !== origD) {
            nextDate = new Date(origY, origM + 1, 0);
          }
        } else {
          // Próximo ano
          nextDate = new Date(origY + 1, origM - 1, origD);
        }

        const nextY = nextDate.getFullYear();
        const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
        const nextD = String(nextDate.getDate()).padStart(2, '0');
        const nextDateStr = `${nextY}-${nextM}-${nextD}`;

        // Verifica se essa renovação já não foi lançada anteriormente
        const alreadyExists = this.state.transactions.some(t => 
          t.accountId === card.id &&
          t.description === recTx.description &&
          t.date === nextDateStr
        );

        if (!alreadyExists) {
          const newTx = {
            id: genId('tx'),
            description: recTx.description,
            amount: recTx.amount,
            type: 'expense',
            categoryId: recTx.categoryId,
            accountId: card.id,
            date: nextDateStr,
            status: 'paid',
            recurring: recTx.recurring,
            notes: `↻ Renovação Automática da assinatura após quitação da fatura`
          };

          this.state.transactions.unshift(newTx);
          // Debita o limite novamente na nova fatura
          this.updateAccountBalance(card.id, newTx.amount, 'expense', 'add');
          renewedTxs.push(newTx);
        }
      }
    }

    this.syncCreditCardBalances();
    await this.save();
    return { success: true, transaction: payTx, creditTx, card, sourceAcc, renewedTxs };
  }

  // --- INTELIGÊNCIA DE FATURAS E CICLOS DE CARTÃO DE CRÉDITO ---

  // Determina a qual fatura (mês de vencimento e fechamento) uma compra pertence
  getInvoiceInfoForDate(dateStr, closingDay = 25, dueDay = 5) {
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    if (!y || !m || !d) {
      return {
        invoiceKey: 'geral',
        closingDateStr: '',
        dueDateStr: '',
        label: 'Geral',
        dueMonth: 1,
        dueYear: 2026
      };
    }

    // No dia do fechamento (Melhor Dia de Compra) ou após ele, a compra entra no ciclo do próximo fechamento
    let closingY = y;
    let closingM = m;
    if (d >= closingDay) {
      closingM++;
      if (closingM > 12) {
        closingM = 1;
        closingY++;
      }
    }

    // Data de vencimento correspondente ao fechamento
    let dueY = closingY;
    let dueM = closingM;
    if (dueDay <= closingDay) {
      // Ex: fecha 25/10, vence 05/11
      dueM++;
      if (dueM > 12) {
        dueM = 1;
        dueY++;
      }
    }

    // Clamp seguro de dia de fechamento e vencimento de acordo com o calendário real do mês
    const maxDaysClosing = new Date(closingY, closingM, 0).getDate();
    const safeClosingDay = Math.min(closingDay, maxDaysClosing);
    const maxDaysDue = new Date(dueY, dueM, 0).getDate();
    const safeDueDay = Math.min(dueDay, maxDaysDue);

    const invoiceKey = `${dueY}-${String(dueM).padStart(2, '0')}`;
    const closingDate = new Date(closingY, closingM - 1, safeClosingDay);
    const dueDate = new Date(dueY, dueM - 1, safeDueDay);
    const closingDateStr = `${closingY}-${String(closingM).padStart(2, '0')}-${String(safeClosingDay).padStart(2, '0')}`;
    const dueDateStr = `${dueY}-${String(dueM).padStart(2, '0')}-${String(safeDueDay).padStart(2, '0')}`;

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const label = `Fatura ${monthNames[dueM - 1]}/${String(dueY).slice(-2)}`;

    return {
      invoiceKey,
      closingDate,
      dueDate,
      closingDateStr,
      dueDateStr,
      label,
      dueMonth: dueM,
      dueYear: dueY
    };
  }

  // Obter faturas discriminadas e inteligência financeira de um cartão de crédito
  getCardInvoices(cardId) {
    const card = this.state.accounts.find(a => a.id === cardId);
    if (!card || card.type !== 'credit') return null;

    const closingDay = card.closingDay || 25;
    const dueDay = card.dueDay || 5;
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const cardTransactions = this.state.transactions.filter(t => 
      t.accountId === card.id || t.fromAccountId === card.id || t.toAccountId === card.id
    );

    const invoicesMap = {};

    cardTransactions.forEach(tx => {
      // Se a transação já tem invoiceKey explicitada (ex: crédito de quitação), utiliza-a
      let invKey = tx.invoiceKey;
      let invInfo = null;

      if (!invKey) {
        invInfo = this.getInvoiceInfoForDate(tx.date, closingDay, dueDay);
        invKey = invInfo.invoiceKey;
      } else {
        const [kY, kM] = invKey.split('-').map(Number);
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let cM = kM;
        let cY = kY;
        if (dueDay <= closingDay) {
          cM--;
          if (cM < 1) { cM = 12; cY--; }
        }
        invInfo = {
          invoiceKey: invKey,
          label: `Fatura ${monthNames[(kM || 1) - 1]}/${String(kY).slice(-2)}`,
          closingDate: new Date(cY, cM - 1, closingDay),
          dueDate: new Date(kY, (kM || 1) - 1, dueDay),
          closingDateStr: `${cY}-${String(cM).padStart(2, '0')}-${String(closingDay).padStart(2, '0')}`,
          dueDateStr: `${kY}-${String(kM).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`
        };
      }

      if (!invoicesMap[invKey]) {
        invoicesMap[invKey] = {
          key: invKey,
          label: invInfo.label,
          closingDate: invInfo.closingDate,
          dueDate: invInfo.dueDate,
          closingDateStr: invInfo.closingDateStr,
          dueDateStr: invInfo.dueDateStr,
          total: 0,
          paidTotal: 0,
          pendingTotal: 0,
          transactions: []
        };
      }

      const amt = parseFloat(tx.amount || 0);
      if (tx.type === 'expense') {
        invoicesMap[invKey].total += amt;
        if (tx.status === 'paid') invoicesMap[invKey].paidTotal += amt;
        else invoicesMap[invKey].pendingTotal += amt;
      } else if (tx.type === 'income') {
        invoicesMap[invKey].total -= amt;
      }

      tx.invoiceKey = invKey;
      tx.invoiceLabel = invInfo.label;
      invoicesMap[invKey].transactions.push(tx);
    });

    // Garante que a fatura do ciclo atual em aberto (de hoje) sempre exista, mesmo que sem compras (total 0)
    const todayY = today.getFullYear();
    const todayM = String(today.getMonth() + 1).padStart(2, '0');
    const todayD = String(today.getDate()).padStart(2, '0');
    const todayDateStr = `${todayY}-${todayM}-${todayD}`;
    const todayInvInfo = this.getInvoiceInfoForDate(todayDateStr, closingDay, dueDay);
    const todayInvKey = todayInvInfo.invoiceKey;

    if (!invoicesMap[todayInvKey]) {
      invoicesMap[todayInvKey] = {
        key: todayInvKey,
        label: todayInvInfo.label,
        closingDate: todayInvInfo.closingDate,
        dueDate: todayInvInfo.dueDate,
        closingDateStr: todayInvInfo.closingDateStr,
        dueDateStr: todayInvInfo.dueDateStr,
        total: 0,
        paidTotal: 0,
        pendingTotal: 0,
        transactions: []
      };
    }

    const invoices = Object.values(invoicesMap).sort((a, b) => a.dueDate - b.dueDate);

    // Classificação de status de cada fatura e cálculo de dias para fechamento
    invoices.forEach(inv => {
      inv.total = Math.max(0, +inv.total.toFixed(2));
      inv.paidTotal = +inv.paidTotal.toFixed(2);
      inv.pendingTotal = +inv.pendingTotal.toFixed(2);

      const invClosingMidnight = new Date(inv.closingDate.getFullYear(), inv.closingDate.getMonth(), inv.closingDate.getDate());
      const diffClosingDays = Math.round((invClosingMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
      inv.daysUntilClosing = diffClosingDays;

      if (todayMidnight < invClosingMidnight) {
        inv.status = 'open';
        inv.statusLabel = 'Aberta';
        inv.isClosed = false;
        inv.closingBadgeText = diffClosingDays === 1 ? 'Fecha amanhã' : `Fecha em ${diffClosingDays} dias`;
      } else if (todayMidnight.getTime() === invClosingMidnight.getTime()) {
        inv.status = 'closing_today';
        inv.statusLabel = 'Fecha Hoje';
        inv.isClosed = false;
        inv.closingBadgeText = 'Fecha HOJE';
      } else if (today <= inv.dueDate) {
        inv.status = 'closed';
        inv.statusLabel = 'Fechada';
        inv.isClosed = true;
        inv.closingBadgeText = 'Fatura Fechada';
      } else {
        inv.status = 'past';
        inv.statusLabel = 'Anterior';
        inv.isClosed = true;
        inv.closingBadgeText = 'Ciclo Encerrado';
      }
    });

    // 1. Identifica a fatura aberta onde compras de HOJE caem (openCycleInvoice)
    const openCycleInvoice = invoices.find(inv => inv.key === todayInvKey);

    // 2. Identificação da Fatura Ativa em Foco (Regra Bancária Universal):
    // Cada mês possui uma fatura alvo correspondente ao vencimento do mês corrente (curTargetKey).
    // - Se a fatura do mês corrente ainda NÃO fechou (ex: C6 Bank, que fecha dia 04/11 e vence 10/11):
    //   -> Ela é a fatura aberta ativa em compras!
    // - Se a fatura do mês corrente JÁ FECHOU (ex: Banco Inter, cujo fechamento ocorreu dia 31/10 e vence 07/11):
    //   -> Se tiver saldo a pagar (> 0), ela permanece como a Fatura Fechada em Foco até ser quitada!
    //   -> Se já tiver sido quitada (total = 0), o foco avança automaticamente para o ciclo do próximo mês!
    const curTargetKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthInv = invoices.find(i => i.key === curTargetKey);

    let currentInvoice = null;
    let hasUnpaidClosedInvoice = false;

    if (monthInv) {
      const invClosingMidnight = new Date(monthInv.closingDate.getFullYear(), monthInv.closingDate.getMonth(), monthInv.closingDate.getDate());
      const isPastClosing = todayMidnight >= invClosingMidnight;

      if (!isPastClosing) {
        // Fatura ainda não fechou -> Fatura aberta normal em compras
        currentInvoice = monthInv;
        hasUnpaidClosedInvoice = false;
      } else if (monthInv.total > 0) {
        // Fatura já fechou e aguarda pagamento -> Fatura fechada a pagar
        currentInvoice = monthInv;
        hasUnpaidClosedInvoice = true;
      } else {
        // Fatura já fechou e já foi quitada -> Avança para a próxima fatura do ciclo seguinte!
        const nextInv = invoices.find(i => i.dueDate > monthInv.dueDate);
        currentInvoice = nextInv || openCycleInvoice || monthInv;
        hasUnpaidClosedInvoice = false;
      }
    } else {
      currentInvoice = openCycleInvoice || invoices.find(inv => today <= inv.dueDate) || invoices[invoices.length - 1];
      hasUnpaidClosedInvoice = currentInvoice ? (currentInvoice.isClosed && currentInvoice.total > 0) : false;
    }

    let nextInvoice = null;
    let futureInvoicesTotal = 0;

    const futureInvoices = currentInvoice ? invoices.filter(inv => inv.dueDate > currentInvoice.dueDate) : [];
    if (futureInvoices.length > 0) {
      nextInvoice = futureInvoices[0];
    }

    invoices.forEach(inv => {
      inv.isCurrent = currentInvoice && inv.key === currentInvoice.key;
      inv.isNext = nextInvoice && inv.key === nextInvoice.key;
      inv.isFuture = currentInvoice && inv.dueDate > currentInvoice.dueDate;

      if (inv.isFuture) {
        futureInvoicesTotal += inv.total;
        inv.status = 'future';
        inv.statusLabel = 'Futura';
      } else if (inv.isCurrent) {
        if (hasUnpaidClosedInvoice) {
          const isOverdue = todayMidnight > new Date(inv.dueDate.getFullYear(), inv.dueDate.getMonth(), inv.dueDate.getDate());
          inv.statusLabel = isOverdue ? 'Vencida (A Pagar)' : 'Fechada (A Pagar)';
          inv.closingBadgeText = isOverdue ? 'FATURA VENCIDA' : 'Fatura Fechada';
        } else {
          inv.statusLabel = inv.status === 'closed' ? 'Fechada (Atual)' : (inv.status === 'closing_today' ? 'Fecha Hoje (Atual)' : 'Aberta (Atual)');
        }
      }
    });

    futureInvoicesTotal = +futureInvoicesTotal.toFixed(2);

    const totalCommittedLimit = Math.abs(Math.min(0, card.balance || 0));
    const totalLimit = card.limit || 0;
    const availableLimit = Math.max(0, totalLimit - totalCommittedLimit);

    // Dias restantes para fechamento da fatura atual
    let curDaysUntilClosing = 0;
    let curClosingBadgeText = '';
    let isCurrentInvoiceClosed = false;

    if (currentInvoice) {
      curDaysUntilClosing = currentInvoice.daysUntilClosing !== undefined ? currentInvoice.daysUntilClosing : 0;
      curClosingBadgeText = currentInvoice.closingBadgeText || '';
      isCurrentInvoiceClosed = !!currentInvoice.isClosed || hasUnpaidClosedInvoice;
    }

    const openCycleAmount = openCycleInvoice && openCycleInvoice !== currentInvoice ? openCycleInvoice.total : 0;

    return {
      card,
      invoices,
      cardTransactions,
      currentInvoice: currentInvoice || { key: 'current', label: 'Fatura Atual', total: 0, transactions: [], statusLabel: 'Aberta' },
      currentInvoiceKey: currentInvoice ? currentInvoice.key : null,
      hasUnpaidClosedInvoice,
      unpaidClosedInvoice: hasUnpaidClosedInvoice ? currentInvoice : null,
      openCycleInvoice,
      openCycleAmount,
      daysUntilClosing: curDaysUntilClosing,
      closingBadgeText: curClosingBadgeText,
      isInvoiceClosed: isCurrentInvoiceClosed,
      nextInvoice,
      futureInvoicesTotal,
      totalCommittedLimit,
      availableLimit,
      totalLimit
    };
  }

  // Obter status e inteligência de faturas de todos os cartões de crédito
  getCreditCardInsights() {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0-indexed
    const curDay = today.getDate();

    const creditCards = this.state.accounts.filter(a => a.type === 'credit');

    return creditCards.map(card => {
      const invData = this.getCardInvoices(card.id);
      const curInv = invData ? invData.currentInvoice : null;

      // O valor da fatura atual é o valor da fatura ativa do ciclo vigente!
      const invoiceAmount = curInv && curInv.total > 0 ? curInv.total : Math.abs(Math.min(0, card.balance || 0));
      const totalLimit = card.limit || 0;
      const availableLimit = invData ? invData.availableLimit : Math.max(0, totalLimit - invoiceAmount);
      const usedPercent = totalLimit > 0 ? Math.min(100, Math.round(((totalLimit - availableLimit) / totalLimit) * 100)) : 0;
      const futureInvoicesTotal = invData ? invData.futureInvoicesTotal : 0;

      const dueDay = card.dueDay || 5;
      const reminderDays = card.reminderDays !== undefined ? card.reminderDays : 3;

      let dueDate = curInv && curInv.dueDate ? curInv.dueDate : new Date(curYear, curMonth, dueDay);
      if (!curInv && curDay > dueDay) {
        dueDate = new Date(curYear, curMonth + 1, dueDay);
      }

      const diffTime = dueDate.getTime() - new Date(curYear, curMonth, curDay).getTime();
      const daysUntilDue = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let reminderActive = false;
      let reminderLevel = 'normal';
      let reminderMessage = `Vence em ${daysUntilDue} dias`;

      if (daysUntilDue === 0) {
        reminderActive = true;
        reminderLevel = 'urgent';
        reminderMessage = 'Vence HOJE!';
      } else if (daysUntilDue < 0) {
        reminderActive = true;
        reminderLevel = 'urgent';
        reminderMessage = `Vencido há ${Math.abs(daysUntilDue)} dias!`;
      } else if (reminderDays >= 0 && daysUntilDue <= reminderDays) {
        reminderActive = true;
        reminderLevel = daysUntilDue <= 2 ? 'urgent' : 'warning';
        reminderMessage = `Vence em ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'}!`;
      }

      const daysUntilClosing = invData ? invData.daysUntilClosing : 0;
      const closingBadgeText = invData ? invData.closingBadgeText : '';
      const isInvoiceClosed = invData ? invData.isInvoiceClosed : false;
      const hasUnpaidClosedInvoice = !!(invData && invData.hasUnpaidClosedInvoice);
      const openCycleAmount = invData ? (invData.openCycleAmount || 0) : 0;

      return {
        id: card.id,
        name: card.name,
        bankId: card.bankId || 'other',
        cardBrand: card.cardBrand || 'mastercard',
        invoiceAmount,
        futureInvoicesTotal,
        hasUnpaidClosedInvoice,
        openCycleAmount,
        currentInvoiceName: curInv ? curInv.label : 'Fatura Atual',
        currentInvoiceStatusLabel: curInv ? curInv.statusLabel : '',
        totalLimit,
        availableLimit,
        usedPercent,
        dueDay,
        closingDay: card.closingDay || 25,
        daysUntilClosing,
        closingBadgeText,
        isInvoiceClosed,
        reminderDays,
        daysUntilDue,
        dueDateStr: dueDate.toLocaleDateString('pt-BR'),
        reminderActive,
        reminderLevel,
        reminderMessage,
        isDefault: !!card.isDefault,
        color: card.color || '#0f172a'
      };
    });
  }

  // --- INTELIGÊNCIA DE PARCELAMENTOS & COMPROMETIMENTO DE RENDA FUTURA ---
  getIncomeCommitmentForecast(monthsAhead = 12) {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0-indexed (0 = Jan)

    // 1. Estima a renda mensal base (calculada pela média de receitas dos últimos 3 meses ou receitas do mês atual)
    let estimatedMonthlyIncome = 0;
    const pastMonthsCount = 3;
    let totalPastIncome = 0;
    let monthsWithIncome = 0;

    for (let i = 0; i < pastMonthsCount; i++) {
      const d = new Date(curYear, curMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const inc = this.state.transactions
        .filter(t => {
          if (t.type !== 'income' || t.isInternalTransfer || t.isInternalRepayment) return false;
          const [ty, tm] = t.date.split('-');
          return parseInt(ty, 10) === y && parseInt(tm, 10) === m;
        })
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      if (inc > 0) {
        totalPastIncome += inc;
        monthsWithIncome++;
      }
    }

    if (monthsWithIncome > 0) {
      estimatedMonthlyIncome = totalPastIncome / monthsWithIncome;
    } else {
      // Se não houver histórico, verifica se há receitas no mês atual ou agendamentos de receita
      const currentMonthIncome = this.state.transactions
        .filter(t => {
          if (t.type !== 'income' || t.isInternalTransfer || t.isInternalRepayment) return false;
          const [ty, tm] = t.date.split('-');
          return parseInt(ty, 10) === curYear && parseInt(tm, 10) === (curMonth + 1);
        })
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      const scheduledIncome = (this.state.schedules || [])
        .filter(s => s.type === 'income')
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

      estimatedMonthlyIncome = Math.max(currentMonthIncome, scheduledIncome, 0);
    }

    // 2. Coleta todas as faturas e compras parceladas de todos os cartões de crédito
    const creditCards = this.state.accounts.filter(a => a.type === 'credit');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyProjection = [];

    // Estrutura os meses futuros
    for (let offset = 0; offset < monthsAhead; offset++) {
      const targetDate = new Date(curYear, curMonth + offset, 1);
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const label = `${monthNames[m - 1]}/${String(y).slice(-2)}`;

      monthlyProjection.push({
        key,
        label,
        year: y,
        month: m,
        totalInvoiceAmount: 0,
        cardsBreakdown: {},
        estimatedIncome: estimatedMonthlyIncome,
        commitmentPercent: 0,
        riskLevel: 'safe', // 'safe' (<30%), 'warning' (30-50%), 'danger' (>50%)
        activeInstallmentsCount: 0
      });
    }

    const projectionMap = {};
    monthlyProjection.forEach(p => projectionMap[p.key] = p);

    // 3. Itera por cada cartão e extrai os totais de fatura mês a mês
    creditCards.forEach(card => {
      const invData = this.getCardInvoices(card.id);
      if (!invData || !invData.invoices) return;

      invData.invoices.forEach(inv => {
        if (!inv.dueDate) return;
        const invDueYear = inv.dueDate.getFullYear();
        const invDueMonth = inv.dueDate.getMonth() + 1;
        const key = `${invDueYear}-${String(invDueMonth).padStart(2, '0')}`;

        if (projectionMap[key]) {
          projectionMap[key].totalInvoiceAmount += (inv.total || 0);
          if (!projectionMap[key].cardsBreakdown[card.name]) {
            projectionMap[key].cardsBreakdown[card.name] = {
              cardId: card.id,
              cardName: card.name,
              color: card.color || '#3b82f6',
              amount: 0
            };
          }
          projectionMap[key].cardsBreakdown[card.name].amount += (inv.total || 0);
        }
      });
    });

    // 4. Analisa todas as compras parceladas ativas
    const allInstallmentPurchases = {};
    this.state.transactions.forEach(t => {
      if (t.installmentId) {
        if (!allInstallmentPurchases[t.installmentId]) {
          allInstallmentPurchases[t.installmentId] = {
            installmentId: t.installmentId,
            description: t.description.replace(/\s*\(\d+\/\d+\)$/, '').trim(),
            totalInstallments: t.totalInstallments || 1,
            amountPerInstallment: parseFloat(t.amount || 0),
            totalAmount: (parseFloat(t.amount || 0) * (t.totalInstallments || 1)),
            accountId: t.accountId,
            accountName: creditCards.find(c => c.id === t.accountId)?.name || 'Cartão',
            installments: []
          };
        }
        allInstallmentPurchases[t.installmentId].installments.push(t);
      }
    });

    const activeInstallmentPlans = [];
    Object.values(allInstallmentPurchases).forEach(plan => {
      // Ordena por data e número da parcela
      plan.installments.sort((a, b) => a.currentInstallment - b.currentInstallment);
      const paidCount = plan.installments.filter(inst => {
        const [iy, im] = inst.date.split('-');
        const instDate = new Date(parseInt(iy, 10), parseInt(im, 10) - 1, 1);
        return instDate < new Date(curYear, curMonth, 1);
      }).length;

      const remainingCount = plan.totalInstallments - paidCount;
      const lastInstallment = plan.installments[plan.installments.length - 1];
      let endMonthLabel = '';
      if (lastInstallment) {
        const [ly, lm] = lastInstallment.date.split('-');
        endMonthLabel = `${monthNames[parseInt(lm, 10) - 1]}/${ly}`;
      }

      if (remainingCount > 0) {
        activeInstallmentPlans.push({
          id: plan.installmentId,
          description: plan.description,
          accountName: plan.accountName,
          amountPerInstallment: plan.amountPerInstallment,
          paidInstallments: paidCount,
          totalInstallments: plan.totalInstallments,
          remainingInstallments: remainingCount,
          remainingAmount: +(remainingCount * plan.amountPerInstallment).toFixed(2),
          progressPercent: Math.round((paidCount / plan.totalInstallments) * 100),
          endMonthLabel
        });
      }
    });

    // 5. Finaliza cálculos de comprometimento e indicadores de risco
    let peakCommitmentMonth = null;
    let peakCommitmentAmount = 0;
    let totalFutureCommitted = 0;

    monthlyProjection.forEach(p => {
      p.totalInvoiceAmount = +p.totalInvoiceAmount.toFixed(2);
      totalFutureCommitted += p.totalInvoiceAmount;

      if (p.totalInvoiceAmount > peakCommitmentAmount) {
        peakCommitmentAmount = p.totalInvoiceAmount;
        peakCommitmentMonth = p.label;
      }

      if (p.estimatedIncome > 0) {
        p.commitmentPercent = Math.min(100, Math.round((p.totalInvoiceAmount / p.estimatedIncome) * 100));
      } else {
        p.commitmentPercent = p.totalInvoiceAmount > 0 ? 100 : 0;
      }

      if (p.commitmentPercent > 50) {
        p.riskLevel = 'danger';
      } else if (p.commitmentPercent >= 30) {
        p.riskLevel = 'warning';
      } else {
        p.riskLevel = 'safe';
      }
    });

    // Média de comprometimento dos próximos 6 meses
    const next6Months = monthlyProjection.slice(0, 6);
    const avg6MonthsCommitment = next6Months.length > 0 
      ? Math.round(next6Months.reduce((sum, p) => sum + p.commitmentPercent, 0) / next6Months.length)
      : 0;

    return {
      monthlyProjection,
      activeInstallmentPlans,
      estimatedMonthlyIncome,
      totalFutureCommitted: +totalFutureCommitted.toFixed(2),
      peakCommitmentMonth,
      peakCommitmentAmount: +peakCommitmentAmount.toFixed(2),
      avg6MonthsCommitment,
      hasCreditCards: creditCards.length > 0
    };
  }

  // =========================================================================
  // --- ETAPA 2: CENTROS DE CUSTO (PROJETOS, VIAGENS, REFORMAS & EVENTOS) ---
  // =========================================================================
  async addCostCenter(data) {
    if (!this.state.costCenters) this.state.costCenters = [];

    const name = (data.name || '').trim();
    if (!name) throw new Error('O nome do projeto/centro de custo é obrigatório.');

    const costCenter = {
      id: genId('cc'),
      name: name,
      icon: data.icon || 'plane', // 'plane' | 'hammer' | 'car' | 'briefcase' | 'camera'
      color: data.color || '#3b82f6',
      budget: parseFloat(data.budget || 0),
      startDate: data.startDate || localDateStr(),
      endDate: data.endDate || null,
      isolateFromMonthlyBudget: data.isolateFromMonthlyBudget !== undefined ? !!data.isolateFromMonthlyBudget : true,
      status: data.status || 'active', // 'active' | 'completed' | 'paused'
      notes: (data.notes || '').trim(),
      createdAt: new Date().toISOString()
    };

    this.state.costCenters.push(costCenter);
    await this.save();
    return costCenter;
  }

  async updateCostCenter(id, data) {
    if (!this.state.costCenters) this.state.costCenters = [];
    const cc = this.state.costCenters.find(c => c.id === id);
    if (!cc) throw new Error('Centro de custo não encontrado.');

    if (data.name !== undefined) {
      const name = (data.name || '').trim();
      if (!name) throw new Error('O nome não pode ser vazio.');
      cc.name = name;
    }
    if (data.icon !== undefined) cc.icon = data.icon;
    if (data.color !== undefined) cc.color = data.color;
    if (data.budget !== undefined) cc.budget = parseFloat(data.budget || 0);
    if (data.startDate !== undefined) cc.startDate = data.startDate;
    if (data.endDate !== undefined) cc.endDate = data.endDate;
    if (data.isolateFromMonthlyBudget !== undefined) cc.isolateFromMonthlyBudget = !!data.isolateFromMonthlyBudget;
    if (data.status !== undefined) cc.status = data.status;
    if (data.notes !== undefined) cc.notes = (data.notes || '').trim();

    await this.save();
    return cc;
  }

  async deleteCostCenter(id) {
    if (!this.state.costCenters) this.state.costCenters = [];
    const idx = this.state.costCenters.findIndex(c => c.id === id);
    if (idx !== -1) {
      // Remove a vinculação nas transações existentes
      (this.state.transactions || []).forEach(t => {
        if (t.costCenterId === id) delete t.costCenterId;
      });
      this.state.costCenters.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  getCostCenterInsights(id) {
    const cc = (this.state.costCenters || []).find(c => c.id === id);
    if (!cc) return null;

    const linkedTransactions = (this.state.transactions || []).filter(t => t.costCenterId === id);
    const totalExpenses = linkedTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const totalIncomes = linkedTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const netCost = totalExpenses - totalIncomes;
    const budget = cc.budget || 0;
    const budgetUsedPercent = budget > 0 ? Math.min(100, Math.round((netCost / budget) * 100)) : 0;
    const remainingBudget = Math.max(0, budget - netCost);

    // Breakdown por categoria de gasto do projeto
    const categoriesMap = {};
    linkedTransactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = (this.state.categories || []).find(c => c.id === t.categoryId);
      const catName = cat ? cat.name : 'Outros';
      const catColor = cat ? cat.color : '#94a3b8';
      if (!categoriesMap[catName]) {
        categoriesMap[catName] = { name: catName, color: catColor, amount: 0 };
      }
      categoriesMap[catName].amount += (parseFloat(t.amount) || 0);
    });

    return {
      costCenter: cc,
      transactions: linkedTransactions,
      totalExpenses: +totalExpenses.toFixed(2),
      totalIncomes: +totalIncomes.toFixed(2),
      netCost: +netCost.toFixed(2),
      budget: +budget.toFixed(2),
      budgetUsedPercent,
      remainingBudget: +remainingBudget.toFixed(2),
      isOverBudget: budget > 0 && netCost > budget,
      categoriesBreakdown: Object.values(categoriesMap)
    };
  }

  getAllCostCentersInsights() {
    return (this.state.costCenters || []).map(cc => this.getCostCenterInsights(cc.id));
  }

  // =========================================================================
  // --- ETAPA 3: RENDA EXTRA / PROJETOS PARALELOS (SIDE HUSTLE / NEGÓCIOS) ---
  // =========================================================================
  async addSideHustle(data) {
    if (!this.state.sideHustles) this.state.sideHustles = [];

    const name = (data.name || '').trim();
    if (!name) throw new Error('O nome do projeto de renda extra é obrigatório.');

    const sideHustle = {
      id: genId('sh'),
      name: name,
      category: data.category || 'freelance', // 'freelance' | 'ecommerce' | 'services' | 'resale' | 'other'
      icon: data.icon || 'zap',
      color: data.color || '#10b981',
      linkedAccountId: data.linkedAccountId || null, // Conta bancária do projeto (ex: conta PJ)
      monthlyTarget: parseFloat(data.monthlyTarget || 0), // Meta de lucro mensal
      status: data.status || 'active', // 'active' | 'paused'
      notes: (data.notes || '').trim(),
      createdAt: new Date().toISOString()
    };

    this.state.sideHustles.push(sideHustle);
    await this.save();
    return sideHustle;
  }

  async updateSideHustle(id, data) {
    if (!this.state.sideHustles) this.state.sideHustles = [];
    const sh = this.state.sideHustles.find(s => s.id === id);
    if (!sh) throw new Error('Projeto de renda extra não encontrado.');

    if (data.name !== undefined) {
      const name = (data.name || '').trim();
      if (!name) throw new Error('O nome não pode ser vazio.');
      sh.name = name;
    }
    if (data.category !== undefined) sh.category = data.category;
    if (data.icon !== undefined) sh.icon = data.icon;
    if (data.color !== undefined) sh.color = data.color;
    if (data.linkedAccountId !== undefined) sh.linkedAccountId = data.linkedAccountId;
    if (data.monthlyTarget !== undefined) sh.monthlyTarget = parseFloat(data.monthlyTarget || 0);
    if (data.status !== undefined) sh.status = data.status;
    if (data.notes !== undefined) sh.notes = (data.notes || '').trim();

    await this.save();
    return sh;
  }

  async deleteSideHustle(id) {
    if (!this.state.sideHustles) this.state.sideHustles = [];
    const idx = this.state.sideHustles.findIndex(s => s.id === id);
    if (idx !== -1) {
      (this.state.transactions || []).forEach(t => {
        if (t.sideHustleId === id) delete t.sideHustleId;
      });
      this.state.sideHustles.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  getSideHustleInsights(id) {
    const sh = (this.state.sideHustles || []).find(s => s.id === id);
    if (!sh) return null;

    const linkedTransactions = (this.state.transactions || []).filter(t => t.sideHustleId === id);

    let grossRevenue = 0; // Faturamento Bruto
    let operationalCosts = 0; // Custos / Insumos
    let proLaboreWithdrawals = 0; // Retiradas para o bolso pessoal

    linkedTransactions.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') {
        grossRevenue += amt;
      } else if (t.type === 'expense') {
        if (t.isProLabore || (t.description && t.description.toLowerCase().includes('pró-labore'))) {
          proLaboreWithdrawals += amt;
        } else {
          operationalCosts += amt;
        }
      }
    });

    const netProfit = +(grossRevenue - operationalCosts).toFixed(2); // Lucro Líquido Gerado
    const profitMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;
    const targetProgress = sh.monthlyTarget > 0 ? Math.min(100, Math.round((netProfit / sh.monthlyTarget) * 100)) : 100;

    return {
      sideHustle: sh,
      transactions: linkedTransactions,
      grossRevenue: +grossRevenue.toFixed(2),
      operationalCosts: +operationalCosts.toFixed(2),
      netProfit,
      profitMargin,
      proLaboreWithdrawals: +proLaboreWithdrawals.toFixed(2),
      monthlyTarget: +(sh.monthlyTarget || 0).toFixed(2),
      targetProgress
    };
  }

  getAllSideHustlesInsights() {
    return (this.state.sideHustles || []).map(sh => this.getSideHustleInsights(sh.id));
  }



  async deleteAccount(id) {
    const idx = this.state.accounts.findIndex(a => a.id === id);
    if (idx !== -1) {
      this._recordDeletion(id);
      this.state.accounts.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  // --- GESTÃO DE CATEGORIAS (CRUD & INTEGRIDADE) ---
  async addCategory(data) {
    if (!this.state.categories) this.state.categories = [];

    const name = (data.name || '').trim();
    if (!name) throw new Error('O nome da categoria é obrigatório.');

    const category = {
      id: genId('cat'),
      name: name,
      type: data.type || 'expense', // 'expense' | 'income' | 'transfer'
      icon: data.icon || 'tag',
      color: data.color || '#3b82f6'
    };

    this.state.categories.push(category);
    await this.save();
    return category;
  }

  async updateCategory(id, data) {
    if (!this.state.categories) this.state.categories = [];
    const cat = this.state.categories.find(c => c.id === id);
    if (!cat) throw new Error('Categoria não encontrada.');

    if (data.name !== undefined) {
      const name = (data.name || '').trim();
      if (!name) throw new Error('O nome da categoria não pode ficar vazio.');
      cat.name = name;
    }
    if (data.type !== undefined) cat.type = data.type;
    if (data.icon !== undefined) cat.icon = data.icon;
    if (data.color !== undefined) cat.color = data.color;

    await this.save();
    return cat;
  }

  getCategoryUsage(id) {
    const transactionsCount = (this.state.transactions || []).filter(t => t.categoryId === id).length;
    const schedulesCount = (this.state.schedules || []).filter(s => s.categoryId === id).length;
    const hasBudget = (this.state.budgets || []).some(b => b.categoryId === id);

    return {
      transactionsCount,
      schedulesCount,
      hasBudget,
      totalLinked: transactionsCount + schedulesCount + (hasBudget ? 1 : 0)
    };
  }

  async deleteCategory(id, fallbackCategoryId = null) {
    if (!this.state.categories) this.state.categories = [];
    const idx = this.state.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      // Reatribui transações e agendamentos se houver fallback
      let targetFallback = fallbackCategoryId;
      if (!targetFallback) {
        const otherCat = this.state.categories.find(c => c.id !== id);
        targetFallback = otherCat ? otherCat.id : null;
      }

      if (targetFallback) {
        (this.state.transactions || []).forEach(t => {
          if (t.categoryId === id) t.categoryId = targetFallback;
        });
        (this.state.schedules || []).forEach(s => {
          if (s.categoryId === id) s.categoryId = targetFallback;
        });
      }

      // Remove orçamento vinculado a esta categoria se existir
      if (this.state.budgets) {
        this.state.budgets = this.state.budgets.filter(b => b.categoryId !== id);
      }

      this.state.categories.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  // --- ORÇAMENTOS (PREVISTO VS REALIZADO) ---
  async setBudget(categoryId, limit) {
    let budget = this.state.budgets.find(b => b.categoryId === categoryId);
    if (budget) {
      budget.limit = parseFloat(limit);
    } else {
      budget = {
        id: genId('bg'),
        categoryId: categoryId,
        limit: parseFloat(limit),
        period: 'monthly'
      };
      this.state.budgets.push(budget);
    }
    await this.save();
    return budget;
  }

  getBudgetComparison(month = null, year = null) {
    const expensesByCategory = this.getExpensesByCategory(month, year);
    const list = [];
    const processedCategoryIds = new Set();

    // 1. Inclui todas as categorias que possuem orçamento explícito definido
    this.state.budgets.forEach(b => {
      const cat = this.state.categories.find(c => c.id === b.categoryId);
      if (cat) {
        processedCategoryIds.add(cat.id);
        const actual = expensesByCategory[cat.name] ? expensesByCategory[cat.name].total : 0;
        const percent = b.limit > 0 ? Math.round((actual / b.limit) * 100) : 0;
        list.push({
          id: b.id,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color || '#3b82f6',
          categoryIcon: cat.icon || 'tag',
          limit: b.limit,
          actual: actual,
          remaining: b.limit - actual,
          percent: percent,
          isOver: b.limit > 0 && actual > b.limit,
          hasLimit: true
        });
      }
    });

    // 2. Inclui dinamicamente qualquer outra categoria de despesa (com gasto atual ou cadastrada)
    this.state.categories.filter(c => c.type === 'expense').forEach(cat => {
      if (!processedCategoryIds.has(cat.id)) {
        processedCategoryIds.add(cat.id);
        const actual = expensesByCategory[cat.name] ? expensesByCategory[cat.name].total : 0;
        list.push({
          id: 'bg-auto-' + cat.id,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color || '#6366f1',
          categoryIcon: cat.icon || 'tag',
          limit: 0,
          actual: actual,
          remaining: 0,
          percent: 0,
          isOver: false,
          hasLimit: false
        });
      }
    });

    // Ordena: primeiro as com limite definido ou com gastos, e por maior gasto
    return list.sort((a, b) => {
      if (a.actual > 0 && b.actual === 0) return -1;
      if (b.actual > 0 && a.actual === 0) return 1;
      return b.actual - a.actual;
    });
  }

  syncCreditCardBalances() {
    if (!this.state.accounts || !this.state.transactions) return;
    this.state.accounts.forEach(acc => {
      if (acc.type === 'credit') {
        const cardTxs = this.state.transactions.filter(t => 
          t.accountId === acc.id || t.fromAccountId === acc.id || t.toAccountId === acc.id
        );
        let totalDebt = 0;
        cardTxs.forEach(t => {
          const amt = parseFloat(t.amount || 0);
          if (t.type === 'expense') totalDebt += amt;
          else if (t.type === 'income') totalDebt -= amt;
        });
        acc.balance = -Math.max(0, +totalDebt.toFixed(2));
      }
    });
  }

  async deleteTransaction(id) {
    const idx = this.state.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const tx = this.state.transactions[idx];
      this._recordDeletion(id);
      if (tx.type === 'transfer') {
        this.updateAccountBalance(tx.fromAccountId, tx.amount, 'income', 'add');
        this.updateAccountBalance(tx.toAccountId, tx.amount, 'expense', 'add');
      } else {
        this.updateAccountBalance(tx.accountId, tx.amount, tx.type, 'remove');
      }
      this.state.transactions.splice(idx, 1);
      this.syncCreditCardBalances();
      await this.save();
      return true;
    }
    return false;
  }

  async deleteTransactionGroup(groupId) {
    if (!groupId) return false;
    const txsToDelete = this.state.transactions.filter(t => t.installmentGroupId === groupId || t.id === groupId);
    if (txsToDelete.length === 0) return false;

    txsToDelete.forEach(tx => {
      this._recordDeletion(tx.id);
      if (tx.type === 'transfer') {
        this.updateAccountBalance(tx.fromAccountId, tx.amount, 'income', 'add');
        this.updateAccountBalance(tx.toAccountId, tx.amount, 'expense', 'add');
      } else {
        const acc = this.state.accounts.find(a => a.id === tx.accountId);
        if (acc && acc.type === 'credit') {
          this.updateAccountBalance(tx.accountId, tx.amount, tx.type, 'remove');
        } else {
          // Em contas correntes/dinheiro, apenas parcelas que de fato foram debitadas do saldo são estornadas
          if (tx.status === 'paid' || tx.installmentIndex === 1) {
            this.updateAccountBalance(tx.accountId, tx.amount, tx.type, 'remove');
          }
        }
      }
    });

    this.state.transactions = this.state.transactions.filter(t => t.installmentGroupId !== groupId && t.id !== groupId);
    this.syncCreditCardBalances();
    await this.save();
    return true;
  }

  updateAccountBalance(accId, amount, type, action) {
    const account = this.state.accounts.find(a => a.id === accId);
    if (!account) return;
    const factor = action === 'add' ? 1 : -1;
    if (type === 'income') {
      account.balance = round2((account.balance || 0) + (amount * factor));
    } else {
      account.balance = round2((account.balance || 0) - (amount * factor));
    }
    this._touchEntity(account);
  }

  // --- CÁLCULO DE DIAS ÚTEIS BRASIL (Sábados, Domingos e Feriados Nacionais) ---
  isHolidayBR(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // Feriados Nacionais Fixos no Brasil
    const fixedHolidays = [
      '01-01', // Confraternização Universal
      '04-21', // Tiradentes
      '05-01', // Dia do Trabalho
      '09-07', // Independência do Brasil
      '10-12', // Nossa Senhora Aparecida
      '11-02', // Finados
      '11-15', // Proclamação da República
      '11-20', // Dia da Consciência Negra
      '12-25'  // Natal
    ];

    if (fixedHolidays.includes(mmdd)) return true;

    // Cálculo da Páscoa (Algoritmo de Meeus/Jones/Butcher) para Carnaval, Sexta-feira Santa e Corpus Christi
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const dVal = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - dVal - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const mVal = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * mVal + 114) / 31);
    const easterDay = ((h + l - 7 * mVal + 114) % 31) + 1;

    const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const easter = new Date(y, easterMonth - 1, easterDay);
    const carnival = new Date(easter.getTime() - 47 * 86400000); // Terça de Carnaval
    const goodFriday = new Date(easter.getTime() - 2 * 86400000); // Sexta-feira Santa
    const corpusChristi = new Date(easter.getTime() + 60 * 86400000); // Corpus Christi

    if (isSameDay(date, carnival) || isSameDay(date, goodFriday) || isSameDay(date, corpusChristi)) {
      return true;
    }

    return false;
  }

  isBusinessDay(date, includeSaturday = false) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return false; // Domingo nunca é dia útil
    if (!includeSaturday && dayOfWeek === 6) return false; // Sábado não é dia bancário útil
    if (this.isHolidayBR(date)) return false;
    return true;
  }

  calculateBusinessDayDate(year, month, rule = '5th_business_clt') {
    // month: 1 a 12
    if (rule === '1st_business') {
      let d = 1;
      while (d <= 31) {
        const testDate = new Date(year, month - 1, d);
        if (this.isBusinessDay(testDate, false)) return testDate;
        d++;
      }
    }

    // Regra CLT: 5º dia útil incluindo sábados (art. 459 §1º CLT). Se o 5º dia útil cair em sábado, antecipa para sexta-feira útil
    if (rule === '5th_business_clt' || rule === '5th_business') {
      const isCLT = rule === '5th_business_clt';
      if (isCLT) {
        let count = 0;
        let d = 1;
        while (count < 5 && d <= 31) {
          const testDate = new Date(year, month - 1, d);
          if (this.isBusinessDay(testDate, true)) { // conta sábado como dia útil na contagem CLT
            count++;
            if (count === 5) {
              // Se o 5º dia útil for sábado, antecipa para o dia bancário útil anterior
              if (testDate.getDay() === 6) {
                let prevD = d - 1;
                while (prevD >= 1) {
                  const prevDate = new Date(year, month - 1, prevD);
                  if (this.isBusinessDay(prevDate, false)) return prevDate;
                  prevD--;
                }
              }
              return testDate;
            }
          }
          d++;
        }
      } else {
        // Regra Bancária pura (Segunda a Sexta sem sábados)
        let count = 0;
        let d = 1;
        while (count < 5 && d <= 31) {
          const testDate = new Date(year, month - 1, d);
          if (this.isBusinessDay(testDate, false)) {
            count++;
            if (count === 5) return testDate;
          }
          d++;
        }
      }
    }

    if (rule === 'last_business') {
      // Último dia do mês e volta até achar dia útil bancário
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      for (let d = lastDayOfMonth; d >= 1; d--) {
        const testDate = new Date(year, month - 1, d);
        if (this.isBusinessDay(testDate, false)) return testDate;
      }
    }

    return new Date(year, month - 1, 5);
  }

  // --- AGENDAMENTOS (A PAGAR / A RECEBER, BOLETOS & RECORRÊNCIA) ---
  async addSchedule(data) {
    let finalDueDate = data.dueDate;
    let dayRule = data.dayRule || 'fixed';

    // Se a regra for dia útil (ex: 5º dia útil para salário), calcula a data exata dinamicamente
    // MAS SOMENTE se o usuário não informou uma data específica deliberada
    if (dayRule !== 'fixed') {
      const today = new Date();
      let targetYear = today.getFullYear();
      let targetMonth = today.getMonth() + 1;

      // Se informou dueDate base, pega ano, mês e dia
      if (data.dueDate) {
        const [y, m, d] = data.dueDate.split('-').map(Number);
        targetYear = y;
        targetMonth = m;
        const calculated = this.calculateBusinessDayDate(targetYear, targetMonth, dayRule);
        // Se o dia digitado for diferente do dia da regra útil, respeita a data digitada pelo usuário como fixed!
        if (d && d !== calculated.getDate()) {
          dayRule = 'fixed';
          finalDueDate = data.dueDate;
        } else {
          const yStr = calculated.getFullYear();
          const mStr = String(calculated.getMonth() + 1).padStart(2, '0');
          const dStr = String(calculated.getDate()).padStart(2, '0');
          finalDueDate = `${yStr}-${mStr}-${dStr}`;
        }
      } else {
        const calculated = this.calculateBusinessDayDate(targetYear, targetMonth, dayRule);
        const yStr = calculated.getFullYear();
        const mStr = String(calculated.getMonth() + 1).padStart(2, '0');
        const dStr = String(calculated.getDate()).padStart(2, '0');
        finalDueDate = `${yStr}-${mStr}-${dStr}`;
      }
    }

    const schedule = {
      id: genId('sch'),
      description: data.description,
      amount: parseFloat(data.amount),
      type: data.type || 'expense', // 'expense' (a pagar / boleto) | 'income' (a receber / salário)
      dueDate: finalDueDate,
      dayRule: dayRule, // 'fixed' | '5th_business' | '1st_business' | 'last_business'
      categoryId: data.categoryId || (data.type === 'income' ? (this.state.categories.find(c => c.type === 'income' && /beneficio|benefício|auxilio|auxílio/.test(c.name.toLowerCase()))?.id || 'cat-1') : 'cat-4'),
      accountId: data.accountId,
      status: 'pending',
      recurring: data.recurring || 'monthly', // 'monthly' | 'yearly' | 'none'
      isBill: data.type === 'income' ? false : (data.isBill !== undefined ? !!data.isBill : true),
      barcode: data.barcode || '',
      notes: data.notes || ''
    };
    this.state.schedules.push(schedule);
    await this.save();
    return schedule;
  }

  // Atualizar agendamento existente
  async updateSchedule(id, data) {
    const idx = this.state.schedules.findIndex(s => s.id === id);
    if (idx === -1) return null;

    const oldSch = this.state.schedules[idx];
    let finalDueDate = data.dueDate || oldSch.dueDate;
    let dayRule = data.dayRule !== undefined ? data.dayRule : (oldSch.dayRule || 'fixed');

    if (dayRule !== 'fixed') {
      const today = new Date();
      let targetYear = today.getFullYear();
      let targetMonth = today.getMonth() + 1;

      if (finalDueDate) {
        const [y, m, d] = finalDueDate.split('-').map(Number);
        targetYear = y;
        targetMonth = m;
        const calculated = this.calculateBusinessDayDate(targetYear, targetMonth, dayRule);
        if (d && d !== calculated.getDate()) {
          dayRule = 'fixed';
        } else {
          const yStr = calculated.getFullYear();
          const mStr = String(calculated.getMonth() + 1).padStart(2, '0');
          const dStr = String(calculated.getDate()).padStart(2, '0');
          finalDueDate = `${yStr}-${mStr}-${dStr}`;
        }
      } else {
        const calculated = this.calculateBusinessDayDate(targetYear, targetMonth, dayRule);
        const yStr = calculated.getFullYear();
        const mStr = String(calculated.getMonth() + 1).padStart(2, '0');
        const dStr = String(calculated.getDate()).padStart(2, '0');
        finalDueDate = `${yStr}-${mStr}-${dStr}`;
      }
    }

    const updatedSchedule = {
      ...oldSch,
      description: data.description !== undefined ? data.description : oldSch.description,
      amount: data.amount !== undefined ? round2(parseFloat(data.amount)) : oldSch.amount,
      type: data.type !== undefined ? data.type : oldSch.type,
      dueDate: finalDueDate,
      dayRule: dayRule,
      categoryId: data.categoryId || oldSch.categoryId || (data.type === 'income' ? (this.state.categories.find(c => c.type === 'income' && /beneficio|benefício|auxilio|auxílio/.test(c.name.toLowerCase()))?.id || 'cat-1') : 'cat-4'),
      accountId: data.accountId !== undefined ? data.accountId : oldSch.accountId,
      recurring: data.recurring !== undefined ? data.recurring : (oldSch.recurring || 'monthly'),
      isBill: data.type === 'income' ? false : (data.isBill !== undefined ? !!data.isBill : (oldSch.isBill !== undefined ? oldSch.isBill : true)),
      barcode: data.barcode !== undefined ? data.barcode : (oldSch.barcode || ''),
      notes: data.notes !== undefined ? data.notes : (oldSch.notes || '')
    };

    this.state.schedules[idx] = updatedSchedule;
    await this.save();
    return updatedSchedule;
  }

  // Baixa / Pagamento / Recebimento de agendamento com renovação automática contínua
  async paySchedule(id, options = {}) {
    const sch = this.state.schedules.find(s => s.id === id);
    if (!sch) return null;

    const payAmount = options.amount !== undefined ? parseFloat(options.amount) : sch.amount;
    const payAccountId = options.accountId || sch.accountId;
    const payDate = options.date || localDateStr();
    const isIncome = sch.type === 'income';

    // 1. Marca agendamento atual como pago / recebido
    sch.status = 'paid';
    sch.paidAt = payDate;
    sch.paidAmount = payAmount;

    // Garante que a categoria da transação gerada seja do mesmo tipo (income vs expense)
    let finalCatId = sch.categoryId;
    const catObj = this.state.categories.find(c => c.id === finalCatId);
    if (!catObj || catObj.type !== sch.type) {
      if (isIncome) {
        const desc = (sch.description || '').toLowerCase();
        if (/seguro[\s-]?desemprego|beneficio|benefício|auxilio|auxílio|fgts|inss|previdencia|previdência|pis|pasep|restituicao|restituição|rescisao|rescisão/.test(desc)) {
          const benCat = this.state.categories.find(c => c.type === 'income' && (c.name.toLowerCase().includes('benefício') || c.name.toLowerCase().includes('beneficio')));
          finalCatId = benCat ? benCat.id : 'cat-1';
        } else {
          const salaryCat = this.state.categories.find(c => c.type === 'income');
          finalCatId = salaryCat ? salaryCat.id : 'cat-1';
        }
      } else {
        const expenseCat = this.state.categories.find(c => c.type === 'expense');
        finalCatId = expenseCat ? expenseCat.id : 'cat-4';
      }
      sch.categoryId = finalCatId;
    }

    // 2. Lança automaticamente no extrato / movimentações
    const prefix = isIncome ? 'Recebimento' : (sch.isBill ? 'Boleto Pago' : 'Baixa');
    const tx = await this.addTransaction({
      description: `[${prefix}] ${sch.description}`,
      amount: payAmount,
      type: sch.type,
      categoryId: finalCatId,
      accountId: payAccountId,
      date: payDate,
      status: 'paid',
      notes: sch.barcode ? `Código/Pix: ${sch.barcode}` : (sch.notes || ''),
      scheduleId: sch.id
    });

    // 3. RENOVAÇÃO AUTOMÁTICA CONTÍNUA: se for recorrente (mensal ou anual), agenda o próximo ciclo automaticamente
    let nextSchedule = null;
    if (sch.recurring === 'monthly' || sch.recurring === 'yearly') {
      const [y, m, d] = sch.dueDate.split('-').map(Number);
      let nextDateStr;

      if (sch.dayRule && sch.dayRule !== 'fixed') {
        // Recalcula dinamicamente pelo calendário de dias úteis para o mês seguinte
        const nextMonthYear = sch.recurring === 'monthly'
          ? (m === 12 ? { y: y + 1, m: 1 } : { y: y, m: m + 1 })
          : { y: y + 1, m: m };

        const nextDate = this.calculateBusinessDayDate(nextMonthYear.y, nextMonthYear.m, sch.dayRule);
        const nextY = nextDate.getFullYear();
        const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
        const nextD = String(nextDate.getDate()).padStart(2, '0');
        nextDateStr = `${nextY}-${nextM}-${nextD}`;
      } else {
        // Data fixa convencional
        let nextDueDate;
        if (sch.recurring === 'monthly') {
          const targetMonth = m; // mês original 1..12 (em Date 0-indexed m é o próximo mês)
          nextDueDate = new Date(y, targetMonth, d);
          if (nextDueDate.getDate() !== d) {
            nextDueDate = new Date(y, targetMonth + 1, 0);
          }
        } else {
          nextDueDate = new Date(y + 1, m - 1, d);
        }

        const nextY = nextDueDate.getFullYear();
        const nextM = String(nextDueDate.getMonth() + 1).padStart(2, '0');
        const nextD = String(nextDueDate.getDate()).padStart(2, '0');
        nextDateStr = `${nextY}-${nextM}-${nextD}`;
      }

      nextSchedule = {
        id: genId('sch') + '-next',
        description: sch.description,
        amount: sch.amount,
        type: sch.type,
        dueDate: nextDateStr,
        dayRule: sch.dayRule || 'fixed',
        categoryId: sch.categoryId,
        accountId: sch.accountId,
        status: 'pending',
        recurring: sch.recurring,
        isBill: sch.isBill,
        barcode: sch.barcode || '',
        notes: sch.notes || ''
      };

      this.state.schedules.push(nextSchedule);
    }

    await this.save();
    return { paidSchedule: sch, transaction: tx, nextSchedule };
  }

  // Monitor e inteligência de boletos e contas a pagar próximas a vencer
  getBillsInsights() {
    const todayStr = localDateStr();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filtra todas as contas e boletos a pagar pendentes
    const pendingBills = this.state.schedules.filter(s => s.status === 'pending' && s.type === 'expense');

    return pendingBills.map(b => {
      const [y, m, d] = b.dueDate.split('-').map(Number);
      const dueDate = new Date(y, m - 1, d);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let reminderLevel = 'normal';
      let reminderMessage = `Vence em ${daysUntilDue} dias`;

      if (daysUntilDue < 0) {
        reminderLevel = 'urgent';
        reminderMessage = `Vencido há ${Math.abs(daysUntilDue)} dias!`;
      } else if (daysUntilDue === 0) {
        reminderLevel = 'urgent';
        reminderMessage = 'Vence HOJE!';
      } else if (daysUntilDue <= 3) {
        reminderLevel = 'warning';
        reminderMessage = `Vence em ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'}!`;
      }

      const acc = this.state.accounts.find(a => a.id === b.accountId);

      return {
        ...b,
        daysUntilDue,
        reminderLevel,
        reminderMessage,
        dueDateFormatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
        accountName: acc ? acc.name : 'Conta Padrão'
      };
    }).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  // Monitor e inteligência de salários e proventos a receber com alertas de confirmação
  getSalaryIncomeInsights() {
    const todayStr = localDateStr();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingIncomes = this.state.schedules.filter(s => s.status === 'pending' && s.type === 'income');

    return pendingIncomes.map(inc => {
      const [y, m, d] = inc.dueDate.split('-').map(Number);
      const dueDate = new Date(y, m - 1, d);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const isToday = daysUntilDue === 0;
      const isPast = daysUntilDue < 0;
      const isSoon = daysUntilDue > 0 && daysUntilDue <= 3;

      let ruleDesc = 'Data Fixa';
      if (inc.dayRule === '5th_business_clt') ruleDesc = '5º dia útil (CLT)';
      else if (inc.dayRule === '5th_business') ruleDesc = '5º dia útil bancário';
      else if (inc.dayRule === '1st_business') ruleDesc = '1º dia útil';
      else if (inc.dayRule === 'last_business') ruleDesc = 'Último dia útil';

      let alertTitle = '';
      let alertMessage = '';
      if (isToday) {
        alertTitle = '💰 Pagamento Previsto para Hoje!';
        alertMessage = `Seu recebimento de ${inc.description} (${ruleDesc}) está agendado para HOJE (${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}). O valor já foi creditado na sua conta?`;
      } else if (isPast) {
        alertTitle = '⚠️ Recebimento Pendente de Baixa';
        alertMessage = `A data prevista do seu ${inc.description} foi em ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} (${Math.abs(daysUntilDue)} dias atrás). Deseja confirmar o recebimento?`;
      } else if (isSoon) {
        alertTitle = '🗓️ Recebimento Próximo';
        alertMessage = `Seu ${inc.description} está previsto para daqui a ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'} (${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}).`;
      }

      const acc = this.state.accounts.find(a => a.id === inc.accountId);

      return {
        ...inc,
        daysUntilDue,
        isToday,
        isPast,
        isSoon,
        ruleDesc,
        alertTitle,
        alertMessage,
        dueDateFormatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
        accountName: acc ? acc.name : 'Conta Padrão'
      };
    }).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  async deleteSchedule(id) {
    const idx = this.state.schedules.findIndex(s => s.id === id);
    if (idx !== -1) {
      this._recordDeletion(id);
      this.state.schedules.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  // --- PROJEÇÃO DE FLUXO DE CAIXA FUTURO ---
  getCashFlowForecast(days = 30) {
    const now = new Date();
    let currentBalance = this.state.accounts.reduce((sum, a) => sum + (a.type !== 'credit' ? a.balance : 0), 0);

    const forecast = [];
    for (let i = 0; i <= days; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateStr = localDateStr(targetDate);

      // Procura contas agendadas neste dia
      const scheduledToday = this.state.schedules.filter(s => s.dueDate === dateStr && s.status === 'pending');
      let dailyIncome = 0;
      let dailyExpense = 0;

      scheduledToday.forEach(s => {
        if (s.type === 'income') dailyIncome += s.amount;
        if (s.type === 'expense') dailyExpense += s.amount;
      });

      currentBalance = currentBalance + dailyIncome - dailyExpense;

      forecast.push({
        date: dateStr,
        dayLabel: `${targetDate.getDate()}/${targetDate.getMonth() + 1}`,
        balance: currentBalance,
        inflow: dailyIncome,
        outflow: dailyExpense
      });
    }

    return forecast;
  }

  // --- BENS PATRIMONIAIS & FINANCIAMENTOS ---
  async addAsset(data) {
    const asset = {
      id: genId('ast'),
      name: data.name,
      type: data.type,
      estimatedValue: parseFloat(data.estimatedValue),
      financedValue: parseFloat(data.financedValue || 0),
      installmentsPaid: parseInt(data.installmentsPaid || 0),
      installmentsTotal: parseInt(data.installmentsTotal || 0),
      monthlyRate: parseFloat(data.monthlyRate || 0)
    };
    this.state.assets.push(asset);
    await this.save();
    return asset;
  }

  async deleteAsset(id) {
    const idx = this.state.assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      this._recordDeletion(id);
      this.state.assets.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  // --- METAS & SONHOS (CRUD, APORTES & INTELIGÊNCIA) ---
  async addGoal(data) {
    if (!this.state.goals) this.state.goals = [];

    const targetAmount = Math.abs(parseFloat(data.targetAmount) || 0);
    const initialAmount = Math.abs(parseFloat(data.currentAmount) || 0);
    const linkedAccountId = data.linkedAccountId || null;

    const goal = {
      id: genId('goal'),
      title: data.title || 'Meu Objetivo',
      category: data.category || 'other',
      icon: data.icon || 'target',
      targetAmount: targetAmount,
      currentAmount: initialAmount,
      deadline: data.deadline || '',
      linkedAccountId: linkedAccountId,
      color: data.color || '#3b82f6',
      createdAt: localDateStr(),
      history: initialAmount > 0 ? [{
        id: genId('gh'),
        date: localDateStr(),
        amount: initialAmount,
        type: 'deposit',
        notes: 'Aporte Inicial'
      }] : []
    };

    this.state.goals.push(goal);
    await this.save();
    return goal;
  }

  async updateGoal(id, data) {
    if (!this.state.goals) this.state.goals = [];
    const goal = this.state.goals.find(g => g.id === id);
    if (!goal) return null;

    if (data.title !== undefined) goal.title = data.title;
    if (data.category !== undefined) goal.category = data.category;
    if (data.icon !== undefined) goal.icon = data.icon;
    if (data.targetAmount !== undefined) goal.targetAmount = Math.abs(parseFloat(data.targetAmount) || 0);
    if (data.deadline !== undefined) goal.deadline = data.deadline;
    if (data.linkedAccountId !== undefined) goal.linkedAccountId = data.linkedAccountId;
    if (data.color !== undefined) goal.color = data.color;

    await this.save();
    return goal;
  }

  async deleteGoal(id) {
    if (!this.state.goals) this.state.goals = [];
    const idx = this.state.goals.findIndex(g => g.id === id);
    if (idx !== -1) {
      this._recordDeletion(id);
      this.state.goals.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  async contributeToGoal(goalId, options = {}) {
    if (!this.state.goals) this.state.goals = [];
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) throw new Error('Meta financeira não encontrada.');

    const amount = Math.abs(parseFloat(options.amount));
    if (isNaN(amount) || amount <= 0) throw new Error('Valor inválido para o aporte.');

    const date = options.date || localDateStr();
    const notes = options.notes || '';
    const debitFromAccount = !!options.debitFromAccount;
    const accountId = options.accountId || goal.linkedAccountId;

    let transaction = null;

    if (debitFromAccount && accountId) {
      const account = this.state.accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Conta bancária de débito não encontrada.');
      if (account.type === 'credit') throw new Error('Não é possível debitar aportes de cartões de crédito.');
      if (account.balance < amount) {
        throw new Error(`Saldo insuficiente na conta ${account.name} (Disponível: R$ ${account.balance.toFixed(2)}).`);
      }

      transaction = await this.addTransaction({
        description: `[Aporte Meta] ${goal.title}`,
        amount: amount,
        type: 'expense',
        categoryId: 'cat-2',
        accountId: account.id,
        date: date,
        status: 'paid',
        notes: notes || `Aporte na meta "${goal.title}"`
      });
    }

    goal.currentAmount = +( (goal.currentAmount || 0) + amount ).toFixed(2);
    if (!goal.history) goal.history = [];

    goal.history.unshift({
      id: genId('gh'),
      date: date,
      amount: amount,
      type: 'deposit',
      notes: notes,
      accountId: accountId || null,
      txId: transaction ? transaction.id : null
    });

    await this.save();
    return { goal, transaction };
  }

  async withdrawFromGoal(goalId, options = {}) {
    if (!this.state.goals) this.state.goals = [];
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) throw new Error('Meta financeira não encontrada.');

    const amount = Math.abs(parseFloat(options.amount));
    if (isNaN(amount) || amount <= 0) throw new Error('Valor inválido para resgate.');

    if ((goal.currentAmount || 0) < amount) {
      throw new Error(`Saldo insuficiente na meta para resgatar este valor (Acumulado: R$ ${(goal.currentAmount || 0).toFixed(2)}).`);
    }

    const date = options.date || localDateStr();
    const notes = options.notes || '';
    const creditToAccount = !!options.creditToAccount;
    const accountId = options.accountId || goal.linkedAccountId;

    let transaction = null;

    if (creditToAccount && accountId) {
      const account = this.state.accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Conta bancária de crédito não encontrada.');

      transaction = await this.addTransaction({
        description: `[Resgate Meta] ${goal.title}`,
        amount: amount,
        type: 'income',
        categoryId: 'cat-2',
        accountId: account.id,
        date: date,
        status: 'paid',
        notes: notes || `Resgate da meta "${goal.title}" para a conta`
      });
    }

    goal.currentAmount = +( (goal.currentAmount || 0) - amount ).toFixed(2);
    if (!goal.history) goal.history = [];

    goal.history.unshift({
      id: genId('gh'),
      date: date,
      amount: amount,
      type: 'withdraw',
      notes: notes,
      accountId: accountId || null,
      txId: transaction ? transaction.id : null
    });

    await this.save();
    return { goal, transaction };
  }

  getGoalsSummary() {
    const goals = this.state.goals || [];
    let totalTarget = 0;
    let totalSaved = 0;
    let completedCount = 0;
    let activeCount = 0;

    goals.forEach(g => {
      const target = g.targetAmount || 0;
      const current = g.currentAmount || 0;
      totalTarget += target;
      totalSaved += current;

      if (target > 0 && current >= target) {
        completedCount++;
      } else {
        activeCount++;
      }
    });

    const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
    const remainingVal = Math.max(0, totalTarget - totalSaved);

    return {
      totalGoals: goals.length,
      totalTarget,
      totalSaved,
      remaining: remainingVal,
      totalRemaining: remainingVal,
      overallPercentage,
      completedCount,
      activeCount
    };
  }

  calculateGoalPace(goal) {
    const target = goal.targetAmount || 0;
    const current = goal.currentAmount || 0;
    const remaining = Math.max(0, target - current);
    const isCompleted = target > 0 && current >= target;
    const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    if (isCompleted || !goal.deadline) {
      return {
        remaining: isCompleted ? 0 : remaining,
        remainingAmount: isCompleted ? 0 : remaining,
        percent: isCompleted ? 100 : percent,
        progressPercent: isCompleted ? 100 : percent,
        isCompleted,
        isExpired: false,
        daysRemaining: 0,
        monthsRemaining: 0,
        monthlyRecommended: 0,
        recommendedMonthlyPace: 0,
        recommendedDailyPace: 0,
        paceMessage: isCompleted ? '🎉 Parabéns! Meta 100% Conquistada!' : 'Sem prazo definido'
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [y, m, d] = goal.deadline.split('-').map(Number);
    const deadlineDate = new Date(y, m - 1, d);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30.44));

    if (diffDays <= 0) {
      return {
        remaining,
        remainingAmount: remaining,
        percent,
        progressPercent: percent,
        isCompleted: false,
        isExpired: true,
        daysRemaining: 0,
        monthsRemaining: 0,
        monthlyRecommended: remaining,
        recommendedMonthlyPace: remaining,
        recommendedDailyPace: +(remaining / 30).toFixed(2),
        paceMessage: `⚠️ Prazo expirado em ${d}/${m}/${y}`
      };
    }

    const monthlyRecommended = +(remaining / monthsRemaining).toFixed(2);
    const dailyRecommended = +(monthlyRecommended / 30).toFixed(2);

    return {
      remaining,
      remainingAmount: remaining,
      percent,
      progressPercent: percent,
      isCompleted: false,
      isExpired: false,
      daysRemaining: diffDays,
      monthsRemaining,
      monthlyRecommended,
      recommendedMonthlyPace: monthlyRecommended,
      recommendedDailyPace: dailyRecommended,
      paceMessage: `Poupar ~ ${monthlyRecommended.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / mês (${monthsRemaining} meses restantes)`
    };
  }

  // --- PARSER OFX / EXCEL / CSV / PDF (CONCILIAÇÃO BANCÁRIA) ---
  parseOFX(ofxContent) {
    const transactions = [];
    if (!ofxContent || typeof ofxContent !== 'string') return transactions;

    const stmtRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi;
    let match;

    while ((match = stmtRegex.exec(ofxContent)) !== null) {
      const block = match[1];
      const typeMatch = block.match(/<TRNTYPE>\s*([^<\r\n]+)/i);
      const dateMatch = block.match(/<DTPOSTED>\s*(\d{8})/i);
      const amountMatch = block.match(/<TRNAMT>\s*([-\d.,]+)/i);
      const memoMatch = block.match(/<MEMO>\s*([^<\r\n]+)/i);
      const nameMatch = block.match(/<NAME>\s*([^<\r\n]+)/i);

      if (amountMatch) {
        let cleanAmt = amountMatch[1].trim().replace(',', '.');
        const rawAmount = parseFloat(cleanAmt);
        if (isNaN(rawAmount)) continue;

        const type = rawAmount >= 0 ? 'income' : 'expense';
        const absAmount = Math.abs(rawAmount);

        let dateStr = localDateStr();
        if (dateMatch && dateMatch[1].length >= 8) {
          const rawDate = dateMatch[1];
          dateStr = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        }

        const desc = (memoMatch && memoMatch[1].trim()) || (nameMatch && nameMatch[1].trim()) || 'Lançamento OFX';

        transactions.push({
          description: desc,
          amount: Math.round(absAmount * 100) / 100,
          type: type,
          date: dateStr
        });
      }
    }

    return transactions;
  }

  // Parser para Planilhas Excel (.xlsx, .xls)
  parseExcel(workbookData) {
    if (typeof XLSX === 'undefined') {
      console.error('Biblioteca XLSX não carregada.');
      return [];
    }

    const workbook = XLSX.read(workbookData, { type: 'binary', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    return this._normalizeExtractedRows(rows);
  }

  // Parser para CSV (.csv)
  parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    // Detecção de delimitador (, ou ;)
    const sample = lines.slice(0, 5).join('\n');
    const commaCount = (sample.match(/,/g) || []).length;
    const semicolonCount = (sample.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const rows = lines.map(line => {
      // Divide respeitando aspas
      const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`, 'g');
      const cells = [];
      let m;
      while ((m = regex.exec(line)) !== null) {
        let val = m[1] !== undefined ? m[1].replace(/""/g, '"') : (m[2] || '');
        cells.push(val.trim());
      }
      return cells;
    });

    return this._normalizeExtractedRows(rows);
  }

  // Normalização de linhas tabulares de Excel ou CSV
  _normalizeExtractedRows(rows) {
    const transactions = [];
    if (!rows || rows.length === 0) return transactions;

    // Localizar índices das colunas
    let dateIdx = -1;
    let descIdx = -1;
    let amountIdx = -1;
    let headerFound = false;
    let startIndex = 0;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i].map(c => String(c || '').toLowerCase().trim());
      const d = row.findIndex(c => c.includes('data') || c.includes('date') || c.includes('dia'));
      const desc = row.findIndex(c => c.includes('descri') || c.includes('hist') || c.includes('memo') || c.includes('lançamento') || c.includes('detalhe'));
      const val = row.findIndex(c => c.includes('valor') || c.includes('amount') || c.includes('total') || c.includes('quantia'));

      if (d !== -1 && (desc !== -1 || val !== -1)) {
        dateIdx = d;
        descIdx = desc !== -1 ? desc : (d === 0 ? 1 : 0);
        amountIdx = val !== -1 ? val : (descIdx === 1 ? 2 : 1);
        headerFound = true;
        startIndex = i + 1;
        break;
      }
    }

    // Se não encontrou cabeçalho explícito, tenta deduzir pela primeira linha de dados
    if (!headerFound) {
      dateIdx = 0;
      descIdx = 1;
      amountIdx = 2;
      startIndex = 0;
    }

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawDate = row[dateIdx];
      const rawDesc = row[descIdx];
      const rawVal = row[amountIdx];

      if (!rawDate && !rawVal) continue;

      const parsedDate = this._parseFlexibleDate(rawDate);
      const parsedAmount = this._parseFlexibleAmount(rawVal);

      if (parsedDate && parsedAmount !== null && !isNaN(parsedAmount.absAmount) && parsedAmount.absAmount > 0) {
        transactions.push({
          date: parsedDate,
          description: String(rawDesc || 'Lançamento Importado').trim() || 'Lançamento Importado',
          amount: parsedAmount.absAmount,
          type: parsedAmount.type
        });
      }
    }

    return transactions;
  }

  // Parser para Texto extraído de Extratos bancários em PDF
  parsePDFText(pdfText) {
    const transactions = [];
    if (!pdfText || typeof pdfText !== 'string') return transactions;

    const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Detecção automática do saldo final da conta constante no extrato
    let detectedStatementBalance = null;
    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      const l = lines[i];
      if (l.toLowerCase().includes('saldo em conta')) {
        const target = l + ' ' + (lines[i+1] || '');
        const m = target.match(/(?:R\$\s*)?([+-]?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})/);
        if (m) {
          const clean = m[1].replace(/\./g, '').replace(',', '.');
          detectedStatementBalance = parseFloat(clean);
          break;
        }
      }
    }
    if (detectedStatementBalance === null) {
      for (const l of lines) {
        if (l.toLowerCase().includes('saldo do dia')) {
          const m = l.match(/(?:R\$\s*)?([+-]?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})$/);
          if (m) {
            const clean = m[1].replace(/\./g, '').replace(',', '.');
            detectedStatementBalance = parseFloat(clean);
            break;
          }
        }
      }
    }

    for (let idx = 0; idx < lines.length; idx++) {
      let line = lines[idx];
      const lower = line.toLowerCase();

      // Ignorar cabeçalhos e saldos parciais/totais
      if (lower.includes('saldo anterior') || lower.includes('saldo final') || lower.includes('saldo do dia') || lower.includes('extrato de conta') || lower.includes('total de entradas') || lower.includes('total de saídas')) {
        continue;
      }

      // 1. Extração prioritária: Linha que começa com data (DD/MM/AAAA ou DD/MM)
      const dateMatch = line.match(/^(\d{2}[/-]\d{2}(?:[/-]\d{2,4})?)/);
      if (dateMatch) {
        const dateStr = this._parseFlexibleDate(dateMatch[1]);
        const rest = line.substring(dateMatch[0].length).trim();

        // Separação inteligente de descrição e valor colados:
        // Caso A: Negativo explícito com sinal '-' (ex: 'PAGAMENTOCONTA SANASA-119,64' ou '...T06/10-710,03')
        const negMatch = rest.match(/^(.*?)(-[\d.]+(?:,\d{2})?)$/);
        if (negMatch) {
          const amtObj = this._parseFlexibleAmount(negMatch[2]);
          const desc = this._cleanTransactionDescription(negMatch[1]);
          if (dateStr && amtObj && amtObj.absAmount > 0 && desc.length > 1) {
            transactions.push({
              date: dateStr,
              description: desc,
              amount: amtObj.absAmount,
              type: 'expense'
            });
            continue;
          }
        }

        // Caso B: Positivo colado em sufixo de data /MM (ex: 'PIX TRANSF Lucas M06/107.143,00' -> desc: '...M06/10', valor: '7.143,00')
        const slashColadaMatch = rest.match(/^(.*?\/\d{2})([+-]?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})$/);
        if (slashColadaMatch) {
          const amtObj = this._parseFlexibleAmount(slashColadaMatch[2]);
          const desc = this._cleanTransactionDescription(slashColadaMatch[1]);
          if (dateStr && amtObj && amtObj.absAmount > 0 && desc.length > 1) {
            transactions.push({
              date: dateStr,
              description: desc,
              amount: amtObj.absAmount,
              type: amtObj.type
            });
            continue;
          }
        }

        // Caso C: Positivo normal no final da linha (com ou sem espaço, ex: 'TED 104.0000.CAIXA E F 2.519,00' ou '...80,00')
        const posMatch = rest.match(/^(.*?)((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})$/);
        if (posMatch) {
          const amtObj = this._parseFlexibleAmount(posMatch[2]);
          const desc = this._cleanTransactionDescription(posMatch[1]);
          if (dateStr && amtObj && amtObj.absAmount > 0 && desc.length > 1) {
            transactions.push({
              date: dateStr,
              description: desc,
              amount: amtObj.absAmount,
              type: amtObj.type
            });
            continue;
          }
        }
      }

      // 2. Fallback de linha única genérica (ex: '05/10/2026 TARIFA BANCARIA 12,00 D')
      const fallbackRegex = /^(\d{2}[/-]\d{2}(?:[/-]\d{2,4})?)\s+(.*?)\s+([+-]?\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}\s*[-+DCdc]?)$/;
      const fMatch = line.match(fallbackRegex);
      if (fMatch) {
        const dateStr = this._parseFlexibleDate(fMatch[1]);
        const desc = this._cleanTransactionDescription(fMatch[2]);
        const amtObj = this._parseFlexibleAmount(fMatch[3]);
        if (dateStr && amtObj && amtObj.absAmount > 0 && desc.length > 1) {
          transactions.push({
            date: dateStr,
            description: desc,
            amount: amtObj.absAmount,
            type: amtObj.type
          });
          continue;
        }
      }

      // 3. Fallback para PDFs onde a data está em uma linha e o valor na linha seguinte
      const singleDateMatch = line.match(/\b(\d{2}[/-]\d{2}(?:[/-]\d{2,4})?)\b/);
      if (singleDateMatch && idx + 1 < lines.length) {
        const nextLine = lines[idx + 1];
        const nextAmtMatch = nextLine.match(/([+-]?\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}\s*[-+DCdc]?)$/);
        if (nextAmtMatch) {
          const dateStr = this._parseFlexibleDate(singleDateMatch[1]);
          const amtObj = this._parseFlexibleAmount(nextAmtMatch[0]);
          let rawDesc = (line.replace(singleDateMatch[0], '') + ' ' + nextLine.replace(nextAmtMatch[0], '')).trim();
          const desc = this._cleanTransactionDescription(rawDesc);

          if (dateStr && amtObj && amtObj.absAmount > 0 && desc.length > 1) {
            transactions.push({
              date: dateStr,
              description: desc,
              amount: amtObj.absAmount,
              type: amtObj.type
            });
            idx++; // Avança linha consumida
          }
        }
      }
    }

    if (detectedStatementBalance !== null) {
      transactions.detectedStatementBalance = detectedStatementBalance;
    }

    return transactions;
  }

  // Utilitário para limpar ruídos de OCR/PDF da descrição do lançamento
  _cleanTransactionDescription(rawDesc) {
    if (!rawDesc) return '';
    let d = String(rawDesc).trim();

    // 1. Remove fragmentos de ano colados no início vindos de quebras de coluna (ex: '/2026PIX' -> 'PIX', '2026 PIX' -> 'PIX')
    d = d.replace(/^\/?\d{2,4}\s*/, '');

    // 2. Remove pontuações ou marcadores iniciais
    d = d.replace(/^[-–—|•*#]\s*/, '');

    // 3. Remove sufixos com datas redundantes anexadas ao final da descrição (ex: 'CPFL PAULIS13/10' ou 'T07/10' -> preserva contexto ou limpa data)
    // d = d.replace(/\b\d{2}[/-]\d{2}(?:[/-]\d{2,4})?\b$/, '').trim();

    // 4. Normaliza espaços múltiplos
    d = d.replace(/\s{2,}/g, ' ').trim();

    return d;
  }

  // Utilitário para parse de datas flexíveis (DD/MM/AAAA, DD/MM, AAAA-MM-DD)
  _parseFlexibleDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) {
      // Datas do Excel chegam como meia-noite UTC: usa componentes UTC nesse caso para não recuar 1 dia
      const isUtcMidnight = val.getUTCHours() === 0 && val.getUTCMinutes() === 0;
      return isUtcMidnight
        ? `${val.getUTCFullYear()}-${String(val.getUTCMonth() + 1).padStart(2, '0')}-${String(val.getUTCDate()).padStart(2, '0')}`
        : localDateStr(val);
    }
    const str = String(val).trim();
    if (!str) return null;

    // ISO AAAA-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // DD/MM/AAAA ou DD-MM-AAAA
    const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }

    // DD/MM/AA
    const dmyShort = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
    if (dmyShort) {
      const day = dmyShort[1].padStart(2, '0');
      const month = dmyShort[2].padStart(2, '0');
      const year = '20' + dmyShort[3];
      return `${year}-${month}-${day}`;
    }

    // DD/MM (assume ano atual)
    const dm = str.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (dm) {
      const day = dm[1].padStart(2, '0');
      const month = dm[2].padStart(2, '0');
      const year = new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  // Utilitário para parse de valores monetários flexíveis (com ou sem R$, sinal -, D/C)
  _parseFlexibleAmount(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      return {
        absAmount: Math.round(Math.abs(val) * 100) / 100,
        type: val < 0 ? 'expense' : 'income'
      };
    }

    let str = String(val).trim();
    if (!str) return null;

    let isNegative = false;
    if (str.includes('-') || str.toUpperCase().endsWith('D') || str.toUpperCase().includes('DEB')) {
      isNegative = true;
    } else if (str.toUpperCase().endsWith('C') || str.toUpperCase().includes('CRED') || str.includes('+')) {
      isNegative = false;
    }

    // Limpa caracteres não numéricos exceto , e .
    let clean = str.replace(/[R$\s+DCdc-]/g, '');
    if (!clean) return null;

    // Trata formato brasileiro 1.234,56 vs americano 1,234.56
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.indexOf('.') < clean.indexOf(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }

    const num = parseFloat(clean);
    if (isNaN(num)) return null;

    return {
      absAmount: Math.round(Math.abs(num) * 100) / 100,
      type: isNegative ? 'expense' : 'income'
    };
  }


  // =====================================================================
  // MOTOR ÚNICO DE REGRAS (fonte da verdade para Resumo, Raio-X, Categorias e Fluxo)
  // =====================================================================

  _resolvePeriod(month, year) {
    const now = new Date();
    return {
      targetMonth: month !== null && month !== undefined ? Number(month) : (now.getMonth() + 1),
      targetYear: year !== null && year !== undefined ? Number(year) : now.getFullYear()
    };
  }

  _inMonth(dateStr, month, year) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === year && m === month;
  }

  // Determina se a transação pertence ao mês/ano sob a ótica de desembolso financeiro
  // (Para receitas, débito, dinheiro e transferências: data do evento t.date.
  //  Para compras no cartão de crédito: mês de vencimento da fatura correspondente).
  isTxInBillingPeriod(t, targetMonth, targetYear) {
    if (!t || !t.date) return false;
    if (t.type === 'expense') {
      const acc = this.state.accounts.find(a => a.id === t.accountId);
      if (acc && acc.type === 'credit') {
        const inv = this.getInvoiceInfoForDate(t.date, acc.closingDay || 25, acc.dueDay || 5);
        return inv.dueMonth === targetMonth && inv.dueYear === targetYear;
      }
    }
    return this._inMonth(t.date, targetMonth, targetYear);
  }

  // true se a transação é receita/despesa real de consumo (exclui cofrinhos, transferências internas,
  // quitações de fatura e projetos isolados do orçamento mensal)
  isConsumptionTx(t) {
    if (!t || (t.type !== 'income' && t.type !== 'expense')) return false;
    const desc = t.description || '';
    if (t.isVaultAllocation || desc.startsWith('[Cofrinho')) return false;
    if (t.categoryId === 'cat-8') return false;
    if (desc.includes('Quitação de Fatura') || desc.includes('Pagamento de Fatura')) return false;
    if (t.costCenterId) {
      const cc = (this.state.costCenters || []).find(c => c.id === t.costCenterId);
      if (cc && cc.isolateFromMonthlyBudget) return false;
    }
    return true;
  }

  // true se a despesa é a baixa de um boleto/conta agendada paga por conta corrente/dinheiro
  // (pagamentos feitos no cartão de crédito continuam contando no card de Cartões)
  isBillPaymentTx(t) {
    if (!t || t.type !== 'expense') return false;
    const acc = this.state.accounts.find(a => a.id === t.accountId);
    if (acc && acc.type === 'credit') return false;
    if (t.scheduleId) return true;
    return /^\[(Boleto Pago|Baixa)\]/.test(t.description || '');
  }

  // Boletos e contas do mês: pagos (transações vinculadas) + pendentes (agendamentos a vencer)
  getMonthBills(month = null, year = null) {
    const { targetMonth, targetYear } = this._resolvePeriod(month, year);

    const paid = this.state.transactions
      .filter(t => this._inMonth(t.date, targetMonth, targetYear) && this.isConsumptionTx(t) && this.isBillPaymentTx(t))
      .map(t => ({
        id: t.id,
        scheduleId: t.scheduleId || null,
        description: (t.description || '').replace(/^\[(Boleto Pago|Baixa)\]\s*/, ''),
        amount: round2(t.amount),
        date: t.date,
        dueDate: t.date,
        accountId: t.accountId,
        categoryId: t.categoryId,
        status: 'paid'
      }));

    const pending = (this.state.schedules || [])
      .filter(s => s.type === 'expense' && s.status === 'pending' && this._inMonth(s.dueDate, targetMonth, targetYear))
      .map(s => ({
        id: s.id,
        scheduleId: s.id,
        description: s.description,
        amount: round2(s.amount),
        dueDate: s.dueDate,
        accountId: s.accountId,
        categoryId: s.categoryId,
        status: 'pending'
      }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const paidTotal = round2(paid.reduce((s, b) => s + b.amount, 0));
    const pendingTotal = round2(pending.reduce((s, b) => s + b.amount, 0));

    // Próximo boleto pendente após o mês exibido (para informar quando o mês já está quitado)
    const monthEnd = `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`;
    const nextBill = (this.state.schedules || [])
      .filter(s => s.type === 'expense' && s.status === 'pending' && s.dueDate && s.dueDate > monthEnd)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;

    return {
      paid,
      pending,
      items: [...pending, ...paid.sort((a, b) => a.date.localeCompare(b.date))],
      paidTotal,
      pendingTotal,
      total: round2(paidTotal + pendingTotal),
      nextBill: nextBill ? { id: nextBill.id, description: nextBill.description, amount: round2(nextBill.amount), dueDate: nextBill.dueDate } : null
    };
  }

  // Cálculos Consolidados (com suporte a filtro de Entidade: 'all', 'pf', 'pj')
  getFinancialSummary(month = null, year = null, entityType = 'all') {
    const { targetMonth, targetYear } = this._resolvePeriod(month, year);

    const matchesEntity = (item) => {
      if (!entityType || entityType === 'all') return true;
      const e = item.entityType || 'pf';
      return e === entityType;
    };

    const filtered = this.state.transactions.filter(t => 
      this.isTxInBillingPeriod(t, targetMonth, targetYear) && matchesEntity(t)
    );

    let totalIncome = 0;
    let paidExpense = 0;
    filtered.forEach(t => {
      if (!this.isConsumptionTx(t)) return;
      if (t.type === 'income') totalIncome += t.amount;
      if (t.type === 'expense') paidExpense += t.amount;
    });

    // Boletos pendentes do mês entram no total previsto; boletos pagos já estão em paidExpense
    const bills = this.getMonthBills(targetMonth, targetYear);
    const pendingBills = bills.pending.filter(matchesEntity);
    const paidBills = bills.paid.filter(matchesEntity);
    const pendingBillsExpense = round2(pendingBills.reduce((s, b) => s + b.amount, 0));
    const paidBillsExpense = round2(paidBills.reduce((s, b) => s + b.amount, 0));

    totalIncome = round2(totalIncome);
    paidExpense = round2(paidExpense);
    const totalExpense = round2(paidExpense + pendingBillsExpense);
    const netSavings = round2(totalIncome - totalExpense);

    const targetAccounts = this.state.accounts.filter(matchesEntity);
    const totalLiquidAssets = round2(targetAccounts.reduce((sum, a) => sum + (a.type !== 'credit' ? ((a.balance || 0) + (a.vaulted || 0)) : 0), 0));
    const totalPhysicalAssets = round2(this.state.assets.filter(matchesEntity).reduce((sum, a) => sum + ((a.estimatedValue || 0) - (a.financedValue || 0)), 0));
    const totalDebts = round2(targetAccounts.reduce((sum, a) => sum + (a.type === 'credit' && a.balance < 0 ? Math.abs(a.balance) : 0), 0));
    const netWorth = round2((totalLiquidAssets + totalPhysicalAssets) - totalDebts);

    const today = localDateStr();
    const overdueCount = (this.state.schedules || []).filter(s => s.status === 'pending' && s.dueDate < today && matchesEntity(s)).length;
    const upcomingSchedules = (this.state.schedules || []).filter(s => s.status === 'pending' && matchesEntity(s));

    return {
      totalIncome,
      totalExpense,
      paidExpense,
      pendingBillsExpense,
      pendingBillsCount: pendingBills.length,
      paidBillsExpense,
      paidBillsCount: paidBills.length,
      netSavings,
      savingsRate: totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : 0,
      totalLiquidAssets,
      totalPhysicalAssets,
      totalDebts,
      netWorth,
      transactionCount: filtered.length,
      overdueCount,
      pendingSchedulesCount: upcomingSchedules.length
    };
  }

  // Raio-X Detalhado de Métricas do Dashboard (Drill-down Inteligente)
  getMetricBreakdown(metricType, month = null, year = null, entityType = 'all') {
    const { targetMonth, targetYear } = this._resolvePeriod(month, year);
    const matchesEntity = (item) => {
      if (!entityType || entityType === 'all') return true;
      const e = item.entityType || 'pf';
      return e === entityType;
    };

    if (metricType === 'income') {
      const txs = this.state.transactions.filter(t =>
        t.type === 'income' &&
        this.isTxInBillingPeriod(t, targetMonth, targetYear) &&
        this.isConsumptionTx(t) &&
        matchesEntity(t)
      );

      let total = 0;
      const catMap = {};
      const accMap = {};

      txs.forEach(t => {
        total += t.amount;
        const cat = this.state.categories.find(c => c.id === t.categoryId) || { name: 'Outras Receitas', color: '#10b981', icon: 'wallet' };
        if (!catMap[cat.name]) catMap[cat.name] = { name: cat.name, color: cat.color || '#10b981', icon: cat.icon || 'arrow-down-left', total: 0, count: 0 };
        catMap[cat.name].total += t.amount;
        catMap[cat.name].count++;

        const acc = this.state.accounts.find(a => a.id === t.accountId) || { name: 'Conta Principal', color: '#6366f1', bankId: 'other' };
        if (!accMap[acc.name]) accMap[acc.name] = { name: acc.name, color: acc.color || '#6366f1', bankId: acc.bankId || 'other', total: 0, count: 0 };
        accMap[acc.name].total += t.amount;
        accMap[acc.name].count++;
      });

      total = round2(total);
      const categories = Object.values(catMap).map(c => ({
        ...c,
        total: round2(c.total),
        percent: total > 0 ? ((c.total / total) * 100).toFixed(1) : '0.0'
      })).sort((a, b) => b.total - a.total);

      const accounts = Object.values(accMap).map(a => ({
        ...a,
        total: round2(a.total),
        percent: total > 0 ? ((a.total / total) * 100).toFixed(1) : '0.0'
      })).sort((a, b) => b.total - a.total);

      const transactions = txs.map(t => {
        const cat = this.state.categories.find(c => c.id === t.categoryId) || { name: 'Outras Receitas', color: '#10b981', icon: 'wallet' };
        const acc = this.state.accounts.find(a => a.id === t.accountId) || { name: 'Conta', bankId: 'other' };
        return {
          id: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          categoryName: cat.name,
          categoryColor: cat.color,
          categoryIcon: cat.icon,
          accountName: acc.name,
          bankId: acc.bankId,
          entityType: t.entityType || 'pf'
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));

      const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
      const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
      const prevSummary = this.getFinancialSummary(prevMonth, prevYear, entityType);
      const prevTotal = prevSummary.totalIncome;
      const diff = round2(total - prevTotal);
      const diffPercent = prevTotal > 0 ? ((diff / prevTotal) * 100).toFixed(1) : null;

      return {
        type: 'income',
        targetMonth,
        targetYear,
        total,
        count: txs.length,
        categories,
        accounts,
        transactions,
        comparison: { prevTotal, diff, diffPercent }
      };
    }

    if (metricType === 'expense') {
      const summary = this.getFinancialSummary(targetMonth, targetYear, entityType);
      const txs = this.state.transactions.filter(t =>
        t.type === 'expense' &&
        this.isTxInBillingPeriod(t, targetMonth, targetYear) &&
        this.isConsumptionTx(t) &&
        matchesEntity(t)
      );

      const catMap = {};
      const accMap = {};

      txs.forEach(t => {
        const cat = this.state.categories.find(c => c.id === t.categoryId) || { name: 'Outras Despesas', color: '#ef4444', icon: 'tag' };
        if (!catMap[cat.name]) catMap[cat.name] = { name: cat.name, color: cat.color || '#ef4444', icon: cat.icon || 'arrow-up-right', total: 0, count: 0 };
        catMap[cat.name].total += t.amount;
        catMap[cat.name].count++;

        const acc = this.state.accounts.find(a => a.id === t.accountId) || { name: 'Outros Métodos', color: '#94a3b8', bankId: 'other', type: 'checking' };
        if (!accMap[acc.name]) accMap[acc.name] = { name: acc.name, color: acc.color || '#94a3b8', bankId: acc.bankId || 'other', type: acc.type, total: 0, count: 0 };
        accMap[acc.name].total += t.amount;
        accMap[acc.name].count++;
      });

      const bills = this.getMonthBills(targetMonth, targetYear);
      const pendingBills = bills.pending.filter(matchesEntity);
      pendingBills.forEach(b => {
        const cat = this.state.categories.find(c => c.id === b.categoryId) || { name: 'Boletos & Contas', color: '#f59e0b', icon: 'calendar-clock' };
        if (!catMap[cat.name]) catMap[cat.name] = { name: cat.name, color: cat.color || '#f59e0b', icon: cat.icon || 'calendar-clock', total: 0, count: 0 };
        catMap[cat.name].total += b.amount;
        catMap[cat.name].count++;
      });

      const total = summary.totalExpense;
      const categories = Object.values(catMap).map(c => ({
        ...c,
        total: round2(c.total),
        percent: total > 0 ? ((c.total / total) * 100).toFixed(1) : '0.0'
      })).sort((a, b) => b.total - a.total);

      const accounts = Object.values(accMap).map(a => ({
        ...a,
        total: round2(a.total),
        percent: total > 0 ? ((a.total / total) * 100).toFixed(1) : '0.0'
      })).sort((a, b) => b.total - a.total);

      const transactions = txs.map(t => {
        const cat = this.state.categories.find(c => c.id === t.categoryId) || { name: 'Despesas', color: '#ef4444' };
        const acc = this.state.accounts.find(a => a.id === t.accountId) || { name: 'Conta', bankId: 'other' };
        return {
          id: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          categoryName: cat.name,
          categoryColor: cat.color,
          accountName: acc.name,
          bankId: acc.bankId,
          isPaid: true
        };
      }).sort((a, b) => b.amount - a.amount);

      const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
      const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
      const prevSummary = this.getFinancialSummary(prevMonth, prevYear, entityType);
      const prevTotal = prevSummary.totalExpense;
      const diff = round2(total - prevTotal);
      const diffPercent = prevTotal > 0 ? ((diff / prevTotal) * 100).toFixed(1) : null;

      return {
        type: 'expense',
        targetMonth,
        targetYear,
        total,
        paidTotal: summary.paidExpense,
        pendingTotal: summary.pendingBillsExpense,
        pendingCount: pendingBills.length,
        categories,
        accounts,
        transactions,
        comparison: { prevTotal, diff, diffPercent }
      };
    }

    if (metricType === 'networth') {
      const summary = this.getFinancialSummary(targetMonth, targetYear, entityType);
      const targetAccounts = this.state.accounts.filter(matchesEntity);
      const targetAssets = (this.state.assets || []).filter(matchesEntity);
      const targetVaults = (this.state.vaults || []).filter(v => {
        const acc = this.state.accounts.find(a => a.id === v.accountId);
        return acc ? matchesEntity(acc) : true;
      });

      const checkingAndCash = targetAccounts
        .filter(a => a.type !== 'credit')
        .map(a => ({
          id: a.id,
          name: a.name,
          bankId: a.bankId,
          type: a.type,
          balance: a.balance || 0,
          vaulted: a.vaulted || 0,
          total: (a.balance || 0) + (a.vaulted || 0)
        }));

      const creditDebts = targetAccounts
        .filter(a => a.type === 'credit')
        .map(a => ({
          id: a.id,
          name: a.name,
          bankId: a.bankId,
          limit: a.limit || 0,
          invoiceBalance: a.balance < 0 ? Math.abs(a.balance) : 0
        }));

      const physicalList = targetAssets.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        estimatedValue: a.estimatedValue || 0,
        financedValue: a.financedValue || 0,
        netValue: round2((a.estimatedValue || 0) - (a.financedValue || 0))
      }));

      const totalPhysicalEstimated = round2(physicalList.reduce((s, a) => s + a.estimatedValue, 0));
      const totalPhysicalFinanced = round2(physicalList.reduce((s, a) => s + a.financedValue, 0));
      const totalCreditDebt = round2(creditDebts.reduce((s, c) => s + c.invoiceBalance, 0));
      const totalDebts = round2(totalPhysicalFinanced + totalCreditDebt);
      const totalGrossAssets = round2(summary.totalLiquidAssets + totalPhysicalEstimated);

      return {
        type: 'networth',
        netWorth: summary.netWorth,
        totalGrossAssets,
        totalDebts,
        liquidAssets: summary.totalLiquidAssets,
        accounts: checkingAndCash,
        vaults: targetVaults,
        assets: physicalList,
        creditDebts,
        totalCreditDebt,
        totalPhysicalFinanced
      };
    }

    if (metricType === 'pending') {
      const today = localDateStr();
      const allSchedules = (this.state.schedules || []).filter(matchesEntity);
      const overdue = [];
      const dueToday = [];
      const upcomingThisMonth = [];
      const otherUpcoming = [];

      allSchedules.forEach(s => {
        if (s.status !== 'pending') return;
        const acc = this.state.accounts.find(a => a.id === s.accountId) || { name: 'Conta não def.' };
        const cat = this.state.categories.find(c => c.id === s.categoryId) || { name: 'Geral' };
        const item = {
          ...s,
          accountName: acc.name,
          categoryName: cat.name,
          daysDiff: Math.round((new Date(s.dueDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / (1000 * 60 * 60 * 24))
        };

        if (s.dueDate < today) {
          overdue.push(item);
        } else if (s.dueDate === today) {
          dueToday.push(item);
        } else {
          const parts = (s.dueDate || '').split('-');
          if (parts.length === 3 && parseInt(parts[1]) === targetMonth && parseInt(parts[0]) === targetYear) {
            upcomingThisMonth.push(item);
          } else {
            otherUpcoming.push(item);
          }
        }
      });

      overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      dueToday.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      upcomingThisMonth.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const totalOverdue = round2(overdue.reduce((s, i) => s + (i.type === 'expense' ? i.amount : -i.amount), 0));
      const totalPendingMonth = round2([...dueToday, ...upcomingThisMonth].reduce((s, i) => s + (i.type === 'expense' ? i.amount : -i.amount), 0));

      return {
        type: 'pending',
        targetMonth,
        targetYear,
        overdue,
        dueToday,
        upcomingThisMonth,
        otherUpcoming,
        totalOverdue,
        totalPendingMonth,
        totalPendingCount: overdue.length + dueToday.length + upcomingThisMonth.length + otherUpcoming.length
      };
    }

    return null;
  }

  getExpensesByCategory(month = null, year = null) {
    const { targetMonth, targetYear } = this._resolvePeriod(month, year);

    const expenses = this.state.transactions.filter(t =>
      t.type === 'expense' && this.isTxInBillingPeriod(t, targetMonth, targetYear) && this.isConsumptionTx(t)
    );

    const categoryMap = {};
    const addToCat = (categoryId, amount, fallbackName, fallbackColor, fallbackIcon = 'tag') => {
      const cat = this.state.categories.find(c => c.id === categoryId) || { id: categoryId, name: fallbackName, color: fallbackColor, icon: fallbackIcon };
      if (!categoryMap[cat.name]) {
        categoryMap[cat.name] = {
          id: cat.id || categoryId,
          name: cat.name,
          color: cat.color || fallbackColor,
          icon: cat.icon || fallbackIcon,
          total: 0,
          count: 0
        };
      }
      categoryMap[cat.name].total += amount;
      categoryMap[cat.name].count++;
    };

    expenses.forEach(t => addToCat(t.categoryId, t.amount, 'Outros', '#94a3b8', 'tag'));
    // Boletos pendentes do mês entram na categoria do agendamento
    this.getMonthBills(targetMonth, targetYear).pending.forEach(b => addToCat(b.categoryId, b.amount, 'Boletos & Contas', '#f59e0b', 'receipt'));

    Object.keys(categoryMap).forEach(key => {
      categoryMap[key].total = round2(categoryMap[key].total);
    });
    return categoryMap;
  }

  getExpensesByAccount(month = null, year = null) {
    const { targetMonth, targetYear } = this._resolvePeriod(month, year);

    const expenses = this.state.transactions.filter(t =>
      t.type === 'expense' && this.isTxInBillingPeriod(t, targetMonth, targetYear) && this.isConsumptionTx(t)
    );

    const accountMap = {};
    expenses.forEach(t => {
      // Boletos pagos ficam no grupo "Boletos & Contas" (não somam no Débito/PIX)
      if (this.isBillPaymentTx(t)) return;

      const acc = this.state.accounts.find(a => a.id === t.accountId) || {
        id: 'other', name: 'Outros Métodos', type: 'checking', color: '#94a3b8', bankId: 'other'
      };
      if (!accountMap[acc.id]) {
        const invInfo = acc.type === 'credit' ? this.getInvoiceInfoForDate(t.date, acc.closingDay || 25, acc.dueDay || 5) : null;
        accountMap[acc.id] = {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          bankId: acc.bankId || 'other',
          color: acc.color || (acc.type === 'credit' ? '#6366f1' : '#10b981'),
          total: 0,
          count: 0,
          limit: acc.limit || 0,
          balance: acc.balance || 0,
          dueDay: acc.dueDay || 5,
          closingDay: acc.closingDay || 25,
          invoiceLabel: invInfo ? invInfo.label : '',
          dueDateStr: invInfo ? invInfo.dueDateStr : ''
        };
      }
      accountMap[acc.id].total += t.amount;
      accountMap[acc.id].count++;
    });

    const bills = this.getMonthBills(targetMonth, targetYear);
    if (bills.items.length > 0) {
      accountMap['bills-group'] = {
        id: 'bills-group',
        name: 'Boletos & Contas',
        type: 'bill',
        bankId: 'bills',
        color: '#f59e0b',
        total: bills.total,
        count: bills.items.length,
        paidCount: bills.paid.length,
        pendingCount: bills.pending.length,
        paidTotal: bills.paidTotal,
        pendingTotal: bills.pendingTotal,
        limit: 0,
        balance: 0,
        isBillsGroup: true,
        items: bills.items
      };
    }

    const list = Object.values(accountMap).sort((a, b) => b.total - a.total);
    list.forEach(item => { item.total = round2(item.total); });
    const grandTotal = round2(list.reduce((sum, item) => sum + item.total, 0));
    list.forEach(item => {
      item.percent = grandTotal > 0 ? +((item.total / grandTotal) * 100).toFixed(1) : 0;
    });

    return {
      list,
      grandTotal,
      byType: {
        credit: list.filter(a => a.type === 'credit'),
        // Qualquer conta que não seja cartão nem grupo de boletos (corrente, dinheiro, investimento...)
        checking: list.filter(a => a.type !== 'credit' && a.type !== 'bill'),
        bills: list.filter(a => a.type === 'bill')
      },
      bills
    };
  }

  getMonthlyAuditReport(month = null, year = null) {
    const { targetMonth, targetYear } = this._resolvePeriod(month, year);
    const summary = this.getFinancialSummary(targetMonth, targetYear);
    const byAccount = this.getExpensesByAccount(targetMonth, targetYear);
    const byCategory = this.getExpensesByCategory(targetMonth, targetYear);
    const bills = byAccount.bills;

    const creditTotal = round2(byAccount.byType.credit.reduce((sum, c) => sum + c.total, 0));
    const checkingTotal = round2(byAccount.byType.checking.reduce((sum, c) => sum + c.total, 0));
    const billsTotal = bills.total;

    const reconciledSum = round2(creditTotal + checkingTotal + billsTotal);
    const isExactMatch = Math.abs(reconciledSum - summary.totalExpense) < 0.005;

    const categoriesSum = round2(Object.values(byCategory).reduce((s, c) => s + c.total, 0));
    const categoriesMatch = Math.abs(categoriesSum - summary.totalExpense) < 0.005;

    const integrityIssues = this.runIntegrityAudit();

    const nextTargetMonth = targetMonth === 12 ? 1 : targetMonth + 1;
    const nextTargetYear = targetMonth === 12 ? targetYear + 1 : targetYear;
    const nextMonthBills = this.getMonthBills(nextTargetMonth, nextTargetYear);

    return {
      month: targetMonth,
      year: targetYear,
      totalExpense: summary.totalExpense,
      paidExpense: summary.paidExpense,
      pendingBillsExpense: bills.pendingTotal,
      creditTotal,
      checkingTotal,
      billsTotal,
      billsPaidTotal: bills.paidTotal,
      billsPendingTotal: bills.pendingTotal,
      reconciledSum,
      isExactMatch,
      categoriesSum,
      categoriesMatch,
      integrityIssues,
      isFullyPrecise: isExactMatch && categoriesMatch && integrityIssues.length === 0,
      cards: byAccount.byType.credit,
      checkingAccounts: byAccount.byType.checking,
      bills: bills.items,
      paidBills: bills.paid,
      pendingBills: bills.pending,
      nextBill: bills.nextBill,
      nextMonth: {
        month: nextTargetMonth,
        year: nextTargetYear,
        total: nextMonthBills.total,
        paidTotal: nextMonthBills.paidTotal,
        pendingTotal: nextMonthBills.pendingTotal,
        items: nextMonthBills.items,
        pending: nextMonthBills.pending,
        paid: nextMonthBills.paid
      },
      categories: Object.entries(byCategory).map(([name, data]) => ({
        id: data.id,
        name,
        color: data.color,
        icon: data.icon || 'tag',
        total: data.total,
        count: data.count,
        percent: summary.totalExpense > 0 ? +((data.total / summary.totalExpense) * 100).toFixed(1) : 0
      })).sort((a, b) => b.total - a.total)
    };
  }

  getMonthlyFlow(refMonth = null, refYear = null) {
    const now = new Date();
    const targetMonth = (refMonth !== null && refMonth !== undefined) ? Number(refMonth) : (now.getMonth() + 1);
    const targetYear = (refYear !== null && refYear !== undefined) ? Number(refYear) : now.getFullYear();

    // 1. Gera os 6 meses consecutivos terminando no mês de referência
    const windowKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, (targetMonth - 1) - i, 1);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      windowKeys.push(`${yStr}-${mStr}`);
    }

    const months = {};
    windowKeys.forEach(k => { months[k] = { income: 0, expense: 0 }; });

    this.state.transactions.forEach(t => {
      if (!t.date || !this.isConsumptionTx(t)) return;
      let key = t.date.slice(0, 7);
      if (t.type === 'expense') {
        const acc = this.state.accounts.find(a => a.id === t.accountId);
        if (acc && acc.type === 'credit') {
          const inv = this.getInvoiceInfoForDate(t.date, acc.closingDay || 25, acc.dueDay || 5);
          key = inv.invoiceKey;
        }
      }
      if (months[key]) {
        if (t.type === 'income') months[key].income += t.amount;
        if (t.type === 'expense') months[key].expense += t.amount;
      }
    });

    (this.state.schedules || []).forEach(s => {
      if (s.status !== 'pending' || !s.dueDate || s.type !== 'expense') return;
      const key = s.dueDate.slice(0, 7);
      if (months[key]) {
        months[key].expense += s.amount;
      }
    });

    const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return windowKeys.map(k => {
      const [year, month] = k.split('-');
      const mIdx = parseInt(month, 10) - 1;
      const monthLabel = monthNamesShort[mIdx] || month;
      return {
        period: `${monthLabel}/${year.slice(-2)}`,
        rawPeriod: k,
        income: round2(months[k].income),
        expense: round2(months[k].expense),
        savings: round2(months[k].income - months[k].expense)
      };
    });
  }

  // =====================================================================
  // AUDITORIA AUTOMÁTICA DE INTEGRIDADE
  // =====================================================================

  // Extrai a "contraparte" de uma descrição de extrato (ex: 'PIX TRANSF Allan T06/10' -> 'ALLAN T')
  _counterpartyKey(desc) {
    let d = String(desc || '').toUpperCase();
    d = d.replace(/\d{2}\/\d{2}(\/\d{2,4})?\s*$/, '');
    d = d.replace(/^(PIX\s+(TRANSF|QRS|ENVIADO|RECEBIDO)|TED|DOC|TRANSF(ERENCIA)?)\s+/, '');
    return d.replace(/\s{2,}/g, ' ').trim();
  }

  runIntegrityAudit() {
    const issues = [];
    const dismissed = new Set((this.state.settings && this.state.settings.dismissedAuditIssues) || []);
    const push = (issue) => { if (!dismissed.has(issue.id)) issues.push(issue); };

    const accIds = new Set(this.state.accounts.map(a => a.id));
    const catIds = new Set(this.state.categories.map(c => c.id));
    const has3Decimals = (v) => typeof v === 'number' && Math.abs(round2(v) - v) > 1e-9;

    // Contrapartes já marcadas pelo usuário como Transferência Interna (aprendizado)
    const internalKeys = new Set(
      this.state.transactions
        .filter(t => t.categoryId === 'cat-8' && !/FATURA/i.test(t.description || ''))
        .map(t => this._counterpartyKey(t.description))
        .filter(k => k.length >= 4)
    );
    const matchesInternal = (key) => {
      for (const k of internalKeys) {
        if (key === k || key.startsWith(k) || k.startsWith(key)) return true;
      }
      return false;
    };

    // Termos que indicam pagamento de fatura dos próprios cartões cadastrados
    const bankTerms = {
      c6: ['C6 BANK', 'C6BANK'], mercadopago: ['MERCADO PAG', 'MERCADOPAGO'], nubank: ['NUBANK', 'NU PAGAMENTOS'],
      inter: ['BANCO INTER'], itau: ['ITAU UNIBANCO', 'ITAUCARD'], bradesco: ['BRADESCARD'], santander: ['SANTANDER'],
      bb: ['OUROCARD'], caixa: ['CAIXA CARTAO'], picpay: ['PICPAY CARD'], xp: ['XP CARTAO'], btg: ['BTG CARTAO']
    };
    const ownCardTerms = [];
    this.state.accounts.filter(a => a.type === 'credit').forEach(a => {
      (bankTerms[a.bankId] || []).forEach(term => ownCardTerms.push({ term, card: a.name }));
    });

    this.state.transactions.forEach(t => {
      const desc = t.description || '';
      const isTransfer = t.type === 'transfer';

      if (!isTransfer && t.accountId && !accIds.has(t.accountId)) {
        push({ id: `orphan-acc:${t.id}`, level: 'error', txId: t.id, message: `"${desc}" está ligada a uma conta que não existe mais.` });
      }
      if (isTransfer && ((t.fromAccountId && !accIds.has(t.fromAccountId)) || (t.toAccountId && !accIds.has(t.toAccountId)))) {
        push({ id: `orphan-acc:${t.id}`, level: 'error', txId: t.id, message: `Transferência "${desc}" referencia conta inexistente.` });
      }
      if (!isTransfer && t.categoryId && !catIds.has(t.categoryId)) {
        push({ id: `orphan-cat:${t.id}`, level: 'warning', txId: t.id, message: `"${desc}" usa uma categoria que não existe mais.` });
      }
      if (has3Decimals(t.amount)) {
        push({ id: `decimals:${t.id}`, level: 'warning', txId: t.id, message: `"${desc}" tem valor com mais de 2 casas decimais.` });
      }

      if (!this.isConsumptionTx(t)) return;
      const acc = this.state.accounts.find(a => a.id === t.accountId);
      const isCredit = acc && acc.type === 'credit';
      const upper = desc.toUpperCase();

      // Pagamento de fatura de cartão próprio lançado como despesa (dupla contagem)
      if (t.type === 'expense' && !isCredit) {
        const hit = ownCardTerms.find(o => upper.includes(o.term));
        if (hit || /FATURA|PAGTO CART|PAG CARTAO|PAGAMENTO CARTAO/.test(upper)) {
          push({
            id: `card-payment:${t.id}`, level: 'warning', txId: t.id, fix: 'internal',
            message: `"${desc}" (${t.date.split('-').reverse().join('/')}, R$ ${t.amount.toFixed(2).replace('.', ',')}) parece pagamento de fatura${hit ? ' do ' + hit.card : ''}. Contar como despesa duplica as compras do cartão.`
          });
          return;
        }
      }

      // Contraparte já reconhecida como transferência entre contas próprias
      const key = this._counterpartyKey(desc);
      if (key.length >= 4 && matchesInternal(key)) {
        push({
          id: `self-transfer:${t.id}`, level: 'warning', txId: t.id, fix: 'internal',
          message: `"${desc}" (${t.date.split('-').reverse().join('/')}, R$ ${t.amount.toFixed(2).replace('.', ',')}) é de/para uma contraparte que você já marcou como Transferência Interna, mas está contando como ${t.type === 'income' ? 'receita' : 'despesa'}.`
        });
      }
    });

    this.state.accounts.forEach(a => {
      if (has3Decimals(a.balance)) {
        push({ id: `decimals-acc:${a.id}`, level: 'warning', message: `Saldo da conta "${a.name}" tem resíduo de casas decimais.` });
      }
    });

    (this.state.schedules || []).forEach(s => {
      if (s.accountId && !accIds.has(s.accountId)) {
        push({ id: `orphan-sch:${s.id}`, level: 'error', message: `Agendamento "${s.description}" está ligado a uma conta que não existe mais.` });
      }
      // Recorrente pago sem próximo ciclo
      if (s.status === 'paid' && (s.recurring === 'monthly' || s.recurring === 'yearly')) {
        const hasNext = this.state.schedules.some(o => o !== s && o.description === s.description && o.dueDate > s.dueDate);
        if (!hasNext) {
          push({ id: `no-next:${s.id}`, level: 'warning', message: `"${s.description}" é recorrente, foi pago, mas o próximo vencimento não está agendado.` });
        }
      }
      // Agendamento pendente possivelmente já pago (mesmo valor lançado até 10 dias do vencimento)
      if (s.status === 'pending' && s.type === 'expense' && s.dueDate) {
        const due = new Date(s.dueDate + 'T12:00:00');
        const match = this.state.transactions.find(t => {
          if (t.type !== 'expense' || !t.date || Math.abs(t.amount - s.amount) > 0.009 || t.scheduleId) return false;
          const diff = Math.abs((new Date(t.date + 'T12:00:00') - due) / 86400000);
          return diff <= 10;
        });
        if (match) {
          push({ id: `maybe-paid:${s.id}:${match.id}`, level: 'warning', message: `O boleto "${s.description}" (venc. ${s.dueDate.split('-').reverse().join('/')}) pode já ter sido pago: há um lançamento "${match.description}" de mesmo valor em ${match.date.split('-').reverse().join('/')}.` });
        }
      }
    });

    return issues;
  }

  async dismissAuditIssue(issueId) {
    if (!this.state.settings) this.state.settings = {};
    if (!Array.isArray(this.state.settings.dismissedAuditIssues)) this.state.settings.dismissedAuditIssues = [];
    if (!this.state.settings.dismissedAuditIssues.includes(issueId)) this.state.settings.dismissedAuditIssues.push(issueId);
    await this.save();
  }

  // Reclassifica como Transferência Interna (não altera saldos: mesma conta, mesmo tipo e valor)
  async markAsInternalTransfer(txId) {
    const t = this.state.transactions.find(x => x.id === txId);
    if (!t) return null;
    t.categoryId = 'cat-8';
    await this.save();
    return t;
  }

  // =========================================================================
  // --- MÓDULO DE LIBERDADE FINANCEIRA & O NORTE (FIRE - FINANCIAL INDEPENDENCE) ---
  // =========================================================================
  getFireCalculation(customParams = null) {
    const params = {
      ...(this.state.firePlanning || {
        currentAge: 32,
        targetAge: 55,
        desiredMonthlyIncome: 10000,
        safeWithdrawalRate: 5.0,
        monthlyContribution: 2500,
        includePhysicalAssets: false
      }),
      ...(customParams || {})
    };

    const currentAge = Math.max(16, parseInt(params.currentAge) || 30);
    const targetAge = Math.max(currentAge + 1, parseInt(params.targetAge) || 55);
    const desiredMonthlyIncome = Math.max(500, parseFloat(params.desiredMonthlyIncome) || 5000);
    const safeWithdrawalRate = Math.max(1.0, Math.min(15.0, parseFloat(params.safeWithdrawalRate) || 5.0));
    const monthlyContribution = Math.max(0, parseFloat(params.monthlyContribution) || 0);
    const includePhysicalAssets = !!params.includePhysicalAssets;

    // 1. Patrimônio Mágico / Meta de Acumulação FIRE (Regra da Taxa Segura de Retirada)
    // Ex: R$ 10.000 / mês * 12 meses / 0.05 = R$ 2.400.000
    const annualDesiredIncome = desiredMonthlyIncome * 12;
    const targetNetWorth = round2(annualDesiredIncome / (safeWithdrawalRate / 100));

    // 2. Patrimônio Atual Consolidado
    const totalLiquid = round2(this.state.accounts.reduce((sum, a) => sum + (a.type !== 'credit' ? ((a.balance || 0) + (a.vaulted || 0)) : 0), 0));
    const totalPhysical = round2(this.state.assets.reduce((sum, a) => sum + ((a.estimatedValue || 0) - (a.financedValue || 0)), 0));
    const totalDebts = round2(this.state.accounts.reduce((sum, a) => sum + (a.type === 'credit' && a.balance < 0 ? Math.abs(a.balance) : 0), 0));
    
    const currentNetWorth = includePhysicalAssets
      ? round2(Math.max(0, (totalLiquid + totalPhysical) - totalDebts))
      : round2(Math.max(0, totalLiquid - totalDebts));

    // 3. Progresso Atual e Renda Passiva Atual já gerada
    const progressPercent = targetNetWorth > 0 ? Math.min(100, round2((currentNetWorth / targetNetWorth) * 100)) : 0;
    const currentPassiveIncome = round2((currentNetWorth * (safeWithdrawalRate / 100)) / 12);

    // 4. Horizonte de Tempo
    const yearsRemaining = Math.max(1, targetAge - currentAge);
    const monthsRemaining = yearsRemaining * 12;
    const monthlyRealRate = Math.pow(1 + safeWithdrawalRate / 100, 1 / 12) - 1;

    // 5. Aporte Mensal Mínimo Necessário para atingir o targetAge
    const fvCurrent = currentNetWorth * Math.pow(1 + monthlyRealRate, monthsRemaining);
    let requiredMonthlyContribution = 0;
    if (fvCurrent < targetNetWorth && monthsRemaining > 0) {
      const shortfall = targetNetWorth - fvCurrent;
      const annuityFactor = (Math.pow(1 + monthlyRealRate, monthsRemaining) - 1) / monthlyRealRate;
      requiredMonthlyContribution = round2(shortfall / annuityFactor);
    }

    // 6. Projeção Ano a Ano com o Aporte Atual do Usuário
    const startYear = new Date().getFullYear();
    const projectionYears = [];
    let runningBalance = currentNetWorth;
    let totalContributed = currentNetWorth;
    let projectedFreedomAge = null;
    let projectedFreedomYear = null;

    // Ponto inicial (Ano 0 / Hoje)
    projectionYears.push({
      year: startYear,
      age: currentAge,
      totalAccumulated: round2(runningBalance),
      totalContributed: round2(totalContributed),
      interestEarned: 0,
      monthlyPassiveIncome: round2((runningBalance * (safeWithdrawalRate / 100)) / 12),
      isGoalReached: runningBalance >= targetNetWorth
    });

    if (runningBalance >= targetNetWorth && projectedFreedomAge === null) {
      projectedFreedomAge = currentAge;
      projectedFreedomYear = startYear;
    }

    const maxSimulationYears = Math.min(60, Math.max(yearsRemaining + 15, 30));
    for (let yr = 1; yr <= maxSimulationYears; yr++) {
      for (let m = 0; m < 12; m++) {
        const interest = runningBalance * monthlyRealRate;
        runningBalance = runningBalance + interest + monthlyContribution;
        totalContributed += monthlyContribution;
      }

      const simAge = currentAge + yr;
      const simYear = startYear + yr;
      const isReached = runningBalance >= targetNetWorth;

      if (isReached && projectedFreedomAge === null) {
        projectedFreedomAge = simAge;
        projectedFreedomYear = simYear;
      }

      projectionYears.push({
        year: simYear,
        age: simAge,
        totalAccumulated: round2(runningBalance),
        totalContributed: round2(totalContributed),
        interestEarned: round2(Math.max(0, runningBalance - totalContributed)),
        monthlyPassiveIncome: round2((runningBalance * (safeWithdrawalRate / 100)) / 12),
        isGoalReached: isReached
      });

      // Se já atingiu e passou bastante da meta, podemos interromper
      if (runningBalance >= targetNetWorth * 1.5 && yr > yearsRemaining) {
        break;
      }
    }

    // 7. Marcos / Degraus de Independência (Milestones)
    const milestones = [
      {
        percent: 10,
        label: 'Primeiro Degrau (10%)',
        amount: round2(targetNetWorth * 0.10),
        reached: currentNetWorth >= targetNetWorth * 0.10,
        desc: 'Fundo de tranquilidade que cobre imprevistos por longos meses.'
      },
      {
        percent: 25,
        label: 'Segurança Básica (25%)',
        amount: round2(targetNetWorth * 0.25),
        reached: currentNetWorth >= targetNetWorth * 0.25,
        desc: 'Os rendimentos passivos já pagam alimentação e contas essenciais de moradia.'
      },
      {
        percent: 50,
        label: 'Meio Caminho (50%)',
        amount: round2(targetNetWorth * 0.50),
        reached: currentNetWorth >= targetNetWorth * 0.50,
        desc: 'Ponto de inflexão: os juros compostos passam a render mais do que seus próprios aportes!'
      },
      {
        percent: 75,
        label: 'Quase Livre (75%)',
        amount: round2(targetNetWorth * 0.75),
        reached: currentNetWorth >= targetNetWorth * 0.75,
        desc: 'Libertação do trabalho obrigatório: você já pode escolher apenas projetos prazerosos.'
      },
      {
        percent: 100,
        label: 'Independência Plena (100%)',
        amount: round2(targetNetWorth),
        reached: currentNetWorth >= targetNetWorth,
        desc: 'Liberdade financeira conquistada. Renda perpétua garantida sem diminuir o patrimônio.'
      }
    ];

    // 8. Diagnóstico de Ritmo
    let paceStatus = 'on_track';
    let paceMessage = '';
    if (currentNetWorth >= targetNetWorth) {
      paceStatus = 'achieved';
      paceMessage = 'Parabéns! Você já conquistou a Liberdade Financeira Plena!';
    } else if (projectedFreedomAge !== null && projectedFreedomAge <= targetAge) {
      paceStatus = 'ahead';
      paceMessage = `Excelente ritmo! No ritmo atual de aporte (R$ ${monthlyContribution.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês), você atingirá a liberdade aos ${projectedFreedomAge} anos (${targetAge - projectedFreedomAge} anos antes do previsto)!`;
    } else if (monthlyContribution >= requiredMonthlyContribution) {
      paceStatus = 'on_track';
      paceMessage = `Você está no caminho exato para atingir sua meta aos ${targetAge} anos. Mantenha a disciplina de aportes.`;
    } else {
      paceStatus = 'behind';
      const gap = round2(requiredMonthlyContribution - monthlyContribution);
      paceMessage = `Atenção ao ritmo: para atingir a renda de R$ ${desiredMonthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aos ${targetAge} anos, você precisaria aportar R$ ${requiredMonthlyContribution.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês (um acréscimo de R$ ${gap.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês).`;
    }

    return {
      params,
      currentAge,
      targetAge,
      desiredMonthlyIncome,
      safeWithdrawalRate,
      monthlyContribution,
      includePhysicalAssets,
      targetNetWorth,
      currentNetWorth,
      totalLiquid,
      totalPhysical,
      totalDebts,
      progressPercent,
      currentPassiveIncome,
      yearsRemaining,
      monthsRemaining,
      requiredMonthlyContribution,
      projectedFreedomAge: projectedFreedomAge || 'Acima de 80',
      projectedFreedomYear: projectedFreedomYear || 'Ajustar aporte',
      paceStatus,
      paceMessage,
      milestones,
      projectionYears
    };
  }

  async saveFirePlanning(data) {
    this.state.firePlanning = {
      ...(this.state.firePlanning || {}),
      ...data
    };
    await this.save();
    return this.state.firePlanning;
  }

  // =========================================================================
  // --- MÓDULO: FINANÇAS A DOIS & DESPESAS COMPARTILHADAS (VALORE COUPLE) ---
  // =========================================================================

  getCoupleSettings() {
    if (!this.state.couple) {
      this.state.couple = {
        enabled: true,
        partner1: { name: 'Você', monthlyIncome: 6000, color: '#3b82f6', pixKey: '', avatar: 'user' },
        partner2: { name: 'Parceiro(a)', monthlyIncome: 4000, color: '#ec4899', pixKey: '', avatar: 'heart' },
        splitMode: 'proportional',
        proportionalRatio: { p1: 60, p2: 40 },
        fixedQuotaAmount: 2000,
        jointHouseAccountName: 'Despesas do Lar'
      };
    }
    return this.state.couple;
  }

  async updateCoupleSettings(data) {
    const couple = this.getCoupleSettings();
    if (data.enabled !== undefined) couple.enabled = !!data.enabled;
    if (data.splitMode !== undefined) couple.splitMode = data.splitMode;
    if (data.fixedQuotaAmount !== undefined) couple.fixedQuotaAmount = Math.max(0, parseFloat(data.fixedQuotaAmount) || 0);
    if (data.jointHouseAccountName !== undefined) couple.jointHouseAccountName = String(data.jointHouseAccountName).trim();

    if (data.partner1) {
      couple.partner1 = {
        ...couple.partner1,
        ...data.partner1,
        monthlyIncome: Math.max(0, parseFloat(data.partner1.monthlyIncome !== undefined ? data.partner1.monthlyIncome : couple.partner1.monthlyIncome) || 0)
      };
    }

    if (data.partner2) {
      couple.partner2 = {
        ...couple.partner2,
        ...data.partner2,
        monthlyIncome: Math.max(0, parseFloat(data.partner2.monthlyIncome !== undefined ? data.partner2.monthlyIncome : couple.partner2.monthlyIncome) || 0)
      };
    }

    // Recalcula proporção justa baseada nas rendas líquidas cadastradas (Equity Split)
    const inc1 = couple.partner1.monthlyIncome;
    const inc2 = couple.partner2.monthlyIncome;
    const totalIncome = inc1 + inc2;

    if (totalIncome > 0) {
      const p1Pct = Math.round((inc1 / totalIncome) * 100);
      couple.proportionalRatio = { p1: p1Pct, p2: 100 - p1Pct };
    } else {
      couple.proportionalRatio = { p1: 50, p2: 50 };
    }

    if (data.proportionalRatio && data.splitMode === 'custom') {
      couple.proportionalRatio = {
        p1: Math.max(0, Math.min(100, parseInt(data.proportionalRatio.p1, 10) || 50)),
        p2: Math.max(0, Math.min(100, parseInt(data.proportionalRatio.p2, 10) || 50))
      };
    }

    await this.save();
    return couple;
  }

  isCoupleEnabled() {
    return !!(this.state && this.state.couple && this.state.couple.enabled !== false);
  }

  async setCoupleEnabled(enabled) {
    const couple = this.getCoupleSettings();
    couple.enabled = !!enabled;
    await this.save();
    return couple.enabled;
  }

  async applyCouplePreset(presetKey) {
    const couple = this.getCoupleSettings();
    couple.preset = presetKey;
    if (presetKey === 'hetero') {
      couple.partner1.avatar = 'user';
      couple.partner1.color = '#3b82f6';
      couple.partner2.avatar = 'heart';
      couple.partner2.color = '#ec4899';
    } else if (presetKey === 'gay_male') {
      couple.partner1.avatar = 'user';
      couple.partner1.color = '#3b82f6';
      couple.partner2.avatar = 'sparkles';
      couple.partner2.color = '#10b981';
    } else if (presetKey === 'lesbian_female') {
      couple.partner1.avatar = 'user-round';
      couple.partner1.color = '#a855f7';
      couple.partner2.avatar = 'heart';
      couple.partner2.color = '#ec4899';
    }
    await this.save();
    return couple;
  }

  // Resumo analítico de despesas compartilhadas, balanço e quitação
  getCoupleSummary(year = null, month = null) {
    const couple = this.getCoupleSettings();
    const periodPrefix = (year && month) ? `${year}-${String(month).padStart(2, '0')}` : null;

    // Todas as despesas compartilhadas
    const allShared = (this.state.transactions || []).filter(t => t.isShared && t.type === 'expense');

    // Filtra pelo período selecionado (se fornecido)
    const periodTransactions = periodPrefix
      ? allShared.filter(t => t.date && t.date.startsWith(periodPrefix))
      : allShared;

    let totalSharedExpenses = 0;
    let paidByP1 = 0;
    let paidByP2 = 0;
    let dueByP1 = 0;
    let dueByP2 = 0;

    // Valores pendentes de acerto (não liquidados)
    let pendingTotal = 0;
    let pendingPaidP1 = 0;
    let pendingPaidP2 = 0;
    let pendingDueP1 = 0;
    let pendingDueP2 = 0;

    const categoryMap = {};

    periodTransactions.forEach(t => {
      const amt = round2(parseFloat(t.amount || 0));
      totalSharedExpenses = round2(totalSharedExpenses + amt);

      const paidBy = t.paidBy === 'p2' ? 'p2' : 'p1';
      if (paidBy === 'p1') paidByP1 = round2(paidByP1 + amt);
      else paidByP2 = round2(paidByP2 + amt);

      // Determina regra de responsabilidade
      let p1Ratio = couple.proportionalRatio.p1 / 100;
      let p2Ratio = couple.proportionalRatio.p2 / 100;

      if (t.splitRule === 'equal') {
        p1Ratio = 0.50;
        p2Ratio = 0.50;
      } else if (t.splitRule === '100_p1') {
        p1Ratio = 1.0;
        p2Ratio = 0.0;
      } else if (t.splitRule === '100_p2') {
        p1Ratio = 0.0;
        p2Ratio = 1.0;
      } else if (t.splitRule === 'custom' && t.customSplit) {
        const customP1 = Math.max(0, Math.min(100, parseFloat(t.customSplit.p1) || 50));
        p1Ratio = customP1 / 100;
        p2Ratio = (100 - customP1) / 100;
      }

      const itemDueP1 = round2(amt * p1Ratio);
      const itemDueP2 = round2(amt - itemDueP1);

      dueByP1 = round2(dueByP1 + itemDueP1);
      dueByP2 = round2(dueByP2 + itemDueP2);

      // Adiciona metadados calculados para a renderização da tabela
      t._computedDueP1 = itemDueP1;
      t._computedDueP2 = itemDueP2;
      t._computedPaidBy = paidBy;

      // Se ainda não quitado / não acertado
      if (!t.settled) {
        pendingTotal = round2(pendingTotal + amt);
        if (paidBy === 'p1') pendingPaidP1 = round2(pendingPaidP1 + amt);
        else pendingPaidP2 = round2(pendingPaidP2 + amt);

        pendingDueP1 = round2(pendingDueP1 + itemDueP1);
        pendingDueP2 = round2(pendingDueP2 + itemDueP2);
      }

      // Distribuição por Categoria
      const catId = t.categoryId || 'other';
      const catObj = this.state.categories.find(c => c.id === catId);
      const catName = catObj ? catObj.name : 'Outras Despesas';
      const catColor = catObj ? catObj.color : '#64748b';

      if (!categoryMap[catId]) {
        categoryMap[catId] = { id: catId, name: catName, color: catColor, total: 0, count: 0 };
      }
      categoryMap[catId].total = round2(categoryMap[catId].total + amt);
      categoryMap[catId].count += 1;
    });

    // Cálculo do Balanço Devedor / Credor Geral do Período
    // diff > 0: P1 pagou mais do que sua parte -> P2 deve para P1
    // diff < 0: P2 pagou mais do que sua parte -> P1 deve para P2
    const netPendingDiff = round2(pendingPaidP1 - pendingDueP1);

    let debtor = null;
    let creditor = null;
    let balanceAmount = 0;
    let statusLabel = 'Tudo Equilibrado';

    if (netPendingDiff > 0.01) {
      debtor = 'p2';
      creditor = 'p1';
      balanceAmount = netPendingDiff;
      statusLabel = `${couple.partner2.name} deve para ${couple.partner1.name}`;
    } else if (netPendingDiff < -0.01) {
      debtor = 'p1';
      creditor = 'p2';
      balanceAmount = Math.abs(netPendingDiff);
      statusLabel = `${couple.partner1.name} deve para ${couple.partner2.name}`;
    }

    const categoriesList = Object.values(categoryMap).sort((a, b) => b.total - a.total);

    // Metas Compartilhadas do Casal
    const coupleGoals = (this.state.goals || []).filter(g => g.isCoupleGoal);

    // Histórico de Quitações / Acertos do Casal
    const settlements = (this.state.coupleSettlements || []).filter(s => {
      if (!periodPrefix) return true;
      return s.year == year && s.month == month;
    });

    return {
      couple,
      period: { year, month },
      totalSharedExpenses,
      paidByP1,
      paidByP2,
      dueByP1,
      dueByP2,
      pendingTotal,
      pendingPaidP1,
      pendingPaidP2,
      pendingDueP1,
      pendingDueP2,
      balanceAmount: round2(balanceAmount),
      debtor,
      creditor,
      debtorName: debtor ? (debtor === 'p1' ? couple.partner1.name : couple.partner2.name) : '',
      creditorName: creditor ? (creditor === 'p1' ? couple.partner1.name : couple.partner2.name) : '',
      creditorPixKey: creditor ? (creditor === 'p1' ? couple.partner1.pixKey : couple.partner2.pixKey) : '',
      statusLabel,
      transactions: periodTransactions,
      categories: categoriesList,
      coupleGoals,
      settlements
    };
  }

  // Quitação / Acerto de contas de despesas compartilhadas
  async settleCoupleExpenses(options = {}) {
    const { year, month, note, accountId } = options;
    const summary = this.getCoupleSummary(year, month);

    if (summary.balanceAmount <= 0.01) {
      throw new Error('Não há saldo devedor pendente para acertar neste período.');
    }

    const settlementId = genId('settle');
    const periodPrefix = (year && month) ? `${year}-${String(month).padStart(2, '0')}` : null;

    // Encontra transações pendentes no período
    let count = 0;
    this.state.transactions.forEach(t => {
      if (t.isShared && t.type === 'expense' && !t.settled) {
        if (!periodPrefix || (t.date && t.date.startsWith(periodPrefix))) {
          t.settled = true;
          t.settlementId = settlementId;
          count++;
        }
      }
    });

    const newSettlement = {
      id: settlementId,
      date: localDateStr(),
      year: year || new Date().getFullYear(),
      month: month || (new Date().getMonth() + 1),
      amount: summary.balanceAmount,
      debtor: summary.debtor,
      creditor: summary.creditor,
      debtorName: summary.debtorName,
      creditorName: summary.creditorName,
      note: note || `Acerto de contas referente a ${month}/${year}`,
      transactionsCount: count,
      accountId: accountId || null,
      createdAt: new Date().toISOString()
    };

    if (!this.state.coupleSettlements) this.state.coupleSettlements = [];
    this.state.coupleSettlements.unshift(newSettlement);

    // Se o usuário informou uma conta bancária para registrar a compensação no extrato
    if (accountId) {
      await this.addTransaction({
        description: `[Acerto Casal] Reembolso de ${summary.debtorName} para ${summary.creditorName}`,
        amount: summary.balanceAmount,
        type: summary.creditor === 'p1' ? 'income' : 'expense',
        categoryId: 'cat-8',
        accountId: accountId,
        date: localDateStr(),
        status: 'paid',
        notes: `Quitação de ${count} despesas compartilhadas do mês ${month}/${year}`
      });
    }

    await this.save();
    return newSettlement;
  }

  // Desfazer acerto de contas
  async deleteCoupleSettlement(settlementId) {
    if (!this.state.coupleSettlements) return false;
    const idx = this.state.coupleSettlements.findIndex(s => s.id === settlementId);
    if (idx === -1) return false;

    // Desmarca transações que estavam vinculadas a esta liquidação
    this.state.transactions.forEach(t => {
      if (t.settlementId === settlementId) {
        t.settled = false;
        t.settlementId = null;
      }
    });

    this.state.coupleSettlements.splice(idx, 1);
    await this.save();
    return true;
  }

  // Relatório da "DR Financeira Positiva" (Alinhamento & Harmonia Financeira do Casal)
  getCoupleAlignmentReport(year, month) {
    const summaryCurrent = this.getCoupleSummary(year, month);
    
    // Mês anterior
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const summaryPrev = this.getCoupleSummary(prevYear, prevMonth);

    const currentTotal = summaryCurrent.totalSharedExpenses;
    const prevTotal = summaryPrev.totalSharedExpenses;

    let variationPercent = 0;
    if (prevTotal > 0) {
      variationPercent = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
    }

    // Cálculo do Score de Harmonia Financeira do Casal (0 a 100)
    let harmonyScore = 100;
    const insights = [];

    if (summaryCurrent.balanceAmount > 1500) {
      harmonyScore -= 15;
      insights.push(`Há um acúmulo de R$ ${summaryCurrent.balanceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente para acerto. Realizar um Pix mensal evita o efeito bola de neve.`);
    } else if (summaryCurrent.balanceAmount <= 0.01) {
      harmonyScore += 5;
      insights.push('Parabéns! Todas as contas do casal estão rigorosamente quitadas e equilibradas.');
    }

    if (variationPercent > 20) {
      harmonyScore -= 10;
      insights.push(`As despesas do lar subiram +${variationPercent}% em relação ao mês anterior. Vale uma conversa rápida de 10 minutos para alinhar os gastos variáveis.`);
    } else if (variationPercent < -5 && prevTotal > 0) {
      harmonyScore += 10;
      insights.push(`Excelente economia! Vocês reduziram os gastos conjuntos em ${Math.abs(variationPercent)}% em comparação ao mês passado.`);
    }

    // Metas do Casal
    const coupleGoals = (this.state.goals || []).filter(g => g.isCoupleGoal);
    if (coupleGoals.length > 0) {
      harmonyScore += 10;
      insights.push(`Vocês possuem ${coupleGoals.length} sonho(s) planejado(s) juntos. Ter objetivos em comum fortalece a união.`);
    } else {
      insights.push('Dica de ouro: Cadastre um sonho conjunto (ex: Viagem romântica, reforma ou casamento) para unir as forças de poupança do casal.');
    }

    harmonyScore = Math.max(30, Math.min(100, harmonyScore));

    return {
      currentTotal,
      prevTotal,
      variationPercent,
      harmonyScore,
      insights,
      couple: summaryCurrent.couple,
      topCategories: summaryCurrent.categories.slice(0, 3),
      coupleGoals
    };
  }

  // =========================================================================
  // --- MOTOR VALORE SYNC: SMART MERGE BIDIRECIONAL (PC ⇄ MOBILE) ---
  // =========================================================================
  async mergeExternalState(incomingPayload) {
    if (!incomingPayload || typeof incomingPayload !== 'object') {
      throw new Error('Dados de sincronização inválidos.');
    }

    const remoteState = incomingPayload.state || incomingPayload;
    if (!Array.isArray(remoteState.accounts) || !Array.isArray(remoteState.transactions)) {
      throw new Error('Estrutura de dados remota incompatível com o Valore.');
    }

    if (!this.state.syncMeta) {
      this.state.syncMeta = { deviceId: genId('dev'), lastSyncAt: null, lastModifiedAt: Date.now(), deletedIds: {} };
    }

    const localDeleted = (this.state.syncMeta && this.state.syncMeta.deletedIds) || {};
    const remoteDeleted = (remoteState.syncMeta && remoteState.syncMeta.deletedIds) || {};

    // 1. Une mapa de exclusões (Tombstones)
    const mergedDeleted = { ...localDeleted };
    for (const [delId, delTime] of Object.entries(remoteDeleted)) {
      if (!mergedDeleted[delId] || delTime > mergedDeleted[delId]) {
        mergedDeleted[delId] = delTime;
      }
    }

    // Proteção Anti-Seed: Se qualquer um dos dois lados já possui contas reais criadas pelo usuário,
    // descarta automaticamente os dados demonstrativos de fábrica (acc-1..3, tx-1..3, etc.)
    const seedAccIds = new Set(['acc-1', 'acc-2', 'acc-3']);
    const localHasReal = (this.state.accounts || []).some(a => a && a.id && !seedAccIds.has(a.id));
    const remoteHasReal = (remoteState.accounts || []).some(a => a && a.id && !seedAccIds.has(a.id));
    if (localHasReal || remoteHasReal) {
      const purgeTs = Date.now() + 10000;
      const demoIds = ['acc-1', 'acc-2', 'acc-3', 'tx-1', 'tx-2', 'tx-3', 'sch-1', 'sch-2', 'sch-3', 'vault-1', 'ast-1', 'ast-2', 'goal-1', 'goal-2'];
      demoIds.forEach(id => { mergedDeleted[id] = purgeTs; });
      [...(this.state.vaults || []), ...(remoteState.vaults || [])].forEach(v => {
        if (v && (v.id === 'vault-1' || seedAccIds.has(v.accountId) || String(v.id).endsWith('-acc-1'))) {
          mergedDeleted[v.id] = purgeTs;
        }
      });
    }

    const stats = {
      addedTransactions: 0,
      updatedTransactions: 0,
      addedAccounts: 0,
      addedSchedules: 0,
      addedGoals: 0,
      addedVaults: 0
    };

    // Função auxiliar para mesclar coleções baseadas em ID e updatedAt
    const mergeCollection = (localArr = [], remoteArr = [], statKeyAdded = null, statKeyUpdated = null, dedupeFn = null) => {
      const map = new Map();

      // Carrega itens locais que não foram excluídos mais recentemente
      for (const item of localArr) {
        if (!item || !item.id) continue;
        const delTime = mergedDeleted[item.id];
        const itemTime = item.updatedAt || 1;
        if (delTime && delTime >= itemTime) continue;
        map.set(item.id, item);
      }

      // Mescla itens remotos
      for (const rItem of remoteArr) {
        if (!rItem || !rItem.id) continue;
        const delTime = mergedDeleted[rItem.id];
        const rTime = rItem.updatedAt || 1;
        if (delTime && delTime >= rTime) continue;

        if (map.has(rItem.id)) {
          const lItem = map.get(rItem.id);
          const lTime = lItem.updatedAt || 1;
          if (rTime > lTime) {
            map.set(rItem.id, { ...lItem, ...rItem });
            if (statKeyUpdated) stats[statKeyUpdated]++;
          }
        } else {
          // Verifica se há duplicata semântica (ex: mesma conta ou transação criada sem mesmo ID)
          if (dedupeFn) {
            const existingMatch = Array.from(map.values()).find(existing => dedupeFn(existing, rItem));
            if (existingMatch) {
              const lTime = existingMatch.updatedAt || 1;
              if (rTime > lTime) {
                map.set(existingMatch.id, { ...existingMatch, ...rItem, id: existingMatch.id });
                if (statKeyUpdated) stats[statKeyUpdated]++;
              }
              continue;
            }
          }
          map.set(rItem.id, rItem);
          if (statKeyAdded) stats[statKeyAdded]++;
        }
      }

      return Array.from(map.values());
    };

    // 2. Mescla Categorias (evitando duplicar categorias com exatamente o mesmo nome e tipo)
    const categoryIdRemap = {};
    const mergedCategories = mergeCollection(
      this.state.categories,
      remoteState.categories,
      null,
      null,
      (lCat, rCat) => {
        const same = (lCat.name || '').trim().toLowerCase() === (rCat.name || '').trim().toLowerCase() && lCat.type === rCat.type;
        if (same && lCat.id !== rCat.id) {
          categoryIdRemap[rCat.id] = lCat.id;
        }
        return same;
      }
    );

    // 3. Mescla Contas Bancárias / Cartões (evitando duplicar contas com mesmo nome e tipo)
    const accountIdRemap = {};
    const mergedAccounts = mergeCollection(
      this.state.accounts,
      remoteState.accounts,
      'addedAccounts',
      null,
      (lAcc, rAcc) => {
        const same = (lAcc.name || '').trim().toLowerCase() === (rAcc.name || '').trim().toLowerCase() && lAcc.type === rAcc.type;
        if (same && lAcc.id !== rAcc.id) {
          accountIdRemap[rAcc.id] = lAcc.id;
        }
        return same;
      }
    );

    // Identifica quais transações são genuinamente novas vindas do remoto para ajustar o saldo das contas correntes
    const localTxIds = new Set((this.state.transactions || []).map(t => t.id));
    const remoteTxIds = new Set((remoteState.transactions || []).map(t => t.id));

    // Normaliza referências de conta/categoria nas transações remotas caso tenha havido remap
    const normalizedRemoteTxs = (remoteState.transactions || []).map(t => ({
      ...t,
      categoryId: categoryIdRemap[t.categoryId] || t.categoryId,
      accountId: accountIdRemap[t.accountId] || t.accountId,
      fromAccountId: accountIdRemap[t.fromAccountId] || t.fromAccountId,
      toAccountId: accountIdRemap[t.toAccountId] || t.toAccountId
    }));

    // Identifica transações remotas que ainda não existiam localmente para aplicar a diferença contábil nas contas
    const newlyAddedFromRemote = [];
    for (const rTx of normalizedRemoteTxs) {
      if (!rTx || !rTx.id) continue;
      const delTime = mergedDeleted[rTx.id];
      const rTime = rTx.updatedAt || 1;
      if (delTime && delTime >= rTime) continue;

      if (!localTxIds.has(rTx.id)) {
        const isDuplicateSeed = (this.state.transactions || []).some(lTx =>
          lTx.id === rTx.id ||
          (lTx.description === rTx.description && lTx.amount === rTx.amount && lTx.date === rTx.date && lTx.accountId === rTx.accountId && (lTx.id.startsWith('tx-1') || lTx.id.startsWith('tx-2') || lTx.id.startsWith('tx-3')))
        );
        if (!isDuplicateSeed) {
          newlyAddedFromRemote.push(rTx);
        }
      }
    }

    // 4. Mescla Transações
    const mergedTransactions = mergeCollection(
      this.state.transactions,
      normalizedRemoteTxs,
      'addedTransactions',
      'updatedTransactions',
      (lTx, rTx) => (
        (lTx.id.startsWith('tx-1') || lTx.id.startsWith('tx-2') || lTx.id.startsWith('tx-3')) &&
        lTx.description === rTx.description &&
        lTx.amount === rTx.amount &&
        lTx.date === rTx.date
      )
    );

    // Ordena transações por data decrescente
    mergedTransactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 5. Mescla Agendamentos, Metas, Cofrinhos, Bens, Centros de Custo, Renda Extra, Orçamentos e Acertos do Casal
    const mergedSchedules = mergeCollection(this.state.schedules, remoteState.schedules, 'addedSchedules');
    const mergedGoals = mergeCollection(this.state.goals, remoteState.goals, 'addedGoals');
    const mergedVaults = mergeCollection(this.state.vaults, remoteState.vaults, 'addedVaults');
    const mergedAssets = mergeCollection(this.state.assets, remoteState.assets);
    const mergedCostCenters = mergeCollection(this.state.costCenters, remoteState.costCenters);
    const mergedSideHustles = mergeCollection(this.state.sideHustles, remoteState.sideHustles);
    const mergedBudgets = mergeCollection(
      this.state.budgets,
      remoteState.budgets,
      null,
      null,
      (lB, rB) => lB.categoryId === rB.categoryId
    );
    const mergedSettlements = mergeCollection(this.state.coupleSettlements, remoteState.coupleSettlements);

    // 6. Aplica estado unificado
    this.state.categories = mergedCategories;
    this.state.accounts = mergedAccounts;
    this.state.transactions = mergedTransactions;
    this.state.schedules = mergedSchedules;
    this.state.goals = mergedGoals;
    this.state.vaults = mergedVaults;
    this.state.assets = mergedAssets;
    this.state.costCenters = mergedCostCenters;
    this.state.sideHustles = mergedSideHustles;
    this.state.budgets = mergedBudgets;
    this.state.coupleSettlements = mergedSettlements;

    // Se as configurações do casal ou FIRE foram atualizadas mais recentemente no remoto, adota-as
    const localMod = (this.state.syncMeta && this.state.syncMeta.lastModifiedAt) || 0;
    const remoteMod = (remoteState.syncMeta && remoteState.syncMeta.lastModifiedAt) || 0;
    if (remoteMod > localMod) {
      if (remoteState.couple) this.state.couple = remoteState.couple;
      if (remoteState.firePlanning) this.state.firePlanning = remoteState.firePlanning;
    }

    // 7. Reconciliação Inteligente de Saldos Contábeis:
    // Aplica o impacto financeiro de lançamentos que vieram exclusivamente do aparelho remoto
    // nas contas que já existiam localmente (evitando divergência quando ambos os aparelhos lançaram despesas)
    for (const rTx of newlyAddedFromRemote) {
      if (rTx.type === 'transfer') {
        const fromAcc = this.state.accounts.find(a => a.id === rTx.fromAccountId);
        const toAcc = this.state.accounts.find(a => a.id === rTx.toAccountId);
        if (fromAcc && fromAcc.type !== 'credit' && (fromAcc.updatedAt || 0) >= (rTx.updatedAt || 0)) {
          this.updateAccountBalance(fromAcc.id, rTx.amount, 'expense', 'add');
        }
        if (toAcc && toAcc.type !== 'credit' && (toAcc.updatedAt || 0) >= (rTx.updatedAt || 0)) {
          this.updateAccountBalance(toAcc.id, rTx.amount, 'income', 'add');
        }
      } else {
        const targetAcc = this.state.accounts.find(a => a.id === rTx.accountId);
        // Se a conta local prevaleceu (tinha updatedAt maior ou igual), aplica a transação remota nova nela
        const remoteAcc = (remoteState.accounts || []).find(a => (accountIdRemap[a.id] || a.id) === rTx.accountId);
        const localAccTime = targetAcc ? (targetAcc.updatedAt || 1) : 0;
        const remoteAccTime = remoteAcc ? (remoteAcc.updatedAt || 1) : 0;
        if (targetAcc && targetAcc.type !== 'credit' && localAccTime >= remoteAccTime && rTx.status === 'paid') {
          this.updateAccountBalance(targetAcc.id, rTx.amount, rTx.type, 'add');
        }
      }
    }

    // Se a conta remota venceu (remoteAccTime > localAccTime), aplica nela as transações que existiam APENAS localmente
    for (const lTx of (this.state.transactions || [])) {
      if (!remoteTxIds.has(lTx.id) && !newlyAddedFromRemote.some(n => n.id === lTx.id)) {
        const targetAcc = this.state.accounts.find(a => a.id === lTx.accountId);
        const remoteAcc = (remoteState.accounts || []).find(a => (accountIdRemap[a.id] || a.id) === lTx.accountId);
        if (targetAcc && remoteAcc && targetAcc.type !== 'credit' && (remoteAcc.updatedAt || 1) > (targetAcc.updatedAt || 0) && lTx.status === 'paid') {
          this.updateAccountBalance(targetAcc.id, lTx.amount, lTx.type, 'add');
        }
      }
    }

    this.syncCreditCardBalances();
    this.state.accounts.forEach(acc => {
      if (acc.type !== 'credit') {
        this.syncAccountVaultedBalance(acc.id);
      }
    });

    // Atualiza metadados de sincronização
    const nowTs = Date.now();
    this.state.syncMeta = {
      deviceId: this.state.syncMeta.deviceId || genId('dev'),
      lastSyncAt: new Date(nowTs).toISOString(),
      lastModifiedAt: nowTs,
      deletedIds: mergedDeleted
    };

    await this.save({ skipAutoSync: true, preserveModifiedTimestamp: true });

    return {
      success: true,
      stats,
      transactionsCount: this.state.transactions.length,
      accountsCount: this.state.accounts.length,
      syncedAt: this.state.syncMeta.lastSyncAt
    };
  }

  /**
   * Sugestão Preditiva Inteligente de Categoria e Conta baseada em Histórico e Dicionário Semântico Local.
   * Retorna { categoryId, categoryName, categoryIcon, categoryColor, accountId, accountName, confidence }
   */
  predictCategoryAndAccount(rawDescription, type = 'expense') {
    if (!rawDescription || typeof rawDescription !== 'string') return null;
    const clean = rawDescription.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean.length < 2) return null;

    // 1. Busca no histórico de transações reais (ponderando frequência e recência)
    const matches = {};
    const txs = this.state.transactions || [];
    const len = txs.length;
    
    for (let i = len - 1; i >= 0; i--) {
      const t = txs[i];
      if (!t.description) continue;
      if (type && t.type !== type && t.type !== 'transfer') continue;

      const tDesc = t.description.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (tDesc.includes(clean) || clean.includes(tDesc)) {
        const catId = t.categoryId;
        if (!catId) continue;
        const key = `${catId}|${t.accountId || ''}`;
        if (!matches[key]) {
          matches[key] = {
            categoryId: catId,
            accountId: t.accountId || null,
            count: 0,
            lastDate: t.date || '',
            score: 0
          };
        }
        matches[key].count++;
        // Correspondência exata no início dá bônus
        const isPrefix = tDesc.startsWith(clean) || clean.startsWith(tDesc);
        matches[key].score += isPrefix ? 3 : 1;
      }
    }

    const sortedHistory = Object.values(matches).sort((a, b) => b.score - a.score || b.count - a.count);
    if (sortedHistory.length > 0) {
      const top = sortedHistory[0];
      const cat = (this.state.categories || []).find(c => c.id === top.categoryId);
      const acc = (this.state.accounts || []).find(a => a.id === top.accountId);
      return {
        categoryId: top.categoryId,
        categoryName: cat ? cat.name : '',
        categoryIcon: cat ? (cat.icon || 'tag') : 'tag',
        categoryColor: cat ? cat.color : '#6366f1',
        accountId: top.accountId,
        accountName: acc ? acc.name : '',
        confidence: top.count >= 2 ? 'high' : 'medium'
      };
    }

    // 2. Dicionário Semântico Inteligente de Fábrica (Léxico Brasileiro)
    const semanticRules = [
      { pattern: /abastec|gasolin|combust|posto|etanol|diesel|ipiranga|shell|br\s?distribuidora/, catKey: 'transporte', defaultIcon: 'car' },
      { pattern: /uber|99\s?app|99pop|taxi|pedagio|sem\s?parar|veloe|estacionamento|estapar/, catKey: 'transporte', defaultIcon: 'car' },
      { pattern: /supermerc|mercado|atacadao|assai|carrefour|pao\s?de\s?acucar|hortifruti|acougue|padaria|feira/, catKey: 'alimenta', defaultIcon: 'shopping-cart' },
      { pattern: /ifood|rappi|restaurante|lanchonete|hamburguer|pizza|mcdonald|burguer|almoco|jantar|subway/, catKey: 'alimenta', defaultIcon: 'utensils' },
      { pattern: /farmacia|drogaria|drogasil|pacheco|remedio|medicamento|consulta|medico|dentista|hospital|exame|laboratorio/, catKey: 'saude', defaultIcon: 'activity' },
      { pattern: /aluguel|condominio|iptu|enel|energia|luz|sabesp|agua|gas|comgas|claro|vivo|oi|tim|internet|fibra/, catKey: 'moradia', defaultIcon: 'home' },
      { pattern: /netflix|spotify|amazon\s?prime|hbo|disney|apple|youtube|cinema|steam|playstation|xbox|jogos/, catKey: 'streaming|lazer', defaultIcon: 'tv' },
      { pattern: /salario|pro-labore|remuneracao|adiantamento|holerite/, catKey: 'salario', defaultIcon: 'wallet', type: 'income' },
      { pattern: /dividendo|jcp|rendimento|fii|cdi|tesouro|poupanca|selic/, catKey: 'invest', defaultIcon: 'trending-up', type: 'income' }
    ];

    for (const rule of semanticRules) {
      if (rule.pattern.test(clean)) {
        const cat = (this.state.categories || []).find(c => {
          const cName = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const keys = rule.catKey.split('|');
          return keys.some(k => cName.includes(k));
        });
        if (cat) {
          return {
            categoryId: cat.id,
            categoryName: cat.name,
            categoryIcon: cat.icon || rule.defaultIcon,
            categoryColor: cat.color || '#6366f1',
            accountId: null,
            accountName: '',
            confidence: 'semantic'
          };
        }
      }
    }

    return null;
  }

  /**
   * Retorna os top lançamentos anteriores similares ao termo digitado para preenchimento em 1 toque.
   */
  getRecentDescriptionSuggestions(query = '', type = 'expense', limit = 4) {
    if (!query || typeof query !== 'string') return [];
    const clean = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean.length < 2) return [];

    const map = new Map();
    const txs = this.state.transactions || [];

    for (let i = txs.length - 1; i >= 0; i--) {
      const t = txs[i];
      if (!t.description) continue;
      if (type && t.type !== type && t.type !== 'transfer') continue;

      const descNorm = t.description.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (descNorm.includes(clean)) {
        const cleanOriginalDesc = (t.installmentTotal > 1) 
          ? (t.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
          : t.description.trim();

        if (!map.has(cleanOriginalDesc.toLowerCase())) {
          const cat = (this.state.categories || []).find(c => c.id === t.categoryId);
          const acc = (this.state.accounts || []).find(a => a.id === t.accountId);
          map.set(cleanOriginalDesc.toLowerCase(), {
            description: cleanOriginalDesc,
            categoryId: t.categoryId,
            categoryName: cat ? cat.name : '',
            categoryIcon: cat ? (cat.icon || 'tag') : 'tag',
            categoryColor: cat ? cat.color : '#6366f1',
            accountId: t.accountId,
            accountName: acc ? acc.name : ''
          });
          if (map.size >= limit) break;
        }
      }
    }

    return Array.from(map.values());
  }
}

// =========================================================================
// --- CRIPTOGRAFIA MILITAR PONTA A PONTA (AES-256-GCM ZERO-KNOWLEDGE) ---
// =========================================================================
class ValoreCrypto {
  static _getSubtle() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    throw new Error('Web Crypto API não disponível neste ambiente.');
  }

  static _bufToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static _base64ToBuf(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  static async _deriveKey(passphrase, saltBytes) {
    const subtle = this._getSubtle();
    const enc = new TextEncoder();
    const keyMaterial = await subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async encryptState(payloadObj, passphrase) {
    if (!passphrase || String(passphrase).trim().length < 4) {
      throw new Error('A Senha Mestra deve ter pelo menos 4 caracteres.');
    }
    const subtle = this._getSubtle();
    const cryptoObj = (typeof window !== 'undefined' && window.crypto) || globalThis.crypto;
    const salt = cryptoObj.getRandomValues(new Uint8Array(16));
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const key = await this._deriveKey(String(passphrase).trim(), salt);

    const enc = new TextEncoder();
    const plainBytes = enc.encode(JSON.stringify(payloadObj));
    const cipherBuffer = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);

    return {
      valoreEncrypted: true,
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256-100K',
      exportedAt: new Date().toISOString(),
      salt: this._bufToBase64(salt.buffer),
      iv: this._bufToBase64(iv.buffer),
      ciphertext: this._bufToBase64(cipherBuffer)
    };
  }

  static async decryptState(encryptedEnvelope, passphrase) {
    if (!encryptedEnvelope || !encryptedEnvelope.valoreEncrypted || !encryptedEnvelope.ciphertext) {
      throw new Error('O pacote informado não é um cofre criptografado válido do Valore.');
    }
    if (!passphrase) {
      throw new Error('Informe a Senha Mestra para descriptografar o cofre.');
    }
    try {
      const subtle = this._getSubtle();
      const salt = new Uint8Array(this._base64ToBuf(encryptedEnvelope.salt));
      const iv = new Uint8Array(this._base64ToBuf(encryptedEnvelope.iv));
      const cipherBuffer = this._base64ToBuf(encryptedEnvelope.ciphertext);

      const key = await this._deriveKey(String(passphrase).trim(), salt);
      const plainBuffer = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuffer);

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(plainBuffer));
    } catch (err) {
      throw new Error('Senha Mestra incorreta ou arquivo corrompido.');
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FinanceService, ValoreCrypto };
} else {
  window.FinanceService = FinanceService;
  window.ValoreCrypto = ValoreCrypto;
}
