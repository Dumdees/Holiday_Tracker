// A side panel that slides in from the right, e.g. "who's off on this day".
import { useEffect, useId, useRef } from 'preact/hooks';
import { IconButton } from './Button.jsx';
import { focusFirst, trapTab } from './focus.js';

function DrawerFrame({ title, onClose, width, footer, children, class: cls }) {
  const ref = useRef(null);
  const titleId = `drawer-${useId()}`;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    focusFirst(ref.current);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      trapTab(e, ref.current);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, []);

  return (
    <div class="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current?.(); }}>
      <aside class={`drawer ${cls}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} style={{ '--drawer-w': `${width}px` }}>
        <div class="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon="x" label="Close" onClick={() => onCloseRef.current?.()} />
        </div>
        <div class="drawer-body">{children}</div>
        {footer ? <div class="drawer-foot">{footer}</div> : null}
      </aside>
    </div>
  );
}

/**
 * Drawer – slides in from the right with a backdrop. Escape and the backdrop close it, focus moves
 * inside (and back when it closes) and the page behind stops scrolling.
 * @param {object} props
 * @param {boolean} props.open
 * @param {any} [props.title]
 * @param {() => void} props.onClose
 * @param {number} [props.width=420] – px (full width on phones)
 * @param {any} [props.children]
 * @param {any} [props.footer] – buttons pinned to the bottom
 * @param {string} [props.class]
 */
export function Drawer({ open = false, title, onClose, width = 420, children, footer, class: cls = '' }) {
  if (!open) return null;
  return <DrawerFrame title={title} onClose={onClose} width={width} footer={footer} class={cls}>{children}</DrawerFrame>;
}
