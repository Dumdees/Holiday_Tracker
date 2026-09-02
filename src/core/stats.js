// Numbers for the Home screen and Reports. All pure; all take the ctx from buildContext.
import { eachDay, rangesOverlap, addDays, diffDays, monthName, parts, addMonths, isoWeekday, isValidISO, WEEKDAYS_SHORT } from './dates.js';
import { countLeaveDays, leaveDaysBreakdown, clipToRange } from './leaveDays.js';
import { usageForAll } from './entitlement.js';

const NO_TEAM = { id: null, name: 'No team', colour: '#9C8A82' };

function carerOf(db, ctx, id) { return (ctx && ctx.carersById && ctx.carersById.get(id)) || db.carers.find((c) => c.id === id) || null; }
function typeOf(db, ctx, id) { return (ctx && ctx.leaveTypesById && ctx.leaveTypesById.get(id)) || db.leaveTypes.find((t) => t.id === id) || null; }
function byName(a, b) { return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'en', { sensitivity: 'base' }); }
function isSickType(t) { return !!t && (t.id === 'lt_sick' || /sick/i.test(t.name || '')); }
function inTeam(carer, teamId) { return !teamId || carer.teamId === teamId; }
function round2(n) { return Math.round(n * 100) / 100 + 0; }
/** A setting as a number, or the fallback when it is missing, blank or not a number. */
function numberSetting(value, fallback) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Everyone off on a day. */
export function whoIsOff(db, iso, ctx, { teamId, includePending = true } = {}) {
  const out = [];
  for (const h of db.holidays) {
    if (h.status === 'declined' || (!includePending && h.status === 'pending')) continue;
    if (iso < h.start || iso > h.end) continue;
    const carer = carerOf(db, ctx, h.carerId);
    if (!carer || !inTeam(carer, teamId)) continue;
    out.push({ carer, holiday: h, leaveType: typeOf(db, ctx, h.typeId) });
  }
  return out.sort((a, b) => byName(a.carer, b.carer));
}

/** Absences overlapping a range, with the days each uses. */
export function absencesBetween(db, start, end, ctx, { teamId, typeIds, statuses, carerIds } = {}) {
  const allowed = new Set(statuses && statuses.length ? statuses : ['approved', 'pending']);
  const types = typeIds && typeIds.length ? new Set(typeIds) : null;
  const people = carerIds && carerIds.length ? new Set(carerIds) : null;
  const out = [];
  for (const h of db.holidays) {
    if (!allowed.has(h.status)) continue;
    if (types && !types.has(h.typeId)) continue;
    if (people && !people.has(h.carerId)) continue;
    if (!rangesOverlap(h.start, h.end, start, end)) continue;
    const carer = carerOf(db, ctx, h.carerId);
    if (!carer || !inTeam(carer, teamId)) continue;
    out.push({ holiday: h, carer, leaveType: typeOf(db, ctx, h.typeId), days: countLeaveDays(h, carer, ctx) });
  }
  return out.sort((a, b) => a.holiday.start.localeCompare(b.holiday.start) || byName(a.carer, b.carer));
}

/** Absences starting within the next `days` days (not including today). */
export function upcoming(db, today, days, ctx, opts = {}) {
  const to = addDays(today, days);
  return absencesBetween(db, addDays(today, 1), to, ctx, opts).filter((a) => a.holiday.start > today && a.holiday.start <= to);
}

/** Absences covering today. */
export function currentlyOff(db, today, ctx, opts = {}) {
  return absencesBetween(db, today, today, ctx, opts);
}

