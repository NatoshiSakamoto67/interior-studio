/* furnish.js — Möblierung der mm-genauen Welt: Katalog-Möbel als Maßkörper platzieren,
   auswählen, ziehen (Plan), drehen, am Grundriss einrasten. THREE + DOM; reine Mathematik
   liegt in furnish-place.js. Globale API: window.Furnish. */
import * as THREE from "three";
// furnish-place.js stellt sich als window.FurnishPlace bereit (bundle-sicher, kein relativer Import).
const Place = window.FurnishPlace;

const M = () => window.Measure;
const P = () => window.Parametric;
const SNAP_M = 0.15;          // Rücken rastet < 15 cm an die Wand
const NUDGE_M = 0.01;         // Pfeiltasten = 10 mm
const ROT_STEP = Math.PI / 12; // q/e = 15°

let _uid = 0;
const placed = [];            // { uid, obj, item }
let selected = null;          // Möbel-Root (Group) oder null
let drag = null;              // { obj, grab:{x,z}, start:{x,z} }

const cm = (v) => (v || 0) / 100;
const $id = (id) => document.getElementById(id);

/* ---------- Maßkörper je kind (echte B×T×H in Metern, Katalogfarbe) ---------- */
function mat(color) { return new THREE.MeshStandardMaterial({ color: new THREE.Color(color || "#b9b2a6"), roughness: 0.7, metalness: 0.02 }); }
function box(w, h, d, m, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01)), m);
  mesh.castShadow = mesh.receiveShadow = true; mesh.position.set(0, y, z || 0); return mesh;
}
function buildProxy(item) {
  const w = cm(item.w), d = cm(item.d), h = cm(item.h), m = mat(item.color);
  const root = new THREE.Group();
  root.userData.furnitureRoot = true; root.userData.cat = item; root.userData.size = { w, d, h };
  const k = item.kind;
  if (k === "sofa") {
    root.add(box(w, h * 0.55, d, m, h * 0.275));
    root.add(box(w, h * 0.45, d * 0.28, m, h * 0.55 + h * 0.225, -d / 2 + d * 0.14));
  } else if (k === "table" || k === "side") {
    root.add(box(w, h * 0.1, d, m, h - h * 0.05));
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
      const leg = box(w * 0.06, h * 0.9, d * 0.06, m, h * 0.45, sz * (d / 2 - d * 0.05));
      leg.position.x = sx * (w / 2 - w * 0.05); root.add(leg);
    });
  } else if (k === "chair") {
    const seatY = cm(45);
    root.add(box(w, h * 0.08, d, m, seatY));
    root.add(box(w, h * 0.5, d * 0.12, m, seatY + h * 0.25, -d / 2 + d * 0.06));
  } else if (k === "lamp") {
    root.add(box(w * 0.12, h * 0.85, d * 0.12, m, h * 0.425));
    root.add(box(w, h * 0.12, d, m, h * 0.93));
  } else if (k === "plant") {
    root.add(box(w * 0.5, h * 0.3, d * 0.5, m, h * 0.15));
    const crown = new THREE.Mesh(new THREE.SphereGeometry(Math.max(w, d) * 0.5, 14, 10), mat("#3f7d4f"));
    crown.position.y = h * 0.62; crown.castShadow = true; root.add(crown);
  } else {   // rug / default: flache Platte
    const hh = Math.max(h, 0.02); root.add(box(w, hh, d, m, hh / 2));
  }
  return root;
}

