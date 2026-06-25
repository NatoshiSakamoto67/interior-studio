# Interior Studio — Build-Dokument

## 1. Der Beruf

Interior Designer planen und realisieren Innenräume von der ersten Anfrage bis zur fertigen Installation. Sie übersetzen Lifestyle, Nutzung und Budget eines Kunden in ein räumliches Konzept (Moodboard, Grundriss, Lichtplanung), detaillieren es zu einer vollständigen FF&E-Spezifikation (Furniture, Fixtures & Equipment — alles bewegliche Inventar, abgegrenzt von baufesten Maßnahmen), beschaffen die Produkte über Lieferanten, koordinieren die Gewerke auf der Baustelle und stylen am Ende den Raum. Anders als reine Dekorateure verantworten sie auch technische und baurechtliche Randbedingungen (Statik, Elektrik, Brandschutz, Barrierefreiheit). Der Beruf ist im Kern **Projektmanagement plus Geschmack**: Die teuersten und langsamsten Schritte sind Konzept, Visualisierung und Revisionsschleifen — und genau dort entsteht der größte Reibungsverlust mit dem Kunden, der sich „seinen" Raum nicht vorstellen kann.

## 2. Phasen-Tabelle

| Phase | Was der Designer tut | Deliverable | Zeitfresser | Wie das Tool hilft |
|---|---|---|---|---|
| 1 Lead & Erstkontakt | Anfrage qualifizieren (Budget, Umfang, Stilpassung), Discovery-Call | Intake-Fragebogen, Scope-Memo | Unqualifizierte Leads, Budget-Mismatch, Ghosting | Intake-Formular + Stil-Varianten-Fächer filtert/erdet Erwartung früh |
| 2 Discovery & Aufmaß | Bedarf/Lifestyle erheben, Vor-Ort-Aufmaß, Bestand & Technik dokumentieren | Designbrief, Aufmaßplan, Fotodoku, Raumprogramm | Vage Wünsche, mehrere Entscheider, ungenaues Aufmaß | Raum-Objekt mit strukturierten Maßen + Bestandsfotos zentral |
| 3 Vertrag & Honorar | Leistungsumfang fixieren, Honorarmodell wählen, Retainer einziehen | Designvertrag, Honorarvereinbarung, erste Rechnung | Scope Creep, Revisionsgrenzen unklar, verspätete Anzahlung | Projekt speichert Honorarmodell + Revisionsgrenzen als Steuergröße |
| 4 Konzept / Moodboard | Stilthese festlegen, Referenzen/Material/Farbe sammeln, Moodboard bauen | Moodboard(s), Farb-/Materialrichtung, Stilfreigabe | Subjektive Geschmacksdebatten, endlose Pinterest-Runden | **KI-Foto-Redesign**: Kunde sieht den eigenen Raum in 3–5 Stilen |
| 5 Raumplanung | Layout-/Möblierungsvarianten, Verkehrsfluss, erstes Lichtkonzept | Möblierungsplan, Schnitte, Lichtkonzept | Layout-Iterationen, späte Statik-/Haustechnik-Einbindung | **3D-Walkthrough**: Proportionen werden begehbar/fühlbar |
| 6 Detailplanung & Spec | Alles ausdetaillieren, FF&E zusammenstellen, mit Gewerken koordinieren | Ausführungspläne, **FF&E-Schedule**, Renderings | Spec-Pflege über viele Positionen, Versionswirrwarr | FF&E-Position als Single Source of Truth, abgeleitete Summen |
| 7 Freigabe & Budget | Konzept präsentieren, Budget rechnen, Freigabe je Position einholen | Präsentation, Budgetübersicht, Freigabeprotokoll | Budgetschock, langsame Freigaben, Approval per E-Mail | **Budget-Ampel** live + Freigabe-Objekt mit eingefrorenem Snapshot |
| 8 Beschaffung | Sourcing finalisieren, POs auslösen, Wareneingang/Tracking | Bestellliste, Purchase Orders, Status-Tabelle | Lange Lieferzeiten, Backorders, manuelles PO-Tracking | PO aus FF&E ableiten, Mengen-Aggregation, Statuskette pro Zeile |
| 9 Ausführung / Bau | Gewerke koordinieren, Site Inspections, Bemusterung freigeben | Bauprotokolle, Mängelliste, Change Orders | Terminverzug, Plan-Abweichungen, viel Reisezeit | Statuskette „bestellt → geliefert → montiert" pro Position |
| 10 Installation & Reveal | Logistik koordinieren, Möbel/Textil/Deko stylen, Reveal + Foto | Lieferplan, Styling-Liste, Projektfotos | Logistik am Liefertag, fehlende/falsche Teile | Raumbuch als Monteur-/Liefersicht, gebündelt pro Raum |
| 11 Übergabe & Nachlauf | Punch List, Pflegeinfos, Schlussrechnung, Testimonial | Übergabeprotokoll, Care-Guide, Case Study | Restmängel ziehen sich, strittige Schlussrechnung | Restposten-Status + Schlussrechnung aus Ist-Daten |

