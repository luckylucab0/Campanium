/**
 * Einstiegspunkt des lokalen DM-Servers.
 * Lädt die Daten aus data/ (überschreibbar via DATA_DIR) und startet die API
 * auf Port 3001 (überschreibbar via PORT). Der Vite-Dev-Server des Clients
 * proxied /api hierher.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erstelleApp } from './app';
import { Storage } from './storage';

const repoWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const datenOrdner = process.env.DATA_DIR ?? path.join(repoWurzel, 'data');
const port = Number(process.env.PORT ?? 3001);

const storage = new Storage(datenOrdner);
storage.laden();

const app = erstelleApp(storage);
app.listen(port, () => {
  console.log(`🦇 Ravenloft Companion – DM-Server läuft auf http://localhost:${port}`);
  console.log(`   Datenordner: ${datenOrdner} (${storage.alle().length} Entitäten geladen)`);
});
