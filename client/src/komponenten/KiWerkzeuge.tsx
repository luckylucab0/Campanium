// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * KI-Zusatzfunktionen als kleine Einstiegsknöpfe (Phase 3): Sitzungsprep,
 * Charakter-Import, Kartengenerierung. Jeder Knopf regelt sein Gating selbst:
 *  - „aktiv"   – Provider konfiguriert UND Plan reicht → echte Aktion
 *  - „gesperrt" – SaaS, aber Plan zu niedrig → Upgrade-Knopf (öffnet Abo)
 *  - „aus"     – kein Provider konfiguriert (z. B. Self-Host ohne Bild-KI)
 * Im Self-Host-Modus ist erlaubt() immer true; es zählt nur der Provider.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, UserPlus, Wand2, X } from 'lucide-react';
import { entityConfigs, type KiFeature } from '@campanium/shared';
import {
  erzeugeSitzungsprep,
  generiereKarte,
  importiereCharakter,
  ladeBildStatus,
  ladeKiStatus,
} from '../api';
import { useI18n } from '../i18n';
import { usePlan } from '../plan';
import { useStore } from '../store';
import { AboModal } from './Abo';

type GateZustand = 'aktiv' | 'gesperrt' | 'aus';

/** Entscheidet, wie ein KI-Knopf dargestellt wird. */
function useGate(feature: KiFeature, providerAktiv: boolean): GateZustand {
  const { saasModus, erlaubt } = usePlan();
  if (providerAktiv && erlaubt(feature)) return 'aktiv';
  if (saasModus && !erlaubt(feature)) return 'gesperrt';
  return 'aus';
}

/** Gemeinsame Knopf-Optik. */
function KiKnopf({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      className="flex items-center gap-1.5 rounded border border-arkan/50 px-3 py-1.5 text-sm text-arkan hover:bg-arkan-flaeche disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {icon} {children}
    </button>
  );
}

/** Gesperrter Knopf (SaaS, Plan zu niedrig) – öffnet die Abo-Übersicht. */
function GesperrtKnopf({ label }: { label: string }) {
  const [abo, setAbo] = useState(false);
  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded border border-gold/50 px-3 py-1.5 text-sm text-gold hover:bg-gold-flaeche"
        onClick={() => setAbo(true)}
      >
        <Lock size={14} /> {label}
      </button>
      {abo && <AboModal schliessen={() => setAbo(false)} />}
    </>
  );
}

// ---- Sitzungsprep -------------------------------------------------------------

export function KiSitzungsprepKnopf() {
  const { kampagne, neuLaden } = useStore();
  const { t, sprache } = useI18n();
  const [status, setStatus] = useState({ aktiv: false });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    void ladeKiStatus().then((s) => setStatus({ aktiv: s.aktiv }));
  }, []);
  const gate = useGate('ki-erweitert', status.aktiv);

  if (gate === 'aus') return null;
  if (gate === 'gesperrt') return <GesperrtKnopf label={t('KI: Prep')} />;

  const erzeugen = async () => {
    if (!kampagne || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      await erzeugeSitzungsprep(kampagne.id, sprache);
      await neuLaden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Anfrage fehlgeschlagen.'));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <KiKnopf onClick={() => void erzeugen()} disabled={laeuft} icon={<Sparkles size={14} />}>
        {laeuft ? t('erzeugt …') : t('KI: Prep erstellen')}
      </KiKnopf>
      {fehler && <span className="text-xs text-rot">{fehler}</span>}
    </div>
  );
}

// ---- Charakter-Import ---------------------------------------------------------

