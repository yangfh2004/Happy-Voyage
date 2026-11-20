import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset URLs relative so the build works on GitHub Pages
// (served from /Happy-Voyage/) as well as from the Express server.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true },
});
