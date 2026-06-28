/* Interior Studio — Startseite / „roter Faden".
 * Versteht eine freie Eingabe (Text + optional Datei) und leitet sie an das
 * richtige Werkzeug weiter. Hängt an der schmalen Brücke window.Studio (app.js).
 * Routing ist DETERMINISTISCH (Dateityp + Stichworte) — kein Extra-API-Aufruf,
 * also sofort, kostenlos und vorhersehbar. Bei mehrdeutigem Bild fragt es nach.
 */
(function () {
  const S = window.Studio;
  if (!S) return;   // ohne Brücke (z. B. Build-Fehler) bleibt die App über die Werkzeuge nutzbar
  const $ = (s, r = document) => r.querySelector(s);
  const esc = S.esc, I = (n, o) => S.icon(n, o);

  const els = {
    form: $("#composer"), box: $("#composerBox"), text: $("#askText"), file: $("#askFile"),
    attach: $("#composerAttach"), thread: $("#homeThread")
  };
  if (!els.form || !els.text) return;
  const DEFAULT_PH = els.text.getAttribute("placeholder") || "";

  let attached = null;      // { file, kind:'image'|'dxf'|'ifc', inline?, url? }
  let forcedIntent = null;  // 'image' | 'apartment' — von den Schnell-Türen gesetzt

  /* ===================== Verlauf (der rote Faden) ===================== */
  function bubble(html, who) {
    els.thread.hidden = false;
    const m = document.createElement("div");
    m.className = "home-msg " + (who || "bot");
    if (html) m.innerHTML = html;
    els.thread.appendChild(m);
    m.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return m;
  }
  function busy(text) { return bubble(I("loader-circle", { cls: "spin" }) + " " + esc(text), "bot busy"); }
  function fail(node, msg) { node.className = "home-msg bot err"; node.textContent = msg || "Fehler"; }

  // Aktionsknöpfe als „nächster Schritt": [{label, icon, accent, onClick}]
  function actions(list) {
    const wrap = document.createElement("div"); wrap.className = "home-actions";
    list.forEach(a => {
      const b = document.createElement("button"); b.type = "button";
      b.className = "btn " + (a.accent ? "btn-accent" : "btn-ghost");
      b.innerHTML = (a.icon ? I(a.icon) + " " : "") + esc(a.label);
      b.onclick = a.onClick; wrap.appendChild(b);
    });
    return wrap;
  }
  function step(text, list) { const m = bubble(esc(text), "bot"); m.appendChild(actions(list)); return m; }

  function resultImage(url, prompt) {
    const card = document.createElement("div"); card.className = "home-card";
    const img = new Image(); img.src = url; img.alt = "Ergebnis"; img.loading = "lazy";
    const acts = document.createElement("div"); acts.className = "home-card-acts";
    const walk = document.createElement("button"); walk.type = "button"; walk.className = "btn btn-accent";
    walk.innerHTML = I("compass") + " Begehen"; walk.onclick = () => S.startTourFromImage(url, prompt);
    const dl = document.createElement("a"); dl.className = "btn btn-ghost"; dl.download = "interior.png";
    dl.href = /^data:image\//.test(url) ? url : "#"; dl.innerHTML = I("download") + " Bild";
    acts.append(walk, dl); card.append(img, acts);
    return card;
  }

  function echoUser(text, a) {
    const m = bubble("", "me");
    if (a && a.url) { const im = new Image(); im.className = "msg-thumb"; im.src = a.url; m.appendChild(im); }
    else if (a) { const c = document.createElement("span"); c.className = "msg-file"; c.innerHTML = I("file") + " " + esc(a.file.name || a.kind.toUpperCase()); m.appendChild(c); }
    if (text) { const t = document.createElement("span"); t.textContent = text; m.appendChild(t); }
    else if (a && a.url) { const t = document.createElement("span"); t.className = "muted"; t.textContent = "Bild angehängt"; m.appendChild(t); }
  }
  function echoChoice(text) { bubble(esc(text), "me"); }

  /* ===================== Stichwort-Router ===================== */
  const RE_APT = /\b(wohnung(?:en)?|appartement|apartment|etage|geschoss|stockwerk|grundriss|haus|büro(?:etage)?|praxis|loft|maisonette|\d+\s*-?\s*zimmer|zimmerwohnung|nachbau|nachbauen|begehbar|rundgang|alle r[äa]ume|mehrere r[äa]ume|jeder raum)\b/i;
  const RE_REDESIGN = /\b(redesign|umgestalt|umbau|neu einrichten|einrichten|restyle|m[öo]blier|staging|homestaging|dieser raum|diesen raum|mein (?:zimmer|raum|wohnzimmer|schlafzimmer))\b/i;
  const looksApartment = t => RE_APT.test(t || "");
  const looksRedesign = t => RE_REDESIGN.test(t || "");

  function redesignPrompt(t) {
    const base = "Redesign and refurnish this room like a professional interior designer. Keep the existing architecture, windows, doors and camera perspective; only restyle and furnish. Photorealistic interior photography.";
    return (t && t.trim()) ? base + " Direction: " + t.trim() + "." : base;
  }

  /* ===================== Aktionen ===================== */
  function needKey(which, hint) {
    const what = which === "gemini" ? "den <b>Gemini-Schlüssel</b> (für die Bilder)"
      : which === "claude" ? "den <b>Claude-Schlüssel</b>"
      : "die <b>Gemini- und Claude-Schlüssel</b>";
    const m = bubble((hint ? esc(hint) + " " : "") + "Dafür brauchst du " + what + ". Beide bleiben nur lokal in deinem Browser — danach einfach nochmal absenden.", "bot");
    m.appendChild(actions([
      { label: "Schlüssel eintragen", icon: "key", accent: true, onClick: () => S.openKey() },
      { label: "Stattdessen Demo begehen", icon: "play", onClick: () => S.loadDemo() }
    ]));
  }

  async function doImage(prompt, refInline) {
    if (!S.hasGemini()) return needKey("gemini");
    const b = busy(refInline ? "Ich gestalte den Raum um …" : "Ich erzeuge dein Stil-Bild …");
    try {
      const res = await S.generate({
        prompt: refInline ? redesignPrompt(prompt) : prompt,
        aspect: "16:9", resolution: "2K", images: refInline ? [refInline] : []
      });
      b.remove();
      const m = bubble(I("sparkles") + " Fertig — hier ist dein Raum:", "bot");
      m.appendChild(resultImage(res.url, prompt));
      S.addToGallery(res.url, refInline ? "redesign" : "bild", prompt);
      step("Wie weiter?", [
        { label: "Begehbar machen", icon: "compass", accent: true, onClick: () => S.startTourFromImage(res.url, prompt) },
        { label: "Noch eine Variante", icon: "rotate-cw", onClick: () => doImage(prompt, refInline) }
      ]);
    } catch (e) { fail(b, e.message); }
  }

  function doApartment(text, planInline) {
    if (!S.hasClaude() || !S.hasGemini()) {
      const which = !S.hasClaude() && !S.hasGemini() ? "both" : (!S.hasClaude() ? "claude" : "gemini");
      return needKey(which);
    }
    bubble(I("building-2") + " Alles klar — ich lese den Plan, lege die Räume an und rendere jeden Raum. Den Fortschritt siehst du oben; am Ende landest du direkt in der Begehung.", "bot");
    S.buildApartment(text, planInline || null);
  }

  // Datei an ein verstecktes Werkzeug-Eingabefeld übergeben und dessen change-Handler auslösen.
  function handTo(sel, file) {
    const inp = document.querySelector(sel); if (!inp) return false;
    try { const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); return true; }
    catch { return false; }
  }
  function handPrecise(file, sel, label) {
    bubble(I("ruler") + " Eine " + esc(label) + " — daraus baue ich ein <b>millimetergenaues</b> Modell. Ich öffne den Bereich <b>Welt 3D · Maß-Modell</b> …", "bot");
    S.showTab("world");
    setTimeout(() => { if (!handTo(sel, file)) S.toast("Bitte die Datei im Maß-Modell-Bereich auswählen.", "err"); }, 150);
  }

  function askImageKind(text, inline) {
    const m = bubble("Ich sehe ein Bild. Ist das ein <b>Grundriss</b> (dann baue ich daraus die Wohnung) oder ein <b>Raumfoto</b> (dann gestalte ich es um)?", "bot");
    m.appendChild(actions([
      { label: "Grundriss → Wohnung bauen", icon: "building-2", accent: true, onClick: () => { echoChoice("Das ist ein Grundriss."); doApartment(text, inline); } },
      { label: "Raumfoto → umgestalten", icon: "palette", onClick: () => { echoChoice("Das ist ein Raumfoto."); doImage(text, inline); } }
    ]));
  }

  /* ===================== Eingang ===================== */
  function route() {
    const text = els.text.value.trim();
    const a = attached;
    if (!text && !a) { els.text.focus(); return; }
    echoUser(text, a);
    els.text.value = ""; clearAttach();
    const intent = forcedIntent; forcedIntent = null; resetDoors();

    if (a && a.kind === "dxf") return handPrecise(a.file, "#cadFile", "CAD-Datei (.dxf)");
    if (a && a.kind === "ifc") return handPrecise(a.file, "#ifcFile", "IFC-Datei (.ifc)");
    if (a && a.kind === "image") {
      if (intent === "apartment" || looksApartment(text)) return doApartment(text, a.inline);
      if (intent === "image" || looksRedesign(text)) return doImage(text, a.inline);
      return askImageKind(text, a.inline);   // sonst nachfragen statt raten
    }
    // Nur Text
    if (intent === "apartment" || looksApartment(text)) return doApartment(text, null);
    return doImage(text, null);
  }

  /* ===================== Anhang ===================== */
  async function setAttached(f) {
    const name = (f.name || "").toLowerCase();
    let kind = "image";
    if (name.endsWith(".dxf")) kind = "dxf";
    else if (name.endsWith(".ifc")) kind = "ifc";
    else if (!/^image\//.test(f.type)) { S.toast("Nur Bilder, .dxf oder .ifc anhängen.", "err"); return; }
    attached = { file: f, kind };
    if (kind === "image") {
      attached.inline = await S.fileToInline(f);
      attached.url = `data:${attached.inline.mime};base64,${attached.inline.base64}`;
    }
    renderAttach();
  }
  function renderAttach() {
    els.attach.innerHTML = "";
    if (!attached) { els.attach.hidden = true; return; }
    els.attach.hidden = false;
    const chip = document.createElement("span"); chip.className = "attach-chip";
    if (attached.url) { const im = new Image(); im.src = attached.url; chip.appendChild(im); }
    else { const ic = document.createElement("span"); ic.className = "attach-ic"; ic.innerHTML = I("ruler"); chip.appendChild(ic); }
    const label = attached.kind === "image" ? "Bild / Grundriss" : attached.kind.toUpperCase() + "-Datei";
    const tx = document.createElement("span"); tx.className = "attach-name"; tx.textContent = label + " · " + (attached.file.name || ""); chip.appendChild(tx);
    const x = document.createElement("button"); x.type = "button"; x.className = "attach-x"; x.setAttribute("aria-label", "Anhang entfernen"); x.innerHTML = I("x"); x.onclick = clearAttach;
    chip.appendChild(x); els.attach.appendChild(chip);
  }
  function clearAttach() { attached = null; renderAttach(); }

  els.file.onchange = async () => { const f = els.file.files[0]; if (f) await setAttached(f); els.file.value = ""; };

  // Datei direkt in den Kasten ziehen
  if (els.box) {
    ["dragenter", "dragover"].forEach(ev => els.box.addEventListener(ev, e => { e.preventDefault(); els.box.classList.add("is-drag"); }));
    els.box.addEventListener("dragleave", e => { if (!els.box.contains(e.relatedTarget)) els.box.classList.remove("is-drag"); });
    els.box.addEventListener("drop", async e => { e.preventDefault(); els.box.classList.remove("is-drag"); const f = e.dataTransfer.files[0]; if (f) await setAttached(f); });
  }

  /* ===================== Schnell-Türen ===================== */
  function setActiveDoor(d) { document.querySelectorAll(".door").forEach(x => x.classList.toggle("is-active", x === d)); }
  function resetDoors() { document.querySelectorAll(".door").forEach(x => x.classList.remove("is-active")); els.text.placeholder = DEFAULT_PH; }
  document.querySelectorAll(".door").forEach(d => d.onclick = () => {
    const k = d.dataset.door;
    if (k === "demo") return S.loadDemo();
    forcedIntent = (k === "apartment") ? "apartment" : "image";
    setActiveDoor(d);
    els.text.placeholder = (k === "apartment")
      ? "Beschreibe die Wohnung — oder häng den Grundriss an und schreib ‚bau das nach‘ …"
      : "Beschreibe den Raum, den du sehen willst — oder häng ein Foto zum Umgestalten an …";
    els.text.focus();
  });

  /* ===================== Absenden ===================== */
  els.form.addEventListener("submit", e => { e.preventDefault(); route(); });
  els.text.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); route(); } });
})();
