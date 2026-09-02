// End-to-end journeys through the built app, exactly as a user would click through them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { openApp } from './helpers.js';
import { sampleDb } from '../../src/store/sample.js';

const TODAY = '2026-09-02';
const seeded = () => openApp({ seed: sampleDb({ today: TODAY }), today: TODAY });

async function noErrors(app) {
  assert.equal(app.errors.length, 0, 'no console errors: ' + app.errors.map((e) => e.message).join(' | '));
}

test('welcome wizard: set up teams and start with sample data', async () => {
  const app = await openApp({ onboarded: false, today: TODAY });
  const { page } = app;
  try {
    await page.getByRole('button', { name: 'Let’s get set up' }).click();
    await page.getByText('1 April').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder('e.g. Day team').fill('Weekend team');
    await page.getByRole('button', { name: 'Add team' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('[data-choice="sample"]').click();
    await page.waitForSelector('.sidebar');
    assert.ok(await page.getByText('Off today').first().isVisible());
    await app.reload();
    assert.ok(await page.locator('.sidebar').isVisible(), 'stays set up after reload');
    await page.locator('.sidebar [data-nav="carers"]').click();
    assert.ok((await page.locator('.carer-card').count()) >= 15, 'sample carers present');
    await noErrors(app);
  } finally { await app.close(); }
});

test('welcome wizard: start fresh keeps the chosen teams', async () => {
  const app = await openApp({ onboarded: false, today: TODAY });
  const { page } = app;
  try {
    await page.getByRole('button', { name: 'Let’s get set up' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder('e.g. Day team').fill('Respite team');
    await page.getByRole('button', { name: 'Add team' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('[data-choice="fresh"]').click();
    await page.waitForSelector('.sidebar');
    await page.goto(page.url().split('#')[0] + '#settings?tab=teams');
    await page.waitForSelector('.settings-list');
    const names = await page.locator('.settings-row strong').allTextContents();
    assert.deepEqual(names, ['Day team', 'Night team', 'Respite team']);
    await noErrors(app);
  } finally { await app.close(); }
});

test('add a carer, open their profile, add a holiday, see it on the calendar', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#carers');
    await page.getByRole('button', { name: 'Add carer' }).first().click();
    await page.getByPlaceholder('e.g. Priya').fill('Test');
    await page.getByPlaceholder('e.g. Patel').fill('Person');
    await page.getByRole('button', { name: 'Add carer' }).last().click();
    await page.waitForSelector('h1:has-text("Test Person")');
    assert.ok(await page.getByText('Works Mon to Fri').isVisible());

    await page.getByRole('button', { name: 'Add holiday' }).first().click();
    await page.locator('.modal input[type=date]').nth(0).fill('2026-10-05');
    await page.locator('.modal input[type=date]').nth(1).fill('2026-10-07');
    await page.waitForSelector('.holiday-summary');
    assert.match(await page.locator('.holiday-summary').textContent(), /Uses 3 days/);
    await page.locator('.modal').getByRole('button', { name: 'Add holiday' }).click();
    await page.waitForSelector('.toast');
    assert.match(await page.locator('.carer-profile table').textContent(), /Mon 5 – Wed 7 Oct 2026/);

    await page.goto(page.url().split('#')[0] + '#calendar?month=2026-10');
    await page.waitForSelector('.month-view');
    const chip = page.locator('.abs-chip', { hasText: 'Test' });
    assert.equal(await chip.count(), 3, 'three chips in October');
    await noErrors(app);
  } finally { await app.close(); }
});

test('an overlapping holiday is blocked with a plain-English message', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#carers?id=carer_s01');
    await page.waitForSelector('.carer-profile');
    const existing = (await page.locator('.carer-profile table tbody tr').first().textContent()).trim();
    await page.getByRole('button', { name: 'Add holiday' }).first().click();
    // Use the first existing holiday's start date to force an overlap.
    const dates = await page.evaluate(() => JSON.parse(localStorage.getItem('mhm:db')).holidays.filter((h) => h.carerId === 'carer_s01' && h.status !== 'declined').map((h) => h.start));
    const iso = dates.sort().at(-1);
    await page.locator('.modal input[type=date]').nth(0).fill(iso);
    await page.locator('.modal input[type=date]').nth(1).fill(iso);
    await page.waitForSelector('.banner-danger, .banner.danger, [class*="banner"]');
    const text = await page.locator('.modal').textContent();
    assert.match(text, /is already off/);
    const addBtn = page.locator('.modal').getByRole('button', { name: /Add holiday|Add anyway/ });
    assert.equal(await addBtn.isDisabled(), true, 'add button disabled while blocked');
    await page.keyboard.press('Escape');
    assert.ok(existing.length > 0);
    await noErrors(app);
  } finally { await app.close(); }
});

test('bulk add for several carers with a live preview, then undo', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#holidays?tab=add');
    await page.locator('.holidays-page [aria-haspopup="dialog"]').click();
    for (const n of ['Ewan MacLeod', 'Grace Okafor', 'Hamza Iqbal']) await page.locator(`.holidays-page label:has-text("${n}")`).click();
    await page.keyboard.press('Escape');
    await page.locator('.holidays-page input[type=date]').nth(0).fill('2026-11-23');
    await page.locator('.holidays-page input[type=date]').nth(1).fill('2026-11-25');
    await page.waitForSelector('.preview-row');
    assert.equal(await page.locator('.preview-row').count(), 3);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mhm:db')).holidays.length);
    await page.getByRole('button', { name: /Add 3 holidays|Add 2 holidays|Add holiday/ }).click();
    await page.waitForSelector('.banner');
    await app.saved();
    await app.reload();
    await page.goto(page.url().split('#')[0] + '#calendar?month=2026-11');
    await page.waitForSelector('.month-view');
    assert.ok((await page.locator('.abs-chip', { hasText: 'Ewan' }).count()) >= 3, 'Ewan is on the November calendar after a reload');
    const after = await page.evaluate(() => new Promise((resolve) => { const r = indexedDB.open('monteith-holiday-manager', 1); r.onsuccess = () => { const tx = r.result.transaction('documents'); const g = tx.objectStore('documents').get('db'); g.onsuccess = () => resolve(g.result.holidays.length); }; }));
    assert.equal(after, before + 3, 'three holidays were saved');
    await noErrors(app);
  } finally { await app.close(); }
});

