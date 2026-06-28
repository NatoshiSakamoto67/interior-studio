/* Interior Studio — Maß-Modell „interior-studio.measure/v1".
   Single Source of Truth für millimetergenaue Räume. ALLE Längen sind INTEGER-MILLIMETER.
   Koordinaten in mm im storey-lokalen Plan-Frame (x→rechts, y→hinten). Wände als Mittellinien.
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
  const len = w => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);     // Wandlänge in mm
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

  window.Measure = {
    DEMO,
    wallLength: len,
    roomArea: polygonAreaMm2,
    validate,
    mm: v => v / 1000   // mm → Meter (für die 3D-Geometrie)
  };
})();
