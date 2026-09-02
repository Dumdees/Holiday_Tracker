import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyDb } from '../../src/store/defaults.js';
import { buildContext } from '../../src/core/context.js';
import { findClashes, checkBatch, existingProblems, offOnDay } from '../../src/core/clashes.js';

function fixture() {
  const db = createEmptyDb();
  db.settings.holidayYearStart = { month: 4, day: 1 };
  db.settings.bankHolidayRegion = 'none';
  db.settings.defaultMaxOffPerDay = 1;
  db.teams = [{ id: 'team_day', name: 'Day team', colour: '#f00', maxOffPerDay: null }, { id: 'team_night', name: 'Night team', colour: '#00f', maxOffPerDay: 0 }];
  const carer = (id, firstName, teamId, extra = {}) => ({ id, firstName, lastName: 'Test', role: 'Carer', teamId, startDate: '2020-01-01', endDate: null, workingDays: [1, 2, 3, 4, 5], entitlementDays: 20, active: true, mustNotBeOffWith: [], adjustments: [], ...extra });
  db.carers = [
    carer('c1', 'Sam', 'team_day'),
    carer('c2', 'Priya', 'team_day', { mustNotBeOffWith: ['c3'] }),
    carer('c3', 'Morag', 'team_day', { workingDays: [1, 3, 5] }),
    carer('c4', 'Ewan', 'team_night', { active: false }),
    carer('c5', 'Isla', 'team_day', { startDate: '2026-10-01', endDate: '2027-01-31' }),
  ];
  db.holidays = [
    { id: 'h1', carerId: 'c1', start: '2026-09-07', end: '2026-09-11', typeId: 'lt_annual', status: 'approved', halfDay: null },
    { id: 'h2', carerId: 'c3', start: '2026-09-09', end: '2026-09-09', typeId: 'lt_annual', status: 'approved', halfDay: null },
    { id: 'h3', carerId: 'c2', start: '2026-05-04', end: '2026-05-22', typeId: 'lt_annual', status: 'approved', halfDay: null }, // 15 days
    { id: 'h4', carerId: 'c1', start: '2026-09-14', end: '2026-09-15', typeId: 'lt_annual', status: 'declined', halfDay: null },
  ];
  return db;
}
const ctx = (db) => buildContext(db, { today: '2026-09-01' });

