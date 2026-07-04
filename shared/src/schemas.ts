/**
 * Zod-Schemas für alle Entitäten und Singletons.
 *
 * Die API validiert jede Schreiboperation gegen diese Schemas und weist
 * kaputte Daten ab. Außerdem liefern `neueEntitaet()` und die
 * DEFAULT_*-Konstanten die Templates für neu angelegte Einträge.
 */
import { z } from 'zod';
import type {
  Entitaet,
  EntityTyp,
  Kalender,
  Kampagnenstand,
  Lesung,
  WidersacherTracker,
} from './types';
import {
  HALTUNGEN,
  LESUNG_KARTEN_STATUS,
  NSC_STATUS,
  QUEST_STATUS,
  SC_STATUS,
  WIDERSACHER_MODI,
} from './types';

const kampagnenLogEintragSchema = z.object({
  sessionNr: z.number().int().nonnegative(),
  text: z.string(),
});

const checklistEintragSchema = z.object({
  text: z.string(),
  erledigt: z.boolean(),
});

/** Basisfelder jeder Entität. */
const basisSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name darf nicht leer sein'),
  erstellt: z.string(),
  geaendert: z.string(),
  tags: z.array(z.string()),
  dmOnly: z.boolean(),
  kampagnenLog: z.array(kampagnenLogEintragSchema),
  // default(null): Bestandsdaten ohne bild-Feld bleiben gültig.
  bild: z.string().min(1).nullable().default(null),
});

/** Optionale Verknüpfung auf eine andere Entität (per ID). */
const refSchema = z.string().min(1).nullable();

export const nscSchema = basisSchema.extend({
  typ: z.literal('nsc'),
  status: z.enum(NSC_STATUS),
  haltung: z.enum(HALTUNGEN),
  ortId: refSchema,
  fraktionId: refSchema,
  buchSeiteDm: z.string(),
  wer: z.string(),
  will: z.string(),
  statblockRefDm: z.string(),
  beschreibung: z.string(),
  weissVerbirgtDm: z.string(),
  beziehungen: z.string(),
});

export const questSchema = basisSchema.extend({
  typ: z.literal('quest'),
  status: z.enum(QUEST_STATUS),
  questgeberId: refSchema,
  ortId: refSchema,
  buchSeiteDm: z.string(),
  auftrag: z.string(),
  hintergrundDm: z.string(),
  ausgaengeDm: z.string(),
  belohnung: z.string(),
  fortschritt: z.array(checklistEintragSchema),
});

export const ortSchema = basisSchema.extend({
  typ: z.literal('ort'),
  region: z.string(),
  besucht: z.boolean(),
  empfohlenesLevel: z.string(),
  buchSeiteDm: z.string(),
  was: z.string(),
  stimmung: z.string(),
  bereiche: z.string(),
  bewohner: z.string(),
  geheimnisseDm: z.string(),
});

export const scSchema = basisSchema.extend({
  typ: z.literal('sc'),
  spieler: z.string(),
  klasseVolk: z.string(),
  level: z.number().int().min(1).max(20),
  status: z.enum(SC_STATUS),
  ac: z.number().int().nonnegative(),
  hp: z.number().int().nonnegative(),
  passiveWahrnehmung: z.number().int().nonnegative(),
  ziele: z.string(),
  hooksDm: z.string(),
  beziehungen: z.string(),
  besonderes: z.string(),
});

export const sessionSchema = basisSchema.extend({
  typ: z.literal('session'),
  nummer: z.number().int().nonnegative(),
  datum: z.string(),
  ingameDatum: z.string(),
  zusammenfassung: z.string(),
  ereignisse: z.string(),
  nscsGetroffen: z.string(),
  gegenstaende: z.string(),
  offeneFaeden: z.string(),
  notizenDm: z.string(),
});

export const sessionPrepSchema = basisSchema.extend({
  typ: z.literal('sessionPrep'),
  // Preps sind grundsätzlich DM-only; das Schema erzwingt das.
  dmOnly: z.literal(true),
  sessionNummer: z.number().int().nonnegative(),
  zieleDm: z.string(),
  szenenDm: z.string(),
  benoetigtDm: z.string(),
  notfallIdeenDm: z.string(),
});

