// Small messages that pop up at the bottom of the screen. toast('Saved!'), toast.error('Oops')
import { signal } from '@preact/signals';
import { Icon } from './Icon.jsx';

export const toasts = signal([]);
let seq = 0;
const timers = new Map(); // id → timeout handle, so a toast's life can be extended or cut short

function schedule(id, duration) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (duration > 0) timers.set(id, setTimeout(() => toast.dismiss(id), duration));
}

export function toast(message, { kind = 'success', duration = 4000, action = null } = {}) {
  const id = ++seq;
  toasts.value = [...toasts.value, { id, message, kind, action, at: Date.now() }];
  schedule(id, duration);
  return id;
}
toast.dismiss = (id) => {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((t) => t.id !== id);
};
/** Change a toast that is already showing (message, kind, action) and optionally restart its timer. Returns the id. */
toast.update = (id, { duration, ...patch } = {}) => {
  if (!toasts.value.some((t) => t.id === id)) return null;
  toasts.value = toasts.value.map((t) => (t.id === id ? { ...t, ...patch } : t));
  if (duration != null) schedule(id, duration);
  return id;
};
/** The newest toast shown in the last `withinMs` that has no button on it yet, or null. */
toast.recentPlain = (withinMs = 800) => {
  const now = Date.now();
  const list = toasts.value;
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    if (!t.action && (t.kind === 'success' || t.kind === 'info') && now - t.at <= withinMs) return t;
  }
  return null;
};
toast.success = (m, o) => toast(m, { ...o, kind: 'success' });
toast.error = (m, o) => toast(m, { duration: 7000, ...o, kind: 'error' });
toast.info = (m, o) => toast(m, { ...o, kind: 'info' });
toast.warn = (m, o) => toast(m, { duration: 6000, ...o, kind: 'warning' });

const ICONS = { success: 'check-circle', error: 'alert-circle', info: 'info', warning: 'alert' };

export function ToastHost() {
  const list = toasts.value;
  if (!list.length) return null;
  return (
    <div class="toast-host" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class={`toast toast-${t.kind}`}>
          <Icon name={ICONS[t.kind] || 'info'} size={20} />
          <span class="toast-msg">{t.message}</span>
          {t.action ? (
            <button type="button" class="toast-action" onClick={() => { t.action.onClick(); toast.dismiss(t.id); }}>{t.action.label}</button>
          ) : null}
          <button type="button" class="toast-close" aria-label="Dismiss" onClick={() => toast.dismiss(t.id)}><Icon name="x" size={16} /></button>
        </div>
      ))}
    </div>
  );
}
