/**
 * Spezialmodul (DM-only): Lesung / Prophezeiung.
 * Generisches Orakel-Modul mit frei konfigurierbarem Titel und beliebig
 * vielen Karten – in Curse of Strahd die Tarokka-Lesung, in anderen
 * Kampagnen Omen, Visionen oder Prophezeiungen. Pro Karte: Aspekt,
 * gezogene Karte, aufgelöster Ort/NSC und Aufdeckungs-Status.
 */
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LesungKartenStatus, LesungsKarte } from '@grimoire/shared';
import { LESUNG_KARTEN_STATUS } from '@grimoire/shared';
import { pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { DmBadge } from '../komponenten/Badge';

const STATUS_FARBE: Record<LesungKartenStatus, string> = {
  geheim: 'border-rand text-text-schwach',
  'hinweis gegeben': 'border-gold/50 text-gold-hell',
  'von Party entdeckt': 'border-gruen/50 text-gruen',
};

export function LesungSeite() {
  const { lesung, setzeLesung, entitaeten } = useStore();

  const setzeKarte = (index: number, aenderung: Partial<LesungsKarte>) => {
    void setzeLesung({
      ...lesung,
      karten: lesung.karten.map((k, i) => (i === index ? { ...k, ...aenderung } : k)),
    });
  };

  const neueKarte = () => {
    void setzeLesung({
      ...lesung,
      karten: [
        ...lesung.karten,
        { aspekt: '', karte: '', aufgeloestId: null, aufgeloestText: '', status: 'geheim' },
      ],
    });
  };

  const kandidaten = entitaeten
    .filter((e) => e.typ === 'ort' || e.typ === 'nsc')
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2.5 text-2xl">
        <Sparkles size={22} className="text-arkan" aria-hidden />
        <input
          className="min-w-0 border-b border-transparent bg-transparent font-display text-2xl text-text-stark hover:border-rand focus:border-gold focus:outline-none"
          value={lesung.titel}
          placeholder="Titel, z. B. „Tarokka-Lesung“ …"
          onChange={(e) => void setzeLesung({ ...lesung, titel: e.target.value })}
          aria-label="Titel der Lesung"
        />
        <DmBadge />
      </h1>
      <p className="mb-6 text-sm text-text-schwach">
        Prophezeiungen, Omen und Visionen – die Schicksalsfäden dieser Kampagne.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lesung.karten.map((karte, i) => {
          const aufgeloest = karte.aufgeloestId
            ? entitaeten.find((e) => e.id === karte.aufgeloestId)
            : undefined;
          return (
            <div key={i} className="karte karte-ornament border-t-2 border-t-(--arkan) p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <input
                  className="w-full border-b border-transparent bg-transparent text-[11px] uppercase tracking-[0.18em] text-arkan hover:border-rand focus:border-arkan focus:outline-none"
                  value={karte.aspekt}
                  placeholder="Aspekt, z. B. „Verbündeter“"
                  onChange={(e) => setzeKarte(i, { aspekt: e.target.value })}
                  aria-label={`Aspekt von Karte ${i + 1}`}
                />
                <button
                  className="text-text-schwach hover:text-rot"
                  aria-label={`Karte ${i + 1} entfernen`}
                  onClick={() =>
                    void setzeLesung({
                      ...lesung,
                      karten: lesung.karten.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <label className="mb-1 block text-xs text-text-schwach">Gezogene Karte / Omen</label>
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
                aria-label={`Auflösung für Karte ${i + 1}`}
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
                  aria-label={`Freitext-Auflösung für Karte ${i + 1}`}
                />
              )}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
                {LESUNG_KARTEN_STATUS.map((status) => (
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
        <button
          className="karte flex min-h-40 items-center justify-center gap-2 border-dashed text-sm text-text-schwach hover:border-arkan hover:text-arkan"
          onClick={neueKarte}
        >
          <Plus size={15} /> Karte hinzufügen
        </button>
      </div>
    </div>
  );
}
