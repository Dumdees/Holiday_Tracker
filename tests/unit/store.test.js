import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, normalise } from '../../src/store/migrate.js';
import { createEmptyDb, SCHEMA_VERSION } from '../../src/store/defaults.js';
import * as store from '../../src/store/store.js';

test('migrate rejects rubbish and fills gaps', () => {
  assert.throws(() => migrate(null));
  assert.throws(() => migrate({ hello: 1 }));
  const doc = migrate({ carers: [{ id: 'c1', firstName: 'A' }], holidays: [{ id: 'h1', carerId: 'c1', start: '2026-01-01', end: '2026-01-02' }] });
  assert.equal(doc.schemaVersion, SCHEMA_VERSION);
  assert.equal(doc.settings.companyName, 'Monteith Personal Care');
  assert.deepEqual(doc.carers[0].workingDays, [1, 2, 3, 4, 5]);
  assert.equal(doc.carers[0].active, true);
  assert.equal(doc.holidays[0].status, 'approved');
  assert.ok(doc.leaveTypes.length > 0);
  assert.deepEqual(doc.bankHolidayOverrides, { added: [], removed: [] });
});

test('normalise keeps user settings', () => {
  const d = createEmptyDb();
  d.settings.companyName = 'Test Care';
  d.settings.holidayYearStart = { month: 1, day: 1 };
  const n = normalise(d);
  assert.equal(n.settings.companyName, 'Test Care');
  assert.deepEqual(n.settings.holidayYearStart, { month: 1, day: 1 });
});

test('store actions: carers, holidays, undo', async () => {
  store.db.value = createEmptyDb();
  const id = store.addCarer({ firstName: 'Priya', lastName: 'Patel', entitlementDays: 25 });
  assert.ok(id.startsWith('carer_'));
  assert.equal(store.carers.value.length, 1);
  assert.equal(store.carerName(id), 'Priya Patel');
  assert.ok(store.carers.value[0].colour);

  const [h1] = store.addHolidays({ carerId: id, start: '2026-04-06', end: '2026-04-03', typeId: 'lt_annual' });
  const hol = store.holidays.value.find((h) => h.id === h1);
  assert.equal(hol.start, '2026-04-03', 'dates are swapped into order');
  assert.equal(hol.end, '2026-04-06');
  assert.ok(hol.batchId);

  store.updateHoliday(h1, { halfDay: 'am' });
  assert.equal(store.holidays.value[0].halfDay, null, 'half day cleared on multi-day ranges');
  store.updateHoliday(h1, { end: '2026-04-03', halfDay: 'pm' });
  assert.equal(store.holidays.value[0].halfDay, 'pm');

  store.setHolidayStatus(h1, 'pending');
  assert.equal(store.holidays.value[0].status, 'pending');

  assert.ok(store.canUndo.value);
  store.undo();
  assert.equal(store.holidays.value[0].status, 'approved');

  store.removeCarer(id);
  assert.equal(store.carers.value.length, 0);
  assert.equal(store.holidays.value.length, 0, 'holidays removed with the carer');
  store.undo();
  assert.equal(store.carers.value.length, 1);
  assert.equal(store.holidays.value.length, 1);
  await store.whenSaved();
});

test('store actions: teams, leave types, bank holiday overrides, import/export', () => {
  store.db.value = createEmptyDb();
  const teamId = store.addTeam({ name: '  Day team ' });
  assert.equal(store.teamName(teamId), 'Day team');
  const cid = store.addCarer({ firstName: 'A', lastName: 'B', teamId });
  store.removeTeam(teamId);
  assert.equal(store.carersById.value.get(cid).teamId, null);

  const lt = store.addLeaveType({ name: 'Jury service' });
  assert.equal(store.removeLeaveType(lt), 'deleted');
  const lt2 = store.addLeaveType({ name: 'Study leave', deductsEntitlement: true });
  store.addHolidays({ carerId: cid, start: '2026-05-01', end: '2026-05-01', typeId: lt2 });
  assert.equal(store.removeLeaveType(lt2), 'archived');
  assert.equal(store.leaveTypesById.value.get(lt2).archived, true);

  store.addCustomBankHoliday({ date: '2026-07-10', name: 'Office closure' });
  store.removeBankHoliday('2026-12-25');
  assert.deepEqual(store.db.value.bankHolidayOverrides.added, [{ date: '2026-07-10', name: 'Office closure' }]);
  assert.deepEqual(store.db.value.bankHolidayOverrides.removed, ['2026-12-25']);
  store.restoreBankHoliday('2026-12-25');
  assert.deepEqual(store.db.value.bankHolidayOverrides.removed, []);
  store.removeBankHoliday('2026-07-10');
  assert.deepEqual(store.db.value.bankHolidayOverrides.added, []);
  assert.deepEqual(store.db.value.bankHolidayOverrides.removed, [], 'removing a custom day does not add it to removed');

  const json = store.exportJson();
  assert.ok(json.includes('"app": "Monteith Holiday Manager"'));
  store.db.value = createEmptyDb();
  store.importJson(json);
  assert.equal(store.carers.value.length, 1);
  assert.equal(store.settings.value.onboardingComplete, true);
  assert.throws(() => store.importJson('not json'), /couldn’t be read/);
  assert.throws(() => store.importJson('{"x":1}'), /isn’t a Holiday Manager backup/);
});
