const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('storage:load'),
  saveData: (data) => ipcRenderer.invoke('storage:save', data),
  getSystemTheme: () => ipcRenderer.invoke('theme:get-system'),
  onSystemThemeChanged: (callback) => {
    ipcRenderer.on('theme:system-changed', (event, theme) => callback(theme));
  },
  parsePdfBuffer: (buffer) => ipcRenderer.invoke('pdf:parse-buffer', buffer),
  getSyncServerStatus: () => ipcRenderer.invoke('sync:get-status'),
  regenerateSyncPin: () => ipcRenderer.invoke('sync:regenerate-pin'),
  restorePcBackup: () => ipcRenderer.invoke('storage:restore-backup'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  onRemoteSyncCompleted: (callback) => {
    ipcRenderer.on('sync:remote-completed', (event, info) => callback(info));
  }
});

