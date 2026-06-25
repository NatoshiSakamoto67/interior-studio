Code-Stand bestätigt. Hier die Spec.

---

# Interior Studio — Stufe 2: Umsetzungs-Spec

**Stand:** 2026-06-25 · **Zielsystem:** Offline/USB-Browser-Tool, vanilla IIFE-Module, `file://`, BYOK (Gemini + Claude) · **Verankert gegen:** realen Code in `/Users/davidoff/Desktop/Interior-Studio/` (app.js 543 Z., tour.js 178 Z., catalog.js 64 Z., banana.js 71 Z., claude.js 53 Z., index.html 257 Z.)

**Lesehilfe:** Aufwand = S (≤0,5 Tag), M (1–2 Tage), L (3–5 Tage). Jede „Ehrliche Grenze" stammt direkt aus der adversarialen Critique und ist nicht verhandelbar wegformuliert.

---

## Vorab — Drei Blocker, die VOR Bereich A–D erledigt sein müssen

Diese drei Punkte sind keine Features, sondern Korrekturen aus der Critique. Sie sind Voraussetzung, nicht Kür:

1. **Pfadfehler (S):** Das Möblierungs-Design referenziert durchgängig `/Users/davidoff/interior-studio/…` — dieser Pfad existiert nicht. Korrekt ist `/Users/davidoff/Desktop/Interior-Studio/…`. Alle Verweise unten sind bereits korrigiert.
2. **Katalog-Rechtsmodell vereinheitlichen (M):** Das Möblierungs-Design codiert echte Marken (IKEA „STRANDMON", Brillux „Creativ Kalk 1620") hart in `catalog.js`. Das ist ein **Rechtsrisiko** (§14 MarkenG, §87a UrhG, §5 UWG), kein Geschmacksthema. Verbindlich: Es gilt **ausschließlich** das Importmodell aus Bereich B. Mitgeliefert werden nur generische CC0-Vorlagen. Markennamen entstehen nur durch Nutzer-Import.
3. **Speicher-Architektur (L):** Panoramen leben heute nur im RAM (`IS.gallery=[]` bei jedem Load, `nodes[].img` als 2K-data-URLs). Bei 10+ Stationen → 150–250 MB → Safari killt den Tab. localStorage (~5 MB, unter `file://` in Safari teils ganz gesperrt) ist für Bilder ungeeignet. Erfordert lazy-build + `destroyScene` + IndexedDB. Details als Querschnittsphase P0 unten.

---

## A) Street-View-Walkthrough

**Ziel:** Wahrgenommenes „Durch-die-Wohnung-Laufen" über dichte 3DoF-Stationen + choreografierten Hop (FOV-Dolly + gleichgerichteter Yaw + Cross-Fade) + perspektivische Boden-Klickpunkte. Kein 6DoF.

### A1 — Graph-Datenmodell (Aufwand: S)

`tour.js` · `normalize()`, `load()`
- Node additiv erweitern: `pos:{x,y}` (Meter, Draufsicht), `yaw0` (Blickrichtung beim Betreten, rad), `room` (Cluster-ID).
- `links[]` um `dist`, `kind:"step"|"door"|"turn"`, `pitch` erweitern.
- **Abgeleitete Felder einmalig** in neuem `hydrateGraph()` (Aufruf am Ende von `load()`): fehlende `yaw`/`dist`/`kind` aus `pos` berechnen — Claude muss nur Position liefern, nicht jeden Tür-Yaw.
- Neue Helfer: `shortestYaw(from,to)`, `bearing(a,b)`, `easeOutCubic`.

### A2 — Dolly-Übergang (Aufwand: M)

`tour.js` · `go(i, opts)`, neu: `approachDolly()`, `dollyTransition()`
- `go(i,{dolly:true,link})`: Phase A `approachDolly()` (260 ms zur Tür drehen + FOV-IN via `lookTo`) → im Callback Phase B `dollyTransition()` (`scene.switchTo` mit custom `transitionUpdate`: FOV-OUT der neuen Szene + Cross-Fade, distanzabhängige Dauer 520–960 ms).
- Ohne `dolly` (Strip-Klick) bleibt der bestehende 700 ms-`switchTo`.
- `buildScene()`: `view` mit `yaw:node.yaw0||0` statt fix `0` initialisieren.

