/**
 * Zentrale Typdefinitionen für alle Entitäten der Kampagne.
 *
 * Namenskonvention für Spoiler-Trennung:
 *   Felder, deren Name auf "Dm" endet (z. B. `geheimnisseDm`) oder die in
 *   `playerFilter.ts` nicht auf der Whitelist stehen, sind ausschließlich
 *   für den DM sichtbar und werden im Spieler-Build entfernt.
 */

/** Alle bekannten Entitätstypen (Sammlungs-Entitäten, keine Singletons). */
export const ENTITY_TYPEN = [
  'nsc',
  'quest',
  'ort',
  'sc',
  'session',
  'sessionPrep',
  'gegenstand',
  'fraktion',
  'karte',
  'notiz',
] as const;

export type EntityTyp = (typeof ENTITY_TYPEN)[number];

/** Eintrag im Kampagnen-Log einer Entität: Was ist in welcher Session damit passiert? */
export interface KampagnenLogEintrag {
  sessionNr: number;
  text: string;
}

/** Checklisten-Eintrag (Quest-Fortschritt, Strahd-Ideen-Vorrat, …). */
export interface ChecklistEintrag {
  text: string;
  erledigt: boolean;
}

/** Basisfelder, die jede Entität besitzt. */
export interface BasisEntitaet {
  id: string;
  typ: EntityTyp;
  name: string;
  /** ISO-Zeitstempel */
  erstellt: string;
  /** ISO-Zeitstempel */
  geaendert: string;
  tags: string[];
  /** true = gesamte Entität ist nur für den DM sichtbar. */
  dmOnly: boolean;
  kampagnenLog: KampagnenLogEintrag[];
  /**
   * Optionales Bild (Portrait, Artwork, Kartengrafik): Dateiname im
   * bilder/-Ordner der Kampagne. null = kein Bild.
   */
  bild: string | null;
}

export const HALTUNGEN = [
  'verbündet',
  'freundlich',
  'neutral',
  'misstrauisch',
  'feindlich',
  'unbekannt',
] as const;
export type Haltung = (typeof HALTUNGEN)[number];

export const NSC_STATUS = ['lebendig', 'tot', 'untot', 'unbekannt'] as const;
export type NscStatus = (typeof NSC_STATUS)[number];

/** Nichtspielercharakter. */
export interface Nsc extends BasisEntitaet {
  typ: 'nsc';
  status: NscStatus;
  haltung: Haltung;
  /** Verknüpfung auf einen Ort (Entitäts-ID). */
  ortId: string | null;
  /** Verknüpfung auf eine Fraktion (Entitäts-ID). */
  fraktionId: string | null;
  /** Seitenreferenz im Abenteuerband – DM-only. */
  buchSeiteDm: string;
  /** „Auf einen Blick": Wer ist das? (eine Zeile) */
  wer: string;
  /** „Auf einen Blick": Was will er/sie? (Motivation) */
  will: string;
  /** Referenz auf den Statblock (z. B. Buch + Seite) – DM-only. */
  statblockRefDm: string;
  /** Abschnitt: Beschreibung & Auftreten (Markdown). */
  beschreibung: string;
  /** Abschnitt: Was er/sie weiß oder verbirgt – DM-only (Markdown). */
  weissVerbirgtDm: string;
  /** Abschnitt: Beziehungen zu NSCs/SCs (Markdown mit [[Wikilinks]]). */
  beziehungen: string;
}

export const QUEST_STATUS = ['offen', 'aktiv', 'erledigt', 'fehlgeschlagen'] as const;
export type QuestStatus = (typeof QUEST_STATUS)[number];

/** Quest / Auftrag. */
export interface Quest extends BasisEntitaet {
  typ: 'quest';
  status: QuestStatus;
  questgeberId: string | null;
  ortId: string | null;
  buchSeiteDm: string;
  /** Eine Zeile, spielersichtbar: Worum geht es? */
  auftrag: string;
  /** Abschnitt: Hintergrund – DM-only (Markdown). */
  hintergrundDm: string;
  /** Abschnitt: Mögliche Ausgänge (Erfolg/Scheitern) – DM-only (Markdown). */
  ausgaengeDm: string;
  /** Abschnitt: Belohnung (Markdown). */
  belohnung: string;
  /** Fortschritts-Checkliste. */
  fortschritt: ChecklistEintrag[];
}

/** Ort / Schauplatz. */
export interface Ort extends BasisEntitaet {
  typ: 'ort';
  /** Region/Gebiet als Freitext – jede Kampagne hat ihre eigenen Regionen. */
  region: string;
  besucht: boolean;
  empfohlenesLevel: string;
  buchSeiteDm: string;
  /** „Auf einen Blick": Was ist das? */
  was: string;
  /** „Auf einen Blick": Stimmung / Sinneseindrücke fürs Erzählen. */
  stimmung: string;
  /** Abschnitt: Wichtige Bereiche (Markdown). */
  bereiche: string;
  /** Abschnitt: Bewohner (Markdown mit [[Wikilinks]]). */
  bewohner: string;
  /** Abschnitt: Geheimnisse & Gefahren – DM-only (Markdown). */
  geheimnisseDm: string;
}