## 3. Datenmodell

**Leitprinzip:** Die FF&E-Position ist die zentrale Wahrheit. Budget, Freigabe und Bestellung *rollen daraus auf* oder hängen daran. Abgeleitete Werte (Marge, Summen, Budget-Ist) werden **berechnet, nie gespeichert**. Stammdaten (Produktkatalog) sind getrennt von der projektierten Verwendung (FF&E-Position).

```
Projekt 1─n Raum 1─n FF&E-Position n─1 Produkt(katalog)
   │           │              │
   │           │              n─n Farbe/Material (Finish)
   │           └─n Moodboard n─n FF&E-Position
   ├─1 Budget 1─n Budget-Posten ──(rollt auf)── FF&E-Position
   ├─n Kundenfreigabe n─n FF&E-Position / Moodboard
   └─n Bestellung(PO) 1─n Bestellposition ─1 FF&E-Position
```

### Projekt
`id` · `name/projektcode` · `kunde` (Ref) · `typ` (residential/hospitality/retail/office) · `leistungsphase` · `status` (Lead/aktiv/abgeschlossen) · `adresse_baustelle` · `budget_rahmen` · `honorarmodell` (Pauschale/Stunden/%-Warenkosten) · `währung` · `verantwortlich` · `start`/`zieltermin` · `mwst_modus`

### Raum
`id` · `projekt_id` · `name` · `raumnummer` (CAD-Brücke) · `etage` · `fläche_m2` · `höhe_m` · `nutzung` · `bestand_foto` (Media[]) · `aufmass` (Plan-Ref) · `lichtkonzept_notiz` · `status`

### FF&E-Position (das Herzstück)
`id` · `pos_nr/tag` (eindeutiger Spec-Tag, z. B. `WZ-FF-01` — gemeinsamer Schlüssel über Plan/Moodboard/PO/Rechnung) · `raum_id` · `kategorie` (Sitzmöbel/Tisch/Leuchte/Textil/Teppich/Boden/Sanitär/Deko/Kunst) · `produkt_id` (Ref, optional) · `bezeichnung` · `hersteller` · `modell/artikelnr` · `maße` (strukturiert B×T×H, nicht Freitext — für Kollisionsprüfung) · `material` (Ref[]) · `farbe_finish` (Ref[]) · `menge` (Stk/lfm/m²) · `einzelpreis_ek` · `einzelpreis_vk` · `marge` (abgeleitet) · `gesamt_vk` (abgeleitet) · `lieferant_id` · `lieferzeit_wochen` · `lead_time_kritisch` (Bool) · `status` (Statuskette ↓) · `bild` · `quelle_url` · `datenblatt` · `montage_notiz` · `freigabe_status` · `bestellpos_id` · `position_im_raum`

