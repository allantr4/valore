const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
const consoleErrors = [];
const consoleWarns = [];
const runtimeExceptions = [];

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  const storageFile = path.join(userDataPath, 'financial_data.json');

  // Carrega os dados reais do usuário para o teste refletir 100% da realidade
  ipcMain.handle('storage:load', async () => {
    try {
      if (fs.existsSync(storageFile)) {
        return JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      }
    } catch (e) {
      console.error('Erro ao ler storage no teste:', e);
    }
    return null;
  });

  ipcMain.handle('storage:save', async (e, data) => true);
  ipcMain.handle('pin:get', async () => null);

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 3) {
      consoleErrors.push({ message, line, sourceId });
    } else if (level === 2) {
      consoleWarns.push({ message, line, sourceId });
    }
  });

  win.webContents.on('crashed', (e) => {
    runtimeExceptions.push({ type: 'crashed', details: e });
  });

  win.webContents.on('render-process-gone', (e, details) => {
    runtimeExceptions.push({ type: 'render-process-gone', details });
  });

  const indexPath = path.join(__dirname, '../src/ui/index.html');
  await win.loadFile(indexPath);

  // Aguarda 1 segundo para bootstrap completo de DOM, dados e listeners
  await new Promise(r => setTimeout(r, 1200));

  // Executa bateria de testes no contexto do renderer
  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const logs = [];
      const testErrors = [];

      function assert(condition, message) {
        if (!condition) {
          testErrors.push(message);
        } else {
          logs.push('✔ ' + message);
        }
      }

      // 1. Verifica se financeService e objetos globais carregaram
      assert(typeof finance !== 'undefined', 'finance está definido globalmente');
      assert(typeof finance.state !== 'undefined', 'finance.state está inicializado');
      if (finance && finance.state) {
        logs.push('Contas no estado: ' + (finance.state.accounts ? finance.state.accounts.length : 0));
        logs.push('Transações no estado: ' + (finance.state.transactions ? finance.state.transactions.length : 0));
        logs.push('Agendamentos no estado: ' + (finance.state.schedules ? finance.state.schedules.length : 0));
      }

      // Validação do Badge de Versão da Sidebar
      const appVer = finance.getAppVersion ? finance.getAppVersion() : '1.3.4';
      const miniBadgeEl = document.getElementById('sidebarMiniBadge');
      assert(miniBadgeEl && miniBadgeEl.textContent.trim() === 'v' + appVer, 'Badge de versão da sidebar exibe v' + appVer);

      // 2. Teste de cada aba da Sidebar usando seletores reais do app
      const navTabs = [
        'dashboard',
        'transactions',
        'accounts',
        'schedules',
        'budgets',
        'goals',
        'forecast',
        'freedom',
        'assets',
        'cost-centers',
        'side-hustles',
        'categories'
      ];

      for (const tab of navTabs) {
        try {
          const navEl = document.querySelector('.sidebar .nav-item[data-tab="' + tab + '"]');
          assert(navEl !== null, 'Item de navegação data-tab="' + tab + '" existe na sidebar');
          if (navEl) {
            navEl.click();
            await new Promise(r => setTimeout(r, 120));
            const view = document.getElementById('view-' + tab);
            assert(view !== null, 'View #view-' + tab + ' existe no DOM');
            if (view) {
              const isVisible = (view.style.display !== 'none' && window.getComputedStyle(view).display !== 'none');
              assert(isVisible, 'Menu "' + tab + '" (#view-' + tab + ') fica visível após clique');
            }
          }
        } catch (err) {
          testErrors.push('Exceção ao navegar para tab ' + tab + ': ' + err.message);
        }
      }

      // 3. Teste do menu Bancos e Cartões (Abertura, Filtros e Fechamento/Toggle de Extrato)
      try {
        const btnAcc = document.querySelector('.sidebar .nav-item[data-tab="accounts"]');
        if (btnAcc) {
          btnAcc.click();
          await new Promise(r => setTimeout(r, 150));

          // Chaveamento de filtros
          if (typeof window.handleSwitchAccountTab === 'function') {
            window.handleSwitchAccountTab('checking');
            window.handleSwitchAccountTab('credit');
            window.handleSwitchAccountTab('bills');
            window.handleSwitchAccountTab('all');
            logs.push('✔ Filtros da tela Bancos e Cartões chaveados com sucesso');
          }

          // Teste dos Botões Contextuais de Criação (+ Nova Conta, + Novo Cartão, + Novo Boleto)
          const btnCtx = document.getElementById('btnAccountsContextualAction');
          assert(btnCtx !== null, 'Botão de ação contextual existe na tela Bancos e Cartões');

          if (btnCtx && typeof window.handleSwitchAccountsTab === 'function') {
            // Teste 1: Aba Checking -> Nova Conta Bancária
            window.handleSwitchAccountsTab('checking');
            await new Promise(r => setTimeout(r, 100));
            btnCtx.click();
            await new Promise(r => setTimeout(r, 150));
            const accModal = document.getElementById('accountModal');
            const accTitle = document.getElementById('accountModalTitle');
            assert(accModal && accModal.classList.contains('open'), 'Modal de Nova Conta abre ao clicar em + Nova Conta');
            assert(accTitle && accTitle.textContent.includes('Conta'), 'Título do modal reflete "Nova Conta Bancária"');
            const btnCloseAcc = document.getElementById('btnCloseAccountModal');
            if (btnCloseAcc) btnCloseAcc.click();
            await new Promise(r => setTimeout(r, 100));

            // Teste 2: Aba Credit -> Novo Cartão de Crédito
            window.handleSwitchAccountsTab('credit');
            await new Promise(r => setTimeout(r, 100));
            btnCtx.click();
            await new Promise(r => setTimeout(r, 150));
            assert(accModal && accModal.classList.contains('open'), 'Modal de Novo Cartão abre ao clicar em + Novo Cartão');
            assert(accTitle && accTitle.textContent.includes('Cartão'), 'Título do modal reflete "Novo Cartão de Crédito"');
            if (btnCloseAcc) btnCloseAcc.click();
            await new Promise(r => setTimeout(r, 100));

            // Teste 3: Aba Bills -> Novo Boleto
            window.handleSwitchAccountsTab('bills');
            await new Promise(r => setTimeout(r, 100));
            btnCtx.click();
            await new Promise(r => setTimeout(r, 150));
            const schModal = document.getElementById('schModal');
            const schTitle = document.getElementById('schModalTitle');
            assert(schModal && schModal.classList.contains('open'), 'Modal de Novo Boleto abre ao clicar em + Novo Boleto');
            assert(schTitle && schTitle.textContent.includes('Boleto'), 'Título do modal reflete "Novo Boleto"');
            const btnCloseSch = document.getElementById('btnCloseSchModal');
            if (btnCloseSch) btnCloseSch.click();
            await new Promise(r => setTimeout(r, 100));

            // Retorna para checking
            window.handleSwitchAccountsTab('checking');
            await new Promise(r => setTimeout(r, 100));
          }

          // Teste de Extrato
          if (finance && finance.state && finance.state.accounts && finance.state.accounts.length > 0) {
            const firstAcc = finance.state.accounts[0];
            window.handleSelectAccount(firstAcc.id);
            await new Promise(r => setTimeout(r, 150));
            const details = document.getElementById('accountDetailsCard');
            assert(details && details.style.display !== 'none', 'Extrato da conta abre com display visível');

            // Clica na mesma conta para testar o fechamento por toggle
            window.handleSelectAccount(firstAcc.id);
            await new Promise(r => setTimeout(r, 150));
            assert(details && details.style.display === 'none', 'Extrato da conta fecha com toggle inteligente');
          }
        }
      } catch (err) {
        testErrors.push('Erro no teste de Bancos e Cartões: ' + err.message);
      }

      // 4. Teste específico de Contas Agendadas
      try {
        const btnSched = document.querySelector('.sidebar .nav-item[data-tab="schedules"]');
        if (btnSched) {
          btnSched.click();
          await new Promise(r => setTimeout(r, 150));

          if (typeof window.handleSwitchScheduleTab === 'function') {
            window.handleSwitchScheduleTab('expense');
            window.handleSwitchScheduleTab('income');
            window.handleSwitchScheduleTab('paid');
            window.handleSwitchScheduleTab('all');
            logs.push('✔ Abas de Contas Agendadas chaveadas com sucesso');
          }
        }
      } catch (err) {
        testErrors.push('Erro no teste de Contas Agendadas: ' + err.message);
      }

      // 5. Teste específico de Visão Geral (Dashboard)
      try {
        const btnDash = document.querySelector('.sidebar .nav-item[data-tab="dashboard"]');
        if (btnDash) {
          btnDash.click();
          await new Promise(r => setTimeout(r, 150));

          if (typeof window.navigateDashboardPeriod === 'function') {
            window.navigateDashboardPeriod(1);
            window.navigateDashboardPeriod(-1);
            logs.push('✔ Navegação de período do Dashboard executada');
          }
        }
      } catch (err) {
        testErrors.push('Erro no teste de Dashboard: ' + err.message);
      }

      // 6. Teste de Abertura e Fechamento dos Modais Principais
      const modalTests = [
        { openBtn: 'btnNewTransactionFloating', modalId: 'txModal', closeBtn: 'btnCloseTxModal', name: 'Nova Transação' },
        { openBtn: 'btnOpenNotificationSettings', modalId: 'notificationSettingsModal', closeBtn: 'btnCloseNotificationSettingsModal', name: 'Configurações de Notificação' }
      ];

      for (const m of modalTests) {
        try {
          const btn = document.getElementById(m.openBtn);
          if (btn) {
            btn.click();
            await new Promise(r => setTimeout(r, 150));
            const modal = document.getElementById(m.modalId);
            assert(modal && modal.classList.contains('open'), 'Modal ' + m.name + ' abre corretamente');
            const closeBtn = document.getElementById(m.closeBtn);
            if (closeBtn) {
              closeBtn.click();
              await new Promise(r => setTimeout(r, 150));
              assert(modal && !modal.classList.contains('open'), 'Modal ' + m.name + ' fecha corretamente');
            }
          }
        } catch (err) {
          testErrors.push('Erro no teste do modal ' + m.name + ': ' + err.message);
        }
      }

      return { logs, testErrors };
    })()
  `);

  console.log('\n======================================================');
  console.log('   RESULTADOS DO TESTE END-TO-END (RUNTIME ELECTRON)  ');
  console.log('======================================================');

  results.logs.forEach(l => console.log(l));

  if (results.testErrors.length > 0) {
    console.log('\n❌ FALHAS ENCONTRADAS NO TESTE:');
    results.testErrors.forEach(err => console.error('  - ' + err));
  } else {
    console.log('\n🎉 TODOS OS TESTES DE NAVEGAÇÃO E MENUS PASSARAM COM SUCESSO!');
  }

  if (consoleErrors.length > 0) {
    console.log('\n🚨 ERROS DE CONSOLE DETECTADOS NO RENDERER:');
    consoleErrors.forEach(e => console.error(`  [Linha ${e.line}]: ${e.message}`));
  } else {
    console.log('✔ Zero erros de console no renderer.');
  }

  if (runtimeExceptions.length > 0) {
    console.log('\n💥 EXCEÇÕES DE PROCESSO:');
    runtimeExceptions.forEach(e => console.error(e));
  }

  const exitCode = (results.testErrors.length > 0 || consoleErrors.length > 0 || runtimeExceptions.length > 0) ? 1 : 0;
  setTimeout(() => {
    app.quit();
    process.exit(exitCode);
  }, 200);
});
