/* Projekt-Persistenz — offenes .studio.json-Bundle (selbsttragend, wieder-öffenbar).
   Bilder werden für den Export auf JPEG komprimiert (Equirect verträgt es, ~70% kleiner).
   Speichern/Laden rein clientseitig (Download/Upload) — kein Server. */
(function () {
  // Bild (data:-URL oder lokaler Pfad) → komprimierte JPEG-data:-URL
  function compressImg(url, max = 1600, q = 0.82) {
    return new Promise(res => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => {
        let w = im.naturalWidth, h = im.naturalHeight;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        try { c.getContext("2d").drawImage(im, 0, 0, w, h); res(c.toDataURL("image/jpeg", q)); }
        catch (e) { res(url); }
      };
      im.onerror = () => res(url);
      im.src = url;
    });
  }
  function thumb(url) { return compressImg(url, 240, 0.6); }

  function download(name, text) {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function pickFile() {
    return new Promise((res, rej) => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".json,.studio.json,application/json";
      inp.onchange = () => { const f = inp.files[0]; if (!f) return rej(new Error("Keine Datei gewählt.")); f.text().then(res).catch(rej); };
      inp.click();
    });
  }

  window.Project = { compressImg, thumb, download, pickFile };
})();
