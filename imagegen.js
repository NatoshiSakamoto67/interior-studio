/* Bild-Engine-Weiche: Nano Banana (Gemini) oder ChatGPT (OpenAI) — BYOK.
   Einheitliche API für app.js; die Wahl steht in window.IS.imgProvider.
   Die Helfer fileToInline/dataUrlToInline sind provider-neutral (von Banana). */
(function () {
  function provider() { return (window.IS && window.IS.imgProvider) || "gemini"; }

  async function generate(opts) {
    if (provider() === "openai" && window.OpenAIImg) return window.OpenAIImg.generate(opts);
    return window.Banana.generate(opts);
  }
  function activeKeyOk() {
    return provider() === "openai" ? !!(window.IS && window.IS.okey) : !!(window.IS && window.IS.key);
  }
  function activeLabel() { return provider() === "openai" ? "ChatGPT (OpenAI)" : "Nano Banana (Gemini)"; }

  window.ImageGen = {
    generate, activeKeyOk, activeLabel, provider,
    fileToInline: (f) => window.Banana.fileToInline(f),
    dataUrlToInline: (u) => window.Banana.dataUrlToInline(u)
  };
})();
