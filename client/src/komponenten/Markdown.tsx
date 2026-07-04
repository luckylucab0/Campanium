/**
 * Markdown-Renderer mit Wikilink-Unterstützung.
 *
 * Ablauf (nicht offensichtlich, daher dokumentiert):
 *  1. [[Wikilinks]] werden VOR dem Markdown-Parsen durch <a>-Platzhalter
 *     ersetzt. Auflösbare Links erhalten data-ziel-id, nicht auflösbare
 *     die Klasse "wikilink-kaputt" plus data-ziel-name („Entität anlegen“).
 *  2. marked parst das Markdown (GFM inkl. Task-Listen).
 *  3. DOMPurify entschärft das HTML (Schutz vor versehentlichem HTML in Notizen).
 *  4. Klicks auf Links werden abgefangen: auflösbar → Navigation zur
 *     Detailseite, kaputt → „Neu anlegen“-Dialog mit vorausgefülltem Namen.
 *  5. Hover über auflösbare Links zeigt eine Mini-Vorschau (Typ, Status, Zeile).
 */
import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Entitaet } from '@campanium/shared';
import { entityConfigs, ersetzeWikilinks } from '@campanium/shared';
import { pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { useUi } from './UiContext';
import { Badge } from './Badge';

marked.setOptions({ gfm: true, breaks: true });

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface VorschauZustand {
  entitaet: Entitaet;
  x: number;
  y: number;
}

/** Rendert Markdown-Text inkl. klickbarer [[Wikilinks]] mit Hover-Vorschau. */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const { perName, perId } = useStore();
  const { oeffneNeuDialog } = useUi();
  const navigate = useNavigate();
  const [vorschau, setVorschau] = useState<VorschauZustand | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    // Schritt 1: Wikilinks → <a>-Platzhalter (vor dem Markdown-Parsen,
    // damit marked sie nicht zerlegt; Links in Code-Blöcken werden dabei
    // bewusst in Kauf genommen – Kampagnennotizen enthalten kaum Code).
    const mitLinks = ersetzeWikilinks(text, (treffer) => {
      const ziel = perName(treffer.ziel);
      if (ziel) {
        return `<a class="wikilink" data-ziel-id="${escapeHtml(ziel.id)}" href="#${pfadFuer(ziel)}">${escapeHtml(treffer.anzeige)}</a>`;
      }
      return `<a class="wikilink-kaputt" data-ziel-name="${escapeHtml(treffer.ziel)}" title="Nicht gefunden – klicken zum Anlegen" href="#">${escapeHtml(treffer.anzeige)}</a>`;
    });
    // Schritt 2 + 3: Markdown parsen, dann säubern (data-Attribute bleiben erhalten).
    return DOMPurify.sanitize(marked.parse(mitLinks, { async: false }));
  }, [text, perName]);

  const beiKlick = (ereignis: MouseEvent) => {
    const link = (ereignis.target as HTMLElement).closest('a[data-ziel-id], a[data-ziel-name]');
    if (!link) return;
    ereignis.preventDefault();
    const zielId = link.getAttribute('data-ziel-id');
    const ziel = zielId ? perId(zielId) : undefined;
    if (ziel) {
      navigate(pfadFuer(ziel));
    } else {
      // Kaputter Link: Entität mit diesem Namen anlegen.
      oeffneNeuDialog(link.getAttribute('data-ziel-name') ?? '');
    }
  };

  const beiHover = (ereignis: MouseEvent) => {
    const link = (ereignis.target as HTMLElement).closest('a[data-ziel-id]');
    if (!link) {
      if (vorschau) setVorschau(null);
      return;
    }
    const id = link.getAttribute('data-ziel-id');
    const entitaet = id ? perId(id) : undefined;
    if (!entitaet) return;
    const rect = link.getBoundingClientRect();
    setVorschau({ entitaet, x: rect.left, y: rect.bottom + 6 });
  };

  if (!text.trim()) return null;

  return (
    <div ref={container} className={`md-inhalt ${className}`}>
      <div
        onClick={beiKlick}
        onMouseOver={beiHover}
        onMouseLeave={() => setVorschau(null)}
        // HTML stammt aus marked + DOMPurify (Schritt 2+3) – sicher.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {vorschau && <HoverVorschau {...vorschau} />}
    </div>
  );
}

/** Mini-Karte beim Überfahren eines Wikilinks: Typ, Status, eine Zeile. */
function HoverVorschau({ entitaet, x, y }: VorschauZustand) {
  const config = entityConfigs[entitaet.typ];
  const untertitel = config.untertitelFeld
    ? String((entitaet as unknown as Record<string, unknown>)[config.untertitelFeld] ?? '')
    : '';
  const status = (entitaet as unknown as Record<string, unknown>)['status'];
  const haltung = (entitaet as unknown as Record<string, unknown>)['haltung'];
  return (
    <div
      className="karte karte-ornament fixed! z-50 max-w-xs px-3 py-2 text-sm shadow-xl"
      style={{ left: Math.min(x, window.innerWidth - 320), top: y }}
      role="tooltip"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-text-schwach">
          {config.label}
        </span>
        {typeof status === 'string' && <Badge wert={status} />}
        {typeof haltung === 'string' && <Badge wert={haltung} />}
      </div>
      <div className="font-display text-text-stark">{entitaet.name}</div>
      {untertitel && <div className="mt-0.5 text-text-schwach">{untertitel}</div>}
    </div>
  );
}
