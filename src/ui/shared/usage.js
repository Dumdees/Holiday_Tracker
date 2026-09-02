// Entitlement usage per carer for a holiday year, cached until the data or date changes.
import { db, carers, holidays, settings, leaveTypesById } from '../../store/store.js';
import { splitRangeByYear, yearBounds } from '../../core/holidayYear.js';
import { leaveDaysBreakdown } from '../../core/leaveDays.js';
import { usageForAll, usageForYear } from '../../core/entitlement.js';
import { ctx, boundsFor } from './context.js';
import { today } from './today.js';

let cache = { doc: null, today: null, byYear: new Map() };

/** Map<carerId, usage> for the given holiday-year key (defaults to the current year). */
export function usageMap(yearKey) {
  const doc = db.value;
  const t = today.value;
  if (cache.doc !== doc || cache.today !== t) cache = { doc, today: t, byYear: new Map() };
  const yb = boundsFor(yearKey);
  if (!cache.byYear.has(yb.key)) {
    cache.byYear.set(yb.key, usageForAll(carers.value, yb, holidays.value, ctx.value, t));
  }
  return cache.byYear.get(yb.key);
}

/** Usage for one carer (or null if unknown). */
export function usageFor(carerId, yearKey) {
  return usageMap(yearKey).get(carerId) ?? null;
}

/** Usage for a carer object that may not be saved yet (e.g. while editing). */
export function usageForCarer(carer, yearKey) {
  return usageForYear(carer, boundsFor(yearKey), holidays.value, ctx.value, today.value);
}

/**
 * What a carer would have left after a proposed holiday, per holiday year it touches.
 * Returns [] for leave types that don't use up entitlement.
 * @returns {Array<{ label: string, key: string, before: number, after: number, days: number }>}
 */
export function remainingAfter(carer, proposal, { ignoreHolidayIds = [] } = {}) {
  const s = settings.value;
  const deducts = leaveTypesById.value.get(proposal.typeId)?.deductsEntitlement === true;
  if (!deducts || proposal.status === 'declined') return [];
  const ignore = new Set(ignoreHolidayIds);
  const others = ignore.size ? holidays.value.filter((h) => !ignore.has(h.id)) : holidays.value;
  return splitRangeByYear(proposal.start, proposal.end, s).map((piece) => {
    const yb = yearBounds(piece.key, s);
    const usage = usageForYear(carer, yb, others, ctx.value, today.value);
    const days = leaveDaysBreakdown({ start: piece.start, end: piece.end, halfDay: proposal.halfDay }, carer, ctx.value).days;
    return { label: yb.label, key: yb.key, before: usage.remaining, after: usage.remaining - days, days };
  });
}
