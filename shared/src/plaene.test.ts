// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

import { describe, expect, it } from 'vitest';
import { FEATURE_STUFE, parsePlan, PLAENE, PLAN_STUFEN, planErlaubt } from './plaene';

describe('parsePlan', () => {
  it('akzeptiert gültige Stufen', () => {
    for (const stufe of PLAN_STUFEN) expect(parsePlan(stufe)).toBe(stufe);
  });
  it('fällt bei Unbekanntem/leer auf „frei“ zurück', () => {
    expect(parsePlan('gold')).toBe('frei');
    expect(parsePlan(undefined)).toBe('frei');
    expect(parsePlan(null)).toBe('frei');
    expect(parsePlan(42)).toBe('frei');
  });
});

describe('planErlaubt', () => {
  it('schaltet den KI-Assistenten ab Basis frei', () => {
    expect(planErlaubt('frei', 'ki-assistent')).toBe(false);
    expect(planErlaubt('basis', 'ki-assistent')).toBe(true);
    expect(planErlaubt('plus', 'ki-assistent')).toBe(true);
    expect(planErlaubt('premium', 'ki-assistent')).toBe(true);
  });

  it('schaltet erweiterte KI-Funktionen erst ab Plus frei', () => {
    expect(planErlaubt('basis', 'ki-erweitert')).toBe(false);
    expect(planErlaubt('plus', 'ki-erweitert')).toBe(true);
    expect(planErlaubt('premium', 'ki-erweitert')).toBe(true);
  });

  it('schaltet Kartengenerierung nur bei Premium frei', () => {
    expect(planErlaubt('plus', 'ki-kartengenerierung')).toBe(false);
    expect(planErlaubt('premium', 'ki-kartengenerierung')).toBe(true);
  });

  it('behandelt unbekannte Pläne wie „frei“', () => {
    expect(planErlaubt('unsinn', 'ki-assistent')).toBe(false);
  });
});

describe('Konsistenz der Tabellen', () => {
  it('jede Feature-Stufe existiert und Ränge sind streng aufsteigend', () => {
    for (const stufe of Object.values(FEATURE_STUFE)) expect(PLAENE[stufe]).toBeDefined();
    const raenge = PLAN_STUFEN.map((s) => PLAENE[s].rang);
    for (let i = 1; i < raenge.length; i++) expect(raenge[i]).toBeGreaterThan(raenge[i - 1]!);
  });
});
