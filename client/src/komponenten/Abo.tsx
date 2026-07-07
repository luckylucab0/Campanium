// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Abo-Anzeige (nur SaaS-Modus): Modal mit den vier Stufen (aktive
 * hervorgehoben) und ein Inline-Hinweis für gesperrte Funktionen. Es gibt
 * bewusst KEINEN Live-Bezahlvorgang – Stufen weist der Betreiber/Admin zu
 * (Stripe-fertig strukturiert, aber nicht angebunden).
 */
import { useState } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';
import { FEATURE_STUFE, PLAENE, PLAN_LISTE, type KiFeature } from '@campanium/shared';
import { useI18n } from '../i18n';
import { usePlan } from '../plan';

/** Preis lesbar formatieren („Kostenlos“ bzw. „5 €“ / „14,99 €“). */
function preisText(preis: number, locale: string, t: (s: string) => string): string {
  if (preis === 0) return t('Kostenlos');
  const zahl = preis.toLocaleString(locale, {
    minimumFractionDigits: Number.isInteger(preis) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${zahl} €`;
}

export function AboModal({ schliessen }: { schliessen: () => void }) {
  const { t, locale } = useI18n();
  const { planInfo } = usePlan();

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-[8vh]"
      onClick={schliessen}
      role="dialog"
      aria-modal="true"
      aria-label={t('Abo-Stufen')}
    >
      <div
        className="karte karte-ornament w-full max-w-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-gold" aria-hidden />
          <h2 className="text-lg">{t('Abo-Stufen')}</h2>
          <button
            className="ml-auto text-text-schwach hover:text-text-stark"
            onClick={schliessen}
            aria-label={t('Schließen')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PLAN_LISTE.map((stufe) => {
            const aktiv = stufe.stufe === planInfo.stufe;
            return (
              <div
                key={stufe.stufe}
                className={`rounded border p-3 ${
                  aktiv ? 'border-gold bg-gold-flaeche' : 'border-rand'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-base text-text-stark">{t(stufe.name)}</span>
                  <span className="font-mono text-sm text-gold">
                    {preisText(stufe.preis, locale, t)}
                    {stufe.preis > 0 && (
                      <span className="text-[10px] text-text-schwach"> / {t('Monat')}</span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-schwach">{t(stufe.beschreibung)}</p>
                {aktiv && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] uppercase tracking-wider text-gold">
                    <Check size={12} /> {t('Dein aktueller Plan')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-text-schwach">
          {t(
            'Stufen werden derzeit vom Betreiber zugewiesen – es findet kein automatischer Bezahlvorgang statt.',
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Inline-Sperrhinweis für ein Feature, das der aktuelle Plan nicht abdeckt.
 * Öffnet auf Klick die Abo-Übersicht. Nur sinnvoll im SaaS-Modus.
 */
export function AboHinweis({ feature, titel }: { feature: KiFeature; titel?: string }) {
  const { t, locale } = useI18n();
  const [offen, setOffen] = useState(false);
  const info = PLAENE[FEATURE_STUFE[feature]];

  return (
    <div className="karte flex flex-col items-start gap-2 border-gold/40 p-4">
      <div className="flex items-center gap-2 text-sm text-text-stark">
        <Lock size={15} className="text-gold" aria-hidden />
        {titel ?? t('Diese Funktion gehört zu einem höheren Plan.')}
      </div>
      <p className="text-xs text-text-schwach">
        {t('Verfügbar ab {plan} ({preis} / Monat).', {
          plan: t(info.name),
          preis: preisText(info.preis, locale, t),
        })}
      </p>
      <button
        className="rounded border border-gold px-3 py-1.5 text-sm text-gold hover:bg-gold-flaeche"
        onClick={() => setOffen(true)}
      >
        {t('Pläne ansehen')}
      </button>
      {offen && <AboModal schliessen={() => setOffen(false)} />}
    </div>
  );
}
