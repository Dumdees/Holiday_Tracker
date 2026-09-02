// Dev only: bundles the component gallery (src/ui/gallery.jsx) plus the app styles into
// .playwright-out/gallery.html so every shared component can be eyeballed in one page.
// Not part of the shipped app – src/main.jsx never imports the gallery.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.playwright-out');
const outFile = path.join(outDir, 'gallery.html');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const [js, css] = await Promise.all([
  build({
    entryPoints: [path.join(root, 'src/ui/gallery.jsx')],
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
.g-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px; }
.g-row.top { align-items: flex-start; }
.g-col { display: flex; flex-direction: column; gap: 12px; }
.g-label { font-size: 12.5px; color: var(--ink-muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 8px; }
.g-label:first-child { margin-top: 0; }
.g-stage { position: relative; overflow: hidden; border-radius: 16px; border: 1px dashed var(--line-strong); background: var(--peach-50); }
/* Overlays are pinned to their stage rather than the window (fixed boxes inside a transformed
   container look washed out in full-page screenshots). */
.g-stage .drawer-backdrop, .g-stage .modal-backdrop, .g-stage .toast-host { position: absolute; }
.g-stage .loading-screen { min-height: 100%; height: 100%; }
.g-box { max-width: 520px; }
.g-narrow { max-width: 220px; }
@media (max-width: 700px) { .gallery { padding: 18px 16px 60px; } }
`;

const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Component gallery · Monteith Holiday Manager</title>
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
