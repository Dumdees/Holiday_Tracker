// Fictional sample data so someone can explore the app before adding real
// carers. Everything is deterministic: the same `today` always produces the
// same document, because dates come from a seeded random generator, not the clock.
//
// Dependencies are kept to defaults.js, dates.js and holidayYear.js on purpose –
// the day counting here is a close approximation (working days only, no bank
// holidays), which is all a demo needs.
import { createEmptyDb, defaultSettings, newCarerRecord, newHolidayRecord, PALETTE } from './defaults.js';
import { addDays, addMonths, addYears, diffDays, eachDay, isoWeekday, maxISO, minISO, rangesOverlap, todayISO } from '../core/dates.js';
import { yearBounds, yearBoundsFor, yearKeyFor, employedFractionOfYear } from '../core/holidayYear.js';

const SEED = 20260401;
const MON_FRI = [1, 2, 3, 4, 5];
const ANNUAL = 'lt_annual';
const EARLIEST_START = '2014-01-01';
/** Holidays starting within this many days of today are scripted, not random, so Home stays tidy. */
const UPCOMING_DAYS = 14;
/** Random annual leave never takes a year above this share of the allowance. */
const USAGE_CEILING = 0.9;
/** Share of each year's allowance that random annual leave aims for (percent ranges). */
const YEAR_SHARES = { prev: [35, 65], cur: [30, 55], next: [5, 15] };
/** Calendar-day lengths for random annual leave; repeats make some lengths more common. */
const LENGTHS = [2, 3, 4, 5, 5, 6, 7, 7, 8, 9, 10, 10];
const NOTES = ['Wedding', 'Family visit', 'Long weekend away', 'Moving house', 'School holidays', 'Trip to Skye', 'Birthday', 'Camping'];
const TRAINING_NOTES = ['Moving and handling course', 'Medication refresher', 'First aid course'];

/** The three teams in the sample. */
export const SAMPLE_TEAMS = [
  { id: 'team_day', name: 'Day team', colour: '#F58F5B', maxOffPerDay: 2 },
  { id: 'team_night', name: 'Night team', colour: '#5F9BD1', maxOffPerDay: 1 },
  { id: 'team_weekend', name: 'Weekend & respite', colour: '#6FA582', maxOffPerDay: null },
];

/**
 * The 18 fictional carers. `kind` marks the special cases: 'starter' (started two
 * months into this holiday year), 'leaver' (leaves six weeks from today) and
 * 'archived' (left four months ago). Contact details are made up: 07700 900xxx
 * numbers are reserved for fiction and example.com never delivers mail.
 */
