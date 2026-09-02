// Entitlement for a holiday year and how much of it a carer has used.
// Everything here is pure: "today" is always passed in so results are repeatable.
import { todayISO, isBetween } from './dates.js';
import { employedFractionOfYear } from './holidayYear.js';
import { leaveDaysBreakdown, clipToRange } from './leaveDays.js';

/** Two decimal places, and never "-0". Keeps float noise out of everything we show. */
function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100 + 0;
}

/**
 * Round to the nearest `step` (0.5 by default), halves rounding up. A falsy step
 * means no rounding at all.
 * @param {number} value
 * @param {number} [step=0.5]
 * @returns {number}
 */
export function roundTo(value, step = 0.5) {
  const v = Number(value) || 0;
  if (!step) return v;
  const stepped = Math.floor(v / step + 0.5) * step;
  return Number(stepped.toFixed(10)) + 0;
}

/**
 * The share of the year's entitlement a carer gets: 0 when their employment misses the
 * year entirely, the employed fraction when pro-rata is on and they start or leave during
 * the year, otherwise the full amount (1).
 */
function proRataFractionFor(carer, yb, settings) {
  const startDate = carer?.startDate || null;
  const endDate = carer?.endDate || null;
  if ((startDate && startDate > yb.end) || (endDate && endDate < yb.start)) return 0;
  const startsInYear = !!startDate && isBetween(startDate, yb.start, yb.end);
  const endsInYear = !!endDate && isBetween(endDate, yb.start, yb.end);
  if (settings?.proRataStartersAndLeavers && (startsInYear || endsInYear)) {
    return employedFractionOfYear(yb, startDate, endDate);
  }
  return 1;
}

/**
 * How many days a carer is entitled to in a holiday year.
 * @param {object} carer – { entitlementDays, startDate, endDate, adjustments[] }
 * @param {{ key: string, start: string, end: string }} yearBounds – from holidayYear.js
 * @param {{ proRataStartersAndLeavers?: boolean, roundEntitlementTo?: number }} settings
 * @returns {{ base: number, proRataFraction: number, proRated: number, adjustments: object[], adjustmentTotal: number, total: number }}
 */
export function entitlementForYear(carer, yearBounds, settings) {
  const base = Number(carer?.entitlementDays) || 0;
  const proRataFraction = proRataFractionFor(carer, yearBounds, settings);
  const proRated = roundTo(base * proRataFraction, settings?.roundEntitlementTo);
  const adjustments = (carer?.adjustments || []).filter((a) => String(a.yearKey) === String(yearBounds.key));
  const adjustmentTotal = round2(adjustments.reduce((sum, a) => sum + (Number(a.days) || 0), 0));
  return { base, proRataFraction, proRated, adjustments, adjustmentTotal, total: round2(proRated + adjustmentTotal) };
}

/** Add `days` to `key` in a Map of totals. */
function addTo(map, key, days) {
  map.set(key, round2((map.get(key) || 0) + days));
}

/** Split a holiday's counted days into those on/before today and those after. */
function splitAroundToday(breakdown, today) {
  const { days, countedDays } = breakdown;
  const perDay = countedDays.length ? days / countedDays.length : 0; // 0.5 for a half day
  const before = countedDays.filter((iso) => iso <= today).length;
  return { before: before * perDay, after: (countedDays.length - before) * perDay };
}

/**
 * A carer's entitlement usage for one holiday year. Only this carer's holidays that
 * overlap the year are considered, each clipped to the year first.
 * - Deducting leave types (per `ctx.leaveTypesById`): approved days on or before today
 *   count as taken, approved days after today as booked (a holiday spanning today is
 *   split), pending days as pending.
 * - Non-deducting types (sick etc.) appear in byType / byTypeStatus / items only.
 * - Declined holidays go to declinedDays, byTypeStatus ('typeId:declined') and items only.
 * @param {object} carer
 * @param {{ key: string, start: string, end: string }} yearBounds
 * @param {object[]} holidays – any list; other carers' holidays are ignored
 * @param {{ settings: object, today?: string, bankHolidayMap?: Map, leaveTypesById?: Map }} ctx
 * @param {string} [today] – ISO date, defaults to ctx.today
 * @returns {{
 *   yearKey: string, yearBounds: object, entitlement: object,
 *   taken: number, booked: number, pending: number, remaining: number, remainingAfterPending: number, declinedDays: number,
 *   byType: Map<string, number>, byTypeStatus: Map<string, number>,
 *   items: Array<{ holiday: object, days: number, start: string, end: string, status: string, deducts: boolean, past: boolean }>,
 * }}
 */
