// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Einstiegspunkt des Campanium-Servers (Self-Host).
 *
 * Eine globale Kampagnen-Verwaltung unter data/, kein Login, kein Abo. Wer KI
 * will, hängt sein eigenes Modell via .env an (AI_PROVIDER bzw. AI_IMAGE_*).
 *
 * Port über PORT, Datenordner über DATA_DIR überschreibbar.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erstelleApp } from './app';
import { erstelleKiProvider, ladeStandardUmgebung } from './ki/config';
import { erstelleBildProvider } from './ki/bild';
import { KampagnenVerwaltung } from './storage';

const repoWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
ladeStandardUmgebung(repoWurzel);

const datenOrdner = process.env.DATA_DIR ?? path.join(repoWurzel, 'data');
const port = Number(process.env.PORT ?? 3001);

const kiProvider = erstelleKiProvider();
const bildProvider = erstelleBildProvider();

const verwaltung = new KampagnenVerwaltung(datenOrdner);
verwaltung.laden();

const app = erstelleApp(verwaltung, kiProvider, bildProvider);
app.listen(port, () => {
  const kampagnen = verwaltung.liste();
  console.log(`🦇 Campanium – DM-Server läuft auf http://localhost:${port}`);
  console.log(
    `   Datenordner: ${datenOrdner} (${kampagnen.length} Kampagne(n): ${
      kampagnen.map((k) => k.name).join(', ') || '–'
    })`,
  );
  console.log(
    kiProvider
      ? `   KI-Assistent: aktiv (${kiProvider.provider} / ${kiProvider.modell})`
      : '   KI-Assistent: deaktiviert (AI_PROVIDER in .env setzen zum Aktivieren)',
  );
  console.log(
    bildProvider
      ? `   KI-Kartengenerierung: aktiv (${bildProvider.modell})`
      : '   KI-Kartengenerierung: deaktiviert (AI_IMAGE_PROVIDER in .env setzen)',
  );
});