export const gegenstandSchema = basisSchema.extend({
  typ: z.literal('gegenstand'),
  gefunden: z.boolean(),
  besitzerId: refSchema,
  fundortId: refSchema,
  buchSeiteDm: z.string(),
  eigenschaften: z.string(),
  geschichte: z.string(),
  geschichteDm: z.string(),
});

export const fraktionSchema = basisSchema.extend({
  typ: z.literal('fraktion'),
  haltung: z.enum(HALTUNGEN),
  ziele: z.string(),
  zieleDm: z.string(),
  mitglieder: z.string(),
  stand: z.string(),
});

const kartenPinSchema = z.object({
  id: z.string().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  ortId: refSchema,
  beschriftung: z.string(),
});

export const karteSchema = basisSchema.extend({
  typ: z.literal('karte'),
  beschreibung: z.string(),
  pins: z.array(kartenPinSchema),
});

export const notizSchema = basisSchema.extend({
  typ: z.literal('notiz'),
  inhalt: z.string(),
});

/** Schema-Registry: Entitätstyp → Zod-Schema. */
export const entitySchemas: Record<EntityTyp, z.ZodTypeAny> = {
  nsc: nscSchema,
  quest: questSchema,
  ort: ortSchema,
  sc: scSchema,
  session: sessionSchema,
  sessionPrep: sessionPrepSchema,
  gegenstand: gegenstandSchema,
  fraktion: fraktionSchema,
  karte: karteSchema,
  notiz: notizSchema,
};

/** Validiert eine Entität gegen das Schema ihres Typs. Wirft bei Fehlern. */
export function validiereEntitaet(typ: EntityTyp, daten: unknown): Entitaet {
  return entitySchemas[typ].parse(daten) as Entitaet;
}

// ---------------------------------------------------------------------------
// Kampagnen-Manifest & Singletons
// ---------------------------------------------------------------------------

export const kampagneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name darf nicht leer sein'),
  beschreibung: z.string(),
  erstellt: z.string(),
});

export const kampagnenstandSchema = z.object({
  partyLevel: z.number().int().min(1).max(20),
  ingameTag: z.number().int().nonnegative(),
  ingameDatumText: z.string(),
  eskalation: z
    .object({
      titel: z.string(),
      stufe: z.number().int().min(1),
      stufen: z.array(z.string()).min(1),
    })
    // Stufe darf nie größer sein als die Anzahl definierter Stufen.
    .refine((e) => e.stufe <= e.stufen.length, {
      message: 'stufe liegt außerhalb der definierten Stufen',
    })
    .nullable(),
  customTracker: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      aktuell: z.number().int(),
      max: z.number().int().min(1),
    }),
  ),
});

export const widersacherTrackerSchema = z.object({
  name: z.string(),
  begegnungen: z.array(
    z.object({
      nr: z.number().int().positive(),
      sessionNr: z.number().int().nonnegative().nullable(),
      ort: z.string(),
      modus: z.enum(WIDERSACHER_MODI),
      wollte: z.string(),
      bekam: z.string(),
      folgen: z.string(),
    }),
  ),
  ideen: z.array(checklistEintragSchema),
});

const kalenderDatumSchema = z.object({
  jahr: z.number().int(),
  monat: z.number().int().min(1),
  tag: z.number().int().min(1),
});

export const kalenderSchema = z.object({
  aera: z.string(),
  monate: z.array(z.object({ name: z.string().min(1), tage: z.number().int().min(1).max(999) })),
  aktuell: kalenderDatumSchema,
  ereignisse: z.array(
    z.object({
      id: z.string().min(1),
      datum: kalenderDatumSchema,
      titel: z.string(),
      entitaetId: refSchema,
    }),
  ),
});

