// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Generische Übersichtsseite pro Entitätstyp: Kartenraster ⇄ Tabelle,
 * Filter aus der Registry (Status, Haltung, Region, Verknüpfungen, …),
 * Suche im Namen und Sortierung. Quests bekommen zusätzlich die
 * Kanban-Ansicht (QuestBoard).
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Columns3, LayoutGrid, Plus, Table2 } from 'lucide-react';
import type { Entitaet, Session } from '@campanium/shared';
import { fuzzyFilter, type EntityConfig, configVonRoute } from '@campanium/shared';
import { bildUrl, IST_SPIELER_MODUS } from '../api';
import { formatDatum, pfadFuer } from '../hilfen';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Badge, DmBadge } from '../komponenten/Badge';
import { entityIcon } from '../komponenten/icons';
import { KiCharakterImportKnopf, KiKarteKnopf } from '../komponenten/KiWerkzeuge';
import { Burg } from '../komponenten/Ornament';
import { useUi } from '../komponenten/UiContext';
import { QuestBoard } from './QuestBoard';

type Ansicht = 'karten' | 'tabelle' | 'board';
type Sortierung = 'name' | 'geaendert' | 'nummer';

export function EntityListeSeite() {
  const { route = '' } = useParams();
  const { t } = useI18n();
  const config = configVonRoute(route);
  if (!config) return <p className="text-text-schwach">{t('Unbekannter Bereich.')}</p>;
  // key erzwingt frischen Filter-State beim Wechsel zwischen Typen.
  return <Liste key={config.typ} config={config} />;
}

