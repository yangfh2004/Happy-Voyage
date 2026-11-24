const { app, BrowserWindow, dialog, session } = require('electron');
const { join } = require('node:path');
const { GAME_URL, serveGameFiles } = require('./game-files.cjs');

function openWindow(gameSession) {
  const window = new BrowserWindow({
    title: 'Happy Voyage',
    width: 1280,
    height: 850,
    webPreferences: {
      session: gameSession,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    const url = new URL(target);
    if (url.origin !== GAME_URL.origin || url.pathname !== GAME_URL.pathname) event.preventDefault();
  });
  window.loadURL(GAME_URL.href).catch((error) => {
    if (window.isDestroyed()) return;
    dialog.showErrorBox('Could not start Happy Voyage', error.message);
    window.close();
  });
}

app.whenReady().then(() => {
  const gameSession = session.fromPartition('persist:happy-voyage');
  const directory = app.isPackaged ? join(process.resourcesPath, 'game') : join(__dirname, '../client/dist');
  // Keep the hosted demo origin for room requests and invite links while serving the game offline.
  gameSession.protocol.handle('https', serveGameFiles(directory, (request) =>
    gameSession.fetch(request, { bypassCustomProtocolHandlers: true })));
  openWindow(gameSession);
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) openWindow(gameSession);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
