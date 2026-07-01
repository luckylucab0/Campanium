/**
 * Einstiegspunkt des lokalen DM-Servers.
 * Lädt alle Kampagnen aus data/ (überschreibbar via DATA_DIR) und startet
 * die API auf Port 3001 (überschreibbar via PORT). Der Vite-Dev-Server des
 * Clients proxied /api hierher.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erstelleApp } from './app';
import { KampagnenVerwaltung } from './storage';

const repoWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const datenOrdner = process.env.DATA_DIR ?? path.join(repoWurzel, 'data');
const port = Number(process.env.PORT ?? 3001);

const verwaltung = new KampagnenVerwaltung(datenOrdner);
verwaltung.laden();

const app = erstelleApp(verwaltung);
app.listen(port, () => {
  const kampagnen = verwaltung.liste();
  console.log(`🦇 Grimoire – DM-Server läuft auf http://localhost:${port}`);
  console.log(
    `   Datenordner: ${datenOrdner} (${kampagnen.length} Kampagne(n): ${
      kampagnen.map((k) => k.name).join(', ') || '–'
    })`,
  );
});
