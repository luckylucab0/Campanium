// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/** Tests für die Slug-Erzeugung (IDs & Dateinamen). */
import { describe, expect, it } from 'vitest';
import { eindeutigerSlug, slugify } from './slug';

describe('slugify', () => {
  it('erzeugt sprechende Slugs', () => {
    expect(slugify('Gregor der Kerzenmacher')).toBe('gregor-der-kerzenmacher');
  });

  it('transliteriert Umlaute und ß', () => {
    expect(slugify('Mühle über dem Fluss, größer')).toBe('muehle-ueber-dem-fluss-groesser');
  });

  it('entfernt Diakritika und Sonderzeichen', () => {
    expect(slugify('Café "Énigme" #7')).toBe('cafe-enigme-7');
  });

  it('fällt bei leerem Ergebnis auf "eintrag" zurück', () => {
    expect(slugify('???')).toBe('eintrag');
  });
});

describe('eindeutigerSlug', () => {
  it('hängt bei Kollisionen einen Zähler an', () => {
    const ids = new Set(['mara', 'mara-2']);
    expect(eindeutigerSlug('Mara', ids)).toBe('mara-3');
    expect(eindeutigerSlug('Neu', ids)).toBe('neu');
  });
});
