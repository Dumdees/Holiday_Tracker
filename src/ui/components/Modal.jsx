// Dialogs. openModal(({ close }) => <YourContent/>) returns a promise resolved with close(value).
// confirm({ title, message, confirmLabel, danger }) is a ready-made yes/no dialog.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon.jsx';

export const modals = signal([]);
let seq = 0;

export function openModal(render, { size = 'md', title = null, dismissable = true } = {}) {
  return new Promise((resolve) => {
    const id = ++seq;
    const close = (value) => {
      modals.value = modals.value.filter((m) => m.id !== id);
      resolve(value);
    };
    modals.value = [...modals.value, { id, render, close, size, title, dismissable }];
  });
}

export function closeAllModals() {
  for (const m of modals.value) m.close(undefined);
}

export function confirm({ title = 'Are you sure?', message = '', confirmLabel = 'Yes, continue', cancelLabel = 'Cancel', danger = false, icon = null }) {
  return openModal(({ close }) => (
    <div class="confirm">
      {icon ? <div class={`confirm-icon ${danger ? 'danger' : ''}`}><Icon name={icon} size={28} /></div> : null}
      <h2>{title}</h2>
      {message ? <p class="soft">{message}</p> : null}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onClick={() => close(false)}>{cancelLabel}</button>
        <button type="button" class={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} data-autofocus>{confirmLabel}</button>
      </div>
    </div>
  ), { size: 'sm' });
}

export function alert({ title = 'Notice', message = '', okLabel = 'OK', icon = 'info' }) {
  return openModal(({ close }) => (
    <div class="confirm">
      <div class="confirm-icon"><Icon name={icon} size={28} /></div>
      <h2>{title}</h2>
      {message ? <p class="soft">{message}</p> : null}
      <div class="modal-actions">
        <button type="button" class="btn btn-primary" onClick={() => close(true)} data-autofocus>{okLabel}</button>
      </div>
    </div>
  ), { size: 'sm' });
}

function ModalFrame({ m }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const focusTarget = el?.querySelector('[data-autofocus]') || el?.querySelector('input, select, textarea, button');
    focusTarget?.focus?.();
    const onKey = (e) => { if (e.key === 'Escape' && m.dismissable) m.close(undefined); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [m]);
  return (
    <div class="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && m.dismissable) m.close(undefined); }}>
      <div class={`modal modal-${m.size}`} role="dialog" aria-modal="true" ref={ref} aria-label={m.title || undefined}>
        {m.title ? (
          <div class="modal-head">
            <h2>{m.title}</h2>
            {m.dismissable ? <button type="button" class="icon-btn" aria-label="Close" onClick={() => m.close(undefined)}><Icon name="x" /></button> : null}
          </div>
        ) : null}
        <div class="modal-body">{m.render({ close: m.close })}</div>
      </div>
    </div>
  );
}

export function ModalHost() {
  const list = modals.value;
  if (!list.length) return null;
  return <>{list.map((m) => <ModalFrame key={m.id} m={m} />)}</>;
}
