// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Express-App mit der REST-API des DM-Modus.
 * Getrennt von index.ts, damit die API in Tests ohne echten Port
 * (über supertest-ähnliche Aufrufe bzw. http.Server) geprüft werden kann.
 *
 * Alle Routen (außer der Kampagnen-Liste) sind kampagnen-bezogen:
 *   /api/kampagnen                      – Liste / Anlegen
 *   /api/kampagnen/:kid/alles           – kompletter Datenbestand einer Kampagne
 *   /api/kampagnen/:kid/entitaeten/:typ – CRUD
 *   /api/kampagnen/:kid/kampagnenstand | widersacher | lesung – Singletons
 *
 * Alle Schreiboperationen validieren gegen die Zod-Schemas aus shared/ –
 * kaputte Daten werden mit 400 abgewiesen und erreichen nie die Platte.
 */
import express from 'express';
import { ZodError } from 'zod';
import {
  eindeutigerSlug,
  kalenderSchema,
  kampagnenstandSchema,
  lesungSchema,
  neueEntitaet,
  validiereEntitaet,
  widersacherTrackerSchema,
} from '@campanium/shared';
import { istEntityTyp, KampagnenVerwaltung, type Storage } from './storage';
import { fuehreChatAus } from './ki/chat';
import type { KiNachricht, KiProvider } from './ki/provider';
import type { KiSprache } from './ki/tools';
import { erzeugeSitzungsprep, importiereCharakter, naechsteSessionNummer } from './ki/funktionen';
import type { BildProvider } from './ki/bild';
import type { KiFeature } from '@campanium/shared';
import type { AppErweiterung } from './erweiterung';

/**
 * Baut die Express-App (Self-Host-Core).
 *
 * @param verwaltung Globale Kampagnen-Verwaltung. Ein Erweiterungs-Overlay
 *                   (z. B. SaaS/Multi-Tenancy) darf sie pro Request über
 *                   `erweiterung.verwaltungFuer` überschreiben (dann null).
 * @param kiProvider Optionaler KI-Provider (eigener Key via .env).
 * @param bildProvider Optionaler Bild-Provider (KI-Kartengenerierung).
 * @param erweiterung Optionale Erweiterungspunkte (Auth, Multi-Tenancy,
 *                   Plan-Gating). Ohne sie verhält sich die App wie bisher:
 *                   ein globaler Datenbestand, keine Konten, keine Gates.
 */
