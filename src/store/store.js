// The single source of truth. `db` holds the whole document; every change goes
// through an action below so it is saved, undoable and validated in one place.
import { signal, computed, batch } from '@preact/signals';
import * as storage from './storage.js';
import { migrate, normalise } from './migrate.js';
import { createEmptyDb, newCarerRecord, newHolidayRecord, PALETTE } from './defaults.js';
import { newId } from './ids.js';

export const db = signal(null);
export const ready = signal(false);
export const saveState = signal('saved'); // 'saved' | 'saving' | 'error'
export const saveError = signal(null);
export const undoStack = signal([]); // [{ label, snapshot }]
export const lastChange = signal(null); // { label, at } – for toasts
export const notice = signal(null); // { message, at } – information toasts with no undo

const UNDO_LIMIT = 25;
let saveTimer = null;
let pendingSave = null;

export async function initStore() {
  let doc = null;
  try {
    doc = await storage.load();
  } catch (err) {
    console.error('Could not load saved data', err);
  }
  db.value = doc ? normalise(migrate(doc)) : createEmptyDb();
  ready.value = true;
  if (typeof window !== 'undefined') {
    // If the app is open in another window and saves there, pick up the newer copy here.
    window.addEventListener('storage', (e) => {
      if (e.key !== 'mhm:db' || !e.newValue) return;
      try {
        const incoming = JSON.parse(e.newValue);
        if (String(incoming.savedAt || '') > String(db.value?.savedAt || '')) {
          batch(() => {
            db.value = normalise(incoming);
            undoStack.value = [];
            notice.value = { message: 'Updated with changes made in another window', at: Date.now() };
          });
        }
      } catch { /* ignore */ }
    });
    window.addEventListener('beforeunload', (e) => {
      if (saveTimer) { flushSave(); }
      if (saveState.value === 'saving') { e.preventDefault(); e.returnValue = ''; }
    });
  }
}

function scheduleSave() {
  saveState.value = 'saving';
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 120);
}

function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const doc = db.value;
  pendingSave = storage.save(doc)
    .then(() => { if (db.value === doc) saveState.value = 'saved'; saveError.value = null; })
    .catch((err) => { saveState.value = 'error'; saveError.value = err?.message || String(err); console.error(err); });
  return pendingSave;
}

/** Wait until everything is written (used by tests and before backups). */
export async function whenSaved() {
  if (saveTimer) await flushSave();
  else if (pendingSave) await pendingSave;
}

/**
 * Apply a change. `mutator` receives a deep copy of the document and edits it
 * freely. The result is stored, saved and pushed onto the undo stack.
 */
export function commit(label, mutator, { undoable = true } = {}) {
  const prev = db.value;
  const draft = structuredClone(prev);
  const result = mutator(draft);
  draft.savedAt = new Date().toISOString();
  batch(() => {
    db.value = draft;
    if (undoable) {
      const next = [...undoStack.value, { label, snapshot: prev }];
      undoStack.value = next.slice(-UNDO_LIMIT);
    } else {
      undoStack.value = [];
    }
    lastChange.value = { label, at: Date.now() };
  });
  scheduleSave();
  return result;
}

export const canUndo = computed(() => undoStack.value.length > 0);
export const undoLabel = computed(() => undoStack.value.at(-1)?.label || '');

export function undo() {
  const stack = undoStack.value;
  if (!stack.length) return false;
  const { label, snapshot } = stack[stack.length - 1];
  const restored = { ...snapshot, savedAt: new Date().toISOString() };
  batch(() => {
    db.value = restored;
    undoStack.value = stack.slice(0, -1);
    lastChange.value = { label: `Undid: ${label}`, at: Date.now() };
  });
  scheduleSave();
  return true;
}