### A3 — Boden-Navigationspunkte (Aufwand: S)

`tour.js` · `rebuildHotspots()` (nav-Zweig) · `style.css` · `index.html`
- nav-Hotspots → `.floor-nav`-Discs mit distanzskaliertem `radius` (1100 + dist·220) und distanzkorrektem `pitch ≈ atan2(1.5, dist)`.
- CSS: pulsierende Boden-Ringe, nur `transform`/`opacity` (compositor-freundlich, web-Performance-Regel), `prefers-reduced-motion`-Guard.

### A4 — Claude plant Stationen mit (Aufwand: M)

`app.js` · `PLAN_SYS`, `buildApartment()`, `$("#loadDemo")`, `renderStationNav()`, `generateStation()`
- `PLAN_SYS`-Schema um `area`, `stations[]` (mit `sid`, `pos`, `yaw0`, `prompt`), `doors[]` (mit `to`, `fromStation`, `toStation`, `yaw`) erweitern. Dichteregel: kleiner Raum 1, normal 2, groß 3–4 Stationen; min. 1 pro Tür-Schwelle, 1 pro Funktionszone.
- `buildApartment()`: Schleife über `room.stations` statt `plan.rooms`; `prevInline`-Stilkette bleibt. Verlinkung aus `stations`+`doors`.
- Demo-Nodes (`#loadDemo`) um `pos`/`yaw0` + Intra-Raum-Stationen ergänzen, damit Begehung ohne Key erlebbar.

**Ehrliche Grenzen (A):**
- **Kein 6DoF, keine Parallaxe.** Physikalisch unmöglich aus Einzel-Equirects: kein Pixel kennt Tiefe, es gibt keine zweite Ansicht zum Triangulieren. Der FOV-Dolly *fingiert* Annäherung — bei `door`-Hops als Zoom durchschaubar. Gegenmittel: FOV-Hub-Deckel ≤0,30 rad; bei `dist>4 m` lieber zwei Stationen.
- **Layer-/Effect-Pfad nicht verifiziert (HOCH).** `dollyTransition` setzt `layer().mergeEffects({opacity})` voraus. `mergeEffects` existiert in `vendor/marzipano.js`, aber `buildScene` legt die Layer-Referenz nicht offen. **Vor Implementierung** den realen Layer-Pfad aus `createScene` erreichbar machen — sonst greift `transitionUpdate` ins Leere und der Dolly wird zum harten Cut.
- **Stations-Drift (HOCH).** Jede Station ist ein separates Generate → Boden/Wandfarbe/Licht springen am Hop. `prevInline` mildert, garantiert nicht. Echte Lösung: Stationen *eines Raums* aus *einem* Master-Generate per Outpainting/Crop, nicht N unabhängige Generates (verschiebt Mehraufwand in A4).
- **`depth3d.js`/`scene3d.js`** taugen nur für „am Stand wackeln", nicht als Weg durch die Wohnung.

---

## B) Katalog-Subsystem

**Ziel:** Offenes Importformat + generische CC0-Beispielkataloge + Such/Filter. **Rechtlicher Kern:** keine proprietären Herstellerdaten im Repo, kein Scraping. Markennamen nur als Nutzer-Freitext im eigenen Import.

### B1 — Offenes Format + neue Engine (Aufwand: L)

