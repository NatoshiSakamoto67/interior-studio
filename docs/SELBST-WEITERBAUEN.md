# Selbst weiterentwickeln

*Wie man Interior Studio anpasst, erweitert und umbaut. Geschrieben für jemanden, der ein bisschen programmieren kann — oder einen Entwickler an der Hand hat.*

---

## Die Grundidee: keine Blackbox

Interior Studio hat **keinen Build-Schritt, keine Framework-Magie, kein `npm install`**. Es ist reines HTML, CSS und JavaScript — Dateien, die ein Browser direkt liest. Genau das macht es hackbar: Du öffnest eine Datei, änderst eine Zeile, lädst die Seite neu, fertig.

Drei Wahrheiten, an denen alles hängt:

1. **Läuft im Browser, offline.** Kein Server, kein Konto. Die App kann sogar als **eine einzige `.html`-Datei** weitergegeben werden.
2. **BYOK — deine eigenen Schlüssel.** Die KI kommt von Google (Gemini/Nano Banana, Bilder) und Anthropic (Claude, Planung). Deine Schlüssel bleiben lokal im Browser.
3. **`file://`-Realität.** Wird die App per Doppelklick geöffnet, sperrt Safari einige Speicher-Funktionen. Dauerhaft sichern = **Export** als Datei. (Mehr dazu in der Plattform-Spezifikation.)

## Der Bauplan — welche Datei was tut

| Datei | Zuständig für |
|-------|---------------|
| `index.html` | Das Gerüst: Kopfzeile, Reiter, alle Bereiche. Hier hängen die Bausteine zusammen. |
| `app.js` | Der Dirigent: Reiter-Wechsel, Zustand, Verdrahtung, die „Wohnung-bauen"-Pipeline. |
| `style.css` | Das gesamte Aussehen: Farben, Schrift, Abstände, Bewegung (Design-Tokens ganz oben). |
| `claude.js` | Ruft Claude auf — liest Grundrisse und plant die Räume. |
| `banana.js` | Ruft Gemini/Nano Banana auf — rendert die Bilder und Panoramen. |
| `tour.js` | Die 360°-Begehung: Panorama-Kugel, Standort-Sprünge, Möbel-Pins. |
| `model3d.js` | Das begehbare 3D-Modell aus dem Grundriss (Three.js). |
| `catalog.js` / `catalogs.js` | Produktdaten (Demo) und das offene Import-Format (JSON/CSV). |
| `store.js` / `project.js` / `projects.js` | Speichern, Laden, Projektbaum. |
| `gallery.js` | Die Galerie der erzeugten Bilder. |
| `icons.js` | Das Icon-Set (Lucide, offline) — wird generiert. |
| `docs.js` / `docs-data.js` | **Dieser Unterlagen-Reiter** und seine Inhalte. |
| `tools/build-*.py` | Kleine Skripte, die generierte Dateien neu bauen. |
| `vendor/` | Fremd-Bibliotheken (Marzipano für 360°, Three.js für 3D). |

## Kochrezepte — die häufigsten Änderungen

### Das Aussehen ändern
Öffne `style.css`. Ganz oben stehen die **Design-Tokens** (`:root { --bg, --accent, --radius … }`). Ändere dort eine Farbe, und sie ändert sich überall. Das ist der schnellste Hebel für einen anderen Look.

### Eigene Produkte / Kataloge einpflegen
Du musst **nichts programmieren**. Im Reiter **Kataloge** lädst du eine `JSON`- oder `CSV`-Datei mit deinen Produkten (Name, Maße, Material, Farbe, Preis, Lieferant). Eine Vorlage liegt dort zum Download bereit. Wichtig: **proprietäre Hersteller-Kataloge nur selbst importieren, nicht weitergeben** — das ist ein Rechtsthema, kein Geschmacksthema.

### Was die KI tut / wie sie antwortet ändern
Die „Anweisungen an die KI" sind Text im Code:
- **Claude** plant die Räume — die Regeln stehen in `app.js` (der große `PLAN_SYS`-Text). Hier legst du fest, wie Grundrisse gelesen und Räume angelegt werden.
- **Gemini** rendert die Bilder — der Prompt-Aufbau steckt in `banana.js`.

### Ein Dokument zu diesem Reiter hinzufügen
1. Lege eine neue `.md`-Datei in `docs/` an.
2. Trage sie in `tools/build-docs.py` in die `MANIFEST`-Liste ein (Titel, Kategorie, Icon).
3. Führe `python3 tools/build-docs.py` aus — das erzeugt `docs-data.js` neu.

> Wichtig: Die `.md`-Dateien sind die **Quelle**. Bearbeite niemals `docs-data.js` von Hand — es wird überschrieben.

### Alles zu einer Datei verpacken (zum Verschicken)
```bash
python3 tools/build-docs.py      # Unterlagen einbacken
python3 tools/build-single.py    # -> dist/Interior-Studio.html (alles inline)
```
Die erzeugte Datei in `dist/` enthält **alles** — Code, Bilder, Demo, diese Unterlagen. Per Mail/USB weitergeben, Empfänger öffnet sie per Doppelklick.

## Starten zum Entwickeln

```bash
# Lokaler Server (empfohlen — volle Funktion, Persistenz):
python3 -m http.server 8765
# dann in Safari: http://localhost:8765/index.html
```

Auf `localhost` (statt `file://`) funktioniert die Speicherung zuverlässig — entwickle immer so.

## Wo es tiefer geht

- **Plattform-Spezifikation** — der große Bauplan: Navigation, Speicher-Architektur, die „Markieren & Sagen"-Einfügemaske, die Norm-Hinweise. Mit ehrlichen Grenzen zu jedem Bereich.
- **Umsetzungs-Spec (Stufe 2)** — der detaillierte, phasierte Umsetzungsplan mit Aufwandsschätzungen.

Beide Specs sind bewusst **selbstkritisch** geschrieben: Sie sagen nicht nur, was geht, sondern auch, was *nicht* sauber geht und warum. Das ist die ehrlichste Karte, die wir dir mitgeben können.

## Ein letztes Wort

Das hier ist ein **Prototyp** — ein guter Startpunkt, kein fertiges Endprodukt. Manches ist roh, manches bewusst weggelassen, manches als „nächster Schritt" markiert. Nimm es als Fundament. Bau dein eigenes Haus darauf.
