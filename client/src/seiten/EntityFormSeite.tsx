// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Generische Bearbeiten-Seite: rendert das Formular einer Entität komplett
 * aus der Registry (shared/entityConfig.ts) – Kopffelder, Markdown-
 * Abschnitte, Quest-Fortschritt und Kampagnen-Log. DM-Felder sind rot
 * markiert. Neue Entitätstypen brauchen hier KEINEN neuen Code.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2 } from 'lucide-react';
import type { Attribute, ChecklistEintrag, Entitaet, KampagnenLogEintrag } from '@campanium/shared';
import {
  ATTRIBUT_FELDER,
  configVonRoute,
  type EntityConfig,
  type FeldConfig,
} from '@campanium/shared';
import { formatModifikator, pfadFuer } from '../hilfen';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { BildUpload } from '../komponenten/BildUpload';
import { Checkliste } from '../komponenten/Checkliste';
import { DmBadge } from '../komponenten/Badge';
import { MarkdownEditor } from '../komponenten/MarkdownEditor';

type Werte = Record<string, unknown>;

/** Volle Attributnamen (für aria-labels; Kurzformen kommen aus ATTRIBUT_FELDER). */
const ATTR_NAME: Record<keyof Attribute, string> = {
  staerke: 'Stärke',
  geschicklichkeit: 'Geschicklichkeit',
  konstitution: 'Konstitution',
  intelligenz: 'Intelligenz',
  weisheit: 'Weisheit',
  charisma: 'Charisma',
};

export function EntityFormSeite() {
  const { route = '', id = '' } = useParams();
  const { t } = useI18n();
  const config = configVonRoute(route);
  const { perId } = useStore();
  const entitaet = perId(id);

  if (!config) return <p className="text-text-schwach">{t('Unbekannter Bereich.')}</p>;
  if (!entitaet || entitaet.typ !== config.typ) {
    return <p className="text-text-schwach">{t('Eintrag nicht gefunden.')}</p>;
  }
  return <Formular config={config} entitaet={entitaet} />;
}

