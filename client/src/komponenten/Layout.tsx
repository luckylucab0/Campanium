/**
 * App-Rahmen: Sidebar-Navigation mit Kampagnen-Umschalter, Kopfzeile mit
 * Nebel-Gradient, Theme-Umschalter und globale Suche. Im Spieler-Modus
 * werden alle DM-Bereiche (Preps, Widersacher, Lesung, Spielabend, „Neu“)
 * und der Kampagnen-Wechsel ausgeblendet.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Castle, Home, Menu, Moon, Plus, Search, Sun, Sparkles, Tent, X } from 'lucide-react';
import { ENTITY_TYPEN, entityConfigs } from '@grimoire/shared';
import { IST_SPIELER_MODUS } from '../api';
import { useStore } from '../store';
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
                Grimoire
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-text-schwach">
                Kampagnen-Companion
              </div>
            </div>
          </NavLink>

          <KampagnenWahl schliesseMenue={() => setMenueOffen(false)} />

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
                <NavLink
                  to="/widersacher"
                  className={navKlasse}
                  onClick={() => setMenueOffen(false)}
                >
                  <Castle size={16} /> Widersacher
                </NavLink>
                <NavLink to="/lesung" className={navKlasse} onClick={() => setMenueOffen(false)}>
                  <Sparkles size={16} /> Lesung
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
          <span className="font-display text-text-stark">Grimoire</span>
        </header>
        <main className="relative mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
      </div>

      {sucheOffen && <SearchPalette schliessen={() => setSucheOffen(false)} />}
    </div>
  );
}

/**
 * Kampagnen-Umschalter in der Sidebar: Dropdown über alle Kampagnen plus
 * „Neue Kampagne …“. Im Spieler-Modus (genau eine Kampagne) nur Anzeige.
 */
function KampagnenWahl({ schliesseMenue }: { schliesseMenue: () => void }) {
  const { kampagnen, kampagne, wechsleKampagne, neueKampagne } = useStore();
  const navigate = useNavigate();
  const [dialogOffen, setDialogOffen] = useState(false);
  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  if (IST_SPIELER_MODUS || !kampagne) {
    return kampagne ? (
      <div className="border-b border-rand px-4 py-2.5 text-sm text-gold-hell">{kampagne.name}</div>
    ) : null;
  }

  const anlegen = async () => {
    if (!name.trim()) return;
    try {
      await neueKampagne(name.trim(), beschreibung.trim());
      setDialogOffen(false);
      setName('');
      setBeschreibung('');
      navigate('/');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen');
    }
  };

  return (
    <div className="border-b border-rand px-2 py-2">
      <label className="px-2 text-[10px] uppercase tracking-[0.2em] text-text-schwach">
        Kampagne
        <select
          className="mt-1 w-full rounded border border-rand bg-flaeche-2 px-2 py-1.5 text-sm normal-case tracking-normal text-gold-hell"
          value={kampagne.id}
          onChange={(e) => {
            if (e.target.value === '__neu') {
              setDialogOffen(true);
            } else {
              // Zurück zum Dashboard: IDs anderer Kampagnen wären auf der
              // aktuellen Detailseite nicht auflösbar.
              wechsleKampagne(e.target.value);
              navigate('/');
              schliesseMenue();
            }
          }}
        >
          {kampagnen.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
          <option value="__neu">＋ Neue Kampagne …</option>
        </select>
      </label>

      {dialogOffen && (
        <div
          className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 pt-[20vh]"
          onClick={() => setDialogOffen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Neue Kampagne anlegen"
        >
          <div
            className="karte karte-ornament w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg">Neue Kampagne</h2>
            <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
              Name
            </label>
            <input
              autoFocus
              className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
              value={name}
              placeholder="z. B. „Sturm über den Salzmarschen“"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void anlegen();
                if (e.key === 'Escape') setDialogOffen(false);
              }}
            />
            <label className="mb-1 block text-xs uppercase tracking-wider text-text-schwach">
              Untertitel (optional)
            </label>
            <input
              className="mb-3 w-full rounded border border-rand bg-flaeche-3 px-2 py-1.5 text-text-stark"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void anlegen()}
            />
            {fehler && <p className="mb-3 text-sm text-rot">{fehler}</p>}
            <div className="flex justify-end gap-2">
              <button
                className="rounded border border-rand px-3 py-1.5 text-sm hover:bg-flaeche-3"
                onClick={() => setDialogOffen(false)}
              >
                Abbrechen
              </button>
              <button
                className="rounded bg-blut px-3 py-1.5 text-sm font-medium text-white hover:bg-blut-hell"
                onClick={() => void anlegen()}
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
