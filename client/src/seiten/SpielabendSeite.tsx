// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * „Spielabend-Ansicht“ (DM-only): das Prep der nächsten/heutigen Session,
 * daneben Schnellzugriff auf alle darin verlinkten NSCs/Orte sowie die
 * Referenz-Notizen (Tag „referenz“ – z. B. Zufallsbegegnungstabellen).
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Tent } from 'lucide-react';
import type { Notiz, SessionPrep } from '@campanium/shared';
import { entityConfigs, sammleLinkZiele } from '@campanium/shared';
import { pfadFuer } from '../hilfen';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Badge, DmBadge } from '../komponenten/Badge';
import { Markdown } from '../komponenten/Markdown';
import { entityIcon } from '../komponenten/icons';

export function SpielabendSeite() {
  const { entitaeten, perName } = useStore();
  const { t } = useI18n();

  // Das Prep mit der höchsten Session-Nummer gilt als „heutiger Abend“.
  const prep = entitaeten
    .filter((e): e is SessionPrep => e.typ === 'sessionPrep')
    .sort((a, b) => b.sessionNummer - a.sessionNummer)[0];

  // Alle [[Links]] aus dem Prep auflösen → Schnellzugriffsleiste.
  const verknuepfte = useMemo(() => {
    if (!prep) return [];
    const ziele = sammleLinkZiele([
      prep.zieleDm,
      prep.szenenDm,
      prep.benoetigtDm,
      prep.notfallIdeenDm,
    ]);
    return [...ziele]
      .map((name) => perName(name))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
  }, [prep, perName]);

  const referenzen = entitaeten.filter(
    (e): e is Notiz => e.typ === 'notiz' && e.tags.includes('referenz'),
  );

  const prepConfig = entityConfigs.sessionPrep;

  if (!prep) {
    return (
      <div className="py-16 text-center text-text-schwach">
        <Tent size={40} className="mx-auto mb-3 text-rand-stark" />
        <p>{t('Kein Session-Prep vorhanden.')}</p>
        <p className="mt-1 text-sm">
          {t('Lege auf dem Dashboard über „Neue Session vorbereiten“ eines an.')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2.5 text-2xl">
        <Tent size={22} className="text-blut-hell" aria-hidden /> {t('Spielabend')} <DmBadge />
      </h1>
      <p className="mb-6 text-sm text-text-schwach">
        {t('Prep für Session')} #{prep.sessionNummer} ·{' '}
        <Link to={`${pfadFuer(prep)}/bearbeiten`} className="wikilink">
          {t('bearbeiten')}
        </Link>
      </p>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Prep-Inhalt */}
        <div className="space-y-5 xl:col-span-2">
          {prepConfig.abschnitte.map((abschnitt) => {
            const text = String((prep as unknown as Record<string, unknown>)[abschnitt.feld] ?? '');
            if (!text.trim()) return null;
            return (
              <section key={abschnitt.feld} className="karte karte-ornament p-4">
                <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
                  {t(abschnitt.titel)}
                </h2>
                <Markdown text={text} />
              </section>
            );
          })}
        </div>

        {/* Seitenleiste: Schnellzugriff + Referenzen */}
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
              {t('Benötigte NSCs & Orte')}
            </h2>
            {verknuepfte.length === 0 && (
              <p className="text-sm text-text-schwach">{t('Keine [[Verknüpfungen]] im Prep gefunden.')}</p>
            )}
            <div className="space-y-2">
              {verknuepfte.map((e) => {
                const config = entityConfigs[e.typ];
                const Icon = entityIcon(config.icon);
                const werte = e as unknown as Record<string, unknown>;
                const untertitel = config.untertitelFeld
                  ? String(werte[config.untertitelFeld] ?? '')
                  : '';
                return (
                  <Link
                    key={e.id}
                    to={pfadFuer(e)}
                    className="karte karte-ornament block p-2.5 hover:bg-flaeche-3"
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={13} className="text-text-schwach" aria-hidden />
                      <span className="font-display text-sm text-text-stark">{e.name}</span>
                      {typeof werte.status === 'string' && <Badge wert={String(werte.status)} />}
                    </div>
                    {untertitel && (
                      <p className="mt-1 line-clamp-1 text-xs text-text-schwach">{untertitel}</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
              {t('Referenzen am Tisch')}
            </h2>
            {referenzen.length === 0 && (
              <p className="text-sm text-text-schwach">
                {t('Notizen mit dem Tag „referenz“ erscheinen hier (z. B. Zufallsbegegnungen).')}
              </p>
            )}
            <div className="space-y-2">
              {referenzen.map((notiz) => (
                <details key={notiz.id} className="karte p-2.5">
                  <summary className="cursor-pointer font-display text-sm text-text-stark">
                    {notiz.name}
                  </summary>
                  <div className="mt-2">
                    <Markdown text={notiz.inhalt} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