export function KiCharakterImportKnopf({ typ }: { typ: 'sc' | 'nsc' }) {
  const { kampagne, neuLaden } = useStore();
  const { t, sprache } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ aktiv: false });
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    void ladeKiStatus().then((s) => setStatus({ aktiv: s.aktiv }));
  }, []);
  const gate = useGate('ki-erweitert', status.aktiv);

  if (gate === 'aus') return null;
  if (gate === 'gesperrt') return <GesperrtKnopf label={t('KI: Import')} />;

  const importieren = async () => {
    if (!kampagne || text.trim().length < 10 || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const neu = await importiereCharakter(kampagne.id, typ, text, sprache);
      await neuLaden();
      setOffen(false);
      setText('');
      navigate(`/${entityConfigs[typ].route}/${neu.id}`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Anfrage fehlgeschlagen.'));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <KiKnopf onClick={() => setOffen(true)} icon={<UserPlus size={14} />}>
        {t('KI: Import')}
      </KiKnopf>
      {offen && (
        <div
          className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
          onClick={() => setOffen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('Charakter aus Statblock importieren')}
        >
          <div className="karte karte-ornament w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <UserPlus size={16} className="text-arkan" aria-hidden />
              <h2 className="text-lg">{t('Charakter aus Statblock importieren')}</h2>
              <button
                className="ml-auto text-text-schwach hover:text-text-stark"
                onClick={() => setOffen(false)}
                aria-label={t('Schließen')}
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-2 text-xs text-text-schwach">
              {t('Statblock oder Charakterbogen einfügen – die KI extrahiert Werte und Attribute.')}
            </p>
            <textarea
              autoFocus
              className="h-48 w-full resize-none rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm text-text-stark"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('z. B. „Aria, Elfe Waldläuferin, Stufe 3, AC 15, HP 24, STR 12 DEX 16 …“')}
            />
            {fehler && <p className="mt-2 text-sm text-rot">{fehler}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded border border-rand px-3 py-1.5 text-sm hover:bg-flaeche-3"
                onClick={() => setOffen(false)}
              >
                {t('Abbrechen')}
              </button>
              <KiKnopf
                onClick={() => void importieren()}
                disabled={laeuft || text.trim().length < 10}
                icon={<Sparkles size={14} />}
              >
                {laeuft ? t('importiert …') : t('Importieren')}
              </KiKnopf>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Kartengenerierung --------------------------------------------------------

export function KiKarteKnopf() {
  const { kampagne, neuLaden } = useStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ aktiv: false });
  const [offen, setOffen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    void ladeBildStatus().then(setStatus);
  }, []);
  const gate = useGate('ki-kartengenerierung', status.aktiv);

  if (gate === 'aus') return null;
  if (gate === 'gesperrt') return <GesperrtKnopf label={t('KI: Karte')} />;

  const generieren = async () => {
    if (!kampagne || !prompt.trim() || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const neu = await generiereKarte(kampagne.id, prompt.trim(), name.trim() || prompt.trim().slice(0, 40));
      await neuLaden();
      setOffen(false);
      setPrompt('');
      setName('');
      navigate(`/karten/${neu.id}`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Anfrage fehlgeschlagen.'));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <>
      <KiKnopf onClick={() => setOffen(true)} icon={<Wand2 size={14} />}>
        {t('KI: Karte generieren')}
      </KiKnopf>
      {offen && (
        <div
          className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
          onClick={() => setOffen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('Karte mit KI generieren')}
        >
          <div className="karte karte-ornament w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <Wand2 size={16} className="text-arkan" aria-hidden />
              <h2 className="text-lg">{t('Karte mit KI generieren')}</h2>
              <button
                className="ml-auto text-text-schwach hover:text-text-stark"
                onClick={() => setOffen(false)}
                aria-label={t('Schließen')}
              >
                <X size={18} />
              </button>
            </div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
              {t('Name')}
            </label>
            <input
              className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm text-text-stark"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('z. B. „Hafenstadt Salzhaven“')}
            />
            <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
              {t('Bildbeschreibung')}
            </label>
            <textarea
              className="h-28 w-full resize-none rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-sm text-text-stark"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('z. B. „Vogelperspektive einer nebelverhangenen Küstenstadt, Fantasy-Kartenstil“')}
            />
            {fehler && <p className="mt-2 text-sm text-rot">{fehler}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded border border-rand px-3 py-1.5 text-sm hover:bg-flaeche-3"
                onClick={() => setOffen(false)}
              >
                {t('Abbrechen')}
              </button>
              <KiKnopf
                onClick={() => void generieren()}
                disabled={laeuft || !prompt.trim()}
                icon={<Sparkles size={14} />}
              >
                {laeuft ? t('generiert …') : t('Generieren')}
              </KiKnopf>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
