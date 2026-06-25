/* Phase 2 — echtes begehbares 3D-Modell aus dem Grundriss (Three.js, vendor/three.min.js).
   First-Person: Maus/Touch-Blick + WASD/Pfeile. Räume aus plan.rooms[].box {x,y,w,h} (0..1, sonst Grid).
   Etagen werden in Z versetzt (kein vertikales Stapeln in v1). Türen = offene Seite zu verbundenen Nachbarn.
   v1: klare Geometrie-Begehung (kein Photoreal) — Texturierung mit den KI-Bildern ist der nächste Schritt.
   API: window.Model3D.init(host) · build(plan) · resize() · start()/stop() · ready(). */
(function () {
  const T = window.THREE;
  let scene, cam, renderer, host, group = null, ready = false, running = false, raf = 0;
  const keys = {}; const look = { yaw: 0, pitch: 0 };
  let locked = false, dragging = false, lastX = 0, lastY = 0, lastT = 0;
  let bounds = null;
  const EYE = 1.6, SPEED = 3.4, SCALE = 18, WALL_H = 2.7, WALL_T = 0.16;

  function init(container) {
    host = container;
    if (!T) { host.innerHTML = '<div class="d3-fail">3D-Engine (three.js) nicht geladen.</div>'; return false; }
    if (ready) return true;
    scene = new T.Scene(); scene.background = new T.Color(0x14131a);
    scene.fog = new T.Fog(0x14131a, 30, 90);
    cam = new T.PerspectiveCamera(74, (host.clientWidth || 16) / (host.clientHeight || 9), 0.08, 400);
    cam.position.set(0, EYE, 0);
    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth || 800, host.clientHeight || 450);
    host.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight(0xffffff, 0x3a3a44, 1.0));
    const d = new T.DirectionalLight(0xffffff, 0.75); d.position.set(6, 14, 8); scene.add(d);
    bindControls();
    ready = true;
    return true;
  }

  function disposeGroup(g) {
    g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
  }

  function deriveBoxes(rooms) {
    const ok = rooms.length && rooms.every(r => r.box && [r.box.x, r.box.y, r.box.w, r.box.h].every(v => isFinite(v)) && r.box.w > 0 && r.box.h > 0);
    if (ok) return rooms.map(r => ({ x: +r.box.x, y: +r.box.y, w: +r.box.w, h: +r.box.h }));
    // Fallback: Grid aus map-Position oder Index
    const n = rooms.length, cols = Math.ceil(Math.sqrt(n)), cw = 1 / cols;
    return rooms.map((r, i) => ({ x: (i % cols) * cw + 0.04, y: Math.floor(i / cols) * cw + 0.04, w: cw - 0.08, h: cw - 0.08 }));
  }

  function build(plan) {
    if (!ready) return;
    if (group) { scene.remove(group); disposeGroup(group); }
    group = new T.Group(); scene.add(group);
    const rooms = (plan && plan.rooms) || [];
    if (!rooms.length) return;
    const boxes = deriveBoxes(rooms);
    const floors = [...new Set(rooms.map(r => Math.round(+r.floor || 0)))].sort((a, b) => a - b);
    const floorGap = SCALE + 6;
    const floorZ = f => (floors.indexOf(f)) * floorGap;
    const idIndex = {}; rooms.forEach((r, i) => { idIndex[r.id] = i; });

    const floorMat = new T.MeshStandardMaterial({ color: 0x6b5640, roughness: 0.95 });
    const wallMat = new T.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 });
    const cx = (b, f) => (b.x + b.w / 2 - 0.5) * SCALE;
    const cz = (b, f) => (b.y + b.h / 2 - 0.5) * SCALE + floorZ(f);

    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    rooms.forEach((r, i) => {
      const b = boxes[i], f = Math.round(+r.floor || 0);
      const w = Math.max(1.2, b.w * SCALE), dch = Math.max(1.2, b.h * SCALE);
      const x = cx(b, f), z = cz(b, f);
      minX = Math.min(minX, x - w / 2); maxX = Math.max(maxX, x + w / 2);
      minZ = Math.min(minZ, z - dch / 2); maxZ = Math.max(maxZ, z + dch / 2);
      // Boden
      const floorMesh = new T.Mesh(new T.BoxGeometry(w, 0.1, dch), floorMat);
      floorMesh.position.set(x, 0, z); group.add(floorMesh);
      // verbundene Nachbarn → offene Seite (Tür)
      const open = { n: false, s: false, e: false, w: false };
      (r.neighbors || []).forEach(nid => {
        const j = idIndex[nid]; if (j == null) return;
        const nb = boxes[j]; const ncx = cx(nb, Math.round(+rooms[j].floor || 0)), ncz = cz(nb, Math.round(+rooms[j].floor || 0));
        const dx = ncx - x, dz = ncz - z;
        if (Math.abs(dx) >= Math.abs(dz)) (dx > 0 ? open.e = true : open.w = true);
        else (dz > 0 ? open.s = true : open.n = true);
      });
      const addWall = (sw, sh, px, pz) => { const m = new T.Mesh(new T.BoxGeometry(sw, WALL_H, sh), wallMat); m.position.set(px, WALL_H / 2, pz); group.add(m); };
      if (!open.n) addWall(w, WALL_T, x, z - dch / 2);
      if (!open.s) addWall(w, WALL_T, x, z + dch / 2);
      if (!open.w) addWall(WALL_T, dch, x - w / 2, z);
      if (!open.e) addWall(WALL_T, dch, x + w / 2, z);
      // Raum-Label
      const label = makeLabel(r.name || ("Raum " + (i + 1)));
      if (label) { label.position.set(x, WALL_H + 0.5, z); group.add(label); }
    });
    bounds = { minX: minX - 1, maxX: maxX + 1, minZ: minZ - 1, maxZ: maxZ + 1 };
    // Kamera in den ersten Raum
    const b0 = boxes[0], f0 = Math.round(+rooms[0].floor || 0);
    cam.position.set(cx(b0, f0), EYE, cz(b0, f0)); look.yaw = 0; look.pitch = 0;
  }

  function makeLabel(text) {
    try {
      const c = document.createElement("canvas"); c.width = 256; c.height = 64;
      const g = c.getContext("2d");
      g.fillStyle = "rgba(20,19,26,.82)"; g.fillRect(0, 0, 256, 64);
      g.fillStyle = "#ededf0"; g.font = "bold 30px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(text).slice(0, 18), 128, 34);
      const tex = new T.CanvasTexture(c); tex.minFilter = T.LinearFilter;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sp.scale.set(3.2, 0.8, 1);
      return sp;
    } catch (e) { return null; }
  }

  /* ---------- First-Person-Steuerung ---------- */
  function bindControls() {
    const cv = renderer.domElement;
    cv.addEventListener("click", () => { if (cv.requestPointerLock) cv.requestPointerLock(); });
    document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === cv; });
    document.addEventListener("mousemove", e => {
      if (locked) { look.yaw -= e.movementX * 0.0024; look.pitch -= e.movementY * 0.0024; clampPitch(); }
      else if (dragging) { look.yaw -= (e.clientX - lastX) * 0.005; look.pitch -= (e.clientY - lastY) * 0.005; lastX = e.clientX; lastY = e.clientY; clampPitch(); }
    });
    cv.addEventListener("mousedown", e => { if (!locked) { dragging = true; lastX = e.clientX; lastY = e.clientY; } });
    window.addEventListener("mouseup", () => dragging = false);
    cv.addEventListener("touchstart", e => { const t = e.touches[0]; dragging = true; lastX = t.clientX; lastY = t.clientY; }, { passive: true });
    cv.addEventListener("touchmove", e => { const t = e.touches[0]; look.yaw -= (t.clientX - lastX) * 0.006; look.pitch -= (t.clientY - lastY) * 0.006; lastX = t.clientX; lastY = t.clientY; clampPitch(); }, { passive: true });
    cv.addEventListener("touchend", () => dragging = false);
    window.addEventListener("keydown", e => { if (running) keys[e.key.toLowerCase()] = true; });
    window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
  }
  function clampPitch() { const L = Math.PI / 2 - 0.05; look.pitch = Math.max(-L, Math.min(L, look.pitch)); }

  function step(dt) {
    let fwd = 0, str = 0;
    if (keys["w"] || keys["arrowup"]) fwd += 1;
    if (keys["s"] || keys["arrowdown"]) fwd -= 1;
    if (keys["d"] || keys["arrowright"]) str += 1;
    if (keys["a"] || keys["arrowleft"]) str -= 1;
    if (fwd || str) {
      const sinY = Math.sin(look.yaw), cosY = Math.cos(look.yaw), v = SPEED * dt;
      // Blickrichtung: -Z bei yaw 0
      cam.position.x += (-sinY * fwd + cosY * str) * v;
      cam.position.z += (-cosY * fwd - sinY * str) * v;
      if (bounds) {
        cam.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, cam.position.x));
        cam.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, cam.position.z));
      }
    }
    cam.position.y = EYE;
    const cp = Math.cos(look.pitch);
    cam.lookAt(
      cam.position.x - Math.sin(look.yaw) * cp,
      cam.position.y + Math.sin(look.pitch),
      cam.position.z - Math.cos(look.yaw) * cp
    );
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    step(dt);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!ready || running) return; running = true; lastT = performance.now(); resize(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
  function resize() { if (!ready || !host) return; const w = host.clientWidth || 800, h = host.clientHeight || 450; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }

  window.Model3D = { init, build, start, stop, resize, ready: () => ready };
})();
