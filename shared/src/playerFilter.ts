/**
 * Spoiler-Filter für den Spieler-Build.
 *
 * SICHERHEITSPRINZIP: WHITELIST STATT BLACKLIST.
 * Es wird ausschließlich exportiert, was hier explizit als spielersicher
 * deklariert ist. Neue Felder sind damit automatisch DM-only, bis sie
 * bewusst freigegeben werden. Tests in playerFilter.test.ts belegen,
 * dass kein DM-Feld den Filter passiert.
 *
 * Sichtbarkeitsregeln (dokumentiert, siehe auch README):
 *  1. Entitäten mit `dmOnly: true` werden komplett entfernt.
 *  2. Session-Preps sowie die Spezialmodule (Widersacher-Tracker, Lesung)
 *     werden nie exportiert.
 *  3. Orte erscheinen nur, wenn `besucht: true`.
 *  4. NSCs erscheinen nur, wenn die Party sie nachweislich getroffen hat:
 *     `status !== 'unbekannt'` UND mindestens ein Kampagnen-Log-Eintrag.
 *  5. Gegenstände erscheinen nur, wenn `gefunden: true`.
 *  6. Pro Entität werden nur die unten gelisteten Felder übernommen.
 *  7. Verknüpfungen (z. B. `ortId`) auf nicht exportierte Entitäten werden
 *     auf null gesetzt, damit der Spieler-Build keine toten IDs enthält,
 *     deren Slug bereits Namen verraten könnte.
 *  8. Karten-Pins überleben nur, wenn ihr verknüpfter Ort exportiert ist;
 *     freie Marker und DM-Beschriftungen werden entfernt.
 */
import type { Entitaet, EntityTyp, Kampagne, Kampagnenstand } from './types';

/** Basisfelder, die für jede exportierte Entität spielersicher sind. */
const BASIS_WHITELIST = [
  'id',
  'typ',
  'name',
  'erstellt',
  'geaendert',
  'tags',
  'dmOnly',
  'kampagnenLog',
  // Nur der Dateiname; die Bilddatei selbst kopiert build-player.ts
  // ausschließlich für exportierte Entitäten in den Spieler-Build.
  'bild',
] as const;

/**
 * Spielersichere Felder pro Typ (zusätzlich zur Basis).
 * sessionPrep hat bewusst KEINEN Eintrag: Der Typ wird nie exportiert.
 */
const FELD_WHITELIST: Partial<Record<EntityTyp, readonly string[]>> = {
  nsc: ['status', 'haltung', 'ortId', 'fraktionId', 'wer', 'will', 'beschreibung', 'beziehungen'],
  quest: ['status', 'questgeberId', 'ortId', 'auftrag', 'belohnung', 'fortschritt'],
  ort: ['region', 'besucht', 'empfohlenesLevel', 'was', 'stimmung', 'bereiche', 'bewohner'],
  sc: [
    'spieler',
    'klasseVolk',
    'level',
    'status',
    'ac',
    'hp',
    'passiveWahrnehmung',
    'ziele',
    'beziehungen',
    'besonderes',
  ],
  session: [
    'nummer',
    'datum',
    'ingameDatum',
    'zusammenfassung',
    'ereignisse',
    'nscsGetroffen',
    'gegenstaende',
    'offeneFaeden',
  ],
  gegenstand: ['gefunden', 'besitzerId', 'fundortId', 'eigenschaften', 'geschichte'],
  fraktion: ['haltung', 'ziele', 'mitglieder', 'stand'],
  // Pins werden zusätzlich in bereinigePins() gefiltert (nur besuchte Orte).
  karte: ['beschreibung', 'pins'],
  notiz: ['inhalt'],
};

/** Spielersichere Felder des Kampagnenstands (bewusst ohne Eskalations-Interna). */
const KAMPAGNENSTAND_WHITELIST = ['partyLevel', 'ingameTag', 'ingameDatumText'] as const;

/** Spielersichere Felder des Kampagnen-Manifests (bewusst ohne interne IDs/Daten). */
const KAMPAGNE_WHITELIST = ['name', 'beschreibung'] as const;

