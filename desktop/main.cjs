const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const { join } = require('node:path');
const { DEBUG_URL, GAME_URL, serveGameFiles } = require('./game-files.cjs');
const { loadPlayerConfig, playerConfigPath } = require('./player-config.cjs');

function openWindow(gameSession, page = GAME_URL, debugEnabled = false) {
  const window = new BrowserWindow({
    title: 'Happy Voyage',
    icon: join(__dirname, 'build/icon.png'),
    width: 1280,
    height: 850,
    webPreferences: {
      session: gameSession,
      preload: join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    const url = new URL(target);
    if (url.origin !== page.origin || url.pathname !== page.pathname) event.preventDefault();
  });
  if (debugEnabled) {
    let tester;
    window.webContents.on('before-input-event', (event, input) => {
      const modifier = process.platform === 'darwin' ? input.meta : input.control;
      if (input.type !== 'keyDown' || !modifier || !input.shift || input.alt || input.code !== 'KeyD') return;
      event.preventDefault();
      if (input.isAutoRepeat) return;
      if (tester && !tester.isDestroyed()) tester.focus();
      else tester = openWindow(gameSession, DEBUG_URL);
    });
  }
  window.loadURL(page.href).catch((error) => {
    if (window.isDestroyed()) return;
    dialog.showErrorBox('Could not start Happy Voyage', error.message);
    window.close();
  });
  return window;
}

app.whenReady().then(async () => {
  const { config, invalid, debugEnabled } = await loadPlayerConfig(playerConfigPath({
    platform: process.platform,
    isPackaged: app.isPackaged,
    executable: process.execPath,
    portableDirectory: process.env.PORTABLE_EXECUTABLE_DIR,
    appDirectory: process.platform === 'darwin' && app.isPackaged ? join(process.resourcesPath, '../..') : __dirname,
  }));
  if (invalid) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'config.json',
      message: '无法读取 config.json，将使用默认设置。\nCould not read config.json. Using default settings.',
      detail: '请确认文件是有效的 JSON 对象。\nMake sure the file contains a valid JSON object.',
    });
  }
  ipcMain.on('player-config', (event) => {
    const frame = event.senderFrame;
    const url = frame?.url ? new URL(frame.url) : null;
    event.returnValue = frame === event.sender.mainFrame && url?.origin === GAME_URL.origin && url.pathname === GAME_URL.pathname ? config : undefined;
  });
  const gameSession = session.fromPartition('persist:happy-voyage');
  const directory = app.isPackaged ? join(process.resourcesPath, 'game') : join(__dirname, '../client/dist');
  const debugDirectory = debugEnabled ? (app.isPackaged ? join(process.resourcesPath, 'debug') : join(__dirname, '../client/dist-debug')) : undefined;
  // Keep the hosted demo origin for room requests and invite links while serving the game offline.
  gameSession.protocol.handle('https', serveGameFiles(directory, (request) =>
    gameSession.fetch(request, { bypassCustomProtocolHandlers: true }), debugDirectory));
  openWindow(gameSession, GAME_URL, debugEnabled);
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) openWindow(gameSession, GAME_URL, debugEnabled);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
