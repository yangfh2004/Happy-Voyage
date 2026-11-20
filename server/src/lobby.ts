import { randomBytes, randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  GAME_MODES, MAX_ROOM_PLAYERS, MIN_ROOM_PLAYERS, NATIONS, ROOM_ID_PATTERN, navigatorForNation,
  type GameEvent, type RoomClientEvents, type RoomOptions, type RoomPass, type RoomPick, type RoomReply, type RoomServerEvents,
} from '@happy-voyage/shared';
import { object } from './roomActions';
import { RoomMatch, type RoomMatchOptions } from './roomMatch';

type RoomServer = Server<RoomClientEvents, RoomServerEvents>;
type RoomSocket = Socket<RoomClientEvents, RoomServerEvents>;

interface Seat extends RoomPick {
  id: string;
  token: string;
  socket?: RoomSocket;
  offlineSince: number;
}

interface Room {
  id: string;
  seats: Seat[];
  options: RoomOptions;
  match?: RoomMatch;
}

const MAX_ROOMS = 256;
const LOBBY_GRACE_MS = 30_000;
const IDLE_MATCH_MS = 60 * 60_000;

function readPick(input: unknown): RoomPick {
  const { name, nation } = object(input);
  const chosen = NATIONS.find((entry) => entry.name === nation);
  if (!chosen) throw new Error('Choose a valid nation.');
  if (typeof name !== 'string' || name.length > 16 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new Error('Use a navigator name of up to 16 characters.');
  }
  return { nation: chosen.name, name: name.trim() || navigatorForNation(chosen.name)!.name };
}

function readOptions(input: Record<string, unknown>): RoomOptions {
  const mode = GAME_MODES.find(({ id }) => id === input.mode)?.id;
  const { difficulty } = input;
  if (!mode || (difficulty !== 'easy' && difficulty !== 'normal' && difficulty !== 'hard')) throw new Error('Invalid voyage settings.');
  return { mode, difficulty };
}

