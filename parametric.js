/* Interior Studio — Parametrischer Bauer (millimetergenau).
   Baut aus einem measure/v1-Modell (window.Measure) EXAKTE Meter-Geometrie in three@0.180 (ESM-Spur,
   isoliert vom alten globalen THREE). Tier 1, KEIN CSG: jede Wand = Shape mit Loch je Öffnung →
   ExtrudeGeometry (Lochkanten = Laibung/Sturz/Brüstung, exakt & gratis). Boden/Decke aus Raum-Polygonen.
   Maßlinien zeigen die echten mm-Werte. First-Person begehbar (Maus/WASD/Touch).
   API: window.Parametric.mountDemo(host) · build(model,host) · start/stop/dispose · available(). */
import * as THREE from "three";

const EYE = 1.6, SPEED = 2.8;
let renderer, scene, cam, host, group = null;
let raf = 0, running = false, mounted = false, lastT = 0;
let liveComposer = null, liveGtao = null;   // Echtzeit-Post: GTAO (Kontaktschatten) + Bloom (Archviz-Look)
let lastAssumptions = [];   // angenommene (nicht gemessene) Maße dieses Baus — Ehrlichkeits-Ledger
let walked = false;         // erst beim ersten Gehen auf Augenhöhe wechseln (sonst: Übersicht)
let lastKind = "interior";  // "interior" (Maß-Modell/Räume) | "building" (IFC-Gebäude) → steuert den Fotoreal-Prompt
const spawn = { x: 0, z: 0 };   // Innen-Startpunkt fürs Begehen
const keys = {}, look = { yaw: 0, pitch: 0 };
let locked = false, dragging = false, lastX = 0, lastY = 0;
const M = () => window.Measure;

// ---------- Möblierung: zweite (Plan-)Kamera + Welt-Zugriff für furnish.js ----------
let orthoCam = null, view = "walk", lastModel = null, _viewCb = null;
const _ray = new THREE.Raycaster(), _ndcV = new THREE.Vector2(), _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function activeCamera() { return (view === "plan" && orthoCam) ? orthoCam : cam; }
function toNdc(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  _ndcV.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  return _ndcV;
}
function pointerToFloor(clientX, clientY) {
  _ray.setFromCamera(toNdc(clientX, clientY), activeCamera());
  const hit = new THREE.Vector3();
  return _ray.ray.intersectPlane(_floorPlane, hit) ? { x: hit.x, z: hit.z } : null;
}
function frontFloorPoint() {   // Boden-Punkt ~1,4 m vor der Blickrichtung der Begeh-Kamera
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  return { x: cam.position.x + fwd.x * 1.4, z: cam.position.z + fwd.z * 1.4 };
}
function pickObjects(clientX, clientY, objs) {
  if (!objs || !objs.length) return null;
  _ray.setFromCamera(toNdc(clientX, clientY), activeCamera());
  const hits = _ray.intersectObjects(objs, true);
  if (!hits.length) return null;
  let o = hits[0].object; while (o && !o.userData.furnitureRoot && o.parent) o = o.parent;
  return (o && o.userData.furnitureRoot) ? o : null;
}
function addObject(o) { if (group) group.add(o); else if (scene) scene.add(o); }
function removeObject(o) { if (o && o.parent) o.parent.remove(o); }
function fitOrtho() {
  if (!orthoCam) return;
  const b = new THREE.Box3(); if (group) b.setFromObject(group);
  const c = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
  const sx = b.isEmpty() ? 6 : (b.max.x - b.min.x), sz = b.isEmpty() ? 6 : (b.max.z - b.min.z);
  const half = Math.max(sx, sz, 2) * 0.6 + 0.5, asp = aspect();
  orthoCam.left = -half * asp; orthoCam.right = half * asp; orthoCam.top = half; orthoCam.bottom = -half;
  orthoCam.position.set(c.x, 30, c.z); orthoCam.up.set(0, 0, -1); orthoCam.lookAt(c.x, 0, c.z); orthoCam.updateProjectionMatrix();
}
function setView(v) {
  view = (v === "plan") ? "plan" : "walk";
  const dp = host && host.querySelector(".dpad"); if (dp) dp.style.display = view === "plan" ? "none" : "";
  // Plan = Grundriss-Schnitt auf 1,4 m: Decke (und Wand-/Möbel-Teile darüber) weg, Boden+Wände+Möbel sichtbar.
  if (renderer) renderer.clippingPlanes = (view === "plan") ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.4)] : [];
  if (view === "plan") { fitOrtho(); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
  if (_viewCb) { try { _viewCb(view); } catch (e) {} }
}
function getView() { return view; }
function onViewChange(cb) { _viewCb = cb; }

