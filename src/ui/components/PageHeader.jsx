// The heading at the top of every section: title, one-line lede, actions on the right.
import { Icon } from './Icon.jsx';

/**
 * PageHeader – produces the `.page-head` layout from layout.css.
 * @param {object} props
 * @param {any} props.title
 * @param {any} [props.lede] – one calm sentence under the title
 * @param {any} [props.actions] – buttons shown on the right
 * @param {{ label?: string, onClick: () => void }} [props.back] – a "← Back" link above the title
 * @param {any} [props.children] – extra content under the lede (filters, tabs)
 */
export function PageHeader({ title, lede, actions, back, children }) {
  return (
    <div class="page-head">
      <div class="page-head-text">
        {back ? (
          <button type="button" class="page-back" onClick={back.onClick}>
            <Icon name="arrow-left" />
            <span>{back.label || 'Back'}</span>
          </button>
        ) : null}
        <h1>{title}</h1>
        {lede ? <p class="lede">{lede}</p> : null}
        {children}
      </div>
      {actions ? <div class="page-actions">{actions}</div> : null}
    </div>
  );
}
