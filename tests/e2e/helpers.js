// Shared Playwright helpers. Tests open the BUILT single-file app over file://
// exactly as a user would, so persistence and offline behaviour are tested for real.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { existsSync } from 'node:fs';

const PREINSTALLED_CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
export const APP_FILE = path.join(ROOT, 'Monteith Holiday Manager', 'Monteith Holiday Manager.html');
export const APP_URL = pathToFileURL(APP_FILE).href;
export const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(ROOT, '.playwright-out');

/**
 * Launch a persistent browser profile (so IndexedDB/localStorage survive reloads
 * within a test) and open the app. Returns { context, page, close }.
 */
export async function openApp({ viewport = { width: 1280, height: 860 }, onboarded = true, seed = null, today = null } = {}) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'mhm-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    ...(existsSync(PREINSTALLED_CHROMIUM) ? { executablePath: PREINSTALLED_CHROMIUM } : {}),
    viewport,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    args: ['--allow-file-access-from-files'],
  });
  const page = context.pages()[0] || (await context.newPage());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(new Error(m.text())); });
  if (today) await page.clock.setFixedTime(new Date(today + 'T09:00:00'));
  if (seed || onboarded) {
    await page.addInitScript(({ seed, onboarded }) => {
      // Seed data ONCE per browser session (init scripts run on every navigation) by writing to
      // localStorage; the app reads it as the newest copy on a brand-new profile.
      if (sessionStorage.getItem('mhm:seeded')) return;
      sessionStorage.setItem('mhm:seeded', '1');
      if (seed) localStorage.setItem('mhm:db', JSON.stringify(seed));
      else if (onboarded && !localStorage.getItem('mhm:db')) {
        localStorage.setItem('mhm:db', JSON.stringify({ schemaVersion: 1, settings: { onboardingComplete: true }, carers: [], holidays: [] }));
      }
    }, { seed, onboarded });
  }
  await page.goto(APP_URL);
  await page.waitForSelector('#app .app, #app .loading-screen', { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('.loading-screen'), null, { timeout: 10000 });
  return {
    context,
    page,
    errors,
    /** Wait until the app reports every change is written. */
    async saved() { await page.waitForFunction(() => document.querySelector('.save-indicator')?.classList.contains('saved'), null, { timeout: 5000 }); },
    async reload() { await page.reload(); await page.waitForFunction(() => !document.querySelector('.loading-screen')); },
    async close() { await context.close(); await rm(userDataDir, { recursive: true, force: true }); },
  };
}

export async function screenshot(page, name) {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