**Statuskette:** `Vorschlag → Freigabe ausstehend → freigegeben → bestellt → bestätigt → versandt → geliefert → montiert → abgenommen` (Nebenpfade: abgelehnt · Alternative gesucht · Reklamation · storniert · backorder). Diese Kette verbindet Design (freigegeben) mit Logistik (geliefert/montiert) — das, was generische Tabellen nicht abbilden.

### Farbe/Material (eigenes Objekt, kein Freitext)
`id` · `art` (Farbe/Stoff/Holz/Stein/Metall/Leder/Lack/Tapete) · `name` · `hersteller` · `code` (RAL/NCS/Pantone) · `hex_vorschau` · `eigenschaften` (Martindale, Lichtechtheit, Brandklasse B1, Pflege) · `muster_status` (angefordert/vorhanden/freigegeben) · `muster_foto` · `preis_einheit` (€/lfm) · `verwendet_in` (abgeleitet). *Warum getrennt:* „Eiche überall etwas dunkler" ändert ein Objekt, nicht 12 Zeilen.

### Budget (Soll + abgeleitetes Ist)
**Plan:** `gesamt_soll` · `puffer_prozent` (10–15 %) · `honorar_soll` (getrennt von Ware).
**Budget-Posten (pro Raum × Kategorie):** `soll` · `ist_committed` (abgeleitet: Σ bestellter VK) · `ist_bezahlt` (abgeleitet) · `abweichung` (abgeleitet → Ampel grün/gelb/rot). Sobald eine Position auf „freigegeben" springt, sieht der Designer sofort, ob der Raum das Budget reißt.

### Kundenfreigabe
`id` · `projekt_id` · `scope_typ` (Position/Moodboard/Paket/Angebot) · `scope_refs` (Ref[]) · `präsentiert_am` · `entscheidung` (offen/freigegeben/abgelehnt/Änderung) · `entschieden_von` · `entschieden_am` · `kommentar` · `signatur/nachweis` · **`version_snapshot`** (eingefrorener Stand: Preis + Finish + Menge zum Freigabezeitpunkt — der geschäftskritische, oft vergessene Teil).

### Lieferant & Bestellung
**Lieferant:** `name` · `typ` (Hersteller/Händler/Handwerker) · `rabatt_konditionen` · `zahlungsziel` · `mindestbestellwert`.
**Bestellung (PO):** `po_nr` · `lieferant_id` · `status` (Entwurf/gesendet/bestätigt/teilgeliefert/geliefert) · `liefertermin_zugesagt` · `summe_netto` · `mwst` · `fracht`.
**Bestellposition:** `po_id` · `ffe_pos_id` (Ref!) · `menge` · `ek_preis` · `bestätigter_liefertermin` · `tracking` · `wareneingang_menge`.

## 4. Feature-Roadmap

### Must-have (Kern-MVP, höchster Nutzen pro Aufwand)
1. **KI-Foto-Redesign** — Kunde lädt Raumfoto hoch → 3–5 Stilvarianten mit erhaltener Geometrie. *Der Aha-Moment: er sieht den eigenen Raum, nicht ein fremdes Pinterest-Bild.*
2. **Stil-Varianten-Fächer aus Brief** — 4–6 Richtungen automatisch, bevor Menschzeit fließt. *Erdet die Erwartung und ersetzt manuelle Sammelarbeit.*
3. **Auto-Einkaufsliste/FF&E mit Live-Summe** — jedes gewählte Produkt → Spec-Zeile, Mengen-Aggregation, Gesamtpreis. *Niedrigster Bauaufwand, ersetzt intransparente Pauschale durch postenweise Kostenwahrheit.*
4. **Budget-Ampel** — Kundenbudget eingeben → grün/gelb/rot, live bei jeder Änderung. *Kein Kostenschock am Ende; Kunde entscheidet mit.*

