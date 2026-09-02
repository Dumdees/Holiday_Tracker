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

// ---------- Extra edge cases ----------
import { sampleDb } from '../../src/store/sample.js';
import { usageForYear } from '../../src/core/entitlement.js';
import { yearBounds } from '../../src/core/holidayYear.js';

const propose = (carerId, start, end, extra = {}) => ({ carerId, start, end, typeId: 'lt_annual', status: 'approved', halfDay: null, ...extra });
const kinds = (list) => list.map((x) => x.kind);

test('half days: morning and afternoon of the same day can sit side by side, two mornings cannot', () => {
  const db = fixture();
  db.holidays.push({ id: 'am', carerId: 'c1', start: '2026-09-21', end: '2026-09-21', typeId: 'lt_annual', status: 'approved', halfDay: 'am' });
  assert.ok(!kinds(findClashes(propose('c1', '2026-09-21', '2026-09-21', { halfDay: 'pm' }), db, ctx(db))).includes('overlap'));
  const same = findClashes(propose('c1', '2026-09-21', '2026-09-21', { halfDay: 'am' }), db, ctx(db));
  assert.equal(same[0].kind, 'overlap');
  assert.match(same[0].message, /Sam is already off Mon 21 Sep 2026 \(morning\)/);
  assert.ok(kinds(findClashes(propose('c1', '2026-09-21', '2026-09-21'), db, ctx(db))).includes('overlap'), 'a full day still collides with a half');
  assert.ok(kinds(findClashes(propose('c1', '2026-09-21', '2026-09-22', { halfDay: 'pm' }), db, ctx(db))).includes('overlap'), 'halfDay on a range is ignored');
  // The same rule in existingProblems.
  db.holidays.push({ id: 'pm', carerId: 'c1', start: '2026-09-21', end: '2026-09-21', typeId: 'lt_annual', status: 'approved', halfDay: 'pm' });
  assert.ok(!kinds(existingProblems(db, ctx(db), { start: '2026-09-01', end: '2026-09-30' })).includes('overlap'));
  // Both halves together use a whole day of entitlement.
  assert.equal(usageForYear(db.carers[0], yearBounds(2026, db.settings), db.holidays, ctx(db)).booked, 5 + 1);
});

test('swapped dates are put the right way round and a pending overlap still blocks', () => {
  const db = fixture();
  const c = findClashes(propose('c1', '2026-09-12', '2026-09-10'), db, ctx(db));
  assert.equal(c[0].kind, 'overlap');
  db.holidays.push({ id: 'p', carerId: 'c2', start: '2026-11-02', end: '2026-11-03', typeId: 'lt_annual', status: 'pending' });
  assert.ok(kinds(findClashes(propose('c2', '2026-11-03', '2026-11-03'), db, ctx(db))).includes('overlap'));
  assert.deepEqual(findClashes(propose('c1', '', ''), db, ctx(db)), []);
  assert.deepEqual(findClashes(propose('c1', '2026-02-30', '2026-03-01'), db, ctx(db)), []);
});

