// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Vitest-Konfiguration (Wurzel). Löst das virtuelle Erweiterungs-Modul
 * `campanium:erweiterung` in Tests auf den öffentlichen No-Op-Default auf –
 * analog zum Vite-Alias im Client-Build. Ohne diesen Alias könnten Tests, die
 * i18n/App-Code importieren, das Modul nicht finden.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const hier = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'campanium:erweiterung': path.resolve(hier, 'client/src/erweiterung/leer.tsx'),
    },
  },
});
