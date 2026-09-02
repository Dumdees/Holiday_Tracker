// Form controls. Labels sit ABOVE fields, hints and errors below:
//   <Field label="First name" hint="As it appears on their contract" error={errors.firstName} required>
//     <TextField value={v} onChange={setV} />
//   </Field>
// Every control reads its id / described-by / invalid state from the nearest <Field> automatically.
import { createContext } from 'preact';
import { useContext, useEffect, useId, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { IconButton } from './Button.jsx';
import { formatShort, isValidISO } from '../../core/dates.js';
import { WEEKDAYS, PALETTE } from '../../store/defaults.js';

/**
 * Shared with every control inside a <Field>: { id, labelId, hintId, errorId, invalid }, or null outside one.
 * Composite controls (MultiSelect) read it for their trigger and reset it to null around their inner inputs.
 */
export const FieldContext = createContext(null);

/** id, aria-describedby and aria-invalid for a control, taken from the surrounding Field when present. */
function useFieldProps(id) {
  const f = useContext(FieldContext);
  const generated = useId();
  const finalId = id || f?.id || `c-${generated}`;
  const described = f ? [f.errorId, f.hintId].filter(Boolean).join(' ') : '';
  return { id: finalId, 'aria-describedby': described || undefined, 'aria-invalid': f?.invalid ? 'true' : undefined };
}

/** Group controls (weekdays, colours, radio cards) are named by the Field's label rather than `for`. */
function useGroupProps(id, fallbackLabel) {
  const f = useContext(FieldContext);
  return { id: id || f?.id, 'aria-labelledby': f?.labelId, 'aria-label': f?.labelId ? undefined : fallbackLabel };
}

/**
 * Field – label above, control in the middle, hint or error below.
 * @param {object} props
 * @param {any} [props.label]
 * @param {any} [props.hint] – shown under the control (hidden while there is an error)
 * @param {any} [props.error] – a sentence a person would say; marks the control invalid
 * @param {boolean} [props.required] – shows an asterisk after the label
 * @param {string} [props.id] – id given to the control (generated when omitted). Put ids here rather than on
 *   the control, so the label's `for` and the control's id always agree.
 * @param {any} [props.children] – exactly one control, usually
 * @param {boolean} [props.inline] – label and control side by side
 * @param {string} [props.class]
 */
export function Field({ label, hint, error, required = false, id, children, inline = false, class: cls = '' }) {
  const generated = useId();
  const fieldId = id || `f-${generated}`;
  const labelId = `${fieldId}-label`;
  const hintId = hint && !error ? `${fieldId}-hint` : null;
  const errorId = error ? `${fieldId}-error` : null;
  const ctx = { id: fieldId, labelId, hintId, errorId, invalid: Boolean(error) };
  const classes = ['field', inline ? 'field-inline' : '', error ? 'field-invalid' : '', cls].filter(Boolean).join(' ');
  return (
    <FieldContext.Provider value={ctx}>
      <div class={classes}>
        {label ? (
          <label class="field-label" id={labelId} for={fieldId}>
            {label}
            {required ? <span class="field-required" aria-hidden="true">*</span> : null}
          </label>
        ) : null}
        <div class="field-control">{children}</div>
        {error ? <p class="field-error" id={errorId} role="alert"><Icon name="alert-circle" />{error}</p> : null}
        {hintId ? <p class="field-hint" id={hintId}>{hint}</p> : null}
      </div>
    </FieldContext.Provider>
  );
}

/**
 * TextField – a single-line text input.
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {string} [props.placeholder]
 * @param {string} [props.type='text'] – text, email, tel, password…
 * @param {string} [props.id]
 * @param {boolean} [props.autoFocus]
 * @param {number} [props.maxLength]
 * @param {boolean} [props.disabled]
 * @param {(value: string) => void} [props.onEnter] – called when Enter is pressed
 * @param {string} [props.class]
 */
export function TextField({ value = '', onChange, placeholder, type = 'text', id, autoFocus = false, maxLength, disabled = false, onEnter, class: cls = '', ...rest }) {
  const a11y = useFieldProps(id);
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <input
      ref={ref}
      {...a11y}
      class={`input ${cls}`.trim()}
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      onInput={(e) => onChange?.(e.currentTarget.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(e.currentTarget.value); } }}
      {...rest}
    />
  );
}

function decimalsOf(step) { return Math.max(0, (String(step).split('.')[1] || '').length); }
function roundTo(n, step) { return Number(n.toFixed(Math.min(6, Math.max(decimalsOf(step), 2)))); }
function clampNumber(n, min, max) {
  if (min != null && n < min) return min;
  if (max != null && n > max) return max;
  return n;
}
function formatNumber(n) { return n == null || Number.isNaN(n) ? '' : String(Math.round(n * 100) / 100); }

