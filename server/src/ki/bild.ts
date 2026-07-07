// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Optionaler Bild-Provider für die KI-Kartengenerierung (Premium-Feature).
 *
 * Strikt opt-in wie der Text-Assistent, aber über EIGENE Variablen, damit
 * Text- und Bild-KI unabhängig konfigurierbar sind:
 *   AI_IMAGE_PROVIDER = openai            (aktuell nur OpenAI-kompatibel)
 *   AI_IMAGE_API_KEY  = Schlüssel
 *   AI_IMAGE_MODEL    = optional (Default gpt-image-1)
 *   AI_IMAGE_URL      = optional (Default https://api.openai.com/v1)
 *
 * Ohne AI_IMAGE_PROVIDER bleibt die Funktion deaktiviert; die Route meldet
 * dann sauber „nicht konfiguriert" (503).
 */

/** Erzeugt eine PNG-Grafik aus einem Text-Prompt. */
export interface BildProvider {
  readonly provider: string;
  readonly modell: string;
  /** Liefert die rohen Bilddaten (PNG). */
  generiere(prompt: string): Promise<Buffer>;
}

const IMAGE_DEFAULTS: Record<string, { modell: string; baseUrl: string }> = {
  openai: { modell: 'gpt-image-1', baseUrl: 'https://api.openai.com/v1' },
};

export function erstelleBildProvider(env: NodeJS.ProcessEnv = process.env): BildProvider | null {
  const provider = env.AI_IMAGE_PROVIDER?.trim().toLowerCase();
  if (!provider) return null;
  const defaults = IMAGE_DEFAULTS[provider];
  if (!defaults) {
    console.error(
      `⚠ Unbekannter AI_IMAGE_PROVIDER "${provider}" – erlaubt: ${Object.keys(IMAGE_DEFAULTS).join(', ')}. Kartengenerierung bleibt deaktiviert.`,
    );
    return null;
  }
  const apiKey = env.AI_IMAGE_API_KEY?.trim() ?? '';
  if (!apiKey) {
    console.error(
      `⚠ AI_IMAGE_PROVIDER=${provider} gesetzt, aber AI_IMAGE_API_KEY fehlt. Kartengenerierung bleibt deaktiviert.`,
    );
    return null;
  }
  const modell = env.AI_IMAGE_MODEL?.trim() || defaults.modell;
  const baseUrl = (env.AI_IMAGE_URL?.trim() || defaults.baseUrl).replace(/\/$/, '');
  return new OpenAiBildProvider(modell, baseUrl, apiKey);
}

/** OpenAI-kompatibler Images-Endpunkt (/images/generations). */
class OpenAiBildProvider implements BildProvider {
  readonly provider = 'openai';
  constructor(
    readonly modell: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async generiere(prompt: string): Promise<Buffer> {
    const antwort = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.modell, prompt, n: 1, size: '1024x1024' }),
    });
    if (!antwort.ok) {
      const detail = await antwort.text().catch(() => '');
      throw new Error(`Bild-API-Fehler ${antwort.status}: ${detail.slice(0, 300)}`);
    }
    const daten = (await antwort.json()) as { data?: { b64_json?: string; url?: string }[] };
    const eintrag = daten.data?.[0];
    // gpt-image-1 liefert b64_json, dall-e-3 standardmäßig eine URL.
    if (eintrag?.b64_json) return Buffer.from(eintrag.b64_json, 'base64');
    if (eintrag?.url) {
      const bild = await fetch(eintrag.url);
      if (!bild.ok) throw new Error(`Bild-Download fehlgeschlagen (${bild.status})`);
      return Buffer.from(await bild.arrayBuffer());
    }
    throw new Error('Bild-API lieferte keine Bilddaten');
  }
}
