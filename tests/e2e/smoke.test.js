import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './helpers.js';

test('app opens from file:// and shows the shell', async () => {
  const app = await openApp();
  try {
    assert.ok(await app.page.locator('.sidebar .brand-name').textContent(), 'brand visible');
    assert.equal((await app.page.locator('.sidebar .brand-name').textContent()).trim(), 'Monteith Personal Care');
    assert.equal(app.errors.length, 0, 'no console errors: ' + app.errors.map((e) => e.message).join('; '));
  } finally { await app.close(); }
});

test('data persists across reload (IndexedDB on file://)', async () => {
  const app = await openApp();
  try {
    await app.page.evaluate(() => {
      // Change the company name via the store's persistence: simulate by writing through IndexedDB directly
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('monteith-holiday-manager', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('documents', 'readwrite');
          const store = tx.objectStore('documents');
          const get = store.get('db');
          get.onsuccess = () => {
            const doc = get.result || { schemaVersion: 1, settings: {}, carers: [], holidays: [] };
            doc.settings = { ...(doc.settings || {}), onboardingComplete: true, companyName: 'Persist Check Ltd' };
            store.put(doc, 'db');
          };
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
    await app.reload();
    assert.equal((await app.page.locator('.sidebar .brand-name').textContent()).trim(), 'Persist Check Ltd');
  } finally { await app.close(); }
});