function Liste({ config }: { config: EntityConfig }) {
  const { entitaeten, perId } = useStore();
  const { t, locale } = useI18n();
  const { oeffneNeuDialog } = useUi();
  const [ansicht, setAnsicht] = useState<Ansicht>('karten');
  const [suche, setSuche] = useState('');
  const [filterWerte, setFilterWerte] = useState<Record<string, string>>({});
  const [sortierung, setSortierung] = useState<Sortierung>(
    config.typ === 'session' || config.typ === 'sessionPrep' ? 'nummer' : 'name',
  );

  const eintraege = useMemo(() => {
    let liste = entitaeten.filter((e) => e.typ === config.typ);
    for (const [feld, wert] of Object.entries(filterWerte)) {
      if (!wert) continue;
      liste = liste.filter((e) => {
        const aktuell = (e as unknown as Record<string, unknown>)[feld];
        if (typeof aktuell === 'boolean') return String(aktuell) === wert;
        return aktuell === wert;
      });
    }
    if (suche.trim()) {
      liste = fuzzyFilter(suche, liste, (e) => e.name);
    } else {
      liste = [...liste].sort((a, b) => {
        if (sortierung === 'geaendert') return b.geaendert.localeCompare(a.geaendert);
        if (sortierung === 'nummer') {
          const na = a as unknown as { nummer?: number; sessionNummer?: number };
          const nb = b as unknown as { nummer?: number; sessionNummer?: number };
          return (nb.nummer ?? nb.sessionNummer ?? 0) - (na.nummer ?? na.sessionNummer ?? 0);
        }
        return a.name.localeCompare(b.name, locale);
      });
    }
    return liste;
  }, [entitaeten, config.typ, filterWerte, suche, sortierung, locale]);

  const Icon = entityIcon(config.icon);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl">
          <Icon size={22} className="text-blut-hell" aria-hidden /> {t(config.labelPlural)}
          <span className="text-base text-text-schwach">({eintraege.length})</span>
        </h1>
        {!IST_SPIELER_MODUS && (
          <div className="flex flex-wrap items-center gap-2">
            {(config.typ === 'sc' || config.typ === 'nsc') && (
              <KiCharakterImportKnopf typ={config.typ} />
            )}
            {config.typ === 'karte' && <KiKarteKnopf />}
            <button
              className="flex items-center gap-1.5 rounded bg-blut px-3 py-1.5 text-sm font-medium text-white hover:bg-blut-hell"
              onClick={() => oeffneNeuDialog('', config.typ)}
            >
              <Plus size={15} /> {t('{label} anlegen', { label: t(config.label) })}
            </button>
          </div>
        )}
      </div>

      {/* Werkzeugleiste: Suche, Filter, Sortierung, Ansicht */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          className="w-48 rounded border border-rand bg-flaeche-2 px-2.5 py-1.5 text-sm"
          placeholder={t('Filtern …')}
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          aria-label={t('{label} durchsuchen', { label: t(config.labelPlural) })}
        />
        {config.filter.map((filter) => (
          <select
            key={filter.feld}
            className="rounded border border-rand bg-flaeche-2 px-2 py-1.5 text-sm text-text-normal"
            value={filterWerte[filter.feld] ?? ''}
            onChange={(e) => setFilterWerte((f) => ({ ...f, [filter.feld]: e.target.value }))}
            aria-label={t('Nach {label} filtern', { label: t(filter.label) })}
          >
            <option value="">
              {t(filter.label)}: {t('alle')}
            </option>
            {filter.art === 'boolean' && (
              <>
                <option value="true">{t('ja')}</option>
                <option value="false">{t('nein')}</option>
              </>
            )}
            {filter.art === 'select' &&
              (filter.optionen ?? []).map((o) => (
                <option key={o} value={o}>
                  {t(o)}
                </option>
              ))}
            {/* 'werte': Optionen sind die tatsächlich vorkommenden Werte
                des Feldes (z. B. die Regionen dieser Kampagne). */}
            {filter.art === 'werte' &&
              [
                ...new Set(
                  entitaeten
                    .filter((e) => e.typ === config.typ)
                    .map((e) =>
                      String((e as unknown as Record<string, unknown>)[filter.feld] ?? ''),
                    )
                    .filter(Boolean),
                ),
              ]
                .sort((a, b) => a.localeCompare(b, locale))
                .map((wert) => (
                  <option key={wert} value={wert}>
                    {wert}
                  </option>
                ))}
            {filter.art === 'ref' &&
              entitaeten
                .filter((e) => filter.refTypen?.includes(e.typ))
                .sort((a, b) => a.name.localeCompare(b.name, locale))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
          </select>
        ))}
        <select
          className="rounded border border-rand bg-flaeche-2 px-2 py-1.5 text-sm text-text-normal"
          value={sortierung}
          onChange={(e) => setSortierung(e.target.value as Sortierung)}
          aria-label={t('Sortierung')}
        >
          <option value="name">{t('Sortierung: Name')}</option>
          <option value="geaendert">{t('Sortierung: zuletzt geändert')}</option>
          {(config.typ === 'session' || config.typ === 'sessionPrep') && (
            <option value="nummer">{t('Sortierung: Session-Nr.')}</option>
          )}
        </select>
        <div
          className="ml-auto flex rounded border border-rand"
          role="group"
          aria-label={t('Ansicht')}
        >
          <button
            className={`p-1.5 ${ansicht === 'karten' ? 'bg-flaeche-3 text-gold' : 'text-text-schwach'}`}
            onClick={() => setAnsicht('karten')}
            aria-label={t('Kartenansicht')}
            aria-pressed={ansicht === 'karten'}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            className={`p-1.5 ${ansicht === 'tabelle' ? 'bg-flaeche-3 text-gold' : 'text-text-schwach'}`}
            onClick={() => setAnsicht('tabelle')}
            aria-label={t('Tabellenansicht')}
            aria-pressed={ansicht === 'tabelle'}
          >
            <Table2 size={15} />
          </button>
          {config.typ === 'quest' && (
            <button
              className={`p-1.5 ${ansicht === 'board' ? 'bg-flaeche-3 text-gold' : 'text-text-schwach'}`}
              onClick={() => setAnsicht('board')}
              aria-label={t('Kanban-Board')}
              aria-pressed={ansicht === 'board'}
            >
              <Columns3 size={15} />
            </button>
          )}
        </div>
      </div>

      {eintraege.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-text-schwach">
          <Burg size={56} className="text-rand-stark" />
          <p>{t(config.beschreibung)}</p>
          <p className="text-sm">{t('Noch keine Einträge.')}</p>
        </div>
      )}

      {ansicht === 'board' && config.typ === 'quest' ? (
        <QuestBoard />
      ) : ansicht === 'tabelle' ? (
        <Tabelle config={config} eintraege={eintraege} perId={perId} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {eintraege.map((e) => (
            <EntityKarte key={e.id} entitaet={e} config={config} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Eine Karte im Kartenraster. */
export function EntityKarte({ entitaet, config }: { entitaet: Entitaet; config: EntityConfig }) {
  const { kampagne } = useStore();
  const { locale } = useI18n();
  const werte = entitaet as unknown as Record<string, unknown>;
  const untertitel = config.untertitelFeld ? String(werte[config.untertitelFeld] ?? '') : '';
  return (
    <Link
      to={pfadFuer(entitaet)}
      className="karte karte-ornament block p-3.5 transition-colors hover:bg-flaeche-3"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          {entitaet.bild && kampagne && (
            <img
              src={bildUrl(kampagne.id, entitaet.bild)}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border border-rand object-cover"
            />
          )}
          <span className="font-display text-base text-text-stark">{entitaet.name}</span>
        </span>
        {(entitaet.dmOnly || config.immerDm) && <DmBadge />}
      </div>
      {untertitel && <p className="mb-2 line-clamp-2 text-sm text-text-schwach">{untertitel}</p>}
      <div className="flex flex-wrap gap-1.5">
        {config.felder
          .filter((f) => f.art === 'select' && typeof werte[f.feld] === 'string')
          .map((f) => (
            <Badge key={f.feld} wert={String(werte[f.feld])} />
          ))}
        {entitaet.typ === 'session' && (
          <span className="text-xs text-text-schwach">
            #{(entitaet as Session).nummer} · {formatDatum((entitaet as Session).datum, locale)}
          </span>
        )}
      </div>
    </Link>
  );
}

/** Tabellenansicht: Name + Select-/Boolean-/Ref-Spalten aus der Registry. */
function Tabelle({
  config,
  eintraege,
  perId,
}: {
  config: EntityConfig;
  eintraege: Entitaet[];
  perId: (id: string) => Entitaet | undefined;
}) {
  const { t } = useI18n();
  const spalten = config.felder.filter((f) =>
    ['select', 'boolean', 'ref', 'nummer'].includes(f.art),
  );
  return (
    <div className="karte overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rand text-left">
            <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-text-schwach">
              {t('Name')}
            </th>
            {spalten.map((s) => (
              <th
                key={s.feld}
                className="px-3 py-2 text-[11px] uppercase tracking-wider text-text-schwach"
              >
                {t(s.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {eintraege.map((e) => {
            const werte = e as unknown as Record<string, unknown>;
            return (
              <tr key={e.id} className="border-b border-rand/50 hover:bg-flaeche-3">
                <td className="px-3 py-2">
                  <Link to={pfadFuer(e)} className="text-text-stark hover:text-gold">
                    {e.name}
                  </Link>
                  {(e.dmOnly || config.immerDm) && (
                    <span className="ml-2 align-middle">
                      <DmBadge />
                    </span>
                  )}
                </td>
                {spalten.map((s) => {
                  const wert = werte[s.feld];
                  return (
                    <td key={s.feld} className="px-3 py-2 text-text-normal">
                      {s.art === 'select' && typeof wert === 'string' ? (
                        <Badge wert={wert} />
                      ) : s.art === 'boolean' ? (
                        wert ? (
                          t('Ja')
                        ) : (
                          t('Nein')
                        )
                      ) : s.art === 'ref' && typeof wert === 'string' ? (
                        (perId(wert)?.name ?? '–')
                      ) : (
                        String(wert ?? '–')
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