export const SAMPLE_CARERS = [
  { id: 'carer_s01', firstName: 'Morag', lastName: 'Sinclair', role: 'Senior carer', teamId: 'team_day', workingDays: MON_FRI, entitlementDays: 28, phone: '07700 900101', email: 'morag.sinclair@example.com', notes: 'First aider.' },
  { id: 'carer_s02', firstName: 'Priya', lastName: 'Patel', role: 'Care coordinator', teamId: 'team_day', workingDays: MON_FRI, entitlementDays: 30, phone: '07700 900102', email: 'priya.patel@example.com' },
  { id: 'carer_s03', firstName: 'Callum', lastName: 'Fraser', role: 'Carer', teamId: 'team_day', workingDays: MON_FRI, entitlementDays: 25 },
  { id: 'carer_s04', firstName: 'Aisha', lastName: 'Rahman', role: 'Carer', teamId: 'team_day', workingDays: MON_FRI, entitlementDays: 25, phone: '07700 900104', email: 'aisha.rahman@example.com', notes: 'Prefers morning visits.' },
  { id: 'carer_s05', firstName: 'Ewan', lastName: 'MacLeod', role: 'Carer', teamId: 'team_day', workingDays: MON_FRI, entitlementDays: 24 },
  { id: 'carer_s06', firstName: 'Grace', lastName: 'Okafor', role: 'Carer', teamId: 'team_day', workingDays: [1, 3, 5], entitlementDays: 17, phone: '07700 900106', notes: 'Part time – Mon, Wed, Fri.' },
  { id: 'carer_s07', firstName: 'Fiona', lastName: 'Campbell', role: 'Carer', teamId: 'team_day', workingDays: MON_FRI, entitlementDays: 28 },
  { id: 'carer_s08', firstName: 'Tomasz', lastName: 'Nowak', role: 'Carer', teamId: 'team_day', workingDays: MON_FRI, entitlementDays: 25, phone: '07700 900108', notes: 'Started this year, so entitlement is pro rata.', kind: 'starter' },
  { id: 'carer_s09', firstName: 'Isla', lastName: 'Robertson', role: 'Senior carer', teamId: 'team_night', workingDays: MON_FRI, entitlementDays: 28, phone: '07700 900109', email: 'isla.robertson@example.com' },
  { id: 'carer_s10', firstName: 'Daniel', lastName: 'Adeyemi', role: 'Carer', teamId: 'team_night', workingDays: MON_FRI, entitlementDays: 25 },
  { id: 'carer_s11', firstName: 'Kirsty', lastName: 'Buchanan', role: 'Carer', teamId: 'team_night', workingDays: [2, 4, 6], entitlementDays: 16, email: 'kirsty.buchanan@example.com', notes: 'Part time – Tue, Thu, Sat.' },
  { id: 'carer_s12', firstName: 'Hamza', lastName: 'Iqbal', role: 'Carer', teamId: 'team_night', workingDays: MON_FRI, entitlementDays: 22 },
  { id: 'carer_s13', firstName: 'Eilidh', lastName: 'Grant', role: 'Carer', teamId: 'team_night', workingDays: MON_FRI, entitlementDays: 25, email: 'eilidh.grant@example.com', notes: 'Leaving soon – last day is in the diary.', kind: 'leaver' },
  { id: 'carer_s14', firstName: 'Marek', lastName: 'Kowalski', role: 'Team leader', teamId: 'team_weekend', workingDays: [2, 3, 4, 5, 6], entitlementDays: 30, phone: '07700 900114', email: 'marek.kowalski@example.com' },
  { id: 'carer_s15', firstName: 'Shona', lastName: 'Douglas', role: 'Carer', teamId: 'team_weekend', workingDays: [5, 6, 7], entitlementDays: 18 },
  { id: 'carer_s16', firstName: 'Leah', lastName: 'Murray', role: 'Carer', teamId: 'team_weekend', workingDays: [1, 2, 3], entitlementDays: 16 },
  { id: 'carer_s17', firstName: 'Ruairidh', lastName: 'Kerr', role: 'Carer', teamId: 'team_weekend', workingDays: [6, 7, 1], entitlementDays: 17, kind: 'archived' },
  { id: 'carer_s18', firstName: 'Amina', lastName: 'Yusuf', role: 'Carer', teamId: 'team_weekend', workingDays: [3, 4, 5, 6, 7], entitlementDays: 26, phone: '07700 900118', email: 'amina.yusuf@example.com' },
];

/** Carers who must not be off at the same time (both directions). */
const PAIRINGS = { carer_s03: ['carer_s05'], carer_s05: ['carer_s03'] };

// ---------- Seeded randomness ----------

/** mulberry32: a tiny seeded generator returning 0 ≤ n < 1. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole numbers, picks and coin flips on top of the seeded generator. */
function makeRandom(seed) {
  const next = mulberry32(seed);
  return {
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}

/** A random ISO date between lo and hi inclusive. */
function randomDate(rng, lo, hi) {
  return addDays(lo, rng.int(0, Math.max(0, diffDays(lo, hi))));
}

// ---------- Working-day helpers (approximate, no bank holidays) ----------

const isWorking = (iso, workingDays) => workingDays.includes(isoWeekday(iso));
const stamp = (iso) => `${iso}T09:00:00.000Z`;

/** First working day on or after `iso` (looks a week ahead), or null. */
function onOrAfter(iso, workingDays) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(iso, i);
    if (isWorking(d, workingDays)) return d;
  }
  return null;
}

