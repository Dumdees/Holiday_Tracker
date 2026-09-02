// Clash detection: everything that should make someone pause before adding a holiday,
// explained in plain English. Pure functions – "today" is always passed in (or read
// from ctx) so results are repeatable in tests.
import {
  formatRange, formatShort, eachDay, rangesOverlap, addDays, maxISO, minISO, compareISO, isValidISO, todayISO,
} from './dates.js';
import { leaveDaysBreakdown, describeWorkingPattern } from './leaveDays.js';
import { usageForYear, formatDays } from './entitlement.js';
import { splitRangeByYear, yearBounds } from './holidayYear.js';

/** How far ahead existingProblems looks when no end date is given. */
const DEFAULT_LOOKAHEAD_DAYS = 60;
const SEVERITY_RANK = { block: 0, warn: 1 };
const UNKNOWN_CARER_MESSAGE = 'That carer no longer exists';

// ---------- Small helpers ----------

/** A carer's first name, as used in every message. */
function firstName(carer) {
  return (carer && String(carer.firstName || '').trim()) || 'This carer';
}

/** Sort order for people: last name, then first name (case-insensitive). */
function byName(a, b) {
  const full = (c) => `${c.lastName || ''} ${c.firstName || ''}`;
  return full(a).localeCompare(full(b), 'en', { sensitivity: 'base' });
}

/** Look a record up by id: the ctx lookup map first, then the document's own list. */
function findById(map, list, id) {
  if (!id) return null;
  return (map && map.get(id)) || (list || []).find((x) => x.id === id) || null;
}
const carerOf = (db, ctx, id) => findById(ctx && ctx.carersById, db.carers, id);
const teamOf = (db, ctx, id) => findById(ctx && ctx.teamsById, db.teams, id);
const leaveTypeOf = (db, ctx, id) => findById(ctx && ctx.leaveTypesById, db.leaveTypes, id);

/** A team's limit on people off together: its own, else the default. 0 means no limit. */
function teamLimit(team, settings) {
  if (!team) return 0;
  const raw = team.maxOffPerDay == null ? settings && settings.defaultMaxOffPerDay : team.maxOffPerDay;
  const limit = Number(raw);
  return limit > 0 ? limit : 0;
}

/** Distinct carers from [{ carer, holiday }] entries, in name order. */
function uniqueCarers(entries) {
  const seen = new Map();
  for (const { carer } of entries) if (!seen.has(carer.id)) seen.set(carer.id, carer);
  return [...seen.values()].sort(byName);
}

function unique(list) {
  return [...new Set(list)];
}

function round2(value) {
  return Math.round(value * 100) / 100 + 0;
}

