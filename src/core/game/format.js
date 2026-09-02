// Friendly big numbers for the game: £1,234 → £1.23 million → £4.5 quadrillion.
const NAMES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion'];

export function fmtNum(n, { short = false } = {}) {
  if (!Number.isFinite(n)) return '∞';
  const neg = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) return neg + (n < 10 && !Number.isInteger(n) ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toLocaleString('en-GB'));
  if (n < 1e6) return neg + Math.floor(n).toLocaleString('en-GB');
  const tier = Math.min(NAMES.length - 1, Math.floor(Math.log10(n) / 3));
  if (tier >= NAMES.length - 1 && n >= 1e42) return neg + n.toExponential(2).replace('e+', ' × 10^');
  const scaled = n / Math.pow(1000, tier);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const word = short ? NAMES[tier].slice(0, 1).toUpperCase() : ' ' + NAMES[tier];
  return neg + scaled.toFixed(digits) + word;
}

export function fmtMoney(n, opts) {
  return '£' + fmtNum(n, opts);
}

/** '£12.5/s' style. */
export function fmtRate(n) {
  if (n < 10) return '£' + (Math.round(n * 10) / 10).toString() + '/s';
  return fmtMoney(n) + '/s';
}

export function fmtSeconds(s) {
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return sec ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m / 60), min = m % 60;
  if (h < 48) return min ? `${h}h ${min}m` : `${h}h`;
  return `${Math.floor(h / 24)} days`;
}

export function fmtPercent(mult) {
  const pct = Math.round((mult - 1) * 100);
  return (pct >= 0 ? '+' : '') + pct + '%';
}
