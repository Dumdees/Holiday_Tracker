// Clash detection: everything that should make someone pause before adding a holiday,
// explained in plain English.
import { formatRange, formatShort, eachDay, rangesOverlap, addDays } from './dates.js';
import { leaveDaysBreakdown, countLeaveDays, describeWorkingPattern } from './leaveDays.js';
import { usageForYear, formatDays } from './entitlement.js';
import { splitRangeByYear, yearBounds } from './holidayYear.js';

const first = (c) => (c && c.firstName) || 'This carer';
const uniqueCarers = (list) => [...new Map(list.map((o) => [o.carer.id, o.carer])).values()];

function carerOf(db, ctx, id) {
  return (ctx && ctx.carersById && ctx.carersById.get(id)) || db.carers.find((c) => c.id === id) || null;
}
function teamOf(db, ctx, id) {
  if (!id) return null;
  return (ctx && ctx.teamsById && ctx.teamsById.get(id)) || db.teams.find((t) => t.id === id) || null;
}
function teamLimit(team, settings) {
  if (!team) return 0;
  const limit = team.maxOffPerDay == null ? settings.defaultMaxOffPerDay : team.maxOffPerDay;
  return Number(limit) > 0 ? Number(limit) : 0;
}
function clash(kind, severity, message, extra = {}) {
  return { kind, severity, message, dates: [], relatedCarerIds: [], relatedHolidayIds: [], ...extra };
}

/**
 * Who is off on a given day.
 * @returns {Array<{ carer: object, holiday: object }>}
 */
export function offOnDay(iso, db, ctx, { teamId = null, includePending = true, ignoreHolidayIds = [], excludeCarerId = null } = {}) {
  const ignore = new Set(ignoreHolidayIds);
  const out = [];
  for (const h of db.holidays) {
    if (h.status === 'declined' || ignore.has(h.id)) continue;
    if (h.status === 'pending' && !includePending) continue;
    if (iso < h.start || iso > h.end) continue;
    if (excludeCarerId && h.carerId === excludeCarerId) continue;
    const carer = carerOf(db, ctx, h.carerId);
    if (!carer) continue;
    if (teamId !== null && teamId !== undefined && carer.teamId !== teamId) continue;
    out.push({ carer, holiday: h });
  }
  return out;
}

/**
 * Check a proposed holiday against everything already recorded.
 * @param {{ carerId: string, start: string, end: string, typeId: string, status: string, halfDay?: string|null }} proposed
 * @returns {Array<{ kind: string, severity: 'block'|'warn', message: string, details?: string, dates: string[], relatedCarerIds: string[], relatedHolidayIds: string[] }>}
 */
