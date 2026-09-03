// Add or edit a carer. Opens as a dialog; resolves with the carer's id when saved.
import { useState } from 'preact/hooks';
import { openModal } from '../components/Modal.jsx';
import { Field, TextField, NumberField, TextArea, DateField, SelectField, WeekdayPicker, ColourPicker } from '../components/Field.jsx';
import { MultiSelect } from '../components/MultiSelect.jsx';
import { Button } from '../components/Button.jsx';
import { HelpTip } from '../components/HelpTip.jsx';
import { toast } from '../components/Toast.jsx';
import { carers, teams, settings, addCarer, updateCarer, carerName } from '../../store/store.js';
import { carerOptions, roleOptions } from '../shared/options.js';
import { today } from '../shared/today.js';
import { shiftPatternOf, patternWeekIndex, MAX_PATTERN_WEEKS } from '../../core/leaveDays.js';
import { startOfWeek, addDays, formatShort } from '../../core/dates.js';

const PATTERN_OPTIONS = [
  { value: 1, label: 'The same days every week' },
  { value: 2, label: 'Repeats every 2 weeks (for example alternate weekends)' },
  { value: 3, label: 'Repeats every 3 weeks' },
  { value: 4, label: 'Repeats every 4 weeks' },
];
const ALTERNATE_WEEKENDS = [[1, 2, 3, 4, 5], [3, 4, 5, 6, 7]];

/**
 * @param {{ carerId?: string|null, defaults?: object }} opts – pass carerId to edit, or defaults for a new carer
 * @returns {Promise<string|undefined>} the carer id, or undefined when cancelled
 */
export function openCarerDialog({ carerId = null, defaults = {} } = {}) {
  return openModal(({ close }) => <CarerForm carerId={carerId} defaults={defaults} close={close} />, {
    size: 'lg',
    title: carerId ? 'Edit carer' : 'Add a carer',
  });
}

