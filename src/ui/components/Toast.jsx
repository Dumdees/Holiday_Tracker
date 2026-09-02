// Small messages that pop up at the bottom of the screen. toast('Saved!'), toast.error('Oops')
import { signal } from '@preact/signals';
import { Icon } from './Icon.jsx';

export const toasts = signal([]);
let seq = 0;

export function toast(message, { kind = 'success', duration = 4000, action = null } = {}) {
  const id = ++seq;
  toasts.value = [...toasts.value, { id, message, kind, action }];
  if (duration > 0) setTimeout(() => toast.dismiss(id), duration);
  return id;
}
toast.dismiss = (id) => { toasts.value = toasts.value.filter((t) => t.id !== id); };
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
