import { io, type Socket } from 'socket.io-client';
import type {
  RoomAction, RoomClientEvents, RoomLobby, RoomOptions, RoomPass, RoomPick, RoomReply, RoomRequest, RoomServerEvents, RoomSnapshot,
} from '@happy-voyage/shared';

export const ROOM_QUERY = 'room';
const storageKey = (id: string) => `happy-voyage-room:${id}`;
export const OFFLINE = 'Could not reach the room server. The static demo supports local play only.';

export function roomLink(roomId: string | null): URL {
  const url = new URL(window.location.href);
  if (roomId) url.searchParams.set(ROOM_QUERY, roomId);
  else url.searchParams.delete(ROOM_QUERY);
  return url;
}

function savePass(roomId: string, token: string | null): void {
  try {
    if (token) sessionStorage.setItem(storageKey(roomId), token);
    else sessionStorage.removeItem(storageKey(roomId));
  } catch {}
}

export class OnlineRoom {
  private readonly socket: Socket<RoomServerEvents, RoomClientEvents> = io({ autoConnect: false });
  private token: string | null = null;
  private closed = false;
  pass: RoomPass | null = null;
  lobby: RoomLobby | null = null;
  snapshot: RoomSnapshot | null = null;
  busy = false;
  ready = false;
  error: string | null = null;

  constructor(
    readonly invite: string | null,
    private readonly changed: () => void,
    private readonly gameUpdated: (snapshot: RoomSnapshot) => void,
  ) {
    if (invite) {
      try { this.token = sessionStorage.getItem(storageKey(invite)); } catch {}
    }
    this.socket.on('connect', () => {
      const roomId = this.pass?.roomId ?? this.invite;
      if (!this.busy && this.token && roomId) this.request({ type: 'resume', roomId, token: this.token });
    });
    this.socket.on('disconnect', (reason) => {
      this.ready = false;
      if (reason === 'io server disconnect') this.error = 'This seat was opened in another browser. Reopen the invite to return.';
      this.changed();
    });
    this.socket.on('room:lobby', (lobby) => {
      if (lobby.id !== this.pass?.roomId) return;
      this.lobby = lobby;
      this.changed();
    });
    this.socket.on('room:game', (snapshot) => {
      if (snapshot.roomId !== this.pass?.roomId) return;
      if (this.snapshot && snapshot.revision <= this.snapshot.revision) return;
      this.snapshot = snapshot;
      this.gameUpdated(snapshot);
    });
  }

  reconnect(): void {
    if (this.token && this.invite) this.request({ type: 'resume', roomId: this.invite, token: this.token });
  }

  create(pick: RoomPick, options: RoomOptions): void {
    void this.request({ type: 'create', pick, ...options });
  }

  join(pick: RoomPick): void {
    if (this.invite) void this.request({ type: 'join', roomId: this.invite, pick });
  }

  start(): void {
    if (this.ready) void this.request({ type: 'start' });
  }

  act(action: RoomAction): void {
    if (this.ready && this.snapshot && !this.lobby?.failed) {
      void this.request({ type: 'act', revision: this.snapshot.revision, action });
    }
  }

  close(): void {
    this.closed = true;
    if (this.pass && !this.lobby?.started) savePass(this.pass.roomId, null);
    if (this.ready && !this.lobby?.started) {
      this.socket.timeout(750).emit('room:request', { type: 'leave' }, () => this.socket.disconnect());
    } else this.socket.disconnect();
  }

  private request(request: RoomRequest): void {
    if (this.busy || this.closed) return;
    this.busy = true;
    this.error = null;
    this.changed();
    if (!this.socket.connected) this.socket.connect();
    // Use the ordered ack callback: the server sends the pass before broadcasting lobby/game state.
    this.socket.timeout(4500).emit('room:request', request, (err: Error | null, reply?: RoomReply) => {
      if (this.closed) return;
      this.busy = false;
      if (err || !reply) {
        this.error = this.socket.connected ? 'The room did not respond. Try again.' : this.pass ? 'Room connection lost.' : OFFLINE;
        if (!this.pass) this.socket.disconnect();
      } else if (!reply.ok) {
        this.error = reply.error;
        if (request.type === 'resume') {
          this.token = null;
          savePass(request.roomId, null);
        }
      } else if (reply.pass) {
        this.pass = reply.pass;
        this.token = reply.pass.token;
        this.ready = true;
        savePass(reply.pass.roomId, reply.pass.token);
        window.history.replaceState(null, '', roomLink(reply.pass.roomId));
      }
      this.changed();
    });
  }
}
