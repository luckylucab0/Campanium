/**
 * App-Wurzel: Router, Provider und Ladezustand.
 * HashRouter statt BrowserRouter, damit der statische Spieler-Build auf
 * GitHub Pages ohne Server-Rewrites funktioniert.
 */
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IST_SPIELER_MODUS } from './api';
import { useStore, StoreProvider } from './store';
import { Layout } from './komponenten/Layout';
import { UiProvider } from './komponenten/UiContext';
import { Fledermaus } from './komponenten/Ornament';
import { Dashboard } from './seiten/Dashboard';
import { EntityDetailSeite } from './seiten/EntityDetailSeite';
import { EntityFormSeite } from './seiten/EntityFormSeite';
import { EntityListeSeite } from './seiten/EntityListeSeite';
import { SessionTimelineSeite } from './seiten/SessionTimelineSeite';
import { SpielabendSeite } from './seiten/SpielabendSeite';
import { StrahdSeite } from './seiten/StrahdSeite';
import { TarokkaSeite } from './seiten/TarokkaSeite';

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <UiProvider>
          <Inhalt />
        </UiProvider>
      </StoreProvider>
    </HashRouter>
  );
}

function Inhalt() {
  const { geladen, ladeFehler } = useStore();

  if (ladeFehler) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <Fledermaus size={36} className="text-blut-hell" />
        <h1 className="text-xl">Daten konnten nicht geladen werden</h1>
        <p className="max-w-md text-sm text-text-schwach">
          {ladeFehler}
          {!IST_SPIELER_MODUS && ' – läuft der Server? (npm run dev startet beides)'}
        </p>
      </div>
    );
  }

  if (!geladen) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-serif text-lg italic text-text-schwach">Die Nebel lichten sich …</p>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* Sessions haben eine eigene Timeline statt der generischen Liste. */}
        <Route path="/sessions" element={<SessionTimelineSeite />} />
        {!IST_SPIELER_MODUS && (
          <>
            <Route path="/spielabend" element={<SpielabendSeite />} />
            <Route path="/strahd" element={<StrahdSeite />} />
            <Route path="/tarokka" element={<TarokkaSeite />} />
            <Route path="/:route/:id/bearbeiten" element={<EntityFormSeite />} />
          </>
        )}
        <Route path="/:route" element={<EntityListeSeite />} />
        <Route path="/:route/:id" element={<EntityDetailSeite />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