export function usageForYear(carer, yearBounds, holidays, ctx, today = ctx?.today || todayISO()) {
  const entitlement = entitlementForYear(carer, yearBounds, ctx?.settings);
  const byType = new Map();
  const byTypeStatus = new Map();
  const items = [];
  let taken = 0, booked = 0, pending = 0, declinedDays = 0;

  for (const holiday of holidays || []) {
    if (holiday.carerId !== carer.id) continue;
    const clipped = clipToRange(holiday, yearBounds.start, yearBounds.end);
    if (!clipped) continue;
    const breakdown = leaveDaysBreakdown(clipped, carer, ctx);
    const { days } = breakdown;
    const status = holiday.status || 'approved';
    const deducts = ctx?.leaveTypesById?.get(holiday.typeId)?.deductsEntitlement === true;
    items.push({ holiday, days, start: clipped.start, end: clipped.end, status, deducts, past: clipped.end <= today });
    addTo(byTypeStatus, `${holiday.typeId}:${status}`, days);
    if (status === 'declined') { declinedDays += days; continue; }
    addTo(byType, holiday.typeId, days);
    if (!deducts) continue;
    if (status === 'pending') pending += days;
    else if (status === 'approved') {
      const { before, after } = splitAroundToday(breakdown, today);
      taken += before;
      booked += after;
    }
  }

  items.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const remaining = round2(entitlement.total - taken - booked);
  return {
    yearKey: yearBounds.key,
    yearBounds,
    entitlement,
    taken: round2(taken),
    booked: round2(booked),
    pending: round2(pending),
    remaining,
    remainingAfterPending: round2(remaining - pending),
    declinedDays: round2(declinedDays),
    byType,
    byTypeStatus,
    items,
  };
}

/**
 * usageForYear for every carer at once.
 * @param {object[]} carers
 * @param {{ key: string, start: string, end: string }} yearBounds
 * @param {object[]} holidays
 * @param {object} ctx
 * @param {string} [today] – ISO date, defaults to ctx.today
 * @returns {Map<string, object>} carer id → usage
 */
export function usageForAll(carers, yearBounds, holidays, ctx, today = ctx?.today || todayISO()) {
  const byCarer = new Map();
  for (const h of holidays || []) {
    if (!byCarer.has(h.carerId)) byCarer.set(h.carerId, []);
    byCarer.get(h.carerId).push(h);
  }
  const out = new Map();
  for (const carer of carers || []) {
    out.set(carer.id, usageForYear(carer, yearBounds, byCarer.get(carer.id) || [], ctx, today));
  }
  return out;
}

/**
 * Totals across many usages (an array, a Map's values, or the Map itself).
 * @param {Iterable<object> | Map<string, object>} usages
 * @returns {{ carerCount: number, entitlement: number, taken: number, booked: number, pending: number, remaining: number }}
 */
export function summarise(usages) {
  const totals = { carerCount: 0, entitlement: 0, taken: 0, booked: 0, pending: 0, remaining: 0 };
  const list = usages instanceof Map ? usages.values() : usages || [];
  for (const u of list) {
    totals.carerCount += 1;
    totals.entitlement += u.entitlement?.total || 0;
    totals.taken += u.taken || 0;
    totals.booked += u.booked || 0;
    totals.pending += u.pending || 0;
    totals.remaining += u.remaining || 0;
  }
  for (const key of ['entitlement', 'taken', 'booked', 'pending', 'remaining']) totals[key] = round2(totals[key]);
  return totals;
}

/**
 * Days as people write them: '12', '12.5', '0.5', '-1.5' – never '12.0'.
 * @param {number} n
 * @returns {string}
 */
export function formatDays(n) {
  return String(round2(n));
}
