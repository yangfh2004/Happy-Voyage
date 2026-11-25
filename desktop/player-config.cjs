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
    const { debug, ...gameplay } = config;
    if (debug !== undefined && typeof debug !== 'boolean') console.warn('Ignoring config.json debug: expected a boolean');
    return { config: gameplay, debugEnabled: debug === true };
  } catch (error) {
    return error.code === 'ENOENT' ? {} : { invalid: true };
  }
}

module.exports = { loadPlayerConfig, playerConfigPath };
