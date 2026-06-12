/**
 * Spezialmodul (DM-only): Tarokka-Lesung.
 * Die fünf Karten der Lesung als „Kartenfächer“: gezogene Karte, aufgelöster
 * Ort/NSC (Verknüpfung oder Freitext) und Aufdeckungs-Status.
 */
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TarokkaKarte, TarokkaKartenStatus } from '@ravenloft/shared';
import { TAROKKA_KARTEN_STATUS } from '@ravenloft/shared';
import { pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { DmBadge } from '../komponenten/Badge';

const STATUS_FARBE: Record<TarokkaKartenStatus, string> = {
  geheim: 'border-rand text-text-schwach',
  'hinweis gegeben': 'border-gold/50 text-gold-hell',
  'von Party entdeckt': 'border-gruen/50 text-gruen',
};

export function TarokkaSeite() {
  const { tarokka, setzeTarokka, entitaeten } = useStore();

  const setzeKarte = (index: number, aenderung: Partial<TarokkaKarte>) => {
    void setzeTarokka({
      karten: tarokka.karten.map((k, i) => (i === index ? { ...k, ...aenderung } : k)),
    });
  };

  const kandidaten = entitaeten
    .filter((e) => e.typ === 'ort' || e.typ === 'nsc')
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2.5 text-2xl">
        <Sparkles size={22} className="text-arkan" aria-hidden /> Tarokka-Lesung <DmBadge />
      </h1>
      <p className="mb-6 text-sm text-text-schwach">
        Madam Evas Karten – die Schicksalsfäden dieser Kampagne.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tarokka.karten.map((karte, i) => {
          const aufgeloest = karte.aufgeloestId
            ? entitaeten.find((e) => e.id === karte.aufgeloestId)
            : undefined;
          return (
            <div
              key={i}
              className="karte karte-ornament border-t-2 border-t-(--arkan) p-4"
            >
              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-arkan">
                {karte.aspekt}
              </p>
              <label className="mb-1 block text-xs text-text-schwach">Gezogene Karte</label>
              <input
                className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 font-display text-text-stark"
                value={karte.karte}
                placeholder="z. B. „Drei der Gläser“"
                onChange={(e) => setzeKarte(i, { karte: e.target.value })}
              />
              <label className="mb-1 block text-xs text-text-schwach">
                Aufgelöst als (Ort/NSC)
              </label>
              <select
                className="mb-2 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm"
                value={karte.aufgeloestId ?? ''}
                onChange={(e) => setzeKarte(i, { aufgeloestId: e.target.value || null })}
                aria-label={`Auflösung für ${karte.aspekt}`}
              >
                <option value="">– Freitext / offen –</option>
                {kandidaten.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              {aufgeloest ? (
                <Link to={pfadFuer(aufgeloest)} className="wikilink mb-3 inline-block text-sm">
                  → {aufgeloest.name}
                </Link>
              ) : (
                <input
                  className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm"
                  value={karte.aufgeloestText}
                  placeholder="Freitext-Auflösung"
                  onChange={(e) => setzeKarte(i, { aufgeloestText: e.target.value })}
                  aria-label={`Freitext-Auflösung für ${karte.aspekt}`}
                />
              )}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
                {TAROKKA_KARTEN_STATUS.map((status) => (
                  <button
                    key={status}
                    className={`rounded-sm border px-2 py-0.5 text-[11px] uppercase tracking-wide transition-colors ${
                      karte.status === status
                        ? STATUS_FARBE[status] + ' bg-flaeche-3'
                        : 'border-transparent text-text-schwach/60 hover:text-text-normal'
                    }`}
                    onClick={() => setzeKarte(i, { status })}
                    aria-pressed={karte.status === status}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
