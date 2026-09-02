// Tiny router: which section is showing, plus optional parameters.
// Kept in a signal so every component re-renders when the view changes.
import { signal } from '@preact/signals';

export const VIEWS = [
  { id: 'home', label: 'Home', icon: 'home', hint: 'Today at a glance' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', hint: 'See who is off and when' },
  { id: 'carers', label: 'Carers', icon: 'users', hint: 'Your team and their entitlement' },
  { id: 'holidays', label: 'Holidays', icon: 'sun', hint: 'Add, change or remove holidays' },
  { id: 'reports', label: 'Reports', icon: 'chart', hint: 'Usage, trends and statistics' },
  { id: 'game', label: 'Care Empire', icon: 'gamepad', hint: 'A little game for your tea break', optional: 'gameEnabled' },
  { id: 'settings', label: 'Settings', icon: 'settings', hint: 'Holiday year, teams, backups' },
];

const VIEW_IDS = new Set(VIEWS.map((v) => v.id));

function readHash() {
  const raw = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '');
  if (!raw) return { view: 'home', params: {} };
  const [view, query = ''] = raw.split('?');
  const params = {};
  for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  return { view: VIEW_IDS.has(view) ? view : 'home', params };
}

export const route = signal(readHash());

/**
 * Go to a section. `params` is a flat object of strings, e.g.
 * navigate('carers', { id: carer.id }) or navigate('calendar', { month: '2026-04' }).
 */
export function navigate(view, params = {}) {
  if (!VIEW_IDS.has(view)) view = 'home';
  const clean = {};
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') clean[k] = String(v);
  route.value = { view, params: clean };
  const qs = new URLSearchParams(clean).toString();
  const hash = '#' + view + (qs ? '?' + qs : '');
  if (typeof history !== 'undefined' && location.hash !== hash) {
    try { history.pushState(null, '', hash); } catch { /* file:// in some browsers */ location.hash = hash; }
  }
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { route.value = readHash(); });
  window.addEventListener('hashchange', () => { route.value = readHash(); });
}
