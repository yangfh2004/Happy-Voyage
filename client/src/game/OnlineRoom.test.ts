import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { OnlineRoom } from './OnlineRoom';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());

it.each([
  { serverUrl: '', connected: false, requestTimeout: 4500 },
  { serverUrl: 'https://happy-voyage.onrender.com', connected: false, requestTimeout: 90_000 },
  { serverUrl: 'https://happy-voyage.onrender.com', connected: true, requestTimeout: 4500 },
])('configures room connections for "$serverUrl" (connected: $connected)', ({ serverUrl, connected, requestTimeout }) => {
  vi.stubEnv('VITE_SERVER_URL', serverUrl);
  const socket = { connected, on: vi.fn(), connect: vi.fn(), timeout: vi.fn().mockReturnValue({ emit: vi.fn() }) };
  vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);

  const room = new OnlineRoom(null, vi.fn(), vi.fn());
  room.create({ name: 'Helena', nation: 'Spain' }, { mode: 'sprint', difficulty: 'normal' });

  expect(io).toHaveBeenLastCalledWith(serverUrl || undefined, serverUrl
    ? { autoConnect: false, timeout: 90_000 }
    : { autoConnect: false });
  expect(socket.connect).toHaveBeenCalledTimes(connected ? 0 : 1);
  expect(socket.timeout).toHaveBeenCalledWith(requestTimeout);
});
