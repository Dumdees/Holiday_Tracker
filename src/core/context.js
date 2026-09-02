// One bundle of everything the pure core functions need to know: the settings,
// "today", which days are bank holidays, and quick lookups by id. Build it once
// per render (or once per test) and pass it around as `ctx`.
import { todayISO, parts, isValidISO } from './dates.js';
import { bankHolidayMap } from './bankHolidays.js';
import { defaultSettings } from '../store/defaults.js';

/** Calendar years either side of today that bank holidays are always pre-computed for. */
const BANK_HOLIDAY_YEARS_AROUND = 3;
/** Never pre-compute further than this from today, however far off a (mistyped) holiday is. */
const BANK_HOLIDAY_YEARS_MAX = 50;

/**
 * Records keyed by their `id`.
 * @param {Array<{ id: string }> | undefined} list
 * @returns {Map<string, object>}
 */
function byId(list) {
  return new Map((list || []).map((item) => [item.id, item]));
}

/**
 * The span of calendar years bank holidays are needed for: a few years either side of
 * today, widened to cover every holiday actually recorded (so a holiday booked well
 * ahead still gives its bank holidays back), within a sane limit.
 * @param {{ holidays?: object[] } | null | undefined} db
 * @param {number} centreYear
 * @returns {{ fromYear: number, toYear: number }}
 */
function bankHolidayYearSpan(db, centreYear) {
  let fromYear = centreYear - BANK_HOLIDAY_YEARS_AROUND;
  let toYear = centreYear + BANK_HOLIDAY_YEARS_AROUND;
  for (const holiday of db?.holidays || []) {
    for (const iso of [holiday?.start, holiday?.end]) {
      if (!isValidISO(iso)) continue;
      const year = parts(iso).y;
      if (year < fromYear) fromYear = year;
      if (year > toYear) toYear = year;
    }
  }
  return {
    fromYear: Math.max(fromYear, centreYear - BANK_HOLIDAY_YEARS_MAX),
    toYear: Math.min(toYear, centreYear + BANK_HOLIDAY_YEARS_MAX),
  };
}

/**
 * Build the context passed to leaveDays / entitlement / clashes / stats.
 * @param {object} db – the whole document: { settings, leaveTypes, teams, carers, bankHolidayOverrides, … }
 * @param {{ today?: string }} [options] – `today` as ISO 'YYYY-MM-DD' (defaults to the real date)
 * @returns {{
 *   settings: object,
 *   today: string,
 *   bankHolidayMap: Map<string, string>,
 *   leaveTypesById: Map<string, object>,
 *   teamsById: Map<string, object>,
 *   carersById: Map<string, object>,
 * }}
 */
export function buildContext(db, { today = todayISO() } = {}) {
  const settings = db?.settings || defaultSettings();
  const todayIso = isValidISO(today) ? today : todayISO();
  const { y } = parts(todayIso);
  return {
    settings,
    today: todayIso,
    bankHolidayMap: bankHolidayMap({
      region: settings.bankHolidayRegion,
      overrides: db?.bankHolidayOverrides || { added: [], removed: [] },
      ...bankHolidayYearSpan(db, y),
    }),
    leaveTypesById: byId(db?.leaveTypes),
    teamsById: byId(db?.teams),
    carersById: byId(db?.carers),
  };
}
