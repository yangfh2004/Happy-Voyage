import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset URLs relative so the build works on GitHub Pages
// (served from /Happy-Voyage/) as well as from the Express server.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: mode === 'debug' ? {
    outDir: 'dist-debug',
    rollupOptions: { input: fileURLToPath(new URL('./debug.html', import.meta.url)) },
  } : undefined,
  server: {
    port: 5173,
    host: true,
    proxy: { '/socket.io': { target: 'http://127.0.0.1:3000', ws: true } },
  },
}));