test('staffing only counts people who would really be at work that day', () => {
  const db = fixture();
  // Morag works Mon/Wed/Fri: her Tue 15 Sep – Thu 17 Sep holiday only takes her away on the Wednesday.
  db.holidays.push({ id: 'm', carerId: 'c3', start: '2026-09-15', end: '2026-09-17', typeId: 'lt_annual', status: 'approved' });
  assert.ok(!kinds(findClashes(propose('c2', '2026-09-15', '2026-09-15'), db, ctx(db))).includes('staffing'), 'Tuesday is not Morag’s day');
  assert.ok(kinds(findClashes(propose('c2', '2026-09-16', '2026-09-16'), db, ctx(db))).includes('staffing'), 'Wednesday is');
  // An archived carer's holiday, and one from before someone started, never count.
  db.holidays.push({ id: 'e', carerId: 'c4', start: '2026-09-22', end: '2026-09-22', typeId: 'lt_annual', status: 'approved' });
  db.carers[3].teamId = 'team_day';
  assert.ok(!kinds(findClashes(propose('c2', '2026-09-22', '2026-09-22'), db, ctx(db))).includes('staffing'), 'archived carer ignored');
  db.holidays.push({ id: 'i', carerId: 'c5', start: '2026-09-23', end: '2026-09-23', typeId: 'lt_annual', status: 'approved' }); // Isla starts 1 Oct
  assert.ok(!kinds(findClashes(propose('c2', '2026-09-23', '2026-09-23'), db, ctx(db))).includes('staffing'), 'not yet started');
  db.holidays.push({ id: 'j', carerId: 'c5', start: '2026-10-05', end: '2026-10-05', typeId: 'lt_annual', status: 'approved' });
  assert.ok(kinds(findClashes(propose('c2', '2026-10-05', '2026-10-05'), db, ctx(db))).includes('staffing'), 'counts once started');
  // Bank holidays that are days off do not make a team short-staffed.
  db.settings.bankHolidayRegion = 'scotland';
  db.holidays.push({ id: 'x1', carerId: 'c1', start: '2026-12-21', end: '2026-12-31', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 'x2', carerId: 'c2', start: '2026-12-25', end: '2026-12-25', typeId: 'lt_annual', status: 'approved' });
  const xmas = existingProblems(db, ctx(db), { start: '2026-12-20', end: '2026-12-31' });
  assert.ok(!kinds(xmas).includes('staffing'), 'Christmas Day is nobody’s working day');
  const noWork = findClashes(propose('c3', '2026-12-25', '2026-12-25'), db, ctx(db)).find((x) => x.kind === 'no-working-days');
  assert.match(noWork.message, /^None of these dates are working days for Morag \(Morag works Mon, Wed, Fri, and Fri 25 Dec 2026 is a bank holiday\)$/);
  assert.deepEqual(noWork.dates, ['2026-12-25']);
  const twoBank = findClashes(propose('c1', '2026-12-25', '2026-12-28'), db, ctx(db)).find((x) => x.kind === 'no-working-days');
  assert.match(twoBank.message, /\(Sam works Mon to Fri, and 2 of them are bank holidays\)$/);
  assert.deepEqual(twoBank.dates, ['2026-12-25', '2026-12-28']);
});

test('team limits: 0 and a default of 0 mean no limit; undefined and null use the default', () => {
  const db = fixture();
  db.holidays.push({ id: 'n', carerId: 'c4', start: '2026-10-05', end: '2026-10-05', typeId: 'lt_annual', status: 'approved' });
  db.carers[3].active = true;
  db.carers.push({ ...db.carers[0], id: 'c7', firstName: 'Nia', teamId: 'team_night', mustNotBeOffWith: [] });
  assert.ok(!kinds(findClashes(propose('c7', '2026-10-05', '2026-10-05'), db, ctx(db))).includes('staffing'), 'maxOffPerDay 0 = no limit');
  db.teams[1].maxOffPerDay = undefined;
  assert.ok(kinds(findClashes(propose('c7', '2026-10-05', '2026-10-05'), db, ctx(db))).includes('staffing'), 'undefined uses the default (1)');
  db.settings.defaultMaxOffPerDay = 0;
  assert.ok(!kinds(findClashes(propose('c7', '2026-10-05', '2026-10-05'), db, ctx(db))).includes('staffing'), 'default 0 = no limit');
  db.settings.defaultMaxOffPerDay = '2';
  db.teams[1].maxOffPerDay = null;
  assert.ok(!kinds(findClashes(propose('c7', '2026-10-05', '2026-10-05'), db, ctx(db))).includes('staffing'), 'string limits are read as numbers');
  db.teams[1].maxOffPerDay = -3;
  assert.ok(!kinds(findClashes(propose('c7', '2026-10-05', '2026-10-05'), db, ctx(db))).includes('staffing'), 'negative = no limit');
  // Someone with no team is never checked for staffing.
  db.carers.push({ ...db.carers[0], id: 'c8', firstName: 'Zed', teamId: null });
  assert.ok(!kinds(findClashes(propose('c8', '2026-09-09', '2026-09-09'), db, ctx(db))).includes('staffing'));
});

