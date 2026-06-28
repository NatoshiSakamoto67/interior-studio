/* Interior Studio — Unterlagen-Reiter (Projekt-Dossier).
   Liest window.DOCS (aus docs-data.js, generiert von tools/build-docs.py) und rendert
   die Markdown-Quellen lesbar — komplett offline, file://-fest (kein fetch).
   Der Markdown→HTML-Renderer ist bewusst escape-first (XSS-sicher): jeder Text wird
   zuerst HTML-escaped, erst danach werden die erlaubten Markdown-Tags erzeugt.
   API: window.Docs.render() · open(id) · mdToHtml(md). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const Icons = window.Icons || { svg: () => "" };
  const LS = "is_docs_last";
  let built = false, current = null;

  /* ---------- Sicherheit ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function sanitizeUrl(u) {
    const t = String(u || "").trim();
    if (/^(https?:|mailto:)/i.test(t)) return t;
    if (t.charAt(0) === "#") return t;
    return null;
  }

  /* ---------- Markdown (subset, escape-first) ---------- */
  function inline(text) {
    // Code-Spans als eigene Segmente heraussplitten (kein Sentinel nötig → robust):
    // `code` bleibt unangetastet, alles andere bekommt die Inline-Markdown-Behandlung.
    return String(text == null ? "" : text).split(/(`[^`]+`)/g).map(seg => {
      if (seg.length > 1 && seg.charAt(0) === "`" && seg.charAt(seg.length - 1) === "`")
        return `<code>${esc(seg.slice(1, -1))}</code>`;
      let s = esc(seg);
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
        const url = sanitizeUrl(u);
        return url ? `<a href="${url}" target="_blank" rel="noopener nofollow">${t}</a>` : m;
      });
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      // einfaches *kursiv* — bewusst KEIN _, sonst zerlegt es snake_case-Bezeichner
      s = s.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1<em>$2</em>");
      return s;
    }).join("");
  }

  function mdToHtml(md) {
    const lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
    const out = [], headings = [], slugCount = {};
    function slug(t) {
      let base = t.toLowerCase().replace(/[^\wÀ-ɏ]+/g, "-").replace(/^-+|-+$/g, "") || "abschnitt";
      if (slugCount[base] != null) { slugCount[base]++; base = base + "-" + slugCount[base]; } else slugCount[base] = 0;
      return base;
    }
    const parseRow = r => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^```(.*)$/);
      if (fence) {
        const lang = fence[1].trim(), buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push(`<pre class="md-pre"><code${lang ? ` data-lang="${esc(lang)}"` : ""}>${esc(buf.join("\n"))}</code></pre>`);
        continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const lvl = h[1].length, txt = h[2].trim();
        const id = slug(txt.replace(/[*`#\[\]]/g, ""));
        headings.push({ level: lvl, text: txt.replace(/[*`#]/g, "").trim(), id });
        out.push(`<h${lvl} id="${id}" class="md-h md-h${lvl}">${inline(txt)}</h${lvl}>`);
        i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr class="md-hr"/>'); i++; continue; }
      // Tabelle: aktuelle Zeile hat |, nächste ist Trennzeile mit ---
      if (line.indexOf("|") >= 0 && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        const header = parseRow(line); i += 2;
        const rows = [];
        while (i < lines.length && lines[i].indexOf("|") >= 0 && !/^\s*$/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
        let t = '<div class="md-tablewrap"><table class="md-table"><thead><tr>' + header.map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
        for (const r of rows) t += "<tr>" + header.map((_, k) => `<td>${inline(r[k] != null ? r[k] : "")}</td>`).join("") + "</tr>";
        out.push(t + "</tbody></table></div>"); continue;
      }
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        out.push(`<blockquote class="md-quote">${mdToHtml(buf.join("\n")).html}</blockquote>`); continue;
      }
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\.\s+/.test(line), items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          let item = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""); i++;
          while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) && !/^```/.test(lines[i])) { item += " " + lines[i].trim(); i++; }
          items.push(item);
        }
        const tag = ordered ? "ol" : "ul";
        out.push(`<${tag} class="md-list">` + items.map(it => `<li>${inline(it)}</li>`).join("") + `</${tag}>`); continue;
      }
      const buf = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) && !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      out.push(`<p class="md-p">${inline(buf.join(" "))}</p>`);
    }
    return { html: out.join("\n"), headings };
  }

  /* ---------- Persistenz (defensiv, file://-fest) ---------- */
  function lastId() { try { return localStorage.getItem(LS); } catch { return null; } }
  function saveLast(id) { try { localStorage.setItem(LS, id); } catch {} }

  /* ---------- UI ---------- */
  function groups() {
    const docs = window.DOCS || [], order = [], map = {};
    docs.forEach(d => { if (!map[d.category]) { map[d.category] = []; order.push(d.category); } map[d.category].push(d); });
    return order.map(cat => ({ cat, docs: map[cat] }));
  }

  function buildShell() {
    const root = $("#docsRoot"); if (!root) return;
    const docs = window.DOCS || [];
    if (!docs.length) { root.innerHTML = '<div class="docs-empty">Keine Unterlagen gefunden — mit <code>python3 tools/build-docs.py</code> erzeugen.</div>'; return; }
    const nav = groups().map(g => `
      <div class="docs-cat"><span class="docs-cat-h">${esc(g.cat)}</span>
        ${g.docs.map(d => `<button class="docs-item" type="button" data-id="${esc(d.id)}">
            <span class="docs-item-ic">${Icons.svg(d.icon) || ""}</span>
            <span class="docs-item-txt"><b>${esc(d.title)}</b><span>${esc(d.blurb || "")}</span></span>
          </button>`).join("")}
      </div>`).join("");
    root.innerHTML = `
      <aside class="docs-nav">
        <div class="docs-nav-head"><span class="eyebrow">Unterlagen</span><h2>Projekt-Dossier</h2>
          <p class="muted small">Die Vision und die Pläne hinter Interior Studio — zum Lesen, Weiterdenken, Übernehmen oder Verwerfen.</p></div>
        <button class="docs-help-cta" type="button" data-goto="help">
          <span class="docs-item-ic">${Icons.svg("circle-help") || ""}</span>
          <span class="docs-item-txt"><b>Beispiele &amp; Hilfe</b><span>So funktioniert's · fertige Prompts · Vorher/Nachher</span></span>
          <span class="docs-help-arrow">→</span>
        </button>
        ${nav}
      </aside>
      <article class="docs-read" id="docsRead"><div class="docs-read-inner" id="docsReadInner"></div></article>`;
    root.querySelectorAll(".docs-item").forEach(b => b.onclick = () => open(b.dataset.id));
    built = true;
  }

  function open(id) {
    const docs = window.DOCS || [];
    const d = docs.find(x => x.id === id) || docs[0];
    if (!d) return;
    current = d.id; saveLast(d.id);
    document.querySelectorAll(".docs-item").forEach(b => b.classList.toggle("is-active", b.dataset.id === d.id));
    const { html, headings } = mdToHtml(d.md);
    const h2s = headings.filter(h => h.level === 2);
    const toc = h2s.length >= 3
      ? `<nav class="docs-toc" aria-label="Auf dieser Seite"><span class="docs-toc-h">Auf dieser Seite</span>${h2s.map(h => `<a href="#${h.id}" class="docs-toc-l">${esc(h.text)}</a>`).join("")}</nav>`
      : "";
    const inner = $("#docsReadInner");
    inner.innerHTML = `
      <header class="docs-doc-head">
        <span class="eyebrow">${esc(d.category)}</span>
        <h1>${esc(d.title)}</h1>
        <div class="docs-doc-meta">
          <span class="docs-file">${Icons.svg("file-down") || ""} ${esc(d.file)}</span>
          <button class="btn btn-ghost docs-dl" type="button">${Icons.svg("download") || ""} Herunterladen</button>
          <button class="btn btn-ghost docs-print" type="button">Drucken</button>
        </div>
      </header>${toc}
      <div class="md-body">${html}</div>`;
    inner.querySelectorAll(".docs-toc-l").forEach(a => a.onclick = ev => {
      ev.preventDefault();
      const id2 = a.getAttribute("href").slice(1);
      const t = inner.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(id2) : id2));
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const dl = inner.querySelector(".docs-dl"); if (dl) dl.onclick = () => download(d.file, d.md);
    const pr = inner.querySelector(".docs-print"); if (pr) pr.onclick = () => printDoc(d, html);
    const rd = $("#docsRead"); if (rd) rd.scrollTop = 0;
  }

  function download(name, text) {
    try {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    } catch (e) { if (window.toast) toast("Download nicht möglich.", "err"); }
  }

  function printDoc(d, html) {
    const w = window.open("", "_blank");
    if (!w) { if (window.toast) toast("Pop-up blockiert — Druck nicht möglich.", "err"); return; }
    w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
      <style>body{font:15px/1.62 Georgia,"Times New Roman",serif;max-width:760px;margin:42px auto;padding:0 22px;color:#141414}
      h1,h2,h3,h4{font-family:system-ui,-apple-system,sans-serif;line-height:1.18}h1{font-size:26px}
      table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ccc;padding:6px 9px;text-align:left;font-size:12.5px}
      th{background:#f3f3f3}pre{background:#f5f5f5;padding:12px;overflow:auto;border-radius:6px;font-size:12px}
      code{background:#eee;padding:1px 4px;border-radius:3px;font-size:.92em}blockquote{border-left:3px solid #bbb;margin:0;padding-left:14px;color:#444}
      hr{border:none;border-top:1px solid #ddd;margin:18px 0}a{color:#9a5b2e}</style>
      </head><body>${html}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
  }

  function render() {
    if (!built) buildShell();
    if (!built) return;
    const docs = window.DOCS || [];
    const start = current || lastId() || (docs[0] && docs[0].id);
    if (start) open(start);
  }

  window.Docs = { render, open, mdToHtml };
})();
