# Campanium — Projektanweisungen & Design-Handoff

Selbst-gehostetes Kampagnen-Management-Tool für Pen-&-Paper (D&D): mehrere
Kampagnen mit In-App-Switcher, verknüpfte Entitäten, Dashboard mit Trackern
und DM-Module (Widersacher, Orakel-Lesung, Beziehungsgraph). Diese Datei
dokumentiert das **Designsystem**, die **Datenmodelle** und den **Ist-Stand**
der umgesetzten Funktionen. Sie ist mit dem tatsächlichen Repo abgeglichen –
Punkte, die im ursprünglichen Design-Handoff als „noch offen" galten, sind
inzwischen umgesetzt (siehe unten).

Der ursprüngliche interaktive Prototyp (`Campanium.dc.html`) diente als
Design-Referenz; Produktionscode ist **TypeScript**: `shared/` (Zod-Schemas,
Entity-Registry, Spoiler-Filter), `server/` (Express-API, datei-basierter
JSON-Storage, ein Ordner pro Kampagne), `client/` (React + Vite + Tailwind v4).
Details zum Datenfluss stehen in [ARCHITECTURE.md](ARCHITECTURE.md).

## Befehle

```bash
npm install
npm run seed          # data.example/ → data/ (fiktive Demo-Kampagnen)
npm run dev           # Express-API (:3001) + React-App (:5173)
npm test              # Vitest (shared + server)
npm run lint          # ESLint
npm run typecheck     # strikter TS über alle Workspaces
npm run build         # Produktions-Build (shared → server → client)
npm run build:player  # statischer, spoiler-gefilterter Spieler-Build
```

Code-Kommentare auf Deutsch, README/öffentliche Doku auf Englisch. Keine
urheberrechtlich geschützten Abenteuer-Inhalte in `data.example/` oder Tests.

## Designsystem (verbindlich)

- **Ästhetik:** mystisches Dark-Fantasy. Tiefes arkanes Nachtviolett mit
  Sternenfeld (fixe `body::before`-Ebene). Umgesetzt als Design-Tokens
  (CSS-Variablen) in `client/src/styles/index.css`, an Tailwind v4 per
  `@theme` durchgereicht. Zwei Themes: `dunkel` (Standard) und `pergament`
  (helle Variante), umschaltbar; die Wahl liegt in `localStorage`.
- **Farben (dunkel):** BG `#0a0812 / #100b22 / #150e2e / #1a1240`; Rand
  `rgba(150,130,235,.16)`; Primär/Indigo `#8b7bf0` (hell `#a99cf5`); Gold
  `#d8b266 / #e3c682` (Akzente/Premium); Widersacher-Rosé `#d37c9e / #e59ab6`;
  Verbündet-Grün `#5f8a68 / #8dc49a`; Gefahr `#e08a5a`. Text `#eae6f7 /
  #9a90c0 / #7d76a6`. **Hinweis:** die Primär-Tokens heißen aus historischen
  Gründen noch `--blut*`, tragen aber das arkane Indigo.
- **Fonts (Fontsource, offline):** Titel/Erzähltext `Newsreader` +
  `Cormorant Garamond` (Serif, kursiv für Flavor); UI `Space Grotesk`;
  Labels/Codes/Zahlen `JetBrains Mono` (Kapitälchen/Letter-Spacing).
- **Logo:** Astrolab (`Astrolab` in `komponenten/Ornament.tsx`) —
  konzentrische Gold-Kreise + gedrehtes Indigo-Quadrat + Nadel + Indigo-Kern.
- **Ornamente:** Runen-Trenner (ᚦᚱᚨ, `.rune-trenner`); Line-SVG-Icons
  (lucide-react, kein Emoji); Ornament-Ecken an Karten (`.karte-ornament`).
- **Sprache:** UI Deutsch **und** Englisch (Sidebar-Umschalter).

## Datenmodelle

Single Source of Truth: `shared/src/types.ts` (Interfaces) + `schemas.ts`
(Zod). Sammlungs-Entitäten (`ENTITY_TYPEN`): **nsc, quest, ort, sc, session,
sessionPrep, gegenstand, fraktion, karte, notiz**. Jede erbt Basisfelder
(id, name, tags, dmOnly, kampagnenLog, bild). Singletons pro Kampagne:
`kampagnenstand`, `widersacher-tracker`, `lesung`, `kalender`.

- **Kampagne**: id, name, beschreibung, erstellt (Manifest `kampagne.json`).
- **Nsc**: status, haltung (verbündet…feindlich/unbekannt), ortId, fraktionId,
  wer, will, beschreibung, beziehungen; DM-only: buchSeiteDm, statblockRefDm,
  weissVerbirgtDm, **attribute** (STR/DEX/CON/INT/WIS/CHA, optional).
- **Sc**: spieler, klasseVolk, level, status, ac, hp, passiveWahrnehmung,
  **attribute** (optional, spielersichtbar), ziele, beziehungen, besonderes;
  DM-only: hooksDm.
- **Quest**: status (offen/aktiv/erledigt/fehlgeschlagen), questgeberId, ortId,
  auftrag, belohnung, fortschritt (Checkliste); DM-only: hintergrundDm,
  ausgaengeDm.
- **Ort**: region, besucht, empfohlenesLevel, was, stimmung, bereiche,
  bewohner; DM-only: geheimnisseDm.
