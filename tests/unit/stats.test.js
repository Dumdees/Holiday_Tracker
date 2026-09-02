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
