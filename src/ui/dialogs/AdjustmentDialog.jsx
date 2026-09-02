// "Adjust entitlement" – give or take days for one holiday year, with a reason.
import { useState } from 'preact/hooks';
import { openModal } from '../components/Modal.jsx';
import { Field, NumberField, TextField } from '../components/Field.jsx';
import { YearPicker } from '../components/YearPicker.jsx';
import { Button } from '../components/Button.jsx';
import { Chip } from '../components/Badge.jsx';
import { toast } from '../components/Toast.jsx';
import { settings, carersById, carerName, addAdjustment } from '../../store/store.js';
import { currentYear } from '../shared/context.js';
import { today } from '../shared/today.js';
import { formatDays } from '../../core/entitlement.js';

const QUICK_REASONS = ['Carried over from last year', 'Extra days awarded', 'Long service', 'Bought extra days', 'Correction'];

/**
 * Open the dialog. Resolves with the new adjustment id, or undefined if cancelled.
 * @param {{ carerId: string, yearKey?: string }} opts
 */
export function openAdjustmentDialog({ carerId, yearKey }) {
  return openModal(({ close }) => <AdjustmentForm carerId={carerId} yearKey={yearKey} close={close} />, { size: 'sm', title: 'Adjust entitlement' });
}

function AdjustmentForm({ carerId, yearKey, close }) {
  const carer = carersById.value.get(carerId);
  const [year, setYear] = useState(yearKey || currentYear.value.key);
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  if (!carer) return <p>That carer no longer exists.</p>;

  function save() {
    if (!days || Number.isNaN(Number(days))) { setError('Enter how many days to add or take away.'); return; }
    if (!reason.trim()) { setError('Please give a short reason – it shows on the carer’s record.'); return; }
    const id = addAdjustment(carerId, { yearKey: year, days: Number(days), reason: reason.trim() });
    toast(`${formatDays(Math.abs(days))} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days > 0 ? 'added to' : 'taken from'} ${carerName(carer)}`);
    close(id);
  }

  return (
    <div class="stack">
      <p class="soft">Give {carer.firstName} extra days, or take some away, for one holiday year. This is added on top of their usual entitlement.</p>
      <Field label="Holiday year">
        <YearPicker value={year} onChange={setYear} settings={settings.value} today={today.value} />
      </Field>
      <Field label="Days to add" hint="Use a minus number to take days away, e.g. −2." error={error && !days ? error : ''}>
        <NumberField value={days} onChange={(v) => { setDays(v); setError(''); }} step={0.5} min={-100} max={100} suffix="days" />
      </Field>
      <Field label="Reason" required error={error && days ? error : ''}>
        <TextField value={reason} onChange={(v) => { setReason(v); setError(''); }} placeholder="e.g. Carried over from last year" onEnter={save} />
      </Field>
      <div class="row">
        {QUICK_REASONS.map((r) => <Chip key={r} label={r} small onClick={() => setReason(r)} />)}
      </div>
      <div class="modal-actions">
        <Button variant="ghost" onClick={() => close(undefined)}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save}>Save adjustment</Button>
      </div>
    </div>
  );
}
