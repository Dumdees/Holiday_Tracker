// How many days a holiday really uses. Only the carer's working days count, and
// (when the setting says so) bank holidays inside the range are given back.
import { isValidISO, isoWeekday, addDays, rangesOverlap, minISO, maxISO, WEEKDAYS_SHORT } from './dates.js';

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];
/** Safety cap so a mistyped year (e.g. 9999) can never hang the app. */
const MAX_RANGE_DAYS = 2000;
const HALF_DAY_VALUES = new Set(['am', 'pm']);

/**
 * The carer's working days as ISO weekday numbers (1 = Mon … 7 = Sun), de-duplicated
 * and sorted. Falls back to Monday to Friday when none are recorded.
 * @param {{ workingDays?: Array<number|string> } | null | undefined} carer
 * @returns {number[]}
 */
export function workingDaysOf(carer) {
  const raw = Array.isArray(carer?.workingDays) ? carer.workingDays : [];
  const valid = raw.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const days = [...new Set(valid)].sort((a, b) => a - b);
  return days.length ? days : [...DEFAULT_WORKING_DAYS];
}

/** Core rule, with the working days already resolved (so loops don't recompute them). */
function classify(iso, workingDays, ctx) {
  if (!workingDays.includes(isoWeekday(iso))) return 'non-working';
  if (ctx?.settings?.bankHolidaysAreDaysOff && ctx.bankHolidayMap?.has(iso)) return 'bank-holiday';
  return 'working';
}

/**
 * Why a date does or doesn't count as leave for this carer.
 * @param {string} iso – 'YYYY-MM-DD'
 * @param {object} carer
 * @param {{ settings: object, bankHolidayMap?: Map<string, string> }} ctx
 * @returns {'working' | 'non-working' | 'bank-holiday'}
 */
export function classifyDay(iso, carer, ctx) {
  return classify(iso, workingDaysOf(carer), ctx);
}

/**
 * True when the carer would normally work on this date: it is one of their working
 * days and not a bank holiday that counts as a day off.
 * @param {string} iso – 'YYYY-MM-DD'
 * @param {object} carer
 * @param {{ settings: object, bankHolidayMap?: Map<string, string> }} ctx
 * @returns {boolean}
 */
export function isWorkingDay(iso, carer, ctx) {
  return classifyDay(iso, carer, ctx) === 'working';
}

/**
 * Count the days a holiday uses and say which dates counted and which were skipped.
 * A single day marked 'am'/'pm' counts 0.5 (or 0 if it isn't a working day); `halfDay`
 * is ignored when start and end differ. Missing or invalid dates (or end before start)
 * give zero. Ranges are capped at 2000 days.
 * @param {{ start: string, end: string, halfDay?: 'am'|'pm'|null }} holidayLike
 * @param {object} carer
 * @param {{ settings: object, bankHolidayMap?: Map<string, string> }} ctx
 * @returns {{ days: number, countedDays: string[], skipped: Array<{ date: string, reason: 'non-working'|'bank-holiday' }> }}
 */
export function leaveDaysBreakdown(holidayLike, carer, ctx) {
  const { start, end, halfDay } = holidayLike || {};
  if (!isValidISO(start) || !isValidISO(end) || end < start) return { days: 0, countedDays: [], skipped: [] };
  const workingDays = workingDaysOf(carer);
  const countedDays = [];
  const skipped = [];
  for (let iso = start, n = 0; iso <= end && n < MAX_RANGE_DAYS; iso = addDays(iso, 1), n++) {
    const kind = classify(iso, workingDays, ctx);
    if (kind === 'working') countedDays.push(iso);
    else skipped.push({ date: iso, reason: kind });
  }
  const isHalfDay = start === end && HALF_DAY_VALUES.has(halfDay);
  return { days: isHalfDay ? countedDays.length / 2 : countedDays.length, countedDays, skipped };
}

/**
 * Number of days a holiday uses for this carer (see leaveDaysBreakdown).
 * @param {{ start: string, end: string, halfDay?: 'am'|'pm'|null }} holidayLike
 * @param {object} carer
 * @param {{ settings: object, bankHolidayMap?: Map<string, string> }} ctx
 * @returns {number}
 */
export function countLeaveDays(holidayLike, carer, ctx) {
  return leaveDaysBreakdown(holidayLike, carer, ctx).days;
}

/**
 * A copy of the holiday trimmed to the inclusive range [start, end], or null when they
 * don’t overlap (or the holiday’s own dates are invalid or back to front). `halfDay`
 * survives only for a single-day holiday (the trimmed range is then still that same
 * day); a multi-day holiday never keeps it.
 * @param {{ start: string, end: string, halfDay?: 'am'|'pm'|null }} holidayLike
 * @param {string} start – 'YYYY-MM-DD' (missing = no lower bound)
 * @param {string} end – 'YYYY-MM-DD' (missing = no upper bound)
 * @returns {object | null}
 */
export function clipToRange(holidayLike, start, end) {
  if (!holidayLike || !isValidISO(holidayLike.start) || !isValidISO(holidayLike.end)) return null;
  if (holidayLike.end < holidayLike.start) return null;
  const lo = start || holidayLike.start;
  const hi = end || holidayLike.end;
  if (!rangesOverlap(holidayLike.start, holidayLike.end, lo, hi)) return null;
  const singleDay = holidayLike.start === holidayLike.end;
  return {
    ...holidayLike,
    start: maxISO(holidayLike.start, lo),
    end: minISO(holidayLike.end, hi),
    halfDay: singleDay ? holidayLike.halfDay ?? null : null,
  };
}

/** Are these sorted weekday numbers one unbroken run? */
function isConsecutive(sorted) {
  return sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
}

/**
 * The carer's working pattern in plain English: 'Mon to Fri', 'Mon, Wed, Fri',
 * 'Sat and Sun', 'Wed only' or 'Every day'.
 * @param {{ workingDays?: number[] } | null | undefined} carer
 * @returns {string}
 */
export function describeWorkingPattern(carer) {
  const days = workingDaysOf(carer);
  const names = days.map((n) => WEEKDAYS_SHORT[n - 1]);
  if (days.length === 7) return 'Every day';
  if (days.length === 1) return `${names[0]} only`;
  if (days.length === 2) return `${names[0]} and ${names[1]}`;
  if (isConsecutive(days)) return `${names[0]} to ${names[names.length - 1]}`;
  return names.join(', ');
}
