/**
 * Tests der Mehrsprachigkeit:
 *  - uebersetze(): Übersetzung, Platzhalter, Fallback auf Deutsch
 *  - Vollständigkeit: Das englische Wörterbuch deckt alle Texte der
 *    Entitäts-Registry (Labels, Beschreibungen, Hinweise, Abschnitte,
 *    Filter) und alle Enum-Anzeigewerte ab. So kann kein neues
 *    Registry-Feld unbemerkt unübersetzt bleiben.
 */
import { describe, expect, it } from 'vitest';
import {
  ENTITY_TYPEN,
  entityConfigs,
  HALTUNGEN,
  LESUNG_KARTEN_STATUS,
  NSC_STATUS,
  QUEST_STATUS,
  SC_STATUS,
  WIDERSACHER_MODI,
} from '@campanium/shared';
import { uebersetze } from './index';
import { en } from './en';

describe('uebersetze()', () => {
  it('liefert Deutsch unverändert und Englisch aus dem Wörterbuch', () => {
    expect(uebersetze('de', 'Speichern')).toBe('Speichern');
    expect(uebersetze('en', 'Speichern')).toBe('Save');
  });

  it('fällt bei fehlenden Einträgen sichtbar auf Deutsch zurück', () => {
    expect(uebersetze('en', 'Dieser Text existiert nicht im Wörterbuch')).toBe(
      'Dieser Text existiert nicht im Wörterbuch',
    );
  });

  it('ersetzt {platzhalter} in beiden Sprachen', () => {
    expect(uebersetze('de', '{label} anlegen', { label: 'Quest' })).toBe('Quest anlegen');
    expect(uebersetze('en', '{label} anlegen', { label: 'Quest' })).toBe('Create Quest');
    // Unbekannte Platzhalter bleiben unangetastet statt "undefined" zu zeigen.
    expect(uebersetze('de', 'Tag {nr}')).toBe('Tag {nr}');
  });
});

describe('Vollständigkeit des englischen Wörterbuchs', () => {
  it('deckt alle Texte der Entitäts-Registry ab', () => {
    const fehlend: string[] = [];
    const pruefe = (text?: string) => {
      if (text && !(text in en)) fehlend.push(text);
    };
    for (const typ of ENTITY_TYPEN) {
      const config = entityConfigs[typ];
      pruefe(config.label);
      pruefe(config.labelPlural);
      pruefe(config.beschreibung);
      for (const feld of config.felder) {
        pruefe(feld.label);
        pruefe(feld.hinweis);
      }
      for (const abschnitt of config.abschnitte) {
        pruefe(abschnitt.titel);
        pruefe(abschnitt.hinweis);
      }
      for (const filter of config.filter) pruefe(filter.label);
    }
    expect(fehlend).toEqual([]);
  });

  it('deckt alle Enum-Anzeigewerte ab', () => {
    const alleWerte = [
      ...HALTUNGEN,
      ...NSC_STATUS,
      ...QUEST_STATUS,
      ...SC_STATUS,
      ...LESUNG_KARTEN_STATUS,
      ...WIDERSACHER_MODI,
    ];
    const fehlend = alleWerte.filter((wert) => !(wert in en));
    expect(fehlend).toEqual([]);
  });
});
