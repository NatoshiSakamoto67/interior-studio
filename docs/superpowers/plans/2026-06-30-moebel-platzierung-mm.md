# Möbel mm-genau platzieren — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Katalog-Möbel als maßgenaue Körper in die mm-exakte Welt-3D-Szene setzen — präzise im Plan-von-oben, grob im Begehen, beides synchron, Grundriss strikt eingehalten — und das bestehende „Foto dieser Ansicht" rendert genau diese Möblierung fotoreal.

**Architecture:** Eine `three.js`-Szene (`parametric.js`), zwei Kameras (Perspektive=Begehen, Ortho=Plan-von-oben). Neues reines Mathe-Modul `furnish-place.js` (kein THREE/DOM, unit-getestet) für Einrasten/Grenzen/mm-Abstände. Neues `furnish.js` baut Maßkörper je `kind`, hängt sie in die Szene, verwaltet Auswahl/Ziehen/Liste. `parametric.js` bekommt eine schlanke API (Welt-Wände/Räume/Grenzen, Ortho-Umschalter, Objekt-Add/Remove, Pointer→Boden-Raycast).

**Tech Stack:** Vanilla ES-Module, three@0.180 (ESM via Importmap), Playwright (headless, swiftshader) für Integration, `node` für Mathe-Unit-Tests. Kein Framework, kein Build-Step außer `tools/build-single.py`.

## Global Constraints

- Maße im Modell sind mm-Integer; Welt-Einheiten = Meter via `Measure.mm(valueMm)→meter`. Plan-Koordinaten `x,y` (mm) → Welt `x,z` (m).
- Offline-fähig: keine neuen CDN/Backends. Nur die bestehende Importmap.
- Immutabilität bei Datenobjekten (Möbel-Ledger als neue Arrays/Objekte, kein In-place-Mutate des Katalogs).
- Kein `console.log` im Auslieferungscode.
- Dateien klein/fokussiert (<400 Zeilen Ziel). `furnish-place.js` ohne THREE/DOM, damit in `node` testbar.
- Funktioniert mit Maß-Modell + CAD (volle Wand-/Raumdaten) und IFC (nur Boden-Platzierung + Grenzen-Box, kein Wandschema).
- Nach Codeänderung an HTML/JS/CSS: `python3 tools/build-single.py` neu bauen (Single-File-Bundle).

---

### Task 1: Reine Platzierungs-Mathematik `furnish-place.js`

**Files:**
- Create: `furnish-place.js`
- Test: `tests/furnish-place.test.mjs`

**Interfaces:**
- Produces (alles in METER, Welt-Koordinaten x,z; Möbel-Footprint achsenausgerichtet zur Drehung `ry` in Radiant):
  - `footprint({x,z,ry,w,d})` → `{cx,cz,hw,hd,ry}` (Halbmaße in m; w=Breite, d=Tiefe in m)
  - `wallSegments(model, mm)` → `[{x1,z1,x2,z2,th}]` (Welt-Meter; aus measure-Modell)
  - `roomPolys(model, mm)` → `[[{x,z}],…]` (Welt-Meter)
  - `boundsOf(segments)` → `{minX,maxX,minZ,maxZ}`
  - `nearestWallDistances({x,z}, segments)` → `[{d, seg}]` aufsteigend (d in m, Punkt→Segment)
  - `snapToWalls(pos, size, segments, snapM)` → `{x,z,ry,snapped}` (Rücken bündig an nächste Wand < snapM; ry auf Wandrichtung gedreht)
  - `clampToPolys(pos, size, polys)` → `{x,z}` (Möbel-Mittelpunkt so verschoben, dass Footprint im Polygon bleibt; Fallback: Bounds)

- [ ] **Step 1: Write failing tests**

