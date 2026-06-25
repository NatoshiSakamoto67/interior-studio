/* Interior Studio — App-Controller */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
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

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    const t = document.createElement("div"); t.className = "toast" + (kind ? " " + kind : "");
    t.textContent = msg; $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* ---------- Key ---------- */
  function refreshKeyState() {
    const ok = !!IS.key;
    $("#keyState").textContent = ok ? "Key ✓" : "Key";
    $("#openKey").classList.toggle("ok", ok);
    $("#needkey").hidden = ok;
  }
  function openKey() {
    $("#keyInput").value = IS.key; $("#modelInput").value = IS.model;
    $("#ckeyInput").value = IS.ckey; $("#cmodelInput").value = IS.cmodel;
    $("#keyModal").hidden = false;
  }
  $("#openKey").onclick = openKey; $("#needkeyBtn").onclick = openKey;
  $("#keyClose").onclick = () => $("#keyModal").hidden = true;
  $("#keyModal").onclick = e => { if (e.target.id === "keyModal") $("#keyModal").hidden = true; };
  $("#keySave").onclick = () => {
    IS.key = $("#keyInput").value.trim(); IS.model = $("#modelInput").value.trim() || IS.model;
    IS.ckey = $("#ckeyInput").value.trim(); IS.cmodel = $("#cmodelInput").value || IS.cmodel;
    store.set("is_key", IS.key); store.set("is_model", IS.model);
    store.set("is_ckey", IS.ckey); store.set("is_cmodel", IS.cmodel);
    $("#keyModal").hidden = true; refreshKeyState(); toast("Keys gespeichert (nur lokal).", "ok");
  };
  $("#keyForget").onclick = () => {
    IS.key = ""; IS.ckey = ""; store.del("is_key"); store.del("is_ckey");
    refreshKeyState(); $("#keyModal").hidden = true; toast("Keys entfernt.");
  };

  /* ---------- Tabs ---------- */
  function showTab(name) {
    $$(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === name));
    $$(".panel").forEach(p => p.classList.toggle("is-active", p.dataset.panel === name));
    if (name === "walk") ensureTour();
  }
  $$(".tab").forEach(t => t.onclick = () => showTab(t.dataset.tab));

  /* ================= KI-STUDIO ================= */
  $$("#studioMode .seg-b").forEach(b => b.onclick = () => {
    $$("#studioMode .seg-b").forEach(x => x.classList.remove("is-active")); b.classList.add("is-active");
    mode = b.dataset.mode;
    $("#uploadFld").hidden = mode !== "redesign";
    $("#promptLabel").textContent = mode === "redesign" ? "Anweisung" : "Beschreibung / Stil";
    $("#prompt").placeholder = mode === "redesign"
      ? "z. B. Gestalte diesen Raum wie ein Profi-Interior-Designer: Japandi, helle Eiche, das Fenster behalten."
      : "z. B. Modernes Wohnzimmer, helle Eiche, warmes Licht, große Fenster, skandinavisch …";
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
    const prompt = $("#prompt").value.trim();
    if (!prompt) return toast("Bitte zuerst eine Beschreibung eingeben.");
    if (!IS.key) return openKey();
    if (mode === "redesign" && !redesignImg) return toast("Bitte ein Raumfoto hochladen.");
    const card = addBusyCard();
    $("#genBtn").disabled = true; $("#genBtn").textContent = "⏳ Erzeuge …";
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
    finally { $("#genBtn").disabled = false; $("#genBtn").textContent = "✨ Erzeugen"; }
  };

  function addBusyCard() {
    $("#galleryEmpty") && ($("#galleryEmpty").style.display = "none");
    $("#clearGallery").hidden = false;
    const c = document.createElement("div"); c.className = "card busy"; c.textContent = "⏳ Nano Banana rendert …";
    $("#gallery").prepend(c); return c;
  }
  function fillCard(card, url, prompt) {
    card.className = "card";
    card.innerHTML = `<img src="${url}" alt="Ergebnis"/>
      <div class="card-acts">
        <a class="btn" download="interior.png" href="${url}">⬇︎</a>
        <button class="btn btn-accent" data-act="tour">🧭 Als Begehung</button>
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
      const btn = document.createElement("button"); btn.className = "btn btn-ghost"; btn.type = "button"; btn.textContent = "🎤 Sprechen"; btn.style.marginTop = "-6px";
      host.insertAdjacentElement("beforebegin", btn);
      const rec = new SR(); rec.lang = "de-DE"; rec.interimResults = false;
      btn.onclick = () => { btn.textContent = "● Hört zu …"; try { rec.start(); } catch {} };
      rec.onresult = e => { const txt = e.results[0][0].transcript; const p = $(fldSel); p.value = (p.value.trim() ? p.value.trim() + " " : "") + txt; };
      rec.onerror = () => toast("Spracherkennung nicht verfügbar.");
      rec.onend = () => btn.textContent = "🎤 Sprechen";
    });
  }

  /* ================= BEGEHUNG (Panorama-Tour) ================= */
  function ensureTour() {
    if (tourReady) { window.Tour.resize(); return; }
    tourReady = true;
    window.Tour.init($("#tourHost"), { onPick: showSpec, onPlace: openPicker });
    setTimeout(() => window.Tour.resize(), 60);
  }

  // Quelle (Text / Foto / KI-Studio)
  $$("#tourMode .seg-b").forEach(b => b.onclick = () => {
    $$("#tourMode .seg-b").forEach(x => x.classList.remove("is-active")); b.classList.add("is-active");
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
      toast("Raum erstellt — ziehen zum Umsehen, Möbel mit 📍 verorten.", "ok");
      return i;
    } catch (e) { window.Tour.setLoading(false); toast(e.message || "Fehler", "err"); }
    finally { setTourBusy(false); }
  }
  function setTourBusy(on) {
    $("#tourGen").disabled = on; $("#tourNext").disabled = on;
    $("#tourGen").textContent = on ? "⏳ Rendert …" : "🧭 Panorama-Standort erzeugen";
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
      const b = document.createElement("button"); b.className = "room-chip" + (i === window.Tour.index() ? " on" : "");
      b.textContent = st.label || ("Raum " + (i + 1)); b.title = st.label;
      b.onclick = () => { window.Tour.go(i); setTimeout(renderStationNav, 40); };
      nav.appendChild(b);
    });
  }
  $("#autoRotBtn").onclick = e => { const on = window.Tour.autoRotate(); e.target.classList.toggle("on", on); };
  $("#resetView").onclick = () => window.Tour.resetView();

  // Offline-Demo (ohne Key): echtes Panorama + vorplatzierte Pins
  function byId(id) { return (window.CATALOG || []).find(c => c.id === id); }
  $("#loadDemo").onclick = () => {
    ensureTour();
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
    $("#placeBtn").textContent = placing ? "✓ Fertig" : "📍 Pin setzen";
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
    if (!items.length) { grid.innerHTML = '<div class="muted" style="grid-column:1/-1">Keine Treffer. Lade/aktiviere Kataloge im Tab 🗂️ Kataloge.</div>'; return; }
    items.forEach(item => {
      const c = document.createElement("button"); c.className = "pick";
      c.innerHTML = `<span class="pick-sw" style="background:${esc(item.color)}"></span>
        <b>${esc(item.name)}</b>
        <span class="muted">${esc(item.cat)} · ${(item.price || 0).toLocaleString("de-DE")} €${item.catalogName ? " · " + esc(item.catalogName) : ""}</span>`;
      c.onclick = () => {
        window.Tour.addPin(window.Tour.index(), { yaw: pendingLL.yaw, pitch: pendingLL.pitch, item });
        $("#pickModal").hidden = true; showSpec(item);
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
    $("#pickModal").hidden = false;
  }
  $("#pickSearch").oninput = renderPickGrid;
  $("#pickCat").onchange = renderPickGrid;
  $("#pickClose").onclick = () => $("#pickModal").hidden = true;
  $("#pickModal").onclick = e => { if (e.target.id === "pickModal") $("#pickModal").hidden = true; };

  /* ================= ARCHITEKT (Claude = Gehirn) ================= */
  let planImg = null;
  const esc = s => String(s == null ? "" : s).replace(/</g, "&lt;");
  function chatPush(html, who) {
    const m = document.createElement("div"); m.className = "chat-msg " + (who || "bot");
    m.innerHTML = html; $("#chatLog").appendChild(m); $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
    return m;
  }
  $("#planFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    planImg = await window.Banana.fileToInline(f);
    const t = $("#planThumb"); t.hidden = false; t.querySelector("img").src = `data:${planImg.mime};base64,${planImg.base64}`;
    chatPush("📐 Grundriss empfangen — klick <b>🏗️ Wohnung bauen</b> oder stell mir Fragen dazu.", "bot");
  };
  $("#chatSend").onclick = sendChat;
  $("#chatText").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendChat(); } });
  async function sendChat() {
    const text = $("#chatText").value.trim(); if (!text && !planImg) return;
    if (!IS.ckey) { toast("Trag zuerst den Claude-Key ein (🔑)."); return openKey(); }
    if (text) chatPush(esc(text), "me");
    $("#chatText").value = "";
    const busy = chatPush("…", "bot");
    try {
      const txt = await window.Claude.call({
        system: "Du bist ein hilfreicher Interior-Architekt in der App Interior Studio. Antworte kurz auf Deutsch. Wenn der Nutzer eine Wohnung oder Etage bauen will, fordere ihn auf, „🏗️ Wohnung bauen\" zu klicken.",
        content: window.Claude.content(text, planImg)
      });
      busy.innerHTML = esc(txt).replace(/\n/g, "<br>");
    } catch (e) { busy.className = "chat-msg err"; busy.textContent = e.message; }
  }

  const PLAN_SYS = `Du bist der Orchestrierungs-Architekt von "Interior Studio". Aus Beschreibung und/oder Grundrissbild planst du eine begehbare Wohnung oder Büroetage.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, kein Text drumherum. Schema:
{"title":"kurzer Titel","intro":"1-2 Sätze Deutsch, was du gebaut hast","style":"gemeinsamer Einrichtungsstil",
 "rooms":[{"id":"kurz_eindeutig","name":"Anzeigename Deutsch","prompt":"Englischer Prompt für ein fotorealistisches EQUIRECTANGULAR 360 Panorama dieses Raums; Fenster und Türen passend zum Grundriss; IDENTISCHER Boden, Stil und Lichtstimmung über ALLE Räume","neighbors":["id"],"map":{"x":0.0,"y":0.0}}]}
Regeln: 4 bis 7 Räume. neighbors müssen gegenseitig konsistent sein (wenn A B als Nachbar hat, hat B auch A). Alle Räume teilen denselben Einrichtungsstil. map = Position im Grundriss, x und y zwischen 0 und 1 (0,0 = oben links).`;

  $("#buildApt").onclick = buildApartment;
  async function buildApartment() {
    if (!IS.ckey) { toast("Claude-Key fehlt (🔑)."); return openKey(); }
    if (!IS.key) { toast("Gemini-Key fehlt fürs Rendern (🔑)."); return openKey(); }
    const text = $("#chatText").value.trim();
    $("#buildApt").disabled = true; $("#chatSend").disabled = true;
    const status = chatPush("🧠 Claude liest den Plan …", "bot");
    try {
      const planTxt = await window.Claude.call({ system: PLAN_SYS, content: window.Claude.content(text || "Plane eine schöne Beispiel-Wohnung.", planImg), maxTokens: 4096 });
      const plan = window.Claude.parseJSON(planTxt);
      if (!plan.rooms || !plan.rooms.length) throw new Error("Kein Raum-Plan erhalten.");
      lastPlan = plan; projectTitle = plan.title || projectTitle;
      status.innerHTML = `🧠 Plan: <b>${esc(plan.title || "Wohnung")}</b> — ${plan.rooms.length} Räume. Ich rendere sie nacheinander …`;
      renderPlanView(plan, -1);
      ensureTour();
      const nodes = []; let prevInline = planImg;
      for (let i = 0; i < plan.rooms.length; i++) {
        const r = plan.rooms[i];
        renderPlanView(plan, i);
        window.Tour.setLoading(true, `Raum ${i + 1}/${plan.rooms.length}: ${r.name} …`);
        const res = await window.Banana.generate({
          prompt: (r.prompt || r.name) + " Equirectangular 360 degree panorama, seamless, photorealistic, horizon centered.",
          aspect: "21:9", resolution: "2K", images: prevInline ? [prevInline] : []
        });
        const img = await padTo2to1(res.url);
        prevInline = window.Banana.dataUrlToInline(img) || prevInline;
        nodes.push({ id: r.id || ("r" + i), label: r.name || ("Raum " + (i + 1)), img, pins: [] });
      }
      const idIndex = {}; plan.rooms.forEach((r, i) => { idIndex[r.id] = i; });
      nodes.forEach((n, i) => {
        const nb = (plan.rooms[i].neighbors || []).map(id => idIndex[id]).filter(j => j != null && j !== i);
        n.links = nb.map((to, k) => ({ to, yaw: -1.4 + k * 1.5, pitch: 0.55, label: nodes[to].label }));
      });
      window.Tour.load(nodes, 0);
      renderStationNav();
      $("#pinTools").hidden = false; $("#tourNext").hidden = false; $("#tourEmpty").hidden = true;
      renderPlanView(plan, plan.rooms.length);
      status.innerHTML = `✅ <b>${esc(plan.title || "Wohnung")}</b> ist begehbar. ${esc(plan.intro || "")}`;
      showTab("walk");
      toast("Wohnung gebaut — viel Spaß beim Begehen!", "ok");
    } catch (e) {
      status.className = "chat-msg err"; status.textContent = "Fehler: " + (e.message || "unbekannt");
      window.Tour.setLoading(false);
    } finally { $("#buildApt").disabled = false; $("#chatSend").disabled = false; }
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
      id: "prj_" + Date.now(),
      meta: { title: projectTitle, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rooms: outNodes.length },
      plan: lastPlan,
      budget: $("#budgetIn").value || "",
      cart: cart.slice(),
      nodes: outNodes
    };
  }
  async function saveProject() {
    if (!window.Tour || !window.Tour.count()) return toast("Erst eine Wohnung bauen oder die Demo laden.");
    const btn = $("#projSave"); btn.disabled = true; btn.textContent = "💾 Komprimiere …";
    try {
      const snap = await projectSnapshot();
      const fn = (projectTitle || "projekt").replace(/[^\wäöüÄÖÜ]+/g, "-").replace(/^-|-$/g, "") + ".studio.json";
      window.Project.download(fn, JSON.stringify(snap));
      toast("Projekt gespeichert: " + fn, "ok");
    } catch (e) { toast("Speichern fehlgeschlagen: " + (e.message || ""), "err"); }
    finally { btn.disabled = false; btn.textContent = "💾 Projekt speichern"; }
  }
  function restoreProject(obj) {
    if (!obj || obj.schema !== "interior-studio.project/v1" || !Array.isArray(obj.nodes) || !obj.nodes.length)
      throw new Error("Keine gültige Projekt-Datei.");
    ensureTour();
    window.Tour.load(obj.nodes.map(n => ({ id: n.id, label: n.label, img: n.img, links: n.links || [], pins: n.pins || [] })), 0);
    lastPlan = obj.plan || null;
    projectTitle = (obj.meta && obj.meta.title) || "Projekt";
    cart.length = 0; (obj.cart || []).forEach(it => cart.push(it));
    $("#budgetIn").value = obj.budget || "";
    renderCart(); renderStationNav();
    $("#tourEmpty").hidden = true; $("#pinTools").hidden = false; $("#tourNext").hidden = false;
    renderProjects(); showTab("walk");
    toast("Projekt „" + projectTitle + "“ geladen.", "ok");
  }
  async function openProject() {
    try { restoreProject(JSON.parse(await window.Project.pickFile())); }
    catch (e) { toast("Laden fehlgeschlagen: " + (e.message || ""), "err"); }
  }
  function newProject() {
    projectTitle = "Neues Projekt"; lastPlan = null; cart.length = 0; renderCart(); renderProjects();
    toast("Neues Projekt — baue eine Wohnung im Studio oder Architekt.");
  }
  function renderProjects() {
    const box = $("#projCurrent"); if (!box) return;
    const rooms = window.Tour ? window.Tour.count() : 0;
    const sum = cart.reduce((s, it) => s + (it.price || 0), 0);
    box.innerHTML = `<div class="proj-card">
      <div class="proj-meta">
        <b>${esc(projectTitle)}</b>
        <span class="muted small">${rooms} ${rooms === 1 ? "Raum" : "Räume"} · ${cart.length} Artikel · ${sum.toLocaleString("de-DE")} €</span>
      </div>
      ${rooms ? '<span class="proj-badge">aktiv</span>' : '<span class="muted small">noch leer</span>'}
    </div>`;
  }
  $("#projSave").onclick = saveProject;
  $("#projOpen").onclick = openProject;
  $("#projNew").onclick = newProject;

  /* ---------- Spec-Card + Einkaufsliste ---------- */
  const cart = [];
  function showSpec(item) {
    const sw = `<span class="swatch" style="background:${item.color}"></span>`;
    $("#specCard").className = "spec";
    $("#specCard").innerHTML = `
      <h4>${item.name}<span class="pos-tag">${item.tag}</span></h4><div class="spec-sub">${item.cat} · ${item.brand} · Status: ${item.status}</div>
      <dl>
        <dt>Maße</dt><dd>${item.w} × ${item.d} × ${item.h} cm</dd>
        <dt>Material</dt><dd>${item.material}</dd>
        <dt>Farbe</dt><dd>${sw}${item.color}</dd>
        <dt>Lieferant</dt><dd>${item.supplier}</dd>
        <dt>Lieferzeit</dt><dd>${item.lead}</dd>
        <dt>Preis</dt><dd><b>${item.price.toLocaleString("de-DE")} €</b></dd>
      </dl>
      <div class="muted small" style="margin-bottom:10px">${item.props.join(" · ")}</div>
      <button class="btn btn-accent" id="addCart" style="width:100%">+ Zur Einkaufsliste</button>`;
    $("#addCart").onclick = () => addCart(item);
  }
  function addCart(item) {
    const key = item.gid || item.id;
    if (!cart.find(c => (c.gid || c.id) === key)) cart.push(item);
    renderCart();
    toast(item.name.replace(/„|"/g, "") + " hinzugefügt.", "ok");
  }
  function renderCart() {
    const ul = $("#cartList");
    const sum = cart.reduce((s, it) => s + it.price, 0);
    if (!cart.length) { ul.innerHTML = '<li class="muted">noch leer</li>'; }
    else {
      ul.innerHTML = "";
      cart.forEach(it => { const li = document.createElement("li"); li.innerHTML = `<span>${it.name.replace(/„|"/g, "")}</span><span>${it.price.toLocaleString("de-DE")} € <span class="rm" title="entfernen">✕</span></span>`; li.querySelector(".rm").onclick = () => { cart.splice(cart.indexOf(it), 1); renderCart(); }; ul.appendChild(li); });
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
      const b = document.createElement("button"); b.className = "btn btn-ghost"; b.innerHTML = "⛶ Vollbild";
      b.onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else vp.requestFullscreen && vp.requestFullscreen(); };
      bar.insertBefore(b, bar.firstChild);
    });
    document.addEventListener("fullscreenchange", () => {
      const fs = document.fullscreenElement;
      $$(".viewport .vp-bar .btn").forEach(b => { if (b.innerHTML.includes("Vollbild") || b.innerHTML.includes("Verlassen")) b.innerHTML = fs ? "⛶ Verlassen (Esc)" : "⛶ Vollbild"; });
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
    const ex = EXAMPLES.map(e => `<div class="ex" data-p="${e.p.replace(/"/g, "&quot;")}"><b>${e.t}</b><span>${e.p.slice(0, 70)}…</span></div>`).join("");
    const gal = GALLERY.map(g => `<figure class="shot"><img loading="lazy" src="${g.src}" alt="${g.t}"/><figcaption><b>${g.t}</b><span>${g.s}</span></figcaption></figure>`).join("");
    $("#helpContent").innerHTML = `
      <span class="eyebrow">Anleitung</span>
      <h2>Interior Studio — so funktioniert's</h2>
      <p>Zwei Module: <b>Bilder erzeugen/redesignen</b> (Nano Banana) und die <b>Begehung</b> — ein 360°-Panorama, in dem man sich frei umsieht, mit klickbaren Möbel-Pins. Kein Server, kein Konto — dein Gemini-Key bleibt nur in deinem Browser.</p>

      <h3>Beispiele — direkt mit diesem Tool erzeugt</h3>
      <div class="ba">
        <figure class="shot ba-fig"><img loading="lazy" src="examples/before-empty.png" alt="Vorher: leerer Raum"/><figcaption><b>Vorher</b><span>Leeres Foto</span></figcaption></figure>
        <div class="ba-arrow" aria-hidden="true">→</div>
        <figure class="shot ba-fig"><img loading="lazy" src="examples/after-midcentury.png" alt="Nachher: Mid-Century redesignt"/><figcaption><b>Nachher</b><span>„Raum redesignen" · Mid-Century</span></figcaption></figure>
      </div>
      <p class="muted">Gleicher Raum, gleiche Kamera — Wände, Fenster und Boden bleiben, nur eingerichtet.</p>
      <div class="shots">${gal}</div>

      <h3>1) Einmal einrichten</h3>
      <ol><li>Oben rechts auf <b>🔑 Key</b>.</li><li>Key bei <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> holen, einfügen, speichern. (Bildgenerierung benötigt aktiviertes Billing im Google-Cloud-Projekt.)</li></ol>

      <h3>2) Bilder erzeugen oder Raum redesignen</h3>
      <p>Im <b>KI-Studio</b>: „Bild erzeugen" für neue Räume/Website-Bilder, oder „Raum redesignen" → eigenes Foto hochladen + Anweisung. Stil-Vorlagen anklicken, 🎤 zum Diktieren. Jedes Ergebnis hat einen Button <b>🧭 Als Begehung</b>.</p>
      <div class="ex-grid">${ex}</div>
      <p class="muted">Klick eine Vorlage, um sie ins Studio zu laden.</p>

      <h3>3) Begehung — im Raum umsehen</h3>
      <p>Im Tab <b>Begehung</b> einen <b>Panorama-Standort</b> erzeugen (aus Text, einem Raumfoto oder einem KI-Studio-Bild). Dann <b>ziehen zum Umsehen</b>, Scroll zum Zoomen, <b>↻ Auto-Drehung</b> für die Präsentation. Mit <b>＋ Nächster Standort</b> erzeugt Nano Banana eine konsistente Folge-Ansicht zum „Weitergehen". <b>⛶ Vollbild</b> für die volle Wirkung (Esc = raus).</p>

      <h3>4) Möbel verorten → Einkaufsliste</h3>
      <p><b>📍 Pin setzen</b> → ins Panorama tippen, wo ein Möbel steht → Produkt aus dem Katalog wählen. Es erscheint als Pin und als <b>Spec-Card</b> (Maße, Material, Farbe, Lieferant, Lieferzeit, Preis). „+ Einkaufsliste" summiert gegen dein <b>Budget</b> (Ampel).</p>

      <h3>Selber weiterbauen</h3>
      <ul>
        <li><code>catalog.js</code> — Möbel, Maße, Preise, Lieferanten (erscheinen im Produkt-Picker beim Pin-Setzen).</li>
        <li><code>catalog.js → STYLES</code> — eigene Stil-Vorlagen.</li>
        <li><code>tour.js</code> — Panorama-Begehung: Kugel-Mapping, Standort-Übergänge, Pins.</li>
        <li><code>banana.js</code> — Bild-API (Modell/Parameter); Panorama nutzt <code>aspectRatio 21:9</code>.</li>
      </ul>
      <div class="note">📦 <b>Auf USB weitergeben:</b> ganzen Ordner kopieren. Empfänger öffnet <code>index.html</code> (oder <code>START.command</code>/<code>START-Windows.bat</code>) im Chrome/Edge, trägt seinen eigenen Gemini-Key ein — fertig. (Internet nur für die Bildgenerierung nötig.)</div>`;
    $$("#helpContent .ex").forEach(c => c.onclick = () => { $("#prompt").value = c.dataset.p; showTab("studio"); $("#prompt").focus(); toast("Prompt geladen."); });
  }

  /* ---------- Init ---------- */
  $("#budgetIn").oninput = renderCart;
  if (window.Catalogs) {
    window.Catalogs.setQuotaHandler(() => toast("Speicher voll — Katalog nur für diese Sitzung gehalten.", "err"));
    window.Catalogs.onChange(renderCatList);
    window.Catalogs.loadBuiltins().then(renderCatList);
  }
  refreshKeyState(); renderHelp(); addVoice(); addFullscreen(); renderCart(); refreshStudioSrc(); renderProjects();
})();
