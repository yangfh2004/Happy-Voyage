const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');
const { DEBUG_URL, GAME_URL } = require('./game-files.cjs');

const main = readFileSync(join(__dirname, 'main.cjs'), 'utf8');
const preload = readFileSync(join(__dirname, 'preload.cjs'), 'utf8');
const config = { starting: { gold: 9999 } };

async function launch(debugEnabled) {
  const app = new EventEmitter();
  const ipcMain = new EventEmitter();
  const windows = [];
  app.whenReady = () => Promise.resolve();
  class BrowserWindow {
    webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler() {} });

    constructor() { windows.push(this); }
    async loadURL(url) { this.url = url; }
    isDestroyed() { return Boolean(this.closed); }
    focus() { this.focused = true; }
    close() { this.closed = true; }
    static getAllWindows() { return windows.filter(window => !window.closed); }
  }
  const electron = { app, BrowserWindow, ipcMain, session: { fromPartition: () => ({ protocol: { handle() {} } }) } };
  runInNewContext(main, {
    __dirname, URL, process: { platform: 'darwin', env: {} },
    require: (name) => name === 'electron' ? electron :
      name === './player-config.cjs' ? { playerConfigPath() {}, loadPlayerConfig: async () => ({ config, debugEnabled }) } :
      require(name),
  });
  await new Promise(setImmediate);
  return { app, ipcMain, windows };
}

test('only shares config with the game and enabled tester main frames', async () => {
  for (const debugEnabled of [false, true]) {
    const { ipcMain } = await launch(debugEnabled);
    function configFor(url, isMainFrame = true) {
      const senderFrame = { url };
      const event = { senderFrame, sender: { mainFrame: isMainFrame ? senderFrame : {} } };
      ipcMain.emit('player-config', event);
      return event.returnValue;
    }
    assert.equal(configFor(GAME_URL.href), config);
    assert.equal(configFor(DEBUG_URL.href), debugEnabled ? config : undefined);
    assert.equal(configFor(DEBUG_URL.href, false), undefined);
    assert.equal(configFor(new URL('/unrelated/debug.html', DEBUG_URL).href), undefined);

    let exposed;
    runInNewContext(preload, {
      location: DEBUG_URL,
      require: () => ({
        contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'happyVoyageDesktop'); exposed = value.config; } },
        ipcRenderer: { sendSync(channel) { assert.equal(channel, 'player-config'); return configFor(DEBUG_URL.href); } },
      }),
    });
    assert.equal(exposed, debugEnabled ? config : undefined);
  }
});
