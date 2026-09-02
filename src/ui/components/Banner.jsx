// A gentle coloured notice: "It's been 9 days since your last backup".
import { Icon } from './Icon.jsx';
import { Button, IconButton } from './Button.jsx';

const ICONS = { info: 'info', warning: 'alert', danger: 'alert-circle', success: 'check-circle' };

/**
 * Banner
 * @param {object} props
 * @param {'info'|'warning'|'danger'|'success'} [props.tone='info']
 * @param {string} [props.icon] – overrides the tone's icon
 * @param {any} [props.title]
 * @param {any} [props.children] – the message
 * @param {{ label: string, onClick: () => void, icon?: string }} [props.action]
 * @param {() => void} [props.onDismiss] – shows an × button
 * @param {string} [props.class]
 */
export function Banner({ tone = 'info', icon, title, children, action, onDismiss, class: cls = '' }) {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  return (
    <div class={`banner banner-${tone} ${cls}`.trim()} role={role}>
      <div class="banner-icon" aria-hidden="true"><Icon name={icon || ICONS[tone] || 'info'} /></div>
      <div class="banner-body">
        {title ? <div class="banner-title">{title}</div> : null}
        {children ? <div class="banner-text">{children}</div> : null}
      </div>
      {action || onDismiss ? (
        <div class="banner-actions">
          {action ? <Button variant="soft" size="sm" icon={action.icon} onClick={action.onClick}>{action.label}</Button> : null}
          {onDismiss ? <IconButton icon="x" label="Dismiss" size="sm" onClick={onDismiss} /> : null}
        </div>
      ) : null}
    </div>
  );
}