function mount(container) {
  if (mounted) { if (container && renderer && renderer.domElement.parentNode !== container) container.appendChild(renderer.domElement); return; }
  host = container;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });   // preserve → snapshot() lesbar
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  resize();
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4a463f);   // weiches Neutralgrau statt Schwarz (Außenkontext / Lücken)
  cam = new THREE.PerspectiveCamera(64, aspect(), 0.05, 400);
  cam.position.set(0, EYE, 0);
  orthoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 200);   // „Plan von oben"
  orthoCam.up.set(0, 0, -1); orthoCam.position.set(0, 30, 0); orthoCam.lookAt(0, 0, 0);

  // Sonne (Schlagschatten) + dezente Fülle; das große Ambiente liefert das IBL (RoomEnvironment).
  scene.add(new THREE.HemisphereLight(0xffe9d6, 0x2a2026, 0.35));
  const d = new THREE.DirectionalLight(0xfff2e6, 2.4);
  d.position.set(6, 12, 7); d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048); d.shadow.camera.far = 60;
  d.shadow.camera.left = d.shadow.camera.bottom = -20; d.shadow.camera.right = d.shadow.camera.top = 20;
  d.shadow.bias = -0.0009; d.shadow.normalBias = 0.02; scene.add(d);
  setupRender();           // IBL (RoomEnvironment) + Live-Post (GTAO + Bloom), beides defensiv/lazy
  bindControls();
  makeDpad(host, keys);
  window.addEventListener("resize", resize);
  mounted = true;
}

function aspect() { const w = host.clientWidth || 800, h = host.clientHeight || 450; return w / Math.max(1, h); }
function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth || 800, h = host.clientHeight || 450;
  renderer.setSize(w, h);
  if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
  if (liveComposer) liveComposer.setSize(w, h);
  if (liveGtao && liveGtao.setSize) liveGtao.setSize(w, h);
  if (orthoCam) fitOrtho();
}

// IBL (prozedurale RoomEnvironment = realistisches Licht/Reflexe, ohne Asset, offline) +
// Echtzeit-Post (GTAO-Kontaktschatten + dezenter Bloom). Beides lazy + defensiv → Fallback = planer Render.
async function setupRender() {
  try {
    const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    if ("environmentIntensity" in scene) scene.environmentIntensity = 0.85;
    pm.dispose();
  } catch (e) { /* ohne IBL trotzdem nutzbar */ }
  try {
    const [EC, RP, GT, BL, OP] = await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
    ]);
    const w = host.clientWidth || 800, h = host.clientHeight || 450;
    const comp = new EC.EffectComposer(renderer);
    comp.addPass(new RP.RenderPass(scene, cam));
    const gtao = new GT.GTAOPass(scene, cam, w, h);
    if (gtao.updateGtaoMaterial) gtao.updateGtaoMaterial({ radius: 0.4, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 });
    comp.addPass(gtao);
    const coarse = window.matchMedia && window.matchMedia("(pointer:coarse)").matches;   // Handy → schlankerer Post
    if (!coarse) comp.addPass(new BL.UnrealBloomPass(new THREE.Vector2(w, h), 0.16, 0.5, 0.92));
    comp.addPass(new OP.OutputPass());
    liveComposer = comp; liveGtao = gtao;
  } catch (e) { liveComposer = null; }
}

