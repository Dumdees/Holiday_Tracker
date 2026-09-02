// Small shared pieces used across views: carer names that link to profiles, type dots, day counts.
import { navigate } from '../../app/router.js';
import { carersById, leaveTypesById, carerName } from '../../store/store.js';
import { formatDays } from '../../core/entitlement.js';
import { Avatar } from '../components/Avatar.jsx';

/** A carer's name as a link to their profile (or plain text when link is false). */
export function CarerName({ carer, id, link = true, avatar = false, size = 28, class: cls = '' }) {
  const c = carer || (id ? carersById.value.get(id) : null);
  const name = c ? carerName(c) : 'Unknown carer';
  const inner = (
    <>
      {avatar && c ? <Avatar name={name} colour={c.colour} size={size} /> : null}
      <span class="carer-name-text">{name}</span>
    </>
  );
  if (!link || !c) return <span class={`carer-name ${cls}`.trim()}>{inner}</span>;
  return (
    <button type="button" class={`carer-name carer-link ${cls}`.trim()} onClick={(e) => { e.stopPropagation(); navigate('carers', { id: c.id }); }} title="Open profile">
      {inner}
    </button>
  );
}

/** Coloured dot + name for a leave type. */
export function LeaveTypeTag({ typeId, small = false }) {
  const t = leaveTypesById.value.get(typeId);
  return (
    <span class={`type-tag ${small ? 'type-tag-sm' : ''}`.trim()}>
      <span class="type-dot" style={{ background: t?.colour || '#9C8A82' }} />
      {t?.name || 'Leave'}
    </span>
  );
}

/** "3 days", "0.5 day", "1 day". */
export function DaysText({ days, class: cls = '' }) {
  return <span class={cls}>{daysLabel(days)}</span>;
}

/** "3 days", "1 day", "half a day", "2.5 days". */
export function daysLabel(days) {
  const n = Number(days) || 0;
  if (n === 0.5) return 'half a day';
  return `${formatDays(n)} ${n === 1 ? 'day' : 'days'}`;
}

/** 'Morning only' / 'Afternoon only' / '' */
export function halfDayLabel(halfDay) {
  return halfDay === 'am' ? 'Morning only' : halfDay === 'pm' ? 'Afternoon only' : '';
}
