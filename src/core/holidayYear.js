// The "holiday year" is the 12 months entitlement is measured over.
// It may start on 1 January, 1 April, or any other day – it's a setting.
import { makeISO, addDays, addYears, daysInMonth, parts, todayISO, minISO, maxISO } from './dates.js';

function startFor(year, hys) {
  const m = hys?.month || 1;
  const d = Math.min(hys?.day || 1, daysInMonth(year, m));
  return makeISO(year, m, d);
}

/** Label shown to users: '2026' for a January start, '2026/27' otherwise. */
export function yearLabel(startYear, hys) {
  const y = Number(startYear);
  if (!hys || (hys.month === 1 && hys.day === 1)) return String(y);
  return `${y}/${String(y + 1).slice(-2)}`;
}

/** { key, label, start, end } for the holiday year beginning in `startYear`. */
export function yearBounds(startYear, settings) {
  const hys = settings.holidayYearStart;
  const y = Number(startYear);
  const start = startFor(y, hys);
  const end = addDays(startFor(y + 1, hys), -1);
  return { key: String(y), label: yearLabel(y, hys), start, end };
}

/** Which holiday year a date falls in. Returns the key ('2026'). */
export function yearKeyFor(iso, settings) {
  const { y } = parts(iso);
  const start = startFor(y, settings.holidayYearStart);
  return String(iso >= start ? y : y - 1);
}

export function yearBoundsFor(iso, settings) {
  return yearBounds(yearKeyFor(iso, settings), settings);
}

export function currentYear(settings, today = todayISO()) {
  return yearBoundsFor(today, settings);
}

/** Holiday years around today, e.g. two past, the current one and one ahead. */
export function yearsAround(settings, { past = 2, future = 1, today = todayISO() } = {}) {
  const cur = Number(yearKeyFor(today, settings));
  const out = [];
  for (let y = cur - past; y <= cur + future; y++) out.push(yearBounds(y, settings));
  return out;
}

/** Every holiday year touched by the data (plus current), sorted ascending. */
export function yearsCovering(dates, settings, today = todayISO()) {
  const keys = new Set([yearKeyFor(today, settings)]);
  for (const d of dates) if (d) keys.add(yearKeyFor(d, settings));
  return [...keys].map(Number).sort((a, b) => a - b).map((y) => yearBounds(y, settings));
}

/**
 * Split an inclusive date range into pieces that each sit inside one holiday year.
 * Returns [{ key, label, start, end }].
 */
export function splitRangeByYear(start, end, settings) {
  const out = [];
  if (!start || !end || end < start) return out;
  let cur = start;
  while (cur <= end) {
    const yb = yearBoundsFor(cur, settings);
    const pieceEnd = minISO(end, yb.end);
    out.push({ key: yb.key, label: yb.label, start: cur, end: pieceEnd });
    cur = addDays(pieceEnd, 1);
  }
  return out;
}

/** Fraction (0–1) of the holiday year that a carer is employed, given start/end dates. */
export function employedFractionOfYear(yb, startDate, endDate) {
  const from = startDate ? maxISO(yb.start, startDate) : yb.start;
  const to = endDate ? minISO(yb.end, endDate) : yb.end;
  if (to < from) return 0;
  const total = daysBetweenInclusive(yb.start, yb.end);
  const employed = daysBetweenInclusive(from, to);
  return Math.max(0, Math.min(1, employed / total));
}

function daysBetweenInclusive(a, b) {
  const ms = Date.UTC(...u(b)) - Date.UTC(...u(a));
  return Math.round(ms / 86400000) + 1;
}
function u(iso) { const { y, m, d } = parts(iso); return [y, m - 1, d]; }

export { addYears };
