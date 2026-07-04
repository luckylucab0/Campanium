// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Globale Suchpalette (Cmd/Ctrl+K): Fuzzy-Suche über Name, Tags und
 * Volltext aller Entitäten, Ergebnisse nach Typ gruppiert,
 * vollständig per Tastatur bedienbar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { Entitaet, EntityTyp } from '@campanium/shared';
import { entityConfigs, fuzzyScore } from '@campanium/shared';
import { pfadFuer } from '../hilfen';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { entityIcon } from './icons';

/**
 * Suchtext einer Entität: Name zählt am stärksten, dann Tags, dann Volltext.
 * Die Gewichtung passiert über getrennte Scores statt String-Konkatenation,
 * damit ein Name-Treffer immer vor einem Volltext-Treffer landet.
 */
function score(suche: string, e: Entitaet): number {
  const nameScore = fuzzyScore(suche, e.name);
  if (nameScore > 0) return nameScore + 1000;
  const tagScore = Math.max(0, ...e.tags.map((t) => fuzzyScore(suche, t)));
  if (tagScore > 0) return tagScore + 500;
  const volltext = Object.values(e)
    .filter((w): w is string => typeof w === 'string')
    .join(' ');
  // Beim Volltext nur exakte Teilstrings werten – Subsequenzen über lange
  // Texte ergeben zu viel Rauschen.
  return volltext.toLowerCase().includes(suche.toLowerCase()) ? 10 : 0;
}

export function SearchPalette({ schliessen }: { schliessen: () => void }) {
  const { entitaeten } = useStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState(0);
  const eingabe = useRef<HTMLInputElement>(null);

  useEffect(() => eingabe.current?.focus(), []);

  const treffer = useMemo(() => {
    if (!suche.trim()) return [];
    return entitaeten
      .map((e) => ({ e, s: score(suche, e) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((x) => x.e);
  }, [suche, entitaeten]);

  /** Für die Anzeige nach Typ gruppieren, Reihenfolge nach bestem Treffer. */
  const gruppen = useMemo(() => {
    const map = new Map<EntityTyp, Entitaet[]>();
    for (const e of treffer) {
      map.set(e.typ, [...(map.get(e.typ) ?? []), e]);
    }
    return [...map.entries()];
  }, [treffer]);

  /** Flache Liste in Anzeige-Reihenfolge für die Tastaturnavigation. */
  const flach = useMemo(() => gruppen.flatMap(([, liste]) => liste), [gruppen]);

  const oeffnen = (e: Entitaet) => {
    schliessen();
    navigate(pfadFuer(e));
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 pt-[15vh]"
      onClick={schliessen}
      role="dialog"
      aria-modal="true"
      aria-label={t('Globale Suche')}
    >
      <div
        className="karte karte-ornament w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-rand px-4 py-3">
          <Search size={16} className="text-text-schwach" aria-hidden />
          <input
            ref={eingabe}
            className="flex-1 bg-transparent text-text-stark outline-none placeholder:text-text-schwach/60"
            placeholder={t('Suchen … (Name, Tags, Volltext)')}
            value={suche}
            onChange={(e) => {
              setSuche(e.target.value);
              setAuswahl(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') schliessen();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAuswahl((a) => Math.min(a + 1, flach.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAuswahl((a) => Math.max(a - 1, 0));
              }
              if (e.key === 'Enter') {
                const ziel = flach[auswahl];
                if (ziel) oeffnen(ziel);
              }
            }}
            aria-label={t('Suchbegriff')}
          />
          <kbd className="rounded border border-rand px-1.5 text-[10px] text-text-schwach">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {suche.trim() && flach.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-schwach">
              {t('Nichts gefunden – die Nebel geben es nicht her.')}
            </p>
          )}
          {gruppen.map(([typ, liste]) => {
            const config = entityConfigs[typ];
            const Icon = entityIcon(config.icon);
            return (
              <div key={typ}>
                <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-text-schwach">
                  {t(config.labelPlural)}
                </div>
                {liste.map((e) => {
                  const index = flach.indexOf(e);
                  return (
                    <button
                      key={e.id}
                      className={`flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-sm ${
                        index === auswahl
                          ? 'bg-flaeche-3 text-gold-hell'
                          : 'text-text-normal hover:bg-flaeche-3'
                      }`}
                      onClick={() => oeffnen(e)}
                      onMouseMove={() => setAuswahl(index)}
                    >
                      <Icon size={14} className="shrink-0 text-text-schwach" aria-hidden />
                      <span className="truncate">{e.name}</span>
                      {e.dmOnly && <span className="ml-auto text-[10px] text-blut-hell">DM</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
