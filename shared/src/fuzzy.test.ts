// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/** Tests für die Fuzzy-Suche der Cmd/Ctrl+K-Palette. */
import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyScore } from './fuzzy';

describe('fuzzyScore', () => {
  it('bewertet Präfix-Treffer am höchsten', () => {
    const praefix = fuzzyScore('greg', 'Gregor der Kerzenmacher');
    const mitte = fuzzyScore('kerzen', 'Gregor der Kerzenmacher');
    const subsequenz = fuzzyScore('gkm', 'Gregor der Kerzenmacher');
    expect(praefix).toBeGreaterThan(mitte);
    expect(mitte).toBeGreaterThan(subsequenz);
    expect(subsequenz).toBeGreaterThan(0);
  });

  it('ist unabhängig von Groß-/Kleinschreibung', () => {
    expect(fuzzyScore('MARA', 'mara wachsherz')).toBeGreaterThan(0);
  });

  it('liefert 0 ohne Treffer oder bei leerer Suche', () => {
    expect(fuzzyScore('xyz', 'Mara')).toBe(0);
    expect(fuzzyScore('', 'Mara')).toBe(0);
  });
});

describe('fuzzyFilter', () => {
  it('filtert Nicht-Treffer heraus und behält Treffer-Reihenfolge stabil', () => {
    const namen = ['Alte Mühle', 'Mara Wachsherz', 'Marodeur'];
    expect(fuzzyFilter('mar', namen, (n) => n)).toEqual(['Mara Wachsherz', 'Marodeur']);
  });

  it('sortiert bessere Treffer nach vorn', () => {
    const namen = ['Kerzenmacher Gregor', 'Gregor'];
    expect(fuzzyFilter('greg', namen, (n) => n)[0]).toBe('Gregor');
  });
});
