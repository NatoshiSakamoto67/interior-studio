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

  // „Foto dieser Ansicht" + „Ganze Wohnung fotorealistisch" erst aktiv, wenn eine begehbare (Parametric-)Geometrie steht.
  function fotoEnable(on) { const b = $("#fotoBtn"); if (b) b.disabled = !on; const t = $("#tourBtn"); if (t) t.disabled = !on; }

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
    fotoEnable(true); showFurnish(true);
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
      fotoEnable(true); showFurnish(true);
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
      fotoEnable(true); showFurnish(true);
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
    const { style, hasRef, kind, furnish, hasPlaced } = o;
    const building = kind === "building";
    const subject = building ? "exterior architectural photograph of the building" : "interior photograph";
    const dfltMat = building
      ? "warm plaster facade, clay roof tiles, oak window and door frames, clear glazing"
      : "matte white plaster walls, wide warm oak plank floor, satin white plaster ceiling, soft natural daylight";
    const enclosure = building
      ? "Show the building on its plot with a natural, softly clouded daylight sky and simple ground/grass context; realistic outdoor lighting. "
      : "This is a FULLY ENCLOSED interior room: render a solid matte plaster CEILING overhead and solid walls — never an open sky, skylight, black void or night above; keep it bright and evenly daylit with no pure-black areas. ";
    // Drei Fälle: (1) eigene Möbel platziert → exakt erhalten, nur fotoreal machen;
    //   (2) KI darf möblieren; (3) nichts hinzufügen. (1) hat Vorrang (mm-Platzierung ist verbindlich).
    const objects = hasPlaced
      ? "The image ALREADY contains furniture placed as simple massing blocks. Render each of them as photorealistic, real furniture in the EXACT same position, footprint, size, height, orientation and count — do NOT add, remove, move, resize or rearrange any piece, and keep the camera identical. Refine only their materials, textures and realism so they read as real furniture. No people. "
      : furnish
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
      const hasPlaced = !!(window.Furnish && window.Furnish.count && window.Furnish.count() > 0);
      const res = await window.ImageGen.generate({ prompt: fotoPrompt({ style, hasRef: images.length > 1, kind, furnish, hasPlaced }), aspect: "16:9", resolution: "4K", images });
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
    fotoEnable(false); showFurnish(false);              // Splat hat keine Parametric-Geometrie → kein „Foto"/Möblieren
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

  /* ---------- Möblierung (Katalog → mm-genau platzieren) ---------- */
  function showFurnish(on) {
    const panel = $("#furnishPanel"), seg = $("#viewSeg");
    if (panel) panel.hidden = !on;
    if (seg) seg.hidden = !on;
    if (!window.Furnish) return;
    if (on) {
      window.Furnish._onChange = renderFurnishList;
      window.Furnish.clear();                 // neues Modell → frische Möblierung
      renderCatalog(); renderFurnishList(); setView3D("walk");
    } else {
      window.Furnish.clear();
      const insp = $("#furnishInspector"); if (insp) insp.hidden = true;
    }
  }
  function renderCatalog() {
    const host = $("#furnishCatalog"); if (!host) return;
    const items = (window.Furnish && window.Furnish.furnitureList) ? window.Furnish.furnitureList() : (window.CATALOG || []);
    host.innerHTML = items.map(it => '<button class="furnish-chip" data-fid="' + esc(it.id) + '" title="' + esc(it.name) + ' · ' + it.w + '×' + it.d + '×' + it.h + ' cm">'
      + '<span class="fc-sw" style="background:' + esc(it.color || '#b9b2a6') + '"></span>'
      + '<span class="fc-t"><span class="fc-n">' + esc(it.name) + '</span><span class="fc-d">' + it.w + '×' + it.d + ' cm</span></span></button>').join("");
    $$(".furnish-chip", host).forEach(b => b.onclick = () => {
      if (!(window.Furnish && window.Furnish.placeFromCatalog)) return;
      const o = window.Furnish.placeFromCatalog(b.dataset.fid);
      if (!o) { if (window.toast) toast("Erst ein Modell laden (CAD/IFC/Demo).", "err"); return; }
      if (window.toast) toast('Platziert — unten „Plan von oben" zum mm-genauen Setzen.');
    });
  }
  function renderFurnishList() {
    const el = $("#furnishList"); if (!el || !(window.Furnish && window.Furnish.list)) return;
    const rows = window.Furnish.list();
    if (!rows.length) { el.hidden = true; el.innerHTML = ""; return; }
    const sum = rows.reduce((a, r) => a + (r.price || 0), 0);
    el.hidden = false;
    el.innerHTML = '<div class="fl-h">Platziert · ' + rows.length + '</div>'
      + rows.map(r => '<div class="fl-row"><span class="fl-n">' + esc(r.name) + '</span><span class="fl-p">' + (r.price ? r.price + ' €' : '') + '</span><button class="fl-x" data-uid="' + r.uid + '" aria-label="entfernen">×</button></div>').join("")
      + '<div class="fl-sum">Summe <b>' + sum.toLocaleString("de-DE") + ' €</b></div>';
    $$(".fl-x", el).forEach(b => b.onclick = () => { if (window.Furnish) window.Furnish.removeByUid(+b.dataset.uid); });
  }
  function setView3D(v) {
    if (window.Parametric && window.Parametric.setView) window.Parametric.setView(v);
    $$("#viewSeg .seg-b").forEach(b => { const on = b.dataset.view === v; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
  }
  // Demo: möblierte Wohnung über den ARCHVIZ-Pfad (build → echte Materialien/Licht), gleich mit Möbeln.
  function autoFurnishDemo() {
    if (!(window.Furnish && window.FurnishPlace && window.Parametric)) return;
    const m = window.Parametric.currentModel(); if (!m) return;
    const segs = window.FurnishPlace.wallSegments(m, window.Measure.mm); if (!segs.length) return;
    const b = window.FurnishPlace.boundsOf(segs), cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    window.Furnish.placeFromCatalog("rug", { x: cx, z: cz });
    window.Furnish.placeFromCatalog("table", { x: cx, z: cz });
    window.Furnish.placeFromCatalog("sofa", { x: cx, z: b.maxZ - 0.4 });
    window.Furnish.placeFromCatalog("plant", { x: b.minX + 0.6, z: b.minZ + 0.6 });
    window.Furnish.select(null);
  }
  async function loadDemoApartment() {
    if (!(window.CAD && window.Parametric && window.Parametric.available() && window.Measure)) { if (window.toast) toast("Demo lädt noch — kurz warten.", "err"); return; }
    try {
      report('<span class="muted small">Möblierte Demo-Wohnung wird geladen …</span>', false);
      const r = await fetch("examples/demo-grundriss.dxf", { cache: "force-cache" });
      if (!r.ok) throw new Error("Demo nur in der gehosteten Version (localhost/Pages).");
      cadAnalysis = window.CAD.analyze(await r.text());
      populateCadLayers();
      buildCad();            // → mountModel → Archviz-Materialien/HDRI + Möblierung an
      autoFurnishDemo();
    } catch (e) { report('Demo nicht ladbar: ' + esc(e.message || "Fehler"), true); }
  }

  /* ---------- AUTOMATISCHE fotorealistische Tour der ganzen Wohnung ----------
     Ein Klick: an mehreren Standpunkten je ein 360°-Bild der EXAKTEN Geometrie aufnehmen (Echtzeit),
     jedes fotoreal machen (konsistent), als begehbare Tour in die Begehung laden. Kein Klicken pro Foto. */
  let tourStyleRef = null;
  function panoPrompt(hasRef) {
    return "This image is a 360° EQUIRECTANGULAR panorama (2:1) of an interior, rendered from exact geometry. "
      + "Re-render it PHOTOREALISTIC while keeping it a valid 2:1 equirectangular panorama: keep every wall position, opening, proportion and the ceiling and floor exactly where they are; keep the horizon straight and the left/right edges seamless. "
      + "Apply photorealistic materials and soft natural daylight: matte plaster walls, warm oak plank floor, plaster ceiling. "
      + "Turn any plain massing blocks into real, tasteful furniture sitting exactly where the blocks are. No people, no text. Keep it full 360° equirectangular. "
      + (hasRef ? "Use the SECOND image ONLY as a style/material/lighting reference so all panoramas of this home look CONSISTENT — never copy its layout or geometry. " : "");
  }
  function normalizeEquirect(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { const W = 2048, H = 1024; const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(img, 0, 0, W, H); resolve(c.toDataURL("image/jpeg", 0.92)); };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }
  async function photorealizePano(rawUrl) {
    const images = [window.ImageGen.dataUrlToInline(rawUrl)];
    if (tourStyleRef) { const r = window.ImageGen.dataUrlToInline(tourStyleRef); if (r) images.push(r); }
    const res = await window.ImageGen.generate({ prompt: panoPrompt(images.length > 1), images, aspect: "16:9", resolution: "4K" });
    if (!tourStyleRef) tourStyleRef = res.url;   // erstes Ergebnis = Stil-Anker für die übrigen
    return await normalizeEquirect(res.url);
  }
  function tourViewpoints() {
    const m = window.Parametric && window.Parametric.currentModel ? window.Parametric.currentModel() : null;
    if (!m || !window.FurnishPlace || !window.Measure) return [];
    const mm = window.Measure.mm;
    const polys = window.FurnishPlace.roomPolys(m, mm);
    if (polys.length) {
      return polys.slice(0, 8).map((poly, i) => { let cx = 0, cz = 0; poly.forEach(p => { cx += p.x; cz += p.z; }); return { x: cx / poly.length, z: cz / poly.length, label: "Raum " + (i + 1) }; });
    }
    const segs = window.FurnishPlace.wallSegments(m, mm);
    if (!segs.length) return [{ x: 0, z: 0, label: "Standort 1" }];
    const b = window.FurnishPlace.boundsOf(segs), w = b.maxX - b.minX, d = b.maxZ - b.minZ, mx = (b.minX + b.maxX) / 2, mz = (b.minZ + b.maxZ) / 2;
    const pts = (w >= d)
      ? [{ x: b.minX + w * 0.30, z: mz }, { x: b.minX + w * 0.70, z: mz }]
      : [{ x: mx, z: b.minZ + d * 0.30 }, { x: mx, z: b.minZ + d * 0.70 }];
    return pts.map((p, i) => ({ x: p.x, z: p.z, label: "Standort " + (i + 1) }));
  }
  async function generateApartmentTour() {
    if (!(window.Parametric && window.Parametric.hasModel && window.Parametric.hasModel() && window.Parametric.capturePanoEquirect)) { if (window.toast) toast("Erst ein Modell laden (Demo, CAD, IFC).", "err"); return; }
    if (!(window.ImageGen && window.ImageGen.activeKeyOk())) { if (window.toast) toast((window.ImageGen ? window.ImageGen.activeLabel() : "Bild") + "-Key fehlt — in Einstellungen eintragen.", "err"); if (window.showPanel) window.showPanel("settings"); return; }
    if (!(window.Studio && window.Studio.addPanorama)) { if (window.toast) toast("Begehung nicht verfügbar.", "err"); return; }
    const vps = tourViewpoints(); if (!vps.length) { if (window.toast) toast("Keine Standpunkte gefunden.", "err"); return; }
    const btn = $("#tourBtn"); if (btn) btn.disabled = true;
    tourStyleRef = null;
    const panos = [];
    try {
      for (let i = 0; i < vps.length; i++) {
        report('<div class="mr-h">Fotorealistische Tour wird erzeugt …</div><div class="muted small">Standort ' + (i + 1) + ' / ' + vps.length + ' wird fotoreal gerendert (~15 s) — du musst nichts tun.</div>', false);
        const raw = window.Parametric.capturePanoEquirect({ at: vps[i], width: 2048, face: 768 });
        if (!raw) continue;
        const photo = await photorealizePano(raw);
        panos.push({ url: photo, label: vps[i].label });
      }
      if (!panos.length) { report('Konnte keine Panoramen erzeugen — Internet + Bild-Key nötig.', true); return; }
      panos.forEach(p => window.Studio.addPanorama(p.url, p.label));   // baut verlinkte Tour + wechselt in die Begehung
      report('<div class="mr-h">✓ Fotorealistische Tour erzeugt · ' + panos.length + ' Standorte</div><div class="muted small">In der Begehung — ziehen zum Umsehen, Boden-Pfeile = weiter.</div>', false);
    } catch (e) { report('Tour fehlgeschlagen: ' + esc(e.message || "Fehler"), true); }
    finally { if (btn) btn.disabled = false; }
  }

  function wire() {
    if (wired) return;
    const wf = $("#worldFile"); if (wf) wf.onchange = () => { if (wf.files[0]) handleWorldFile(wf.files[0]); };
    const tb = $("#tourBtn"); if (tb) tb.onclick = generateApartmentTour;
    $$("#viewSeg .seg-b").forEach(b => b.onclick = () => setView3D(b.dataset.view));
    const cb = $("#cadBuildBtn"); if (cb) cb.onclick = buildCad;
    const dd = $("#worldDemoBtn"); if (dd) dd.onclick = loadDemoApartment;
    const vb = $("#measureVerifyBtn"); if (vb) vb.onclick = verifyAgainstPlan;
    const fb = $("#fotoBtn"); if (fb) fb.onclick = photorealView;
    const fr = $("#fotoRef"); if (fr) fr.onchange = () => { const l = $("#fotoRefLabel"), f = fr.files[0]; if (l) l.textContent = f ? f.name.slice(0, 28) : "Stil-Referenzbild (optional)"; };
    wired = true;
  }

  function enter() { wire(); fotoEnable(false); showFurnish(false); }
  function leave() { try { if (window.SplatViewer) window.SplatViewer.stop(); if (window.Parametric) window.Parametric.stop(); } catch (e) {} }

  window.World = { enter, leave };
})();