// ---------- Lookups (recomputed automatically when db changes) ----------
export const settings = computed(() => db.value?.settings);
export const carers = computed(() => db.value?.carers ?? []);
export const holidays = computed(() => db.value?.holidays ?? []);
export const teams = computed(() => db.value?.teams ?? []);
export const leaveTypes = computed(() => db.value?.leaveTypes ?? []);
export const carersById = computed(() => new Map(carers.value.map((c) => [c.id, c])));
export const teamsById = computed(() => new Map(teams.value.map((t) => [t.id, t])));
export const leaveTypesById = computed(() => new Map(leaveTypes.value.map((t) => [t.id, t])));
export const activeCarers = computed(() => carers.value.filter((c) => c.active));

export function carerName(carerOrId) {
  const c = typeof carerOrId === 'string' ? carersById.value.get(carerOrId) : carerOrId;
  if (!c) return 'Unknown carer';
  return `${c.firstName} ${c.lastName}`.trim() || 'Unnamed carer';
}

export function teamName(teamId) {
  return teamsById.value.get(teamId)?.name || 'No team';
}

export function leaveTypeName(typeId) {
  return leaveTypesById.value.get(typeId)?.name || 'Leave';
}

function pickColour(used) {
  const counts = new Map(PALETTE.map((c) => [c, 0]));
  for (const u of used) if (counts.has(u)) counts.set(u, counts.get(u) + 1);
  let best = PALETTE[0], bestN = Infinity;
  for (const [c, n] of counts) if (n < bestN) { best = c; bestN = n; }
  return best;
}


/** Keep "must not be off with" symmetrical: if A lists B, B lists A. */
function syncPairings(d, carerId, ids) {
  const wanted = new Set((ids || []).filter((x) => x && x !== carerId && d.carers.some((c) => c.id === x)));
  const me = d.carers.find((c) => c.id === carerId);
  if (me) me.mustNotBeOffWith = [...wanted];
  for (const c of d.carers) {
    if (c.id === carerId) continue;
    const has = (c.mustNotBeOffWith || []).includes(carerId);
    if (wanted.has(c.id) && !has) c.mustNotBeOffWith = [...(c.mustNotBeOffWith || []), carerId];
    if (!wanted.has(c.id) && has) c.mustNotBeOffWith = c.mustNotBeOffWith.filter((x) => x !== carerId);
  }
}

// ---------- Carers ----------
export function addCarer(data) {
  return commit('Added carer', (d) => {
    const colour = data.colour || pickColour(d.carers.map((c) => c.colour));
    const carer = newCarerRecord({ ...data, id: newId('carer'), colour }, d.settings);
    d.carers.push(carer);
    syncPairings(d, carer.id, data.mustNotBeOffWith);
    return carer.id;
  });
}

export function addCarers(list) {
  return commit(`Added ${list.length} carers`, (d) => {
    const ids = [];
    for (const data of list) {
      const colour = data.colour || pickColour(d.carers.map((c) => c.colour));
      const carer = newCarerRecord({ ...data, id: newId('carer'), colour }, d.settings);
      d.carers.push(carer);
      ids.push(carer.id);
    }
    return ids;
  });
}

export function updateCarer(id, patch) {
  return commit('Updated carer', (d) => {
    const c = d.carers.find((x) => x.id === id);
    if (!c) return false;
    Object.assign(c, patch, { updatedAt: new Date().toISOString() });
    if (patch.mustNotBeOffWith) syncPairings(d, id, patch.mustNotBeOffWith);
    return true;
  });
}

export function setCarerActive(id, active) {
  return commit(active ? 'Reactivated carer' : 'Archived carer', (d) => {
    const c = d.carers.find((x) => x.id === id);
    if (c) { c.active = active; c.updatedAt = new Date().toISOString(); }
  });
}

/** Removes the carer AND all their holidays. Undoable. */
export function removeCarer(id) {
  return commit('Removed carer', (d) => {
    d.carers = d.carers.filter((c) => c.id !== id);
    d.holidays = d.holidays.filter((h) => h.carerId !== id);
    for (const c of d.carers) c.mustNotBeOffWith = (c.mustNotBeOffWith || []).filter((x) => x !== id);
  });
}

