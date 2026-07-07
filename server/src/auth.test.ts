// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Auth- und Multi-Tenancy-Tests (SaaS-Modus): Registrierung, Login, Session-
 * Cookie, Rollen (erster Nutzer = Admin) und – am wichtigsten – die
 * Mandanten-Isolation: Konto A sieht die Kampagnen von Konto B nicht.
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

let server: Server;
let basisUrl: string;
let datenOrdner: string;

beforeAll(async () => {
  datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'campanium-auth-'));
  const nutzerStore = new NutzerStore(path.join(datenOrdner, 'users.json'), 'admin@example.com');
  nutzerStore.laden();
  const saas: SaasKontext = {
    nutzerStore,
    register: new MandantenRegister(datenOrdner),
    session: new SessionManager('test-geheimnis'),
    sichereCookies: false,
  };
  const app = erstelleApp(null, null, saas);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const adresse = server.address();
  if (typeof adresse === 'string' || adresse === null) throw new Error('Kein Port');
  basisUrl = `http://127.0.0.1:${adresse.port}`;
});

afterAll(() => {
  server.close();
  fs.rmSync(datenOrdner, { recursive: true, force: true });
});

/** Extrahiert das Session-Cookie (name=value) aus einer Antwort. */
function sessionAus(antwort: Response): string {
  const kekse = antwort.headers.getSetCookie?.() ?? [];
  const treffer =
    kekse.find((c) => c.startsWith('campanium_session=')) ??
    (antwort.headers.get('set-cookie')?.includes('campanium_session=')
      ? antwort.headers.get('set-cookie')!
      : undefined);
  if (!treffer) throw new Error('Kein Session-Cookie in der Antwort');
  return treffer.split(';')[0]!;
}

function json(pfad: string, methode: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${basisUrl}${pfad}`, {
    method: methode,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('SaaS-Konfiguration', () => {
  it('meldet den SaaS-Modus über /api/config', async () => {
    const config = await (await fetch(`${basisUrl}/api/config`)).json();
    expect(config.saas).toBe(true);
  });
});

describe('Registrierung & Login', () => {
  it('lehnt zu kurze Passwörter mit 400 ab', async () => {
    const antwort = await json('/api/auth/register', 'POST', {
      email: 'kurz@example.com',
      passwort: 'abc',
    });
    expect(antwort.status).toBe(400);
  });

  it('lehnt ungültige E-Mail mit 400 ab', async () => {
    const antwort = await json('/api/auth/register', 'POST', {
      email: 'keine-email',
      passwort: 'sicher123',
    });
    expect(antwort.status).toBe(400);
  });

  it('registriert den ersten Nutzer als Admin', async () => {
    const antwort = await json('/api/auth/register', 'POST', {
      email: 'admin@example.com',
      passwort: 'sicher123',
    });
    expect(antwort.status).toBe(201);
    const nutzer = await antwort.json();
    expect(nutzer.email).toBe('admin@example.com');
    expect(nutzer.rolle).toBe('admin');
    expect(nutzer.plan).toBe('frei');
    expect(nutzer.passwortHash).toBeUndefined(); // Hash verlässt den Server nie
  });

  it('lehnt doppelte Registrierung mit 409 ab', async () => {
    const antwort = await json('/api/auth/register', 'POST', {
      email: 'admin@example.com',
      passwort: 'sicher123',
    });
    expect(antwort.status).toBe(409);
  });

  it('liefert das Konto über /me mit gültigem Cookie', async () => {
    const login = await json('/api/auth/login', 'POST', {
      email: 'admin@example.com',
      passwort: 'sicher123',
    });
    expect(login.status).toBe(200);
    const cookie = sessionAus(login);
    const me = await json('/api/auth/me', 'GET', undefined, cookie);
    expect(me.status).toBe(200);
    expect((await me.json()).email).toBe('admin@example.com');
  });

  it('lehnt falsches Passwort mit 401 ab', async () => {
    const antwort = await json('/api/auth/login', 'POST', {
      email: 'admin@example.com',
      passwort: 'falsch-falsch',
    });
    expect(antwort.status).toBe(401);
  });

  it('lehnt /me ohne Cookie mit 401 ab', async () => {
    const antwort = await json('/api/auth/me', 'GET');
    expect(antwort.status).toBe(401);
  });
});

describe('Mandanten-Isolation', () => {
  it('schützt /api/kampagnen ohne Session (401)', async () => {
    const antwort = await fetch(`${basisUrl}/api/kampagnen`);
    expect(antwort.status).toBe(401);
  });

  it('trennt die Kampagnen zweier Konten vollständig', async () => {
    // Konto A (Admin) legt eine Kampagne an.
    const loginA = await json('/api/auth/login', 'POST', {
      email: 'admin@example.com',
      passwort: 'sicher123',
    });
    const cookieA = sessionAus(loginA);
    const kampagneA = await (
      await json('/api/kampagnen', 'POST', { name: 'Reich von A' }, cookieA)
    ).json();
    expect(kampagneA.id).toBe('reich-von-a');

    // Konto B registriert sich (zweiter Nutzer → normale Rolle).
    const registerB = await json('/api/auth/register', 'POST', {
      email: 'spieler-b@example.com',
      passwort: 'sicher123',
    });
    expect(registerB.status).toBe(201);
    expect((await registerB.json()).rolle).toBe('nutzer');
    const cookieB = sessionAus(registerB);

    // B sieht keine Kampagnen und kann A's Kampagne nicht abrufen.
    const listeB = await (await json('/api/kampagnen', 'GET', undefined, cookieB)).json();
    expect(listeB).toEqual([]);
    const zugriffB = await json(`/api/kampagnen/${kampagneA.id}/alles`, 'GET', undefined, cookieB);
    expect(zugriffB.status).toBe(404);

    // A sieht seine eigene Kampagne weiterhin.
    const listeA = await (await json('/api/kampagnen', 'GET', undefined, cookieA)).json();
    expect(listeA.map((k: { id: string }) => k.id)).toContain('reich-von-a');

    // Getrennte Datenordner auf der Platte.
    const nutzer = JSON.parse(fs.readFileSync(path.join(datenOrdner, 'users.json'), 'utf-8'));
    const idA = nutzer.find((n: { email: string }) => n.email === 'admin@example.com').id;
    expect(fs.existsSync(path.join(datenOrdner, idA, 'reich-von-a', 'kampagne.json'))).toBe(true);
  });
});
