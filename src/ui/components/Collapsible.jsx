// A section that folds away (details/summary), e.g. "Advanced" in Settings.
import { Icon } from './Icon.jsx';

/**
 * Collapsible
 * @param {object} props
 * @param {any} props.title
 * @param {any} [props.summary] – small grey text at the right of the title
 * @param {boolean} [props.open] – initially open (the user can still toggle it)
 * @param {any} [props.children]
 * @param {string} [props.icon]
 * @param {(open: boolean) => void} [props.onToggle]
 * @param {string} [props.class]
 */
export function Collapsible({ title, summary, open, children, icon, onToggle, class: cls = '' }) {
  return (
    <details class={`collapsible ${cls}`.trim()} open={open} onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined}>
      <summary class="collapsible-summary">
        <Icon name="chevron-right" className="collapsible-chevron" />
        {icon ? <Icon name={icon} className="collapsible-icon" /> : null}
        <span class="collapsible-title">{title}</span>
        {summary ? <span class="collapsible-hint">{summary}</span> : null}
      </summary>
      <div class="collapsible-body">{children}</div>
    </details>
  );
}