export function findClashes(proposed, db, ctx, { ignoreHolidayIds = [], today = ctx && ctx.today } = {}) {
  const carer = carerOf(db, ctx, proposed.carerId);
  if (!carer) return [clash('unknown-carer', 'block', 'That carer no longer exists')];
  const ignore = new Set(ignoreHolidayIds);
  const name = first(carer);
  const out = [];

  // Same carer, overlapping dates – this one blocks.
  for (const h of db.holidays) {
    if (h.carerId !== carer.id || h.status === 'declined' || ignore.has(h.id)) continue;
    if (!rangesOverlap(h.start, h.end, proposed.start, proposed.end)) continue;
    out.push(clash('overlap', 'block', `${name} is already off ${formatRange(h.start, h.end)}`, { dates: [h.start], relatedCarerIds: [carer.id], relatedHolidayIds: [h.id] }));
  }

  if (carer.active === false) {
    out.push(clash('inactive', 'warn', `${name} is archived – reactivate them first if this is a mistake`, { relatedCarerIds: [carer.id] }));
  }
  if (carer.startDate && proposed.start < carer.startDate) {
    out.push(clash('outside-employment', 'warn', `${name}’s start date is ${formatShort(carer.startDate)}, after this holiday begins`, { dates: [proposed.start], relatedCarerIds: [carer.id] }));
  }
  if (carer.endDate && proposed.end > carer.endDate) {
    out.push(clash('outside-employment', 'warn', `${name} leaves on ${formatShort(carer.endDate)}, before this holiday ends`, { dates: [proposed.end], relatedCarerIds: [carer.id] }));
  }

  const breakdown = leaveDaysBreakdown(proposed, carer, ctx);
  if (breakdown.days === 0) {
    out.push(clash('no-working-days', 'warn', `None of these dates are working days for ${name} (${name} works ${describeWorkingPattern(carer)})`, { relatedCarerIds: [carer.id] }));
  }

  // Too many from the same team off together.
  const team = teamOf(db, ctx, carer.teamId);
  const limit = teamLimit(team, ctx.settings);
  if (team && limit > 0) {
    const over = [];
    for (const d of breakdown.countedDays) {
      const others = uniqueCarers(offOnDay(d, db, ctx, { teamId: team.id, includePending: true, ignoreHolidayIds, excludeCarerId: carer.id }));
      const count = others.length + 1;
      if (count > limit) over.push({ date: d, count, others });
    }
    if (over.length) {
      const worst = over.reduce((a, b) => (b.count > a.count ? b : a), over[0]);
      const more = over.length - 1;
      out.push(clash('staffing', 'warn',
        `${worst.count} people in ${team.name} would be off on ${formatShort(worst.date)} – the limit is ${limit}${more ? ` (and ${more} more ${more === 1 ? 'day' : 'days'})` : ''}`,
        { details: `Also off: ${worst.others.map(first).join(', ')}`, dates: over.map((o) => o.date), relatedCarerIds: worst.others.map((c) => c.id) }));
    }
  }

  // People who must not be off together.
  const partners = new Set(carer.mustNotBeOffWith || []);
  for (const c of db.carers) if ((c.mustNotBeOffWith || []).includes(carer.id)) partners.add(c.id);
  for (const pid of partners) {
    const partner = carerOf(db, ctx, pid);
    if (!partner) continue;
    const dates = [];
    let holidayIds = [];
    for (const d of breakdown.countedDays) {
      const hits = offOnDay(d, db, ctx, { includePending: true, ignoreHolidayIds }).filter((o) => o.carer.id === pid);
      if (hits.length) { dates.push(d); holidayIds = hits.map((h) => h.holiday.id); }
    }
    if (dates.length) {
      out.push(clash('pairing', 'warn', `${name} and ${first(partner)} shouldn’t be off at the same time – ${first(partner)} is off ${formatShort(dates[0])}${dates.length > 1 ? ` (and ${dates.length - 1} more ${dates.length - 1 === 1 ? 'day' : 'days'})` : ''}`, { dates, relatedCarerIds: [partner.id], relatedHolidayIds: [...new Set(holidayIds)] }));
    }
  }

  // Not enough entitlement left.
  const type = ctx.leaveTypesById && ctx.leaveTypesById.get(proposed.typeId);
  if (type && type.deductsEntitlement && proposed.status !== 'declined') {
    const others = ignore.size ? db.holidays.filter((h) => !ignore.has(h.id)) : db.holidays;
    for (const piece of splitRangeByYear(proposed.start, proposed.end, ctx.settings)) {
      const yb = yearBounds(piece.key, ctx.settings);
      const usage = usageForYear(carer, yb, others, ctx, today);
      const pieceDays = leaveDaysBreakdown({ start: piece.start, end: piece.end, halfDay: proposed.halfDay }, carer, ctx).days;
      if (pieceDays > 0 && usage.remaining - pieceDays < 0) {
        const after = Math.round((usage.remaining - pieceDays) * 100) / 100;
        const msg = usage.remaining <= 0
          ? `${name} has no days left in ${yb.label} – this would take them to ${formatDays(after)}`
          : `Only ${formatDays(usage.remaining)} ${usage.remaining === 1 ? 'day' : 'days'} left in ${yb.label} – this would take ${name} to ${formatDays(after)}`;
        out.push(clash('entitlement', 'warn', msg, { dates: [piece.start], relatedCarerIds: [carer.id] }));
      }
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'block' ? -1 : 1));
}

/**
 * Check a whole batch; later proposals see earlier (non-blocked) ones as if already added.
 * @returns {Array<{ proposal: object, clashes: object[], days: number, blocked: boolean }>}
 */