/**
 * NumberField – a number with round − and + buttons. Reports `null` while empty.
 * @param {object} props
 * @param {number|null} [props.value]
 * @param {(value: number|null) => void} [props.onChange]
 * @param {number} [props.min]
 * @param {number} [props.max]
 * @param {number} [props.step=1]
 * @param {string} [props.suffix] – e.g. "days", shown inside the box
 * @param {string} [props.id]
 * @param {boolean} [props.disabled]
 * @param {string} [props.placeholder]
 * @param {string} [props.class]
 */
export function NumberField({ value = null, onChange, min, max, step = 1, suffix, id, disabled = false, placeholder, class: cls = '' }) {
  const a11y = useFieldProps(id);
  const [text, setText] = useState(formatNumber(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { last.current = value; setText(formatNumber(value)); }
  }, [value]);
  const commit = (n) => { last.current = n; onChange?.(n); };
  const onInput = (e) => {
    const t = e.currentTarget.value;
    setText(t);
    if (t.trim() === '') { commit(null); return; }
    const n = Number(t.replace(',', '.'));
    if (Number.isFinite(n)) commit(n);
  };
  const onBlur = () => {
    if (value == null) { setText(''); return; }
    const n = clampNumber(value, min, max);
    if (n !== value) commit(n);
    setText(formatNumber(n));
  };
  const nudge = (dir) => {
    const base = value == null ? (min != null ? min : 0) : value;
    const n = clampNumber(roundTo(base + dir * step, step), min, max);
    commit(n);
    setText(formatNumber(n));
  };
  const canDown = !disabled && (min == null || value == null || value > min);
  const canUp = !disabled && (max == null || value == null || value < max);
  return (
    <div class={`number-field ${cls}`.trim()}>
      <button type="button" class="number-btn" aria-label="Decrease" onClick={() => nudge(-1)} disabled={!canDown}><Icon name="minus" /></button>
      <div class={`number-field-input ${suffix ? 'has-suffix' : ''}`.trim()}>
        <input
          {...a11y}
          class="input"
          type="text"
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onInput={onInput}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); nudge(1); } else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(-1); }
          }}
        />
        {suffix ? <span class="number-suffix" aria-hidden="true">{suffix}</span> : null}
      </div>
      <button type="button" class="number-btn" aria-label="Increase" onClick={() => nudge(1)} disabled={!canUp}><Icon name="plus" /></button>
    </div>
  );
}

/**
 * TextArea – a multi-line text box.
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {number} [props.rows=3]
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 * @param {number} [props.maxLength]
 * @param {boolean} [props.disabled]
 * @param {string} [props.class]
 */
export function TextArea({ value = '', onChange, rows = 3, placeholder, id, maxLength, disabled = false, class: cls = '', ...rest }) {
  const a11y = useFieldProps(id);
  return (
    <textarea
      {...a11y}
      class={`input ${cls}`.trim()}
      rows={rows}
      value={value ?? ''}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      onInput={(e) => onChange?.(e.currentTarget.value)}
      {...rest}
    />
  );
}

/**
 * DateField – the native date picker, with the friendly date ("Mon 3 Mar 2026") beside it.
 * @param {object} props
 * @param {string} [props.value] – ISO 'YYYY-MM-DD' or ''
 * @param {(iso: string) => void} [props.onChange] – ISO or '' when cleared
 * @param {string} [props.min] – ISO
 * @param {string} [props.max] – ISO
 * @param {string} [props.id]
 * @param {boolean} [props.showFriendly=true]
 * @param {boolean} [props.disabled]
 * @param {string} [props.emptyText='No date chosen']
 * @param {string} [props.class]
 */
export function DateField({ value = '', onChange, min, max, id, showFriendly = true, disabled = false, emptyText = 'No date chosen', class: cls = '', ...rest }) {
  const a11y = useFieldProps(id);
  const valid = value && isValidISO(value) ? value : '';
  const lastSent = useRef(valid);
  const handle = (e) => {
    const raw = e.currentTarget.value;
    const next = raw && isValidISO(raw) ? raw : '';
    if (next === lastSent.current && next === valid) return;
    lastSent.current = next;
    onChange?.(next);
  };
  return (
    <div class={`date-field ${cls}`.trim()}>
      <input {...a11y} class="input" type="date" value={valid} min={min || undefined} max={max || undefined} disabled={disabled} onInput={handle} onChange={handle} {...rest} />
      {showFriendly ? <span class={`date-friendly ${valid ? '' : 'is-empty'}`.trim()} aria-hidden="true">{valid ? formatShort(valid) : emptyText}</span> : null}
    </div>
  );
}

