// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * KI-Feature-Kennungen – die einzige „Plan"-nahe Größe, die der öffentliche
 * Core kennt. Der Core gated KI-Funktionen abstrakt über diese Namen; WELCHE
 * Stufe ein Feature freischaltet (Preise/Ränge) ist kommerzielle Logik und
 * lebt außerhalb des Cores (im SaaS-Overlay). So bleibt der Self-Host-Core
 * frei von Abo-Wissen, kann aber generische Gate-Hooks anbieten.
 */

/** An ein KI-Feature gebundene Kennung (stabiler Bezeichner, nicht übersetzt). */
export type KiFeature = 'ki-assistent' | 'ki-erweitert' | 'ki-kartengenerierung';

/** Alle bekannten KI-Feature-Kennungen. */
export const KI_FEATURES: readonly KiFeature[] = [
  'ki-assistent',
  'ki-erweitert',
  'ki-kartengenerierung',
] as const;
