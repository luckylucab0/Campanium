// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Konten-Speicher für den SaaS-Modus. Nur aktiv, wenn CAMPANIUM_SAAS gesetzt
 * ist; die Self-Host-Variante kennt keine Konten.
 *
 * Alle Konten liegen in einer einzigen Datei `data/users.json`. Passwörter
 * werden NIE im Klartext gespeichert: pro Konto ein zufälliger Salt und ein
 * scrypt-Hash (node:crypto, keine externe Krypto-Abhängigkeit). Der Vergleich
 * läuft zeitkonstant über `timingSafeEqual`.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

export type Rolle = 'nutzer' | 'admin';

/** Vollständiger Konto-Datensatz (inkl. Hash – verlässt nie den Server). */
export interface Nutzer {
  id: string;
  email: string;
  passwortHash: string;
  salt: string;
  rolle: Rolle;
  /** Abo-Stufe; in Phase 2 typisiert. Default `frei`. */
  plan: string;
  erstellt: string;
}

/** Öffentliche Sicht auf ein Konto (an den Client ausgeliefert, ohne Hash). */
export interface OeffentlicherNutzer {
  id: string;
  email: string;
  rolle: Rolle;
  plan: string;
}

/** scrypt-Parameter (Standardkosten, ausreichend für ein Self-Host-SaaS). */
const SCRYPT_LAENGE = 64;

export function oeffentlich(nutzer: Nutzer): OeffentlicherNutzer {
  return { id: nutzer.id, email: nutzer.email, rolle: nutzer.rolle, plan: nutzer.plan };
}

export class NutzerStore {
  private nutzer = new Map<string, Nutzer>();

  /**
   * @param datei      Pfad zu users.json
   * @param adminEmail Optionale E-Mail, die beim Registrieren zum Admin wird.
   */
  constructor(
    private readonly datei: string,
    private readonly adminEmail?: string,
  ) {}

  /** Lädt alle Konten aus der Datei (fehlt sie, wird leer gestartet). */
  laden(): void {
    if (!fs.existsSync(this.datei)) return;
    try {
      const roh = JSON.parse(fs.readFileSync(this.datei, 'utf-8'));
      if (Array.isArray(roh)) {
        for (const n of roh) {
          if (n && typeof n.id === 'string') this.nutzer.set(n.id, n as Nutzer);
        }
      }
    } catch (fehler) {
      console.error(`⚠ users.json konnte nicht gelesen werden: ${this.datei}`, fehler);
    }
  }

  anzahl(): number {
    return this.nutzer.size;
  }

  alle(): Nutzer[] {
    return [...this.nutzer.values()];
  }

  holen(id: string): Nutzer | undefined {
    return this.nutzer.get(id);
  }

  findeEmail(email: string): Nutzer | undefined {
    const gesucht = normalisiere(email);
    return [...this.nutzer.values()].find((n) => n.email === gesucht);
  }

  /**
   * Legt ein Konto an. Der erste Nutzer (oder die konfigurierte Admin-E-Mail)
   * erhält die Rolle `admin`. Wirft, wenn die E-Mail schon existiert.
   */
  anlegen(email: string, passwort: string): Nutzer {
    const gesucht = normalisiere(email);
    if (this.findeEmail(gesucht)) throw new Error('E-Mail ist bereits registriert');
    const salt = crypto.randomBytes(16).toString('hex');
    const istAdmin = this.nutzer.size === 0 || gesucht === normalisiere(this.adminEmail ?? '');
    const nutzer: Nutzer = {
      id: crypto.randomUUID(),
      email: gesucht,
      passwortHash: hashe(passwort, salt),
      salt,
      rolle: istAdmin ? 'admin' : 'nutzer',
      plan: 'frei',
      erstellt: new Date().toISOString(),
    };
    this.nutzer.set(nutzer.id, nutzer);
    this.speichern();
    return nutzer;
  }

  /** Zeitkonstanter Passwortvergleich. */
  pruefePasswort(nutzer: Nutzer, passwort: string): boolean {
    const kandidat = Buffer.from(hashe(passwort, nutzer.salt), 'hex');
    const echt = Buffer.from(nutzer.passwortHash, 'hex');
    return kandidat.length === echt.length && crypto.timingSafeEqual(kandidat, echt);
  }

  /** Setzt die Abo-Stufe eines Kontos (Admin-Aktion, Phase 2). */
  setzePlan(id: string, plan: string): Nutzer {
    const nutzer = this.nutzer.get(id);
    if (!nutzer) throw new Error(`Nutzer nicht gefunden: ${id}`);
    nutzer.plan = plan;
    this.speichern();
    return nutzer;
  }

  private speichern(): void {
    fs.mkdirSync(dirname(this.datei), { recursive: true });
    fs.writeFileSync(this.datei, JSON.stringify([...this.nutzer.values()], null, 2) + '\n', {
      mode: 0o600,
    });
  }
}

/** E-Mail normalisieren: trimmen + Kleinschreibung (Vergleiche case-insensitiv). */
function normalisiere(email: string): string {
  return email.trim().toLowerCase();
}

/** scrypt-Hash als Hex-String. */
function hashe(passwort: string, salt: string): string {
  return crypto.scryptSync(passwort, salt, SCRYPT_LAENGE).toString('hex');
}

/** Verzeichnisanteil eines Pfades (ohne node:path zu importieren). */
function dirname(pfad: string): string {
  const i = Math.max(pfad.lastIndexOf('/'), pfad.lastIndexOf('\\'));
  return i === -1 ? '.' : pfad.slice(0, i);
}
