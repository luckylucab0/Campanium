/**
 * Slug-Erzeugung für IDs und Dateinamen.
 * Aus "Gregor der Kerzenmacher" wird "gregor-der-kerzenmacher" –
 * sprechende Dateinamen in data/ sind ein erklärtes Ziel des Tools.
 */

/** Wandelt einen Namen in einen URL-/Dateinamen-tauglichen Slug um. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      // Deutsche Umlaute lesbar transliterieren statt nur Akzente zu strippen.
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      // Restliche Diakritika entfernen (é → e): erst zerlegen, dann Kombinationszeichen strippen.
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'eintrag'
  );
}

/** Erzeugt einen eindeutigen Slug; bei Kollision wird -2, -3, … angehängt. */
export function eindeutigerSlug(name: string, vorhandeneIds: ReadonlySet<string>): string {
  const basis = slugify(name);
  if (!vorhandeneIds.has(basis)) return basis;
  let n = 2;
  while (vorhandeneIds.has(`${basis}-${n}`)) n++;
  return `${basis}-${n}`;
}
