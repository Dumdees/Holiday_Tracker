import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './helpers.js';
import { sampleDb } from '../../src/store/sample.js';

const TODAY = '2026-09-02';

test('a change in one window shows up in another window', async () => {
  const app = await openApp({ seed: sampleDb({ today: TODAY }), today: TODAY });
  const { page, context } = app;
  try {
    const second = await context.newPage();
    await second.goto(page.url().split('#')[0] + '#carers');
    await second.waitForSelector('.carer-card');
    const before = await second.locator('.carer-card').count();

    await page.goto(page.url().split('#')[0] + '#carers');
    await page.getByRole('button', { name: 'Add carer' }).first().click();
    await page.getByPlaceholder('e.g. Priya').fill('Second');
    await page.getByPlaceholder('e.g. Patel').fill('Window');
    await page.getByRole('button', { name: 'Add carer' }).last().click();
    await app.saved();

    await second.waitForSelector('.toast');
    await second.goto(second.url().split('#')[0] + '#carers');
    await second.waitForSelector('.carer-card');
    assert.equal(await second.locator('.carer-card').count(), before + 1, 'other window sees the new carer');
    assert.ok(await second.getByText('Second Window').isVisible());
    await second.close();
  } finally { await app.close(); }
});
