// Entitlement usage per carer for a holiday year, cached until the data or date changes.
import { db, carers, holidays } from '../../store/store.js';
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