export function addAdjustment(carerId, { yearKey, days, reason }) {
  return commit('Adjusted entitlement', (d) => {
    const c = d.carers.find((x) => x.id === carerId);
    if (!c) return null;
    const adj = { id: newId('adj'), yearKey: String(yearKey), days: Number(days), reason: reason || '', createdAt: new Date().toISOString() };
    c.adjustments = [...(c.adjustments || []), adj];
    c.updatedAt = new Date().toISOString();
    return adj.id;
  });
}

export function removeAdjustment(carerId, adjustmentId) {
  return commit('Removed entitlement adjustment', (d) => {
    const c = d.carers.find((x) => x.id === carerId);
    if (!c) return;
    c.adjustments = (c.adjustments || []).filter((a) => a.id !== adjustmentId);
    c.updatedAt = new Date().toISOString();
  });
}

// ---------- Holidays ----------
/** Add one or many holidays. Returns the new ids. All share one batchId. */
export function addHolidays(list, label) {
  const items = Array.isArray(list) ? list : [list];
  const batchId = newId('batch');
  return commit(label || (items.length === 1 ? 'Added holiday' : `Added ${items.length} holidays`), (d) => {
    const ids = [];
    for (const data of items) {
      const h = newHolidayRecord({ ...data, id: newId('hol'), batchId });
      if (h.start > h.end) [h.start, h.end] = [h.end, h.start];
      if (h.start !== h.end) h.halfDay = null;
      d.holidays.push(h);
      ids.push(h.id);
    }
    return ids;
  });
}

export function updateHoliday(id, patch) {
  return commit('Updated holiday', (d) => {
    const h = d.holidays.find((x) => x.id === id);
    if (!h) return false;
    Object.assign(h, patch, { updatedAt: new Date().toISOString() });
    if (h.start > h.end) [h.start, h.end] = [h.end, h.start];
    if (h.start !== h.end) h.halfDay = null;
    return true;
  });
}

export function setHolidayStatus(ids, status) {
  const list = Array.isArray(ids) ? ids : [ids];
  const labels = { approved: 'Approved', pending: 'Marked as awaiting approval', declined: 'Declined' };
  return commit(`${labels[status] || 'Updated'} ${list.length === 1 ? 'holiday' : list.length + ' holidays'}`, (d) => {
    const set = new Set(list);
    for (const h of d.holidays) if (set.has(h.id)) { h.status = status; h.updatedAt = new Date().toISOString(); }
  });
}

export function removeHolidays(ids, label) {
  const list = Array.isArray(ids) ? ids : [ids];
  return commit(label || (list.length === 1 ? 'Removed holiday' : `Removed ${list.length} holidays`), (d) => {
    const set = new Set(list);
    d.holidays = d.holidays.filter((h) => !set.has(h.id));
  });
}

// ---------- Settings, teams, leave types ----------
export function updateSettings(patch, label = 'Updated settings') {
  return commit(label, (d) => { Object.assign(d.settings, patch); }, { undoable: false });
}

/**
 * Make the team list match these names (used by the welcome screen). Existing teams whose
 * name matches (ignoring case) are kept, new names are added, the rest are removed.
 */
export function setTeams(names) {
  return commit('Set up teams', (d) => {
    const clean = [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))];
    const keep = [];
    for (const name of clean) {
      const existing = d.teams.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (existing) keep.push(existing);
      else keep.push({ id: newId('team'), name, colour: pickColour([...d.teams, ...keep].map((t) => t.colour)), maxOffPerDay: null });
    }
    const keptIds = new Set(keep.map((t) => t.id));
    for (const c of d.carers) if (c.teamId && !keptIds.has(c.teamId)) c.teamId = null;
    d.teams = keep;
    return keep.map((t) => t.id);
  }, { undoable: false });
}

export function addTeam({ name, colour, maxOffPerDay = null }) {
  return commit('Added team', (d) => {
    const team = { id: newId('team'), name: name.trim(), colour: colour || pickColour(d.teams.map((t) => t.colour)), maxOffPerDay };
    d.teams.push(team);
    return team.id;
  });
}

