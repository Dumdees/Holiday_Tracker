// Captures the screenshots shown in README.md from the built app with sample data.
// Usage: node scripts/readme-shots.mjs   (run `npm run build` first)
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sampleDb } from '../src/store/sample.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'screenshots');
await mkdir(out, { recursive: true });
const TODAY = '2026-09-02';
const chromiumPath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ headless: true, ...(existsSync(chromiumPath) ? { executablePath: chromiumPath } : {}) });
const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: 'en-GB', timezoneId: 'Europe/London', deviceScaleFactor: 1 });
const page = await context.newPage();
await page.clock.setFixedTime(new Date(TODAY + 'T09:00:00'));
await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('mhm:db', JSON.stringify(s)); } }, sampleDb({ today: TODAY }));
const url = pathToFileURL(path.join(root, 'Monteith Holiday Manager', 'Monteith Holiday Manager.html')).href;
const shot = async (hash, name, fullPage = false) => {
  await page.goto(url + '#' + hash);
  await page.waitForFunction(() => !document.querySelector('.loading-screen'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage });
  console.log('saved', name);
};
await shot('home', 'home');
await shot('calendar?month=2026-09', 'calendar');
await shot('carers', 'carers');
await page.goto(url + '#holidays?tab=add');
await page.waitForSelector('.holidays-page');
await page.locator('.holidays-page [aria-haspopup="dialog"]').click();
for (const n of ['Callum Fraser', 'Morag Sinclair', 'Aisha Rahman']) await page.locator(`.holidays-page label:has-text("${n}")`).click();
await page.keyboard.press('Escape');
await page.locator('.holidays-page input[type=date]').nth(0).fill('2026-09-28');
await page.locator('.holidays-page input[type=date]').nth(1).fill('2026-10-02');
await page.waitForSelector('.preview-row');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, 'bulk-add.png'), fullPage: true });
console.log('saved bulk-add');
await shot('reports', 'reports');
await browser.close();
