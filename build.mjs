// Builds the whole app into ONE self-contained HTML file that runs offline
// by double-clicking it. Output: "Monteith Holiday Manager/Monteith Holiday Manager.html"
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

export const OUT_DIR = path.join(root, 'Monteith Holiday Manager');
export const OUT_FILE = path.join(OUT_DIR, 'Monteith Holiday Manager.html');

const [js, css] = await Promise.all([
  build({
    entryPoints: [path.join(root, 'src/main.jsx')],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2020', 'chrome90', 'edge90', 'firefox90', 'safari15'],
    minify: !dev,
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
    minify: !dev,
    legalComments: 'none',
    logLevel: 'warning',
  }),
]);

const jsText = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const cssText = css.outputFiles[0].text.replace(/<\/style/gi, '<\\/style');

const template = await readFile(path.join(root, 'src/index.html'), 'utf8');
const html = template
  .replace('<!--%CSS%-->', () => cssText)
  .replace('<!--%JS%-->', () => jsText)
  .replace(/%VERSION%/g, pkg.version);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, html, 'utf8');
const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log(`Built ${path.relative(root, OUT_FILE)} (${kb} KB${dev ? ', dev build' : ''})`);
