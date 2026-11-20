import type { Server } from 'socket.io';

/**
 * Multiplayer skeleton. Clients join a named room and see who else is there.
 * Next step: create a GameEngine per room, accept 'roll' / 'claim' messages
 * from the current player only, and broadcast engine events to the room.
 */
export function registerLobby(io: Server): void {
  io.on('connection', (socket) => {
    socket.on('lobby:join', (room: string, name: string) => {
      socket.join(room);
      socket.data.name = name;
      io.to(room).emit('lobby:joined', { id: socket.id, name });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) io.to(room).emit('lobby:left', { id: socket.id });
      }
    });
  });
}
