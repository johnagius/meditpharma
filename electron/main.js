const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: 'Meditpharma Pro',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // index.html is copied alongside main.js at build time
  const htmlPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'index.html')
    : path.join(__dirname, 'index.html');

  win.loadFile(htmlPath);
  win.setMenuBarVisibility(false);

  // Open external links in the system browser, not in the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