```js
// tests/furnish-place.test.mjs
import assert from 'node:assert/strict';
import * as P from '../furnish-place.js';

const mm = (v) => v / 1000;                       // measure.mm-Äquivalent für den Test

// wallSegments: ein measure-Modell mit 1 Wand 0,0→5000,0 (mm), th 240
const model = { storeys: [{ walls: [
  { id: 'w1', start: { x: 0, y: 0 }, end: { x: 5000, y: 0 }, thicknessMm: 240 },
  { id: 'w2', start: { x: 0, y: 0 }, end: { x: 0, y: 4000 }, thicknessMm: 240 },
], rooms: [{ name: 'R', polygon: [{x:0,y:0},{x:5000,y:0},{x:5000,y:4000},{x:0,y:4000}] }] }] };

const segs = P.wallSegments(model, mm);
assert.equal(segs.length, 2);
assert.deepEqual(segs[0], { x1: 0, z1: 0, x2: 5, z2: 0, th: 0.24 });

// nearestWallDistances: Punkt (2, 1) m → nächste Wand = w1 (z=0), Abstand 1 m
const nd = P.nearestWallDistances({ x: 2, z: 1 }, segs);
assert.ok(Math.abs(nd[0].d - 1) < 1e-9);

// snapToWalls: Sofa 2,1 m breit/tief bei (2, 0.4) m, snap 0.15 → rastet an w1 (z=0),
// Rücken bündig: Mittelpunkt z = halbe Tiefe = 0.5 (d=1.0 → hd=0.5)
const snapped = P.snapToWalls({ x: 2, z: 0.4 }, { w: 2.0, d: 1.0, ry: 0 }, segs, 0.15);
assert.equal(snapped.snapped, true);
assert.ok(Math.abs(snapped.z - 0.5) < 1e-6);

// clampToPolys: Möbel-Mittelpunkt (4.9, 2) Footprint 1×1 → in 5×4-Raum zurückgeschoben auf x=4.5
const polys = P.roomPolys(model, mm);
const c = P.clampToPolys({ x: 4.9, z: 2 }, { w: 1, d: 1, ry: 0 }, polys);
assert.ok(c.x <= 4.5 + 1e-6 && c.x >= 0.5);

console.log('furnish-place: alle Tests grün');
```

- [ ] **Step 2: Run, verify it fails**

Run: `node tests/furnish-place.test.mjs`
Expected: FAIL (`furnish-place.js` existiert nicht / Export fehlt).

- [ ] **Step 3: Implement `furnish-place.js`** (reine Geometrie, kein THREE)