export function checkBatch(proposals, db, ctx, opts = {}) {
  const temps = [];
  const out = [];
  proposals.forEach((p, i) => {
    const view = temps.length ? { ...db, holidays: [...db.holidays, ...temps] } : db;
    const clashes = findClashes(p, view, ctx, opts);
    const carer = carerOf(db, ctx, p.carerId);
    const days = carer ? countLeaveDays(p, carer, ctx) : 0;
    const blocked = clashes.some((c) => c.severity === 'block');
    out.push({ proposal: p, clashes, days, blocked });
    if (!blocked) temps.push({ ...p, id: `tmp_${i}`, status: p.status || 'approved' });
  });
  return out;
}

/** Group sorted ISO dates into runs of consecutive days. */
function runs(dates) {
  const out = [];
  for (const d of dates) {
    const last = out[out.length - 1];
    if (last && addDays(last[last.length - 1], 1) === d) last.push(d);
    else out.push([d]);
  }
  return out;
}

/**
 * Problems already present in the data within a date range (for the Home screen).
 * @returns {Array<{ kind: 'overlap'|'staffing'|'pairing', message: string, dates: string[], carerIds: string[], holidayIds: string[] }>}
 */
export function existingProblems(db, ctx, { start, end, includePending = true } = {}) {
  const from = start || (ctx && ctx.today) || db.holidays[0]?.start;
  const to = end || (from && addDays(from, 60));
  if (!from || !to) return [];
  const out = [];
  const live = db.holidays.filter((h) => h.status !== 'declined' && (includePending || h.status !== 'pending') && rangesOverlap(h.start, h.end, from, to));

  // Overlaps for the same carer.
  const byCarer = new Map();
  for (const h of live) { if (!byCarer.has(h.carerId)) byCarer.set(h.carerId, []); byCarer.get(h.carerId).push(h); }
  for (const [carerId, list] of byCarer) {
    const carer = carerOf(db, ctx, carerId);
    if (!carer) continue;
    list.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!rangesOverlap(list[i].start, list[i].end, list[j].start, list[j].end)) continue;
        out.push({ kind: 'overlap', message: `${first(carer)} has two holidays that overlap: ${formatRange(list[i].start, list[i].end)} and ${formatRange(list[j].start, list[j].end)}`, dates: [list[j].start], carerIds: [carer.id], holidayIds: [list[i].id, list[j].id] });
      }
    }
  }

  const days = eachDay(from, to).slice(0, 400);
  // Staffing per team.
  for (const team of db.teams) {
    const limit = teamLimit(team, ctx.settings);
    if (!limit) continue;
    const overDays = [];
    const info = new Map();
    for (const d of days) {
      const off = uniqueCarers(offOnDay(d, db, ctx, { teamId: team.id, includePending }));
      if (off.length > limit) { overDays.push(d); info.set(d, off); }
    }
    for (const run of runs(overDays)) {
      const worst = run.reduce((a, b) => (info.get(b).length > info.get(a).length ? b : a), run[0]);
      const more = run.length - 1;
      out.push({ kind: 'staffing', message: `${info.get(worst).length} people in ${team.name} are off on ${formatShort(worst)} – the limit is ${limit}${more ? ` (and ${more} more ${more === 1 ? 'day' : 'days'})` : ''}`, dates: run, carerIds: info.get(worst).map((c) => c.id), holidayIds: [] });
    }
  }

  // Pairs who must not be off together.
  const pairs = new Map();
  for (const c of db.carers) for (const pid of c.mustNotBeOffWith || []) {
    const key = [c.id, pid].sort().join('|');
    if (!pairs.has(key)) pairs.set(key, [c.id, pid].sort());
  }
  for (const [a, b] of pairs.values()) {
    const A = carerOf(db, ctx, a), B = carerOf(db, ctx, b);
    if (!A || !B) continue;
    const both = [];
    for (const d of days) {
      const off = offOnDay(d, db, ctx, { includePending });
      if (off.some((o) => o.carer.id === a) && off.some((o) => o.carer.id === b)) both.push(d);
    }
    for (const run of runs(both)) {
      out.push({ kind: 'pairing', message: `${first(A)} and ${first(B)} are both off ${run.length > 1 ? formatRange(run[0], run[run.length - 1]) : `on ${formatShort(run[0])}`} – they shouldn’t be off at the same time`, dates: run, carerIds: [a, b], holidayIds: [] });
    }
  }

  return out.sort((x, y) => (x.dates[0] || '').localeCompare(y.dates[0] || ''));
}
