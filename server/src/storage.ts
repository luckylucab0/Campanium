/**
 * Dateibasierter Speicher mit Kampagnen als oberster Ebene:
 *
 *   data/
 *     <kampagnen-id>/
 *       kampagne.json          Manifest (Name, Beschreibung, …)
 *       kampagnenstand.json    Singleton
 *       widersacher-tracker.json
 *       lesung.json
 *       nsc/<id>.json          eine Datei pro Entität
 *       quest/<id>.json …
 *
 * Bewusst ohne Datenbank: Die Dateien sind menschenlesbar, lassen sich
 * mit Git versionieren und notfalls von Hand reparieren. Beim Start wird
 * alles in den Speicher geladen; Schreibzugriffe gehen sofort auf die
 * Platte (Write-Through), damit nie Daten verloren gehen.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_KALENDER,
  DEFAULT_KAMPAGNENSTAND,
  DEFAULT_LESUNG,
  DEFAULT_WIDERSACHER,
  eindeutigerSlug,
  ENTITY_TYPEN,
  kampagneSchema,
  validiereEntitaet,
  type Entitaet,
  type EntityTyp,
  type Kalender,
  type Kampagne,
  type Kampagnenstand,
  type Lesung,
  type WidersacherTracker,
} from '@campanium/shared';

const SINGLETON_DATEIEN = {
  kampagnenstand: 'kampagnenstand.json',
  widersacher: 'widersacher-tracker.json',
  lesung: 'lesung.json',
  kalender: 'kalender.json',
} as const;

/** Speicher für genau EINE Kampagne (ein Unterordner von data/). */
export class Storage {
  private entitaeten = new Map<string, Entitaet>();
  kampagnenstand: Kampagnenstand = DEFAULT_KAMPAGNENSTAND;
  widersacher: WidersacherTracker = DEFAULT_WIDERSACHER;
  lesung: Lesung = DEFAULT_LESUNG;
  kalender: Kalender = DEFAULT_KALENDER;

  constructor(public readonly datenOrdner: string) {}

  /** Lädt alle Dateien der Kampagne in den Speicher. */
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
    this.widersacher = this.ladeSingleton('widersacher', DEFAULT_WIDERSACHER);
    this.lesung = this.ladeSingleton('lesung', DEFAULT_LESUNG);
    this.kalender = this.ladeSingleton('kalender', DEFAULT_KALENDER);
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
    daten: Kampagnenstand | WidersacherTracker | Lesung | Kalender,
  ): void {
    fs.mkdirSync(this.datenOrdner, { recursive: true });
    fs.writeFileSync(
      path.join(this.datenOrdner, SINGLETON_DATEIEN[schluessel]),
      JSON.stringify(daten, null, 2) + '\n',
    );
  }

  // ---- Bilder ---------------------------------------------------------------
  // Hochgeladene Bilder (Portraits, Kartengrafiken) liegen als normale
  // Dateien in data/<kampagne>/bilder/; Entitäten referenzieren sie nur
  // per Dateiname im Feld `bild`.

  /** Ordner für die Bilder dieser Kampagne. */
  get bilderOrdner(): string {
    return path.join(this.datenOrdner, 'bilder');
  }

  /** Erlaubte Bild-Dateinamen: nur ein einzelnes, harmloses Pfadsegment. */
  static istSichererDateiname(datei: string): boolean {
    return /^[\w][\w.-]{0,127}$/.test(datei) && !datei.includes('..');
  }

  /** Schreibt eine Bilddatei in den bilder/-Ordner. */
  speichereBild(datei: string, daten: Buffer): void {
    if (!Storage.istSichererDateiname(datei)) throw new Error(`Unsicherer Dateiname: ${datei}`);
    fs.mkdirSync(this.bilderOrdner, { recursive: true });
    fs.writeFileSync(path.join(this.bilderOrdner, datei), daten);
  }

  /** Absoluter Pfad einer vorhandenen Bilddatei – sonst null. */
  bildPfad(datei: string): string | null {
    if (!Storage.istSichererDateiname(datei)) return null;
    const voll = path.join(this.bilderOrdner, datei);
    return fs.existsSync(voll) ? voll : null;
  }
}

/**
 * Verwaltung aller Kampagnen: scannt data/ nach Unterordnern mit
 * kampagne.json und hält pro Kampagne einen Storage.
 */
export class KampagnenVerwaltung {
  private kampagnen = new Map<string, { kampagne: Kampagne; storage: Storage }>();