test('staffing counts each person once and names the busiest day with how many more', () => {
  const db = fixture();
  db.settings.defaultMaxOffPerDay = 2;
  db.holidays.push({ id: 'p1', carerId: 'c2', start: '2026-10-05', end: '2026-10-07', typeId: 'lt_annual', status: 'pending' });
  db.holidays.push({ id: 'p2', carerId: 'c3', start: '2026-10-05', end: '2026-10-09', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 'p3', carerId: 'c5', start: '2026-10-07', end: '2026-10-07', typeId: 'lt_annual', status: 'approved' });
  const st = findClashes(propose('c1', '2026-10-05', '2026-10-09'), db, ctx(db)).find((x) => x.kind === 'staffing');
  // Mon 5: Priya, Morag + Sam = 3; Wed 7: Priya, Morag, Isla + Sam = 4; Fri 9: Morag + Sam = 2 (fine)
  assert.match(st.message, /^4 people in Day team would be off on Wed 7 Oct 2026 – the limit is 2 \(and 1 more day\)$/);
  assert.equal(st.details, 'Also off: Isla, Morag, Priya', 'others are listed in name order');
  assert.deepEqual(st.dates, ['2026-10-05', '2026-10-07']);
  assert.deepEqual([...st.relatedCarerIds].sort(), ['c2', 'c3', 'c5']);
  assert.deepEqual([...st.relatedHolidayIds].sort(), ['p1', 'p2', 'p3']);
});

test('pairing works in both directions and only on days both would be working', () => {
  const db = fixture();
  // The rule is recorded on Priya (c2 → c3) only. Proposing for Morag when Priya is off must still warn.
  db.holidays.push({ id: 'pr', carerId: 'c2', start: '2026-10-05', end: '2026-10-09', typeId: 'lt_annual', status: 'approved' });
  const rev = findClashes(propose('c3', '2026-10-05', '2026-10-09'), db, ctx(db)).find((x) => x.kind === 'pairing');
  assert.ok(rev, 'reverse direction');
  assert.match(rev.message, /^Morag and Priya shouldn’t be off at the same time – Priya is off Mon 5 Oct 2026 \(and 2 more days\)$/);
  assert.deepEqual(rev.dates, ['2026-10-05', '2026-10-07', '2026-10-09']);
  assert.deepEqual(rev.relatedHolidayIds, ['pr']);
  // Morag does not work Tuesdays, so Priya being off on a Tuesday is no clash for Morag on that day.
  const tue = findClashes(propose('c3', '2026-10-06', '2026-10-06'), db, ctx(db));
  assert.ok(!kinds(tue).includes('pairing'));
  assert.ok(kinds(tue).includes('no-working-days'));
  // And the other way: Morag off Mon 12 – Fri 16 only takes her away Mon/Wed/Fri; Priya proposing Tuesday is fine.
  db.holidays.push({ id: 'mo', carerId: 'c3', start: '2026-10-12', end: '2026-10-16', typeId: 'lt_annual', status: 'approved' });
  assert.ok(!kinds(findClashes(propose('c2', '2026-10-13', '2026-10-13'), db, ctx(db))).includes('pairing'));
  assert.ok(kinds(findClashes(propose('c2', '2026-10-14', '2026-10-14'), db, ctx(db))).includes('pairing'));
  // A carer paired with themselves or with someone who no longer exists is harmless.
  db.carers[1].mustNotBeOffWith = ['c2', 'ghost', 'c3'];
  assert.equal(findClashes(propose('c2', '2026-10-14', '2026-10-14'), db, ctx(db)).filter((x) => x.kind === 'pairing').length, 1);
});

test('a declined proposal is only checked for overlaps, working days, employment and archive', () => {
  const db = fixture();
  const c = findClashes(propose('c2', '2026-09-09', '2026-09-09', { status: 'declined' }), db, ctx(db));
  assert.deepEqual(kinds(c), []);
  const d = findClashes(propose('c2', '2026-10-05', '2026-10-16', { status: 'declined' }), db, ctx(db));
  assert.ok(!kinds(d).includes('entitlement'));
});

