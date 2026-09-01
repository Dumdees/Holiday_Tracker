import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../../src/core/dates.js';

test('validity and parsing', () => {
  assert.ok(d.isValidISO('2026-02-28'));
  assert.ok(!d.isValidISO('2026-02-30'));
  assert.ok(d.isValidISO('2024-02-29'));
  assert.ok(!d.isValidISO('2023-02-29'));
  assert.ok(!d.isValidISO('26-02-01'));
  assert.equal(d.parseLooseDate('03/04/2026'), '2026-04-03');
  assert.equal(d.parseLooseDate('3/4/26'), '2026-04-03');
  assert.equal(d.parseLooseDate('2026-04-03'), '2026-04-03');
  assert.equal(d.parseLooseDate('3 Apr 2026'), '2026-04-03');
  assert.equal(d.parseLooseDate('3 April 2026'), '2026-04-03');
  assert.equal(d.parseLooseDate('31/02/2026'), null);
  assert.equal(d.parseLooseDate(''), null);
});

test('arithmetic', () => {
  assert.equal(d.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(d.addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(d.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(d.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(d.addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(d.addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(d.addYears('2024-02-29', 1), '2025-02-28');
  assert.equal(d.diffDays('2026-01-01', '2026-12-31'), 364);
  assert.equal(d.diffDays('2026-03-29', '2026-03-30'), 1); // BST clock change day
  assert.equal(d.diffDays('2026-10-25', '2026-10-26'), 1);
  assert.equal(d.isoWeekday('2026-04-01'), 3); // Wednesday
  assert.equal(d.isoWeekday('2026-04-05'), 7); // Sunday
  assert.ok(d.isWeekend('2026-04-04'));
  assert.equal(d.eachDay('2026-04-01', '2026-04-03').length, 3);
  assert.deepEqual(d.eachDay('2026-04-03', '2026-04-01'), []);
  assert.ok(d.rangesOverlap('2026-04-01', '2026-04-05', '2026-04-05', '2026-04-09'));
  assert.ok(!d.rangesOverlap('2026-04-01', '2026-04-05', '2026-04-06', '2026-04-09'));
});

test('weeks and months', () => {
  assert.equal(d.startOfWeek('2026-04-01', 1), '2026-03-30');
  assert.equal(d.startOfWeek('2026-04-05', 1), '2026-03-30');
  assert.equal(d.startOfWeek('2026-04-05', 7), '2026-04-05');
  assert.equal(d.endOfWeek('2026-04-01', 1), '2026-04-05');
  assert.equal(d.startOfMonth('2026-04-17'), '2026-04-01');
  assert.equal(d.endOfMonth('2026-02-10'), '2026-02-28');
  const grid = d.monthGrid(2026, 4, 1);
  assert.equal(grid.length, 6);
  assert.equal(grid[0][0].iso, '2026-03-30');
  assert.equal(grid[0][0].inMonth, false);
  assert.equal(grid[0][2].iso, '2026-04-01');
  assert.equal(grid[0][2].inMonth, true);
  assert.deepEqual(d.weekdayHeaders(1), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(d.weekdayHeaders(7), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
});

test('formatting', () => {
  assert.equal(d.formatShort('2026-03-03'), 'Tue 3 Mar 2026');
  assert.equal(d.formatLong('2026-03-03'), 'Tuesday 3 March 2026');
  assert.equal(d.formatNumeric('2026-03-03'), '03/03/2026');
  assert.equal(d.formatRange('2026-03-03', '2026-03-03'), 'Tue 3 Mar 2026');
  assert.equal(d.formatRange('2026-03-02', '2026-03-06'), 'Mon 2 – Fri 6 Mar 2026');
  assert.equal(d.formatRange('2026-03-28', '2026-04-02'), '28 Mar – 2 Apr 2026');
  assert.equal(d.formatRange('2025-12-30', '2026-01-02'), '30 Dec 2025 – 2 Jan 2026');
  assert.equal(d.formatMonthYear('2026-04'), 'April 2026');
  assert.equal(d.relativeDay('2026-04-01', '2026-04-01'), 'Today');
  assert.equal(d.relativeDay('2026-04-02', '2026-04-01'), 'Tomorrow');
  assert.equal(d.relativeDay('2026-04-04', '2026-04-01'), 'in 3 days');
  assert.equal(d.relativeDay('2026-03-04', '2026-04-01'), '4 weeks ago');
  assert.equal(d.pluralise(1, 'day'), '1 day');
  assert.equal(d.pluralise(1.5, 'day'), '1.5 days');
  assert.equal(d.pluralise(0, 'day'), '0 days');
});
