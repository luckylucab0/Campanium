// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Einstiegspunkt des Campanium-Servers.
 *
 * Zwei Betriebsarten:
 *  - Self-Host (Standard): eine globale Kampagnen-Verwaltung unter data/,
 *    kein Login, kein Abo. Wer KI will, hängt sein eigenes Modell via .env an.
 *  - SaaS (CAMPANIUM_SAAS=true): Konten mit Login, pro Konto isolierte
 *    Kampagnen unter data/<nutzerId>/, serverseitig durchgesetzte Abo-Stufen.
 *    Nur für unseren gehosteten Betrieb gedacht – Self-Hoster lassen den
 *    Schalter aus und bekommen die volle App ohne Gates.
 *
 * Port über PORT, Datenordner über DATA_DIR überschreibbar.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { erstelleApp } from './app';
import { erstelleKiProvider, ladeStandardUmgebung } from './ki/config';
import { KampagnenVerwaltung } from './storage';
import { MandantenRegister } from './mandanten';
import { NutzerStore } from './auth/nutzer';
import { ladeOderErzeugeSecret, SessionManager } from './auth/session';
import type { SaasKontext } from './auth/routes';

const repoWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
ladeStandardUmgebung(repoWurzel);

const datenOrdner = process.env.DATA_DIR ?? path.join(repoWurzel, 'data');
const port = Number(process.env.PORT ?? 3001);
const saasModus = istWahr(process.env.CAMPANIUM_SAAS);

const kiProvider = erstelleKiProvider();

let app: ReturnType<typeof erstelleApp>;
let startMeldung: () => void;

if (saasModus) {
  const secret = ladeOderErzeugeSecret(datenOrdner, process.env.CAMPANIUM_SECRET, fs, path);
  const nutzerStore = new NutzerStore(
    path.join(datenOrdner, 'users.json'),
    process.env.CAMPANIUM_ADMIN_EMAIL,
  );
  nutzerStore.laden();
  const saas: SaasKontext = {
    nutzerStore,
    register: new MandantenRegister(datenOrdner),
    session: new SessionManager(secret),
    sichereCookies: istWahr(process.env.CAMPANIUM_SECURE_COOKIE),
  };
  app = erstelleApp(null, kiProvider, saas);
  startMeldung = () => {
    console.log(`🦇 Campanium – SaaS-Server läuft auf http://localhost:${port}`);
    console.log(`   Modus: SaaS (Login-Pflicht, isolierte Kampagnen je Konto)`);
    console.log(`   Datenordner: ${datenOrdner} (${nutzerStore.anzahl()} Konto/Konten)`);
  };
} else {
  const verwaltung = new KampagnenVerwaltung(datenOrdner);
  verwaltung.laden();
  app = erstelleApp(verwaltung, kiProvider);
  startMeldung = () => {
    const kampagnen = verwaltung.liste();
    console.log(`🦇 Campanium – DM-Server läuft auf http://localhost:${port}`);
    console.log(
      `   Datenordner: ${datenOrdner} (${kampagnen.length} Kampagne(n): ${
        kampagnen.map((k) => k.name).join(', ') || '–'
      })`,
    );
  };
}

app.listen(port, () => {
  startMeldung();
  console.log(
    kiProvider
      ? `   KI-Assistent: aktiv (${kiProvider.provider} / ${kiProvider.modell})`
      : '   KI-Assistent: deaktiviert (AI_PROVIDER in .env setzen zum Aktivieren)',
  );
});

/** Deutet gängige „an"-Werte einer Umgebungsvariable als true. */
function istWahr(wert: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on', 'ja'].includes((wert ?? '').trim().toLowerCase());
}
