// "Nothing here yet" – an icon, one sentence and a button.
import { Icon } from './Icon.jsx';
import { Button } from './Button.jsx';

/**
 * EmptyState
 * @param {object} props
 * @param {string} [props.icon='sparkle']
 * @param {any} [props.title]
 * @param {any} [props.message] – one friendly sentence
 * @param {{ label: string, onClick: () => void, icon?: string }} [props.action]
 * @param {boolean} [props.compact] – smaller padding, for inside cards and tables
 * @param {string} [props.class]
 * @param {any} [props.children] – extra content under the button
 */
export function EmptyState({ icon = 'sparkle', title, message, action, compact = false, class: cls = '', children }) {
  return (
    <div class={`empty-state ${compact ? 'empty-compact' : ''} ${cls}`.trim()}>
      <div class="empty-icon" aria-hidden="true"><Icon name={icon} /></div>
      {title ? <h3 class="empty-title">{title}</h3> : null}
      {message ? <p class="empty-message">{message}</p> : null}
      {action ? <Button variant="primary" size={compact ? 'sm' : 'md'} icon={action.icon} onClick={action.onClick}>{action.label}</Button> : null}
      {children}
    </div>
  );
}
