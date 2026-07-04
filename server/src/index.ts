// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Einstiegspunkt des lokalen DM-Servers.
 * Lädt alle Kampagnen aus data/ (überschreibbar via DATA_DIR) und startet
 * die API auf Port 3001 (überschreibbar via PORT). Der Vite-Dev-Server des
 * Clients proxied /api hierher.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erstelleApp } from './app';
import { erstelleKiProvider, ladeStandardUmgebung } from './ki/config';
import { KampagnenVerwaltung } from './storage';

const repoWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
ladeStandardUmgebung(repoWurzel);

const datenOrdner = process.env.DATA_DIR ?? path.join(repoWurzel, 'data');
const port = Number(process.env.PORT ?? 3001);

const verwaltung = new KampagnenVerwaltung(datenOrdner);
verwaltung.laden();

const kiProvider = erstelleKiProvider();

const app = erstelleApp(verwaltung, kiProvider);
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
});
