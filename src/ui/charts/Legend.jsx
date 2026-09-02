// A row of colour keys with labels (and optional values) shown under or beside a chart.

/**
 * Legend
 * @param {object} props
 * @param {Array<{ label: any, colour: string, value?: any, sub?: any }>} props.items
 * @param {boolean} [props.compact=false] – smaller text and tighter spacing (under a chart)
 * @param {'rect'|'line'|'dot'} [props.shape='rect'] – key shape: rect for bars/areas, line for lines
 * @param {number|null} [props.activeIndex=null] – highlight one item and soften the rest
 * @param {(index: number|null) => void} [props.onActivate] – called on hover/focus (null when leaving)
 * @param {boolean} [props.stacked=false] – one item per line (used beside a donut)
 * @param {string} [props.class]
 */
export function Legend({ items = [], compact = false, shape = 'rect', activeIndex = null, onActivate, stacked = false, class: cls = '' }) {
  if (!items.length) return null;
  const interactive = typeof onActivate === 'function';
  const classes = ['chart-legend', compact ? 'is-compact' : '', stacked ? 'is-stacked' : '', interactive ? 'is-interactive' : '', cls].filter(Boolean).join(' ');
  return (
    <ul class={classes}>
      {items.map((it, i) => {
        const muted = activeIndex != null && activeIndex !== i;
        const active = activeIndex === i;
        const props = interactive ? {
          onPointerEnter: () => onActivate(i),
          onPointerLeave: () => onActivate(null),
          onFocus: () => onActivate(i),
          onBlur: () => onActivate(null),
          tabIndex: 0,
        } : {};
        return (
          <li class={`chart-legend-item ${muted ? 'is-muted' : ''} ${active ? 'is-active' : ''}`.trim()} key={i} {...props}>
            <i class={`chart-legend-key key-${shape}`} style={{ background: it.colour }} aria-hidden="true" />
            <span class="chart-legend-label">{it.label}</span>
            {it.value != null ? <span class="chart-legend-value">{it.value}</span> : null}
            {it.sub != null ? <span class="chart-legend-sub">{it.sub}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
