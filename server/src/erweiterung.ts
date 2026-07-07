// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Erweiterungspunkt des öffentlichen Cores.
 *
 * Der Self-Host-Core kennt weder Konten noch Abo-Stufen. Damit ein separates
 * (privates) SaaS-Overlay Auth, Multi-Tenancy und Plan-Gating einklinken kann,
 * OHNE dass kommerzieller Code im öffentlichen Core liegt, nimmt `erstelleApp`
 * eine optionale `AppErweiterung` entgegen. Ohne sie verhält sich die App wie
 * bisher (Self-Host, ein globaler Datenbestand, keine Gates).
 *
 * Die SaaS-Implementierung dieser Schnittstelle lebt außerhalb des Cores und
 * wird beim Start injiziert (siehe das SaaS-Overlay).
 */
import type express from 'express';
import type { KiFeature } from '@campanium/shared';
import type { KampagnenVerwaltung } from './storage';

/**
 * Entscheidung eines KI-Gates. `erlaubt=false` blockt das Feature; `sende`
 * darf dann die konkrete Ablehnungsantwort schreiben (SaaS: 402 mit Plan-Info)
 * – so bleibt die kommerzielle Fehlermeldung/Preislogik aus dem Core heraus.
 */
export interface KiEntscheidung {
  erlaubt: boolean;
  sende?: (res: express.Response) => void;
}

export interface AppErweiterung {
  /** Wird vor /api/kampagnen und /api/ki gehängt (SaaS: Auth-Pflicht). */
  middleware?: express.RequestHandler[];
  /** Zusätzliche Router-Mounts (SaaS: /api/auth, /api/plan, /api/admin). */
  router?: { pfad: string; handler: express.RequestHandler | express.RequestHandler[] }[];
  /**
   * Löst die zuständige Verwaltung pro Request auf (SaaS: pro Konto).
   * Default: die eine globale Verwaltung des Self-Host-Modus.
   */
  verwaltungFuer?: (req: express.Request) => KampagnenVerwaltung;
  /** Gate für KI-Features (SaaS: Plan-Prüfung). Default: alles erlaubt. */
  kiGate?: (req: express.Request, feature: KiFeature) => KiEntscheidung;
  /** Zusatzfelder für GET /api/config (SaaS: { saas: true }). */
  konfig?: Record<string, unknown>;
}
