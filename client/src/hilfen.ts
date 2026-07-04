/**
 * Kleine UI-Hilfsfunktionen: Routen-Pfade, Datumsformatierung und die
 * Farbzuordnung für Status-/Haltungs-Badges.
 */
import type { Entitaet } from '@campanium/shared';
import { entityConfigs } from '@campanium/shared';

/** Detailseiten-Pfad einer Entität, z. B. /nscs/gregor-der-kerzenmacher. */
export function pfadFuer(e: Pick<Entitaet, 'typ' | 'id'>): string {
  return `/${entityConfigs[e.typ].route}/${e.id}`;
}

/** Formatiert ein ISO-Datum gemäß Locale (12.06.2026 bzw. 06/12/2026). */
export function formatDatum(iso: string, locale = 'de-DE'): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export type BadgeFarbe = 'gruen' | 'gold' | 'rot' | 'grau' | 'arkan' | 'blut';

/**
 * Farbcodierung für Status- und Haltungswerte:
 * verbündet grün → feindlich rot; tot ausgegraut, untot violett.
 */
export function badgeFarbe(wert: string): BadgeFarbe {
  switch (wert) {
    case 'verbündet':
    case 'erledigt':
    case 'lebendig':
    case 'aktiv':
      return 'gruen';
    case 'freundlich':
    case 'offen':
      return 'gold';
    case 'misstrauisch':
      return 'blut';
    case 'feindlich':
    case 'fehlgeschlagen':
      return 'rot';
    case 'untot':
      return 'arkan';
    case 'tot':
    case 'inaktiv':
    case 'unbekannt':
    default:
      return 'grau';
  }
}
