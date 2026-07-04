# Architektur

Dieses Dokument beschreibt den Datenfluss, die Ordnerstruktur und das
Vorgehen, um eine neue Entitätsart hinzuzufügen.

## Überblick & Datenfluss

```
            DM-Modus (lokal)                          Spieler-Modus (statisch)
┌─────────────────────────────────────┐      ┌──────────────────────────────────┐
│  data/<kampagne>/*.json             │      │  KAMPAGNE=<id>                   │
│        ▲              │             │      │  npm run build:player            │
│  Write-Through        │ laden       │      │   1. EINE Kampagne lesen         │
│        │              ▼             │      │   2. Whitelist-Spoiler-Filter    │
│  server/ (Express, Zod-validiert)   │      │   3. Paranoia-Prüfung            │
│        ▲  REST /api/kampagnen/:kid  │      │   4. player-data.json schreiben  │
│        │                            │      │   5. vite build --mode player    │
│  client/ (React, lädt die aktive    │      │        ▼                         │
│  Kampagne komplett in den Store)    │      │  client/dist-player/ → Pages     │
└─────────────────────────────────────┘      └──────────────────────────────────┘
```

Zentrale Ideen:

1. **Kampagnen sind die oberste Datenebene.** Jeder Unterordner von `data/`
   mit einer `kampagne.json` ist eine Kampagne; der Client zeigt einen
   Umschalter in der Sidebar. Alle API-Routen sind kampagnen-bezogen
   (`/api/kampagnen/:kid/…`), Wikilinks/Backlinks/Suche wirken immer nur
   innerhalb der aktiven Kampagne.
2. **Eine Kampagne ist klein** (hunderte, nicht Millionen Einträge). Der
   Client lädt deshalb beim Kampagnen-Wechsel den kompletten Datenbestand
   (`GET /api/kampagnen/:kid/alles` bzw. statisches `player-data.json`) in
   einen React-Context (`client/src/store.tsx`). Daraus werden Indizes
   abgeleitet:

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
  kalender.ts      Kalender-Arithmetik (Tag vor/zurück, Formatierung) (+ Tests)
  playerFilter.ts  Spoiler-Filter, WHITELIST-Prinzip (+ Tests)

server/src/
  storage.ts       Datei-Speicher pro Kampagne + KampagnenVerwaltung
  app.ts           Express-Routen (/api/kampagnen/…), Zod-Validierung (+ Tests)
  index.ts         Einstiegspunkt (Port 3001, DATA_DIR überschreibbar)
  ki/              Optionaler KI-Assistent (opt-in über .env):
    provider.ts      provider-neutrale Typen (Nachrichten, Tools)
    anthropic.ts     Claude über das offizielle SDK
    openaiKompatibel.ts  OpenAI, Mistral, Gemini & Ollama (ein Adapter)
    tools.ts         Werkzeuge = CRUD gegen den Storage (Zod-validiert, kein Löschen)
    chat.ts          Agent-Loop (max. 8 Runden) + System-Prompt mit Guardrails
                     (nur Kampagnen-Themen, Injection-Schutz); die Chat-Route
                     deckelt zusätzlich Verlaufslänge und Nachrichtengröße
    config.ts        .env-Konfiguration, Provider-Factory (+ Tests)

client/src/
  api.ts           REST-Aufrufe; im Spieler-Modus statisches JSON
  store.tsx        Daten-Context, Backlink-Index, Mutationen
  komponenten/     Layout (inkl. Kampagnen-Umschalter), Markdown(+Wikilinks),
                   Editor, Suche, Badges, …
  seiten/          Dashboard, generische Liste/Detail/Formular, QuestBoard,
                   SessionTimeline, Spielabend, Widersacher, Lesung,
                   KarteSeite (Pin-Overlay), KalenderSeite, GraphSeite
  styles/index.css Design-Tokens (CSS-Variablen) + Themes + Tailwind

scripts/
  seed.mjs         data.example/ → data/ kopieren
  build-player.ts  Spieler-Build (Filter + statischer Vite-Build)
