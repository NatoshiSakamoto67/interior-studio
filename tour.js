/* Interior Studio — Begehung auf Marzipano (Matterport-Stil, offline/USB).
   Mehrere Raum-Nodes (360°-Equirect von Nano Banana), frei umsehen + tief zoomen,
   per Boden-Pfeil von Raum zu Raum gehen, Möbel-Pins → Spec-Card.
   Nadir-Cap (gesampelte Bodenfarbe) verdeckt den Pol-Strudel. */
(function () {
  const M = window.Marzipano;
  const DEG = Math.PI / 180;
  const FOV_MIN = 14 * DEG, FOV_MAX = 100 * DEG, FOV_DEF = 78 * DEG;
  const CLICK_TOL = 6;

  let host, viewerEl, loadEl, viewer, limiter;
  let onPick = null, onPlace = null, onChange = null;
  let nodes = [], idx = -1, placeMode = false, inited = false, rotating = false, autorot = null;
  let downX = 0, downY = 0, moved = 0;

  function el(t, c) { const e = document.createElement(t); if (c) e.className = c; return e; }
  let navGen = 0;   // Generationszähler gegen Navigations-Race (zwei schnelle Dolly-Übergänge)
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function init(container, opts = {}) {
    if (inited) return;
    inited = true; host = container; onPick = opts.onPick; onPlace = opts.onPlace; onChange = opts.onChange;

    viewerEl = el("div", "tour-canvas");
    loadEl = el("div", "tour-loading"); loadEl.hidden = true;
    loadEl.innerHTML = `<div class="spinner"></div><span class="tour-load-txt">Lädt …</span>`;
    host.appendChild(viewerEl); host.appendChild(loadEl);

    viewer = new M.Viewer(viewerEl, { controls: { mouseViewMode: "drag" } });
    const lf = M.RectilinearView.limit;
    limiter = M.util.compose(
      lf.vfov(FOV_MIN, FOV_MAX),
      lf.pitch(-Math.PI / 2 * 0.94, Math.PI / 2 * 0.94)
    );
    autorot = M.autorotate({ yawSpeed: 0.04, targetPitch: 0, targetFov: FOV_DEF });

    bindPlace();
    window.addEventListener("resize", resize);
  }

  /* ---------- Lade-Overlay ---------- */
  function setLoading(on, msg) {
    if (!loadEl) return;
    loadEl.hidden = !on;
    if (on && msg) loadEl.querySelector(".tour-load-txt").textContent = msg;
  }

  /* ---------- Pin-Setzen (Klick vs. Drag) ---------- */
  function bindPlace() {
    const downH = (x, y) => { downX = x; downY = y; moved = 0; };
    const moveH = (x, y) => { moved = Math.max(moved, Math.abs(x - downX) + Math.abs(y - downY)); };
    const upH = (x, y) => {
      if (!placeMode || moved >= CLICK_TOL) return;
      const n = nodes[idx]; if (!n || !n._view) return;
      const r = viewerEl.getBoundingClientRect();
      const c = n._view.screenToCoordinates({ x: x - r.left, y: y - r.top });
      if (c && onPlace) onPlace({ yaw: c.yaw, pitch: c.pitch });
    };
    viewerEl.addEventListener("mousedown", e => downH(e.clientX, e.clientY));
    window.addEventListener("mousemove", e => moveH(e.clientX, e.clientY));
    viewerEl.addEventListener("mouseup", e => upH(e.clientX, e.clientY));
    viewerEl.addEventListener("touchstart", e => { const t = e.touches[0]; downH(t.clientX, t.clientY); }, { passive: true });
    viewerEl.addEventListener("touchmove", e => { const t = e.touches[0]; moveH(t.clientX, t.clientY); }, { passive: true });
    viewerEl.addEventListener("touchend", e => { const t = e.changedTouches[0]; upH(t.clientX, t.clientY); });
  }

  /* ---------- Bodenfarbe sampeln → Nadir-Cap ---------- */
  function sampleFloor(url, cb) {
    const im = new Image();
    im.onload = () => {
      try {
        const w = 48, h = 24, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d");
        const sx = Math.floor(im.naturalWidth * 0.34), sw = Math.floor(im.naturalWidth * 0.32);
        const sy = Math.floor(im.naturalHeight * 0.80), sh = Math.floor(im.naturalHeight * 0.18);
        ctx.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data; let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        cb(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
      } catch (e) { cb("rgb(150,128,104)"); }
    };
    im.onerror = () => cb("rgb(150,128,104)");
    im.src = url;
  }

  /* ---------- Szene je Node bauen ---------- */
  function buildScene(node) {
    const source = M.ImageUrlSource.fromString(node.img);
    const geometry = new M.EquirectGeometry([{ width: node.width || 4000 }]);
    const view = new M.RectilinearView({ yaw: 0, pitch: 0, fov: FOV_DEF }, limiter);
    const scene = viewer.createScene({ source, geometry, view });
    node._scene = scene; node._view = view;

    const cont = scene.hotspotContainer();
    // Nadir-Cap (verdeckt den Pol-Strudel) — flach auf dem Boden
    const cap = el("div", "nadir-cap");
    sampleFloor(node.img, col => { cap.style.background = `radial-gradient(circle at 50% 50%, ${col} 0%, ${col} 56%, rgba(0,0,0,0) 75%)`; });
    cont.createHotspot(cap, { yaw: 0, pitch: Math.PI / 2 - 0.001 }, { perspective: { radius: 1500, extraTransforms: "rotateX(90deg)" } });

    node._cont = cont;
    rebuildHotspots(node);
  }

  function rebuildHotspots(node) {
    const cont = node._cont; if (!cont) return;
    // alte Pin/Nav-Hotspots entfernen (Nadir-Cap bleibt)
    (node._hs || []).forEach(h => { try { cont.destroyHotspot(h); } catch (e) {} });
    node._hs = [];
    // Möbel-Pins
    (node.pins || []).forEach((pin, i) => {
      const b = el("button", "pin");
      b.innerHTML = `<span class="pin-dot"></span><span class="pin-lbl">${esc(pin.item.tag)}</span>`;
      b.title = String(pin.item.name || "").replace(/„|"/g, "");
      b.onclick = ev => { ev.stopPropagation(); onPick && onPick(pin.item, { nodeIdx: nodes.indexOf(node), pinIdx: i }); };
      node._hs.push(cont.createHotspot(b, { yaw: pin.yaw, pitch: pin.pitch }));
    });
    // Navigations-Pfeile (Boden) → in anderen Raum gehen
    (node.links || []).forEach(link => {
      const a = el("button", "nav-hotspot");
      a.innerHTML = `<span class="nav-ic">›</span><span class="nav-lbl">${esc(link.label || (nodes[link.to] && nodes[link.to].label) || "weiter")}</span>`;
      a.onclick = ev => { ev.stopPropagation(); go(link.to, { dolly: true, fromYaw: link.yaw }); };
      node._hs.push(cont.createHotspot(a, { yaw: link.yaw, pitch: link.pitch != null ? link.pitch : 0.55 },
        { perspective: { radius: 1400, extraTransforms: "rotateX(86deg)" } }));
    });
  }

  /* ---------- Navigation ---------- */
  // sanfter View-Tween (Yaw kürzester Weg, FOV) für das „Vorwärtsgehen"-Gefühl
  function tweenView(view, to, dur, done) {
    let dyaw = to.yaw != null ? to.yaw - view.yaw() : 0;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    const fy = view.yaw(), fp = view.pitch(), ff = view.fov(), t0 = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      if (to.yaw != null) view.setYaw(fy + dyaw * e);
      if (to.pitch != null) view.setPitch(fp + (to.pitch - fp) * e);
      if (to.fov != null) view.setFov(ff + (to.fov - ff) * e);
      if (t < 1) requestAnimationFrame(step); else if (done) done();
    })(performance.now());
  }
  function go(i, opts = {}) {
    if (i < 0 || i >= nodes.length) return;
    const gen = ++navGen;
    const n = nodes[i]; if (!n._scene) buildScene(n);
    const cur = nodes[idx], dolly = opts.dolly && cur && cur._view && n._view && !rotating;
    if (dolly) {
      // Street-View-Gefühl: zur Tür drehen + reinzoomen → Cross-Fade → in der neuen Szene FOV aufziehen.
      const v = cur._view, nv = n._view;
      tweenView(v, { yaw: opts.fromYaw != null ? opts.fromYaw : v.yaw(), fov: Math.max(FOV_MIN, v.fov() * 0.6) }, 250, () => {
        if (gen !== navGen) return;   // eine neuere Navigation hat übernommen → diesen Übergang verwerfen
        if (opts.fromYaw != null) nv.setYaw(opts.fromYaw);
        nv.setFov(Math.max(FOV_MIN, FOV_DEF * 0.72));
        n._scene.switchTo({ transitionDuration: 520 }, () => tweenView(nv, { fov: FOV_DEF }, 430));
        idx = i;
        if (onChange) { try { onChange(idx); } catch (e) {} }
      });
      return;
    }
    setLoading(true, "Raum wird geladen …");
    n._scene.switchTo({ transitionDuration: opts.instant ? 0 : 700 }, () => setLoading(false));
    setTimeout(() => setLoading(false), 1200); // Sicherheitsnetz
    idx = i;
    if (rotating) startRot();
    if (onChange) { try { onChange(idx); } catch (e) {} }   // Mini-Karte / Raum-Strip aktualisieren
  }

  function normalize(node) {
    return { id: node.id || ("n" + Math.round(performance.now())), label: node.label || ("Raum " + (nodes.length + 1)),
      img: node.img, width: node.width, pins: node.pins || [], links: node.links || [] };
  }
  function load(list, start = 0) {
    nodes.forEach(n => { try { n._scene && viewer.destroyScene(n._scene); } catch (e) {} });
    nodes = list.map(normalize); idx = -1;
    nodes.forEach(buildScene);
    go(start, { instant: true });
  }
  function addNode(node, opts = {}) {
    const n = normalize(node); nodes.push(n); buildScene(n);
    const i = nodes.length - 1;
    if (opts.linkFrom != null && nodes[opts.linkFrom]) {
      link(opts.linkFrom, i, opts.linkYaw != null ? opts.linkYaw : 0, opts.linkPitch);
      link(i, opts.linkFrom, opts.backYaw != null ? opts.backYaw : Math.PI, opts.linkPitch, "zurück");
    }
    if (opts.select !== false) go(i);
    return i;
  }

  function link(fromIdx, toIdx, yaw, pitch, label) {
    const n = nodes[fromIdx]; if (!n) return;
    n.links.push({ to: toIdx, yaw: yaw || 0, pitch: pitch, label });
    if (n._scene) rebuildHotspots(n);
  }
  function addPin(nodeIdx, pin) { const n = nodes[nodeIdx]; if (!n) return; n.pins.push(pin); rebuildHotspots(n); }
  function removePin(nodeIdx, pinIdx) { const n = nodes[nodeIdx]; if (!n) return; n.pins.splice(pinIdx, 1); rebuildHotspots(n); }

  /* ---------- Steuerung ---------- */
  function startRot() { viewer.setIdleMovement(1500, autorot); viewer.startMovement(autorot); }
  function stopRot() { viewer.stopMovement(); viewer.setIdleMovement(Infinity); }
  function autoRotate(on) { rotating = on == null ? !rotating : on; if (rotating) startRot(); else stopRot(); return rotating; }
  function resetView() { const v = nodes[idx] && nodes[idx]._view; if (!v) return; v.setYaw(0); v.setPitch(0); v.setFov(FOV_DEF); }
  // Tastatur-Begehung (a11y, WCAG 2.1.1): Blick/Zoom per Pfeiltasten verschieben. Limiter klemmt Pitch/FOV.
  function nudge(dYaw, dPitch, dFov) {
    const v = nodes[idx] && nodes[idx]._view; if (!v) return;
    if (dYaw) v.setYaw(v.yaw() + dYaw);
    if (dPitch) v.setPitch(v.pitch() + dPitch);
    if (dFov) v.setFov(v.fov() + dFov);
  }
  function currentYaw() { const v = nodes[idx] && nodes[idx]._view; return v ? v.yaw() : 0; }   // für Kompass-Pfeil der Mini-Karte
  function setPlaceMode(on) { placeMode = on; host.classList.toggle("placing", on); }
  function resize() { if (viewer) viewer.updateSize(); }

  window.Tour = {
    init, load, addNode, go, link, addPin, removePin,
    resetView, nudge, currentYaw, autoRotate, setPlaceMode, resize, setLoading,
    count: () => nodes.length, index: () => idx, stations: () => nodes
  };
})();
