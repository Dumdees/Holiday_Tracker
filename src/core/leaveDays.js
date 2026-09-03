// How many days a holiday really uses. Only the carer's working days count, and
// (when the setting says so) bank holidays inside the range are given back.
import { isValidISO, isoWeekday, addDays, diffDays, startOfWeek, rangesOverlap, minISO, maxISO, WEEKDAYS_SHORT } from './dates.js';

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
  const days = tidyDays(carer?.workingDays);
  return days.length ? days : [...DEFAULT_WORKING_DAYS];
}

/** Valid, de-duplicated, sorted ISO weekday numbers from any list. */
function tidyDays(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const valid = list.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  return [...new Set(valid)].sort((a, b) => a - b);
}

export const MAX_PATTERN_WEEKS = 4;

/**
 * The carer's repeating shift pattern, if they have one: working days for each week of a
 * cycle of 2–4 weeks, plus the Monday that starts a "week 1". Some carers work every other
 * weekend, for example. Null when they work the same days every week (or the pattern on the
 * record is incomplete), so callers can fall back to `workingDaysOf`.
 * @param {{ shiftPattern?: { weeks?: number[][], anchor?: string } } | null | undefined} carer
 * @returns {{ weeks: number[][], anchor: string } | null}
 */
export function shiftPatternOf(carer) {
  const p = carer?.shiftPattern;
  if (!p || !Array.isArray(p.weeks) || p.weeks.length < 2 || !isValidISO(p.anchor)) return null;
  const weeks = p.weeks.slice(0, MAX_PATTERN_WEEKS).map(tidyDays);
  if (!weeks.some((w) => w.length)) return null;
  return { weeks, anchor: startOfWeek(p.anchor, 1) };
}

/**
 * Which week of the pattern (0-based) a date falls in. Weeks run Monday to Sunday and the
 * cycle repeats forever in both directions from the anchor week.
 * @param {string} iso – 'YYYY-MM-DD'
 * @param {{ weeks: number[][], anchor: string }} pattern – from shiftPatternOf
 * @returns {number}
 */
export function patternWeekIndex(iso, pattern) {
  const n = pattern.weeks.length;
  const weeks = Math.floor(diffDays(pattern.anchor, startOfWeek(iso, 1)) / 7);
  return ((weeks % n) + n) % n;
}

/**
 * The working days that apply on a particular date: the usual week, or the matching week of
 * the carer's shift pattern.
 * @param {string} iso – 'YYYY-MM-DD'
 * @param {object} carer
 * @returns {number[]}
 */
export function workingDaysOn(iso, carer) {
  const p = shiftPatternOf(carer);
  return p ? p.weeks[patternWeekIndex(iso, p)] : workingDaysOf(carer);
}

/** A function giving the working days for any date, resolved once per carer for loops. */
function dayResolver(carer) {
  const p = shiftPatternOf(carer);
  if (!p) { const usual = workingDaysOf(carer); return () => usual; }
  return (iso) => p.weeks[patternWeekIndex(iso, p)];
}

/**
 * Average number of working days a week (over the whole cycle for a shift pattern).
 * @param {object} carer
 * @returns {number}
 */
export function workingDaysPerWeek(carer) {
  const p = shiftPatternOf(carer);
  if (!p) return workingDaysOf(carer).length;
  return p.weeks.reduce((sum, w) => sum + w.length, 0) / p.weeks.length;
}

/** Core rule, with a resolver for the working days (so loops don't recompute the pattern). */
function classify(iso, daysFor, ctx) {
  if (!daysFor(iso).includes(isoWeekday(iso))) return 'non-working';
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
  return classify(iso, dayResolver(carer), ctx);
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
  const daysFor = dayResolver(carer);
  const countedDays = [];
  const skipped = [];
  for (let iso = start, n = 0; iso <= end && n < MAX_RANGE_DAYS; iso = addDays(iso, 1), n++) {
    const kind = classify(iso, daysFor, ctx);
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
  const p = shiftPatternOf(carer);
  if (!p) return describeDays(workingDaysOf(carer));
  return `${p.weeks.map(describeDays).join(', then ')} (repeats every ${p.weeks.length} weeks)`;
}

/**
 * One week's days in plain English: 'Mon to Fri', 'Mon, Wed, Fri', 'Sat and Sun', 'Wed only',
 * 'Every day' or 'no days'.
 * @param {number[]} raw – ISO weekday numbers
 * @returns {string}
 */
export function describeDays(raw) {
  const days = tidyDays(raw);
  const names = days.map((n) => WEEKDAYS_SHORT[n - 1]);
  if (days.length === 0) return 'no days';
  if (days.length === 7) return 'Every day';
  if (days.length === 1) return `${names[0]} only`;
  if (days.length === 2) return `${names[0]} and ${names[1]}`;
  if (isConsecutive(days)) return `${names[0]} to ${names[names.length - 1]}`;
  return names.join(', ');
}

/**
 * For a carer on a shift pattern: which week of the pattern a date is in, in plain English,
 * e.g. 'Week 2 of 2 – Wed to Sun'. Empty string for carers without a pattern.
 * @param {string} iso – 'YYYY-MM-DD'
 * @param {object} carer
 * @returns {string}
 */
export function describePatternWeek(iso, carer) {
  const p = shiftPatternOf(carer);
  if (!p) return '';
  const i = patternWeekIndex(iso, p);
  return `Week ${i + 1} of ${p.weeks.length} – ${describeDays(p.weeks[i])}`;
}
