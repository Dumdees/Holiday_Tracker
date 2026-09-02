// Tabs. <Tabs tabs={[{ id: 'add', label: 'Add holidays', icon: 'calendar-plus' }]} value={tab} onChange={setTab} />
import { useId } from 'preact/hooks';
import { Icon } from './Icon.jsx';

/**
 * Tabs – a tablist with arrow-key navigation (Left/Right/Home/End move and select).
 * @param {object} props
 * @param {Array<{ id: string, label: any, icon?: string, count?: number }>} props.tabs
 * @param {string} props.value – id of the selected tab
 * @param {(id: string) => void} [props.onChange]
 * @param {'segmented'|'underline'} [props.variant='segmented']
 * @param {string} [props.ariaLabel='Sections']
 * @param {string} [props.id] – when given, tabs point at `<id>-panel-<tab id>` (see TabPanel)
 * @param {string} [props.class]
 */
export function Tabs({ tabs = [], value, onChange, variant = 'segmented', ariaLabel = 'Sections', id, class: cls = '' }) {
  const generated = useId();
  const base = id || `tabs-${generated}`;
  const onKey = (e, i) => {
    const n = tabs.length;
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next == null) return;
    e.preventDefault();
    onChange?.(tabs[next].id);
    e.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return (
    <div class={`tabs tabs-${variant} ${cls}`.trim()} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active}
            aria-controls={id ? `${base}-panel-${t.id}` : undefined}
            tabIndex={active ? 0 : -1}
            class={`tab ${active ? 'is-active' : ''}`.trim()}
            onClick={() => onChange?.(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.icon ? <Icon name={t.icon} /> : null}
            <span class="tab-label">{t.label}</span>
            {t.count != null ? <span class="tab-count">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * TabPanel – the content for one tab, wired to <Tabs id={tabsId}>.
 * @param {{ tabsId: string, id: string, children?: any, class?: string }} props
 */
export function TabPanel({ tabsId, id, children, class: cls = '' }) {
  return (
    <div role="tabpanel" id={`${tabsId}-panel-${id}`} aria-labelledby={`${tabsId}-tab-${id}`} class={`tab-panel ${cls}`.trim()} tabIndex={-1}>
      {children}
    </div>
  );
}
