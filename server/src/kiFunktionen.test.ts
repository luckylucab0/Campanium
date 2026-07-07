// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Phase-3-KI-Funktionen: Sitzungsprep, Charakter-Import, Kartengenerierung.
 * Unit-Tests fürs Parsen/Normalisieren + Integrationstests der Routen mit
 * Fake-Providern (kein echter Schlüssel nötig), inklusive Abo-Gating (402)
 * und „nicht konfiguriert" (503).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleApp } from './app';
import { NutzerStore } from './auth/nutzer';
import { SessionManager } from './auth/session';
import { MandantenRegister } from './mandanten';
import type { SaasKontext } from './auth/routes';
import type { KiProvider } from './ki/provider';
import type { BildProvider } from './ki/bild';
import { jsonAusText, naechsteSessionNummer, normalisiereCharakter } from './ki/funktionen';

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

// ---- Integration --------------------------------------------------------------

let server: Server;
let basisUrl: string;
let datenOrdner: string;
let adminCookie: string;

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

function sessionAus(antwort: Response): string {
  const kekse = antwort.headers.getSetCookie?.() ?? [];
  const treffer = kekse.find((c) => c.startsWith('campanium_session='));
  if (!treffer) throw new Error('Kein Session-Cookie');
  return treffer.split(';')[0]!;
}

function req(pfad: string, methode: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${basisUrl}${pfad}`, {
    method: methode,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'campanium-kifn-'));
  const nutzerStore = new NutzerStore(path.join(datenOrdner, 'users.json'));
  nutzerStore.laden();
  const saas: SaasKontext = {
    nutzerStore,
    register: new MandantenRegister(datenOrdner),
    session: new SessionManager('test-geheimnis'),
    sichereCookies: false,
  };
  const app = erstelleApp(null, fakeKi, saas, fakeBild);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const adresse = server.address();
  if (typeof adresse === 'string' || adresse === null) throw new Error('Kein Port');
  basisUrl = `http://127.0.0.1:${adresse.port}`;

  const reg = await req('/api/auth/register', 'POST', {
    email: 'dm@example.com',
    passwort: 'sicher123',
  });
  adminCookie = sessionAus(reg);
  const adminId = (await reg.json()).id;
  // Erster Nutzer ist Admin – gating erst mit frei, dann auf premium heben.
  await req(`/api/admin/nutzer/${adminId}/plan`, 'PUT', { plan: 'premium' }, adminCookie);
});

afterAll(() => {
  server.close();
  fs.rmSync(datenOrdner, { recursive: true, force: true });
});

describe('Routen mit ausreichendem Plan (Premium)', () => {
  let kid: string;
  it('legt eine Testkampagne an', async () => {
    kid = (await (await req('/api/kampagnen', 'POST', { name: 'KI-Welt' }, adminCookie)).json()).id;
    expect(kid).toBe('ki-welt');
  });

  it('erzeugt einen Sitzungsprep-Entwurf (sessionPrep)', async () => {
    const antwort = await req(`/api/kampagnen/${kid}/ki/sitzungsprep`, 'POST', {}, adminCookie);
    expect(antwort.status).toBe(201);
    const prep = await antwort.json();
    expect(prep.typ).toBe('sessionPrep');
    expect(prep.zieleDm).toBe('Ziel A');
    expect(prep.benoetigtDm).toContain('[[Gregor]]');
    expect(prep.sessionNummer).toBe(1);
  });

  it('importiert einen Charakter aus Freitext (SC mit Attributen)', async () => {
    const antwort = await req(
      `/api/kampagnen/${kid}/ki/charakter-import`,
      'POST',
      { typ: 'sc', text: 'Aria, Elf Ranger, Level 3, AC 15 …' },
      adminCookie,
    );
    expect(antwort.status).toBe(201);
    const sc = await antwort.json();
    expect(sc.typ).toBe('sc');
    expect(sc.name).toBe('Aria');
    expect(sc.level).toBe(3);
    expect(sc.attribute.geschicklichkeit).toBe(16);
  });

  it('generiert eine Karte aus einem Prompt (Bild angehängt)', async () => {
    const antwort = await req(
      `/api/kampagnen/${kid}/ki/karte`,
      'POST',
      { prompt: 'Eine nebelverhangene Küstenstadt', name: 'Hafenstadt' },
      adminCookie,
    );
    expect(antwort.status).toBe(201);
    const karte = await antwort.json();
    expect(karte.typ).toBe('karte');
    expect(karte.bild).toMatch(/^ki-.*\.png$/);
    // Bilddatei liegt im Kampagnenordner des Admins.
    const nutzer = JSON.parse(fs.readFileSync(path.join(datenOrdner, 'users.json'), 'utf-8'));
    const bildPfad = path.join(datenOrdner, nutzer[0].id, kid, 'bilder', karte.bild);
    expect(fs.existsSync(bildPfad)).toBe(true);
  });
});

describe('Gating & Konfiguration', () => {
  it('sperrt die Funktionen unter Plus mit 402', async () => {
    const reg = await req('/api/auth/register', 'POST', {
      email: 'frei@example.com',
      passwort: 'sicher123',
    });
    const cookie = sessionAus(reg);
    const kid = (await (await req('/api/kampagnen', 'POST', { name: 'Frei-Welt' }, cookie)).json())
      .id;
    const prep = await req(`/api/kampagnen/${kid}/ki/sitzungsprep`, 'POST', {}, cookie);
    expect(prep.status).toBe(402);
    expect((await prep.json()).benoetigt).toBe('plus');

    const karte = await req(
      `/api/kampagnen/${kid}/ki/karte`,
      'POST',
      { prompt: 'x' },
      cookie,
    );
    expect(karte.status).toBe(402);
    expect((await karte.json()).benoetigt).toBe('premium');
  });

  it('meldet 503, wenn kein Provider konfiguriert ist', async () => {
    // Eigene App ohne Provider, aber mit gültiger Premium-Session.
    const store2 = new NutzerStore(path.join(datenOrdner, 'users2.json'));
    store2.laden();
    const saas2: SaasKontext = {
      nutzerStore: store2,
      register: new MandantenRegister(path.join(datenOrdner, 'zwei')),
      session: new SessionManager('geheim2'),
      sichereCookies: false,
    };
    const app2 = erstelleApp(null, null, saas2, null);
    const srv2 = await new Promise<Server>((resolve) => {
      const s = app2.listen(0, () => resolve(s));
    });
    const adr = srv2.address();
    if (typeof adr === 'string' || adr === null) throw new Error('Kein Port');
    const url = `http://127.0.0.1:${adr.port}`;

    const reg = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.io', passwort: 'sicher123' }),
    });
    const cookie = reg.headers.getSetCookie!().find((c) => c.startsWith('campanium_session='))!.split(';')[0]!;
    const id = (await reg.json()).id;
    await fetch(`${url}/api/admin/nutzer/${id}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ plan: 'premium' }),
    });
    const kid = (
      await (
        await fetch(`${url}/api/kampagnen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ name: 'Welt' }),
        })
      ).json()
    ).id;
    const prep = await fetch(`${url}/api/kampagnen/${kid}/ki/sitzungsprep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: '{}',
    });
    expect(prep.status).toBe(503);
    const karte = await fetch(`${url}/api/kampagnen/${kid}/ki/karte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ prompt: 'x' }),
    });
    expect(karte.status).toBe(503);
    srv2.close();
  });
});