/** Last working day on or before `iso` (looks a week back), or null. */
function onOrBefore(iso, workingDays) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(iso, -i);
    if (isWorking(d, workingDays)) return d;
  }
  return null;
}

/** Trim a range so it starts and ends on working days. Null if it has none. */
function alignRange(start, end, workingDays) {
  if (!start || !end || end < start || !workingDays.length) return null;
  const s = onOrAfter(start, workingDays);
  const e = onOrBefore(end, workingDays);
  return s && e && s <= e ? { start: s, end: e } : null;
}

/** A range of about `calendarDays` beginning on the first working day on or after `from`. */
function spanFrom(from, calendarDays, workingDays) {
  const start = onOrAfter(from, workingDays);
  if (!start) return null;
  return { start, end: onOrBefore(addDays(start, calendarDays - 1), workingDays) || start };
}

/** A range guaranteed to cover `iso`, reaching at least `before`/`after` days either side. */
function spanAround(iso, before, after, workingDays) {
  const start = onOrBefore(addDays(iso, -before), workingDays);
  const end = onOrAfter(addDays(iso, after), workingDays);
  return start && end ? { start, end } : null;
}

// ---------- Carers ----------

/** Employment dates for a carer, depending on which demo role they play. */
function employmentDates(rng, kind, { today, yearStart }) {
  const latestStart = addMonths(today, -2);
  if (kind === 'starter') return { startDate: addMonths(yearStart, 2), endDate: null };
  if (kind === 'leaver') return { startDate: randomDate(rng, EARLIEST_START, latestStart), endDate: addDays(today, 42) };
  if (kind === 'archived') {
    const endDate = addMonths(today, -4);
    return { startDate: randomDate(rng, EARLIEST_START, addMonths(endDate, -12)), endDate };
  }
  return { startDate: randomDate(rng, EARLIEST_START, latestStart), endDate: null };
}

/** Entitlement adjustments for the current holiday year, for the two carers that have them. */
function adjustmentsFor(carerId, yearKey, yearStart) {
  const adj = (id, days, reason) => ({ id, yearKey, days, reason, createdAt: stamp(yearStart) });
  if (carerId === 'carer_s02') return [adj('adj_s01', 3, 'Carried over from last year')];
  if (carerId === 'carer_s07') return [adj('adj_s02', 1, 'Long service')];
  return [];
}

/** Build the 18 carer records. */
function buildCarers(rng, today, settings) {
  const year = yearBoundsFor(today, settings);
  return SAMPLE_CARERS.map((def, i) => {
    const { kind, ...fields } = def;
    const dates = employmentDates(rng, kind, { today, yearStart: year.start });
    const created = stamp(minISO(dates.startDate, today));
    return newCarerRecord({
      ...fields,
      ...dates,
      workingDays: [...def.workingDays],
      phone: def.phone || '',
      email: def.email || '',
      notes: def.notes || '',
      colour: PALETTE[i % PALETTE.length],
      active: kind !== 'archived',
      mustNotBeOffWith: [...(PAIRINGS[def.id] || [])],
      adjustments: adjustmentsFor(def.id, year.key, year.start),
      createdAt: created,
      updatedAt: created,
    }, settings);
  });
}

// ---------- Holiday generation ----------

/**
 * Everything the generator needs to place holidays without breaking the rules:
 * ranges per carer (no overlaps), who is off per team per day (staffing limits)
 * and approximate annual-leave usage per carer per holiday year.
 */
function createWorld(rng, today, db) {
  const { settings, teams, carers } = db;
  const cur = yearBoundsFor(today, settings);
  const years = {
    prev: yearBounds(Number(cur.key) - 1, settings),
    cur,
    next: yearBounds(Number(cur.key) + 1, settings),
  };
  const capOf = (t) => (t.maxOffPerDay === 0 ? Infinity : (t.maxOffPerDay ?? settings.defaultMaxOffPerDay));
  return {
    rng, today, settings, carers, years,
    lo: maxISO(years.prev.start, addDays(addYears(today, -2), 7)),
    hi: minISO(years.next.end, addDays(addYears(today, 2), -7)),
    carer: (id) => carers.find((c) => c.id === id),
    capByTeam: new Map(teams.map((t) => [t.id, capOf(t)])),
    holidays: [],
    rangesByCarer: new Map(carers.map((c) => [c.id, []])),
    offByDay: new Map(), // iso → Map<teamId, count>
    usage: new Map(),    // 'carerId:yearKey' → annual leave days
  };
}

