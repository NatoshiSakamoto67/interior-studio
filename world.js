/* Interior Studio — „Welt 3D" (Beta): Foto → begehbare Gaussian-Splat-Welt.
   Zwei Wege: (A) aus Foto erzeugen via Backend/Marble; (B) fertige Splat-Datei
   offline öffnen (.ply/.splat/.ksplat). Das eigentliche Rendern macht
   window.SplatViewer (eigene Datei, lib-spezifisch). Dieser Flow ist lib-agnostisch. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let wired = false;
  let lastFotoResult = null;   // letztes Fotoreal-Ergebnis → Stil-Anker für konsistente Mehransichten (pro Modell)
  // Nach dem Laden eines Modells das (auf dem Handy oben liegende, große) 3D-Fenster in den Blick holen.
  function revealViewport() { const vp = $(".world-viewport"); if (vp && vp.scrollIntoView) { try { vp.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} } }

  // „Foto dieser Ansicht" erst aktiv, wenn eine begehbare (Parametric-)Geometrie steht.
  function fotoEnable(on) { const b = $("#fotoBtn"); if (b) b.disabled = !on; }

  function unitLabel(res) {
    const m = res && res.unitMeters;
    const name = m === 0.001 ? "mm" : m === 0.01 ? "cm" : m === 1 ? "m" : (Math.abs(m - 0.0254) < 1e-6 ? "inch" : (m + " m/Einh."));
    const src = res && res.unitSource === "gelesen" ? "aus IFC gelesen" : "geschätzt";
    return "Einheit " + name + " · " + src;
  }

  /* ---------- Einheitlicher Datei-Router: „egal welche Datei" ----------
     Eine Eingabe für alles — Typ wird an der Endung erkannt und richtig geladen.
     Kurze Rückfrage nur bei Mehrdeutigkeit (DXF mit unklarer Wand-Ebene; Bild ohne Schlüssel). */
  function extOf(name) { const m = /\.([a-z0-9]+)$/i.exec(name || ""); return m ? m[1].toLowerCase() : ""; }
  function resetContextUI() {
    const cl = $("#cadLayers"); if (cl) cl.hidden = true;
    const vb = $("#measureVerifyBtn"); if (vb) vb.hidden = true;
    const t = $("#measureThumb"); if (t) t.hidden = true;
  }
  function handleWorldFile(file) {
    if (!file) return;
    resetContextUI();
    const ext = extOf(file.name), type = file.type || "";
    if (["ply", "splat", "ksplat", "spz"].includes(ext)) { fotoEnable(false); loadSplat(file); return; }
    if (ext === "dxf") { analyzeCadFromFile(file); return; }
    if (ext === "ifc") { buildIfcFromFile(file); return; }
    if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext) || type.startsWith("image/")) { buildFromImageFile(file); return; }
    if (window.toast) toast("Dateityp „." + ext + "“ wird nicht unterstützt.", "err");
    report('Diese Datei kenne ich nicht (.' + esc(ext) + '). Unterstützt: <b>Grundriss-Bild</b> (.png/.jpg), <b>CAD</b> (.dxf), <b>IFC</b> (.ifc) oder eine fertige <b>Splat-Welt</b> (.ply/.splat).', true);
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
  async function buildFromImageFile(file) {
    // Grundriss als Bild → Claude liest die Maße. Das ist der einzige Pfad, der einen Schlüssel braucht
    // (die „kleine Rückfrage", wenn keiner gesetzt ist).
    if (!(window.IS && window.IS.ckey)) {
      if (window.toast) toast("Ein Grundriss-Bild vermisst Claude — dafür den Claude-Schlüssel oben eintragen.", "err");
      report('Für einen Grundriss als <b>Bild</b> liest Claude die Maße — dafür den Claude-Schlüssel (oben unter „Key") eintragen, dann die Datei erneut wählen. <b>CAD (.dxf)</b> und <b>IFC (.ifc)</b> brauchen keinen Schlüssel.', true);
      const t = $("#measureThumb"); if (t) { const img = t.querySelector("img"); if (img && file) img.src = URL.createObjectURL(file); t.hidden = false; }
      return;
    }
    const t = $("#measureThumb"); if (t) { const img = t.querySelector("img"); if (img && file) img.src = URL.createObjectURL(file); t.hidden = false; }
    runExtraction(await window.ImageGen.fileToInline(file));
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
    lastFotoResult = null;   // neues Modell → Material-Anker zurücksetzen
    if (window.SplatViewer) window.SplatViewer.stop();
    const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
    const sh = $("#splatHost"); if (sh) sh.hidden = true;
    const ph = $("#paramHost"); if (ph) { ph.hidden = false; window.Parametric.build(model, ph); window.Parametric.start(); }
    fotoEnable(true);
    report(summary(model, v), false);
    revealViewport();
  }

  let cadAnalysis = null;
  async function analyzeCadFromFile(file) {
    if (!(window.CAD && window.Parametric && window.Parametric.available() && window.Measure)) { if (window.toast) toast("CAD-Modul lädt noch — kurz warten und erneut wählen.", "err"); return; }
    report('<span class="muted small">DXF wird gelesen …</span>', false);
    try {
      cadAnalysis = window.CAD.analyze(await file.text());
      populateCadLayers();
      const layers = cadAnalysis.layers || [];
      const guess = window.CAD.guessWallLayer(layers);
      // Kurze Rückfrage NUR bei Mehrdeutigkeit: mehrere Ebenen und keine sichere Wand-Ebene erkannt.
      if (layers.length > 1 && !guess) {
        const wrap = $("#cadLayers"); if (wrap) wrap.hidden = false;
        report('<div class="mr-h">DXF gelesen · ' + layers.length + ' Ebenen</div><div class="muted small">Welche Ebene sind die Wände? Wählen → „Modell bauen".</div>', false);
      } else {
        buildCad();   // eindeutig (oder sicher geraten) → direkt eine begehbare Welt
      }
    } catch (e) { cadAnalysis = null; report('DXF konnte nicht gelesen werden: ' + esc(e.message || "Fehler"), true); }
  }
  function populateCadLayers() {
    const sel = $("#cadLayerSel"); if (!sel || !cadAnalysis) return;
    const guess = window.CAD.guessWallLayer(cadAnalysis.layers);
    sel.innerHTML = '<option value="*">Alle Ebenen (' + cadAnalysis.segs.length + ' Linien)</option>' +
      cadAnalysis.layers.map(l => '<option value="' + esc(l.name) + '"' + (l.name === guess ? ' selected' : '') + '>' + esc(l.name) + ' (' + l.segs + ')</option>').join("");
  }
  async function loadDemoIfc() {
    if (!(window.IFC && window.Parametric && window.Parametric.available())) { if (window.toast) toast("IFC-Modul lädt noch — kurz warten.", "err"); return; }
    lastFotoResult = null;
    report('<span class="muted small">Demo-IFC (Haus) wird geladen — WASM + ~2,5 MB, einige Sekunden …</span>', false);
    try {
      const r = await fetch("examples/fzk-haus.ifc", { cache: "force-cache" });
      if (!r.ok) throw new Error("Demo-IFC nur in der gehosteten Version (localhost/Pages).");
      const res = await window.IFC.loadIFC(await r.arrayBuffer(), msg => report('<span class="muted small">' + esc(msg) + '</span>', false));
      if (window.SplatViewer) window.SplatViewer.stop();
      const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
      const sh = $("#splatHost"); if (sh) sh.hidden = true;
      const ph = $("#paramHost"); if (ph) { ph.hidden = false; window.Parametric.buildGroup(res.group, ph); window.Parametric.start(); }
      fotoEnable(true);
      report('<div class="mr-h">✓ IFC-Demo · ' + res.meshCount + ' Bauteile</div><div class="muted small">FZK-Haus (öffentliches IFC-Beispiel) — echte CAD-Geometrie · ' + esc(unitLabel(res)) + '. Reinklicken + WASD = begehen.</div>', false);
      revealViewport();
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

  async function buildIfcFromFile(file) {
    if (!(window.IFC && window.Parametric && window.Parametric.available())) { if (window.toast) toast("IFC-Modul lädt noch — kurz warten.", "err"); return; }
    lastFotoResult = null;
    report('<span class="muted small">IFC wird geladen (WASM, beim 1. Mal etwas größer) …</span>', false);
    try {
      const buf = await file.arrayBuffer();
      const res = await window.IFC.loadIFC(buf, msg => report('<span class="muted small">' + esc(msg) + '</span>', false));
      if (window.SplatViewer) window.SplatViewer.stop();
      const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
      const sh = $("#splatHost"); if (sh) sh.hidden = true;
      const ph = $("#paramHost"); if (ph) { ph.hidden = false; window.Parametric.buildGroup(res.group, ph); window.Parametric.start(); }
      fotoEnable(true);
      report('<div class="mr-h">✓ IFC geladen · ' + res.meshCount + ' Bauteile</div><div class="muted small">Echte CAD-Geometrie (Wände, Türen, Fenster, Räume) · ' + esc(unitLabel(res)) + '. Reinklicken + WASD = begehen.</div>', false);
      revealViewport();
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
  // Recherche-basiert: harte Erhaltungs-Sperre (PRESERVE) → erlaubte Änderungen (nur Material/Licht)
  // → Verbote (nichts hinzufügen). Die Wortwahl IST die „Struktur-Stärke" (kein Denoise-Regler).
  function fotoPrompt(o) {
    const { style, hasRef, kind, furnish } = o;
    const building = kind === "building";
    const subject = building ? "exterior architectural photograph of the building" : "interior photograph";
    const dfltMat = building
      ? "warm plaster facade, clay roof tiles, oak window and door frames, clear glazing"
      : "matte white plaster walls, wide warm oak plank floor, satin white plaster ceiling, soft natural daylight";
    const enclosure = building
      ? "Show the building on its plot with a natural, softly clouded daylight sky and simple ground/grass context; realistic outdoor lighting. "
      : "This is a FULLY ENCLOSED interior room: render a solid matte plaster CEILING overhead and solid walls — never an open sky, skylight, black void or night above; keep it bright and evenly daylit with no pure-black areas. ";
    // Möbliert: KI darf Einrichtung/Umfeld ergänzen, aber die ARCHITEKTUR bleibt fix.
    const objects = furnish
      ? (building
        ? "You MAY add realistic, tasteful landscaping and entourage appropriate to the setting (planting, garden, path, low hedges), but keep the BUILDING geometry, all openings and the camera unchanged. No people, no vehicles. "
        : "Furnish the room tastefully and realistically with style-appropriate furniture, rugs, lighting and a little decor — but keep ALL architecture unchanged: wall positions, every window and door opening, proportions, ceiling height and the exact camera/perspective must stay identical. No people. ")
      : "Do NOT add furniture, people, vehicles, plants, signage or any object that is not present in the input. ";
    return "Photorealistic " + subject + " generated FROM the provided architectural render. "
      + "CRITICAL — PRESERVE EXACTLY: keep the geometry, wall/element positions and thicknesses, proportions, heights, "
      + "every window and door opening, and the exact camera position, framing, perspective and field of view identical to the input. "
      + "Do NOT move, add, remove, resize, crop, re-align or re-interpret any wall, opening, edge or structural element, and do not change the viewpoint. "
      + "Keep the existing light direction and shadows. "
      + "ONLY change surface realism and lighting: apply photorealistic PBR materials, physically correct global illumination, "
      + "soft contact shadows, realistic light falloff, subtle micro-texture and natural imperfections. "
      + enclosure + objects
      + "Materials & mood: " + (style || dfltMat) + ". "
      + (hasRef ? "Use the SECOND image ONLY as a material/colour/mood reference to keep materials and lighting CONSISTENT — never copy its geometry, layout, objects, framing or perspective. " : "")
      + "Shot on a 24mm architectural lens, neutral white balance, straight verticals, ultra realistic, high detail. "
      + "Everything else, especially all structural lines and the camera, must stay aligned to the input.";
  }
  async function photorealView() {
    if (!(window.Parametric && window.Parametric.snapshot)) { if (window.toast) toast("Maß-Viewer nicht verfügbar.", "err"); return; }
    if (!(window.Parametric.hasModel && window.Parametric.hasModel())) { if (window.toast) toast("Erst ein Modell bauen/laden (CAD, IFC oder Demo).", "err"); return; }
    if (!(window.ImageGen && window.ImageGen.activeKeyOk())) {
      if (window.toast) toast((window.ImageGen ? window.ImageGen.activeLabel() : "Bild") + "-Key fehlt — in Einstellungen eintragen.", "err");
      if (window.showPanel) window.showPanel("settings"); return;
    }
    const btn = $("#fotoBtn"); if (btn) btn.disabled = true;
    fotoOverlay("loading");
    try {
      const shot = await window.Parametric.snapshot({ aspectRatio: 16 / 9 });   // exakt 16:9 → kein Recompose-Drift
      if (!shot) { fotoOverlay("error", null, null, "Konnte die Ansicht nicht erfassen."); return; }
      const styleEl = $("#fotoStyle"); const style = styleEl ? styleEl.value.trim() : "";
      const furnish = !!($("#fotoFurnish") && $("#fotoFurnish").checked);
      const consistent = !($("#fotoConsistent") && !$("#fotoConsistent").checked);   // Default: an
      const refInp = $("#fotoRef"); const refFile = refInp && refInp.files[0];
      const images = [];
      const sInline = window.ImageGen.dataUrlToInline(shot); if (sInline) images.push(sInline);
      // Stil-Referenz: explizite Datei hat Vorrang; sonst (für Rundgang-Konsistenz) das letzte Foto-Ergebnis
      let refInline = null;
      if (refFile) { try { refInline = await window.ImageGen.fileToInline(refFile); } catch (e) {} }
      else if (consistent && lastFotoResult) refInline = window.ImageGen.dataUrlToInline(lastFotoResult);
      if (refInline) images.push(refInline);
      const kind = (window.Parametric.kind && window.Parametric.kind()) || "interior";
      const res = await window.ImageGen.generate({ prompt: fotoPrompt({ style, hasRef: images.length > 1, kind, furnish }), aspect: "16:9", resolution: "4K", images });
      lastFotoResult = res.url;   // nächste Ansicht referenziert dieses → konsistente Materialien
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
    fotoEnable(false);                                  // Splat hat keine Parametric-Geometrie → kein „Foto dieser Ansicht"
    if (window.Parametric) window.Parametric.stop();    // ggf. laufendes Maß-/IFC-Modell anhalten
    const ph = $("#paramHost"); if (ph) ph.hidden = true;
    const host = $("#splatHost"); if (host) host.hidden = false;
    const empty = $("#worldEmpty"); if (empty) empty.hidden = true;
    try {
      await window.SplatViewer.mount(host);
      await window.SplatViewer.load(urlOrFile, (pct, msg) => progress(pct, msg || "Welt wird geladen …"));
      window.SplatViewer.start();
      hideProgress();
      revealViewport();
    } catch (e) {
      if (window.toast) toast("Welt konnte nicht geladen werden: " + e.message, "err");
      if (empty) empty.hidden = false;
    }
  }

  function wire() {
    if (wired) return;
    const wf = $("#worldFile"); if (wf) wf.onchange = () => { if (wf.files[0]) handleWorldFile(wf.files[0]); };
    const cb = $("#cadBuildBtn"); if (cb) cb.onclick = buildCad;
    const dd = $("#worldDemoBtn"); if (dd) dd.onclick = loadDemoIfc;
    const vb = $("#measureVerifyBtn"); if (vb) vb.onclick = verifyAgainstPlan;
    const fb = $("#fotoBtn"); if (fb) fb.onclick = photorealView;
    const fr = $("#fotoRef"); if (fr) fr.onchange = () => { const l = $("#fotoRefLabel"), f = fr.files[0]; if (l) l.textContent = f ? f.name.slice(0, 28) : "Stil-Referenzbild (optional)"; };
    wired = true;
  }

  function enter() { wire(); fotoEnable(false); }
  function leave() { try { if (window.SplatViewer) window.SplatViewer.stop(); if (window.Parametric) window.Parametric.stop(); } catch (e) {} }

  window.World = { enter, leave };
})();
