// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Provider-neutrale Typen für den KI-Assistenten.
 *
 * Der Chat-Loop (chat.ts) arbeitet ausschließlich mit diesen Typen;
 * die Adapter (anthropic.ts, openaiKompatibel.ts) übersetzen sie in das
 * jeweilige Wire-Format. So bleibt die Kernlogik testbar und
 * provider-unabhängig.
 */

/** Ein Werkzeug, das dem Modell angeboten wird (JSON-Schema-Parameter). */
export interface KiToolDefinition {
  name: string;
  beschreibung: string;
  /** JSON Schema der Eingabe (type: object). */
  parameter: Record<string, unknown>;
}

/** Ein vom Modell angeforderter Werkzeug-Aufruf. */
export interface KiToolAufruf {
  /** Provider-vergebene ID, muss im Tool-Ergebnis zurückgegeben werden. */
  id: string;
  name: string;
  eingabe: unknown;
}

/** Provider-neutrale Chat-Nachricht. */
export type KiNachricht =
  | { rolle: 'nutzer'; text: string }
  | { rolle: 'assistent'; text: string; toolAufrufe?: KiToolAufruf[] }
  | { rolle: 'tool'; aufrufId: string; name: string; ergebnis: string };

/** Antwort eines Providers auf einen Chat-Schritt. */
export interface KiAntwort {
  text: string;
  toolAufrufe: KiToolAufruf[];
}

/** Gemeinsame Schnittstelle aller KI-Provider. */
export interface KiProvider {
  /** Anzeigename, z. B. "anthropic" oder "ollama". */
  readonly provider: string;
  readonly modell: string;
  chat(system: string, nachrichten: KiNachricht[], tools: KiToolDefinition[]): Promise<KiAntwort>;
}
