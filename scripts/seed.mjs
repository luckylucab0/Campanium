/**
 * Seed-Skript: kopiert die fiktiven Beispieldaten aus data.example/ nach
 * data/, damit das Tool beim ersten Start lebendig aussieht.
 * Bricht ab, wenn data/ bereits existiert – echte Kampagnendaten werden
 * niemals überschrieben.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelle = path.join(wurzel, 'data.example');
const ziel = path.join(wurzel, 'data');

if (fs.existsSync(ziel)) {
  console.error('✗ data/ existiert bereits – nichts kopiert (Schutz vor Überschreiben).');
  console.error('  Zum Neu-Seeden zuerst data/ löschen oder umbenennen.');
  process.exit(1);
}

fs.cpSync(quelle, ziel, { recursive: true });
console.log('✓ Beispieldaten nach data/ kopiert. Los geht’s: npm run dev');
