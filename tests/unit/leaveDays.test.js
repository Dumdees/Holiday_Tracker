import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  workingDaysOf, classifyDay, isWorkingDay, leaveDaysBreakdown, countLeaveDays, clipToRange, describeWorkingPattern,
} from '../../src/core/leaveDays.js';
import * as ldm from '../../src/core/leaveDays.js';

// Fixtures. 2026-06-15 is a Monday; 2026-05-04 and 2026-05-25 are Mondays and bank holidays.
const bankHolidayMap = new Map([
  ['2026-05-04', 'Early May bank holiday'],
  ['2026-05-25', 'Spring bank holiday'],
  ['2026-12-25', 'Christmas Day'],
]);
const makeCtx = (settings = {}) => ({ settings: { bankHolidaysAreDaysOff: true, ...settings }, today: '2026-06-17', bankHolidayMap });
const ctx = makeCtx();
const ctxNoBankHols = makeCtx({ bankHolidaysAreDaysOff: false });

const fullTime = { id: 'c1', workingDays: [1, 2, 3, 4, 5] };
const partTime = { id: 'c2', workingDays: [1, 3, 5] };
const weekends = { id: 'c3', workingDays: [6, 7] };

describe('workingDaysOf', () => {
  test('returns the carer’s working days', () => {
    assert.deepEqual(workingDaysOf(partTime), [1, 3, 5]);
  });
  test('defaults to Monday to Friday when missing or empty', () => {
    assert.deepEqual(workingDaysOf({ id: 'x' }), [1, 2, 3, 4, 5]);
    assert.deepEqual(workingDaysOf({ id: 'x', workingDays: [] }), [1, 2, 3, 4, 5]);
    assert.deepEqual(workingDaysOf({ id: 'x', workingDays: null }), [1, 2, 3, 4, 5]);
    assert.deepEqual(workingDaysOf(null), [1, 2, 3, 4, 5]);
    assert.deepEqual(workingDaysOf(undefined), [1, 2, 3, 4, 5]);
  });
  test('cleans up strings, duplicates, out-of-range values and order', () => {
    assert.deepEqual(workingDaysOf({ workingDays: ['5', 1, 1, 3, 0, 8, 'x'] }), [1, 3, 5]);
    assert.deepEqual(workingDaysOf({ workingDays: [0, 9] }), [1, 2, 3, 4, 5]);
  });
  test('does not return the carer’s own array', () => {
    const carer = { workingDays: [2, 4] };
    assert.notEqual(workingDaysOf(carer), carer.workingDays);
  });
});

describe('isWorkingDay / classifyDay', () => {
  test('weekday in the pattern is a working day', () => {
    assert.equal(isWorkingDay('2026-06-15', fullTime, ctx), true);
    assert.equal(classifyDay('2026-06-15', fullTime, ctx), 'working');
  });
  test('weekend is not a working day for Mon to Fri', () => {
    assert.equal(isWorkingDay('2026-06-20', fullTime, ctx), false);
    assert.equal(isWorkingDay('2026-06-21', fullTime, ctx), false);
    assert.equal(classifyDay('2026-06-20', fullTime, ctx), 'non-working');
  });
  test('part-time pattern only counts its own days', () => {
    assert.equal(isWorkingDay('2026-06-15', partTime, ctx), true); // Mon
    assert.equal(isWorkingDay('2026-06-16', partTime, ctx), false); // Tue
    assert.equal(isWorkingDay('2026-06-17', partTime, ctx), true); // Wed
    assert.equal(isWorkingDay('2026-06-20', weekends, ctx), true); // Sat
    assert.equal(isWorkingDay('2026-06-19', weekends, ctx), false); // Fri
  });
  test('bank holidays are days off only when the setting says so', () => {
    assert.equal(isWorkingDay('2026-05-04', fullTime, ctx), false);
    assert.equal(classifyDay('2026-05-04', fullTime, ctx), 'bank-holiday');
    assert.equal(isWorkingDay('2026-05-04', fullTime, ctxNoBankHols), true);
    assert.equal(classifyDay('2026-05-04', fullTime, ctxNoBankHols), 'working');
  });
  test('a bank holiday on a non-working day is reported as non-working', () => {
    assert.equal(classifyDay('2026-05-04', weekends, ctx), 'non-working');
  });
  test('copes with a context that has no bank holiday map', () => {
    assert.equal(isWorkingDay('2026-05-04', fullTime, { settings: { bankHolidaysAreDaysOff: true } }), true);
  });
  test('carer with no working days recorded is treated as Mon to Fri', () => {
    assert.equal(isWorkingDay('2026-06-15', { id: 'x' }, ctx), true);
    assert.equal(isWorkingDay('2026-06-20', { id: 'x' }, ctx), false);
  });
});

