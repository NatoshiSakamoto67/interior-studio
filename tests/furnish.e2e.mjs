/* E2E: Möbel mm-genau platzieren, Wand-Einrasten, Plan/Begehen synchron.
   Lauf: Server auf :8799, dann  node tests/furnish.e2e.mjs  (Playwright aus gecachtem Pfad). */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8799/index.html';
const DXF = '/Users/davidoff/interior-studio/examples/demo-grundriss.dxf';
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
  await page.setInputFiles('#worldFile', DXF);
  await page.waitForFunction(() => { const r = document.querySelector('#measureReport'); return r && /Wände|Modell gebaut/i.test(r.textContent || ''); }, { timeout: 30000 });
  await page.waitForTimeout(500);

  check('Möbel-Panel sichtbar', await page.locator('#furnishPanel').isVisible());
  const chips = await page.locator('#furnishCatalog .furnish-chip').count();
  check('Katalog-Chips gerendert', chips > 0, chips + ' Chips');
  check('Plan/Begehen-Umschalter sichtbar', await page.locator('#viewSeg').isVisible());

  // Chip-Klick platziert ein Sofa, Liste erscheint mit Preis
  await page.click('#furnishCatalog .furnish-chip[data-fid="sofa"]');
  await page.waitForTimeout(150);
  check('Chip-Klick platziert Möbel', (await page.evaluate(() => window.Furnish.count())) === 1);
  const listTxt = await page.locator('#furnishList').textContent();
  check('Möbel-Liste sichtbar mit Preis', await page.locator('#furnishList').isVisible() && /€/.test(listTxt || ''));

  // mm-genau (am interiorsten Punkt, garantiert ohne Snap) + Wand-Einrasten bündig — deterministisch
  const r = await page.evaluate(() => {
    const FP = window.FurnishPlace, P = window.Parametric, mm = window.Measure.mm;
    const model = P.currentModel(), segs = FP.wallSegments(model, mm), b = FP.boundsOf(segs);
    window.Furnish.clear();
    // wähle den von allen Wänden am weitesten entfernten Punkt → kein Snap → exakte mm
    let best = null, bestD = -1;
    for (let gx = 1; gx <= 5; gx++) for (let gz = 1; gz <= 5; gz++) {
      const x = b.minX + (b.maxX - b.minX) * gx / 6, z = b.minZ + (b.maxZ - b.minZ) * gz / 6;
      const d = FP.nearestWallDistances({ x, z }, segs)[0].d;
      if (d > bestD) { bestD = d; best = { x, z }; }
    }
    window.Furnish.placeFromCatalog('table', best);
    const t = window.Furnish.list()[0];

    // nah an Wand 0 platzieren → Rücken muss bündig einrasten
    const s = segs[0], midx = (s.x1 + s.x2) / 2, midz = (s.z1 + s.z2) / 2;
    let nx = -(s.z2 - s.z1), nz = (s.x2 - s.x1); const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    if ((best.x - midx) * nx + (best.z - midz) * nz < 0) { nx = -nx; nz = -nz; }
    window.Furnish.placeFromCatalog('sofa', { x: midx + nx * 0.05, z: midz + nz * 0.05 });
    const sofa = window.Furnish.list().find((x) => x.id === 'sofa');
    const distAfter = FP.nearestWallDistances({ x: sofa.x_mm / 1000, z: sofa.z_mm / 1000 }, segs)[0].d;
    const item = window.CATALOG.find((i) => i.id === 'sofa');
    const expectedOff = (item.d / 100) / 2 + s.th / 2;
    return { reqX: Math.round(best.x * 1000), reqZ: Math.round(best.z * 1000), tX: t.x_mm, tZ: t.z_mm, bestD, distAfter, expectedOff };
  });
  check('mm-genau platziert (kein Snap)', Math.abs(r.tX - r.reqX) <= 2 && Math.abs(r.tZ - r.reqZ) <= 2, `Soll(${r.reqX},${r.reqZ}) Ist(${r.tX},${r.tZ}) · ${r.bestD.toFixed(2)} m von Wand`);
  check('Wand-Einrasten bündig', Math.abs(r.distAfter - r.expectedOff) < 0.01, `Abstand ${r.distAfter.toFixed(3)} ≈ ${r.expectedOff.toFixed(3)} m`);

  // Plan/Begehen: dasselbe Objekt, kein Fehler, Screenshots
  await page.evaluate(() => window.Parametric.setView('plan')); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/is-smoke/plan.png' });
  const cntPlan = await page.evaluate(() => window.Furnish.count());
  await page.evaluate(() => window.Parametric.setView('walk')); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/is-smoke/walk.png' });
  const cntWalk = await page.evaluate(() => window.Furnish.count());
  check('Plan↔Begehen behält Möbel', cntPlan === cntWalk && cntPlan > 0, `plan=${cntPlan} walk=${cntWalk}`);
} catch (e) { check('Durchlauf ohne Ausnahme', false, e.message); }

const benign = /favicon|404|sourcemap/i;
const real = errors.filter((e) => !benign.test(e));
console.log('\nKonsole-Fehler:', real.length ? real.slice(0, 8).join('\n') : 'keine');
const passed = results.filter((r) => r.ok).length;
console.log(`\nERGEBNIS: ${passed}/${results.length} Checks, ${real.length} echte Fehler`);
await browser.close();
process.exit(results.every((r) => r.ok) && real.length === 0 ? 0 : 1);