/**
 * SelectField – a native dropdown with our own chevron. Values round-trip with their original type.
 * @param {object} props
 * @param {Array<{ value: any, label: any, disabled?: boolean } | { group: string, options: Array<{ value: any, label: any, disabled?: boolean }> }>} [props.options]
 * @param {any} [props.value]
 * @param {(value: any) => void} [props.onChange]
 * @param {string} [props.placeholder] – shown when nothing is chosen; not selectable
 * @param {string} [props.id]
 * @param {boolean} [props.disabled]
 * @param {string} [props.class]
 * @param {string} [props.ariaLabel] – when there is no visible label
 */
export function SelectField({ options = [], value, onChange, placeholder, id, disabled = false, class: cls = '', ariaLabel, ...rest }) {
  const a11y = useFieldProps(id);
  const flat = [];
  const renderOption = (o) => {
    flat.push(o);
    return <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>{o.label}</option>;
  };
  const handle = (e) => {
    const v = e.currentTarget.value;
    const match = flat.find((o) => String(o.value) === v);
    onChange?.(match ? match.value : v);
  };
  return (
    <div class={`select-wrap ${cls}`.trim()}>
      <select {...a11y} class="input" value={value == null ? '' : String(value)} disabled={disabled} onChange={handle} aria-label={ariaLabel} {...rest}>
        {placeholder ? <option value="" disabled>{placeholder}</option> : null}
        {options.map((o) => (o && o.group != null && Array.isArray(o.options)
          ? <optgroup key={o.group} label={o.group}>{o.options.map(renderOption)}</optgroup>
          : renderOption(o)))}
      </select>
      <Icon name="chevron-down" className="select-chevron" />
    </div>
  );
}

/**
 * Toggle – an on/off switch with a label and optional description.
 * @param {object} props
 * @param {boolean} [props.checked]
 * @param {(checked: boolean) => void} [props.onChange]
 * @param {any} [props.label]
 * @param {any} [props.description]
 * @param {string} [props.id]
 * @param {boolean} [props.disabled]
 * @param {string} [props.class]
 */
export function Toggle({ checked = false, onChange, label, description, id, disabled = false, class: cls = '' }) {
  const a11y = useFieldProps(id);
  return (
    <label class={`toggle ${disabled ? 'is-disabled' : ''} ${cls}`.trim()} for={a11y.id}>
      <input {...a11y} class="toggle-input" type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange?.(e.currentTarget.checked)} />
      <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
      {label || description ? (
        <span class="toggle-text">
          {label ? <span class="toggle-label">{label}</span> : null}
          {description ? <span class="toggle-desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Checkbox – a tick box with an optional label. Use `ariaLabel` when there is no visible label.
 * @param {object} props
 * @param {boolean} [props.checked]
 * @param {(checked: boolean) => void} [props.onChange]
 * @param {any} [props.label]
 * @param {boolean} [props.indeterminate] – "some of them" state (for select-all boxes)
 * @param {string} [props.id]
 * @param {boolean} [props.disabled]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.class]
 */
export function Checkbox({ checked = false, onChange, label, indeterminate = false, id, disabled = false, ariaLabel, class: cls = '' }) {
  const a11y = useFieldProps(id);
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = Boolean(indeterminate); }, [indeterminate, checked]);
  return (
    <label class={`checkbox ${label ? '' : 'no-label'} ${disabled ? 'is-disabled' : ''} ${cls}`.trim()} for={a11y.id}>
      <input ref={ref} {...a11y} class="checkbox-input" type="checkbox" checked={Boolean(checked)} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange?.(e.currentTarget.checked)} />
      <span class="checkbox-box" aria-hidden="true" />
      {label ? <span class="checkbox-label">{label}</span> : null}
    </label>
  );
}

/**
 * RadioCards – big clickable option cards; exactly one can be chosen.
 * @param {object} props
 * @param {Array<{ value: any, label: any, description?: any, icon?: string, disabled?: boolean }>} [props.options]
 * @param {any} [props.value]
 * @param {(value: any) => void} [props.onChange]
 * @param {number} [props.columns=2]
 * @param {string} [props.id]
 * @param {string} [props.name] – radio group name (generated when omitted)
 * @param {boolean} [props.disabled]
 * @param {string} [props.class]
 */
