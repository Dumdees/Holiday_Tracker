// Small focus helpers shared by dialogs (Modal, Drawer). No rendering here.

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function isVisible(el) {
  return Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

/**
 * Keep Tab presses inside `el`, wrapping from the last focusable thing to the first and back.
 * Call from a keydown handler; does nothing for other keys.
 * @param {KeyboardEvent} e
 * @param {HTMLElement|null} el
 */
export function trapTab(e, el) {
  if (e.key !== 'Tab' || !el) return;
  const items = [...el.querySelectorAll(FOCUSABLE)].filter(isVisible);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !el.contains(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !el.contains(active))) { e.preventDefault(); first.focus(); }
}

/**
 * Focus the first sensible thing inside a dialog: [data-autofocus], then a control in the body,
 * then anything focusable (usually the close button).
 * @param {HTMLElement|null} el
 */
export function focusFirst(el) {
  if (!el) return;
  const target = el.querySelector('[data-autofocus]')
    || el.querySelector(`.drawer-body ${FOCUSABLE}`)
    || el.querySelector(`.modal-body ${FOCUSABLE}`)
    || el.querySelector(FOCUSABLE);
  target?.focus?.();
}