/* ---------- Fotoreal v1: prozedurale Material-Texturen (offline, geometrie-treu) ---------- */
let _tex = null;
function noiseTex(base, amt) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const im = g.getImageData(0, 0, 256, 256), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTex() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#8a6f4f"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 30) {
    g.fillStyle = "rgba(40,26,12,0.28)"; g.fillRect(0, y, 256, 1.5);   // Dielenfuge
    for (let k = 0; k < 24; k++) {
      g.strokeStyle = "rgba(" + (120 + (Math.random() * 40 | 0)) + "," + (95 + (Math.random() * 26 | 0)) + "," + (60 + (Math.random() * 26 | 0)) + ",0.22)";
      g.beginPath(); const yy = y + 3 + Math.random() * 24; g.moveTo(0, yy); g.bezierCurveTo(85, yy + (Math.random() - 0.5) * 3, 170, yy + (Math.random() - 0.5) * 3, 256, yy); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(0.6, 0.6); return t;
}
function textures() {
  if (_tex) return _tex;
  _tex = { wall: noiseTex("#e9e5dd", 14), wallA: noiseTex("#b9c0cc", 14), floor: woodTex(), ceil: noiseTex("#f2efe9", 8) };
  return _tex;
}

/* ---------- exakte Geometrie ---------- */
function build(model, container) {
  if (container) mount(container);
  if (!mounted) return;
  lastModel = model; lastKind = "interior";
  if (group) { scene.remove(group); disposeGroup(group); }
  group = new THREE.Group(); scene.add(group);
  const mm = M().mm;

  lastAssumptions = [];
  const exactModel = ((model.provenance || {}).precision === "exact");
  // PBR + IBL: matte Wände, leicht reflektierender Boden (geben dem RoomEnvironment-Licht Reflexe).
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 0.94, metalness: 0, envMapIntensity: 1.0, side: THREE.DoubleSide });
  const wallAssumedMat = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.94, metalness: 0, envMapIntensity: 1.0, side: THREE.DoubleSide }); // bläulich = Maß angenommen
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4f, roughness: 0.42, metalness: 0, envMapIntensity: 1.1, side: THREE.DoubleSide });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.97, metalness: 0, envMapIntensity: 0.85, side: THREE.DoubleSide });
  const TX = textures();   // Fotoreal v1: Putz/Holz-Texturen auf die exakte Geometrie
  wallMat.map = TX.wall; wallAssumedMat.map = TX.wallA; floorMat.map = TX.floor; ceilMat.map = TX.ceil;

  const st = (model.storeys || [])[0]; if (!st) return;
  const byWall = {}; (st.openings || []).forEach(o => { (byWall[o.wallId] = byWall[o.wallId] || []).push(o); });
  const storeyH = st.ceilingHeightMm || 2700;   // Default nur, wenn der Plan keine Höhe trägt
  if (st.ceilingHeightMm == null) lastAssumptions.push({ what: "Deckenhöhe", value: "2,70 m", reason: "nicht im Plan bemaßt" });

  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  (st.walls || []).forEach(w => {
    const thA = w.thicknessMm == null, htA = w.heightMm == null;
    const Lmm = M().wallLength(w), Hmm = w.heightMm || storeyH, Tmm = w.thicknessMm || (w.type === "partition" ? 115 : 240);
    const L = mm(Lmm), H = mm(Hmm), T = mm(Tmm);
    if (!(L > 0 && H > 0)) return;
    if (thA) lastAssumptions.push({ what: "Wandstärke " + (w.id || ""), value: Tmm + " mm", reason: "nicht bemaßt" });
    const wmat = (thA || htA) ? wallAssumedMat : wallMat;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(L, 0); shape.lineTo(L, H); shape.lineTo(0, H); shape.lineTo(0, 0);
    (byWall[w.id] || []).forEach(o => {
      if (!(o.widthMm > 0)) return;
      const sill = o.sillMm != null ? o.sillMm : (o.type === "window" ? 900 : 0);
      const oh = o.heightMm || (o.type === "window" ? 1300 : 2010);
      if (o.heightMm == null || o.sillMm == null) lastAssumptions.push({ what: (o.type === "window" ? "Fenster " : "Tür ") + (o.id || ""), value: "Höhe/Brüstung Standard", reason: "nicht bemaßt" });
      const a0 = Math.max(0, o.offsetMm || 0), a1 = Math.min(Lmm - 1, a0 + o.widthMm);
      const b0 = Math.max(0, sill), b1 = Math.min(Hmm - 1, b0 + oh);
      if (!(a1 > a0 + 1 && b1 > b0 + 1)) return;   // passt nicht in die Wand → überspringen (validate meldet es)
      const x0 = mm(a0), x1 = mm(a1), y0 = mm(b0), y1 = mm(b1);
      const hole = new THREE.Path(); hole.moveTo(x0, y0); hole.lineTo(x1, y0); hole.lineTo(x1, y1); hole.lineTo(x0, y1); hole.lineTo(x0, y0);
      shape.holes.push(hole);
    });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, steps: 1 });
    const mesh = new THREE.Mesh(geo, wmat); mesh.castShadow = mesh.receiveShadow = true;
    const sx = mm(w.start.x), sy = mm(w.start.y), ex = mm(w.end.x), ey = mm(w.end.y);
    const A = Math.atan2(ey - sy, ex - sx), cos = Math.cos(A), sin = Math.sin(A);
    const exv = new THREE.Vector3(cos, 0, sin), eyv = new THREE.Vector3(0, 1, 0), ezv = new THREE.Vector3(-sin, 0, cos);
    const pos = new THREE.Vector3(sx, 0, sy).addScaledVector(ezv, -T / 2);
    const m4 = new THREE.Matrix4().makeBasis(exv, eyv, ezv); m4.setPosition(pos);
    mesh.applyMatrix4(m4); group.add(mesh);
    minX = Math.min(minX, sx, ex); maxX = Math.max(maxX, sx, ex); minZ = Math.min(minZ, sy, ey); maxZ = Math.max(maxZ, sy, ey);
    addDimLabel(w, exactModel);
  });

  // Boden + Decke aus Raum-Polygonen (Plan x,y → Welt x,z)
  const H0 = mm(storeyH);
  (st.rooms || []).forEach(r => {
    const shp = new THREE.Shape();
    (r.polygon || []).forEach((p, i) => { const X = mm(p.x), Z = mm(p.y); i ? shp.lineTo(X, Z) : shp.moveTo(X, Z); });
    shp.closePath();
    const fg = new THREE.ShapeGeometry(shp);
    const floor = new THREE.Mesh(fg, floorMat); floor.rotation.x = Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    const ceil = new THREE.Mesh(fg.clone(), ceilMat); ceil.rotation.x = -Math.PI / 2; ceil.position.y = H0; group.add(ceil);
  });

  // Ohne Raum-Polygone (z. B. DXF-Import) → Boden/Decke aus der Wand-Bounding-Box
  if (!(st.rooms || []).length && isFinite(minX) && maxX > minX) {
    const fw = (maxX - minX) + 0.4, fd = (maxZ - minZ) + 0.4, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.04, fd), floorMat); floor.position.set(cx, -0.02, cz); floor.receiveShadow = true; group.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.04, fd), ceilMat); ceil.position.set(cx, H0, cz); group.add(ceil);
  }

  // Augenhöhe INNEN, sofort begehbar. Bei Räumen in die MITTE des ersten Raums (Decke ist dann
  // garantiert oben → kein schwarzer „Decken"-Spalt); sonst (DXF) in die Bounding-Box-Ecke quer blicken.
  const r0 = (st.rooms || [])[0];
  if (r0 && r0.polygon && r0.polygon.length) {
    let cx = 0, cz = 0; r0.polygon.forEach(pt => { cx += mm(pt.x); cz += mm(pt.y); }); cx /= r0.polygon.length; cz /= r0.polygon.length;
    cam.position.set(cx, EYE, cz);
    const dir = new THREE.Vector3((minX + maxX) / 2 - cx, 0, (minZ + maxZ) / 2 - cz);
    if (dir.lengthSq() < 0.04) dir.set(0, 0, -1);
    look.yaw = Math.atan2(-dir.x, -dir.z); look.pitch = -0.03;
  } else if (isFinite(minX) && maxX > minX) {
    const ux = maxX - minX, uz = maxZ - minZ;
    cam.position.set(minX + Math.min(0.9, ux * 0.15), EYE, minZ + Math.min(0.9, uz * 0.15));
    const dir = new THREE.Vector3(maxX - cam.position.x, 0, maxZ - cam.position.z).normalize();
    look.yaw = Math.atan2(-dir.x, -dir.z); look.pitch = -0.05;
  } else { cam.position.set(0, EYE, 0); look.yaw = 0; look.pitch = 0; }
  walked = true; applyLook();
  if (view === "plan") fitOrtho();
}

