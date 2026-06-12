/**
 * Spezialmodul (DM-only): Strahd-Begegnungs-Tracker.
 * Tabelle aller bisherigen Strahd-Auftritte plus abhakbarer Ideen-Vorrat.
 */
import { Castle, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Session, StrahdBegegnung, StrahdModus } from '@ravenloft/shared';
import { STRAHD_MODI } from '@ravenloft/shared';
import { pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { Checkliste } from '../komponenten/Checkliste';
import { DmBadge } from '../komponenten/Badge';
import { Trennlinie } from '../komponenten/Ornament';

const MODUS_FARBE: Record<StrahdModus, string> = {
  Charme: 'text-arkan',
  Drohung: 'text-gold-hell',
  Gewalt: 'text-rot',
};

export function StrahdSeite() {
  const { strahdTracker, setzeStrahdTracker, entitaeten } = useStore();
  const sessions = entitaeten.filter((e): e is Session => e.typ === 'session');

  const setzeBegegnung = (index: number, aenderung: Partial<StrahdBegegnung>) => {
    void setzeStrahdTracker({
      ...strahdTracker,
      begegnungen: strahdTracker.begegnungen.map((b, i) =>
        i === index ? { ...b, ...aenderung } : b,
      ),
    });
  };

  const neueBegegnung = () => {
    void setzeStrahdTracker({
      ...strahdTracker,
      begegnungen: [
        ...strahdTracker.begegnungen,
        {
          nr: strahdTracker.begegnungen.length + 1,
          sessionNr: null,
          ort: '',
          modus: 'Charme',
          wollte: '',
          bekam: '',
          folgen: '',
        },
      ],
    });
  };

  const zelle = 'rounded border border-transparent bg-transparent px-1.5 py-1 text-sm w-full hover:border-rand focus:border-gold';

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2.5 text-2xl">
        <Castle size={22} className="text-blut-hell" aria-hidden /> Strahd-Begegnungen <DmBadge />
      </h1>
      <p className="mb-6 text-sm text-text-schwach">
        Jeder Auftritt des Grafen – damit er berechenbar unberechenbar bleibt.
      </p>

      <div className="karte overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-rand text-left">
              {['Nr.', 'Session', 'Ort', 'Modus', 'Was er wollte', 'Was er bekam', 'Folgen', ''].map(
                (titel, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-[11px] uppercase tracking-wider text-text-schwach"
                  >
                    {titel}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {strahdTracker.begegnungen.map((b, i) => {
              const session = sessions.find((s) => s.nummer === b.sessionNr);
              return (
                <tr key={i} className="border-b border-rand/50 align-top">
                  <td className="px-2 py-1.5 font-display text-gold">{b.nr}</td>
                  <td className="px-2 py-1.5">
                    <select
                      className="rounded border border-transparent bg-transparent px-1 py-1 text-sm hover:border-rand"
                      value={b.sessionNr ?? ''}
                      onChange={(e) =>
                        setzeBegegnung(i, {
                          sessionNr: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      aria-label={`Session für Begegnung ${b.nr}`}
                    >
                      <option value="">–</option>
                      {sessions
                        .sort((a, z) => a.nummer - z.nummer)
                        .map((s) => (
                          <option key={s.id} value={s.nummer}>
                            #{s.nummer}
                          </option>
                        ))}
                    </select>
                    {session && (
                      <Link to={pfadFuer(session)} className="block text-[11px] text-gold-hell">
                        {session.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input className={zelle} value={b.ort} onChange={(e) => setzeBegegnung(i, { ort: e.target.value })} aria-label="Ort" />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className={`rounded border border-transparent bg-transparent px-1 py-1 text-sm hover:border-rand ${MODUS_FARBE[b.modus]}`}
                      value={b.modus}
                      onChange={(e) => setzeBegegnung(i, { modus: e.target.value as StrahdModus })}
                      aria-label="Modus"
                    >
                      {STRAHD_MODI.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input className={zelle} value={b.wollte} onChange={(e) => setzeBegegnung(i, { wollte: e.target.value })} aria-label="Was er wollte" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className={zelle} value={b.bekam} onChange={(e) => setzeBegegnung(i, { bekam: e.target.value })} aria-label="Was er bekam" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className={zelle} value={b.folgen} onChange={(e) => setzeBegegnung(i, { folgen: e.target.value })} aria-label="Folgen" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      className="text-text-schwach hover:text-rot"
                      aria-label={`Begegnung ${b.nr} löschen`}
                      onClick={() =>
                        void setzeStrahdTracker({
                          ...strahdTracker,
                          begegnungen: strahdTracker.begegnungen
                            .filter((_, j) => j !== i)
                            .map((rest, j) => ({ ...rest, nr: j + 1 })),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {strahdTracker.begegnungen.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-schwach">
            Noch keine Begegnung – der Graf lässt auf sich warten.
          </p>
        )}
      </div>
      <button
        className="mt-3 flex items-center gap-1.5 rounded border border-rand px-3 py-1.5 text-sm hover:border-gold hover:text-gold"
        onClick={neueBegegnung}
      >
        <Plus size={14} /> Begegnung eintragen
      </button>

      <Trennlinie className="my-8" />

      <h2 className="mb-3 text-lg">Ideen-Vorrat</h2>
      <p className="mb-3 text-sm text-text-schwach">
        Szenen-Ideen für künftige Auftritte – abhaken, was verbraucht ist.
      </p>
      <div className="karte karte-ornament max-w-2xl p-4">
        <Checkliste
          eintraege={strahdTracker.ideen}
          onChange={(ideen) => void setzeStrahdTracker({ ...strahdTracker, ideen })}
          bearbeitbar
        />
      </div>
    </div>
  );
}
