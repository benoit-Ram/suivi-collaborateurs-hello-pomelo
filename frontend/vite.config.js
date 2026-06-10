import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: en prod le service systemd `hp-frontend` lance `vite --host` (mode dev).
// On désactive l'overlay HMR pour que les erreurs serveur Vite (ex: requêtes bot
// avec URL malformée → "Invalid URL" dans viteServeStaticMiddleware) ne remontent
// pas en plein écran chez les 120 users.
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['rh.pomelo-dev.fr'],
    port: 3000,
    host: '0.0.0.0',
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
