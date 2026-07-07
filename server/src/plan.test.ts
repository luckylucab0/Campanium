// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Abo-Gating im SaaS-Modus: /api/plan, Admin-Plan-Zuweisung und die
 * serverseitige Durchsetzung am KI-Assistenten (402 unter Basis, 200 ab
 * Basis; /api/ki/status folgt dem Plan). Ein Fake-Provider ersetzt die echte
 * KI, damit der Test ohne Schlüssel läuft.
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

let server: Server;
let basisUrl: string;
let datenOrdner: string;
let adminCookie: string;
let userCookie: string;
let userId: string;

const fakeProvider: KiProvider = {
  provider: 'fake',
  modell: 'fake-1',
  chat: () => Promise.resolve({ text: 'ok', toolAufrufe: [] }),
};

beforeAll(async () => {
  datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'campanium-plan-'));
  const nutzerStore = new NutzerStore(path.join(datenOrdner, 'users.json'));
  nutzerStore.laden();
  const saas: SaasKontext = {
    nutzerStore,
    register: new MandantenRegister(datenOrdner),
    session: new SessionManager('test-geheimnis'),
    sichereCookies: false,
  };
  const app = erstelleApp(null, fakeProvider, saas);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const adresse = server.address();
  if (typeof adresse === 'string' || adresse === null) throw new Error('Kein Port');
  basisUrl = `http://127.0.0.1:${adresse.port}`;

  adminCookie = sessionAus(await register('admin@example.com')); // erster = Admin
  const uReg = await register('spieler@example.com');
  userCookie = sessionAus(uReg);
  userId = (await uReg.json()).id;
});

afterAll(() => {
  server.close();
  fs.rmSync(datenOrdner, { recursive: true, force: true });
});

function sessionAus(antwort: Response): string {
  const kekse = antwort.headers.getSetCookie?.() ?? [];
  const treffer =
    kekse.find((c) => c.startsWith('campanium_session=')) ??
    (antwort.headers.get('set-cookie')?.includes('campanium_session=')
      ? antwort.headers.get('set-cookie')!
      : undefined);
  if (!treffer) throw new Error('Kein Session-Cookie');
  return treffer.split(';')[0]!;
}

function register(email: string) {
  return req('/api/auth/register', 'POST', { email, passwort: 'sicher123' });
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

describe('Abo-Status', () => {
  it('meldet für ein neues Konto den Plan „frei“ ohne KI-Features', async () => {
    const plan = await (await req('/api/plan', 'GET', undefined, userCookie)).json();
    expect(plan.plan).toBe('frei');
    expect(plan.features['ki-assistent']).toBe(false);
  });

  it('meldet /api/ki/status trotz Provider als inaktiv (Plan zu niedrig)', async () => {
    const status = await (await req('/api/ki/status', 'GET', undefined, userCookie)).json();
    expect(status.aktiv).toBe(false);
  });
});

describe('KI-Gating am Chat', () => {
  it('lehnt den Chat unter Basis mit 402 ab', async () => {
    const kampagne = await (
      await req('/api/kampagnen', 'POST', { name: 'Testwelt' }, userCookie)
    ).json();
    const antwort = await req(
      `/api/kampagnen/${kampagne.id}/chat`,
      'POST',
      { nachrichten: [{ rolle: 'nutzer', text: 'Hallo' }] },
      userCookie,
    );
    expect(antwort.status).toBe(402);
    expect((await antwort.json()).benoetigt).toBe('basis');
  });
});

describe('Admin-Plan-Zuweisung', () => {
  it('verweigert Nicht-Admins den Admin-Bereich (403)', async () => {
    const antwort = await req('/api/admin/nutzer', 'GET', undefined, userCookie);
    expect(antwort.status).toBe(403);
  });

  it('lehnt unbekannte Plan-Stufen mit 400 ab', async () => {
    const antwort = await req(`/api/admin/nutzer/${userId}/plan`, 'PUT', { plan: 'gold' }, adminCookie);
    expect(antwort.status).toBe(400);
  });

  it('hebt ein Konto auf Basis an und schaltet den Chat frei', async () => {
    const gesetzt = await req(`/api/admin/nutzer/${userId}/plan`, 'PUT', { plan: 'basis' }, adminCookie);
    expect(gesetzt.status).toBe(200);
    expect((await gesetzt.json()).plan).toBe('basis');

    // Jetzt meldet der Status aktiv …
    const status = await (await req('/api/ki/status', 'GET', undefined, userCookie)).json();
    expect(status.aktiv).toBe(true);

    // … und der Chat antwortet mit 200.
    const kampagne = await (
      await req('/api/kampagnen', 'POST', { name: 'Zweite Welt' }, userCookie)
    ).json();
    const chat = await req(
      `/api/kampagnen/${kampagne.id}/chat`,
      'POST',
      { nachrichten: [{ rolle: 'nutzer', text: 'Hallo' }] },
      userCookie,
    );
    expect(chat.status).toBe(200);
    expect((await chat.json()).antwort).toBe('ok');
  });
});