/** Gefilterter Kampagnenstand für Spieler. */
export type PlayerKampagnenstand = Pick<Kampagnenstand, (typeof KAMPAGNENSTAND_WHITELIST)[number]>;

/** Gefilterte Kampagnen-Metadaten für Spieler. */
export type PlayerKampagne = Pick<Kampagne, (typeof KAMPAGNE_WHITELIST)[number]>;

/** Das komplette Datenpaket des Spieler-Builds (immer genau EINE Kampagne). */
export interface PlayerDaten {
  kampagne: PlayerKampagne;
  entitaeten: Entitaet[];
  kampagnenstand: PlayerKampagnenstand;
}

/** Regel 3–5: Ist die Entität für Spieler grundsätzlich sichtbar? */
export function istSpielerSichtbar(e: Entitaet): boolean {
  if (e.dmOnly) return false;
  if (!(e.typ in FELD_WHITELIST)) return false; // z. B. sessionPrep
  if (e.typ === 'ort' && !e.besucht) return false;
  if (e.typ === 'nsc' && (e.status === 'unbekannt' || e.kampagnenLog.length === 0)) return false;
  if (e.typ === 'gegenstand' && !e.gefunden) return false;
  return true;
}

/** Kopiert nur die gewhitelisteten Felder einer Entität (Regel 6). */
function filtereFelder(e: Entitaet): Entitaet {
  const erlaubt = new Set<string>([...BASIS_WHITELIST, ...(FELD_WHITELIST[e.typ] ?? [])]);
  const ergebnis: Record<string, unknown> = {};
  for (const [key, wert] of Object.entries(e)) {
    if (erlaubt.has(key)) ergebnis[key] = wert;
  }
  return ergebnis as unknown as Entitaet;
}

/** Setzt Verknüpfungs-IDs auf nicht exportierte Entitäten auf null (Regel 7). */
function bereinigeRefs(e: Entitaet, exportierteIds: ReadonlySet<string>): Entitaet {
  const kopie: Record<string, unknown> = { ...e };
  for (const [key, wert] of Object.entries(kopie)) {
    if (key.endsWith('Id') && typeof wert === 'string' && !exportierteIds.has(wert)) {
      kopie[key] = null;
    }
  }
  return kopie as unknown as Entitaet;
}

/**
 * Karten-Pins: Es überleben nur Pins, deren Ort selbst exportiert (= besucht)
 * ist – Position und Beschriftung unentdeckter Orte sind Spoiler. Die
 * Beschriftung wird geleert (DM-Freitext); die Spieler-UI zeigt den Ortsnamen.
 */
function bereinigePins(e: Entitaet, exportierteIds: ReadonlySet<string>): Entitaet {
  if (e.typ !== 'karte') return e;
  return {
    ...e,
    pins: e.pins
      .filter((pin) => pin.ortId !== null && exportierteIds.has(pin.ortId))
      .map((pin) => ({ ...pin, beschriftung: '' })),
  };
}

/**
 * Wendet alle Regeln an und liefert das spielersichere Datenpaket.
 * Das ist die einzige Funktion, die der Spieler-Build (scripts/build-player.ts)
 * zum Filtern verwendet – Single Source of Truth.
 */
export function filterFuerSpieler(
  kampagne: Kampagne,
  entitaeten: readonly Entitaet[],
  kampagnenstand: Kampagnenstand,
): PlayerDaten {
  const sichtbar = entitaeten.filter(istSpielerSichtbar);
  const ids = new Set(sichtbar.map((e) => e.id));
  const gefiltert = sichtbar.map((e) => bereinigePins(bereinigeRefs(filtereFelder(e), ids), ids));

  const standGefiltert: Record<string, unknown> = {};
  for (const key of KAMPAGNENSTAND_WHITELIST) {
    standGefiltert[key] = kampagnenstand[key];
  }

  const kampagneGefiltert: Record<string, unknown> = {};
  for (const key of KAMPAGNE_WHITELIST) {
    kampagneGefiltert[key] = kampagne[key];
  }

  return {
    kampagne: kampagneGefiltert as unknown as PlayerKampagne,
    entitaeten: gefiltert,
    kampagnenstand: standGefiltert as unknown as PlayerKampagnenstand,
  };
}
