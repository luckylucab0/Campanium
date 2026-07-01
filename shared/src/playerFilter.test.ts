/**
 * Tests für den Spoiler-Filter des Spieler-Builds.
 * Diese Tests sind das Sicherheitsnetz: Sie belegen, dass kein DM-Feld
 * und keine DM-Entität im Spieler-Export landet.
 */
import { describe, expect, it } from 'vitest';
import type { Entitaet, Kampagne, Kampagnenstand, Nsc, Ort } from './types';
import { DEFAULT_KAMPAGNENSTAND, neueEntitaet } from './schemas';
import { filterFuerSpieler, istSpielerSichtbar } from './playerFilter';

const kampagne: Kampagne = {
  id: 'test-kampagne',
  name: 'Testkampagne',
  beschreibung: 'Eine Kampagne für Tests',
  erstellt: '2026-01-01T00:00:00.000Z',
};

/** Hilfsfunktion: NSC, den die Party bereits getroffen hat. */
function getroffenerNsc(name: string, extra: Partial<Nsc> = {}): Nsc {
  const nsc = neueEntitaet('nsc', name.toLowerCase(), name) as Nsc;
  return {
    ...nsc,
    kampagnenLog: [{ sessionNr: 1, text: 'Getroffen.' }],
    buchSeiteDm: 'S. 42',
    statblockRefDm: 'Geheimer Statblock',
    weissVerbirgtDm: 'Er ist heimlich ein Spion!',
    ...extra,
  };
}

function besuchterOrt(name: string, extra: Partial<Ort> = {}): Ort {
  const ort = neueEntitaet('ort', name.toLowerCase(), name) as Ort;
  return { ...ort, besucht: true, geheimnisseDm: 'Falle im Keller!', ...extra };
}

const stand: Kampagnenstand = {
  ...DEFAULT_KAMPAGNENSTAND,
  eskalation: {
    titel: 'Strahds Eskalation',
    stufe: 4,
    stufen: ['ruhig', 'neugierig', 'fordernd', 'Geheimplan: Er will Lyra brechen'],
  },
};

describe('istSpielerSichtbar (Sichtbarkeitsregeln)', () => {
  it('entfernt dmOnly-Entitäten komplett', () => {
    expect(istSpielerSichtbar(getroffenerNsc('Spion', { dmOnly: true }))).toBe(false);
  });

  it('entfernt Session-Preps immer', () => {
    expect(istSpielerSichtbar(neueEntitaet('sessionPrep', 'prep-1', 'Prep 1'))).toBe(false);
  });

  it('entfernt unbesuchte Orte', () => {
    expect(istSpielerSichtbar(besuchterOrt('Geheimort', { besucht: false }))).toBe(false);
    expect(istSpielerSichtbar(besuchterOrt('Dorfplatz'))).toBe(true);
  });

  it('entfernt nie getroffene NSCs (Status unbekannt oder leeres Kampagnen-Log)', () => {
    expect(istSpielerSichtbar(getroffenerNsc('Mysterium', { status: 'unbekannt' }))).toBe(false);
    expect(istSpielerSichtbar(getroffenerNsc('NieGesehen', { kampagnenLog: [] }))).toBe(false);
    expect(istSpielerSichtbar(getroffenerNsc('Gregor'))).toBe(true);
  });

  it('entfernt nicht gefundene Gegenstände', () => {
    const verborgen = neueEntitaet('gegenstand', 'artefakt', 'Artefakt');
    expect(istSpielerSichtbar(verborgen)).toBe(false);
  });
});

