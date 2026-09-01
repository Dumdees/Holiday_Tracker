import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as hy from '../../src/core/holidayYear.js';

const april = { holidayYearStart: { month: 4, day: 1 } };
const jan = { holidayYearStart: { month: 1, day: 1 } };

test('year keys and labels', () => {
  assert.equal(hy.yearKeyFor('2026-04-01', april), '2026');
  assert.equal(hy.yearKeyFor('2026-03-31', april), '2025');
  assert.equal(hy.yearKeyFor('2026-12-31', april), '2026');
  assert.equal(hy.yearKeyFor('2026-06-01', jan), '2026');
  assert.equal(hy.yearLabel(2026, april.holidayYearStart), '2026/27');
  assert.equal(hy.yearLabel(2026, jan.holidayYearStart), '2026');
  const yb = hy.yearBounds('2026', april);
  assert.deepEqual(yb, { key: '2026', label: '2026/27', start: '2026-04-01', end: '2027-03-31' });
  assert.deepEqual(hy.yearBounds(2026, jan), { key: '2026', label: '2026', start: '2026-01-01', end: '2026-12-31' });
});

test('odd start days clamp to month length', () => {
  const feb29 = { holidayYearStart: { month: 2, day: 29 } };
  assert.equal(hy.yearBounds(2025, feb29).start, '2025-02-28');
  assert.equal(hy.yearBounds(2024, feb29).start, '2024-02-29');
});

test('splitRangeByYear', () => {
  const pieces = hy.splitRangeByYear('2026-03-30', '2026-04-03', april);
  assert.equal(pieces.length, 2);
  assert.deepEqual(pieces[0], { key: '2025', label: '2025/26', start: '2026-03-30', end: '2026-03-31' });
  assert.deepEqual(pieces[1], { key: '2026', label: '2026/27', start: '2026-04-01', end: '2026-04-03' });
  assert.equal(hy.splitRangeByYear('2026-05-01', '2026-05-03', april).length, 1);
  assert.deepEqual(hy.splitRangeByYear('2026-05-03', '2026-05-01', april), []);
  assert.equal(hy.splitRangeByYear('2025-03-01', '2027-05-01', april).length, 4); // 2024/25, 25/26, 26/27, 27/28
});

test('yearsAround and yearsCovering', () => {
  const list = hy.yearsAround(april, { past: 1, future: 1, today: '2026-06-01' });
  assert.deepEqual(list.map((y) => y.key), ['2025', '2026', '2027']);
  const cov = hy.yearsCovering(['2023-05-01', '2027-06-01', null], april, '2026-06-01');
  assert.deepEqual(cov.map((y) => y.key), ['2023', '2026', '2027']);
});

test('employedFractionOfYear', () => {
  const yb = hy.yearBounds(2026, april);
  assert.equal(hy.employedFractionOfYear(yb, null, null), 1);
  assert.equal(hy.employedFractionOfYear(yb, '2020-01-01', null), 1);
  const half = hy.employedFractionOfYear(yb, '2026-10-01', null);
  assert.ok(half > 0.49 && half < 0.51, String(half));
  assert.equal(hy.employedFractionOfYear(yb, '2027-06-01', null), 0);
  assert.equal(hy.employedFractionOfYear(yb, null, '2026-03-01'), 0);
  const leaver = hy.employedFractionOfYear(yb, null, '2026-04-30');
  assert.ok(leaver > 0.08 && leaver < 0.085, String(leaver));
});
