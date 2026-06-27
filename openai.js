/* ChatGPT / OpenAI Bildgenerierung (gpt-image-1) im Browser — BYOK.
   OpenAI erlaubt Browser-CORS (Access-Control-Allow-Origin: *), also direkt aufrufbar
   wie Gemini — kein Backend nötig, läuft auch von file://. Rückgabe identisch zu
   Banana.generate: { url, text }. Key/Model aus window.IS (okey/omodel). */
(function () {
  const GEN = "https://api.openai.com/v1/images/generations";
  const EDIT = "https://api.openai.com/v1/images/edits";

  // Bildverhältnis -> erlaubte gpt-image-1-Größe (1024² · 1536×1024 quer · 1024×1536 hoch)
  function sizeFor(aspect) {
    const m = /^(\d+):(\d+)$/.exec(String(aspect || "1:1"));
    const r = m ? (+m[1] / +m[2]) : 1;
    if (r >= 1.2) return "1536x1024";
    if (r <= 0.83) return "1024x1536";
    return "1024x1024";
  }
  function qualityFor(res) { return res === "1K" ? "low" : res === "4K" ? "high" : "medium"; }

  function inlineToBlob(inline) {
    const bin = atob(inline.base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: inline.mime || "image/png" });
  }

  async function parseErr(resp) {
    let detail = "";
    try { const j = await resp.json(); detail = (j.error && j.error.message) || ""; } catch {}
    if (resp.status === 401) return "OpenAI-Key ungültig. Prüfe ihn unter dem Schlüssel-Symbol.";
    if (resp.status === 429) return "OpenAI: Rate-Limit oder Guthaben aufgebraucht — kurz warten / Billing prüfen.";
    if (resp.status === 403) return "OpenAI: Zugriff verweigert (für gpt-image-1 ist evtl. eine Org-Verifizierung nötig).";
    if (resp.status === 400 && /content|safety|moderation/i.test(detail)) return "OpenAI hat den Prompt abgelehnt (Inhaltsfilter). Umformulieren.";
    return `OpenAI ${resp.status}: ${detail || "unbekannter Fehler"}`;
  }

  async function generate({ prompt, aspect = "1:1", resolution = "2K", images = [] }) {
    const key = ((window.IS && window.IS.okey) || "").trim();
    if (!key) throw new Error("Kein OpenAI-Key. Trag ihn oben unter dem Schlüssel-Symbol ein.");
    const model = (window.IS && window.IS.omodel) || "gpt-image-1";
    const size = sizeFor(aspect), quality = qualityFor(resolution);

    let resp;
    try {
      if (images && images.length) {
        // Redesign / Vorlage -> images/edits (multipart, gpt-image-1 versteht Bild-Eingabe)
        const fd = new FormData();
        fd.append("model", model);
        fd.append("prompt", prompt);
        fd.append("size", size);
        fd.append("quality", quality);
        fd.append("n", "1");
        fd.append("image", inlineToBlob(images[0]), "vorlage.png");
        resp = await fetch(EDIT, { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd });
      } else {
        resp = await fetch(GEN, {
          method: "POST",
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, size, quality, n: 1 })
        });
      }
    } catch (e) {
      throw new Error("Netzwerkfehler — Internet/Verbindung prüfen.");
    }
    if (!resp.ok) throw new Error(await parseErr(resp));

    const json = await resp.json();
    const b64 = json && json.data && json.data[0] && json.data[0].b64_json;
    if (!b64) throw new Error("Kein Bild von OpenAI erhalten.");
    return { url: "data:image/png;base64," + b64, text: "" };
  }

  window.OpenAIImg = { generate };
})();