function Formular({ config, entitaet }: { config: EntityConfig; entitaet: Entitaet }) {
  const { aktualisieren, loeschen } = useStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [werte, setWerte] = useState<Werte>({ ...entitaet });
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const setze = (feld: string, wert: unknown) => setWerte((w) => ({ ...w, [feld]: wert }));

  const speichern = async () => {
    setSpeichert(true);
    setFehler(null);
    try {
      const gespeichert = await aktualisieren(config.typ, entitaet.id, werte as Partial<Entitaet>);
      navigate(pfadFuer(gespeichert));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Speichern fehlgeschlagen'));
    } finally {
      setSpeichert(false);
    }
  };

  const entfernen = async () => {
    if (
      !window.confirm(
        t('„{name}“ wirklich löschen? Das kann nicht rückgängig gemacht werden.', {
          name: entitaet.name,
        }),
      )
    )
      return;
    await loeschen(config.typ, entitaet.id);
    navigate(`/${config.route}`);
  };

  const log = (werte.kampagnenLog as KampagnenLogEintrag[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-text-schwach">
        {t('{label} bearbeiten', { label: t(config.label) })}
      </p>
      <input
        className="mb-5 w-full border-b border-rand bg-transparent pb-2 font-display text-2xl text-text-stark outline-none focus:border-gold"
        value={String(werte.name ?? '')}
        onChange={(e) => setze('name', e.target.value)}
        aria-label={t('Name')}
      />

      {/* Bild / Portrait */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-text-schwach">{t('Bild')}</h2>
        <BildUpload
          wert={(werte.bild as string | null) ?? null}
          onChange={(datei) => setze('bild', datei)}
          alt={String(werte.name ?? '')}
        />
      </section>

      {/* Kopffelder aus der Registry */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {config.felder.map((feld) => (
          <Feld key={feld.feld} feld={feld} wert={werte[feld.feld]} setze={setze} />
        ))}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-text-schwach">
            {t('Tags (kommagetrennt)')}
          </span>
          <input
            className="rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
            value={((werte.tags as string[]) ?? []).join(', ')}
            onChange={(e) =>
              setze(
                'tags',
                e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
        {!config.immerDm && (
          <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
            <input
              type="checkbox"
              className="accent-(--blut)"
              checked={Boolean(werte.dmOnly)}
              onChange={(e) => setze('dmOnly', e.target.checked)}
            />
            <span className="flex items-center gap-1.5">
              {t('Komplett DM-only')} <DmBadge />
            </span>
          </label>
        )}
      </div>

      {/* Quest-Fortschritt */}
      {config.typ === 'quest' && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
            {t('Fortschritt')}
          </h2>
          <Checkliste
            eintraege={(werte.fortschritt as ChecklistEintrag[]) ?? []}
            onChange={(neu) => setze('fortschritt', neu)}
            bearbeitbar
          />
        </section>
      )}

      {/* Markdown-Abschnitte aus der Registry */}
      {config.abschnitte.map((abschnitt) => (
        <section key={abschnitt.feld} className={`mb-6 ${abschnitt.dm ? 'dm-bereich pl-3' : ''}`}>
          <h2 className="mb-2 flex items-center gap-2 text-sm uppercase tracking-wider text-text-schwach">
            {t(abschnitt.titel)} {abschnitt.dm && <DmBadge />}
          </h2>
          <MarkdownEditor
            wert={String(werte[abschnitt.feld] ?? '')}
            onChange={(neu) => setze(abschnitt.feld, neu)}
            placeholder={abschnitt.hinweis ? t(abschnitt.hinweis) : undefined}
          />
        </section>
      ))}

      {/* Kampagnen-Log */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm uppercase tracking-wider text-text-schwach">
          {t('Kampagnen-Log (was ist wann passiert?)')}
        </h2>
        {log.map((eintrag, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              type="number"
              className="w-20 rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
              value={eintrag.sessionNr}
              onChange={(e) =>
                setze(
                  'kampagnenLog',
                  log.map((l, j) => (j === i ? { ...l, sessionNr: Number(e.target.value) } : l)),
                )
              }
              aria-label={t('Session-Nummer Eintrag {nr}', { nr: i + 1 })}
            />
            <input
              className="flex-1 rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
              value={eintrag.text}
              onChange={(e) =>
                setze(
                  'kampagnenLog',
                  log.map((l, j) => (j === i ? { ...l, text: e.target.value } : l)),
                )
              }
              aria-label={t('Log-Text Eintrag {nr}', { nr: i + 1 })}
            />
            <button
              type="button"
              className="text-text-schwach hover:text-rot"
              onClick={() =>
                setze(
                  'kampagnenLog',
                  log.filter((_, j) => j !== i),
                )
              }
              aria-label={t('Log-Eintrag {nr} entfernen', { nr: i + 1 })}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rounded border border-rand px-2.5 py-1 text-xs text-text-schwach hover:text-gold"
          onClick={() => setze('kampagnenLog', [...log, { sessionNr: log.length + 1, text: '' }])}
        >
          + {t('Log-Eintrag')}
        </button>
      </section>

      {fehler && <p className="mb-4 text-sm text-rot">{fehler}</p>}

      <div className="flex items-center gap-2 border-t border-rand pt-4">
        <button
          className="flex items-center gap-2 rounded bg-blut px-4 py-2 text-sm font-medium text-white hover:bg-blut-hell disabled:opacity-50"
          onClick={() => void speichern()}
          disabled={speichert}
        >
          <Save size={15} /> {t('Speichern')}
        </button>
        <button
          className="rounded border border-rand px-4 py-2 text-sm hover:bg-flaeche-3"
          onClick={() => navigate(pfadFuer(entitaet))}
        >
          {t('Abbrechen')}
        </button>
        <button
          className="ml-auto flex items-center gap-2 rounded border border-rot/40 px-4 py-2 text-sm text-rot hover:bg-rot-flaeche"
          onClick={() => void entfernen()}
        >
          <Trash2 size={15} /> {t('Löschen')}
        </button>
      </div>
    </div>
  );
}

/** Rendert ein einzelnes Kopffeld anhand seiner Art. */
function Feld({
  feld,
  wert,
  setze,
}: {
  feld: FeldConfig;
  wert: unknown;
  setze: (feld: string, wert: unknown) => void;
}) {
  const { entitaeten } = useStore();
  const { t, locale } = useI18n();
  const label = (
    <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-schwach">
      {t(feld.label)} {feld.dm && <DmBadge />}
    </span>
  );
  const basisKlasse = 'rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark';

  switch (feld.art) {
    case 'attribute': {
      const attr = (wert as Attribute | null) ?? null;
      const standard: Attribute = {
        staerke: 10,
        geschicklichkeit: 10,
        konstitution: 10,
        intelligenz: 10,
        weisheit: 10,
        charisma: 10,
      };
      return (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-(--blut)"
              checked={attr !== null}
              onChange={(e) => setze(feld.feld, e.target.checked ? standard : null)}
            />
            {label}
          </label>
          {attr && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ATTRIBUT_FELDER.map(({ feld: k, kurz }) => (
                <label key={k} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[10px] tracking-wider text-text-schwach">
                    {t(kurz)}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="w-full rounded border border-rand bg-flaeche-3 px-1 py-1 text-center text-text-stark"
                    value={attr[k]}
                    onChange={(e) =>
                      setze(feld.feld, {
                        ...attr,
                        [k]: Math.max(1, Math.min(30, Number(e.target.value))),
                      })
                    }
                    aria-label={t(ATTR_NAME[k])}
                  />
                  <span className="font-mono text-[11px] text-gold">
                    {formatModifikator(attr[k])}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'boolean':
      return (
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
          <input
            type="checkbox"
            className="accent-(--blut)"
            checked={Boolean(wert)}
            onChange={(e) => setze(feld.feld, e.target.checked)}
          />
          {label}
        </label>
      );
    case 'select':
      return (
        <label className="flex flex-col gap-1 text-sm">
          {label}
          <select
            className={basisKlasse}
            value={String(wert ?? '')}
            onChange={(e) => setze(feld.feld, e.target.value)}
          >
            {(feld.optionen ?? []).map((o) => (
              <option key={o} value={o}>
                {t(o)}
              </option>
            ))}
          </select>
        </label>
      );
    case 'ref': {
      const kandidaten = entitaeten
        .filter((e) => feld.refTypen?.includes(e.typ))
        .sort((a, b) => a.name.localeCompare(b.name, locale));
      return (
        <label className="flex flex-col gap-1 text-sm">
          {label}
          <select
            className={basisKlasse}
            value={String(wert ?? '')}
            onChange={(e) => setze(feld.feld, e.target.value || null)}
          >
            <option value="">{t('– keine –')}</option>
            {kandidaten.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      );
    }
    case 'nummer':
      return (
        <label className="flex flex-col gap-1 text-sm">
          {label}
          <input
            type="number"
            className={basisKlasse}
            value={Number(wert ?? 0)}
            onChange={(e) => setze(feld.feld, Number(e.target.value))}
          />
        </label>
      );
    case 'datum':
      return (
        <label className="flex flex-col gap-1 text-sm">
          {label}
          <input
            type="date"
            className={basisKlasse}
            value={String(wert ?? '')}
            onChange={(e) => setze(feld.feld, e.target.value)}
          />
        </label>
      );
    default:
      return (
        <label className="flex flex-col gap-1 text-sm">
          {label}
          <input
            className={basisKlasse}
            value={String(wert ?? '')}
            placeholder={feld.hinweis ? t(feld.hinweis) : undefined}
            onChange={(e) => setze(feld.feld, e.target.value)}
          />
        </label>
      );
  }
}
