/**
 * Vite-Konfiguration des Clients.
 * - DM-Modus (dev/build): /api wird zum lokalen Express-Server geproxied.
 * - Spieler-Modus (--mode player): kein Proxy nötig, die Daten liegen als
 *   statisches player-data.json im Build (siehe scripts/build-player.ts).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
