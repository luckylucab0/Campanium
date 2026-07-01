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
  kampagnenstandSchema,
  lesungSchema,
  neueEntitaet,
  validiereEntitaet,
  widersacherTrackerSchema,
} from '@campanium/shared';
import { istEntityTyp, KampagnenVerwaltung, type Storage } from './storage';

export function erstelleApp(verwaltung: KampagnenVerwaltung): express.Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  /** Löst :kid auf; antwortet selbst mit 404, wenn die Kampagne fehlt. */
  const mitKampagne = (
    res: express.Response,
    kid: string | undefined,
    handler: (storage: Storage) => void,
  ) => {
    const eintrag = kid ? verwaltung.holen(kid) : undefined;
    if (!eintrag) return res.status(404).json({ fehler: `Kampagne nicht gefunden: ${kid}` });
    handler(eintrag.storage);
  };

  // ---- Kampagnen -----------------------------------------------------------

  app.get('/api/kampagnen', (_req, res) => {
    res.json(verwaltung.liste());
  });

  app.post('/api/kampagnen', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ fehler: 'Name darf nicht leer sein' });
    const beschreibung =
      typeof req.body?.beschreibung === 'string' ? req.body.beschreibung.trim() : '';
    return res.status(201).json(verwaltung.anlegen(name, beschreibung));
  });

  app.put('/api/kampagnen/:kid', (req, res) => {
    const { kid } = req.params;
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
    mitKampagne(res, req.params.kid, (storage) => {
      res.json({
        entitaeten: storage.alle(),
        kampagnenstand: storage.kampagnenstand,
        widersacher: storage.widersacher,
        lesung: storage.lesung,
      });
    });
  });

  // ---- Entitäten-CRUD --------------------------------------------------------

  app.post('/api/kampagnen/:kid/entitaeten/:typ', (req, res) => {
    const { typ } = req.params;
    if (!istEntityTyp(typ)) return res.status(404).json({ fehler: `Unbekannter Typ: ${typ}` });
    mitKampagne(res, req.params.kid, (storage) => {
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
    mitKampagne(res, req.params.kid, (storage) => {
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
    mitKampagne(res, req.params.kid, (storage) => {
      const vorhanden = storage.holen(id);
      if (!vorhanden || vorhanden.typ !== typ) {
        return res.status(404).json({ fehler: `Nicht gefunden: ${typ}/${id}` });
      }
      storage.loeschen(id);
      return res.status(204).end();
    });
  });

  // ---- Singletons -------------------------------------------------------------

  app.put('/api/kampagnen/:kid/kampagnenstand', (req, res) => {
    mitKampagne(res, req.params.kid, (storage) => {
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
    mitKampagne(res, req.params.kid, (storage) => {
      try {
        storage.widersacher = widersacherTrackerSchema.parse(req.body);
        storage.speichereSingleton('widersacher', storage.widersacher);
        return res.json(storage.widersacher);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
  });

  app.put('/api/kampagnen/:kid/lesung', (req, res) => {
    mitKampagne(res, req.params.kid, (storage) => {
      try {
        storage.lesung = lesungSchema.parse(req.body);
        storage.speichereSingleton('lesung', storage.lesung);
        return res.json(storage.lesung);
      } catch (fehler) {
        return sendeValidierungsfehler(res, fehler);
      }
    });
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
