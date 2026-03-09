import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { LedgerDatabase } from "./database";
import { registerLedgerIpc } from "./ipc";

let mainWindow: BrowserWindow | null = null;
let database: LedgerDatabase | null = null;
let ipcRegistered = false;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#f3f0e8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "..", "preload", "index.js")
    }
  });

  void window.loadFile(join(__dirname, "..", "renderer", "index.html"));
  return window;
}

app.whenReady().then(() => {
  database = new LedgerDatabase();
  mainWindow = createMainWindow();
  if (database && !ipcRegistered) {
    registerLedgerIpc(database, mainWindow);
    ipcRegistered = true;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  database?.close();
});
