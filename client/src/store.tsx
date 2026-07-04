// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Zentraler Daten-Store (React-Context) mit Kampagnen-Verwaltung.
 *
 * Beim Start wird die Kampagnen-Liste geladen; die zuletzt geöffnete
 * Kampagne (localStorage) oder die erste wird aktiviert. Ein Kampagnen-
 * Wechsel lädt den kompletten Datenbestand der neuen Kampagne (Kampagnen
 * sind klein genug, um alles im Speicher zu halten). Daraus werden
 * abgeleitet:
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
  Kalender,
  Kampagne,
  Kampagnenstand,
  Lesung,
  WidersacherTracker,
} from '@campanium/shared';
import { parseWikilinks } from '@campanium/shared';
import * as api from './api';

const KAMPAGNE_STORAGE_KEY = 'aktuelleKampagne';

interface StoreWert {
  geladen: boolean;
  ladeFehler: string | null;
  /** Alle bekannten Kampagnen. */
  kampagnen: Kampagne[];
  /** Die gerade geöffnete Kampagne (null = noch keine vorhanden/gewählt). */
  kampagne: Kampagne | null;
  /** Wechselt zur Kampagne mit der übergebenen ID und lädt deren Daten. */
  wechsleKampagne: (id: string) => void;
  /** Lädt die aktive Kampagne still neu (z. B. nach Änderungen durch den KI-Assistenten). */
  neuLaden: () => Promise<void>;
  neueKampagne: (name: string, beschreibung: string) => Promise<Kampagne>;
  benenneKampagneUm: (aenderung: { name?: string; beschreibung?: string }) => Promise<void>;
  entitaeten: Entitaet[];
  kampagnenstand: Kampagnenstand;
  widersacher: WidersacherTracker;
  lesung: Lesung;
  kalender: Kalender;
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
  setzeWidersacher: (tracker: WidersacherTracker) => Promise<void>;
  setzeLesung: (lesung: Lesung) => Promise<void>;
  setzeKalender: (kalender: Kalender) => Promise<void>;
}

const StoreContext = createContext<StoreWert | null>(null);

