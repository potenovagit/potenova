import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server for the Potenova web app.
 *
 * The browser calls the API same-origin under `/api/*`; Vite proxies that to the
 * local API host (default http://localhost:8080) and strips the prefix. This keeps
 * the browser free of CORS concerns in dev and matches a same-origin gateway in prod.
 */
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
