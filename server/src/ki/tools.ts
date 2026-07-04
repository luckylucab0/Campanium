// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Die Werkzeuge des KI-Assistenten: genau die CRUD-Operationen, die auch
 * die REST-API anbietet, ausgeführt gegen den Storage der aktiven
 * Kampagne. Jede Schreiboperation läuft durch dieselbe Zod-Validierung
 * wie die API – das Modell kann keine kaputten Daten erzeugen.
 *
 * Bewusst KEIN Lösch-Werkzeug: Löschen bleibt eine manuelle DM-Aktion.
 */
import {
  eindeutigerSlug,
  ENTITY_TYPEN,
  entityConfigs,
  kalenderSchema,
  kampagnenstandSchema,
  neueEntitaet,
  validiereEntitaet,
  type Entitaet,
  type EntityTyp,
} from '@campanium/shared';
import type { Storage } from '../storage';
import type { KiToolAufruf, KiToolDefinition } from './provider';

/** Eine vom Assistenten durchgeführte Änderung – wird dem DM im Chat angezeigt. */
export interface KiAktion {
  /** Stabiler Bezeichner: "aktualisiert" | "angelegt" | "Log-Eintrag". */
  art: string;
  /** Anzeigetext in der UI-Sprache des Clients. */
  beschreibung: string;
  /** Verlinkbare Entität, falls vorhanden. */
  entitaetId?: string;
  typ?: EntityTyp;
}

/** Vom Client übergebene UI-Sprache (für die Anzeigetexte der Aktions-Karten). */
export type KiSprache = 'de' | 'en';

/** Typ-Labels für englische Aktions-Beschreibungen (Deutsch liefert die Registry). */
const TYP_LABEL_EN: Record<EntityTyp, string> = {
  nsc: 'NPC',
  quest: 'Quest',
  ort: 'Location',
  sc: 'Player character',
  session: 'Session',
  sessionPrep: 'Session prep',
  gegenstand: 'Item',
  fraktion: 'Faction',
  karte: 'Map',
  notiz: 'Note',
};

/** Beschreibungs-Vorlagen der Aktions-Karten pro Sprache. */
const AKTIONS_TEXTE: Record<
  KiSprache,
  {
    angelegt: (label: string, name: string) => string;
    aktualisiert: (label: string, name: string, felder: string) => string;
    logEintrag: (sessionNr: number, name: string) => string;
    kampagnenstand: (felder: string) => string;
    kalender: (felder: string) => string;
  }
> = {
  de: {
    angelegt: (label, name) => `${label} „${name}“ angelegt`,
    aktualisiert: (label, name, felder) => `${label} „${name}“ aktualisiert (${felder})`,
    logEintrag: (sessionNr, name) => `Log-Eintrag (S${sessionNr}) bei „${name}“ ergänzt`,
    kampagnenstand: (felder) => `Kampagnenstand aktualisiert (${felder})`,
    kalender: (felder) => `Kalender aktualisiert (${felder})`,
  },
  en: {
    angelegt: (label, name) => `${label} “${name}” created`,
    aktualisiert: (label, name, felder) => `${label} “${name}” updated (${felder})`,
    logEintrag: (sessionNr, name) => `Log entry (S${sessionNr}) added to “${name}”`,
    kampagnenstand: (felder) => `Campaign state updated (${felder})`,
    kalender: (felder) => `Calendar updated (${felder})`,
  },
};

/** Typ-Label in der gewünschten Sprache. */
function typLabel(typ: EntityTyp, sprache: KiSprache): string {
  return sprache === 'de' ? entityConfigs[typ].label : TYP_LABEL_EN[typ];
}

const TYP_LISTE = ENTITY_TYPEN.join(' | ');

