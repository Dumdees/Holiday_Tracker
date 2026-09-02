import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDays, fmtPercent, niceTicks, truncateLabel, textWidth, fitLabel, sum } from '../../src/ui/charts/format.js';

test('fmtDays writes days the way people do', () => {
  assert.equal(fmtDays(12), '12');
  assert.equal(fmtDays(12.0), '12');
  assert.equal(fmtDays(12.5), '12.5');
  assert.equal(fmtDays(0.5), '0.5');
  assert.equal(fmtDays(-1.5), '-1.5');
  assert.equal(fmtDays(0), '0');
  assert.equal(fmtDays(-0), '0');
  assert.equal(fmtDays(-0.04), '0');
  assert.equal(fmtDays(2.25), '2.3');
  assert.equal(fmtDays(1234.5), '1,234.5');
  assert.equal(fmtDays('7.5'), '7.5');
  assert.equal(fmtDays(null), '0');
  assert.equal(fmtDays(undefined), '0');
  assert.equal(fmtDays(NaN), '0');
  assert.equal(fmtDays('abc'), '0');
  assert.equal(fmtDays(Infinity), '0');
});

test('fmtPercent turns a fraction into a whole percentage', () => {
  assert.equal(fmtPercent(0.43), '43%');
  assert.equal(fmtPercent(0.4349), '43%');
  assert.equal(fmtPercent(0.435), '44%');
  assert.equal(fmtPercent(0), '0%');
  assert.equal(fmtPercent(1), '100%');
  assert.equal(fmtPercent(1.2), '120%');
  assert.equal(fmtPercent(-0.001), '0%');
  assert.equal(fmtPercent(NaN), '0%');
  assert.equal(fmtPercent(undefined), '0%');
});

test('niceTicks picks round numbers that cover the maximum', () => {
  assert.deepEqual(niceTicks(28), [0, 10, 20, 30]);
  assert.deepEqual(niceTicks(12), [0, 5, 10, 15]);
  assert.deepEqual(niceTicks(100), [0, 25, 50, 75, 100]);
  assert.deepEqual(niceTicks(2.5), [0, 1, 2, 3]);
  assert.deepEqual(niceTicks(0.5), [0, 0.2, 0.4, 0.6]);
  assert.deepEqual(niceTicks(1), [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(niceTicks(7, 7), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(niceTicks(950, 5), [0, 200, 400, 600, 800, 1000]);
});

test('niceTicks always covers the maximum and starts at zero', () => {
  for (const max of [0.1, 0.3, 1, 3, 7, 9, 11, 19, 33, 47, 99, 101, 250, 999, 12345]) {
    for (const count of [2, 3, 4, 5, 6]) {
      const ticks = niceTicks(max, count);
      assert.equal(ticks[0], 0, `starts at 0 for ${max}/${count}`);
      assert.ok(ticks[ticks.length - 1] >= max, `covers ${max} with ${count} ticks: ${ticks}`);
      assert.ok(ticks.length >= 2 && ticks.length <= count + 3, `sensible count for ${max}/${count}: ${ticks}`);
      const step = ticks[1] - ticks[0];
      for (let i = 1; i < ticks.length; i++) assert.ok(Math.abs(ticks[i] - ticks[i - 1] - step) < 1e-9, `even steps for ${max}: ${ticks}`);
    }
  }
});

test('niceTicks copes with nothing to show', () => {
  assert.deepEqual(niceTicks(0), [0, 1]);
  assert.deepEqual(niceTicks(-5), [0, 1]);
  assert.deepEqual(niceTicks(NaN), [0, 1]);
  assert.deepEqual(niceTicks(undefined), [0, 1]);
  assert.deepEqual(niceTicks(28, 0), [0, 10, 20, 30]);
  assert.deepEqual(niceTicks(28, 'many'), [0, 10, 20, 30]);
});

test('truncateLabel shortens with an ellipsis', () => {
  assert.equal(truncateLabel('Priya Sharma', 20), 'Priya Sharma');
  assert.equal(truncateLabel('Priya Sharma', 12), 'Priya Sharma');
  assert.equal(truncateLabel('Dominika Nowak', 8), 'Dominik…');
  assert.equal(truncateLabel('Dominika Nowak', 10), 'Dominika…');
  assert.equal(truncateLabel('Dominika Nowak', 1), '…');
  assert.equal(truncateLabel('Dominika Nowak', 0), '');
  assert.equal(truncateLabel('', 5), '');
  assert.equal(truncateLabel(null, 5), '');
  assert.equal(truncateLabel(42, 5), '42');
  assert.equal(truncateLabel('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnopq…');
  assert.equal(truncateLabel('abcdefghijklmnopqrstuvwxyz').length, 18);
});

test('textWidth and fitLabel use the rough 0.6em rule', () => {
  assert.equal(textWidth('abcde', 10), 30);
  assert.equal(textWidth('abcde'), 36);
  assert.equal(textWidth(''), 0);
  assert.equal(textWidth(null), 0);
  assert.equal(fitLabel('Dominika Nowak', 110), 'Dominika Nowak'); // 15 chars fit at 12px
  assert.equal(fitLabel('Dominika Nowak', 100), 'Dominika Now…'); // 13 chars fit
  assert.equal(fitLabel('Dominika Nowak', 60), 'Dominik…'); // 8 chars fit
  assert.equal(fitLabel('Dominika Nowak', 60, 24), 'Dom…');
  assert.equal(fitLabel('Dominika Nowak', 0), '');
});

test('sum ignores anything that is not a number', () => {
  assert.equal(sum([1, 2.5, '3', null, undefined, NaN, 'x']), 6.5);
  assert.equal(sum([]), 0);
  assert.equal(sum(null), 0);
});

test('fitLabel and truncateLabel cope with odd widths and spacing', () => {
  assert.equal(fitLabel('Priya Sharma', -10), '');
  assert.equal(fitLabel('Priya Sharma', NaN), '');
  assert.equal(fitLabel('Priya Sharma', Infinity), 'Priya Sharma');
  assert.equal(truncateLabel('Priya   Sharma', 8), 'Priya…'); // trailing spaces before the ellipsis go
  assert.equal(truncateLabel('Priya Sharma', 2.9), 'P…'); // fractional limits round down
  assert.equal(truncateLabel(undefined), '');
});

test('niceTicks handles fractions and very large counts sensibly', () => {
  assert.deepEqual(niceTicks(0.05), [0, 0.02, 0.04, 0.06]);
  assert.deepEqual(niceTicks(3, 100).slice(0, 3), [0, 0.05, 0.1]); // asks for many: still nice, still evenly spaced
  assert.equal(niceTicks(3, 100).at(-1), 3);
  assert.deepEqual(niceTicks('28'), [0, 10, 20, 30]);
});
