/* Unit-Tests für die reine Platzierungs-Mathematik (kein THREE, kein DOM). Lauf: node tests/furnish-place.test.mjs */
import assert from 'node:assert/strict';
import * as P from '../furnish-place.js';

const mm = (v) => v / 1000;   // measure.mm-Äquivalent (mm → Meter)

const model = { storeys: [{
  walls: [
    { id: 'w1', start: { x: 0, y: 0 }, end: { x: 5000, y: 0 }, thicknessMm: 240 },
    { id: 'w2', start: { x: 0, y: 0 }, end: { x: 0, y: 4000 }, thicknessMm: 240 },
  ],
  rooms: [{ name: 'R', polygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }] }],
}] };

// wallSegments: mm → Meter, Wandstärke übernommen
const segs = P.wallSegments(model, mm);
assert.equal(segs.length, 2);
assert.deepEqual(segs[0], { x1: 0, z1: 0, x2: 5, z2: 0, th: 0.24 });

// nearestWallDistances: Punkt (2,1) m → nächste Wand w1 (z=0), Abstand 1 m
const nd = P.nearestWallDistances({ x: 2, z: 1 }, segs);
assert.ok(Math.abs(nd[0].d - 1) < 1e-9, 'Wandabstand 1 m');

// snapToWalls: Sofa T=1.0 m bei (2, 0.4) m, snap 0.15 → rastet an w1; Rücken bündig
//   Mittelpunkt z = halbe Tiefe (0.5) + halbe Wand (0.12) = 0.62
const snapped = P.snapToWalls({ x: 2, z: 0.4 }, { w: 2.0, d: 1.0, ry: 0 }, segs, 0.15);
assert.equal(snapped.snapped, true, 'eingerastet');
assert.ok(Math.abs(snapped.z - 0.62) < 1e-6, `z bündig (war ${snapped.z})`);

// snapToWalls: zu weit weg (z=2) → kein Snap
const far = P.snapToWalls({ x: 2, z: 2 }, { w: 2.0, d: 1.0, ry: 0 }, segs, 0.15);
assert.equal(far.snapped, false, 'kein Snap außer Reichweite');

// clampToPolys: Mittelpunkt (4.9,2), Footprint 1×1 → x auf 4.5 begrenzt (Raum 5×4)
const polys = P.roomPolys(model, mm);
const c = P.clampToPolys({ x: 4.9, z: 2 }, { w: 1, d: 1, ry: 0 }, polys);
assert.ok(c.x <= 4.5 + 1e-6 && c.x >= 0.5 - 1e-6, `x geklemmt (war ${c.x})`);

console.log('furnish-place: alle Tests grün');
