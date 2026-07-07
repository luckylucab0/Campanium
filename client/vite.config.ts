/**
 * Vite-Konfiguration des Clients.
 * - DM-Modus (dev/build): /api wird zum lokalen Express-Server geproxied.
 * - Spieler-Modus (--mode player): kein Proxy nötig, die Daten liegen als
 *   statisches player-data.json im Build (siehe scripts/build-player.ts).
 *
 * Erweiterungspunkt: das virtuelle Modul `campanium:erweiterung` wird per Alias
 * aufgelöst – standardmäßig auf den No-Op-Default (Self-Host); ein Overlay
 * (z. B. SaaS) setzt CAMPANIUM_CLIENT_EXT auf sein eigenes Modul.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const hier = path.dirname(fileURLToPath(import.meta.url));
const erweiterungModul = process.env.CAMPANIUM_CLIENT_EXT
  ? path.resolve(process.env.CAMPANIUM_CLIENT_EXT)
  : path.resolve(hier, 'src/erweiterung/leer.tsx');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'campanium:erweiterung': erweiterungModul,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
