// "Approved" / "Awaiting approval" / "Declined" as a coloured badge.
import { HOLIDAY_STATUSES } from '../../store/defaults.js';
import { Badge } from './Badge.jsx';

/** Badge tone for each holiday status. */
export const STATUS_TONES = { approved: 'sage', pending: 'amber', declined: 'neutral' };

/**
 * StatusBadge – shows a holiday's status using the labels from HOLIDAY_STATUSES.
 * @param {object} props
 * @param {'approved'|'pending'|'declined'} props.status
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.dot=true]
 * @param {string} [props.class]
 */
export function StatusBadge({ status, size = 'md', dot = true, class: cls = '' }) {
  const label = HOLIDAY_STATUSES.find((s) => s.id === status)?.label || 'Unknown';
  return <Badge tone={STATUS_TONES[status] || 'neutral'} size={size} dot={dot} class={cls}>{label}</Badge>;
}
