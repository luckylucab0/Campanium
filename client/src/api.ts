/**
 * API-Schicht mit zwei Betriebsmodi:
 *  - DM-Modus (Standard): spricht die REST-API des lokalen Servers an.
 *  - Spieler-Modus (vite build --mode player): lädt ein statisches,
 *    bereits spoiler-gefiltertes player-data.json; Schreiben ist unmöglich.
 */
import type {
  Entitaet,
  EntityTyp,
  Kampagnenstand,
  StrahdTracker,
  TarokkaLesung,
} from '@ravenloft/shared';
import { DEFAULT_KAMPAGNENSTAND, DEFAULT_STRAHD_TRACKER, DEFAULT_TAROKKA } from '@ravenloft/shared';

/** true, wenn dieser Build der read-only Spieler-Build ist. */
export const IST_SPIELER_MODUS = import.meta.env.MODE === 'player';

export interface AlleDaten {
  entitaeten: Entitaet[];
  kampagnenstand: Kampagnenstand;
  strahdTracker: StrahdTracker;
  tarokka: TarokkaLesung;
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

/** Lädt den kompletten Datenbestand (DM: API, Spieler: statisches JSON). */
export async function ladeAlles(): Promise<AlleDaten> {
  if (IST_SPIELER_MODUS) {
    // BASE_URL berücksichtigt den relativen Base-Path für GitHub Pages.
    const antwort = await pruefe(await fetch(`${import.meta.env.BASE_URL}player-data.json`));
    const daten = await antwort.json();
    return {
      entitaeten: daten.entitaeten,
      // Spieler-Daten enthalten nur die Whitelist-Felder; der Rest wird mit
      // neutralen Defaults aufgefüllt, damit die UI-Typen stimmen.
      kampagnenstand: { ...DEFAULT_KAMPAGNENSTAND, ...daten.kampagnenstand },
      strahdTracker: DEFAULT_STRAHD_TRACKER,
      tarokka: DEFAULT_TAROKKA,
    };
  }
  const antwort = await pruefe(await fetch('/api/alles'));
  return antwort.json();
}

export async function erstelleEntitaet(
  typ: EntityTyp,
  daten: Partial<Entitaet> & { name: string },
): Promise<Entitaet> {
  const antwort = await pruefe(
    await fetch(`/api/entitaeten/${typ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    }),
  );
  return antwort.json();
}

export async function aktualisiereEntitaet(
  typ: EntityTyp,
  id: string,
  daten: Partial<Entitaet>,
): Promise<Entitaet> {
  const antwort = await pruefe(
    await fetch(`/api/entitaeten/${typ}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    }),
  );
  return antwort.json();
}

export async function loescheEntitaet(typ: EntityTyp, id: string): Promise<void> {
  await pruefe(await fetch(`/api/entitaeten/${typ}/${id}`, { method: 'DELETE' }));
}

export async function speichereKampagnenstand(stand: Kampagnenstand): Promise<Kampagnenstand> {
  const antwort = await pruefe(
    await fetch('/api/kampagnenstand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stand),
    }),
  );
  return antwort.json();
}

export async function speichereStrahdTracker(tracker: StrahdTracker): Promise<StrahdTracker> {
  const antwort = await pruefe(
    await fetch('/api/strahd-tracker', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tracker),
    }),
  );
  return antwort.json();
}

export async function speichereTarokka(lesung: TarokkaLesung): Promise<TarokkaLesung> {
  const antwort = await pruefe(
    await fetch('/api/tarokka', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lesung),
    }),
  );
  return antwort.json();
}
