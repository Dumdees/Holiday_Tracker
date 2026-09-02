import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyDb } from '../../src/store/defaults.js';
import { buildContext } from '../../src/core/context.js';
import { yearBounds } from '../../src/core/holidayYear.js';
import * as stats from '../../src/core/stats.js';
import { sampleDb } from '../../src/store/sample.js';

function fixture() {
  const db = createEmptyDb();
  db.settings.holidayYearStart = { month: 4, day: 1 };
  db.settings.bankHolidayRegion = 'none';
  db.settings.unusedLeaveWarningWeeks = 12;
  db.settings.unusedLeaveWarningDays = 5;
  db.teams = [{ id: 'team_day', name: 'Day team', colour: '#f00', maxOffPerDay: 2 }];
  const carer = (id, firstName, extra = {}) => ({ id, firstName, lastName: 'Test', role: 'Carer', teamId: 'team_day', startDate: '2020-01-01', endDate: null, workingDays: [1, 2, 3, 4, 5], entitlementDays: 20, active: true, mustNotBeOffWith: [], adjustments: [], ...extra });
  db.carers = [carer('c1', 'Sam'), carer('c2', 'Priya'), carer('c3', 'Old', { active: false })];
  db.holidays = [
    { id: 'h1', carerId: 'c1', start: '2026-04-27', end: '2026-05-01', typeId: 'lt_annual', status: 'approved', halfDay: null }, // 5 days, Apr 27-30 + May 1
    { id: 'h2', carerId: 'c1', start: '2026-09-01', end: '2026-09-02', typeId: 'lt_sick', status: 'approved', halfDay: null },
    { id: 'h3', carerId: 'c2', start: '2026-09-10', end: '2026-09-10', typeId: 'lt_annual', status: 'pending', halfDay: null },
    { id: 'h4', carerId: 'c2', start: '2026-09-02', end: '2026-09-02', typeId: 'lt_annual', status: 'approved', halfDay: 'am' },
    { id: 'h5', carerId: 'c2', start: '2026-06-01', end: '2026-06-01', typeId: 'lt_annual', status: 'declined', halfDay: null },
  ];
  return db;
}
const TODAY = '2026-09-02';
const ctx = (db) => buildContext(db, { today: TODAY });

test('who is off, upcoming, capacity', () => {
  const db = fixture();
  const c = ctx(db);
  assert.deepEqual(stats.whoIsOff(db, '2026-09-02', c).map((x) => x.carer.id), ['c2', 'c1']);
  assert.deepEqual(stats.currentlyOff(db, TODAY, c).map((x) => x.holiday.id), ['h2', 'h4']);
  assert.deepEqual(stats.upcoming(db, TODAY, 14, c).map((x) => x.holiday.id), ['h3']);
  assert.equal(stats.upcoming(db, TODAY, 5, c).length, 0);
  const cap = stats.capacityByDay(db, '2026-09-01', '2026-09-10', c);
  assert.equal(cap.get('2026-09-02'), 2);
  assert.equal(cap.get('2026-09-10'), 1);
  assert.equal(cap.get('2026-09-05'), undefined);
});

test('monthly, by type, weekday and team summaries', () => {
  const db = fixture();
  const c = ctx(db);
  const yb = yearBounds(2026, db.settings);
  const monthly = stats.monthlyLeave(db, yb, c);
  assert.equal(monthly.length, 12);
  assert.equal(monthly[0].month, '2026-04');
  assert.equal(monthly[0].label, 'Apr 2026');
  assert.equal(monthly[0].byType.get('lt_annual'), 4);
  assert.equal(monthly[1].byType.get('lt_annual'), 1);
  assert.equal(monthly[5].total, 3.5); // September: 2 sick + 0.5 annual + 1 pending
  const byType = stats.leaveByType(db, yb, c);
  assert.equal(byType[0].typeId, 'lt_annual');
  assert.equal(byType[0].days, 6.5);
  assert.equal(byType[0].count, 3);
  const dow = stats.dayOfWeekPattern(db, yb, c);
  assert.equal(dow[0].label, 'Mon');
  assert.equal(dow.reduce((n, d) => n + d.days, 0), 8.5);
  const team = stats.teamSummary(db, yb, c, TODAY);
  assert.equal(team.length, 1);
  assert.equal(team[0].carerCount, 2);
  assert.equal(team[0].entitlement, 40);
  assert.equal(team[0].taken, 5.5);
  assert.equal(team[0].pending, 1);
  assert.equal(team[0].sickDays, 2);
  assert.deepEqual(stats.sicknessByCarer(db, yb, c).map((r) => [r.carer.id, r.days, r.occurrences]), [['c1', 2, 1]]);
});