test('entitlement warnings: one per holiday year touched, natural wording, unknown types skipped', () => {
  const db = fixture();
  db.carers[0].entitlementDays = 3; // Sam already has 5 booked in 2026/27 → -2 over
  // Mon 29 – Wed 31 Mar 2027 (3 days) sit in 2026/27; Thu 1 – Wed 7 Apr 2027 (5 days) in 2027/28.
  const two = findClashes(propose('c1', '2027-03-29', '2027-04-07'), db, ctx(db)).filter((x) => x.kind === 'entitlement');
  assert.equal(two.length, 2);
  assert.match(two[0].message, /^Sam is already 2 days over in 2026\/27 – this would take them to -5$/);
  assert.match(two[1].message, /^Only 3 days left in 2027\/28 – this would take Sam to -2$/);
  assert.ok(!kinds(findClashes(propose('c1', '2027-04-01', '2027-04-02'), db, ctx(db))).includes('entitlement'), 'staying in credit next year is fine');
  assert.deepEqual(two.map((x) => x.dates[0]), ['2027-03-29', '2027-04-01']);
  db.carers[0].entitlementDays = 6; // exactly 1 left
  const one = findClashes(propose('c1', '2026-10-05', '2026-10-06'), db, ctx(db)).find((x) => x.kind === 'entitlement');
  assert.match(one.message, /^Only 1 day left in 2026\/27 – this would take Sam to -1$/);
  db.carers[0].entitlementDays = 5;
  const none = findClashes(propose('c1', '2026-10-05', '2026-10-05', { halfDay: 'am' }), db, ctx(db)).find((x) => x.kind === 'entitlement');
  assert.match(none.message, /^Sam has no days left in 2026\/27 – this would take them to -0\.5$/);
  assert.ok(!kinds(findClashes(propose('c1', '2026-10-05', '2026-10-05', { typeId: 'lt_mystery' }), db, ctx(db))).includes('entitlement'));
  assert.ok(!kinds(findClashes(propose('c1', '2026-10-05', '2026-10-05', { typeId: null }), db, ctx(db))).includes('entitlement'));
  // Editing an existing holiday ignores its own days.
  db.carers[0].entitlementDays = 5;
  assert.ok(!kinds(findClashes(propose('c1', '2026-09-07', '2026-09-11'), db, ctx(db), { ignoreHolidayIds: ['h1'] })).includes('entitlement'));
});

test('entitlement warnings use the January-style label when the year starts on 1 January', () => {
  const db = fixture();
  db.settings.holidayYearStart = { month: 1, day: 1 };
  db.carers[0].entitlementDays = 5;
  const c = findClashes(propose('c1', '2026-12-28', '2026-12-31'), db, ctx(db)).find((x) => x.kind === 'entitlement');
  assert.match(c.message, /^Sam has no days left in 2026 – this would take them to -4$/);
});

test('employment warnings on the exact boundary days do not fire', () => {
  const db = fixture();
  assert.ok(!kinds(findClashes(propose('c5', '2026-10-01', '2026-10-02'), db, ctx(db))).includes('outside-employment'));
  assert.ok(!kinds(findClashes(propose('c5', '2027-01-28', '2027-01-29'), db, ctx(db))).includes('outside-employment'));
  const both = findClashes(propose('c5', '2026-09-30', '2027-02-01'), db, ctx(db)).filter((x) => x.kind === 'outside-employment');
  assert.equal(both.length, 2);
});

test('an empty document gives no problems and blocks unknown carers', () => {
  const db = createEmptyDb();
  assert.deepEqual(existingProblems(db, ctx(db)), []);
  assert.deepEqual(existingProblems(db, ctx(db), { start: '2026-09-30', end: '2026-09-01' }), []);
  assert.deepEqual(findClashes(propose('nobody', '2026-09-01', '2026-09-01'), db, ctx(db)).map((x) => [x.kind, x.severity, x.message]), [['unknown-carer', 'block', 'That carer no longer exists']]);
  assert.deepEqual(findClashes(null, db, ctx(db)).map((x) => x.kind), ['unknown-carer']);
  assert.deepEqual(checkBatch(null, db, ctx(db)), []);
});

test('checkBatch: later rows see earlier ones for entitlement, blocked rows are not carried forward', () => {
  const db = fixture();
  db.carers[0].entitlementDays = 6; // 5 booked already → 1 left
  const rows = checkBatch([
    propose('c1', '2026-10-05', '2026-10-05'),          // uses the last day
    propose('c1', '2026-10-05', '2026-10-05'),          // blocked: overlaps the first
    propose('c1', '2026-10-06', '2026-10-06'),          // sees the first → -1
    propose('c1', '2026-10-06', '2026-10-06', { halfDay: 'am' }), // blocked by the third, not the second
  ], db, ctx(db));
  assert.deepEqual(rows.map((r) => r.blocked), [false, true, false, true]);
  assert.deepEqual(rows.map((r) => r.days), [1, 1, 1, 0.5]);
  assert.deepEqual(kinds(rows[0].clashes), []);
  assert.match(rows[2].clashes.find((x) => x.kind === 'entitlement').message, /^Sam has no days left in 2026\/27 – this would take them to -1$/);
  assert.equal(rows[3].clashes[0].kind, 'overlap');
  assert.ok(!db.holidays.some((h) => String(h.id).startsWith('tmp_')), 'the document itself is untouched');
  // Pending rows in a batch still count towards staffing for later rows; a declined one does not.
  const more = checkBatch([
    propose('c1', '2026-11-02', '2026-11-02', { status: 'pending' }),
    propose('c2', '2026-11-02', '2026-11-02'),
    propose('c3', '2026-11-04', '2026-11-04', { status: 'declined' }),
    propose('c2', '2026-11-04', '2026-11-04'),
  ], db, ctx(db));
  assert.ok(kinds(more[1].clashes).includes('staffing'));
  assert.ok(!kinds(more[3].clashes).includes('staffing'));
});

