// Renders the peach "M" mark with Chromium and packs it into installer/icon.ico in the classic
// (uncompressed BMP) format that every Windows tool accepts, plus a 256px PNG.
// Usage: node scripts/make-icon.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromiumPath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ headless: true, ...(existsSync(chromiumPath) ? { executablePath: chromiumPath } : {}) });
const page = await browser.newPage();
const svg = (size) => `<!doctype html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#F7915E"/><path d="M16 46V20l8-2 8 16 8-16 8 2v26h-7V30l-9 17-9-17v16z" fill="#FFF8F3"/></svg></body>`;
const sizes = [256, 64, 48, 32, 16];
const images = [];
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(svg(size));
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  images.push({ size, png, rgba: decodePng(png) });
}
await browser.close();

/** Minimal PNG decoder for 8-bit RGBA/RGB non-interlaced images (what Chromium screenshots produce). */
function decodePng(buf) {
  let pos = 8; let width = 0, height = 0, channels = 4; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8); const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); const ct = data[9]; channels = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error('unsupported PNG colour type ' + ct); })(); if (data[8] !== 8 || data[12] !== 0) throw new Error('unsupported PNG'); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels; const out = Buffer.alloc(width * height * 4); let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < width; x++) { const s = x * channels, d = (y * width + x) * 4; out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = channels === 4 ? line[s + 3] : 255; }
    prev = line;
  }
  return { width, height, data: out };
}

/** BMP-style ICO entry: BITMAPINFOHEADER + bottom-up BGRA pixels + 1-bit AND mask. */
function bmpEntry({ width, height, data }) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); header.writeInt32LE(width, 4); header.writeInt32LE(height * 2, 8);
  header.writeUInt16LE(1, 12); header.writeUInt16LE(32, 14); header.writeUInt32LE(0, 16); header.writeUInt32LE(width * height * 4, 20);
  const pixels = Buffer.alloc(width * height * 4);
  const maskStride = Math.ceil(width / 32) * 4; const mask = Buffer.alloc(maskStride * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const s = (y * width + x) * 4, d = ((height - 1 - y) * width + x) * 4;
    pixels[d] = data[s + 2]; pixels[d + 1] = data[s + 1]; pixels[d + 2] = data[s]; pixels[d + 3] = data[s + 3];
    if (data[s + 3] < 128) mask[(height - 1 - y) * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return Buffer.concat([header, pixels, mask]);
}

const entries = images.map((im) => ({ size: im.size, data: bmpEntry(im.rgba) }));
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
const dir = Buffer.alloc(16 * entries.length); let offset = 6 + dir.length;
entries.forEach((e, i) => {
  const o = i * 16; dir.writeUInt8(e.size === 256 ? 0 : e.size, o); dir.writeUInt8(e.size === 256 ? 0 : e.size, o + 1);
  dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3); dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(e.data.length, o + 8); dir.writeUInt32LE(offset, o + 12); offset += e.data.length;
});
await mkdir(path.join(root, 'installer'), { recursive: true });
const ico = Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
await writeFile(path.join(root, 'installer', 'icon.ico'), ico);
await writeFile(path.join(root, 'installer', 'icon-256.png'), images[0].png);
console.log('wrote installer/icon.ico', ico.length, 'bytes');
