// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * KI-Zusatzfunktionen (Self-Host): Unit-Tests fürs Parsen/Normalisieren sowie
 * Integrationstests der Routen mit Fake-Providern (kein echter Schlüssel
 * nötig). Ohne Erweiterung greift kein Plan-Gate – die Routen antworten direkt
 * (201) bzw. sauber „nicht konfiguriert" (503). Das Abo-Gating (402) wird im
 * SaaS-Overlay getestet.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleApp } from '../app';
import { KampagnenVerwaltung } from '../storage';
import type { KiProvider } from './provider';
import type { BildProvider } from './bild';
import { jsonAusText, naechsteSessionNummer, normalisiereCharakter } from './funktionen';

describe('jsonAusText', () => {
  it('extrahiert JSON aus Code-Fences und umgebendem Text', () => {
    expect(jsonAusText('Hier:\n```json\n{"a":1}\n```\nfertig')).toEqual({ a: 1 });
    expect(jsonAusText('{"b":2}')).toEqual({ b: 2 });
  });
  it('wirft bei fehlendem JSON', () => {
    expect(() => jsonAusText('kein json hier')).toThrow();
  });
});

describe('normalisiereCharakter', () => {
  it('normalisiert Attribut-Kürzel und koerziert Zahlen', () => {
    const roh = normalisiereCharakter('sc', {
      name: 'Aria',
      level: '3',
      ac: 15,
      hp: '24',
      passiveWahrnehmung: 13,
      attribute: { STR: 12, dex: '16', con: 14, int: 10, wis: 13, cha: 8 },
      unbekannt: 'wird verworfen',
    });
    expect(roh.name).toBe('Aria');
    expect(roh.level).toBe(3);
    expect(roh.hp).toBe(24);
    expect(roh.unbekannt).toBeUndefined();
    expect(roh.attribute).toEqual({
      staerke: 12,
      geschicklichkeit: 16,
      konstitution: 14,
      intelligenz: 10,
      weisheit: 13,
      charisma: 8,
    });
  });

  it('lässt unvollständige Attribute weg', () => {
    const roh = normalisiereCharakter('nsc', { name: 'X', attribute: { str: 10 } });
    expect(roh.attribute).toBeUndefined();
  });
});

describe('naechsteSessionNummer', () => {
  it('liefert höchste Nummer + 1, sonst 1', () => {
    expect(naechsteSessionNummer([])).toBe(1);
  });
});

// ---- Integration (Self-Host, ohne Erweiterung) --------------------------------

let server: Server;
let basisUrl: string;
let datenOrdner: string;
let kid: string;

const fakeKi: KiProvider = {
  provider: 'fake',
  modell: 'fake',
  chat: (system) => {
    const prep = system.includes('zieleDm');
    const text = prep
      ? '```json\n{"zieleDm":"Ziel A","szenenDm":"Szene B","benoetigtDm":"[[Gregor]]","notfallIdeenDm":"Notfall C"}\n```'
      : '{"name":"Aria","klasseVolk":"Waldläuferin","level":3,"ac":15,"hp":24,"passiveWahrnehmung":13,"attribute":{"str":12,"dex":16,"con":14,"int":10,"wis":13,"cha":8}}';
    return Promise.resolve({ text, toolAufrufe: [] });
  },
};

const fakeBild: BildProvider = {
  provider: 'fake',
  modell: 'fake-img',
  generiere: () => Promise.resolve(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
};

function json(pfad: string, methode: string, body?: unknown) {
  return fetch(`${basisUrl}${pfad}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function starte(app: ReturnType<typeof erstelleApp>): Promise<{ srv: Server; url: string }> {
  const srv = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const adresse = srv.address();
  if (typeof adresse === 'string' || adresse === null) throw new Error('Kein Port');
  return { srv, url: `http://127.0.0.1:${adresse.port}` };
}

beforeAll(async () => {
  datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'campanium-kifn-'));
  const verwaltung = new KampagnenVerwaltung(datenOrdner);
  verwaltung.laden();
  ({ srv: server, url: basisUrl } = await starte(erstelleApp(verwaltung, fakeKi, fakeBild)));
  kid = (await (await json('/api/kampagnen', 'POST', { name: 'KI-Welt' })).json()).id;
});

afterAll(() => {
  server.close();
  fs.rmSync(datenOrdner, { recursive: true, force: true });
});

describe('KI-Funktions-Routen (Self-Host)', () => {
  it('erzeugt einen Sitzungsprep-Entwurf (sessionPrep)', async () => {
    const antwort = await json(`/api/kampagnen/${kid}/ki/sitzungsprep`, 'POST', {});
    expect(antwort.status).toBe(201);
    const prep = await antwort.json();
    expect(prep.typ).toBe('sessionPrep');
    expect(prep.zieleDm).toBe('Ziel A');
    expect(prep.benoetigtDm).toContain('[[Gregor]]');
  });

  it('importiert einen Charakter aus Freitext (SC mit Attributen)', async () => {
    const antwort = await json(`/api/kampagnen/${kid}/ki/charakter-import`, 'POST', {
      typ: 'sc',
      text: 'Aria, Elf Ranger, Level 3, AC 15 …',
    });
    expect(antwort.status).toBe(201);
    const sc = await antwort.json();
    expect(sc.typ).toBe('sc');
    expect(sc.name).toBe('Aria');
    expect(sc.attribute.geschicklichkeit).toBe(16);
  });

  it('generiert eine Karte aus einem Prompt (Bild angehängt)', async () => {
    const antwort = await json(`/api/kampagnen/${kid}/ki/karte`, 'POST', {
      prompt: 'Eine nebelverhangene Küstenstadt',
      name: 'Hafenstadt',
    });
    expect(antwort.status).toBe(201);
    const karte = await antwort.json();
    expect(karte.typ).toBe('karte');
    expect(karte.bild).toMatch(/^ki-.*\.png$/);
  });
});

describe('„Nicht konfiguriert" (kein Provider)', () => {
  it('meldet 503, wenn kein Provider vorhanden ist', async () => {
    const verwaltung = new KampagnenVerwaltung(fs.mkdtempSync(path.join(os.tmpdir(), 'campanium-kifn2-')));
    verwaltung.laden();
    const { srv, url } = await starte(erstelleApp(verwaltung, null, null));
    const k = (
      await (
        await fetch(`${url}/api/kampagnen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Leer' }),
        })
      ).json()
    ).id;
    const prep = await fetch(`${url}/api/kampagnen/${k}/ki/sitzungsprep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(prep.status).toBe(503);
    const karte = await fetch(`${url}/api/kampagnen/${k}/ki/karte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'x' }),
    });
    expect(karte.status).toBe(503);
    srv.close();
  });
});
