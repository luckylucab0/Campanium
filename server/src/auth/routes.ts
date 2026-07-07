// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Auth-Routen + Middleware für den SaaS-Modus (Registrierung, Login, Logout,
 * „wer bin ich"). Wird nur montiert, wenn CAMPANIUM_SAAS aktiv ist. Die
 * Session steckt in einem HttpOnly-Cookie; `authPflicht` löst sie zu
 * `req.nutzerId` auf und schützt alle kampagnen-bezogenen Routen.
 */
import express from 'express';
import { istPlanStufe, parsePlan, planErlaubt, type KiFeature } from '@campanium/shared';
import { MandantenRegister } from '../mandanten';
import { NutzerStore, oeffentlich } from './nutzer';
import { leseCookie, SESSION_COOKIE, SessionManager } from './session';

/** Alles, was der SaaS-Modus zur Laufzeit braucht (null = Self-Host). */
export interface SaasKontext {
  nutzerStore: NutzerStore;
  register: MandantenRegister;
  session: SessionManager;
  /** Cookie nur über HTTPS senden (Produktion). Dev/Tests: false. */
  sichereCookies: boolean;
}

/** Request mit aufgelöster Nutzer-ID (durch authPflicht gesetzt). */
export type AuthRequest = express.Request & { nutzerId?: string };

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORT_MIN = 8;
const COOKIE_MAX_ALTER_MS = 30 * 24 * 60 * 60 * 1000;

function cookieOptionen(saas: SaasKontext): express.CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_ALTER_MS,
    secure: saas.sichereCookies,
  };
}

/**
 * Middleware: verlangt eine gültige Session. Ohne sie → 401. Mit ihr wird
 * `req.nutzerId` gesetzt, sodass nachgelagerte Routen den Mandanten kennen.
 */
export function authPflicht(saas: SaasKontext): express.RequestHandler {
  return (req, res, next) => {
    const token = leseCookie(req, SESSION_COOKIE);
    const nutzerId = saas.session.pruefe(token);
    if (!nutzerId || !saas.nutzerStore.holen(nutzerId)) {
      return res.status(401).json({ fehler: 'Nicht angemeldet' });
    }
    (req as AuthRequest).nutzerId = nutzerId;
    next();
  };
}

/** Middleware: verlangt zusätzlich die Admin-Rolle (nach authPflicht). */
export function adminPflicht(saas: SaasKontext): express.RequestHandler {
  return (req, res, next) => {
    const nutzer = saas.nutzerStore.holen((req as AuthRequest).nutzerId ?? '');
    if (nutzer?.rolle !== 'admin') return res.status(403).json({ fehler: 'Nur für Admins' });
    next();
  };
}

/** Plan-Stufe des Requests (nur SaaS – authPflicht muss vorher gelaufen sein). */
export function planVon(saas: SaasKontext, req: express.Request): string {
  return saas.nutzerStore.holen((req as AuthRequest).nutzerId ?? '')?.plan ?? 'frei';
}

/** Router mit dem Abo-Status des angemeldeten Kontos (unter /api/plan). */
export function planRouter(saas: SaasKontext): express.Router {
  const router = express.Router();
  router.get('/', (req, res) => {
    const stufe = parsePlan(planVon(saas, req));
    const features: Record<KiFeature, boolean> = {
      'ki-assistent': planErlaubt(stufe, 'ki-assistent'),
      'ki-erweitert': planErlaubt(stufe, 'ki-erweitert'),
      'ki-kartengenerierung': planErlaubt(stufe, 'ki-kartengenerierung'),
    };
    res.json({ plan: stufe, features });
  });
  return router;
}

/** Admin-Router (unter /api/admin, hinter authPflicht + adminPflicht). */
export function adminRouter(saas: SaasKontext): express.Router {
  const router = express.Router();

  router.get('/nutzer', (_req, res) => {
    res.json(saas.nutzerStore.alle().map(oeffentlich));
  });

  router.put('/nutzer/:id/plan', (req, res) => {
    const plan = req.body?.plan;
    if (!istPlanStufe(plan)) return res.status(400).json({ fehler: 'Unbekannte Plan-Stufe' });
    if (!saas.nutzerStore.holen(req.params.id)) {
      return res.status(404).json({ fehler: 'Nutzer nicht gefunden' });
    }
    return res.json(oeffentlich(saas.nutzerStore.setzePlan(req.params.id, plan)));
  });

  return router;
}

/** Router mit /register, /login, /logout, /me – wird unter /api/auth montiert. */
export function authRouter(saas: SaasKontext): express.Router {
  const router = express.Router();

  router.post('/register', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const passwort = typeof req.body?.passwort === 'string' ? req.body.passwort : '';
    if (!EMAIL_MUSTER.test(email)) {
      return res.status(400).json({ fehler: 'Bitte eine gültige E-Mail-Adresse angeben' });
    }
    if (passwort.length < PASSWORT_MIN) {
      return res
        .status(400)
        .json({ fehler: `Passwort muss mindestens ${PASSWORT_MIN} Zeichen haben` });
    }
    if (saas.nutzerStore.findeEmail(email)) {
      return res.status(409).json({ fehler: 'E-Mail ist bereits registriert' });
    }
    const nutzer = saas.nutzerStore.anlegen(email, passwort);
    res.cookie(SESSION_COOKIE, saas.session.signiere(nutzer.id), cookieOptionen(saas));
    return res.status(201).json(oeffentlich(nutzer));
  });

  router.post('/login', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const passwort = typeof req.body?.passwort === 'string' ? req.body.passwort : '';
    const nutzer = saas.nutzerStore.findeEmail(email);
    if (!nutzer || !saas.nutzerStore.pruefePasswort(nutzer, passwort)) {
      return res.status(401).json({ fehler: 'E-Mail oder Passwort falsch' });
    }
    res.cookie(SESSION_COOKIE, saas.session.signiere(nutzer.id), cookieOptionen(saas));
    return res.json(oeffentlich(nutzer));
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return res.status(204).end();
  });

  router.get('/me', (req, res) => {
    const token = leseCookie(req, SESSION_COOKIE);
    const nutzerId = saas.session.pruefe(token);
    const nutzer = nutzerId ? saas.nutzerStore.holen(nutzerId) : undefined;
    if (!nutzer) return res.status(401).json({ fehler: 'Nicht angemeldet' });
    return res.json(oeffentlich(nutzer));
  });

  return router;
}
