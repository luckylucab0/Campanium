/**
 * Zentraler Daten-Store (React-Context).
 *
 * Lädt beim Start ALLE Daten (Kampagnen sind klein genug) und hält sie im
 * Speicher. Daraus werden abgeleitet:
 *  - Lookup per ID und per Name (für Wikilink-Auflösung, case-insensitiv)
 *  - der Backlink-Index: welche Entität erwähnt welche andere per [[Name]]
 *    oder verweist per Referenzfeld (ortId, questgeberId, …) auf sie
 *
 * Alle Mutationen gehen durch den Server (Write-Through) und aktualisieren
 * anschließend den lokalen Zustand.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Entitaet,
  EntityTyp,
  Kampagnenstand,
  StrahdTracker,
  TarokkaLesung,
} from '@ravenloft/shared';
import { parseWikilinks } from '@ravenloft/shared';
import * as api from './api';

interface StoreWert {
  geladen: boolean;
  ladeFehler: string | null;
  entitaeten: Entitaet[];
  kampagnenstand: Kampagnenstand;
  strahdTracker: StrahdTracker;
  tarokka: TarokkaLesung;
  /** Entität per ID nachschlagen. */
  perId: (id: string) => Entitaet | undefined;
  /** Entität per Name nachschlagen (case-insensitiv) – für [[Wikilinks]]. */
  perName: (name: string) => Entitaet | undefined;
  /** Alle Entitäten, die die übergebene Entität erwähnen oder referenzieren. */
  backlinks: (id: string) => Entitaet[];
  erstellen: (typ: EntityTyp, daten: Partial<Entitaet> & { name: string }) => Promise<Entitaet>;
  aktualisieren: (typ: EntityTyp, id: string, daten: Partial<Entitaet>) => Promise<Entitaet>;
  loeschen: (typ: EntityTyp, id: string) => Promise<void>;
  setzeKampagnenstand: (stand: Kampagnenstand) => Promise<void>;
  setzeStrahdTracker: (tracker: StrahdTracker) => Promise<void>;
  setzeTarokka: (lesung: TarokkaLesung) => Promise<void>;
}

const StoreContext = createContext<StoreWert | null>(null);

/** Alle String-Felder einer Entität (Markdown + Einzeiler) für die Linksuche. */
function alleTextfelder(e: Entitaet): string[] {
  return Object.values(e).filter((w): w is string => typeof w === 'string');
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [geladen, setGeladen] = useState(false);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [entitaeten, setEntitaeten] = useState<Entitaet[]>([]);
  const [kampagnenstand, setKampagnenstandState] = useState<Kampagnenstand>(
    null as unknown as Kampagnenstand,
  );
  const [strahdTracker, setStrahdTrackerState] = useState<StrahdTracker>(
    null as unknown as StrahdTracker,
  );
  const [tarokka, setTarokkaState] = useState<TarokkaLesung>(null as unknown as TarokkaLesung);

  useEffect(() => {
    api
      .ladeAlles()
      .then((daten) => {
        setEntitaeten(daten.entitaeten);
        setKampagnenstandState(daten.kampagnenstand);
        setStrahdTrackerState(daten.strahdTracker);
        setTarokkaState(daten.tarokka);
        setGeladen(true);
      })
      .catch((fehler: Error) => setLadeFehler(fehler.message));
  }, []);

  const idIndex = useMemo(() => new Map(entitaeten.map((e) => [e.id, e])), [entitaeten]);
  const nameIndex = useMemo(
    () => new Map(entitaeten.map((e) => [e.name.toLowerCase(), e])),
    [entitaeten],
  );

  /**
   * Backlink-Index: Ziel-ID → Menge der Entitäten, die darauf verweisen.
   * Quellen: [[Wikilinks]] in allen Textfeldern (per Name aufgelöst) und
   * Referenzfelder, deren Name auf "Id" endet (ortId, besitzerId, …).
   */
  const backlinkIndex = useMemo(() => {
    const index = new Map<string, Entitaet[]>();
    const merken = (zielId: string, quelle: Entitaet) => {
      if (zielId === quelle.id) return;
      const liste = index.get(zielId) ?? [];
      if (!liste.some((e) => e.id === quelle.id)) liste.push(quelle);
      index.set(zielId, liste);
    };
    for (const quelle of entitaeten) {
      for (const text of alleTextfelder(quelle)) {
        for (const link of parseWikilinks(text)) {
          const ziel = nameIndex.get(link.ziel.toLowerCase());
          if (ziel) merken(ziel.id, quelle);
        }
      }
      for (const [feld, wert] of Object.entries(quelle)) {
        if (feld.endsWith('Id') && typeof wert === 'string' && idIndex.has(wert)) {
          merken(wert, quelle);
        }
      }
    }
    return index;
  }, [entitaeten, nameIndex, idIndex]);

  const perId = useCallback((id: string) => idIndex.get(id), [idIndex]);
  const perName = useCallback(
    (name: string) => nameIndex.get(name.toLowerCase().trim()),
    [nameIndex],
  );
  const backlinks = useCallback((id: string) => backlinkIndex.get(id) ?? [], [backlinkIndex]);

  const erstellen = useCallback(
    async (typ: EntityTyp, daten: Partial<Entitaet> & { name: string }) => {
      const neu = await api.erstelleEntitaet(typ, daten);
      setEntitaeten((alt) => [...alt, neu]);
      return neu;
    },
    [],
  );

  const aktualisieren = useCallback(
    async (typ: EntityTyp, id: string, daten: Partial<Entitaet>) => {
      const aktualisiert = await api.aktualisiereEntitaet(typ, id, daten);
      setEntitaeten((alt) => alt.map((e) => (e.id === id ? aktualisiert : e)));
      return aktualisiert;
    },
    [],
  );

  const loeschen = useCallback(async (typ: EntityTyp, id: string) => {
    await api.loescheEntitaet(typ, id);
    setEntitaeten((alt) => alt.filter((e) => e.id !== id));
  }, []);

  const setzeKampagnenstand = useCallback(async (stand: Kampagnenstand) => {
    setKampagnenstandState(stand); // optimistisch, Tracker sollen sofort reagieren
    await api.speichereKampagnenstand(stand);
  }, []);

  const setzeStrahdTracker = useCallback(async (tracker: StrahdTracker) => {
    setStrahdTrackerState(tracker);
    await api.speichereStrahdTracker(tracker);
  }, []);

  const setzeTarokka = useCallback(async (lesung: TarokkaLesung) => {
    setTarokkaState(lesung);
    await api.speichereTarokka(lesung);
  }, []);

  const wert: StoreWert = {
    geladen,
    ladeFehler,
    entitaeten,
    kampagnenstand,
    strahdTracker,
    tarokka,
    perId,
    perName,
    backlinks,
    erstellen,
    aktualisieren,
    loeschen,
    setzeKampagnenstand,
    setzeStrahdTracker,
    setzeTarokka,
  };

  return <StoreContext.Provider value={wert}>{children}</StoreContext.Provider>;
}

/** Zugriff auf den Daten-Store; wirft außerhalb des Providers. */
export function useStore(): StoreWert {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore muss innerhalb von <StoreProvider> verwendet werden');
  return store;
}
