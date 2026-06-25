/* Nano Banana (Gemini) Bildgenerierung im Browser — gleiche API wie generate.py.
   Key/Model kommen aus window.IS (App-State). Daten gehen NUR an Googles API. */
(function () {
  const HOST = "https://generativelanguage.googleapis.com/v1beta/models";

  // Datei -> {mime, base64} (ohne data:-Präfix)
  async function fileToInline(file) {
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { mime: file.type || "image/png", base64: btoa(bin) };
  }
  function dataUrlToInline(url) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(url);
    return m ? { mime: m[1], base64: m[2] } : null;
  }

  async function generate({ prompt, aspect = "1:1", resolution = "1K", images = [] }) {
    const key = (window.IS && window.IS.key || "").trim();
    if (!key) throw new Error("Kein API-Key. Trag ihn oben unter dem Schlüssel-Symbol ein.");
    const model = (window.IS && window.IS.model) || "gemini-3.1-flash-image-preview";

    const parts = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
    }
    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: aspect, imageSize: resolution }
      }
    };

    let resp;
    try {
      // Kein Content-Type-Header -> Browser sendet text/plain (CORS-safelisted) ->
      // kein Preflight -> funktioniert auch von file:// (USB-Stick). Gemini parst den JSON-Body.
      resp = await fetch(`${HOST}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error("Netzwerkfehler — Internet/Verbindung prüfen.");
    }
    if (!resp.ok) {
      let detail = "";
      try { const j = await resp.json(); detail = j.error && j.error.message || ""; } catch {}
      if (resp.status === 400 && /API key|API_KEY/i.test(detail)) throw new Error("Key ungültig. Prüfe ihn unter dem Schlüssel-Symbol.");
      if (resp.status === 404) throw new Error(`Modell „${model}\" nicht gefunden. Probiere gemini-3.1-flash-image-preview (unter dem Schlüssel-Symbol).`);
      if (resp.status === 429) throw new Error("Rate-Limit erreicht — kurz warten und erneut.");
      throw new Error(`API ${resp.status}: ${detail || "unbekannter Fehler"}`);
    }
    const json = await resp.json();
    let mime = "image/png", data = null, text = "";
    for (const c of (json.candidates || [])) {
      for (const p of ((c.content && c.content.parts) || [])) {
        if (p.inlineData) { mime = p.inlineData.mimeType || mime; data = p.inlineData.data; }
        else if (p.text) text += p.text;
      }
    }
    if (!data) {
      const block = json.promptFeedback && json.promptFeedback.blockReason;
      throw new Error(block ? `Anfrage blockiert (${block}). Prompt umformulieren.` : (text ? "Kein Bild — Modell sagte: " + text.slice(0, 120) : "Kein Bild erhalten."));
    }
    return { url: `data:${mime};base64,${data}`, text };
  }

  window.Banana = { generate, fileToInline, dataUrlToInline };
})();