// Kamera schräg von außen-oben auf das Modell richten (Übersicht); Innen-Startpunkt fürs Begehen merken.
function frameView(box, spX, spZ) {
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 2);
  const camPos = new THREE.Vector3(c.x - span * 0.5, box.max.y + span * 0.5 + 1.4, c.z + span * 0.92);
  cam.position.copy(camPos);
  const dir = c.clone().sub(camPos).normalize();
  look.pitch = Math.max(-Math.PI / 2 + 0.05, Math.asin(Math.max(-1, Math.min(1, dir.y))));
  look.yaw = Math.atan2(-dir.x, -dir.z);
  spawn.x = spX; spawn.z = spZ; walked = false;
  applyLook();
}

function addDimLabel(w, exact) {
  try {
    const mm = M().mm, lenM = mm(M().wallLength(w));
    const txt = (exact ? "" : "ca. ") + lenM.toFixed(2).replace(".", ",") + " m";
    const c = document.createElement("canvas"); c.width = 192; c.height = 56;
    const g = c.getContext("2d");
    g.fillStyle = exact ? "rgba(227,160,111,.92)" : "rgba(140,140,150,.92)"; g.beginPath(); g.roundRect(0, 0, 192, 56, 12); g.fill();
    g.fillStyle = "#1a120b"; g.font = "bold 30px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(txt, 96, 30);
    const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false }));
    sp.scale.set(0.9, 0.26, 1);
    const mx = mm((w.start.x + w.end.x) / 2), mz = mm((w.start.y + w.end.y) / 2);
    sp.position.set(mx, 1.2, mz); group.add(sp);
  } catch (e) {}
}

