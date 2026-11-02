const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { FinanceService } = require('../core/financeService');

// --- OTIMIZAÇÃO PARA HARDWARE LIMITADO / 32-BITS ---
// Reduz o footprint de memória RAM e evita saturação de CPU em máquinas mais antigas
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

let mainWindow = null;

function getStorageFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'financial_data.json');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 360,
    minHeight: 520,
    backgroundColor: '#0f172a',
    title: 'Valore - Gestão Financeira Inteligente',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single Instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    ensureSyncServerStarted();

    nativeTheme.on('updated', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('theme:system-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// IPC Handlers
ipcMain.handle('storage:load', async () => {
  const filePath = getStorageFilePath();
  const backupPath = filePath + '.bak';
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
    if (fs.existsSync(backupPath)) {
      console.warn('Arquivo principal não encontrado. Restaurando do backup de segurança...');
      const backupData = fs.readFileSync(backupPath, 'utf-8');
      return JSON.parse(backupData);
    }
    return null;
  } catch (error) {
    console.error('Erro ao ler base de dados principal, tentando backup:', error);
    try {
      if (fs.existsSync(backupPath)) {
        const backupData = fs.readFileSync(backupPath, 'utf-8');
        return JSON.parse(backupData);
      }
    } catch (bakErr) {
      console.error('Erro crítico: backup também corrompido:', bakErr);
    }
    return null;
  }
});

ipcMain.handle('storage:save', async (event, data) => {
  try {
    const filePath = getStorageFilePath();
    const tempPath = filePath + '.tmp';
    const backupPath = filePath + '.bak';
    const jsonContent = JSON.stringify(data, null, 2);

    // 1. Grava no arquivo temporário primeiro (escrita atômica)
    fs.writeFileSync(tempPath, jsonContent, 'utf-8');

    // 2. Se o arquivo oficial já existir, cria/atualiza backup
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, backupPath);
      } catch (copyErr) {
        console.warn('Não foi possível gerar backup prévio:', copyErr);
      }
    }

    // 3. Renomeia o temporário para o arquivo oficial
    fs.renameSync(tempPath, filePath);

    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar dados atomicamente:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('theme:get-system', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('shell:open-external', async (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('pdf:parse-buffer', async (event, input) => {
  try {
    const pdfParse = require('pdf-parse');
    let buffer;
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (input instanceof Uint8Array) {
      buffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    } else if (input instanceof ArrayBuffer) {
      buffer = Buffer.from(input);
    } else {
      buffer = Buffer.from(input);
    }
    const data = await pdfParse(buffer);
    return { success: true, text: data.text, numPages: data.numpages };
  } catch (error) {
    console.error('Erro ao ler PDF:', error);
    return { success: false, error: error.message };
  }
});

// =========================================================================
// --- SERVIDOR WI-FI LOCAL (VALORE LAN SYNC SERVER - PORTA 45454) ---
// =========================================================================
let syncHttpServer = null;
let syncServerPort = 45454;
let syncServerPin = null;
let syncClientsCount = 0;
let lastLanSyncTime = null;

function getSyncConfigPath() {
  return path.join(app.getPath('userData'), 'sync_server_config.json');
}

function loadOrCreateSyncPin() {
  if (syncServerPin && /^\d{6}$/.test(syncServerPin)) {
    return syncServerPin;
  }
  try {
    const cfgPath = getSyncConfigPath();
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (cfg && cfg.pin && /^\d{6}$/.test(String(cfg.pin))) {
        syncServerPin = String(cfg.pin);
        return syncServerPin;
      }
    }
  } catch (_) {}
  syncServerPin = String(Math.floor(100000 + Math.random() * 900000));
  saveSyncPinToDisk(syncServerPin);
  return syncServerPin;
}

function saveSyncPinToDisk(pin) {
  try {
    const cfgPath = getSyncConfigPath();
    fs.writeFileSync(cfgPath, JSON.stringify({ pin: String(pin), updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
  } catch (_) {}
}

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  // Prioriza redes locais Wi-Fi / Ethernet padrão (192.168.x.x, 10.x.x.x, 172.x.x.x)
  ips.sort((a, b) => {
    const aScore = a.address.startsWith('192.168.') ? 0 : (a.address.startsWith('10.') ? 1 : 2);
    const bScore = b.address.startsWith('192.168.') ? 0 : (b.address.startsWith('10.') ? 1 : 2);
    return aScore - bScore;
  });
  return ips;
}

function loadRawStateFromDisk() {
  const filePath = getStorageFilePath();
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

function saveRawStateToDisk(stateData) {
  const filePath = getStorageFilePath();
  const tempPath = filePath + '.tmp';
  const backupPath = filePath + '.bak';
  const jsonContent = JSON.stringify(stateData, null, 2);
  fs.writeFileSync(tempPath, jsonContent, 'utf-8');
  if (fs.existsSync(filePath)) {
    try { fs.copyFileSync(filePath, backupPath); } catch (_) {}
  }
  fs.renameSync(tempPath, filePath);
}

function ensureSyncServerStarted() {
  loadOrCreateSyncPin();
  if (syncHttpServer && syncHttpServer.listening) {
    const ips = getLocalIPv4Addresses();
    return {
      running: true,
      port: syncServerPort,
      pin: syncServerPin,
      ips: ips.map(i => i.address),
      primaryIp: ips.length > 0 ? ips[0].address : '127.0.0.1',
      hostname: os.hostname(),
      lastSyncAt: lastLanSyncTime,
      syncCount: syncClientsCount
    };
  }

  syncHttpServer = http.createServer((req, res) => {
    // Cabeçalhos CORS para permitir acesso direto do WebView Android na rede Wi-Fi local
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Valore-Pin');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const clientPin = String(req.headers['x-valore-pin'] || '').trim();

    if (req.url === '/valore-sync/ping' && req.method === 'GET') {
      if (clientPin && clientPin !== syncServerPin) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'PIN de segurança inválido.' }));
        return;
      }
      const diskState = loadRawStateFromDisk();
      const lastModifiedAt = (diskState && diskState.syncMeta && diskState.syncMeta.lastModifiedAt) || 0;
      const lastSyncAt = (diskState && diskState.syncMeta && diskState.syncMeta.lastSyncAt) || lastLanSyncTime || null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        appName: 'Valore Desktop',
        hostname: os.hostname(),
        requiresPin: true,
        lastModifiedAt,
        lastSyncAt,
        transactionsCount: (diskState && Array.isArray(diskState.transactions)) ? diskState.transactions.length : 0
      }));
      return;
    }

    if (req.url === '/valore-sync/sync' && req.method === 'POST') {
      if (clientPin !== syncServerPin) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'PIN de Segurança incorreto! Verifique o código de 6 dígitos na tela do PC.' }));
        return;
      }

      let bodyChunks = [];
      req.on('data', chunk => bodyChunks.push(chunk));
      req.on('end', async () => {
        try {
          const rawBody = Buffer.concat(bodyChunks).toString('utf-8');
          const mobilePayload = JSON.parse(rawBody);
          const syncMode = mobilePayload.syncMode || 'smart_merge';

          const diskState = loadRawStateFromDisk();
          if (diskState) {
            try {
              const preSyncBakPath = path.join(app.getPath('userData'), 'financial_data.pre-sync.bak');
              fs.writeFileSync(preSyncBakPath, JSON.stringify(diskState, null, 2), 'utf-8');
            } catch (_) {}
          }

          const memAdapter = {
            get: async () => diskState,
            save: async (newState) => {
              saveRawStateToDisk(newState);
              return { success: true };
            }
          };

          const svc = new FinanceService(memAdapter);
          await svc.init();

          let mergeReport;
          if (syncMode === 'pc_to_mobile') {
            // Modo PC -> Celular: A base do PC prevalece integralmente e substitui a do Celular
            svc.purgeFactoryDemoIfRealDataExists(svc.state);
            const nowTs = Date.now();
            if (!svc.state.syncMeta) svc.state.syncMeta = { deviceId: 'pc-master', deletedIds: {} };
            svc.state.syncMeta.lastSyncAt = new Date(nowTs).toISOString();
            svc.state.syncMeta.lastModifiedAt = nowTs;
            await svc.save();
            mergeReport = {
              stats: {
                addedTransactions: 0,
                updatedTransactions: 0,
                addedAccounts: 0,
                mode: 'pc_to_mobile'
              }
            };
          } else if (syncMode === 'mobile_to_pc') {
            // Modo Celular -> PC: A base do Celular substitui a do PC
            const incomingState = mobilePayload.state || mobilePayload;
            await svc.restoreBackup(incomingState);
            const nowTs = Date.now();
            if (!svc.state.syncMeta) svc.state.syncMeta = { deviceId: 'mobile-master', deletedIds: {} };
            svc.state.syncMeta.lastSyncAt = new Date(nowTs).toISOString();
            svc.state.syncMeta.lastModifiedAt = nowTs;
            await svc.save();
            mergeReport = {
              stats: {
                addedTransactions: (svc.state.transactions || []).length,
                updatedTransactions: 0,
                addedAccounts: (svc.state.accounts || []).length,
                mode: 'mobile_to_pc'
              }
            };
          } else {
            // Modo Smart Merge Inteligente (com filtro anti-seed de fábrica)
            mergeReport = await svc.mergeExternalState(mobilePayload);
          }

          syncClientsCount++;
          lastLanSyncTime = new Date().toISOString();

          // Notifica a janela do Valore Desktop para recarregar os dados instantaneamente na tela!
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('sync:remote-completed', {
              stats: mergeReport.stats,
              syncMode,
              syncedAt: lastLanSyncTime,
              deviceName: mobilePayload.deviceName || 'Smartphone Android',
              silentAutoSync: !!mobilePayload.silentAutoSync,
              autoSyncReason: mobilePayload.autoSyncReason || null
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            hostname: os.hostname(),
            syncMode,
            stats: mergeReport.stats,
            syncedAt: lastLanSyncTime,
            mergedState: svc.state
          }));
        } catch (err) {
          console.error('Erro durante LAN Sync:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message || 'Erro interno ao mesclar dados no PC.' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Endpoint não encontrado.' }));
  });

  syncHttpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      syncServerPort++;
      try { syncHttpServer.listen(syncServerPort, '0.0.0.0'); } catch (_) {}
    } else {
      console.error('Erro no servidor LAN Sync:', err);
    }
  });

  try {
    syncHttpServer.listen(syncServerPort, '0.0.0.0');
  } catch (e) {
    console.error('Falha ao iniciar servidor LAN Sync:', e);
  }

  const ips = getLocalIPv4Addresses();
  return {
    running: true,
    port: syncServerPort,
    pin: syncServerPin,
    ips: ips.map(i => i.address),
    primaryIp: ips.length > 0 ? ips[0].address : '127.0.0.1',
    hostname: os.hostname(),
    lastSyncAt: lastLanSyncTime,
    syncCount: syncClientsCount
  };
}

ipcMain.handle('sync:get-status', () => {
  return ensureSyncServerStarted();
});

ipcMain.handle('sync:regenerate-pin', () => {
  syncServerPin = String(Math.floor(100000 + Math.random() * 900000));
  saveSyncPinToDisk(syncServerPin);
  return ensureSyncServerStarted();
});

ipcMain.handle('storage:restore-backup', () => {
  try {
    const userDataDir = app.getPath('userData');
    const candidates = [
      path.join(userDataDir, 'financial_data.backup-manual-recuperado.json'),
      path.join(userDataDir, 'financial_data.pre-sync.bak'),
      path.join(userDataDir, 'financial_data.json.bak')
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.accounts)) {
          saveRawStateToDisk(parsed);
          return { success: true, source: path.basename(candidate), state: parsed };
        }
      }
    }
    return { success: false, error: 'Nenhum arquivo de backup automático encontrado no PC.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.on('window-all-closed', () => {
  if (syncHttpServer) {
    try { syncHttpServer.close(); } catch (_) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
