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
 *  2. Session-Preps sowie die Spezialmodule (Strahd-Tracker, Tarokka)
 *     werden nie exportiert.
 *  3. Orte erscheinen nur, wenn `besucht: true`.
 *  4. NSCs erscheinen nur, wenn die Party sie nachweislich getroffen hat:
 *     `status !== 'unbekannt'` UND mindestens ein Kampagnen-Log-Eintrag.
 *  5. Gegenstände erscheinen nur, wenn `gefunden: true`.
 *  6. Pro Entität werden nur die unten gelisteten Felder übernommen.
 *  7. Verknüpfungen (z. B. `ortId`) auf nicht exportierte Entitäten werden
 *     auf null gesetzt, damit der Spieler-Build keine toten IDs enthält,
 *     deren Slug bereits Namen verraten könnte.
 */
import type { Entitaet, EntityTyp, Kampagnenstand } from './types';

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
  notiz: ['inhalt'],
};

/** Spielersichere Felder des Kampagnenstands (bewusst ohne Strahd-Interna). */
const KAMPAGNENSTAND_WHITELIST = ['partyLevel', 'ingameTag', 'ingameDatumText'] as const;

/** Gefilterter Kampagnenstand für Spieler. */
export type PlayerKampagnenstand = Pick<
  Kampagnenstand,
  (typeof KAMPAGNENSTAND_WHITELIST)[number]
>;

/** Das komplette Datenpaket des Spieler-Builds. */
export interface PlayerDaten {
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
 * Wendet alle Regeln an und liefert das spielersichere Datenpaket.
 * Das ist die einzige Funktion, die der Spieler-Build (scripts/build-player.ts)
 * zum Filtern verwendet – Single Source of Truth.
 */
export function filterFuerSpieler(
  entitaeten: readonly Entitaet[],
  kampagnenstand: Kampagnenstand,
): PlayerDaten {
  const sichtbar = entitaeten.filter(istSpielerSichtbar);
  const ids = new Set(sichtbar.map((e) => e.id));
  const gefiltert = sichtbar.map((e) => bereinigeRefs(filtereFelder(e), ids));

  const standGefiltert: Record<string, unknown> = {};
  for (const key of KAMPAGNENSTAND_WHITELIST) {
    standGefiltert[key] = kampagnenstand[key];
  }

  return {
    entitaeten: gefiltert,
    kampagnenstand: standGefiltert as unknown as PlayerKampagnenstand,
  };
}
