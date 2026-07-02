/**
 * Anthropic-Adapter (Claude) über das offizielle SDK.
 *
 * Nutzt die Messages API mit Tool-Use im manuellen Loop-Stil: chat.ts
 * steuert die Schleife, dieser Adapter übersetzt nur ein einzelnes
 * Request/Response-Paar. Wichtig: aufeinanderfolgende Tool-Ergebnisse
 * müssen in EINER user-Nachricht gebündelt werden (API-Anforderung bei
 * parallelen Tool-Aufrufen).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { KiAntwort, KiNachricht, KiProvider, KiToolDefinition } from './provider';

export class AnthropicProvider implements KiProvider {
  readonly provider = 'anthropic';
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly modell: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    system: string,
    nachrichten: KiNachricht[],
    tools: KiToolDefinition[],
  ): Promise<KiAntwort> {
    const messages: Anthropic.MessageParam[] = [];
    for (const n of nachrichten) {
      if (n.rolle === 'nutzer') {
        messages.push({ role: 'user', content: n.text });
      } else if (n.rolle === 'assistent') {
        const content: Anthropic.ContentBlockParam[] = [];
        if (n.text) content.push({ type: 'text', text: n.text });
        for (const aufruf of n.toolAufrufe ?? []) {
          content.push({
            type: 'tool_use',
            id: aufruf.id,
            name: aufruf.name,
            input: aufruf.eingabe ?? {},
          });
        }
        if (content.length > 0) messages.push({ role: 'assistant', content });
      } else {
        // Tool-Ergebnis: mit einem direkt vorangehenden Tool-Ergebnis in
        // derselben user-Nachricht bündeln (parallele Tool-Aufrufe).
        const block: Anthropic.ToolResultBlockParam = {
          type: 'tool_result',
          tool_use_id: n.aufrufId,
          content: n.ergebnis,
        };
        const letzte = messages[messages.length - 1];
        if (letzte && letzte.role === 'user' && Array.isArray(letzte.content)) {
          (letzte.content as Anthropic.ContentBlockParam[]).push(block);
        } else {
          messages.push({ role: 'user', content: [block] });
        }
      }
    }

    const antwort = await this.client.messages.create({
      model: this.modell,
      max_tokens: 8192,
      system,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.beschreibung,
        input_schema: t.parameter as Anthropic.Tool.InputSchema,
      })),
      messages,
    });

    let text = '';
    const toolAufrufe = [];
    for (const block of antwort.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'tool_use') {
        toolAufrufe.push({ id: block.id, name: block.name, eingabe: block.input });
      }
    }
    return { text, toolAufrufe };
  }
}
