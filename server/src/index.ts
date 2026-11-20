import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createDefaultMap } from '@happy-voyage/shared';
import { checkDatabase } from './db';
import { registerLobby } from './lobby';

/**
 * Express + Socket.IO server. Today it serves the built client and a couple of
 * API routes; multiplayer rooms (see lobby.ts) will run GameEngine here so the
 * server is the source of truth for every match.
 */
const PORT = Number(process.env.PORT ?? 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, database: await checkDatabase() });
});

app.get('/api/map', (_req, res) => {
  res.json(createDefaultMap());
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
registerLobby(io);

httpServer.listen(PORT, () => {
  console.log(`Happy Voyage server on http://localhost:${PORT}`);
});
