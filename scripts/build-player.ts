/**
 * Spieler-Build: erzeugt die statische, read-only Spieler-Version.
 *
 * Ablauf:
 *  1. data/ einlesen (Entitäten + Kampagnenstand), gegen die Zod-Schemas
 *     validieren – kaputte Dateien brechen den Build ab.
 *  2. Spoiler-Filter anwenden (shared/playerFilter.ts, Whitelist-Prinzip).
 *  3. Paranoia-Prüfung: Das Ergebnis darf keine *Dm-Schlüssel, keine
 *     dmOnly-Entitäten und keine DM-only-Typen enthalten – sonst Abbruch.
 *  4. Gefilterte Daten nach client/public/player-data.json schreiben und
 *     den Client mit --mode player und relativem Base-Path bauen
 *     (GitHub-Pages-tauglich). Ergebnis: client/dist-player/.
 *
 * Aufruf:  npm run build:player   (Datenordner via DATA_DIR überschreibbar)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENTITY_TYPEN,
  filterFuerSpieler,
  kampagnenstandSchema,
  DEFAULT_KAMPAGNENSTAND,
  validiereEntitaet,
  type Entitaet,
  type Kampagnenstand,
} from '@ravenloft/shared';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datenOrdner = process.env.DATA_DIR ?? path.join(wurzel, 'data');

// ---- Schritt 1: Daten laden & validieren ----------------------------------

if (!fs.existsSync(datenOrdner)) {
  console.error(`✗ Datenordner nicht gefunden: ${datenOrdner}`);
  console.error('  Tipp: npm run seed kopiert die Beispieldaten nach data/.');
  process.exit(1);
}

const entitaeten: Entitaet[] = [];
for (const typ of ENTITY_TYPEN) {
  const ordner = path.join(datenOrdner, typ);
  if (!fs.existsSync(ordner)) continue;
  for (const datei of fs.readdirSync(ordner).filter((d) => d.endsWith('.json'))) {
    const voll = path.join(ordner, datei);
    // Bewusst KEIN try/catch: ungültige Daten sollen den Spieler-Build
    // stoppen, statt eventuell Unerwartetes zu veröffentlichen.
    entitaeten.push(validiereEntitaet(typ, JSON.parse(fs.readFileSync(voll, 'utf-8'))));
  }
}

const standDatei = path.join(datenOrdner, 'kampagnenstand.json');
const kampagnenstand: Kampagnenstand = fs.existsSync(standDatei)
  ? kampagnenstandSchema.parse(JSON.parse(fs.readFileSync(standDatei, 'utf-8')))
  : DEFAULT_KAMPAGNENSTAND;

console.log(`→ ${entitaeten.length} Entitäten geladen aus ${datenOrdner}`);

// ---- Schritt 2: Spoiler-Filter ---------------------------------------------

const spielerDaten = filterFuerSpieler(entitaeten, kampagnenstand);
console.log(`→ ${spielerDaten.entitaeten.length} Entitäten sind spielersicher`);

// ---- Schritt 3: Paranoia-Prüfung -------------------------------------------

const json = JSON.stringify(spielerDaten, null, 2);
const dmSchluessel = json.match(/"[a-zA-Z]+Dm"\s*:/g);
if (dmSchluessel) {
  console.error(`✗ ABBRUCH: DM-Felder im Spieler-Export gefunden: ${dmSchluessel.join(', ')}`);
  process.exit(1);
}
if (spielerDaten.entitaeten.some((e) => e.dmOnly || e.typ === 'sessionPrep')) {
  console.error('✗ ABBRUCH: dmOnly-Entität oder Session-Prep im Spieler-Export.');
  process.exit(1);
}
console.log('→ Paranoia-Prüfung bestanden: keine DM-Inhalte im Export');

// ---- Schritt 4: Schreiben & Client bauen -----------------------------------

const zielJson = path.join(wurzel, 'client', 'public', 'player-data.json');
fs.mkdirSync(path.dirname(zielJson), { recursive: true });
fs.writeFileSync(zielJson, json + '\n');

console.log('→ Baue statischen Spieler-Client …');
execSync('npx vite build --mode player --base ./ --outDir dist-player', {
  cwd: path.join(wurzel, 'client'),
  stdio: 'inherit',
});

console.log('');
console.log('✓ Spieler-Build fertig: client/dist-player/');
console.log('  Lokal testen:  npx vite preview --outDir dist-player  (im Ordner client/)');
console.log('  Deploy: Inhalt von client/dist-player/ auf GitHub Pages veröffentlichen.');
