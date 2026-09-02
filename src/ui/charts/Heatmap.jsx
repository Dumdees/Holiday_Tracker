// A calendar heat map: one mini month per calendar month, each day shaded by its value.
// Used for team capacity ("days when many are off") and a carer's year at a glance.
import { useRef, useState } from 'preact/hooks';
import { parts, makeISO, daysInMonth, isoWeekday, addMonths, startOfMonth, monthName, weekdayHeaders, formatShort, formatDay, todayISO } from '../../core/dates.js';
import { fmtDays } from './format.js';
import { svgToWrapper, clamp, ChartEmpty, ChartTooltip } from './common.jsx';

const GAP = 3; // between cells, in svg units
const HEADER = 14; // weekday letters row, in svg units
const LEVELS = 6; // default ramp: peach-200 … peach-700
const MAX_MONTHS = 48;

/** Read a day's value from a Map or a plain object, as a non-negative number. */
function readValue(values, iso) {
  const raw = values instanceof Map ? values.get(iso) : values ? values[iso] : undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function allValues(values) {
  if (values instanceof Map) return [...values.values()];
  return values ? Object.values(values) : [];
}

/** Cells for one calendar month, only for days inside [start, end]. */
function monthCells(monthStart, { start, end, weekStartsOn, values, dim, today, level, pitch }) {
  const { y, m } = parts(monthStart);
  const days = daysInMonth(y, m);
  const offset = (isoWeekday(monthStart) - weekStartsOn + 7) % 7;
  const cells = [];
  let marked = 0;
  let peak = 0;
  let peakIso = null;
  for (let d = 1; d <= days; d++) {
    const iso = makeISO(y, m, d);
    if (iso < start || iso > end) continue;
    const idx = offset + d - 1;
    const v = readValue(values, iso);
    if (v > 0) { marked++; if (v > peak) { peak = v; peakIso = iso; } }
    cells.push({ iso, v, x: (idx % 7) * pitch, y: HEADER + Math.floor(idx / 7) * pitch, lvl: level(v), dim: dim.has(iso), today: iso === today });
  }
  return { y, m, rows: Math.ceil((offset + days) / 7), cells, marked, peak, peakIso };
}

/**
 * Heatmap – a calendar heat map from `start` to `end` (inclusive).
 * @param {object} props
 * @param {string} props.start – ISO date
 * @param {string} props.end – ISO date
 * @param {Map<string, number>|Record<string, number>} [props.values] – value per ISO day; missing days count as 0
 * @param {number} [props.max] – value that gets the deepest colour (defaults to the largest value)
 * @param {number} [props.weekStartsOn=1] – ISO weekday the columns start on (1 = Monday)
 * @param {(iso: string) => void} [props.onDayClick]
 * @param {(iso: string, value: number) => string} [props.tooltip] – text for a day (defaults to 'Wed 4 Mar 2026 · 3')
 * @param {Set<string>|string[]} [props.dimDays] – days drawn dimmer (weekends, bank holidays)
 * @param {number} [props.cellSize=14] – base cell size; blocks scale up to fill their grid cell
 * @param {boolean} [props.showMonthLabels=true]
 * @param {boolean} [props.legend=true] – 'Fewer … More' key under the grid
 * @param {string[]} [props.colourScale] – custom ramp, lightest first (defaults to peach-200 … peach-700)
 * @param {string} [props.today] – ISO date to outline (defaults to today)
 * @param {(n: number) => string} [props.valueFormat=fmtDays]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.class]
 */
export function Heatmap({ start, end, values, max, weekStartsOn = 1, onDayClick, tooltip, dimDays, cellSize = 14, showMonthLabels = true, legend = true, colourScale, today = todayISO(), valueFormat = fmtDays, ariaLabel, class: cls = '' }) {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);

  if (!start || !end || end < start) {
    return <div class={`chart chart-heatmap ${cls}`.trim()}><ChartEmpty text="No dates to show yet" minHeight={120} /></div>;
  }

  const dim = dimDays instanceof Set ? dimDays : new Set(dimDays || []);
  const scale = Array.isArray(colourScale) && colourScale.length ? colourScale : null;
  const levels = scale ? scale.length : LEVELS;
  const peak = Number(max) > 0 ? Number(max) : Math.max(1, ...allValues(values).map((v) => Number(v) || 0));
  const level = (v) => (v <= 0 ? 0 : clamp(Math.ceil((v / peak) * levels), 1, levels));
  const pitch = cellSize + GAP;
  const W = 7 * pitch - GAP;
  const letters = weekdayHeaders(weekStartsOn).map((s) => s[0]);
  const tipText = (iso, v) => (typeof tooltip === 'function' ? tooltip(iso, v) : `${formatShort(iso)} · ${valueFormat(v)}`);

  const months = [];
  for (let cur = startOfMonth(start), last = startOfMonth(end); cur <= last && months.length < MAX_MONTHS; cur = addMonths(cur, 1)) {
    months.push(monthCells(cur, { start, end, weekStartsOn, values, dim, today, level, pitch }));
  }

  const showTip = (e, cell) => {
    const svg = e.currentTarget.ownerSVGElement;
    const p = svgToWrapper(svg, wrapRef.current, cell.x + cellSize / 2, cell.y, W);
    setTip({ x: p.x, y: p.y, title: tipText(cell.iso, cell.v), placement: 'above' });
  };
  const hideTip = () => setTip(null);
  const clickable = typeof onDayClick === 'function';
  const aria = ariaLabel || `Calendar heat map from ${formatDay(start, { year: true })} to ${formatDay(end, { year: true })}`;

  return (
    <div ref={wrapRef} class={`chart chart-heatmap ${cls}`.trim()} role="group" aria-label={aria}>
      <div class="chart-hm-grid">
        {months.map((mo) => {
          const label = `${monthName(mo.m)} ${mo.y}`;
          const H = HEADER + mo.rows * pitch - GAP;
          const monthAria = mo.marked
            ? `${label}: ${mo.marked} days marked, busiest ${formatDay(mo.peakIso)} with ${valueFormat(mo.peak)}`
            : `${label}: nothing marked`;
          return (
            <div class="chart-hm-month" key={`${mo.y}-${mo.m}`}>
              {showMonthLabels ? <h4 class="chart-hm-title">{label}</h4> : null}
              <svg class="chart-hm-svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={monthAria} onPointerLeave={hideTip}>
                {letters.map((l, i) => <text key={i} class="chart-hm-wd" x={i * pitch + cellSize / 2} y={9} text-anchor="middle">{l}</text>)}
                {mo.cells.map((cell) => (
                  <rect
                    key={cell.iso}
                    class={`chart-hm-cell lvl-${cell.lvl} ${cell.dim ? 'is-dim' : ''} ${cell.today ? 'is-today' : ''} ${clickable ? 'is-clickable' : ''}`.trim()}
                    x={cell.x}
                    y={cell.y}
                    width={cellSize}
                    height={cellSize}
                    rx="3"
                    fill={scale && cell.lvl > 0 ? scale[cell.lvl - 1] : undefined}
                    onPointerEnter={(e) => showTip(e, cell)}
                    onClick={clickable ? () => onDayClick(cell.iso) : undefined}
                  >
                    <title>{tipText(cell.iso, cell.v)}</title>
                  </rect>
                ))}
              </svg>
            </div>
          );
        })}
      </div>
      {legend ? (
        <div class="chart-hm-legend" aria-hidden="true">
          <span>Fewer</span>
          {Array.from({ length: levels + 1 }, (_, i) => (
            <i key={i} class={`lvl-${i}`} style={scale && i > 0 ? { background: scale[i - 1] } : undefined} />
          ))}
          <span>More</span>
        </div>
      ) : null}
      <ChartTooltip tip={tip} />
    </div>
  );
}
