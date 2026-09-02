// A big number with a label: "12 · Off this week".
import { Icon } from './Icon.jsx';

/**
 * StatTile
 * @param {object} props
 * @param {any} props.label
 * @param {any} props.value
 * @param {any} [props.hint] – small grey text under the label
 * @param {string} [props.icon]
 * @param {'default'|'peach'|'sage'|'sky'|'amber'|'rose'|'plum'} [props.tone='default']
 * @param {(e: Event) => void} [props.onClick] – renders as a button
 * @param {boolean} [props.small]
 * @param {string} [props.class]
 * @param {string} [props.title]
 */
export function StatTile({ label, value, hint, icon, tone = 'default', onClick, small = false, class: cls = '', title }) {
  const classes = ['stat-tile', tone !== 'default' ? `stat-${tone}` : '', small ? 'stat-sm' : '', onClick ? 'stat-clickable' : '', cls].filter(Boolean).join(' ');
  const inner = (
    <>
      {icon ? <div class="stat-icon" aria-hidden="true"><Icon name={icon} /></div> : null}
      <div class="stat-body">
        <div class="stat-value">{value}</div>
        <div class="stat-label">{label}</div>
        {hint ? <div class="stat-hint">{hint}</div> : null}
      </div>
    </>
  );
  return onClick
    ? <button type="button" class={classes} onClick={onClick} title={title}>{inner}</button>
    : <div class={classes} title={title}>{inner}</div>;
}
