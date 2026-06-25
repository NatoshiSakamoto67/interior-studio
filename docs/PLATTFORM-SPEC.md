All load-bearing facts confirmed against the real source:

- `store` wrapper: try/catch-defensive localStorage, keys `is_key/is_model/is_ckey/is_cmodel/is_catalogs`.
- `Claude.call({system, content, maxTokens})` — `content` is a parts-array, `img()` builds base64 image parts, `Claude.parseJSON()` strips fences. **`messages` is hardcoded to a single `{role:"user", content}`** — confirms the "no history" gap.
- `Banana.generate({prompt, aspect, resolution, images})` — `images` array carries reference images.
- Catalog item: `gid`, `w/d/h`, `maße`, `material`, `props[]`, `brand`, `cat`, `currency`. No `brandClass/emission/loadKg/cert` today — confirms the audit's optional additive fields.
- Path is `/Users/davidoff/Desktop/Interior-Studio/`, and there's already a `docs/STUFE-2-SPEC.md` + `docs/BERUF-UND-ROADMAP.md`.

I have everything needed. Delivering the consolidated spec.

---

# Interior Studio — Plattform & Doku (Konsolidierte, phasierte Spec)

Stand 2026-06-25 · reine Spezifikation, keine Datei geändert · alle Pfade absolut unter `/Users/davidoff/Desktop/Interior-Studio/`

> **Pfad-Korrektur vorab:** Die fünf Einzeldesigns nannten `/Users/davidoff/interior-studio/`. Der reale Projektort ist `/Users/davidoff/Desktop/Interior-Studio/`. Alle Pfade unten sind korrigiert. Verifiziert im Quelltext: 5 Tabs (`studio/arch/walk/katalog/help`), `IS.gallery` In-Memory (app.js:15), `cart` als lokales `const` (app.js:457), hartkodierte Geometrie `-1.4+k*1.5` (app.js:413) und `-1.4,0.2` (app.js:292), `sendChat` single-shot ohne `messages`-History (claude.js:13), `store` try/catch-Wrapper (app.js:6-10), `Claude.call({system,content})` + `img()` + `parseJSON()` (claude.js), `Banana.generate({prompt,aspect,resolution,images})` (banana.js), Katalog-Item ohne Norm-Felder (catalogs.js:24-48).

## Leitprinzipien (die ganze Spec hängt an diesen vier Wahrheiten)

