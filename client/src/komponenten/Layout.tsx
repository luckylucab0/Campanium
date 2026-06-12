/**
 * App-Rahmen: Sidebar-Navigation, Kopfzeile mit Nebel-Gradient,
 * Theme-Umschalter und globale Suche. Im Spieler-Modus werden alle
 * DM-Bereiche (Preps, Strahd, Tarokka, Spielabend, „Neu“) ausgeblendet.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Castle, Home, Menu, Moon, Plus, Search, Sun, Sparkles, Tent, X } from 'lucide-react';
import { ENTITY_TYPEN, entityConfigs } from '@ravenloft/shared';
import { IST_SPIELER_MODUS } from '../api';
import { entityIcon } from './icons';
import { Fledermaus } from './Ornament';
import { SearchPalette } from './SearchPalette';
import { useUi } from './UiContext';

const navKlasse = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors ${
    isActive
      ? 'bg-blut-flaeche text-text-stark border-l-2 border-(--blut)'
      : 'text-text-normal hover:bg-flaeche-3 hover:text-text-stark'
  }`;

export function Layout({ children }: { children: ReactNode }) {
  const { oeffneNeuDialog, theme, wechsleTheme } = useUi();
  const [sucheOffen, setSucheOffen] = useState(false);
  const [menueOffen, setMenueOffen] = useState(false);

  // Cmd/Ctrl+K öffnet die globale Suche.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSucheOffen((s) => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sichtbareTypen = ENTITY_TYPEN.filter(
    (t) => !(IST_SPIELER_MODUS && entityConfigs[t].immerDm),
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 transform border-r border-rand bg-flaeche-1 transition-transform lg:static lg:translate-x-0 ${
          menueOffen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <NavLink
            to="/"
            className="kerze flex items-center gap-2.5 border-b border-rand px-4 py-4"
            onClick={() => setMenueOffen(false)}
          >
            <Fledermaus size={22} className="text-blut-hell" />
            <div>
              <div className="font-display text-base font-semibold tracking-wide text-text-stark">
                Ravenloft
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-text-schwach">
                Companion
              </div>
            </div>
          </NavLink>

          <nav
            className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3"
            aria-label="Hauptnavigation"
          >
            <NavLink to="/" end className={navKlasse} onClick={() => setMenueOffen(false)}>
              <Home size={16} /> Dashboard
            </NavLink>
            {!IST_SPIELER_MODUS && (
              <NavLink to="/spielabend" className={navKlasse} onClick={() => setMenueOffen(false)}>
                <Tent size={16} /> Spielabend
              </NavLink>
            )}

            <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-text-schwach">
              Kompendium
            </div>
            {sichtbareTypen.map((typ) => {
              const config = entityConfigs[typ];
              const Icon = entityIcon(config.icon);
              return (
                <NavLink
                  key={typ}
                  to={`/${config.route}`}
                  className={navKlasse}
                  onClick={() => setMenueOffen(false)}
                >
                  <Icon size={16} /> {config.labelPlural}
                </NavLink>
              );
            })}

            {!IST_SPIELER_MODUS && (
              <>
                <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-text-schwach">
                  DM-Module
                </div>
                <NavLink to="/strahd" className={navKlasse} onClick={() => setMenueOffen(false)}>
                  <Castle size={16} /> Strahd-Tracker
                </NavLink>
                <NavLink to="/tarokka" className={navKlasse} onClick={() => setMenueOffen(false)}>
                  <Sparkles size={16} /> Tarokka-Lesung
                </NavLink>
              </>
            )}
          </nav>

          <div className="space-y-1 border-t border-rand px-2 py-3">
            <button
              className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-sm text-text-normal hover:bg-flaeche-3 hover:text-text-stark"
              onClick={() => setSucheOffen(true)}
            >
              <Search size={16} /> Suche
              <kbd className="ml-auto rounded border border-rand px-1 text-[10px] text-text-schwach">
                ⌘K
              </kbd>
            </button>
            {!IST_SPIELER_MODUS && (
              <button
                className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-sm text-text-normal hover:bg-flaeche-3 hover:text-text-stark"
                onClick={() => oeffneNeuDialog()}
              >
                <Plus size={16} /> Neu anlegen
              </button>
            )}
            <button
              className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-sm text-text-normal hover:bg-flaeche-3 hover:text-text-stark"
              onClick={wechsleTheme}
              aria-label={
                theme === 'dunkel' ? 'Pergament-Theme aktivieren' : 'Dunkles Theme aktivieren'
              }
            >
              {theme === 'dunkel' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dunkel' ? 'Pergament' : 'Dunkel'}
            </button>
            {IST_SPIELER_MODUS && (
              <p className="px-3 pt-1 text-[10px] leading-relaxed text-text-schwach">
                Spieler-Kompendium · read-only
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile-Overlay hinter der Sidebar */}
      {menueOffen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMenueOffen(false)}
          aria-hidden
        />
      )}

      {/* Hauptbereich mit dezentem Nebel-Gradient im Kopf */}
      <div className="min-w-0 flex-1">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-(image:--nebel)"
          aria-hidden
        />
        <header className="flex items-center gap-3 px-4 py-3 lg:hidden">
          <button
            className="rounded border border-rand p-1.5 text-text-normal"
            onClick={() => setMenueOffen(true)}
            aria-label="Menü öffnen"
          >
            {menueOffen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="font-display text-text-stark">Ravenloft Companion</span>
        </header>
        <main className="relative mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
      </div>

      {sucheOffen && <SearchPalette schliessen={() => setSucheOffen(false)} />}
    </div>
  );
}