const yearOf = (world, key) => Object.values(world.years).find((y) => y.key === key);
const usageOf = (world, carer, yearKey) => world.usage.get(`${carer.id}:${yearKey}`) || 0;

/** Approximate annual-leave allowance for one holiday year: pro rata plus adjustments. */
function allowanceFor(world, carer, yb) {
  const fraction = world.settings.proRataStartersAndLeavers ? employedFractionOfYear(yb, carer.startDate, carer.endDate) : 1;
  const adjustments = (carer.adjustments || []).filter((a) => a.yearKey === yb.key).reduce((n, a) => n + a.days, 0);
  return carer.entitlementDays * fraction + adjustments;
}

/** Working days in a range, split by holiday year. Half days count 0.5. */
function usageByYear(world, carer, range, halfDay) {
  const out = new Map();
  for (const day of eachDay(range.start, range.end)) {
    if (!isWorking(day, carer.workingDays)) continue;
    const key = yearKeyFor(day, world.settings);
    out.set(key, (out.get(key) || 0) + (halfDay ? 0.5 : 1));
  }
  return out;
}

function exceedsAllowance(world, carer, usage) {
  for (const [key, days] of usage) {
    const yb = yearOf(world, key);
    if (yb && usageOf(world, carer, key) + days > USAGE_CEILING * allowanceFor(world, carer, yb)) return true;
  }
  return false;
}

function withinEmployment(world, carer, range) {
  if (range.start < world.lo || range.end > world.hi) return false;
  if (carer.startDate && range.start < carer.startDate) return false;
  if (carer.endDate && range.end > carer.endDate) return false;
  return true;
}

function overlapsOwn(world, carer, range) {
  return world.rangesByCarer.get(carer.id).some((r) => rangesOverlap(r.start, r.end, range.start, range.end));
}

function breaksTeamCap(world, carer, range) {
  const cap = world.capByTeam.get(carer.teamId) ?? world.settings.defaultMaxOffPerDay;
  if (!Number.isFinite(cap)) return false;
  return eachDay(range.start, range.end).some((day) => (world.offByDay.get(day)?.get(carer.teamId) || 0) + 1 > cap);
}

function breaksPairing(world, carer, range) {
  return (carer.mustNotBeOffWith || []).some((id) =>
    (world.rangesByCarer.get(id) || []).some((r) => rangesOverlap(r.start, r.end, range.start, range.end)));
}

function noteOff(world, day, teamId) {
  if (!world.offByDay.has(day)) world.offByDay.set(day, new Map());
  const byTeam = world.offByDay.get(day);
  byTeam.set(teamId, (byTeam.get(teamId) || 0) + 1);
}

/**
 * Try to add one holiday. Returns the record, or null when it would overlap the
 * carer's other holidays, fall outside their employment (or the sample window),
 * exceed a team's max-off-per-day, break a pairing rule or (when
 * `respectAllowance` is set) push a year's annual leave above the ceiling.
 * `allowStaffingClash` / `allowPairingClash` let the deliberate clashes through.
 */
