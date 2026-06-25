# Interior Studio

KI-Raumdesign & begehbare Wohnungen — **offline, BYOK, ohne Konto/Server**.
Claude plant (liest Grundrisse → Räume), Gemini/Nano Banana rendert, der Browser ist die Engine.

## Was es kann

1. **Bilder erzeugen & Räume redesignen** — Text→Bild oder eigenes Foto + Anweisung (Wände/Fenster bleiben, neu eingerichtet).
2. **Wohnung aus Grundriss** — Grundriss hochladen → Claude liest die tatsächlichen Räume (1:1 nach Aufteilung & Türen) → pro Raum ein 360°-Panorama → **begehbare Wohnung**.
3. **Möbel verorten → Einkaufsliste** — Pins im Panorama, Spec-Cards, Budget-Ampel, eigene Kataloge (JSON/CSV).

## Starten

**A) Lokaler Server (empfohlen, volle Funktion):**
```bash
./START.command           # macOS (Doppelklick)
# oder:
python3 -m http.server 8765 --directory .
```
Dann **in Safari** `http://localhost:8765/index.html` öffnen. Oben rechts die zwei Keys eintragen
(Gemini: aistudio.google.com/apikey · Claude: console.anthropic.com) — bleiben nur lokal im Browser.

**B) Eine Datei zum Verschicken (WhatsApp/Mail/USB):**
```bash
python3 tools/build-single.py     # -> dist/Interior-Studio.html (~1,5 MB, alles inline)
```
Empfänger öffnet die Datei per **Doppelklick** (`file://`) und trägt eigene Keys ein. Demo-Begehung läuft sofort ohne Key.

## Projektstruktur

| Datei | Zweck |
|-------|-------|
| `index.html` | Shell + Tabs (Projekte · KI-Studio · Architekt · Begehung · Kataloge · Hilfe) |
| `app.js` | Orchestrierung: Tabs, State, Verdrahtung, Wohnung-Pipeline |
| `claude.js` | Anthropic-Direktaufruf (BYOK), liest Grundriss & plant Räume |
| `banana.js` | Gemini-Bild (Nano Banana 2), Panorama-Rendering |
| `tour.js` | Marzipano-Begehung: Equirect-Kugel, Standort-Hops, Möbel-Pins |
| `catalog.js` / `catalogs.js` | Produktdaten (Demo) & offenes Import-Format (JSON/CSV) |
| `project.js` | `.studio.json` speichern/laden |
| `icons.js` | Icon-Set (Lucide, offline) — generiert |
| `style.css` | Design-Tokens & Layout |
| `tools/build-icons.py` | `icons.js` aus echten Lucide-ISC-Pfaden bauen |
| `tools/build-single.py` | Einzeldatei `dist/Interior-Studio.html` bauen |
| `vendor/marzipano.js` | 360°-Engine (MIT/Apache, offline) |

## Build-Skripte

```bash
python3 tools/build-icons.py     # icons.js (Lucide v1.21.0, ISC) neu generieren
python3 tools/build-single.py    # dist/Interior-Studio.html (selbsttragend)
```

## Ehrliche Grenzen

- **Begehung = 360°-Panorama-Tour:** umsehen + Raum-für-Raum springen. Freies Umherlaufen (echtes 6DoF-3D) ist als **Phase 2** geplant (Wand-Extrusion aus dem Grundriss, Three.js liegt bereits bei).
- **KI-Bilder sind nicht maßstabstreu** — gut für Stil & Wirkung, nicht für exakte Maße/Abnahme.
- **`file://` + Safari:** Keys werden teils nicht über Neustarts gespeichert (App läuft trotzdem; Keys ggf. erneut eintragen). Dauerhaftes Sichern von Projekten: Export (`.studio.json`).

## Lizenzen Dritter

- Icons: [Lucide](https://lucide.dev) — ISC.
- 360°-Engine: [Marzipano](https://www.marzipano.net) — Apache-2.0.