test('existingProblems: dates stay inside the window, each problem appears once, sorted by first date', () => {
  const db = fixture();
  db.holidays.push({ id: 'o1', carerId: 'c2', start: '2026-08-24', end: '2026-09-04', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 'o2', carerId: 'c2', start: '2026-08-31', end: '2026-09-02', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 'o3', carerId: 'c2', start: '2026-09-02', end: '2026-09-03', typeId: 'lt_annual', status: 'approved' });
  db.settings.defaultMaxOffPerDay = 1;
  db.holidays.push({ id: 's1', carerId: 'c1', start: '2026-09-21', end: '2026-09-25', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 's2', carerId: 'c2', start: '2026-09-22', end: '2026-09-24', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 's3', carerId: 'c3', start: '2026-09-23', end: '2026-09-23', typeId: 'lt_annual', status: 'approved' });
  const p = existingProblems(db, ctx(db), { start: '2026-09-01', end: '2026-09-30' });
  const overlaps = p.filter((x) => x.kind === 'overlap');
  assert.equal(overlaps.length, 3, 'three pairs among o1, o2, o3');
  for (const o of overlaps) for (const d of o.dates) assert.ok(d >= '2026-09-01' && d <= '2026-09-30', `${d} is inside the window`);
  assert.deepEqual(overlaps[0].dates, ['2026-09-01', '2026-09-02']);
  assert.match(overlaps[0].message, /^Priya has two holidays that overlap: Mon 24 Aug – Fri 4 Sep 2026 and Mon 31 Aug – Wed 2 Sep 2026$/);
  const staffing = p.filter((x) => x.kind === 'staffing' && x.dates[0] >= '2026-09-21');
  assert.equal(staffing.length, 1, 'one run, not one per day');
  assert.match(staffing[0].message, /^3 people in Day team are off on Wed 23 Sep 2026 – the limit is 1 \(and 2 more days\)$/);
  assert.deepEqual(staffing[0].dates, ['2026-09-22', '2026-09-23', '2026-09-24']);
  assert.deepEqual([...staffing[0].carerIds].sort(), ['c1', 'c2', 'c3']);
  assert.deepEqual([...staffing[0].holidayIds].sort(), ['s1', 's2', 's3']);
  const pairing = p.filter((x) => x.kind === 'pairing');
  assert.equal(pairing.length, 1, 'Priya and Morag are only both off on Wed 23 Sep');
  assert.match(pairing[0].message, /^Priya and Morag are both off on Wed 23 Sep 2026 – they shouldn’t be off at the same time$/);
  assert.deepEqual(pairing[0].dates, ['2026-09-23']);
  assert.deepEqual([...pairing[0].holidayIds].sort(), ['s2', 's3']);
  const firsts = p.map((x) => x.dates[0]);
  assert.deepEqual(firsts, [...firsts].sort());
  // Pending holidays can be left out.
  db.holidays.push({ id: 'pp', carerId: 'c1', start: '2026-09-28', end: '2026-09-28', typeId: 'lt_annual', status: 'pending' });
  db.holidays.push({ id: 'pq', carerId: 'c2', start: '2026-09-28', end: '2026-09-28', typeId: 'lt_annual', status: 'approved' });
  assert.ok(existingProblems(db, ctx(db), { start: '2026-09-28', end: '2026-09-28' }).some((x) => x.kind === 'staffing'));
  assert.ok(!existingProblems(db, ctx(db), { start: '2026-09-28', end: '2026-09-28', includePending: false }).some((x) => x.kind === 'staffing'));
  // A multi-day pairing run reads as a range.
  db.holidays.push({ id: 'r1', carerId: 'c2', start: '2026-10-12', end: '2026-10-16', typeId: 'lt_annual', status: 'approved' });
  db.holidays.push({ id: 'r2', carerId: 'c3', start: '2026-10-12', end: '2026-10-16', typeId: 'lt_annual', status: 'approved' });
  const runs = existingProblems(db, ctx(db), { start: '2026-10-12', end: '2026-10-16' }).filter((x) => x.kind === 'pairing');
  assert.equal(runs.length, 1, 'one problem for the week, not one per day');
  assert.deepEqual(runs[0].dates, ['2026-10-12', '2026-10-14', '2026-10-16'], 'Morag works Mon/Wed/Fri');
  assert.match(runs[0].message, /^Priya and Morag are both off Mon 12 – Fri 16 Oct 2026 – they shouldn’t be off at the same time$/);
});