function place(world, carer, spec, opts = {}) {
  const { typeId = ANNUAL, status = 'approved', halfDay = null, notes = '' } = spec;
  const range = alignRange(spec.start, spec.end, carer.workingDays);
  if (!range) return null;
  if (halfDay && range.start !== range.end) return null;
  if (!withinEmployment(world, carer, range) || overlapsOwn(world, carer, range)) return null;
  const counts = status !== 'declined';
  if (counts && !opts.allowStaffingClash && breaksTeamCap(world, carer, range)) return null;
  if (counts && !opts.allowPairingClash && breaksPairing(world, carer, range)) return null;
  const usage = counts && typeId === ANNUAL ? usageByYear(world, carer, range, halfDay) : new Map();
  if (opts.respectAllowance && exceedsAllowance(world, carer, usage)) return null;

  const holiday = { carerId: carer.id, start: range.start, end: range.end, typeId, status, halfDay, notes };
  world.holidays.push(holiday);
  world.rangesByCarer.get(carer.id).push(range);
  if (counts) for (const day of eachDay(range.start, range.end)) noteOff(world, day, carer.teamId);
  for (const [key, days] of usage) world.usage.set(`${carer.id}:${key}`, usageOf(world, carer, key) + days);
  return holiday;
}

/** The part of [lo, hi] a carer is employed for and the sample covers, or null. */
function employmentWindow(world, carer, lo, hi) {
  const from = maxISO(maxISO(lo, world.lo), carer.startDate || lo);
  const to = minISO(minISO(hi, world.hi), carer.endDate || hi);
  return to < from ? null : { lo: from, hi: to };
}

const inUpcomingWindow = (world, iso) => iso > world.today && iso <= addDays(world.today, UPCOMING_DAYS);

/** A random start inside the window, avoiding the scripted "next two weeks". */
function randomStart(world, win) {
  const start = randomDate(world.rng, win.lo, win.hi);
  return inUpcomingWindow(world, start) ? null : start;
}

/** Keep a range inside the holiday year it starts in (only one holiday spans a boundary). */
function clampToYear(world, start, end) {
  return minISO(end, yearBoundsFor(start, world.settings).end);
}

const randomNote = (rng) => (rng.chance(0.15) ? rng.pick(NOTES) : '');

/** Place up to `count` holidays of one type at random. Returns how many were placed. */
function placeRandom(world, { typeId, count, lengths, lo, hi, carers, status = 'approved', notes = () => '', respectAllowance = false }) {
  let placed = 0;
  for (let attempt = 0; attempt < count * 40 && placed < count; attempt++) {
    const carer = world.rng.pick(carers);
    const win = employmentWindow(world, carer, lo, hi);
    if (!win) continue;
    const start = randomStart(world, win);
    if (!start) continue;
    const end = clampToYear(world, start, minISO(addDays(start, world.rng.pick(lengths) - 1), win.hi));
    if (place(world, carer, { start, end, typeId, status, notes: notes(world.rng) }, { respectAllowance })) placed++;
  }
  return placed;
}

// ---- Scripted scenarios (placed first so they always land) ----

/** One holiday straddling the start of the current holiday year. */
function addYearBoundaryHoliday(world) {
  const start = world.years.cur.start;
  place(world, world.carer('carer_s01'), { start: addDays(start, -4), end: addDays(start, 3), notes: 'Spring break' });
}

/** Three carers off today – between them they cover every day of the week. */
function addOffToday(world) {
  const off = (id, before, after, notes = '') => {
    const carer = world.carer(id);
    place(world, carer, { ...spanAround(world.today, before, after, carer.workingDays), notes });
  };
  off('carer_s04', 2, 2, 'Family visit');
  off('carer_s10', 1, 3);
  off('carer_s18', 1, 1);
}

/** Three holidays starting within the next fortnight, for the Home page. */
function addUpcoming(world) {
  const soon = (id, offset, calendarDays, notes = '') => {
    const carer = world.carer(id);
    place(world, carer, { ...spanFrom(addDays(world.today, offset), calendarDays, carer.workingDays), notes });
  };
  soon('carer_s16', 3, 3);
  soon('carer_s09', 8, 5, 'Trip to Skye');
  soon('carer_s14', 12, 2);
}

/** Callum and Ewan (who must not be off together) both off about three weeks from today. */
function addPairingClash(world) {
  const a = world.carer('carer_s03');
  const b = world.carer('carer_s05');
  const day = onOrAfter(addDays(world.today, 18), a.workingDays);
  if (!place(world, a, { ...spanFrom(day, 2, a.workingDays), notes: 'Concert in Glasgow' })) return;
  place(world, b, { start: day, end: day }, { allowPairingClash: true });
}

