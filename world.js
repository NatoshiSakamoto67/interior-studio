/* Interior Studio — „Welt 3D" (Beta): Foto → begehbare Gaussian-Splat-Welt.
   Zwei Wege: (A) aus Foto erzeugen via Backend/Marble; (B) fertige Splat-Datei
   offline öffnen (.ply/.splat/.ksplat). Das eigentliche Rendern macht
   window.SplatViewer (eigene Datei, lib-spezifisch). Dieser Flow ist lib-agnostisch. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const BACKEND = (localStorage.getItem("is_world_backend") || "http://localhost:8799").replace(/\/$/, "");
  let wired = false, pollTimer = null, srcFile = null;

  function setMode(m) {
    $$("#worldMode .seg-b").forEach(b => { const on = b.dataset.wmode === m; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
    const gen = $("#worldGenerate"), op = $("#worldOpen"), me = $("#worldMeasure");
    if (gen) gen.hidden = m !== "generate";
    if (op) op.hidden = m !== "open";
    if (me) me.hidden = m !== "measure";
    if (m !== "measure") {
      if (window.Parametric) window.Parametric.stop();
      const ph = $("#paramHost"); if (ph) ph.hidden = true;
      const sh = $("#splatHost"); if (sh) sh.hidden = false;
    }
  }

  // Maß-Modell (parametrisch, mm-genau) im eigenen Host mounten
  function mountMeasure() {
    if (!(window.Parametric && window.Parametric.available())) { if (window.toast) toast("Maß-Modell nicht verfügbar.", "err"); return; }
    if (window.SplatViewer) window.SplatViewer.stop();
    const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
    const sh = $("#splatHost"); if (sh) sh.hidden = true;
    const ph = $("#paramHost"); if (ph) { ph.hidden = false; window.Parametric.mountDemo(ph); }
  }

  async function checkBackend() {
    const el = $("#worldBackend"); if (!el) return;
    el.innerHTML = '<span class="muted small">Backend wird geprüft …</span>';
    try {
      const r = await fetch(BACKEND + "/api/health", { cache: "no-store" });
      const j = await r.json();
      el.innerHTML = j.marbleConfigured
        ? '<span class="dot ok"></span><span class="muted small">Backend bereit · Marble-Key gesetzt</span>'
        : '<span class="dot warn"></span><span class="muted small">Backend läuft, aber kein Marble-Key (<code>backend/.env</code>)</span>';
    } catch (e) {
      el.innerHTML = '<span class="dot err"></span><span class="muted small">Backend nicht erreichbar — <code>backend/run.command</code> starten. Offline geht „Splat-Datei öffnen".</span>';
    }
  }

  function preview(file) {
    srcFile = file || null;
    const t = $("#worldThumb"); if (!t) return;
    if (!file) { t.hidden = true; return; }
    t.querySelector("img").src = URL.createObjectURL(file);
    t.hidden = false;
  }

  function progress(pct, msg) {
    const p = $("#worldProgress"); if (p) p.hidden = false;
    const bar = $("#worldBar"); if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
    const st = $("#worldStatus"); if (st) st.textContent = msg || "";
  }
  function hideProgress() { const p = $("#worldProgress"); if (p) p.hidden = true; }

  function ensureViewer() {
    if (window.SplatViewer && window.SplatViewer.available()) return true;
    if (window.toast) toast("Der Splat-Viewer ist in dieser Version noch nicht installiert.", "err");
    return false;
  }

  async function safeMsg(r) { try { const j = await r.json(); return j.detail || j.message || ("HTTP " + r.status); } catch { return "HTTP " + r.status; } }

  async function generate() {
    if (!srcFile) { if (window.toast) toast("Erst ein Raumfoto oder Panorama wählen.", "err"); return; }
    if (!ensureViewer()) return;
    progress(4, "Welt-Auftrag wird gesendet …");
    let jobId;
    try {
      const fd = new FormData();
      fd.append("image", srcFile, srcFile.name || "room.jpg");
      const r = await fetch(BACKEND + "/api/world", { method: "POST", body: fd });
      if (!r.ok) throw new Error(await safeMsg(r));
      jobId = (await r.json()).jobId;
    } catch (e) {
      hideProgress(); if (window.toast) toast("Start fehlgeschlagen: " + e.message, "err"); checkBackend(); return;
    }
    poll(jobId);
  }

  function poll(jobId) {
    clearTimeout(pollTimer);
    const tick = async () => {
      try {
        const r = await fetch(BACKEND + "/api/world/" + jobId, { cache: "no-store" });
        const j = await r.json();
        progress(j.progress || 10, j.message || "Welt wird erzeugt …");
        if (j.status === "done") { await loadSplat(BACKEND + "/api/world/" + jobId + "/splat"); progress(100, "Welt fertig — los geht's."); return; }
        if (j.status === "error") { hideProgress(); if (window.toast) toast("Fehler: " + j.message, "err"); return; }
        pollTimer = setTimeout(tick, 2000);
      } catch (e) { pollTimer = setTimeout(tick, 3000); }
    };
    tick();
  }

  async function loadSplat(urlOrFile) {
    if (!ensureViewer()) return;
    const host = $("#splatHost"); const empty = $("#worldEmpty");
    if (empty) empty.hidden = true;
    try {
      await window.SplatViewer.mount(host);
      await window.SplatViewer.load(urlOrFile, (pct, msg) => progress(pct, msg || "Welt wird geladen …"));
      window.SplatViewer.start();
      hideProgress();
    } catch (e) {
      if (window.toast) toast("Welt konnte nicht geladen werden: " + e.message, "err");
      if (empty) empty.hidden = false;
    }
  }

  function wire() {
    if (wired) return;
    $$("#worldMode .seg-b").forEach(b => b.onclick = () => setMode(b.dataset.wmode));
    const f = $("#worldFile"); if (f) f.onchange = () => preview(f.files[0]);
    const g = $("#worldGenBtn"); if (g) g.onclick = generate;
    const sf = $("#worldSplatFile"); if (sf) sf.onchange = () => { if (sf.files[0]) loadSplat(sf.files[0]); };
    const dm = $("#worldDemo"); if (dm) dm.onclick = () => { progress(20, "Beispiel-Welt wird geladen …"); loadSplat("https://media.reshot.ai/models/nike_next/model.splat"); };
    const mb = $("#worldMeasureBtn"); if (mb) mb.onclick = mountMeasure;
    wired = true;
  }

  function enter() { wire(); checkBackend(); }
  function leave() { try { if (window.SplatViewer) window.SplatViewer.stop(); if (window.Parametric) window.Parametric.stop(); } catch (e) {} }

  window.World = { enter, leave };
})();
