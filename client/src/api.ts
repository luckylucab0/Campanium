// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * API-Schicht mit zwei Betriebsmodi:
 *  - DM-Modus (Standard): spricht die kampagnen-bezogene REST-API des
 *    lokalen Servers an (/api/kampagnen/:kid/…).
 *  - Spieler-Modus (vite build --mode player): lädt ein statisches,
 *    bereits spoiler-gefiltertes player-data.json mit genau EINER
 *    Kampagne; Schreiben ist unmöglich.
 */
import type {
  Entitaet,
  EntityTyp,
  Kalender,
  Kampagne,
  Kampagnenstand,
  Lesung,
  WidersacherTracker,
} from '@campanium/shared';
import {
  DEFAULT_KALENDER,
  DEFAULT_KAMPAGNENSTAND,
  DEFAULT_LESUNG,
  DEFAULT_WIDERSACHER,
} from '@campanium/shared';

/** true, wenn dieser Build der read-only Spieler-Build ist. */
export const IST_SPIELER_MODUS = import.meta.env.MODE === 'player';

/** Kennung der Spieler-Kampagne im Store (es gibt im Spieler-Build nur eine). */
export const SPIELER_KAMPAGNE_ID = 'spieler';

export interface KampagnenDaten {
  entitaeten: Entitaet[];
  kampagnenstand: Kampagnenstand;
  widersacher: WidersacherTracker;
  lesung: Lesung;
  kalender: Kalender;
}

async function pruefe(antwort: Response): Promise<Response> {
  if (!antwort.ok) {
    let meldung = `HTTP ${antwort.status}`;
    try {
      const json = await antwort.json();
      if (json?.fehler) meldung = json.fehler;
    } catch {
      /* Antwort war kein JSON – Standardmeldung reicht. */
    }
    throw new Error(meldung);
  }
  return antwort;
}

/** Liste aller Kampagnen (Spieler-Modus: genau eine, aus dem statischen JSON). */
export async function ladeKampagnen(): Promise<Kampagne[]> {
  if (IST_SPIELER_MODUS) {
    const daten = await ladeSpielerDaten();
    return [
      {
        id: SPIELER_KAMPAGNE_ID,
        name: daten.kampagne?.name ?? 'Kampagne',
        beschreibung: daten.kampagne?.beschreibung ?? '',
        erstellt: '',
      },
    ];
  }
  const antwort = await pruefe(await fetch('/api/kampagnen'));
  return antwort.json();
}

export async function erstelleKampagne(name: string, beschreibung: string): Promise<Kampagne> {
  const antwort = await pruefe(
    await fetch('/api/kampagnen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, beschreibung }),
    }),
  );
  return antwort.json();
}

export async function aktualisiereKampagne(
  kid: string,
  aenderung: { name?: string; beschreibung?: string },
): Promise<Kampagne> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aenderung),
    }),
  );
  return antwort.json();
}

/** Struktur des von scripts/build-player.ts erzeugten player-data.json. */
interface SpielerJson {
  kampagne?: { name?: string; beschreibung?: string };
  entitaeten?: Entitaet[];
  kampagnenstand?: Partial<Kampagnenstand>;
}

/** Das statische Spieler-JSON wird nur einmal geladen und dann gecacht. */
let spielerDatenCache: Promise<SpielerJson> | null = null;
function ladeSpielerDaten(): Promise<SpielerJson> {
  spielerDatenCache ??= fetch(`${import.meta.env.BASE_URL}player-data.json`)
    .then(pruefe)
    .then((antwort) => antwort.json());
  return spielerDatenCache;
}

/** Lädt den kompletten Datenbestand einer Kampagne. */
export async function ladeAlles(kid: string): Promise<KampagnenDaten> {
  if (IST_SPIELER_MODUS) {
    // BASE_URL berücksichtigt den relativen Base-Path für GitHub Pages.
    const daten = await ladeSpielerDaten();
    return {
      entitaeten: daten.entitaeten ?? [],
      // Spieler-Daten enthalten nur die Whitelist-Felder; der Rest wird mit
      // neutralen Defaults aufgefüllt, damit die UI-Typen stimmen.
      kampagnenstand: { ...DEFAULT_KAMPAGNENSTAND, ...daten.kampagnenstand },
      widersacher: DEFAULT_WIDERSACHER,
      lesung: DEFAULT_LESUNG,
      kalender: DEFAULT_KALENDER,
    };
  }
  const antwort = await pruefe(await fetch(`/api/kampagnen/${kid}/alles`));
  return antwort.json();
}

export async function erstelleEntitaet(
  kid: string,
  typ: EntityTyp,
  daten: Partial<Entitaet> & { name: string },
): Promise<Entitaet> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/entitaeten/${typ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    }),
  );
  return antwort.json();
}

export async function aktualisiereEntitaet(
  kid: string,
  typ: EntityTyp,
  id: string,
  daten: Partial<Entitaet>,
): Promise<Entitaet> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/entitaeten/${typ}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    }),
  );
  return antwort.json();
}

