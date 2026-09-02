// Dev only: bundles the chart gallery (src/ui/charts/gallery-charts.jsx) plus the app styles into
// .playwright-out/charts.html, opens it in headless Chromium at desktop and phone sizes, saves
// full-page screenshots and fails (exit 1) on any console error, page error or sideways overflow.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.playwright-out');
const outFile = path.join(outDir, 'charts.html');
const chromiumPath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const SIZES = [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
];

// ---------- 1. Bundle ----------
const [js, css] = await Promise.all([
  build({
    entryPoints: [path.join(root, 'src/ui/charts/gallery-charts.jsx')],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2020', 'chrome90', 'edge90', 'firefox90', 'safari15'],
    minify: false,
    legalComments: 'none',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    logLevel: 'warning',
  }),
  build({
    entryPoints: [path.join(root, 'src/styles/index.css')],
    bundle: true,
    write: false,
    minify: false,
    legalComments: 'none',
    logLevel: 'warning',
  }),
]);

const jsText = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const cssText = css.outputFiles[0].text.replace(/<\/style/gi, '<\\/style');

const galleryCss = `
.gallery { max-width: var(--content-max); margin: 0 auto; padding: 28px 32px 80px; }
.gallery > header { margin-bottom: 32px; }
.g-section { margin-bottom: 48px; }
.g-section > h2 { margin-bottom: 4px; }
.g-desc { color: var(--ink-soft); margin: 0 0 16px; }
.cg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; align-items: start; }
.cg-full { grid-column: 1 / -1; }
.cg-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.cg-tile { flex-direction: row; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 18px; }
.cg-tile-value { font-size: 28px; font-weight: 650; line-height: 1.1; color: var(--ink); }
.cg-tile-label { font-size: 13px; color: var(--ink-muted); margin-top: 2px; }
@media (max-width: 700px) { .gallery { padding: 18px 16px 60px; } .cg-grid { grid-template-columns: 1fr; } }
`;

const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chart gallery · Monteith Holiday Manager</title>
<style>
${cssText}
${galleryCss}
</style>
</head>
<body>
<div id="app"></div>
<script>
${jsText}
</script>
</body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(outFile, html, 'utf8');
console.log(`Built ${path.relative(root, outFile)} (${Math.round(Buffer.byteLength(html, 'utf8') / 1024)} KB)`);

// ---------- 2. Screenshots ----------
const problems = [];
const browser = await chromium.launch({ headless: true, ...(existsSync(chromiumPath) ? { executablePath: chromiumPath } : {}) });
try {
  for (const [name, viewport] of SIZES) {
    const page = await browser.newPage({ viewport, locale: 'en-GB', timezoneId: 'Europe/London' });
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${name}] console error: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`[${name}] page error: ${e.message}`));
    await page.goto(pathToFileURL(outFile).href);
    await page.waitForTimeout(500);

    // Nothing may push the page wider than the window.
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > width + 1 && getComputedStyle(el).position !== 'fixed')
        .slice(0, 8)
        .map((el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`);
      return { scrollWidth: document.documentElement.scrollWidth, width, wide };
    });
    if (overflow.scrollWidth > overflow.width + 1) {
      problems.push(`[${name}] page is ${overflow.scrollWidth}px wide in a ${overflow.width}px window: ${overflow.wide.join(', ')}`);
    }

    const file = path.join(outDir, `charts-${name}.png`);
    // Animations off: a full-page capture otherwise catches entry animations half way.
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    console.log(`Saved ${path.relative(root, file)}`);

    // Hover states, desktop only: a bar tooltip, a doughnut segment, a heat-map day and the
    // line-chart crosshair. Each card is scrolled into view BEFORE hovering – scrolling afterwards
    // would move the page under the pointer and hide the tooltip. The doughnut is hovered at a
    // point on the ring (its bounding-box centre is the hole).
    if (name === 'desktop') {
      const ring = { x: 100 + Math.cos(Math.PI * 200 / 180) * 84, y: 100 + Math.sin(Math.PI * 200 / 180) * 84 };
      const shots = [
        ['usage', '.chart-bar-group >> nth=2', {}, 'charts-hover-bar.png'],
        ['donut', '.chart-donut-svg', { position: ring }, 'charts-hover-donut.png'],
        ['heatmap', '.chart-hm-cell.lvl-3 >> nth=0', {}, 'charts-hover-heatmap.png'],
        ['line', '.chart-hit', {}, 'charts-hover-line.png'],
      ];
      for (const [shot, selector, options, fileName] of shots) {
        const card = page.locator(`[data-shot="${shot}"]`);
        try {
          await card.scrollIntoViewIfNeeded();
          await page.waitForTimeout(100);
          await card.locator(selector).first().hover({ force: true, ...options });
          await page.waitForTimeout(150);
          const hasTip = await card.locator('.chart-tip').count();
          if (!hasTip) problems.push(`[${name}] no tooltip appeared when hovering ${shot} (${selector})`);
          await card.screenshot({ path: path.join(outDir, fileName) });
          console.log(`Saved ${path.relative(root, path.join(outDir, fileName))}`);
        } catch (err) {
          problems.push(`[${name}] could not hover ${shot} (${selector}): ${err.message.split('\n')[0]}`);
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
