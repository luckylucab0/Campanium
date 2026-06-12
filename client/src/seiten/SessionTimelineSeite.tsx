/**
 * Chronologische Session-Timeline (ersetzt für Sessions die generische
 * Liste). Jede Session zeigt ihr Protokoll-Resümee; existiert ein Prep mit
 * derselben Session-Nummer, sind beide miteinander verlinkt.
 */
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, Plus } from 'lucide-react';
import type { Session, SessionPrep } from '@ravenloft/shared';
import { IST_SPIELER_MODUS } from '../api';
import { formatDatum, pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { useUi } from '../komponenten/UiContext';

export function SessionTimelineSeite() {
  const { entitaeten } = useStore();
  const { oeffneNeuDialog } = useUi();

  const sessions = entitaeten
    .filter((e): e is Session => e.typ === 'session')
    .sort((a, b) => b.nummer - a.nummer);
  const preps = entitaeten.filter((e): e is SessionPrep => e.typ === 'sessionPrep');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl">
          <BookOpen size={22} className="text-blut-hell" aria-hidden /> Sessions
          <span className="text-base text-text-schwach">({sessions.length})</span>
        </h1>
        {!IST_SPIELER_MODUS && (
          <button
            className="flex items-center gap-1.5 rounded bg-blut px-3 py-1.5 text-sm font-medium text-white hover:bg-blut-hell"
            onClick={() => oeffneNeuDialog('', 'session')}
          >
            <Plus size={15} /> Session anlegen
          </button>
        )}
      </div>

      {sessions.length === 0 && (
        <p className="py-12 text-center text-text-schwach">Noch keine Sessions protokolliert.</p>
      )}

      {/* Timeline mit Mittellinie */}
      <ol className="relative space-y-4 border-l border-rand-stark pl-6">
        {sessions.map((session) => {
          const prep = preps.find((p) => p.sessionNummer === session.nummer);
          return (
            <li key={session.id} className="relative">
              {/* Timeline-Knoten */}
              <span
                className="absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full border border-gold bg-flaeche-0"
                aria-hidden
              />
              <Link
                to={pfadFuer(session)}
                className="karte karte-ornament block p-4 hover:bg-flaeche-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-lg text-text-stark">
                    <span className="text-gold">#{session.nummer}</span> {session.name}
                  </span>
                  <span className="text-xs text-text-schwach">
                    {formatDatum(session.datum)}
                    {session.ingameDatum && ` · ${session.ingameDatum}`}
                  </span>
                </div>
                {session.zusammenfassung && (
                  <p className="mt-1.5 line-clamp-3 font-serif text-base text-text-normal">
                    {session.zusammenfassung.replace(/[#*[\]]/g, '').slice(0, 280)}
                  </p>
                )}
              </Link>
              {prep && !IST_SPIELER_MODUS && (
                <Link
                  to={pfadFuer(prep)}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-text-schwach hover:text-gold"
                >
                  <ClipboardList size={12} aria-hidden /> Zum Prep dieser Session
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
