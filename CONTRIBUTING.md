# Contributing

Issues und Pull Requests sind willkommen! Das Projekt ist dual-lizenziert:
[AGPL v3](LICENSE) für die Open-Source-Nutzung plus eine
[kommerzielle Lizenz](LICENSE-COMMERCIAL.md) für Nutzung ohne
AGPL-Pflichten.

## CLA (Voraussetzung für jeden PR)

Damit das Dual-Licensing funktioniert, werden Pull Requests **nur mit
akzeptiertem CLA** gemerged: Lies [CLA.md](CLA.md) (kurz und verständlich)
und schreibe in die Beschreibung deines ersten PRs den Satz
„I have read and agree to the CLA (CLA.md).“

## Setup

```bash
npm install
npm run seed   # Beispieldaten nach data/
npm run dev    # Server (:3001) + Client (:5173)
```

## Vor dem PR

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Regeln

- **Keine urheberrechtlich geschützten Inhalte** aus dem offiziellen
  Abenteuerband (Texte, Statblocks, Werte) – auch nicht in Beispieldaten
  oder Tests. `data.example/` enthält ausschließlich Erfundenes.
- Neue Felder sind im Spieler-Export **automatisch DM-only** – wer ein
  Feld für Spieler freigibt (`shared/src/playerFilter.ts`), begründet das
  bitte im PR.
- Code-Kommentare auf Deutsch, README auf Englisch.
- Für neue Entitätsarten: Schritte in [ARCHITECTURE.md](ARCHITECTURE.md).
