// A round coloured circle with a person's initials.

const FALLBACK_COLOUR = '#9C8A82';

/**
 * Initials for a name: the first letter of the first two words ("Priya Sharma" → "PS").
 * @param {string} name
 * @returns {string} one or two upper-case letters, or "?" for an empty name
 */
export function initialsOf(name = '') {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => Array.from(w)[0].toUpperCase()).join('') || '?';
}

/**
 * Avatar – initials in white on the carer's colour.
 * @param {object} props
 * @param {string} [props.name] – full name; used for the initials and the hover title
 * @param {string} [props.colour] – any CSS colour (falls back to a warm grey)
 * @param {number} [props.size=36] – diameter in px
 * @param {string} [props.initials] – override the computed initials
 * @param {string} [props.class]
 * @param {string} [props.title] – hover text (defaults to the name)
 */
export function Avatar({ name = '', colour, size = 36, initials, class: cls = '', title }) {
  const style = { width: `${size}px`, height: `${size}px`, background: colour || FALLBACK_COLOUR, fontSize: `${Math.round(size * 0.4)}px` };
  return (
    <span class={`avatar ${cls}`.trim()} style={style} aria-hidden="true" title={title ?? (name || undefined)}>
      {initials || initialsOf(name)}
    </span>
  );
}