/* ---------- Welt-Geometrie des aktuellen Modells (für Einrasten/Grenzen) ---------- */
function mm() { return (M() && M().mm) ? M().mm : (v) => v / 1000; }
function modelGeom() {
  const model = P() && P().currentModel ? P().currentModel() : null;
  if (!model) return { segs: [], polys: [] };
  return { segs: Place.wallSegments(model, mm()), polys: Place.roomPolys(model, mm()) };
}
// Achsenausgerichtete Hülle eines um ry gedrehten Rechtecks (für korrektes Klemmen nach dem Drehen).
function rotatedExtents(w, d, ry) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); return { w: c * w + s * d, d: s * w + c * d }; }
function applyConstraints(obj) {
  const sz = obj.userData.size, g = modelGeom();
  let p = { x: obj.position.x, z: obj.position.z }, ry = obj.rotation.y;
  // 1) Erst an die nächste Wand einrasten (setzt Drehung + bündige Position) …
  if (g.segs.length) {
    const s = Place.snapToWalls(p, { w: sz.w, d: sz.d, ry }, g.segs, SNAP_M);
    if (s.snapped) { ry = s.ry; obj.rotation.y = ry; p = { x: s.x, z: s.z }; }
  }
  // 2) … dann im Raum halten — mit der GEDREHTEN Grundfläche.
  if (g.polys.length) { const e = rotatedExtents(sz.w, sz.d, ry); p = Place.clampToPolys(p, { w: e.w, d: e.d }, g.polys); }
  obj.position.x = p.x; obj.position.z = p.z;
}

/* ---------- Platzieren ---------- */
function defaultPoint() {
  const v = (P() && P().getView) ? P().getView() : "walk";
  if (v === "walk" && P().frontFloorPoint) { const p = P().frontFloorPoint(); if (p) return p; }
  const g = modelGeom();
  if (g.segs.length) { const b = Place.boundsOf(g.segs); return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }; }
  return { x: 0, z: 0 };
}
const FURNITURE_KINDS = ["sofa", "table", "chair", "lamp", "plant", "rug", "side"];
function isFurniture(it) { return !!it && FURNITURE_KINDS.indexOf(it.kind) >= 0 && it.w > 0 && it.d > 0 && it.h > 0; }
function placeFromCatalog(id, atPoint) {
  if (!(P() && P().hasModel && P().hasModel())) return null;
  const item = (window.CATALOG || []).find((i) => i.id === id);
  if (!isFurniture(item)) return null;   // nur echte Möbel mit gültigen Maßen (keine Fische/Oberflächen aus anderen Katalogen)
  const obj = buildProxy(item);
  const pt = atPoint || defaultPoint();
  obj.position.set(pt.x, 0, pt.z);
  applyConstraints(obj);
  P().addObject(obj);
  placed.push({ uid: ++_uid, obj, item });
  select(obj); fireChange();
  return obj;
}

/* ---------- Liste / entfernen / wiederherstellen ---------- */
function toMm(meters) { return Math.round(meters * 1000); }
function list() {
  return placed.map(({ uid, obj, item }) => ({
    uid, id: item.id, name: item.name, price: item.price || 0,
    x_mm: toMm(obj.position.x), z_mm: toMm(obj.position.z), ry: +obj.rotation.y.toFixed(4),
  }));
}
function removeByUid(uid) {
  const i = placed.findIndex((p) => p.uid === uid); if (i < 0) return;
  const { obj } = placed[i];
  if (selected === obj) select(null);
  P().removeObject(obj); disposeObj(obj); placed.splice(i, 1); fireChange();
}
function clear() { placed.splice(0).forEach(({ obj }) => { P().removeObject(obj); disposeObj(obj); }); select(null); fireChange(); }
function restore(arr) {
  clear();
  (arr || []).forEach((r) => { const o = placeFromCatalog(r.id, { x: (r.x_mm || 0) / 1000, z: (r.z_mm || 0) / 1000 }); if (o && r.ry != null) { o.rotation.y = r.ry; applyConstraints(o); } });
  select(null);
}
function disposeObj(obj) { obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }

