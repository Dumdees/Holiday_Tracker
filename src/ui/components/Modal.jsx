// Dialogs. openModal(({ close }) => <YourContent/>) returns a promise resolved with close(value).
// confirm({ title, message, confirmLabel, danger }) is a ready-made yes/no dialog.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { focusFirst, trapTab, pushLayer, isTopLayer } from './focus.js';

export const modals = signal([]);
let seq = 0;

/**
 * Open a dialog. `render` receives `{ close }` and returns the content; the promise resolves with
 * whatever `close(value)` is called with (undefined when dismissed with Escape or the backdrop).
 * @param {(api: { close: (value?: any) => void }) => any} render
 * @param {{ size?: 'sm'|'md'|'lg', title?: string|null, dismissable?: boolean, ariaLabel?: string }} [options] –
 *   `ariaLabel` names the dialog for screen readers when it has no visible `title`
 * @returns {Promise<any>}
 */
export function openModal(render, { size = 'md', title = null, dismissable = true, ariaLabel = null } = {}) {
  return new Promise((resolve) => {
    const id = ++seq;
    const close = (value) => {
      modals.value = modals.value.filter((m) => m.id !== id);
      resolve(value);
    };
    modals.value = [...modals.value, { id, render, close, size, title, dismissable, ariaLabel }];
  });
}

/** Close every open dialog (each promise resolves with undefined). */
export function closeAllModals() {
  for (const m of modals.value) m.close(undefined);
}

/**
 * A yes/no question. Resolves true when confirmed, false otherwise.
 * @param {{ title?: string, message?: any, confirmLabel?: string, cancelLabel?: string, danger?: boolean, icon?: string|null }} options
 * @returns {Promise<boolean>}
 */
export function confirm({ title = 'Are you sure?', message = '', confirmLabel = 'Yes, continue', cancelLabel = 'Cancel', danger = false, icon = null }) {
  return openModal(({ close }) => (
    <div class="confirm">
      {icon ? <div class={`confirm-icon ${danger ? 'danger' : ''}`.trim()} aria-hidden="true"><Icon name={icon} size={28} /></div> : null}
      <h2>{title}</h2>
      {message ? <p class="soft">{message}</p> : null}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onClick={() => close(false)}>{cancelLabel}</button>
        <button type="button" class={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} data-autofocus>{confirmLabel}</button>
      </div>
    </div>
  ), { size: 'sm', ariaLabel: typeof title === 'string' ? title : null }).then((v) => v === true);
}

/**
 * A simple notice with one OK button.
 * @param {{ title?: string, message?: any, okLabel?: string, icon?: string }} options
 * @returns {Promise<void>}
 */
export function alert({ title = 'Notice', message = '', okLabel = 'OK', icon = 'info' }) {
  return openModal(({ close }) => (
    <div class="confirm">
      <div class="confirm-icon" aria-hidden="true"><Icon name={icon} size={28} /></div>
      <h2>{title}</h2>
      {message ? <p class="soft">{message}</p> : null}
      <div class="modal-actions">
        <button type="button" class="btn btn-primary" onClick={() => close(true)} data-autofocus>{okLabel}</button>
      </div>
    </div>
  ), { size: 'sm', ariaLabel: typeof title === 'string' ? title : null }).then(() => undefined);
}

function ModalFrame({ m, isTop }) {
  const ref = useRef(null);
  const titleId = `modal-${m.id}-title`;

  useEffect(() => {
    const previous = document.activeElement;
    const release = pushLayer(m);
    focusFirst(ref.current);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      release();
      document.body.style.overflow = prevOverflow;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [m]);

  useEffect(() => {
    if (!isTop) return undefined;
    const onKey = (e) => {
      // Another overlay (a drawer or a newer dialog) may have opened on top since.
      if (!isTopLayer(m)) return;
      if (e.key === 'Escape') { if (m.dismissable) m.close(undefined); return; }
      trapTab(e, ref.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [m, isTop]);

  return (
    <div class="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && m.dismissable) m.close(undefined); }}>
      <div class={`modal modal-${m.size}`} role="dialog" aria-modal="true" ref={ref} aria-labelledby={m.title ? titleId : undefined} aria-label={m.title ? undefined : (m.ariaLabel || 'Dialog')}>
        {m.title ? (
          <div class="modal-head">
            <h2 id={titleId}>{m.title}</h2>
            {m.dismissable ? <button type="button" class="icon-btn" aria-label="Close" title="Close" onClick={() => m.close(undefined)}><Icon name="x" /></button> : null}
          </div>
        ) : null}
        <div class="modal-body">{m.render({ close: m.close })}</div>
      </div>
    </div>
  );
}

/** Renders every open dialog; the topmost one owns Escape and the Tab trap. */
export function ModalHost() {
  const list = modals.value;
  if (!list.length) return null;
  return <>{list.map((m, i) => <ModalFrame key={m.id} m={m} isTop={i === list.length - 1} />)}</>;
}
