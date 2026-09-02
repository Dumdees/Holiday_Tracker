// Saves the one big document in the browser. IndexedDB first (roomy and durable),
// with localStorage as a safety-net copy. Everything stays on this computer.
const DB_NAME = 'monteith-holiday-manager';
const STORE = 'documents';
const KEY = 'db';
const LS_KEY = 'mhm:db';
const LS_MIRROR_LIMIT = 3 * 1024 * 1024; // only mirror to localStorage below ~3MB

let engine = 'memory';
let memoryDoc = null;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
  });
}

function lsGet() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsSet(doc) {
  try {
    const raw = JSON.stringify(doc);
    if (raw.length > LS_MIRROR_LIMIT) return false;
    localStorage.setItem(LS_KEY, raw);
    return true;
  } catch { return false; }
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return String(b.savedAt || '') > String(a.savedAt || '') ? b : a;
}

/** Load the saved document, or null if this is a brand-new install. */
export async function load() {
  let fromIdb = null;
  try {
    const db = await openDb();
    fromIdb = await idbGet(db, KEY);
    db.close();
    engine = 'IndexedDB';
  } catch (err) {
    console.warn('IndexedDB not usable, falling back to localStorage', err);
    try {
      localStorage.setItem('mhm:probe', '1');
      localStorage.removeItem('mhm:probe');
      engine = 'localStorage';
    } catch {
      engine = 'memory';
      return memoryDoc;
    }
  }
  // The localStorage copy is written synchronously on every change, so it can be
  // newer than IndexedDB if the window was closed a moment after a change.
  return newer(fromIdb, lsGet());
}

/** Save the whole document. The quick copy is written immediately; the durable one shortly after. */
export async function save(doc) {
  if (engine === 'memory') { memoryDoc = doc; return; }
  const mirrored = lsSet(doc);
  if (engine === 'localStorage') {
    if (!mirrored) throw new Error('Could not save – browser storage is full');
    return;
  }
  const db = await openDb();
  try { await idbPut(db, KEY, doc); } finally { db.close(); }
}

/** Wipe everything this app has stored in the browser. */
export async function clearAll() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* ignore */ }
  memoryDoc = null;
}

export function storageEngine() { return engine; }

export function approximateSizeBytes(doc) {
  try { return new Blob([JSON.stringify(doc)]).size; } catch { return JSON.stringify(doc).length; }
}
