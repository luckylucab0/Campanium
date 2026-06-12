/**
 * Express-App mit der REST-API des DM-Modus.
 * Getrennt von index.ts, damit die API in Tests ohne echten Port
 * (über supertest-ähnliche Aufrufe bzw. http.Server) geprüft werden kann.
 *
 * Alle Schreiboperationen validieren gegen die Zod-Schemas aus shared/ –
 * kaputte Daten werden mit 400 abgewiesen und erreichen nie die Platte.
 */
import express from 'express';
import { ZodError } from 'zod';
import {
  eindeutigerSlug,
  kampagnenstandSchema,
  neueEntitaet,
  strahdTrackerSchema,
  tarokkaLesungSchema,
  validiereEntitaet,
} from '@ravenloft/shared';
import { istEntityTyp, Storage } from './storage';

export function erstelleApp(storage: Storage): express.Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // ---- Lesen -------------------------------------------------------------

  /** Kompletter Datenbestand in einem Rutsch – der Client lädt alles beim Start. */
  app.get('/api/alles', (_req, res) => {
    res.json({
      entitaeten: storage.alle(),
      kampagnenstand: storage.kampagnenstand,
      strahdTracker: storage.strahdTracker,
      tarokka: storage.tarokka,
    });
  });

  // ---- Entitäten-CRUD ----------------------------------------------------

  app.post('/api/entitaeten/:typ', (req, res) => {
    const { typ } = req.params;
    if (!istEntityTyp(typ)) return res.status(404).json({ fehler: `Unbekannter Typ: ${typ}` });

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

  app.put('/api/entitaeten/:typ/:id', (req, res) => {
    const { typ, id } = req.params;
    if (!istEntityTyp(typ)) return res.status(404).json({ fehler: `Unbekannter Typ: ${typ}` });
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

  app.delete('/api/entitaeten/:typ/:id', (req, res) => {
    const { typ, id } = req.params;
    const vorhanden = storage.holen(id);
    if (!vorhanden || vorhanden.typ !== typ) {
      return res.status(404).json({ fehler: `Nicht gefunden: ${typ}/${id}` });
    }
    storage.loeschen(id);
    return res.status(204).end();
  });

  // ---- Singletons ----------------------------------------------------------

  app.put('/api/kampagnenstand', (req, res) => {
    try {
      storage.kampagnenstand = kampagnenstandSchema.parse(req.body);
      storage.speichereSingleton('kampagnenstand', storage.kampagnenstand);
      return res.json(storage.kampagnenstand);
    } catch (fehler) {
      return sendeValidierungsfehler(res, fehler);
    }
  });

  app.put('/api/strahd-tracker', (req, res) => {
    try {
      storage.strahdTracker = strahdTrackerSchema.parse(req.body);
      storage.speichereSingleton('strahdTracker', storage.strahdTracker);
      return res.json(storage.strahdTracker);
    } catch (fehler) {
      return sendeValidierungsfehler(res, fehler);
    }
  });

  app.put('/api/tarokka', (req, res) => {
    try {
      storage.tarokka = tarokkaLesungSchema.parse(req.body);
      storage.speichereSingleton('tarokka', storage.tarokka);
      return res.json(storage.tarokka);
    } catch (fehler) {
      return sendeValidierungsfehler(res, fehler);
    }
  });

  return app;
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