/** Three Day-team carers approved off on the same working day about four weeks from today. */
function addStaffingClash(world) {
  const day = onOrAfter(addDays(world.today, 27), MON_FRI);
  const candidates = ['carer_s01', 'carer_s02', 'carer_s07', 'carer_s04', 'carer_s03'].map(world.carer);
  const specs = [
    (wd) => ({ ...spanFrom(day, 3, wd), notes: 'Wedding' }),
    (wd) => ({ start: onOrBefore(addDays(day, -1), wd), end: day }),
    () => ({ start: day, end: day }),
  ];
  let placed = 0;
  for (const carer of candidates) {
    if (placed === specs.length) break;
    if (!isWorking(day, carer.workingDays)) continue;
    if (place(world, carer, specs[placed](carer.workingDays), { allowStaffingClash: true })) placed++;
  }
}

/** Four half days: two in the past, two ahead (beyond the scripted fortnight). */
function addHalfDays(world) {
  const items = [
    ['carer_s02', -20, 'pm', 'Dentist'],
    ['carer_s09', -45, 'am', ''],
    ['carer_s06', 42, 'am', 'Doctor’s appointment'],
    ['carer_s15', 35, 'pm', ''],
  ];
  for (const [id, offset, halfDay, notes] of items) {
    const carer = world.carer(id);
    for (const shift of [0, 7, -7, 14]) {
      const day = onOrAfter(addDays(world.today, offset + shift), carer.workingDays);
      if (place(world, carer, { start: day, end: day, halfDay, notes })) break;
    }
  }
}

function addSickLeave(world) {
  placeRandom(world, { typeId: 'lt_sick', count: 12, lengths: [1, 1, 2, 3], lo: world.lo, hi: addDays(world.today, -1), carers: world.carers });
}

function addOtherLeave(world) {
  const carers = world.carers.filter((c) => c.active);
  const anyTime = { lo: world.lo, hi: world.hi, carers };
  placeRandom(world, { typeId: 'lt_training', count: 3, lengths: [1, 1, 2], ...anyTime, notes: (rng) => rng.pick(TRAINING_NOTES) });
  placeRandom(world, { typeId: 'lt_compassionate', count: 2, lengths: [2, 3], lo: world.lo, hi: addDays(world.today, -1), carers });
  placeRandom(world, { typeId: 'lt_unpaid', count: 2, lengths: [2, 3, 5], ...anyTime });
  placeRandom(world, { typeId: 'lt_toil', count: 2, lengths: [1], ...anyTime });
}

/** Requests awaiting approval: all in the future, mostly this holiday year. */
function addPendingRequests(world) {
  placeRandom(world, {
    typeId: ANNUAL, status: 'pending', count: 10, lengths: [1, 2, 3, 4, 5],
    lo: addDays(world.today, UPCOMING_DAYS + 1), hi: addDays(world.years.cur.end, 90),
    carers: world.carers.filter((c) => c.active), notes: randomNote, respectAllowance: true,
  });
}

function addDeclinedRequests(world) {
  placeRandom(world, { typeId: ANNUAL, status: 'declined', count: 2, lengths: [1, 2, 3], lo: world.lo, hi: world.hi, carers: world.carers.filter((c) => c.active) });
}

/** Top up one carer's annual leave in one holiday year until it reaches `share` of their allowance. */
function fillYear(world, carer, yb, share) {
  const total = allowanceFor(world, carer, yb);
  const win = employmentWindow(world, carer, yb.start, yb.end);
  if (total < 1 || !win) return;
  const target = total * share;
  for (let attempt = 0; attempt < 200 && usageOf(world, carer, yb.key) < target; attempt++) {
    const start = randomStart(world, win);
    if (!start) continue;
    const end = minISO(addDays(start, world.rng.pick(LENGTHS) - 1), win.hi);
    place(world, carer, { start, end, notes: randomNote(world.rng) }, { respectAllowance: true });
  }
}

