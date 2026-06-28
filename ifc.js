/* Interior Studio — IFC-Import (web-ifc, WASM) auf der ESM-Spur.
   IFC trägt echte Geometrie + Einheiten: Wände, Türen, Fenster, Räume, Geschosse.
   Wir laden die GEOMETRIE direkt als three.js-Meshes (das IST die exakte CAD-Geometrie) und
   übergeben sie dem begehbaren Parametric-Viewer. web-ifc wird LAZY geladen (erst beim Import).
   API: window.IFC.loadIFC(arrayBuffer, onProgress) → { group, meshCount, scaled }. */
import * as THREE from "three";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.77/";
let api = null;

async function init(onProgress) {
  if (api) return;
  if (onProgress) onProgress("IFC-Engine wird geladen (WASM, beim 1. Mal größer) …");
  const mod = await import("web-ifc");
  const IfcAPI = mod.IfcAPI || (mod.default && mod.default.IfcAPI);
  if (!IfcAPI) throw new Error("web-ifc: IfcAPI nicht gefunden.");
  api = new IfcAPI();
  api.SetWasmPath(WASM_BASE);
  await api.Init();
}

async function loadIFC(arrayBuffer, onProgress) {
  await init(onProgress);
  if (onProgress) onProgress("IFC wird geöffnet …");
  const modelID = api.OpenModel(new Uint8Array(arrayBuffer));
  const group = new THREE.Group();
  try {
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

  // Einheits-Heuristik: ist das Modell riesig (Tausende Einheiten groß), war es mm → in Meter skalieren.
  let scaled = false;
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  if (Math.max(size.x, size.y, size.z) > 500) { group.scale.setScalar(0.001); scaled = true; }

  return { group, meshCount: group.children.length, scaled };
}

window.IFC = { loadIFC };
