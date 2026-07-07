// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * App-Wurzel: Router, Provider und Ladezustand.
 * HashRouter statt BrowserRouter, damit der statische Spieler-Build auf
 * GitHub Pages ohne Server-Rewrites funktioniert.
 */
import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { IST_SPIELER_MODUS } from './api';
import { I18nProvider, useI18n } from './i18n';
import { useStore, StoreProvider } from './store';
import { ErrorBoundary } from './komponenten/ErrorBoundary';
import { Layout } from './komponenten/Layout';
import { UiProvider } from './komponenten/UiContext';
import { Fledermaus } from './komponenten/Ornament';
import { Dashboard } from './seiten/Dashboard';
import { EntityDetailSeite } from './seiten/EntityDetailSeite';
import { EntityFormSeite } from './seiten/EntityFormSeite';
import { EntityListeSeite } from './seiten/EntityListeSeite';
import { GraphSeite } from './seiten/GraphSeite';
import { KalenderSeite } from './seiten/KalenderSeite';
import { KarteSeite } from './seiten/KarteSeite';
import { LesungSeite } from './seiten/LesungSeite';
import { SessionTimelineSeite } from './seiten/SessionTimelineSeite';
import { SpielabendSeite } from './seiten/SpielabendSeite';
import { WidersacherSeite } from './seiten/WidersacherSeite';

export default function App() {
  return (
    <HashRouter>
      <I18nProvider>
        <StoreProvider>
          <UiProvider>
            <Inhalt />
          </UiProvider>
        </StoreProvider>
      </I18nProvider>
    </HashRouter>
  );
}

function Inhalt() {
  const { geladen, ladeFehler, kampagne } = useStore();
  const { t } = useI18n();
  const location = useLocation();

  if (ladeFehler) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <Fledermaus size={36} className="text-blut-hell" />
        <h1 className="text-xl">{t('Daten konnten nicht geladen werden')}</h1>
        <p className="max-w-md text-sm text-text-schwach">
          {ladeFehler}
          {!IST_SPIELER_MODUS && ` – ${t('läuft der Server? (npm run dev startet beides)')}`}
        </p>
      </div>
    );
  }

  if (!geladen) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-serif text-lg italic text-text-schwach">
          {t('Die Nebel lichten sich …')}
        </p>
      </div>
    );
  }

  // Noch keine Kampagne vorhanden: Willkommens-/Anlegen-Bildschirm.
  if (!kampagne) {
    return <ErsteKampagneAnlegen />;
  }

  return (
    <Layout>
      {/* key={pathname}: ein Seitenwechsel setzt die Fehlergrenze zurück,
          sodass ein Crash auf einer Seite die App nicht dauerhaft blockiert. */}
      <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {/* Sessions haben eine eigene Timeline statt der generischen Liste. */}
          <Route path="/sessions" element={<SessionTimelineSeite />} />
          <Route path="/graph" element={<GraphSeite />} />
          {!IST_SPIELER_MODUS && (
            <>
              <Route path="/spielabend" element={<SpielabendSeite />} />
              <Route path="/widersacher" element={<WidersacherSeite />} />
              <Route path="/lesung" element={<LesungSeite />} />
              <Route path="/kalender" element={<KalenderSeite />} />
              <Route path="/:route/:id/bearbeiten" element={<EntityFormSeite />} />
            </>
          )}
          {/* Karten haben eine eigene Detailseite mit Pin-Overlay. */}
          <Route path="/karten/:id" element={<KarteSeite />} />
          <Route path="/:route" element={<EntityListeSeite />} />
          <Route path="/:route/:id" element={<EntityDetailSeite />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

/** Willkommens-Bildschirm, wenn data/ noch keine Kampagne enthält. */
function ErsteKampagneAnlegen() {
  const { neueKampagne } = useStore();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  const anlegen = async () => {
    if (!name.trim()) return;
    try {
      await neueKampagne(name.trim(), beschreibung.trim());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Anlegen fehlgeschlagen'));
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Fledermaus size={40} className="mb-4 text-blut-hell" />
      <h1 className="mb-1 text-2xl">{t('Willkommen bei Campanium')}</h1>
      <p className="mb-6 max-w-md text-center text-sm text-text-schwach">
        {t(
          'Noch keine Kampagne vorhanden. Lege deine erste an – oder kopiere die Beispieldaten mit',
        )}{' '}
        <code className="rounded bg-flaeche-3 px-1">npm run seed</code>.
      </p>
      <div className="karte karte-ornament w-full max-w-md p-5">
        <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
          {t('Name der Kampagne')}
        </label>
        <input
          autoFocus
          className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
          value={name}
          placeholder={t('z. B. „Curse of Strahd“')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void anlegen()}
        />
        <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
          {t('Untertitel (optional)')}
        </label>
        <input
          className="mb-4 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
          value={beschreibung}
          placeholder={t('z. B. „Die Nebel von Barovia haben euch fest im Griff …“')}
          onChange={(e) => setBeschreibung(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void anlegen()}
        />
        {fehler && <p className="mb-3 text-sm text-rot">{fehler}</p>}
        <button
          className="w-full rounded bg-blut px-3 py-2 text-sm font-medium text-white hover:bg-blut-hell"
          onClick={() => void anlegen()}
        >
          {t('Kampagne anlegen')}
        </button>
      </div>
    </div>
  );
}
