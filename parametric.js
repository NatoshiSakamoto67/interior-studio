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
let lastAssumptions = [];   // angenommene (nicht gemessene) Maße dieses Baus — Ehrlichkeits-Ledger
const keys = {}, look = { yaw: 0, pitch: 0 };
let locked = false, dragging = false, lastX = 0, lastY = 0;
const M = () => window.Measure;

function mount(container) {
  if (mounted) { if (container && renderer && renderer.domElement.parentNode !== container) container.appendChild(renderer.domElement); return; }
  host = container;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  resize();
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0d12);
  scene.fog = new THREE.Fog(0x0e0d12, 22, 70);
  cam = new THREE.PerspectiveCamera(68, aspect(), 0.05, 400);
  cam.position.set(0, EYE, 0);

  scene.add(new THREE.HemisphereLight(0xffe9d6, 0x20191c, 0.6));
  const d = new THREE.DirectionalLight(0xfff2e6, 1.3);
  d.position.set(6, 12, 7); d.castShadow = true;
  d.shadow.mapSize.set(1024, 1024); d.shadow.camera.far = 60;
  d.shadow.camera.left = d.shadow.camera.bottom = -20; d.shadow.camera.right = d.shadow.camera.top = 20;
  d.shadow.bias = -0.0012; scene.add(d);
  setupEnv();
  bindControls();
  makeDpad(host, keys);
  window.addEventListener("resize", resize);
  mounted = true;
}

function aspect() { const w = host.clientWidth || 800, h = host.clientHeight || 450; return w / Math.max(1, h); }
function resize() { if (!renderer || !host) return; const w = host.clientWidth || 800, h = host.clientHeight || 450; renderer.setSize(w, h); if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); } }

function setupEnv() {
  try {
    const c = document.createElement("canvas"); c.width = 16; c.height = 64;
    const g = c.getContext("2d"), grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, "#cfcabf"); grd.addColorStop(0.5, "#7d7a72"); grd.addColorStop(1, "#23211e");
    g.fillStyle = grd; g.fillRect(0, 0, 16, 64);
    const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(tex).texture; tex.dispose(); pm.dispose();
  } catch (e) { /* Bonus */ }
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
  if (group) { scene.remove(group); disposeGroup(group); }
  group = new THREE.Group(); scene.add(group);
  const mm = M().mm;

  lastAssumptions = [];
  const exactModel = ((model.provenance || {}).precision === "exact");
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const wallAssumedMat = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }); // bläulich = Maß angenommen
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4f, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
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

  // Kamera in den ersten Raum
  const r0 = (st.rooms || [])[0];
  if (r0 && r0.polygon && r0.polygon.length) {
    let cx = 0, cz = 0; r0.polygon.forEach(p => { cx += mm(p.x); cz += mm(p.y); });
    cam.position.set(cx / r0.polygon.length, EYE, cz / r0.polygon.length);
  } else if (isFinite(minX)) cam.position.set((minX + maxX) / 2, EYE, (minZ + maxZ) / 2);
  look.yaw = 0; look.pitch = 0; applyLook();
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

/* ---------- First-Person ---------- */
function bindControls() {
  const cv = renderer.domElement;
  cv.addEventListener("click", () => { if (cv.requestPointerLock) cv.requestPointerLock(); });
  document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === cv; });
  document.addEventListener("mousemove", e => {
    if (locked) { look.yaw -= e.movementX * 0.0023; look.pitch -= e.movementY * 0.0023; clampPitch(); }
    else if (dragging) { look.yaw -= (e.clientX - lastX) * 0.005; look.pitch -= (e.clientY - lastY) * 0.005; lastX = e.clientX; lastY = e.clientY; clampPitch(); }
  });
  cv.addEventListener("mousedown", e => { if (!locked) { dragging = true; lastX = e.clientX; lastY = e.clientY; } });
  window.addEventListener("mouseup", () => { dragging = false; });
  cv.addEventListener("touchstart", e => { const t = e.touches[0]; dragging = true; lastX = t.clientX; lastY = t.clientY; }, { passive: true });
  cv.addEventListener("touchmove", e => { const t = e.touches[0]; look.yaw -= (t.clientX - lastX) * 0.006; look.pitch -= (t.clientY - lastY) * 0.006; lastX = t.clientX; lastY = t.clientY; clampPitch(); }, { passive: true });
  cv.addEventListener("touchend", () => { dragging = false; });
  window.addEventListener("keydown", e => { if (running) keys[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
}
function clampPitch() { const L = Math.PI / 2 - 0.05; look.pitch = Math.max(-L, Math.min(L, look.pitch)); applyLook(); }
function applyLook() { const cp = Math.cos(look.pitch); cam.lookAt(cam.position.x - Math.sin(look.yaw) * cp, cam.position.y + Math.sin(look.pitch), cam.position.z - Math.cos(look.yaw) * cp); }
function step(dt) {
  let f = 0, s = 0;
  if (keys["w"] || keys["arrowup"]) f += 1; if (keys["s"] || keys["arrowdown"]) f -= 1;
  if (keys["d"] || keys["arrowright"]) s += 1; if (keys["a"] || keys["arrowleft"]) s -= 1;
  if (f || s) { const sy = Math.sin(look.yaw), cy = Math.cos(look.yaw), v = SPEED * dt; cam.position.x += (-sy * f + cy * s) * v; cam.position.z += (-cy * f - sy * s) * v; }
  cam.position.y = EYE; applyLook();
}
function frame(t) { if (!running) return; const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t; step(dt); renderer.render(scene, cam); raf = requestAnimationFrame(frame); }
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
  lastAssumptions = [];
  const box = new THREE.Box3().setFromObject(group);
  if (!box.isEmpty() && isFinite(box.min.x)) {
    const c = box.getCenter(new THREE.Vector3());
    cam.position.set(c.x, box.min.y + EYE, c.z);
  } else cam.position.set(0, EYE, 0);
  look.yaw = 0; look.pitch = 0; applyLook();
}

window.Parametric = { available: () => true, mount, build, buildGroup, mountDemo, start, stop, dispose, assumptions: () => lastAssumptions.slice() };
