/* Mediengalerie über window.Store — jedes erzeugte Bild persistent (Thumbnail + komprimiertes Vollbild).
   localhost: bleibt erhalten. file:// (Einzeldatei): Session-Fallback.
   Record: {id, kind:"bild"|"redesign"|"panorama", prompt, thumb, full, projectId, createdAt}. */
(function () {
  const listeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) {} });
  const uid = () => "img_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);

  async function add(rec) {
    if (!rec || !rec.full) return null;
    rec.id = rec.id || uid();
    rec.createdAt = rec.createdAt || new Date().toISOString();
    await window.Store.put("gallery", rec.id, rec);
    emit();
    return rec.id;
  }
  async function list() {
    const all = (await window.Store.getAll("gallery")) || [];
    return all.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
  async function get(id) { return window.Store.get("gallery", id); }
  async function remove(id) { await window.Store.del("gallery", id); emit(); }

  window.Gallery = { add, list, get, remove, onChange: fn => { if (typeof fn === "function") listeners.push(fn); } };
})();