export function registerLobby(io: RoomServer, timing?: RoomMatchOptions): () => void {
  const rooms = new Map<string, Room>();
  const bindings = new Map<string, { room: Room; seat: Seat }>();

  const publishLobby = (room: Room) => {
    const lobby = {
      id: room.id, ...room.options, host: room.seats[0]?.id ?? '', started: !!room.match, failed: room.match?.failed ?? false,
      seats: room.seats.map(({ id, name, nation, socket }) => ({ id, name, nation, connected: !!socket })),
    };
    for (const seat of room.seats) seat.socket?.emit('room:lobby', lobby);
  };

  const publishGame = (room: Room, events: GameEvent[], only?: Seat) => {
    const match = room.match!;
    const state = match.engine.state;
    room.seats.forEach((seat, playerId) => {
      if (!seat.socket || (only && seat !== only)) return;
      seat.socket.emit('room:game', {
        roomId: room.id, revision: match.revision, playerId, hasHoard: state.hoardNode !== null, events,
        state: {
          ...state,
          hoardNode: null,
          players: state.players.map((player) => player.id === playerId ? player : { ...player, knownHoard: null }),
        },
      });
    });
  };

  const join = (room: Room, pick: RoomPick): Seat => {
    if (room.match) throw new Error('This voyage has already started.');
    if (room.seats.length >= MAX_ROOM_PLAYERS) throw new Error('This room is full.');
    if (room.seats.some(({ nation }) => nation === pick.nation)) throw new Error('That nation is already taken.');
    const seat = { ...pick, id: randomUUID(), token: randomBytes(32).toString('hex'), offlineSince: 0 };
    room.seats.push(seat);
    return seat;
  };

  const bind = (room: Room, seat: Seat, socket: RoomSocket): RoomPass => {
    const previous = seat.socket;
    seat.socket = socket;
    bindings.set(socket.id, { room, seat });
    if (previous && previous !== socket) {
      bindings.delete(previous.id);
      previous.disconnect(true);
    }
    return { roomId: room.id, seatId: seat.id, token: seat.token };
  };

  const detach = (socket: RoomSocket, leave: boolean) => {
    const binding = bindings.get(socket.id);
    if (!binding) return;
    bindings.delete(socket.id);
    const { room, seat } = binding;
    seat.socket = undefined;
    seat.offlineSince = Date.now();
    if (leave && !room.match) room.seats = room.seats.filter((member) => member !== seat);
    if (!room.seats.length) rooms.delete(room.id);
    else publishLobby(room);
  };

  const findRoom = (id: unknown) => {
    const room = typeof id === 'string' && ROOM_ID_PATTERN.test(id) ? rooms.get(id) : undefined;
    if (!room) throw new Error('This room does not exist or has expired.');
    return room;
  };

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (!room.match) {
        const seats = room.seats.filter((seat) => seat.socket || now - seat.offlineSince < LOBBY_GRACE_MS);
        if (seats.length !== room.seats.length) {
          room.seats = seats;
          if (seats.length) publishLobby(room);
          else rooms.delete(room.id);
        }
      } else if (room.seats.every((seat) => !seat.socket && now - seat.offlineSince >= IDLE_MATCH_MS)) {
        room.match.dispose();
        rooms.delete(room.id);
      }
    }
  }, 5000);
  sweep.unref();

  io.on('connection', (socket) => {
    let windowStart = Date.now();
    let requests = 0;
    socket.on('room:request', (raw, reply: (result: RoomReply) => void) => {
      if (typeof reply !== 'function') return;
      if (Date.now() - windowStart >= 1000) {
        windowStart = Date.now();
        requests = 0;
      }
      if (++requests > 20) return reply({ ok: false, error: 'Too many requests. Try again in a moment.' });
      try {
        const request = object(raw);
        const binding = bindings.get(socket.id);
        if (request.type === 'create' || request.type === 'join' || request.type === 'resume') {
          if (binding && (request.type !== 'resume' || request.roomId !== binding.room.id || request.token !== binding.seat.token)) {
            throw new Error('Leave your current room first.');
          }
          let room: Room;
          let seat: Seat;
          if (request.type === 'create') {
            if (rooms.size >= MAX_ROOMS) throw new Error('The server has no room slots available. Try again later.');
            let id: string;
            do id = randomBytes(8).toString('hex'); while (rooms.has(id));
            room = { id, seats: [], options: readOptions(request) };
            seat = join(room, readPick(request.pick));
            rooms.set(id, room);
          } else {
            room = findRoom(request.roomId);
            if (request.type === 'resume') {
              const existing = room.seats.find(({ token }) => token === request.token);
              if (!existing) throw new Error('Your seat reservation has expired. Join again if the voyage has not started.');
              seat = existing;
            } else seat = join(room, readPick(request.pick));
          }
          reply({ ok: true, pass: bind(room, seat, socket) });
          publishLobby(room);
          if (room.match) publishGame(room, [], seat);
          return;
        }

        if (!binding) throw new Error('Join a room first.');
        const { room, seat } = binding;
        switch (request.type) {
          case 'leave':
            detach(socket, true);
            break;
          case 'start':
            if (seat !== room.seats[0]) throw new Error('Only the host can start the voyage.');
            if (room.match) throw new Error('This voyage has already started.');
            if (room.seats.length < MIN_ROOM_PLAYERS || room.seats.some((member) => !member.socket)) {
              throw new Error('At least two players must be connected, with no seats waiting to reconnect.');
            }
            room.match = new RoomMatch(room.seats, room.options, (events) => publishGame(room, events), () => publishLobby(room), timing);
            publishLobby(room);
            room.match.start();
            break;
          case 'act':
            if (!room.match) throw new Error('The voyage has not started.');
            room.match.act(room.seats.indexOf(seat), request.revision, request.action);
            break;
          default:
            throw new Error('Invalid room request.');
        }
        reply({ ok: true });
      } catch (error) {
        reply({ ok: false, error: error instanceof Error ? error.message : 'Room request failed.' });
      }
    });
    socket.on('disconnect', () => detach(socket, false));
  });

  return () => {
    clearInterval(sweep);
    for (const room of rooms.values()) room.match?.dispose();
  };
}
