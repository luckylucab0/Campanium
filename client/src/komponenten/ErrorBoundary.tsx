// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Fehlergrenze um den Seiteninhalt: Ein Render-Fehler einer einzelnen Seite
 * (z. B. ein kaputter persistierter Datensatz) wird hier aufgefangen und als
 * Meldung angezeigt, statt den kompletten React-Baum weiß auszublenden.
 * In App.tsx per `key={pathname}` umschlossen, sodass ein Seitenwechsel die
 * Grenze automatisch zurücksetzt.
 */
import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n';

/** Sichtbares Fallback – als Funktionskomponente, um useI18n nutzen zu können. */
function FehlerFallback() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <AlertTriangle size={32} className="text-blut-hell" aria-hidden />
      <h1 className="text-xl">{t('Diese Seite ist auf einen Fehler gestoßen.')}</h1>
      <p className="text-sm text-text-schwach">
        {t('Wähle links einen anderen Bereich oder lade die Seite neu.')}
      </p>
      <button
        className="rounded bg-blut px-4 py-2 text-sm font-medium text-white hover:bg-blut-hell"
        onClick={() => window.location.reload()}
      >
        {t('Neu laden')}
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { fehler: boolean }> {
  state = { fehler: false };

  static getDerivedStateFromError(): { fehler: boolean } {
    return { fehler: true };
  }

  componentDidCatch(fehler: Error): void {
    // Für die Diagnose in der Konsole behalten; der Nutzer sieht das Fallback.
    console.error('UI-Fehler abgefangen:', fehler);
  }

  render(): ReactNode {
    return this.state.fehler ? <FehlerFallback /> : this.props.children;
  }
}