test('existingProblems: a fortnight over the limit is one problem, but a fine day in between splits it', () => {
  const db = fixture();
  db.settings.defaultMaxOffPerDay = 1;
  db.holidays = [
    { id: 'a', carerId: 'c1', start: '2026-10-05', end: '2026-10-16', typeId: 'lt_annual', status: 'approved' },
    { id: 'b', carerId: 'c2', start: '2026-10-05', end: '2026-10-16', typeId: 'lt_annual', status: 'approved' },
  ];
  const one = existingProblems(db, ctx(db), { start: '2026-10-01', end: '2026-10-31' }).filter((x) => x.kind === 'staffing');
  assert.equal(one.length, 1, 'the weekend in the middle does not split it');
  assert.equal(one[0].dates.length, 10);
  assert.match(one[0].message, /^2 people in Day team are off on Mon 5 Oct 2026 – the limit is 1 \(and 9 more days\)$/);
  // Priya is back on the Wednesday of week one: that day is fine, so two problems.
  db.holidays[1] = { id: 'b', carerId: 'c2', start: '2026-10-05', end: '2026-10-06', typeId: 'lt_annual', status: 'approved' };
  db.holidays.push({ id: 'c', carerId: 'c2', start: '2026-10-08', end: '2026-10-16', typeId: 'lt_annual', status: 'approved' });
  const two = existingProblems(db, ctx(db), { start: '2026-10-01', end: '2026-10-31' }).filter((x) => x.kind === 'staffing');
  assert.deepEqual(two.map((x) => x.dates.length), [2, 7]);
  // Weekend-team members working Saturdays keep a Saturday in the run rather than bridging it.
  db.carers.push({ ...db.carers[0], id: 'w', firstName: 'Wes', workingDays: [6, 7], mustNotBeOffWith: [] });
  const still = existingProblems(db, ctx(db), { start: '2026-10-01', end: '2026-10-31' }).filter((x) => x.kind === 'staffing');
  assert.deepEqual(still.map((x) => x.dates.length), [2, 2, 5], 'Wes works the weekend, which was fine, so it splits the second week');
});

test('the sample data behaves: one staffing and one pairing problem ahead, and editing a holiday never clashes with itself', () => {
  for (const today of ['2026-06-17', '2026-04-01', '2027-03-31', '2026-12-25']) {
    const db = sampleDb({ today });
    const c = buildContext(db, { today });
    const problems = existingProblems(db, c, {});
    assert.deepEqual(kinds(problems).sort(), ['pairing', 'staffing'], `problems for ${today}: ${problems.map((p) => p.message).join(' | ')}`);
    for (const h of db.holidays) {
      const clashes = findClashes(h, db, c, { ignoreHolidayIds: [h.id] });
      assert.ok(!clashes.some((x) => x.severity === 'block'), `${h.id} would block itself: ${clashes.map((x) => x.message).join(' | ')}`);
    }
    for (const h of db.holidays) {
      if (h.status === 'declined') continue;
      assert.ok(findClashes(h, db, c).some((x) => x.kind === 'overlap'), `${h.id} re-added is an overlap`);
    }
    const rows = checkBatch(db.holidays.map((h) => ({ ...h, id: undefined })), db, c, { ignoreHolidayIds: db.holidays.map((h) => h.id) });
    assert.equal(rows.filter((r) => r.blocked).length, 0, 'every existing holiday could be re-added on its own');
  }
});
