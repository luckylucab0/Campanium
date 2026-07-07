// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Login-/Registrierungs-Bildschirm des SaaS-Modus. Wird nur angezeigt, wenn
 * der Server Login-Pflicht meldet und niemand angemeldet ist.
 */
import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Astrolab } from '../komponenten/Ornament';

export function Anmeldung() {
  const { anmelden, registrieren } = useAuth();
  const { t } = useI18n();
  const [modus, setModus] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const absenden = async () => {
    if (!email.trim() || !passwort) return;
    setFehler(null);
    setLaeuft(true);
    try {
      if (modus === 'login') await anmelden(email.trim(), passwort);
      else await registrieren(email.trim(), passwort);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Anmeldung fehlgeschlagen'));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Astrolab size={44} className="mb-4 text-gold" />
      <h1 className="mb-1 text-2xl">
        {modus === 'login' ? t('Bei Campanium anmelden') : t('Konto erstellen')}
      </h1>
      <p className="mb-6 max-w-md text-center text-sm text-text-schwach">
        {t('Deine Kampagnen sind privat und nur mit deinem Konto zugänglich.')}
      </p>

      <div className="karte karte-ornament w-full max-w-md p-5">
        <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
          {t('E-Mail')}
        </label>
        <input
          autoFocus
          type="email"
          autoComplete="email"
          className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void absenden()}
        />
        <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
          {modus === 'login' ? t('Passwort') : t('Passwort (mind. 8 Zeichen)')}
        </label>
        <input
          type="password"
          autoComplete={modus === 'login' ? 'current-password' : 'new-password'}
          className="mb-4 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void absenden()}
        />
        {fehler && <p className="mb-3 text-sm text-rot">{fehler}</p>}
        <button
          className="w-full rounded bg-blut px-3 py-2 text-sm font-medium text-white hover:bg-blut-hell disabled:opacity-60"
          disabled={laeuft}
          onClick={() => void absenden()}
        >
          {modus === 'login' ? t('Anmelden') : t('Registrieren')}
        </button>
        <button
          className="mt-3 w-full text-center text-xs text-text-schwach hover:text-gold"
          onClick={() => {
            setModus((m) => (m === 'login' ? 'register' : 'login'));
            setFehler(null);
          }}
        >
          {modus === 'login'
            ? t('Noch kein Konto? Jetzt registrieren')
            : t('Bereits ein Konto? Anmelden')}
        </button>
      </div>
    </div>
  );
}
