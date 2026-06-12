/**
 * Wikilink-Parser: erkennt `[[Name]]` und `[[Name|Anzeigetext]]` in
 * Markdown-Texten – die Grundlage für Verknüpfungen, Backlinks und
 * Hover-Vorschauen (wie in Obsidian).
 *
 * Bewusst als eigener, kleiner Parser implementiert (statt Remark-Plugin),
 * damit Client, Server-Skripte und Tests dieselbe Logik teilen.
 */

export interface WikilinkTreffer {
  /** Voller Roh-Text inkl. Klammern, z. B. "[[Ireena|die Rote]]". */
  roh: string;
  /** Ziel-Name (vor dem `|`), getrimmt. */
  ziel: string;
  /** Anzeigetext (nach dem `|`) oder der Ziel-Name, falls keiner gesetzt ist. */
  anzeige: string;
  /** Startindex im Quelltext. */
  index: number;
}

// [[Ziel]] oder [[Ziel|Anzeige]] – kein ]] und kein Zeilenumbruch im Inneren.
const WIKILINK_REGEX = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;

/** Findet alle Wikilinks in einem Markdown-Text. */
export function parseWikilinks(text: string): WikilinkTreffer[] {
  const treffer: WikilinkTreffer[] = [];
  for (const m of text.matchAll(WIKILINK_REGEX)) {
    const ziel = (m[1] ?? '').trim();
    if (!ziel) continue;
    treffer.push({
      roh: m[0],
      ziel,
      anzeige: (m[2] ?? '').trim() || ziel,
      index: m.index,
    });
  }
  return treffer;
}

/**
 * Ersetzt alle Wikilinks in einem Text über eine Callback-Funktion.
 * Wird vom Markdown-Renderer genutzt, um Links in HTML/JSX zu verwandeln.
 */
export function ersetzeWikilinks(
  text: string,
  ersetzer: (treffer: WikilinkTreffer) => string,
): string {
  return text.replace(WIKILINK_REGEX, (roh, zielRaw: string, anzeigeRaw: string | undefined, index: number) => {
    const ziel = zielRaw.trim();
    if (!ziel) return roh;
    return ersetzer({ roh, ziel, anzeige: (anzeigeRaw ?? '').trim() || ziel, index });
  });
}

/**
 * Liefert alle eindeutigen Ziel-Namen (kleingeschrieben als Schlüssel),
 * die in den übergebenen Texten verlinkt werden. Basis des Backlink-Index.
 */
export function sammleLinkZiele(texte: string[]): Set<string> {
  const ziele = new Set<string>();
  for (const text of texte) {
    for (const t of parseWikilinks(text)) ziele.add(t.ziel.toLowerCase());
  }
  return ziele;
}
