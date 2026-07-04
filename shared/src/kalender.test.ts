// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/** Tests für die Kalender-Arithmetik (Monats-/Jahresüberläufe, Klemmen). */
import { describe, expect, it } from 'vitest';
import type { Kalender } from './types';
import {
  formatKalenderDatum,
  kalenderAktiv,
  klemmeDatum,
  naechsterTag,
  vorherigerTag,
} from './kalender';

const kalender: Kalender = {
  aera: 'BC',
  monate: [
    { name: 'Frosthauch', tage: 30 },
    { name: 'Mondwende', tage: 28 },
    { name: 'Nebelzeit', tage: 31 },
  ],
  aktuell: { jahr: 735, monat: 1, tag: 1 },
  ereignisse: [],
};

describe('Kalender-Arithmetik', () => {
  it('erkennt einen nicht eingerichteten Kalender', () => {
    expect(kalenderAktiv(kalender)).toBe(true);
    expect(kalenderAktiv({ ...kalender, monate: [] })).toBe(false);
  });

  it('zählt innerhalb eines Monats hoch und runter', () => {
    expect(naechsterTag(kalender, { jahr: 735, monat: 1, tag: 12 })).toEqual({
      jahr: 735,
      monat: 1,
      tag: 13,
    });
    expect(vorherigerTag(kalender, { jahr: 735, monat: 1, tag: 12 })).toEqual({
      jahr: 735,
      monat: 1,
      tag: 11,
    });
  });

  it('rollt über Monatsgrenzen (inkl. unterschiedlicher Monatslängen)', () => {
    expect(naechsterTag(kalender, { jahr: 735, monat: 2, tag: 28 })).toEqual({
      jahr: 735,
      monat: 3,
      tag: 1,
    });
    expect(vorherigerTag(kalender, { jahr: 735, monat: 3, tag: 1 })).toEqual({
      jahr: 735,
      monat: 2,
      tag: 28,
    });
  });

  it('rollt über Jahresgrenzen', () => {
    expect(naechsterTag(kalender, { jahr: 735, monat: 3, tag: 31 })).toEqual({
      jahr: 736,
      monat: 1,
      tag: 1,
    });
    expect(vorherigerTag(kalender, { jahr: 736, monat: 1, tag: 1 })).toEqual({
      jahr: 735,
      monat: 3,
      tag: 31,
    });
  });

  it('klemmt Daten in den gültigen Bereich (nach Umbau der Monatsliste)', () => {
    expect(klemmeDatum(kalender, { jahr: 735, monat: 9, tag: 40 })).toEqual({
      jahr: 735,
      monat: 3,
      tag: 31,
    });
  });

  it('formatiert Daten mit Monatsname und Ära', () => {
    expect(formatKalenderDatum(kalender, { jahr: 735, monat: 2, tag: 12 })).toBe(
      '12. Mondwende 735 BC',
    );
    expect(formatKalenderDatum({ ...kalender, aera: '' }, { jahr: 1, monat: 1, tag: 3 })).toBe(
      '3. Frosthauch 1',
    );
  });
});
