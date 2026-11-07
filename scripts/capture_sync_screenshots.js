const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, 'manual_assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

app.whenReady().then(async () => {
  ipcMain.handle('storage:load', async () => ({
    accounts: [
      { id: 'acc1', name: 'Nubank Allan', type: 'checking', balance: 4250.80 },
      { id: 'acc2', name: 'Inter Esposa', type: 'checking', balance: 3890.15 },
      { id: 'acc3', name: 'Cartão Black', type: 'credit', balance: -1450.00 }
    ],
    vaults: [],
    transactions: [
      { id: 'tx1', description: 'Supermercado Mensal', amount: 840.50, type: 'expense', category: 'Alimentação', author: 'Allan', date: '2026-11-06' },
      { id: 'tx2', description: 'Farmácia & Cuidados', amount: 165.20, type: 'expense', category: 'Saúde', author: 'Esposa', date: '2026-11-07' }
    ],
    categories: [],
    schedules: [],
    goals: [],
    assets: [],
    debts: [],
    syncMeta: {
      deviceId: 'pc-master',
      lastModifiedAt: Date.now(),
      lastSyncAt: new Date().toISOString()
    }
  }));
  ipcMain.handle('storage:save', async () => true);
  ipcMain.handle('theme:get-system', async () => 'dark');
  ipcMain.handle('sync:get-status', async () => ({
    running: true,
    port: 45454,
    pin: '531362',
    ips: ['192.168.1.15', '10.0.0.8'],
    primaryIp: '192.168.1.15',
    hostname: 'DELL-ALLAN-PC',
    lastSyncAt: new Date().toISOString(),
    syncCount: 3
  }));

  // 1. DESKTOP
  const winDesktop = new BrowserWindow({
    width: 1100,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await winDesktop.loadFile(path.join(__dirname, '../src/ui/index.html'));
  await new Promise(r => setTimeout(r, 1200));

  await winDesktop.webContents.executeJavaScript(`
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.add('open');
    if (typeof refreshDesktopSyncServerCard === 'function') {
      refreshDesktopSyncServerCard();
    }
    const pcCard = document.getElementById('syncDesktopServerCard');
    if (pcCard) pcCard.style.display = 'block';
  `);
  await new Promise(r => setTimeout(r, 600));

  // PC Card
  const pcRect = await winDesktop.webContents.executeJavaScript(`
    (() => {
      const card = document.getElementById('syncDesktopServerCard');
      if (!card) return null;
      card.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = card.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `);
  if (pcRect) {
    const pcImg = await winDesktop.webContents.capturePage(pcRect);
    fs.writeFileSync(path.join(outputDir, 'pc_server_card.png'), pcImg.toPNG());
  }

  // Troca para aba de Arquivos / Cofre no Desktop
  await winDesktop.webContents.executeJavaScript(`
    if (typeof window.switchSyncHubTab === 'function') {
      window.switchSyncHubTab('files');
    } else {
      const btn = document.getElementById('btnSyncTabFiles');
      if (btn) btn.click();
    }
  `);
  await new Promise(r => setTimeout(r, 600));

  const filesRect = await winDesktop.webContents.executeJavaScript(`
    (() => {
      const pane = document.getElementById('syncHubPaneFiles');
      if (!pane) return null;
      pane.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = pane.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `);
  if (filesRect) {
    const fImg = await winDesktop.webContents.capturePage(filesRect);
    fs.writeFileSync(path.join(outputDir, 'backup_files_card.png'), fImg.toPNG());
  }

  // 2. MOBILE
  const winMobile = new BrowserWindow({
    width: 420,
    height: 880,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload_mock_mobile.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const mobilePreloadPath = path.join(__dirname, 'preload_mock_mobile.js');
  fs.writeFileSync(mobilePreloadPath, `
    const { contextBridge, ipcRenderer } = require('electron');
    contextBridge.exposeInMainWorld('electronAPI', {
      loadData: () => ipcRenderer.invoke('storage:load'),
      saveData: () => true,
      getSystemTheme: () => 'dark'
    });
  `, 'utf-8');

  await winMobile.loadFile(path.join(__dirname, '../src/ui/index.html'));
  await new Promise(r => setTimeout(r, 1200));

  await winMobile.webContents.executeJavaScript(`
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.add('open');
    const pcCard = document.getElementById('syncDesktopServerCard');
    if (pcCard) pcCard.style.display = 'none';

    const ipInput = document.getElementById('syncRemoteIpInput');
    const pinInput = document.getElementById('syncRemotePinInput');
    if (ipInput) ipInput.value = '192.168.1.15:45454';
    if (pinInput) pinInput.value = '531362';

    const banner = document.getElementById('syncWifiFeedbackBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.style.background = 'rgba(16, 185, 129, 0.15)';
      banner.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      banner.style.color = '#10b981';
      banner.innerHTML = '✅ Conectado com sucesso ao computador <b>DELL-ALLAN-PC</b>! Pronto para sincronizar.';
    }
    const autoBadge = document.getElementById('syncWifiAutoBadge');
    if (autoBadge) {
      autoBadge.textContent = '● Auto-Sync Ativo';
      autoBadge.style.background = 'rgba(16, 185, 129, 0.14)';
      autoBadge.style.color = '#10b981';
    }
  `);
  await new Promise(r => setTimeout(r, 600));

  const mobileRect = await winMobile.webContents.executeJavaScript(`
    (() => {
      const clientTitle = document.getElementById('syncClientCardTitle');
      const card = clientTitle ? clientTitle.closest('div[style*="border: 1px solid"]') : null;
      if (!card) return null;
      card.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = card.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `);
  if (mobileRect) {
    const mobImg = await winMobile.webContents.capturePage(mobileRect);
    fs.writeFileSync(path.join(outputDir, 'mobile_sync_card.png'), mobImg.toPNG());
  }

  // Captura tela completa mobile
  const mobFull = await winMobile.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, 'mobile_full_view.png'), mobFull.toPNG());

  try { fs.unlinkSync(mobilePreloadPath); } catch (_) {}
  console.log('✅ Todos os cards e abas capturados!');
  app.quit();
});
