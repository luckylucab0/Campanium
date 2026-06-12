/**
 * Dateibasierter Speicher: eine JSON-Datei pro Entität mit sprechendem
 * Dateinamen (data/<typ>/<id>.json), Singletons als einzelne Dateien.
 *
 * Bewusst ohne Datenbank: Die Dateien sind menschenlesbar, lassen sich
 * mit Git versionieren und notfalls von Hand reparieren. Beim Start wird
 * alles in den Speicher geladen; Schreibzugriffe gehen sofort auf die Platte
 * (Write-Through), damit nie Daten verloren gehen.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_KAMPAGNENSTAND,
  DEFAULT_STRAHD_TRACKER,
  DEFAULT_TAROKKA,
  ENTITY_TYPEN,
  type Entitaet,
  type EntityTyp,
  type Kampagnenstand,
  type StrahdTracker,
  type TarokkaLesung,
  validiereEntitaet,
} from '@ravenloft/shared';

const SINGLETON_DATEIEN = {
  kampagnenstand: 'kampagnenstand.json',
  strahdTracker: 'strahd-tracker.json',
  tarokka: 'tarokka-lesung.json',
} as const;

export class Storage {
  private entitaeten = new Map<string, Entitaet>();
  kampagnenstand: Kampagnenstand = DEFAULT_KAMPAGNENSTAND;
  strahdTracker: StrahdTracker = DEFAULT_STRAHD_TRACKER;
  tarokka: TarokkaLesung = DEFAULT_TAROKKA;

  constructor(public readonly datenOrdner: string) {}

  /** Lädt alle Dateien aus data/ in den Speicher. Legt fehlende Strukturen an. */
  laden(): void {
    fs.mkdirSync(this.datenOrdner, { recursive: true });

    for (const typ of ENTITY_TYPEN) {
      const ordner = path.join(this.datenOrdner, typ);
      if (!fs.existsSync(ordner)) continue;
      for (const datei of fs.readdirSync(ordner)) {
        if (!datei.endsWith('.json')) continue;
        const voll = path.join(ordner, datei);
        try {
          const roh = JSON.parse(fs.readFileSync(voll, 'utf-8'));
          const entitaet = validiereEntitaet(typ, roh);
          this.entitaeten.set(entitaet.id, entitaet);
        } catch (fehler) {
          // Kaputte Dateien überspringen statt den Start zu verhindern –
          // der DM kann sie von Hand reparieren.
          console.error(`⚠ Datei übersprungen (ungültig): ${voll}`, fehler);
        }
      }
    }

    this.kampagnenstand = this.ladeSingleton('kampagnenstand', DEFAULT_KAMPAGNENSTAND);
    this.strahdTracker = this.ladeSingleton('strahdTracker', DEFAULT_STRAHD_TRACKER);
    this.tarokka = this.ladeSingleton('tarokka', DEFAULT_TAROKKA);
  }

  private ladeSingleton<T>(schluessel: keyof typeof SINGLETON_DATEIEN, fallback: T): T {
    const datei = path.join(this.datenOrdner, SINGLETON_DATEIEN[schluessel]);
    if (!fs.existsSync(datei)) return structuredClone(fallback);
    try {
      return JSON.parse(fs.readFileSync(datei, 'utf-8')) as T;
    } catch (fehler) {
      console.error(`⚠ Singleton übersprungen (ungültig): ${datei}`, fehler);
      return structuredClone(fallback);
    }
  }

  alle(): Entitaet[] {
    return [...this.entitaeten.values()];
  }

  vorhandeneIds(): Set<string> {
    return new Set(this.entitaeten.keys());
  }

  holen(id: string): Entitaet | undefined {
    return this.entitaeten.get(id);
  }

  /** Schreibt eine Entität in den Speicher UND auf die Platte. */
  speichern(entitaet: Entitaet): void {
    this.entitaeten.set(entitaet.id, entitaet);
    const ordner = path.join(this.datenOrdner, entitaet.typ);
    fs.mkdirSync(ordner, { recursive: true });
    fs.writeFileSync(
      path.join(ordner, `${entitaet.id}.json`),
      JSON.stringify(entitaet, null, 2) + '\n',
    );
  }

  loeschen(id: string): boolean {
    const entitaet = this.entitaeten.get(id);
    if (!entitaet) return false;
    this.entitaeten.delete(id);
    const datei = path.join(this.datenOrdner, entitaet.typ, `${id}.json`);
    if (fs.existsSync(datei)) fs.unlinkSync(datei);
    return true;
  }

  speichereSingleton(
    schluessel: keyof typeof SINGLETON_DATEIEN,
    daten: Kampagnenstand | StrahdTracker | TarokkaLesung,
  ): void {
    fs.mkdirSync(this.datenOrdner, { recursive: true });
    fs.writeFileSync(
      path.join(this.datenOrdner, SINGLETON_DATEIEN[schluessel]),
      JSON.stringify(daten, null, 2) + '\n',
    );
  }
}

/** Liest Entitäten + Singletons direkt aus einem Ordner (für Build-Skripte). */
export function ladeDatenOrdner(datenOrdner: string): {
  entitaeten: Entitaet[];
  kampagnenstand: Kampagnenstand;
} {
  const storage = new Storage(datenOrdner);
  storage.laden();
  return { entitaeten: storage.alle(), kampagnenstand: storage.kampagnenstand };
}

/** Typ-Guard für Routen-Parameter. */
export function istEntityTyp(wert: string): wert is EntityTyp {
  return (ENTITY_TYPEN as readonly string[]).includes(wert);
}