```js
/* furnish-place.js — reine Platzierungs-Mathematik (Meter, Welt x,z). Kein THREE, kein DOM. */
export function wallSegments(model, mm) {
  const st = (model && model.storeys && model.storeys[0]) || {};
  return (st.walls || []).map(w => ({
    x1: mm(w.start.x), z1: mm(w.start.y), x2: mm(w.end.x), z2: mm(w.end.y),
    th: mm(w.thicknessMm || (w.type === 'partition' ? 115 : 240)),
  })).filter(s => (s.x1 !== s.x2 || s.z1 !== s.z2));
}
export function roomPolys(model, mm) {
  const st = (model && model.storeys && model.storeys[0]) || {};
  return (st.rooms || []).map(r => (r.polygon || []).map(p => ({ x: mm(p.x), z: mm(p.y) })))
    .filter(poly => poly.length >= 3);
}
export function boundsOf(segs) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  segs.forEach(s => { minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2); minZ = Math.min(minZ, s.z1, s.z2); maxZ = Math.max(maxZ, s.z1, s.z2); });
  return { minX, maxX, minZ, maxZ };
}
function pointSeg(px, pz, s) {
  const dx = s.x2 - s.x1, dz = s.z2 - s.z1, L2 = dx * dx + dz * dz || 1e-9;
  let t = ((px - s.x1) * dx + (pz - s.z1) * dz) / L2; t = Math.max(0, Math.min(1, t));
  const qx = s.x1 + t * dx, qz = s.z1 + t * dz;
  return { d: Math.hypot(px - qx, pz - qz), qx, qz };
}
export function nearestWallDistances(p, segs) {
  return segs.map(seg => ({ ...pointSeg(p.x, p.z, seg), seg })).sort((a, b) => a.d - b.d);
}
export function snapToWalls(pos, size, segs, snapM) {
  const nd = nearestWallDistances(pos, segs);
  if (!nd.length) return { x: pos.x, z: pos.z, ry: size.ry || 0, snapped: false };
  const n = nd[0]; if (n.d > snapM) return { x: pos.x, z: pos.z, ry: size.ry || 0, snapped: false };
  const s = n.seg; const ang = Math.atan2(s.z2 - s.z1, s.x2 - s.x1);       // Wandrichtung
  // Rücken bündig an die Wand: Mittelpunkt = nächster Wandpunkt + Normale * (halbe Tiefe + halbe Wand)
  let nx = -(s.z2 - s.z1), nz = (s.x2 - s.x1); const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
  // Normale soll zur Möbelseite zeigen (weg von der Wand, Richtung pos):
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
export function clampToPolys(pos, size, polys) {
  const hw = size.w / 2, hd = size.d / 2;
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  // Wähle das Polygon, das den Mittelpunkt enthält (sonst erstes / Bounds-Fallback)
  const poly = polys.find(p => pointInPoly(pos.x, pos.z, p)) || polys[0];
  if (!poly) return { x: pos.x, z: pos.z };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  poly.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
  const x = Math.max(minX + hw, Math.min(maxX - hw, pos.x));
  const z = Math.max(minZ + hd, Math.min(maxZ - hd, pos.z));
  return { x, z };
}
export function footprint(o) { return { cx: o.x, cz: o.z, hw: o.w / 2, hd: o.d / 2, ry: o.ry || 0 }; }
```

- [ ] **Step 4: Run, verify pass**

Run: `node tests/furnish-place.test.mjs`
Expected: `furnish-place: alle Tests grün`

- [ ] **Step 5: Commit**

```bash
git add furnish-place.js tests/furnish-place.test.mjs
git commit -m "feat(furnish): reine Platzierungs-Mathematik (Einrasten/Grenzen/mm-Abstand) + Tests"
```

---

### Task 2: `parametric.js` — Welt-Daten + Objekt-API + Pointer→Boden

**Files:**
- Modify: `parametric.js` (Modul-Scope: aktuelles `model` merken; neue Funktionen + Export)

**Interfaces:**
- Consumes: bestehende `mount/build/buildGroup/start/stop`, `group`, `scene`, `cam`, `renderer`, `host`, `Measure.mm`.
- Produces (Export ergänzen):
  - `currentModel()` → das letzte measure-Modell (oder `null` bei IFC)
  - `addObject(obj3d)` / `removeObject(obj3d)`
  - `pointerToFloor(clientX, clientY)` → `{x,z}|null` (Raycast aktive Kamera → Ebene y=0)
  - `pickObjects(clientX, clientY, objs)` → erstes getroffenes `obj3d|null`
  - `activeCamera()` → aktive Kamera (für Raycaster außerhalb)

- [ ] **Step 1: Modell merken** — in `build(model,…)` nach `lastKind="interior"` ein `lastModel = model;`; in `buildGroup` `lastModel = null;`. Modul-Variable `let lastModel = null;` ergänzen.

- [ ] **Step 2: Raycast-Helfer** (oben `import * as THREE` ist vorhanden)

