// Stacked or grouped bars, vertical or horizontal. Used for entitlement usage per carer
// (horizontal, with the entitlement drawn as a reference line) and leave by month (vertical).
import { useRef, useState } from 'preact/hooks';
import { fmtDays, niceTicks, textWidth, fitLabel, sum } from './format.js';
import { Legend } from './Legend.jsx';
import { useMeasuredWidth, svgToWrapper, barPath, px, clamp, ChartEmpty, ChartTooltip, summarise, keyActivate } from './common.jsx';

const PAD = { top: 12, right: 16, bottom: 6, left: 4 };
const MAX_BAR_V = 28; // thickest a vertical bar gets
const MAX_BAR_H = 22; // thickest a horizontal bar gets
const MIN_BAR = 4;
const RADIUS = 4;
const GAP = 2; // surface gap between stacked segments and between grouped bars
const AXIS_BAND = 22; // room for one row of axis labels
const ROTATION = -38; // degrees, for crowded vertical labels

/** A non-negative number for a series key, or 0 when missing. */
function val(item, key) {
  const v = Number(item?.values?.[key]);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** The stacked segments of one bar, in series order, with the total so far. */
function stackParts(item, series) {
  const parts = [];
  let cum = 0;
  for (const s of series) {
    const v = val(item, s.key);
    if (v <= 0) continue;
    parts.push({ series: s, from: cum, to: cum + v });
    cum += v;
  }
  return parts;
}

function refText(referenceLine, value, valueFormat) {
  return `${referenceLine.label ? `${referenceLine.label} ` : ''}${valueFormat(value)}`;
}

/** Geometry for vertical bars: categories along the bottom, values up the side. */
function verticalLayout({ data, series, totals, width, height, barGap, stacked, valueFormat, showValues, rawMax, referenceLine, refVal }) {
  const n = data.length;
  const ticks = niceTicks(rawMax, 4);
  const domainMax = ticks[ticks.length - 1];
  const tickLabels = ticks.map(valueFormat);
  const left = PAD.left + Math.max(...tickLabels.map((t) => textWidth(t))) + 10;
  const right = width - PAD.right;
  const plotW = Math.max(40, right - left);
  const band = plotW / n;

  const labels = data.map((d) => String(d.label ?? ''));
  const maxLabelW = Math.max(...labels.map((l) => textWidth(l)));
  const rotate = maxLabelW > band - 6;
  const maxRotW = Math.min(88, Math.max(36, (left + band / 2 - 4) / 0.79));
  const shown = rotate ? labels.map((l) => fitLabel(l, maxRotW)) : labels;
  const rotW = rotate ? Math.max(...shown.map((l) => textWidth(l))) : 0;
  const xBand = rotate ? Math.min(Math.round(rotW * 0.62 + 20), 80) : AXIS_BAND;
  const every = rotate ? Math.max(1, Math.ceil(21 / band)) : 1;

  const top = PAD.top + (showValues ? 14 : 0) + (refVal != null ? 8 : 0);
  const bottom = height - PAD.bottom - xBand;
  const plotH = Math.max(40, bottom - top);
  const y = (v) => bottom - (v / domainMax) * plotH;

  const k = series.length;
  const gap = Math.min(barGap, band * 0.45); // narrow slots keep some bar, not just air
  const barW = clamp(band - gap, MIN_BAR, MAX_BAR_V);
  const groupW = stacked ? barW : Math.min(Math.max(MIN_BAR, band - gap), MAX_BAR_V * k + GAP * (k - 1));
  const eachW = stacked ? barW : Math.max(MIN_BAR, (groupW - GAP * (k - 1)) / k);
  // Value labels are all or nothing: a chart where only the short numbers fit looks broken.
  const valuesFit = showValues && totals.every((t) => t <= 0 || textWidth(valueFormat(t)) <= band - 2);

  const bars = data.map((d, i) => {
    const x0 = left + i * band;
    const cx = x0 + band / 2;
    const segments = [];
    if (stacked) {
      const parts = stackParts(d, series);
      parts.forEach((p, j) => {
        const yTop = y(p.to);
        const yBase = y(p.from) - (j > 0 ? GAP : 0);
        const h = yBase - yTop;
        if (h < 0.5) return;
        segments.push({ key: p.series.key, colour: p.series.colour, d: barPath(cx - eachW / 2, yTop, eachW, h, RADIUS, j === parts.length - 1 ? 'top' : 'none') });
      });
    } else {
      const gx = cx - groupW / 2;
      series.forEach((s, j) => {
        const v = val(d, s.key);
        const h = bottom - y(v);
        if (v <= 0 || h < 0.5) return;
        segments.push({ key: s.key, colour: s.colour, d: barPath(gx + j * (eachW + GAP), y(v), eachW, h, RADIUS, 'top') });
      });
    }
    const total = totals[i];
    const value = valuesFit && total > 0 ? { x: cx, y: y(total) - 5, anchor: 'middle', text: valueFormat(total) } : null;
    return { i, hit: { x: x0, y: top, w: band, h: plotH }, segments, value, anchor: { x: cx, y: y(total) }, placement: 'above' };
  });

  const tickMarks = ticks.map((t, j) => ({
    isZero: t === 0,
    line: { x1: left, y1: y(t), x2: right, y2: y(t) },
    label: { x: left - 8, y: y(t) + 4, anchor: 'end' },
    text: tickLabels[j],
  }));

  const cats = [];
  labels.forEach((full, i) => {
    if (i % every) return;
    const cx = left + i * band + band / 2;
    cats.push(rotate
      ? { x: cx + 4, y: bottom + 13, text: shown[i], full, anchor: 'end', rotate: ROTATION }
      : { x: cx, y: bottom + 16, text: shown[i], full, anchor: 'middle', rotate: 0 });
  });

  const ref = refVal != null && refVal <= domainMax ? {
    line: { x1: left, y1: y(refVal), x2: right, y2: y(refVal) },
    label: { x: right - 2, y: y(refVal) - 5, anchor: 'end', text: refText(referenceLine, refVal, valueFormat) },
  } : null;

  return { W: width, H: height, ticks: tickMarks, cats, bars, ref, axis: { x1: left, y1: bottom, x2: right, y2: bottom } };
}

/** Geometry for horizontal bars: one row per category, values along the bottom. */
function horizontalLayout({ data, series, totals, width, rowHeight, barGap, stacked, valueFormat, showValues, rawMax, referenceLine, refVal }) {
  const n = data.length;
  const labels = data.map((d) => String(d.label ?? ''));
  const maxLabelW = Math.max(...labels.map((l) => textWidth(l)));
  const labelCol = clamp(maxLabelW + 12, 56, Math.max(72, Math.min(190, width * 0.34)));
  const left = PAD.left + labelCol;
  const valueW = showValues ? Math.max(...totals.map((t) => textWidth(valueFormat(t)))) + 8 : 0;
  const right = width - PAD.right - valueW;
  const plotW = Math.max(40, right - left);
  const ticks = niceTicks(rawMax, clamp(Math.floor(plotW / 48), 2, 5));
  const domainMax = ticks[ticks.length - 1];
  const tickLabels = ticks.map(valueFormat);

  const top = PAD.top + (refVal != null ? 14 : 0);
  const bottom = top + n * rowHeight;
  const H = bottom + AXIS_BAND + PAD.bottom;
  const x = (v) => left + (v / domainMax) * plotW;

  const k = series.length;
  const barH = clamp(rowHeight - barGap, MIN_BAR, MAX_BAR_H);
  const groupH = stacked ? barH : Math.min(Math.max(MIN_BAR, rowHeight - barGap), MAX_BAR_H * k + GAP * (k - 1));
  const eachH = stacked ? barH : Math.max(MIN_BAR, (groupH - GAP * (k - 1)) / k);
  const shown = labels.map((l) => fitLabel(l, labelCol - 12));

  const bars = data.map((d, i) => {
    const y0 = top + i * rowHeight;
    const cy = y0 + rowHeight / 2;
    const segments = [];
    if (stacked) {
      const parts = stackParts(d, series);
      parts.forEach((p, j) => {
        const xStart = x(p.from) + (j > 0 ? GAP : 0);
        const w = x(p.to) - xStart;
        if (w < 0.5) return;
        segments.push({ key: p.series.key, colour: p.series.colour, d: barPath(xStart, cy - barH / 2, w, barH, RADIUS, j === parts.length - 1 ? 'right' : 'none') });
      });
    } else {
      const gy = cy - groupH / 2;
      series.forEach((s, j) => {
        const v = val(d, s.key);
        const w = x(v) - left;
        if (v <= 0 || w < 0.5) return;
        segments.push({ key: s.key, colour: s.colour, d: barPath(left, gy + j * (eachH + GAP), w, eachH, RADIUS, 'right') });
      });
    }
    const total = totals[i];
    const value = showValues && total > 0 ? { x: x(total) + 6, y: cy + 4, anchor: 'start', text: valueFormat(total) } : null;
    return { i, hit: { x: PAD.left, y: y0, w: width - PAD.left - PAD.right, h: rowHeight }, segments, value, anchor: { x: x(total), y: cy }, placement: 'right' };
  });

  const tickMarks = ticks.map((t, j) => ({
    isZero: t === 0,
    line: { x1: x(t), y1: top, x2: x(t), y2: bottom },
    label: { x: x(t), y: bottom + 16, anchor: 'middle' },
    text: tickLabels[j],
  }));

  const cats = labels.map((full, i) => ({ x: left - 10, y: top + i * rowHeight + rowHeight / 2 + 4, text: shown[i], full, anchor: 'end', rotate: 0 }));

  let ref = null;
  if (refVal != null && refVal <= domainMax) {
    const rx = x(refVal);
    const text = refText(referenceLine, refVal, valueFormat);
    const half = textWidth(text) / 2;
    const anchor = rx - half < left ? 'start' : rx + half > width - PAD.right ? 'end' : 'middle';
    ref = { line: { x1: rx, y1: top - 4, x2: rx, y2: bottom }, label: { x: rx, y: top - 8, anchor, text } };
  }

  return { W: width, H, ticks: tickMarks, cats, bars, ref, axis: { x1: left, y1: bottom, x2: right, y2: bottom } };
}

/**
 * BarChart – stacked (default) or side-by-side bars, vertical (default) or horizontal.
 * @param {object} props
 * @param {Array<{ key: string, label: string, colour: string }>} props.series
 * @param {Array<{ label: string, values: Record<string, number>, sub?: string, meta?: any }>} props.data – one bar per item; `sub` shows under the title in the tooltip, `meta` is handed back by onBarClick
 * @param {boolean} [props.stacked=true] – false draws the series side by side (give horizontal charts a bigger rowHeight)
 * @param {boolean} [props.horizontal=false] – category labels on the left; height grows with the rows
 * @param {number} [props.height=260] – svg height in vertical mode, axis included
 * @param {number} [props.rowHeight=34] – height per row in horizontal mode
 * @param {number} [props.barGap=8] – pixels of air around each bar inside its slot
 * @param {(n: number) => string} [props.valueFormat=fmtDays]
 * @param {boolean} [props.showValues=false] – print each bar's total at its tip
 * @param {boolean} [props.showLegend=true] – the legend appears when there are two or more series
 * @param {number} [props.maxValue] – force the top of the value axis
 * @param {(item: object, index: number) => void} [props.onBarClick] – makes bars clickable and keyboard focusable
 * @param {string} [props.emptyText='Nothing to show yet']
 * @param {string} [props.ariaLabel] – summary for screen readers (generated from the data if omitted)
 * @param {{ value: number, label?: string }} [props.referenceLine] – a dashed marker line, e.g. the entitlement
 * @param {number|null} [props.highlightIndex] – draw attention to one bar and soften the rest
 * @param {string} [props.class]
 */
export function BarChart({ series = [], data = [], stacked = true, horizontal = false, height = 260, rowHeight = 34, barGap = 8, valueFormat = fmtDays, showValues = false, showLegend = true, maxValue, onBarClick, emptyText = 'Nothing to show yet', ariaLabel, referenceLine, highlightIndex = null, class: cls = '' }) {
  const [wrapRef, width] = useMeasuredWidth(640);
  const svgRef = useRef(null);
  const [tip, setTip] = useState(null);

  const keys = series.map((s) => s.key);
  const totals = data.map((d) => (stacked ? sum(keys.map((k) => val(d, k))) : Math.max(0, ...keys.map((k) => val(d, k)))));
  const refVal = referenceLine && Number.isFinite(Number(referenceLine.value)) ? Number(referenceLine.value) : null;
  const empty = !series.length || !data.length || (refVal == null && !totals.some((t) => t > 0));
  if (empty) {
    return <div class={`chart chart-bar ${cls}`.trim()}><ChartEmpty text={emptyText} minHeight={Math.min(height, 200)} /></div>;
  }

  const rawMax = Number(maxValue) > 0 ? Number(maxValue) : Math.max(...totals, refVal ?? 0);
  const args = { data, series, totals, width, height, rowHeight, barGap, stacked, valueFormat, showValues, rawMax, referenceLine, refVal };
  const L = horizontal ? horizontalLayout(args) : verticalLayout(args);

  const aria = ariaLabel || `Bar chart. ${summarise(data.map((d, i) => ({ label: d.label, value: totals[i] })), valueFormat)}${refVal != null ? `. ${referenceLine.label || 'Marker'} at ${valueFormat(refVal)}` : ''}`;

  const rowsFor = (item) => series.map((s) => ({ label: s.label, colour: s.colour, value: valueFormat(val(item, s.key)) }));
  const showTip = (bar) => {
    const item = data[bar.i];
    const rows = rowsFor(item);
    if (stacked && series.length > 1) rows.push({ label: 'Total', value: valueFormat(totals[bar.i]), strong: true });
    const p = svgToWrapper(svgRef.current, wrapRef.current, bar.anchor.x, bar.anchor.y, L.W);
    setTip({ x: p.x, y: p.y, title: item.label, sub: item.sub, rows, placement: bar.placement });
  };
  const hideTip = () => setTip(null);

  return (
    <div ref={wrapRef} class={`chart chart-bar ${horizontal ? 'is-horizontal' : 'is-vertical'} ${cls}`.trim()}>
      <svg ref={svgRef} class="chart-svg" viewBox={`0 0 ${L.W} ${L.H}`} width="100%" role="img" aria-label={aria} onPointerLeave={hideTip}>
        {L.ticks.map((t, j) => (
          <line key={`g${j}`} class={t.isZero ? 'chart-axis' : 'chart-grid'} x1={px(t.line.x1)} y1={px(t.line.y1)} x2={px(t.line.x2)} y2={px(t.line.y2)} />
        ))}
        {L.ticks.map((t, j) => (
          <text key={`t${j}`} class="chart-axis-text" x={px(t.label.x)} y={px(t.label.y)} text-anchor={t.label.anchor}>{t.text}</text>
        ))}
        <line class="chart-axis" x1={px(L.axis.x1)} y1={px(L.axis.y1)} x2={px(L.axis.x2)} y2={px(L.axis.y2)} />
        {L.cats.map((c, j) => (
          <text key={`c${j}`} class="chart-cat-text" x={px(c.x)} y={px(c.y)} text-anchor={c.anchor} transform={c.rotate ? `rotate(${c.rotate} ${px(c.x)} ${px(c.y)})` : undefined}>
            {c.full !== c.text ? <title>{c.full}</title> : null}
            {c.text}
          </text>
        ))}
        {L.bars.map((b) => {
          const item = data[b.i];
          const muted = highlightIndex != null && highlightIndex !== b.i;
          const clickable = typeof onBarClick === 'function';
          const title = `${item.label}: ${rowsFor(item).map((r) => `${r.label} ${r.value}`).join(', ')}`;
          return (
            <g
              key={b.i}
              class={`chart-bar-group ${clickable ? 'is-clickable' : ''} ${muted ? 'is-muted' : ''}`.trim()}
              tabIndex={clickable ? 0 : undefined}
              role={clickable ? 'button' : undefined}
              aria-label={clickable ? title : undefined}
              onPointerEnter={() => showTip(b)}
              onFocus={() => showTip(b)}
              onBlur={hideTip}
              onClick={clickable ? () => onBarClick(item, b.i) : undefined}
              onKeyDown={clickable ? keyActivate(() => onBarClick(item, b.i)) : undefined}
            >
              <title>{title}</title>
              <rect class={`chart-hit ${highlightIndex === b.i ? 'is-highlight' : ''}`.trim()} x={px(b.hit.x)} y={px(b.hit.y)} width={px(b.hit.w)} height={px(b.hit.h)} rx="6" />
              {b.segments.map((s) => <path key={s.key} class="chart-segment" d={s.d} fill={s.colour} />)}
              {b.value ? <text class="chart-value" x={px(b.value.x)} y={px(b.value.y)} text-anchor={b.value.anchor}>{b.value.text}</text> : null}
            </g>
          );
        })}
        {L.ref ? (
          <g class="chart-ref-group" aria-hidden="true">
            <line class="chart-ref" x1={px(L.ref.line.x1)} y1={px(L.ref.line.y1)} x2={px(L.ref.line.x2)} y2={px(L.ref.line.y2)} />
            <text class="chart-ref-label" x={px(L.ref.label.x)} y={px(L.ref.label.y)} text-anchor={L.ref.label.anchor}>{L.ref.label.text}</text>
          </g>
        ) : null}
      </svg>
      {showLegend && series.length > 1 ? <Legend compact items={series.map((s) => ({ label: s.label, colour: s.colour }))} /> : null}
      <ChartTooltip tip={tip} />
    </div>
  );
}