  constructor(public readonly datenWurzel: string) {}

  laden(): void {
    fs.mkdirSync(this.datenWurzel, { recursive: true });

    // Hinweis für Nutzer des alten, kampagnen-losen Layouts (Entitäts-Ordner
    // direkt in data/): einmalig warnen statt still nichts zu laden.
    const altesLayout = ENTITY_TYPEN.some((typ) => fs.existsSync(path.join(this.datenWurzel, typ)));
    if (altesLayout) {
      console.error(
        '⚠ data/ nutzt noch das alte Layout ohne Kampagnen-Ordner.\n' +
          '  Migration: Unterordner anlegen (z. B. data/meine-kampagne/), alle\n' +
          '  Entitäts-Ordner und Singleton-Dateien hineinschieben und eine\n' +
          '  kampagne.json ergänzen (siehe data.example/curse-of-strahd/).',
      );
    }

    for (const eintrag of fs.readdirSync(this.datenWurzel, { withFileTypes: true })) {
      if (!eintrag.isDirectory()) continue;
      const manifestDatei = path.join(this.datenWurzel, eintrag.name, 'kampagne.json');
      if (!fs.existsSync(manifestDatei)) continue;
      try {
        const kampagne = kampagneSchema.parse(
          JSON.parse(fs.readFileSync(manifestDatei, 'utf-8')),
        ) as Kampagne;
        const storage = new Storage(path.join(this.datenWurzel, eintrag.name));
        storage.laden();
        this.kampagnen.set(kampagne.id, { kampagne, storage });
      } catch (fehler) {
        console.error(`⚠ Kampagne übersprungen (ungültiges Manifest): ${manifestDatei}`, fehler);
      }
    }
  }

  liste(): Kampagne[] {
    return [...this.kampagnen.values()]
      .map((k) => k.kampagne)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  holen(id: string): { kampagne: Kampagne; storage: Storage } | undefined {
    return this.kampagnen.get(id);
  }

  /** Legt eine neue Kampagne an (Ordner + Manifest + leere Singletons). */
  anlegen(name: string, beschreibung: string): Kampagne {
    const id = eindeutigerSlug(name, new Set(this.kampagnen.keys()));
    const kampagne: Kampagne = {
      id,
      name,
      beschreibung,
      erstellt: new Date().toISOString(),
    };
    const ordner = path.join(this.datenWurzel, id);
    fs.mkdirSync(ordner, { recursive: true });
    fs.writeFileSync(path.join(ordner, 'kampagne.json'), JSON.stringify(kampagne, null, 2) + '\n');
    const storage = new Storage(ordner);
    storage.laden();
    this.kampagnen.set(id, { kampagne, storage });
    return kampagne;
  }

  /** Aktualisiert Name/Beschreibung einer Kampagne (ID bleibt stabil). */
  aktualisieren(id: string, aenderung: { name?: string; beschreibung?: string }): Kampagne {
    const eintrag = this.kampagnen.get(id);
    if (!eintrag) throw new Error(`Kampagne nicht gefunden: ${id}`);
    const neu: Kampagne = {
      ...eintrag.kampagne,
      ...(aenderung.name !== undefined ? { name: aenderung.name } : {}),
      ...(aenderung.beschreibung !== undefined ? { beschreibung: aenderung.beschreibung } : {}),
    };
    fs.writeFileSync(
      path.join(this.datenWurzel, id, 'kampagne.json'),
      JSON.stringify(neu, null, 2) + '\n',
    );
    this.kampagnen.set(id, { kampagne: neu, storage: eintrag.storage });
    return neu;
  }
}

/** Liest eine einzelne Kampagne direkt aus einem Ordner (für Build-Skripte). */
export function ladeKampagnenOrdner(ordner: string): {
  kampagne: Kampagne;
  entitaeten: Entitaet[];
  kampagnenstand: Kampagnenstand;
} {
  const kampagne = kampagneSchema.parse(
    JSON.parse(fs.readFileSync(path.join(ordner, 'kampagne.json'), 'utf-8')),
  ) as Kampagne;
  const storage = new Storage(ordner);
  storage.laden();
  return { kampagne, entitaeten: storage.alle(), kampagnenstand: storage.kampagnenstand };
}

/** Typ-Guard für Routen-Parameter. */
export function istEntityTyp(wert: string): wert is EntityTyp {
  return (ENTITY_TYPEN as readonly string[]).includes(wert);
}
