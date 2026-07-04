// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/** Tests für den Wikilink-Parser – Herzstück der Verknüpfungen. */
import { describe, expect, it } from 'vitest';
import { ersetzeWikilinks, parseWikilinks, sammleLinkZiele } from './wikilink';

describe('parseWikilinks', () => {
  it('findet einfache Links', () => {
    const treffer = parseWikilinks('Sie wohnt bei [[Gregor der Kerzenmacher]] im Dorf.');
    expect(treffer).toHaveLength(1);
    expect(treffer[0]?.ziel).toBe('Gregor der Kerzenmacher');
    expect(treffer[0]?.anzeige).toBe('Gregor der Kerzenmacher');
  });

  it('unterstützt Anzeigetext mit |', () => {
    const treffer = parseWikilinks('Frag [[Mara Wachsherz|die Kerzenzieherin]] danach.');
    expect(treffer[0]?.ziel).toBe('Mara Wachsherz');
    expect(treffer[0]?.anzeige).toBe('die Kerzenzieherin');
  });

  it('findet mehrere Links und trimmt Leerzeichen', () => {
    const treffer = parseWikilinks('[[ Alte Mühle ]] und [[Mara Wachsherz]]');
    expect(treffer.map((t) => t.ziel)).toEqual(['Alte Mühle', 'Mara Wachsherz']);
  });

  it('ignoriert leere, unvollständige und mehrzeilige Klammern', () => {
    expect(parseWikilinks('[[]] und [[nur offen und [[über\nzwei Zeilen]]')).toHaveLength(0);
    expect(parseWikilinks('aber [[Gültig]] daneben [[über\nzwei Zeilen]]')).toHaveLength(1);
    expect(parseWikilinks('normaler [Markdown-Link](https://example.com)')).toHaveLength(0);
  });

  it('liefert korrekte Indizes', () => {
    const text = 'xx [[Ziel]]';
    expect(parseWikilinks(text)[0]?.index).toBe(3);
  });
});

describe('ersetzeWikilinks', () => {
  it('ersetzt Links über den Callback', () => {
    const html = ersetzeWikilinks(
      'Hallo [[Mara|du]]!',
      (t) => `<a href="#${t.ziel}">${t.anzeige}</a>`,
    );
    expect(html).toBe('Hallo <a href="#Mara">du</a>!');
  });

  it('lässt Text ohne Links unverändert', () => {
    expect(ersetzeWikilinks('kein Link', () => 'X')).toBe('kein Link');
  });
});

describe('sammleLinkZiele', () => {
  it('sammelt eindeutige Ziele kleingeschrieben über mehrere Texte', () => {
    const ziele = sammleLinkZiele(['[[Mara]] trifft [[Gregor]]', 'wieder [[mara]]']);
    expect(ziele).toEqual(new Set(['mara', 'gregor']));
  });
});
