/**
 * Dashboard: Tracker-Widgets aus dem Kampagnenstand (direkt editierbar,
 * inkl. optionalem Eskalations-Tracker mit editierbaren Stufen), aktive
 * Quests, letzte Sessions, verbündete NSCs, offene Fäden und
 * Schnellzugriff auf die Spezialmodule.
 */
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Castle, Minus, Pencil, Plus, Sparkles, Tent, Trash2 } from 'lucide-react';
import type { Entitaet, Nsc, Quest, Session } from '@campanium/shared';
import { formatKalenderDatum, kalenderAktiv, slugify } from '@campanium/shared';
import { IST_SPIELER_MODUS } from '../api';
import { formatDatum, pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { Badge } from '../komponenten/Badge';
import { Markdown } from '../komponenten/Markdown';
import { Trennlinie } from '../komponenten/Ornament';

export function Dashboard() {
  const { entitaeten, kampagne, kampagnenstand, setzeKampagnenstand, kalender } = useStore();
  const navigate = useNavigate();
  const { erstellen } = useStore();

  const aktiveQuests = entitaeten.filter(
    (e): e is Quest => e.typ === 'quest' && e.status === 'aktiv',
  );
  const sessions = entitaeten
    .filter((e): e is Session => e.typ === 'session')
    .sort((a, b) => b.nummer - a.nummer);
  const letzteSessions = sessions.slice(0, 3);
  const verbuendete = entitaeten.filter(
    (e): e is Nsc => e.typ === 'nsc' && e.haltung === 'verbündet',
  );
  const letzteSession = sessions[0];

  /** „Neue Session vorbereiten“: legt direkt ein Prep für die nächste Nummer an. */
  const neuesPrep = async () => {
    const naechste = (sessions[0]?.nummer ?? 0) + 1;
    const prep = await erstellen('sessionPrep', {
      name: `Prep Session ${naechste}`,
      sessionNummer: naechste,
      dmOnly: true,
    } as Partial<Entitaet> & { name: string });
    navigate(`${pfadFuer(prep)}/bearbeiten`);
  };

  const setzeWert = (aenderung: Partial<typeof kampagnenstand>) =>
    void setzeKampagnenstand({ ...kampagnenstand, ...aenderung });

  return (
    <div>
      <h1 className="mb-1 text-3xl">{kampagne?.name ?? 'Kampagnen-Übersicht'}</h1>
      <p className="mb-6 font-serif text-lg italic text-text-schwach">
        {kampagne?.beschreibung || 'Ein neues Kapitel wartet darauf, geschrieben zu werden …'}
      </p>

      {/* Tracker-Widgets */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Zaehler
          titel="Party-Level"
          wert={kampagnenstand.partyLevel}
          min={1}
          max={20}
          onChange={(v) => setzeWert({ partyLevel: v })}
        />
        <div className="karte karte-ornament p-4">
          <TrackerTitel>In-Game-Tag</TrackerTitel>
          <div className="flex items-center gap-2">
            <ZaehlerKnoepfe
              wert={kampagnenstand.ingameTag}
              min={1}
              max={9999}
              onChange={(v) => setzeWert({ ingameTag: v })}
            >
              <span className="font-display text-2xl text-text-stark">
                Tag {kampagnenstand.ingameTag}
              </span>
            </ZaehlerKnoepfe>
          </div>
          {/* Ist der Kalender eingerichtet, erscheint hier das formatierte Datum. */}
          {!IST_SPIELER_MODUS && kalenderAktiv(kalender) && (
            <Link
              to="/kalender"
              className="mt-1 block text-sm text-gold-hell hover:text-gold"
            >
              {formatKalenderDatum(kalender, kalender.aktuell)}
            </Link>
          )}
          {IST_SPIELER_MODUS ? (
            kampagnenstand.ingameDatumText && (
              <p className="mt-1 text-sm text-text-schwach">{kampagnenstand.ingameDatumText}</p>
            )
          ) : (
            <input
              className="mt-1.5 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-text-schwach hover:border-rand focus:border-rand"
              value={kampagnenstand.ingameDatumText}
              placeholder="z. B. „neblig, kurz vor Mitternacht“"
              onChange={(e) => setzeWert({ ingameDatumText: e.target.value })}
              aria-label="In-Game-Datum (Freitext)"
            />
          )}
        </div>
        {!IST_SPIELER_MODUS && <EskalationsKarte />}
        {kampagnenstand.customTracker.map((tracker) => (
          <div key={tracker.id} className="karte karte-ornament p-4">
            <TrackerTitel>
              {tracker.name}
              {!IST_SPIELER_MODUS && (
                <button
                  className="float-right text-text-schwach hover:text-rot"
                  aria-label={`Tracker „${tracker.name}“ löschen`}
                  onClick={() =>
                    setzeWert({
                      customTracker: kampagnenstand.customTracker.filter(
                        (t) => t.id !== tracker.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              )}
            </TrackerTitel>
            <ZaehlerKnoepfe
              wert={tracker.aktuell}
              min={0}
              max={tracker.max}
              onChange={(v) =>
                setzeWert({
                  customTracker: kampagnenstand.customTracker.map((t) =>
                    t.id === tracker.id ? { ...t, aktuell: v } : t,
                  ),
                })
              }
            >
              <span className="font-display text-2xl text-text-stark">
                {tracker.aktuell}
                <span className="text-base text-text-schwach">/{tracker.max}</span>
              </span>
            </ZaehlerKnoepfe>
          </div>
        ))}
        {!IST_SPIELER_MODUS && <NeuerTrackerKnopf />}
      </div>

      {/* Schnellzugriff (nur DM) */}
      {!IST_SPIELER_MODUS && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => void neuesPrep()}
            className="flex items-center gap-2 rounded bg-blut px-3.5 py-2 text-sm font-medium text-white hover:bg-blut-hell"
          >
            <Tent size={15} /> Neue Session vorbereiten
          </button>
          <Link
            to="/widersacher"
            className="flex items-center gap-2 rounded border border-rand px-3.5 py-2 text-sm hover:border-gold hover:text-gold"
          >
            <Castle size={15} /> Widersacher-Tracker
          </Link>
          <Link
            to="/lesung"
            className="flex items-center gap-2 rounded border border-arkan/40 px-3.5 py-2 text-sm text-arkan hover:bg-arkan-flaeche"
          >
            <Sparkles size={15} /> Lesung
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aktive Quests */}
        <section>
          <h2 className="mb-3 text-lg">Aktive Quests</h2>
          {aktiveQuests.length === 0 && (
            <p className="text-sm text-text-schwach">Keine aktiven Quests.</p>
          )}
          <div className="space-y-2">
            {aktiveQuests.map((quest) => (
              <Link
                key={quest.id}
                to={pfadFuer(quest)}
                className="karte karte-ornament block p-3 hover:bg-flaeche-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-text-stark">{quest.name}</span>
                  <Badge wert={quest.status} />
                </div>
                {quest.auftrag && <p className="mt-1 text-sm text-text-schwach">{quest.auftrag}</p>}
              </Link>
            ))}
          </div>
        </section>

        {/* Letzte Sessions */}
        <section>
          <h2 className="mb-3 text-lg">Letzte Sessions</h2>
          {letzteSessions.length === 0 && (
            <p className="text-sm text-text-schwach">Noch keine Sessions protokolliert.</p>
          )}
          <div className="space-y-2">
            {letzteSessions.map((session) => (
              <Link
                key={session.id}
                to={pfadFuer(session)}
                className="karte karte-ornament block p-3 hover:bg-flaeche-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-text-stark">
                    #{session.nummer} · {session.name}
                  </span>
                  <span className="text-xs text-text-schwach">{formatDatum(session.datum)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Verbündete */}
        <section>
          <h2 className="mb-3 text-lg">Verbündete NSCs</h2>
          {verbuendete.length === 0 && (
            <p className="text-sm text-text-schwach">
              Noch keine Verbündeten – die Welt ist ein einsamer Ort.
            </p>
          )}
          <ul className="flex flex-wrap gap-2">
            {verbuendete.map((nsc) => (
              <li key={nsc.id}>
                <Link
                  to={pfadFuer(nsc)}
                  className="karte inline-block px-2.5 py-1.5 text-sm text-text-stark hover:border-gold"
                >
                  {nsc.name}
                  {nsc.wer && <span className="ml-1.5 text-xs text-text-schwach">{nsc.wer}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Offene Fäden */}
        <section>
          <h2 className="mb-3 text-lg">Offene Fäden</h2>
          {letzteSession?.offeneFaeden ? (
            <div className="karte karte-ornament p-3.5">
              <p className="mb-2 text-xs uppercase tracking-wider text-text-schwach">
                aus Session #{letzteSession.nummer}
              </p>
              <Markdown text={letzteSession.offeneFaeden} />
            </div>
          ) : (
            <p className="text-sm text-text-schwach">Keine offenen Fäden notiert.</p>
          )}
        </section>
      </div>

      <Trennlinie className="mt-10" />
    </div>
  );
}

function TrackerTitel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-schwach">
      {children}
    </h2>
  );
}

/** +/−-Steuerung um einen Wert herum; ohne onChange (Spieler) nur Anzeige. */
function ZaehlerKnoepfe({
  wert,
  min,
  max,
  onChange,
  children,
}: {
  wert: number;
  min: number;
  max: number;
  onChange: (wert: number) => void;
  children: ReactNode;
}) {
  if (IST_SPIELER_MODUS) return <>{children}</>;
  return (
    <div className="flex items-center gap-2">
      <button
        className="rounded border border-rand p-1 text-text-schwach hover:border-gold hover:text-gold disabled:opacity-30"
        onClick={() => onChange(Math.max(min, wert - 1))}
        disabled={wert <= min}
        aria-label="verringern"
      >
        <Minus size={13} />
      </button>
      {children}
      <button
        className="rounded border border-rand p-1 text-text-schwach hover:border-gold hover:text-gold disabled:opacity-30"
        onClick={() => onChange(Math.min(max, wert + 1))}
        disabled={wert >= max}
        aria-label="erhöhen"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

function Zaehler({
  titel,
  wert,
  min,
  max,
  onChange,
}: {
  titel: string;
  wert: number;
  min: number;
  max: number;
  onChange: (wert: number) => void;
}) {
  return (
    <div className="karte karte-ornament p-4">
      <TrackerTitel>{titel}</TrackerTitel>
      <ZaehlerKnoepfe wert={wert} min={min} max={max} onChange={onChange}>
        <span className="font-display text-2xl text-text-stark">{wert}</span>
      </ZaehlerKnoepfe>
    </div>
  );
}

/**
 * Optionaler Eskalations-Tracker (DM-only): +/− für die Stufe, Stift-Icon
 * öffnet den Editor für Titel und Stufenbeschreibungen. Ohne konfigurierten
 * Tracker erscheint eine „hinzufügen“-Karte.
 */
function EskalationsKarte() {
  const { kampagnenstand, setzeKampagnenstand } = useStore();
  const [editorOffen, setEditorOffen] = useState(false);
  const eskalation = kampagnenstand.eskalation;

  const speichere = (neu: typeof eskalation) =>
    void setzeKampagnenstand({ ...kampagnenstand, eskalation: neu });

  if (!eskalation) {
    return (
      <button
        className="karte flex min-h-24 items-center justify-center gap-2 border-dashed text-sm text-text-schwach hover:border-gold hover:text-gold"
        onClick={() =>
          speichere({
            titel: 'Eskalation',
            stufe: 1,
            stufen: ['Stufe 1', 'Stufe 2', 'Stufe 3', 'Stufe 4', 'Stufe 5'],
          })
        }
      >
        <Plus size={15} /> Eskalations-Tracker
      </button>
    );
  }

  return (
    <div className="karte karte-ornament p-4">
      <TrackerTitel>
        {eskalation.titel || 'Eskalation'}
        <button
          className="float-right text-text-schwach hover:text-gold"
          aria-label="Eskalations-Tracker bearbeiten"
          onClick={() => setEditorOffen((o) => !o)}
        >
          <Pencil size={13} />
        </button>
      </TrackerTitel>
      <ZaehlerKnoepfe
        wert={eskalation.stufe}
        min={1}
        max={eskalation.stufen.length}
        onChange={(v) => speichere({ ...eskalation, stufe: v })}
      >
        <span className="font-display text-2xl text-text-stark">Stufe {eskalation.stufe}</span>
      </ZaehlerKnoepfe>
      <p className="mt-1 line-clamp-2 text-xs text-text-schwach">
        {eskalation.stufen[eskalation.stufe - 1]}
      </p>

      {editorOffen && (
        <div className="mt-3 border-t border-rand pt-3">
          <input
            className="mb-2 w-full rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
            value={eskalation.titel}
            placeholder="Titel, z. B. „Strahds Eskalation“"
            onChange={(e) => speichere({ ...eskalation, titel: e.target.value })}
            aria-label="Titel des Eskalations-Trackers"
          />
          {eskalation.stufen.map((stufe, i) => (
            <div key={i} className="mb-1.5 flex items-start gap-1.5">
              <span className="mt-1.5 shrink-0 font-display text-xs text-gold">{i + 1}</span>
              <textarea
                className="w-full resize-y rounded border border-rand bg-flaeche-3 px-2 py-1 text-xs"
                rows={2}
                value={stufe}
                onChange={(e) =>
                  speichere({
                    ...eskalation,
                    stufen: eskalation.stufen.map((s, j) => (j === i ? e.target.value : s)),
                  })
                }
                aria-label={`Beschreibung Stufe ${i + 1}`}
              />
              <button
                className="mt-1.5 text-text-schwach hover:text-rot disabled:opacity-30"
                disabled={eskalation.stufen.length <= 1}
                aria-label={`Stufe ${i + 1} entfernen`}
                onClick={() =>
                  speichere({
                    ...eskalation,
                    stufe: Math.min(eskalation.stufe, eskalation.stufen.length - 1),
                    stufen: eskalation.stufen.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="flex justify-between">
            <button
              className="text-xs text-text-schwach hover:text-gold"
              onClick={() =>
                speichere({
                  ...eskalation,
                  stufen: [...eskalation.stufen, `Stufe ${eskalation.stufen.length + 1}`],
                })
              }
            >
              + Stufe
            </button>
            <button
              className="text-xs text-text-schwach hover:text-rot"
              onClick={() => {
                if (window.confirm('Eskalations-Tracker wirklich entfernen?')) {
                  speichere(null);
                  setEditorOffen(false);
                }
              }}
            >
              Tracker entfernen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Formular-Karte zum Anlegen eines neuen Custom-Trackers. */
function NeuerTrackerKnopf() {
  const { kampagnenstand, setzeKampagnenstand } = useStore();
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState('');
  const [max, setMax] = useState(3);

  if (!offen) {
    return (
      <button
        className="karte flex min-h-24 items-center justify-center gap-2 border-dashed text-sm text-text-schwach hover:border-gold hover:text-gold"
        onClick={() => setOffen(true)}
      >
        <Plus size={15} /> Eigener Tracker
      </button>
    );
  }
  return (
    <div className="karte karte-ornament p-4">
      <TrackerTitel>Neuer Tracker</TrackerTitel>
      <input
        autoFocus
        className="mb-2 w-full rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-schwach">
          Max:{' '}
          <input
            type="number"
            className="w-16 rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
            value={max}
            min={1}
            onChange={(e) => setMax(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <button
          className="ml-auto rounded bg-blut px-2.5 py-1 text-xs font-medium text-white hover:bg-blut-hell"
          onClick={() => {
            if (!name.trim()) return;
            void setzeKampagnenstand({
              ...kampagnenstand,
              customTracker: [
                ...kampagnenstand.customTracker,
                { id: slugify(name), name: name.trim(), aktuell: 0, max },
              ],
            });
            setName('');
            setOffen(false);
          }}
        >
          Anlegen
        </button>
        <button
          className="rounded border border-rand px-2.5 py-1 text-xs"
          onClick={() => setOffen(false)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
