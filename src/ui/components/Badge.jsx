// Small labels. <Badge tone="sage" dot>Approved</Badge>, <Chip label="Priya" colour="#F58F5B" onRemove={…} />
import { Icon } from './Icon.jsx';

const TONES = new Set(['peach', 'sage', 'sky', 'amber', 'rose', 'plum', 'neutral']);

/**
 * Badge – a small rounded label for statuses and counts.
 * @param {object} props
 * @param {'peach'|'sage'|'sky'|'amber'|'rose'|'plum'|'neutral'} [props.tone='neutral']
 * @param {any} [props.children]
 * @param {boolean} [props.dot] – show a small dot before the text
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.icon] – icon name shown before the text
 * @param {string} [props.class]
 * @param {string} [props.title]
 */
export function Badge({ tone = 'neutral', children, dot = false, size = 'md', icon, class: cls = '', title }) {
  const classes = ['badge', tone !== 'neutral' && TONES.has(tone) ? `badge-${tone}` : '', size !== 'md' ? `badge-${size}` : '', cls].filter(Boolean).join(' ');
  return (
    <span class={classes} title={title}>
      {dot ? <span class="badge-dot" aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

/**
 * Chip – a pill naming a thing (a carer, a team), optionally removable and/or clickable.
 * @param {object} props
 * @param {any} props.label
 * @param {string} [props.colour] – colour dot shown before the label
 * @param {(e: Event) => void} [props.onRemove] – shows an × button
 * @param {string} [props.icon]
 * @param {boolean} [props.small]
 * @param {(e: Event) => void} [props.onClick]
 * @param {string} [props.class]
 * @param {string} [props.title]
 * @param {string} [props.removeLabel] – accessible name of the × button (default "Remove <label>")
 */
export function Chip({ label, colour, onRemove, icon, small = false, onClick, class: cls = '', title, removeLabel }) {
  const classes = ['chip', small ? 'chip-sm' : '', onClick ? 'chip-clickable' : '', cls].filter(Boolean).join(' ');
  const inner = (
    <>
      {colour ? <span class="chip-dot" style={{ '--dot': colour }} aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} /> : null}
      <span class="chip-label">{label}</span>
    </>
  );
  if (onClick && !onRemove) {
    return <button type="button" class={classes} onClick={onClick} title={title}>{inner}</button>;
  }
  const interactive = onClick ? {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(e); } },
  } : {};
  return (
    <span class={classes} title={title} {...interactive}>
      {inner}
      {onRemove ? (
        <button type="button" class="chip-remove" aria-label={removeLabel || `Remove ${typeof label === 'string' ? label : ''}`.trim()} onClick={(e) => { e.stopPropagation(); onRemove(e); }}>
          <Icon name="x" />
        </button>
      ) : null}
    </span>
  );
}
