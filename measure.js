/* Interior Studio — Maß-Modell „interior-studio.measure/v1".
   Single Source of Truth für millimetergenaue Räume. ALLE Längen sind INTEGER-MILLIMETER.
   Koordinaten in mm im EINEN globalen Plan-Frame (x→rechts, y→nach unten). Wände als Mittellinien.
   Öffnungen referenzieren die Wand, die sie durchstoßen (offset entlang der Wand ab start).
   Provenance.precision: exact (CAD/Bemaßung) | calibrated (skaliert) | estimated (geschätzt).
   Dieses Modul ist provider-/lane-neutral (klassisches Script) — parametric.js (ESM) liest window.Measure. */
(function () {
  // ---- Demo: kleine, exakt bemaßte 2-Zimmer-Wohnung (zum Verifizieren des Bauers) ----
  const DEMO = {
    schema: "interior-studio.measure/v1",
    unit: "mm",
    provenance: { kind: "demo", precision: "exact", confidence: 1, warnings: [] },
    project: { title: "Demo-Wohnung (exakt)", northDeg: 0 },
    storeys: [{
      id: "eg", name: "Erdgeschoss", level: 0, elevationMm: 0, ceilingHeightMm: 2740,
      walls: [
        { id: "w_s", start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thicknessMm: 240, heightMm: 2740, type: "exterior" },
        { id: "w_e", start: { x: 6000, y: 0 }, end: { x: 6000, y: 4000 }, thicknessMm: 240, heightMm: 2740, type: "exterior" },
        { id: "w_n", start: { x: 6000, y: 4000 }, end: { x: 0, y: 4000 }, thicknessMm: 240, heightMm: 2740, type: "exterior" },
        { id: "w_w", start: { x: 0, y: 4000 }, end: { x: 0, y: 0 }, thicknessMm: 240, heightMm: 2740, type: "exterior" },
        { id: "w_p", start: { x: 4000, y: 0 }, end: { x: 4000, y: 4000 }, thicknessMm: 115, heightMm: 2740, type: "partition" }
      ],
      openings: [
        { id: "win1", type: "window", wallId: "w_s", offsetMm: 1500, widthMm: 1200, heightMm: 1400, sillMm: 900 },
        { id: "door_in", type: "door", wallId: "w_w", offsetMm: 800, widthMm: 1010, heightMm: 2100, sillMm: 0 },
        { id: "door_p", type: "door", wallId: "w_p", offsetMm: 1600, widthMm: 900, heightMm: 2100, sillMm: 0 }
      ],
      rooms: [
        { id: "wohnen", name: "Wohnzimmer", use: "living", polygon: [{ x: 120, y: 120 }, { x: 3942, y: 120 }, { x: 3942, y: 3880 }, { x: 120, y: 3880 }] },
        { id: "schlafen", name: "Schlafzimmer", use: "bedroom", polygon: [{ x: 4057, y: 120 }, { x: 5880, y: 120 }, { x: 5880, y: 3880 }, { x: 4057, y: 3880 }] }
      ]
    }]
  };

  // ---- Helfer ----
  // Wandlänge in mm — defensiv: kaputte/fehlende Koordinaten → 0 (stromabwärts greifen die L>0-Guards)
  const len = w => {
    const s = w && w.start, e = w && w.end;
    return (s && e && Number.isFinite(+s.x) && Number.isFinite(+s.y) && Number.isFinite(+e.x) && Number.isFinite(+e.y))
      ? Math.hypot(+e.x - +s.x, +e.y - +s.y) : 0;
  };
  function polygonAreaMm2(poly) {                                            // Gauß'sche Fläche (Betrag)
    let a = 0;
    for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; a += p.x * q.y - q.x * p.y; }
    return Math.abs(a) / 2;
  }
  // Deterministische Plausibilitäts-/Schließungs-Prüfung (KEIN Raten — meldet nur).
  function validate(model) {
    const warn = [];
    if (!model || model.schema !== "interior-studio.measure/v1") return { ok: false, warnings: ["Falsches/fehlendes Schema."] };
    (model.storeys || []).forEach(st => {
      const ids = new Set((st.walls || []).map(w => w.id));
      (st.walls || []).forEach(w => {
        if (len(w) < 1) warn.push(`Wand ${w.id}: Länge ~0.`);
        if (!(w.thicknessMm > 0 && w.heightMm > 0)) warn.push(`Wand ${w.id}: Dicke/Höhe fehlt.`);
      });
      (st.openings || []).forEach(o => {
        const w = (st.walls || []).find(x => x.id === o.wallId);
        if (!w) { warn.push(`Öffnung ${o.id}: Wand ${o.wallId} unbekannt.`); return; }
        if (o.offsetMm + o.widthMm > len(w) + 1) warn.push(`Öffnung ${o.id} ragt über Wand ${o.wallId} hinaus.`);
        if ((o.sillMm || 0) + o.heightMm > w.heightMm + 1) warn.push(`Öffnung ${o.id} höher als Wand ${o.wallId}.`);
      });
      void ids;
    });
    return { ok: warn.length === 0, warnings: warn };
  }

  // ---- Claude-Extraktion: bemaßter Grundriss → measure/v1 (NIE raten) ----
  const MEASURE_SYS = `Du bist ein präziser Aufmaß-Extraktor für Architektur-Grundrisse. Eingabe: das Bild eines Grundrisses. Ausgabe: AUSSCHLIESSLICH gültiges JSON nach "interior-studio.measure/v1" — kein Text davor/danach.

RATEN IST VERBOTEN:
- Übernimm NUR Maße, die im Plan als Bemaßung/Maßkette EINGETRAGEN und lesbar sind. Nicht direkt ablesbar → Zahl = null UND ein Eintrag in "uncertain" {field, reason}. Lieber 20 null-Werte als ein geratener.
- Ein bloßes Maßstabsverhältnis ("1:50") OHNE messbaren Maßstabsbalken/bemaßte Referenzstrecke IM BILD ist KEINE gültige Quelle → solche Maße bleiben null.
- precision: "exact" = alle übernommenen Werte direkt aus Bemaßung. "calibrated" = NUR wenn ein Maßstabsbalken/eine bemaßte Referenzstrecke IM BILD messbar ist (daraus berechnete Werte: conf ≤0.6). Es gibt KEIN "estimated".
- conf je Wert = Belegbarkeit: 1.0 nur bei direkt abgelesener Zahl; <1.0 nur bei Maßstab-Berechnung — JEDER Wert mit conf<1.0 MUSS einen uncertain-Eintrag haben.

EINHEITEN (Ergebnis = GANZZAHLIGE mm, runde abgeleitete Werte):
- Komma = Dezimaltrenner, Nachkomma gehört zur Einheit: "2,5 m"=2500 · "37,5 cm"=375 · "4,20 m"=4200.
- Punkt in einer Maßzahl ist mehrdeutig (Tausender ODER CAD-Dezimal) → über Einheit/Größenordnung auflösen, sonst null+uncertain.
- FEHLT die Einheit (DE-Maßketten oft cm ohne Suffix), aus dem Kettenkontext bestimmen; bleibt sie uneindeutig → null+uncertain.

EIN GLOBALER FRAME FÜR ALLES:
- Ursprung = Schnittpunkt der MITTELLINIEN der oberen und der linken Bezugs-Außenwand. x→rechts, y→nach unten, EXAKT wie im Bild (NICHT spiegeln, NICHT drehen).
- Alle Wände (start/end = Mittellinien) UND alle Raum-Polygone in DIESEM einen Frame. Koordinaten NIE pro Raum neu bei 0 beginnen.
- Leite Raum-Polygone aus dem Wandnetz ab (innere Kante = Mittellinie ∓ halbe Wandstärke). Ist Wandlage/-stärke unbekannt → betroffene Polygon-Ecke null + uncertain statt geraten.
- Eine geteilte Wand nur EINMAL. Maßketten gegen das Gesamtmaß abgleichen → Abweichungen in provenance.warnings.

FELDER: walls[{id,start{x,y},end{x,y},thicknessMm|null,heightMm|null,type:exterior|loadbearing|partition,conf}] · openings[{id,type:door|window|passage,wallId,offsetMm,widthMm,heightMm|null,sillMm|null,conf}] · rooms[{id,name,use,polygon[{x,y}]}].

BEISPIEL (zeigt einen TEILS UNBEKANNTEN Plan mit 2 Räumen im globalen Frame — täusche KEIN Vollmodell vor):
{"schema":"interior-studio.measure/v1","unit":"mm","provenance":{"kind":"vision-dimensions","precision":"exact","confidence":0.7,"warnings":["Süd-Maßkette 60mm kürzer als Gesamtmaß"]},"project":{"title":"","northDeg":0},"uncertain":[{"field":"storeys[0].ceilingHeightMm","reason":"Deckenhöhe nicht bemaßt"},{"field":"walls[1].thicknessMm","reason":"Wandstärke nicht bemaßt"}],"storeys":[{"id":"eg","name":"EG","level":0,"elevationMm":0,"ceilingHeightMm":null,"walls":[{"id":"w1","start":{"x":0,"y":0},"end":{"x":6000,"y":0},"thicknessMm":240,"heightMm":null,"type":"exterior","conf":1.0},{"id":"w2","start":{"x":4000,"y":0},"end":{"x":4000,"y":4000},"thicknessMm":null,"heightMm":null,"type":"partition","conf":1.0}],"openings":[{"id":"win1","type":"window","wallId":"w1","offsetMm":1500,"widthMm":1200,"heightMm":null,"sillMm":null,"conf":1.0}],"rooms":[{"id":"r1","name":"Wohnen","use":"living","polygon":[{"x":120,"y":120},{"x":3942,"y":120},{"x":3942,"y":3880},{"x":120,"y":3880}]},{"id":"r2","name":"Schlafen","use":"bedroom","polygon":[{"x":4057,"y":120},{"x":5880,"y":120},{"x":5880,"y":3880},{"x":4057,"y":3880}]}]}]}

Gib NUR dieses JSON zurück.`;

  async function extractFromPlan(inline) {
    if (!window.Claude) throw new Error("Claude-Modul nicht geladen.");
    const userText = "Lies diesen Grundriss. Extrahiere alle eingetragenen Maße exakt in measure/v1. Erfinde nichts — Unbestimmbares als null + uncertain markieren.";
    const content = window.Claude.content(userText, inline);     // [Bild, Text]
    const txt = await window.Claude.call({ system: MEASURE_SYS, content, maxTokens: 8000 });
    const model = window.Claude.parseJSON(txt);
    if (!model || model.schema !== "interior-studio.measure/v1" || !Array.isArray(model.storeys)) {
      throw new Error("Claude lieferte kein gültiges Maß-Modell.");
    }
    return model;
  }

  window.Measure = {
    DEMO,
    wallLength: len,
    roomArea: polygonAreaMm2,
    validate,
    extractFromPlan,
    mm: v => v / 1000   // mm → Meter (für die 3D-Geometrie)
  };
})();
