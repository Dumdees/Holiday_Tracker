// Dev only: opens .playwright-out/gallery.html in headless Chromium at desktop and phone sizes,
// saves full-page screenshots and fails (exit 1) on any console error, page error or sideways overflow.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.playwright-out');
const galleryUrl = pathToFileURL(path.join(outDir, 'gallery.html')).href;
const chromiumPath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const SIZES = [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
];

const problems = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'],
  ...(existsSync(chromiumPath) ? { executablePath: chromiumPath } : {}),
});
try {
  for (const [name, viewport] of SIZES) {
    const page = await browser.newPage({ viewport, locale: 'en-GB', timezoneId: 'Europe/London' });
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${name}] console error: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`[${name}] page error: ${e.message}`));
    await page.goto(galleryUrl);
    await page.waitForTimeout(500);

    // Nothing may push the page wider than the window.
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const name = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
      // Anything inside a scrolling or clipping box cannot widen the page, so it is not a culprit.
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowX)) return true;
        }
        return false;
      };
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > width + 1 && getComputedStyle(el).position !== 'fixed' && !clipped(el));
      const outermost = wide.filter((el) => !wide.some((other) => other !== el && other.contains(el)));
      return { scrollWidth: document.documentElement.scrollWidth, width, wide: outermost.slice(0, 8).map((el) => `${name(el)} (${Math.round(el.getBoundingClientRect().width)}px wide)`) };
    });
    if (overflow.scrollWidth > overflow.width + 1) {
      problems.push(`[${name}] page is ${overflow.scrollWidth}px wide in a ${overflow.width}px window: ${overflow.wide.join(', ')}`);
    }

    const file = path.join(outDir, `gallery-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`Saved ${path.relative(root, file)}`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
