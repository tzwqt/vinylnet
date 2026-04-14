const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vinylnet', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  scanFolder: (path) => ipcRenderer.invoke('scan-folder', path),
  savePrefs: (prefs) => ipcRenderer.invoke('save-prefs', prefs),
  loadPrefs: () => ipcRenderer.invoke('load-prefs')
})
