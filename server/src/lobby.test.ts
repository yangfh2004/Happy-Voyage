import { createServer } from 'node:http';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import { NATIONS, type GameState, type RoomAction, type RoomClientEvents, type RoomLobby, type RoomPass, type RoomRequest, type RoomServerEvents, type RoomSnapshot } from '@happy-voyage/shared';
import { registerLobby } from './lobby';

type RoomSocket = Socket<RoomServerEvents, RoomClientEvents>;
const clients: RoomSocket[] = [];
let server: Server<RoomClientEvents, RoomServerEvents>;
let dispose: () => void;
let endpoint: string;

beforeEach(async () => {
  const http = createServer();
  server = new Server(http);
  let seed = 42;
  const rng = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);
  dispose = registerLobby(server, { paceMultiplier: 0, rng });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  endpoint = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  dispose();
  await server.close();
});

async function connect() {
  const socket: RoomSocket = io(endpoint, { transports: ['websocket'], reconnection: false });
  clients.push(socket);
  const state: { lobby?: RoomLobby; game?: RoomSnapshot } = {};
  socket.on('room:lobby', (lobby) => { state.lobby = lobby; });
  socket.on('room:game', (game) => { state.game = game; });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return {
    socket, state,
    request: (request: RoomRequest) => socket.timeout(2000).emitWithAck('room:request', request),
  };
}

type Client = Awaited<ReturnType<typeof connect>>;
async function create(host: Client): Promise<RoomPass> {
  const reply = await host.request({ type: 'create', pick: { name: 'Helena', nation: 'Spain' }, mode: 'sprint', difficulty: 'normal' });
  if (!reply.ok || !reply.pass) throw new Error('Room creation failed');
  return reply.pass;
}

it('enforces unique nations, connected seats and a host-only start in rooms of two to six', async () => {
  const host = await connect();
  const pass = await create(host);
  const join = async (client: Client, i: number) =>
    client.request({ type: 'join', roomId: pass.roomId, pick: { name: '', nation: NATIONS[i].name } });

  expect(await host.request({ type: 'start' })).toMatchObject({ ok: false, error: expect.stringContaining('two players') });
  const guest = await connect();
  expect(await join(guest, 0)).toMatchObject({ ok: false, error: 'That nation is already taken.' });
  const joined = await join(guest, 1);
  if (!joined.ok || !joined.pass) throw new Error('Join failed');
  expect(await guest.request({ type: 'start' })).toMatchObject({ ok: false, error: 'Only the host can start the voyage.' });
  for (let i = 2; i <= 5; i++) expect(await join(await connect(), i)).toMatchObject({ ok: true });
  expect(await join(await connect(), 6)).toMatchObject({ ok: false, error: 'This room is full.' });
  await vi.waitFor(() => expect(host.state.lobby?.seats).toHaveLength(6));
  expect(JSON.stringify(host.state.lobby)).not.toContain(joined.pass.token);

  guest.socket.disconnect();
  await vi.waitFor(() => expect(host.state.lobby?.seats[1].connected).toBe(false));
  expect(await host.request({ type: 'start' })).toMatchObject({ ok: false });
  expect(await host.request({ type: 'leave' })).toMatchObject({ ok: true });
  const returning = await connect();
  expect(await returning.request({ type: 'resume', roomId: pass.roomId, token: pass.token })).toMatchObject({ ok: false });
  expect(await returning.request({ type: 'resume', roomId: pass.roomId, token: joined.pass.token })).toEqual(joined);
  await vi.waitFor(() => expect(returning.state.lobby?.host).toBe(joined.pass!.seatId));
  expect(await returning.request({ type: 'start' })).toMatchObject({ ok: true });
  await vi.waitFor(() => expect(returning.state.game?.state.players.filter(({ isAI }) => !isAI)).toHaveLength(5));
});

