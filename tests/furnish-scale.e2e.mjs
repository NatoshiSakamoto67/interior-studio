/* E2E (Skalierung): riesige Bürofläche 40×25 m — mm-genau am fernen Eck, Einrasten auf Distanz,
   Plan-Zoom. Lauf: Server auf :8799, dann  node tests/furnish-scale.e2e.mjs */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8799/index.html';
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
const results = [];
const check = (n, ok, d = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 });
  await page.click('button.tab[data-tab="world"]');
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    // 40×25 m Halle synthetisch bauen (mm), Möblierung aktivieren
    const model = {
      provenance: { precision: 'exact' },
      storeys: [{
        ceilingHeightMm: 3000,
        walls: [
          { id: 'n', start: { x: 0, y: 0 }, end: { x: 40000, y: 0 }, thicknessMm: 300 },
          { id: 'e', start: { x: 40000, y: 0 }, end: { x: 40000, y: 25000 }, thicknessMm: 300 },
          { id: 's', start: { x: 40000, y: 25000 }, end: { x: 0, y: 25000 }, thicknessMm: 300 },
          { id: 'w', start: { x: 0, y: 25000 }, end: { x: 0, y: 0 }, thicknessMm: 300 },
        ],
        rooms: [{ name: 'Büro', polygon: [{ x: 0, y: 0 }, { x: 40000, y: 0 }, { x: 40000, y: 25000 }, { x: 0, y: 25000 }] }],
        openings: [],
      }],
    };
    const ph = document.getElementById('paramHost'); ph.hidden = false;
    document.getElementById('splatHost').hidden = true;
    const empty = document.getElementById('worldEmpty'); if (empty) empty.hidden = true;
    window.Parametric.build(model, ph); window.Parametric.start();
    window.Furnish.clear();

    // 1) Mitte (20, 12.5) m → exakt
    window.Furnish.placeFromCatalog('side', { x: 20, z: 12.5 });
    const mid = window.Furnish.list()[0];

    // 2) Fernes Eck-nah, aber > Snap-Reichweite (38, 23) m → exakt
    window.Furnish.placeFromCatalog('side', { x: 38, z: 23 });
    const corner = window.Furnish.list()[1];

    // 3) ganz nah an Ostwand (x≈40) → Einrasten bündig
    window.Furnish.placeFromCatalog('side', { x: 39.9, z: 12.5 });
    const snapItem = window.Furnish.list()[2];
    const FP = window.FurnishPlace, segs = FP.wallSegments(model, window.Measure.mm);
    const distAfter = FP.nearestWallDistances({ x: snapItem.x_mm / 1000, z: snapItem.z_mm / 1000 }, segs)[0].d;
    const it = window.CATALOG.find((i) => i.id === 'side');
    const off = (it.d / 100) / 2 + 0.3 / 2;

    // 4) Plan-Zoom: Wheel rein → Ortho-Ausschnitt kleiner
    window.Parametric.setView('plan');
    const rect = ph.querySelector('canvas').getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const rBefore = window.Parametric.activeCamera().right;
    ph.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
    const rAfter = window.Parametric.activeCamera().right;
    window.Parametric.setView('walk');

    return {
      midX: mid.x_mm, midZ: mid.z_mm, cornerX: corner.x_mm, cornerZ: corner.z_mm,
      distAfter, off, rBefore, rAfter, count: window.Furnish.count(),
    };
  });

  check('mm-genau in der Mitte (20 m / 12,5 m)', r.midX === 20000 && r.midZ === 12500, `(${r.midX},${r.midZ})`);
  check('mm-genau am fernen Eck (38 m / 23 m)', r.cornerX === 38000 && r.cornerZ === 23000, `(${r.cornerX},${r.cornerZ})`);
  check('Einrasten bündig auf 40 m Distanz', Math.abs(r.distAfter - r.off) < 0.01, `${r.distAfter.toFixed(3)} ≈ ${r.off.toFixed(3)} m`);
  check('Plan-Zoom (Rad) verkleinert Ausschnitt', r.rAfter < r.rBefore, `${r.rBefore.toFixed(1)} → ${r.rAfter.toFixed(1)} m`);
  check('3 Möbel platziert', r.count === 3);

  await page.evaluate(() => window.Parametric.setView('plan')); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/is-smoke/buero-plan.png' });
} catch (e) { check('Durchlauf ohne Ausnahme', false, e.message); }

const benign = /favicon|404|sourcemap/i;
const real = errors.filter((e) => !benign.test(e));
console.log('\nKonsole-Fehler:', real.length ? real.slice(0, 8).join('\n') : 'keine');
const passed = results.filter((r) => r.ok).length;
console.log(`\nERGEBNIS: ${passed}/${results.length} Checks, ${real.length} echte Fehler`);
await browser.close();
process.exit(results.every((r) => r.ok) && real.length === 0 ? 0 : 1);