function fillAnnualLeave(world, carer) {
  for (const [name, yb] of Object.entries(world.years)) {
    const [lo, hi] = YEAR_SHARES[name];
    fillYear(world, carer, yb, world.rng.int(lo, hi) / 100);
  }
}

/** Sort by date, give ids hol_s001… and fill in the record shape. */
function finalise(world) {
  const sorted = [...world.holidays].sort((a, b) => a.start.localeCompare(b.start) || a.carerId.localeCompare(b.carerId));
  return sorted.map((h, i) => {
    const created = stamp(h.typeId === 'lt_sick' ? minISO(h.start, world.today) : minISO(addDays(h.start, -14), world.today));
    return newHolidayRecord({ ...h, id: `hol_s${String(i + 1).padStart(3, '0')}`, batchId: null, createdAt: created, updatedAt: created });
  });
}

function buildHolidays(rng, today, db) {
  const world = createWorld(rng, today, db);
  addYearBoundaryHoliday(world);
  addOffToday(world);
  addUpcoming(world);
  addPairingClash(world);
  addStaffingClash(world);
  addHalfDays(world);
  addSickLeave(world);
  addOtherLeave(world);
  addPendingRequests(world);
  addDeclinedRequests(world);
  for (const carer of world.carers) fillAnnualLeave(world, carer);
  return finalise(world);
}

// ---------- Public API ----------

/**
 * A complete, deterministic sample document: 3 teams, 18 carers and around 150
 * holidays spread over the previous, current and next holiday years relative to
 * `today`. Includes carers off today, upcoming holidays, pending requests, sick
 * leave, half days, a starter, a leaver, an archived carer, one staffing clash
 * and one pairing clash. Identical output for the same `today`.
 *
 * `settings` is merged over the defaults; the holiday year (1 April), bank
 * holiday region (Scotland), onboarding flag and last-backup date are then fixed
 * so the sample always makes sense.
 */
export function sampleDb({ today = todayISO(), settings = {} } = {}) {
  const db = createEmptyDb();
  db.createdAt = stamp(today);
  db.settings = {
    ...defaultSettings(),
    ...settings,
    onboardingComplete: true,
    holidayYearStart: { month: 4, day: 1 },
    bankHolidayRegion: 'scotland',
    lastBackupAt: null,
  };
  db.teams = SAMPLE_TEAMS.map((t) => ({ ...t }));
  const rng = makeRandom(SEED);
  db.carers = buildCarers(rng, today, db.settings);
  db.holidays = buildHolidays(rng, today, db);
  return db;
}

// ---------- CSV example for "Import carers" ----------

const CSV_HEADERS = ['First name', 'Last name', 'Team', 'Role', 'Start date', 'Working days', 'Entitlement days', 'Phone', 'Email', 'Notes'];
const CSV_ROWS = [
  ['Jamie', 'Henderson', 'Day team', 'Carer', '06/09/2021', 'Mon, Tue, Wed, Thu, Fri', '25', '07700 900201', 'jamie.henderson@example.com', ''],
  ['Nadia', 'Hussain', 'Day team', 'Senior carer', '12/03/2018', 'Mon, Tue, Wed, Thu, Fri', '28', '', 'nadia.hussain@example.com', 'First aider'],
  ['Struan', 'Wallace', 'Night team', 'Carer', '16/01/2023', 'Mon, Wed, Fri', '17', '07700 900203', '', 'Part time'],
  ['Olu', 'Adebayo', 'Weekend & respite', 'Carer', '04/06/2022', 'Fri, Sat, Sun', '16', '', '', ''],
  ['Mairi', 'Docherty', 'Night team', 'Team leader', '01/11/2016', 'Mon, Tue, Wed, Thu, Fri', '30', '07700 900205', 'mairi.docherty@example.com', ''],
];

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A small CSV (header row plus five fictional carers) showing the format the
 * "Import carers" feature expects. Dates are dd/mm/yyyy (as people type them
 * and as the app's own export writes them); working days are a quoted list of
 * short day names.
 */
export function sampleCarerCsv() {
  return [CSV_HEADERS, ...CSV_ROWS].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}
