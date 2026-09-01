// Ready-made, automatically refreshed calculation context and holiday-year helpers for views.
import { computed } from '@preact/signals';
import { db, settings } from '../../store/store.js';
import { buildContext } from '../../core/context.js';
import { yearBounds, yearKeyFor, yearsAround, yearsCovering } from '../../core/holidayYear.js';
import { today } from './today.js';

/** Calculation context (bank holidays, lookups) – recomputed only when data or the date changes. */
export const ctx = computed(() => (db.value ? buildContext(db.value, { today: today.value }) : null));

/** The holiday year that today falls in: { key, label, start, end }. */
export const currentYear = computed(() => yearBounds(yearKeyFor(today.value, settings.value), settings.value));

/** Holiday years worth offering in dropdowns (data-covering ∪ two back / two ahead), ascending. */
export const availableYears = computed(() => {
  const s = settings.value;
  const dates = (db.value?.holidays ?? []).flatMap((h) => [h.start, h.end]);
  const map = new Map();
  for (const y of yearsCovering(dates, s, today.value)) map.set(y.key, y);
  for (const y of yearsAround(s, { past: 2, future: 2, today: today.value })) map.set(y.key, y);
  return [...map.values()].sort((a, b) => Number(a.key) - Number(b.key));
});

/** Bounds for a year key, falling back to the current year when the key is unknown/empty. */
export function boundsFor(yearKey) {
  const s = settings.value;
  if (!yearKey || !/^\d{4}$/.test(String(yearKey))) return currentYear.value;
  return yearBounds(yearKey, s);
}
