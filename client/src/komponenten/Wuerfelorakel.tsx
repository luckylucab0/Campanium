// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Würfelorakel: ein rein clientseitiges Würfel-Tool (kein Backend). Öffnet
 * sich als Modal über den „Würfel werfen"-Knopf in der Sidebar. Unterstützt
 * d4–d100, mehrere Würfel, zeigt Einzelergebnisse + Summe, einen kurzen
 * Verlauf und hebt beim einzelnen d20 Kritischen Erfolg (20) bzw. Patzer (1)
 * hervor. Die Taumel-Animation respektiert prefers-reduced-motion (global).
 */
import { useState } from 'react';
import { Dices, X } from 'lucide-react';
import { useI18n } from '../i18n';

const WUERFEL = [4, 6, 8, 10, 12, 20, 100] as const;
type Seiten = (typeof WUERFEL)[number];

interface Wurf {
  seiten: Seiten;
  einzel: number[];
  summe: number;
  /** Bei einzelnem d20: 'krit' (20) oder 'patzer' (1), sonst null. */
  besonders: 'krit' | 'patzer' | null;
}

/** Ein Wurf mit `anzahl` Würfeln zu je `seiten` Seiten (1..seiten). */
function wuerfle(seiten: Seiten, anzahl: number): Wurf {
  const einzel = Array.from({ length: anzahl }, () => 1 + Math.floor(Math.random() * seiten));
  const summe = einzel.reduce((a, b) => a + b, 0);
  let besonders: Wurf['besonders'] = null;
  if (seiten === 20 && anzahl === 1) {
    if (einzel[0] === 20) besonders = 'krit';
    else if (einzel[0] === 1) besonders = 'patzer';
  }
  return { seiten, einzel, summe, besonders };
}

export function Wuerfelorakel({ schliessen }: { schliessen: () => void }) {
  const { t } = useI18n();
  const [seiten, setSeiten] = useState<Seiten>(20);
  const [anzahl, setAnzahl] = useState(1);
  const [aktuell, setAktuell] = useState<Wurf | null>(null);
  const [verlauf, setVerlauf] = useState<Wurf[]>([]);
  /** Zähler nur, um die Taumel-Animation bei jedem Wurf neu auszulösen. */
  const [wurfNr, setWurfNr] = useState(0);

  const werfen = () => {
    const w = wuerfle(seiten, anzahl);
    setAktuell(w);
    setVerlauf((alt) => [w, ...alt].slice(0, 8));
    setWurfNr((n) => n + 1);
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 pt-[12vh]"
      onClick={schliessen}
      role="dialog"
      aria-modal="true"
      aria-label={t('Würfelorakel')}
      onKeyDown={(e) => e.key === 'Escape' && schliessen()}
    >
      <div
        className="karte karte-ornament w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-rand px-4 py-3">
          <Dices size={18} className="text-gold" aria-hidden />
          <span className="font-display text-base text-text-stark">{t('Würfelorakel')}</span>
          <button
            className="ml-auto text-text-schwach hover:text-text-stark"
            onClick={schliessen}
            aria-label={t('Schließen')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Würfel-Wahl */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Würfeltyp')}>
            {WUERFEL.map((w) => (
              <button
                key={w}
                className={`rounded border px-2.5 py-1 font-mono text-sm transition-colors ${
                  seiten === w
                    ? 'border-blut bg-blut-flaeche text-blut-hell'
                    : 'border-rand text-text-schwach hover:border-gold hover:text-gold'
                }`}
                onClick={() => setSeiten(w)}
                aria-pressed={seiten === w}
              >
                d{w}
              </button>
            ))}
          </div>

          {/* Anzahl + Würfeln */}
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-text-schwach">{t('Anzahl')}</span>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-rand px-2 text-text-schwach hover:border-gold hover:text-gold disabled:opacity-30"
                onClick={() => setAnzahl((a) => Math.max(1, a - 1))}
                disabled={anzahl <= 1}
                aria-label={t('verringern')}
              >
                −
              </button>
              <span className="w-6 text-center font-mono text-text-stark">{anzahl}</span>
              <button
                className="rounded border border-rand px-2 text-text-schwach hover:border-gold hover:text-gold disabled:opacity-30"
                onClick={() => setAnzahl((a) => Math.min(12, a + 1))}
                disabled={anzahl >= 12}
                aria-label={t('erhöhen')}
              >
                +
              </button>
            </div>
            <button
              className="ml-auto flex items-center gap-2 rounded bg-blut px-4 py-2 text-sm font-medium text-white hover:bg-blut-hell"
              onClick={werfen}
            >
              <Dices size={15} /> {anzahl}d{seiten} {t('würfeln')}
            </button>
          </div>

          {/* Ergebnis */}
          {aktuell && (
            <div
              key={wurfNr}
              className={`wuerfelt rounded border p-4 text-center ${
                aktuell.besonders === 'krit'
                  ? 'border-gold/50 bg-gold-flaeche'
                  : aktuell.besonders === 'patzer'
                    ? 'border-rot/50 bg-rot-flaeche'
                    : 'border-rand bg-flaeche-3'
              }`}
            >
              <div
                className={`font-display text-4xl ${
                  aktuell.besonders === 'krit'
                    ? 'text-gold-hell'
                    : aktuell.besonders === 'patzer'
                      ? 'text-rot-hell'
                      : 'text-text-stark'
                }`}
              >
                {aktuell.summe}
              </div>
              {aktuell.einzel.length > 1 && (
                <div className="mt-1 font-mono text-xs text-text-schwach">
                  {aktuell.einzel.join(' + ')}
                </div>
              )}
              {aktuell.besonders === 'krit' && (
                <div className="mt-1 text-sm font-medium text-gold-hell">
                  {t('Kritischer Erfolg!')}
                </div>
              )}
              {aktuell.besonders === 'patzer' && (
                <div className="mt-1 text-sm font-medium text-rot-hell">{t('Patzer!')}</div>
              )}
            </div>
          )}

          {/* Verlauf */}
          {verlauf.length > 1 && (
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-text-schwach">
                {t('Verlauf')}
              </div>
              <ul className="space-y-1">
                {verlauf.slice(1).map((w, i) => (
                  <li key={i} className="flex justify-between font-mono text-xs text-text-schwach">
                    <span>
                      {w.einzel.length}d{w.seiten}
                    </span>
                    <span className="text-text-normal">
                      {w.summe}
                      {w.einzel.length > 1 && (
                        <span className="text-text-schwach"> ({w.einzel.join('+')})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
