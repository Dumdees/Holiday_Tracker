// A small round "?" that explains something in a sentence when clicked or hovered.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';

/**
 * HelpTip
 * @param {object} props
 * @param {any} props.text – the explanation
 * @param {string} [props.label='More information'] – accessible name of the button
 * @param {boolean} [props.defaultOpen] – start open (used by the gallery)
 * @param {string} [props.class]
 */
export function HelpTip({ text, label = 'More information', defaultOpen = false, class: cls = '' }) {
  const id = `tip-${useId()}`;
  const [pinned, setPinned] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  const ref = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setPinned(false); };
    const onKey = (e) => { if (e.key === 'Escape') setPinned(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  // Keep the popover inside the window: nudge sideways, flip below when there is no room above.
  // Worked out from the button's position and the popover's own size rather than the popover's
  // rendered box, which is mid-animation (and mid-transform) at this point.
  useLayoutEffect(() => {
    const pop = popRef.current;
    const btn = ref.current?.querySelector('.helptip-btn');
    if (!open || !pop || !btn) return;
    const pad = 12;
    // The layout viewport, not window.innerWidth: phones report the zoomed-out visual viewport there.
    const viewW = document.documentElement.clientWidth || window.innerWidth;
    const b = btn.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const wanted = b.left + b.width / 2 - w / 2; // centred on the button
    const left = Math.max(pad, Math.min(viewW - pad - w, wanted));
    pop.style.setProperty('--shift', `${Math.round(left - wanted)}px`);
    pop.classList.toggle('is-below', b.top - h - 10 < pad);
  }, [open, text]);

  return (
    <span class={`helptip ${cls}`.trim()} ref={ref}>
      <button
        type="button"
        class="helptip-btn"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => { setHover(false); setPinned(false); }}
      >
        ?
      </button>
      <span class="helptip-pop" role="tooltip" id={id} ref={popRef} hidden={!open}>{text}</span>
    </span>
  );
}
