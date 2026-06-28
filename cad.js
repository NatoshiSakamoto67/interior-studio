/* Interior Studio — CAD-Import (DXF) auf der ESM-Spur.
   Parst eine DXF-Datei zu EXAKTEN mm-Wänden (Positionen aus CAD = millimetergenau).
   Einheit aus $INSUNITS. Ebenen-Auswahl, damit nur Wände (nicht Möbel/Maße/Text) gebaut werden.
   Wandstärke/Höhe trägt DXF nicht semantisch → bleiben null (parametric.js markiert sie ehrlich als angenommen).
   API: window.CAD.analyze(text) · toModel(analysis, layerName|null) · guessWallLayer(layers). */
import DxfParser from "dxf-parser";

// $INSUNITS → mm pro Zeichnungseinheit (0/undef → mm angenommen)
function unitScale(header) {
  const u = header && header["$INSUNITS"];
  return ({ 1: 25.4, 4: 1, 5: 10, 6: 1000, 8: 0.0254 })[u] || 1;
}

function lineSeg(e) {
  if (e.vertices && e.vertices.length >= 2) return [e.vertices[0], e.vertices[1]];
  if (e.start && e.end) return [e.start, e.end];
  return null;
}

function segmentsOf(dxf) {
  const segs = [];
  (dxf.entities || []).forEach(e => {
    const layer = e.layer || "0";
    if (e.type === "LINE") {
      const s = lineSeg(e); if (s) segs.push({ layer, a: s[0], b: s[1] });
    } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices && e.vertices.length >= 2) {
      for (let i = 0; i < e.vertices.length - 1; i++) segs.push({ layer, a: e.vertices[i], b: e.vertices[i + 1] });
      if (e.shape || e.closed) segs.push({ layer, a: e.vertices[e.vertices.length - 1], b: e.vertices[0] });
    }
  });
  return segs.filter(s => s.a && s.b && isFinite(s.a.x) && isFinite(s.a.y) && isFinite(s.b.x) && isFinite(s.b.y));
}

function analyze(text) {
  const dxf = new DxfParser().parseSync(text);
  const scale = unitScale(dxf.header);
  const segs = segmentsOf(dxf);
  if (!segs.length) throw new Error("Keine Linien/Polylinien in der DXF gefunden.");
  const byLayer = {};
  segs.forEach(s => { byLayer[s.layer] = (byLayer[s.layer] || 0) + 1; });
  const layers = Object.keys(byLayer).map(name => ({ name, segs: byLayer[name] })).sort((a, b) => b.segs - a.segs);
  return { scale, segs, layers, hasUnit: !!(dxf.header && dxf.header["$INSUNITS"]) };
}

function guessWallLayer(layers) {
  const m = (layers || []).find(l => /wall|wand|mauer|tragwand|aussen|außen/i.test(l.name));
  return m ? m.name : ((layers && layers[0] && layers[0].name) || "*");
}

function toModel(an, layerName) {
  const scale = an.scale;
  const segs = (layerName && layerName !== "*") ? an.segs.filter(s => s.layer === layerName) : an.segs;
  if (!segs.length) throw new Error("Keine Linien auf dieser Ebene.");
  let minX = Infinity, minY = Infinity, maxY = -Infinity;
  segs.forEach(s => { minX = Math.min(minX, s.a.x, s.b.x); minY = Math.min(minY, s.a.y, s.b.y); maxY = Math.max(maxY, s.a.y, s.b.y); });
  const px = v => Math.round((v - minX) * scale);
  const py = v => Math.round((maxY - v) * scale);   // DXF y↑ → Plan y↓ (konsistent mit Claude-Pfad)
  const walls = segs.map((s, i) => ({
    id: "w" + i, start: { x: px(s.a.x), y: py(s.a.y) }, end: { x: px(s.b.x), y: py(s.b.y) },
    thicknessMm: null, heightMm: null, type: "loadbearing", conf: 1
  })).filter(w => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) >= 50);   // <5 cm = Rauschen
  if (!walls.length) throw new Error("Keine brauchbaren Wandlinien (zu kurz).");
  const unc = [{ field: "thicknessMm", reason: "Wandstärken aus DXF nicht semantisch ableitbar — Standard angenommen" }];
  if (!an.hasUnit) unc.push({ field: "unit", reason: "DXF ohne $INSUNITS — Einheit als mm angenommen" });
  return {
    schema: "interior-studio.measure/v1", unit: "mm",
    provenance: { kind: "dxf", precision: "exact", confidence: 1, warnings: an.hasUnit ? [] : ["DXF trug keine Einheit — als mm interpretiert."] },
    project: { title: "CAD-Import (DXF)", northDeg: 0 },
    uncertain: unc,
    storeys: [{ id: "eg", name: "DXF", level: 0, elevationMm: 0, ceilingHeightMm: null, walls, openings: [], rooms: [] }]
  };
}

window.CAD = { analyze, toModel, guessWallLayer };
