/* Claude als Gehirn — Browser-API (BYOK). Liest Grundrisse, plant die Wohnung,
   beurteilt Bilder. Direkter Browser-Aufruf via anthropic-dangerous-direct-browser-access.
   Key/Modell aus window.IS (ckey/cmodel). Daten gehen nur an api.anthropic.com. */
(function () {
  const URL = "https://api.anthropic.com/v1/messages";

  function img(part) { return { type: "image", source: { type: "base64", media_type: part.mime, data: part.base64 } }; }

  async function call({ system, content, maxTokens = 4096 }) {
    const key = (window.IS && window.IS.ckey || "").trim();
    if (!key) throw new Error("Kein Claude-Key. Trag ihn oben unter dem Schlüssel-Symbol ein.");
    const model = (window.IS && window.IS.cmodel) || "claude-opus-4-8";
    const body = { model, max_tokens: maxTokens, messages: [{ role: "user", content }] };
    if (system) body.system = system;
    let resp;
    try {
      resp = await fetch(URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": key,
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body)
      });
    } catch (e) { throw new Error("Netzwerkfehler zu Claude — Verbindung prüfen."); }
    if (!resp.ok) {
      let detail = ""; try { const j = await resp.json(); detail = j.error && j.error.message || ""; } catch {}
      if (resp.status === 401) throw new Error("Claude-Key ungültig. Prüfe ihn unter dem Schlüssel-Symbol.");
      if (resp.status === 429) throw new Error("Claude-Rate-Limit — kurz warten.");
      throw new Error("Claude " + resp.status + ": " + (detail || "Fehler"));
    }
    const j = await resp.json();
    return (j.content || []).filter(p => p.type === "text").map(p => p.text).join("");
  }

  // freier Chat-Turn (Text + optional Grundrissbild)
  function content(text, image) {
    const c = []; if (image) c.push(img(image)); if (text) c.push({ type: "text", text }); return c;
  }

  // robustes JSON aus Claude-Antwort ziehen (auch wenn in ```json gewrappt)
  function parseJSON(txt) {
    let s = txt.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    else { const i = s.indexOf("{"), j = s.lastIndexOf("}"); if (i >= 0 && j > i) s = s.slice(i, j + 1); }
    return JSON.parse(s);
  }

  window.Claude = { call, content, parseJSON };
})();
