/* Katalog-Subsystem — offenes Importformat (JSON/CSV) + Beispielkataloge.
   Mehrere Kataloge gleichzeitig, aktiv/inaktiv, Suche/Filter. Aktive Artikel
   landen gemerged in window.CATALOG (kompatibel mit Picker/Spec-Card/Einkaufsliste).
   KEINE proprietären Herstellerdaten im Repo — Markennamen nur durch Nutzer-Import. */
(function () {
  const KEY = "is_catalogs";
  const BUILTINS = ["wohnen-basis", "wand-oberflaeche", "aquaristik-basis"];
  let catalogs = [];            // {id,name,publisher,license,source,currency,items[],enabled,builtin}
  const listeners = [];
  let onQuota = null;           // Callback bei localStorage-Quota (App zeigt Toast)

  /* ---------- Helfer ---------- */
  const slug = s => String(s || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
  function domain(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } }
  function sanitizeUrl(u) { if (!u) return ""; return /^https?:\/\//i.test(u) ? u : ""; }
  function sanitizeImg(u) { if (!u) return ""; return /^(https?:\/\/|data:image\/)/i.test(u) ? u : ""; }
  function num(v) { const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; }
  function dims(m) {
    const ns = String(m || "").match(/\d+(?:[.,]\d+)?/g);
    if (ns && ns.length >= 3) return { w: num(ns[0]), d: num(ns[1]), h: num(ns[2]) };
    return { w: "—", d: "—", h: "—" };
  }

  function normalizeItem(raw, cat, i) {
    const id = raw.id || slug(raw.name) || ("item-" + i);
    const dm = dims(raw["maße"] || raw.masse || raw.dim);
    const brand = raw.hersteller || raw.brand || "";
    const props = Array.isArray(raw.props) ? raw.props : (raw.props ? String(raw.props).split(/\s*[;|]\s*/).filter(Boolean) : []);
    return {
      id, gid: cat.id + ":" + id,
      name: raw.name || id,
      cat: raw.kategorie || raw.cat || "Sonstiges",
      brand,
      supplier: raw.lieferant || raw.supplier || domain(raw.produkt_url) || brand || "—",
      price: num(raw.preis != null ? raw.preis : raw.price),
      currency: cat.currency || raw["währung"] || "EUR",
      priceUnit: (raw.preisEinheit || raw.priceUnit || "stk").toLowerCase(),
      w: dm.w, d: dm.d, h: dm.h, maße: raw["maße"] || raw.masse || "",
      material: raw.material || "—",
      color: raw.farbe || raw.color || "#9a8c7a",
      lead: raw.lieferzeit || raw.lead || "—",
      props,
      tag: raw.tag || (slug(raw.kategorie || "ff").slice(0, 2).toUpperCase() + "-" + String(i + 1).padStart(2, "0")),
      status: raw.status || "Vorschlag",
      kind: raw.kind || "",
      produkt_url: sanitizeUrl(raw.produkt_url || raw.url),
      bild: sanitizeImg(raw.bild || raw.image),
      catalogId: cat.id, catalogName: cat.name
    };
  }

  function normalizeCatalog(env, builtin) {
    if (!env || env.schema !== "interior-studio.catalog/v1" || !Array.isArray(env.items))
      throw new Error("Ungültiges Katalog-Format (schema/items fehlt).");
    const cat = {
      id: env.id || slug(env.name) || ("kat-" + Date.now()),
      name: env.name || "Katalog", publisher: env.publisher || "", license: env.license || "—",
      source: env.source || "", currency: env.currency || "EUR", enabled: true, builtin: !!builtin
    };
    cat.items = env.items.map((r, i) => normalizeItem(r, cat, i));
    return cat;
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return { schema: "interior-studio.catalog/v1", items: [] };
    const sep = lines[0].includes(";") ? ";" : ",";
    const head = lines[0].split(sep).map(h => h.trim());
    const items = lines.slice(1).map(l => {
      const cells = l.split(sep); const o = {};
      head.forEach((h, i) => { o[h] = (cells[i] || "").trim(); });
      return o;
    });
    return { schema: "interior-studio.catalog/v1", id: "import-" + Date.now(), name: "Importierter Katalog (CSV)", items };
  }

  /* ---------- Persistenz (nur Nutzer-Kataloge; Builtins kommen aus Dateien) ---------- */
  function persist() {
    const user = catalogs.filter(c => !c.builtin).map(c => ({
      id: c.id, name: c.name, publisher: c.publisher, license: c.license, source: c.source,
      currency: c.currency, enabled: c.enabled, items: c.items
    }));
    try { localStorage.setItem(KEY, JSON.stringify(user)); }
    catch (e) { onQuota && onQuota(); }
  }
  function loadPersisted() {
    let raw; try { raw = localStorage.getItem(KEY); } catch { return; }
    if (!raw) return;
    try {
      JSON.parse(raw).forEach(c => {
        c.builtin = false; if (!catalogs.find(x => x.id === c.id)) catalogs.push(c);
      });
    } catch {}
  }

  /* ---------- aktiver Merge → window.CATALOG ---------- */
  function rebuild() {
    const merged = [];
    catalogs.filter(c => c.enabled).forEach(c => c.items.forEach(it => merged.push(it)));
    window.CATALOG = merged;
    listeners.forEach(fn => { try { fn(); } catch {} });
  }

  /* ---------- API ---------- */
  async function loadBuiltins() {
    const inj = window.__IS_BUILTIN_CATALOGS__;   // vom Einzeldatei-Build injiziert (fetch scheitert unter file://)
    for (const id of BUILTINS) {
      try {
        let env = inj && inj[id];
        if (!env) {
          const r = await fetch("examples/catalogs/" + id + ".json");
          if (!r.ok) continue;
          env = await r.json();
        }
        const cat = normalizeCatalog(env, true);
        if (!catalogs.find(c => c.id === cat.id)) catalogs.push(cat);
      } catch {}
    }
    loadPersisted();
    rebuild();
  }
  async function importFiles(fileList) {
    const added = [];
    for (const f of Array.from(fileList || [])) {
      const text = await f.text();
      let env;
      try { env = f.name.toLowerCase().endsWith(".csv") ? parseCSV(text) : JSON.parse(text); }
      catch { throw new Error(`„${f.name}" ist kein gültiges JSON/CSV.`); }
      const cat = normalizeCatalog(env, false);
      const ex = catalogs.findIndex(c => c.id === cat.id);
      if (ex >= 0) catalogs[ex] = cat; else catalogs.push(cat);
      added.push(cat);
    }
    persist(); rebuild();
    return added;
  }
  function setEnabled(id, on) { const c = catalogs.find(x => x.id === id); if (c) { c.enabled = on; persist(); rebuild(); } }
  function remove(id) { catalogs = catalogs.filter(c => c.id !== id); persist(); rebuild(); }
  function list() { return catalogs.map(c => ({ id: c.id, name: c.name, license: c.license, publisher: c.publisher, count: c.items.length, enabled: c.enabled, builtin: c.builtin })); }
  function categories() { const s = new Set(); (window.CATALOG || []).forEach(i => s.add(i.cat)); return Array.from(s).sort(); }
  function byGid(gid) { return (window.CATALOG || []).find(i => i.gid === gid); }
  function query(q = {}) {
    const t = (q.text || "").trim().toLowerCase();
    return (window.CATALOG || []).filter(i =>
      (!q.kategorie || i.cat === q.kategorie) &&
      (!q.katalogId || i.catalogId === q.katalogId) &&
      (!t || (i.name + " " + i.brand + " " + i.cat + " " + (i.tags || []).join(" ")).toLowerCase().includes(t))
    );
  }
  function onChange(fn) { listeners.push(fn); }
  function setQuotaHandler(fn) { onQuota = fn; }

  window.Catalogs = { loadBuiltins, importFiles, setEnabled, remove, list, categories, query, byGid, onChange, setQuotaHandler };
})();
