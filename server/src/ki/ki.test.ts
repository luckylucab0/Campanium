/**
 * Tests für den KI-Assistenten – komplett ohne Netz:
 * Werkzeug-Ausführung gegen einen temporären Storage und der Agent-Loop
 * mit einem geskripteten Fake-Provider.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kampagne, Nsc, Quest } from '@campanium/shared';
import { Storage } from '../storage';
import { fuehreChatAus } from './chat';
import { erstelleKiProvider } from './config';
import type { KiAntwort, KiNachricht, KiProvider, KiToolDefinition } from './provider';
import { fuehreToolAus, KI_TOOLS } from './tools';

let ordner: string;
let storage: Storage;

const kampagne: Kampagne = {
  id: 'test',
  name: 'Testkampagne',
  beschreibung: '',
  erstellt: '2026-01-01T00:00:00.000Z',
};

beforeAll(() => {
  ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'campanium-ki-'));
  storage = new Storage(ordner);
  storage.laden();
});

afterAll(() => {
  fs.rmSync(ordner, { recursive: true, force: true });
});

/** Fake-Provider: gibt vorbereitete Antworten der Reihe nach zurück. */
class FakeProvider implements KiProvider {
  readonly provider = 'fake';
  readonly modell = 'fake-1';
  aufrufe: { nachrichten: KiNachricht[]; tools: KiToolDefinition[] }[] = [];
  constructor(private antworten: KiAntwort[]) {}
  async chat(_system: string, nachrichten: KiNachricht[], tools: KiToolDefinition[]) {
    this.aufrufe.push({ nachrichten: [...nachrichten], tools });
    const antwort = this.antworten.shift();
    if (!antwort) throw new Error('FakeProvider: keine Antwort mehr');
    return antwort;
  }
}

describe('Werkzeug-Ausführung', () => {
  it('legt Entitäten an und listet sie auf', () => {
    const anlegen = fuehreToolAus(storage, {
      id: 't1',
      name: 'entitaet_anlegen',
      eingabe: { typ: 'nsc', name: 'Gregor', felder: { haltung: 'freundlich' } },
    });
    expect(anlegen.aktion?.art).toBe('angelegt');
    expect((JSON.parse(anlegen.ergebnis) as Nsc).haltung).toBe('freundlich');

    const liste = fuehreToolAus(storage, {
      id: 't2',
      name: 'kompendium_auflisten',
      eingabe: { typ: 'nsc' },
    });
    expect(JSON.parse(liste.ergebnis)).toEqual([
      { id: 'gregor', name: 'Gregor', typ: 'nsc', status: 'lebendig' },
    ]);
  });

  it('aktualisiert mit Zod-Validierung und schützt id/typ', () => {
    const ok = fuehreToolAus(storage, {
      id: 't3',
      name: 'entitaet_aktualisieren',
      eingabe: { id: 'gregor', aenderungen: { status: 'untot', id: 'boese' } },
    });
    const nsc = JSON.parse(ok.ergebnis) as Nsc;
    expect(nsc.status).toBe('untot');
    expect(nsc.id).toBe('gregor');

    const kaputt = fuehreToolAus(storage, {
      id: 't4',
      name: 'entitaet_aktualisieren',
      eingabe: { id: 'gregor', aenderungen: { status: 'verschollen' } },
    });
    expect(kaputt.ergebnis).toContain('Fehler');
    expect(kaputt.aktion).toBeUndefined();
    // Ungültige Änderung wurde nicht gespeichert.
    expect((storage.holen('gregor') as Nsc).status).toBe('untot');
  });

  it('ergänzt Kampagnen-Logs und aktualisiert den Kampagnenstand', () => {
    const log = fuehreToolAus(storage, {
      id: 't5',
      name: 'log_hinzufuegen',
      eingabe: { id: 'gregor', sessionNr: 3, text: 'Wurde untot.' },
    });
    expect(JSON.parse(log.ergebnis)).toEqual([{ sessionNr: 3, text: 'Wurde untot.' }]);

    const stand = fuehreToolAus(storage, {
      id: 't6',
      name: 'kampagnenstand_aktualisieren',
      eingabe: { aenderungen: { ingameTag: 12 } },
    });
    expect(JSON.parse(stand.ergebnis).ingameTag).toBe(12);
    expect(storage.kampagnenstand.ingameTag).toBe(12);
  });

  it('kennt kein Lösch-Werkzeug', () => {
    expect(KI_TOOLS.some((t) => t.name.includes('loesch') || t.name.includes('delete'))).toBe(
      false,
    );
    const unbekannt = fuehreToolAus(storage, { id: 't7', name: 'entitaet_loeschen', eingabe: {} });
    expect(unbekannt.ergebnis).toContain('unbekanntes Werkzeug');
  });
});