/** '3 days', '1 day', '0.5 days', '2.5 days'. */
function daysWord(n) {
  return `${formatDays(n)} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
}

/** ' (and 2 more days)', ' (and 1 more day)' or '' when there is nothing more. */
function andMore(count) {
  if (count <= 0) return '';
  return ` (and ${count} more ${count === 1 ? 'day' : 'days'})`;
}

/** Group sorted ISO dates into runs of consecutive days: [['d1','d2'], ['d5']]. */
function contiguousRuns(dates) {
  const runs = [];
  for (const date of dates) {
    const last = runs[runs.length - 1];
    if (last && addDays(last[last.length - 1], 1) === date) last.push(date);
    else runs.push([date]);
  }
  return runs;
}

/** The day in a run with most people off (earliest wins a tie). `countOf(date)` gives the count. */
function busiestDay(run, countOf) {
  return run.reduce((best, date) => (countOf(date) > countOf(best) ? date : best), run[0]);
}

function makeClash(kind, severity, message, extra = {}) {
  return { kind, severity, message, dates: [], relatedCarerIds: [], relatedHolidayIds: [], ...extra };
}

/**
 * A copy of the proposal with valid dates the right way round and a half day only when it
 * is a single day (the same tidy-up the store does when saving). Null if the dates are unusable.
 */
function normaliseProposal(proposed) {
  if (!proposed || !isValidISO(proposed.start) || !isValidISO(proposed.end)) return null;
  const start = minISO(proposed.start, proposed.end);
  const end = maxISO(proposed.start, proposed.end);
  return { ...proposed, start, end, halfDay: start === end ? proposed.halfDay || null : null };
}

/** Does this holiday still take someone off work, for the purposes of a check? */
function isLive(holiday, includePending, ignore) {
  if (holiday.status === 'declined' || ignore.has(holiday.id)) return false;
  return includePending || holiday.status !== 'pending';
}

function covers(holiday, iso) {
  return iso >= holiday.start && iso <= holiday.end;
}

// ---------- Who is off ----------

/**
 * Everyone off on a given day: one entry per holiday covering `iso` whose carer still
 * exists. Declined holidays never count; pending ones count unless `includePending` is false.
 * @param {string} iso – 'YYYY-MM-DD'
 * @param {{ carers: object[], holidays: object[] }} db
 * @param {{ carersById?: Map<string, object> }} ctx – from buildContext
 * @param {object} [options]
 * @param {string|null} [options.teamId=null] – only carers in this team
 * @param {boolean} [options.includePending=true]
 * @param {string[]} [options.ignoreHolidayIds=[]] – holidays to pretend aren't there (e.g. the one being edited)
 * @param {string|null} [options.excludeCarerId=null] – leave this carer out
 * @returns {Array<{ carer: object, holiday: object }>} in the order the holidays are stored
 */
export function offOnDay(iso, db, ctx, { teamId = null, includePending = true, ignoreHolidayIds = [], excludeCarerId = null } = {}) {
  const ignore = new Set(ignoreHolidayIds);
  const out = [];
  for (const holiday of db.holidays || []) {
    if (!isLive(holiday, includePending, ignore) || !covers(holiday, iso)) continue;
    if (excludeCarerId && holiday.carerId === excludeCarerId) continue;
    const carer = carerOf(db, ctx, holiday.carerId);
    if (!carer) continue;
    if (teamId != null && carer.teamId !== teamId) continue;
    out.push({ carer, holiday });
  }
  return out;
}

// ---------- Checking one proposed holiday ----------

/** Same carer, overlapping dates – always a block. One clash per overlapping holiday. */
function overlapClashes(proposal, carer, db, ignore) {
  const out = [];
  for (const holiday of db.holidays || []) {
    if (holiday.carerId !== carer.id || !isLive(holiday, true, ignore)) continue;
    if (!rangesOverlap(holiday.start, holiday.end, proposal.start, proposal.end)) continue;
    out.push(makeClash('overlap', 'block', `${firstName(carer)} is already off ${formatRange(holiday.start, holiday.end)}`, {
      dates: eachDay(maxISO(holiday.start, proposal.start), minISO(holiday.end, proposal.end)),
      relatedCarerIds: [carer.id],
      relatedHolidayIds: [holiday.id],
    }));
  }
  return out;
}

/** Too many people from the carer's team off on one of the proposal's working days. */
function staffingClashes(carer, countedDays, db, ctx, ignoreHolidayIds) {
  const team = teamOf(db, ctx, carer.teamId);
  const limit = teamLimit(team, ctx && ctx.settings);
  if (!team || !limit) return [];
  const over = [];
  for (const date of countedDays) {
    const entries = offOnDay(date, db, ctx, { teamId: team.id, includePending: true, ignoreHolidayIds, excludeCarerId: carer.id });
    const others = uniqueCarers(entries);
    const count = others.length + 1;
    if (count > limit) over.push({ date, count, others, holidayIds: entries.map((e) => e.holiday.id) });
  }
  if (!over.length) return [];
  const worst = over.reduce((best, day) => (day.count > best.count ? day : best), over[0]);
  const message = `${worst.count} people in ${team.name} would be off on ${formatShort(worst.date)} – the limit is ${limit}${andMore(over.length - 1)}`;
  return [makeClash('staffing', 'warn', message, {
    details: `Also off: ${worst.others.map(firstName).join(', ')}`,
    dates: over.map((day) => day.date),
    relatedCarerIds: unique(over.flatMap((day) => day.others.map((c) => c.id))),
    relatedHolidayIds: unique(over.flatMap((day) => day.holidayIds)),
  })];
}

/** Carers who must not be off with this one, whichever side recorded the rule. */
function partnersOf(carer, db) {
  const ids = new Set(carer.mustNotBeOffWith || []);
  for (const other of db.carers || []) if ((other.mustNotBeOffWith || []).includes(carer.id)) ids.add(other.id);
  ids.delete(carer.id);
  return (db.carers || []).filter((c) => ids.has(c.id));
}

/** A "must not be off with" partner is off on one of the proposal's working days. */
function pairingClashes(carer, countedDays, db, ignore) {
  const out = [];
  for (const partner of partnersOf(carer, db)) {
    const partnerHolidays = (db.holidays || []).filter((h) => h.carerId === partner.id && isLive(h, true, ignore));
    const dates = [];
    const holidayIds = [];
    for (const date of countedDays) {
      const hits = partnerHolidays.filter((h) => covers(h, date));
      if (!hits.length) continue;
      dates.push(date);
      holidayIds.push(...hits.map((h) => h.id));
    }
    if (!dates.length) continue;
    const message = `${firstName(carer)} and ${firstName(partner)} shouldn’t be off at the same time – ${firstName(partner)} is off ${formatShort(dates[0])}${andMore(dates.length - 1)}`;
    out.push(makeClash('pairing', 'warn', message, { dates, relatedCarerIds: [partner.id], relatedHolidayIds: unique(holidayIds) }));
  }
  return out;
}

function entitlementMessage(name, remaining, after, label) {
  if (remaining > 0) return `Only ${daysWord(remaining)} left in ${label} – this would take ${name} to ${formatDays(after)}`;
  if (remaining === 0) return `${name} has no days left in ${label} – this would take them to ${formatDays(after)}`;
  return `${name} is already ${daysWord(-remaining)} over in ${label} – this would take them to ${formatDays(after)}`;
}

/** The proposal would take the carer below zero in any holiday year it touches. */
function entitlementClashes(proposal, carer, db, ctx, ignore, today) {
  const type = leaveTypeOf(db, ctx, proposal.typeId);
  if (!type || type.deductsEntitlement !== true) return [];
  const settings = ctx.settings;
  const others = (db.holidays || []).filter((h) => !ignore.has(h.id));
  const out = [];
  for (const piece of splitRangeByYear(proposal.start, proposal.end, settings)) {
    const pieceDays = leaveDaysBreakdown({ start: piece.start, end: piece.end, halfDay: proposal.halfDay }, carer, ctx).days;
    if (!pieceDays) continue;
    const yb = yearBounds(piece.key, settings);
    const { remaining } = usageForYear(carer, yb, others, ctx, today);
    const after = round2(remaining - pieceDays);
    if (after >= 0) continue;
    out.push(makeClash('entitlement', 'warn', entitlementMessage(firstName(carer), remaining, after, yb.label), {
      dates: [piece.start],
      relatedCarerIds: [carer.id],
    }));
  }
  return out;
}

function noWorkingDaysClash(carer) {
  const name = firstName(carer);
  return makeClash('no-working-days', 'warn', `None of these dates are working days for ${name} (${name} works ${describeWorkingPattern(carer)})`, {
    relatedCarerIds: [carer.id],
  });
}

/** The proposal starts before the carer joined or ends after they leave. */
function employmentClashes(proposal, carer) {
  const name = firstName(carer);
  const out = [];
  if (carer.startDate && proposal.start < carer.startDate) {
    out.push(makeClash('outside-employment', 'warn', `${name}’s start date is ${formatShort(carer.startDate)}, after this holiday begins`, {
      dates: [proposal.start], relatedCarerIds: [carer.id],
    }));
  }
  if (carer.endDate && proposal.end > carer.endDate) {
    out.push(makeClash('outside-employment', 'warn', `${name} leaves on ${formatShort(carer.endDate)}, before this holiday ends`, {
      dates: [proposal.end], relatedCarerIds: [carer.id],
    }));
  }
  return out;
}

function inactiveClash(carer) {
  return makeClash('inactive', 'warn', `${firstName(carer)} is archived – reactivate them first if this is a mistake`, { relatedCarerIds: [carer.id] });
}

/**
 * Check a proposed holiday against everything already recorded (see docs/SPEC.md §3).
 * Blocking clashes come first, then warnings. Kinds:
 * - `overlap` (block): the same carer already has a non-declined holiday on these dates.
 * - `staffing` (warn): too many of the carer's team would be off on one of the working days
 *   (the message names the busiest day; `details` lists who else is off that day).
 * - `pairing` (warn): someone they must not be off with is off on one of the working days.
 * - `entitlement` (warn): a deducting leave type would take them below zero in a holiday year.
 * - `no-working-days` (warn): none of the dates are working days for them.
 * - `outside-employment` (warn): before their start date or after their end date.
 * - `inactive` (warn): the carer is archived.
 * - `unknown-carer` (block): the carer no longer exists (the only clash returned in that case).
 * Staffing, pairing and entitlement are skipped for a declined proposal – it takes nobody off.
 * Unusable dates (missing or invalid) give [].
 * @param {{ carerId: string, start: string, end: string, typeId: string, status?: string, halfDay?: 'am'|'pm'|null }} proposed
 * @param {{ carers: object[], holidays: object[], teams: object[], leaveTypes?: object[] }} db
 * @param {{ settings: object, today?: string, bankHolidayMap?: Map, leaveTypesById?: Map, teamsById?: Map, carersById?: Map }} ctx
 * @param {object} [options]
 * @param {string[]} [options.ignoreHolidayIds=[]] – ignore these holidays (the one being edited)
 * @param {string} [options.today] – ISO date, defaults to ctx.today
 * @returns {Array<{ kind: string, severity: 'block'|'warn', message: string, details?: string, dates: string[], relatedCarerIds: string[], relatedHolidayIds: string[] }>}
 */
export function findClashes(proposed, db, ctx, { ignoreHolidayIds = [], today = (ctx && ctx.today) || todayISO() } = {}) {
  const carer = carerOf(db, ctx, proposed && proposed.carerId);
  if (!carer) return [makeClash('unknown-carer', 'block', UNKNOWN_CARER_MESSAGE)];
  const proposal = normaliseProposal(proposed);
  if (!proposal) return [];

  const ignore = new Set(ignoreHolidayIds);
  const { days, countedDays } = leaveDaysBreakdown(proposal, carer, ctx);
  const out = overlapClashes(proposal, carer, db, ignore);
  if (proposal.status !== 'declined') {
    out.push(...staffingClashes(carer, countedDays, db, ctx, ignoreHolidayIds));
    out.push(...pairingClashes(carer, countedDays, db, ignore));
    out.push(...entitlementClashes(proposal, carer, db, ctx, ignore, today));
  }
  if (days === 0) out.push(noWorkingDaysClash(carer));
  out.push(...employmentClashes(proposal, carer));
  if (carer.active === false) out.push(inactiveClash(carer));
  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Check a whole batch of proposals (the bulk "Add holidays" preview). Each proposal is
 * checked as if every earlier, non-blocked proposal had already been added, so two people
 * from the same team booked together in one go still trip the staffing rule.
 * @param {object[]} proposals – see findClashes
 * @param {object} db
 * @param {object} ctx
 * @param {{ ignoreHolidayIds?: string[], today?: string }} [options] – passed to findClashes
 * @returns {Array<{ proposal: object, clashes: object[], days: number, blocked: boolean }>}
 */
export function checkBatch(proposals, db, ctx, options = {}) {
  const temps = [];
  const out = [];
  (proposals || []).forEach((proposal, i) => {
    const view = temps.length ? { ...db, holidays: [...(db.holidays || []), ...temps] } : db;
    const clashes = findClashes(proposal, view, ctx, options);
    const carer = carerOf(db, ctx, proposal && proposal.carerId);
    const normalised = normaliseProposal(proposal);
    const days = carer && normalised ? leaveDaysBreakdown(normalised, carer, ctx).days : 0;
    const blocked = clashes.some((c) => c.severity === 'block');
    out.push({ proposal, clashes, days, blocked });
    if (!blocked && normalised) temps.push({ ...normalised, id: `tmp_${i}`, status: normalised.status || 'approved' });
  });
  return out;
}

// ---------- Problems already in the data ----------

/** Holidays in the window that still take someone off, paired with their carer. */
function liveEntries(db, ctx, from, to, includePending) {
  const none = new Set();
  const out = [];
  for (const holiday of db.holidays || []) {
    if (!isLive(holiday, includePending, none) || !rangesOverlap(holiday.start, holiday.end, from, to)) continue;
    const carer = carerOf(db, ctx, holiday.carerId);
    if (carer) out.push({ carer, holiday });
  }
  return out;
}

/** Map<iso, [{ carer, holiday }]> for every day in the window that has someone off. */
function entriesByDay(entries, from, to) {
  const map = new Map();
  for (const entry of entries) {
    for (const date of eachDay(maxISO(entry.holiday.start, from), minISO(entry.holiday.end, to))) {
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(entry);
    }
  }
  return map;
}

/** One problem per pair of a carer's holidays that overlap each other. */
function overlapProblems(entries, from, to) {
  const byCarer = new Map();
  for (const entry of entries) {
    if (!byCarer.has(entry.carer.id)) byCarer.set(entry.carer.id, { carer: entry.carer, holidays: [] });
    byCarer.get(entry.carer.id).holidays.push(entry.holiday);
  }
  const out = [];
  for (const { carer, holidays } of byCarer.values()) {
    const sorted = [...holidays].sort((a, b) => compareISO(a.start, b.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        if (!rangesOverlap(a.start, a.end, b.start, b.end)) continue;
        const shared = eachDay(maxISO(a.start, b.start, from), minISO(a.end, b.end, to));
        out.push({
          kind: 'overlap',
          message: `${firstName(carer)} has two holidays that overlap: ${formatRange(a.start, a.end)} and ${formatRange(b.start, b.end)}`,
          dates: shared.length ? shared : [maxISO(a.start, b.start)],
          carerIds: [carer.id],
          holidayIds: [a.id, b.id],
        });
      }
    }
  }
  return out;
}

/** One problem per team per run of consecutive days with more people off than allowed. */
function staffingProblems(db, ctx, days, perDay) {
  const out = [];
  for (const team of db.teams || []) {
    const limit = teamLimit(team, ctx && ctx.settings);
    if (!limit) continue;
    const info = new Map();
    for (const date of days) {
      const entries = (perDay.get(date) || []).filter((e) => e.carer.teamId === team.id);
      const carers = uniqueCarers(entries);
      if (carers.length > limit) info.set(date, { carers, holidayIds: entries.map((e) => e.holiday.id) });
    }
    for (const run of contiguousRuns([...info.keys()])) {
      const worst = busiestDay(run, (date) => info.get(date).carers.length);
      out.push({
        kind: 'staffing',
        message: `${info.get(worst).carers.length} people in ${team.name} are off on ${formatShort(worst)} – the limit is ${limit}${andMore(run.length - 1)}`,
        dates: run,
        carerIds: unique(run.flatMap((date) => info.get(date).carers.map((c) => c.id))),
        holidayIds: unique(run.flatMap((date) => info.get(date).holidayIds)),
      });
    }
  }
  return out;
}

/** Every "must not be off together" pair, each once, as [carerA, carerB]. */
function pairingPairs(db, ctx) {
  const pairs = new Map();
  for (const carer of db.carers || []) {
    for (const otherId of carer.mustNotBeOffWith || []) {
      const other = carerOf(db, ctx, otherId);
      if (!other || other.id === carer.id) continue;
      const key = [carer.id, other.id].sort().join('|');
      if (!pairs.has(key)) pairs.set(key, [carer, other]);
    }
  }
  return [...pairs.values()];
}

/** One problem per pair per run of consecutive days on which both are off. */
function pairingProblems(db, ctx, days, perDay) {
  const out = [];
  for (const [a, b] of pairingPairs(db, ctx)) {
    const info = new Map();
    for (const date of days) {
      const entries = perDay.get(date) || [];
      const mine = entries.filter((e) => e.carer.id === a.id || e.carer.id === b.id);
      if (mine.some((e) => e.carer.id === a.id) && mine.some((e) => e.carer.id === b.id)) info.set(date, mine.map((e) => e.holiday.id));
    }
    for (const run of contiguousRuns([...info.keys()])) {
      const when = run.length > 1 ? formatRange(run[0], run[run.length - 1]) : `on ${formatShort(run[0])}`;
      out.push({
        kind: 'pairing',
        message: `${firstName(a)} and ${firstName(b)} are both off ${when} – they shouldn’t be off at the same time`,
        dates: run,
        carerIds: [a.id, b.id],
        holidayIds: unique(run.flatMap((date) => info.get(date))),
      });
    }
  }
  return out;
}

/**
 * Problems already present in the data within a date range – for the Home screen.
 * Overlaps are reported once per pair of holidays, staffing once per team per run of
 * consecutive days over the limit, pairing once per pair of carers per run of days both
 * are off. Sorted by first date. The window defaults to the next 60 days from ctx.today.
 * @param {{ carers: object[], holidays: object[], teams: object[] }} db
 * @param {{ settings: object, today?: string, carersById?: Map, teamsById?: Map }} ctx
 * @param {{ start?: string, end?: string, includePending?: boolean }} [options]
 * @returns {Array<{ kind: 'overlap'|'staffing'|'pairing', message: string, dates: string[], carerIds: string[], holidayIds: string[] }>}
 */
export function existingProblems(db, ctx, { start, end, includePending = true } = {}) {
  const from = start || (ctx && ctx.today) || todayISO();
  const to = end || addDays(from, DEFAULT_LOOKAHEAD_DAYS);
  if (!isValidISO(from) || !isValidISO(to) || to < from) return [];
  const entries = liveEntries(db, ctx, from, to, includePending);
  const days = eachDay(from, to);
  const perDay = entriesByDay(entries, from, to);
  return [
    ...overlapProblems(entries, from, to),
    ...staffingProblems(db, ctx, days, perDay),
    ...pairingProblems(db, ctx, days, perDay),
  ].sort((a, b) => compareISO(a.dates[0] || '', b.dates[0] || ''));
}
