// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Abo-Stufen und Feature-Freischaltung.
 *
 * WICHTIG: Diese Stufen greifen ausschließlich im SaaS-Modus (unser
 * gehosteter Betrieb). In der Self-Host-Variante gibt es KEINE Pläne – wer
 * dort ein eigenes KI-Modell anhängt, nutzt alle Funktionen ohne Gate.
 *
 * Preise (€/Monat):
 *   Frei    0      – alle Kernfunktionen, keine KI
 *   Basis   5      – KI-Assistent (mit eigenem Modell)
 *   Plus    9      – zusätzlich alle weiteren KI-Funktionen außer Kartengen.
 *   Premium 14,99  – zusätzlich KI-Kartengenerierung
 */

export const PLAN_STUFEN = ['frei', 'basis', 'plus', 'premium'] as const;
export type PlanStufe = (typeof PLAN_STUFEN)[number];

export interface PlanInfo {
  stufe: PlanStufe;
  /** Anzeigename (deutscher Quelltext, wird via i18n übersetzt). */
  name: string;
  /** Preis in Euro pro Monat. */
  preis: number;
  /** Rang für Vergleiche (0 = niedrigste Stufe). */
  rang: number;
  /** Kurzbeschreibung des Umfangs (deutscher Quelltext). */
  beschreibung: string;
}

export const PLAENE: Record<PlanStufe, PlanInfo> = {
  frei: {
    stufe: 'frei',
    name: 'Frei',
    preis: 0,
    rang: 0,
    beschreibung: 'Alle Kernfunktionen. Keine KI.',
  },
  basis: {
    stufe: 'basis',
    name: 'Basis',
    preis: 5,
    rang: 1,
    beschreibung: 'KI-Assistent mit eigenem Modell.',
  },
  plus: {
    stufe: 'plus',
    name: 'Plus',
    preis: 9,
    rang: 2,
    beschreibung: 'Alle KI-Funktionen außer Kartengenerierung.',
  },
  premium: {
    stufe: 'premium',
    name: 'Premium',
    preis: 14.99,
    rang: 3,
    beschreibung: 'Zusätzlich KI-Kartengenerierung.',
  },
};

/** Reihenfolge der Stufen (aufsteigend) – praktisch für die Abo-Anzeige. */
export const PLAN_LISTE: PlanInfo[] = PLAN_STUFEN.map((s) => PLAENE[s]);

/** KI-Funktionen, die an eine Mindest-Stufe gebunden sind. */
export type KiFeature = 'ki-assistent' | 'ki-erweitert' | 'ki-kartengenerierung';

/** Welche Mindest-Stufe schaltet ein Feature frei? */
export const FEATURE_STUFE: Record<KiFeature, PlanStufe> = {
  'ki-assistent': 'basis',
  'ki-erweitert': 'plus',
  'ki-kartengenerierung': 'premium',
};

/** Robustes Parsen: unbekannte/leere Werte werden zu `frei`. */
export function parsePlan(wert: unknown): PlanStufe {
  return typeof wert === 'string' && (PLAN_STUFEN as readonly string[]).includes(wert)
    ? (wert as PlanStufe)
    : 'frei';
}

/** Ist der übergebene Plan-Wert eine gültige Stufe? */
export function istPlanStufe(wert: unknown): wert is PlanStufe {
  return typeof wert === 'string' && (PLAN_STUFEN as readonly string[]).includes(wert);
}

/** Reicht der Plan für das Feature? (Rang-Vergleich) */
export function planErlaubt(plan: string, feature: KiFeature): boolean {
  return PLAENE[parsePlan(plan)].rang >= PLAENE[FEATURE_STUFE[feature]].rang;
}
