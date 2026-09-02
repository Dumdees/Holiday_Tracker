// UK bank holidays worked out from the gov.uk rules rather than a hard-coded list,
// so the app keeps working for any year without needing an update. Pure functions, no DOM.
//
// Every date is an ISO string 'YYYY-MM-DD'. A "map" is a Map<iso, name> built by
// `bankHolidayMap`, iterated in ascending date order.
import { makeISO, addDays, daysInMonth, isoWeekday, isWeekend, isValidISO, compareISO, parts, todayISO } from './dates.js';

/** Regions we know the rules for. 'none' means "don't use bank holidays". */
export const REGIONS = ['england-and-wales', 'scotland', 'northern-ireland', 'none'];

const ALL = ['england-and-wales', 'scotland', 'northern-ireland'];
const EW_NI = ['england-and-wales', 'northern-ireland'];
const SCOT = ['scotland'];
const NI = ['northern-ireland'];

const SUBSTITUTE_SUFFIX = ' (substitute day)';
const DEFAULT_NAME = 'Bank holiday';

// ---------- Working out dates ----------

/**
 * Easter Sunday for a year, using the Anonymous Gregorian algorithm.
 * @param {number} year
 * @returns {string} ISO date
 */
export function easterSunday(year) {
  const y = Number(year);
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeISO(y, month, day);
}

/** A rule that lands on the same calendar day every year. */
const fixedOn = (month, day) => (year) => makeISO(year, month, day);

/** A rule a fixed number of days from Easter Sunday. */
const easterPlus = (offset) => (year) => addDays(easterSunday(year), offset);

/** First Monday of a month. */
const firstMondayOf = (month) => (year) => {
  const first = makeISO(year, month, 1);
  return addDays(first, (8 - isoWeekday(first)) % 7);
};

/** Last Monday of a month. */
const lastMondayOf = (month) => (year) => {
  const last = makeISO(year, month, daysInMonth(year, month));
  return addDays(last, 1 - isoWeekday(last));
};

// The standing rules (gov.uk). `fixed` rules move to the next free weekday when they fall
// on a weekend ("substitute day"); the others always land on a weekday by construction.
const RULES = [
  { id: 'new-years-day', name: "New Year's Day", regions: ALL, date: fixedOn(1, 1), fixed: true },
  { id: 'second-january', name: '2 January', regions: SCOT, date: fixedOn(1, 2), fixed: true },
  { id: 'st-patricks-day', name: "St Patrick's Day", regions: NI, date: fixedOn(3, 17), fixed: true },
  { id: 'good-friday', name: 'Good Friday', regions: ALL, date: easterPlus(-2), fixed: false },
  { id: 'easter-monday', name: 'Easter Monday', regions: EW_NI, date: easterPlus(1), fixed: false },
  { id: 'early-may', name: 'Early May bank holiday', regions: ALL, date: firstMondayOf(5), fixed: false },
  { id: 'spring', name: 'Spring bank holiday', regions: ALL, date: lastMondayOf(5), fixed: false },
  { id: 'battle-of-the-boyne', name: 'Battle of the Boyne', regions: NI, date: fixedOn(7, 12), fixed: true },
  { id: 'summer-scotland', name: 'Summer bank holiday', regions: SCOT, date: firstMondayOf(8), fixed: false },
  { id: 'summer', name: 'Summer bank holiday', regions: EW_NI, date: lastMondayOf(8), fixed: false },
  { id: 'st-andrews-day', name: "St Andrew's Day", regions: SCOT, date: fixedOn(11, 30), fixed: true },
  { id: 'christmas-day', name: 'Christmas Day', regions: ALL, date: fixedOn(12, 25), fixed: true },
  { id: 'boxing-day', name: 'Boxing Day', regions: ALL, date: fixedOn(12, 26), fixed: true },
];

// One-off changes announced by the government, applied to every region.
// `moved` replaces a rule's date (by rule id) for that year; `added` are extra days.
const EXTRA = {
  2020: {
    moved: { 'early-may': { date: '2020-05-08', name: 'Early May bank holiday (VE Day)' } },
  },
  2022: {
    moved: { spring: { date: '2022-06-02' } },
    added: [
      { date: '2022-06-03', name: 'Platinum Jubilee bank holiday' },
      { date: '2022-09-19', name: 'Bank holiday for the State Funeral of Queen Elizabeth II' },
    ],
  },
  2023: {
    added: [{ date: '2023-05-08', name: 'Bank holiday for the coronation of King Charles III' }],
  },
};

const byDate = (a, b) => compareISO(a.date, b.date);

