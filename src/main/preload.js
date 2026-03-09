const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ledgerApi', {
  listEntries: (filters) => ipcRenderer.invoke('ledger:list', filters),
  createEntry: (payload) => ipcRenderer.invoke('ledger:create', payload),
  deleteEntry: (id) => ipcRenderer.invoke('ledger:delete', id),
  getSummary: (yearMonth) => ipcRenderer.invoke('ledger:summary', yearMonth)
});
