/**
 * API-CRUD-Tests: starten die Express-App auf einem zufälligen Port mit
 * temporärem Datenordner und prüfen Kampagnen-Verwaltung, Anlegen, Ändern,
 * Validierung, Löschen sowie die Persistenz auf der Platte.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleApp } from './app';
import type { KiNachricht, KiProvider } from './ki/provider';
import { KampagnenVerwaltung } from './storage';

let server: Server;
let basisUrl: string;
let datenOrdner: string;
/** ID der im Test angelegten Kampagne. */
let kid: string;

beforeAll(async () => {
  datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'campanium-test-'));
  const verwaltung = new KampagnenVerwaltung(datenOrdner);
  verwaltung.laden();
  const app = erstelleApp(verwaltung);
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

async function post(pfad: string, body: unknown) {
  return fetch(`${basisUrl}${pfad}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function put(pfad: string, body: unknown) {
  return fetch(`${basisUrl}${pfad}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Kampagnen', () => {
  it('startet ohne Kampagnen', async () => {
    const liste = await (await fetch(`${basisUrl}/api/kampagnen`)).json();
    expect(liste).toEqual([]);
  });

  it('legt eine Kampagne an (Ordner + Manifest + Slug-ID)', async () => {
    const antwort = await post('/api/kampagnen', {
      name: 'Curse of Strahd',
      beschreibung: 'Die Nebel rufen',
    });
    expect(antwort.status).toBe(201);
    const kampagne = await antwort.json();
    kid = kampagne.id;
    expect(kid).toBe('curse-of-strahd');
    expect(fs.existsSync(path.join(datenOrdner, kid, 'kampagne.json'))).toBe(true);
  });

  it('benennt eine Kampagne um', async () => {
    const antwort = await put(`/api/kampagnen/${kid}`, { beschreibung: 'Neu' });
    expect(antwort.status).toBe(200);
    expect((await antwort.json()).beschreibung).toBe('Neu');
  });

  it('liefert 404 für unbekannte Kampagnen', async () => {
    const antwort = await fetch(`${basisUrl}/api/kampagnen/gibts-nicht/alles`);
    expect(antwort.status).toBe(404);
  });
});

describe('Entitäten-CRUD (kampagnenbezogen)', () => {
  it('legt einen NSC an, vergibt Slug-ID und schreibt die Datei', async () => {
    const antwort = await post(`/api/kampagnen/${kid}/entitaeten/nsc`, {
      name: 'Gregor der Kerzenmacher',
      haltung: 'freundlich',
    });
    expect(antwort.status).toBe(201);
    const nsc = await antwort.json();
    expect(nsc.id).toBe('gregor-der-kerzenmacher');
    expect(nsc.haltung).toBe('freundlich');
    expect(nsc.status).toBe('lebendig'); // Template-Default
    expect(fs.existsSync(path.join(datenOrdner, kid, 'nsc', 'gregor-der-kerzenmacher.json'))).toBe(
      true,
    );
  });

  it('liefert alles über /alles inkl. Singletons', async () => {
    const alles = await (await fetch(`${basisUrl}/api/kampagnen/${kid}/alles`)).json();
    expect(alles.entitaeten.some((e: { id: string }) => e.id === 'gregor-der-kerzenmacher')).toBe(
      true,
    );
    expect(alles.kampagnenstand.partyLevel).toBe(1);
    expect(alles.widersacher.begegnungen).toEqual([]);
    expect(alles.lesung.karten).toEqual([]);
  });

  it('aktualisiert eine Entität und schützt id/typ/erstellt', async () => {
    const antwort = await put(`/api/kampagnen/${kid}/entitaeten/nsc/gregor-der-kerzenmacher`, {
      status: 'untot',
      id: 'boese-id',
      typ: 'quest',
    });
    expect(antwort.status).toBe(200);
    const nsc = await antwort.json();
    expect(nsc.status).toBe('untot');
    expect(nsc.id).toBe('gregor-der-kerzenmacher');
    expect(nsc.typ).toBe('nsc');
  });

  it('weist ungültige Daten mit 400 ab (Zod-Validierung)', async () => {
    const antwort = await put(`/api/kampagnen/${kid}/entitaeten/nsc/gregor-der-kerzenmacher`, {
      status: 'verschollen',
    });
    expect(antwort.status).toBe(400);
    const fehler = await antwort.json();
    expect(fehler.fehler).toContain('status');
  });

  it('trennt Kampagnen voneinander', async () => {
    const kampagne2 = await (await post('/api/kampagnen', { name: 'Zweite Welt' })).json();
    const alles2 = await (await fetch(`${basisUrl}/api/kampagnen/${kampagne2.id}/alles`)).json();
    expect(alles2.entitaeten).toEqual([]);
    // Entität aus Kampagne 1 ist in Kampagne 2 nicht erreichbar.
    const antwort = await put(
      `/api/kampagnen/${kampagne2.id}/entitaeten/nsc/gregor-der-kerzenmacher`,
      { status: 'tot' },
    );
    expect(antwort.status).toBe(404);
  });

  it('löscht Entität samt Datei', async () => {
    await post(`/api/kampagnen/${kid}/entitaeten/nsc`, { name: 'Wegwerf-NSC' });
    const antwort = await fetch(`${basisUrl}/api/kampagnen/${kid}/entitaeten/nsc/wegwerf-nsc`, {
      method: 'DELETE',
    });
    expect(antwort.status).toBe(204);
    expect(fs.existsSync(path.join(datenOrdner, kid, 'nsc', 'wegwerf-nsc.json'))).toBe(false);
  });
});

