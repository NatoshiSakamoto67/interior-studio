/* Interior Studio — Icon-System (Lucide)
 * Original-Pfade aus lucide-static v1.21.0 (https://lucide.dev) — ISC License,
 * Copyright (c) for portions Lucide are held by Cole Bemis 2013-2022, the rest Lucide Contributors 2022.
 * Generiert von tools/build-icons.py — NICHT von Hand editieren (Pfade exakt, nicht nachgezeichnet).
 * API: window.Icons.svg(name, opts) -> SVG-String · el(name, opts) -> SVGElement
 *      hydrate(root=document) ersetzt [data-icon]-Platzhalter · has(name) · names()
 * opts: { cls, title, strokeWidth } — title => role=img+aria-label, sonst aria-hidden.
 * Kein Webfont, kein CDN: voll offline / file://-tauglich.
 */
(function () {
  "use strict";
  var VB = "0 0 24 24";
  var PATHS = {
    "_missing": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /><path d=\"M12 17h.01\" />",
    "arrow-right": "<path d=\"M5 12h14\" /><path d=\"m12 5 7 7-7 7\" />",
    "book-open": "<path d=\"M12 7v14\" /><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\" />",
    "brain": "<path d=\"M12 18V5\" /><path d=\"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4\" /><path d=\"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5\" /><path d=\"M17.997 5.125a4 4 0 0 1 2.526 5.77\" /><path d=\"M18 18a4 4 0 0 0 2-7.464\" /><path d=\"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517\" /><path d=\"M6 18a4 4 0 0 1-2-7.464\" /><path d=\"M6.003 5.125a4 4 0 0 0-2.526 5.77\" />",
    "building-2": "<path d=\"M10 12h4\" /><path d=\"M10 8h4\" /><path d=\"M14 21v-3a2 2 0 0 0-4 0v3\" /><path d=\"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2\" /><path d=\"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16\" />",
    "camera": "<path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\" /><circle cx=\"12\" cy=\"13\" r=\"3\" />",
    "check": "<path d=\"M20 6 9 17l-5-5\" />",
    "chevron-down": "<path d=\"m6 9 6 6 6-6\" />",
    "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
    "circle-check": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m9 12 2 2 4-4\" />",
    "circle-help": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /><path d=\"M12 17h.01\" />",
    "compass": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\" />",
    "door-open": "<path d=\"M11 20H2\" /><path d=\"M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z\" /><path d=\"M11 4H8a2 2 0 0 0-2 2v14\" /><path d=\"M14 12h.01\" /><path d=\"M22 20h-3\" />",
    "download": "<path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" />",
    "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
    "file-down": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /><path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /><path d=\"M12 18v-6\" /><path d=\"m9 15 3 3 3-3\" />",
    "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" />",
    "folder-open": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />",
    "folder-plus": "<path d=\"M12 10v6\" /><path d=\"M9 13h6\" /><path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" />",
    "folders": "<path d=\"M20 5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2.5a1.5 1.5 0 0 1 1.2.6l.6.8a1.5 1.5 0 0 0 1.2.6z\" /><path d=\"M3 8.268a2 2 0 0 0-1 1.738V19a2 2 0 0 0 2 2h11a2 2 0 0 0 1.732-1\" />",
    "footprints": "<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\" /><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\" /><path d=\"M16 17h4\" /><path d=\"M4 13h4\" />",
    "gauge": "<path d=\"m12 14 4-4\" /><path d=\"M3.34 19a10 10 0 1 1 17.32 0\" />",
    "hand": "<path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2\" /><path d=\"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2\" /><path d=\"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\" /><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\" />",
    "house": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" /><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />",
    "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" /><circle cx=\"9\" cy=\"9\" r=\"2\" /><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />",
    "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" />",
    "key": "<path d=\"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4\" /><path d=\"m21 2-9.6 9.6\" /><circle cx=\"7.5\" cy=\"15.5\" r=\"5.5\" />",
    "library": "<path d=\"m16 6 4 14\" /><path d=\"M12 6v14\" /><path d=\"M8 8v12\" /><path d=\"M4 4v16\" />",
    "loader-circle": "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\" />",
    "map-pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\" /><circle cx=\"12\" cy=\"10\" r=\"3\" />",
    "maximize": "<path d=\"M8 3H5a2 2 0 0 0-2 2v3\" /><path d=\"M21 8V5a2 2 0 0 0-2-2h-3\" /><path d=\"M3 16v3a2 2 0 0 0 2 2h3\" /><path d=\"M16 21h3a2 2 0 0 0 2-2v-3\" />",
    "mic": "<path d=\"M12 19v3\" /><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\" /><rect x=\"9\" y=\"2\" width=\"6\" height=\"13\" rx=\"3\" />",
    "mouse-pointer-click": "<path d=\"M14 4.1 12 6\" /><path d=\"m5.1 8-2.9-.8\" /><path d=\"m6 12-1.9 2\" /><path d=\"M7.2 2.2 8 5.1\" /><path d=\"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z\" />",
    "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\" /><path d=\"M12 22V12\" /><polyline points=\"3.29 7 12 12 20.71 7\" /><path d=\"m7.5 4.27 9 5.15\" />",
    "palette": "<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\" /><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\" /><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
    "play": "<path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\" />",
    "plus": "<path d=\"M5 12h14\" /><path d=\"M12 5v14\" />",
    "rotate-cw": "<path d=\"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" />",
    "ruler": "<path d=\"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z\" /><path d=\"m14.5 12.5 2-2\" /><path d=\"m11.5 9.5 2-2\" /><path d=\"m8.5 6.5 2-2\" /><path d=\"m17.5 15.5 2-2\" />",
    "save": "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" /><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" /><path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />",
    "settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
    "share-2": "<circle cx=\"18\" cy=\"5\" r=\"3\" /><circle cx=\"6\" cy=\"12\" r=\"3\" /><circle cx=\"18\" cy=\"19\" r=\"3\" /><line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\" /><line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\" />",
    "shopping-cart": "<circle cx=\"8\" cy=\"21\" r=\"1\" /><circle cx=\"19\" cy=\"21\" r=\"1\" /><path d=\"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12\" />",
    "sofa": "<path d=\"M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3\" /><path d=\"M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z\" /><path d=\"M4 18v2\" /><path d=\"M20 18v2\" /><path d=\"M12 4v9\" />",
    "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /><path d=\"M20 2v4\" /><path d=\"M22 4h-4\" /><circle cx=\"4\" cy=\"20\" r=\"2\" />",
    "square-pen": "<path d=\"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\" /><path d=\"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z\" />",
    "trash-2": "<path d=\"M10 11v6\" /><path d=\"M14 11v6\" /><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" /><path d=\"M3 6h18\" /><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" />",
    "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
    "upload": "<path d=\"M12 3v12\" /><path d=\"m17 8-5-5-5 5\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" />",
    "usb": "<circle cx=\"10\" cy=\"7\" r=\"1\" /><circle cx=\"4\" cy=\"20\" r=\"1\" /><path d=\"M4.7 19.3 19 5\" /><path d=\"m21 3-3 1 2 2Z\" /><path d=\"M9.26 7.68 5 12l2 5\" /><path d=\"m10 14 5 2 3.5-3.5\" /><path d=\"m18 12 1-1 1 1-1 1Z\" />",
    "x": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />"
  };
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function svg(name, opts) {
    opts = opts || {};
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
  }
  function el(name, opts) {
    var tpl = document.createElement("template");
    tpl.innerHTML = svg(name, opts);
    return tpl.content.firstChild;
  }
  function hydrate(root) {
    root = root || document;
    var nodes = root.querySelectorAll("[data-icon]:not([data-icon-done])");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var opts = {};
      if (n.getAttribute("data-icon-title")) opts.title = n.getAttribute("data-icon-title");
      if (n.getAttribute("data-icon-cls")) opts.cls = n.getAttribute("data-icon-cls");
      n.innerHTML = svg(n.getAttribute("data-icon"), opts);
      n.setAttribute("data-icon-done", "");
    }
  }
  window.Icons = {
    svg: svg, el: el, hydrate: hydrate,
    has: function (n) { return Object.prototype.hasOwnProperty.call(PATHS, n); },
    names: function () { return Object.keys(PATHS); }
  };
})();
