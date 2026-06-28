/* Interior Studio — „Welt 3D" (Beta): Foto → begehbare Gaussian-Splat-Welt.
   Zwei Wege: (A) aus Foto erzeugen via Backend/Marble; (B) fertige Splat-Datei
   offline öffnen (.ply/.splat/.ksplat). Das eigentliche Rendern macht
   window.SplatViewer (eigene Datei, lib-spezifisch). Dieser Flow ist lib-agnostisch. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let wired = false;

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
    const dm = window.Measure && window.Measure.DEMO;
    if (dm) report('<div class="mr-h">Beispiel-Wohnung (synthetisch, exakt konstruiert)</div>' + summary(dm, window.Measure.validate(dm)), false);
  }

  function report(html, isErr) { const el = $("#measureReport"); if (!el) return; el.hidden = false; el.classList.toggle("is-err", !!isErr); el.innerHTML = html; }

  function summary(model, v) {
    const st = (model.storeys || [])[0] || {};
    const exact = ((model.provenance || {}).precision === "exact");
    const ca = exact ? "" : "ca. ";
    const rooms = (st.rooms || []).map(r => esc(r.name || "Raum") + " " + ca + (window.Measure.roomArea(r.polygon || []) / 1e6).toFixed(1) + " m²").join(" · ");
    const unc = (model.uncertain || []);
    const warn = (((model.provenance || {}).warnings) || []).concat((v && v.warnings) || []);
    const ass = (window.Parametric && window.Parametric.assumptions) ? window.Parametric.assumptions() : [];
    let h = '<div class="mr-h">✓ Modell gebaut · ' + (st.walls || []).length + ' Wände · ' + (st.rooms || []).length + ' Räume</div>';
    if (rooms) h += '<div class="muted small">' + rooms + '</div>';
    h += '<div class="small mr-prec">Präzision: <b>' + esc((model.provenance || {}).precision || "?") + '</b>';
    if (unc.length) h += ' · <span class="mr-unk">' + unc.length + ' unbekannte Maße</span>';
    if (ass.length) h += ' · <span class="mr-unk">' + ass.length + ' angenommen</span>';
    h += '</div>';
    if (ass.length) h += '<div class="small muted">Bläulich eingefärbte Wände = Maß <b>angenommen</b> (Standardwert, nicht gemessen).</div>';
    if (ass.length) h += '<details class="mr-warn"><summary>' + ass.length + ' angenommene Maße</summary><ul>' + ass.slice(0, 14).map(a => '<li>' + esc((a.what || "") + ": " + (a.value || "") + " — " + (a.reason || "")) + '</li>').join("") + '</ul></details>';
    if (warn.length) h += '<details class="mr-warn"><summary>' + warn.length + ' Hinweise</summary><ul>' + warn.slice(0, 14).map(x => '<li>' + esc(typeof x === "string" ? x : JSON.stringify(x)) + '</li>').join("") + '</ul></details>';
    if (unc.length) h += '<details class="mr-warn"><summary>Unbekannte Maße (nicht geraten)</summary><ul>' + unc.slice(0, 14).map(u => '<li>' + esc((u.field || "") + ": " + (u.reason || "")) + '</li>').join("") + '</ul></details>';
    return h;
  }

  async function runExtraction(inline) {
    if (!(window.IS && window.IS.ckey)) { if (window.toast) toast("Claude-Key fehlt — oben unter dem Schlüssel-Symbol eintragen.", "err"); report('Claude-Key fehlt — oben rechts unter „Key" eintragen, dann erneut.', true); return; }
    if (!(window.Parametric && window.Parametric.available() && window.Measure)) { if (window.toast) toast("Maß-Bauer nicht verfügbar.", "err"); return; }
    report('<span class="muted small">Claude liest die Maße aus dem Grundriss … (~10–30 s)</span>', false);
    const btn = $("#measureBuildBtn"); if (btn) btn.disabled = true;
    try {
      const model = await window.Measure.extractFromPlan(inline);
      lastPlan = inline; lastModel = model;
      mountModel(model, window.Measure.validate(model));
      const vb = $("#measureVerifyBtn"); if (vb) vb.hidden = false;
    } catch (e) {
      report('Konnte das Modell nicht bauen: ' + esc(e.message || "Fehler"), true);
    } finally { if (btn) btn.disabled = false; }
  }
  async function buildFromPlan() {
    const inp = $("#measureFile"); const file = inp && inp.files[0];
    if (!file) { if (window.toast) toast("Erst einen Grundriss mit Maßen wählen.", "err"); return; }
    runExtraction(await window.ImageGen.fileToInline(file));
  }
  async function loadDemoGrundriss() {
    try {
      report('<span class="muted small">Demo-Grundriss wird geladen …</span>', false);
      const r = await fetch("examples/demo-grundriss.png", { cache: "force-cache" });
      if (!r.ok) throw new Error("Demo-Bild nicht gefunden (nur in der gehosteten Version).");
      const inline = await window.ImageGen.fileToInline(await r.blob());
      runExtraction(inline);
    } catch (e) { report('Demo-Grundriss nicht ladbar: ' + esc(e.message || "Fehler"), true); }
  }

  let lastPlan = null, lastModel = null;
  function verifyReport(rep) {
    const devs = (rep && rep.deviations) || [], miss = (rep && rep.missing) || [];
    const none = rep && rep.ok && !devs.length && !miss.length;
    let h = '<div class="mr-h">Prüfung: ' + (none ? '✓ keine Abweichungen gefunden' : (devs.length + miss.length) + ' Punkte') + '</div>';
    if (rep && rep.summary) h += '<div class="muted small">' + esc(rep.summary) + '</div>';
    if (devs.length) h += '<ul class="mr-devs">' + devs.slice(0, 20).map(d => '<li class="sev-' + esc(d.severity || "") + '"><b>' + esc(d.location || "") + '</b>: ' + esc(d.expected || "") + ' → <i>' + esc(d.got || "") + '</i>' + (d.fix ? ' — ' + esc(d.fix) : "") + '</li>').join("") + '</ul>';
    if (miss.length) h += '<details class="mr-warn"><summary>Fehlt im Modell (' + miss.length + ')</summary><ul>' + miss.slice(0, 20).map(m => '<li>' + esc(m) + '</li>').join("") + '</ul></details>';
    return h;
  }
  async function verifyAgainstPlan() {
    if (!lastPlan || !lastModel) { if (window.toast) toast("Erst ein Modell aus einem Grundriss bauen.", "err"); return; }
    if (!(window.IS && window.IS.ckey)) { if (window.toast) toast("Claude-Key fehlt (Schlüssel-Symbol).", "err"); return; }
    const btn = $("#measureVerifyBtn"); if (btn) btn.disabled = true;
    report('<span class="muted small">Claude vergleicht das Modell gegen den Plan … (~10–20 s)</span>', false);
    try {
      const rep = await window.Measure.verify(lastPlan, lastModel);
      report(verifyReport(rep), false);
    } catch (e) { report('Prüfung fehlgeschlagen: ' + esc(e.message || "Fehler"), true); }
    finally { if (btn) btn.disabled = false; }
  }

  function mountModel(model, v) {
    if (window.SplatViewer) window.SplatViewer.stop();
    const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
    const sh = $("#splatHost"); if (sh) sh.hidden = true;
    const ph = $("#paramHost"); if (ph) { ph.hidden = false; window.Parametric.build(model, ph); window.Parametric.start(); }
    report(summary(model, v), false);
  }

  let cadAnalysis = null;
  async function analyzeCad() {
    const inp = $("#cadFile"); const file = inp && inp.files[0];
    if (!file) return;
    if (!window.CAD) { if (window.toast) toast("CAD-Modul lädt noch — kurz warten und erneut wählen.", "err"); return; }
    report('<span class="muted small">DXF wird gelesen …</span>', false);
    try {
      const text = await file.text();
      cadAnalysis = window.CAD.analyze(text);
      populateCadLayers();
      const wrap = $("#cadLayers"); if (wrap) wrap.hidden = false;
      report('<span class="muted small">DXF gelesen: ' + cadAnalysis.layers.length + ' Ebenen. Wand-Ebene wählen → „CAD als Modell bauen".</span>', false);
    } catch (e) { cadAnalysis = null; report('DXF konnte nicht gelesen werden: ' + esc(e.message || "Fehler"), true); }
  }
  function populateCadLayers() {
    const sel = $("#cadLayerSel"); if (!sel || !cadAnalysis) return;
    const guess = window.CAD.guessWallLayer(cadAnalysis.layers);
    sel.innerHTML = '<option value="*">Alle Ebenen (' + cadAnalysis.segs.length + ' Linien)</option>' +
      cadAnalysis.layers.map(l => '<option value="' + esc(l.name) + '"' + (l.name === guess ? ' selected' : '') + '>' + esc(l.name) + ' (' + l.segs + ')</option>').join("");
  }
  async function loadDemoCad() {
    if (!window.CAD) { if (window.toast) toast("CAD-Modul lädt noch — kurz warten.", "err"); return; }
    try {
      report('<span class="muted small">Demo-CAD (.dxf) wird geladen …</span>', false);
      const r = await fetch("examples/demo-grundriss.dxf", { cache: "force-cache" });
      if (!r.ok) throw new Error("Demo-DXF nur in der gehosteten Version (localhost/Pages).");
      cadAnalysis = window.CAD.analyze(await r.text());
      populateCadLayers();
      const wrap = $("#cadLayers"); if (wrap) wrap.hidden = false;
      buildCad();
    } catch (e) { cadAnalysis = null; report('Demo-CAD nicht ladbar: ' + esc(e.message || "Fehler"), true); }
  }
  async function loadDemoIfc() {
    if (!(window.IFC && window.Parametric && window.Parametric.available())) { if (window.toast) toast("IFC-Modul lädt noch — kurz warten.", "err"); return; }
    report('<span class="muted small">Demo-IFC (Haus) wird geladen — WASM + ~2,5 MB, einige Sekunden …</span>', false);
    try {
      const r = await fetch("examples/fzk-haus.ifc", { cache: "force-cache" });
      if (!r.ok) throw new Error("Demo-IFC nur in der gehosteten Version (localhost/Pages).");
      const res = await window.IFC.loadIFC(await r.arrayBuffer(), msg => report('<span class="muted small">' + esc(msg) + '</span>', false));
      if (window.SplatViewer) window.SplatViewer.stop();
      const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
      const sh = $("#splatHost"); if (sh) sh.hidden = true;
      const ph = $("#paramHost"); if (ph) { ph.hidden = false; window.Parametric.buildGroup(res.group, ph); window.Parametric.start(); }
      report('<div class="mr-h">✓ IFC-Demo · ' + res.meshCount + ' Bauteile</div><div class="muted small">FZK-Haus (öffentliches IFC-Beispiel) — echte CAD-Geometrie' + (res.scaled ? ' · mm→m' : '') + '. Reinklicken + WASD = begehen.</div>', false);
    } catch (e) { report('Demo-IFC nicht ladbar: ' + esc(e.message || "Fehler"), true); }
  }
  function buildCad() {
    if (!cadAnalysis) { if (window.toast) toast("Erst eine DXF-Datei wählen.", "err"); return; }
    if (!(window.Parametric && window.Parametric.available() && window.CAD && window.Measure)) { if (window.toast) toast("CAD-Bauer nicht verfügbar.", "err"); return; }
    try {
      const sel = $("#cadLayerSel"); const layer = sel ? sel.value : "*";
      const model = window.CAD.toModel(cadAnalysis, layer);
      mountModel(model, window.Measure.validate(model));
    } catch (e) { report('Konnte das CAD-Modell nicht bauen: ' + esc(e.message || "Fehler"), true); }
  }

  async function buildIfc() {
    const inp = $("#ifcFile"); const file = inp && inp.files[0];
    if (!file) return;
    if (!(window.IFC && window.Parametric && window.Parametric.available())) { if (window.toast) toast("IFC-Modul lädt noch — kurz warten.", "err"); return; }
    report('<span class="muted small">IFC wird geladen (WASM, beim 1. Mal etwas größer) …</span>', false);
    try {
      const buf = await file.arrayBuffer();
      const res = await window.IFC.loadIFC(buf, msg => report('<span class="muted small">' + esc(msg) + '</span>', false));
      if (window.SplatViewer) window.SplatViewer.stop();
      const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
      const sh = $("#splatHost"); if (sh) sh.hidden = true;
      const ph = $("#paramHost"); if (ph) { ph.hidden = false; window.Parametric.buildGroup(res.group, ph); window.Parametric.start(); }
      report('<div class="mr-h">✓ IFC geladen · ' + res.meshCount + ' Bauteile</div><div class="muted small">Echte CAD-Geometrie (Wände, Türen, Fenster, Räume)' + (res.scaled ? ' · Einheit mm→m skaliert' : '') + '.</div>', false);
    } catch (e) { report('IFC konnte nicht geladen werden: ' + esc(e.message || "Fehler"), true); }
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

  /* ---------- Fotoreal-Pass: exakte Geometrie (3D-Viewer) → fotorealistisches Bild ----------
     Nimmt die AKTUELLE Ansicht des Parametric-Viewers (mm-genaue Geometrie + Kamera) als
     Struktur-Vorlage und lässt Gemini/OpenAI daraus ein Foto rendern, das Maße & Perspektive
     respektiert. „Fotoreal UND maßstabstreu", ohne Backend/GPU. */
  function fotoPrompt(style) {
    return "Photorealistic interior photograph of EXACTLY this room. Keep the identical geometry, "
      + "wall positions, window and door openings, proportions and camera perspective from the provided "
      + "structural 3D render — do not move, add, remove or resize anything. Replace the plain materials with "
      + "realistic ones and add natural, physically plausible lighting with soft shadows. "
      + (style ? ("Interior style: " + style + ". ") : "Warm, inviting, high-end interior design. ")
      + "Architectural interior photography, ultra realistic, high detail, natural daylight, no text, no labels.";
  }
  async function photorealView() {
    if (!(window.Parametric && window.Parametric.snapshot)) { if (window.toast) toast("Maß-Viewer nicht verfügbar.", "err"); return; }
    if (!(window.Parametric.hasModel && window.Parametric.hasModel())) { if (window.toast) toast("Erst ein Modell bauen/laden (CAD, IFC oder Demo).", "err"); return; }
    if (!(window.ImageGen && window.ImageGen.activeKeyOk())) {
      if (window.toast) toast((window.ImageGen ? window.ImageGen.activeLabel() : "Bild") + "-Key fehlt — in Einstellungen eintragen.", "err");
      if (window.showPanel) window.showPanel("settings"); return;
    }
    const shot = window.Parametric.snapshot();
    if (!shot) { if (window.toast) toast("Konnte die Ansicht nicht erfassen.", "err"); return; }
    const styleEl = $("#fotoStyle"); const style = styleEl ? styleEl.value.trim() : "";
    const btn = $("#fotoBtn"); if (btn) btn.disabled = true;
    fotoOverlay("loading");
    try {
      const inline = window.ImageGen.dataUrlToInline(shot);
      const res = await window.ImageGen.generate({ prompt: fotoPrompt(style), aspect: "16:9", resolution: "2K", images: inline ? [inline] : [] });
      fotoOverlay("done", res.url, shot);
      if (window.Studio && window.Studio.addToGallery) window.Studio.addToGallery(res.url, "fotoreal", style || "Fotoreal-Ansicht");
    } catch (e) { fotoOverlay("error", null, null, e.message || "Fehler"); }
    finally { if (btn) btn.disabled = false; }
  }
  function fotoOverlay(state, url, structUrl, errMsg) {
    const ov = $("#fotoOverlay"); if (!ov) return;
    const I = n => (window.Icons ? window.Icons.svg(n) : "");
    ov.hidden = false;
    if (state === "loading") {
      ov.innerHTML = '<div class="foto-card"><div class="foto-load">' + (window.Icons ? window.Icons.svg("loader-circle", { cls: "spin" }) : "") + ' Fotorealistische Ansicht wird gerendert … (~10–25 s)</div></div>';
    } else if (state === "error") {
      ov.innerHTML = '<div class="foto-card"><div class="foto-err">Fehlgeschlagen: ' + esc(errMsg) + '</div><div class="foto-acts"><button class="btn" data-foto="close">Schließen</button></div></div>';
    } else {
      ov.innerHTML = '<div class="foto-card foto-result">'
        + '<img class="foto-img" src="' + url + '" alt="Fotorealistische Ansicht der exakten Geometrie"/>'
        + (structUrl ? '<img class="foto-struct" src="' + structUrl + '" title="Struktur: die exakte Geometrie" alt="Strukturvorlage"/>' : '')
        + '<div class="foto-acts">'
        + '<a class="btn btn-accent" download="fotoreal.png" href="' + url + '">' + I("download") + ' Herunterladen</a>'
        + '<button class="btn" data-foto="again">' + I("rotate-cw") + ' Neu rendern</button>'
        + '<button class="btn btn-ghost" data-foto="close">Schließen</button>'
        + '</div></div>';
    }
    $$('[data-foto]', ov).forEach(b => b.onclick = () => {
      if (b.dataset.foto === "close") { ov.hidden = true; ov.innerHTML = ""; }
      else if (b.dataset.foto === "again") photorealView();
    });
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
    const sf = $("#worldSplatFile"); if (sf) sf.onchange = () => { if (sf.files[0]) loadSplat(sf.files[0]); };
    const dm = $("#worldDemo"); if (dm) dm.onclick = () => { progress(20, "Beispiel-Welt wird geladen …"); loadSplat("https://media.reshot.ai/models/nike_next/model.splat"); };
    const mb = $("#worldMeasureBtn"); if (mb) mb.onclick = mountMeasure;
    const mf = $("#measureFile"); if (mf) mf.onchange = () => { const t = $("#measureThumb"), f = mf.files[0]; if (t) { if (f) { t.querySelector("img").src = URL.createObjectURL(f); t.hidden = false; } else t.hidden = true; } };
    const mbb = $("#measureBuildBtn"); if (mbb) mbb.onclick = buildFromPlan;
    const mdb = $("#measureDemoBtn"); if (mdb) mdb.onclick = loadDemoGrundriss;
    const cf = $("#cadFile"); if (cf) cf.onchange = analyzeCad;
    const cb = $("#cadBuildBtn"); if (cb) cb.onclick = buildCad;
    const iff = $("#ifcFile"); if (iff) iff.onchange = buildIfc;
    const dc = $("#demoCadBtn"); if (dc) dc.onclick = loadDemoCad;
    const di = $("#demoIfcBtn"); if (di) di.onclick = loadDemoIfc;
    const vb = $("#measureVerifyBtn"); if (vb) vb.onclick = verifyAgainstPlan;
    const fb = $("#fotoBtn"); if (fb) fb.onclick = photorealView;
    wired = true;
  }

  function enter() { wire(); }
  function leave() { try { if (window.SplatViewer) window.SplatViewer.stop(); if (window.Parametric) window.Parametric.stop(); } catch (e) {} }

  window.World = { enter, leave };
})();
