/**
 * Kleine Fuzzy-Suche für die Cmd/Ctrl+K-Palette und das [[-Autocomplete.
 * Bewusst ohne externe Abhängigkeit: Teilstring-Treffer werden bevorzugt,
 * ansonsten zählt eine einfache Subsequenz-Bewertung (alle Suchzeichen
 * müssen in Reihenfolge vorkommen, nah beieinander = besser).
 */

/**
 * Bewertet, wie gut `suche` auf `text` passt.
 * @returns Punktzahl > 0 bei Treffer, 0 bei keinem Treffer. Höher = besser.
 */
export function fuzzyScore(suche: string, text: string): number {
  const s = suche.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!s) return 0;

  // Exakter Teilstring: stark bevorzugt, früher Treffer noch besser.
  const idx = t.indexOf(s);
  if (idx >= 0) {
    let score = 100 - Math.min(idx, 50);
    if (idx === 0) score += 30; // Präfix-Treffer
    return score;
  }

  // Subsequenz: alle Zeichen von s müssen in Reihenfolge in t vorkommen.
  let score = 0;
  let pos = -1;
  let vorherigePos = -1;
  for (const zeichen of s) {
    pos = t.indexOf(zeichen, pos + 1);
    if (pos === -1) return 0;
    // Aufeinanderfolgende Zeichen geben Bonus, große Lücken kosten.
    score += pos === vorherigePos + 1 ? 5 : 1;
    vorherigePos = pos;
  }
  return score;
}

/** Sortiert Einträge nach Fuzzy-Score (beste zuerst) und filtert Nicht-Treffer. */
export function fuzzyFilter<T>(
  suche: string,
  eintraege: readonly T[],
  textVon: (eintrag: T) => string,
): T[] {
  return eintraege
    .map((e) => ({ e, score: fuzzyScore(suche, textVon(e)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}