describe('Bilder', () => {
  /** 1×1-PNG (Magic Bytes reichen – der Server prüft nur den Content-Type). */
  const miniPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

  it('nimmt einen Upload an und liefert das Bild wieder aus', async () => {
    const upload = await fetch(`${basisUrl}/api/kampagnen/${kid}/bilder`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: miniPng,
    });
    expect(upload.status).toBe(201);
    const { datei } = await upload.json();
    expect(datei).toMatch(/^[\w-]+\.png$/);
    expect(fs.existsSync(path.join(datenOrdner, kid, 'bilder', datei))).toBe(true);

    const abruf = await fetch(`${basisUrl}/api/kampagnen/${kid}/bilder/${datei}`);
    expect(abruf.status).toBe(200);
    expect(Buffer.from(await abruf.arrayBuffer())).toEqual(miniPng);
  });

  it('weist nicht unterstützte Formate ab', async () => {
    const antwort = await fetch(`${basisUrl}/api/kampagnen/${kid}/bilder`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml' },
      body: '<svg/>',
    });
    expect(antwort.status).toBe(400);
  });

  it('blockiert Pfad-Tricks beim Abruf', async () => {
    const antwort = await fetch(
      `${basisUrl}/api/kampagnen/${kid}/bilder/${encodeURIComponent('../kampagne.json')}`,
    );
    expect(antwort.status).toBe(404);
  });
});

