// Add or edit ONE holiday, with live day counts and plain-English clash warnings.
import { useState, useMemo } from 'preact/hooks';
import { openModal, confirm } from '../components/Modal.jsx';
import { Field, DateField, SelectField, TextArea, RadioCards } from '../components/Field.jsx';
import { Button } from '../components/Button.jsx';
import { Banner } from '../components/Banner.jsx';
import { toast } from '../components/Toast.jsx';
import { db, carers, teams, leaveTypes, leaveTypesById, carersById, holidays, addHolidays, updateHoliday, removeHolidays, carerName } from '../../store/store.js';
import { ctx } from '../shared/context.js';
import { today } from '../shared/today.js';
import { findClashes } from '../../core/clashes.js';
import { leaveDaysBreakdown } from '../../core/leaveDays.js';
import { formatDays } from '../../core/entitlement.js';
import { remainingAfter } from '../shared/usage.js';
import { formatRange, isValidISO } from '../../core/dates.js';
import { leaveTypeOptions } from '../shared/options.js';
import { daysLabel } from '../shared/bits.jsx';

/**
 * Open the holiday dialog.
 * - Edit: openHolidayDialog({ holidayId })
 * - Add:  openHolidayDialog({ carerId?, start?, end?, typeId?, status? })
 * Resolves with 'saved', 'deleted' or undefined (cancelled).
 */
export function openHolidayDialog(opts = {}) {
  return openModal(({ close }) => <HolidayForm {...opts} close={close} />, {
    size: 'md',
    title: opts.holidayId ? 'Edit holiday' : 'Add a holiday',
  });
}

const STATUS_OPTIONS = [
  { value: 'approved', label: 'Approved', description: 'Confirmed and counted.', icon: 'check-circle' },
  { value: 'pending', label: 'Awaiting approval', description: 'Requested, not yet agreed.', icon: 'clock' },
];
const HALF_OPTIONS = [
  { value: '', label: 'Whole day' },
  { value: 'am', label: 'Morning only' },
  { value: 'pm', label: 'Afternoon only' },
];

function carerSelectOptions(includeId) {
  const groups = new Map();
  const teamName = new Map(teams.value.map((t) => [t.id, t.name]));
  const list = carers.value.filter((c) => c.active || c.id === includeId);
  for (const c of list) {
    const g = (c.teamId && teamName.get(c.teamId)) || 'No team';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ value: c.id, label: `${carerName(c)}${c.active ? '' : ' (archived)'}` });
  }
  const order = [...teams.value.map((t) => t.name), 'No team'];
  return order.filter((g) => groups.has(g)).map((g) => ({ group: g, options: groups.get(g).sort((a, b) => a.label.localeCompare(b.label)) }));
}

