// Number and label formatting shared by every chart. Pure functions – no DOM, fully unit-tested
// in tests/unit/chartFormat.test.js.

/** Rough width of a run of text: 0.6em per character. Good enough to decide truncation. */
const EM_PER_CHAR = 0.6;

/**
 * Days the way people write them: '12', '12.5', '0.5', '-1.5' – never '12.0'.
 * Rounds to one decimal place and groups thousands ('1,234.5'). Anything that is not a
 * finite number shows as '0'.
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export function fmtDays(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 10) / 10 || 0; // `|| 0` turns -0 into 0
  return r.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/**
 * A fraction as a whole percentage: fmtPercent(0.43) → '43%'. Values outside 0–1 are
 * still formatted (1.2 → '120%'); non-numbers show as '0%'.
 * @param {number} fraction – 0 … 1
 * @returns {string}
 */
export function fmtPercent(fraction) {
  const v = Number(fraction);
  if (!Number.isFinite(v)) return '0%';
  return `${Math.round(v * 100) || 0}%`;
}

/**
 * Evenly spaced "nice" axis ticks from 0 up to (at least) `max`, using steps of
 * 1, 2, 2.5, 5 or 10 × a power of ten. niceTicks(28) → [0, 10, 20, 30];
 * niceTicks(12) → [0, 5, 10, 15]; niceTicks(2.5) → [0, 1, 2, 3].
 * A max of 0 (or less, or not a number) gives [0, 1] so an axis can always be drawn.
 * @param {number} max – the largest value to show
 * @param {number} [count=4] – roughly how many ticks you would like
 * @returns {number[]}
 */
export function niceTicks(max, count = 4) {
  const m = Number(max);
  const n = Math.max(1, Math.floor(Number(count)) || 4);
  if (!Number.isFinite(m) || m <= 0) return [0, 1];
  const step = niceStep(m / n);
  const top = Math.ceil(m / step - 1e-9) * step;
  const ticks = [];
  for (let i = 0; i * step <= top + step / 2; i++) ticks.push(round6(i * step));
  return ticks;
}

/** Nearest "nice" step (1, 2, 2.5, 5, 10 × 10ⁿ) at or above `raw`. */
function niceStep(raw) {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return round6(nice * mag);
}

function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

/**
 * Cut a label to at most `max` characters, ending with an ellipsis when shortened.
 * truncateLabel('Dominika Nowak', 8) → 'Dominik…'. Trailing spaces before the ellipsis are removed.
 * @param {string} text
 * @param {number} [max=18] – maximum characters including the ellipsis
 * @returns {string}
 */
export function truncateLabel(text, max = 18) {
  const s = text == null ? '' : String(text);
  const limit = Math.floor(Number(max));
  if (!Number.isFinite(limit) || limit <= 0) return '';
  if (s.length <= limit) return s;
  if (limit === 1) return '…';
  return s.slice(0, limit - 1).replace(/\s+$/, '') + '…';
}

/**
 * Rough pixel width of `text` at a given font size (0.6em per character).
 * @param {string} text
 * @param {number} [fontSize=12]
 * @returns {number}
 */
export function textWidth(text, fontSize = 12) {
  const s = text == null ? '' : String(text);
  return s.length * fontSize * EM_PER_CHAR;
}

/**
 * Truncate `text` so it fits inside `maxWidth` pixels at `fontSize`, using the same rough
 * 0.6em-per-character rule as textWidth().
 * @param {string} text
 * @param {number} maxWidth – pixels available
 * @param {number} [fontSize=12]
 * @returns {string}
 */
export function fitLabel(text, maxWidth, fontSize = 12) {
  const chars = Math.floor(Number(maxWidth) / (fontSize * EM_PER_CHAR));
  return truncateLabel(text, chars);
}

/**
 * Sum of a list of numbers, ignoring anything that is not a finite number.
 * @param {Array<number|string|null|undefined>} values
 * @returns {number}
 */
export function sum(values) {
  let total = 0;
  for (const v of values || []) {
    const x = Number(v);
    if (Number.isFinite(x)) total += x;
  }
  return total;
}
