/**
 * Leichtgewichtige Mehrsprachigkeit ohne Zusatzabhängigkeit.
 *
 * Prinzip: Deutsch ist die Quellsprache. Übersetzbare Texte stehen als
 * deutscher Originaltext im Code und laufen durch t(); pro weiterer
 * Sprache gibt es ein Wörterbuch „deutscher Text → Übersetzung“ (en.ts).
 * Fehlende Einträge fallen sichtbar auf Deutsch zurück – so bricht eine
 * unvollständige Übersetzung nie die UI.
 *
 * Wichtige Invariante: Gespeicherte Daten bleiben sprachneutral.
 * JSON-Schlüssel (ortId, geheimnisseDm, …) und Enum-Werte (status
 * "lebendig", haltung "verbündet", …) sind stabile Bezeichner und werden
 * ausschließlich für die ANZEIGE übersetzt – nie beim Speichern.
 *
 * Neue Sprache hinzufügen:
 *  1. Wörterbuch-Datei anlegen (Kopie von en.ts, Werte übersetzen)
 *  2. in SPRACHEN und WOERTERBUECHER registrieren
 *  Der Sprachumschalter in der Sidebar zeigt sie automatisch an.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { en } from './en';

export const SPRACHEN = [
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'en', name: 'English', locale: 'en-US' },
] as const;

export type Sprache = (typeof SPRACHEN)[number]['code'];

/** Wörterbücher aller Nicht-Quellsprachen (Deutsch braucht keines). */
const WOERTERBUECHER: Partial<Record<Sprache, Record<string, string>>> = { en };

const SPRACHE_STORAGE_KEY = 'sprache';

export type UebersetzenFn = (text: string, params?: Record<string, string | number>) => string;

/**
 * Übersetzt einen deutschen Quelltext in die Zielsprache und ersetzt
 * {platzhalter} durch die übergebenen Parameter.
 */
export function uebersetze(
  sprache: Sprache,
  text: string,
  params?: Record<string, string | number>,
): string {
  const roh = sprache === 'de' ? text : (WOERTERBUECHER[sprache]?.[text] ?? text);
  if (!params) return roh;
  return roh.replace(/\{(\w+)\}/g, (treffer, name: string) =>
    name in params ? String(params[name]) : treffer,
  );
}

function startSprache(): Sprache {
  const gespeichert = localStorage.getItem(SPRACHE_STORAGE_KEY);
  if (SPRACHEN.some((s) => s.code === gespeichert)) return gespeichert as Sprache;
  // Erste Nutzung: Browser-Sprache respektieren, sonst Deutsch.
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

interface I18nWert {
  sprache: Sprache;
  /** BCP-47-Locale der aktiven Sprache (für Datumsformate & Sortierung). */
  locale: string;
  setzeSprache: (sprache: Sprache) => void;
  t: UebersetzenFn;
}

const I18nContext = createContext<I18nWert | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [sprache, setSprache] = useState<Sprache>(startSprache);

  useEffect(() => {
    localStorage.setItem(SPRACHE_STORAGE_KEY, sprache);
    document.documentElement.lang = sprache;
  }, [sprache]);

  const t = useCallback<UebersetzenFn>(
    (text, params) => uebersetze(sprache, text, params),
    [sprache],
  );

  const wert: I18nWert = {
    sprache,
    locale: SPRACHEN.find((s) => s.code === sprache)!.locale,
    setzeSprache: setSprache,
    t,
  };

  return <I18nContext.Provider value={wert}>{children}</I18nContext.Provider>;
}

/** Zugriff auf Sprache und Übersetzungsfunktion; wirft außerhalb des Providers. */
export function useI18n(): I18nWert {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n muss innerhalb von <I18nProvider> verwendet werden');
  return i18n;
}
