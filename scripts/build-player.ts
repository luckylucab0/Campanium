// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Spieler-Build: erzeugt die statische, read-only Spieler-Version für
 * genau EINE Kampagne.
 *
 * Ablauf:
 *  1. Kampagne wählen: KAMPAGNE=<id> (Ordnername unter data/); gibt es nur
 *     eine Kampagne, wird sie automatisch genommen.
 *  2. Daten einlesen und gegen die Zod-Schemas validieren – kaputte
 *     Dateien brechen den Build ab.
 *  3. Spoiler-Filter anwenden (shared/playerFilter.ts, Whitelist-Prinzip).
 *  4. Paranoia-Prüfung: Das Ergebnis darf keine *Dm-Schlüssel, keine
 *     dmOnly-Entitäten und keine DM-only-Typen enthalten – sonst Abbruch.
 *  5. Gefilterte Daten nach client/public/player-data.json schreiben und
 *     den Client mit --mode player und relativem Base-Path bauen
 *     (GitHub-Pages-tauglich). Ergebnis: client/dist-player/.
 *
 * Aufruf:  npm run build:player            (eine Kampagne in data/)
 *          KAMPAGNE=nebelmark-kampagne npm run build:player
 *          DATA_DIR=data.example KAMPAGNE=nebelmark-kampagne npm run build:player
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_KAMPAGNENSTAND,
  ENTITY_TYPEN,
  filterFuerSpieler,
  findeVersteckteLinks,
  kampagneSchema,
  kampagnenstandSchema,
  validiereEntitaet,
  type Entitaet,
  type Kampagne,
  type Kampagnenstand,
} from '@campanium/shared';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datenWurzel = process.env.DATA_DIR ?? path.join(wurzel, 'data');

// ---- Schritt 1: Kampagne wählen --------------------------------------------

if (!fs.existsSync(datenWurzel)) {
  console.error(`✗ Datenordner nicht gefunden: ${datenWurzel}`);
  console.error('  Tipp: npm run seed kopiert die Beispieldaten nach data/.');
  process.exit(1);
}

const kampagnenIds = fs
  .readdirSync(datenWurzel, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(datenWurzel, e.name, 'kampagne.json')))
  .map((e) => e.name);

if (kampagnenIds.length === 0) {
  console.error(`✗ Keine Kampagne in ${datenWurzel} gefunden (kein Ordner mit kampagne.json).`);
  process.exit(1);
}

const gewaehlt = process.env.KAMPAGNE ?? (kampagnenIds.length === 1 ? kampagnenIds[0] : null);
if (!gewaehlt || !kampagnenIds.includes(gewaehlt)) {
  console.error(
    `✗ Mehrere Kampagnen gefunden – bitte eine wählen: KAMPAGNE=<id> npm run build:player`,
  );
  console.error(`  Verfügbar: ${kampagnenIds.join(', ')}`);
  process.exit(1);
}

const kampagnenOrdner = path.join(datenWurzel, gewaehlt);

// ---- Schritt 2: Daten laden & validieren ------------------------------------

const kampagne: Kampagne = kampagneSchema.parse(
  JSON.parse(fs.readFileSync(path.join(kampagnenOrdner, 'kampagne.json'), 'utf-8')),
);

const entitaeten: Entitaet[] = [];
for (const typ of ENTITY_TYPEN) {
  const ordner = path.join(kampagnenOrdner, typ);
  if (!fs.existsSync(ordner)) continue;
  for (const datei of fs.readdirSync(ordner).filter((d) => d.endsWith('.json'))) {
    const voll = path.join(ordner, datei);
    // Bewusst KEIN try/catch: ungültige Daten sollen den Spieler-Build
    // stoppen, statt eventuell Unerwartetes zu veröffentlichen.
    entitaeten.push(validiereEntitaet(typ, JSON.parse(fs.readFileSync(voll, 'utf-8'))));
  }
}

