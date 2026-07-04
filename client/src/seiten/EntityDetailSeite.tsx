/**
 * Generische Detailseite: Kopf mit Badges, Metadaten (Verknüpfungen als
 * Links), Markdown-Abschnitte (DM-Abschnitte markiert), Quest-Fortschritt,
 * Kampagnen-Log und automatische Backlinks („Erwähnt in …“).
 */
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import type { ChecklistEintrag, Entitaet, Quest } from '@campanium/shared';
import { configVonRoute, entityConfigs, type EntityConfig } from '@campanium/shared';
import { bildUrl, IST_SPIELER_MODUS } from '../api';
import { formatDatum, pfadFuer } from '../hilfen';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Badge, DmBadge } from '../komponenten/Badge';
import { Checkliste } from '../komponenten/Checkliste';
import { Markdown } from '../komponenten/Markdown';
import { Trennlinie } from '../komponenten/Ornament';
import { entityIcon } from '../komponenten/icons';

export function EntityDetailSeite() {
  const { route = '', id = '' } = useParams();
  const { t } = useI18n();
  const config = configVonRoute(route);
  const { perId } = useStore();
  const entitaet = perId(id);

  if (!config) return <p className="text-text-schwach">{t('Unbekannter Bereich.')}</p>;
  if (!entitaet || entitaet.typ !== config.typ) {
    return <p className="text-text-schwach">{t('Eintrag nicht gefunden.')}</p>;
  }
  return <Detail config={config} entitaet={entitaet} />;
}

function Detail({ config, entitaet }: { config: EntityConfig; entitaet: Entitaet }) {
  const { kampagne, perId, backlinks, aktualisieren } = useStore();
  const { t, locale } = useI18n();
  const werte = entitaet as unknown as Record<string, unknown>;
  const Icon = entityIcon(config.icon);
  const erwaehnungen = backlinks(entitaet.id);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Portrait/Artwork: fließt rechts neben Kopf und Metadaten. */}
      {entitaet.bild && kampagne && (
        <img
          src={bildUrl(kampagne.id, entitaet.bild)}
          alt={t('Bild von {name}', { name: entitaet.name })}
          className="float-right mb-3 ml-5 w-36 rounded border border-rand object-cover shadow-md sm:w-48"
        />
      )}
      {/* Kopf */}
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-text-schwach">
        <Icon size={13} aria-hidden /> {t(config.label)}
        {(entitaet.dmOnly || config.immerDm) && <DmBadge />}
      </div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl">{entitaet.name}</h1>
        {!IST_SPIELER_MODUS && (
          <Link
            to={`${pfadFuer(entitaet)}/bearbeiten`}
            className="flex items-center gap-1.5 rounded border border-rand px-3 py-1.5 text-sm text-text-normal hover:border-gold hover:text-gold"
          >
            <Pencil size={14} /> {t('Bearbeiten')}
          </Link>
        )}
      </div>

      {/* Tags + Status-Badges */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {config.felder
          .filter((f) => f.art === 'select' && typeof werte[f.feld] === 'string')
          .map((f) => (
            <Badge key={f.feld} wert={String(werte[f.feld])} />
          ))}
        {entitaet.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-sm bg-flaeche-3 px-1.5 py-0.5 text-[11px] text-text-schwach"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Metadaten */}
      <dl className="karte karte-ornament mb-6 grid gap-x-6 gap-y-2 p-4 sm:grid-cols-2">
        {config.felder
          .filter((f) => f.art !== 'select')
          .map((feld) => {
            const wert = werte[feld.feld];
            if (wert === null || wert === undefined || wert === '') return null;
            if (feld.dm && IST_SPIELER_MODUS) return null;
            let anzeige: ReactNode;
            if (feld.art === 'ref' && typeof wert === 'string') {
              const ziel = perId(wert);
              anzeige = ziel ? (
                <Link className="wikilink" to={pfadFuer(ziel)}>
                  {ziel.name}
                </Link>
              ) : (
                '–'
              );
            } else if (feld.art === 'boolean') {
              anzeige = wert ? t('Ja') : t('Nein');
            } else if (feld.art === 'datum') {
              anzeige = formatDatum(String(wert), locale);
            } else {
              anzeige = String(wert);
            }
            return (
              <div key={feld.feld} className="text-sm">
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-schwach">
                  {t(feld.label)} {feld.dm && <DmBadge />}
                </dt>
                <dd className="mt-0.5 text-text-stark">{anzeige}</dd>
              </div>
            );
          })}
      </dl>

      {/* Quest-Fortschritt: direkt auf der Detailseite abhakbar */}
      {entitaet.typ === 'quest' && (entitaet as Quest).fortschritt.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
            {t('Fortschritt')}
          </h2>
          <Checkliste
            eintraege={(entitaet as Quest).fortschritt}
            onChange={
              IST_SPIELER_MODUS
                ? undefined
                : (neu: ChecklistEintrag[]) =>
                    void aktualisieren('quest', entitaet.id, { fortschritt: neu })
            }
          />
        </section>
      )}

      {/* Markdown-Abschnitte */}
      {config.abschnitte.map((abschnitt) => {
        const text = String(werte[abschnitt.feld] ?? '');
        if (!text.trim()) return null;
        return (
          <section key={abschnitt.feld} className={`mb-6 ${abschnitt.dm ? 'dm-bereich pl-3' : ''}`}>
            <h2 className="mb-1.5 flex items-center gap-2 text-sm uppercase tracking-wider text-text-schwach">
              {t(abschnitt.titel)} {abschnitt.dm && <DmBadge />}
            </h2>
            <Markdown text={text} />
          </section>
        );
      })}

      {/* Kampagnen-Log */}
      {entitaet.kampagnenLog.length > 0 && (
        <>
          <Trennlinie className="my-6" />
          <section className="mb-6">
            <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
              {t('Kampagnen-Log')}
            </h2>
            <ol className="space-y-1.5">
              {[...entitaet.kampagnenLog]
                .sort((a, b) => a.sessionNr - b.sessionNr)
                .map((eintrag, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="shrink-0 font-display text-gold">S{eintrag.sessionNr}</span>
                    <span className="md-inhalt text-base">
                      <Markdown text={eintrag.text} />
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        </>
      )}

      {/* Backlinks */}
      {erwaehnungen.length > 0 && (
        <>
          <Trennlinie className="my-6" />
          <section>
            <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
              {t('Erwähnt in …')}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {erwaehnungen.map((quelle) => (
                <li key={quelle.id}>
                  <Link
                    to={pfadFuer(quelle)}
                    className="karte inline-flex items-center gap-1.5 px-2.5 py-1 text-sm text-text-normal hover:border-gold hover:text-gold"
                  >
                    <span className="text-[10px] uppercase tracking-wider text-text-schwach">
                      {t(entityConfigs[quelle.typ].label)}
                    </span>
                    {quelle.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
