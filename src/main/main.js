const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { LedgerDatabase } = require('./db');

let mainWindow;
let db;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function registerIpcHandlers() {
  ipcMain.handle('ledger:list', async (_event, filters) => db.getEntries(filters));
  ipcMain.handle('ledger:create', async (_event, payload) => db.addEntry(payload));
  ipcMain.handle('ledger:delete', async (_event, id) => db.removeEntry(id));
  ipcMain.handle('ledger:summary', async (_event, yearMonth) => db.getMonthlySummary(yearMonth));
}

app.whenReady().then(async () => {
  const dbFilePath = path.join(app.getPath('userData'), 'ledger.sqlite');
  db = new LedgerDatabase(dbFilePath);
  await db.initialize();

  registerIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
