/**
 * StorageAdapter Interface & Implementations
 * Design Pattern: Hexagonal Architecture / Repository Pattern
 * Permite usar o mesmo Core de regras no Desktop (Electron Store / File),
 * Web (LocalStorage / IndexedDB) e Mobile (AsyncStorage / SQLite nativo no iOS e Android).
 */

class LocalStorageAdapter {
  constructor(storageKey = 'gestor_financeiro_db') {
    this.storageKey = storageKey;
  }

  async get() {
    try {
      // 1. Desktop Electron
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.loadData) {
        return await window.electronAPI.loadData();
      }
      // 2. Mobile Android (Capacitor Nativo / Preferences)
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
        const { value } = await window.Capacitor.Plugins.Preferences.get({ key: this.storageKey });
        if (value) return JSON.parse(value);
      }
      // 3. Webview / Fallback LocalStorage
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('StorageAdapter get error:', err);
      return null;
    }
  }

  async save(data) {
    try {
      // 1. Desktop Electron
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.saveData) {
        return await window.electronAPI.saveData(data);
      }
      const jsonStr = JSON.stringify(data);
      // 2. Mobile Android (Capacitor Nativo / Preferences)
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
        await window.Capacitor.Plugins.Preferences.set({ key: this.storageKey, value: jsonStr });
      }
      // 3. Webview / Fallback LocalStorage
      localStorage.setItem(this.storageKey, jsonStr);
      return { success: true };
    } catch (err) {
      console.error('StorageAdapter save error:', err);
      return { success: false, error: err.message };
    }
  }
}

// Export para uso em Browser ou bundler moderno
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LocalStorageAdapter };
} else {
  window.LocalStorageAdapter = LocalStorageAdapter;
}
