/**
 * Adapter für OpenAI-kompatible Chat-Completions-APIs.
 *
 * Deckt vier Provider mit einem einzigen Adapter ab, weil alle dasselbe
 * Wire-Format sprechen (POST {baseUrl}/chat/completions):
 *   - OpenAI  (https://api.openai.com/v1)
 *   - Mistral (https://api.mistral.ai/v1)
 *   - Google Gemini über den OpenAI-Kompatibilitätsendpunkt
 *     (https://generativelanguage.googleapis.com/v1beta/openai)
 *   - Ollama, lokal (http://localhost:11434/v1 – kein API-Key nötig)
 */
import type { KiAntwort, KiNachricht, KiProvider, KiToolDefinition } from './provider';

/** Nachrichtenformat der OpenAI-kompatiblen APIs (nur die genutzten Felder). */
interface OpenAiNachricht {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
}

export class OpenAiKompatibelProvider implements KiProvider {
  constructor(
    readonly provider: string,
    readonly modell: string,
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async chat(
    system: string,
    nachrichten: KiNachricht[],
    tools: KiToolDefinition[],
  ): Promise<KiAntwort> {
    const messages: OpenAiNachricht[] = [{ role: 'system', content: system }];
    for (const n of nachrichten) {
      if (n.rolle === 'nutzer') {
        messages.push({ role: 'user', content: n.text });
      } else if (n.rolle === 'assistent') {
        messages.push({
          role: 'assistant',
          content: n.text || null,
          tool_calls: n.toolAufrufe?.length
            ? n.toolAufrufe.map((a) => ({
                id: a.id,
                type: 'function' as const,
                function: { name: a.name, arguments: JSON.stringify(a.eingabe ?? {}) },
              }))
            : undefined,
        });
      } else {
        messages.push({ role: 'tool', content: n.ergebnis, tool_call_id: n.aufrufId });
      }
    }

    const antwort = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Ollama braucht keinen Key; ein leerer Authorization-Header schadet dort nicht.
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.modell,
        messages,
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.beschreibung, parameters: t.parameter },
        })),
      }),
    });
    if (!antwort.ok) {
      const text = await antwort.text();
      throw new Error(`${this.provider}: HTTP ${antwort.status} – ${text.slice(0, 300)}`);
    }

    const json = (await antwort.json()) as {
      choices?: { message?: OpenAiNachricht }[];
    };
    const nachricht = json.choices?.[0]?.message;
    return {
      text: typeof nachricht?.content === 'string' ? nachricht.content : '',
      toolAufrufe: (nachricht?.tool_calls ?? []).map((aufruf) => ({
        id: aufruf.id,
        name: aufruf.function.name,
        eingabe: sicheresJsonParse(aufruf.function.arguments),
      })),
    };
  }
}

/** Tool-Argumente kommen als JSON-String; kaputtes JSON wird zu leerem Objekt. */
function sicheresJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
