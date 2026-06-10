/* ============================================================================
   minecrAft — Adyah's Adventure
   Electron main process: window, native menu, and real on-disk save files.
   Works fully offline on Windows and macOS.
   ============================================================================ */
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ---- Where Adyah's worlds are stored (a real save folder, per-OS) ----
//   macOS:   ~/Library/Application Support/minecraaft/saves/
//   Windows: %APPDATA%/minecraaft/saves/
const SAVE_DIR = path.join(app.getPath('userData'), 'saves');
const SAVE_FILE = path.join(SAVE_DIR, 'adyah-world.json');
const BACKUP_FILE = path.join(SAVE_DIR, 'adyah-world.backup.json');

function ensureSaveDir() {
  try { fs.mkdirSync(SAVE_DIR, { recursive: true }); } catch (e) {}
}

let mainWindow = null;
let quitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b1020',
    title: "minecrAft - Adyah's Adventure",
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Ask the renderer to flush a final save before the window actually closes.
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.webContents.send('flush-save');
      // Safety net: quit anyway if the renderer doesn't answer quickly.
      setTimeout(() => { quitting = true; app.quit(); }, 1500);
    }
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Game',
      submenu: [
        {
          label: 'New World (start over)',
          click: () => {
            const res = dialog.showMessageBoxSync(mainWindow, {
              type: 'warning',
              buttons: ['Cancel', 'Start a new world'],
              defaultId: 0,
              cancelId: 0,
              title: 'New World',
              message: "Start a brand-new world for Adyah?",
              detail: "This erases the current world and all buildings. (A backup is kept.)"
            });
            if (res === 1) mainWindow.webContents.send('new-world');
          }
        },
        {
          label: 'Open Save Folder',
          click: () => { ensureSaveDir(); shell.openPath(SAVE_DIR); }
        },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'How to Play',
          click: () => mainWindow.webContents.send('show-help')
        },
        {
          label: 'About',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About',
            message: "minecrAft — Adyah's Adventure",
            detail: "A voxel building & adventure game made just for Adyah.\nRuns 100% offline. Your world saves automatically."
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------- Save / Load IPC ----------------
function readSave() {
  ensureSaveDir();
  for (const f of [SAVE_FILE, BACKUP_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const txt = fs.readFileSync(f, 'utf8');
        const data = JSON.parse(txt);
        if (data && typeof data === 'object') return data;
      }
    } catch (e) { /* try backup next */ }
  }
  return null;
}

function writeSave(data) {
  ensureSaveDir();
  try {
    // keep a rolling backup of the previous good save
    if (fs.existsSync(SAVE_FILE)) {
      try { fs.copyFileSync(SAVE_FILE, BACKUP_FILE); } catch (e) {}
    }
    // atomic-ish write: temp then rename
    const tmp = SAVE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, SAVE_FILE);
    return true;
  } catch (e) {
    return false;
  }
}

ipcMain.handle('game-load', () => readSave());
ipcMain.handle('game-save', (e, data) => writeSave(data));
ipcMain.handle('game-clear', () => {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      fs.copyFileSync(SAVE_FILE, BACKUP_FILE);
      fs.unlinkSync(SAVE_FILE);
    }
    return true;
  } catch (e) { return false; }
});
ipcMain.handle('save-path', () => SAVE_DIR);

// Renderer tells us it finished its final save → really quit now.
ipcMain.on('flush-done', () => { quitting = true; app.quit(); });

// ---------------- App lifecycle ----------------
app.whenReady().then(() => {
  ensureSaveDir();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { quitting = true; });