function CarerForm({ carerId, defaults, close }) {
  const existing = carerId ? carers.value.find((c) => c.id === carerId) : null;
  const s = settings.value;
  const [form, setForm] = useState(() => ({
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    role: existing?.role ?? 'Carer',
    teamId: existing?.teamId ?? defaults.teamId ?? (teams.value[0]?.id ?? ''),
    startDate: existing?.startDate ?? '',
    endDate: existing?.endDate ?? '',
    workingDays: existing?.workingDays ?? [...s.defaultWorkingDays],
    // A repeating pattern: one list of days per week, and which of those weeks the current week is.
    patternWeeks: shiftPatternOf(existing)?.weeks ?? null,
    thisWeek: shiftPatternOf(existing) ? patternWeekIndex(today.value, shiftPatternOf(existing)) : 0,
    entitlementDays: existing?.entitlementDays ?? s.defaultEntitlementDays,
    phone: existing?.phone ?? '',
    email: existing?.email ?? '',
    notes: existing?.notes ?? '',
    colour: existing?.colour ?? null,
    mustNotBeOffWith: existing?.mustNotBeOffWith ?? [],
    ...defaults,
  }));
  const [errors, setErrors] = useState({});
  const set = (key) => (value) => { setForm((f) => ({ ...f, [key]: value })); if (errors[key]) setErrors((e) => ({ ...e, [key]: '' })); };

  function setCycle(n) {
    if (n <= 1) { set('patternWeeks')(null); return; }
    const base = form.patternWeeks || [[...form.workingDays]];
    const weeks = Array.from({ length: Math.min(n, MAX_PATTERN_WEEKS) }, (_, i) => [...(base[i] || base[base.length - 1] || form.workingDays)]);
    setForm((f) => ({ ...f, patternWeeks: weeks, thisWeek: Math.min(f.thisWeek, weeks.length - 1) }));
    if (errors.pattern) setErrors((e) => ({ ...e, pattern: '' }));
  }
  function setWeek(i, days) {
    setForm((f) => ({ ...f, patternWeeks: f.patternWeeks.map((w, j) => (j === i ? days : w)) }));
    if (errors.pattern) setErrors((e) => ({ ...e, pattern: '' }));
  }

  const others = carerOptions(carers.value.filter((c) => c.id !== carerId), teams.value, { includeArchived: false });
  const teamOpts = [{ value: '', label: 'No team' }, ...teams.value.map((t) => ({ value: t.id, label: t.name }))];
  const roles = roleOptions(s, carers.value);
  if (form.role && !roles.some((r) => r.value === form.role)) roles.push({ value: form.role, label: form.role });

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Please enter a first name.';
    if (!form.lastName.trim()) e.lastName = 'Please enter a last name.';
    if (form.patternWeeks) {
      if (!form.patternWeeks.some((w) => w.length)) e.pattern = 'Choose at least one working day somewhere in the pattern.';
    } else if (!form.workingDays?.length) e.workingDays = 'Choose at least one working day.';
    if (form.entitlementDays == null || form.entitlementDays < 0) e.entitlementDays = 'Enter their holiday entitlement (0 or more days).';
    if (form.endDate && form.startDate && form.endDate < form.startDate) e.endDate = 'The leaving date must be after the start date.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'That email address doesn’t look right.';
    return e;
  }

  function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = {
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role || 'Carer',
      teamId: form.teamId || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
      entitlementDays: Number(form.entitlementDays) || 0,
      workingDays: form.patternWeeks ? [...(form.patternWeeks.find((w) => w.length) || form.workingDays)] : [...form.workingDays].sort((a, b) => a - b),
      // Week 1 of the pattern is `thisWeek` weeks before the current week.
      shiftPattern: form.patternWeeks ? { weeks: form.patternWeeks.map((w) => [...w].sort((a, b) => a - b)), anchor: addDays(startOfWeek(today.value, 1), -7 * form.thisWeek) } : null,
    };
    delete data.patternWeeks;
    delete data.thisWeek;
    if (existing) {
      updateCarer(existing.id, data);
      toast(`${carerName(data)} updated`);
      close(existing.id);
    } else {
      const id = addCarer(data);
      toast(`${carerName(data)} added`);
      close(id);
    }
  }

  return (
    <div class="carer-form stack">
      <div class="grid grid-2">
        <Field label="First name" required error={errors.firstName}>
          <TextField value={form.firstName} onChange={set('firstName')} autoFocus placeholder="e.g. Priya" />
        </Field>
        <Field label="Last name" required error={errors.lastName}>
          <TextField value={form.lastName} onChange={set('lastName')} placeholder="e.g. Patel" />
        </Field>
        <Field label="Team">
          <SelectField options={teamOpts} value={form.teamId || ''} onChange={set('teamId')} />
        </Field>
        <Field label="Role">
          <SelectField options={roles} value={form.role} onChange={set('role')} />
        </Field>
        <Field label="Start date" hint="Used to work out a fair share of holiday for people who joined part-way through the year.">
          <DateField value={form.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Leaving date" hint="Only for carers who are leaving." error={errors.endDate}>
          <DateField value={form.endDate} onChange={set('endDate')} min={form.startDate || undefined} />
        </Field>
      </div>

      <Field label="Working pattern" hint="Holidays only use up days on the days they would have worked, and clash checks only count them on those days.">
        <SelectField options={PATTERN_OPTIONS} value={form.patternWeeks ? form.patternWeeks.length : 1} onChange={(v) => setCycle(Number(v))} />
      </Field>
      {!form.patternWeeks ? (
        <Field label="Working days" required error={errors.workingDays}>
          <WeekdayPicker value={form.workingDays} onChange={set('workingDays')} />
        </Field>
      ) : (
        <div class="shift-pattern" data-test="shift-pattern">
          {form.patternWeeks.map((days, i) => (
            <Field key={i} label={`Week ${i + 1}${i === form.thisWeek ? ' (this week)' : ''}`} error={i === 0 ? errors.pattern : undefined}>
              <WeekdayPicker value={days} onChange={(v) => setWeek(i, v)} />
            </Field>
          ))}
          <div class="grid grid-2">
            <Field label="Which week is it this week?" hint={`The week beginning ${formatShort(startOfWeek(today.value, 1))}.`}>
              <SelectField options={form.patternWeeks.map((_, i) => ({ value: i, label: `Week ${i + 1}` }))} value={form.thisWeek} onChange={(v) => set('thisWeek')(Number(v))} />
            </Field>
            {form.patternWeeks.length === 2 ? (
              <Field label="Quick fill" hint="Mon to Fri one week, Wed to Sun the next.">
                <Button variant="secondary" icon="calendar" onClick={() => set('patternWeeks')(ALTERNATE_WEEKENDS.map((w) => [...w]))}>Alternate weekends</Button>
              </Field>
            ) : null}
          </div>
        </div>
      )}

      <div class="grid grid-2">
        <Field label={<>Holiday entitlement <HelpTip text="The number of days' holiday they get in a full holiday year. Half days are fine (for example 22.5)." /></>} required error={errors.entitlementDays} hint="Days per full holiday year.">
          <NumberField value={form.entitlementDays} onChange={set('entitlementDays')} min={0} max={365} step={0.5} suffix="days" />
        </Field>
        <Field label="Colour" hint="Used for their chips on the calendar.">
          <ColourPicker value={form.colour || undefined} onChange={set('colour')} />
        </Field>
        <Field label="Phone">
          <TextField value={form.phone} onChange={set('phone')} type="tel" placeholder="Optional" />
        </Field>
        <Field label="Email" error={errors.email}>
          <TextField value={form.email} onChange={set('email')} type="email" placeholder="Optional" />
        </Field>
      </div>

      <Field label="Must not be off at the same time as" hint="We’ll warn you if these carers are booked off together.">
        <MultiSelect options={others} value={form.mustNotBeOffWith} onChange={set('mustNotBeOffWith')} placeholder="Nobody – no rules" itemNoun="carer" />
      </Field>

      <Field label="Notes">
        <TextArea value={form.notes} onChange={set('notes')} rows={2} placeholder="Anything useful to remember" />
      </Field>

      <div class="modal-actions">
        <Button variant="ghost" onClick={() => close(undefined)}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save}>{existing ? 'Save changes' : 'Add carer'}</Button>
      </div>
    </div>
  );
}
