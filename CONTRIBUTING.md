# Contributing

Issues und Pull Requests sind willkommen! Beiträge laufen **ausschließlich
über Pull Requests an dieses Repository** – dauerhafte öffentliche Forks
erlaubt die [Lizenz](LICENSE) nicht (ein temporärer GitHub-Fork nur zum
Vorbereiten eines PRs ist in Ordnung). Mit dem Einreichen eines PRs räumst
du dem Projektinhaber die in der Lizenz beschriebenen Rechte an deinem
Beitrag ein.

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
