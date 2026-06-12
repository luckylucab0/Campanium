/**
 * Farbcodierte Badges für Status, Haltung & Co. sowie die DM-Markierung.
 */
import { EyeOff } from 'lucide-react';
import { badgeFarbe, type BadgeFarbe } from '../hilfen';

const FARBKLASSEN: Record<BadgeFarbe, string> = {
  gruen: 'bg-gruen-flaeche text-gruen border-gruen/40',
  gold: 'bg-gold-flaeche text-gold-hell border-gold/40',
  rot: 'bg-rot-flaeche text-rot border-rot/40',
  grau: 'bg-grau-flaeche text-text-schwach border-rand',
  arkan: 'bg-arkan-flaeche text-arkan border-arkan/40',
  blut: 'bg-blut-flaeche text-blut-hell border-blut/40',
};

/** Badge mit automatischer Farbwahl anhand des Wertes (Status/Haltung). */
export function Badge({ wert, farbe }: { wert: string; farbe?: BadgeFarbe }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${FARBKLASSEN[farbe ?? badgeFarbe(wert)]}`}
    >
      {wert}
    </span>
  );
}

/** Markierung für DM-only-Inhalte (nur im DM-Modus sichtbar). */
export function DmBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-blut/40 bg-blut-flaeche px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-blut-hell"
      title="Nur für den DM sichtbar – wird im Spieler-Build entfernt"
    >
      <EyeOff size={11} aria-hidden /> DM
    </span>
  );
}
