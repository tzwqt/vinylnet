const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')

let win

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 550,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#050008',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { bypassCSP: true, stream: true } }
])

app.whenReady().then(() => {
  protocol.registerFileProtocol('localfile', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''))
    callback({ path: filePath })
  })
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    message: 'Select your music folder'
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

ipcMain.handle('scan-folder', async (event, folderPath) => {
  const exts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus']
  const tracks = []

  function scanDir(dir) {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(full)
      } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
        tracks.push({ name: entry.name, path: full, url: 'localfile://' + encodeURIComponent(full) })
      }
    }
  }

  scanDir(folderPath)
  tracks.sort((a, b) => a.name.localeCompare(b.name))
  return tracks
})

ipcMain.handle('save-prefs', async (event, prefs) => {
  const prefsPath = path.join(app.getPath('userData'), 'prefs.json')
  fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2))
  return true
})

ipcMain.handle('load-prefs', async () => {
  const prefsPath = path.join(app.getPath('userData'), 'prefs.json')
  try {
    return JSON.parse(fs.readFileSync(prefsPath, 'utf8'))
  } catch {
    return null
  }
})
