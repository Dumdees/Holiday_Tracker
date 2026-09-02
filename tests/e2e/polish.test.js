// Journeys that check the app reads consistently from screen to screen, as a first-time
// office manager would notice: numbers that agree, plain wording, and nothing lost on a phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './helpers.js';
import { sampleDb } from '../../src/store/sample.js';

const TODAY = '2026-09-02';
const seeded = (extra = {}) => openApp({ seed: sampleDb({ today: TODAY }), today: TODAY, ...extra });

async function noErrors(app) {
  assert.equal(app.errors.length, 0, 'no console errors: ' + app.errors.map((e) => e.message).join(' | '));
}

test('the Home numbers agree with the Carers and Holidays screens', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    const carersTile = await page.locator('.stat-tile', { hasText: 'Carers' }).textContent();
    const homeLeft = carersTile.match(/([\d.]+) days left between them/)[1];
    const pendingTile = page.locator('.stat-tile', { hasText: 'Awaiting approval' });
    const homePending = (await pendingTile.textContent()).match(/(\d+)/)[1];

    // The days left on Home only count current carers, exactly like the Carers screen.
    await page.goto(page.url().split('#')[0] + '#carers');
    await page.waitForSelector('.carer-card');
    const carersLeft = (await page.locator('.stat-tile', { hasText: 'Days left' }).textContent()).match(/([\d.]+)/)[1];
    assert.equal(homeLeft, carersLeft, 'Home and Carers agree on days left');

    // Clicking the pending tile shows every request that is waiting, whatever year it falls in.
    await page.goto(page.url().split('#')[0] + '#home');
    await page.locator('.stat-tile', { hasText: 'Awaiting approval' }).click();
    await page.waitForSelector('.holidays-page table, .holidays-page .table');
    const shown = (await page.locator('.stat-tile', { hasText: 'Awaiting approval' }).textContent()).match(/(\d+)/)[1];
    assert.equal(shown, homePending, 'All holidays shows the same number of requests as Home');
    const yearChoice = await page.locator('.holidays-page select[aria-label="Holiday year"]').inputValue();
    assert.equal(yearChoice, 'all', 'the year dropdown says all years');
    await noErrors(app);
  } finally { await app.close(); }
});

test('a half day reads as “half a day”', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#carers?id=carer_s01');
    await page.getByRole('button', { name: 'Add holiday' }).first().click();
    await page.locator('.modal input[type=date]').nth(0).fill('2026-12-14');
    await page.locator('.modal input[type=date]').nth(1).fill('2026-12-14');
    await page.locator('.modal select').nth(1).selectOption('am');
    await page.waitForSelector('.holiday-summary');
    assert.match(await page.locator('.holiday-summary').textContent(), /Uses half a day/);
    await noErrors(app);
  } finally { await app.close(); }
});

test('phone-sized screen: remove holidays can still select everything at once', async () => {
  const app = await seeded({ viewport: { width: 390, height: 844 } });
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#holidays?tab=remove');
    await page.locator('.holidays-page input[type=date]').nth(0).fill('2027-01-01');
    await page.locator('.holidays-page input[type=date]').nth(1).fill('2027-01-31');
    await page.waitForSelector('tbody .checkbox-box');
    const rows = await page.locator('tbody .checkbox-box').count();
    assert.ok(rows > 1);
    // The table header (with its select-all box) is hidden on a phone, so there is a button instead.
    assert.equal(await page.locator('thead .checkbox-box').isVisible(), false);
    await page.getByRole('button', { name: `Select all ${rows}` }).click();
    assert.ok(await page.getByRole('button', { name: `Remove ${rows} selected` }).isVisible());
    await page.getByRole('button', { name: 'Clear selection' }).click();
    assert.ok(await page.getByRole('button', { name: 'Remove selected' }).isDisabled());
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(width <= 390, `page must not scroll sideways (was ${width}px)`);
    await noErrors(app);
  } finally { await app.close(); }
});

test('the year overview names the holiday year, not just a calendar year', async () => {
  const app = await seeded();
  const { page } = app;
  try {
    await page.goto(page.url().split('#')[0] + '#calendar?view=year&month=2027-02');
    await page.waitForSelector('.year-view');
    const select = page.locator('.calendar-nav select[aria-label="Holiday year"]');
    assert.equal(await select.locator('option:checked').textContent(), '2026/27', 'February 2027 sits in the 2026/27 holiday year');
    await select.selectOption('2025');
    await page.waitForSelector('.year-month-title:has-text("April 2025")');
    await noErrors(app);
  } finally { await app.close(); }
});