test('alerts and backup status', () => {
  const db = fixture();
  const c = ctx(db);
  const yb = yearBounds(2026, db.settings);
  assert.equal(stats.unusedLeaveAlerts(db, yb, c, TODAY).length, 0, 'not yet near year end');
  const near = buildContext(db, { today: '2027-02-01' });
  const alerts = stats.unusedLeaveAlerts(db, yb, near, '2027-02-01');
  assert.deepEqual(alerts.map((a) => a.carer.id), ['c2', 'c1']);
  assert.equal(stats.lowRemainingAlerts(db, yb, c, TODAY).length, 0);
  db.carers[0].entitlementDays = 6;
  assert.deepEqual(stats.lowRemainingAlerts(db, yb, ctx(db), TODAY).map((a) => a.carer.id), ['c1']);
  db.carers[0].entitlementDays = 3;
  assert.equal(stats.overdrawnAlerts(db, yb, ctx(db), TODAY)[0].remaining, -2);
  assert.deepEqual(stats.pendingApprovals(db, c).map((p) => p.holiday.id), ['h3']);
  assert.deepEqual(stats.backupStatus({ lastBackupAt: null, backupReminderDays: 7 }, TODAY), { lastBackupAt: null, daysSince: null, due: true });
  assert.equal(stats.backupStatus({ lastBackupAt: '2026-08-30T10:00:00Z', backupReminderDays: 7 }, TODAY).due, false);
  assert.equal(stats.backupStatus({ lastBackupAt: '2026-08-20T10:00:00Z', backupReminderDays: 7 }, TODAY).due, true);
  assert.equal(stats.backupStatus({ lastBackupAt: null, backupReminderDays: 0 }, TODAY).due, false);
  const league = stats.usageLeagueTable(db, yb, ctx(db), TODAY);
  assert.equal(league[0].carer.id, 'c2');
});

test('works on the sample data without throwing', () => {
  const db = sampleDb({ today: TODAY });
  const c = ctx(db);
  const yb = yearBounds(2026, db.settings);
  assert.ok(stats.currentlyOff(db, TODAY, c).length >= 2);
  assert.ok(stats.monthlyLeave(db, yb, c).some((m) => m.total > 0));
  assert.ok(stats.teamSummary(db, yb, c).length >= 3);
  assert.ok(stats.usageLeagueTable(db, yb, c, TODAY).length > 10);
});

// ---------- Extra edge cases ----------
import { usageForAll } from '../../src/core/entitlement.js';
import { eachDay } from '../../src/core/dates.js';
import { countLeaveDays } from '../../src/core/leaveDays.js';

test('monthlyLeave keeps a short 13th month when the year starts part-way through a month', () => {
  const db = fixture();
  db.settings.holidayYearStart = { month: 4, day: 6 };
  db.holidays = [
    { id: 'a', carerId: 'c1', start: '2027-04-01', end: '2027-04-05', typeId: 'lt_annual', status: 'approved', halfDay: null }, // Thu, Fri, Mon → 3 days in the last month
    { id: 'b', carerId: 'c1', start: '2026-04-01', end: '2026-04-07', typeId: 'lt_annual', status: 'approved', halfDay: null }, // only Mon 6, Tue 7 fall in the year
  ];
  const yb = yearBounds(2026, db.settings);
  assert.deepEqual([yb.start, yb.end], ['2026-04-06', '2027-04-05']);
  const monthly = stats.monthlyLeave(db, yb, ctx(db));
  assert.equal(monthly.length, 13);
  assert.equal(monthly[12].month, '2027-04');
  assert.equal(monthly[12].label, 'Apr 2027');
  assert.equal(monthly[12].total, 3);
  assert.equal(monthly[0].total, 2);
  assert.equal(monthly.reduce((n, m) => n + m.total, 0), 5, 'nothing is lost');
  // A January year is 12 calendar months exactly.
  db.settings.holidayYearStart = { month: 1, day: 1 };
  const jan = stats.monthlyLeave(db, yearBounds(2026, db.settings), ctx(db));
  assert.equal(jan.length, 12);
  assert.deepEqual([jan[0].month, jan[11].month], ['2026-01', '2026-12']);
});

