import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './helpers.js';
import { sampleDb } from '../../src/store/sample.js';

const TODAY = '2026-09-02';

test('Care Empire: visit a door, take somebody on, and the shop says what is worth buying', async () => {
  const app = await openApp({ seed: sampleDb({ today: TODAY }) });
  let { page } = app;
  const url = page.url().split('#')[0];
  try {
    await page.locator('.sidebar [data-nav="game"]').click();
    await page.waitForSelector('[data-test="clicker"]');
    await page.locator('[data-test="clicker"]').click();
    await page.locator('[data-test="clicker"]').click(); // the same door straight away: nothing
    assert.match(await page.locator('.game-funds-main').textContent(), /£[12]$/, 'at most two visits paid');
    assert.ok(await page.locator('[data-test="buy-carer"]').isDisabled(), 'cannot afford a carer yet');
    assert.match(await page.locator('[data-test="balance"]').textContent(), /wanted/, 'the balance strip says which side is behind');

    await page.waitForFunction(() => !!localStorage.getItem('mhm:game'), null, { timeout: 8000 });
    // Give the saved game a little money and two people to look after. A fresh page is used so the
    // old one cannot write its own copy over the top when it closes.
    const fresh = await app.context.newPage();
    await page.close();
    page = fresh;
    await page.goto(url + '#home');
    await page.waitForFunction(() => !document.querySelector('.loading-screen'));
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('mhm:game'));
      s.funds = 60; s.buildings = { client: 2 };
      localStorage.setItem('mhm:game', JSON.stringify(s));
    });
    await page.locator('.sidebar [data-nav="game"]').click();
    await page.waitForSelector('[data-test="clicker"]');
    assert.match(await page.locator('.game-funds-main').textContent(), /£60/);

    const carerRow = page.locator('[data-test="buy-carer"]');
    assert.match(await carerRow.textContent(), /pays for itself|earns nothing/, 'every row says when it pays for itself');
    await carerRow.click();
    assert.match(await page.locator('.game-funds-main').textContent(), /£45/, '60 - 15 = 45');
    assert.ok((await page.locator('.team-avatar').count()) >= 1, 'a carer avatar appears');
    const firstName = await page.evaluate(() => JSON.parse(localStorage.getItem('mhm:db')).carers.filter((c) => c.active).map((c) => c.firstName)[0]);
    assert.ok((await page.locator('.team-avatar').first().getAttribute('title')).includes(firstName), 'the team uses real carer names');

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

test('Care Empire: a big choice appears at the village, and picking one sticks', async () => {
  const app = await openApp({ seed: sampleDb({ today: TODAY }) });
  const { page } = app;
  try {
    await page.evaluate(() => {
      localStorage.setItem('mhm:game', JSON.stringify({
        version: 2, startedAt: Date.now(), runStartedAt: Date.now(), lastSeen: Date.now(),
        funds: 5e5, invoices: 0, runEarned: 5e5, lifetimeEarned: 5e5, visits: 900, clicks: 40, collections: 3,
        buildings: { carer: 30, client: 28, keysafe: 12, package: 6, car: 3 }, upgrades: ['admin'], branches: {},
        achievements: [], level: 1, starsEarned: 3, starsSpent: 0, perks: [], effects: [], spawn: null,
        spawnsThisRun: 1, cooldowns: {}, prismaticHires: [], prismaticsMet: 0, cardsOpened: 0,
        offlineReturns: 0, playedLate: false, adminTimer: 0, log: [],
      }));
    });
    await page.goto(page.url().split('#')[0] + '#game');
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('.loading-screen'));
    await page.waitForSelector('[data-test="clicker"]');
    await page.waitForSelector('[data-test="branch-buyer-private"]');
    assert.match(await page.locator('.branch-card').textContent(), /Who do you work for/);
    await page.locator('[data-test="branch-buyer-council"]').click();
    await page.waitForSelector('.branch-card', { state: 'detached' });
    const chosen = await page.evaluate(() => JSON.parse(localStorage.getItem('mhm:game')).branches);
    assert.equal(chosen.buyer, 'buyer-council', 'the choice is remembered');
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
