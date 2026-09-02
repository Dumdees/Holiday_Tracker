// Bits shared by every chart: measuring the container, the hover tooltip, bar path
// geometry and the friendly empty state. Not meant to be used from views directly.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

/** Font size used for axis text and labels inside every svg. */
export const AXIS_FONT = 12;

/**
 * Width of the chart wrapper in CSS pixels, kept up to date with a ResizeObserver, so an svg
 * can use a viewBox that matches its rendered size and text stays crisp at 12px.
 * Falls back to `fallback` until the element has been measured.
 * @param {number} [fallback=640]
 * @returns {[import('preact').RefObject<HTMLElement>, number]}
 */
export function useMeasuredWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let last = 0;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0 && w !== last) { last = w; setWidth(w); }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width || fallback];
}

/**
 * Convert a point in an svg's viewBox units to pixels relative to its `.chart` wrapper,
 * so a tooltip can be anchored to a mark even when the svg is being scaled.
 * @param {SVGSVGElement|null} svg
 * @param {HTMLElement|null} wrapper
 * @param {number} x
 * @param {number} y
 * @param {number} viewWidth – the viewBox width the svg was drawn with
 * @returns {{ x: number, y: number }}
 */
export function svgToWrapper(svg, wrapper, x, y, viewWidth) {
  if (!svg || !wrapper) return { x, y };
  const s = svg.getBoundingClientRect();
  const w = wrapper.getBoundingClientRect();
  const scale = viewWidth > 0 && s.width > 0 ? s.width / viewWidth : 1;
  return { x: s.left - w.left + x * scale, y: s.top - w.top + y * scale };
}

/**
 * Pointer position in an svg's viewBox units.
 * @param {PointerEvent|MouseEvent} e
 * @param {SVGSVGElement} svg
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @returns {{ x: number, y: number }}
 */
export function pointerToSvg(e, svg, viewWidth, viewHeight) {
  const r = svg.getBoundingClientRect();
  const sx = r.width > 0 ? viewWidth / r.width : 1;
  const sy = r.height > 0 ? viewHeight / r.height : 1;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

/** Round to two decimals to keep path data short and tidy. */
export function px(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Keep a number between two bounds.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Path for a bar whose "data end" is rounded (radius r) and whose base is square.
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r – corner radius, clamped so it never exceeds half the bar
 * @param {'top'|'right'|'none'} end – which side is the data end
 * @returns {string}
 */
export function barPath(x, y, w, h, r, end = 'top') {
  if (w <= 0 || h <= 0) return '';
  const rr = px(Math.max(0, Math.min(r, w / 2, h / 2)));
  const X = px(x), Y = px(y), W = px(w), H = px(h);
  if (!rr || end === 'none') return `M${X},${Y}h${W}v${H}h${-W}z`;
  if (end === 'top') {
    return `M${X},${Y + H}v${-px(H - rr)}a${rr},${rr} 0 0 1 ${rr},${-rr}h${px(W - 2 * rr)}a${rr},${rr} 0 0 1 ${rr},${rr}v${px(H - rr)}z`;
  }
  return `M${X},${Y}h${px(W - rr)}a${rr},${rr} 0 0 1 ${rr},${rr}v${px(H - 2 * rr)}a${rr},${rr} 0 0 1 ${-rr},${rr}h${-px(W - rr)}z`;
}

/**
 * Friendly centred message used when a chart has nothing to draw.
 * @param {{ text?: string, minHeight?: number, class?: string }} props
 */
export function ChartEmpty({ text = 'Nothing to show yet', minHeight = 160, class: cls = '' }) {
  return (
    <div class={`chart-empty ${cls}`.trim()} style={{ minHeight: `${minHeight}px` }} role="status">
      <svg class="chart-empty-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18M7 17V11M12 17V7M17 17v-3" />
      </svg>
      <p>{text}</p>
    </div>
  );
}

/**
 * Hover/focus tooltip. Render inside a `.chart` wrapper (position: relative) and pass the
 * anchor point in wrapper pixels. It measures itself and stays inside the wrapper sideways.
 * @param {{ tip: null | { x: number, y: number, title?: any, sub?: any, rows?: Array<{ label: any, value: any, colour?: string, strong?: boolean }>, placement?: 'above'|'right' } }} props
 */
export function ChartTooltip({ tip }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const host = el.offsetParent || el.parentElement;
    const hostW = host ? host.clientWidth : 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left;
    let top;
    if (tip.placement === 'right') {
      left = tip.x + 14;
      top = tip.y - h / 2;
      if (hostW && left + w > hostW - 4) left = tip.x - 14 - w;
      if (left < 4) left = 4;
      if (top < 0) top = 0;
    } else {
      left = tip.x - w / 2;
      top = tip.y - h - 10;
      if (top < 0) top = tip.y + 14;
      if (hostW) left = Math.max(4, Math.min(hostW - w - 4, left));
    }
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.visibility = 'visible';
  }, [tip]);
  if (!tip) return null;
  return (
    <div ref={ref} class="chart-tip" style="visibility:hidden" aria-hidden="true">
      {tip.title ? <div class="chart-tip-title">{tip.title}</div> : null}
      {tip.sub ? <div class="chart-tip-sub">{tip.sub}</div> : null}
      {tip.rows && tip.rows.length ? (
        <div class="chart-tip-rows">
          {tip.rows.map((r, i) => (
            <div class={`chart-tip-row ${r.strong ? 'is-strong' : ''}`.trim()} key={i}>
              {r.colour ? <i class="chart-tip-key" style={{ background: r.colour }} /> : <i class="chart-tip-key is-blank" />}
              <span class="chart-tip-label">{r.label}</span>
              <span class="chart-tip-value">{r.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Short plain-English summary of a list of labelled values for aria-labels.
 * @param {Array<{ label: any, value: number }>} items
 * @param {(n: number) => string} fmt
 * @param {number} [limit=8]
 * @returns {string}
 */
export function summarise(items, fmt, limit = 8) {
  if (!items.length) return 'nothing to show yet';
  const shown = items.slice(0, limit).map((it) => `${it.label} ${fmt(it.value)}`);
  const more = items.length - shown.length;
  return shown.join(', ') + (more > 0 ? ` and ${more} more` : '');
}

/**
 * Handle Enter / Space on a focusable svg mark the way a button would.
 * @param {(e: KeyboardEvent) => void} action
 */
export function keyActivate(action) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(e); }
  };
}
