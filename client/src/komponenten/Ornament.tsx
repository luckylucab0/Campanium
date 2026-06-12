/**
 * Thematische SVG-Akzente: ornamentale Trennlinie, Fledermaus und
 * Burg-Silhouette. Bewusst dezent gehalten – Atmosphäre, kein Clipart.
 */

/** Ornamentale Trennlinie mit Rauten-Mittelstück. */
export function Trennlinie({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-(--rand-stark)" />
      <svg width="14" height="14" viewBox="0 0 14 14" className="text-gold/70">
        <rect x="4" y="4" width="6" height="6" transform="rotate(45 7 7)" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-(--rand-stark)" />
    </div>
  );
}

/** Kleine Fledermaus-Silhouette (Logo-Akzent). */
export function Fledermaus({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 6c-.6 1.4-1.8 2.2-3 2.3C7 8.5 4.5 7.5 1 9c2.2.6 3 1.8 3.4 3.2C5.7 11.6 7 11.8 8 13c.8-1 1.8-1.3 2.6-1.2L12 14l1.4-2.2c.8-.1 1.8.2 2.6 1.2 1-1.2 2.3-1.4 3.6-.8C20 10.8 20.8 9.6 23 9c-3.5-1.5-6-.5-8-.7-1.2-.1-2.4-.9-3-2.3z" />
    </svg>
  );
}

/** Burg-Silhouette für leere Zustände und den Header. */
export function Burg({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden fill="currentColor">
      <path d="M6 42V22l3-2v-6h2v4l3-2V8h2v6l4 3V9h2v3h4V9h2v8l4-3V8h2v8l3 2v4h2v-4l3 2v22H30v-8a6 6 0 0 0-12 0v8H6z" />
    </svg>
  );
}
