/**
 * Markdown-Editor mit [[-Autocomplete und Live-Vorschau.
 *
 * Autocomplete-Logik: Tippt man "[[", öffnet sich unter dem Editor eine
 * Vorschlagsliste (Fuzzy-Suche über alle Entitätsnamen). Pfeiltasten/Enter
 * übernehmen den Treffer und schließen die Klammern automatisch.
 */
import { useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { entityConfigs, fuzzyFilter } from '@campanium/shared';
import { useStore } from '../store';
import { Markdown } from './Markdown';

interface Props {
  wert: string;
  onChange: (wert: string) => void;
  zeilen?: number;
  placeholder?: string;
  id?: string;
}

/** Findet eine offene "[["-Eingabe unmittelbar vor der Cursor-Position. */
function offeneKlammer(text: string, cursor: number): { start: number; suche: string } | null {
  const davor = text.slice(0, cursor);
  const start = davor.lastIndexOf('[[');
  if (start === -1) return null;
  const dazwischen = davor.slice(start + 2);
  // Abbrechen, wenn die Klammer bereits geschlossen wurde oder ein Umbruch folgt.
  if (dazwischen.includes(']]') || dazwischen.includes('\n')) return null;
  return { start, suche: dazwischen };
}

export function MarkdownEditor({ wert, onChange, zeilen = 6, placeholder, id }: Props) {
  const { entitaeten } = useStore();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [vorschauAn, setVorschauAn] = useState(false);
  const [autocomplete, setAutocomplete] = useState<{ start: number; suche: string } | null>(null);
  const [auswahl, setAuswahl] = useState(0);

  const vorschlaege = useMemo(() => {
    if (!autocomplete) return [];
    const liste = autocomplete.suche
      ? fuzzyFilter(autocomplete.suche, entitaeten, (e) => e.name)
      : entitaeten;
    return liste.slice(0, 8);
  }, [autocomplete, entitaeten]);

  const aktualisiereAutocomplete = () => {
    const el = textarea.current;
    if (!el) return;
    setAutocomplete(offeneKlammer(el.value, el.selectionStart));
    setAuswahl(0);
  };

  const uebernehmen = (name: string) => {
    const el = textarea.current;
    if (!el || !autocomplete) return;
    const cursor = el.selectionStart;
    const neu = wert.slice(0, autocomplete.start) + `[[${name}]]` + wert.slice(cursor);
    onChange(neu);
    setAutocomplete(null);
    // Cursor hinter den eingefügten Link setzen (nach dem React-Rerender).
    const ziel = autocomplete.start + name.length + 4;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ziel, ziel);
    });
  };

  return (
    <div className="relative">
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-text-schwach hover:text-gold"
          onClick={() => setVorschauAn((v) => !v)}
          aria-pressed={vorschauAn}
        >
          {vorschauAn ? <EyeOff size={13} /> : <Eye size={13} />}
          {vorschauAn ? 'Vorschau aus' : 'Vorschau'}
        </button>
      </div>
      <div className={vorschauAn ? 'grid gap-3 lg:grid-cols-2' : ''}>
        <textarea
          ref={textarea}
          id={id}
          className="w-full resize-y rounded border border-rand bg-flaeche-3 px-3 py-2 font-mono text-sm leading-relaxed text-text-stark placeholder:text-text-schwach/60"
          rows={zeilen}
          value={wert}
          placeholder={placeholder ?? 'Markdown … [[Name]] verlinkt eine Entität'}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onKeyUp={aktualisiereAutocomplete}
          onClick={aktualisiereAutocomplete}
          onKeyDown={(e) => {
            if (!autocomplete || vorschlaege.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAuswahl((a) => (a + 1) % vorschlaege.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAuswahl((a) => (a - 1 + vorschlaege.length) % vorschlaege.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              const v = vorschlaege[auswahl];
              if (v) uebernehmen(v.name);
            } else if (e.key === 'Escape') {
              setAutocomplete(null);
            }
          }}
          onBlur={() => setTimeout(() => setAutocomplete(null), 150)}
        />
        {vorschauAn && (
          <div className="karte min-h-20 overflow-auto px-3 py-2">
            <Markdown text={wert} />
          </div>
        )}
      </div>
      {autocomplete && vorschlaege.length > 0 && (
        <ul
          className="karte absolute z-40 mt-1 max-h-64 w-72 overflow-auto py-1 shadow-xl"
          role="listbox"
        >
          {vorschlaege.map((e, i) => (
            <li key={e.id} role="option" aria-selected={i === auswahl}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  i === auswahl ? 'bg-flaeche-3 text-gold-hell' : 'text-text-normal'
                }`}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  uebernehmen(e.name);
                }}
              >
                <span>{e.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-text-schwach">
                  {entityConfigs[e.typ].label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