test('monthlyLeave attributes a holiday across a month boundary day by day, half days included', () => {
  const db = fixture();
  db.holidays = [
    { id: 'a', carerId: 'c1', start: '2026-06-29', end: '2026-07-03', typeId: 'lt_annual', status: 'approved', halfDay: null }, // Mon 29, Tue 30 | Wed 1, Thu 2, Fri 3
    { id: 'b', carerId: 'c2', start: '2026-06-30', end: '2026-06-30', typeId: 'lt_sick', status: 'approved', halfDay: 'pm' },
    { id: 'c', carerId: 'c2', start: '2026-07-31', end: '2026-08-03', typeId: 'lt_annual', status: 'pending', halfDay: null }, // Fri 31 | Mon 3
  ];
  const yb = yearBounds(2026, db.settings);
  const monthly = stats.monthlyLeave(db, yb, ctx(db));
  const by = Object.fromEntries(monthly.map((m) => [m.month, m]));
  assert.equal(by['2026-06'].total, 2.5);
  assert.equal(by['2026-06'].byType.get('lt_sick'), 0.5);
  assert.equal(by['2026-07'].total, 4);
  assert.equal(by['2026-08'].total, 1);
  assert.equal(monthly.reduce((n, m) => n + m.total, 0), 7.5);
  const total = db.holidays.reduce((n, h) => n + countLeaveDays(h, db.carers.find((c) => c.id === h.carerId), ctx(db)), 0);
  assert.equal(total, 7.5, 'monthly totals match the holidays');
});

test('backupStatus handles 0, blank, unreadable and future dates', () => {
  assert.equal(stats.backupStatus({ lastBackupAt: null, backupReminderDays: 0 }, TODAY).due, false);
  assert.equal(stats.backupStatus({ lastBackupAt: null, backupReminderDays: '0' }, TODAY).due, false);
  assert.equal(stats.backupStatus({ lastBackupAt: null, backupReminderDays: '' }, TODAY).due, false);
  assert.equal(stats.backupStatus({ lastBackupAt: null }, TODAY).due, false);
  assert.equal(stats.backupStatus({ lastBackupAt: '2026-08-01T10:00:00Z', backupReminderDays: 0 }, TODAY).due, false);
  assert.deepEqual(stats.backupStatus({ lastBackupAt: 'yesterday', backupReminderDays: 7 }, TODAY), { lastBackupAt: 'yesterday', daysSince: null, due: true });
  assert.deepEqual(stats.backupStatus({ lastBackupAt: '2026-09-02T23:59:00Z', backupReminderDays: 7 }, TODAY), { lastBackupAt: '2026-09-02T23:59:00Z', daysSince: 0, due: false });
  assert.equal(stats.backupStatus({ lastBackupAt: '2026-09-03T01:00:00Z', backupReminderDays: 7 }, TODAY).daysSince, 0);
  assert.equal(stats.backupStatus({ lastBackupAt: '2026-08-26', backupReminderDays: 7 }, TODAY).due, true, 'exactly 7 days is due');
  assert.equal(stats.backupStatus({ lastBackupAt: '2026-08-27', backupReminderDays: 7 }, TODAY).due, false);
  assert.equal(stats.backupStatus({ lastBackupAt: '2026-08-01', backupReminderDays: 'weekly' }, TODAY).due, false, 'unreadable reminder setting means off');
});