```js
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _floorPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
function activeCamera() { return (view === 'plan' && orthoCam) ? orthoCam : cam; }
function toNdc(clientX, clientY) { const r = renderer.domElement.getBoundingClientRect(); _ndc.set(((clientX - r.left)/r.width)*2-1, -((clientY - r.top)/r.height)*2+1); return _ndc; }
function pointerToFloor(clientX, clientY) {
  _ray.setFromCamera(toNdc(clientX, clientY), activeCamera());
  const hit = new THREE.Vector3();
  return _ray.ray.intersectPlane(_floorPlane, hit) ? { x: hit.x, z: hit.z } : null;
}
function pickObjects(clientX, clientY, objs) {
  _ray.setFromCamera(toNdc(clientX, clientY), activeCamera());
  const hits = _ray.intersectObjects(objs, true);
  if (!hits.length) return null;
  let o = hits[0].object; while (o && !o.userData.furnitureRoot && o.parent) o = o.parent; return o || null;
}
function addObject(o) { if (group) group.add(o); else scene.add(o); }
function removeObject(o) { if (o && o.parent) o.parent.remove(o); }
```

- [ ] **Step 3: Export ergänzen** — `window.Parametric = { …, currentModel: () => lastModel, addObject, removeObject, pointerToFloor, pickObjects, activeCamera, … }`

- [ ] **Step 4: Verifizieren** (Smoke, kein Unit) — `node --check parametric.js` (nach .mjs-Kopie). Funktionsnachweis kommt in Task 7 (Playwright).

Run: `cp parametric.js /tmp/_pm.mjs && node --check /tmp/_pm.mjs && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add parametric.js
git commit -m "feat(parametric): Modell-Zugriff + addObject/removeObject + Pointer→Boden-Raycast"
```

---

### Task 3: `parametric.js` — Ortho-Kamera „Plan von oben" + Umschalter

**Files:**
- Modify: `parametric.js`

**Interfaces:**
- Produces: `setView('plan'|'walk')`, `getView()→'plan'|'walk'`, `onViewChange(cb)`. Modul-Var `let view='walk', orthoCam=null;`.

- [ ] **Step 1: Ortho-Kamera bauen** (in `mount`, nach `cam`-Erzeugung):

```js
orthoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 200);
orthoCam.up.set(0, 0, -1);          // Plan: Norden = -z nach oben
function fitOrtho() {
  const b = new THREE.Box3(); if (group) b.setFromObject(group);
  const c = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
  const sx = b.isEmpty() ? 6 : (b.max.x - b.min.x), sz = b.isEmpty() ? 6 : (b.max.z - b.min.z);
  const half = Math.max(sx, sz) * 0.6 + 0.5, asp = aspect();
  orthoCam.left = -half * asp; orthoCam.right = half * asp; orthoCam.top = half; orthoCam.bottom = -half;
  orthoCam.position.set(c.x, 30, c.z); orthoCam.lookAt(c.x, 0, c.z); orthoCam.updateProjectionMatrix();
}
```

- [ ] **Step 2: View-Umschalter** + Render mit aktiver Kamera:

```js
let _viewCb = null;
function setView(v) {
  view = (v === 'plan') ? 'plan' : 'walk';
  const dp = host && host.querySelector('.dpad'); if (dp) dp.style.display = view === 'plan' ? 'none' : '';
  if (view === 'plan') { fitOrtho(); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
  if (_viewCb) _viewCb(view);
}
function getView() { return view; }
function onViewChange(cb) { _viewCb = cb; }
```

- [ ] **Step 3: `frame()` rendert aktive Kamera** — ersetze `cam` durch `activeCamera()` in den Render-/Composer-Aufrufen; im Plan-Modus `step(dt)` nur fürs Gehen relevant → im Plan kein WASD-Move (Frame: `if (view==='walk') step(dt);`). `resize()` aktualisiert auch `orthoCam` (via `fitOrtho()` wenn im Plan).

- [ ] **Step 4: Export + Syntaxcheck**

Run: `cp parametric.js /tmp/_pm.mjs && node --check /tmp/_pm.mjs && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add parametric.js
git commit -m "feat(parametric): Ortho-Plan-Kamera + Begehen/Plan-Umschalter, aktive Kamera im Render"
```

---

### Task 4: `furnish.js` — Maßkörper je `kind` + Hinzufügen

**Files:**
- Create: `furnish.js`
- Modify: `catalog.js` (Helfer `dims(item)→{w,d,h}` in Meter, falls noch nicht da)