/** The year's holidays before substitute days are worked out: [{ date, name, fixed }]. */
function nominalHolidays(year, region) {
  const extra = EXTRA[year] || {};
  const moved = extra.moved || {};
  const list = [];
  for (const rule of RULES) {
    if (!rule.regions.includes(region)) continue;
    const move = moved[rule.id];
    if (move) list.push({ date: move.date, name: move.name || rule.name, fixed: false });
    else list.push({ date: rule.date(year), name: rule.name, fixed: rule.fixed });
  }
  for (const { date, name } of extra.added || []) list.push({ date, name, fixed: false });
  return list;
}

function needsSubstitute(entry) {
  return entry.fixed && isWeekend(entry.date);
}

/**
 * Move weekend fixed-date holidays to the next weekday that is not already a bank
 * holiday. Days that stay put are claimed first, then the weekend ones are resolved in
 * calendar order, so pairs like Christmas Day / Boxing Day land on consecutive free days.
 */
function resolveSubstitutes(entries) {
  const taken = new Set(entries.filter((e) => !needsSubstitute(e)).map((e) => e.date));
  const out = [];
  for (const entry of [...entries].sort(byDate)) {
    if (!needsSubstitute(entry)) {
      out.push({ date: entry.date, name: entry.name });
      continue;
    }
    let date = addDays(entry.date, 1);
    while (isWeekend(date) || taken.has(date)) date = addDays(date, 1);
    taken.add(date);
    out.push({ date, name: entry.name + SUBSTITUTE_SUFFIX });
  }
  return out.sort(byDate);
}

/** Keep the first entry for each date. */
function dedupeByDate(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (seen.has(item.date)) continue;
    seen.add(item.date);
    out.push(item);
  }
  return out;
}

// ---------- Public API ----------

/**
 * Bank holidays for one calendar year in a region, including substitute days and
 * one-off days. Sorted ascending, no duplicate dates.
 * @param {number} year e.g. 2026
 * @param {string} region one of REGIONS; 'none' or an unknown region gives []
 * @returns {{ date: string, name: string }[]}
 */
export function bankHolidaysForYear(year, region) {
  const y = Number(year);
  if (!Number.isInteger(y) || region === 'none' || !REGIONS.includes(region)) return [];
  return dedupeByDate(resolveSubstitutes(nominalHolidays(y, region)));
}

/**
 * Map<iso, name> of every bank holiday from `fromYear` to `toYear` inclusive, with the
 * user's overrides applied: `overrides.added` ([{ date, name }]) are set (name defaults
 * to 'Bank holiday'), then `overrides.removed` ([iso]) are deleted. Iterates in ascending
 * date order. When the years are omitted, covers two years either side of `today`.
 * @param {object} opts
 * @param {string} [opts.region='none'] one of REGIONS
 * @param {{ added?: { date: string, name?: string }[], removed?: string[] }} [opts.overrides]
 * @param {number} [opts.fromYear]
 * @param {number} [opts.toYear]
 * @param {string} [opts.today] ISO date used only to pick default years
 * @returns {Map<string, string>}
 */
export function bankHolidayMap({ region = 'none', overrides, fromYear, toYear, today = todayISO() } = {}) {
  const centre = parts(today).y;
  const from = fromYear == null ? centre - 2 : Number(fromYear);
  const to = toYear == null ? centre + 2 : Number(toYear);
  const entries = new Map();
  for (let y = from; y <= to; y++) {
    for (const { date, name } of bankHolidaysForYear(y, region)) entries.set(date, name);
  }
  for (const item of overrides?.added || []) {
    if (!item || !isValidISO(item.date)) continue;
    entries.set(item.date, String(item.name || '').trim() || DEFAULT_NAME);
  }
  for (const date of overrides?.removed || []) entries.delete(date);
  return new Map([...entries].sort(([a], [b]) => compareISO(a, b)));
}

/**
 * Bank holidays between two dates, inclusive of both ends, sorted ascending.
 * @param {string} start ISO date
 * @param {string} end ISO date
 * @param {Map<string, string>} map from bankHolidayMap
 * @returns {{ date: string, name: string }[]}
 */
export function bankHolidaysBetween(start, end, map) {
  const out = [];
  if (!map || !start || !end || end < start) return out;
  for (const [date, name] of map) {
    if (date >= start && date <= end) out.push({ date, name });
  }
  return out.sort(byDate);
}

/**
 * Is this day a bank holiday (after overrides)?
 * @param {string} iso
 * @param {Map<string, string>} map from bankHolidayMap
 * @returns {boolean}
 */
export function isBankHoliday(iso, map) {
  return !!map && map.has(iso);
}

/**
 * The bank holiday's name for a day, or null when it isn't one.
 * @param {string} iso
 * @param {Map<string, string>} map from bankHolidayMap
 * @returns {string | null}
 */
export function bankHolidayName(iso, map) {
  if (!map || !map.has(iso)) return null;
  return map.get(iso);
}