- **Karte**: bild (Grafik) + pins[{x%, y%, ortId, beschriftung}].
- **Gegenstand / Fraktion / Notiz / Session / SessionPrep**: siehe types.ts.
- **Kampagnenstand**: partyLevel, ingameTag, ingameDatumText, optionaler
  Eskalations-Tracker, frei definierbare Custom-Counter.
- **Kalender**: Ära, Monate (Name+Tage), aktuelles Datum, Ereignisse (mit
  optionaler Entitäts-Verknüpfung).
- **WidersacherTracker / Lesung**: DM-Module (Dossier/Begegnungen bzw. Orakel).

## Implementierte Funktionen (Ist-Stand)

Alles unten ist **umgesetzt** (der Handoff führte einige davon noch als
„offen"; das ist überholt):

- Kampagnen-Switcher (anlegen, umbenennen, wechseln); pro Kampagne ein
  Ordner `data/<id>/` mit Zod-validierten JSON-Dateien.
- Dashboard: Party-Level/In-Game-Tag/Eskalations-Tracker (+/-), **frei
  definierbare Custom-Counter**, aktive Quests, letzte Sessions, Verbündete.
- Kompendium: generische Listen (Karten/Tabelle/Kanban), Detail- und
  Formularseiten aus der Entity-Registry; Bild-/Porträt-Upload (serverseitig
  persistiert).
- **Wikilinks `[[Name]]` + Backlinks** („Erwähnt in …") mit Autocomplete,
  Hover-Vorschau, Ein-Klick-Anlegen.
- **Globale ⌘K-Suche** (Fuzzy über Name/Tags/Volltext, nach Typ gruppiert).
- **i18n Deutsch/Englisch** (Wörterbuch, zur Laufzeit umschaltbar; Daten
  bleiben sprachneutral).
- Interaktive **Karten** (Pins auf hochgeladenem Kartenbild → Orte),
  **In-Game-Kalender**, **Beziehungsgraph** (Force-Directed aus Wikilinks/
  Referenzen), DM-Module **Lesung** & **Widersacher**.
- **Charakter-Attribute** (STR/DEX/CON/INT/WIS/CHA + Modifikatoren) für
  SC (spielersichtbar) und NSC (DM-only).
- **Würfelorakel** (d4–d100, Anzahl, Verlauf, Krit/Patzer, Tumble-Animation).
- **Optionaler KI-Assistent** (echte Anbindung, strikt opt-in per `.env`):
  Anthropic/OpenAI/Google/Mistral/Ollama; arbeitet über die Zod-validierte
  Storage-Schicht, kann nichts löschen; Guardrails (nur Kampagnen-Themen,
  Verlaufslimits).
- **KI-Zusatzfunktionen** (Ein-Schritt, kein Agent-Loop): **Sitzungsprep**-
  Entwurf aus dem Kampagnenstand, **Charakterbogen-/Statblock-Import**
  (Freitext → Zod-validierter SC/NSC) und **KI-Kartengenerierung** (eigener
  Bild-Provider `AI_IMAGE_*`, OpenAI-kompatibel → Grafik an eine Karte). Im
  Self-Host mit eigenem Key frei nutzbar.
- **Spieler-Modus / Spoiler-Filter**: statischer, schreibgeschützter Export
  (`npm run build:player`) per **Whitelist** (neue Felder sind automatisch
  DM-only). Wikilinks auf versteckte Entitäten werden neutralisiert; ein
  Paranoia-Gate bricht den Build ab, falls DM-Inhalte durchrutschen.
- **Erweiterungspunkt (für Overlays)**: Server (`server/src/erweiterung.ts`,
  `AppErweiterung`) und Client (`client/src/erweiterung/`, `ClientErweiterung`
  + Vite-Alias `campanium:erweiterung`) bieten optionale Hooks (Middleware,
  Router, Tenant-Resolver, KI-Gate, UI-Slots). Ohne Overlay verhält sich die
  App wie hier beschrieben (Self-Host, keine Konten, keine Gates). Ein
  separates, nicht-öffentliches Overlay (z. B. ein gehostetes SaaS-Angebot mit
  Login/Abo) kann sich hierüber einklinken, ohne dass kommerzieller Code in
  diesem Repo liegt.

## Offen / mögliche nächste Schritte

- **Karten-Geländeeditor** (Raster malen: Wasser/Wald/Gebirge/Weg/Siedlung +
  platzierbare Symbole) — eigenes Subsystem neben der bestehenden
  Pin-auf-Bild-Karte; bräuchte neue Schema-Felder (mapCells/mapSymbols).

## Konventionen für die Umsetzung

- Marker-/Pin-Positionen als **Prozentwerte** (responsiv).
- **Spielleiter-Modus** (volle Bearbeitung, DM-Inhalte sichtbar) vs.
  **Spieler-Build** (DM-Inhalte per Whitelist entfernt).
- Neue Entitätsart / neues Feld: `types.ts` → `schemas.ts` →
  `entityConfig.ts` (Registry) → ggf. `playerFilter.ts` (Whitelist bewusst
  setzen) → i18n `en.ts`. Schritt-für-Schritt in ARCHITECTURE.md.
- Icons als schlanke Line-SVGs (lucide-react), kein Emoji.
