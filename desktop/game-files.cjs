const { readFile } = require('node:fs/promises');
const { extname, join } = require('node:path');

const GAME_URL = new URL('https://raw.githack.com/yangfh2004/Happy-Voyage/demo/index.html');
const DEBUG_URL = new URL('debug/debug.html', GAME_URL);
const GAME_ROOT = new URL('.', GAME_URL).pathname;
const DEBUG_ROOT = new URL('.', DEBUG_URL).pathname;
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.ttf', 'font/ttf'],
]);

function serveGameFiles(directory, fetchRemote, debugDirectory) {
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== GAME_URL.origin) return fetchRemote(request);
    if (request.method !== 'GET') return new Response(null, { status: 405 });

    const debug = url.pathname.startsWith(DEBUG_ROOT);
    const root = debug ? DEBUG_ROOT : GAME_ROOT;
    const base = debug ? debugDirectory : directory;
    const file = url.pathname.slice(root.length);
    if (!base || !url.pathname.startsWith(root) ||
        (file !== (debug ? 'debug.html' : 'index.html') && !/^assets\/[\w.-]+$/.test(file))) {
      return new Response(null, { status: 404 });
    }
    const contentType = CONTENT_TYPES.get(extname(file));
    if (!contentType) return new Response(null, { status: 404 });

    try {
      return new Response(await readFile(join(base, file)), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      if (error.code === 'ENOENT') return new Response(null, { status: 404 });
      throw error;
    }
  };
}

module.exports = { DEBUG_URL, GAME_URL, serveGameFiles };
