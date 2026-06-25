#!/usr/bin/env python3
"""Build icons.js from authentic Lucide SVG paths (ISC).

Holt die Original-Pfade aus lucide-static (gepinnte Version) — NICHT nachgezeichnet,
damit Proportionen/Pfade exakt stimmen. Erzeugt eine selbsttragende icons.js
(window.Icons) ohne Webfont/CDN, file://-fest.

Aufruf:  python3 tools/build-icons.py
"""
import re
import subprocess
import sys
from pathlib import Path

LUCIDE_VERSION = "1.21.0"  # gepinnt für Reproduzierbarkeit (geprüft 2026-06-25)
BASE = f"https://unpkg.com/lucide-static@{LUCIDE_VERSION}/icons"

# Benötigte Icons (Lucide-Namen). _missing wird auf circle-help gemappt.
ICONS = [
    # Kern-UI
    "folders", "palette", "building-2", "compass", "library", "book-open",
    "key", "save", "folder-open", "plus", "sparkles", "image", "ruler",
    "footprints", "map-pin", "loader-circle", "mic", "brain", "circle-check",
    "package", "rotate-cw", "x", "upload", "download", "check", "maximize",
    "play", "arrow-right", "hand",
    # Hilfe / Begehung / Extra
    "shopping-cart", "gauge", "info", "sofa", "door-open", "house",
    "circle-help", "triangle-alert", "eye", "mouse-pointer-click", "usb",
    "share-2", "file-down", "folder", "camera", "settings",
]

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons.js"

INNER_RE = re.compile(r"<svg[^>]*>(.*)</svg>", re.S)
WS_RE = re.compile(r">\s+<")


def fetch(name: str) -> str:
    url = f"{BASE}/{name}.svg"
    res = subprocess.run(
        ["curl", "-fsSL", "--max-time", "20", url],
        capture_output=True, text=True,
    )
    if res.returncode != 0:
        raise RuntimeError(f"fetch failed ({res.returncode}) for {name}: {res.stderr.strip()[:120]}")
    m = INNER_RE.search(res.stdout)
    if not m:
        raise RuntimeError(f"no <svg> body for {name}")
    inner = m.group(1).strip()
    inner = WS_RE.sub("><", inner)            # Whitespace zwischen Tags weg
    inner = re.sub(r"\s+", " ", inner).strip()  # restliche Whitespace normalisieren
    return inner


def js_string(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> int:
    paths, failed = {}, []
    for name in ICONS:
        try:
            paths[name] = fetch(name)
            print(f"  ok   {name}")
        except Exception as e:  # noqa: BLE001
            failed.append(name)
            print(f"  FAIL {name}: {e}", file=sys.stderr)
    if failed:
        print(f"\n{len(failed)} Icon(s) fehlgeschlagen: {failed}", file=sys.stderr)
        return 1

    # _missing = circle-help (klarer Platzhalter statt Crash)
    paths["_missing"] = paths["circle-help"]

    entries = ",\n    ".join(f"{js_string(k)}: {js_string(v)}" for k, v in sorted(paths.items()))

    body = f"""/* Interior Studio — Icon-System (Lucide)
 * Original-Pfade aus lucide-static v{LUCIDE_VERSION} (https://lucide.dev) — ISC License,
 * Copyright (c) for portions Lucide are held by Cole Bemis 2013-2022, the rest Lucide Contributors 2022.
 * Generiert von tools/build-icons.py — NICHT von Hand editieren (Pfade exakt, nicht nachgezeichnet).
 * API: window.Icons.svg(name, opts) -> SVG-String · el(name, opts) -> SVGElement
 *      hydrate(root=document) ersetzt [data-icon]-Platzhalter · has(name) · names()
 * opts: {{ cls, title, strokeWidth }} — title => role=img+aria-label, sonst aria-hidden.
 * Kein Webfont, kein CDN: voll offline / file://-tauglich.
 */
(function () {{
  "use strict";
  var VB = "0 0 24 24";
  var PATHS = {{
    {entries}
  }};
  function esc(s) {{
    return String(s).replace(/[&<>"]/g, function (c) {{
      return {{ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }}[c];
    }});
  }}
  function svg(name, opts) {{
    opts = opts || {{}};
    var has = Object.prototype.hasOwnProperty.call(PATHS, name);
    if (!has && typeof console !== "undefined") console.warn("[Icons] unbekanntes Icon:", name);
    var inner = has ? PATHS[name] : PATHS._missing;
    var cls = "icon" + (opts.cls ? " " + opts.cls : "");
    var sw = opts.strokeWidth || 2;
    var a11y = opts.title
      ? ' role="img" aria-label="' + esc(opts.title) + '"'
      : ' aria-hidden="true" focusable="false"';
    return '<svg class="' + cls + '" viewBox="' + VB + '" width="1em" height="1em"'
      + ' fill="none" stroke="currentColor" stroke-width="' + sw + '"'
      + ' stroke-linecap="round" stroke-linejoin="round"' + a11y + '>' + inner + '</svg>';
  }}
  function el(name, opts) {{
    var tpl = document.createElement("template");
    tpl.innerHTML = svg(name, opts);
    return tpl.content.firstChild;
  }}
  function hydrate(root) {{
    root = root || document;
    var nodes = root.querySelectorAll("[data-icon]:not([data-icon-done])");
    for (var i = 0; i < nodes.length; i++) {{
      var n = nodes[i];
      var opts = {{}};
      if (n.getAttribute("data-icon-title")) opts.title = n.getAttribute("data-icon-title");
      if (n.getAttribute("data-icon-cls")) opts.cls = n.getAttribute("data-icon-cls");
      n.innerHTML = svg(n.getAttribute("data-icon"), opts);
      n.setAttribute("data-icon-done", "");
    }}
  }}
  window.Icons = {{
    svg: svg, el: el, hydrate: hydrate,
    has: function (n) {{ return Object.prototype.hasOwnProperty.call(PATHS, n); }},
    names: function () {{ return Object.keys(PATHS); }}
  }};
}})();
"""
    OUT.write_text(body, encoding="utf-8")
    print(f"\n✓ {OUT} geschrieben — {len(paths)} Icons ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
