/**
 * Editierbare Checkliste (Quest-Fortschritt, Strahd-Ideen-Vorrat).
 * Im read-only Modus (Spieler-Build/Detailseite) nur Anzeige mit Haken.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ChecklistEintrag } from '@grimoire/shared';

interface Props {
  eintraege: ChecklistEintrag[];
  onChange?: (eintraege: ChecklistEintrag[]) => void;
  /** Können neue Einträge angelegt / gelöscht werden? */
  bearbeitbar?: boolean;
}

export function Checkliste({ eintraege, onChange, bearbeitbar = false }: Props) {
  const [neuerText, setNeuerText] = useState('');
  const readOnly = !onChange;

  const umschalten = (index: number) => {
    onChange?.(eintraege.map((e, i) => (i === index ? { ...e, erledigt: !e.erledigt } : e)));
  };

  const hinzufuegen = () => {
    if (!neuerText.trim()) return;
    onChange?.([...eintraege, { text: neuerText.trim(), erledigt: false }]);
    setNeuerText('');
  };

  return (
    <div>
      <ul className="space-y-1">
        {eintraege.map((eintrag, i) => (
          <li key={i} className="group flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-(--blut)"
              checked={eintrag.erledigt}
              disabled={readOnly}
              onChange={() => umschalten(i)}
              id={`check-${i}-${eintrag.text.slice(0, 8)}`}
            />
            <label
              htmlFor={`check-${i}-${eintrag.text.slice(0, 8)}`}
              className={`flex-1 text-sm ${eintrag.erledigt ? 'text-text-schwach line-through' : ''}`}
            >
              {eintrag.text}
            </label>
            {bearbeitbar && onChange && (
              <button
                type="button"
                aria-label={`„${eintrag.text}“ entfernen`}
                className="invisible text-text-schwach hover:text-rot group-hover:visible"
                onClick={() => onChange(eintraege.filter((_, j) => j !== i))}
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {bearbeitbar && onChange && (
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded border border-rand bg-flaeche-3 px-2 py-1 text-sm"
            placeholder="Neuer Punkt …"
            value={neuerText}
            onChange={(e) => setNeuerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                hinzufuegen();
              }
            }}
          />
          <button
            type="button"
            className="rounded border border-rand px-2 text-text-schwach hover:text-gold"
            onClick={hinzufuegen}
            aria-label="Punkt hinzufügen"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
