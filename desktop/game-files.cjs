const { readFile } = require('node:fs/promises');
const { extname, join } = require('node:path');

const GAME_URL = new URL('https://raw.githack.com/yangfh2004/Happy-Voyage/demo/index.html');
const GAME_ROOT = new URL('.', GAME_URL).pathname;
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.ttf', 'font/ttf'],
]);

function serveGameFiles(directory, fetchRemote) {
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== GAME_URL.origin) return fetchRemote(request);
    if (request.method !== 'GET') return new Response(null, { status: 405 });

    const file = url.pathname.slice(GAME_ROOT.length);
    if (!url.pathname.startsWith(GAME_ROOT) ||
        (file !== 'index.html' && !/^assets\/[\w.-]+$/.test(file))) {
      return new Response(null, { status: 404 });
    }
    const contentType = CONTENT_TYPES.get(extname(file));
    if (!contentType) return new Response(null, { status: 404 });

    try {
      return new Response(await readFile(join(directory, file)), {
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

module.exports = { GAME_URL, serveGameFiles };