export function updateTeam(id, patch) {
  return commit('Updated team', (d) => {
    const t = d.teams.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  });
}

/** Removes a team; carers in it are left with "No team". */
export function removeTeam(id) {
  return commit('Removed team', (d) => {
    d.teams = d.teams.filter((t) => t.id !== id);
    for (const c of d.carers) if (c.teamId === id) c.teamId = null;
  });
}

export function addLeaveType({ name, colour, deductsEntitlement = false }) {
  return commit('Added leave type', (d) => {
    const lt = { id: newId('lt'), name: name.trim(), colour: colour || pickColour(d.leaveTypes.map((t) => t.colour)), deductsEntitlement: !!deductsEntitlement, builtIn: false, archived: false };
    d.leaveTypes.push(lt);
    return lt.id;
  });
}

export function updateLeaveType(id, patch) {
  return commit('Updated leave type', (d) => {
    const t = d.leaveTypes.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  });
}

/** Deletes a leave type if unused, otherwise archives it (hidden from dropdowns). */
export function removeLeaveType(id) {
  return commit('Removed leave type', (d) => {
    const used = d.holidays.some((h) => h.typeId === id);
    if (used) {
      const t = d.leaveTypes.find((x) => x.id === id);
      if (t) t.archived = true;
      return 'archived';
    }
    d.leaveTypes = d.leaveTypes.filter((t) => t.id !== id);
    return 'deleted';
  });
}

// ---------- Bank holiday overrides ----------
export function addCustomBankHoliday({ date, name }) {
  return commit('Added bank holiday', (d) => {
    d.bankHolidayOverrides.added = d.bankHolidayOverrides.added.filter((b) => b.date !== date);
    d.bankHolidayOverrides.added.push({ date, name: name || 'Bank holiday' });
    d.bankHolidayOverrides.removed = d.bankHolidayOverrides.removed.filter((x) => x !== date);
  });
}

export function removeBankHoliday(date) {
  return commit('Removed bank holiday', (d) => {
    const wasCustom = d.bankHolidayOverrides.added.some((b) => b.date === date);
    d.bankHolidayOverrides.added = d.bankHolidayOverrides.added.filter((b) => b.date !== date);
    if (!wasCustom && !d.bankHolidayOverrides.removed.includes(date)) d.bankHolidayOverrides.removed.push(date);
  });
}

export function restoreBankHoliday(date) {
  return commit('Restored bank holiday', (d) => {
    d.bankHolidayOverrides.removed = d.bankHolidayOverrides.removed.filter((x) => x !== date);
  });
}

// ---------- Whole-document operations ----------
export function exportJson() {
  const doc = { ...db.value, exportedAt: new Date().toISOString(), app: 'Monteith Holiday Manager', appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev' };
  return JSON.stringify(doc, null, 2);
}

/** Replace everything with a backup file's contents. Throws a friendly error if invalid. */
export function importJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file couldn’t be read. Please choose a backup file saved by this app.'); }
  const doc = normalise(migrate(parsed));
  doc.settings.onboardingComplete = true;
  return commit('Restored from backup', (d) => { Object.assign(d, doc); Object.keys(d).forEach((k) => { if (!(k in doc)) delete d[k]; }); });
}

export function replaceDb(doc, label = 'Replaced all data') {
  const clean = normalise(doc);
  return commit(label, (d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, clean); });
}

export async function resetAll() {
  const fresh = createEmptyDb();
  batch(() => { db.value = fresh; undoStack.value = []; lastChange.value = { label: 'Cleared all data', at: Date.now() }; });
  await storage.clearAll();
  try { localStorage.removeItem('mhm:game'); } catch { /* ignore */ }
  await flushSave();
}

export function markBackedUp() {
  updateSettings({ lastBackupAt: new Date().toISOString() }, 'Backup saved');
}

export function storageInfo() {
  return { engine: storage.storageEngine(), sizeBytes: db.value ? storage.approximateSizeBytes(db.value) : 0 };
}