describe('KI-Chat-Guardrails (Verlaufs- und Längenlimits)', () => {
  it('kürzt lange Verläufe und überlange Nachrichten vor dem Provider-Aufruf', async () => {
    // Eigene App mit Fake-Provider, der den empfangenen Verlauf aufzeichnet.
    const empfangen: KiNachricht[][] = [];
    const fakeProvider: KiProvider = {
      provider: 'fake',
      modell: 'fake-1',
      chat: (_system, nachrichten) => {
        empfangen.push([...nachrichten]);
        return Promise.resolve({ text: 'ok', toolAufrufe: [] });
      },
    };
    const verwaltung = new KampagnenVerwaltung(datenOrdner);
    verwaltung.laden();
    const kiApp = erstelleApp(verwaltung, fakeProvider);
    const kiServer = await new Promise<Server>((resolve) => {
      const s = kiApp.listen(0, () => resolve(s));
    });
    const adresse = kiServer.address();
    if (typeof adresse === 'string' || adresse === null) throw new Error('Kein Port');

    // 30 Nachrichten, die letzte 10 000 Zeichen lang.
    const nachrichten = Array.from({ length: 29 }, (_, i) => ({
      rolle: i % 2 === 0 ? 'nutzer' : 'assistent',
      text: `Nachricht ${i + 1}`,
    }));
    nachrichten.push({ rolle: 'nutzer', text: 'x'.repeat(10_000) });

    const antwort = await fetch(`http://127.0.0.1:${adresse.port}/api/kampagnen/${kid}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nachrichten }),
    });
    kiServer.close();

    expect(antwort.status).toBe(200);
    const texte = empfangen[0]!.map((n) => ('text' in n ? n.text : ''));
    // Nur die letzten 20 Nachrichten erreichen den Provider …
    expect(texte).toHaveLength(20);
    expect(texte[0]).toBe('Nachricht 11');
    // … und überlange Nachrichten sind auf 4000 Zeichen gekürzt.
    expect(texte.at(-1)).toHaveLength(4000);
  });
});

describe('Singletons', () => {
  it('speichert den Kampagnenstand validiert (inkl. Eskalation)', async () => {
    const alles = await (await fetch(`${basisUrl}/api/kampagnen/${kid}/alles`)).json();
    const neu = {
      ...alles.kampagnenstand,
      partyLevel: 4,
      eskalation: { titel: 'Strahds Eskalation', stufe: 2, stufen: ['ruhig', 'neugierig'] },
    };
    const antwort = await put(`/api/kampagnen/${kid}/kampagnenstand`, neu);
    expect(antwort.status).toBe(200);
    expect(fs.existsSync(path.join(datenOrdner, kid, 'kampagnenstand.json'))).toBe(true);
  });

  it('weist Eskalationsstufe außerhalb der Stufen ab', async () => {
    const alles = await (await fetch(`${basisUrl}/api/kampagnen/${kid}/alles`)).json();
    const antwort = await put(`/api/kampagnen/${kid}/kampagnenstand`, {
      ...alles.kampagnenstand,
      eskalation: { titel: 'X', stufe: 9, stufen: ['eins', 'zwei'] },
    });
    expect(antwort.status).toBe(400);
  });

  it('speichert den Kalender validiert und weist kaputte Daten ab', async () => {
    const ok = await put(`/api/kampagnen/${kid}/kalender`, {
      aera: 'BC',
      monate: [{ name: 'Frosthauch', tage: 30 }],
      aktuell: { jahr: 735, monat: 1, tag: 12 },
      ereignisse: [
        { id: 'e1', datum: { jahr: 735, monat: 1, tag: 14 }, titel: 'Fest', entitaetId: null },
      ],
    });
    expect(ok.status).toBe(200);
    expect(fs.existsSync(path.join(datenOrdner, kid, 'kalender.json'))).toBe(true);
    const alles = await (await fetch(`${basisUrl}/api/kampagnen/${kid}/alles`)).json();
    expect(alles.kalender.monate).toHaveLength(1);

    const kaputt = await put(`/api/kampagnen/${kid}/kalender`, {
      aera: '',
      monate: [{ name: 'X', tage: 0 }],
      aktuell: { jahr: 1, monat: 1, tag: 1 },
      ereignisse: [],
    });
    expect(kaputt.status).toBe(400);
  });

  it('speichert Widersacher-Tracker und Lesung', async () => {
    const widersacher = await put(`/api/kampagnen/${kid}/widersacher`, {
      name: 'Strahd von Zarovich',
      begegnungen: [],
      ideen: [{ text: 'Krähen', erledigt: false }],
    });
    expect(widersacher.status).toBe(200);
    const lesung = await put(`/api/kampagnen/${kid}/lesung`, {
      titel: 'Tarokka-Lesung',
      karten: [
        {
          aspekt: 'Verbündeter',
          karte: 'Die Wirtin',
          aufgeloestId: null,
          aufgeloestText: '',
          status: 'geheim',
        },
      ],
    });
    expect(lesung.status).toBe(200);
  });
});
