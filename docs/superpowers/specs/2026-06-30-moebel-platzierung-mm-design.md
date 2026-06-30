# Design-Spec: Möbel mm-genau platzieren (Welt 3D)

- **Datum:** 2026-06-30
- **Status:** freigegeben (Brainstorming), bereit für Umsetzungsplanung
- **Betrifft:** `world.js`, `parametric.js`, neues `furnish.js`, `catalog.js`, `index.html`, `style.css`

## 1. Ziel

Der Nutzer will: „Ich nehme ein Möbel aus dem Katalog, sage *da hin* — und es wird **millimetergenau genau dahin** eingefügt, der Grundriss wird dabei genaustens befolgt. Und am Ende ist es fotorealistisch."

Konkret: In der bestehenden, mm-exakten begehbaren Welt (aus Grundriss/CAD/IFC) Katalog-Möbel präzise platzieren, am Grundriss einrasten, in mm kontrollieren — und auf Knopfdruck ein fotorealistisches Bild genau dieser Möblierung erzeugen.

## 2. Leitprinzip (ehrlich)

„Millimetergenau" und „fotorealistisch" leben in **zwei gekoppelten Schichten**:

1. **Modell-Schicht (mm-exakt, editierbar, begehbar):** Geometrie + platzierte Möbel als echte three.js-Objekte mit echten Maßen. Hier ist alles mm-genau und der Grundriss wird strikt eingehalten.
2. **Präsentations-Schicht (fotoreal):** „Foto dieser Ansicht" rendert genau diese Anordnung fotorealistisch (Gemini/OpenAI, geometrie-treu).

Ein einziger *live begehbarer* Foto-Render ist im Browser nicht möglich. Die Marriage „mm-exakt + fotoreal" entsteht durch: exakt setzen → Foto-Knopf fotografiert exakt das.

## 3. Architektur

**Eine Szene, zwei Kameras** (kein doppelter Datenstand → automatisch synchron):

- Die bestehende `parametric.js`-Szene bleibt die einzige Quelle der Wahrheit (mm-genaue Meter-Geometrie).
- Möbel sind echte Objekte in dieser Szene (`THREE.Group` je Möbel).
- **„Begehen"** = vorhandene First-Person-`PerspectiveCamera`.
- **„Plan von oben"** = zusätzliche `OrthographicCamera` senkrecht nach unten, an die Modell-Bounding-Box angepasst. Umschalter im Viewport.
- Beide Ansichten lesen dieselben Möbel-Objekte → Änderung in der einen erscheint sofort in der anderen.

