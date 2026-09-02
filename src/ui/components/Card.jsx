// White panels with a soft shadow. <Card title="Today" icon="sun" actions={<Button/>}>…</Card>
import { Icon } from './Icon.jsx';

const TONES = new Set(['peach', 'sage', 'sky', 'amber', 'rose', 'plum']);

/**
 * Card – a rounded white panel with an optional header (icon, title, subtitle, actions) and footer.
 * @param {object} props
 * @param {any} [props.title]
 * @param {any} [props.subtitle]
 * @param {any} [props.actions] – node placed at the right of the header (buttons, badges)
 * @param {string} [props.icon] – icon name shown in a soft square before the title
 * @param {boolean} [props.padded=true] – false for flush content such as tables and lists
 * @param {'default'|'peach'|'sage'|'sky'|'amber'|'rose'|'plum'} [props.tone='default'] – tinted background
 * @param {string} [props.class]
 * @param {(e: Event) => void} [props.onClick] – makes the whole card clickable (keyboard friendly)
 * @param {any} [props.footer]
 * @param {any} [props.children]
 */
export function Card({ title, subtitle, actions, icon, padded = true, tone = 'default', class: cls = '', onClick, footer, children, ...rest }) {
  const classes = ['card', TONES.has(tone) ? `card-${tone}` : '', padded ? '' : 'card-flush', onClick ? 'card-clickable' : '', cls].filter(Boolean).join(' ');
  const hasHead = Boolean(title || subtitle || actions || icon);
  const interactive = onClick ? {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(e); } },
  } : {};
  return (
    <div class={classes} {...interactive} {...rest}>
      {hasHead ? (
        <div class="card-head">
          {icon ? <div class="card-icon" aria-hidden="true"><Icon name={icon} /></div> : null}
          {title || subtitle ? (
            <div class="card-head-text">
              {title ? <h3 class="card-title">{title}</h3> : null}
              {subtitle ? <p class="card-subtitle">{subtitle}</p> : null}
            </div>
          ) : null}
          {actions ? <div class="card-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div class="card-body">{children}</div>
      {footer ? <div class="card-foot">{footer}</div> : null}
    </div>
  );
}

/**
 * CardSection – a titled block inside a flush card (`padded={false}`), separated by a thin line.
 * @param {{ title?: any, children?: any, class?: string }} props
 */
export function CardSection({ title, children, class: cls = '' }) {
  return (
    <section class={`card-section ${cls}`.trim()}>
      {title ? <h4 class="card-section-title">{title}</h4> : null}
      {children}
    </section>
  );
}