/** Map<iso, number of carers off> for every day in the range with someone off. */
export function capacityByDay(db, start, end, ctx, { teamId, includePending = true } = {}) {
  const map = new Map();
  for (const h of db.holidays) {
    if (h.status === 'declined' || (!includePending && h.status === 'pending')) continue;
    if (!rangesOverlap(h.start, h.end, start, end)) continue;
    const carer = carerOf(db, ctx, h.carerId);
    if (!carer || !inTeam(carer, teamId)) continue;
    const from = h.start > start ? h.start : start;
    const to = h.end < end ? h.end : end;
    for (const d of eachDay(from, to)) {
      if (!map.has(d)) map.set(d, new Set());
      map.get(d).add(carer.id);
    }
  }
  const out = new Map();
  for (const [d, set] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out.set(d, set.size);
  return out;
}

function yearItems(db, yearBounds, ctx, teamId) {
  const out = [];
  for (const h of db.holidays) {
    if (h.status === 'declined') continue;
    if (!rangesOverlap(h.start, h.end, yearBounds.start, yearBounds.end)) continue;
    const carer = carerOf(db, ctx, h.carerId);
    if (!carer || !inTeam(carer, teamId)) continue;
    const clipped = clipToRange(h, yearBounds.start, yearBounds.end);
    if (!clipped) continue;
    out.push({ holiday: h, clipped, carer, leaveType: typeOf(db, ctx, h.typeId), breakdown: leaveDaysBreakdown(clipped, carer, ctx) });
  }
  return out;
}

/**
 * Days off in each calendar month of the holiday year, by leave type. Twelve months,
 * or thirteen when the year starts part-way through a month (1–5 April then belong to
 * a short final month rather than being lost).
 */
export function monthlyLeave(db, yearBounds, ctx, { teamId } = {}) {
  const months = [];
  const last = yearBounds.end.slice(0, 7);
  let cur = yearBounds.start.slice(0, 7) + '-01';
  for (let i = 0; i < 13 && cur.slice(0, 7) <= last; i++) {
    const p = parts(cur);
    months.push({ month: cur.slice(0, 7), label: `${monthName(p.m, true)} ${p.y}`, byType: new Map(), total: 0 });
    cur = addMonths(cur, 1);
  }
  const index = new Map(months.map((m, i) => [m.month, i]));
  for (const item of yearItems(db, yearBounds, ctx, teamId)) {
    const perDay = item.breakdown.countedDays.length ? item.breakdown.days / item.breakdown.countedDays.length : 0;
    for (const d of item.breakdown.countedDays) {
      const m = months[index.get(d.slice(0, 7))];
      if (!m) continue;
      m.byType.set(item.holiday.typeId, round2((m.byType.get(item.holiday.typeId) || 0) + perDay));
      m.total = round2(m.total + perDay);
    }
  }
  return months;
}

/** Days and number of holidays per leave type, most days first. */
export function leaveByType(db, yearBounds, ctx, { teamId } = {}) {
  const map = new Map();
  for (const item of yearItems(db, yearBounds, ctx, teamId)) {
    const t = item.leaveType;
    const key = item.holiday.typeId;
    if (!map.has(key)) map.set(key, { typeId: key, name: t?.name || 'Leave', colour: t?.colour || '#9C8A82', days: 0, count: 0 });
    const row = map.get(key);
    row.days = round2(row.days + item.breakdown.days);
    row.count += 1;
  }
  return [...map.values()].sort((a, b) => b.days - a.days || b.count - a.count || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** Days off by weekday (1 = Monday). */
export function dayOfWeekPattern(db, yearBounds, ctx, { teamId } = {}) {
  const out = Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, label: WEEKDAYS_SHORT[i], days: 0 }));
  for (const item of yearItems(db, yearBounds, ctx, teamId)) {
    const perDay = item.breakdown.countedDays.length ? item.breakdown.days / item.breakdown.countedDays.length : 0;
    for (const d of item.breakdown.countedDays) {
      const row = out[isoWeekday(d) - 1];
      row.days = round2(row.days + perDay);
    }
  }
  return out;
}

/** One row per team (plus "No team"), for active carers. */
export function teamSummary(db, yearBounds, ctx, today = ctx && ctx.today) {
  const active = db.carers.filter((c) => c.active);
  const usages = usageForAll(active, yearBounds, db.holidays, ctx, today);
  const sick = new Map(sicknessByCarer(db, yearBounds, ctx).map((r) => [r.carer.id, r.days]));
  const rows = [...db.teams.map((t) => ({ id: t.id, name: t.name, colour: t.colour })), NO_TEAM].map((team) => {
    const members = active.filter((c) => (team.id ? c.teamId === team.id : !c.teamId || !db.teams.some((t) => t.id === c.teamId)));
    const row = { team, carerCount: members.length, entitlement: 0, taken: 0, booked: 0, pending: 0, remaining: 0, sickDays: 0 };
    for (const m of members) {
      const u = usages.get(m.id);
      if (!u) continue;
      row.entitlement = round2(row.entitlement + u.entitlement.total);
      row.taken = round2(row.taken + u.taken);
      row.booked = round2(row.booked + u.booked);
      row.pending = round2(row.pending + u.pending);
      row.remaining = round2(row.remaining + u.remaining);
      row.sickDays = round2(row.sickDays + (sick.get(m.id) || 0));
    }
    return row;
  });
  return rows.filter((r) => r.team.id !== null || r.carerCount > 0);
}

