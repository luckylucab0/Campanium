/**
 * Mappt die Icon-Namen aus der Entitäts-Registry (shared/) auf
 * Lucide-Komponenten. So bleibt shared/ frei von React-Abhängigkeiten.
 */
import {
  BookOpen,
  ClipboardList,
  Flag,
  Gem,
  Map,
  MapPin,
  Scroll,
  StickyNote,
  Swords,
  Users,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Users,
  Scroll,
  Map,
  MapPin,
  Swords,
  BookOpen,
  ClipboardList,
  Gem,
  Flag,
  StickyNote,
};

/** Liefert die Icon-Komponente zu einem Registry-Namen (Fallback: Notiz). */
export function entityIcon(name: string): LucideIcon {
  return ICONS[name] ?? StickyNote;
}
