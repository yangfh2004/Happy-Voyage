import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createDefaultMap, type RoomClientEvents, type RoomServerEvents } from '@happy-voyage/shared';
import { checkDatabase } from './db';
import { registerLobby } from './lobby';
import { roomSocketOptions } from './roomSocketOptions';

const PORT = Number(process.env.PORT ?? 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.sendStatus(200);
});

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
const io = new Server<RoomClientEvents, RoomServerEvents>(httpServer, roomSocketOptions);
registerLobby(io);

httpServer.listen(PORT, () => {
  console.log(`Happy Voyage server on http://localhost:${PORT}`);
});
