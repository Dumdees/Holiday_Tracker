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
  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!open || !pop) return;
    pop.style.setProperty('--shift', '0px');
    pop.classList.remove('is-below');
    const rect = pop.getBoundingClientRect();
    const pad = 12;
    let shift = 0;
    if (rect.left < pad) shift = pad - rect.left;
    else if (rect.right > window.innerWidth - pad) shift = window.innerWidth - pad - rect.right;
    pop.style.setProperty('--shift', `${Math.round(shift)}px`);
    if (rect.top < pad) pop.classList.add('is-below');
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
        onBlur={() => setHover(false)}
      >
        ?
      </button>
      <span class="helptip-pop" role="tooltip" id={id} ref={popRef} hidden={!open}>{text}</span>
    </span>
  );
}