export function erstelleApp(
  verwaltung: KampagnenVerwaltung | null,
  kiProvider: KiProvider | null = null,
  bildProvider: BildProvider | null = null,
  erweiterung: AppErweiterung = {},
): express.Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Bootstrap-Endpunkt: der Client liest hieraus u. a., ob ein Overlay (SaaS)
  // aktiv ist. Der Core selbst liefert nur, was die Erweiterung beisteuert.
  app.get('/api/config', (_req, res) => res.json({ ...erweiterung.konfig }));

  // Erweiterungs-Middleware (z. B. Auth) vor die geschützten Bereiche hängen.
  for (const mw of erweiterung.middleware ?? []) {
    app.use('/api/kampagnen', mw);
    app.use('/api/ki', mw);
  }
  // Zusätzliche Router der Erweiterung (z. B. /api/auth, /api/plan, /api/admin).
  for (const r of erweiterung.router ?? []) {
    app.use(r.pfad, ...(Array.isArray(r.handler) ? r.handler : [r.handler]));
  }

  /** Die für diesen Request zuständige Verwaltung (Default: die globale). */
  const verwaltungFuer = erweiterung.verwaltungFuer ?? (() => verwaltung!);

  /** KI-Gate der Erweiterung (Default: alles erlaubt). */
  const kiGate = erweiterung.kiGate ?? (() => ({ erlaubt: true }));

  /**
   * Prüft ein KI-Feature-Gate. Bei Ablehnung schreibt die Erweiterung die
   * Antwort (SaaS: 402 mit Plan-Info) bzw. es geht ein neutraler 403 raus.
   * Rückgabe: true = erlaubt (weitermachen), false = bereits beantwortet.
   */
  const pruefeKi = (req: express.Request, res: express.Response, feature: KiFeature): boolean => {
    const entscheidung = kiGate(req, feature);
    if (entscheidung.erlaubt) return true;
    if (entscheidung.sende) entscheidung.sende(res);
    else res.status(403).json({ fehler: 'Dieses KI-Feature ist nicht freigeschaltet' });
    return false;
  };

  /** Löst :kid auf; antwortet selbst mit 404, wenn die Kampagne fehlt. */
  const mitKampagne = (
    req: express.Request,
    res: express.Response,
    kid: string | undefined,
    handler: (storage: Storage) => void,
  ) => {
    const eintrag = kid ? verwaltungFuer(req).holen(kid) : undefined;
    if (!eintrag) return res.status(404).json({ fehler: `Kampagne nicht gefunden: ${kid}` });
    handler(eintrag.storage);
  };

  // ---- Kampagnen -----------------------------------------------------------

  app.get('/api/kampagnen', (req, res) => {
    res.json(verwaltungFuer(req).liste());
  });

  app.post('/api/kampagnen', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ fehler: 'Name darf nicht leer sein' });
    const beschreibung =
      typeof req.body?.beschreibung === 'string' ? req.body.beschreibung.trim() : '';
    return res.status(201).json(verwaltungFuer(req).anlegen(name, beschreibung));
  });

  app.put('/api/kampagnen/:kid', (req, res) => {
    const { kid } = req.params;
    const verwaltung = verwaltungFuer(req);
    if (!verwaltung.holen(kid)) {
      return res.status(404).json({ fehler: `Kampagne nicht gefunden: ${kid}` });
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    if (name === '') return res.status(400).json({ fehler: 'Name darf nicht leer sein' });
    const beschreibung =
      typeof req.body?.beschreibung === 'string' ? req.body.beschreibung : undefined;
    return res.json(verwaltung.aktualisieren(kid, { name, beschreibung }));
  });

  // ---- Lesen ----------------------------------------------------------------

  /** Kompletter Datenbestand einer Kampagne – der Client lädt alles beim Wechsel. */
  app.get('/api/kampagnen/:kid/alles', (req, res) => {
    mitKampagne(req, res, req.params.kid, (storage) => {
      res.json({
        entitaeten: storage.alle(),
        kampagnenstand: storage.kampagnenstand,
        widersacher: storage.widersacher,
        lesung: storage.lesung,
        kalender: storage.kalender,
      });
    });
  });

  // ---- Entitäten-CRUD --------------------------------------------------------

  app.post('/api/kampagnen/:kid/entitaeten/:typ', (req, res) => {
    const { typ } = req.params;
    if (!istEntityTyp(typ)) return res.status(404).json({ fehler: `Unbekannter Typ: ${typ}` });
    mitKampagne(req, res, req.params.kid, (storage) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name) return res.status(400).json({ fehler: 'Name darf nicht leer sein' });

      // Template mit Defaults erzeugen, übergebene Felder darüberlegen,
      // dann validieren. ID/Zeitstempel bestimmt immer der Server.
      const id = eindeutigerSlug(name, storage.vorhandeneIds());
      const template = neueEntitaet(typ, id, name);
      const kandidat = {
        ...template,
        ...req.body,
        id,
        typ,
        name,
        erstellt: template.erstellt,
        geaendert: template.geaendert,
      };

      try {
        const entitaet = validiereEntitaet(typ, kandidat);
        storage.speichern(entitaet);
        return res.status(201).json(entitaet);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
  });

  app.put('/api/kampagnen/:kid/entitaeten/:typ/:id', (req, res) => {
    const { typ, id } = req.params;
    if (!istEntityTyp(typ)) return res.status(404).json({ fehler: `Unbekannter Typ: ${typ}` });
    mitKampagne(req, res, req.params.kid, (storage) => {
      const vorhanden = storage.holen(id);
      if (!vorhanden || vorhanden.typ !== typ) {
        return res.status(404).json({ fehler: `Nicht gefunden: ${typ}/${id}` });
      }

      // ID, Typ und Erstellungsdatum sind unveränderlich; geaendert setzt der Server.
      const kandidat = {
        ...vorhanden,
        ...req.body,
        id,
        typ,
        erstellt: vorhanden.erstellt,
        geaendert: new Date().toISOString(),
      };

      try {
        const entitaet = validiereEntitaet(typ, kandidat);
        storage.speichern(entitaet);
        return res.json(entitaet);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
  });

  app.delete('/api/kampagnen/:kid/entitaeten/:typ/:id', (req, res) => {
    const { typ, id } = req.params;
    mitKampagne(req, res, req.params.kid, (storage) => {
      const vorhanden = storage.holen(id);
      if (!vorhanden || vorhanden.typ !== typ) {
        return res.status(404).json({ fehler: `Nicht gefunden: ${typ}/${id}` });
      }
      storage.loeschen(id);
      return res.status(204).end();
    });
  });

  // ---- Bilder -----------------------------------------------------------------

  /** Content-Type → Dateiendung der erlaubten Bildformate. */
  const BILD_FORMATE: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  /**
   * Bild-Upload: Der Client schickt die Datei roh (Content-Type = Bildtyp),
   * der Server vergibt einen sicheren Dateinamen und antwortet mit ihm.
   * Entitäten speichern nur diesen Dateinamen im Feld `bild`.
   */
  app.post(
    '/api/kampagnen/:kid/bilder',
    express.raw({ type: 'image/*', limit: '10mb' }),
    (req, res) => {
      mitKampagne(req, res, req.params.kid, (storage) => {
        const contentType = (req.headers['content-type'] ?? '').split(';')[0]!.trim();
        const endung = BILD_FORMATE[contentType];
        if (!endung) {
          return res
            .status(400)
            .json({ fehler: 'Bildformat nicht unterstützt (erlaubt: PNG, JPEG, WebP, GIF)' });
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ fehler: 'Leerer Upload' });
        }
        // Zeitstempel + Zufallsteil: eindeutig, ohne Nutzereingabe im Namen.
        const datei = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${endung}`;
        storage.speichereBild(datei, req.body);
        return res.status(201).json({ datei });
      });
    },
  );

  app.get('/api/kampagnen/:kid/bilder/:datei', (req, res) => {
    mitKampagne(req, res, req.params.kid, (storage) => {
      const pfad = storage.bildPfad(req.params.datei);
      if (!pfad) return res.status(404).json({ fehler: 'Bild nicht gefunden' });
      return res.sendFile(pfad);
    });
  });

  // ---- Singletons -------------------------------------------------------------

  app.put('/api/kampagnen/:kid/kampagnenstand', (req, res) => {
    mitKampagne(req, res, req.params.kid, (storage) => {
      try {
        storage.kampagnenstand = kampagnenstandSchema.parse(req.body);
        storage.speichereSingleton('kampagnenstand', storage.kampagnenstand);
        return res.json(storage.kampagnenstand);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
  });

  app.put('/api/kampagnen/:kid/widersacher', (req, res) => {
    mitKampagne(req, res, req.params.kid, (storage) => {
      try {
        storage.widersacher = widersacherTrackerSchema.parse(req.body);
        storage.speichereSingleton('widersacher', storage.widersacher);
        return res.json(storage.widersacher);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
  });

  // ---- KI-Assistent (optional) ----------------------------------------------

  /**
   * Ist der Assistent nutzbar? Der Client blendet den Chat sonst aus.
   * Self-Host: allein vom Provider abhängig. SaaS: zusätzlich Plan ≥ Basis.
   */
  app.get('/api/ki/status', (req, res) => {
    const gateFrei = kiGate(req, 'ki-assistent').erlaubt;
    res.json(
      kiProvider && gateFrei
        ? { aktiv: true, provider: kiProvider.provider, modell: kiProvider.modell }
        : { aktiv: false },
    );
  });

  /** Ist die KI-Kartengenerierung serverseitig konfiguriert? (Bild-Provider) */
  app.get('/api/ki/bild-status', (_req, res) => {
    res.json(bildProvider ? { aktiv: true, modell: bildProvider.modell } : { aktiv: false });
  });

  /**
   * Chat-Anfrage: nimmt den bisherigen Gesprächsverlauf (nur Nutzer-/
   * Assistent-Texte) entgegen und führt den Agent-Loop inkl. Werkzeugen
   * gegen die Kampagne aus. Nicht streamend – Antworten sind kurz.
   *
   * Guardrails gegen Token-Verschwendung (ergänzend zu den Regeln im
   * System-Prompt): Der Verlauf wird auf die letzten Nachrichten begrenzt
   * und überlange Einzelnachrichten werden gekürzt – der volle Verlauf
   * würde sonst mit jeder Runde erneut zum Provider geschickt.
   */
  const CHAT_MAX_NACHRICHTEN = 20;
  const CHAT_MAX_ZEICHEN = 4000;

  app.post('/api/kampagnen/:kid/chat', (req, res) => {
    if (!kiProvider) {
      return res
        .status(503)
        .json({ fehler: 'KI-Assistent ist nicht konfiguriert (siehe .env.example)' });
    }
    // Feature-Gate der Erweiterung (Self-Host: immer frei; SaaS: Plan ≥ Basis).
    if (!pruefeKi(req, res, 'ki-assistent')) return;
    mitKampagne(req, res, req.params.kid, (storage) => {
      const eintrag = verwaltungFuer(req).holen(req.params.kid)!;
      const roh = Array.isArray(req.body?.nachrichten) ? req.body.nachrichten : [];
      const verlauf: KiNachricht[] = [];
      for (const n of roh.slice(-CHAT_MAX_NACHRICHTEN)) {
        if (n && typeof n.text === 'string' && (n.rolle === 'nutzer' || n.rolle === 'assistent')) {
          verlauf.push({ rolle: n.rolle, text: n.text.slice(0, CHAT_MAX_ZEICHEN) });
        }
      }
      if (verlauf.length === 0 || verlauf[verlauf.length - 1]?.rolle !== 'nutzer') {
        return res
          .status(400)
          .json({ fehler: 'nachrichten muss mit einer Nutzer-Nachricht enden' });
      }
      // UI-Sprache des Clients (Antworten + Aktions-Beschreibungen), Default Deutsch.
      const sprache: KiSprache = req.body?.sprache === 'en' ? 'en' : 'de';
      fuehreChatAus(kiProvider, eintrag.kampagne, storage, verlauf, sprache)
        .then((ergebnis) => res.json(ergebnis))
        .catch((fehler: unknown) => {
          // Provider-Fehler (Netz, Auth, Ratelimit) sauber an den Client melden.
          const meldung = fehler instanceof Error ? fehler.message : 'KI-Anfrage fehlgeschlagen';
          console.error('KI-Fehler:', meldung);
          res.status(502).json({ fehler: meldung });
        });
    });
  });

  // ---- KI-Zusatzfunktionen (Phase 3, hinter den Abo-Stufen) -----------------

  /** KI-Sitzungsprep (Plus): erzeugt einen sessionPrep-Entwurf. */
  app.post('/api/kampagnen/:kid/ki/sitzungsprep', (req, res) => {
    if (!kiProvider) return res.status(503).json({ fehler: KI_UNKONFIGURIERT });
    if (!pruefeKi(req, res, 'ki-erweitert')) return;
    mitKampagne(req, res, req.params.kid, (storage) => {
      const eintrag = verwaltungFuer(req).holen(req.params.kid)!;
      const sprache: KiSprache = req.body?.sprache === 'en' ? 'en' : 'de';
      const fokus = typeof req.body?.fokus === 'string' ? req.body.fokus.slice(0, 500) : undefined;
      erzeugeSitzungsprep(kiProvider, eintrag.kampagne, storage, sprache, fokus)
        .then((entwurf) => {
          const nummer = naechsteSessionNummer(storage.alle());
          const name = `Prep – Session ${nummer}`;
          const id = eindeutigerSlug(name, storage.vorhandeneIds());
          const template = neueEntitaet('sessionPrep', id, name);
          const entitaet = validiereEntitaet('sessionPrep', {
            ...template,
            ...entwurf,
            sessionNummer: nummer,
          });
          storage.speichern(entitaet);
          res.status(201).json(entitaet);
        })
        .catch((fehler: unknown) => sendeKiFehler(res, fehler));
    });
  });

  /** Charakterbogen-/Statblock-Import (Plus): Freitext → SC/NSC. */
  app.post('/api/kampagnen/:kid/ki/charakter-import', (req, res) => {
    if (!kiProvider) return res.status(503).json({ fehler: KI_UNKONFIGURIERT });
    if (!pruefeKi(req, res, 'ki-erweitert')) return;
    const typ: 'sc' | 'nsc' = req.body?.typ === 'nsc' ? 'nsc' : 'sc';
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (text.trim().length < 10) {
      return res.status(400).json({ fehler: 'Bitte einen Statblock/Charakterbogen einfügen' });
    }
    mitKampagne(req, res, req.params.kid, (storage) => {
      const sprache: KiSprache = req.body?.sprache === 'en' ? 'en' : 'de';
      importiereCharakter(kiProvider, typ, text.slice(0, 8000), sprache)
        .then((roh) => {
          const name = typeof roh.name === 'string' && roh.name.trim() ? roh.name.trim() : 'Import';
          const id = eindeutigerSlug(name, storage.vorhandeneIds());
          const template = neueEntitaet(typ, id, name);
          const entitaet = validiereEntitaet(typ, { ...template, ...roh, id, typ, name });
          storage.speichern(entitaet);
          res.status(201).json(entitaet);
        })
        .catch((fehler: unknown) => sendeKiFehler(res, fehler));
    });
  });

  /** KI-Kartengenerierung (Premium): Bild-Provider → Karte mit Grafik. */
  app.post('/api/kampagnen/:kid/ki/karte', (req, res) => {
    if (!bildProvider) {
      return res
        .status(503)
        .json({ fehler: 'KI-Kartengenerierung ist nicht konfiguriert (AI_IMAGE_* in .env)' });
    }
    if (!pruefeKi(req, res, 'ki-kartengenerierung')) return;
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) return res.status(400).json({ fehler: 'Bitte eine Bildbeschreibung angeben' });
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : prompt.slice(0, 60);
    mitKampagne(req, res, req.params.kid, (storage) => {
      bildProvider
        .generiere(prompt.slice(0, 1500))
        .then((buffer) => {
          const datei = `ki-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`;
          storage.speichereBild(datei, buffer);
          const id = eindeutigerSlug(name, storage.vorhandeneIds());
          const template = neueEntitaet('karte', id, name);
          const entitaet = validiereEntitaet('karte', {
            ...template,
            bild: datei,
            beschreibung: prompt,
          });
          storage.speichern(entitaet);
          res.status(201).json(entitaet);
        })
        .catch((fehler: unknown) => sendeKiFehler(res, fehler));
    });
  });

  app.put('/api/kampagnen/:kid/lesung', (req, res) => {
    mitKampagne(req, res, req.params.kid, (storage) => {
      try {
        storage.lesung = lesungSchema.parse(req.body);
        storage.speichereSingleton('lesung', storage.lesung);
        return res.json(storage.lesung);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
  });

  app.put('/api/kampagnen/:kid/kalender', (req, res) => {
    mitKampagne(req, res, req.params.kid, (storage) => {
      try {
        storage.kalender = kalenderSchema.parse(req.body);
        storage.speichereSingleton('kalender', storage.kalender);
        return res.json(storage.kalender);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
  });

  return app;
}

/** Fehlermeldung, wenn kein Text-KI-Provider konfiguriert ist. */
const KI_UNKONFIGURIERT = 'KI-Assistent ist nicht konfiguriert (siehe .env.example)';

/** KI-Fehler melden: kaputte KI-Ausgabe → 400 (Zod), Provider-/Netzfehler → 502. */
function sendeKiFehler(res: express.Response, fehler: unknown) {
  if (fehler instanceof ZodError) return sendeValidierungsfehler(res, fehler);
  const meldung = fehler instanceof Error ? fehler.message : 'KI-Anfrage fehlgeschlagen';
  console.error('KI-Fehler:', meldung);
  return res.status(502).json({ fehler: meldung });
}

/** Übersetzt Zod-Fehler in eine lesbare 400-Antwort. */
function sendeValidierungsfehler(res: express.Response, fehler: unknown) {
  if (fehler instanceof ZodError) {
    const details = fehler.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return res.status(400).json({ fehler: `Validierung fehlgeschlagen – ${details}` });
  }
  console.error(fehler);
  return res.status(500).json({ fehler: 'Interner Fehler' });
}
