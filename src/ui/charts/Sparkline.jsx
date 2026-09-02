// A tiny trend line for stat tiles. No axes, no labels – just the shape of the numbers.
import { fmtDays } from './format.js';
import { px } from './common.jsx';

const PAD = 3;

/**
 * Sparkline
 * @param {object} props
 * @param {number[]} props.values – in order; negative or missing values count as 0
 * @param {string} [props.colour] – line colour (defaults to peach)
 * @param {number} [props.width=120]
 * @param {number} [props.height=32]
 * @param {boolean} [props.area=true] – soft fill under the line
 * @param {(n: number) => string} [props.valueFormat=fmtDays] – used in the accessible label
 * @param {string} [props.ariaLabel] – defaults to 'Trend over N points: from A to B'
 * @param {string} [props.class]
 */
export function Sparkline({ values = [], colour, width = 120, height = 32, area = true, valueFormat = fmtDays, ariaLabel, class: cls = '' }) {
  const nums = (values || []).map((v) => Math.max(0, Number(v) || 0));
  const n = nums.length;
  const classes = `chart-sparkline ${cls}`.trim();

  if (n < 2) {
    return (
      <svg class={classes} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel || 'No trend yet'}>
        <line class="spark-empty" x1={PAD} y1={px(height / 2)} x2={width - PAD} y2={px(height / 2)} />
      </svg>
    );
  }

  const max = Math.max(1e-9, ...nums);
  const step = (width - 2 * PAD) / (n - 1);
  const pts = nums.map((v, i) => [px(PAD + i * step), px(height - PAD - (v / max) * (height - 2 * PAD))]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
  const areaD = `${line}L${pts[n - 1][0]},${px(height - PAD)}L${pts[0][0]},${px(height - PAD)}Z`;
  const last = pts[n - 1];
  const aria = ariaLabel || `Trend over ${n} points: from ${valueFormat(nums[0])} to ${valueFormat(nums[n - 1])}`;
  const strokeStyle = colour ? { stroke: colour } : undefined;
  const fillStyle = colour ? { fill: colour } : undefined;

  return (
    <svg class={classes} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={aria}>
      {area ? <path class="spark-area" d={areaD} style={fillStyle} /> : null}
      <path class="spark-line" d={line} style={strokeStyle} />
      <circle class="spark-dot" cx={last[0]} cy={last[1]} r="3" style={fillStyle} />
    </svg>
  );
}