describe('leaveDaysBreakdown', () => {
  test('a Mon to Sun week for a Mon to Fri carer is 5 days, weekend skipped', () => {
    const r = leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-21' }, fullTime, ctx);
    assert.equal(r.days, 5);
    assert.deepEqual(r.countedDays, ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19']);
    assert.deepEqual(r.skipped, [
      { date: '2026-06-20', reason: 'non-working' },
      { date: '2026-06-21', reason: 'non-working' },
    ]);
  });
  test('part-time Mon/Wed/Fri counts 3 days in a full week', () => {
    const r = leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-21' }, partTime, ctx);
    assert.equal(r.days, 3);
    assert.deepEqual(r.countedDays, ['2026-06-15', '2026-06-17', '2026-06-19']);
    assert.equal(r.skipped.length, 4);
    assert.ok(r.skipped.every((s) => s.reason === 'non-working'));
  });
  test('bank holiday inside the range is given back when bankHolidaysAreDaysOff is on', () => {
    const r = leaveDaysBreakdown({ start: '2026-05-04', end: '2026-05-08' }, fullTime, ctx);
    assert.equal(r.days, 4);
    assert.deepEqual(r.skipped, [{ date: '2026-05-04', reason: 'bank-holiday' }]);
    assert.deepEqual(r.countedDays, ['2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08']);
  });
  test('bank holiday counts as leave when bankHolidaysAreDaysOff is off', () => {
    const r = leaveDaysBreakdown({ start: '2026-05-04', end: '2026-05-08' }, fullTime, ctxNoBankHols);
    assert.equal(r.days, 5);
    assert.deepEqual(r.skipped, []);
  });
  test('a range with both a weekend and a bank holiday reports each reason', () => {
    const r = leaveDaysBreakdown({ start: '2026-05-01', end: '2026-05-05' }, fullTime, ctx); // Fri to Tue
    assert.equal(r.days, 2);
    assert.deepEqual(r.skipped, [
      { date: '2026-05-02', reason: 'non-working' },
      { date: '2026-05-03', reason: 'non-working' },
      { date: '2026-05-04', reason: 'bank-holiday' },
    ]);
  });
  test('half day on a working day counts 0.5', () => {
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15', halfDay: 'am' }, fullTime, ctx).days, 0.5);
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15', halfDay: 'pm' }, fullTime, ctx).days, 0.5);
    const r = leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15', halfDay: 'am' }, fullTime, ctx);
    assert.deepEqual(r.countedDays, ['2026-06-15']);
  });
  test('half day on a non-working day or bank holiday counts 0', () => {
    assert.equal(leaveDaysBreakdown({ start: '2026-06-20', end: '2026-06-20', halfDay: 'pm' }, fullTime, ctx).days, 0);
    assert.equal(leaveDaysBreakdown({ start: '2026-05-04', end: '2026-05-04', halfDay: 'am' }, fullTime, ctx).days, 0);
  });
  test('single day without halfDay counts 1', () => {
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15', halfDay: null }, fullTime, ctx).days, 1);
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15' }, fullTime, ctx).days, 1);
  });
  test('halfDay is ignored when the range is more than one day', () => {
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-16', halfDay: 'am' }, fullTime, ctx).days, 2);
  });
  test('carer with no working days recorded defaults to Mon to Fri', () => {
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-21' }, { id: 'x' }, ctx).days, 5);
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-21' }, { id: 'x', workingDays: [] }, ctx).days, 5);
  });
  test('every-day carer counts every day', () => {
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-21' }, { workingDays: [1, 2, 3, 4, 5, 6, 7] }, ctx).days, 7);
  });
  test('invalid or missing dates give zero', () => {
    const empty = { days: 0, countedDays: [], skipped: [] };
    assert.deepEqual(leaveDaysBreakdown({ start: '', end: '' }, fullTime, ctx), empty);
    assert.deepEqual(leaveDaysBreakdown({ start: '2026-06-15' }, fullTime, ctx), empty);
    assert.deepEqual(leaveDaysBreakdown({ start: '2026-13-01', end: '2026-13-02' }, fullTime, ctx), empty);
    assert.deepEqual(leaveDaysBreakdown({ start: '15/06/2026', end: '16/06/2026' }, fullTime, ctx), empty);
    assert.deepEqual(leaveDaysBreakdown(null, fullTime, ctx), empty);
    assert.deepEqual(leaveDaysBreakdown({}, fullTime, ctx), empty);
  });
  test('end before start gives zero', () => {
    assert.deepEqual(leaveDaysBreakdown({ start: '2026-06-16', end: '2026-06-15' }, fullTime, ctx), { days: 0, countedDays: [], skipped: [] });
  });
  test('very long ranges are capped at 2000 days', () => {
    const r = leaveDaysBreakdown({ start: '2020-01-01', end: '2030-01-01' }, { workingDays: [1, 2, 3, 4, 5, 6, 7] }, ctxNoBankHols);
    assert.equal(r.days, 2000);
    assert.equal(r.countedDays.length + r.skipped.length, 2000);
  });
  test('returns fresh arrays each time', () => {
    const a = leaveDaysBreakdown({}, fullTime, ctx);
    const b = leaveDaysBreakdown({}, fullTime, ctx);
    assert.notEqual(a.countedDays, b.countedDays);
  });
});

describe('countLeaveDays', () => {
  test('is the days from the breakdown', () => {
    assert.equal(countLeaveDays({ start: '2026-06-15', end: '2026-06-21' }, fullTime, ctx), 5);
    assert.equal(countLeaveDays({ start: '2026-06-15', end: '2026-06-21' }, partTime, ctx), 3);
    assert.equal(countLeaveDays({ start: '2026-05-04', end: '2026-05-08' }, fullTime, ctx), 4);
    assert.equal(countLeaveDays({ start: '2026-05-04', end: '2026-05-08' }, fullTime, ctxNoBankHols), 5);
    assert.equal(countLeaveDays({ start: '2026-06-15', end: '2026-06-15', halfDay: 'am' }, fullTime, ctx), 0.5);
    assert.equal(countLeaveDays({ start: 'nope', end: 'nope' }, fullTime, ctx), 0);
  });
});

describe('clipToRange', () => {
  const holiday = { id: 'h1', carerId: 'c1', start: '2026-03-30', end: '2026-04-03', halfDay: null, typeId: 'lt_annual' };

  test('returns the holiday unchanged when it sits inside the range', () => {
    const r = clipToRange(holiday, '2026-01-01', '2026-12-31');
    assert.deepEqual(r, holiday);
    assert.notEqual(r, holiday);
  });
  test('trims the start and end to the range and keeps other fields', () => {
    assert.deepEqual(clipToRange(holiday, '2025-04-01', '2026-03-31'), { ...holiday, start: '2026-03-30', end: '2026-03-31' });
    assert.deepEqual(clipToRange(holiday, '2026-04-01', '2027-03-31'), { ...holiday, start: '2026-04-01', end: '2026-04-03' });
    assert.deepEqual(clipToRange(holiday, '2026-03-31', '2026-04-01'), { ...holiday, start: '2026-03-31', end: '2026-04-01' });
  });
  test('returns null when there is no overlap', () => {
    assert.equal(clipToRange(holiday, '2026-04-04', '2026-04-30'), null);
    assert.equal(clipToRange(holiday, '2026-03-01', '2026-03-29'), null);
  });
  test('range edges are inclusive', () => {
    assert.deepEqual(clipToRange(holiday, '2026-04-03', '2026-04-30'), { ...holiday, start: '2026-04-03', end: '2026-04-03' });
    assert.deepEqual(clipToRange(holiday, '2026-03-01', '2026-03-30'), { ...holiday, start: '2026-03-30', end: '2026-03-30' });
  });
  test('keeps halfDay for a single-day holiday', () => {
    const half = { ...holiday, start: '2026-06-15', end: '2026-06-15', halfDay: 'pm' };
    assert.equal(clipToRange(half, '2026-06-01', '2026-06-30').halfDay, 'pm');
    assert.equal(clipToRange(half, '2026-06-15', '2026-06-15').halfDay, 'pm');
  });
  test('drops halfDay when a multi-day holiday is clipped, even down to one day', () => {
    const multi = { ...holiday, halfDay: 'am' };
    assert.equal(clipToRange(multi, '2026-04-03', '2026-04-30').halfDay, null);
    assert.equal(clipToRange(multi, '2026-01-01', '2026-12-31').halfDay, null);
  });
  test('missing halfDay becomes null', () => {
    const { halfDay: _drop, ...noHalf } = holiday;
    assert.equal(clipToRange(noHalf, '2026-01-01', '2026-12-31').halfDay, null);
  });
  test('missing bounds are open-ended', () => {
    assert.deepEqual(clipToRange(holiday, '2026-04-01', null), { ...holiday, start: '2026-04-01' });
    assert.deepEqual(clipToRange(holiday, null, '2026-03-31'), { ...holiday, end: '2026-03-31' });
  });
  test('invalid holidays give null', () => {
    assert.equal(clipToRange(null, '2026-01-01', '2026-12-31'), null);
    assert.equal(clipToRange({ start: '', end: '' }, '2026-01-01', '2026-12-31'), null);
    assert.equal(clipToRange({ start: '2026-04-03', end: '2026-03-30' }, '2026-01-01', '2026-12-31'), null);
  });
});

describe('describeWorkingPattern', () => {
  test('describes common patterns in plain English', () => {
    assert.equal(describeWorkingPattern({ workingDays: [1, 2, 3, 4, 5] }), 'Mon to Fri');
    assert.equal(describeWorkingPattern({ workingDays: [1, 3, 5] }), 'Mon, Wed, Fri');
    assert.equal(describeWorkingPattern({ workingDays: [1, 2, 3, 4, 5, 6, 7] }), 'Every day');
    assert.equal(describeWorkingPattern({ workingDays: [6, 7] }), 'Sat and Sun');
    assert.equal(describeWorkingPattern({ workingDays: [2, 3, 4] }), 'Tue to Thu');
    assert.equal(describeWorkingPattern({ workingDays: [1, 2, 3, 4, 5, 6] }), 'Mon to Sat');
    assert.equal(describeWorkingPattern({ workingDays: [3] }), 'Wed only');
    assert.equal(describeWorkingPattern({ workingDays: [1, 2, 3, 5] }), 'Mon, Tue, Wed, Fri');
    assert.equal(describeWorkingPattern({ workingDays: [1, 2, 6, 7] }), 'Mon, Tue, Sat, Sun');
  });
  test('unsorted or missing days still describe correctly', () => {
    assert.equal(describeWorkingPattern({ workingDays: [5, 3, 1] }), 'Mon, Wed, Fri');
    assert.equal(describeWorkingPattern({ workingDays: [5, 4, 3, 2, 1] }), 'Mon to Fri');
    assert.equal(describeWorkingPattern({}), 'Mon to Fri');
    assert.equal(describeWorkingPattern(null), 'Mon to Fri');
  });
});

describe('leaveDaysBreakdown – edge cases', () => {
  test('a range across 29 February in a leap year counts the leap day', () => {
    // Mon 28 Feb 2028 .. Wed 1 Mar 2028
    const r = leaveDaysBreakdown({ start: '2028-02-28', end: '2028-03-01' }, fullTime, ctx);
    assert.deepEqual(r.countedDays, ['2028-02-28', '2028-02-29', '2028-03-01']);
    assert.equal(r.days, 3);
  });
  test('a range made entirely of bank holidays counts nothing and says why', () => {
    const r = leaveDaysBreakdown({ start: '2026-05-04', end: '2026-05-04' }, fullTime, ctx);
    assert.equal(r.days, 0);
    assert.deepEqual(r.skipped, [{ date: '2026-05-04', reason: 'bank-holiday' }]);
  });
  test('half day values other than am/pm are ignored', () => {
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15', halfDay: 'AM' }, fullTime, ctx).days, 1);
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15', halfDay: '' }, fullTime, ctx).days, 1);
    assert.equal(leaveDaysBreakdown({ start: '2026-06-15', end: '2026-06-15', halfDay: true }, fullTime, ctx).days, 1);
  });
  test('half days add up without float noise', () => {
    let total = 0;
    for (let i = 0; i < 10; i++) total += countLeaveDays({ start: '2026-06-15', end: '2026-06-15', halfDay: 'am' }, fullTime, ctx);
    assert.equal(total, 5);
  });
  test('workingDays given as strings still count', () => {
    assert.equal(countLeaveDays({ start: '2026-06-15', end: '2026-06-21' }, { workingDays: ['1', '3', '5'] }, ctx), 3);
  });
  test('a range ending on the last day of a month and one starting on the first join up', () => {
    const a = countLeaveDays({ start: '2026-06-22', end: '2026-06-30' }, fullTime, ctx); // Mon 22 .. Tue 30
    const b = countLeaveDays({ start: '2026-07-01', end: '2026-07-03' }, fullTime, ctx); // Wed 1 .. Fri 3
    assert.equal(a + b, countLeaveDays({ start: '2026-06-22', end: '2026-07-03' }, fullTime, ctx));
    assert.equal(a + b, 10);
  });
  test('missing ctx never throws', () => {
    assert.equal(countLeaveDays({ start: '2026-06-15', end: '2026-06-19' }, fullTime, undefined), 5);
    assert.equal(countLeaveDays({ start: '2026-06-15', end: '2026-06-19' }, fullTime, {}), 5);
  });
});

describe('clipToRange – year boundaries', () => {
  test('a holiday over 31 March / 1 April splits cleanly into two years', () => {
    const h = { start: '2026-03-30', end: '2026-04-03', halfDay: null };
    const prev = clipToRange(h, '2025-04-01', '2026-03-31');
    const next = clipToRange(h, '2026-04-01', '2027-03-31');
    assert.equal(countLeaveDays(prev, fullTime, ctx) + countLeaveDays(next, fullTime, ctx), countLeaveDays(h, fullTime, ctx));
  });
  test('a holiday over 31 December / 1 January splits for a January year', () => {
    const h = { start: '2026-12-28', end: '2027-01-04', halfDay: null }; // Mon 28 Dec .. Mon 4 Jan
    const a = clipToRange(h, '2026-01-01', '2026-12-31');
    const b = clipToRange(h, '2027-01-01', '2027-12-31');
    assert.deepEqual([a.start, a.end, b.start, b.end], ['2026-12-28', '2026-12-31', '2027-01-01', '2027-01-04']);
    assert.equal(countLeaveDays(a, fullTime, ctxNoBankHols), 4);
    assert.equal(countLeaveDays(b, fullTime, ctxNoBankHols), 2);
  });
  test('a half day exactly on the year boundary stays a half day', () => {
    const h = { start: '2026-04-01', end: '2026-04-01', halfDay: 'pm' };
    assert.equal(countLeaveDays(clipToRange(h, '2026-04-01', '2027-03-31'), fullTime, ctx), 0.5);
    assert.equal(clipToRange(h, '2025-04-01', '2026-03-31'), null);
  });
});

describe('shift patterns', () => {
  // Week 1 = Mon to Fri, week 2 = Wed to Sun. 2026-08-31 is a Monday and starts a week 1.
  const alternate = { id: 'p1', workingDays: [1, 2, 3, 4, 5], shiftPattern: { weeks: [[1, 2, 3, 4, 5], [3, 4, 5, 6, 7]], anchor: '2026-09-02' } };

  test('shiftPatternOf tidies the weeks and anchors on a Monday; incomplete patterns are ignored', () => {
    const { shiftPatternOf } = ldm;
    assert.deepEqual(shiftPatternOf(alternate), { weeks: [[1, 2, 3, 4, 5], [3, 4, 5, 6, 7]], anchor: '2026-08-31' });
    assert.equal(shiftPatternOf(fullTime), null);
    assert.equal(shiftPatternOf({ shiftPattern: { weeks: [[1]], anchor: '2026-08-31' } }), null, 'one week is not a pattern');
    assert.equal(shiftPatternOf({ shiftPattern: { weeks: [[1], [2]], anchor: 'nope' } }), null, 'needs a valid anchor');
    assert.equal(shiftPatternOf({ shiftPattern: { weeks: [[], []], anchor: '2026-08-31' } }), null, 'needs at least one working day');
    assert.deepEqual(shiftPatternOf({ shiftPattern: { weeks: [['5', 5, 1, 9], []], anchor: '2026-08-31' } }).weeks, [[1, 5], []], 'a week off is allowed');
  });

  test('the pattern repeats in both directions from the anchor week', () => {
    const { workingDaysOn, patternWeekIndex, shiftPatternOf } = ldm;
    const p = shiftPatternOf(alternate);
    assert.equal(patternWeekIndex('2026-08-31', p), 0);
    assert.equal(patternWeekIndex('2026-09-06', p), 0, 'Sunday is still week 1');
    assert.equal(patternWeekIndex('2026-09-07', p), 1);
    assert.equal(patternWeekIndex('2026-09-14', p), 0);
    assert.equal(patternWeekIndex('2026-08-24', p), 1, 'the week before the anchor is week 2');
    assert.equal(patternWeekIndex('2026-08-17', p), 0);
    assert.deepEqual(workingDaysOn('2026-09-05', alternate), [1, 2, 3, 4, 5]);
    assert.deepEqual(workingDaysOn('2026-09-12', alternate), [3, 4, 5, 6, 7]);
    assert.deepEqual(workingDaysOn('2026-09-12', fullTime), [1, 2, 3, 4, 5], 'no pattern: the usual week');
  });

  test('holidays only use days on the weeks they would have worked', () => {
    // Sat 5 – Sun 6 Sep is a week-1 weekend (off); Sat 12 – Sun 13 Sep is a week-2 weekend (working).
    assert.equal(countLeaveDays({ start: '2026-09-05', end: '2026-09-06' }, alternate, ctx), 0);
    assert.equal(countLeaveDays({ start: '2026-09-12', end: '2026-09-13' }, alternate, ctx), 2);
    assert.equal(countLeaveDays({ start: '2026-09-07', end: '2026-09-13' }, alternate, ctx), 5, 'week 2: Wed to Sun');
    assert.equal(countLeaveDays({ start: '2026-08-31', end: '2026-09-13' }, alternate, ctx), 10);
    assert.equal(classifyDay('2026-09-07', alternate, ctx), 'non-working', 'Monday of a week 2');
    assert.equal(isWorkingDay('2026-09-13', alternate, ctx), true);
    const b = leaveDaysBreakdown({ start: '2026-09-07', end: '2026-09-08' }, alternate, ctx);
    assert.deepEqual(b.skipped.map((x) => x.reason), ['non-working', 'non-working']);
  });

  test('describing patterns', () => {
    const { describeDays, describePatternWeek, workingDaysPerWeek } = ldm;
    assert.equal(describeWorkingPattern(alternate), 'Mon to Fri, then Wed to Sun (repeats every 2 weeks)');
    assert.equal(describeWorkingPattern({ shiftPattern: { weeks: [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5], []], anchor: '2026-08-31' } }), 'Mon to Fri, then Mon to Fri, then no days (repeats every 3 weeks)');
    assert.equal(describeDays([6, 7]), 'Sat and Sun');
    assert.equal(describeDays([]), 'no days');
    assert.equal(describePatternWeek('2026-09-09', alternate), 'Week 2 of 2 – Wed to Sun');
    assert.equal(describePatternWeek('2026-09-09', fullTime), '');
    assert.equal(workingDaysPerWeek(alternate), 5);
    assert.equal(workingDaysPerWeek({ shiftPattern: { weeks: [[1, 2, 3, 4, 5], []], anchor: '2026-08-31' } }), 2.5);
    assert.equal(workingDaysPerWeek(partTime), 3);
  });
});