export const SC_STATUS = ['aktiv', 'inaktiv', 'tot'] as const;
export type ScStatus = (typeof SC_STATUS)[number];

/** Spielercharakter. */
export interface Sc extends BasisEntitaet {
  typ: 'sc';
  spieler: string;
  klasseVolk: string;
  level: number;
  status: ScStatus;
  ac: number;
  hp: number;
  passiveWahrnehmung: number;
  /** Abschnitt: Ziele & Motivation (Markdown). */
  ziele: string;
  /** Abschnitt: Bindungen & Schwächen / DM-Hooks – DM-only (Markdown). */
  hooksDm: string;
  /** Abschnitt: Beziehungen zu NSCs (Markdown). */
  beziehungen: string;
  /** Abschnitt: Dunkle Gaben / Flüche / Besonderes (Markdown). */
  besonderes: string;
}

/** Session-Protokoll. `name` dient als Titel der Session. */
export interface Session extends BasisEntitaet {
  typ: 'session';
  nummer: number;
  /** Reales Datum (ISO yyyy-mm-dd). */
  datum: string;
  /** In-Game-Datum (Freitext, Kalender der Spielwelt). */
  ingameDatum: string;
  /** Abschnitt: Zusammenfassung (Markdown). */
  zusammenfassung: string;
  /** Abschnitt: Wichtige Ereignisse (Markdown). */
  ereignisse: string;
  /** Abschnitt: NSCs getroffen (Markdown mit [[Wikilinks]]). */
  nscsGetroffen: string;
  /** Abschnitt: Erhaltene Gegenstände / Hinweise (Markdown). */
  gegenstaende: string;
  /** Abschnitt: Offene Fäden für nächstes Mal (Markdown). */
  offeneFaeden: string;
  /** Abschnitt: Notizen / Loot / XP – DM-only (Markdown). */
  notizenDm: string;
}

/** Session-Planung. Komplett DM-only (dmOnly ist immer true). */
export interface SessionPrep extends BasisEntitaet {
  typ: 'sessionPrep';
  /** Nummer der geplanten Session (verknüpft Prep ↔ Protokoll). */
  sessionNummer: number;
  /** Abschnitt: Ziele des Abends (Markdown). */
  zieleDm: string;
  /** Abschnitt: Geplante Szenen (Markdown). */
  szenenDm: string;
  /** Abschnitt: Benötigte NSCs/Orte (Markdown mit [[Wikilinks]]). */
  benoetigtDm: string;
  /** Abschnitt: Notfall-Ideen (Markdown). */
  notfallIdeenDm: string;
}

/** Gegenstand / Artefakt. */
export interface Gegenstand extends BasisEntitaet {
  typ: 'gegenstand';
  gefunden: boolean;
  /** Besitzer: SC- oder NSC-Verknüpfung. */
  besitzerId: string | null;
  /** Fundort: Ort-Verknüpfung. */
  fundortId: string | null;
  buchSeiteDm: string;
  /** Abschnitt: Eigenschaften (Kurzfassung, Markdown). */
  eigenschaften: string;
  /** Abschnitt: Geschichte / Bedeutung – spielersichtbarer Teil (Markdown). */
  geschichte: string;
  /** Abschnitt: Geschichte / Bedeutung – DM-only-Teil (Markdown). */
  geschichteDm: string;
}

/** Fraktion / Gruppierung. */
export interface Fraktion extends BasisEntitaet {
  typ: 'fraktion';
  haltung: Haltung;
  /** Abschnitt: Ziele – spielersichtbarer Teil (Markdown). */
  ziele: string;
  /** Abschnitt: Ziele – DM-only-Teil (Markdown). */
  zieleDm: string;
  /** Abschnitt: Mitglieder (Markdown mit [[Wikilinks]]). */
  mitglieder: string;
  /** Abschnitt: Aktueller Stand (Markdown). */
  stand: string;
}

/** Ein Pin auf einer Karte. */
export interface KartenPin {
  id: string;
  /** Position in Prozent der Bildbreite (0–100). */
  x: number;
  /** Position in Prozent der Bildhöhe (0–100). */
  y: number;
  /** Verknüpfter Ort (Entitäts-ID), null = freier Marker. */
  ortId: string | null;
  /** Freitext-Beschriftung (bei verknüpften Pins optional, sonst der Name). */
  beschriftung: string;
}

/**
 * Interaktive Karte: eine hochgeladene Kartengrafik (Basisfeld `bild`)
 * mit klickbaren Pins, die auf Orte verlinken. Im Spieler-Build werden
 * nur Pins exportierter (= besuchter) Orte übernommen.
 */