export async function loescheEntitaet(kid: string, typ: EntityTyp, id: string): Promise<void> {
  await pruefe(await fetch(`/api/kampagnen/${kid}/entitaeten/${typ}/${id}`, { method: 'DELETE' }));
}

export async function speichereKampagnenstand(
  kid: string,
  stand: Kampagnenstand,
): Promise<Kampagnenstand> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/kampagnenstand`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stand),
    }),
  );
  return antwort.json();
}

export async function speichereWidersacher(
  kid: string,
  tracker: WidersacherTracker,
): Promise<WidersacherTracker> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/widersacher`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tracker),
    }),
  );
  return antwort.json();
}

// ---- Bilder ------------------------------------------------------------------

/** Lädt eine Bilddatei hoch; der Server vergibt den Dateinamen. */
export async function ladeBildHoch(kid: string, datei: File): Promise<string> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/bilder`, {
      method: 'POST',
      headers: { 'Content-Type': datei.type },
      body: datei,
    }),
  );
  const json = (await antwort.json()) as { datei: string };
  return json.datei;
}

/**
 * URL eines Kampagnen-Bildes. Im Spieler-Modus liegen die (gefilterten)
 * Bilder als statische Dateien unter bilder/ im Build.
 */
export function bildUrl(kid: string, datei: string): string {
  if (IST_SPIELER_MODUS) return `${import.meta.env.BASE_URL}bilder/${datei}`;
  return `/api/kampagnen/${kid}/bilder/${datei}`;
}

// ---- KI-Assistent (optional, nur DM-Modus) ----------------------------------

/** Status des optionalen KI-Assistenten (kein Key verlässt je den Server). */
export interface KiStatus {
  aktiv: boolean;
  provider?: string;
  modell?: string;
}

/** Eine vom Assistenten durchgeführte Änderung (Anzeige als Karte im Chat). */
export interface KiAktion {
  art: string;
  beschreibung: string;
  entitaetId?: string;
  typ?: EntityTyp;
}

/** Fragt ab, ob der KI-Assistent serverseitig konfiguriert ist. */
export async function ladeKiStatus(): Promise<KiStatus> {
  if (IST_SPIELER_MODUS) return { aktiv: false };
  try {
    const antwort = await fetch('/api/ki/status');
    if (!antwort.ok) return { aktiv: false };
    return (await antwort.json()) as KiStatus;
  } catch {
    return { aktiv: false };
  }
}

/**
 * Sendet den Gesprächsverlauf an den Assistenten der aktiven Kampagne.
 * `sprache` steuert die Antwortsprache und die Aktions-Beschreibungen.
 */
export async function sendeKiChat(
  kid: string,
  nachrichten: { rolle: 'nutzer' | 'assistent'; text: string }[],
  sprache: string = 'de',
): Promise<{ antwort: string; aktionen: KiAktion[] }> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nachrichten, sprache }),
    }),
  );
  return antwort.json();
}

export async function speichereLesung(kid: string, lesung: Lesung): Promise<Lesung> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/lesung`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lesung),
    }),
  );
  return antwort.json();
}

export async function speichereKalender(kid: string, kalender: Kalender): Promise<Kalender> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/kalender`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kalender),
    }),
  );
  return antwort.json();
}

// ---- Auth & SaaS-Konfiguration ----------------------------------------------
// Nur im SaaS-Modus (CAMPANIUM_SAAS am Server) relevant. In der Self-Host-
// Variante meldet /api/config `saas:false` und es gibt keinen Login.

export type Rolle = 'nutzer' | 'admin';

/** Öffentliche Konto-Sicht (ohne Passwort-Hash). */
export interface AuthNutzer {
  id: string;
  email: string;
  rolle: Rolle;
  plan: string;
}

/** Bootstrap-Konfiguration: läuft der Server im SaaS-Modus? */
export interface AppKonfig {
  saas: boolean;
}

/** Fragt vor allem anderen ab, ob Login-Pflicht besteht. */
export async function ladeAppKonfig(): Promise<AppKonfig> {
  if (IST_SPIELER_MODUS) return { saas: false };
  try {
    const antwort = await fetch('/api/config');
    if (!antwort.ok) return { saas: false };
    return (await antwort.json()) as AppKonfig;
  } catch {
    // Kein Server erreichbar → wie Self-Host behandeln (Fehler zeigt der Store).
    return { saas: false };
  }
}

/** Aktuell angemeldetes Konto – oder null (nicht angemeldet). */
export async function ladeMich(): Promise<AuthNutzer | null> {
  try {
    const antwort = await fetch('/api/auth/me');
    if (!antwort.ok) return null;
    return (await antwort.json()) as AuthNutzer;
  } catch {
    return null;
  }
}

export async function meldeAn(email: string, passwort: string): Promise<AuthNutzer> {
  const antwort = await pruefe(
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, passwort }),
    }),
  );
  return antwort.json();
}

export async function registriere(email: string, passwort: string): Promise<AuthNutzer> {
  const antwort = await pruefe(
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, passwort }),
    }),
  );
  return antwort.json();
}

export async function meldeAb(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
