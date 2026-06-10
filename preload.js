/* ============================================================================
   Preload bridge — safely exposes the save API + menu events to the game.
   No Node access leaks into the game; only these functions are available.
   ============================================================================ */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gameAPI', {
  // persistence
  save: (data) => ipcRenderer.invoke('game-save', data),
  load: () => ipcRenderer.invoke('game-load'),
  clear: () => ipcRenderer.invoke('game-clear'),
  savePath: () => ipcRenderer.invoke('save-path'),

  // events from the native menu / window
  onNewWorld: (cb) => ipcRenderer.on('new-world', cb),
  onShowHelp: (cb) => ipcRenderer.on('show-help', cb),
  onFlushSave: (cb) => ipcRenderer.on('flush-save', cb),
  flushDone: () => ipcRenderer.send('flush-done'),

  isElectron: true
});