export function RadioCards({ options = [], value, onChange, columns = 2, id, name, disabled = false, class: cls = '' }) {
  const group = useGroupProps(id, 'Options');
  const generated = useId();
  const groupName = name || `rc-${generated}`;
  return (
    <div class={`radio-cards ${cls}`.trim()} role="radiogroup" {...group} style={{ '--cols': columns }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <label key={String(o.value)} class={`radio-card ${selected ? 'is-selected' : ''}`.trim()}>
            <input class="radio-card-input" type="radio" name={groupName} value={String(o.value)} checked={selected} disabled={disabled || o.disabled} onChange={() => onChange?.(o.value)} />
            <span class="radio-card-ring" aria-hidden="true" />
            {o.icon ? <span class="radio-card-icon" aria-hidden="true"><Icon name={o.icon} /></span> : null}
            <span class="radio-card-text">
              <span class="radio-card-label">{o.label}</span>
              {o.description ? <span class="radio-card-desc">{o.description}</span> : null}
            </span>
            <span class="radio-card-check" aria-hidden="true"><Icon name="check" strokeWidth={3} /></span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * WeekdayPicker – seven pill toggles, Monday to Sunday. Value is a sorted list of ISO weekdays (1 = Mon … 7 = Sun).
 * @param {object} props
 * @param {number[]} [props.value]
 * @param {(days: number[]) => void} [props.onChange]
 * @param {string} [props.id]
 * @param {boolean} [props.disabled]
 * @param {string} [props.class]
 */
export function WeekdayPicker({ value = [], onChange, id, disabled = false, class: cls = '' }) {
  const group = useGroupProps(id, 'Working days');
  const on = new Set(value);
  const toggle = (n) => {
    const next = new Set(on);
    if (next.has(n)) next.delete(n); else next.add(n);
    onChange?.([...next].sort((a, b) => a - b));
  };
  return (
    <div class={`weekday-picker ${cls}`.trim()} role="group" {...group}>
      {WEEKDAYS.map((d) => (
        <button key={d.n} type="button" class={`weekday-pill ${on.has(d.n) ? 'is-on' : ''}`.trim()} aria-pressed={on.has(d.n)} aria-label={d.long} title={d.long} disabled={disabled} onClick={() => toggle(d.n)}>
          {d.short}
        </button>
      ))}
    </div>
  );
}

const COLOUR_NAMES = {
  '#F58F5B': 'Peach', '#7BAF8E': 'Sage', '#6FA8DC': 'Sky blue', '#9B7BBF': 'Plum', '#E9A23B': 'Amber', '#D97C9A': 'Rose',
  '#4FB3A9': 'Teal', '#C25A36': 'Terracotta', '#8FA83A': 'Olive', '#5C7CC4': 'Cornflower', '#B8860B': 'Gold', '#C46A8C': 'Raspberry',
};

/**
 * ColourPicker – a row of round swatches; one is selected.
 * @param {object} props
 * @param {string} [props.value] – hex colour
 * @param {(colour: string) => void} [props.onChange]
 * @param {string[]} [props.colours=PALETTE]
 * @param {string} [props.id]
 * @param {string} [props.class]
 */
export function ColourPicker({ value, onChange, colours = PALETTE, id, class: cls = '' }) {
  const group = useGroupProps(id, 'Colour');
  const current = (value || '').toLowerCase();
  const selectedIndex = colours.findIndex((c) => c.toLowerCase() === current);
  const move = (e, i) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + colours.length) % colours.length;
    onChange?.(colours[next]);
    e.currentTarget.parentElement?.children[next]?.focus();
  };
  return (
    <div class={`colour-picker ${cls}`.trim()} role="radiogroup" {...group}>
      {colours.map((c, i) => {
        const selected = i === selectedIndex;
        const name = COLOUR_NAMES[c.toUpperCase()] || `Colour ${i + 1}`;
        const tabbable = selected || (selectedIndex === -1 && i === 0);
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            tabIndex={tabbable ? 0 : -1}
            class={`colour-swatch ${selected ? 'is-selected' : ''}`.trim()}
            style={{ '--swatch': c }}
            onClick={() => onChange?.(c)}
            onKeyDown={(e) => move(e, i)}
          >
            <Icon name="check" strokeWidth={3} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * SearchBox – a search input with a magnifier and a clear button. Escape clears it.
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {string} [props.placeholder='Search…']
 * @param {boolean} [props.autoFocus]
 * @param {string} [props.id]
 * @param {string} [props.ariaLabel='Search'] – used when there is no surrounding Field label
 * @param {(value: string) => void} [props.onEnter]
 * @param {string} [props.class]
 */
export function SearchBox({ value = '', onChange, placeholder = 'Search…', autoFocus = false, id, ariaLabel = 'Search', onEnter, class: cls = '' }) {
  const field = useContext(FieldContext);
  const a11y = useFieldProps(id);
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const clear = () => { onChange?.(''); ref.current?.focus(); };
  return (
    <div class={`search-box ${cls}`.trim()} role="search">
      <input
        ref={ref}
        {...a11y}
        class="input"
        type="search"
        value={value ?? ''}
        placeholder={placeholder}
        aria-label={field ? undefined : ariaLabel}
        autocomplete="off"
        onInput={(e) => onChange?.(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) { e.preventDefault(); e.stopPropagation(); clear(); }
          else if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(e.currentTarget.value); }
        }}
      />
      <Icon name="search" className="search-icon" />
      {value ? <IconButton icon="x" label="Clear search" size="sm" class="search-clear" onClick={clear} /> : null}
    </div>
  );
}
