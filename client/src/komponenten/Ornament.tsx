// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Thematische SVG-Akzente: Runen-Trennlinie, Astrolab-Logo und
 * Burg-Silhouette. Bewusst dezent gehalten – Atmosphäre, kein Clipart.
 */

/** Runen-Trennlinie (Goldlinie mit ᚦᚱᚨ-Runen) – siehe .rune-trenner in index.css. */
export function Trennlinie({ className = '' }: { className?: string }) {
  return (
    <div className={`rune-trenner ${className}`} aria-hidden>
      <span>ᚦᚱᚨ</span>
    </div>
  );
}

/**
 * Astrolab-Logo: konzentrische Gold-Kreise + gedrehtes Indigo-Quadrat mit
 * Nadel und Indigo-Kern. Gold-/Indigo-Töne folgen den Design-Tokens, sodass
 * das Logo themen-bewusst bleibt. Die className steuert nur die Größe/Marge.
 */
export function Astrolab({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="24" cy="24" r="18" stroke="var(--gold)" strokeWidth="1.3" />
      <circle cx="24" cy="24" r="11.5" stroke="var(--gold)" strokeWidth="0.9" opacity="0.5" />
      <path
        d="M24 6v5M24 37v5M6 24h5M37 24h5"
        stroke="var(--gold)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect
        x="16"
        y="16"
        width="16"
        height="16"
        stroke="var(--arkan)"
        strokeWidth="1.3"
        transform="rotate(45 24 24)"
      />
      <circle cx="24" cy="24" r="2.3" fill="var(--arkan)" />
    </svg>
  );
}

/** Burg-Silhouette für leere Zustände und den Header. */
export function Burg({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M6 42V22l3-2v-6h2v4l3-2V8h2v6l4 3V9h2v3h4V9h2v8l4-3V8h2v8l3 2v4h2v-4l3 2v22H30v-8a6 6 0 0 0-12 0v8H6z" />
    </svg>
  );
}
