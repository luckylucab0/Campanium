/**
 * Entitäts-Registry: beschreibt jeden Entitätstyp deklarativ
 * (Labels, Routen, Kopffelder, Markdown-Abschnitte, Filter).
 *
 * Client-Formulare, Detailseiten und Listenfilter werden generisch aus
 * dieser Registry gerendert. Eine neue Entitätsart hinzuzufügen heißt im
 * Kern: types.ts + schemas.ts + dieser Datei einen Eintrag geben
 * (Details siehe ARCHITECTURE.md).
 */
import type { EntityTyp } from './types';
import { HALTUNGEN, NSC_STATUS, QUEST_STATUS, SC_STATUS } from './types';

/** Art eines Kopffeldes (oberhalb der Markdown-Abschnitte). */
export type FeldArt = 'text' | 'nummer' | 'boolean' | 'select' | 'ref' | 'datum';

/** Beschreibung eines Kopffeldes für Formular & Detailansicht. */
export interface FeldConfig {
  /** Property-Name auf der Entität (z. B. "status", "ortId"). */
  feld: string;
  label: string;
  art: FeldArt;
  /** Nur für art = 'select': erlaubte Werte. */
  optionen?: readonly string[];
  /** Nur für art = 'ref': welche Entitätstypen verlinkt werden dürfen. */
  refTypen?: readonly EntityTyp[];
  /** true = Feld ist DM-only (wird im Spieler-Build entfernt, UI markiert es). */
  dm?: boolean;
  /** Platzhalter/Hilfetext im Formular. */
  hinweis?: string;
}

/** Beschreibung eines Markdown-Abschnitts (Template-Struktur der Entität). */
export interface AbschnittConfig {
  /** Property-Name des Markdown-Feldes (z. B. "beschreibung"). */
  feld: string;
  titel: string;
  /** true = Abschnitt ist DM-only. */
  dm?: boolean;
  hinweis?: string;
}

/** Filterdefinition für Übersichtsseiten. */
export interface FilterConfig {
  feld: string;
  label: string;
  /**
   * 'select' filtert auf feste Werte, 'boolean' auf ja/nein, 'ref' auf
   * Verknüpfung, 'werte' auf die tatsächlich vorkommenden Werte des Feldes
   * (dynamisch – z. B. die Regionen der jeweiligen Kampagne).
   */
  art: 'select' | 'boolean' | 'ref' | 'werte';
  optionen?: readonly string[];
  refTypen?: readonly EntityTyp[];
}

/** Vollständige Konfiguration eines Entitätstyps. */
export interface EntityConfig {
  typ: EntityTyp;
  label: string;
  labelPlural: string;
  /** URL-Segment, z. B. "nscs" → /nscs und /nscs/:id. */
  route: string;
  /** Name des Lucide-Icons (der Client mappt ihn auf die Komponente). */
  icon: string;
  /** true = Typ ist grundsätzlich DM-only (z. B. Session-Prep). */
  immerDm?: boolean;
  /** Kurzbeschreibung für leere Listen. */
  beschreibung: string;
  /** Einzeiler-Feld, das in Karten/Suche als Untertitel dient. */
  untertitelFeld?: string;
  felder: FeldConfig[];
  abschnitte: AbschnittConfig[];
  filter: FilterConfig[];
}

