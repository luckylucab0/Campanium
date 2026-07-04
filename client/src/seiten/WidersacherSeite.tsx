// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Spezialmodul (DM-only): Widersacher-Begegnungs-Tracker.
 * Protokolliert jeden Auftritt des großen Gegenspielers der Kampagne
 * (Name frei konfigurierbar) plus abhakbarer Ideen-Vorrat.
 */
import { Castle, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Session, WidersacherBegegnung, WidersacherModus } from '@campanium/shared';
import { WIDERSACHER_MODI } from '@campanium/shared';
import { pfadFuer } from '../hilfen';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Checkliste } from '../komponenten/Checkliste';
import { DmBadge } from '../komponenten/Badge';
import { Trennlinie } from '../komponenten/Ornament';

const MODUS_FARBE: Record<WidersacherModus, string> = {
  Charme: 'text-arkan',
  Drohung: 'text-gold-hell',
  Gewalt: 'text-rot',
};

export function WidersacherSeite() {
  const { widersacher, setzeWidersacher, entitaeten } = useStore();
  const { t } = useI18n();
  const sessions = entitaeten.filter((e): e is Session => e.typ === 'session');

  const setzeBegegnung = (index: number, aenderung: Partial<WidersacherBegegnung>) => {
    void setzeWidersacher({
      ...widersacher,
      begegnungen: widersacher.begegnungen.map((b, i) =>
        i === index ? { ...b, ...aenderung } : b,
      ),
    });
  };

  const neueBegegnung = () => {
    void setzeWidersacher({
      ...widersacher,
      begegnungen: [
        ...widersacher.begegnungen,
        {
          nr: widersacher.begegnungen.length + 1,
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

  const zelle =
    'rounded border border-transparent bg-transparent px-1.5 py-1 text-sm w-full hover:border-rand focus:border-gold';

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2.5 text-2xl">
        <Castle size={22} className="text-blut-hell" aria-hidden />
        <input
          className="min-w-0 flex-1 border-b border-transparent bg-transparent font-display text-2xl text-text-stark hover:border-rand focus:border-gold focus:outline-none"
          value={widersacher.name}
          placeholder={t('Name des Widersachers …')}
          onChange={(e) => void setzeWidersacher({ ...widersacher, name: e.target.value })}
          aria-label={t('Name des Widersachers')}
        />
        <DmBadge />
      </h1>
      <p className="mb-6 text-sm text-text-schwach">
        {t('Jeder Auftritt des großen Gegenspielers – damit er berechenbar unberechenbar bleibt.')}
      </p>

      <div className="karte overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-rand text-left">
              {[
                'Nr.',
                'Session',
                'Ort',
                'Modus',
                'Was er/sie wollte',
                'Was er/sie bekam',
                'Folgen',
                '',
              ].map((titel, i) => (
                <th
                  key={i}
                  className="px-2 py-2 text-[11px] uppercase tracking-wider text-text-schwach"
                >
                  {titel ? t(titel) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widersacher.begegnungen.map((b, i) => {
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
                      aria-label={t('Session für Begegnung {nr}', { nr: b.nr })}
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
                    <input
                      className={zelle}
                      value={b.ort}
                      onChange={(e) => setzeBegegnung(i, { ort: e.target.value })}
                      aria-label={t('Ort')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className={`rounded border border-transparent bg-transparent px-1 py-1 text-sm hover:border-rand ${MODUS_FARBE[b.modus]}`}
                      value={b.modus}
                      onChange={(e) =>
                        setzeBegegnung(i, { modus: e.target.value as WidersacherModus })
                      }
                      aria-label={t('Modus')}
                    >
                      {WIDERSACHER_MODI.map((m) => (
                        <option key={m} value={m}>
                          {t(m)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={zelle}
                      value={b.wollte}
                      onChange={(e) => setzeBegegnung(i, { wollte: e.target.value })}
                      aria-label={t('Was er/sie wollte')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={zelle}
                      value={b.bekam}
                      onChange={(e) => setzeBegegnung(i, { bekam: e.target.value })}
                      aria-label={t('Was er/sie bekam')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={zelle}
                      value={b.folgen}
                      onChange={(e) => setzeBegegnung(i, { folgen: e.target.value })}
                      aria-label={t('Folgen')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      className="text-text-schwach hover:text-rot"
                      aria-label={t('Begegnung {nr} löschen', { nr: b.nr })}
                      onClick={() =>
                        void setzeWidersacher({
                          ...widersacher,
                          begegnungen: widersacher.begegnungen
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
        {widersacher.begegnungen.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-schwach">
            {t('Noch keine Begegnung – {name} lässt auf sich warten.', {
              name: widersacher.name || t('der Widersacher'),
            })}
          </p>
        )}
      </div>
      <button
        className="mt-3 flex items-center gap-1.5 rounded border border-rand px-3 py-1.5 text-sm hover:border-gold hover:text-gold"
        onClick={neueBegegnung}
      >
        <Plus size={14} /> {t('Begegnung eintragen')}
      </button>

      <Trennlinie className="my-8" />

      <h2 className="mb-3 text-lg">{t('Ideen-Vorrat')}</h2>
      <p className="mb-3 text-sm text-text-schwach">
        {t('Szenen-Ideen für künftige Auftritte – abhaken, was verbraucht ist.')}
      </p>
      <div className="karte karte-ornament max-w-2xl p-4">
        <Checkliste
          eintraege={widersacher.ideen}
          onChange={(ideen) => void setzeWidersacher({ ...widersacher, ideen })}
          bearbeitbar
        />
      </div>
    </div>
  );
}