describe('Agent-Loop', () => {
  it('führt Werkzeuge aus und sammelt Aktionen bis zur finalen Antwort', async () => {
    const provider = new FakeProvider([
      {
        text: '',
        toolAufrufe: [
          {
            id: 'a1',
            name: 'entitaet_anlegen',
            eingabe: { typ: 'quest', name: 'Neue Quest', felder: { status: 'aktiv' } },
          },
        ],
      },
      { text: 'Erledigt: Quest angelegt.', toolAufrufe: [] },
    ]);

    const ergebnis = await fuehreChatAus(provider, kampagne, storage, [
      { rolle: 'nutzer', text: 'Lege die Quest „Neue Quest“ als aktiv an.' },
    ]);

    expect(ergebnis.antwort).toBe('Erledigt: Quest angelegt.');
    expect(ergebnis.aktionen).toHaveLength(1);
    expect(ergebnis.aktionen[0]?.entitaetId).toBe('neue-quest');
    expect((storage.holen('neue-quest') as Quest).status).toBe('aktiv');

    // Zweite Runde bekam das Tool-Ergebnis als Verlauf.
    const zweiteRunde = provider.aufrufe[1]!;
    expect(zweiteRunde.nachrichten.at(-1)?.rolle).toBe('tool');
    expect(zweiteRunde.tools.map((t) => t.name)).toContain('kompendium_auflisten');
  });

  it('bricht nach dem Rundenlimit kontrolliert ab', async () => {
    const endlos: KiAntwort = {
      text: '',
      toolAufrufe: [{ id: 'x', name: 'kampagnenstand_lesen', eingabe: {} }],
    };
    const provider = new FakeProvider(Array.from({ length: 20 }, () => ({ ...endlos })));
    const ergebnis = await fuehreChatAus(provider, kampagne, storage, [
      { rolle: 'nutzer', text: 'Endlos!' },
    ]);
    expect(provider.aufrufe.length).toBe(8);
    expect(ergebnis.antwort).toContain('Rundenlimit');
  });
});

describe('Provider-Konfiguration', () => {
  it('ist ohne AI_PROVIDER deaktiviert', () => {
    expect(erstelleKiProvider({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('braucht für Cloud-Provider einen Key, für Ollama nicht', () => {
    expect(erstelleKiProvider({ AI_PROVIDER: 'anthropic' } as NodeJS.ProcessEnv)).toBeNull();
    const anthropic = erstelleKiProvider({
      AI_PROVIDER: 'anthropic',
      AI_API_KEY: 'sk-test',
    } as NodeJS.ProcessEnv);
    expect(anthropic?.provider).toBe('anthropic');
    expect(anthropic?.modell).toBe('claude-opus-4-8');

    const ollama = erstelleKiProvider({
      AI_PROVIDER: 'ollama',
      AI_MODEL: 'mistral',
    } as NodeJS.ProcessEnv);
    expect(ollama?.provider).toBe('ollama');
    expect(ollama?.modell).toBe('mistral');
  });

  it('lehnt unbekannte Provider ab', () => {
    expect(erstelleKiProvider({ AI_PROVIDER: 'skynet' } as NodeJS.ProcessEnv)).toBeNull();
  });
});