describe('filterFuerSpieler (Whitelist)', () => {
  it('lässt KEIN Feld mit Dm-Suffix durch – über alle Typen hinweg', () => {
    // Eine Entität pro Typ, jede mit befüllten DM-Feldern, alle spielersichtbar.
    const alle: Entitaet[] = [
      getroffenerNsc('Gregor'),
      {
        ...neueEntitaet('quest', 'kerzen', 'Kerzen für die Kirche'),
        typ: 'quest',
        hintergrundDm: 'Geheimer Hintergrund',
        ausgaengeDm: 'Geheime Ausgänge',
        buchSeiteDm: 'S. 7',
      } as Entitaet,
      besuchterOrt('Dorfplatz'),
      { ...neueEntitaet('sc', 'lena', 'Lena'), hooksDm: 'Angst vor Wölfen' } as Entitaet,
      { ...neueEntitaet('session', 's1', 'Session 1'), notizenDm: '300 XP' } as Entitaet,
      {
        ...neueEntitaet('gegenstand', 'amulett', 'Amulett'),
        gefunden: true,
        geschichteDm: 'Verflucht!',
        buchSeiteDm: 'S. 99',
      } as Entitaet,
      { ...neueEntitaet('fraktion', 'zirkel', 'Zirkel'), zieleDm: 'Weltherrschaft' } as Entitaet,
      neueEntitaet('notiz', 'hausregeln', 'Hausregeln'),
    ];

    const ergebnis = filterFuerSpieler(kampagne, alle, stand);

    // Alle 8 spielersichtbaren Entitäten sind enthalten …
    expect(ergebnis.entitaeten).toHaveLength(8);
    // … aber im gesamten serialisierten Export existiert kein einziger
    // Schlüssel mit Dm-Suffix und keiner der DM-Inhalte.
    const json = JSON.stringify(ergebnis);
    expect(json).not.toMatch(/"[a-zA-Z]*Dm"/);
    for (const spoiler of [
      'Spion',
      'Geheimer Hintergrund',
      'Geheime Ausgänge',
      'Falle im Keller',
      'Angst vor Wölfen',
      '300 XP',
      'Verflucht',
      'Weltherrschaft',
      'S. 42',
      'S. 7',
      'S. 99',
    ]) {
      expect(json).not.toContain(spoiler);
    }
  });

  it('whitelistet unbekannte Zusatzfelder NICHT (Whitelist statt Blacklist)', () => {
    const nsc = getroffenerNsc('Gregor') as Nsc & { geheimesNeuesFeld?: string };
    nsc.geheimesNeuesFeld = 'Streng geheim';
    const ergebnis = filterFuerSpieler(kampagne, [nsc], stand);
    expect(JSON.stringify(ergebnis)).not.toContain('Streng geheim');
  });

  it('nullt Verknüpfungen auf nicht exportierte Entitäten', () => {
    const geheimerOrt = besuchterOrt('Geheime Gruft', { besucht: false });
    const nsc = getroffenerNsc('Gregor', { ortId: geheimerOrt.id });
    const ergebnis = filterFuerSpieler(kampagne, [nsc, geheimerOrt], stand);
    expect(ergebnis.entitaeten).toHaveLength(1);
    expect((ergebnis.entitaeten[0] as Nsc).ortId).toBeNull();
    expect(JSON.stringify(ergebnis)).not.toContain('geheime-gruft');
  });

  it('behält gültige Verknüpfungen zwischen exportierten Entitäten', () => {
    const ort = besuchterOrt('Dorfplatz');
    const nsc = getroffenerNsc('Gregor', { ortId: ort.id });
    const ergebnis = filterFuerSpieler(kampagne, [nsc, ort], stand);
    const exportierterNsc = ergebnis.entitaeten.find((e) => e.typ === 'nsc') as Nsc;
    expect(exportierterNsc.ortId).toBe(ort.id);
  });

  it('exportiert vom Kampagnenstand nur die Whitelist-Felder (keine Eskalation)', () => {
    const ergebnis = filterFuerSpieler(kampagne, [], stand);
    expect(ergebnis.kampagnenstand).toEqual({
      partyLevel: stand.partyLevel,
      ingameTag: stand.ingameTag,
      ingameDatumText: stand.ingameDatumText,
    });
    const json = JSON.stringify(ergebnis);
    expect(json).not.toContain('eskalation');
    expect(json).not.toContain('Geheimplan');
  });

  it('exportiert von der Kampagne nur Name und Beschreibung', () => {
    const ergebnis = filterFuerSpieler(kampagne, [], stand);
    expect(ergebnis.kampagne).toEqual({
      name: 'Testkampagne',
      beschreibung: 'Eine Kampagne für Tests',
    });
  });
});