test('alerts: thresholds from settings, blank settings fall back, ties sort by name', () => {
  const db = fixture();
  db.carers.push({ ...db.carers[0], id: 'c9', firstName: 'Amy', lastName: 'Aardvark' });
  const near = buildContext(db, { today: '2027-02-01' });
  db.settings.unusedLeaveWarningWeeks = '';
  db.settings.unusedLeaveWarningDays = null;
  const alerts = stats.unusedLeaveAlerts(db, yearBounds(2026, db.settings), near, '2027-02-01');
  assert.deepEqual(alerts.map((a) => [a.carer.id, a.remaining]), [['c9', 20], ['c2', 19.5], ['c1', 15]]);
  assert.equal(alerts[0].weeksLeft, 8.3);
  db.settings.unusedLeaveWarningWeeks = 4;
  assert.equal(stats.unusedLeaveAlerts(db, yearBounds(2026, db.settings), near, '2027-02-01').length, 0);
  db.settings.unusedLeaveWarningWeeks = 12;
  db.settings.unusedLeaveWarningDays = 20;
  assert.deepEqual(stats.unusedLeaveAlerts(db, yearBounds(2026, db.settings), near, '2027-02-01').map((a) => a.carer.id), ['c9']);
  assert.equal(stats.unusedLeaveAlerts(db, yearBounds(2026, db.settings), near, '2027-04-01').length, 0, 'after the year ends');
  assert.equal(stats.unusedLeaveAlerts(db, yearBounds(2027, db.settings), near, '2027-02-01').length, 0, 'next year is too far off');
  db.carers[0].entitlementDays = 2; // Sam: 2 − 5 taken = −3
  db.carers[1].entitlementDays = 0.5; // Priya: 0.5 − 0.5 = 0
  const c = ctx(db);
  const yb = yearBounds(2026, db.settings);
  assert.deepEqual(stats.lowRemainingAlerts(db, yb, c, TODAY).map((a) => [a.carer.id, a.remaining]), [['c2', 0]]);
  assert.deepEqual(stats.overdrawnAlerts(db, yb, c, TODAY).map((a) => [a.carer.id, a.remaining]), [['c1', -3]]);
  db.carers[2].active = true; // 'Old' has no holidays: 20 left
  assert.deepEqual(stats.usageLeagueTable(db, yb, c, TODAY).map((r) => r.carer.id), ['c9', 'c3', 'c2', 'c1']);
  assert.deepEqual(stats.usageLeagueTable(db, yb, c, TODAY).map((r) => r.percentUsed), [0, 0, 100, 250]);
});

test('whoIsOff / upcoming / capacity respect status filters and window edges', () => {
  const db = fixture();
  const c = ctx(db);
  assert.deepEqual(stats.whoIsOff(db, '2026-09-10', c).map((x) => x.carer.id), ['c2']);
  assert.deepEqual(stats.whoIsOff(db, '2026-09-10', c, { includePending: false }), []);
  assert.deepEqual(stats.whoIsOff(db, '2026-06-01', c), [], 'declined never shows');
  assert.deepEqual(stats.upcoming(db, TODAY, 8, c).map((x) => x.holiday.id), ['h3'], 'the last day of the window counts');
  assert.deepEqual(stats.upcoming(db, TODAY, 7, c), []);
  assert.deepEqual(stats.upcoming(db, '2026-09-01', 14, c).map((x) => x.holiday.id), ['h4', 'h3'], 'starting tomorrow counts, starting today does not');
  const cap = stats.capacityByDay(db, '2026-09-10', '2026-09-10', c, { includePending: false });
  assert.equal(cap.size, 0);
  assert.deepEqual([...stats.capacityByDay(db, '2026-04-30', '2026-05-01', c).keys()], ['2026-04-30', '2026-05-01']);
  assert.deepEqual(stats.leaveByType(db, yearBounds(2026, db.settings), c, { teamId: 'team_night' }), []);
});

test('leaveByType and sicknessByCarer sort deterministically and spot custom sick types', () => {
  const db = fixture();
  db.leaveTypes.push({ id: 'lt_custom', name: 'Sickness (long term)', colour: '#000', deductsEntitlement: false, builtIn: false, archived: false });
  db.holidays = [
    { id: 'a', carerId: 'c1', start: '2026-05-11', end: '2026-05-12', typeId: 'lt_sick', status: 'approved', halfDay: null },
    { id: 'b', carerId: 'c2', start: '2026-05-11', end: '2026-05-12', typeId: 'lt_custom', status: 'approved', halfDay: null },
    { id: 'c', carerId: 'c2', start: '2026-05-13', end: '2026-05-13', typeId: 'lt_sick', status: 'approved', halfDay: 'am' },
    { id: 'd', carerId: 'c1', start: '2026-05-18', end: '2026-05-19', typeId: 'lt_gone', status: 'approved', halfDay: null },
  ];
  const c = ctx(db);
  const yb = yearBounds(2026, db.settings);
  assert.deepEqual(stats.leaveByType(db, yb, c).map((r) => [r.name, r.days, r.count]), [['Sick leave', 2.5, 2], ['Leave', 2, 1], ['Sickness (long term)', 2, 1]]);
  assert.deepEqual(stats.sicknessByCarer(db, yb, c).map((r) => [r.carer.id, r.days, r.occurrences]), [['c2', 2.5, 2], ['c1', 2, 1]]);
  assert.equal(stats.teamSummary(db, yb, c, TODAY)[0].sickDays, 4.5);
});

