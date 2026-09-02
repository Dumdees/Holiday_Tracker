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

/*
 * Overlay layers. Drawers and dialogs can sit on top of one another (a day drawer on the
 * calendar opens the "Add holiday" dialog). Only the topmost one may react to Escape and
 * trap Tab, otherwise every layer fights for the keyboard: Tab bounces between them and one
 * Escape closes everything at once. Each overlay registers itself while it is open.
 */
const layers = [];

/**
 * Register an open overlay. Returns a function that removes it again (call it on unmount).
 * @param {HTMLElement|object} layer – anything that identifies the overlay, usually its root element
 * @returns {() => void}
 */
export function pushLayer(layer) {
  layers.push(layer);
  return () => {
    const i = layers.lastIndexOf(layer);
    if (i !== -1) layers.splice(i, 1);
  };
}

/**
 * True when `layer` is the topmost open overlay (or when nothing is registered at all).
 * @param {HTMLElement|object} layer
 * @returns {boolean}
 */
export function isTopLayer(layer) {
  return layers.length === 0 || layers[layers.length - 1] === layer;
}
