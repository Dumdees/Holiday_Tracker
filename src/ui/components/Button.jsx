// Buttons. <Button variant="primary" icon="plus">Add holiday</Button> and <IconButton icon="x" label="Close" />
import { Icon } from './Icon.jsx';

function join(...parts) { return parts.filter(Boolean).join(' '); }

/**
 * Button – the standard clickable control. Says what it does ("Add holiday", never "Submit").
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'|'soft'|'link'} [props.variant='secondary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.icon] – icon name shown before the label
 * @param {string} [props.iconRight] – icon name shown after the label
 * @param {boolean} [props.loading] – shows a spinner and blocks clicks
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.full] – stretch to the full width of the container
 * @param {'button'|'submit'|'reset'} [props.type='button']
 * @param {(e: MouseEvent) => void} [props.onClick]
 * @param {string} [props.class] – extra class names
 * @param {string} [props.title]
 * @param {any} [props.children] – the label
 */
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, loading = false, disabled = false, full = false, type = 'button', onClick, class: cls = '', title, children, ...rest }) {
  const classes = join('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, full && 'btn-full', loading && 'btn-loading', cls);
  const hasLabel = children != null && children !== false && children !== '';
  return (
    <button type={type} class={classes} disabled={disabled || loading} aria-busy={loading || undefined} onClick={onClick} title={title} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {hasLabel ? <span class="btn-label">{children}</span> : null}
      {iconRight ? <Icon name={iconRight} /> : null}
    </button>
  );
}

/**
 * IconButton – a square button showing only an icon. `label` is required: it becomes the
 * accessible name and the tooltip.
 * @param {object} props
 * @param {string} props.icon
 * @param {string} props.label
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {'ghost'|'secondary'|'soft'|'primary'|'danger'} [props.variant='ghost']
 * @param {(e: MouseEvent) => void} [props.onClick]
 * @param {boolean} [props.disabled]
 * @param {string} [props.class]
 * @param {'button'|'submit'} [props.type='button']
 */
export function IconButton({ icon, label, size = 'md', variant = 'ghost', onClick, disabled = false, class: cls = '', type = 'button', ...rest }) {
  const classes = join('icon-btn', size !== 'md' && `icon-btn-${size}`, variant !== 'ghost' && `icon-btn-${variant}`, cls);
  return (
    <button type={type} class={classes} aria-label={label} title={label} onClick={onClick} disabled={disabled} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
