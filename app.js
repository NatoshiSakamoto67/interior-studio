/* Interior Studio — App-Controller */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  // icons.js lädt vor app.js (index.html + Einzeldatei-Build). Fallback, falls es doch fehlt → kein Crash der ganzen App.
  const Icons = window.Icons || { svg: () => "", el: () => document.createElement("span"), hydrate() {}, has: () => false, names: () => [] };
  // Safari sperrt localStorage auf file:// → defensiv kapseln (App läuft auch ohne Persistenz weiter).
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  const NANO_BANANA = "gemini-3.1-flash-image-preview"; // stärkstes Bildmodell (Nano Banana 2)
  let savedModel = store.get("is_model");
  if (!savedModel || savedModel === "gemini-2.5-flash-image") savedModel = NANO_BANANA; // auf das stärkere Modell migrieren
  window.IS = { key: store.get("is_key") || "", model: savedModel,
    ckey: store.get("is_ckey") || "", cmodel: store.get("is_cmodel") || "claude-opus-4-8", gallery: [] };

  let mode = "generate", redesignImg = null;   // KI-Studio
  let tourReady = false, tourSrc = "text", tourPhotoImg = null;
  let lastPlan = null, projectTitle = "Unbenanntes Projekt";   // Projekt-State
  let tourPos = [];   // {x,y} je Raum für die Mini-Karte (aus Grundriss-map; sonst Grid-Fallback)

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    const t = document.createElement("div"); t.className = "toast" + (kind ? " " + kind : "");
    t.textContent = msg; $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* ---------- Globaler Bau-Fortschritt (sofort sichtbar, jeder Tab) ---------- */
  function buildBar(text) { const b = $("#buildBar"); if (!b) return; b.className = "build-bar"; b.hidden = false; b.innerHTML = Icons.svg("loader-circle", { cls: "spin" }) + " " + esc(text); }
  function buildBarErr(text) { const b = $("#buildBar"); if (!b) return; b.className = "build-bar err"; b.hidden = false; b.innerHTML = Icons.svg("triangle-alert") + " " + esc(text); setTimeout(() => { if (b.classList.contains("err")) b.hidden = true; }, 6000); }
  function hideBuildBar() { const b = $("#buildBar"); if (b) { b.hidden = true; b.className = "build-bar"; } }

  /* ---------- Modal (a11y: Fokus setzen, Escape, Fokus-Falle, Fokus zurück) ---------- */
  let lastFocus = null;
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function openModal(id) {
    lastFocus = document.activeElement;
    const m = $("#" + id); m.hidden = false;
    const first = m.querySelector(FOCUSABLE);
    if (first) first.focus();
  }
  function closeModal(id) {
    $("#" + id).hidden = true;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch {} }
  }
  document.addEventListener("keydown", e => {
    const m = !$("#keyModal").hidden ? $("#keyModal") : (!$("#pickModal").hidden ? $("#pickModal") : null);
    if (!m) return;
    if (e.key === "Escape") { e.preventDefault(); closeModal(m.id); return; }
    if (e.key === "Tab") {
      const f = $$(FOCUSABLE, m).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Key ---------- */
  function refreshKeyState() {
    const ok = !!IS.key;
    $("#keyState").innerHTML = ok ? 'Key ' + Icons.svg("check", { cls: "ic-ok" }) : "Key";
    $("#openKey").classList.toggle("ok", ok);
    $("#needkey").hidden = ok;
  }
  function openKey() {
    $("#keyInput").value = IS.key; $("#modelInput").value = IS.model;
    $("#ckeyInput").value = IS.ckey; $("#cmodelInput").value = IS.cmodel;
    openModal("keyModal");
  }
  $("#openKey").onclick = openKey; $("#needkeyBtn").onclick = openKey;
  $("#keyClose").onclick = () => closeModal("keyModal");
  $("#keyModal").onclick = e => { if (e.target.id === "keyModal") closeModal("keyModal"); };
  $("#keySave").onclick = () => {
    IS.key = $("#keyInput").value.trim(); IS.model = $("#modelInput").value.trim() || IS.model;
    IS.ckey = $("#ckeyInput").value.trim(); IS.cmodel = $("#cmodelInput").value || IS.cmodel;
    store.set("is_key", IS.key); store.set("is_model", IS.model);
    store.set("is_ckey", IS.ckey); store.set("is_cmodel", IS.cmodel);
    closeModal("keyModal"); refreshKeyState(); toast("Keys gespeichert (nur lokal).", "ok");
  };
  $("#keyForget").onclick = () => {
    IS.key = ""; IS.ckey = ""; store.del("is_key"); store.del("is_ckey");
    refreshKeyState(); closeModal("keyModal"); toast("Keys entfernt.");
  };

  /* ---------- Tabs ---------- */
  function showTab(name) {
    $$(".tab").forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    $$(".panel").forEach(p => p.classList.toggle("is-active", p.dataset.panel === name));
    if (name === "walk") ensureTour();
  }
  $$(".tab").forEach(t => t.onclick = () => showTab(t.dataset.tab));

  /* ================= KI-STUDIO ================= */
  $$("#studioMode .seg-b").forEach(b => b.onclick = () => {
    $$("#studioMode .seg-b").forEach(x => { x.classList.remove("is-active"); x.setAttribute("aria-pressed", "false"); });
    b.classList.add("is-active"); b.setAttribute("aria-pressed", "true");
    mode = b.dataset.mode;
    const isApt = mode === "apartment";
    $("#uploadFld").hidden = !(mode === "redesign" || isApt);
    if ($("#uploadLabel")) $("#uploadLabel").textContent = isApt ? "Grundriss hochladen (optional)" : "Raumfoto hochladen";
    if ($("#studioParams")) $("#studioParams").hidden = isApt;   // Format/Auflösung steuert die Wohnung-Pipeline selbst
    $("#promptLabel").textContent = isApt ? "Stil & Wünsche für die ganze Wohnung"
      : (mode === "redesign" ? "Anweisung" : "Beschreibung / Stil");
    $("#prompt").placeholder = isApt
      ? "z. B. moderne Luxus-Ästhetik, Marmor, Messingakzente, indirekte Beleuchtung — mit Grundriss baut Claude die Räume 1:1 nach"
      : mode === "redesign"
        ? "z. B. Gestalte diesen Raum wie ein Profi-Interior-Designer: Japandi, helle Eiche, das Fenster behalten."
        : "z. B. Modernes Wohnzimmer, helle Eiche, warmes Licht, große Fenster, skandinavisch …";
    $("#genBtn").innerHTML = isApt ? Icons.svg("building-2") + " Wohnung bauen & begehen" : Icons.svg("sparkles") + " Erzeugen";
    $("#genHint").textContent = isApt
      ? "Claude liest den Grundriss → plant die Räume → rendert pro Raum ein 360°-Panorama → begehbare Wohnung."
      : "Nutzt Nano Banana 2 (Gemini). Dauer ~5–20 s.";
  });
  (window.STYLES || []).forEach(s => {
    const c = document.createElement("button"); c.className = "chip"; c.textContent = s.k;
    c.onclick = () => { const p = $("#prompt"); p.value = (p.value.trim() ? p.value.trim() + ", " : "") + s.p; c.classList.add("on"); setTimeout(() => c.classList.remove("on"), 600); };
    $("#styleChips").appendChild(c);
  });
  $("#roomFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    redesignImg = await window.Banana.fileToInline(f);
    const url = `data:${redesignImg.mime};base64,${redesignImg.base64}`;
    const t = $("#roomThumb"); t.hidden = false; t.querySelector("img").src = url;
  };

  $("#genBtn").onclick = async () => {
    if (mode === "apartment") return buildApartment($("#prompt").value.trim(), redesignImg);
    const prompt = $("#prompt").value.trim();
    if (!prompt) return toast("Bitte zuerst eine Beschreibung eingeben.");
    if (!IS.key) return openKey();
    if (mode === "redesign" && !redesignImg) return toast("Bitte ein Raumfoto hochladen.");
    const card = addBusyCard();
    $("#genBtn").disabled = true; $("#genBtn").innerHTML = Icons.svg("loader-circle", { cls: "spin" }) + " Erzeuge …";
    try {
      const res = await window.Banana.generate({
        prompt, aspect: $("#aspect").value, resolution: $("#resolution").value,
        images: mode === "redesign" && redesignImg ? [redesignImg] : []
      });
      fillCard(card, res.url, prompt);
      IS.gallery.unshift({ url: res.url, prompt });
      refreshStudioSrc();
      toast("Bild erzeugt.", "ok");
    } catch (e) { card.remove(); toast(e.message || "Fehler", "err"); }
    finally { $("#genBtn").disabled = false; $("#genBtn").innerHTML = Icons.svg("sparkles") + " Erzeugen"; }
  };

  function addBusyCard() {
    $("#galleryEmpty") && ($("#galleryEmpty").style.display = "none");
    $("#clearGallery").hidden = false;
    const c = document.createElement("div"); c.className = "card busy"; c.innerHTML = Icons.svg("loader-circle", { cls: "spin" }) + " Nano Banana rendert …";
    $("#gallery").prepend(c); return c;
  }
  function fillCard(card, url, prompt) {
    card.className = "card";
    card.innerHTML = `<img src="${url}" alt="Ergebnis"/>
      <div class="card-acts">
        <a class="btn" download="interior.png" href="${/^(https?:|data:image\/)/.test(url) ? url : "#"}">${Icons.svg("download", { title: "Bild herunterladen" })}</a>
        <button class="btn btn-accent" data-act="tour">${Icons.svg("compass")} Als Begehung</button>
      </div>`;
    card.querySelector('[data-act="tour"]').onclick = () => startTourFromImage(url, prompt);
  }
  $("#clearGallery").onclick = () => { IS.gallery = []; $("#gallery").innerHTML = ""; $("#gallery").appendChild($("#galleryEmpty")); $("#galleryEmpty").style.display = ""; $("#clearGallery").hidden = true; refreshStudioSrc(); };

  function refreshStudioSrc() {
    const box = $("#tourStudioSrc"); if (!box) return;
    if (!IS.gallery.length) { box.innerHTML = '<span class="muted">Erzeuge zuerst ein Bild im KI-Studio.</span>'; return; }
    box.innerHTML = "";
    IS.gallery.slice(0, 6).forEach((g, i) => {
      const im = new Image(); im.src = g.url; im.title = "als Vorlage"; im.className = i === 0 ? "sel" : "";
      im.onclick = () => { $$("#tourStudioSrc img").forEach(x => x.classList.remove("sel")); im.classList.add("sel"); im.dataset.pick = "1"; };
      if (i === 0) im.dataset.pick = "1";
      box.appendChild(im);
    });
  }
  function pickedStudioUrl() { const im = $('#tourStudioSrc img[data-pick="1"]') || $("#tourStudioSrc img.sel") || $("#tourStudioSrc img"); return im ? im.src : (IS.gallery[0] && IS.gallery[0].url); }

  /* ---------- Voice (JARVIS) ---------- */
  function addVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    [["#genBtn", "#prompt"], ["#tourGen", "#tourPrompt"]].forEach(([btnSel, fldSel]) => {
      const host = $(btnSel); if (!host) return;
      const btn = document.createElement("button"); btn.className = "btn btn-ghost"; btn.type = "button"; btn.innerHTML = Icons.svg("mic") + " Sprechen"; btn.style.marginTop = "-6px";
      host.insertAdjacentElement("beforebegin", btn);
      const rec = new SR(); rec.lang = "de-DE"; rec.interimResults = false;
      btn.onclick = () => { btn.textContent = "● Hört zu …"; try { rec.start(); } catch {} };
      rec.onresult = e => { const txt = e.results[0][0].transcript; const p = $(fldSel); p.value = (p.value.trim() ? p.value.trim() + " " : "") + txt; };
      rec.onerror = () => toast("Spracherkennung nicht verfügbar.");
      rec.onend = () => btn.innerHTML = Icons.svg("mic") + " Sprechen";
    });
  }

  /* ================= BEGEHUNG (Panorama-Tour) ================= */
  function ensureTour() {
    if (tourReady) { window.Tour.resize(); return; }
    tourReady = true;
    window.Tour.init($("#tourHost"), { onPick: showSpec, onPlace: openPicker, onChange: onTourChange });
    setTimeout(() => window.Tour.resize(), 60);
  }

  // Quelle (Text / Foto / KI-Studio)
  $$("#tourMode .seg-b").forEach(b => b.onclick = () => {
    $$("#tourMode .seg-b").forEach(x => { x.classList.remove("is-active"); x.setAttribute("aria-pressed", "false"); });
    b.classList.add("is-active"); b.setAttribute("aria-pressed", "true");
    tourSrc = b.dataset.src;
    $("#tourPhotoFld").hidden = tourSrc !== "photo";
    $("#tourStudioFld").hidden = tourSrc !== "studio";
    $("#tourPromptLabel").textContent = tourSrc === "text" ? "Raum beschreiben" : "Zusätzliche Anweisung (optional)";
    if (tourSrc === "studio") refreshStudioSrc();
  });
  $("#tourFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    tourPhotoImg = await window.Banana.fileToInline(f);
    const t = $("#tourThumb"); t.hidden = false; t.querySelector("img").src = `data:${tourPhotoImg.mime};base64,${tourPhotoImg.base64}`;
  };

  function equirectPrompt(base) {
    return `Equirectangular 360 degree panorama, full spherical seamless interior view, no fisheye distortion, evenly and naturally lit, horizon centered. Room: ${base}. Photorealistic interior photography, wide dynamic range.`;
  }
  function imgFromDataUrl(url) { return window.Banana.dataUrlToInline(url); }

  // 21:9 → sauberes 2:1-Equirect (Kantenfortsetzung), damit Marzipano keinen verzerrten Boden zeigt.
  function padTo2to1(url) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => {
        const w = im.naturalWidth, ih = im.naturalHeight, th = Math.round(w / 2);
        const cv = document.createElement("canvas"); cv.width = w; cv.height = th;
        const ctx = cv.getContext("2d"); const y = Math.round((th - ih) / 2);
        ctx.drawImage(im, 0, y, w, ih);
        if (y > 0) { ctx.drawImage(im, 0, 0, w, 1, 0, 0, w, y); ctx.drawImage(im, 0, ih - 1, w, 1, 0, y + ih, w, th - (y + ih)); }
        // Wrap-Naht weichzeichnen: linke und rechte Kante kontinuierlich machen (kein harter Strich mehr hinten)
        try {
          const F = Math.max(8, Math.round(w * 0.05)), id = ctx.getImageData(0, 0, w, th), d = id.data;
          for (let yy = 0; yy < th; yy++) {
            const row = yy * w * 4;
            for (let x = 0; x < F; x++) {
              const t = x / F, a = row + x * 4, b = row + (w - 1 - x) * 4;
              for (let k = 0; k < 3; k++) {
                const lv = d[a + k], rv = d[b + k];
                d[a + k] = Math.round(lv * (0.5 + 0.5 * t) + rv * (0.5 - 0.5 * t));
                d[b + k] = Math.round(rv * (0.5 + 0.5 * t) + lv * (0.5 - 0.5 * t));
              }
            }
          }
          ctx.putImageData(id, 0, 0);
        } catch (e) {}
        try { res(cv.toDataURL("image/png")); } catch (e) { res(url); }
      };
      im.onerror = () => res(url);
      im.src = url;
    });
  }

  async function generateStation({ prompt, refImg, label, linkFrom }) {
    ensureTour();
    if (!IS.key) { openKey(); return; }
    setTourBusy(true);
    window.Tour.setLoading(true, "Nano Banana rendert dein Panorama … (~8–20 s)");
    try {
      const res = await window.Banana.generate({
        prompt: equirectPrompt(prompt), aspect: "21:9", resolution: "2K",
        images: refImg ? [refImg] : []
      });
      const img = await padTo2to1(res.url);
      $("#tourEmpty").hidden = true;
      const opts = (linkFrom != null) ? { linkFrom, linkYaw: 0, linkPitch: 0.55 } : {};
      const i = window.Tour.addNode({ img, label: label || ("Raum " + (window.Tour.count() + 1)) }, opts);
      renderStationNav();
      $("#pinTools").hidden = false;
      $("#tourNext").hidden = false;
      toast("Raum erstellt — ziehen zum Umsehen, Möbel über „Pin setzen“ verorten.", "ok");
      return i;
    } catch (e) { window.Tour.setLoading(false); toast(e.message || "Fehler", "err"); }
    finally { setTourBusy(false); }
  }
  function setTourBusy(on) {
    $("#tourGen").disabled = on; $("#tourNext").disabled = on;
    $("#tourGen").innerHTML = on ? Icons.svg("loader-circle", { cls: "spin" }) + " Rendert …" : Icons.svg("compass") + " Panorama-Standort erzeugen";
  }

  $("#tourGen").onclick = () => {
    const extra = $("#tourPrompt").value.trim();
    if (tourSrc === "text") {
      if (!extra) return toast("Bitte den Raum beschreiben.");
      generateStation({ prompt: extra });
    } else if (tourSrc === "photo") {
      if (!tourPhotoImg) return toast("Bitte ein Raumfoto wählen.");
      generateStation({ prompt: (extra || "diesen Raum originalgetreu, Architektur und Fenster beibehalten"), refImg: tourPhotoImg });
    } else { // studio
      const url = pickedStudioUrl();
      if (!url) return toast("Erzeuge zuerst ein Bild im KI-Studio.");
      generateStation({ prompt: (extra || "dieser Raum, gleiche Möblierung, Stil und Beleuchtung beibehalten"), refImg: imgFromDataUrl(url) });
    }
  };
  $("#tourNext").onclick = () => {
    // Begehbare Wohnung: durch die Tür in den nächsten SCHON gebauten Raum gehen (kein neues Panorama)
    if ($("#tourNext").dataset.mode === "navigate" && window.Tour.count() > 1) {
      const cur = window.Tour.stations()[window.Tour.index()];
      const fwd = (cur.links && cur.links[0]) || null;   // erste Tür = „nach vorne"
      if (fwd) window.Tour.go(fwd.to, { dolly: true, fromYaw: fwd.yaw });
      else window.Tour.go((window.Tour.index() + 1) % window.Tour.count(), { dolly: true });
      return;
    }
    // Einzel-Standort-Tour (Aus Text/Foto): einen neuen angrenzenden Standort erzeugen
    const cur = window.Tour.stations()[window.Tour.index()];
    if (!cur) return;
    generateStation({
      prompt: "exactly the same apartment — same style, floor, wall color and daylight; move forward through the doorway into the adjacent room, equirectangular 360",
      refImg: imgFromDataUrl(cur.img), label: "Raum " + (window.Tour.count() + 1), linkFrom: window.Tour.index()
    });
  };

  function startTourFromImage(url, prompt) {
    showTab("walk");
    $$("#tourMode .seg-b").forEach(x => x.classList.toggle("is-active", x.dataset.src === "studio"));
    tourSrc = "studio"; $("#tourPhotoFld").hidden = true; $("#tourStudioFld").hidden = false; refreshStudioSrc();
    $("#tourPrompt").value = "";
    generateStation({ prompt: prompt ? prompt + ", gleiche Möblierung und Stil beibehalten" : "dieser Raum, Stil beibehalten", refImg: imgFromDataUrl(url) });
  }

  // Raum-Navigation (Strip)
  function renderStationNav() {
    const nav = $("#stationNav"); nav.innerHTML = "";
    window.Tour.stations().forEach((st, i) => {
      const cur = i === window.Tour.index();
      const b = document.createElement("button"); b.className = "room-chip" + (cur ? " on" : "");
      if (cur) b.setAttribute("aria-current", "true");
      b.textContent = st.label || ("Raum " + (i + 1)); b.title = st.label || "";
      b.onclick = () => { window.Tour.go(i); setTimeout(renderStationNav, 40); };
      nav.appendChild(b);
    });
  }

  /* ---------- Mini-Karte (Grundriss, „du bist hier") ---------- */
  function onTourChange() { renderStationNav(); renderMiniMap(); updateNextBtn(); }
  function updateNextBtn() {
    const b = $("#tourNext"); if (!b) return;
    const cur = window.Tour.stations()[window.Tour.index()];
    const linked = !!(cur && cur.links && cur.links.length) && window.Tour.count() > 1;
    b.dataset.mode = linked ? "navigate" : "extend";   // navigate = durch die Tür gehen; extend = neuen Standort generieren
    b.innerHTML = Icons.svg("footprints") + (linked ? " Nächster Raum" : " Schritt vorwärts (neu)");
    b.title = linked ? "In den nächsten gebauten Raum gehen" : "Einen neuen angrenzenden Standort erzeugen (KI)";
  }
  function setTourPos(rooms) {
    tourPos = (rooms || []).map(r => (r && r.map && isFinite(r.map.x) && isFinite(r.map.y)) ? { x: +r.map.x, y: +r.map.y } : null);
    if (tourPos.some(p => !p)) tourPos = [];   // nur verwenden, wenn ALLE Räume echte Grundriss-Positionen haben
  }
  function renderMiniMap() {
    const box = $("#miniMap"); if (!box) return;
    const st = (window.Tour && window.Tour.stations && window.Tour.stations()) || [];
    const n = st.length;
    if (n < 1) { box.hidden = true; return; }
    box.hidden = false;
    const cur = window.Tour.index();
    let pts;
    if (tourPos.length === n) pts = tourPos.slice();
    else { const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols); pts = st.map((_, i) => ({ x: cols > 1 ? (i % cols) / (cols - 1) : 0.5, y: rows > 1 ? Math.floor(i / cols) / (rows - 1) : 0.5 })); }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = x => maxX > minX ? 12 + (x - minX) / (maxX - minX) * 76 : 50;
    const sy = y => maxY > minY ? 12 + (y - minY) / (maxY - minY) * 76 : 50;
    const P = pts.map(p => ({ x: sx(p.x), y: sy(p.y) }));
    let lines = "";
    st.forEach((node, i) => (node.links || []).forEach(l => { if (l.to > i && P[l.to]) lines += `<line x1="${P[i].x.toFixed(1)}" y1="${P[i].y.toFixed(1)}" x2="${P[l.to].x.toFixed(1)}" y2="${P[l.to].y.toFixed(1)}"/>`; }));
    const dots = P.map((p, i) => `<g class="mm-room${i === cur ? " is-cur" : ""}" data-i="${i}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i === cur ? 5 : 3.6}"/><title>${esc((st[i] && st[i].label) || ("Raum " + (i + 1)))}</title></g>`).join("");
    box.innerHTML = `<svg viewBox="0 0 100 100" role="img" aria-label="Grundriss-Karte — du bist in: ${esc((st[cur] && st[cur].label) || "")}"><g class="mm-lines">${lines}</g>${dots}</svg>`;
    $$(".mm-room", box).forEach(g => g.onclick = () => { const i = parseInt(g.dataset.i, 10); if (i !== window.Tour.index()) window.Tour.go(i); });
  }
  $("#autoRotBtn").onclick = e => { const on = window.Tour.autoRotate(); e.currentTarget.classList.toggle("on", on); };
  $("#resetView").onclick = () => window.Tour.resetView();
  // Tastatur-Begehung (a11y, WCAG 2.1.1): #tourHost ist fokussierbar — Pfeile = umsehen, +/− = zoomen.
  const TOUR_KEYS = { ArrowLeft: [-0.12, 0, 0], ArrowRight: [0.12, 0, 0], ArrowUp: [0, -0.1, 0], ArrowDown: [0, 0.1, 0], "+": [0, 0, -0.1], "=": [0, 0, -0.1], "-": [0, 0, 0.1], "_": [0, 0, 0.1] };
  $("#tourHost").addEventListener("keydown", e => {
    const m = TOUR_KEYS[e.key]; if (!m || !window.Tour || !window.Tour.nudge) return;
    e.preventDefault(); window.Tour.nudge(m[0], m[1], m[2]);
  });

  // Offline-Demo (ohne Key): echtes Panorama + vorplatzierte Pins
  function byId(id) { return (window.CATALOG || []).find(c => c.id === id); }
  $("#loadDemo").onclick = () => {
    ensureTour();
    if (window.Projects) window.Projects.startNew();   // Demo-Interaktionen überschreiben kein echtes Projekt
    const P = (id, yaw, pitch) => ({ yaw, pitch, item: byId(id) });
    const demo = [
      { id: "wohn", label: "Wohnzimmer", img: "examples/tour/node1.png",
        pins: [P("sofa", 2.6, 0.16), P("table", 2.9, 0.34), P("plant", 1.15, 0.10), P("lamp", -0.5, -0.02)].filter(p => p.item),
        links: [{ to: 1, yaw: -1.2, pitch: 0.6, label: "Flur" }] },
      { id: "flur", label: "Flur", img: "examples/tour/node2.png",
        pins: [P("side", -1.4, 0.2)].filter(p => p.item),
        links: [{ to: 0, yaw: 1.9, pitch: 0.6, label: "Wohnzimmer" }, { to: 2, yaw: 0.2, pitch: 0.6, label: "Küche" }] },
      { id: "kueche", label: "Küche", img: "examples/tour/node3.png",
        pins: [P("chair", 0.1, 0.24)].filter(p => p.item),
        links: [{ to: 1, yaw: -2.6, pitch: 0.6, label: "Flur" }] }
    ];
    tourPos = demo.map((d, i) => ({ x: demo.length > 1 ? 0.12 + i * (0.76 / (demo.length - 1)) : 0.5, y: 0.5 }));
    window.Tour.load(demo, 0);
    lastPlan = { title: "Demo-Wohnung", style: "Skandinavisch", rooms: demo.map(d => ({ id: d.id, name: d.label, neighbors: (d.links || []).map(l => demo[l.to] && demo[l.to].id).filter(Boolean) })) };
    projectTitle = "Demo-Wohnung";
    $("#tourEmpty").hidden = true; $("#pinTools").hidden = false; $("#tourNext").hidden = false;
    setTimeout(renderStationNav, 80); renderProjects();
    toast("Demo geladen — ziehen zum Umsehen, Boden-Pfeil = in den nächsten Raum.", "ok");
  };

  // Pin setzen + Produktauswahl
  let placing = false;
  $("#placeBtn").onclick = () => {
    placing = !placing; window.Tour.setPlaceMode(placing);
    $("#placeBtn").innerHTML = placing ? Icons.svg("check") + " Fertig" : Icons.svg("map-pin") + " Pin setzen";
    $("#placeBtn").classList.toggle("on", placing);
    if (placing) toast("Pin-Modus an — tippe ins Panorama, wo ein Möbel steht.");
  };
  let pendingLL = null;
  function pickItems() {
    return window.Catalogs ? window.Catalogs.query({ text: $("#pickSearch").value, kategorie: $("#pickCat").value }) : (window.CATALOG || []);
  }
  function renderPickGrid() {
    const grid = $("#pickGrid"); grid.innerHTML = "";
    const items = pickItems();
    if (!items.length) { grid.innerHTML = '<div class="muted" style="grid-column:1/-1">Keine Treffer. Lade/aktiviere Kataloge im Tab ' + Icons.svg("library") + ' Kataloge.</div>'; return; }
    items.forEach(item => {
      const c = document.createElement("button"); c.className = "pick";
      c.innerHTML = `<span class="pick-sw" style="background:${safeColor(item.color)}"></span>
        <b>${esc(item.name)}</b>
        <span class="muted">${esc(item.cat)} · ${(item.price || 0).toLocaleString("de-DE")} €${item.catalogName ? " · " + esc(item.catalogName) : ""}</span>`;
      c.onclick = () => {
        window.Tour.addPin(window.Tour.index(), { yaw: pendingLL.yaw, pitch: pendingLL.pitch, item });
        closeModal("pickModal"); showSpec(item); scheduleSave();
        toast(item.name.replace(/„|"/g, "") + " verortet.", "ok");
      };
      grid.appendChild(c);
    });
  }
  function openPicker(ll) {
    pendingLL = ll;
    const sel = $("#pickCat"), cur = sel.value;
    const cats = window.Catalogs ? window.Catalogs.categories() : [];
    sel.innerHTML = '<option value="">Alle Kategorien</option>' + cats.map(c => `<option${c === cur ? " selected" : ""}>${esc(c)}</option>`).join("");
    renderPickGrid();
    openModal("pickModal");
  }
  $("#pickSearch").oninput = renderPickGrid;
  $("#pickCat").onchange = renderPickGrid;
  $("#pickClose").onclick = () => closeModal("pickModal");
  $("#pickModal").onclick = e => { if (e.target.id === "pickModal") closeModal("pickModal"); };

  /* ================= ARCHITEKT (Claude = Gehirn) ================= */
  let planImg = null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const safeColor = c => /^[#a-zA-Z0-9(),.%\s-]+$/.test(String(c || "")) ? c : "transparent";
  function chatPush(html, who) {
    const m = document.createElement("div"); m.className = "chat-msg " + (who || "bot");
    m.innerHTML = html; $("#chatLog").appendChild(m); $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
    return m;
  }
  $("#planFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    planImg = await window.Banana.fileToInline(f);
    const t = $("#planThumb"); t.hidden = false; t.querySelector("img").src = `data:${planImg.mime};base64,${planImg.base64}`;
    chatPush(Icons.svg("ruler") + " Grundriss empfangen — klick <b>" + Icons.svg("building-2") + " Wohnung bauen</b> oder stell mir Fragen dazu.", "bot");
  };
  $("#chatSend").onclick = sendChat;
  $("#chatText").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendChat(); } });
  async function sendChat() {
    const text = $("#chatText").value.trim(); if (!text && !planImg) return;
    if (!IS.ckey) { toast("Trag zuerst den Claude-Key ein (Schlüssel-Symbol oben rechts)."); return openKey(); }
    if (text) chatPush(esc(text), "me");
    $("#chatText").value = "";
    const busy = chatPush("…", "bot");
    try {
      const txt = await window.Claude.call({
        system: "Du bist ein hilfreicher Interior-Architekt in der App Interior Studio. Antworte kurz auf Deutsch. Wenn der Nutzer eine Wohnung oder Etage bauen will, fordere ihn auf, „Wohnung bauen\" zu klicken.",
        content: window.Claude.content(text, planImg)
      });
      busy.innerHTML = esc(txt).replace(/\n/g, "<br>");
    } catch (e) { busy.className = "chat-msg err"; busy.textContent = e.message; }
  }

  const PLAN_SYS = `Du bist der Orchestrierungs-Architekt von "Interior Studio". Aus Beschreibung und/oder GRUNDRISSBILD planst du eine begehbare Wohnung oder Büroetage.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, kein Text drumherum. Schema:
{"title":"kurzer Titel","intro":"1-2 Sätze Deutsch, was du gebaut hast","style":"gemeinsamer Einrichtungsstil",
 "rooms":[{"id":"kurz_eindeutig","name":"Anzeigename Deutsch","prompt":"Englischer Prompt für ein fotorealistisches EQUIRECTANGULAR 360 Panorama dieses Raums; Fenster und Türen passend zum Grundriss; IDENTISCHER Boden, Stil und Lichtstimmung über ALLE Räume","neighbors":["id"],"map":{"x":0.0,"y":0.0}}]}
Regeln:
- WENN ein Grundriss-Bild vorliegt: lies es GENAU. Verwende die TATSÄCHLICH eingezeichneten Räume — exakte Anzahl und Namen aus der Zeichnung (z. B. "Wohnküche","Schlafzimmer","Bad","Flur","Diele","Balkon"). Erfinde KEINE zusätzlichen Räume und lasse keinen weg. neighbors = Räume, die laut Plan durch Tür/Durchgang verbunden sind. map.x/map.y = Position des Raums im Grundriss (0..1, 0,0 = oben links), maßstäblich zur Zeichnung.
- OHNE Grundriss: plane 4 bis 7 sinnvolle, verbundene Räume.
- neighbors müssen GEGENSEITIG konsistent sein (hat A B als Nachbar, hat B auch A).
- Arbeite den vom Nutzer gewünschten Stil/Materialien/Licht in JEDEN room.prompt ein, damit alle Räume EINHEITLICH wirken (gleicher Boden, gleiche Wandfarbe, gleiche Lichtstimmung).`;

  $("#buildApt").onclick = () => buildApartment($("#chatText").value.trim(), planImg);
  function setBuildBusy(on) {
    [$("#buildApt"), $("#chatSend"), $("#genBtn")].forEach(b => { if (b) b.disabled = on; });
  }
  async function buildApartment(briefText, planImage) {
    if (typeof briefText !== "string") briefText = $("#chatText").value.trim();
    if (planImage === undefined) planImage = planImg;
    if (!IS.ckey) { toast("Claude-Key fehlt (Schlüssel-Symbol oben rechts)."); return openKey(); }
    if (!IS.key) { toast("Gemini-Key fehlt fürs Rendern (Schlüssel-Symbol oben rechts)."); return openKey(); }
    const text = briefText;
    if (window.Projects) window.Projects.startNew();   // jeder Bau = neues Projekt im Baum
    setBuildBusy(true);
    buildBar("Claude plant deine Wohnung …");   // SOFORT sichtbar (egal welcher Tab) — kein „passiert nichts" mehr
    const status = chatPush(Icons.svg("brain") + " Claude liest den Plan …", "bot");
    try {
      const brief = text ? `Wunsch/Stil des Nutzers (in JEDEN room.prompt einarbeiten): ${text}` : "Plane eine schöne, realistische Beispiel-Wohnung.";
      const planTxt = await window.Claude.call({ system: PLAN_SYS, content: window.Claude.content(brief, planImage), maxTokens: 4096 });
      const plan = window.Claude.parseJSON(planTxt);
      if (!plan.rooms || !plan.rooms.length) throw new Error("Kein Raum-Plan erhalten.");
      lastPlan = plan; projectTitle = plan.title || projectTitle;
      status.innerHTML = Icons.svg("brain") + ` Plan: <b>${esc(plan.title || "Wohnung")}</b> — ${plan.rooms.length} Räume.`;
      renderPlanView(plan, -1);
      ensureTour();
      // Bewusst NICHT früh den Tab wechseln (war der „springt aus dem Nichts"-Sprung). Fortschritt zeigt der Banner.
      const built = []; let prevInline = null;   // Grundriss ist Strichzeichnung → NICHT als Render-Referenz; Räume verketten sich für Stil-Konsistenz
      for (let i = 0; i < plan.rooms.length; i++) {
        const r = plan.rooms[i];
        renderPlanView(plan, i);
        buildBar(`Raum ${i + 1}/${plan.rooms.length} wird gerendert: ${r.name || ""} …`);
        try {
          const res = await window.Banana.generate({
            prompt: (r.prompt || r.name) + " Equirectangular 360 degree panorama, seamless, photorealistic, horizon centered.",
            aspect: "21:9", resolution: "2K", images: prevInline ? [prevInline] : []
          });
          const img = await padTo2to1(res.url);
          prevInline = window.Banana.dataUrlToInline(img) || prevInline;
          built.push({ id: r.id || ("r" + i), label: r.name || ("Raum " + (i + 1)), img, map: r.map, neighbors: r.neighbors || [], pins: [] });
        } catch (err) {
          toast(`Raum „${r.name || (i + 1)}" übersprungen: ${err.message || "Fehler"}`, "err");   // Teilausfall killt nicht mehr alles
        }
      }
      if (!built.length) throw new Error("Kein Raum konnte gerendert werden — API-Limit, Guthaben oder Key prüfen.");
      // Nachbarschaften auf die TATSÄCHLICH gebauten Räume abbilden (übersprungene rausfiltern)
      const idIndex = {}; built.forEach((n, i) => { idIndex[n.id] = i; });
      built.forEach((n, i) => {
        const nb = (n.neighbors || []).map(id => idIndex[id]).filter(j => j != null && j !== i);
        n.links = nb.map((to, k) => ({ to, yaw: -1.4 + k * 1.5, pitch: 0.55, label: built[to].label }));
      });
      setTourPos(built);                          // Mini-Karte aus Grundriss-Positionen
      window.Tour.load(built, 0);
      renderStationNav(); renderMiniMap();
      $("#pinTools").hidden = false; $("#tourNext").hidden = false; $("#tourEmpty").hidden = true;
      renderPlanView(plan, plan.rooms.length);
      const skipped = plan.rooms.length - built.length;
      status.innerHTML = Icons.svg("circle-check", { cls: "ic-ok", title: "Fertig" }) + ` <b>${esc(plan.title || "Wohnung")}</b> ist begehbar${skipped ? ` (${skipped} übersprungen)` : ""}. ${esc(plan.intro || "")}`;
      showTab("walk");                            // erst JETZT wechseln — es gibt etwas zu sehen
      hideBuildBar();
      autoSaveFull();                             // sofort persistent — geht beim Neuladen nicht verloren
      toast(skipped ? `Wohnung gebaut — ${skipped} Raum/Räume übersprungen.` : "Wohnung gebaut — durch die Boden-Pfeile gehst du von Raum zu Raum.", "ok");
    } catch (e) {
      status.className = "chat-msg err"; status.textContent = "Fehler: " + (e.message || "unbekannt");
      window.Tour.setLoading(false);
      buildBarErr("Fehlgeschlagen: " + (e.message || "unbekannt"));
      toast("Wohnung bauen fehlgeschlagen: " + (e.message || "unbekannt"), "err");
    } finally { setBuildBusy(false); }
  }
  function renderPlanView(plan, doneUpto) {
    $("#planView").innerHTML = `<div class="plan-title">${esc(plan.title || "Wohnung")}</div>
      <div class="muted small" style="margin-bottom:8px">${esc(plan.style || "")}</div>
      <ol class="plan-rooms">${plan.rooms.map((r, i) => `<li class="${i < doneUpto ? "done" : (i === doneUpto ? "cur" : "")}"><b>${esc(r.name)}</b><span class="muted"> · ${(r.neighbors || []).length} Verbindungen</span></li>`).join("")}</ol>`;
  }

  /* ================= KATALOGE-TAB ================= */
  function renderCatList() {
    const box = $("#catList"); if (!box || !window.Catalogs) return;
    const cats = window.Catalogs.list();
    box.innerHTML = cats.length ? cats.map(c => `
      <div class="kat-card">
        <label class="kat-toggle"><input type="checkbox" data-id="${esc(c.id)}" ${c.enabled ? "checked" : ""} /></label>
        <div class="kat-meta">
          <b>${esc(c.name)}</b>
          <span class="muted small">${c.count} Artikel · Lizenz: ${esc(c.license)}${c.builtin ? " · mitgeliefert" : ""}</span>
        </div>
        ${c.builtin ? "" : `<button class="link kat-rm" data-rm="${esc(c.id)}">entfernen</button>`}
      </div>`).join("") : '<div class="muted">Keine Kataloge geladen.</div>';
    box.querySelectorAll("input[type=checkbox]").forEach(cb => cb.onchange = () => window.Catalogs.setEnabled(cb.dataset.id, cb.checked));
    box.querySelectorAll(".kat-rm").forEach(b => b.onclick = () => { window.Catalogs.remove(b.dataset.rm); renderCatList(); });
  }
  if ($("#catFile")) $("#catFile").onchange = async e => {
    if (!e.target.files.length) return;
    try { const added = await window.Catalogs.importFiles(e.target.files); toast(added.length + " Katalog(e) importiert.", "ok"); }
    catch (err) { toast(err.message || "Import fehlgeschlagen", "err"); }
    e.target.value = ""; renderCatList();
  };

  /* ================= PROJEKTE (speichern/laden) ================= */
  async function projectSnapshot() {
    const nodes = window.Tour ? window.Tour.stations() : [];
    const outNodes = [];
    for (const n of nodes) {
      outNodes.push({
        id: n.id, label: n.label,
        img: await window.Project.compressImg(n.img),
        links: (n.links || []).map(l => ({ to: l.to, yaw: l.yaw, pitch: l.pitch, label: l.label })),
        pins: (n.pins || []).map(p => ({ yaw: p.yaw, pitch: p.pitch, item: p.item }))
      });
    }
    return {
      schema: "interior-studio.project/v1",
      id: (window.Projects && window.Projects.current()) || ("prj_" + Date.now()),
      meta: { title: projectTitle, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rooms: outNodes.length },
      plan: lastPlan,
      budget: $("#budgetIn").value || "",
      mapPos: tourPos.slice(),   // Grundriss-Positionen für die Mini-Karte
      cart: cart.slice(),
      nodes: outNodes
    };
  }
  async function saveProject() {
    if (!window.Tour || !window.Tour.count()) return toast("Erst eine Wohnung bauen oder die Demo laden.");
    const btn = $("#projSave"); btn.disabled = true; btn.innerHTML = Icons.svg("loader-circle", { cls: "spin" }) + " Komprimiere …";
    try {
      const snap = await projectSnapshot();
      const fn = (projectTitle || "projekt").replace(/[^\wäöüÄÖÜ]+/g, "-").replace(/^-|-$/g, "") + ".studio.json";
      window.Project.download(fn, JSON.stringify(snap));
      toast("Projekt gespeichert: " + fn, "ok");
    } catch (e) { toast("Speichern fehlgeschlagen: " + (e.message || ""), "err"); }
    finally { btn.disabled = false; btn.innerHTML = Icons.svg("download") + " Exportieren"; }
  }
  function restoreProject(obj) {
    if (!obj || obj.schema !== "interior-studio.project/v1" || !Array.isArray(obj.nodes) || !obj.nodes.length)
      throw new Error("Keine gültige Projekt-Datei.");
    ensureTour();
    tourPos = Array.isArray(obj.mapPos) ? obj.mapPos.slice() : [];
    window.Tour.load(obj.nodes.map(n => ({ id: n.id, label: n.label, img: n.img, links: n.links || [], pins: n.pins || [] })), 0);
    lastPlan = obj.plan || null;
    projectTitle = (obj.meta && obj.meta.title) || "Projekt";
    cart.length = 0; (obj.cart || []).forEach(it => cart.push(it));
    $("#budgetIn").value = obj.budget || "";
    renderCart(); renderStationNav(); renderMiniMap();
    $("#tourEmpty").hidden = true; $("#pinTools").hidden = false; $("#tourNext").hidden = false;
    renderProjects(); showTab("walk");
    toast("Projekt „" + projectTitle + "“ geladen.", "ok");
  }
  async function openProject() {
    try {
      if (window.Projects) window.Projects.startNew();   // importierte Datei = neues Projekt im Baum
      restoreProject(JSON.parse(await window.Project.pickFile()));
      scheduleSave();
    } catch (e) { toast("Laden fehlgeschlagen: " + (e.message || ""), "err"); }
  }
  function newProject() {
    if (window.Projects) window.Projects.startNew();
    projectTitle = "Neues Projekt"; lastPlan = null; tourPos = []; cart.length = 0; renderCart(); renderProjects();
    toast("Neues Projekt — baue eine Wohnung im Studio oder Architekt.");
  }
  let saveTimer = null;
  function scheduleSave() { if (!window.Projects || !window.Tour || !window.Tour.count()) return; clearTimeout(saveTimer); saveTimer = setTimeout(autoSaveFull, 2500); }
  async function autoSaveFull() {
    if (!window.Projects || !window.Tour || !window.Tour.count()) return;
    try {
      const bundle = await projectSnapshot();
      bundle.meta.title = projectTitle;
      bundle.meta.thumbnail = bundle.nodes[0] ? await window.Project.thumb(bundle.nodes[0].img) : "";
      await window.Projects.save(bundle);   // legt neu an oder aktualisiert das aktuelle Projekt
    } catch (e) { /* App läuft in der Sitzung weiter; dauerhaft sichern via Export */ }
  }
  async function loadAndWalk(id) {
    const b = await window.Projects.load(id);
    if (!b) return toast("Projekt nicht gefunden.", "err");
    try { restoreProject(b); } catch (e) { toast("Laden fehlgeschlagen: " + (e.message || ""), "err"); }
  }
  function renderProjects() {
    const box = $("#projTree"); if (!box || !window.Projects) return;
    const { folders, projects } = window.Projects.tree();
    const curId = window.Projects.current();
    const hint = $("#projHint");
    if (hint) hint.textContent = (window.Store && window.Store.persistent())
      ? "Automatisch im Browser gespeichert. Tipp: für Backup/Weitergabe zusätzlich exportieren."
      : "Achtung: dauerhaftes Speichern hier nicht möglich (file://) — bitte exportieren.";
    if (!projects.length && !folders.length) {
      box.innerHTML = '<div class="empty">Noch keine Projekte. Bau im <b>KI-Studio → „Wohnung aus Grundriss"</b> eine Wohnung — sie erscheint dann automatisch hier und ist jederzeit wieder begehbar.</div>';
      return;
    }
    const folderOpts = sel => '<option value="">— ohne Ordner —</option>' + folders.map(f => `<option value="${esc(f.id)}"${sel === f.id ? " selected" : ""}>${esc(f.name)}</option>`).join("");
    const card = p => `<div class="prj-card${p.id === curId ? " is-cur" : ""}" data-open="${esc(p.id)}">
        ${p.thumbnail ? `<img src="${esc(p.thumbnail)}" alt=""/>` : `<span class="prj-ph">${Icons.svg("building-2")}</span>`}
        <div class="prj-meta"><b>${esc(p.title)}</b><span class="muted small">${p.rooms || 0} Räume · ${esc(new Date(p.updatedAt).toLocaleDateString("de-DE"))}</span></div>
        <select class="prj-move" data-mv="${esc(p.id)}" aria-label="In Ordner verschieben">${folderOpts(p.folderId)}</select>
        <button class="prj-del" data-del="${esc(p.id)}" aria-label="Projekt löschen">${Icons.svg("x")}</button>
      </div>`;
    const grid = list => `<div class="prj-grid">${list.map(card).join("") || '<div class="muted small" style="grid-column:1/-1;padding:4px">leer</div>'}</div>`;
    let html = folders.map(f => `<details class="prj-folder" open><summary>${Icons.svg("folder")} <b>${esc(f.name)}</b><button class="link fld-del" data-fdel="${esc(f.id)}" aria-label="Ordner entfernen">${Icons.svg("x")}</button></summary>${grid(projects.filter(p => p.folderId === f.id))}</details>`).join("");
    const loose = projects.filter(p => !p.folderId);
    if (loose.length) html += grid(loose);
    box.innerHTML = html;
    $$(".prj-card[data-open]", box).forEach(c => c.onclick = e => { if (e.target.closest(".prj-del") || e.target.closest(".prj-move")) return; loadAndWalk(c.dataset.open); });
    $$(".prj-del", box).forEach(b => b.onclick = e => { e.stopPropagation(); if (confirm("Dieses Projekt löschen?")) window.Projects.remove(b.dataset.del); });
    $$(".fld-del", box).forEach(b => b.onclick = e => { e.stopPropagation(); e.preventDefault(); window.Projects.removeFolder(b.dataset.fdel); });
    $$(".prj-move", box).forEach(s => { s.onclick = e => e.stopPropagation(); s.onchange = e => { e.stopPropagation(); window.Projects.moveProject(s.dataset.mv, s.value); }; });
  }
  $("#projSave").onclick = saveProject;
  $("#projOpen").onclick = openProject;
  $("#projNew").onclick = newProject;
  $("#projFolder").onclick = () => { const name = prompt("Name des neuen Ordners:"); if (name && window.Projects) window.Projects.addFolder(name.trim()); };

  /* ---------- Spec-Card + Einkaufsliste ---------- */
  const cart = [];
  function showSpec(item) {
    // Katalogdaten sind nutzer-importiert (untrusted) → jedes Feld escapen, Farbe auf sichere Zeichen begrenzen.
    const sw = `<span class="swatch" style="background:${safeColor(item.color)}"></span>`;
    $("#specCard").className = "spec";
    $("#specCard").innerHTML = `
      <h4>${esc(item.name)}<span class="pos-tag">${esc(item.tag)}</span></h4><div class="spec-sub">${esc(item.cat)} · ${esc(item.brand)} · Status: ${esc(item.status)}</div>
      <dl>
        <dt>Maße</dt><dd>${esc(item.w)} × ${esc(item.d)} × ${esc(item.h)} cm</dd>
        <dt>Material</dt><dd>${esc(item.material)}</dd>
        <dt>Farbe</dt><dd>${sw}${esc(item.color)}</dd>
        <dt>Lieferant</dt><dd>${esc(item.supplier)}</dd>
        <dt>Lieferzeit</dt><dd>${esc(item.lead)}</dd>
        <dt>Preis</dt><dd><b>${(Number(item.price) || 0).toLocaleString("de-DE")} €</b></dd>
      </dl>
      <div class="muted small" style="margin-bottom:10px">${(item.props || []).map(esc).join(" · ")}</div>
      <button class="btn btn-accent" id="addCart" style="width:100%">+ Zur Einkaufsliste</button>`;
    $("#addCart").onclick = () => addCart(item);
  }
  function addCart(item) {
    const key = item.gid || item.id;
    if (!cart.find(c => (c.gid || c.id) === key)) cart.push(item);
    renderCart(); scheduleSave();
    toast(item.name.replace(/„|"/g, "") + " hinzugefügt.", "ok");
  }
  function renderCart() {
    const ul = $("#cartList");
    const sum = cart.reduce((s, it) => s + it.price, 0);
    if (!cart.length) { ul.innerHTML = '<li class="muted">noch leer</li>'; }
    else {
      ul.innerHTML = "";
      cart.forEach(it => { const nm = String(it.name || "").replace(/„|"/g, ""); const li = document.createElement("li"); li.innerHTML = `<span>${esc(nm)}</span><span>${(Number(it.price) || 0).toLocaleString("de-DE")} € <button type="button" class="rm" aria-label="${esc(nm)} entfernen">${Icons.svg("x")}</button></span>`; li.querySelector(".rm").onclick = () => { cart.splice(cart.indexOf(it), 1); renderCart(); scheduleSave(); }; ul.appendChild(li); });
    }
    $("#cartTotal").textContent = sum.toLocaleString("de-DE") + " €";
    updateAmpel(sum);
  }
  function updateAmpel(ist) {
    const soll = parseFloat($("#budgetIn").value) || 0;
    const a = $("#ampel"), fill = $("#ampelFill"), txt = $("#ampelTxt");
    if (!soll) { a.hidden = true; return; }
    a.hidden = false;
    const ratio = ist / soll;
    let col = "#3fb16b"; if (ratio > 1) col = "#e0654f"; else if (ratio > 0.9) col = "#d59a6a";
    fill.style.width = Math.min(100, ratio * 100) + "%"; fill.style.background = col;
    const diff = soll - ist;
    txt.textContent = `${ist.toLocaleString("de-DE")} € von ${soll.toLocaleString("de-DE")} € — ${diff >= 0 ? "noch " + diff.toLocaleString("de-DE") + " € frei" : Math.abs(diff).toLocaleString("de-DE") + " € über Budget"}`;
    txt.style.color = col;
  }

  /* ---------- Vollbild (sauberes Raus) ---------- */
  function addFullscreen() {
    $$(".viewport .vp-bar").forEach(bar => {
      const vp = bar.closest(".viewport");
      const b = document.createElement("button"); b.className = "btn btn-ghost"; b.innerHTML = Icons.svg("maximize") + " Vollbild";
      b.onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else vp.requestFullscreen && vp.requestFullscreen(); };
      bar.insertBefore(b, bar.firstChild);
    });
    document.addEventListener("fullscreenchange", () => {
      const fs = document.fullscreenElement;
      $$(".viewport .vp-bar .btn").forEach(b => { if (b.innerHTML.includes("Vollbild") || b.innerHTML.includes("Verlassen")) b.innerHTML = fs ? Icons.svg("maximize") + " Verlassen (Esc)" : Icons.svg("maximize") + " Vollbild"; });
      setTimeout(() => tourReady && window.Tour.resize(), 80);
    });
  }

  /* ================= HILFE ================= */
  const EXAMPLES = [
    { t: "Wohnzimmer skandinavisch", p: "Helles skandinavisches Wohnzimmer, Eiche, weiße Wände, Bouclé-Sofa, große Fenster, Pflanzen, warmes Tageslicht, fotorealistisch" },
    { t: "Küche modern", p: "Moderne Küche, grifflose Fronten in Salbeigrün, helle Arbeitsplatte, Messingarmatur, Holzboden, indirektes Licht, fotorealistisch" },
    { t: "Schlafzimmer Japandi", p: "Japandi-Schlafzimmer, niedriges Holzbett, Leinen, warme Erdtöne, Papierleuchte, ruhig, fotorealistisch" },
    { t: "Bad spa-artig", p: "Spa-Badezimmer, Mikrozement, Travertin, ebenerdige Dusche, Holzakzente, warmes Licht, fotorealistisch" },
    { t: "Home-Office", p: "Home-Office, Eichenschreibtisch, Bücherregal, gemütliche Beleuchtung, Pflanzen, Mid-Century-Stuhl, fotorealistisch" },
    { t: "Website-Hero", p: "Architektur-Hero-Bild eines modernen Holzhauses bei goldener Stunde, Wald, fotorealistisch, breites Format" }
  ];
  const GALLERY = [
    { src: "examples/demo-livingroom.png", t: "Skandinavisch erzeugt", s: "Text → Bild" },
    { src: "examples/style-japandi-bedroom.png", t: "Japandi-Schlafzimmer", s: "Text → Bild" },
    { src: "examples/style-industrial-kitchen.png", t: "Industrial-Küche", s: "Text → Bild" },
    { src: "examples/style-luxury-office.png", t: "Light-Luxury-Office", s: "Text → Bild" }
  ];
  function renderHelp() {
    const I = (n, o) => (window.Icons ? Icons.svg(n, o) : "");
    const ex = EXAMPLES.map(e => `<div class="ex" data-p="${e.p.replace(/"/g, "&quot;")}"><b>${e.t}</b><span>${e.p.slice(0, 70)}…</span></div>`).join("");
    const gal = GALLERY.map(g => `<figure class="shot"><img loading="lazy" src="${g.src}" alt="${g.t}"/><figcaption><b>${g.t}</b><span>${g.s}</span></figcaption></figure>`).join("");
    $("#helpContent").innerHTML = `
      <span class="eyebrow">Anleitung</span>
      <h2>Interior Studio — so funktioniert's</h2>
      <p>Drei Dinge in einem Werkzeug: <b>Bilder erzeugen &amp; Räume redesignen</b> (Nano Banana / Gemini), aus einem <b>Grundriss eine begehbare Wohnung</b> bauen (Claude plant, Gemini rendert), und darin <b>Möbel verorten</b> mit automatischer Einkaufsliste &amp; Budget. Kein Server, kein Konto — deine Keys bleiben nur in deinem Browser (BYOK).</p>

      <h3>Beispiele — direkt mit diesem Tool erzeugt</h3>
      <div class="ba">
        <figure class="shot ba-fig"><img loading="lazy" src="examples/before-empty.png" alt="Vorher: leerer Raum"/><figcaption><b>Vorher</b><span>Leeres Foto</span></figcaption></figure>
        <div class="ba-arrow">${I("arrow-right")}</div>
        <figure class="shot ba-fig"><img loading="lazy" src="examples/after-midcentury.png" alt="Nachher: Mid-Century redesignt"/><figcaption><b>Nachher</b><span>„Raum redesignen" · Mid-Century</span></figcaption></figure>
      </div>
      <p class="muted">Gleicher Raum, gleiche Kamera — Wände, Fenster und Boden bleiben, nur eingerichtet.</p>
      <div class="shots">${gal}</div>

      <h3>1) Einmal einrichten — zwei Schlüssel</h3>
      <ol>
        <li>Oben rechts auf <b>${I("key")} Key</b>.</li>
        <li><b>Gemini-Key</b> (für die Bilder) bei <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> holen. Die Bildgenerierung braucht ein Google-Cloud-Projekt mit aktiviertem Billing.</li>
        <li><b>Claude-Key</b> (für das Lesen von Grundrissen &amp; das Planen der Wohnung) bei <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>. Beide Keys bleiben nur lokal in deinem Browser.</li>
      </ol>

      <h3>2) ${I("building-2")} Wohnung aus Grundriss — das Herzstück</h3>
      <p>Im <b>KI-Studio</b> den Modus <b>„Wohnung aus Grundriss"</b> wählen (oder den Tab <b>${I("building-2")} Architekt</b>). Lade ein Foto/Scan deines <b>Grundrisses</b> hoch und beschreibe den gewünschten Stil (z. B. „moderne Luxus-Ästhetik, Marmor, Messing, indirekte Beleuchtung"). Claude liest den Plan, legt die <b>tatsächlichen Räume</b> an (1:1 nach Aufteilung &amp; Türen) und rendert pro Raum ein 360°-Panorama — am Ende ist alles <b>begehbar</b>. Ohne Grundriss reicht auch eine reine Beschreibung.</p>

      <h3>3) Einzelne Bilder erzeugen oder einen Raum redesignen</h3>
      <p>Im <b>KI-Studio</b>: <b>„Bild erzeugen"</b> für neue Räume/Website-Bilder, oder <b>„Raum redesignen"</b> → eigenes Foto hochladen + Anweisung (Wände/Fenster bleiben, nur neu eingerichtet). Stil-Vorlagen anklicken, ${I("mic")} zum Diktieren. Jedes Ergebnis hat einen Button <b>${I("compass")} Als Begehung</b>.</p>
      <div class="ex-grid">${ex}</div>
      <p class="muted">Klick eine Vorlage, um sie ins Studio zu laden.</p>

      <h3>4) ${I("compass")} Begehung — im Raum umsehen</h3>
      <p><b>Ziehen</b> zum Umsehen, <b>Scroll</b> zum Zoomen, <b>${I("rotate-cw")} Auto-Drehung</b> für die Präsentation, <b>${I("footprints")} Schritt vorwärts</b> für den nächsten Standort, <b>${I("maximize")} Vollbild</b> (Esc = raus). Tipp: <b>${I("play")} Demo-Begehung</b> läuft sofort ohne Key.</p>

      <h3>5) ${I("map-pin")} Möbel verorten → ${I("shopping-cart")} Einkaufsliste</h3>
      <p><b>${I("map-pin")} Pin setzen</b> → ins Panorama tippen, wo ein Möbel steht → Produkt aus dem Katalog wählen. Es erscheint als Pin und als <b>Spec-Card</b> (Maße, Material, Farbe, Lieferant, Lieferzeit, Preis) und summiert in der <b>Einkaufsliste</b> gegen dein ${I("gauge")} <b>Budget</b> (Ampel). Eigene Kataloge (JSON/CSV) lädst du im Tab <b>${I("library")} Kataloge</b>.</p>

      <h3>6) ${I("save")} Projekt sichern &amp; ${I("share-2")} teilen</h3>
      <ul>
        <li><b>Speichern:</b> Tab <b>${I("folders")} Projekte</b> → <b>${I("save")} Projekt speichern</b> legt eine selbsttragende <code>.studio.json</code> an (Räume, Pins, Einkaufsliste, Budget). Jederzeit wieder öffnen — auch auf einem anderen Rechner.</li>
        <li><b>Als EINE Datei verschicken:</b> <code>dist/Interior-Studio.html</code> enthält alles in sich (Code, Bilder, Demo). Per WhatsApp/Mail/USB verschicken — Empfänger öffnet sie per <b>Doppelklick</b> und trägt eigene Keys ein. (Neu bauen: <code>python3 tools/build-single.py</code>.)</li>
      </ul>

      <div class="note">${I("triangle-alert")} <b>Ehrlich, was es (noch) nicht ist:</b> Die Begehung ist eine <b>360°-Panorama-Tour</b> — du siehst dich um und springst Raum für Raum, läufst aber noch nicht frei wie in einem Spiel (echtes 6DoF-3D ist als nächster Schritt geplant). KI-Bilder sind <b>nicht maßstabstreu</b> — gut für Stil &amp; Wirkung, nicht für exakte Maße. Beim Öffnen als Einzeldatei (file://) merkt sich Safari die Keys teils nicht über Neustarts — einfach erneut eintragen.</div>

      <h3>Für Entwickler — selber weiterbauen</h3>
      <ul>
        <li><code>icons.js</code> — Icon-Set (Lucide, offline). Neu bauen: <code>python3 tools/build-icons.py</code>.</li>
        <li><code>catalog.js</code> / <code>catalogs.js</code> — Produktdaten &amp; Import (Picker beim Pin-Setzen, Einkaufsliste).</li>
        <li><code>tour.js</code> — Panorama-Begehung: Kugel-Mapping, Standort-Übergänge, Pins.</li>
        <li><code>app.js</code> — Orchestrierung; <code>banana.js</code> (Gemini-Bild), <code>claude.js</code> (Anthropic-Plan).</li>
      </ul>`;
    $$("#helpContent .ex").forEach(c => c.onclick = () => { $("#prompt").value = c.dataset.p; showTab("studio"); $("#prompt").focus(); toast("Prompt geladen."); });
  }

  /* ---------- Init ---------- */
  if (window.Icons) Icons.hydrate(document);
  $("#budgetIn").oninput = () => { renderCart(); scheduleSave(); };
  if (window.Catalogs) {
    window.Catalogs.setQuotaHandler(() => toast("Speicher voll — Katalog nur für diese Sitzung gehalten.", "err"));
    window.Catalogs.onChange(renderCatList);
    window.Catalogs.loadBuiltins().then(renderCatList);
  }
  refreshKeyState(); renderHelp(); addVoice(); addFullscreen(); renderCart(); refreshStudioSrc();
  if (window.Projects) { window.Projects.onChange(renderProjects); window.Projects.init(); } else { renderProjects(); }
})();