### Should (klarer Mehrwert, etwas mehr Aufwand)
5. **Produkt-Hotspots im Bild** — klickbare Punkte → Produktname/Maße/Preis/Händler. *Macht das schöne Bild nachvollziehbar und kaufbar.*
6. **Prompt-basierte Einzeländerung** — „Boden in Eiche", „Wand salbeigrün" in Sekunden. *Killt die mehrtägige Revisionsschleife.*
7. **Strukturierter Produktkatalog (Repository-Pattern)** — wiederverwendbare Stammdaten. *Voraussetzung für Hotspots und Auto-Matching, verhindert Daten-Drift.*
8. **Freigabe-/Kommentar-Flow im Bild** — Kunde markiert „gefällt/gefällt nicht" direkt am Render. *Ersetzt Mail-Ping-Pong, erzeugt rechtssicheren Audit-Log.*

### Later (hoher Aufwand oder noch unausgereift)
9. **Interaktiver 3D-Walkthrough (parametrisch)** — Raum aus Maßen + platzierbare Assets. *Teuerster Hebel; erst nach Validierung des 2D-KI-Kerns.*
10. **Auto-Produkt-Matching** — KI matcht generiertes Objekt → echtes Katalogprodukt. *Fehleranfällig, braucht Mensch-im-Loop bis robust.*
11. **CBOM / Varianten-Konfigurator** — Stoff-/Größenoptionen ohne Listen-Duplikation. *Erst nötig bei großem Sortiment.*
12. **VR-Begehung** — Nice-to-have, schmale Zielgruppe.

## 5. Prototyp-Status vs. Nächste Schritte

### Schon im aktuellen Prototyp
- **KI-Studio (Bild/Redesign)** — deckt Must-have 1 + 2 ab: Foto-zu-Stilvarianten, der zentrale Aha-Moment.
- **3D-Walkthrough mit klickbarem FF&E-Katalog + Spec-Card** — nimmt Later-Feature 9 und Should-Feature 5 vorweg: begehbarer Raum, Hotspots auf Möbeln, Produktdetail-Card.
- **Einkaufsliste / Budget** — deckt Must-have 3 + 4 ab: Spec-Zeilen aus platzierten Produkten, Live-Summe, Budget.
- **Bild→3D-Parallax** — verbindet KI-Stimmung (a) mit räumlicher Geometrie (b); genau die geforderte Brücke „3D liefert Geometrie, KI die Atmosphäre".

### Was als Nächstes kommt (Priorität von oben)
1. **Datenmodell verankern** — die Spec-Card/Einkaufsliste an das oben definierte FF&E-Objekt mit `pos_nr`-Tag, Statuskette und **abgeleiteten** Summen koppeln. Damit wird aus der Liste die echte Single Source of Truth statt einer parallel gepflegten Tabelle.
2. **Budget-Ampel scharf schalten** (Must 4) — Soll pro Raum × Kategorie, Ist-Committed live aus freigegebenen Positionen, grün/gelb/rot.
3. **Prompt-basierte Einzeländerung** (Should 6) — gezielte Edits am bestehenden KI-Render statt voller Neugenerierung; killt die Revisionsschleife.
4. **Freigabe-Flow mit `version_snapshot`** (Should 8) — Kunde gibt Position/Moodboard frei, Preis+Finish+Menge werden eingefroren; ersetzt E-Mail-Approval.
5. **Strukturierter Katalog + Lieferant/PO** (Should 7 → Phase 8) — Stammdaten-Bibliothek, dann PO-Generierung und Mengen-Aggregation aus der FF&E-Wahrheit.

### Zwei Caveats, die im Bau gelten
- **KI-Bild ≠ Maßwahrheit.** Generierte Szenen sind Stimmung, nicht Bemaßung. Must-have 1 und 3 müssen zusammen gedacht werden — das schöne Bild ohne gekoppelte echte Produktdaten erzeugt einen Vertrauensbruch („das Sofa passt ja gar nicht rein").
- **Designer bleibt im Loop.** Statik, Lastwände, Brandschutz, Barrierefreiheit darf keine Automatik freigeben. Das Tool beschleunigt Konzept/Visualisierung/Sourcing/Budget — die fachliche Freigabe bleibt menschlich. Positionierung: **Co-Pilot, nicht Ersatz.**