/** Sick days per carer, most first. */
export function sicknessByCarer(db, yearBounds, ctx) {
  const map = new Map();
  for (const item of yearItems(db, yearBounds, ctx)) {
    if (!isSickType(item.leaveType)) continue;
    if (!map.has(item.carer.id)) map.set(item.carer.id, { carer: item.carer, days: 0, occurrences: 0 });
    const row = map.get(item.carer.id);
    row.days = round2(row.days + item.breakdown.days);
    row.occurrences += 1;
  }
  return [...map.values()].filter((r) => r.days > 0).sort((a, b) => b.days - a.days || byName(a.carer, b.carer));
}

function activeUsages(db, yearBounds, ctx, today, teamId) {
  const people = db.carers.filter((c) => c.active && inTeam(c, teamId));
  return { people, usages: usageForAll(people, yearBounds, db.holidays, ctx, today) };
}

/** Carers with lots of holiday left as the year end approaches. */
export function unusedLeaveAlerts(db, yearBounds, ctx, today = ctx && ctx.today) {
  const s = ctx.settings;
  if (!today || today > yearBounds.end) return [];
  const weeksLeft = diffDays(today, yearBounds.end) / 7;
  if (weeksLeft > numberSetting(s.unusedLeaveWarningWeeks, 12)) return [];
  const threshold = numberSetting(s.unusedLeaveWarningDays, 5);
  const { people, usages } = activeUsages(db, yearBounds, ctx, today);
  return people
    .map((c) => ({ carer: c, remaining: usages.get(c.id)?.remaining ?? 0, weeksLeft: Math.round(weeksLeft * 10) / 10 }))
    .filter((r) => r.remaining >= threshold)
    .sort((a, b) => b.remaining - a.remaining || byName(a.carer, b.carer));
}

/** Carers with only a little holiday left (0 to threshold). */
export function lowRemainingAlerts(db, yearBounds, ctx, today = ctx && ctx.today, threshold = 2) {
  const { people, usages } = activeUsages(db, yearBounds, ctx, today);
  return people
    .map((c) => ({ carer: c, remaining: usages.get(c.id)?.remaining ?? 0 }))
    .filter((r) => r.remaining >= 0 && r.remaining <= threshold && (usages.get(r.carer.id)?.entitlement.total ?? 0) > 0)
    .sort((a, b) => a.remaining - b.remaining || byName(a.carer, b.carer));
}

/** Carers who have gone over their entitlement. */
export function overdrawnAlerts(db, yearBounds, ctx, today = ctx && ctx.today) {
  const { people, usages } = activeUsages(db, yearBounds, ctx, today);
  return people
    .map((c) => ({ carer: c, remaining: usages.get(c.id)?.remaining ?? 0 }))
    .filter((r) => r.remaining < 0)
    .sort((a, b) => a.remaining - b.remaining || byName(a.carer, b.carer));
}

/** Holidays waiting for a decision, soonest first. */
export function pendingApprovals(db, ctx) {
  const out = [];
  for (const h of db.holidays) {
    if (h.status !== 'pending') continue;
    const carer = carerOf(db, ctx, h.carerId);
    if (!carer) continue;
    out.push({ holiday: h, carer, leaveType: typeOf(db, ctx, h.typeId), days: countLeaveDays(h, carer, ctx) });
  }
  return out.sort((a, b) => a.holiday.start.localeCompare(b.holiday.start) || byName(a.carer, b.carer));
}

/**
 * Is a backup due? Reminders are off when `backupReminderDays` is 0 (or missing). A last
 * backup date that can't be read counts as no backup at all. Days are never negative,
 * so a backup stamped later today (or by a clock that was ahead) reads as 0 days ago.
 */
export function backupStatus(settings, today) {
  const raw = settings?.lastBackupAt ? String(settings.lastBackupAt).slice(0, 10) : null;
  const last = raw && isValidISO(raw) ? raw : null;
  const daysSince = last && isValidISO(today) ? Math.max(0, diffDays(last, today)) : null;
  const every = Math.max(0, numberSetting(settings?.backupReminderDays, 0));
  const due = every > 0 && (daysSince === null || daysSince >= every);
  return { lastBackupAt: (settings?.lastBackupAt) || null, daysSince, due };
}

/** Every active carer with their usage, most days left first. */
export function usageLeagueTable(db, yearBounds, ctx, today = ctx && ctx.today, { teamId } = {}) {
  const { people, usages } = activeUsages(db, yearBounds, ctx, today, teamId);
  return people
    .map((c) => {
      const usage = usages.get(c.id);
      const total = usage?.entitlement.total || 0;
      const percentUsed = total > 0 ? Math.min(999, ((usage.taken + usage.booked) / total) * 100) : 0;
      return { carer: c, usage, percentUsed: Math.round(percentUsed * 10) / 10 };
    })
    .filter((r) => r.usage)
    .sort((a, b) => b.usage.remaining - a.usage.remaining || byName(a.carer, b.carer));
}