function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); }

// Struktur-Vorlage für den Fotoreal-Pass (Recherche: bake ControlNet-Cues in EIN RGB-Bild).
// → exaktes Seitenverhältnis (kein Recompose-Drift), KEIN Nebel, helleres Licht, gebackenes AO
//   (SSAO best-effort), Maßlabels/D-Pad aus. async wegen optionalem SSAO-Lazy-Import.
let _composer = null, _ssao = null, _aoTried = false;
async function ensureAO() {
  if (_composer || _aoTried) return;
  _aoTried = true;
  try {
    const [EC, RP, SS, OP] = await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/SSAOPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
    ]);
    _composer = new EC.EffectComposer(renderer);
    _composer.addPass(new RP.RenderPass(scene, cam));
    _ssao = new SS.SSAOPass(scene, cam, 1600, 900);
    _ssao.kernelRadius = 0.5; _ssao.minDistance = 0.0015; _ssao.maxDistance = 0.12;
    _composer.addPass(_ssao);
    _composer.addPass(new OP.OutputPass());
  } catch (e) { _composer = null; }   // SSAO nicht verfügbar → planer Render-Fallback
}
// Kanten-Overlay (EdgesGeometry je Mesh, im Weltraum) — dünne dunkle Linien schärfen
// Öffnungen/Wandkanten, was die fehlende MLSD/Canny-Konditionierung emuliert. One-shot.
function makeEdges(g) {
  if (!g) return null;
  let count = 0; g.traverse(o => { if (o.isMesh) count++; });
  if (!count || count > 600) return null;   // zu viel Geometrie → überspringen (Perf)
  const grp = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x2e2a25, transparent: true, opacity: 0.45 });
  g.traverse(o => {
    if (o.isMesh && o.geometry) {
      try {
        const ls = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), mat);
        o.updateWorldMatrix(true, false); ls.applyMatrix4(o.matrixWorld);
        grp.add(ls);
      } catch (e) {}
    }
  });
  return grp.children.length ? grp : null;
}
async function snapshot(opts = {}) {
  if (!renderer || !mounted || !cam) return null;
  const ar = opts.aspectRatio || (16 / 9), W = 1600, H = Math.round(W / ar);
  const hidden = [];
  if (group) group.traverse(o => { if (o.isSprite && o.visible) { hidden.push(o); o.visible = false; } });
  const dp = host && host.querySelector(".dpad"); const dpPrev = dp ? dp.style.display : null; if (dp) dp.style.display = "none";
  const prevFog = scene.fog, prevExp = renderer.toneMappingExposure, prevAspect = cam.aspect, prevPR = renderer.getPixelRatio(), prevBg = scene.background;
  const prevClip = renderer.clippingPlanes; renderer.clippingPlanes = [];   // Foto nie als Plan-Schnitt rendern
  const sz = new THREE.Vector2(); renderer.getSize(sz);
  scene.fog = null; renderer.toneMappingExposure = 1.32;
  // Heller Hintergrund: Lücken (über Wänden / durch Öffnungen) lesen als hell statt schwarz →
  // kein „schwarze Decke / Nachthimmel"-Artefakt, und außen ein photoreal-tauglicher heller Kontext.
  scene.background = new THREE.Color(0xe9e3d7);
  // Fülllicht NUR fürs Foto: hebt Decke/Schattenseiten an (Recherche: nie flach/dunkel),
  // lässt aber die gerichteten Schatten als Tiefencue stehen.
  const fill = new THREE.AmbientLight(0xfff3e6, 0.5); scene.add(fill);
  const edges = (opts.edges === false) ? null : makeEdges(group);   // MLSD/Canny-Ersatz: scharfe Linien an Wänden/Öffnungen
  if (edges) scene.add(edges);
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); cam.aspect = ar; cam.updateProjectionMatrix();
  let url = null;
  try {
    await ensureAO();
    if (_composer) { _composer.setSize(W, H); if (_ssao) _ssao.setSize(W, H); _composer.render(); }
    else renderer.render(scene, cam);
    url = renderer.domElement.toDataURL("image/png");
  } catch (e) {
    try { renderer.render(scene, cam); url = renderer.domElement.toDataURL("image/png"); } catch (_) {}
  }
  // Zustand wiederherstellen
  scene.remove(fill);
  if (edges) { scene.remove(edges); disposeGroup(edges); }
  scene.background = prevBg; scene.fog = prevFog; renderer.toneMappingExposure = prevExp; renderer.clippingPlanes = prevClip;
  renderer.setPixelRatio(prevPR); renderer.setSize(sz.x, sz.y, false); cam.aspect = prevAspect; cam.updateProjectionMatrix();
  hidden.forEach(o => o.visible = true); if (dp) dp.style.display = dpPrev || "";
  if (running) renderer.render(scene, cam);   // Live-Ansicht in alter Größe neu zeichnen
  return url;
}

