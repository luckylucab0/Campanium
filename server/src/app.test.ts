/**
 * API-CRUD-Tests: starten die Express-App auf einem zufälligen Port mit
 * temporärem Datenordner und prüfen Anlegen, Ändern, Validierung, Löschen
 * sowie die Persistenz auf der Platte.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleApp } from './app';
import { Storage } from './storage';

let server: Server;
let basisUrl: string;
let datenOrdner: string;

beforeAll(async () => {
  datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'ravenloft-test-'));
  const storage = new Storage(datenOrdner);
  storage.laden();
  const app = erstelleApp(storage);
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

describe('Entitäten-CRUD', () => {
  it('legt einen NSC an, vergibt Slug-ID und schreibt die Datei', async () => {
    const antwort = await fetch(`${basisUrl}/api/entitaeten/nsc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gregor der Kerzenmacher', haltung: 'freundlich' }),
    });
    expect(antwort.status).toBe(201);
    const nsc = await antwort.json();
    expect(nsc.id).toBe('gregor-der-kerzenmacher');
    expect(nsc.haltung).toBe('freundlich');
    expect(nsc.status).toBe('lebendig'); // Template-Default
    expect(fs.existsSync(path.join(datenOrdner, 'nsc', 'gregor-der-kerzenmacher.json'))).toBe(true);
  });

  it('liefert alles über /api/alles inkl. Singletons', async () => {
    const alles = await (await fetch(`${basisUrl}/api/alles`)).json();
    expect(alles.entitaeten.some((e: { id: string }) => e.id === 'gregor-der-kerzenmacher')).toBe(
      true,
    );
    expect(alles.kampagnenstand.partyLevel).toBe(1);
    expect(alles.tarokka.karten).toHaveLength(5);
  });

  it('aktualisiert eine Entität und schützt id/typ/erstellt', async () => {
    const antwort = await fetch(`${basisUrl}/api/entitaeten/nsc/gregor-der-kerzenmacher`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'untot', id: 'boese-id', typ: 'quest' }),
    });
    expect(antwort.status).toBe(200);
    const nsc = await antwort.json();
    expect(nsc.status).toBe('untot');
    expect(nsc.id).toBe('gregor-der-kerzenmacher');
    expect(nsc.typ).toBe('nsc');
  });

  it('weist ungültige Daten mit 400 ab (Zod-Validierung)', async () => {
    const antwort = await fetch(`${basisUrl}/api/entitaeten/nsc/gregor-der-kerzenmacher`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verschollen' }),
    });
    expect(antwort.status).toBe(400);
    const fehler = await antwort.json();
    expect(fehler.fehler).toContain('status');
  });

  it('vergibt bei Namenskollision eine eindeutige ID', async () => {
    const antwort = await fetch(`${basisUrl}/api/entitaeten/nsc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gregor der Kerzenmacher' }),
    });
    const nsc = await antwort.json();
    expect(nsc.id).toBe('gregor-der-kerzenmacher-2');
  });

  it('weist unbekannte Typen mit 404 ab', async () => {
    const antwort = await fetch(`${basisUrl}/api/entitaeten/drache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smaug' }),
    });
    expect(antwort.status).toBe(404);
  });

  it('löscht Entität samt Datei', async () => {
    const antwort = await fetch(`${basisUrl}/api/entitaeten/nsc/gregor-der-kerzenmacher-2`, {
      method: 'DELETE',
    });
    expect(antwort.status).toBe(204);
    expect(fs.existsSync(path.join(datenOrdner, 'nsc', 'gregor-der-kerzenmacher-2.json'))).toBe(
      false,
    );
  });
});

describe('Singletons', () => {
  it('speichert den Kampagnenstand validiert', async () => {
    const alles = await (await fetch(`${basisUrl}/api/alles`)).json();
    const neu = { ...alles.kampagnenstand, ireenasBisse: 2, partyLevel: 4 };
    const antwort = await fetch(`${basisUrl}/api/kampagnenstand`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(neu),
    });
    expect(antwort.status).toBe(200);
    expect(fs.existsSync(path.join(datenOrdner, 'kampagnenstand.json'))).toBe(true);
  });

  it('weist ungültigen Kampagnenstand ab (ireenasBisse > 3)', async () => {
    const alles = await (await fetch(`${basisUrl}/api/alles`)).json();
    const antwort = await fetch(`${basisUrl}/api/kampagnenstand`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alles.kampagnenstand, ireenasBisse: 7 }),
    });
    expect(antwort.status).toBe(400);
  });
});