/* ---------- Auswahl + Hervorhebung (emissive, transform-unabhängig) ---------- */
function setEmissive(obj, hex) { obj.traverse((o) => { if (o.isMesh && o.material && "emissive" in o.material) { if (o.userData._em == null) o.userData._em = o.material.emissive.getHex(); o.material.emissive.setHex(hex); } }); }
function clearEmissive(obj) { obj.traverse((o) => { if (o.isMesh && o.material && o.userData._em != null) { o.material.emissive.setHex(o.userData._em); } }); }
function select(o) {
  if (selected && selected !== o) clearEmissive(selected);
  selected = o || null;
  if (selected) setEmissive(selected, 0x3a2a12);
  updateInspector(selected);
  if (window.Furnish && window.Furnish._onSelect) window.Furnish._onSelect(selected);
}

/* ---------- mm-Inspektor ---------- */
function m2(v) { return v.toFixed(2).replace(".", ","); }
function updateInspector(obj) {
  const el = $id("furnishInspector"); if (!el) return;
  if (!obj) { el.hidden = true; el.textContent = ""; return; }
  const g = modelGeom();
  const nd = g.segs.length ? Place.nearestWallDistances({ x: obj.position.x, z: obj.position.z }, g.segs) : [];
  let s = (obj.userData.cat.name || "Möbel") + " · x " + m2(obj.position.x) + " m · z " + m2(obj.position.z) + " m";
  if (nd[0]) s += " · Wand " + m2(nd[0].d) + " m";
  if (nd[1]) s += " · " + m2(nd[1].d) + " m";
  el.textContent = s; el.hidden = false;
}

/* ---------- Zeiger (nur Plan-Ansicht; von parametric.js geroutet) ---------- */
function objs() { return placed.map((p) => p.obj); }
function _pointer(type, x, y) {
  if (!(P() && P().pointerToFloor)) return false;
  if (type === "down") {
    const hit = P().pickObjects(x, y, objs());
    if (hit) { const fp = P().pointerToFloor(x, y) || { x: hit.position.x, z: hit.position.z }; select(hit); drag = { obj: hit, grab: fp, start: { x: hit.position.x, z: hit.position.z } }; return true; }
    select(null); return false;     // nichts getroffen → Aufrufer darf den Plan schwenken
  } else if (type === "move") {
    if (!drag) return false;
    const p = P().pointerToFloor(x, y); if (!p) return true;
    drag.obj.position.x = drag.start.x + (p.x - drag.grab.x);
    drag.obj.position.z = drag.start.z + (p.z - drag.grab.z);
    applyConstraints(drag.obj); updateInspector(drag.obj); return true;
  } else if (type === "up") {
    if (drag) { drag = null; fireChange(); }
    return false;
  }
  return false;
}
function _key(key) {
  if (!selected) return false;
  if (key === "q" || key === "Q") { selected.rotation.y += ROT_STEP; applyConstraints(selected); updateInspector(selected); fireChange(); return true; }
  if (key === "e" || key === "E") { selected.rotation.y -= ROT_STEP; applyConstraints(selected); updateInspector(selected); fireChange(); return true; }
  if (key === "Delete" || key === "Backspace") { const e = placed.find((p) => p.obj === selected); if (e) removeByUid(e.uid); return true; }
  const d = { ArrowUp: [0, -NUDGE_M], ArrowDown: [0, NUDGE_M], ArrowLeft: [-NUDGE_M, 0], ArrowRight: [NUDGE_M, 0] }[key];
  if (d) { selected.position.x += d[0]; selected.position.z += d[1]; applyConstraints(selected); updateInspector(selected); fireChange(); return true; }
  return false;
}

function fireChange() { if (window.Furnish && window.Furnish._onChange) window.Furnish._onChange(); }

window.Furnish = {
  init: () => {},
  placeFromCatalog, list, removeByUid, clear, restore,
  select: (o) => select(o), selected: () => selected, count: () => placed.length,
  furnitureList: () => (window.CATALOG || []).filter(isFurniture),   // nur echte Möbel für den Picker
  _pointer, _key, _onChange: null, _onSelect: null,
};
