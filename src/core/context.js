// One bundle of everything the pure core functions need to know: the settings,
// "today", which days are bank holidays, and quick lookups by id. Build it once
// per render (or once per test) and pass it around as `ctx`.
import { todayISO, parts } from './dates.js';
import { bankHolidayMap } from './bankHolidays.js';
import { defaultSettings } from '../store/defaults.js';

/** Calendar years either side of today that bank holidays are pre-computed for. */
const BANK_HOLIDAY_YEARS_AROUND = 3;

/**
 * Records keyed by their `id`.
 * @param {Array<{ id: string }> | undefined} list
 * @returns {Map<string, object>}
 */
function byId(list) {
  return new Map((list || []).map((item) => [item.id, item]));
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
  const { y } = parts(today);
  return {
    settings,
    today,
    bankHolidayMap: bankHolidayMap({
      region: settings.bankHolidayRegion,
      overrides: db?.bankHolidayOverrides || { added: [], removed: [] },
      fromYear: y - BANK_HOLIDAY_YEARS_AROUND,
      toYear: y + BANK_HOLIDAY_YEARS_AROUND,
    }),
    leaveTypesById: byId(db?.leaveTypes),
    teamsById: byId(db?.teams),
    carersById: byId(db?.carers),
  };
}
