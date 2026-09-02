// Renders the peach "M" mark to PNGs with Chromium and packs them into installer/icon.ico.
// Usage: node scripts/make-icon.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromiumPath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ headless: true, ...(existsSync(chromiumPath) ? { executablePath: chromiumPath } : {}) });
const page = await browser.newPage();
const svg = (size) => `<!doctype html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#F7915E"/><path d="M16 46V20l8-2 8 16 8-16 8 2v26h-7V30l-9 17-9-17v16z" fill="#FFF8F3"/></svg></body>`;
const sizes = [256, 64, 48, 32, 16];
const pngs = [];
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(svg(size));
  pngs.push({ size, data: await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }) });
}
await browser.close();
// ICO container: header + directory + PNG payloads (PNG-in-ICO is supported since Windows Vista).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
const dir = Buffer.alloc(16 * pngs.length);
let offset = 6 + dir.length;
pngs.forEach((p, i) => {
  const o = i * 16;
  dir.writeUInt8(p.size === 256 ? 0 : p.size, o);
  dir.writeUInt8(p.size === 256 ? 0 : p.size, o + 1);
  dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
  dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(p.data.length, o + 8); dir.writeUInt32LE(offset, o + 12);
  offset += p.data.length;
});
await mkdir(path.join(root, 'installer'), { recursive: true });
const out = path.join(root, 'installer', 'icon.ico');
await writeFile(out, Buffer.concat([header, dir, ...pngs.map((p) => p.data)]));
await writeFile(path.join(root, 'installer', 'icon-256.png'), pngs[0].data);
console.log('wrote', out, Buffer.concat([header, dir, ...pngs.map((p) => p.data)]).length, 'bytes');
