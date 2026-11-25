const { readFile } = require('node:fs/promises');
const { dirname, join } = require('node:path');

function playerConfigPath({ platform, isPackaged, executable, portableDirectory, appDirectory }) {
  if (!isPackaged) return join(appDirectory, 'config.json');
  if (platform === 'win32' && portableDirectory) return join(portableDirectory, 'config.json');
  if (platform === 'darwin') return join(dirname(appDirectory), 'config.json');
  return join(dirname(executable), 'config.json');
}

async function loadPlayerConfig(path) {
  try {
    const config = JSON.parse(await readFile(path, 'utf8'));
    if (config === null || typeof config !== 'object' || Array.isArray(config)) return { invalid: true };
    return { config };
  } catch (error) {
    return error.code === 'ENOENT' ? {} : { invalid: true };
  }
}

module.exports = { loadPlayerConfig, playerConfigPath };