export interface Karte extends BasisEntitaet {
  typ: 'karte';
  /** Abschnitt: Beschreibung / Legende (Markdown). */
  beschreibung: string;
  pins: KartenPin[];
}

/** Freie Referenz-Notiz (Hausregeln, Kalender, Tabellen, …). */
export interface Notiz extends BasisEntitaet {
  typ: 'notiz';
  /** Inhalt (Markdown). */
  inhalt: string;
}

/** Vereinigung aller Sammlungs-Entitäten. */
export type Entitaet =
  | Nsc
  | Quest
  | Ort
  | Sc
  | Session
  | SessionPrep
  | Gegenstand
  | Fraktion
  | Karte
  | Notiz;

// ---------------------------------------------------------------------------
// Kampagnen & Singletons
// (Jede Kampagne ist ein eigener Ordner in data/ mit einer kampagne.json
//  als Manifest; die Singletons existieren genau einmal pro Kampagne.)
// ---------------------------------------------------------------------------

/** Manifest einer Kampagne (data/<id>/kampagne.json). */
export interface Kampagne {
  id: string;
  name: string;
  /** Untertitel/Tagline, erscheint auf dem Dashboard. */
  beschreibung: string;
  /** ISO-Zeitstempel */
  erstellt: string;
}

/** Frei erweiterbarer Zähler auf dem Dashboard (z. B. „Heilige Symbole gefunden 1/3"). */
export interface CustomTracker {
  id: string;
  name: string;
  aktuell: number;
  max: number;
}

/**
 * Optionaler Eskalations-Tracker mit frei benennbarem Titel und frei
 * editierbaren Stufenbeschreibungen (in Curse of Strahd z. B.
 * „Strahds Eskalation“ mit 5 Stufen).
 */
export interface EskalationsTracker {
  titel: string;
  /** Aktuelle Stufe, 1-basiert. */
  stufe: number;
  /** Beschreibungen der Stufen (Länge = Anzahl Stufen). */
  stufen: string[];
}

/** Kampagnenstand – das Herzstück des Dashboards. Ein Singleton pro Kampagne. */
export interface Kampagnenstand {
  partyLevel: number;
  /** Tag-Zähler seit Kampagnenbeginn. */
  ingameTag: number;
  /** Freitext, z. B. „3. Tag nach Neumond, nieseliger Morgen". */
  ingameDatumText: string;
  /** Optionaler Eskalations-Tracker (null = Kampagne nutzt keinen). */
  eskalation: EskalationsTracker | null;
  customTracker: CustomTracker[];
}

export const WIDERSACHER_MODI = ['Charme', 'Drohung', 'Gewalt'] as const;
export type WidersacherModus = (typeof WIDERSACHER_MODI)[number];

/** Eine Zeile im Widersacher-Begegnungs-Tracker. */
export interface WidersacherBegegnung {
  nr: number;
  /** Verknüpfte Session-Nummer (null = noch nicht zugeordnet). */
  sessionNr: number | null;
  ort: string;
  modus: WidersacherModus;
  wollte: string;
  bekam: string;
  folgen: string;
}

/**
 * Spezialmodul: Widersacher-Tracker (DM-only). Protokolliert jeden Auftritt
 * des großen Gegenspielers der Kampagne – in Curse of Strahd der Graf
 * selbst, in anderen Kampagnen der jeweilige Erzschurke.
 */
export interface WidersacherTracker {
  /** Name des Widersachers, frei konfigurierbar (z. B. „Strahd von Zarovich“). */
  name: string;
  begegnungen: WidersacherBegegnung[];
  /** „Ideen-Vorrat": abhakbare Szenen-Ideen. */
  ideen: ChecklistEintrag[];
}

export const LESUNG_KARTEN_STATUS = ['geheim', 'hinweis gegeben', 'von Party entdeckt'] as const;
export type LesungKartenStatus = (typeof LESUNG_KARTEN_STATUS)[number];

/** Eine Karte/Ein Omen einer Lesung. */
export interface LesungsKarte {
  /** Wofür steht diese Karte? (frei editierbar, z. B. „Artefakt: Sonnenschwert“) */
  aspekt: string;
  /** Name der gezogenen Karte / des Omens. */
  karte: string;
  /** Aufgelöster Ort/NSC als Entitäts-ID (Verknüpfung), null = offen. */
  aufgeloestId: string | null;
  /** Freitext-Auflösung, falls (noch) keine Entität verknüpft ist. */
  aufgeloestText: string;
  status: LesungKartenStatus;
}

/**
 * Spezialmodul: Lesung/Prophezeiung (DM-only). Generisches Orakel-Modul –
 * in Curse of Strahd die Tarokka-Lesung, anderswo Prophezeiungen, Omen
 * oder Visionen. Titel und Karten sind frei konfigurierbar.
 */
export interface Lesung {
  /** Titel des Moduls, z. B. „Tarokka-Lesung“ oder „Prophezeiung der Salzmutter“. */
  titel: string;
  karten: LesungsKarte[];
}