export const lesungSchema = z.object({
  titel: z.string(),
  karten: z.array(
    z.object({
      aspekt: z.string(),
      karte: z.string(),
      aufgeloestId: refSchema,
      aufgeloestText: z.string(),
      status: z.enum(LESUNG_KARTEN_STATUS),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Templates / Defaults für neue Einträge
// ---------------------------------------------------------------------------

/** Erzeugt eine neue, leere Entität des gewünschten Typs mit sinnvollen Defaults. */
export function neueEntitaet(typ: EntityTyp, id: string, name: string): Entitaet {
  const jetzt = new Date().toISOString();
  const basis = {
    id,
    name,
    erstellt: jetzt,
    geaendert: jetzt,
    tags: [] as string[],
    dmOnly: false,
    kampagnenLog: [] as { sessionNr: number; text: string }[],
    bild: null,
  };
  switch (typ) {
    case 'nsc':
      return {
        ...basis,
        typ,
        status: 'lebendig',
        haltung: 'unbekannt',
        ortId: null,
        fraktionId: null,
        buchSeiteDm: '',
        wer: '',
        will: '',
        statblockRefDm: '',
        beschreibung: '',
        weissVerbirgtDm: '',
        beziehungen: '',
      };
    case 'quest':
      return {
        ...basis,
        typ,
        status: 'offen',
        questgeberId: null,
        ortId: null,
        buchSeiteDm: '',
        auftrag: '',
        hintergrundDm: '',
        ausgaengeDm: '',
        belohnung: '',
        fortschritt: [],
      };
    case 'ort':
      return {
        ...basis,
        typ,
        region: '',
        besucht: false,
        empfohlenesLevel: '',
        buchSeiteDm: '',
        was: '',
        stimmung: '',
        bereiche: '',
        bewohner: '',
        geheimnisseDm: '',
      };
    case 'sc':
      return {
        ...basis,
        typ,
        spieler: '',
        klasseVolk: '',
        level: 1,
        status: 'aktiv',
        ac: 10,
        hp: 10,
        passiveWahrnehmung: 10,
        ziele: '',
        hooksDm: '',
        beziehungen: '',
        besonderes: '',
      };
    case 'session':
      return {
        ...basis,
        typ,
        nummer: 0,
        datum: new Date().toISOString().slice(0, 10),
        ingameDatum: '',
        zusammenfassung: '',
        ereignisse: '',
        nscsGetroffen: '',
        gegenstaende: '',
        offeneFaeden: '',
        notizenDm: '',
      };
    case 'sessionPrep':
      return {
        ...basis,
        typ,
        dmOnly: true,
        sessionNummer: 0,
        zieleDm: '',
        szenenDm: '',
        benoetigtDm: '',
        notfallIdeenDm: '',
      };
    case 'gegenstand':
      return {
        ...basis,
        typ,
        gefunden: false,
        besitzerId: null,
        fundortId: null,
        buchSeiteDm: '',
        eigenschaften: '',
        geschichte: '',
        geschichteDm: '',
      };
    case 'fraktion':
      return {
        ...basis,
        typ,
        haltung: 'unbekannt',
        ziele: '',
        zieleDm: '',
        mitglieder: '',
        stand: '',
      };
    case 'karte':
      return { ...basis, typ, beschreibung: '', pins: [] };
    case 'notiz':
      return { ...basis, typ, inhalt: '' };
  }
}

/** Default-Kampagnenstand für eine frische Kampagne (ohne Eskalations-Tracker). */
export const DEFAULT_KAMPAGNENSTAND: Kampagnenstand = {
  partyLevel: 1,
  ingameTag: 1,
  ingameDatumText: '',
  eskalation: null,
  customTracker: [],
};

/** Default-Widersacher-Tracker (leer, Name noch unbenannt). */
export const DEFAULT_WIDERSACHER: WidersacherTracker = { name: '', begegnungen: [], ideen: [] };

/** Default-Lesung (leer – Karten legt der DM je nach Kampagne selbst an). */
export const DEFAULT_LESUNG: Lesung = { titel: '', karten: [] };

/** Default-Kalender (leer = Modul wartet auf Einrichtung). */
export const DEFAULT_KALENDER: Kalender = {
  aera: '',
  monate: [],
  aktuell: { jahr: 1, monat: 1, tag: 1 },
  ereignisse: [],
};
