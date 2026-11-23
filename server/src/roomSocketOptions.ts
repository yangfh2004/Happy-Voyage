import type { ServerOptions } from 'socket.io';

const demoOrigins = new Set(['https://raw.githack.com', 'https://rawcdn.githack.com']);
const loopbackOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
const allowedCrossOrigin = (origin: string) => demoOrigins.has(origin) || loopbackOrigin.test(origin);

export const roomSocketOptions: Partial<ServerOptions> = {
  maxHttpBufferSize: 8 * 1024,
  cors: {
    origin: (origin, done) => done(null, !!origin && allowedCrossOrigin(origin)),
  },
  allowRequest: (req, done) => {
    const { origin, host } = req.headers;
    try {
      done(null, !origin || allowedCrossOrigin(origin) || new URL(origin).host === host);
    } catch {
      done(null, false);
    }
  },
};
