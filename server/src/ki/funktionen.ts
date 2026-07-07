// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Zusätzliche KI-Funktionen jenseits des Chat-Assistenten (Phase 3):
 *  - Sitzungsprep-Entwurf aus dem aktuellen Kampagnenstand
 *  - Charakterbogen-/Statblock-Import (Freitext → strukturierte Felder)
 *
 * Beide nutzen den vorhandenen KiProvider im Ein-Schritt-Modus (kein
 * Agent-Loop, keine Werkzeuge): Prompt rein, JSON raus. Das Parsen ist
 * defensiv (Code-Fences, umgebender Text), das Ergebnis wird vom Aufrufer
 * gegen die Zod-Schemas validiert.
 */
import type { Entitaet, Kampagne } from '@campanium/shared';
import type { Storage } from '../storage';
import type { KiProvider } from './provider';
import type { KiSprache } from './tools';

/** Extrahiert das erste JSON-Objekt aus einer Modell-Antwort. */
export function jsonAusText(text: string): Record<string, unknown> {
  const ohneFence = text.replace(/```(?:json)?/gi, '');
  const start = ohneFence.indexOf('{');
  const ende = ohneFence.lastIndexOf('}');
  if (start === -1 || ende <= start) throw new Error('Die KI hat keine verwertbare Antwort geliefert');
  return JSON.parse(ohneFence.slice(start, ende + 1)) as Record<string, unknown>;
}

function alsText(wert: unknown): string {
  return typeof wert === 'string' ? wert : '';
}

/** Baut einen kompakten Kampagnen-Kontext für den Prep-Prompt. */
function baueKampagnenKontext(storage: Storage): string {
  const alle = storage.alle();
  const zeilen: string[] = [];
  zeilen.push(`Party-Level: ${storage.kampagnenstand.partyLevel}`);
  if (storage.kampagnenstand.ingameDatumText) {
    zeilen.push(`In-Game-Datum: ${storage.kampagnenstand.ingameDatumText}`);
  }

  const aktiveQuests = alle.filter(
    (e) => e.typ === 'quest' && (e.status === 'aktiv' || e.status === 'offen'),
  );
  if (aktiveQuests.length) {
    zeilen.push('Aktive Quests:');
    for (const q of aktiveQuests.slice(0, 8)) {
      zeilen.push(
        `- ${q.name}: ${alsText((q as unknown as Record<string, unknown>).auftrag).slice(0, 200)}`,
      );
    }
  }

  const verbuendete = alle.filter((e) => e.typ === 'nsc' && e.haltung === 'verbündet');
  if (verbuendete.length) {
    zeilen.push(`Verbündete NSCs: ${verbuendete.map((e) => e.name).slice(0, 10).join(', ')}`);
  }

  const sessions = alle
    .filter((e) => e.typ === 'session')
    .sort((a, b) => (b as { nummer: number }).nummer - (a as { nummer: number }).nummer);
  if (sessions.length) {
    const letzte = sessions[0] as unknown as Record<string, unknown>;
    zeilen.push(`Letzte Session (#${letzte.nummer}): ${alsText(letzte.zusammenfassung).slice(0, 400)}`);
  }

  return zeilen.join('\n');
}

/** Nächste Session-Nummer (höchstes vorhandenes Prep/Protokoll + 1). */
export function naechsteSessionNummer(entitaeten: readonly Entitaet[]): number {
  const nummern = entitaeten
    .map((e) =>
      e.typ === 'sessionPrep'
        ? e.sessionNummer
        : e.typ === 'session'
          ? e.nummer
          : 0,
    )
    .filter((n) => Number.isFinite(n));
  return (nummern.length ? Math.max(...nummern) : 0) + 1;
}

/** Die vom Prep-Entwurf befüllten Markdown-Abschnitte. */
export interface PrepEntwurf {
  zieleDm: string;
  szenenDm: string;
  benoetigtDm: string;
  notfallIdeenDm: string;
}

/**
 * Erzeugt einen Sitzungsprep-Entwurf. Der Aufrufer baut daraus die
 * sessionPrep-Entität (inkl. Nummer) und validiert sie.
 */
export async function erzeugeSitzungsprep(
  provider: KiProvider,
  kampagne: Kampagne,
  storage: Storage,
  sprache: KiSprache,
  fokus?: string,
): Promise<PrepEntwurf> {
  const system =
    sprache === 'en'
      ? 'You are a tabletop RPG co-DM. Draft prep for the next session of the campaign. ' +
        'Reply ONLY with a JSON object with the string fields "zieleDm" (goals of the night), ' +
        '"szenenDm" (planned scenes), "benoetigtDm" (needed NPCs/places, use [[Name]] wikilinks), ' +
        '"notfallIdeenDm" (emergency ideas). Each value is Markdown. No prose outside the JSON.'
      : 'Du bist Co-Spielleiter für ein Pen-&-Paper-Rollenspiel. Entwirf das Prep für die nächste ' +
        'Session der Kampagne. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt mit den String-Feldern ' +
        '"zieleDm" (Ziele des Abends), "szenenDm" (geplante Szenen), "benoetigtDm" (benötigte NSCs/Orte, ' +
        'nutze [[Name]]-Wikilinks), "notfallIdeenDm" (Notfall-Ideen). Jeder Wert ist Markdown. ' +
        'Kein Text außerhalb des JSON.';

  const nutzer =
    `${sprache === 'en' ? 'Campaign' : 'Kampagne'}: ${kampagne.name}\n` +
    (fokus ? `${sprache === 'en' ? 'Focus' : 'Fokus'}: ${fokus}\n` : '') +
    `\n${baueKampagnenKontext(storage)}`;

  const antwort = await provider.chat(system, [{ rolle: 'nutzer', text: nutzer }], []);
  const roh = jsonAusText(antwort.text);
  return {
    zieleDm: alsText(roh.zieleDm),
    szenenDm: alsText(roh.szenenDm),
    benoetigtDm: alsText(roh.benoetigtDm),
    notfallIdeenDm: alsText(roh.notfallIdeenDm),
  };
}

/**
 * Parst einen Statblock/Charakterbogen (Freitext) in strukturierte Felder.
 * Liefert ein rohes Objekt; der Aufrufer legt es über das Entitäts-Template
 * und validiert per Zod.
 */
export async function importiereCharakter(
  provider: KiProvider,
  typ: 'sc' | 'nsc',
  text: string,
  sprache: KiSprache,
): Promise<Record<string, unknown>> {
  const felder =
    typ === 'sc'
      ? '"name", "spieler", "klasseVolk", "level" (Zahl), "ac" (Zahl), "hp" (Zahl), ' +
        '"passiveWahrnehmung" (Zahl), "attribute" (Objekt mit staerke, geschicklichkeit, ' +
        'konstitution, intelligenz, weisheit, charisma als Zahlen), "ziele", "besonderes"'
      : '"name", "wer" (eine Zeile), "will" (Motivation), "beschreibung", "attribute" ' +
        '(Objekt mit staerke, geschicklichkeit, konstitution, intelligenz, weisheit, charisma als Zahlen)';

  const system =
    (sprache === 'en'
      ? `Extract a ${typ === 'sc' ? 'player character' : 'NPC'} from the pasted stat block. `
      : `Extrahiere ${typ === 'sc' ? 'einen Spielercharakter' : 'einen NSC'} aus dem eingefügten Statblock. `) +
    (sprache === 'en'
      ? `Reply ONLY with a JSON object using these keys (German field names, keep them exactly): ${felder}. `
      : `Antworte AUSSCHLIESSLICH mit einem JSON-Objekt mit diesen Schlüsseln: ${felder}. `) +
    (sprache === 'en'
      ? 'Omit fields you cannot determine. Attribute values are ability scores (e.g. 14), not modifiers.'
      : 'Lass Felder weg, die du nicht bestimmen kannst. Attribut-Werte sind Fähigkeitswerte (z. B. 14), keine Modifikatoren.');

  const antwort = await provider.chat(system, [{ rolle: 'nutzer', text }], []);
  return normalisiereCharakter(typ, jsonAusText(antwort.text));
}

/** Attribut-Schlüssel-Aliase (englisch/Kürzel) → Schema-Feldnamen. */
const ATTR_ALIAS: Record<string, string> = {
  str: 'staerke',
  staerke: 'staerke',
  strength: 'staerke',
  dex: 'geschicklichkeit',
  geschicklichkeit: 'geschicklichkeit',
  dexterity: 'geschicklichkeit',
  con: 'konstitution',
  konstitution: 'konstitution',
  constitution: 'konstitution',
  int: 'intelligenz',
  intelligenz: 'intelligenz',
  intelligence: 'intelligenz',
  wis: 'weisheit',
  weisheit: 'weisheit',
  wisdom: 'weisheit',
  cha: 'charisma',
  charisma: 'charisma',
};

/**
 * Bereinigt die KI-Rohdaten: nur erlaubte Felder, Zahlen aus Strings,
 * Attribut-Schlüssel normalisiert. Das Ergebnis wird anschließend regulär
 * gegen das Zod-Schema validiert.
 */
export function normalisiereCharakter(
  typ: 'sc' | 'nsc',
  roh: Record<string, unknown>,
): Record<string, unknown> {
  const erlaubt =
    typ === 'sc'
      ? ['name', 'spieler', 'klasseVolk', 'level', 'ac', 'hp', 'passiveWahrnehmung', 'ziele', 'besonderes']
      : ['name', 'wer', 'will', 'beschreibung'];
  const zahlen = new Set(['level', 'ac', 'hp', 'passiveWahrnehmung']);

  const ergebnis: Record<string, unknown> = {};
  for (const feld of erlaubt) {
    const wert = roh[feld];
    if (wert === undefined || wert === null) continue;
    ergebnis[feld] = zahlen.has(feld) ? zahl(wert) : String(wert);
  }

  const attr = roh.attribute;
  if (attr && typeof attr === 'object') {
    const normalisiert: Record<string, number> = {};
    for (const [k, v] of Object.entries(attr as Record<string, unknown>)) {
      const feld = ATTR_ALIAS[k.trim().toLowerCase()];
      if (feld) normalisiert[feld] = zahl(v);
    }
    const vollstaendig = ['staerke', 'geschicklichkeit', 'konstitution', 'intelligenz', 'weisheit', 'charisma'];
    if (vollstaendig.every((f) => f in normalisiert)) ergebnis.attribute = normalisiert;
  }

  return ergebnis;
}

/** Koerziert einen Wert zu einer ganzen Zahl (fällt auf 0 zurück). */
function zahl(wert: unknown): number {
  const n = typeof wert === 'number' ? wert : parseInt(String(wert).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
