const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm, readdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { playerConfigPath, loadPlayerConfig } = require('./player-config.cjs');

test('finds config beside the portable EXE, the macOS app, or the development checkout', () => {
  const params = { isPackaged: true, executable: '/runtime/electron', appDirectory: '/games/Happy Voyage.app', portableDirectory: '/games' };
  assert.equal(playerConfigPath({ ...params, platform: 'win32' }), join('/games', 'config.json'));
  assert.equal(playerConfigPath({ ...params, platform: 'darwin', portableDirectory: undefined }), join('/games', 'config.json'));
  assert.equal(playerConfigPath({ ...params, platform: 'linux' }), join('/runtime', 'config.json'));
  assert.equal(playerConfigPath({ ...params, isPackaged: false, appDirectory: '/checkout/desktop' }), join('/checkout/desktop', 'config.json'));
});

test('leaves missing config absent and distinguishes invalid and valid JSON files', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'happy-voyage-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'config.json');
  assert.deepEqual(await loadPlayerConfig(path), {});
  assert.deepEqual(await readdir(directory), []);
  for (const invalid of ['{bad json}', 'null', '[]', '9']) {
    await writeFile(path, invalid);
    assert.deepEqual(await loadPlayerConfig(path), { invalid: true });
  }
  await writeFile(path, '{"starting":{"gold":9999}}');
  assert.deepEqual(await loadPlayerConfig(path), { config: { starting: { gold: 9999 } }, debugEnabled: false });
});

test('only a JSON boolean true enables desktop debug, separately from gameplay tuning', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'happy-voyage-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.mock.method(console, 'warn', () => {});
  const path = join(directory, 'config.json');
  for (const debug of [true, false, 'true', 1, null]) {
    await writeFile(path, JSON.stringify({ debug, starting: { gold: 9999 } }));
    assert.deepEqual(await loadPlayerConfig(path), { config: { starting: { gold: 9999 } }, debugEnabled: debug === true });
  }
  assert.equal(console.warn.mock.callCount(), 3);
});
