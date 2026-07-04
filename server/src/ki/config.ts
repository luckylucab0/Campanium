// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Konfiguration des KI-Assistenten über Umgebungsvariablen (.env).
 *
 * Das Feature ist strikt opt-in: Ohne AI_PROVIDER bleibt es deaktiviert,
 * der Client blendet den Chat komplett aus. API-Keys leben ausschließlich
 * hier im Server-Prozess – sie erreichen nie den Browser oder einen Build.
 *
 *   AI_PROVIDER = anthropic | openai | google | mistral | ollama
 *   AI_API_KEY  = Schlüssel des Providers (entfällt bei ollama)
 *   AI_MODEL    = optionales Modell (sonst Default des Providers)
 *   OLLAMA_URL  = optional, Default http://localhost:11434
 */
import fs from 'node:fs';
import path from 'node:path';
import { AnthropicProvider } from './anthropic';
import { OpenAiKompatibelProvider } from './openaiKompatibel';
import type { KiProvider } from './provider';

const PROVIDER_DEFAULTS: Record<string, { modell: string; baseUrl?: string }> = {
  anthropic: { modell: 'claude-opus-4-8' },
  openai: { modell: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  google: {
    modell: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  mistral: { modell: 'mistral-small-latest', baseUrl: 'https://api.mistral.ai/v1' },
  ollama: { modell: 'llama3.2' },
};

/**
 * Minimaler .env-Loader (bewusst ohne dotenv-Abhängigkeit): liest
 * KEY=WERT-Zeilen und setzt sie, sofern nicht bereits in process.env.
 */
export function ladeUmgebungsdatei(datei: string): void {
  if (!fs.existsSync(datei)) return;
  for (const zeile of fs.readFileSync(datei, 'utf-8').split('\n')) {
    const bereinigt = zeile.trim();
    if (!bereinigt || bereinigt.startsWith('#')) continue;
    const trenner = bereinigt.indexOf('=');
    if (trenner === -1) continue;
    const schluessel = bereinigt.slice(0, trenner).trim();
    const wert = bereinigt
      .slice(trenner + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (schluessel && !(schluessel in process.env)) process.env[schluessel] = wert;
  }
}

/** Lädt die .env aus der Repo-Wurzel (falls vorhanden). */
export function ladeStandardUmgebung(repoWurzel: string): void {
  ladeUmgebungsdatei(path.join(repoWurzel, '.env'));
}

/** Vom Client abfragbarer Status (ohne Key!). */
export interface KiStatus {
  aktiv: boolean;
  provider?: string;
  modell?: string;
}

/**
 * Erzeugt den konfigurierten Provider – oder null, wenn das Feature
 * deaktiviert ist (kein AI_PROVIDER bzw. fehlender Key).
 */
export function erstelleKiProvider(env: NodeJS.ProcessEnv = process.env): KiProvider | null {
  const provider = env.AI_PROVIDER?.trim().toLowerCase();
  if (!provider) return null;
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    console.error(
      `⚠ Unbekannter AI_PROVIDER "${provider}" – erlaubt: ${Object.keys(PROVIDER_DEFAULTS).join(', ')}. KI-Assistent bleibt deaktiviert.`,
    );
    return null;
  }
  const modell = env.AI_MODEL?.trim() || defaults.modell;
  const apiKey = env.AI_API_KEY?.trim() ?? '';

  if (provider === 'ollama') {
    const basis = (env.OLLAMA_URL?.trim() || 'http://localhost:11434').replace(/\/$/, '');
    return new OpenAiKompatibelProvider('ollama', modell, `${basis}/v1`, '');
  }
  if (!apiKey) {
    console.error(
      `⚠ AI_PROVIDER=${provider} gesetzt, aber AI_API_KEY fehlt. KI-Assistent bleibt deaktiviert.`,
    );
    return null;
  }
  if (provider === 'anthropic') return new AnthropicProvider(apiKey, modell);
  return new OpenAiKompatibelProvider(provider, modell, defaults.baseUrl!, apiKey);
}