```

## Datenhaltung

- `data/<kampagne>/kampagne.json` – Manifest (ID, Name, Untertitel).
  Jeder Ordner mit Manifest wird beim Serverstart als Kampagne geladen.
- `data/<kampagne>/<typ>/<slug>.json` – eine Datei pro Entität, ID = Slug
  des Namens (Kollisionen bekommen `-2`, `-3`, …). Menschenlesbar,
  git-versionierbar.
- Singletons pro Kampagne: `kampagnenstand.json`,
  `widersacher-tracker.json`, `lesung.json`, `kalender.json`.
- `data/<kampagne>/bilder/` – hochgeladene Bilder (Portraits,
  Kartengrafiken) als normale Dateien; Entitäten referenzieren sie nur
  per Dateiname im Basisfeld `bild`.
- Jede Schreiboperation validiert die API gegen die Zod-Schemas; ungültige
  Daten werden mit HTTP 400 abgewiesen und erreichen die Platte nie.

## Kampagnen-agnostische Spezialmodule

Alle Spezialmodule sind generisch und pro Kampagne konfigurierbar – die
fiktive Demo-Kampagne „Die Nebelmark“ zeigt eine Belegung:

| Modul               | Generisch                           | In der Nebelmark-Demo               |
| ------------------- | ----------------------------------- | ----------------------------------- |
| Widersacher-Tracker | Name frei (`widersacher.name`)      | „Graf Vessimir“                     |
| Lesung              | Titel + beliebig viele Karten       | Kartenlegung der Salzmutter, 5 K.   |
| Eskalations-Tracker | optional, Titel + Stufen editierbar | „Vessimirs Eskalation“, 5 Stufen    |
| Custom-Tracker      | beliebige Zähler (`aktuell`/`max`)  | „Selainestes Bisse“ 1/3                 |
| Ort-Region          | Freitext, Filter aus Ist-Werten     | „Wildnis & Straßen“, …              |
| Kalender            | Monate/Längen/Ära frei, Ereignisse  | 12 fiktive Monate, Jahr 735 NZ      |
| Karten              | Grafik + Pins auf Orte              | Übersichtskarte des Tals, 3 Pins    |

## Mehrsprachigkeit (i18n)

Die UI ist mehrsprachig (aktuell Deutsch & Englisch), ohne zusätzliche
Abhängigkeit – umgesetzt in `client/src/i18n/`:

- **Deutsch ist die Quellsprache.** Übersetzbare Texte stehen als deutscher
  Originaltext im Code und laufen durch `t('…')` (Hook `useI18n()`).
  Pro weiterer Sprache gibt es ein Wörterbuch „deutscher Text →
  Übersetzung“ (`en.ts`). Fehlende Einträge fallen sichtbar auf Deutsch
  zurück – eine unvollständige Übersetzung bricht nie die UI.
- **Daten bleiben sprachneutral.** JSON-Schlüssel (`ortId`,
  `geheimnisseDm`, …) und Enum-Werte (`status: "lebendig"`,
  `haltung: "verbündet"`) sind stabile Bezeichner und werden nur für die
  **Anzeige** übersetzt (zentral z. B. in der `Badge`-Komponente) – nie
  beim Speichern. Kampagnen sind dadurch zwischen Sprachen portabel.
- **Registry bleibt einsprachig.** Die Labels/Hinweise in
  `entityConfig.ts` sind die deutschen Quelltexte; der Client übersetzt
  sie an der Anzeigestelle mit `t(config.label)` usw. Ein Test
  (`i18n/uebersetzung.test.ts`) erzwingt, dass das englische Wörterbuch
  alle Registry-Texte und Enum-Werte abdeckt.
- **Platzhalter** wie `{name}` werden zur Laufzeit ersetzt:
  `t('Tag {nr}', { nr: 3 })`.
- **KI-Assistent:** Der Client schickt die UI-Sprache mit
  (`POST …/chat`, Feld `sprache`); der Server passt Antwortsprache und
  Aktions-Beschreibungen an (`server/src/ki/tools.ts`).
- Die Sprachwahl liegt in `localStorage`, initial entscheidet die
  Browser-Sprache; `<html lang>` wird mitgeführt. Datumsformate und
  Sortierung nutzen die Locale der aktiven Sprache.

**Neue Sprache hinzufügen** (z. B. Französisch):

1. `client/src/i18n/fr.ts` anlegen – Kopie von `en.ts`, Werte übersetzen.
2. In `client/src/i18n/index.tsx` bei `SPRACHEN` und `WOERTERBUECHER`
   registrieren – der Umschalter in der Sidebar zeigt sie automatisch.
3. Optional: `KiSprache` in `server/src/ki/tools.ts` erweitern, damit auch
   der KI-Assistent in der neuen Sprache antwortet.

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
5. **`client/src/i18n/en.ts`** – die neuen Labels/Hinweise übersetzen.
   Der Vollständigkeits-Test (`i18n/uebersetzung.test.ts`) schlägt sonst
   fehl – vergessene Übersetzungen fallen also im CI auf.
6. Optional: Icon-Name in `client/src/komponenten/icons.ts` mappen,
   Tests ergänzen.

Server, Storage, Suche, Backlinks und Spieler-Build greifen die neue Art
ohne weitere Änderungen auf (alles iteriert über `ENTITY_TYPEN` bzw. die
Registry).

## Spieler-Build & Deployment

`npm run build:player` exportiert genau EINE Kampagne (Auswahl über
`KAMPAGNE=<id>`, bei nur einer Kampagne automatisch), schreibt das
gefilterte `player-data.json` nach `client/public/` und baut die SPA mit
`--mode player --base ./` nach `client/dist-player/`. Der Client erkennt den Modus über
`import.meta.env.MODE === 'player'`: kein API-Zugriff, keine Edit-UI,
keine DM-Navigation. `HashRouter` + relativer Base-Path machen den Build
auf GitHub Pages ohne Server-Konfiguration lauffähig. Veröffentlicht wird
über den manuell auslösbaren Pages-Workflow (siehe README).