test('overlap blocks, declined ignored', () => {
  const db = fixture();
  const c = findClashes({ carerId: 'c1', start: '2026-09-10', end: '2026-09-12', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  assert.equal(c[0].kind, 'overlap');
  assert.equal(c[0].severity, 'block');
  assert.match(c[0].message, /Sam is already off Mon 7 – Fri 11 Sep 2026/);
  const d = findClashes({ carerId: 'c1', start: '2026-09-14', end: '2026-09-15', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  assert.ok(!d.some((x) => x.kind === 'overlap'), 'declined holiday does not overlap');
  const e = findClashes({ carerId: 'c1', start: '2026-09-10', end: '2026-09-12', typeId: 'lt_annual', status: 'approved' }, db, ctx(db), { ignoreHolidayIds: ['h1'] });
  assert.ok(!e.some((x) => x.kind === 'overlap'), 'ignored when editing');
});

test('staffing warns with team limit and lists the others', () => {
  const db = fixture();
  const c = findClashes({ carerId: 'c2', start: '2026-09-09', end: '2026-09-09', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  const st = c.find((x) => x.kind === 'staffing');
  assert.ok(st, 'staffing clash');
  assert.match(st.message, /3 people in Day team would be off on Wed 9 Sep 2026 – the limit is 1/);
  assert.match(st.details, /Also off: /);
  assert.deepEqual(st.dates, ['2026-09-09']);
  const pairing = c.find((x) => x.kind === 'pairing');
  assert.ok(pairing, 'pairing clash with Morag');
  assert.match(pairing.message, /Priya and Morag shouldn’t be off at the same time/);
  // Night team has no limit
  db.carers.push({ ...db.carers[0], id: 'c6', firstName: 'Ann', teamId: 'team_night' });
  db.holidays.push({ id: 'h5', carerId: 'c6', start: '2026-09-09', end: '2026-09-09', typeId: 'lt_annual', status: 'approved' });
  const n = findClashes({ carerId: 'c4', start: '2026-09-09', end: '2026-09-09', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  assert.ok(!n.some((x) => x.kind === 'staffing'));
  assert.ok(n.some((x) => x.kind === 'inactive'));
});

test('entitlement, working days and employment warnings', () => {
  const db = fixture();
  const c = findClashes({ carerId: 'c2', start: '2026-10-05', end: '2026-10-16', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  const ent = c.find((x) => x.kind === 'entitlement');
  assert.ok(ent, 'entitlement warning');
  assert.match(ent.message, /Only 5 days left in 2026\/27 – this would take Priya to -5/);
  const sick = findClashes({ carerId: 'c2', start: '2026-10-05', end: '2026-10-16', typeId: 'lt_sick', status: 'approved' }, db, ctx(db));
  assert.ok(!sick.some((x) => x.kind === 'entitlement'), 'sick leave does not check entitlement');
  const wk = findClashes({ carerId: 'c3', start: '2026-09-15', end: '2026-09-15', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  assert.match(wk.find((x) => x.kind === 'no-working-days').message, /None of these dates are working days for Morag \(Morag works Mon, Wed, Fri\)/);
  const emp = findClashes({ carerId: 'c5', start: '2026-09-28', end: '2026-09-29', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  assert.match(emp.find((x) => x.kind === 'outside-employment').message, /Isla’s start date is Thu 1 Oct 2026, after this holiday begins/);
  const leave = findClashes({ carerId: 'c5', start: '2027-02-01', end: '2027-02-02', typeId: 'lt_annual', status: 'approved' }, db, ctx(db));
  assert.match(leave.find((x) => x.kind === 'outside-employment').message, /Isla leaves on Sun 31 Jan 2027, before this holiday ends/);
  assert.deepEqual(findClashes({ carerId: 'nope', start: '2026-09-01', end: '2026-09-01', typeId: 'lt_annual', status: 'approved' }, db, ctx(db)).map((x) => x.severity), ['block']);
});

test('checkBatch sees earlier proposals', () => {
  const db = fixture();
  const rows = checkBatch([
    { carerId: 'c1', start: '2026-10-05', end: '2026-10-05', typeId: 'lt_annual', status: 'approved' },
    { carerId: 'c2', start: '2026-10-05', end: '2026-10-05', typeId: 'lt_annual', status: 'approved' },
    { carerId: 'c1', start: '2026-09-08', end: '2026-09-08', typeId: 'lt_annual', status: 'approved' },
  ], db, ctx(db));
  assert.equal(rows[0].clashes.length, 0);
  assert.equal(rows[0].days, 1);
  assert.ok(rows[1].clashes.some((x) => x.kind === 'staffing'), 'second sees the first');
  assert.equal(rows[2].blocked, true);
});

test('existingProblems finds overlaps, staffing and pairing', () => {
  const db = fixture();
  db.holidays.push({ id: 'h6', carerId: 'c2', start: '2026-09-09', end: '2026-09-10', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 'h7', carerId: 'c1', start: '2026-09-11', end: '2026-09-12', typeId: 'lt_annual', status: 'approved' });
  const p = existingProblems(db, ctx(db), { start: '2026-09-01', end: '2026-09-30' });
  const kinds = p.map((x) => x.kind);
  assert.ok(kinds.includes('overlap'));
  assert.ok(kinds.includes('staffing'));
  assert.ok(kinds.includes('pairing'));
  const st = p.find((x) => x.kind === 'staffing');
  assert.match(st.message, /people in Day team are off on/);
  assert.equal(offOnDay('2026-09-09', db, ctx(db), { teamId: 'team_day' }).length, 3);
});