export const entityConfigs: Record<EntityTyp, EntityConfig> = {
  nsc: {
    typ: 'nsc',
    label: 'NSC',
    labelPlural: 'NSCs',
    route: 'nscs',
    icon: 'Users',
    beschreibung: 'Nichtspielercharaktere – Verbündete, Schurken und alle dazwischen.',
    untertitelFeld: 'wer',
    felder: [
      { feld: 'status', label: 'Status', art: 'select', optionen: NSC_STATUS },
      { feld: 'haltung', label: 'Haltung zur Party', art: 'select', optionen: HALTUNGEN },
      { feld: 'ortId', label: 'Ort', art: 'ref', refTypen: ['ort'] },
      { feld: 'fraktionId', label: 'Fraktion', art: 'ref', refTypen: ['fraktion'] },
      {
        feld: 'wer',
        label: 'Wer? (eine Zeile)',
        art: 'text',
        hinweis: 'z. B. „Mürrischer Kerzenmacher mit goldenem Herzen“',
      },
      {
        feld: 'will',
        label: 'Will (Motivation)',
        art: 'text',
        hinweis: 'Was treibt diese Figur an?',
      },
      {
        feld: 'statblockRefDm',
        label: 'Statblock-Referenz',
        art: 'text',
        dm: true,
        hinweis: 'z. B. „MM S. 25“ – nur für dich',
      },
      { feld: 'buchSeiteDm', label: 'Buchseite', art: 'text', dm: true },
    ],
    abschnitte: [
      { feld: 'beschreibung', titel: 'Beschreibung & Auftreten' },
      { feld: 'weissVerbirgtDm', titel: 'Was er/sie weiß oder verbirgt', dm: true },
      { feld: 'beziehungen', titel: 'Beziehungen', hinweis: 'Mit [[Name]] auf NSCs/SCs verlinken' },
    ],
    filter: [
      { feld: 'status', label: 'Status', art: 'select', optionen: NSC_STATUS },
      { feld: 'haltung', label: 'Haltung', art: 'select', optionen: HALTUNGEN },
      { feld: 'ortId', label: 'Ort', art: 'ref', refTypen: ['ort'] },
      { feld: 'fraktionId', label: 'Fraktion', art: 'ref', refTypen: ['fraktion'] },
    ],
  },
  quest: {
    typ: 'quest',
    label: 'Quest',
    labelPlural: 'Quests',
    route: 'quests',
    icon: 'Scroll',
    beschreibung: 'Aufträge, Gefallen und lose Fäden der Kampagne.',
    untertitelFeld: 'auftrag',
    felder: [
      { feld: 'status', label: 'Status', art: 'select', optionen: QUEST_STATUS },
      { feld: 'questgeberId', label: 'Questgeber', art: 'ref', refTypen: ['nsc'] },
      { feld: 'ortId', label: 'Ort', art: 'ref', refTypen: ['ort'] },
      { feld: 'auftrag', label: 'Auftrag (eine Zeile, spielersichtbar)', art: 'text' },
      { feld: 'buchSeiteDm', label: 'Buchseite', art: 'text', dm: true },
    ],
    abschnitte: [
      { feld: 'hintergrundDm', titel: 'Hintergrund', dm: true },
      { feld: 'ausgaengeDm', titel: 'Mögliche Ausgänge (Erfolg/Scheitern)', dm: true },
      { feld: 'belohnung', titel: 'Belohnung' },
    ],
    filter: [
      { feld: 'status', label: 'Status', art: 'select', optionen: QUEST_STATUS },
      { feld: 'questgeberId', label: 'Questgeber', art: 'ref', refTypen: ['nsc'] },
      { feld: 'ortId', label: 'Ort', art: 'ref', refTypen: ['ort'] },
    ],
  },
  ort: {
    typ: 'ort',
    label: 'Ort',
    labelPlural: 'Orte',
    route: 'orte',
    icon: 'MapPin',
    beschreibung: 'Schauplätze der Kampagne – vom Dorf bis zum Dungeon.',
    untertitelFeld: 'was',
    felder: [
      {
        feld: 'region',
        label: 'Region',
        art: 'text',
        hinweis: 'Frei benennbar, z. B. „Küste“, „Hauptstadt“, „Unterreich“',
      },
      { feld: 'besucht', label: 'Besucht', art: 'boolean' },
      { feld: 'empfohlenesLevel', label: 'Empfohlenes Level', art: 'text' },
      { feld: 'was', label: 'Was? (eine Zeile)', art: 'text' },
      {
        feld: 'stimmung',
        label: 'Stimmung (Sinneseindrücke)',
        art: 'text',
        hinweis: 'Gerüche, Geräusche, Licht – fürs Erzählen',
      },
      { feld: 'buchSeiteDm', label: 'Buchseite', art: 'text', dm: true },
    ],
    abschnitte: [
      { feld: 'bereiche', titel: 'Wichtige Bereiche' },
      { feld: 'bewohner', titel: 'Bewohner', hinweis: 'Mit [[Name]] auf NSCs verlinken' },
      { feld: 'geheimnisseDm', titel: 'Geheimnisse & Gefahren', dm: true },
    ],
    filter: [
      { feld: 'region', label: 'Region', art: 'werte' },
      { feld: 'besucht', label: 'Besucht', art: 'boolean' },
    ],
  },
  sc: {
    typ: 'sc',
    label: 'Spielercharakter',
    labelPlural: 'Spielercharaktere',
    route: 'scs',
    icon: 'Swords',
    beschreibung: 'Die Heldinnen und Helden der Party.',
    untertitelFeld: 'klasseVolk',
    felder: [
      { feld: 'spieler', label: 'Spieler*in', art: 'text' },
      { feld: 'klasseVolk', label: 'Klasse & Volk', art: 'text' },
      { feld: 'level', label: 'Level', art: 'nummer' },
      { feld: 'status', label: 'Status', art: 'select', optionen: SC_STATUS },
      { feld: 'ac', label: 'Rüstungsklasse (AC)', art: 'nummer' },
      { feld: 'hp', label: 'Trefferpunkte (HP)', art: 'nummer' },
      { feld: 'passiveWahrnehmung', label: 'Passive Wahrnehmung', art: 'nummer' },
    ],
    abschnitte: [
      { feld: 'ziele', titel: 'Ziele & Motivation' },
      { feld: 'hooksDm', titel: 'Bindungen & Schwächen / DM-Hooks', dm: true },
      { feld: 'beziehungen', titel: 'Beziehungen zu NSCs' },
      { feld: 'besonderes', titel: 'Dunkle Gaben / Flüche / Besonderes' },
    ],
    filter: [{ feld: 'status', label: 'Status', art: 'select', optionen: SC_STATUS }],
  },
  session: {
    typ: 'session',
    label: 'Session',
    labelPlural: 'Sessions',
    route: 'sessions',
    icon: 'BookOpen',
    beschreibung: 'Protokolle der gespielten Abende.',
    untertitelFeld: 'ingameDatum',
    felder: [
      { feld: 'nummer', label: 'Session-Nr.', art: 'nummer' },
      { feld: 'datum', label: 'Datum (real)', art: 'datum' },
      { feld: 'ingameDatum', label: 'In-Game-Datum', art: 'text' },
    ],
    abschnitte: [
      { feld: 'zusammenfassung', titel: 'Zusammenfassung' },
      { feld: 'ereignisse', titel: 'Wichtige Ereignisse' },
      { feld: 'nscsGetroffen', titel: 'NSCs getroffen', hinweis: 'Mit [[Name]] verlinken' },
      { feld: 'gegenstaende', titel: 'Erhaltene Gegenstände / Hinweise' },
      { feld: 'offeneFaeden', titel: 'Offene Fäden für nächstes Mal' },
      { feld: 'notizenDm', titel: 'Notizen / Loot / XP', dm: true },
    ],
    filter: [],
  },
  sessionPrep: {
    typ: 'sessionPrep',
    label: 'Session-Prep',
    labelPlural: 'Session-Preps',
    route: 'preps',
    icon: 'ClipboardList',
    immerDm: true,
    beschreibung: 'Planung kommender Spielabende – komplett DM-only.',
    felder: [{ feld: 'sessionNummer', label: 'Geplante Session-Nr.', art: 'nummer' }],
    abschnitte: [
      { feld: 'zieleDm', titel: 'Ziele des Abends', dm: true },
      { feld: 'szenenDm', titel: 'Geplante Szenen', dm: true },
      {
        feld: 'benoetigtDm',
        titel: 'Benötigte NSCs / Orte',
        dm: true,
        hinweis: 'Mit [[Name]] verlinken',
      },
      { feld: 'notfallIdeenDm', titel: 'Notfall-Ideen', dm: true },
    ],
    filter: [],
  },
  gegenstand: {
    typ: 'gegenstand',
    label: 'Gegenstand',
    labelPlural: 'Gegenstände',
    route: 'gegenstaende',
    icon: 'Gem',
    beschreibung: 'Artefakte, Hinweise und Loot.',
    felder: [
      { feld: 'gefunden', label: 'Gefunden', art: 'boolean' },
      { feld: 'besitzerId', label: 'Besitzer', art: 'ref', refTypen: ['sc', 'nsc'] },
      { feld: 'fundortId', label: 'Fundort', art: 'ref', refTypen: ['ort'] },
      { feld: 'buchSeiteDm', label: 'Buchseite', art: 'text', dm: true },
    ],
    abschnitte: [
      { feld: 'eigenschaften', titel: 'Eigenschaften (Kurzfassung)' },
      { feld: 'geschichte', titel: 'Geschichte / Bedeutung' },
      { feld: 'geschichteDm', titel: 'Geschichte / Bedeutung (DM)', dm: true },
    ],
    filter: [
      { feld: 'gefunden', label: 'Gefunden', art: 'boolean' },
      { feld: 'besitzerId', label: 'Besitzer', art: 'ref', refTypen: ['sc', 'nsc'] },
      { feld: 'fundortId', label: 'Fundort', art: 'ref', refTypen: ['ort'] },
    ],
  },
  fraktion: {
    typ: 'fraktion',
    label: 'Fraktion',
    labelPlural: 'Fraktionen',
    route: 'fraktionen',
    icon: 'Flag',
    beschreibung: 'Gruppierungen und ihre Agenda.',
    felder: [{ feld: 'haltung', label: 'Haltung zur Party', art: 'select', optionen: HALTUNGEN }],
    abschnitte: [
      { feld: 'ziele', titel: 'Ziele' },
      { feld: 'zieleDm', titel: 'Ziele (DM)', dm: true },
      { feld: 'mitglieder', titel: 'Mitglieder', hinweis: 'Mit [[Name]] auf NSCs verlinken' },
      { feld: 'stand', titel: 'Aktueller Stand' },
    ],
    filter: [{ feld: 'haltung', label: 'Haltung', art: 'select', optionen: HALTUNGEN }],
  },
  karte: {
    typ: 'karte',
    label: 'Karte',
    labelPlural: 'Karten',
    route: 'karten',
    icon: 'Map',
    beschreibung:
      'Interaktive Karten: Kartengrafik hochladen und Pins setzen, die auf Orte verlinken.',
    felder: [],
    abschnitte: [{ feld: 'beschreibung', titel: 'Beschreibung / Legende' }],
    filter: [],
  },
  notiz: {
    typ: 'notiz',
    label: 'Notiz',
    labelPlural: 'Notizen',
    route: 'notizen',
    icon: 'StickyNote',
    beschreibung: 'Hausregeln, Kalender, Tabellen und andere Referenzen.',
    felder: [],
    abschnitte: [{ feld: 'inhalt', titel: 'Inhalt' }],
    filter: [],
  },
};

/** Findet die Config zu einem Routen-Segment ("nscs" → nsc-Config). */
export function configVonRoute(route: string): EntityConfig | undefined {
  return Object.values(entityConfigs).find((c) => c.route === route);
}
