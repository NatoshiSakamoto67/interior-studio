/* Persistenz-Fundament — IndexedDB (Bilder/Bundles vertragen MBs, anders als localStorage).
   localhost/http: voll persistent. file:// in Safari: IndexedDB teils gesperrt → Fallback auf
   Session-Memory (App läuft weiter; dauerhaft sichern dann via Export .studio.json).
   API (alle Promise-basiert): Store.put/get/getAll/del(storeName, key, val), Store.persistent(). */
(function () {
  const DB = "interior-studio", VER = 1, STORES = ["projects", "gallery", "meta"];
  let dbp = null, mem = null, usingMem = false;

  function memDB() { if (!mem) mem = { projects: {}, gallery: {}, meta: {} }; return mem; }

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      let req;
      try { req = indexedDB.open(DB, VER); }
      catch (e) { usingMem = true; return res(null); }
      req.onupgradeneeded = () => {
        const d = req.result;
        STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => { usingMem = true; res(null); };   // z. B. file:// in Safari
    });
    return dbp;
  }

  async function os(store, mode) {
    const db = await open();
    if (!db || usingMem) return null;   // sobald EIN Write in den Memory-Fallback ging, ALLES aus Memory lesen (kein Split-State → kein stiller Daten-Rückfall)
    try { return db.transaction(store, mode).objectStore(store); }
    catch (e) { usingMem = true; return null; }
  }

  function wrap(req) {
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  }

  const Store = {
    persistent: () => !usingMem,
    async put(store, key, val) {
      const o = await os(store, "readwrite");
      if (!o) { memDB()[store][key] = val; return; }
      try { return await wrap(o.put(val, key)); }
      catch (e) { usingMem = true; memDB()[store][key] = val; }
    },
    async get(store, key) {
      const o = await os(store, "readonly");
      if (!o) return memDB()[store][key];
      try { return await wrap(o.get(key)); } catch (e) { return memDB()[store][key]; }
    },
    async getAll(store) {
      const o = await os(store, "readonly");
      if (!o) return Object.values(memDB()[store]);
      try { return (await wrap(o.getAll())) || []; } catch (e) { return Object.values(memDB()[store]); }
    },
    async del(store, key) {
      const o = await os(store, "readwrite");
      if (!o) { delete memDB()[store][key]; return; }
      try { return await wrap(o.delete(key)); } catch (e) { delete memDB()[store][key]; }
    }
  };
  window.Store = Store;
})();
