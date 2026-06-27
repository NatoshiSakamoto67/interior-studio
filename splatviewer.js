/* Interior Studio — Gaussian-Splat-Viewer (begehbar), umgesetzt mit World Labs „Spark".
   ES-Modul: importiert ein modernes three + Spark via <script type="importmap"> (CDN).
   Bewusst ISOLIERT vom alten globalen window.THREE (das model3d.js nutzt) — kein Konflikt.
   Rendert .spz (Marble), .splat, .ply, .ksplat. First-Person: Klick=Maus fangen, WASD/Pfeile, Touch.
   Setzt window.SplatViewer (Vertrag siehe world.js). */
import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const EYE = 1.5, SPEED = 2.6;
let renderer, scene, camera, spark, host, current = null;
let raf = 0, running = false, mounted = false, lastT = 0;
const keys = {}, look = { yaw: 0, pitch: 0 };
let locked = false, dragging = false, lastX = 0, lastY = 0;

function mount(container) {
  if (mounted) { if (container && renderer && renderer.domElement.parentNode !== container) container.appendChild(renderer.domElement); return; }
  host = container;
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  resize();
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c0f);
  camera = new THREE.PerspectiveCamera(62, aspect(), 0.05, 800);
  camera.position.set(0, EYE, 0);

  spark = new SparkRenderer({ renderer });
  scene.add(spark);

  bindControls();
  window.addEventListener("resize", resize);
  mounted = true;
}

function aspect() { const w = host.clientWidth || 800, h = host.clientHeight || 450; return w / Math.max(1, h); }
function resize() {
  if (!renderer || !host) return;
  const w = host.clientWidth || 800, h = host.clientHeight || 450;
  renderer.setSize(w, h);
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

async function load(input, onProgress) {
  if (!mounted) throw new Error("Viewer nicht initialisiert.");
  if (onProgress) onProgress(40, "Welt wird geladen …");
  // vorherige Welt entladen (Speicher freigeben)
  if (current) { try { scene.remove(current); current.dispose && current.dispose(); } catch (e) {} current = null; }

  let url, fileType;
  if (typeof input === "string") {
    url = input; fileType = extOf(input);
  } else if (input instanceof File || input instanceof Blob) {
    url = URL.createObjectURL(input);
    fileType = extOf(input.name || "");
  } else {
    throw new Error("Unbekannte Eingabe für den Splat-Viewer.");
  }

  const opts = { url };
  if (fileType) opts.fileType = fileType;   // .splat/.ksplat brauchen den Typ-Hinweis; .ply/.spz werden erkannt
  const mesh = new SplatMesh(opts);

  // Spark lädt asynchron; je nach Version via initialized-Promise.
  try { if (mesh.initialized && typeof mesh.initialized.then === "function") await mesh.initialized; } catch (e) { /* weiter, Frame-Loop zeigt es */ }
  scene.add(mesh);
  current = mesh;
  frameTo(mesh);
  if (onProgress) onProgress(99, "Fast fertig …");
}

function extOf(name) {
  const m = String(name).split("?")[0].toLowerCase().match(/\.(spz|splat|ksplat|ply|sog)$/);
  return m ? m[1] : "";
}

// Kamera grob in/vor die Welt setzen, damit man nicht im Nichts startet.
function frameTo(mesh) {
  try {
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty() || !isFinite(box.min.x)) { camera.position.set(0, EYE, 2.5); look.yaw = 0; look.pitch = 0; applyLook(); return; }
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z) || 3;
    camera.position.set(c.x, c.y + Math.min(EYE, size.y * 0.5 + 0.3), c.z + span * 0.65);
    look.yaw = Math.PI; look.pitch = -0.05; applyLook();
  } catch (e) {
    camera.position.set(0, EYE, 2.5); look.yaw = 0; look.pitch = 0; applyLook();
  }
}

/* ---------- First-Person-Steuerung ---------- */
function bindControls() {
  const cv = renderer.domElement;
  cv.addEventListener("click", () => { if (cv.requestPointerLock) cv.requestPointerLock(); });
  document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === cv; });
  document.addEventListener("mousemove", e => {
    if (locked) { look.yaw -= e.movementX * 0.0023; look.pitch -= e.movementY * 0.0023; clampPitch(); }
    else if (dragging) { look.yaw -= (e.clientX - lastX) * 0.005; look.pitch -= (e.clientY - lastY) * 0.005; lastX = e.clientX; lastY = e.clientY; clampPitch(); }
  });
  cv.addEventListener("mousedown", e => { if (!locked) { dragging = true; lastX = e.clientX; lastY = e.clientY; } });
  window.addEventListener("mouseup", () => { dragging = false; });
  cv.addEventListener("touchstart", e => { const t = e.touches[0]; dragging = true; lastX = t.clientX; lastY = t.clientY; }, { passive: true });
  cv.addEventListener("touchmove", e => { const t = e.touches[0]; look.yaw -= (t.clientX - lastX) * 0.006; look.pitch -= (t.clientY - lastY) * 0.006; lastX = t.clientX; lastY = t.clientY; clampPitch(); }, { passive: true });
  cv.addEventListener("touchend", () => { dragging = false; });
  window.addEventListener("keydown", e => { if (running) keys[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
}
function clampPitch() { const L = Math.PI / 2 - 0.05; look.pitch = Math.max(-L, Math.min(L, look.pitch)); applyLook(); }
function applyLook() {
  const cp = Math.cos(look.pitch);
  camera.lookAt(
    camera.position.x - Math.sin(look.yaw) * cp,
    camera.position.y + Math.sin(look.pitch),
    camera.position.z - Math.cos(look.yaw) * cp
  );
}

function step(dt) {
  let fwd = 0, str = 0;
  if (keys["w"] || keys["arrowup"]) fwd += 1;
  if (keys["s"] || keys["arrowdown"]) fwd -= 1;
  if (keys["d"] || keys["arrowright"]) str += 1;
  if (keys["a"] || keys["arrowleft"]) str -= 1;
  if (fwd || str) {
    const sy = Math.sin(look.yaw), cy = Math.cos(look.yaw), v = SPEED * dt;
    camera.position.x += (-sy * fwd + cy * str) * v;
    camera.position.z += (-cy * fwd - sy * str) * v;
  }
  applyLook();
}

function frame(t) {
  if (!running) return;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  step(dt);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}
function start() { if (!mounted || running) return; running = true; lastT = performance.now(); resize(); raf = requestAnimationFrame(frame); }
function stop() { running = false; if (raf) cancelAnimationFrame(raf); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
function dispose() { stop(); if (current) { try { scene.remove(current); current.dispose && current.dispose(); } catch (e) {} current = null; } }

window.SplatViewer = { available: () => true, mount, load, start, stop, dispose };
