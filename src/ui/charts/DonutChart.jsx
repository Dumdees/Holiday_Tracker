// A ring showing how a total splits up – leave by type on the Reports screen.
import { useRef, useState } from 'preact/hooks';
import { fmtDays, fmtPercent, fitLabel, sum } from './format.js';
import { Legend } from './Legend.jsx';
import { svgToWrapper, px, clamp, ChartTooltip } from './common.jsx';

const GAP = 2; // surface gap between segments, in pixels along the ring

/**
 * DonutChart
 * @param {object} props
 * @param {Array<{ label: string, value: number, colour: string }>} props.segments – drawn in order; zero values stay in the legend only
 * @param {number} [props.size=200] – diameter in pixels
 * @param {number} [props.thickness=26] – ring thickness in pixels
 * @param {any} [props.centreLabel] – big text in the middle (defaults to the formatted total)
 * @param {any} [props.centreSub] – small text under it, e.g. 'days'
 * @param {boolean} [props.showLegend=true] – legend with values and percentages beside the ring
 * @param {(n: number) => string} [props.valueFormat=fmtDays]
 * @param {string} [props.valueLabel='Days'] – what the values are, for the tooltip
 * @param {string} [props.ariaLabel] – summary for screen readers (generated if omitted)
 * @param {string} [props.emptyText='Nothing to show yet'] – shown under an empty ring when the total is 0
 * @param {string} [props.class]
 */
export function DonutChart({ segments = [], size = 200, thickness = 26, centreLabel, centreSub, showLegend = true, valueFormat = fmtDays, valueLabel = 'Days', ariaLabel, emptyText = 'Nothing to show yet', class: cls = '' }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);
  const [tip, setTip] = useState(null);

  const items = segments.map((s) => ({ label: String(s.label ?? ''), colour: s.colour, value: Math.max(0, Number(s.value) || 0) }));
  const total = sum(items.map((s) => s.value));
  const c = size / 2;
  const r = Math.max(10, (size - thickness) / 2 - 3); // 3px of air so the hovered segment can grow
  const circ = 2 * Math.PI * r;
  const gap = items.filter((s) => s.value > 0).length > 1 ? GAP : 0;

  let acc = 0;
  const arcs = items.map((s, i) => {
    const len = total > 0 ? (s.value / total) * circ : 0;
    const arc = { ...s, i, start: acc, len };
    acc += len;
    return arc;
  });

  const inner = 2 * r - thickness; // diameter of the hole
  const mainText = centreLabel != null ? String(centreLabel) : valueFormat(total);
  const mainSize = clamp(Math.floor((inner - 24) / (0.6 * Math.max(1, mainText.length))), 12, 26);
  const subText = centreSub != null ? fitLabel(String(centreSub), inner - 20, 12) : '';
  const mainY = subText ? c + mainSize * 0.35 - 7 : c + mainSize * 0.35;

  const activate = (i) => {
    setActive(i);
    const a = i == null ? null : arcs[i];
    if (!a || a.len <= 0) { setTip(null); return; }
    const angle = ((a.start + a.len / 2) / circ) * Math.PI * 2 - Math.PI / 2;
    const p = svgToWrapper(svgRef.current, wrapRef.current, c + Math.cos(angle) * r, c + Math.sin(angle) * r, size);
    setTip({
      x: p.x,
      y: p.y,
      title: a.label,
      rows: [
        { label: valueLabel, value: valueFormat(a.value), colour: a.colour },
        { label: 'Share', value: fmtPercent(a.value / total) },
      ],
      placement: 'above',
    });
  };

  const aria = ariaLabel || (total > 0
    ? `Doughnut chart. ${items.map((s) => `${s.label} ${valueFormat(s.value)} (${fmtPercent(s.value / total)})`).join(', ')}`
    : `Doughnut chart. ${emptyText}`);

  return (
    <div ref={wrapRef} class={`chart chart-donut ${total > 0 ? '' : 'is-empty'} ${cls}`.trim()}>
      <div class="chart-donut-figure">
        <svg ref={svgRef} class="chart-svg chart-donut-svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={aria} onPointerLeave={() => activate(null)}>
          {total <= 0 ? <circle class="chart-donut-track" cx={c} cy={c} r={r} fill="none" stroke-width={thickness} /> : null}
          {arcs.filter((a) => a.len > gap).map((a) => (
            <circle
              key={a.i}
              class={`chart-donut-seg ${active != null && active !== a.i ? 'is-muted' : ''}`.trim()}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={a.colour}
              stroke-width={active === a.i ? thickness + 4 : thickness}
              stroke-dasharray={`${px(a.len - gap)} ${px(circ)}`}
              stroke-dashoffset={px(-(a.start + gap / 2))}
              transform={`rotate(-90 ${c} ${c})`}
              onPointerEnter={() => activate(a.i)}
            >
              <title>{`${a.label}: ${valueFormat(a.value)} (${fmtPercent(a.value / total)})`}</title>
            </circle>
          ))}
          <text class={`chart-donut-centre ${total > 0 ? '' : 'is-empty'}`.trim()} x={c} y={px(mainY)} text-anchor="middle" font-size={mainSize}>{mainText}</text>
          {subText ? <text class="chart-donut-centre-sub" x={c} y={px(mainY + 16)} text-anchor="middle">{subText}</text> : null}
        </svg>
        {total <= 0 ? <p class="chart-donut-empty">{emptyText}</p> : null}
      </div>
      {showLegend && total > 0 ? (
        <Legend
          stacked
          items={items.map((s) => ({ label: s.label, colour: s.colour, value: valueFormat(s.value), sub: fmtPercent(s.value / total) }))}
          activeIndex={active}
          onActivate={activate}
        />
      ) : null}
      <ChartTooltip tip={tip} />
    </div>
  );
}
