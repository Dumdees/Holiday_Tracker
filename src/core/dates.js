// Every date in the app is a plain string 'YYYY-MM-DD'. No timezones, no surprises.

const pad = (n) => String(n).padStart(2, '0');

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // index 0 = Mon
export const WEEKDAYS_SHORT = WEEKDAYS_LONG.map((d) => d.slice(0, 3));

export function isValidISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local-midnight Date for an ISO string. */
export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function makeISO(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function todayISO() {
  return toISO(new Date());
}

export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(iso, n) {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function addYears(iso, n) {
  return addMonths(iso, n * 12);
}

/** Whole days from a to b (b - a). Same day = 0. */
export function diffDays(a, b) {
  const ms = Date.UTC(...utcParts(b)) - Date.UTC(...utcParts(a));
  return Math.round(ms / 86400000);
}

function utcParts(iso) {
  const { y, m, d } = parts(iso);
  return [y, m - 1, d];
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(iso) {
  const wd = fromISO(iso).getDay(); // 0 = Sunday
  return wd === 0 ? 7 : wd;
}

export function isWeekend(iso) {
  return isoWeekday(iso) >= 6;
}

export function compareISO(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minISO(a, b) { return a < b ? a : b; }
export function maxISO(a, b) { return a > b ? a : b; }

export function clampISO(iso, lo, hi) {
  if (lo && iso < lo) return lo;
  if (hi && iso > hi) return hi;
  return iso;
}

/** Inclusive list of every day from start to end. Empty if end < start. */
export function eachDay(start, end) {
  const out = [];
  if (!start || !end || end < start) return out;
  let cur = start;
  const limit = 5000;
  while (cur <= end && out.length < limit) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}

/** Do two inclusive ranges share at least one day? */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function isBetween(iso, start, end) {
  return iso >= start && iso <= end;
}

export function startOfMonth(iso) { const { y, m } = parts(iso); return makeISO(y, m, 1); }
export function endOfMonth(iso) { const { y, m } = parts(iso); return makeISO(y, m, daysInMonth(y, m)); }
export function monthKey(iso) { return iso.slice(0, 7); } // 'YYYY-MM'

/** Monday-based (or `weekStartsOn`) start of the week containing iso. */
export function startOfWeek(iso, weekStartsOn = 1) {
  const wd = isoWeekday(iso);
  const diff = (wd - weekStartsOn + 7) % 7;
  return addDays(iso, -diff);
}

export function endOfWeek(iso, weekStartsOn = 1) {
  return addDays(startOfWeek(iso, weekStartsOn), 6);
}

/**
 * Rows of 7 cells for a month view. Each cell: { iso, inMonth }.
 * Always returns 6 rows so the calendar never jumps in height.
 */
export function monthGrid(year, month, weekStartsOn = 1) {
  const first = makeISO(year, month, 1);
  let cur = startOfWeek(first, weekStartsOn);
  const rows = [];
  for (let r = 0; r < 6; r++) {
    const row = [];
    for (let c = 0; c < 7; c++) {
      row.push({ iso: cur, inMonth: cur.slice(0, 7) === first.slice(0, 7) });
      cur = addDays(cur, 1);
    }
    rows.push(row);
  }
  return rows;
}

/** Weekday headers in display order for the given week start. */
export function weekdayHeaders(weekStartsOn = 1, style = 'short') {
  const src = style === 'long' ? WEEKDAYS_LONG : WEEKDAYS_SHORT;
  const out = [];
  for (let i = 0; i < 7; i++) out.push(src[(weekStartsOn - 1 + i) % 7]);
  return out;
}

// ---------- Friendly formatting (UK style) ----------
export function monthName(m, short = false) { return (short ? MONTHS_SHORT : MONTHS)[m - 1]; }
export function weekdayName(n, short = false) { return (short ? WEEKDAYS_SHORT : WEEKDAYS_LONG)[n - 1]; }

/** 'Mon 3 Mar 2026' */
export function formatShort(iso, { year = true } = {}) {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return `${WEEKDAYS_SHORT[isoWeekday(iso) - 1]} ${d} ${MONTHS_SHORT[m - 1]}${year ? ' ' + y : ''}`;
}

/** 'Monday 3 March 2026' */
export function formatLong(iso) {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return `${WEEKDAYS_LONG[isoWeekday(iso) - 1]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** '3 Mar' or '3 Mar 2026' */
export function formatDay(iso, { year = false } = {}) {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS_SHORT[m - 1]}${year ? ' ' + y : ''}`;
}

/** '03/03/2026' */
export function formatNumeric(iso) {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return `${pad(d)}/${pad(m)}/${y}`;
}

/** 'March 2026' */
export function formatMonthYear(isoOrKey) {
  const [y, m] = isoOrKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** 'Mon 3 – Fri 7 Mar 2026', '28 Mar – 2 Apr 2026', '30 Dec 2025 – 2 Jan 2026', or a single day. */
export function formatRange(start, end) {
  if (!start) return '';
  if (!end || end === start) return formatShort(start);
  const a = parts(start), b = parts(end);
  if (a.y !== b.y) return `${formatDay(start, { year: true })} – ${formatDay(end, { year: true })}`;
  if (a.m !== b.m) return `${formatDay(start)} – ${formatDay(end)} ${a.y}`;
  return `${WEEKDAYS_SHORT[isoWeekday(start) - 1]} ${a.d} – ${WEEKDAYS_SHORT[isoWeekday(end) - 1]} ${b.d} ${MONTHS_SHORT[a.m - 1]} ${a.y}`;
}

/** 'Today', 'Tomorrow', 'in 3 days', '2 weeks ago' … relative to `today`. */
export function relativeDay(iso, today = todayISO()) {
  const n = diffDays(today, iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const abs = Math.abs(n);
  const unit = abs >= 14 ? `${Math.round(abs / 7)} weeks` : `${abs} days`;
  return n > 0 ? `in ${unit}` : `${unit} ago`;
}

/** Plural helper: pluralise(1.5, 'day') → '1.5 days'; pluralise(1, 'day') → '1 day' */
export function pluralise(n, singular, plural = singular + 's') {
  const v = Number(n);
  const shown = Number.isInteger(v) ? String(v) : String(Math.round(v * 2) / 2);
  return `${shown} ${v === 1 ? singular : plural}`;
}

/** Parse a variety of typed inputs ('03/04/2026', '2026-04-03', '3 Apr 2026') to ISO or null. */
export function parseLooseDate(text) {
  if (!text) return null;
  const t = String(text).trim();
  if (isValidISO(t)) return t;
  let m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    y = y.length === 2 ? '20' + y : y;
    const iso = makeISO(Number(y), Number(mo), Number(d));
    return isValidISO(iso) ? iso : null;
  }
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (m) {
    const [, d, mon, y] = m;
    const idx = MONTHS.findIndex((x) => x.toLowerCase().startsWith(mon.toLowerCase().slice(0, 3)));
    if (idx >= 0) {
      const iso = makeISO(Number(y), idx + 1, Number(d));
      return isValidISO(iso) ? iso : null;
    }
  }
  const dt = new Date(t);
  return Number.isNaN(dt.getTime()) ? null : toISO(dt);
}
