// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Mandanten-Register für den SaaS-Modus: pro Konto ein eigener, isolierter
 * Datenordner `data/<nutzerId>/` mit einer eigenen KampagnenVerwaltung. Konten
 * sehen ausschließlich ihre eigenen Kampagnen – es gibt keine gemeinsame
 * Wurzel, die gescannt würde.
 *
 * Die Verwaltung pro Nutzer wird lazy erzeugt und gecacht (Kampagnen liegen
 * vollständig im Speicher). In der Self-Host-Variante wird diese Klasse nicht
 * benutzt – dort gibt es genau eine globale KampagnenVerwaltung.
 */
import path from 'node:path';
import { KampagnenVerwaltung } from './storage';

export class MandantenRegister {
  private cache = new Map<string, KampagnenVerwaltung>();

  constructor(private readonly datenWurzel: string) {}

  /** Liefert (und lädt bei Bedarf) die Verwaltung eines Kontos. */
  fuer(nutzerId: string): KampagnenVerwaltung {
    let verwaltung = this.cache.get(nutzerId);
    if (!verwaltung) {
      verwaltung = new KampagnenVerwaltung(path.join(this.datenWurzel, nutzerId));
      verwaltung.laden();
      this.cache.set(nutzerId, verwaltung);
    }
    return verwaltung;
  }
}