function HolidayForm({ holidayId = null, carerId = '', start = '', end = '', typeId = 'lt_annual', status = 'approved', close }) {
  const existing = holidayId ? holidays.value.find((h) => h.id === holidayId) : null;
  const [form, setForm] = useState(() => ({
    carerId: existing?.carerId ?? carerId ?? '',
    typeId: existing?.typeId ?? typeId ?? 'lt_annual',
    start: existing?.start ?? start ?? '',
    end: existing?.end ?? (end || start) ?? '',
    halfDay: existing?.halfDay ?? null,
    status: existing?.status ?? status ?? 'approved',
    notes: existing?.notes ?? '',
  }));
  const [errors, setErrors] = useState({});
  const set = (key) => (value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'start' && value && (!next.end || next.end < value)) next.end = value;
      if (key === 'end' && value && next.start && value < next.start) next.start = value;
      if (next.start !== next.end) next.halfDay = null;
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const carer = carersById.value.get(form.carerId);
  const typeOpts = leaveTypeOptions(leaveTypes.value, { includeArchived: false });
  if (form.typeId && !typeOpts.some((o) => o.value === form.typeId)) {
    const t = leaveTypesById.value.get(form.typeId);
    if (t) typeOpts.push({ value: t.id, label: t.name });
  }
  const statusOpts = existing?.status === 'declined' || form.status === 'declined'
    ? [...STATUS_OPTIONS, { value: 'declined', label: 'Declined', description: 'Turned down – not counted.', icon: 'x' }]
    : STATUS_OPTIONS;

  const ready = carer && isValidISO(form.start) && isValidISO(form.end) && form.end >= form.start;

  const analysis = useMemo(() => {
    if (!ready) return null;
    const proposed = { carerId: form.carerId, start: form.start, end: form.end, typeId: form.typeId, status: form.status, halfDay: form.halfDay };
    const breakdown = leaveDaysBreakdown(proposed, carer, ctx.value);
    const clashes = findClashes(proposed, db.value, ctx.value, { ignoreHolidayIds: holidayId ? [holidayId] : [], today: today.value });
    const deducts = leaveTypesById.value.get(form.typeId)?.deductsEntitlement === true;
    const afterByYear = remainingAfter(carer, proposed, { ignoreHolidayIds: holidayId ? [holidayId] : [] });
    return { breakdown, clashes, deducts, afterByYear };
  }, [ready, form.carerId, form.start, form.end, form.typeId, form.status, form.halfDay, holidayId, db.value, today.value]);

  const blocked = analysis?.clashes.some((c) => c.severity === 'block');
  const warnings = analysis?.clashes.filter((c) => c.severity === 'warn') || [];
  const blocks = analysis?.clashes.filter((c) => c.severity === 'block') || [];

  function validate() {
    const e = {};
    if (!form.carerId) e.carerId = 'Choose who this holiday is for.';
    if (!isValidISO(form.start)) e.start = 'Choose the first day.';
    if (!isValidISO(form.end)) e.end = 'Choose the last day.';
    if (!form.typeId) e.typeId = 'Choose the type of leave.';
    return e;
  }

  function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length || blocked) return;
    const data = { carerId: form.carerId, start: form.start, end: form.end, typeId: form.typeId, status: form.status, halfDay: form.start === form.end ? form.halfDay || null : null, notes: form.notes.trim() };
    if (existing) {
      updateHoliday(existing.id, data);
      toast(`Holiday updated for ${carerName(carer)}`);
    } else {
      addHolidays([data]);
      toast(`Holiday added for ${carerName(carer)}`);
    }
    close('saved');
  }

  async function remove() {
    const ok = await confirm({ title: 'Remove this holiday?', message: `${carerName(carer)} · ${formatRange(form.start, form.end)}. You can undo this straight afterwards.`, confirmLabel: 'Remove holiday', danger: true, icon: 'trash' });
    if (!ok) return;
    removeHolidays([existing.id]);
    toast(`Holiday removed for ${carerName(carer)}`);
    close('deleted');
  }

  return (
    <div class="holiday-form stack">
      <Field label="Who" required error={errors.carerId}>
        <SelectField options={carerSelectOptions(existing?.carerId)} value={form.carerId} onChange={set('carerId')} placeholder="Choose a carer" />
      </Field>
      <div class="grid grid-2">
        <Field label="First day" required error={errors.start}>
          <DateField value={form.start} onChange={set('start')} />
        </Field>
        <Field label="Last day" required error={errors.end} hint="Same as the first day for a single day off.">
          <DateField value={form.end} onChange={set('end')} min={form.start || undefined} />
        </Field>
      </div>
      {form.start && form.start === form.end ? (
        <Field label="How much of the day?">
          <SelectField options={HALF_OPTIONS} value={form.halfDay || ''} onChange={(v) => set('halfDay')(v || null)} />
        </Field>
      ) : null}
      <Field label="Type of leave" required error={errors.typeId}>
        <SelectField options={typeOpts} value={form.typeId} onChange={set('typeId')} />
      </Field>
      <Field label="Status">
        <RadioCards options={statusOpts} value={form.status} onChange={set('status')} columns={statusOpts.length} />
      </Field>
      <Field label="Notes">
        <TextArea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional – e.g. Wedding" />
      </Field>

      {analysis ? (
        <div class="holiday-summary">
          <div class="holiday-summary-main">
            <strong>Uses {daysLabel(analysis.breakdown.days)}</strong>
            <span class="soft"> · {formatRange(form.start, form.end)}</span>
            {analysis.breakdown.skipped.length ? (
              <div class="muted small">
                Doesn’t count {describeSkipped(analysis.breakdown.skipped)}.
              </div>
            ) : null}
          </div>
          {analysis.afterByYear.map((y) => (
            <div key={y.label} class={`holiday-summary-after ${y.after < 0 ? 'negative' : ''}`}>
              {carer.firstName} will have <strong>{formatDays(y.after)}</strong> {Math.abs(y.after) === 1 ? 'day' : 'days'} left in {y.label}
              <span class="muted"> (currently {formatDays(y.before)})</span>
            </div>
          ))}
          {!analysis.deducts ? <div class="muted small">This type of leave doesn’t use up holiday entitlement.</div> : null}
        </div>
      ) : null}

      {blocks.map((c, i) => (
        <Banner key={'b' + i} tone="danger" title="This can’t be added">{c.message}</Banner>
      ))}
      {warnings.length ? (
        <Banner tone="warning" title={warnings.length === 1 ? 'Something to check' : `${warnings.length} things to check`}>
          <ul class="clash-list">{warnings.map((c, i) => <li key={i}>{c.message}{c.details ? <span class="muted"> – {c.details}</span> : null}</li>)}</ul>
        </Banner>
      ) : null}

      <div class="modal-actions">
        {existing ? <Button variant="danger" icon="trash" onClick={remove}>Remove</Button> : null}
        <span class="spacer" />
        <Button variant="ghost" onClick={() => close(undefined)}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save} disabled={blocked}>
          {existing ? 'Save changes' : warnings.length ? 'Add anyway' : 'Add holiday'}
        </Button>
      </div>
    </div>
  );
}

function describeSkipped(skipped) {
  const nonWorking = skipped.filter((s) => s.reason === 'non-working').length;
  const bank = skipped.filter((s) => s.reason === 'bank-holiday').length;
  const parts = [];
  if (nonWorking) parts.push(`${nonWorking} non-working ${nonWorking === 1 ? 'day' : 'days'}`);
  if (bank) parts.push(`${bank} bank ${bank === 1 ? 'holiday' : 'holidays'}`);
  return parts.join(' and ');
}