**Interfaces:**
- Consumes: `Parametric.addObject/removeObject/currentModel/pointerToFloor`, `furnish-place.js`, `window.CATALOG`, `Measure.mm`, `import * as THREE`.
- Produces (global `window.Furnish`): `init()`, `placeFromCatalog(id, atPoint?)`, `list()→[{id,name,x_mm,z_mm,ry,price}]`, `clear()`, `select(obj)`, `restore(arr)`.

- [ ] **Step 1: Proxy-Bauer je `kind`** — Box-basierte Maßkörper aus echten cm-Maßen (→m), Katalogfarbe; Wurzel-Group mit `userData.furnitureRoot=true`, `userData.cat=item`:

```js
import * as THREE from 'three';
const M = () => window.Measure;
function cm(v) { return (v || 0) / 100; }
function mat(color) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(color || '#b9b2a6'), roughness: 0.7, metalness: 0.02 }); }
function box(w, h, d, m, y) { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.castShadow = g.receiveShadow = true; g.position.y = y; return g; }
function buildProxy(item) {
  const w = cm(item.w), d = cm(item.d), h = cm(item.h), m = mat(item.color);
  const root = new THREE.Group(); root.userData.furnitureRoot = true; root.userData.cat = item; root.userData.size = { w, d, h };
  if (item.kind === 'sofa') { root.add(box(w, h * 0.55, d, m, h * 0.275)); root.add(box(w, h * 0.45, d * 0.28, m, h * 0.55 + h * 0.225)).position.z = -d / 2 + d * 0.14; }
  else if (item.kind === 'table' || item.kind === 'side') { root.add(box(w, h * 0.1, d, m, h - h * 0.05)); [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sz]) => { const leg = box(w*0.06, h*0.9, d*0.06, m, h*0.45); leg.position.set(sx*(w/2-w*0.05), h*0.45, sz*(d/2-d*0.05)); root.add(leg); }); }
  else if (item.kind === 'chair') { root.add(box(w, h * 0.08, d, m, cm(45))); root.add(box(w, h * 0.5, d * 0.12, m, cm(45) + h * 0.25)).position.z = -d / 2 + d * 0.06; }
  else if (item.kind === 'lamp') { root.add(box(w * 0.1, h * 0.85, d * 0.1, m, h * 0.425)); root.add(box(w, h * 0.12, d, m, h * 0.93)); }
  else if (item.kind === 'plant') { root.add(box(w * 0.5, h * 0.3, d * 0.5, m, h * 0.15)); const c = new THREE.Mesh(new THREE.SphereGeometry(w * 0.5, 12, 10), mat('#3f7d4f')); c.position.y = h * 0.62; root.add(c); }
  else { const hh = Math.max(h, 0.02); root.add(box(w, hh, d, m, hh / 2)); }   // rug/Default = flache Platte
  return root;
}
```

- [ ] **Step 2: Hinzufügen an Welt-Punkt** (Default: Raum-/Bounds-Mitte) + einrasten + clampen:

```js
import * as Place from './furnish-place.js';
const placed = [];   // {obj, item}
const SNAP_M = 0.15;
function modelGeom() { const m = window.Parametric.currentModel && window.Parametric.currentModel(); const mm = M() ? M().mm : (v)=>v/1000; return { segs: m ? Place.wallSegments(m, mm) : [], polys: m ? Place.roomPolys(m, mm) : [] }; }
function applyConstraints(obj) {
  const sz = obj.userData.size, { segs, polys } = modelGeom();
  let p = { x: obj.position.x, z: obj.position.z };
  if (polys.length) p = Place.clampToPolys(p, sz, polys);
  if (segs.length) { const s = Place.snapToWalls(p, { w: sz.w, d: sz.d, ry: obj.rotation.y }, segs, SNAP_M); if (s.snapped) { obj.rotation.y = s.ry; p = { x: s.x, z: s.z }; } }
  obj.position.x = p.x; obj.position.z = p.z;
}
function placeFromCatalog(id, atPoint) {
  const item = (window.CATALOG || []).find(i => i.id === id); if (!item) return null;
  const obj = buildProxy(item);
  const g = modelGeom(); const b = g.segs.length ? Place.boundsOf(g.segs) : { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  obj.position.set(atPoint ? atPoint.x : (b.minX + b.maxX) / 2, 0, atPoint ? atPoint.z : (b.minZ + b.maxZ) / 2);
  applyConstraints(obj);
  window.Parametric.addObject(obj); placed.push({ obj, item }); select(obj);
  if (window.Furnish._onChange) window.Furnish._onChange();
  return obj;
}
```

