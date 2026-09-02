// A dropdown of holiday years: "2025/26", "2026/27 (this year)", "2027/28" …
import { yearsAround, yearsCovering, yearKeyFor, yearBounds } from '../../core/holidayYear.js';
import { todayISO } from '../../core/dates.js';
import { SelectField } from './Field.jsx';

/**
 * Options for the picker: the years covering `extraDates` plus two back and two ahead of today,
 * sorted ascending, with "(this year)" on the current one.
 * @param {object} settings – needs `holidayYearStart`
 * @param {string[]} [extraDates] – ISO dates whose years must be offered (e.g. every holiday's start/end)
 * @param {string} [today] – ISO
 * @param {string} [ensureKey] – a year key that must be present (the current value)
 * @returns {Array<{ value: string, label: string }>}
 */
export function yearOptions(settings, extraDates = [], today = todayISO(), ensureKey = null) {
  const map = new Map();
  for (const y of yearsCovering(extraDates, settings, today)) map.set(y.key, y);
  for (const y of yearsAround(settings, { past: 2, future: 2, today })) map.set(y.key, y);
  if (ensureKey && /^\d{4}$/.test(String(ensureKey)) && !map.has(String(ensureKey))) map.set(String(ensureKey), yearBounds(ensureKey, settings));
  const current = yearKeyFor(today, settings);
  return [...map.values()]
    .sort((a, b) => Number(a.key) - Number(b.key))
    .map((y) => ({ value: y.key, label: y.key === current ? `${y.label} (this year)` : y.label }));
}

/**
 * YearPicker – native select of holiday years.
 * @param {object} props
 * @param {string} props.value – year key, e.g. '2026'
 * @param {(yearKey: string) => void} [props.onChange]
 * @param {object} props.settings
 * @param {string[]} [props.extraDates]
 * @param {string} [props.id]
 * @param {string} [props.today] – ISO, defaults to the real date
 * @param {boolean} [props.disabled]
 * @param {string} [props.ariaLabel='Holiday year']
 * @param {string} [props.class]
 */
export function YearPicker({ value, onChange, settings, extraDates = [], id, today = todayISO(), disabled = false, ariaLabel = 'Holiday year', class: cls = '' }) {
  const options = yearOptions(settings, extraDates, today, value);
  return <SelectField id={id} options={options} value={value} onChange={(v) => onChange?.(String(v))} disabled={disabled} ariaLabel={ariaLabel} class={cls} />;
}
