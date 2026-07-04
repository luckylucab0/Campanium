/**
 * KI-Assistent (optional, nur DM-Modus): schwebender Knopf unten rechts,
 * der einen Chat-Drawer öffnet. Erscheint nur, wenn der Server einen
 * Provider konfiguriert hat (GET /api/ki/status).
 *
 * Jede vom Assistenten durchgeführte Änderung wird als Aktions-Karte mit
 * Link zur Entität angezeigt; danach lädt der Store die Kampagne still
 * neu, damit alle Ansichten den neuen Stand zeigen.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Pencil, Plus, ScrollText, Send, X } from 'lucide-react';
import { entityConfigs } from '@campanium/shared';
import { IST_SPIELER_MODUS, ladeKiStatus, sendeKiChat, type KiAktion, type KiStatus } from '../api';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { Markdown } from './Markdown';

interface ChatNachricht {
  rolle: 'nutzer' | 'assistent';
  text: string;
  aktionen?: KiAktion[];
  fehler?: boolean;
}

export function KiChat() {
  const { kampagne, neuLaden } = useStore();
  const { t, sprache } = useI18n();
  const [status, setStatus] = useState<KiStatus>({ aktiv: false });
  const [offen, setOffen] = useState(false);
  const [nachrichten, setNachrichten] = useState<ChatNachricht[]>([]);
  const [eingabe, setEingabe] = useState('');
  const [laedt, setLaedt] = useState(false);
  const listeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void ladeKiStatus().then(setStatus);
  }, []);

  // Beim Kampagnenwechsel beginnt ein frisches Gespräch.
  useEffect(() => {
    setNachrichten([]);
  }, [kampagne?.id]);

  // Immer ans Ende scrollen, wenn neue Nachrichten kommen.
  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight });
  }, [nachrichten, laedt]);

  if (IST_SPIELER_MODUS || !status.aktiv || !kampagne) return null;

  const senden = async () => {
    const text = eingabe.trim();
    if (!text || laedt) return;
    const verlauf = [...nachrichten, { rolle: 'nutzer' as const, text }];
    setNachrichten(verlauf);
    setEingabe('');
    setLaedt(true);
    try {
      const ergebnis = await sendeKiChat(
        kampagne.id,
        verlauf.filter((n) => !n.fehler).map((n) => ({ rolle: n.rolle, text: n.text })),
        sprache,
      );
      setNachrichten((alt) => [
        ...alt,
        { rolle: 'assistent', text: ergebnis.antwort, aktionen: ergebnis.aktionen },
      ]);
      if (ergebnis.aktionen.length > 0) await neuLaden();
    } catch (fehler) {
      setNachrichten((alt) => [
        ...alt,
        {
          rolle: 'assistent',
          text: fehler instanceof Error ? fehler.message : t('Anfrage fehlgeschlagen.'),
          fehler: true,
        },
      ]);
    } finally {
      setLaedt(false);
    }
  };

  return (
    <>
      {/* Schwebender Öffnen-Knopf */}
      {!offen && (
        <button
          className="kerze fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-arkan/50 bg-flaeche-2 text-arkan shadow-xl hover:bg-arkan-flaeche"
          onClick={() => setOffen(true)}
          aria-label={t('KI-Assistent öffnen')}
          title={`${t('KI-Assistent')} (${status.provider} / ${status.modell})`}
        >
          <Bot size={22} />
        </button>
      )}

      {/* Chat-Drawer */}
      {offen && (
        <div
          className="karte karte-ornament fixed! bottom-5 right-5 z-40 flex h-[70vh] w-[min(26rem,calc(100vw-2.5rem))] flex-col shadow-2xl"
          role="dialog"
          aria-label={t('KI-Assistent')}
          onKeyDown={(e) => e.key === 'Escape' && setOffen(false)}
        >
          <div className="flex items-center gap-2 border-b border-rand px-3 py-2.5">
            <Bot size={16} className="text-arkan" aria-hidden />
            <span className="font-display text-sm text-text-stark">{t('KI-Assistent')}</span>
            <span className="text-[10px] uppercase tracking-wider text-text-schwach">
              {status.provider}
            </span>
            <button
              className="ml-auto text-text-schwach hover:text-text-stark"
              onClick={() => setOffen(false)}
              aria-label={t('Schließen')}
            >
              <X size={16} />
            </button>
          </div>

          <div ref={listeRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {nachrichten.length === 0 && (
              <p className="text-sm text-text-schwach">
                {t('Erzähl mir, was am Tisch passiert ist – ich pflege es ein. Zum Beispiel:')}{' '}
                <em>
                  {t('„Die Gruppe hat die Kerzen-Quest abgeschlossen und Gregor ist jetzt verbündet.“')}
                </em>
                <br />
                <br />
                {t('Ich kann Einträge anlegen und ändern, aber nichts löschen.')}
              </p>
            )}
            {nachrichten.map((n, i) => (
              <div key={i}>
                <div
                  className={`rounded px-2.5 py-1.5 text-sm ${
                    n.rolle === 'nutzer'
                      ? 'ml-6 bg-flaeche-3 text-text-stark'
                      : n.fehler
                        ? 'mr-6 border border-rot/40 bg-rot-flaeche text-rot'
                        : 'mr-6 bg-arkan-flaeche'
                  }`}
                >
                  {n.rolle === 'assistent' && !n.fehler ? <Markdown text={n.text} /> : n.text}
                </div>
                {n.aktionen && n.aktionen.length > 0 && (
                  <ul className="mr-6 mt-1.5 space-y-1">
                    {n.aktionen.map((aktion, j) => (
                      <li key={j}>
                        <AktionsKarte aktion={aktion} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {laedt && <p className="mr-6 animate-pulse text-sm text-text-schwach">{t('denkt nach …')}</p>}
          </div>

          <div className="flex gap-2 border-t border-rand p-2.5">
            <textarea
              className="max-h-28 flex-1 resize-none rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm text-text-stark placeholder:text-text-schwach/60"
              rows={2}
              placeholder={t('Was ist passiert?')}
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void senden();
                }
              }}
              aria-label={t('Nachricht an den KI-Assistenten')}
            />
            <button
              className="self-end rounded bg-blut p-2 text-white hover:bg-blut-hell disabled:opacity-40"
              onClick={() => void senden()}
              disabled={laedt || !eingabe.trim()}
              aria-label={t('Senden')}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Karte für eine durchgeführte Änderung, verlinkt auf die Entität. */
function AktionsKarte({ aktion }: { aktion: KiAktion }) {
  const Icon =
    aktion.art === 'angelegt' ? Plus : aktion.art === 'Log-Eintrag' ? ScrollText : Pencil;
  const inhalt = (
    <span className="flex items-center gap-1.5">
      <Icon size={12} className="shrink-0 text-gold" aria-hidden />
      {aktion.beschreibung}
    </span>
  );
  if (aktion.entitaetId && aktion.typ) {
    return (
      <Link
        to={`/${entityConfigs[aktion.typ].route}/${aktion.entitaetId}`}
        className="karte block px-2 py-1 text-xs text-text-normal hover:border-gold hover:text-gold"
      >
        {inhalt}
      </Link>
    );
  }
  return <span className="karte block px-2 py-1 text-xs text-text-normal">{inhalt}</span>;
}
