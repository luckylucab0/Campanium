// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Öffentlicher Default des Client-Erweiterungspunkts: alles No-Op. Damit läuft
 * der Self-Host-Client ohne Login, ohne Abo, ohne Gates. Der SaaS-Build ersetzt
 * dieses Modul per Vite-Alias `campanium:erweiterung` durch sein eigenes.
 */
import type { ReactNode } from 'react';
import type { ClientErweiterung } from './typen';

function Passthrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const erweiterung: ClientErweiterung = {
  Wurzel: Passthrough,
  Zugang: Passthrough,
  KontoFuss: () => null,
  routen: [],
  useKiGate: () => ({ erlaubt: true }),
};
