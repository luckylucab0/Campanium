/**
 * In-Game-Kalender (DM-Modul): frei konfigurierbare Monate mit eigenen
 * Längen, aktuelles Datum mit Tages-Schaltung (rollt über Monats-/
 * Jahresgrenzen) und Ereignisse pro Tag, optional mit Entitäts-Verknüpfung.
 *
 * Ohne eingerichtete Monate zeigt die Seite den Einrichtungs-Bildschirm
 * mit zwei Vorlagen; die Monatsliste bleibt danach jederzeit editierbar.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Settings2, Trash2 } from 'lucide-react';
import type { Kalender, KalenderDatum, KalenderEreignis } from '@campanium/shared';
import {
  formatKalenderDatum,
  gleichesDatum,
  kalenderAktiv,
  klemmeDatum,
  naechsterTag,
  vorherigerTag,
  vorlageIrdisch,
  vorlageZwoelfMonate,
} from '@campanium/shared';
import { pfadFuer } from '../hilfen';
import { useStore } from '../store';

export function KalenderSeite() {
  const { kalender, setzeKalender } = useStore();

  if (!kalenderAktiv(kalender)) {
    return <Einrichtung speichere={(neu) => void setzeKalender(neu)} kalender={kalender} />;
  }
  return <KalenderAnsicht />;
}

/** Einrichtungs-Bildschirm: Vorlage wählen, Monate später frei anpassbar. */
function Einrichtung({
  kalender,
  speichere,
}: {
  kalender: Kalender;
  speichere: (neu: Kalender) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 flex items-center gap-2.5 text-2xl">
        <CalendarDays size={22} className="text-blut-hell" aria-hidden /> Kalender
      </h1>
      <p className="mb-6 text-sm text-text-schwach">
        Richte den Kalender deiner Spielwelt ein – Monatsnamen und -längen sind frei wählbar und
        lassen sich später jederzeit anpassen.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="karte karte-ornament p-4 text-left hover:border-gold"
          onClick={() =>
            speichere({ ...kalender, monate: vorlageZwoelfMonate(), aktuell: { jahr: 1, monat: 1, tag: 1 } })
          }
        >
          <div className="mb-1 font-display text-text-stark">12 Monate à 30 Tage</div>
          <p className="text-sm text-text-schwach">
            Neutraler Fantasy-Kalender – Monatsnamen anschließend umbenennen.
          </p>
        </button>
        <button
          className="karte karte-ornament p-4 text-left hover:border-gold"
          onClick={() =>
            speichere({ ...kalender, monate: vorlageIrdisch(), aktuell: { jahr: 1, monat: 1, tag: 1 } })
          }
        >
          <div className="mb-1 font-display text-text-stark">Irdischer Kalender</div>
          <p className="text-sm text-text-schwach">
            Januar bis Dezember mit echten Monatslängen (ohne Schaltjahre).
          </p>
        </button>
      </div>
    </div>
  );
}