test('teamSummary puts carers with a missing team under "No team" and skips archived carers', () => {
  const db = fixture();
  db.carers.push({ ...db.carers[0], id: 'c9', firstName: 'Zoe', teamId: 'team_gone' });
  db.carers.push({ ...db.carers[0], id: 'c10', firstName: 'Yan', teamId: null });
  const rows = stats.teamSummary(db, yearBounds(2026, db.settings), ctx(db), TODAY);
  assert.deepEqual(rows.map((r) => [r.team.name, r.carerCount]), [['Day team', 2], ['No team', 2]]);
  assert.equal(rows[1].entitlement, 40);
});

test('sample data properties: remaining adds up, nobody is counted twice, totals agree', () => {
  for (const today of ['2026-06-17', '2026-04-01', '2027-03-31']) {
    const db = sampleDb({ today });
    const c = buildContext(db, { today });
    const yb = yearBounds(2026, db.settings);
    const usages = usageForAll(db.carers, yb, db.holidays, c, today);
    for (const [id, u] of usages) {
      assert.equal(u.remaining, Math.round((u.entitlement.total - u.taken - u.booked) * 100) / 100, `${id} remaining`);
      assert.equal(u.remainingAfterPending, Math.round((u.remaining - u.pending) * 100) / 100, `${id} after pending`);
      assert.ok([u.taken, u.booked, u.pending].every((n) => n >= 0 && Number.isInteger(n * 2)), `${id} whole or half days`);
      assert.equal(u.taken + u.booked, [...u.byTypeStatus].filter(([k]) => k === 'lt_annual:approved').reduce((n, [, d]) => n + d, 0), `${id} annual approved = taken + booked`);
    }
    // capacityByDay never counts a carer twice, and agrees with whoIsOff.
    const cap = stats.capacityByDay(db, yb.start, yb.end, c);
    for (const day of eachDay(addDaysSafe(today, -30), addDaysSafe(today, 30))) {
      const distinct = new Set(stats.whoIsOff(db, day, c).map((x) => x.carer.id)).size;
      assert.equal(cap.get(day) ?? 0, day >= yb.start && day <= yb.end ? distinct : cap.get(day) ?? 0, `${day} capacity`);
    }
    // Team rows add up to the league table for active carers.
    const teams = stats.teamSummary(db, yb, c, today);
    const league = stats.usageLeagueTable(db, yb, c, today);
    const sum = (key) => Math.round(league.reduce((n, r) => n + r.usage[key], 0) * 100) / 100;
    assert.equal(teams.reduce((n, t) => n + t.carerCount, 0), league.length);
    assert.equal(Math.round(teams.reduce((n, t) => n + t.remaining, 0) * 100) / 100, sum('remaining'));
    assert.equal(Math.round(teams.reduce((n, t) => n + t.taken, 0) * 100) / 100, sum('taken'));
    // Monthly totals equal the by-type totals equal the day-of-week totals.
    const monthly = stats.monthlyLeave(db, yb, c).reduce((n, m) => n + m.total, 0);
    const byType = stats.leaveByType(db, yb, c).reduce((n, t) => n + t.days, 0);
    const byDow = stats.dayOfWeekPattern(db, yb, c).reduce((n, d) => n + d.days, 0);
    assert.equal(Math.round(monthly * 100) / 100, Math.round(byType * 100) / 100);
    assert.equal(Math.round(byDow * 100) / 100, Math.round(byType * 100) / 100);
  }
});

function addDaysSafe(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
