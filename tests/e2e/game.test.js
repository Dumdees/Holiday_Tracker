import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './helpers.js';
import { sampleDb } from '../../src/store/sample.js';

const TODAY = '2026-09-02';

test('Care Empire: visit a home (with a cooldown), collect payments, hire a carer named after a real one, and it saves', async () => {
  const app = await openApp({ seed: sampleDb({ today: TODAY }) });
  let { page } = app;
  const url = page.url().split('#')[0];
  try {
    await page.locator('.sidebar [data-nav="game"]').click();
    await page.waitForSelector('[data-test="clicker"]');
    await page.locator('[data-test="clicker"]').click();
    await page.locator('[data-test="clicker"]').click(); // the same home straight away: nothing
    assert.match(await page.locator('.game-funds-main').textContent(), /£1$/, 'one visit paid, the second was too soon');
    assert.ok(await page.locator('[data-test="buy-carer"]').isDisabled(), 'cannot afford a carer yet');
    await page.waitForFunction(() => !!localStorage.getItem('mhm:game'), null, { timeout: 8000 });
    // Give the saved game a little money and a second home. A fresh page is used so the old one
    // cannot write its own copy over the top when it closes.
    const fresh = await app.context.newPage();
    await page.close();
    page = fresh;
    await page.goto(url + '#home');
    await page.waitForFunction(() => !document.querySelector('.loading-screen'));
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('mhm:game'));
      s.funds = 30; s.buildings = { home: 2 };
      localStorage.setItem('mhm:game', JSON.stringify(s));
    });
    await page.locator('.sidebar [data-nav="game"]').click();
    await page.waitForSelector('[data-test="clicker"]');
    assert.match(await page.locator('.game-funds-main').textContent(), /£30/);
    await page.locator('[data-test="buy-carer"]').click();
    assert.match(await page.locator('.game-funds-main').textContent(), /£15/, '30 - 15 = 15');
    assert.ok((await page.locator('.team-avatar').count()) >= 1, 'a carer avatar appears');
    const firstName = await page.evaluate(() => JSON.parse(localStorage.getItem('mhm:db')).carers.filter((c) => c.active).map((c) => c.firstName)[0]);
    assert.ok((await page.locator('.team-avatar').first().getAttribute('title')).includes(firstName), 'team uses real carer names');
    await page.waitForFunction(() => !document.querySelector('[data-test="collect"]').disabled, null, { timeout: 15000 });
    await page.locator('[data-test="collect"]').click();
    await page.waitForFunction(() => document.querySelector('[data-test="collect"]').disabled);
    await page.waitForTimeout(4500); // auto-save
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.loading-screen'));
    await page.locator('.sidebar [data-nav="game"]').click();
    await page.waitForSelector('[data-test="clicker"]');
    assert.ok((await page.locator('.team-avatar').count()) >= 1, 'progress survived a reload');
    assert.equal(app.errors.length, 0, app.errors.map((e) => e.message).join(' | '));
  } finally { await app.close(); }
});

test('Care Empire can be hidden from the menu in Settings', async () => {
  const app = await openApp({ seed: sampleDb({ today: TODAY }) });
  const { page } = app;
  try {
    assert.equal(await page.locator('.sidebar [data-nav="game"]').count(), 1);
    await page.goto(page.url().split('#')[0] + '#settings?tab=general');
    await page.getByText('Show Care Empire in the menu').click();
    await page.waitForSelector('.toast');
    assert.equal(await page.locator('.sidebar [data-nav="game"]').count(), 0, 'hidden');
    await page.goto(page.url().split('#')[0] + '#game');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-test="clicker"]').count(), 0, 'direct link falls back to Home');
    await page.goto(page.url().split('#')[0] + '#settings?tab=general');
    await page.getByText('Show Care Empire in the menu').click();
    assert.equal(await page.locator('.sidebar [data-nav="game"]').count(), 1, 'back again');
  } finally { await app.close(); }
});
