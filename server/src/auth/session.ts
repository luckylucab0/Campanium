// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Sitzungs-Token für den SaaS-Modus (nur aktiv, wenn CAMPANIUM_SAAS gesetzt
 * ist – die Self-Host-Variante kennt weder Konten noch Sessions).
 *
 * Bewusst dependency-arm: statt einer JWT-/Cookie-Bibliothek nur node:crypto.
 * Ein Token ist `base64url(payload).hmacSHA256(payload)`, wobei der Payload
 * `<nutzerId>.<ausgestelltMs>` ist. Der HMAC macht ihn fälschungssicher; ein
 * Alterslimit (Default 30 Tage) begrenzt gestohlene Tokens. Der Token wandert
 * als HttpOnly-Cookie zum Browser – er ist damit für Skripte unerreichbar.
 */
import crypto from 'node:crypto';
import type express from 'express';

/** Name des Session-Cookies (HttpOnly). */
export const SESSION_COOKIE = 'campanium_session';

/** Maximale Gültigkeit eines Tokens (30 Tage). */
const MAX_ALTER_MS = 30 * 24 * 60 * 60 * 1000;

export class SessionManager {
  constructor(private readonly secret: string) {}

  /** Signiert eine Nutzer-ID zu einem manipulationssicheren Token. */
  signiere(nutzerId: string): string {
    const payload = base64url(`${nutzerId}.${Date.now()}`);
    return `${payload}.${this.hmac(payload)}`;
  }

  /**
   * Prüft ein Token und liefert die Nutzer-ID – oder null, wenn Signatur
   * ungültig, Format kaputt oder der Token zu alt ist.
   */
  pruefe(token: string | undefined): string | null {
    if (!token) return null;
    const punkt = token.lastIndexOf('.');
    if (punkt <= 0) return null;
    const payload = token.slice(0, punkt);
    const signatur = token.slice(punkt + 1);
    // Signatur zeitkonstant vergleichen (kein Frühabbruch → kein Timing-Leak).
    const erwartet = this.hmac(payload);
    if (!zeitgleich(signatur, erwartet)) return null;

    const roh = entpackeBase64url(payload);
    const trenner = roh.lastIndexOf('.');
    if (trenner <= 0) return null;
    const nutzerId = roh.slice(0, trenner);
    const ausgestellt = Number(roh.slice(trenner + 1));
    if (!Number.isFinite(ausgestellt) || Date.now() - ausgestellt > MAX_ALTER_MS) return null;
    return nutzerId;
  }

  private hmac(payload: string): string {
    return crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}

/** base64url-kodiert einen UTF-8-String. */
function base64url(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64url');
}

/** Dekodiert einen base64url-String zurück nach UTF-8. */
function entpackeBase64url(kodiert: string): string {
  return Buffer.from(kodiert, 'base64url').toString('utf-8');
}

/** Zeitkonstanter String-Vergleich (verhindert Timing-Angriffe auf den HMAC). */
function zeitgleich(a: string, b: string): boolean {
  const pufferA = Buffer.from(a);
  const pufferB = Buffer.from(b);
  if (pufferA.length !== pufferB.length) return false;
  return crypto.timingSafeEqual(pufferA, pufferB);
}

/** Liest einen einzelnen Cookie-Wert aus dem Request-Header (ohne Dependency). */
export function leseCookie(req: express.Request, name: string): string | undefined {
  const roh = req.headers.cookie;
  if (!roh) return undefined;
  for (const teil of roh.split(';')) {
    const gleich = teil.indexOf('=');
    if (gleich === -1) continue;
    if (teil.slice(0, gleich).trim() === name) {
      return decodeURIComponent(teil.slice(gleich + 1).trim());
    }
  }
  return undefined;
}

/**
 * Ermittelt das Session-Geheimnis: bevorzugt CAMPANIUM_SECRET, sonst wird
 * einmalig eines erzeugt und in `<datenWurzel>/.secret` persistiert, damit
 * Tokens einen Neustart überleben.
 */
export function ladeOderErzeugeSecret(
  datenWurzel: string,
  vorgabe: string | undefined,
  fs: typeof import('node:fs'),
  path: typeof import('node:path'),
): string {
  const bereinigt = vorgabe?.trim();
  if (bereinigt) return bereinigt;
  const datei = path.join(datenWurzel, '.secret');
  if (fs.existsSync(datei)) {
    const inhalt = fs.readFileSync(datei, 'utf-8').trim();
    if (inhalt) return inhalt;
  }
  const neu = crypto.randomBytes(32).toString('base64url');
  fs.mkdirSync(datenWurzel, { recursive: true });
  fs.writeFileSync(datei, neu + '\n', { mode: 0o600 });
  return neu;
}