**Neues Modul `furnish.js`** (das „Gehirn" für Möblierung, lib-agnostisch zur Render-Schicht):
- Katalog-Picker (liest `window.CATALOG`).
- Platzierungs-Engine: Hinzufügen, Auswahl, Verschieben, Drehen, Einrasten, Grenzen, mm-Anzeige.
- Möbel-Ledger: Liste der platzierten Stücke (id, Position mm, Drehung, Preis) → Output/Speichern.
- Stellt `parametric.js` nur die Geometrie-Bauer je `kind` bereit und nutzt dessen Szene/Kamera/Raycast.

`parametric.js` bekommt minimale neue API: Ortho-Kamera + Umschalter, Raycast-Helfer (Boden/Wände), Zugriff auf Wand-/Raum-Daten des aktuellen Modells, `addFurnitureObject/removeFurnitureObject`.

`world.js` verdrahtet Katalog-Panel + Ansicht-Umschalter und reicht das aktuelle Modell (Wände/Räume bzw. IFC-Group) an `furnish.js`.

## 4. Möbel-Darstellung (v1: Maßkörper)

- Je Katalog-`kind` ein **dimensionierter Proxy** aus Primitiven, gebaut aus den **echten Maßen** (`w` × `d` × `h` in cm → m) und der Katalogfarbe (`color`), PBR-Material (matt) passend zum Echtzeit-Look:
  - `sofa`/`side`/`table` = Box(en) (Tisch ggf. Platte + Beine, Sofa = Korpus + Rückenlehne — schlicht, aber maßtreu).
  - `chair` = Sitz + Lehne. `lamp` = dünner Stab + Schirm/Fuß. `plant` = Topf + Kugel. `rug` = flache Platte (Höhe ~`h`).
- Footprint (Grundfläche) und Höhe sind **exakt** = mm-genaue Platzierung ist echt, nicht symbolisch.
- Auswahl-Zustand sichtbar (Umriss/Highlight). Maßlabel optional (B×T×H) wie bei Wänden.

## 5. Platzierungs-Engine (der Kern)

**Hinzufügen:**
- Im **Plan**: Katalogeintrag in den Plan ziehen (oder antippen → „auf den nächsten freien Platz") → Möbel erscheint unter dem Cursor, rastet beim Loslassen ein.
- Im **Begehen**: Katalog wählen → ins Bild klicken → Raycast auf den Boden → Möbel dort.

**Bewegen/Drehen:**
- Ziehen in beiden Ansichten (Plan = präzise, Begehen = grob). Drehen per Griff/Tastendrehung in 15°- bzw. 1°-Schritten.
- Auswahl per Klick; aktives Möbel hat Griffe (Plan) bzw. Highlight (Begehen).

**Grundriss wird befolgt (Constraints):**
- **Wand-Einrasten:** Rückseite des Möbels rastet bündig an die nächste Wand (Snap-Distanz konfigurierbar, z. B. < 150 mm).
- **Raum-Grenzen:** Möbel bleibt innerhalb des Raum-Polygons / der Wand-Hülle — kein Durchdringen von Wänden.
- **mm-Anzeige live:** Abstand zu den nächsten Wänden, z. B. „1.200 mm ↤ · 800 mm ↥". Position/Drehung in einem kleinen Inspektor.
- **Feinjustage:** Bei ausgewähltem Möbel im **Plan** verschieben Pfeiltasten das Stück in mm-Schritten (Standard 10 mm, mit Modifier 1 mm). Im **Begehen** bleiben Pfeiltasten/WASD = gehen; dort wird grob per Ziehen gesetzt und im Plan fein justiert. Eingabefeld für exakten Wandabstand = v2.

**Pro Eingabetyp:**
- **Maß-Modell / CAD (.dxf):** volle Wand-/Raum-Daten → Wand-Einrasten + Raum-Grenzen + mm-Abstände.
- **IFC (.ifc):** keine strukturierten Wände/Räume → Raycast auf die Boden-/Geometrie-Flächen, freies Setzen + Koordinaten-Anzeige; Wand-Einrasten best-effort (gegen Geometrie), ohne Raum-Grenze. Ehrlich kommuniziert.

## 6. Fotorealismus-Anbindung

- „Foto dieser Ansicht" (bestehend) fotografiert die möblierte Szene mit (Möbel sind in der Szene → im Snapshot).
- **Prompt-Wechsel, wenn Möbel platziert sind:** statt „Möbel erfinden" (`fotoFurnish`) → „rendere **diese** Einrichtung fotorealistisch, behalte Anzahl, Art, Position, Maßstab und Kamera". Die platzierten Maßkörper werden so zu fotorealistischen Möbeln **an exakt der Stelle**.
- `fotoFurnish`-Checkbox bleibt für den Fall „leerer Raum, KI darf möblieren"; bei vorhandener Möblierung Default = „meine Möbel erhalten".

## 7. Output / Persistenz

- **Möbel-Liste:** je Stück Name, Position (mm), Drehung, Preis (Katalog hat `price`/`preis`), Summe. Sichtbar im Panel.
- Speist die bestehende **Einkaufsliste/FF&E**-Logik (Katalog-`tag`/`status`).
- **Speichern mit dem Projekt** (bestehende Projekt-/Store-Schicht): Möblierung als Teil des Welt-3D-Zustands (Liste aus {catalogId, x_mm, z_mm, ry}). Beim erneuten Laden wiederherstellbar.

## 8. UI-Layout (Welt 3D)

```
┌─ Katalog ─────┐ ┌───────── Großer Viewport ──────────┐
│ Sofa 210×92   │ │  [ Plan von oben ]  [ Begehen ]     │
│ Tisch 90×90   │ │                                     │
│ Sessel 78×80  │ │   Möbel als Maßkörper in der        │
│ Leuchte …     │ │   Wohnung, am Grundriss eingerastet  │
│ (reinziehen)  │ │                                     │
├───────────────┤ │                                     │
│ Platziert (3) │ └─────────────────────────────────────┘
│ Sofa  1.290 € │   [ Foto dieser Ansicht ] · mm-Inspektor
└───────────────┘
```

- Katalog-Panel links (eigener Abschnitt in der Welt-3D-Seitenleiste, nur wenn ein Modell geladen ist).
- Ansicht-Umschalter `Plan von oben ⇄ Begehen` oben im Viewport.
- mm-Inspektor (Position/Abstände) am Rand des Viewports, nur bei ausgewähltem Möbel.

## 9. Umfang

**v1 (dieser Plan):** Maßkörper je `kind`, Ortho-Plan-Ansicht + Umschalter, Katalog-Picker, Platzieren per Drag (Plan) / Klick (Begehen), Verschieben/Drehen synchron, Wand-Einrasten + Raum-Grenzen + mm-Abstände (Maß/CAD), IFC = Boden-Platzierung, Möbel-Liste mit Preis, möbliertes Foto, Speichern der Möblierung.

**Später (v2):** echte GLB-Möbelmodelle statt Proxys; Kollision *zwischen* Möbeln; Auto-Layout-Vorschläge; numerische „X mm von Wand"-Direkteingabe; mehrstöckige IFC.

## 10. Verifikation

- Playwright headless (wie bei Welt-3D-Umbau): Demo-Modell laden → Möbel platzieren → assert Position (mm) entspricht Klickpunkt; Wand-Einrasten setzt Rücken bündig (Abstand 0); Möbel bleibt im Raum; Plan ⇄ Begehen zeigt dasselbe Stück; Liste enthält Stück + Preis; 0 Konsolenfehler; Screenshots beider Ansichten.
- mm-Beweis: ein platziertes Sofa an Soll-Koordinate → ausgelesene Position == Soll (0 mm Abweichung), analog zum bestehenden mm-Nachweis der Wände.

## 11. Nicht-Ziele / Annahmen

- Keine generative *Geometrie* für Möbel (kein KI-Drift); Maße bleiben aus Katalog/Modell maßgeblich.
- v1 erzwingt keine Kollision zwischen Möbelstücken (nur Wände/Raumgrenzen).
- IFC ohne Raumschema: Wand-Einrasten eingeschränkt — bewusst und transparent.
