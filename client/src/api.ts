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
  Kampagne,
  Kampagnenstand,
  Lesung,
  WidersacherTracker,
} from '@campanium/shared';
import { DEFAULT_KAMPAGNENSTAND, DEFAULT_LESUNG, DEFAULT_WIDERSACHER } from '@campanium/shared';

/** true, wenn dieser Build der read-only Spieler-Build ist. */
export const IST_SPIELER_MODUS = import.meta.env.MODE === 'player';

/** Kennung der Spieler-Kampagne im Store (es gibt im Spieler-Build nur eine). */
export const SPIELER_KAMPAGNE_ID = 'spieler';

export interface KampagnenDaten {
  entitaeten: Entitaet[];
  kampagnenstand: Kampagnenstand;
  widersacher: WidersacherTracker;
  lesung: Lesung;
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

/** Sendet den Gesprächsverlauf an den Assistenten der aktiven Kampagne. */
export async function sendeKiChat(
  kid: string,
  nachrichten: { rolle: 'nutzer' | 'assistent'; text: string }[],
): Promise<{ antwort: string; aktionen: KiAktion[] }> {
  const antwort = await pruefe(
    await fetch(`/api/kampagnen/${kid}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nachrichten }),
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