/** Werkzeug-Definitionen, die dem Modell angeboten werden. */
export const KI_TOOLS: KiToolDefinition[] = [
  {
    name: 'kompendium_auflisten',
    beschreibung:
      'Listet alle Entitäten der Kampagne kompakt auf (ID, Name, Typ, Status). ' +
      'Nutze dies zuerst, um IDs nachzuschlagen. Optional nach Typ filtern.',
    parameter: {
      type: 'object',
      properties: {
        typ: { type: 'string', description: `Optionaler Filter: ${TYP_LISTE}` },
      },
    },
  },
  {
    name: 'entitaet_lesen',
    beschreibung: 'Liest eine Entität vollständig (alle Felder) anhand ihrer ID.',
    parameter: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Entitäts-ID (Slug)' } },
      required: ['id'],
    },
  },
  {
    name: 'entitaet_anlegen',
    beschreibung:
      'Legt eine neue Entität an. Nicht angegebene Felder erhalten sinnvolle ' +
      'Defaults aus dem Template des Typs.',
    parameter: {
      type: 'object',
      properties: {
        typ: { type: 'string', description: `Einer von: ${TYP_LISTE}` },
        name: { type: 'string' },
        felder: {
          type: 'object',
          description: 'Optionale weitere Felder der Entität (z. B. status, beschreibung)',
        },
      },
      required: ['typ', 'name'],
    },
  },
  {
    name: 'entitaet_aktualisieren',
    beschreibung:
      'Aktualisiert Felder einer bestehenden Entität (Teil-Update). ' +
      'id, typ und erstellt sind unveränderlich.',
    parameter: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        aenderungen: { type: 'object', description: 'Zu ändernde Felder' },
      },
      required: ['id', 'aenderungen'],
    },
  },
  {
    name: 'log_hinzufuegen',
    beschreibung:
      'Fügt dem Kampagnen-Log einer Entität einen Eintrag hinzu ' +
      '(was ist in welcher Session mit ihr passiert).',
    parameter: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        sessionNr: { type: 'integer' },
        text: { type: 'string' },
      },
      required: ['id', 'sessionNr', 'text'],
    },
  },
  {
    name: 'kampagnenstand_lesen',
    beschreibung:
      'Liest den Kampagnenstand (Party-Level, In-Game-Tag, Eskalation, Custom-Tracker).',
    parameter: { type: 'object', properties: {} },
  },
  {
    name: 'kampagnenstand_aktualisieren',
    beschreibung:
      'Aktualisiert Felder des Kampagnenstands (Teil-Update), z. B. ingameTag ' +
      'weiterzählen oder einen Custom-Tracker setzen.',
    parameter: {
      type: 'object',
      properties: {
        aenderungen: { type: 'object', description: 'Zu ändernde Felder des Kampagnenstands' },
      },
      required: ['aenderungen'],
    },
  },
  {
    name: 'kalender_lesen',
    beschreibung:
      'Liest den In-Game-Kalender der Kampagne: Monate (Name + Tage), Ära, ' +
      'aktuelles Datum {jahr, monat, tag} und Ereignisse. Leere Monatsliste = ' +
      'Kalender nicht eingerichtet.',
    parameter: { type: 'object', properties: {} },
  },
  {
    name: 'kalender_aktualisieren',
    beschreibung:
      'Aktualisiert Felder des Kalenders (Teil-Update), z. B. das aktuelle ' +
      'Datum weitersetzen oder ein Ereignis ergänzen. Lies den Kalender vorher ' +
      'mit kalender_lesen. Beim Weiterzählen des Datums Monats- und ' +
      'Jahresgrenzen beachten (tage des Monats aus der Monatsliste; nach dem ' +
      'letzten Monat beginnt Monat 1 des Folgejahres). Monat und Tag sind 1-basiert.',
    parameter: {
      type: 'object',
      properties: {
        aenderungen: { type: 'object', description: 'Zu ändernde Felder des Kalenders' },
      },
      required: ['aenderungen'],
    },
  },
];

/** Ergebnis einer Werkzeug-Ausführung. */
export interface ToolErgebnis {
  /** Als Tool-Result ans Modell zurückgegebener Text (meist JSON). */
  ergebnis: string;
  /** Durchgeführte Änderung für die Anzeige im Chat (nur bei Schreibzugriffen). */
  aktion?: KiAktion;
}

function istEntityTyp(wert: unknown): wert is EntityTyp {
  return typeof wert === 'string' && (ENTITY_TYPEN as readonly string[]).includes(wert);
}

/**
 * Führt einen Werkzeug-Aufruf gegen den Storage aus. Fehler werden als
 * Text zurückgegeben (nicht geworfen), damit das Modell reagieren kann.
 */