1. **`file://`-Realität:** Auf USB gibt es faktisch nur `localStorage`. `caches` ist unter `file://` in Safari `undefined`, IndexedDB unzuverlässig. Daraus folgt hart: **localStorage = nur Metadaten + Thumbnails; Bild-Bytes = Session-only; dauerhafte Bildsicherung ausschließlich per Export-Download.** Jedes „Bilder überleben den Reload"-Versprechen ist gestrichen bzw. nur als http-localhost-Bonus markiert.
2. **Nano-Banana-Bilder sind nicht maßstabs- und nicht geometrietreu.** Das ist die gemeinsame Wurzel der Grenzen von Einfügemaske (optisch) und Audit (haftungsrelevant). Wird überall offen benannt, nirgends kaschiert.
3. **Eine Wahrheitsquelle je Achse:** Bytes liegen genau einmal (content-adressiert), referenziert per Hash — nie doppelt im Projekt-Objekt. Tabs/Doku/Onboarding lesen aus je einer Registry.
4. **Ehrliches Naming:** Kein „lokale Bearbeitung" (es ist Crop-Recomposite), kein „DIN-Audit/Norm-Check" (es ist „Norm-Hinweise / Entwurfs-Vorprüfung").

---

## Bereich 1 — Plattform-/Navigations-Umbau (Reiter, Settings, Wissensbasis)

**Aufwand: L** (in Teilschritte zerlegt, siehe Phasen — nicht als ein Sprung bauen)

### Neue Tab-Liste (NAV-Registry als einzige Wahrheitsquelle)

Heute hartkodiert in `index.html:21-25` + `showTab()` (app.js:55). Wird ersetzt durch eine Registry `NAV = [{v, icon, label, panel}]`, additiv eingeführt (alte Selektoren als Fallback, bis jeder Tab einzeln umgestellt und klick-getestet ist).

| # | `v` | Icon (Name aus Bereich 4) | Label | Herkunft |
|---|------|------|-------|----------|
| 1 | `projects` | `folders` | Projekte | NEU (Container/Heim) |
| 2 | `studio` | `palette` | Studio | KI-Studio + Architekt verschmolzen |
| 3 | `walk` | `compass` | Begehung | bleibt, projektgebunden |
| 4 | `gallery` | `image` | Galerie | aus In-Memory `IS.gallery` → persistent+durchsuchbar |
| 5 | `katalog` | `sofa` | Kataloge | bleibt nahezu unverändert |
| 6 | `assistant` | `message-square` | Assistent | freier Chat aus Architekt herausgelöst |

Nicht-Tab-Einträge im Header: **Projekt-Umschalter** (`▾`-Dropdown) + **Settings-Drawer** (`settings`, Overlay) + **Key-Status-Punkt** (`key`, grün/grau statt Text-Button).

**Studio-Verschmelzung:** `#studioMode` von 2 auf 3 Segmente (Bild · Redesign · Wohnung). Im Wohnung-Modus rendert das Architekt-Markup (`buildApartment`, Grundriss-Upload, Plan-Fortschritt). „Beispiele & Hilfe" entfällt als Top-Tab → Beispiel-Prompts (`EXAMPLES`, app.js:521) wandern als Studio-Vorlagen, `renderHelp`-Inhalt in den Settings-Drawer + neuen Wissensbasis-Reiter.

### Settings-Drawer (ersetzt das `#keyModal`)

Sektionen: **Keys** (`#keyInput`/`#ckeyInput` — IDs bleiben, nur umgruppiert → minimiert app.js-Churn) · **Modelle** (`#modelInput`/`#cmodelInput`) · **Optionen** (Default-Auflösung/-Format, Auto-Rotate-Default, Reduced-Motion, Voice-Sprache — heute hart `de-DE`) · **Daten** (Export/Import/„alles löschen"/Speicherbelegung) · **Hilfe & Beispiele**. `#needkey`-Banner zeigt künftig auf Drawer-Sektion Keys.

### Dateien / Funktionen

- **NEU** `/Users/davidoff/Desktop/Interior-Studio/projects.js` — `window.Projects` (Repository, siehe Bereich 2).
- **NEU** `/Users/davidoff/Desktop/Interior-Studio/onboarding.js` — NAV-getriebene Tour (Name vermeidet Kollision mit Marzipano-`tour.js`).
- **NEU** (oder inline) `nav.js` — die `NAV`-Registry.
- **ÄNDERN** `index.html` — Tab-Leiste aus Registry generieren; `#keyModal`→Drawer; Panels `projects/gallery/assistant`; Script-Tags `projects.js`/`onboarding.js` **vor** `app.js`.
- **ÄNDERN** `app.js` — `showTab()` auf Registry-Iteration + `aria-current` + Mitten-Auto-Scroll; State-Quellen wandern (siehe Bereich 2).

### Ehrliche Grenzen (aus Critique eingearbeitet)

- **„Assistent sieht die Wissensbasis" ist ein Text-Summary, kein Bildverständnis.** Claude sieht Bilder nur, wenn man sie als Image-Parts mitschickt (Token-/Latenz-Explosion). Phase-1-Assistent liefert nur Textzusammenfassung (Raumnamen, Cart-Summe, Budget, Bildanzahl, Plan ja/nein). Im UI klar als „Textzusammenfassung des Projekts" labeln, **nicht** „Claude sieht deine Räume". Die Checkbox-Kontext-Maschine ist optionaler Ausbau, nicht Phase 1.
- **„Migration" ist irreführend** — es gibt keinen persistenten Bestand zu migrieren (alles heute In-Memory). Korrekt: beim Erststart ein leeres Default-Projekt anlegen.
- **Der Umbau ist nicht „risikoarm".** `showTab()`-Refactor bricht potenziell alle 5 Tabs gleichzeitig, während State-Quellen wandern. Mitigation: Registry additiv, Tab-für-Tab umstellen, manueller Klick-Test je Tab.
- **Speicher-Widerspruch zu Bereich 2 ist aufgelöst:** `knowledge.images` enthält **keine** dataURLs, nur Referenzen/Hashes. Bereich 2 gewinnt.

---

## Bereich 2 — Projekte speichern/laden + Galerie + Chat-Persistenz

**Aufwand: M** (Fundament) · der durchdachteste Bereich, Format ist tragend

### Format-Schema `.studio.json` (`interior-studio.project/v1`)

```jsonc
{
  "schema": "interior-studio.project/v1",
  "id": "prj_2026-06-25_a1b2c3",
  "meta": { "title", "createdAt", "updatedAt", "appVersion":"is/1",
            "thumbnail": "data:image/jpeg…",   // 128–160px, JPEG q0.7 (hart gedeckelt)
            "notes" },
  "plan": { "title","intro","style","rooms":[{ "id","prompt","neighbors":[],"map":{} }],
            "rawResponse"? },
  "nodes": [{
    "id","title",
    "image": { "mode":"ref"|"embed", "src": "blobHash"|"assets/…png"|"data:…" },
    "initialView": { "yaw","pitch","fov" },
    "floorColor": "#caa",                       // sampleFloor-Cache (Nadir-Cap)
    "links": [{ "to","yaw","pitch" }],
    "pins":  [{ "id","yaw","pitch","catalogRef":{"catalog","item"},"label","note",
                "estimated": true }]             // ⚠ Geometrie geschätzt-Flag
  }],
  "startNodeId",
  "catalogs": { "refs":["wohnen-basis"], "embedded":[{…catalog/v1…}] },
  "cart": { "currency":"EUR","budgetLimit":25000,
            "items":[{ "catalog","item","qty","unitPrice","room" }] },
            // Summen/Ampel DERIVIERT, nicht gespeichert
  "chat": { "plan":[…messages…], "free":[…messages…] },
            // message = {role,content,ts,model?}
  "galleryItemIds": ["img_…"]
}
```

### Bild-Modi (der zentrale Format-Hebel, Critique-korrigiert)

- **`ref`** — nur Schlüssel/Pfad. Für generierte Bilder real **nur als localStorage-/Session-Blob-Schlüssel** (der Browser kann unter `file://` keine `assets/*.png` schreiben). Dateipfad-`ref` gilt ausschließlich für **mitgelieferte** USB-Assets.
- **`embed`** — Base64-dataURL im JSON, selbsttragend. **Nur als Download-Blob erzeugen, nie in localStorage speichern.** Vor Embed immer JPEG q0.82 (Equirect verträgt es, 60–80 % kleiner).

### Persistenz-Layout (`store.js` kapselt)

| Key | Inhalt |
|-----|--------|
| `is_project_current` | aktives Bundle (Bilder als Session-Schlüssel, nicht eingebettet) |
| `is_project_index` | `{id,title,updatedAt,thumbnail}[]` — schnelle Liste |
| `is_gallery` | Galerie-Records (Metadaten+Tags+Thumb, **nicht** Vollbild-Bytes) |

**Quota-Strategie:** Metadaten immer localStorage. Vollbild-Bytes Session-only im RAM; persistente Sicherung = Export. `QuotaExceededError` → **sichtbarer Toast + „jetzt exportieren"-CTA, niemals fail-silent**; „gespeichert ✓" nur nach erfolgreichem Write. SHA-Hash nur beim Export/expliziten Save (nicht im 2 s-Auto-Save → sonst Main-Thread-Block); im Auto-Save billiger Pseudo-Key (Zeitstempel+Größe). Auto-Save debounced 2 s, best-effort.

### Galerie (`gallery.js`)

Record: `{id, blobHash, thumb(256px JPEG), kind:"panorama"|"render"|"edit", createdAt, projectId, roomId?, tags[], prompt, source, meta{w,h,ratio}}`. **Auto-Tagging** aus Projekt-Titel/Raum/`plan.style`/Datum/`kind`; **Prompt-Text volltext-durchsuchbar** (ehrlichste Suche, da sie beschreibt was im Bild ist). Filter: Projekt/`kind`/Datum/Tag-Chips, alles client-seitig deriviert, optional URL-State (`#gallery?tag=hell`). Aktionen: Öffnen · In Begehung verwenden · Als Referenz · Tags · Download · Löschen (mit Blob-GC).

### Chat-Persistenz (kein eigenes `chat.js` — YAGNI)

Verlauf lebt in `chat.plan[]`/`chat.free[]` im Bundle, getrennt je `project.id`; freie Chats ohne Projekt → `is_chat_scratch`. **Funktionsverbesserung:** `claude.js` schickt künftig `messages[]` statt einem Single-Shot-Prompt (heute hartkodiert claude.js:13 `messages:[{role:"user",content}]`) — Trimming auf letzte N Turns in `claude.js`.

### Dateien / Funktionen

- **NEU** `store.js` (`IS.store`: get/set/del + putBlob/getBlob), `project.js` (`IS.project`: serialize/load/validate/migrate/export/import — baut auf vorhandenem `Tour.load()`), `gallery.js` (`IS.gallery`).
- **ÄNDERN** `app.js` — `cart` (457)/`budget`/`renderCart` → `Projects`; `buildApartment`-Plan/-Nodes → `Projects.setPlan/addRoom`; Gallery-Funktionen (97-132) → `Projects.addImage`. `claude.js` — `messages[]`-History.
- **Ladereihenfolge:** `… banana.js → store.js → claude.js → project.js → gallery.js → tour.js → app.js`.

### Ehrliche Grenzen

- **Bild-Bytes überleben Reload nicht garantiert** — Default akzeptiert („Session + Export reicht"). Nur Thumbnails (256px) persistent.
- **`caches`/IndexedDB unter `file://` wertlos** auf USB — kein Byte-Persistenz-Pfad dorthin bauen.
- **Pin-`yaw/pitch` verlustfrei gespeichert, aber nicht korrekter** (`estimated:true`-Flag). Echte Geometrie kommt erst aus Bereich 3.
- **Embed-Bundle mit 6 Panoramen kann trotz JPEG mehrere MB groß sein** (Mail-Grenze) — akzeptierter Preis für „ein File, alles drin".
- Fehlender Katalog beim Import → Pin-Markierung „Katalog fehlt", kein Crash.

---

## Bereich 3 — Live-Einfügemaske („Markieren & Sagen")

**Aufwand: L**

### Grundwahrheit

Gemini/Nano Banana **maskiert nicht** — kein `mask`-Feld, gibt immer ein neues Full-Frame. „Lokale Bearbeitung" = **Crop-als-Maske + clientseitiger Feather-Recomposite:** betroffenen Equirect-Sektor herausschneiden → nur diesen Crop von Gemini neu gestalten (Referenz = Crop + Katalog-Artikel) → per Canvas mit Feather zurückblenden. **Garantiert:** kein Pixel außerhalb des Polygons wird überschrieben. **Nicht garantiert:** dass die Naht unsichtbar ist.

### Flow

`✏️ Markieren`-Toggle (`IS.editMode`) → Auto-Rotate pausiert, Klicks zeichnen Lasso/Box → Punkte sofort via `view.screenToCoordinates()` in **Yaw/Pitch** gespeichert (klebt am Panorama, nicht am Screen), SVG-Overlay bei jedem `viewChange` neu projiziert → Kontext-Panel `[+Einfügen]`(Katalog-Picker) / `[−Entfernen]` / `[Text]` / `[↺Variante]` → Spinner auf der Markierung → Vorher/Nachher-Wipe → `[Übernehmen]/[Verwerfen]`. Bei Übernehmen: **Pin im Centroid** (echtes Yaw/Pitch, ersetzt `-1.4+k*1.5`), **Cart-Buchung** (+1 bei Einfügen), Node-Bild-Tausch, Galerie-Frame, Undo-Push.

### Mathe (der Kern)

**Yaw/Pitch → Equirect-Pixel** (W=Breite, H=W/2):
```
u = (yaw + π)/(2π)      px = u*W
v = (π/2 − pitch)/π     py = v*H
```
**Crop-Sektor** mit Pflicht-Padding (Gemini braucht Umgebungskontext):
```
padU = clamp(0.25*(maxU−minU), 0.04, 0.15)   // padV analog
cropU0 = clamp(minU−padU, 0, 1) …
cropPxW = round((cropU1−cropU0)*W)           // cropPxH analog
```
**Recomposite:** Gemini-Ergebnis an `(cropU0*W, cropV0*H)` in eine **Kopie** der Equirect zeichnen, **radiale Alpha-Feather-Maske** (innerhalb Original-Polygon volle Deckkraft, im Padding-Ring weich auf 0). **Luminanz-/Gain-Offset-Match Pflicht** (nicht optional) vor dem Blend, sonst sichtbare Naht.

**Sonderfälle:** Yaw-Naht ±π → Equirect horizontal rollen (eine Codepfad-Variante). Pol-Nähe → `cropV` auf **±70° pitch cappen**, sonst Warnung. Mini-Region → Minimum 6° Yaw-Breite.

### Dateien / Funktionen

- `tour.js`: `beginEdit/addEditPoint/closeEditRegion/projectRegionToSvg`, `yawPitchToEquirect`, `regionToCropRect`, `cropEquirectSector`, `recompositeSector`, `regionCentroidYawPitch`, `replaceNodeImage`.
- `banana.js`: `editSector(cropDataURL, refArticleImg|null, instruction)` — Reuse von `generate({images:[crop, artikel]})`, nur Prompt-Builder + 2-Referenz-Pfad.
- `app.js`: `wireEditMode/openSectorCommandPanel/runSectorEdit/commitSectorEdit/discardSectorEdit/addPinFromRegion/pushUndo/popUndo`.

### Ehrliche Grenzen (aus Critique verschärft)

- **„Außerhalb unverändert" ≠ „nahtlos".** Wording im UI trennen. Pro Edit ein Disclaimer „KI gestaltet den Bereich neu — Naht/Ergebnis kann abweichen".
- **Roher Equirect-Crop ist perspektivisch verzerrt** → eingefügte Möbel können sich „biegen". Entzerrung ist V2 (bewusst weggelassen). **Wände/fronto-parallele Flächen zuerst** (geringe Verzerrung, brauchbar); **Boden/Pol-Nähe als ungenau warnen/sperren**.
- **Pin-Centroid korrekt relativ zur Hand-Markierung** auf verzerrter Kugel — besser als `-1.4+k*1.5`, nicht absolut korrekt.
- **Marzipano-Volltextur-Tausch ruckelt/leakt** bei Multi-Edit (Safari) → Preview auf reduzierter Arbeitstextur, Volltextur-Tausch nur bei Übernehmen, View beibehalten.
- **In-Memory, kein Reload-Überleben** → an Bereich 2 koppeln, sonst gehen teuer erzeugte Edits sofort verloren.

---

## Bereich 4 — Icon-System (Emojis raus) + komplette Doku

**Aufwand: Icons S (mechanisch) · Doku M**

### Icon-System

`icons.js` mit Registry `PATHS = {name → pathMarkup}` + einem Helfer `icon(name, opts)` → inline-SVG (24×24 viewBox, `stroke="currentColor"`, `1em`-Größe erbt Schriftgröße, a11y-Default `aria-hidden` bzw. `role="img"`+`aria-label` bei `title`). Kein Webfont, kein CDN (`file://`/USB-fest, keine CSP-Probleme). **Original-Lucide-Pfade direkt übernehmen** (ISC-Lizenz, Attribution im Header) — **nicht** nachzeichnen (Critique: Proportions-/Pfadfehler). `_missing`-Platzhalter + `console.warn` statt Crash. DOM-Variante `iconEl()` bevorzugt vor `innerHTML`.

**Mapping (Auszug, vollständig im Einzeldesign):** 🎨→`palette` · 🏗️→`building-2` · 🧭→`compass` · 🗂️→`folders` · 📘→`book-open` · 🔑→`key` · 📍→`map-pin` · 👣→`footprints` · 📐→`ruler` · 🖼️→`image` · 🛒→`shopping-cart` · 🚦→`gauge` · 💬→`message-square` · ⚠️→`alert-triangle` · 🛋️→`sofa` · 🧱→`brick-wall` · 🐟→`fish`. CSS-Hooks `.icon` + Ampel-Farb-Tokens `--ok/--warn/--err`. **Vollständigkeits-Test:** jeder UI-`name` ∈ Registry, DOM-Regex `\p{Extended_Pictographic}` = 0 Treffer.

### Doku

**Single Source = `docs.js`** (Inhalte als JS-Strings, da `fetch('docs/*.md')` unter `file://` scheitert). **Kein `docs/*.md`-Schattenbaum ohne Build** (Critique: das ist exakt der Doppelpflege-Drift, den `renderHelp` heute schon hat). Falls `.md` gewünscht: `.md` = Quelle + 5-Zeilen-Node-Script generiert `docs.js` — sonst gar kein `.md`. Neuer Reiter „Wissensbasis" (`file-text`), gespeist aus `docs.js`, Sidebar aus Doku-Registry `DOCS=[{id,icon,title}]`. `renderHelp` wird zur reinen Beispiel-Fläche entkernt. **Doku zuletzt schreiben** (nach Persistenz/Maske), sonst dokumentiert sie veraltete Zwischenstände.

#### ASCII-Datenfluss (Flow A — Architekt baut Wohnung)

```
 Nutzer-Wunsch (Text)
        │
        ▼
 [app.js buildApartment] ──PLAN_SYS (strikt JSON)──► [claude.js call()] ──HTTPS──► api.anthropic.com
        │◄──────────────── JSON (```-fenced) ───────────────────────────────────────┘
        ▼  Claude.parseJSON()  →  { title, intro, style, rooms[] }
 ┌─ Schleife über rooms ───────────────────────────────────────────────┐
 │  refImg = vorheriges Panorama (Stil-Konsistenz; erstes = none)        │
 │     ▼  [banana.js generate({prompt, images:[refImg]})] ──► Gemini ──► 21:9-Bild
 │     ▼  padTo2to1()  21:9 → 2:1 equirect (Naht-Blend)                  │
 │     ▼  [tour.js addNode()]  EquirectGeometry-Node                     │
 │     neighbors → [tour.js link()]  Boden-Pfeil (yaw=-1.4+k*1.5 ⚠geschätzt)
 │     pins      → [tour.js addPin()]  (-1.4,0.2 ⚠geschätzt)             │
 └───────────────────────────────────────────────────────────────────────┘
        ▼  [tour.js load()] + showTab('walk') → ensureTour() (lazy Marzipano)
        ▼  In-Memory: IS.gallery / Nodes / Pins   ⚠ KEIN localStorage → Reload = weg
                                                  (Bereich 2 behebt: Metadaten persistent, Bytes Session)
```

(Flows B Begehung-Hop, C Katalog→Cart→Budget, D Keys/BYOK analog im Einzeldesign — alle verifiziert gegen `scene.switchTo` 700 ms, `sampleFloor`/Nadir-Cap, `window.CATALOG`-Merge, Keys `is_key/is_model/is_ckey/is_cmodel`.)

#### Architektur (Kurzform)

Reine Client-/BYOK-SPA, no build, `file://`-tauglich. `index.html` lädt feste Reihenfolge → `app.js` = Orchestrator (Tabs/State/Verdrahtung) → Module: `banana.js` (Gemini-Bild), `claude.js` (Anthropic direkt, `anthropic-dangerous-direct-browser-access`), `tour.js` (Marzipano, Equirect, View 14–100°, Hops, Nadir-Cap), `catalogs.js` (Schema v1, 3 Builtins, merge→`window.CATALOG`), `catalog.js` (Legacy-7-Item, Demo). **Toter Pfad, nicht eingebunden:** `depth3d.js`, `scene3d.js` — entfernen oder reaktivieren.

#### Code-Struktur (Status je Datei)

`index.html`/`app.js`/`tour.js`/`claude.js`/`banana.js`/`catalogs.js`/`style.css` = verdrahtet · `catalog.js` = legacy aktiv · `vendor/marzipano.js` = vendor · **NEU designt:** `projects.js/store.js/project.js/gallery.js/icons.js/docs.js/audit.js/onboarding.js` · **TOT:** `depth3d.js/scene3d.js`.

### Ehrliche Grenzen

- Doku-Doppelpflege vermieden (nur `docs.js`).
- Bestehende `docs/STUFE-2-SPEC.md` + `docs/BERUF-UND-ROADMAP.md` sind Quelldokumente — die In-App-`docs.js` muss daraus abgeleitet, nicht parallel gepflegt werden.

---

## Bereich 5 — DIN/Recht-Audit-Skill in-App („Norm-Hinweise / Entwurfs-Vorprüfung")

**Aufwand: M (Code) · KRITISCH bei Scope-Disziplin** — höchstes Haftungsrisiko der fünf Bereiche

> **Umbenennung Pflicht (Critique):** nicht „DIN-Audit"/„Norm-Check" (klingt nach Prüfsiegel/Abnahme), sondern **„Norm-Hinweise (Entwurfs-Vorprüfung)"**.

### Prüfumfang — hart zweigeteilt

**Belastbarer Kern (Katalog-faktenbasiert):**
| ID | Titel | Quelle | Prüfung |
|----|-------|--------|---------|
| R02 | Ergonomie/Möbelmaße | Katalog | Sitzhöhe/Arbeitshöhe/Durchgänge aus `w/d/h` |
| R04 | Emissionen | Katalog | E1/Blauer Engel — fehlt Feld → „Datenlücke", **nie „konform"** |
| R05 | Standfestigkeit/Zertifikat | Katalog | Tragfähigkeit/EN-Zertifikat aus Katalogfeld |
| R07 | Doku-Vollständigkeit | Katalog | Datenblatt/Zertifikat vorhanden ja/nein |

**Schwächerer, deutlich getrennter Block (Bild-Hinweise — pro Befund Label „Schätzung aus generiertem Bild, nicht gemessen"):**
| R01 | Barrierefreiheit | Türbreite/Bewegungsfläche **am Katalog-Möbelmaß kalibriert geschätzt** — nie als gemessene Zahl |
| R03 | Brandschutz | **nur** Baustoffklasse Polster/Vorhänge aus Katalog — **keine** Rettungsweg-Geometrie aus Bild |

**Gestrichen (Critique — methodisch nicht ableitbar):** lx-Beleuchtungsstärke (R06, nur qualitativ „wirkt unterbeleuchtet", kein Lux/Norm-Soll) · T60-Akustik (R06, gestrichen) · Brandschutz-Rettungswegbreite/Bestuhlungsdichte aus Panorama (höchste Fallhöhe) · B2B-„ausschreibungsfähige Maße aus Bildern" (R07, gestrichen — nur Katalog-Maße belastbar).

### Claude-Ausführung

`audit.js` → `window.Audit` (`NORMS`-Registry, `collect/run/render/exportMd/exportJson`). Nutzt vorhandene multimodale `Claude.call({system, content})` mit `img()`-Parts (verifiziert claude.js:7,9,39) + `Claude.parseJSON()` — **keine Änderung an `claude.js`**. Content-Array: aktive Normen (Text) + Scoping (Text) + Katalogtabelle (Text, billig) + Panorama-`img()`-Parts mit Label dahinter. `AUDIT_SYS` eiserne Regeln: keine DIN/EN-Nummern erfinden (nur `Audit.NORMS`-Whitelist, client-seitig gegen Liste prüfen, Unbekannte verwerfen) · jeder Befund braucht `fundstelle` (`bild:<label>` und/oder `katalog:<gid>`) sonst verworfen · Bildmaße sind Schätzungen „am realen Plan zu verifizieren" · fehlendes Feld = „nicht bewertbar/Datenlücke" · zweiachsige Severity (Sicherheit/Haftung × Konformität, schärfste gewinnt). Bildanzahl/Auflösung gedeckelt (Token).

**Katalog-Schema rückwärtskompatibel erweitern** (optional, additiv in `normalizeItem`): `brandClass/emission/loadKg/cert` — fehlen sie, ist das selbst ein Befund. Picker unverändert.

### Disclaimer (nicht ausblendbar, erste Zeile im Export-Markdown)

> Keine Abnahme · kein Statik-/Brandschutz-/Sachverständigengutachten · keine Rechtsberatung (RDG) · strukturierte Vorarbeit zur Vorlage bei Fachplanern/Prüfern.

### Ehrliche Grenzen (Critique — die rechtliche Sprengstelle)

- **DIN-Maße aus generiertem Bild = methodisch zirkulär:** das Bild hat die Maße frei erfunden (Nano Banana nicht maßstabstreu), der „kalibrierte" Maßstab suggeriert Genauigkeit, die das Medium nicht hat. → Maßbefunde nie als Zahl-mit-Norm-Soll ohne Pro-Befund-Label „geschätzt, nicht gemessen".
- **Generierte Räume ≠ Bauwerk** · **Katalogdaten = Selbstauskunft** · **keine Bauvorlageberechtigung**.

---

## Empfohlene Bau-Reihenfolge (Phasen)

| Phase | Inhalt | Aufwand | Begründung |
|-------|--------|---------|------------|
| **P0** | **Persistenz-Fundament minimal:** `store.js` + `project.js` + `gallery.js`; `cart/rooms/plan/gallery`-Metadaten persistent, Bytes Session-only, Export/Import. **Hier anhalten und verifizieren** (Klick-Test je heutigem Tab) bevor UI umgebaut wird. | M | Behebt sofort den Reload-Datenverlust (höchster Nutzen, kleinste Bruchfläche). Löst den Speicher-Widerspruch Bereich 1↔2 zugunsten Bereich 2. |
| **P1** | **Icons** (`icons.js`, Original-Lucide-Pfade, Emoji-Migration als ein Commit + Vollständigkeits-Assert). | S | Rein mechanisch, risikolos, schnell verifizierbar. |
| **P2** | **Plattform-Umbau:** NAV-Registry additiv → `showTab()`-Refactor Tab-für-Tab → Galerie- + Projekte-Reiter sichtbar → Studio-Verschmelzung → Assistent herauslösen (Text-Summary) → Settings-Drawer. `messages[]`-History in `claude.js`. | L | Erst nach stabilem Persistenz-Fundament. |
| **P3** | **Einfügemaske** (Schritte 1–3 = reine Canvas-Mathe offline testbar, dann `editSector`, dann commit/Pin/Cart/Undo, Caps zuletzt). An P0 gekoppelt. | L | Liefert echte Pin-Geometrie; braucht Persistenz, sonst Edit-Verlust. |
| **P4** | **Audit entschärft** (`audit.js`, Katalog-Kern + getrennter Bild-Hinweis-Block, lx/Akustik/Brandschutz-Geometrie gestrichen, Disclaimer als erste Zeile, Umbenennung). | M | Zuletzt, weil haftungssensibel und auf Katalog/Tour/Persistenz aufbauend. |
| **P5** | **Doku** (`docs.js` Single-Source, Wissensbasis-Reiter, ASCII-Flows, Onboarding). | M | Ganz am Ende — sonst dokumentiert sie veraltete Zwischenstände. |

## Offene Fragen (vor Bau zu klären)

1. **Betriebsmodus-Priorität:** Primär USB/`file://` (dann Byte-Persistenz unmöglich, nur Export) oder localhost/http (dann IndexedDB als echter Byte-Pfad möglich)? Bestimmt, ob „Bilder überleben Reload" überhaupt anbietbar ist.
2. **Studio-Verschmelzung jetzt oder später?** Architekt→Wohnung-Modus ist der riskanteste UI-Schritt — in P2 ziehen oder als eigene Phase P2b isolieren?
3. **Assistent-Bildverständnis:** reicht dauerhaft der Text-Summary, oder soll später gezielt 1–2 Bilder als Image-Parts mitgehen (Token/Kosten-Budget klären)?
4. **`docs/*.md`-Quelle:** vorhandene `STUFE-2-SPEC.md`/`BERUF-UND-ROADMAP.md` als Doku-Quelle behalten + Mini-Generator nach `docs.js`, oder `docs.js` von Hand als alleinige Quelle?
5. **Toter 3D-Pfad** (`depth3d.js`/`scene3d.js`): löschen oder reaktivieren — entscheidet, ob er in Architektur-Doku als „aufgegeben" oder „geplant" steht.
6. **Audit-Katalogfelder:** Wer pflegt `brandClass/emission/loadKg/cert` in die Kataloge? Ohne Datenpflege bleibt der belastbare Kern (R04/R05/R07) leer und der Audit zeigt fast nur „Datenlücke".
7. **Demo-Begehung** (`catalog.js`-Legacy): in ein flüchtiges Pseudo-Projekt „Demo" (key-frei, nicht persistiert) oder ganz aus dem Projektmodell heraushalten?

Relevante Pfade: `/Users/davidoff/Desktop/Interior-Studio/{index.html,app.js,tour.js,claude.js,banana.js,catalogs.js,catalog.js,style.css,docs/STUFE-2-SPEC.md,docs/BERUF-UND-ROADMAP.md}` · neu vorgeschlagen `{projects.js,store.js,project.js,gallery.js,icons.js,docs.js,audit.js,onboarding.js,nav.js}` · tot `{depth3d.js,scene3d.js}`. Keine Datei wurde geändert — dies ist reine Spezifikation.