/** Alle String-Felder einer Entität (Markdown + Einzeiler) für die Linksuche. */
function alleTextfelder(e: Entitaet): string[] {
  return Object.values(e).filter((w): w is string => typeof w === 'string');
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [geladen, setGeladen] = useState(false);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [kampagnen, setKampagnen] = useState<Kampagne[]>([]);
  const [aktuelleId, setAktuelleId] = useState<string | null>(null);
  const [entitaeten, setEntitaeten] = useState<Entitaet[]>([]);
  const [kampagnenstand, setKampagnenstandState] = useState<Kampagnenstand>(
    null as unknown as Kampagnenstand,
  );
  const [widersacher, setWidersacherState] = useState<WidersacherTracker>(
    null as unknown as WidersacherTracker,
  );
  const [lesung, setLesungState] = useState<Lesung>(null as unknown as Lesung);
  const [kalender, setKalenderState] = useState<Kalender>(null as unknown as Kalender);

  // Schritt 1: Kampagnen-Liste laden und Start-Kampagne bestimmen.
  useEffect(() => {
    api
      .ladeKampagnen()
      .then((liste) => {
        setKampagnen(liste);
        const gespeichert = localStorage.getItem(KAMPAGNE_STORAGE_KEY);
        const start = liste.find((k) => k.id === gespeichert) ?? liste[0];
        if (start) {
          setAktuelleId(start.id);
        } else {
          // Keine Kampagne vorhanden – die UI zeigt den Anlegen-Bildschirm.
          setGeladen(true);
        }
      })
      .catch((fehler: Error) => setLadeFehler(fehler.message));
  }, []);

  // Schritt 2: Bei (Wechsel der) aktiver Kampagne deren Daten laden.
  useEffect(() => {
    if (!aktuelleId) return;
    setGeladen(false);
    api
      .ladeAlles(aktuelleId)
      .then((daten) => {
        setEntitaeten(daten.entitaeten);
        setKampagnenstandState(daten.kampagnenstand);
        setWidersacherState(daten.widersacher);
        setLesungState(daten.lesung);
        setKalenderState(daten.kalender);
        setGeladen(true);
      })
      .catch((fehler: Error) => setLadeFehler(fehler.message));
  }, [aktuelleId]);

  const kampagne = useMemo(
    () => kampagnen.find((k) => k.id === aktuelleId) ?? null,
    [kampagnen, aktuelleId],
  );

  const neuLaden = useCallback(async () => {
    if (!aktuelleId) return;
    // Bewusst ohne Lade-Zustand: stiller Refresh, die UI bleibt stehen.
    const daten = await api.ladeAlles(aktuelleId);
    setEntitaeten(daten.entitaeten);
    setKampagnenstandState(daten.kampagnenstand);
    setWidersacherState(daten.widersacher);
    setLesungState(daten.lesung);
    setKalenderState(daten.kalender);
  }, [aktuelleId]);

  const wechsleKampagne = useCallback((id: string) => {
    localStorage.setItem(KAMPAGNE_STORAGE_KEY, id);
    setAktuelleId(id);
  }, []);

  const neueKampagne = useCallback(
    async (name: string, beschreibung: string) => {
      const kampagneNeu = await api.erstelleKampagne(name, beschreibung);
      setKampagnen((alt) =>
        [...alt, kampagneNeu].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      );
      wechsleKampagne(kampagneNeu.id);
      return kampagneNeu;
    },
    [wechsleKampagne],
  );

  const benenneKampagneUm = useCallback(
    async (aenderung: { name?: string; beschreibung?: string }) => {
      if (!aktuelleId) return;
      const aktualisiert = await api.aktualisiereKampagne(aktuelleId, aenderung);
      setKampagnen((alt) => alt.map((k) => (k.id === aktualisiert.id ? aktualisiert : k)));
    },
    [aktuelleId],
  );

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

  /** Wirft, wenn keine Kampagne aktiv ist – schützt alle Mutationen. */
  const kid = useCallback(() => {
    if (!aktuelleId) throw new Error('Keine Kampagne aktiv');
    return aktuelleId;
  }, [aktuelleId]);

  const erstellen = useCallback(
    async (typ: EntityTyp, daten: Partial<Entitaet> & { name: string }) => {
      const neu = await api.erstelleEntitaet(kid(), typ, daten);
      setEntitaeten((alt) => [...alt, neu]);
      return neu;
    },
    [kid],
  );

  const aktualisieren = useCallback(
    async (typ: EntityTyp, id: string, daten: Partial<Entitaet>) => {
      const aktualisiert = await api.aktualisiereEntitaet(kid(), typ, id, daten);
      setEntitaeten((alt) => alt.map((e) => (e.id === id ? aktualisiert : e)));
      return aktualisiert;
    },
    [kid],
  );

  const loeschen = useCallback(
    async (typ: EntityTyp, id: string) => {
      await api.loescheEntitaet(kid(), typ, id);
      setEntitaeten((alt) => alt.filter((e) => e.id !== id));
    },
    [kid],
  );

  const setzeKampagnenstand = useCallback(
    async (stand: Kampagnenstand) => {
      setKampagnenstandState(stand); // optimistisch, Tracker sollen sofort reagieren
      await api.speichereKampagnenstand(kid(), stand);
    },
    [kid],
  );

  const setzeWidersacher = useCallback(
    async (tracker: WidersacherTracker) => {
      setWidersacherState(tracker);
      await api.speichereWidersacher(kid(), tracker);
    },
    [kid],
  );

  const setzeLesung = useCallback(
    async (neu: Lesung) => {
      setLesungState(neu);
      await api.speichereLesung(kid(), neu);
    },
    [kid],
  );

  const setzeKalender = useCallback(
    async (neu: Kalender) => {
      setKalenderState(neu);
      await api.speichereKalender(kid(), neu);
    },
    [kid],
  );

  const wert: StoreWert = {
    geladen,
    ladeFehler,
    kampagnen,
    kampagne,
    wechsleKampagne,
    neuLaden,
    neueKampagne,
    benenneKampagneUm,
    entitaeten,
    kampagnenstand,
    widersacher,
    lesung,
    kalender,
    perId,
    perName,
    backlinks,
    erstellen,
    aktualisieren,
    loeschen,
    setzeKampagnenstand,
    setzeWidersacher,
    setzeLesung,
    setzeKalender,
  };

  return <StoreContext.Provider value={wert}>{children}</StoreContext.Provider>;
}

/** Zugriff auf den Daten-Store; wirft außerhalb des Providers. */
export function useStore(): StoreWert {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore muss innerhalb von <StoreProvider> verwendet werden');
  return store;
}
