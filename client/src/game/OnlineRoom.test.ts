import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { OnlineRoom, roomInviteLink, roomLink } from './OnlineRoom';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllGlobals());

it('shares the normal game URL from the desktop tester without dropping its preview from browser history', () => {
  const demo = 'https://raw.githack.com/yangfh2004/Happy-Voyage/demo';
  vi.stubGlobal('window', { location: { href: `${demo}/debug/debug.html?preview=landing` } });
  expect(roomInviteLink('test-room').href).toBe(`${demo}/index.html?room=test-room`);
  expect(roomLink('test-room').href).toBe(`${demo}/debug/debug.html?preview=landing&room=test-room`);
});

it('keeps the deployed path and unrelated parameters for ordinary web invites', () => {
  vi.stubGlobal('window', { location: { href: 'https://example.com/Happy-Voyage/?theme=sea' } });
  expect(roomInviteLink('test-room').href).toBe('https://example.com/Happy-Voyage/?theme=sea&room=test-room');
});

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
