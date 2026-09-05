// Friendly big numbers for the game: £1,234 → £1.23 million → £4.5 trillion billion.
//
// Past a thousand trillion the proper names are ones nobody has ever said out loud – and worse,
// half of them look alike, so "£40.5 sextillion" and "£51.1 quintillion" sitting on the same row
// cannot be told apart at a glance. So the big ones are counted in billions instead, stacked: one
// more "billion" always means a thousand million times bigger, and two numbers can be compared just
// by counting the word.
const NAMES = ['', 'thousand', 'million', 'billion', 'trillion'];
const BILLION = 1e9;
const STACK_FROM = 1e15;      // where the names people know run out

/** Anything up to a thousand trillion, in the words everybody knows. */
function inWordsWeKnow(n, digits) {
  if (n < 1000) return n < 10 && !Number.isInteger(n) ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toLocaleString('en-GB');
  if (n < 1e6) return Math.floor(n).toLocaleString('en-GB');
  const tier = Math.min(NAMES.length - 1, Math.floor(Math.log10(n) / 3));
  const scaled = n / Math.pow(1000, tier);
  const d = digits === undefined ? (scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2) : digits;
  return scaled.toFixed(d).replace(/\.0+$/, '') + ' ' + NAMES[tier];
}

export function fmtNum(n, { short = false } = {}) {
  if (!Number.isFinite(n)) return '∞';
  const neg = n < 0 ? '-' : '';
  n = Math.abs(n);
  const digits = short ? 1 : undefined;
  if (n < STACK_FROM) return neg + inWordsWeKnow(n, digits);
  let stacked = 0, rest = n;
  while (rest >= STACK_FROM) { rest /= BILLION; stacked++; }
  return neg + inWordsWeKnow(rest, digits) + ' billion'.repeat(stacked);
}

export function fmtMoney(n, opts) {
  return '£' + fmtNum(n, opts);
}

/** '£12.5 a second' style. */
export function fmtRate(n, opts) {
  if (n < 10) return '£' + (Math.round(n * 10) / 10).toString() + ' a second';
  return fmtMoney(n, opts) + ' a second';
}

export function fmtSeconds(s) {
  if (!Number.isFinite(s)) return '∞';
  if (s > 0 && s < 1) return 'instantly';           // never "0s" for something that does pay off
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return sec ? `${m}m ${sec}s` : `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60), min = m % 60;
  if (h < 48) return min ? `${h}h ${min}m` : `${h} hour${h === 1 ? '' : 's'}`;
  const days = Math.floor(h / 24);
  if (days < 400) return `${days} days`;
  if (days < 4000) return `${Math.round(days / 30)} months`;
  if (days < 4e6) return `${fmtNum(Math.round(days / 365))} years`;
  return 'longer than anybody would wait';
}

export function fmtPercent(mult) {
  const pct = Math.round((mult - 1) * 100);
  return (pct >= 0 ? '+' : '') + pct + '%';
}

/**
 * How much better something makes things, said the way a person would say it rather than as a
 * number with a times sign in front of it.
 */
export function fmtTimes(mult) {
  if (!Number.isFinite(mult) || mult <= 1.02) return 'no better';
  if (mult < 1.15) return 'a little better';
  if (mult < 1.4) return 'a bit better';
  if (mult < 1.75) return 'half as good again';
  if (mult < 1.94) return 'nearly twice as good';
  if (mult < 2.3) return 'twice as good';
  if (mult < 2.7) return 'two and a half times as good';
  if (mult < 3.4) return 'three times as good';
  if (mult >= 200) return 'hundreds of times better';
  const words = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const whole = Math.round(mult);
  return `${words[whole] || fmtNum(whole)} times as good`;
}

/**
 * A price for a narrow column. The long money words are fine as one big figure at the top of the
 * screen, but in a shop row "£954 trillion billion billion billion" is wider than the row and shoves
 * everything else onto its own line – so once the words get that long, the price is said in what it
 * would take to earn it instead, which is shorter and easier to weigh up anyway.
 */
export function fmtPrice(n, income) {
  const money = fmtMoney(n, { short: true });
  if (money.length <= 22 || !(income > 0)) return money;
  return `${fmtSeconds(n / income)} of takings`;
}