test('bulk remove with tick boxes', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#holidays?tab=remove');
    await page.locator('.holidays-page input[type=date]').nth(0).fill('2027-01-01');
    await page.locator('.holidays-page input[type=date]').nth(1).fill('2027-01-31');
    await page.waitForSelector('tbody .checkbox-box');
    const rows = await page.locator('tbody .checkbox-box').count();
    assert.ok(rows > 0);
    await page.locator('thead .checkbox-box').click();
    await page.getByRole('button', { name: /Remove \d+ selected/ }).click();
    await page.getByRole('button', { name: /Remove \d+ holidays|Remove holiday/ }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('tbody .checkbox-box').count(), 0, 'all removed');
    assert.ok(await page.getByText('No holidays match').isVisible());
    // Undo brings them back
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('tbody .checkbox-box').count(), rows, 'undo restores them');
    await noErrors(app);
  } finally { await app.close(); }
});

test('backup file downloads and restores', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#settings?tab=backup');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Save a backup file' }).click(),
    ]);
    assert.match(download.suggestedFilename(), /^Monteith Holiday Manager backup 2026-09-02\.json$/);
    const file = path.join(os.tmpdir(), `mhm-backup-${Date.now()}.json`);
    await download.saveAs(file);
    const doc = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(doc.carers.length, 18);
    await page.waitForSelector('text=Last backup:');

    // Wipe everything, then restore.
    await page.goto(page.url().split('#')[0] + '#settings?tab=advanced');
    await page.getByRole('button', { name: 'Clear all data' }).click();
    await page.getByPlaceholder('DELETE').fill('DELETE');
    await page.getByRole('button', { name: 'Clear everything' }).click();
    await page.waitForSelector('.onboarding');
    await page.getByRole('button', { name: 'Skip setup for now' }).click();
    await page.waitForSelector('.sidebar');
    await page.goto(page.url().split('#')[0] + '#settings?tab=backup');
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Restore from a backup file' }).click(),
    ]);
    await chooser.setFiles(file);
    await page.getByRole('button', { name: 'Restore backup' }).click();
    await page.waitForSelector('.toast');
    await page.goto(page.url().split('#')[0] + '#carers');
    await page.waitForSelector('.carer-card');
    assert.equal(await page.locator('.carer-card').count(), 17, 'active carers restored');
    await noErrors(app);
  } finally { await app.close(); }
});

test('a rubbish backup file is refused politely', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    const bad = path.join(os.tmpdir(), `mhm-bad-${Date.now()}.json`);
    await writeFile(bad, '{"hello": "world"}');
    await page.goto(page.url().split('#')[0] + '#settings?tab=backup');
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Restore from a backup file' }).click(),
    ]);
    await chooser.setFiles(bad);
    await page.getByRole('button', { name: 'Restore backup' }).click();
    await page.waitForSelector('text=That didn’t work');
    assert.ok(await page.getByText('isn’t a Holiday Manager backup').isVisible());
    await page.getByRole('button', { name: 'OK' }).click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mhm:db')).carers.length), 18, 'data untouched');
  } finally { await app.close(); }
});

test('changing the holiday year start re-labels the year everywhere', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#settings?tab=general');
    await page.locator('.settings-page select').nth(0).selectOption('1');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForSelector('.toast');
    await page.goto(page.url().split('#')[0] + '#carers');
    await page.waitForSelector('.carer-card');
    assert.match(await page.locator('.stat-tile').nth(1).textContent(), /2026(?!\/)/);
    await noErrors(app);
  } finally { await app.close(); }
});

test('phone-sized screen: bottom navigation works', async () => {
  const app = await openApp({ seed: sampleDb({ today: TODAY }), today: TODAY, viewport: { width: 390, height: 844 } });
  const { page } = app;
  try {
    assert.ok(await page.locator('.bottom-nav').isVisible());
    await page.locator('.bottom-nav [data-nav="calendar"]').click();
    await page.waitForSelector('.month-view');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(width <= 390, `page must not scroll sideways (was ${width}px)`);
    await page.locator('.bottom-nav [data-nav="reports"]').click();
    await page.waitForSelector('.reports-page');
    const width2 = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(width2 <= 390, `reports must not scroll sideways (was ${width2}px)`);
    await noErrors(app);
  } finally { await app.close(); }
});
