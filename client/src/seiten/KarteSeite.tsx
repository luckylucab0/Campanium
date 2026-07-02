/**
 * Detailseite einer interaktiven Karte: zeigt die Kartengrafik mit
 * Pin-Overlay. Pins verlinken auf Orte (Farbe: besucht = gold,
 * unbesucht = rot, freier Marker = grau).
 *
 * DM-Modus: „Pins bearbeiten“ aktiviert den Editor – Klick auf die Karte
 * setzt einen Pin (Position in Prozent, bleibt also bei jeder Bildgröße
 * stabil), Klick auf einen Pin öffnet ihn zum Verknüpfen/Beschriften/
 * Löschen. Jede Änderung wird sofort gespeichert.
 * Spieler-Modus: reine Ansicht, Pin-Klick navigiert zum Ort.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin, Pencil, X } from 'lucide-react';
import type { Karte, KartenPin, Ort } from '@campanium/shared';
import { bildUrl, IST_SPIELER_MODUS } from '../api';
import { pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { DmBadge } from '../komponenten/Badge';
import { Markdown } from '../komponenten/Markdown';

export function KarteSeite() {
  const { id = '' } = useParams();
  const { perId } = useStore();
  const entitaet = perId(id);
  if (!entitaet || entitaet.typ !== 'karte') {
    return <p className="text-text-schwach">Karte nicht gefunden.</p>;
  }
  return <KartenAnsicht karte={entitaet} />;
}

function KartenAnsicht({ karte }: { karte: Karte }) {
  const { kampagne, perId, entitaeten, aktualisieren } = useStore();
  const navigate = useNavigate();
  const bildRef = useRef<HTMLDivElement>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  /** ID des gerade im Editor geöffneten Pins. */
  const [offenerPin, setOffenerPin] = useState<string | null>(null);

  const orte = entitaeten
    .filter((e): e is Ort => e.typ === 'ort')
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const speicherePins = (pins: KartenPin[]) => {
    void aktualisieren('karte', karte.id, { pins });
  };

  /** Klick auf die Kartenfläche: im Editor-Modus neuen Pin setzen. */
  const kartenKlick = (e: React.MouseEvent) => {
    if (!bearbeiten || !bildRef.current) return;
    const rect = bildRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const neu: KartenPin = {
      id: `pin-${Date.now().toString(36)}`,
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
      ortId: null,
      beschriftung: '',
    };
    speicherePins([...karte.pins, neu]);
    setOffenerPin(neu.id);
  };

  const pinAendern = (pinId: string, aenderung: Partial<KartenPin>) => {
    speicherePins(karte.pins.map((p) => (p.id === pinId ? { ...p, ...aenderung } : p)));
  };

  const pinLoeschen = (pinId: string) => {
    speicherePins(karte.pins.filter((p) => p.id !== pinId));
    setOffenerPin(null);
  };

  const pinFarbe = (pin: KartenPin): string => {
    const ort = pin.ortId ? perId(pin.ortId) : undefined;
    if (!ort || ort.typ !== 'ort') return 'text-text-schwach';
    return ort.besucht ? 'text-gold' : 'text-blut-hell';
  };

  const pinTitel = (pin: KartenPin): string => {
    const ort = pin.ortId ? perId(pin.ortId) : undefined;
    return pin.beschriftung || ort?.name || 'Pin';
  };

  const bearbeiteterPin = karte.pins.find((p) => p.id === offenerPin);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Kopf */}
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-text-schwach">
        <MapPin size={13} aria-hidden /> Karte {karte.dmOnly && <DmBadge />}
      </div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl">{karte.name}</h1>
        {!IST_SPIELER_MODUS && (
          <div className="flex gap-2">
            <button
              className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm ${
                bearbeiten
                  ? 'border-gold bg-flaeche-3 text-gold'
                  : 'border-rand text-text-normal hover:border-gold hover:text-gold'
              }`}
              onClick={() => {
                setBearbeiten((b) => !b);
                setOffenerPin(null);
              }}
              aria-pressed={bearbeiten}
            >
              <MapPin size={14} /> {bearbeiten ? 'Fertig' : 'Pins bearbeiten'}
            </button>
            <Link
              to={`/karten/${karte.id}/bearbeiten`}
              className="flex items-center gap-1.5 rounded border border-rand px-3 py-1.5 text-sm text-text-normal hover:border-gold hover:text-gold"
            >
              <Pencil size={14} /> Bearbeiten
            </Link>
          </div>
        )}
      </div>

      {!karte.bild || !kampagne ? (
        <div className="karte flex flex-col items-center gap-2 py-16 text-text-schwach">
          <MapPin size={32} className="text-rand-stark" />
          <p>Noch keine Kartengrafik.</p>
          {!IST_SPIELER_MODUS && (
            <p className="text-sm">
              Über <em>Bearbeiten</em> ein Bild hochladen, dann hier Pins setzen.
            </p>
          )}
        </div>
      ) : (
        <>
          {bearbeiten && (
            <p className="mb-2 text-sm text-gold">
              Klick auf die Karte setzt einen Pin · Klick auf einen Pin öffnet ihn.
            </p>
          )}
          <div
            ref={bildRef}
            className={`relative overflow-hidden rounded border border-rand ${
              bearbeiten ? 'cursor-crosshair' : ''
            }`}
            onClick={kartenKlick}
          >
            <img
              src={bildUrl(kampagne.id, karte.bild)}
              alt={`Karte: ${karte.name}`}
              className="block w-full select-none"
              draggable={false}
            />
            {karte.pins.map((pin) => (
              <button
                key={pin.id}
                className={`absolute -translate-x-1/2 -translate-y-full drop-shadow-md transition-transform hover:scale-125 ${pinFarbe(pin)} ${
                  offenerPin === pin.id ? 'scale-125' : ''
                }`}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                title={pinTitel(pin)}
                aria-label={pinTitel(pin)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (bearbeiten) {
                    setOffenerPin(offenerPin === pin.id ? null : pin.id);
                  } else if (pin.ortId) {
                    const ziel = perId(pin.ortId);
                    if (ziel) navigate(pfadFuer(ziel));
                  }
                }}
              >
                <MapPin size={26} fill="currentColor" strokeWidth={1.5} aria-hidden />
              </button>
            ))}
          </div>

          {/* Pin-Editor */}
          {bearbeiten && bearbeiteterPin && (
            <div className="karte karte-ornament mt-3 flex flex-wrap items-end gap-3 p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wider text-text-schwach">
                  Verknüpfter Ort
                </span>
                <select
                  className="rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
                  value={bearbeiteterPin.ortId ?? ''}
                  onChange={(e) => pinAendern(bearbeiteterPin.id, { ortId: e.target.value || null })}
                >
                  <option value="">– freier Marker –</option>
                  {orte.map((ort) => (
                    <option key={ort.id} value={ort.id}>
                      {ort.name} {ort.besucht ? '' : '(unbesucht)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wider text-text-schwach">
                  Beschriftung (optional)
                </span>
                <input
                  className="rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
                  value={bearbeiteterPin.beschriftung}
                  placeholder="sonst wird der Ortsname angezeigt"
                  onChange={(e) => pinAendern(bearbeiteterPin.id, { beschriftung: e.target.value })}
                />
              </label>
              <button
                className="rounded border border-rot/40 px-3 py-1.5 text-sm text-rot hover:bg-rot-flaeche"
                onClick={() => pinLoeschen(bearbeiteterPin.id)}
              >
                Pin löschen
              </button>
              <button
                className="rounded border border-rand p-1.5 text-text-schwach hover:text-text-stark"
                onClick={() => setOffenerPin(null)}
                aria-label="Pin-Editor schließen"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Legende: alle verknüpften Pins als Linkliste (auch für Spieler). */}
          {karte.pins.some((p) => p.ortId) && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {karte.pins
                .filter((p) => p.ortId)
                .map((pin) => {
                  const ort = perId(pin.ortId!);
                  if (!ort) return null;
                  return (
                    <li key={pin.id}>
                      <Link
                        to={pfadFuer(ort)}
                        className="karte inline-flex items-center gap-1.5 px-2.5 py-1 text-sm text-text-normal hover:border-gold hover:text-gold"
                      >
                        <MapPin size={12} className={pinFarbe(pin)} aria-hidden />
                        {pin.beschriftung || ort.name}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          )}
        </>
      )}

      {karte.beschreibung.trim() && (
        <section className="mt-6">
          <h2 className="mb-1.5 text-sm uppercase tracking-wider text-text-schwach">
            Beschreibung / Legende
          </h2>
          <Markdown text={karte.beschreibung} />
        </section>
      )}
    </div>
  );
}