const standDatei = path.join(kampagnenOrdner, 'kampagnenstand.json');
const kampagnenstand: Kampagnenstand = fs.existsSync(standDatei)
  ? kampagnenstandSchema.parse(JSON.parse(fs.readFileSync(standDatei, 'utf-8')))
  : DEFAULT_KAMPAGNENSTAND;

console.log(`→ Kampagne „${kampagne.name}“: ${entitaeten.length} Entitäten geladen`);

// ---- Schritt 3: Spoiler-Filter -----------------------------------------------

const spielerDaten = filterFuerSpieler(kampagne, entitaeten, kampagnenstand);
console.log(`→ ${spielerDaten.entitaeten.length} Entitäten sind spielersicher`);

// ---- Schritt 4: Paranoia-Prüfung ---------------------------------------------

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
// Regel 9: kein [[Wikilink]] darf den Namen einer nicht exportierten Entität
// verraten (Freitextfelder umgehen sonst die ID-Bereinigung).
const geleakteLinks = findeVersteckteLinks(spielerDaten);
if (geleakteLinks.length > 0) {
  console.error(
    `✗ ABBRUCH: Wikilinks auf versteckte Entitäten im Spieler-Export: ${geleakteLinks.join(', ')}`,
  );
  process.exit(1);
}
console.log('→ Paranoia-Prüfung bestanden: keine DM-Inhalte im Export');

// ---- Schritt 5: Schreiben & Client bauen -------------------------------------

const zielJson = path.join(wurzel, 'client', 'public', 'player-data.json');
fs.mkdirSync(path.dirname(zielJson), { recursive: true });
fs.writeFileSync(zielJson, json + '\n');

// Bilder: NUR die Dateien exportierter Entitäten in den Build kopieren.
// Der Zielordner wird vorher geleert, damit keine Altlasten (z. B. Bilder
// inzwischen DM-only gestellter Entitäten) veröffentlicht werden.
const bilderZiel = path.join(wurzel, 'client', 'public', 'bilder');
fs.rmSync(bilderZiel, { recursive: true, force: true });
const bilderQuelle = path.join(kampagnenOrdner, 'bilder');
const exportierteBilder = spielerDaten.entitaeten
  .map((e) => e.bild)
  .filter((b): b is string => typeof b === 'string' && b.length > 0);
if (exportierteBilder.length > 0) {
  fs.mkdirSync(bilderZiel, { recursive: true });
  for (const datei of exportierteBilder) {
    // Der Spieler-Build ist ein VERÖFFENTLICHTES Artefakt: nur einfache
    // Dateinamen zulassen, damit ein manipuliertes bild-Feld (z. B. „../x")
    // nicht aus bilder/ ausbrechen kann.
    if (datei !== path.basename(datei) || datei.includes('..')) {
      console.error(`⚠ Unsicherer Bild-Dateiname übersprungen: ${datei}`);
      continue;
    }
    const quelle = path.join(bilderQuelle, datei);
    if (!fs.existsSync(quelle)) {
      console.error(`⚠ Bild fehlt und wird übersprungen: ${quelle}`);
      continue;
    }
    fs.copyFileSync(quelle, path.join(bilderZiel, datei));
  }
  console.log(`→ ${exportierteBilder.length} Bild(er) in den Spieler-Build kopiert`);
}

console.log('→ Baue statischen Spieler-Client …');
execSync('npx vite build --mode player --base ./ --outDir dist-player', {
  cwd: path.join(wurzel, 'client'),
  stdio: 'inherit',
});

console.log('');
console.log(`✓ Spieler-Build fertig: client/dist-player/ (Kampagne „${kampagne.name}“)`);
console.log('  Lokal testen:  npx vite preview --outDir dist-player  (im Ordner client/)');
console.log('  Deploy: Inhalt von client/dist-player/ auf GitHub Pages veröffentlichen.');
