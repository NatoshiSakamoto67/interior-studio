/* Interior Studio — IFC-Import (web-ifc, WASM) auf der ESM-Spur.
   IFC trägt echte Geometrie + Einheiten: Wände, Türen, Fenster, Räume, Geschosse.
   Wir laden die GEOMETRIE direkt als three.js-Meshes (das IST die exakte CAD-Geometrie) und
   übergeben sie dem begehbaren Parametric-Viewer. web-ifc wird LAZY geladen (erst beim Import).
   API: window.IFC.loadIFC(arrayBuffer, onProgress) → { group, meshCount, scaled }. */
import * as THREE from "three";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.77/";
let api = null, IFCPROJECT = null;

async function init(onProgress) {
  if (api) return;
  if (onProgress) onProgress("IFC-Engine wird geladen (WASM, beim 1. Mal größer) …");
  const mod = await import("web-ifc");
  const IfcAPI = mod.IfcAPI || (mod.default && mod.default.IfcAPI);
  if (!IfcAPI) throw new Error("web-ifc: IfcAPI nicht gefunden.");
  IFCPROJECT = mod.IFCPROJECT;
  api = new IfcAPI();
  api.SetWasmPath(WASM_BASE);
  await api.Init();
}

// Echte Längeneinheit aus der IFC lesen (IfcUnitAssignment) → Faktor auf METER.
// So wird die Skalierung prinzipientreu statt geraten. Gibt null zurück, wenn nicht lesbar.
const SI_PREFIX = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 10, DECI: 0.1, CENTI: 0.01, MILLI: 0.001, MICRO: 1e-6, NANO: 1e-9, PICO: 1e-12, FEMTO: 1e-15, ATTO: 1e-18 };
function lengthUnitToMeters(modelID) {
  try {
    if (!IFCPROJECT) return null;
    const projVec = api.GetLineIDsWithType(modelID, IFCPROJECT);
    if (!projVec || projVec.size() === 0) return null;
    const proj = api.GetLine(modelID, projVec.get(0));
    if (!proj || !proj.UnitsInContext) return null;
    const ua = api.GetLine(modelID, proj.UnitsInContext.value);
    const units = ua && ua.Units; if (!units || !units.length) return null;
    for (let i = 0; i < units.length; i++) {
      const u = api.GetLine(modelID, units[i].value);
      const ut = u && u.UnitType && u.UnitType.value;
      if (ut !== "LENGTHUNIT") continue;
      // IfcSIUnit (Name METRE [+ Prefix]) …
      if (u.Name && /METRE|METER/i.test(u.Name.value)) {
        const pref = u.Prefix && u.Prefix.value;
        return (pref && SI_PREFIX[pref] != null) ? SI_PREFIX[pref] : 1;
      }
      // … oder IfcConversionBasedUnit (z. B. inch → ConversionFactor in Metern)
      if (u.ConversionFactor) {
        const mwu = api.GetLine(modelID, u.ConversionFactor.value);
        const v = mwu && mwu.ValueComponent && mwu.ValueComponent.value;
        if (typeof v === "number" && v > 0) return v;
      }
    }
  } catch (e) {}
  return null;
}

async function loadIFC(arrayBuffer, onProgress) {
  await init(onProgress);
  if (onProgress) onProgress("IFC wird geöffnet …");
  const modelID = api.OpenModel(new Uint8Array(arrayBuffer));
  const group = new THREE.Group();
  let unitFromIfc = null;
  try {
    unitFromIfc = lengthUnitToMeters(modelID);   // VOR dem Schließen lesen (sonst Modell zu)
    api.StreamAllMeshes(modelID, (flatMesh) => {
      const geos = flatMesh.geometries;
      for (let i = 0; i < geos.size(); i++) {
        const placed = geos.get(i);
        const g = api.GetGeometry(modelID, placed.geometryExpressID);
        const v = api.GetVertexArray(g.GetVertexData(), g.GetVertexDataSize());     // [px,py,pz,nx,ny,nz, …]
        const ix = api.GetIndexArray(g.GetIndexData(), g.GetIndexDataSize());
        const n = v.length / 6;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
        for (let k = 0, j = 0; j < n; k += 6, j += 1) {
          pos[j * 3] = v[k]; pos[j * 3 + 1] = v[k + 1]; pos[j * 3 + 2] = v[k + 2];
          nor[j * 3] = v[k + 3]; nor[j * 3 + 1] = v[k + 4]; nor[j * 3 + 2] = v[k + 5];
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geom.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        geom.setIndex(new THREE.BufferAttribute(new Uint32Array(ix), 1));
        const c = placed.color || { x: 0.85, y: 0.85, z: 0.82, w: 1 };
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(c.x, c.y, c.z), roughness: 0.85, metalness: 0,
          transparent: c.w < 0.99, opacity: c.w, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation));
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
        g.delete();
      }
    });
  } finally {
    try { api.CloseModel(modelID); } catch (e) {}
  }
  if (!group.children.length) throw new Error("Keine Geometrie in der IFC gefunden.");

  // Einheit PRINZIPIENTREU aus der IFC (vor dem Schließen gelesen); Heuristik nur als Fallback.
  let scaled = false, unitMeters = unitFromIfc, unitSource = "gelesen";
  if (!(unitMeters > 0)) {
    // Fallback: Größen-Heuristik (riesiges Modell ⇒ war in mm)
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    unitMeters = Math.max(size.x, size.y, size.z) > 500 ? 0.001 : 1;
    unitSource = "geschätzt";
  }
  if (unitMeters !== 1) { group.scale.setScalar(unitMeters); scaled = true; }

  return { group, meshCount: group.children.length, scaled, unitMeters, unitSource };
}

window.IFC = { loadIFC };
