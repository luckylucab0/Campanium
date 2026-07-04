/**
 * UI-Context: globaler „Neu anlegen“-Dialog (auch von kaputten Wikilinks
 * aus erreichbar) und das Theme (dunkel ⇄ pergament, in localStorage).
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ENTITY_TYPEN, entityConfigs, type EntityTyp } from '@campanium/shared';
import { IST_SPIELER_MODUS } from '../api';
import { useI18n } from '../i18n';
import { useStore } from '../store';

type Theme = 'dunkel' | 'pergament';

interface UiWert {
  /** Öffnet den Dialog zum Anlegen einer Entität, optional mit Namen vorbefüllt. */
  oeffneNeuDialog: (name?: string, typ?: EntityTyp) => void;
  theme: Theme;
  wechsleTheme: () => void;
}

const UiContext = createContext<UiWert | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<{ name: string; typ: EntityTyp } | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'dunkel',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const oeffneNeuDialog = useCallback((name = '', typ: EntityTyp = 'nsc') => {
    if (IST_SPIELER_MODUS) return; // Spieler-Build ist read-only
    setDialog({ name, typ });
  }, []);

  const wechsleTheme = useCallback(
    () => setTheme((t) => (t === 'dunkel' ? 'pergament' : 'dunkel')),
    [],
  );

  return (
    <UiContext.Provider value={{ oeffneNeuDialog, theme, wechsleTheme }}>
      {children}
      {dialog && <NeuDialog initial={dialog} schliessen={() => setDialog(null)} />}
    </UiContext.Provider>
  );
}

export function useUi(): UiWert {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi muss innerhalb von <UiProvider> verwendet werden');
  return ui;
}

/** Modaler Dialog: Typ wählen, Name eingeben, anlegen → direkt zum Bearbeiten. */
function NeuDialog({
  initial,
  schliessen,
}: {
  initial: { name: string; typ: EntityTyp };
  schliessen: () => void;
}) {
  const { erstellen } = useStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState(initial.name);
  const [typ, setTyp] = useState<EntityTyp>(initial.typ);
  const [fehler, setFehler] = useState<string | null>(null);

  const anlegen = async () => {
    if (!name.trim()) return;
    try {
      const neu = await erstellen(typ, { name: name.trim() });
      schliessen();
      navigate(`/${entityConfigs[typ].route}/${neu.id}/bearbeiten`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Unbekannter Fehler'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 pt-[20vh]"
      onClick={schliessen}
      role="dialog"
      aria-modal="true"
      aria-label={t('Neue Entität anlegen')}
    >
      <div
        className="karte karte-ornament w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg">{t('Neu anlegen')}</h2>
        <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
          {t('Art')}
        </label>
        <select
          className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
          value={typ}
          onChange={(e) => setTyp(e.target.value as EntityTyp)}
        >
          {ENTITY_TYPEN.map((eintrag) => (
            <option key={eintrag} value={eintrag}>
              {t(entityConfigs[eintrag].label)}
            </option>
          ))}
        </select>
        <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
          {t('Name')}
        </label>
        <input
          autoFocus
          className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void anlegen();
            if (e.key === 'Escape') schliessen();
          }}
        />
        {fehler && <p className="mb-3 text-sm text-rot">{fehler}</p>}
        <div className="flex justify-end gap-2">
          <button
            className="rounded border border-rand px-3 py-1.5 text-sm hover:bg-flaeche-3"
            onClick={schliessen}
          >
            {t('Abbrechen')}
          </button>
          <button
            className="rounded bg-blut px-3 py-1.5 text-sm font-medium text-white hover:bg-blut-hell"
            onClick={() => void anlegen()}
          >
            {t('Anlegen')}
          </button>
        </div>
      </div>
    </div>
  );
}
