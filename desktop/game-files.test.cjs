const assert = require('node:assert/strict');
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { DEBUG_URL, GAME_URL, serveGameFiles } = require('./game-files.cjs');

test('serves the bundled game from the hosted demo origin without fetching it', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'happy-voyage-desktop-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<title>Happy Voyage</title>');
  await writeFile(join(directory, 'assets', 'index-123.js'), 'export {};');
  await writeFile(join(directory, 'debug.html'), 'tester');
  const handle = serveGameFiles(directory, () => assert.fail('Unexpected network request'));

  const title = await handle(new Request(new URL('?room=123', GAME_URL)));
  assert.equal(title.status, 200);
  assert.equal(title.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(await title.text(), '<title>Happy Voyage</title>');

  const script = await handle(new Request(new URL('assets/index-123.js', GAME_URL)));
  assert.equal(script.status, 200);
  assert.equal(script.headers.get('Content-Type'), 'text/javascript; charset=utf-8');
  assert.equal(await script.text(), 'export {};');

  for (const path of ['debug.html', 'assets/missing.css', '../index.html', 'assets/..%2fdebug.html']) {
    assert.equal((await handle(new Request(new URL(path, GAME_URL)))).status, 404);
  }
  assert.equal((await handle(new Request(GAME_URL, { method: 'POST' }))).status, 405);
});

test('passes the room server request through unchanged', async () => {
  const request = new Request('https://happy-voyage.onrender.com/socket.io/?EIO=4');
  const mockResponse = new Response('room server');
  const handle = serveGameFiles('', (remote) => {
    assert.equal(remote, request);
    return mockResponse;
  });
  assert.equal(await handle(request), mockResponse);
});

test('exposes the tester page and its assets only when the debug directory is enabled', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'happy-voyage-debug-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'debug.html'), '<title>Window Tester</title>');
  await writeFile(join(directory, 'assets', 'tester.js'), 'export {};');
  const asset = new URL('assets/tester.js', DEBUG_URL);
  const disabled = serveGameFiles(directory, () => assert.fail('Unexpected network request'));
  const enabled = serveGameFiles(directory, () => assert.fail('Unexpected network request'), directory);
  for (const url of [DEBUG_URL, asset, new URL('?preview=repair', DEBUG_URL)]) {
    assert.equal((await disabled(new Request(url))).status, 404);
    assert.equal((await enabled(new Request(url))).status, 200);
  }
  assert.equal((await enabled(new Request(new URL('index.html', DEBUG_URL)))).status, 404);
});