- [ ] **Step 3: Liste/Clear/Restore** + `window.Furnish` Export:

```js
function list() { const mm = M() ? M().mm : (v)=>v/1000; const toMm = (m) => Math.round(m / mm(1)); return placed.map(({ obj, item }) => ({ id: item.id, name: item.name, price: item.price || 0, x_mm: toMm(obj.position.x), z_mm: toMm(obj.position.z), ry: +obj.rotation.y.toFixed(4) })); }
function clear() { placed.splice(0).forEach(({ obj }) => window.Parametric.removeObject(obj)); select(null); }
function restore(arr) { clear(); (arr || []).forEach(r => { const o = placeFromCatalog(r.id, { x: (r.x_mm||0)/1000, z: (r.z_mm||0)/1000 }); if (o) { o.rotation.y = r.ry || 0; } }); }
let selected = null;
function select(o) { /* Task 5 setzt Highlight */ selected = o; if (window.Furnish._onSelect) window.Furnish._onSelect(o); }
window.Furnish = { init: () => {}, placeFromCatalog, list, clear, restore, select: (o)=>select(o), selected: () => selected, _onChange: null, _onSelect: null };
```

- [ ] **Step 4: Syntaxcheck** (ESM-Kopie)

Run: `cp furnish.js /tmp/_f.mjs && node --check /tmp/_f.mjs && echo OK`
Expected: `OK` (Hinweis: `import 'three'` ist erst im Browser auflösbar — `--check` prüft nur Syntax.)

- [ ] **Step 5: Commit**

```bash
git add furnish.js catalog.js
git commit -m "feat(furnish): Maßkörper je kind + Hinzufügen mit Einrasten/Raumgrenze"
```

---

### Task 5: `furnish.js` — Auswahl, Ziehen (beide Ansichten), Drehen, mm-Inspektor

**Files:**
- Modify: `furnish.js`, `parametric.js` (Pointer-Events an furnish weiterreichen), `index.html` (Inspektor-Container), `style.css`

**Interfaces:**
- Consumes: `Parametric.pointerToFloor/pickObjects/getView`, `furnish-place.nearestWallDistances`.
- Produces: Auswahl-Highlight (Edges/Box3Helper), Drag-Move auf Bodenebene (+ Constraints live), Drehen per Tasten `q`/`e` (15°) im Plan, Inspektor-Update `#furnishInspector` (Position mm + 2 nächste Wandabstände mm).

- [ ] **Step 1: Highlight** — in `select(o)`: vorherige `Box3Helper` entfernen; für `o` eine `THREE.Box3Helper(new THREE.Box3().setFromObject(o), 0xe3a06f)` als Kind hinzufügen.
- [ ] **Step 2: Pointer-Handler** — `parametric.js` ruft bei `pointerdown`/`move`/`up` auf der Canvas (wenn nicht pointer-locked) `window.Furnish._pointer(type, clientX, clientY)` auf. In furnish: down → `pickObjects` → select + merke Drag; move → `pointerToFloor` → setze `obj.position` (x,z) → `applyConstraints` → Inspektor; up → Drag aus + `_onChange`.
- [ ] **Step 3: Drehen** — keydown `q`/`e` wenn `getView()==='plan'` und `selected`: `selected.rotation.y ± Math.PI/12`, dann `applyConstraints`.
- [ ] **Step 4: Inspektor** — `updateInspector(obj)`: schreibt in `#furnishInspector` „x: 1.20 m · z: 0.50 m · ↤ 1.20 m · ↥ 0.50 m" (nächste 2 Wandabstände aus `nearestWallDistances`).
- [ ] **Step 5: Playwright-Funktionsnachweis** (in Task 7 gebündelt). Hier nur Syntaxcheck + Commit.

