const { contextBridge, ipcRenderer } = require('electron');

if (location.origin === 'https://raw.githack.com' && (
  location.pathname === '/yangfh2004/Happy-Voyage/demo/index.html' ||
  location.pathname === '/yangfh2004/Happy-Voyage/demo/debug/debug.html'
)) {
  contextBridge.exposeInMainWorld('happyVoyageDesktop', { config: ipcRenderer.sendSync('player-config') });
}
