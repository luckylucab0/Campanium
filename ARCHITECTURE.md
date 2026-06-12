# Architektur

Dieses Dokument beschreibt den Datenfluss, die Ordnerstruktur und das
Vorgehen, um eine neue Entitätsart hinzuzufügen.

## Überblick & Datenfluss

```
            DM-Modus (lokal)                          Spieler-Modus (statisch)
┌─────────────────────────────────────┐      ┌──────────────────────────────────┐
│  data/*.json  (eine Datei/Entität)  │      │  npm run build:player            │
│        ▲              │             │      │   1. data/ lesen + validieren    │
│  Write-Through        │ laden       │      │   2. Whitelist-Spoiler-Filter    │
│        │              ▼             │      │   3. Paranoia-Prüfung            │
│  server/ (Express, Zod-validiert)   │      │   4. player-data.json schreiben  │
│        ▲  REST /api/…               │      │   5. vite build --mode player    │
│        │                            │      │        ▼                         │
│  client/ (React, lädt ALLES beim    │      │  client/dist-player/ → Pages     │
│  Start in den Store)                │      └──────────────────────────────────┘
└─────────────────────────────────────┘
```

Zentrale Idee: **Eine Kampagne ist klein** (hunderte, nicht Millionen
Einträge). Der Client lädt deshalb beim Start den kompletten Datenbestand
(`GET /api/alles` bzw. statisches `player-data.json`) in einen React-Context
(`client/src/store.tsx`). Daraus werden Indizes abgeleitet:

- **Name-Index** (case-insensitiv) → Auflösung von `[[Wikilinks]]`
- **Backlink-Index** → „Erwähnt in …“ auf jeder Detailseite; gespeist aus
  `[[Wikilinks]]` in allen Textfeldern **und** Referenzfeldern (`ortId`, …)

Mutationen gehen immer durch die API (Write-Through auf die Platte) und
aktualisieren anschließend den Store.

## Ordnerstruktur

```
shared/src/
  types.ts         Entitäts-Interfaces & Enums (Single Source of Truth)
  schemas.ts       Zod-Schemas + Templates (neueEntitaet, DEFAULT_*)
  entityConfig.ts  Registry: Labels, Routen, Kopffelder, Abschnitte, Filter
  wikilink.ts      [[Wikilink]]-Parser (+ Tests)
  fuzzy.ts         Fuzzy-Suche für Palette & Autocomplete (+ Tests)
  slug.ts          sprechende IDs/Dateinamen (+ Tests)
  playerFilter.ts  Spoiler-Filter, WHITELIST-Prinzip (+ Tests)

server/src/
  storage.ts       Datei-Speicher: data/<typ>/<id>.json, Singletons
  app.ts           Express-Routen, Zod-Validierung (+ CRUD-Tests)
  index.ts         Einstiegspunkt (Port 3001, DATA_DIR überschreibbar)

client/src/
  api.ts           REST-Aufrufe; im Spieler-Modus statisches JSON
  store.tsx        Daten-Context, Backlink-Index, Mutationen
  komponenten/     Layout, Markdown(+Wikilinks), Editor, Suche, Badges, …
  seiten/          Dashboard, generische Liste/Detail/Formular,
                   QuestBoard, SessionTimeline, Spielabend, Strahd, Tarokka
  styles/index.css Design-Tokens (CSS-Variablen) + Themes + Tailwind

scripts/
  seed.mjs         data.example/ → data/ kopieren
  build-player.ts  Spieler-Build (Filter + statischer Vite-Build)
```

## Datenhaltung

- `data/<typ>/<slug>.json` – eine Datei pro Entität, ID = Slug des Namens
  (Kollisionen bekommen `-2`, `-3`, …). Menschenlesbar, git-versionierbar.
- Singletons: `kampagnenstand.json`, `strahd-tracker.json`,
  `tarokka-lesung.json` direkt in `data/`.
- Jede Schreiboperation validiert die API gegen die Zod-Schemas; ungültige
  Daten werden mit HTTP 400 abgewiesen und erreichen die Platte nie.

## Spoiler-Trennung (wichtigste Invariante)

1. **Feld-Ebene:** DM-Felder enden per Konvention auf `Dm`
   (`geheimnisseDm`, `buchSeiteDm`). Die UI markiert sie rot.
2. **Entitäts-Ebene:** `dmOnly: true` versteckt den ganzen Eintrag.
3. **Export:** `shared/src/playerFilter.ts` exportiert ausschließlich
   Felder von einer expliziten **Whitelist** pro Typ. Neue Felder sind
   damit automatisch DM-only, bis sie bewusst freigegeben werden.
   Tests (`playerFilter.test.ts`) und eine Paranoia-Prüfung im
   Build-Skript sichern das ab.

## Neue Entitätsart hinzufügen

Beispiel: Typ „Monster“.

1. **`shared/src/types.ts`** – Interface `Monster` definieren, `'monster'`
   zu `ENTITY_TYPEN` hinzufügen und das Interface in die `Entitaet`-Union
   aufnehmen.
2. **`shared/src/schemas.ts`** – `monsterSchema` schreiben, in
   `entitySchemas` registrieren und in `neueEntitaet()` einen
   Default-Zweig ergänzen (das ist zugleich das Template).
3. **`shared/src/entityConfig.ts`** – Registry-Eintrag mit Label, Route,
   Icon-Name, Kopffeldern, Markdown-Abschnitten und Filtern anlegen.
   Listen-, Detail- und Formularseite entstehen daraus **automatisch**.
4. **`shared/src/playerFilter.ts`** – bewusst entscheiden, welche Felder
   spielersicher sind, und sie in `FELD_WHITELIST` eintragen.
   **Kein Eintrag = Typ wird nie exportiert** (sicherer Default).
5. Optional: Icon-Name in `client/src/komponenten/icons.ts` mappen,
   Tests ergänzen.

Server, Storage, Suche, Backlinks und Spieler-Build greifen die neue Art
ohne weitere Änderungen auf (alles iteriert über `ENTITY_TYPEN` bzw. die
Registry).

## Spieler-Build & Deployment

`npm run build:player` schreibt das gefilterte `player-data.json` nach
`client/public/` und baut die SPA mit `--mode player --base ./` nach
`client/dist-player/`. Der Client erkennt den Modus über
`import.meta.env.MODE === 'player'`: kein API-Zugriff, keine Edit-UI,
keine DM-Navigation. `HashRouter` + relativer Base-Path machen den Build
auf GitHub Pages ohne Server-Konfiguration lauffähig. Veröffentlicht wird
über den manuell auslösbaren Pages-Workflow (siehe README).
