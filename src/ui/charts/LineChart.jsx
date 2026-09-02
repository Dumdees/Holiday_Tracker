// A line chart with straight segments, a soft area wash and a crosshair tooltip that
// reads every series at once. Used for sickness over time.
import { useRef, useState } from 'preact/hooks';
import { fmtDays, niceTicks, textWidth } from './format.js';
import { Legend } from './Legend.jsx';
import { useMeasuredWidth, svgToWrapper, pointerToSvg, px, clamp, ChartEmpty, ChartTooltip } from './common.jsx';

const PAD = { top: 14, right: 18, bottom: 6, left: 4 };
const AXIS_BAND = 22;
const MAX_DOTS = 40; // beyond this many points, dots only appear on hover

function val(item, key) {
  const v = Number(item?.values?.[key]);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * LineChart
 * @param {object} props
 * @param {Array<{ key: string, label: string, colour: string }>} props.series
 * @param {Array<{ label: string, values: Record<string, number> }>} props.data – one point per item, in order
 * @param {number} [props.height=220] – svg height, axis included
 * @param {boolean} [props.area=true] – soft fill under each line
 * @param {boolean} [props.showPoints=true] – dots on every point (hidden automatically past 40 points)
 * @param {(n: number) => string} [props.valueFormat=fmtDays]
 * @param {boolean} [props.showLegend=true] – the legend appears when there are two or more series
 * @param {number} [props.maxValue] – force the top of the value axis
 * @param {string} [props.ariaLabel] – summary for screen readers (generated if omitted)
 * @param {string} [props.emptyText='Nothing to show yet']
 * @param {string} [props.class]
 */
export function LineChart({ series = [], data = [], height = 220, area = true, showPoints = true, valueFormat = fmtDays, showLegend = true, maxValue, ariaLabel, emptyText = 'Nothing to show yet', class: cls = '' }) {
  const [wrapRef, width] = useMeasuredWidth(640);
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);

  if (!series.length || !data.length) {
    return <div class={`chart chart-line ${cls}`.trim()}><ChartEmpty text={emptyText} minHeight={Math.min(height, 200)} /></div>;
  }

  const n = data.length;
  const allMax = Math.max(0, ...data.flatMap((d) => series.map((s) => val(d, s.key))));
  const rawMax = Number(maxValue) > 0 ? Number(maxValue) : allMax;
  const ticks = niceTicks(rawMax, 4);
  const domainMax = ticks[ticks.length - 1];
  const tickLabels = ticks.map(valueFormat);

  const left = PAD.left + Math.max(...tickLabels.map((t) => textWidth(t))) + 10;
  const right = width - PAD.right;
  const plotW = Math.max(40, right - left);
  const top = PAD.top;
  const bottom = height - PAD.bottom - AXIS_BAND;
  const plotH = Math.max(40, bottom - top);
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i) => (n > 1 ? left + i * step : left + plotW / 2);
  const y = (v) => bottom - (v / domainMax) * plotH;

  const lines = series.map((s) => {
    const pts = data.map((d, i) => [px(x(i)), px(y(val(d, s.key)))]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
    const areaD = n > 1 ? `${line}L${pts[n - 1][0]},${px(bottom)}L${pts[0][0]},${px(bottom)}Z` : '';
    return { ...s, pts, line, areaD };
  });

  const labels = data.map((d) => String(d.label ?? ''));
  const maxLabelW = Math.max(...labels.map((l) => textWidth(l)));
  const every = n > 1 ? Math.max(1, Math.ceil((maxLabelW + 12) / step)) : 1;
  const anchorFor = (i) => {
    const half = textWidth(labels[i]) / 2;
    if (x(i) - half < 2) return 'start';
    if (x(i) + half > width - 2) return 'end';
    return 'middle';
  };
  const dots = showPoints && n <= MAX_DOTS;

  const aria = ariaLabel || `Line chart. ${series.map((s) => {
    const vals = data.map((d) => val(d, s.key));
    const hi = vals.indexOf(Math.max(...vals));
    return `${s.label}: ${valueFormat(vals[0])} in ${labels[0]} to ${valueFormat(vals[n - 1])} in ${labels[n - 1]}, highest ${valueFormat(vals[hi])} in ${labels[hi]}`;
  }).join('. ')}`;

  const onMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const p = pointerToSvg(e, svg, width, height);
    const i = n > 1 ? clamp(Math.round((p.x - left) / step), 0, n - 1) : 0;
    if (i !== active) setActive(i);
  };
  const onKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in moves) { e.preventDefault(); setActive(clamp((active ?? 0) + moves[e.key], 0, n - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'Escape') setActive(null);
  };
  const clear = () => setActive(null);

  let tip = null;
  if (active != null) {
    const p = svgToWrapper(svgRef.current, wrapRef.current, x(active), top, width);
    tip = { x: p.x, y: p.y, title: labels[active], rows: series.map((s) => ({ label: s.label, colour: s.colour, value: valueFormat(val(data[active], s.key)) })), placement: 'right' };
  }

  return (
    <div ref={wrapRef} class={`chart chart-line ${cls}`.trim()}>
      <svg ref={svgRef} class="chart-svg chart-line-svg" viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={aria} tabIndex={0} onKeyDown={onKey} onBlur={clear} onPointerLeave={clear}>
        {ticks.map((t, j) => <line key={`g${j}`} class={t === 0 ? 'chart-axis' : 'chart-grid'} x1={px(left)} y1={px(y(t))} x2={px(right)} y2={px(y(t))} />)}
        {ticks.map((t, j) => <text key={`t${j}`} class="chart-axis-text" x={px(left - 8)} y={px(y(t) + 4)} text-anchor="end">{tickLabels[j]}</text>)}
        {labels.map((l, i) => (i % every ? null : <text key={`x${i}`} class="chart-axis-text" x={px(x(i))} y={px(bottom + 18)} text-anchor={anchorFor(i)}>{l}</text>))}
        {active != null ? <line class="chart-crosshair" x1={px(x(active))} y1={px(top)} x2={px(x(active))} y2={px(bottom)} /> : null}
        {area ? lines.map((l) => (l.areaD ? <path key={`a${l.key}`} class="chart-area-path" d={l.areaD} fill={l.colour} /> : null)) : null}
        {lines.map((l) => <path key={`l${l.key}`} class="chart-line-path" d={l.line} stroke={l.colour} />)}
        {lines.map((l) => l.pts.map((p, i) => (dots || i === active
          ? <circle key={`${l.key}-${i}`} class="chart-point" cx={p[0]} cy={p[1]} r={i === active ? 5 : 4} fill={l.colour} />
          : null)))}
        <rect class="chart-hit" x={px(left)} y={px(top)} width={px(plotW)} height={px(plotH)} onPointerMove={onMove} onPointerDown={onMove} />
      </svg>
      {showLegend && series.length > 1 ? <Legend compact shape="line" items={series.map((s) => ({ label: s.label, colour: s.colour }))} /> : null}
      <ChartTooltip tip={tip} />
    </div>
  );
}