function KalenderAnsicht() {
  const { kalender, setzeKalender, entitaeten, perId } = useStore();
  /** Angezeigter Monat (unabhängig vom aktuellen Datum blätterbar). */
  const [ansicht, setAnsicht] = useState<{ jahr: number; monat: number }>({
    jahr: kalender.aktuell.jahr,
    monat: kalender.aktuell.monat,
  });
  const [gewaehlterTag, setGewaehlterTag] = useState<KalenderDatum | null>(null);
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);

  const speichere = (neu: Kalender) => void setzeKalender(neu);
  const monat = kalender.monate[ansicht.monat - 1]!;

  const blaettern = (richtung: 1 | -1) => {
    setGewaehlterTag(null);
    setAnsicht((a) => {
      let monatNeu = a.monat + richtung;
      let jahrNeu = a.jahr;
      if (monatNeu < 1) {
        monatNeu = kalender.monate.length;
        jahrNeu -= 1;
      } else if (monatNeu > kalender.monate.length) {
        monatNeu = 1;
        jahrNeu += 1;
      }
      return { jahr: jahrNeu, monat: monatNeu };
    });
  };

  const setzeAktuell = (datum: KalenderDatum) => speichere({ ...kalender, aktuell: datum });

  const tagWechseln = (richtung: 1 | -1) => {
    const neu =
      richtung === 1
        ? naechsterTag(kalender, kalender.aktuell)
        : vorherigerTag(kalender, kalender.aktuell);
    speichere({ ...kalender, aktuell: neu });
    setAnsicht({ jahr: neu.jahr, monat: neu.monat });
  };

  const ereignisseAm = (datum: KalenderDatum): KalenderEreignis[] =>
    kalender.ereignisse.filter((e) => gleichesDatum(e.datum, datum));

  return (
    <div className="mx-auto max-w-4xl">
      {/* Kopf: aktuelles Datum + Tages-Schaltung */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 flex items-center gap-2.5 text-2xl">
            <CalendarDays size={22} className="text-blut-hell" aria-hidden /> Kalender
          </h1>
          <p className="font-serif text-lg italic text-gold-hell">
            Heute: {formatKalenderDatum(kalender, kalender.aktuell)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-rand px-3 py-1.5 text-sm hover:border-gold hover:text-gold"
            onClick={() => tagWechseln(-1)}
          >
            −1 Tag
          </button>
          <button
            className="rounded bg-blut px-3 py-1.5 text-sm font-medium text-white hover:bg-blut-hell"
            onClick={() => tagWechseln(1)}
          >
            +1 Tag
          </button>
          <button
            className={`rounded border p-1.5 ${
              einstellungenOffen
                ? 'border-gold text-gold'
                : 'border-rand text-text-schwach hover:text-gold'
            }`}
            onClick={() => setEinstellungenOffen((o) => !o)}
            aria-label="Kalender-Einstellungen"
            aria-pressed={einstellungenOffen}
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {einstellungenOffen && <Einstellungen kalender={kalender} speichere={speichere} />}

      {/* Monats-Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          className="rounded border border-rand p-1.5 text-text-schwach hover:text-gold"
          onClick={() => blaettern(-1)}
          aria-label="Voriger Monat"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="font-display text-xl text-text-stark">
          {monat.name} {ansicht.jahr}
          {kalender.aera ? ` ${kalender.aera}` : ''}
        </h2>
        <button
          className="rounded border border-rand p-1.5 text-text-schwach hover:text-gold"
          onClick={() => blaettern(1)}
          aria-label="Nächster Monat"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tages-Raster (ohne Wochenstruktur – Fantasy-Kalender haben keine) */}
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
        {Array.from({ length: monat.tage }, (_, i) => {
          const datum: KalenderDatum = { jahr: ansicht.jahr, monat: ansicht.monat, tag: i + 1 };
          const istHeute = gleichesDatum(datum, kalender.aktuell);
          const istGewaehlt = gewaehlterTag !== null && gleichesDatum(datum, gewaehlterTag);
          const ereignisse = ereignisseAm(datum);
          return (
            <button
              key={i}
              className={`karte min-h-16 p-1.5 text-left align-top transition-colors hover:border-gold ${
                istHeute ? 'border-gold bg-gold/10' : ''
              } ${istGewaehlt ? 'ring-1 ring-gold' : ''}`}
              onClick={() => setGewaehlterTag(istGewaehlt ? null : datum)}
              aria-label={`Tag ${i + 1}${ereignisse.length ? `, ${ereignisse.length} Ereignis(se)` : ''}`}
            >
              <span
                className={`text-xs ${istHeute ? 'font-semibold text-gold' : 'text-text-schwach'}`}
              >
                {i + 1}
              </span>
              {ereignisse.slice(0, 2).map((e) => (
                <p key={e.id} className="mt-0.5 truncate text-[11px] leading-tight text-text-normal">
                  {e.titel}
                </p>
              ))}
              {ereignisse.length > 2 && (
                <p className="text-[10px] text-text-schwach">+{ereignisse.length - 2} weitere</p>
              )}
            </button>
          );
        })}
      </div>

      {gewaehlterTag && (
        <TagesPanel
          datum={gewaehlterTag}
          kalender={kalender}
          speichere={speichere}
          setzeAktuell={setzeAktuell}
          ereignisse={ereignisseAm(gewaehlterTag)}
          entitaeten={entitaeten}
          perId={perId}
        />
      )}
    </div>
  );
}

/** Panel unter dem Raster: Ereignisse des gewählten Tags verwalten. */
function TagesPanel({
  datum,
  kalender,
  speichere,
  setzeAktuell,
  ereignisse,
  entitaeten,
  perId,
}: {
  datum: KalenderDatum;
  kalender: Kalender;
  speichere: (neu: Kalender) => void;
  setzeAktuell: (datum: KalenderDatum) => void;
  ereignisse: KalenderEreignis[];
  entitaeten: ReturnType<typeof useStore>['entitaeten'];
  perId: ReturnType<typeof useStore>['perId'];
}) {
  const [titel, setTitel] = useState('');
  const [entitaetId, setEntitaetId] = useState('');
  const istHeute = gleichesDatum(datum, kalender.aktuell);

  const hinzufuegen = () => {
    if (!titel.trim()) return;
    const neu: KalenderEreignis = {
      id: `ereignis-${Date.now().toString(36)}`,
      datum,
      titel: titel.trim(),
      entitaetId: entitaetId || null,
    };
    speichere({ ...kalender, ereignisse: [...kalender.ereignisse, neu] });
    setTitel('');
    setEntitaetId('');
  };

  const loeschen = (id: string) =>
    speichere({ ...kalender, ereignisse: kalender.ereignisse.filter((e) => e.id !== id) });

  return (
    <div className="karte karte-ornament mt-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-text-stark">{formatKalenderDatum(kalender, datum)}</h3>
        {!istHeute && (
          <button
            className="rounded border border-rand px-2.5 py-1 text-xs hover:border-gold hover:text-gold"
            onClick={() => setzeAktuell(datum)}
          >
            Als aktuellen Tag setzen
          </button>
        )}
      </div>

      {ereignisse.length === 0 && (
        <p className="mb-3 text-sm text-text-schwach">Keine Ereignisse an diesem Tag.</p>
      )}
      <ul className="mb-3 space-y-1.5">
        {ereignisse.map((e) => {
          const verknuepft = e.entitaetId ? perId(e.entitaetId) : undefined;
          return (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span className="text-text-stark">{e.titel}</span>
              {verknuepft && (
                <Link to={pfadFuer(verknuepft)} className="wikilink text-sm">
                  {verknuepft.name}
                </Link>
              )}
              <button
                className="ml-auto text-text-schwach hover:text-rot"
                onClick={() => loeschen(e.id)}
                aria-label={`Ereignis „${e.titel}“ löschen`}
              >
                <Trash2 size={13} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-40 flex-1 rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm"
          placeholder="Neues Ereignis, z. B. „Kerzenfest in Nebelfurt“"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hinzufuegen()}
        />
        <select
          className="rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm text-text-normal"
          value={entitaetId}
          onChange={(e) => setEntitaetId(e.target.value)}
          aria-label="Ereignis mit Entität verknüpfen"
        >
          <option value="">– keine Verknüpfung –</option>
          {[...entitaeten]
            .sort((a, b) => a.name.localeCompare(b.name, 'de'))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
        <button
          className="flex items-center gap-1 rounded bg-blut px-2.5 py-1.5 text-sm font-medium text-white hover:bg-blut-hell"
          onClick={hinzufuegen}
        >
          <Plus size={14} /> Eintragen
        </button>
      </div>
    </div>
  );
}

/** Editor für Ära und Monatsliste; das aktuelle Datum wird ggf. geklemmt. */
function Einstellungen({
  kalender,
  speichere,
}: {
  kalender: Kalender;
  speichere: (neu: Kalender) => void;
}) {
  const monateAendern = (monate: Kalender['monate']) => {
    if (monate.length === 0) return;
    const neu = { ...kalender, monate };
    speichere({ ...neu, aktuell: klemmeDatum(neu, kalender.aktuell) });
  };

  return (
    <div className="karte karte-ornament mb-5 p-4">
      <label className="mb-3 flex max-w-60 flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-text-schwach">
          Ära / Jahreszählung (optional)
        </span>
        <input
          className="rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
          value={kalender.aera}
          placeholder="z. B. „BC“"
          onChange={(e) => speichere({ ...kalender, aera: e.target.value })}
        />
      </label>
      <h3 className="mb-2 text-xs uppercase tracking-wider text-text-schwach">Monate</h3>
      {kalender.monate.map((monat, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-2">
          <span className="w-5 shrink-0 text-right font-display text-xs text-gold">{i + 1}</span>
          <input
            className="flex-1 rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
            value={monat.name}
            onChange={(e) =>
              monateAendern(
                kalender.monate.map((m, j) => (j === i ? { ...m, name: e.target.value } : m)),
              )
            }
            aria-label={`Name Monat ${i + 1}`}
          />
          <input
            type="number"
            min={1}
            max={999}
            className="w-20 rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
            value={monat.tage}
            onChange={(e) =>
              monateAendern(
                kalender.monate.map((m, j) =>
                  j === i ? { ...m, tage: Math.max(1, Number(e.target.value)) } : m,
                ),
              )
            }
            aria-label={`Tage Monat ${i + 1}`}
          />
          <button
            className="text-text-schwach hover:text-rot disabled:opacity-30"
            disabled={kalender.monate.length <= 1}
            onClick={() => monateAendern(kalender.monate.filter((_, j) => j !== i))}
            aria-label={`Monat ${i + 1} entfernen`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        className="mt-1 rounded border border-rand px-2.5 py-1 text-xs text-text-schwach hover:text-gold"
        onClick={() =>
          monateAendern([
            ...kalender.monate,
            { name: `${kalender.monate.length + 1}. Monat`, tage: 30 },
          ])
        }
      >
        + Monat
      </button>
    </div>
  );
}