Neu: `/Users/davidoff/Desktop/Interior-Studio/catalogs.js` (~300–400 Z., IIFE `window.Catalogs`)
- **Envelope (JSON):** `schema:"interior-studio.catalog/v1"`, `id`, `name`, `publisher`, `license`, `source`, `currency`, `version`, `items[]`.
- **Item-Schema** (CSV-Spalten = JSON-Keys 1:1, Obermenge des heutigen `CATALOG`-Objekts): `id`✓, `name`✓, `kategorie`✓, `hersteller`, `preis`, `währung`, `maße` (string|obj), `material`, `farbe` (hex|Klartext), `lieferzeit`, `produkt_url`, `bild`, `tags`, `kind`, `props`.
- **Funktionen:** `parseJSON`, `parseCSV`, `normalizeItem(raw,catalog)` (Maß-Parser, Farb-Namens-Map, GID `katalogId:itemId`, URL-Sanitizing), `rebuildActiveCatalog()` (setzt `window.CATALOG` = Merge aller `enabled`-Kataloge → `openPicker`/`byId` bleiben gültig).
- **API:** `list()`, `importFiles(FileList)`, `importText()`, `setEnabled()`, `remove()`, `categories()`, `query({text,kategorie,katalogId})`, `byGid()`, `onChange(fn)`, `loadBuiltins()`.
- **Persistenz:** Schlüssel `is_catalogs`. Bilder als data:-URL → Quota-Schutz (fail-soft auf Sitzung statt Crash).

### B2 — Kollisionsschutz (Aufwand: S)

`app.js` · `addCart`/`renderCart` (Z.439–450), `byId` (Z.283)
- Dedupe-Key `item.id` → `item.gid` (`cart.find(c=>c.gid===item.gid)`). **Einziger nötiger Verhaltens-Patch** an bestehender Logik — alles andere additiv. `byId` bleibt als Demo-Fallback.

### B3 — Such-/Filter-UI (Aufwand: M)