export function fuehreToolAus(
  storage: Storage,
  aufruf: KiToolAufruf,
  sprache: KiSprache = 'de',
): ToolErgebnis {
  const texte = AKTIONS_TEXTE[sprache];
  const eingabe = (aufruf.eingabe ?? {}) as Record<string, unknown>;
  try {
    switch (aufruf.name) {
      case 'kompendium_auflisten': {
        const typ = eingabe.typ;
        const liste = storage
          .alle()
          .filter((e) => !typ || e.typ === typ)
          .map((e) => ({
            id: e.id,
            name: e.name,
            typ: e.typ,
            status: (e as unknown as Record<string, unknown>).status,
          }));
        return { ergebnis: JSON.stringify(liste) };
      }

      case 'entitaet_lesen': {
        const entitaet = storage.holen(String(eingabe.id ?? ''));
        if (!entitaet) return { ergebnis: `Fehler: keine Entität mit ID "${eingabe.id}"` };
        return { ergebnis: JSON.stringify(entitaet) };
      }

      case 'entitaet_anlegen': {
        if (!istEntityTyp(eingabe.typ)) {
          return { ergebnis: `Fehler: unbekannter Typ "${eingabe.typ}" (erlaubt: ${TYP_LISTE})` };
        }
        const name = String(eingabe.name ?? '').trim();
        if (!name) return { ergebnis: 'Fehler: name darf nicht leer sein' };
        const id = eindeutigerSlug(name, storage.vorhandeneIds());
        const template = neueEntitaet(eingabe.typ, id, name);
        const kandidat = {
          ...template,
          ...((eingabe.felder as object) ?? {}),
          id,
          typ: eingabe.typ,
          name,
          erstellt: template.erstellt,
          geaendert: template.geaendert,
        };
        const entitaet = validiereEntitaet(eingabe.typ, kandidat);
        storage.speichern(entitaet);
        return {
          ergebnis: JSON.stringify(entitaet),
          aktion: {
            art: 'angelegt',
            beschreibung: texte.angelegt(typLabel(entitaet.typ, sprache), entitaet.name),
            entitaetId: entitaet.id,
            typ: entitaet.typ,
          },
        };
      }

      case 'entitaet_aktualisieren': {
        const vorhanden = storage.holen(String(eingabe.id ?? ''));
        if (!vorhanden) return { ergebnis: `Fehler: keine Entität mit ID "${eingabe.id}"` };
        const kandidat = {
          ...vorhanden,
          ...((eingabe.aenderungen as object) ?? {}),
          id: vorhanden.id,
          typ: vorhanden.typ,
          erstellt: vorhanden.erstellt,
          geaendert: new Date().toISOString(),
        };
        const entitaet = validiereEntitaet(vorhanden.typ, kandidat);
        storage.speichern(entitaet);
        const geaenderteFelder = Object.keys((eingabe.aenderungen as object) ?? {}).join(', ');
        return {
          ergebnis: JSON.stringify(entitaet),
          aktion: {
            art: 'aktualisiert',
            beschreibung: texte.aktualisiert(
              typLabel(entitaet.typ, sprache),
              entitaet.name,
              geaenderteFelder,
            ),
            entitaetId: entitaet.id,
            typ: entitaet.typ,
          },
        };
      }

      case 'log_hinzufuegen': {
        const vorhanden = storage.holen(String(eingabe.id ?? ''));
        if (!vorhanden) return { ergebnis: `Fehler: keine Entität mit ID "${eingabe.id}"` };
        const eintrag = { sessionNr: Number(eingabe.sessionNr), text: String(eingabe.text ?? '') };
        const kandidat: Entitaet = {
          ...vorhanden,
          kampagnenLog: [...vorhanden.kampagnenLog, eintrag],
          geaendert: new Date().toISOString(),
        };
        const entitaet = validiereEntitaet(vorhanden.typ, kandidat);
        storage.speichern(entitaet);
        return {
          ergebnis: JSON.stringify(entitaet.kampagnenLog),
          aktion: {
            art: 'Log-Eintrag',
            beschreibung: texte.logEintrag(eintrag.sessionNr, entitaet.name),
            entitaetId: entitaet.id,
            typ: entitaet.typ,
          },
        };
      }

      case 'kampagnenstand_lesen':
        return { ergebnis: JSON.stringify(storage.kampagnenstand) };

      case 'kampagnenstand_aktualisieren': {
        const kandidat = { ...storage.kampagnenstand, ...((eingabe.aenderungen as object) ?? {}) };
        const stand = kampagnenstandSchema.parse(kandidat);
        storage.kampagnenstand = stand;
        storage.speichereSingleton('kampagnenstand', stand);
        const geaenderteFelder = Object.keys((eingabe.aenderungen as object) ?? {}).join(', ');
        return {
          ergebnis: JSON.stringify(stand),
          aktion: {
            art: 'aktualisiert',
            beschreibung: texte.kampagnenstand(geaenderteFelder),
          },
        };
      }

      case 'kalender_lesen':
        return { ergebnis: JSON.stringify(storage.kalender) };

      case 'kalender_aktualisieren': {
        const kandidat = { ...storage.kalender, ...((eingabe.aenderungen as object) ?? {}) };
        const kalender = kalenderSchema.parse(kandidat);
        storage.kalender = kalender;
        storage.speichereSingleton('kalender', kalender);
        const geaenderteFelder = Object.keys((eingabe.aenderungen as object) ?? {}).join(', ');
        return {
          ergebnis: JSON.stringify(kalender),
          aktion: {
            art: 'aktualisiert',
            beschreibung: texte.kalender(geaenderteFelder),
          },
        };
      }

      default:
        return { ergebnis: `Fehler: unbekanntes Werkzeug "${aufruf.name}"` };
    }
  } catch (fehler) {
    // Zod-Fehler & Co. als Text ans Modell – es kann den Aufruf korrigieren.
    const meldung = fehler instanceof Error ? fehler.message : String(fehler);
    return { ergebnis: `Fehler: ${meldung.slice(0, 500)}` };
  }
}