/* ---------- First-Person ---------- */
function bindControls() {
  const cv = renderer.domElement;
  const FP = (type, x, y) => { const F = window.Furnish; if (F && F._pointer) F._pointer(type, x, y); };
  cv.addEventListener("click", () => { if (view === "walk" && cv.requestPointerLock) cv.requestPointerLock(); });
  document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === cv; });
  document.addEventListener("mousemove", e => {
    if (view === "plan") { FP("move", e.clientX, e.clientY); return; }
    if (locked) { look.yaw -= e.movementX * 0.0023; look.pitch -= e.movementY * 0.0023; clampPitch(); }
    else if (dragging) { look.yaw -= (e.clientX - lastX) * 0.005; look.pitch -= (e.clientY - lastY) * 0.005; lastX = e.clientX; lastY = e.clientY; clampPitch(); }
  });
  cv.addEventListener("mousedown", e => { if (view === "plan") { FP("down", e.clientX, e.clientY); return; } if (!locked) { dragging = true; lastX = e.clientX; lastY = e.clientY; } });
  window.addEventListener("mouseup", () => { if (view === "plan") FP("up"); dragging = false; });
  cv.addEventListener("touchstart", e => { const t = e.touches[0]; if (view === "plan") { FP("down", t.clientX, t.clientY); return; } dragging = true; lastX = t.clientX; lastY = t.clientY; }, { passive: true });
  cv.addEventListener("touchmove", e => { const t = e.touches[0]; if (view === "plan") { FP("move", t.clientX, t.clientY); return; } look.yaw -= (t.clientX - lastX) * 0.006; look.pitch -= (t.clientY - lastY) * 0.006; lastX = t.clientX; lastY = t.clientY; clampPitch(); }, { passive: true });
  cv.addEventListener("touchend", () => { if (view === "plan") FP("up"); dragging = false; });
  window.addEventListener("keydown", e => {
    if (view === "plan" && window.Furnish && window.Furnish._key && window.Furnish._key(e.key)) { e.preventDefault(); return; }
    if (running) keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
}
function clampPitch() { const L = Math.PI / 2 - 0.05; look.pitch = Math.max(-L, Math.min(L, look.pitch)); applyLook(); }
function applyLook() { const cp = Math.cos(look.pitch); cam.lookAt(cam.position.x - Math.sin(look.yaw) * cp, cam.position.y + Math.sin(look.pitch), cam.position.z - Math.cos(look.yaw) * cp); }
function step(dt) {
  let f = 0, s = 0;
  if (keys["w"] || keys["arrowup"]) f += 1; if (keys["s"] || keys["arrowdown"]) f -= 1;
  if (keys["d"] || keys["arrowright"]) s += 1; if (keys["a"] || keys["arrowleft"]) s -= 1;
  if (f || s) {
    if (!walked) { walked = true; cam.position.set(spawn.x, EYE, spawn.z); }   // erstes Gehen → rein in den Raum
    const sy = Math.sin(look.yaw), cy = Math.cos(look.yaw), v = SPEED * dt;
    cam.position.x += (-sy * f + cy * s) * v; cam.position.z += (-cy * f - sy * s) * v;
  }
  if (walked) cam.position.y = EYE;   // beim Begehen auf Augenhöhe; in der Übersicht frei
  applyLook();
}
function frame(t) {
  if (!running) return;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  if (view === "walk") step(dt);   // Gehen nur im Begehen; im Plan steht die Kamera fest oben
  // Echtzeit-Render (sofort, glatt, nie pixelig, kein Neurechnen beim Gehen).
  // Post-Stack (GTAO/Bloom) hängt an der Begeh-Kamera → im Plan plan rendern.
  if (liveComposer && view === "walk") liveComposer.render();
  else renderer.render(scene, activeCamera());
  raf = requestAnimationFrame(frame);
}
function makeDpad(hostEl, keyObj) {
  if (!hostEl || hostEl.querySelector(".dpad")) return;
  const pad = document.createElement("div"); pad.className = "dpad";
  const lbl = { w: "vorwärts", a: "links", s: "rückwärts", d: "rechts" };
  ["w", "a", "s", "d"].forEach(k => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.k = k; b.textContent = k.toUpperCase(); b.setAttribute("aria-label", lbl[k]);
    const on = e => { e.preventDefault(); e.stopPropagation(); keyObj[k] = true; }, off = e => { e.stopPropagation(); keyObj[k] = false; };
    b.addEventListener("touchstart", on, { passive: false }); b.addEventListener("touchend", off); b.addEventListener("touchcancel", off);
    b.addEventListener("mousedown", on); b.addEventListener("mouseup", off); b.addEventListener("mouseleave", off);
    pad.appendChild(b);
  });
  hostEl.appendChild(pad);
}