`index.html` · `app.js` · `style.css`
- Neuer Tab `🗂️ Kataloge` (`data-panel="katalog"`): Import-Dropzone (`#catFile`, multiple, .json/.csv), Built-in-Liste, geladene-Kataloge-Liste mit Lizenz-Badge + `☑ aktiv`-Toggle + Entfernen, Vorlagen-Download.
- Picker-Kopf (`#pickSearch`, `#pickCat`, `#pickCatalog`) über `#pickGrid`. `openPicker` liest `Catalogs.query(...)` statt direkt `window.CATALOG`. Thumbnail via `<img loading="lazy" referrerpolicy="no-referrer">` falls vorhanden, sonst Farb-Swatch.
- `showSpec`: zwei additive Zeilen (Katalog-Herkunft + „Zum Produkt ↗"-Link, nur `http(s)`, `rel="noopener nofollow"`).

### B4 — Mitgelieferte Beispielkataloge (Aufwand: S)

Neu: `examples/catalogs/{wohnen-basis,wand-oberflaeche,aquaristik-basis,katalog-vorlage}.json` + `SCHEMA.md`
- Alle CC0, frei erfunden. `wohnen-basis` = heutiger `catalog.js`-Seed (Fantasie-Hersteller „Nordhaus"/„Lumen&Co") → Demo-Begehung läuft unverändert. „Brillux-Stil" → neutrale Vorlage „Wandfarben & Putze", „Aquaristik" → generische Hardware.

**Ehrliche Grenzen (B):**
- **Quota/Toast-Lücke (HOCH).** Das Design behauptet einen „Katalog zu groß"-Toast — aber `store.set` schluckt Quota-Fehler heute **still** (`app.js:8`, kein Toast). Der Toast muss erst gebaut werden, sonst scheitert Persistenz lautlos.
- **localStorage falsch für Bilder.** data:-Bild-Kataloge sprengen ~5 MB sofort; Safari `file://` sperrt localStorage teils ganz. → Bilder nie in localStorage; Thumbnails in IndexedDB (P0) oder Farb-Swatch-Default.
- **XSS-Boundary (MITTEL).** Import = untrusted. Alle Strings über `esc()`/`textContent`, URL-Sanitizing (`http(s):`/`data:image` ja; `javascript:`/`file:` verwerfen). Envelope ohne `schema`/`items[]` → klarer Fehler, kein stilles Schlucken.

---

## C) Claude-orchestrierte, katalog-gestützte Möblierung

**Ziel:** Leere („blanco") Wohnung bauen, dann inkrementell möblieren — **nur Gefragtes**, item-level Schema, ausschließlich aus geladenen Katalogen, Nano-Banana-Redesign auf bestehenden Räumen.

### C1 — Blanco-Wohnung (Aufwand: S)

`app.js` · neu `BLANCO_SYS`, `buildBlancoApartment()` · `index.html` Button `#buildBlanco`
- Klon von `buildApartment()`, nur Prompt-Delta: Räume mit `empty:true`, Prompts beschreiben kahle Architektur. Gleicher `padTo2to1`/`Tour.load`. Cart leer, Ampel 0.

### C2 — Item-level Orchestrator (Aufwand: L)

`app.js` · neu `FURNISH_SYS`, `furnish(userText)` · `index.html` Button `#furnishBtn`
- **Action-Schema (JSON):** `{reply, actions:[{room, action:"add"|"replace"|"clear", articleIds[], freitext, position, replaceTag}]}`.
- **Harte Prompt-Regeln:** „Nur explizit Genanntes. `room` MUSS existieren (Liste folgt). `articleIds` MÜSSEN aus geladenen Katalogen (id/name/price/catalog-Liste folgt). Bei genanntem Katalog NUR daraus. Kein passender Artikel → leer + erklären. Ungenanntes nie ändern."
- **Kontext-Block** kompakt (`id|name|price|catalog`-Zeilen, token-arm).
- **Validierung an der Grenze (ECC-Regel):** `room` gegen `Tour.stations()`, `articleIds` gegen Katalog-Index prüfen; Unbekanntes verwerfen + Toast.
- Quelle der Kataloge = **Bereich-B-Importmodell** (nicht hartcodierte Marken).

### C3 — Nano-Banana Redesign + Auto-Pins (Aufwand: M)

`app.js` · `furnishPrompt()`, `articleClause()`, `applyFurnishGroup()`, `applyPins()`, `posToLatLng()` · `tour.js` neu: `replaceNodeImage()`, `clearPins()`, `removePinByTag()`
- Pro Raum **ein** `Banana.generate` im redesign-Modus (aktuelles Equirect als Referenz), `padTo2to1`, dann `Tour.replaceNodeImage(roomIdx,img)` — **selber Node**, Topologie/Links bleiben.
- Pins + Cart + Budget automatisch aus `articleIds` (`Tour.addPin` + `addCart` → `renderCart`→`updateAmpel`, alle bestehend).

**Ehrliche Grenzen (C):**
- **Generativer Drift ist der schwerste praktische Mangel (HOCH).** Bildmodelle sind **nicht idempotent**. „Nichts sonst ändern" ist eine Bitte, kein Constraint — Wandfarbe/Boden verschieben sich, vorhandene Möbel wandern, Fehler akkumulieren über Iterationen. Die Design-Abmilderungen (Prompt-Guard + letztes Bild als Referenz) sind die **schwächsten** verfügbaren.
  - **Verbindlich in den Default heben (nicht optional):** (a) Masken-/Sektor-Inpainting statt Full-Frame-Redesign — nur den `position`-Sektor des Equirects neu generieren und Canvas-komponieren (Gemini-Mask-Support in `banana.js` erst prüfen); (b) **Blanco-Bild als permanenter zweiter Referenz-Anker** (`images:[current, blanco]`); (c) Diff-Vorschau alt/neu vor Übernahme.
- **Pin-Drift (MITTEL).** Möbel landet im Bild, wo Banana es setzt — nicht wo das `position`-Enum sagt. Auto-Pin aus Enum erzeugt falsch platzierte Pins. Pragmatisch: Nutzer setzt Pin per Klick (bestehender `setPlaceMode`-Pfad, `tour.js:170`) statt deterministischem Enum.
- **`replaceNodeImage` verliert Kamera-Yaw (NIEDRIG-MITTEL).** Vor `destroyScene` aktuellen `view.yaw()/pitch()/fov()` sichern, nach `buildScene` wiederherstellen — sonst springt die Ansicht bei jeder Änderung.
- **Bild-Kosten je Iteration (MITTEL-HOCH).** Jede Änderung = ein 2K-Generate (BYOK, Nutzer zahlt direkt). „Aquarium→IKEA→Kalkputz→ändern" = 4× pro Raum. Gegenmittel: 1K-Vorschau beim Iterieren, finales 2K auf Knopfdruck; Session-Hard-Cap; Undo via gecachte letzte N Equirects (kein Re-Generate).

---

## D) Budget / Einkaufsliste / Export

**Ziel:** Pins als Single Source of Truth → abgeleitete Einkaufsliste (gruppiert nach Raum/Lieferant), Raum- + Gesamt-Budget-Ampel, vier Offline-Exporte.

### D1 — Abgeleitetes Datenmodell (Aufwand: M)

`app.js` (oder neu `export.js`) · neu `buildBoQ()`, `boqRows()`, `roomSubtotal()`, `grandTotal()`, `cartOnlyItems()`
- `buildBoQ()` aggregiert Tour-Pins per `id` je Raum (Mengen automatisch via `pin.qty||1`), plus cart-only-Posten als „Ohne Raum". Rein lesend, immutable.
- Zentral statt verstreut: `CURRENCY`, `fmtEUR()` (ersetzt `+ " €"`-Stellen).

### D2 — Mengen (Aufwand: S)

`tour.js` · neu `setPinQty(nodeIdx,pinIdx,qty)`; `pin.qty` optional (default 1). Löst das heutige Dedupe-1×-Problem ohne globalen Umbau.

### D3 — Einkaufsliste + Ampel (Aufwand: M)

`app.js` · `renderCart()` (umgebaut, gruppiert), neu `renderRoomGroup()`, `renderRoomAmpel()`, `ampelColor()`, `roomBudget()/setRoomBudget()`
- `.cart`-Box → `<details>`-Gruppen je Raum mit Zwischensumme + optionalem Raum-Soll + Mini-Ampel; Gesamtsumme + Gesamt-Ampel bleiben.
- Schwellen als Konstanten (`BUDGET_WARN=0.9`, `BUDGET_OVER=1.0`), `ampelColor(ratio)` zentral.
- Flächenpreise (`priceKind:"area"`, €/m²) via `lineTotal()` mit `DEFAULT_WALL_M2`.
- **Kompatibilität:** `renderCart` bleibt zentraler Re-Render; `addCart`, `#cartTotal`, `#budgetIn.oninput`, `updateAmpel` alle funktionsfähig.

### D4 — Lieferantensicht (Aufwand: S)

`app.js` · neu `buildSupplierView()`, `parseLeadWeeks()` · Toggle `<div class="seg" id="boqView">` „nach Raum | nach Lieferant". Liefert Bestell-Splittung + kritische Lieferzeit (Max der `lead`).

### D5 — Export (Aufwand: M)

Neu: `/Users/davidoff/Desktop/Interior-Studio/export.js` (vor `app.js` eingebunden)
- Alle clientseitig (Blob + `URL.createObjectURL` + `<a download>`), kein Server.
- `exportCSV()` (`;`-getrennt, `\uFEFF`-BOM, 14 Spalten), `exportPrint()` (HTML-Druckvorlage → „Als PDF speichern"), `exportQuote()` (Angebot mit Netto/`VAT=0.19`/Brutto), `exportRoomBook()` (Architekten-Raumbuch je Raum).
- Helfer: `download()`, `dateStamp()`, `printHTML()`, `projectMeta()`, `csvCell()`.

**Ehrliche Grenzen (D):**
- **Pin-Drift trifft Budget doppelt:** Solange C die Pin-Platzierung nicht stabil hat, weicht die Raumzuordnung der Einkaufsliste vom Bild ab. D ist nur so verlässlich wie die Pin-Wahrheit aus C.
- **Export-XSS:** Druck-HTML interpoliert Artikel-/Raumnamen → `esc()` zwingend (gleicher Pfad wie bestehende `esc()`).
- **„PDF ohne Lib":** Nur über Browser-Druckdialog; kein pixelgenaues Layout garantiert, abhängig vom Browser des Nutzers.

---

## Querschnitt P0 — Speicher (VOR A–D, Aufwand: L)

`tour.js` · `app.js` · neu IndexedDB-Wrapper
- **Lazy-build:** Szenen erst bei Annäherung via `buildScene` (heute baut `load()` alle Z.143). Inaktive via `destroyScene` entladen, ~8–10 aktive max.
- **IndexedDB statt localStorage** für Panoramen/Thumbnails (Blob-Storage, hunderte MB). Tour übersteht Reload.
- **In RAM-Bilanz einrechnen:** `padTo2to1`-Canvas-Spikes (app.js:179).

**Ehrliche Grenze:** Ohne P0 killt Safari die Session bei 10+ Stationen — das ist kein Edge-Case, sondern der Normalfall der A4-Dichteplanung.

---

## Empfohlene Bau-Reihenfolge

**Phase 1 — Fundament & Recht (Blocker, ~1 Woche).** Pfadkorrektur · Katalog-Rechtsmodell auf Import vereinheitlichen · Bereich B vollständig (B1–B4) · Querschnitt P0 (Speicher). *Begründung:* B ist Voraussetzung für C; Recht und Speicher sind Show-Stopper, nicht nachrüstbar.

**Phase 2 — Begehung (~1 Woche).** Bereich A komplett (A1–A4). *Voraussetzung:* P0 (lazy-build), sonst sprengt die Stationsdichte den Speicher. *Risiko-Gate:* zuerst den Marzipano-Layer-/Effect-Pfad (A2-Grenze) verifizieren, bevor Dolly gebaut wird.

**Phase 3 — Möblierung (~1,5 Wochen).** Bereich C (C1–C3). *Voraussetzung:* B (Kataloge) + A (begehbare Räume zum Re-Rendern). *Risiko-Gate:* Drift-Mittel (Masken-Inpainting/Blanco-Anker/Diff) als Default, nicht optional — sonst ist der Loop unbrauchbar.

**Phase 4 — Auswertung (~1 Woche).** Bereich D (D1–D5). *Voraussetzung:* C liefert Pins als Wahrheit. *Hinweis:* D2 (Mengen) kann früh parallel laufen, da rein additiv.

---

## Offene Fragen an den Nutzer

1. **Drift-Strategie:** Unterstützt die Gemini-Image-API in deinem BYOK-Setup Masken-/Regionen-Inpainting? Falls nein, ist C3 auf Full-Frame-Redesign mit Blanco-Anker beschränkt — sichtbarer Drift bleibt Restrisiko. Soll ich das `banana.js`-Endpoint vorab darauf prüfen?
2. **Persistenz-Tiefe:** Soll die ganze Tour (alle Panoramen) den Reload überleben (→ IndexedDB-Pflicht, P0 = L), oder reicht „Session-only, Export rettet die Daten"? Das verschiebt P0 von L auf S.
3. **Kosten-Cap:** Welcher Session-Hard-Cap für Bild-Generierungen ist akzeptabel (z. B. 30/Session), und willst du 1K-Vorschau beim Iterieren + 2K nur final?
4. **Pin-Platzierung:** Auto-Pin aus `position`-Enum (bequem, aber driftet vom Bild ab) oder manueller Klick nach jedem Redesign (genau, aber ein Schritt mehr)?
5. **Claude-CORS:** Läuft `claude.js` aus `file://` heute real durch? Anthropic erlaubt Browser-CORS nur mit explizitem Header — bitte einmal bestätigen, sonst ist C2/`furnish` blockiert, bevor wir bauen.
6. **Raum-Budgets:** Brauchst du Soll-Budgets pro Raum (D3) oder genügt ein Gesamt-Budget? Pro-Raum kostet wenig extra, lohnt aber nur bei echtem Planungsbedarf.

**Relevante Dateien (absolut):** `/Users/davidoff/Desktop/Interior-Studio/{tour.js, app.js, catalog.js, banana.js, claude.js, index.html, style.css}` · neu: `catalogs.js`, `export.js`, `examples/catalogs/*` · `vendor/marzipano.js` (Layer-/Transition-Pfad verifizieren).