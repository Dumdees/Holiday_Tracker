// Entitlement bars and rings: taken / booked / awaiting / remaining.

/** Days shown without trailing noise: 12 → "12", 2.5 → "2.5". */
function formatDays(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/**
 * Widths (%) for each segment over `total`, clamped so the bar never overflows.
 * @param {Array<{ value: number }>} segments
 * @param {number} total – falls back to the sum of the segments when missing or zero
 * @returns {number[]}
 */
export function segmentWidths(segments, total) {
  const sum = segments.reduce((a, s) => a + Math.max(0, Number(s.value) || 0), 0);
  const denom = total > 0 ? total : sum > 0 ? sum : 1;
  let used = 0;
  return segments.map((s) => {
    const v = Math.max(0, Number(s.value) || 0);
    const pct = Math.max(0, Math.min(100 - used, (v / denom) * 100));
    used += pct;
    return pct;
  });
}

/**
 * ProgressBar – a stacked bar of coloured segments.
 * @param {object} props
 * @param {Array<{ value: number, colour?: string, label?: string }>} [props.segments]
 * @param {number} [props.total] – the full width; segments beyond it are clamped
 * @param {number} [props.height=12]
 * @param {boolean} [props.showLegend] – list the segments beneath the bar
 * @param {string} [props.ariaLabel='Progress']
 * @param {string} [props.class]
 */
export function ProgressBar({ segments = [], total, height = 12, showLegend = false, ariaLabel = 'Progress', class: cls = '' }) {
  const widths = segmentWidths(segments, total);
  const summary = segments.map((s) => `${s.label || 'Part'} ${formatDays(s.value)}`).join(', ');
  return (
    <div class={`progress ${cls}`.trim()}>
      <div class="progress-track" style={{ height: `${height}px` }} role="img" aria-label={`${ariaLabel}: ${summary}${total > 0 ? ` of ${formatDays(total)}` : ''}`}>
        {segments.map((s, i) => (widths[i] > 0
          ? <div key={i} class="progress-seg" style={{ width: `${widths[i]}%`, background: s.colour || 'var(--peach-500)' }} title={`${s.label || ''} ${formatDays(s.value)}`.trim()} />
          : null))}
      </div>
      {showLegend ? (
        <ul class="progress-legend">
          {segments.map((s, i) => (
            <li key={i}>
              <span class="legend-dot" style={{ background: s.colour || 'var(--peach-500)' }} aria-hidden="true" />
              <span>{s.label}</span>
              <strong>{formatDays(s.value)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Font size (px) so that `text` fits across `room` px – SVG text cannot wrap. Nodes keep `base`.
 * @param {any} text
 * @param {number} base – the size wanted when there is room
 * @param {number} room – usable width inside the ring
 * @returns {number}
 */
function fitText(text, base, room) {
  if (typeof text !== 'string' && typeof text !== 'number') return base;
  const chars = Math.max(1, String(text).length);
  return Math.max(8, Math.min(base, Math.floor((room - 6) / (chars * 0.6))));
}

/**
 * ProgressRing – an SVG ring with a number in the middle.
 * @param {object} props
 * @param {number} [props.value=0]
 * @param {number} [props.total=1]
 * @param {number} [props.size=72] – diameter in px
 * @param {number} [props.stroke=8] – ring thickness in px
 * @param {string} [props.colour='var(--peach-500)']
 * @param {any} [props.label] – centre text (defaults to the value)
 * @param {any} [props.sublabel] – small text under the label, e.g. "left"
 * @param {string} [props.trackColour]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.class]
 */
export function ProgressRing({ value = 0, total = 1, size = 72, stroke = 8, colour = 'var(--peach-500)', label, sublabel, trackColour, ariaLabel, class: cls = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.max(0, Math.min(1, (Number(value) || 0) / total)) : 0;
  const half = size / 2;
  const labelText = label ?? formatDays(value);
  const labelSize = fitText(labelText, Math.round(size * (sublabel ? 0.24 : 0.28)), size - stroke * 2);
  const subSize = fitText(sublabel, Math.round(size * 0.14), size - stroke * 2);
  return (
    <svg class={`progress-ring ${cls}`.trim()} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel || `${formatDays(value)} of ${formatDays(total)}`}>
      <circle class="progress-ring-track" cx={half} cy={half} r={r} stroke-width={stroke} style={trackColour ? { stroke: trackColour } : undefined} />
      <circle class="progress-ring-value" cx={half} cy={half} r={r} stroke-width={stroke} stroke={colour} stroke-dasharray={c} stroke-dashoffset={c * (1 - fraction)} transform={`rotate(-90 ${half} ${half})`} />
      <text class="progress-ring-label" x={half} y={sublabel ? half - subSize * 0.55 : half} text-anchor="middle" dominant-baseline="central" font-size={labelSize}>{labelText}</text>
      {sublabel ? <text class="progress-ring-sub" x={half} y={half + labelSize * 0.6} text-anchor="middle" dominant-baseline="central" font-size={subSize}>{sublabel}</text> : null}
    </svg>
  );
}