Run: `cp furnish.js /tmp/_f.mjs && node --check /tmp/_f.mjs && echo OK`
Expected: `OK`

```bash
git add furnish.js parametric.js index.html style.css
git commit -m "feat(furnish): Auswahl, Ziehen (Plan+Begehen), Drehen, mm-Inspektor"
```

---

### Task 6: Welt-3D-UI — Katalog-Panel + Plan/Begehen-Umschalter + Lebenszyklus

**Files:**
- Modify: `index.html` (Welt-3D-Seitenleiste: Katalog-Panel + Liste; vp-bar: Plan/Begehen-Umschalter), `world.js`, `style.css`

**Interfaces:**
- Consumes: `window.CATALOG`, `Furnish.*`, `Parametric.setView/onViewChange`.
- Produces: Panel `#furnishPanel` (nur sichtbar bei geladenem Parametric-Modell), Umschalter `#viewSeg` (Plan/Begehen), Liste `#furnishList` mit Summe.

- [ ] **Step 1: HTML** — in `.world-side` ein `#furnishPanel hidden` mit Katalog-Chips (aus `window.CATALOG`, Name + „B×T×H") und `#furnishList`; in `.vp-bar` ein Segment `#viewSeg` mit „Plan von oben"/„Begehen"; ein `#furnishInspector` im Viewport.
- [ ] **Step 2: `world.js` Verdrahtung** — beim erfolgreichen Modellbau (`mountModel`, `buildIfcFromFile`, `loadDemoIfc`): `showFurnish(true)`, Katalog-Chips rendern (Klick → `Furnish.placeFromCatalog(id)`), `Furnish._onChange = renderFurnishList`. `#viewSeg`-Klick → `Parametric.setView(...)`. Bei Splat/Leeren: `showFurnish(false)` + `Furnish.clear()`.
- [ ] **Step 3: Liste rendern** — `renderFurnishList()` aus `Furnish.list()`: Zeilen „Name · Preis", Summe; je Zeile „×" → entfernt (über `Furnish`-Remove, Task 4 ergänzt `removeAt(id-or-obj)` falls nötig).
- [ ] **Step 4: CSS** — Panel/Chips/Liste/Inspektor/Umschalter im bestehenden Token-Stil.
- [ ] **Step 5: Commit**

```bash
git add index.html world.js style.css
git commit -m "feat(world): Katalog-Panel + Plan/Begehen-Umschalter + Möbel-Liste mit Preis"
```

---

### Task 7: Integrationstest (Playwright) — der mm-Beweis + beide Ansichten

**Files:**
- Create: `tests/furnish.e2e.mjs` (läuft über das gecachte Playwright wie bei den bisherigen Smoke-Tests; nicht als Repo-Dep)

- [ ] **Step 1: Test schreiben** — Server `:8799`, Welt-3D, Demo-DXF laden; dann:
  - `Furnish.placeFromCatalog('sofa')` via Klick auf Katalog-Chip → `Furnish.list().length===1`.
  - Sofa an Wand ziehen (Pointer-Events im Plan) → `list()[0]` Position == erwarteter mm-Wert (±1 mm), Rücken bündig (Wandabstand 0).
  - `setView('plan')` und `setView('walk')` → dasselbe Objekt sichtbar (Screenshot beider).
  - 0 Konsolenfehler.
- [ ] **Step 2: Ausführen**

Run: `cd ~/interior-studio && (python3 -m http.server 8799 &) ; cd /tmp/is-smoke && node /Users/davidoff/interior-studio/tests/furnish.e2e.mjs`
Expected: alle Checks PASS, 0 Fehler, Screenshots `plan.png`/`walk.png`.

- [ ] **Step 3: Commit**

```bash
git add tests/furnish.e2e.mjs
git commit -m "test(furnish): E2E mm-Platzierung + Plan/Begehen synchron"
```

---

### Task 8: Fotoreal-Prompt für platzierte Möbel + Persistenz + Bundle

**Files:**
- Modify: `world.js` (`fotoPrompt`/`photorealView`), `store.js`/`projects.js` (Möblierung speichern), `tools/build-single.py`-Lauf

**Interfaces:**
- Consumes: `Furnish.list()`, bestehender `photorealView`/`fotoPrompt`.

- [ ] **Step 1: Prompt** — wenn `Furnish.list().length>0`: im `fotoPrompt` den Möblier-Zweig ersetzen durch „render the furniture ALREADY PRESENT in the image photorealistically; keep its count, type, position, scale and the camera identical; do not add or remove furniture." (statt KI-erfinden). `#fotoFurnish` greift nur bei leerer Möblierung.
- [ ] **Step 2: Persistenz** — Welt-3D-Zustand `{ furnishing: Furnish.list() }` in die bestehende Projekt-Speicherung aufnehmen; beim Laden `Furnish.restore(furnishing)` nach Modellbau.
- [ ] **Step 3: Bundle neu bauen** — `python3 tools/build-single.py`; sicherstellen, dass `furnish.js`/`furnish-place.js` in der `<script>`-Reihenfolge von `index.html` stehen (nach `parametric.js`, vor `world.js`) und so auch ins Single-File wandern.
- [ ] **Step 4: Voller Re-Test** — Task-7-E2E + Foto-Render (mit Env-Key) zeigt das platzierte Sofa fotoreal an Position.
- [ ] **Step 5: Commit**

```bash
git add world.js store.js projects.js dist/Interior-Studio.html index.html
git commit -m "feat(furnish): möbliertes Foto erhält platzierte Möbel + Persistenz + Bundle"
```

---

## Self-Review

**Spec coverage:** Maßkörper je kind (T4) ✓ · zwei synchrone Ansichten (T3 Ortho + T2 aktive Kamera; Sync = eine Szene) ✓ · Platzieren Drag/Klick (T5) ✓ · Wand-Einrasten + Raumgrenze + mm-Abstände (T1 Mathe, T5 Inspektor) ✓ · IFC = Boden + Bounds, kein Wandschema (T4 `modelGeom` leere segs/polys → nur Bounds) ✓ · Foto erhält Möbel (T8) ✓ · Liste mit Preis (T6) ✓ · Persistenz (T8) ✓ · Verifikation Playwright + mm-Beweis (T7) ✓.

**Placeholder scan:** Keine TBD/TODO. Schritte mit Code zeigen Code; reine Integrations-/UI-Schritte (T5/T6) sind als konkrete Aktionen + Datei + Verifikationspfad beschrieben (Playwright in T7), bewusst statt Pseudo-Unit-Tests für DOM/THREE.

**Type consistency:** `Furnish.placeFromCatalog(id, atPoint?)`, `list()→{id,name,price,x_mm,z_mm,ry}`, `clear()`, `restore(arr)`, `_onChange/_onSelect` durchgängig. `Parametric.currentModel/addObject/removeObject/pointerToFloor/pickObjects/setView/getView/onViewChange/activeCamera` durchgängig. `furnish-place`: `wallSegments/roomPolys/boundsOf/nearestWallDistances/snapToWalls/clampToPolys/footprint` durchgängig.

**Offene Kleinigkeit:** T6 erwähnt `Furnish.removeAt` — in T4 als optional markiert; bei Bedarf in T6/Step 3 als 3-Zeiler ergänzen (Objekt aus `placed` filtern + `removeObject`).