function start() { if (!mounted || running) return; running = true; lastT = performance.now(); resize(); raf = requestAnimationFrame(frame); }
function stop() { running = false; if (raf) cancelAnimationFrame(raf); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
function dispose() { stop(); if (group) { scene.remove(group); disposeGroup(group); group = null; } }
function mountDemo(container) { if (!window.Measure) return; build(window.Measure.DEMO, container); start(); }

// Fertige three.js-Gruppe (z. B. echte IFC-Geometrie) übernehmen und begehbar machen
function buildGroup(extGroup, container) {
  if (container) mount(container);
  if (!mounted) return;
  if (group) { scene.remove(group); disposeGroup(group); }
  group = extGroup; scene.add(group);
  lastAssumptions = []; lastModel = null; lastKind = "building";
  const box = new THREE.Box3().setFromObject(group);
  if (!box.isEmpty() && isFinite(box.min.x)) {
    const c = box.getCenter(new THREE.Vector3());
    frameView(box, c.x, c.z);                 // Übersicht über das ganze Gebäude, dann begehbar
  } else { cam.position.set(0, EYE, 0); look.yaw = 0; look.pitch = 0; walked = true; applyLook(); }
  if (view === "plan") fitOrtho();
}

window.Parametric = {
  available: () => true, mount, build, buildGroup, mountDemo, start, stop, dispose, snapshot,
  hasModel: () => !!group, kind: () => lastKind, assumptions: () => lastAssumptions.slice(),
  // Möblierung
  currentModel: () => lastModel, addObject, removeObject, pointerToFloor, frontFloorPoint, pickObjects,
  activeCamera, setView, getView, onViewChange
};
