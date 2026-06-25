/* Projekt-Repository über window.Store — Projektbaum (Ordner + Projekte), persistent.
   - Bundle (Räume/Panoramen/Pins/Cart) liegt im Store "projects" unter seiner id.
   - Leichter Index + Ordner + aktuelle id liegen im Store "meta" (schnelles Baum-Rendern ohne alle Bundles zu laden).
   API: init, save(bundle), load(id), remove(id), startNew(), current(),
        addFolder/renameFolder/removeFolder, moveProject(id,folderId), tree(), onChange(fn). */
(function () {
  const IDX = "projectIndex", FLD = "folders", CUR = "currentId";
  let index = [];      // [{id, folderId, title, updatedAt, thumbnail, rooms}]
  let folders = [];    // [{id, name, parentId}]
  let currentId = null;
  const listeners = [];

  const emit = () => listeners.forEach(f => { try { f(); } catch (e) {} });
  const uid = p => p + "_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
  async function persistMeta() {
    await window.Store.put("meta", IDX, index);
    await window.Store.put("meta", FLD, folders);
    await window.Store.put("meta", CUR, currentId);
  }

  async function init() {
    try {
      index = (await window.Store.get("meta", IDX)) || [];
      folders = (await window.Store.get("meta", FLD)) || [];
      currentId = (await window.Store.get("meta", CUR)) || null;
    } catch (e) { index = []; folders = []; currentId = null; }
    emit();
  }

  async function save(bundle) {
    if (!bundle) return null;
    bundle.id = bundle.id || currentId || uid("prj");
    bundle.meta = bundle.meta || {};
    bundle.meta.updatedAt = new Date().toISOString();
    await window.Store.put("projects", bundle.id, bundle);
    const rec = {
      id: bundle.id,
      folderId: (index.find(r => r.id === bundle.id) || {}).folderId || null,
      title: bundle.meta.title || "Projekt",
      updatedAt: bundle.meta.updatedAt,
      thumbnail: bundle.meta.thumbnail || "",
      rooms: (bundle.nodes || []).length
    };
    const i = index.findIndex(r => r.id === bundle.id);
    if (i >= 0) index[i] = rec; else index.push(rec);
    currentId = bundle.id;
    await persistMeta();
    emit();
    return bundle.id;
  }

  async function load(id) {
    const b = await window.Store.get("projects", id);
    if (b) { currentId = id; await window.Store.put("meta", CUR, currentId); emit(); }
    return b;
  }

  async function remove(id) {
    await window.Store.del("projects", id);
    index = index.filter(r => r.id !== id);
    if (currentId === id) currentId = null;
    await persistMeta(); emit();
  }

  function startNew() { currentId = null; }   // nächster save() legt ein NEUES Projekt an

  function addFolder(name, parentId) {
    const f = { id: uid("fld"), name: name || "Ordner", parentId: parentId || null };
    folders.push(f); persistMeta(); emit(); return f.id;
  }
  function renameFolder(id, name) { const f = folders.find(x => x.id === id); if (f) { f.name = name || f.name; persistMeta(); emit(); } }
  function removeFolder(id) {
    folders = folders.filter(f => f.id !== id);
    index.forEach(r => { if (r.folderId === id) r.folderId = null; });   // Projekte nicht löschen, nur lösen
    persistMeta(); emit();
  }
  function moveProject(id, folderId) { const r = index.find(x => x.id === id); if (r) { r.folderId = folderId || null; persistMeta(); emit(); } }
  async function renameProject(id, title) {
    title = (title || "").trim(); if (!title) return;
    const r = index.find(x => x.id === id); if (r) r.title = title;
    const b = await window.Store.get("projects", id);
    if (b) { b.meta = b.meta || {}; b.meta.title = title; await window.Store.put("projects", id, b); }
    await persistMeta(); emit();
  }
  function isDescendant(folderId, candidateId) {           // ist candidate == folder oder darunter?
    let f = folders.find(x => x.id === candidateId);
    while (f) { if (f.id === folderId) return true; f = folders.find(x => x.id === f.parentId); }
    return false;
  }
  function reparentFolder(id, parentId) {
    if (id === parentId || (parentId && isDescendant(id, parentId))) return;   // kein Zyklus
    const f = folders.find(x => x.id === id); if (f) { f.parentId = parentId || null; persistMeta(); emit(); }
  }
  function moveNode(dragId, targetFolderId) {              // Drag&Drop: Ordner ODER Projekt verschieben
    if (folders.find(f => f.id === dragId)) reparentFolder(dragId, targetFolderId);
    else moveProject(dragId, targetFolderId);
  }

  window.Projects = {
    init, save, load, remove, startNew, current: () => currentId,
    addFolder, renameFolder, removeFolder, moveProject, renameProject, reparentFolder, moveNode,
    tree: () => ({ folders: folders.slice(), projects: index.slice() }),
    onChange: fn => { if (typeof fn === "function") listeners.push(fn); }
  };
})();
