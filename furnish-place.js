/* furnish-place.js — reine Platzierungs-Mathematik für die Möblierung.
   Kein THREE, kein DOM → in node unit-testbar. Alles in METER, Welt-Koordinaten x,z.
   Möbel-Footprint: w=Breite, d=Tiefe (Meter), ry=Drehung (Radiant). */

// measure-Modell → Wand-Segmente in Welt-Metern. mm() = Measure.mm (mm → Meter).
export function wallSegments(model, mm) {
  const st = (model && model.storeys && model.storeys[0]) || {};
  return (st.walls || []).map(w => ({
    x1: mm(w.start.x), z1: mm(w.start.y), x2: mm(w.end.x), z2: mm(w.end.y),
    th: mm(w.thicknessMm || (w.type === "partition" ? 115 : 240)),
  })).filter(s => (s.x1 !== s.x2 || s.z1 !== s.z2));
}

// Raum-Polygone in Welt-Metern.
export function roomPolys(model, mm) {
  const st = (model && model.storeys && model.storeys[0]) || {};
  return (st.rooms || []).map(r => (r.polygon || []).map(p => ({ x: mm(p.x), z: mm(p.y) })))
    .filter(poly => poly.length >= 3);
}

export function boundsOf(segs) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  segs.forEach(s => {
    minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
    minZ = Math.min(minZ, s.z1, s.z2); maxZ = Math.max(maxZ, s.z1, s.z2);
  });
  return { minX, maxX, minZ, maxZ };
}

function pointSeg(px, pz, s) {
  const dx = s.x2 - s.x1, dz = s.z2 - s.z1, L2 = dx * dx + dz * dz || 1e-9;
  let t = ((px - s.x1) * dx + (pz - s.z1) * dz) / L2; t = Math.max(0, Math.min(1, t));
  const qx = s.x1 + t * dx, qz = s.z1 + t * dz;
  return { d: Math.hypot(px - qx, pz - qz), qx, qz };
}

// Wandabstände aufsteigend: [{d, qx, qz, seg}].
export function nearestWallDistances(p, segs) {
  return segs.map(seg => ({ ...pointSeg(p.x, p.z, seg), seg })).sort((a, b) => a.d - b.d);
}

// Rücken bündig an nächste Wand (< snapM) einrasten; dreht auf die Wandrichtung.
export function snapToWalls(pos, size, segs, snapM) {
  const nd = nearestWallDistances(pos, segs);
  if (!nd.length) return { x: pos.x, z: pos.z, ry: size.ry || 0, snapped: false };
  const n = nd[0];
  // Einrasten, wenn der RÜCKEN (halbe Tiefe) in Snap-Reichweite der Wand ist — nicht der Mittelpunkt.
  if (n.d > size.d / 2 + snapM) return { x: pos.x, z: pos.z, ry: size.ry || 0, snapped: false };
  const s = n.seg;
  const ang = Math.atan2(s.z2 - s.z1, s.x2 - s.x1);
  let nx = -(s.z2 - s.z1), nz = (s.x2 - s.x1);
  const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
  // Normale zur Möbelseite zeigen lassen (weg von der Wand, Richtung pos)
  if ((pos.x - n.qx) * nx + (pos.z - n.qz) * nz < 0) { nx = -nx; nz = -nz; }
  const off = size.d / 2 + (s.th || 0) / 2;
  return { x: n.qx + nx * off, z: n.qz + nz * off, ry: ang, snapped: true };
}

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z, xj = poly[j].x, zj = poly[j].z;
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}

// Möbel-Mittelpunkt so verschieben, dass der Footprint im Raum-Polygon bleibt (Bounds-Klemmung).
export function clampToPolys(pos, size, polys) {
  const hw = size.w / 2, hd = size.d / 2;
  const poly = polys.find(p => pointInPoly(pos.x, pos.z, p)) || polys[0];
  if (!poly) return { x: pos.x, z: pos.z };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  poly.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
  const x = Math.max(minX + hw, Math.min(maxX - hw, pos.x));
  const z = Math.max(minZ + hd, Math.min(maxZ - hd, pos.z));
  return { x, z };
}

export function footprint(o) { return { cx: o.x, cz: o.z, hw: o.w / 2, hd: o.d / 2, ry: o.ry || 0 }; }