function humanAction(state: GameState): RoomAction {
  switch (state.phase) {
    case 'awaitingSpin': return ['spinCompass'];
    case 'awaitingClaim': return state.players[state.currentPlayer].gold >= state.map[state.pendingClaim!].price! ? ['claim'] : ['decline'];
    case 'awaitingToll': return ['payToll'];
    case 'awaitingBuild': return ['finishBuilding'];
    case 'awaitingMarket': return ['finishMarket'];
    case 'awaitingRecruit': return ['declineRecruit'];
    case 'awaitingLottery': return state.lottery?.draw ? ['finishLottery'] : ['drawLottery'];
    case 'awaitingBarter': return ['declineBarter'];
    case 'awaitingMistDuel': return ['leaveMistIsland'];
    case 'awaitingMerchant': return ['acceptMerchant'];
    case 'awaitingWyvern': return ['wyvernFly', state.players[state.currentPlayer].homePort];
    case 'awaitingCargoMarket': return ['finishTrading'];
    default: throw new Error(`Not a human decision: ${state.phase}`);
  }
}

it('runs a complete server-owned match and resumes a seat without resetting the match', async () => {
  const host = await connect();
  const pass = await create(host);
  const firstGuest = await connect();
  const joined = await firstGuest.request({ type: 'join', roomId: pass.roomId, pick: { name: 'Ada', nation: 'England' } });
  if (!joined.ok || !joined.pass) throw new Error('No guest seat');
  expect(await host.request({ type: 'start' })).toEqual({ ok: true });
  await vi.waitFor(() => expect(firstGuest.state.game?.state.phase).toBe('awaitingSpin'));
  const first = host.state.game!;
  expect(first.playerId).toBe(0);
  expect(first.state.hoardNode).toBeNull();
  expect(first.hasHoard).toBe(true);
  const act = (client: Client, revision: number, action: RoomAction) => client.request({ type: 'act', revision, action });
  expect(await act(firstGuest, first.revision, ['spinCompass'])).toEqual({ ok: false, error: 'It is not your turn.' });
  expect(await act(host, first.revision - 1, ['spinCompass'])).toMatchObject({ ok: false });
  expect(await act(host, first.revision, ['sail'] as unknown as RoomAction)).toEqual({ ok: false, error: 'Invalid game command.' });
  expect(await act(host, first.revision, ['useStrategy', 'navigate', 1.5])).toEqual({ ok: false, error: 'Invalid game command.' });
  expect(host.state.game?.revision).toBe(first.revision);

  firstGuest.socket.disconnect();
  const guest = await connect();
  expect(await guest.request({ type: 'resume', roomId: pass.roomId, token: joined.pass.token })).toEqual(joined);
  await vi.waitFor(() => expect(guest.state.game?.revision).toBe(first.revision));
  expect(guest.state.game?.playerId).toBe(1);
  expect(guest.state.game?.state).toEqual(first.state);

  const decisions = [0, 0];
  let revision = 0;
  for (let i = 0; i < 200; i++) {
    const ready = () => {
      const snap = host.state.game!;
      const { state } = snap;
      return snap.revision > revision && (state.phase === 'gameOver' ||
        (!state.players[state.currentPlayer].isAI && state.phase !== 'spinning' && state.phase !== 'moving'));
    };
    await vi.waitFor(() => expect(ready()).toBe(true), { interval: 5 });
    const { state, revision: latest } = host.state.game!;
    revision = latest;
    if (state.phase === 'gameOver') break;
    const id = state.currentPlayer;
    const client = id === 0 ? host : guest;
    expect(await act(client, revision, humanAction(state))).toEqual({ ok: true });
    decisions[id]++;
  }
  const final = host.state.game!;
  expect(final.state.phase).toBe('gameOver');
  expect(final.state.winner).not.toBeNull();
  expect(decisions.every((count) => count > 0)).toBe(true);
  await vi.waitFor(() => expect(guest.state.game?.revision).toBe(final.revision));
  expect(guest.state.game?.state).toEqual(final.state);
  expect(await act(guest, final.revision, ['spinCompass'])).toEqual({ ok: false, error: 'This voyage has ended.' });
}, 15000);
