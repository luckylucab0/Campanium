// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Client-Erweiterungspunkt.
 *
 * Der öffentliche Client (Self-Host) kennt weder Login noch Abo. Ein privates
 * Overlay (SaaS) klinkt sich über dieses typisierte Objekt ein: ein
 * App-Provider, ein Zugangs-Gate, ein Konto-Fuß, Zusatzrouten, ein KI-Gate und
 * optionale Übersetzungen. Der öffentliche Default (leer.tsx) ist ein reiner
 * No-Op; der SaaS-Build tauscht ihn per Vite-Alias `campanium:erweiterung`.
 */
import type { ComponentType, ReactNode } from 'react';
import type { KiFeature } from '@campanium/shared';

export interface KiGateErgebnis {
  /** Self-Host: immer true. SaaS: hängt vom Plan ab. */
  erlaubt: boolean;
  /** Optional-UI, wenn gesperrt (SaaS: Upgrade-Knopf/Abo). */
  Sperre?: ComponentType<{ label: string }>;
}

export interface ClientErweiterung {
  /** App-weiter Provider (SaaS: AuthProvider). Default: Passthrough. */
  Wurzel: ComponentType<{ children: ReactNode }>;
  /** Zugangs-Gate um den Store (SaaS: Login-Pflicht). Default: Passthrough. */
  Zugang: ComponentType<{ children: ReactNode }>;
  /** Sidebar-Fuß (SaaS: Konto/Abo/Admin). Default: null. */
  KontoFuss: ComponentType;
  /** Zusätzliche Routen (SaaS: /admin). Default: []. */
  routen: { pfad: string; element: ReactNode }[];
  /** Gate für ein KI-Feature (SaaS: Plan-Prüfung). Default: () => ({ erlaubt: true }). */
  useKiGate: (feature: KiFeature) => KiGateErgebnis;
  /** Zusätzliche Übersetzungen je Sprachcode, in die Wörterbücher gemischt. */
  i18nZusatz?: Record<string, Record<string, string>>;
}
