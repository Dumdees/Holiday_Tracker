// A big friendly dropdown for picking several carers (or anything) at once.
//   <MultiSelect options={carerOptions(...)} value={ids} onChange={setIds} itemNoun="carer" />
// Options may carry a `group` (team name): the panel then shows group headers with an "All <group>" tick box.
import { useContext, useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { Chip } from './Badge.jsx';
import { FieldContext, SearchBox } from './Field.jsx';
import { pluralise } from '../../core/dates.js';

/** Split options into groups, keeping the order groups were first seen in. */
function groupOptions(options) {
  const map = new Map();
  let hasGroups = false;
  for (const o of options) {
    const g = o.group || '';
    if (g) hasGroups = true;
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(o);
  }
  return { hasGroups, groups: [...map.entries()].map(([name, items]) => ({ name, items })) };
}

function matches(o, q) {
  if (!q) return true;
  return `${o.label ?? ''} ${o.sub ?? ''} ${o.group ?? ''}`.toLowerCase().includes(q);
}

function GroupHead({ name, items, selected, onToggle }) {
  const ref = useRef(null);
  const enabled = items.filter((o) => !o.disabled);
  const n = enabled.filter((o) => selected.has(o.value)).length;
  const all = enabled.length > 0 && n === enabled.length;
  const some = n > 0 && !all;
  useEffect(() => { if (ref.current) ref.current.indeterminate = some; }, [some, all]);
  return (
    <label class="ms-group-head" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onToggle(); } }}>
      <input ref={ref} class="ms-input" type="checkbox" checked={all} disabled={enabled.length === 0} onChange={onToggle} aria-label={`All ${name}`} />
      <span class="ms-ring" aria-hidden="true" />
      <span class="ms-check" aria-hidden="true" />
      <span>All {name}</span>
      <span class="ms-group-count">{n} of {items.length}</span>
    </label>
  );
}

function Row({ option: o, selected, onToggle }) {
  return (
    <label class={`ms-row ${selected ? 'is-selected' : ''} ${o.disabled ? 'is-disabled' : ''}`.trim()} onKeyDown={(e) => { if (e.key === 'Enter' && !o.disabled) { e.preventDefault(); onToggle(); } }}>
      <input class="ms-input" type="checkbox" checked={selected} disabled={o.disabled} onChange={onToggle} />
      <span class="ms-ring" aria-hidden="true" />
      <span class="ms-check" aria-hidden="true" />
      {o.colour ? <span class="ms-dot" style={{ '--dot': o.colour }} aria-hidden="true" /> : null}
      <span class="ms-text">
        <span class="ms-label">{o.label}</span>
        {o.sub ? <span class="ms-sub">{o.sub}</span> : null}
      </span>
    </label>
  );
}

/**
 * MultiSelect – trigger button showing chips of the chosen items; panel with search, select all / clear,
 * optional group headers and tick-box rows. Closes on outside click, Escape or when focus leaves it.
 * @param {object} props
 * @param {Array<{ value: any, label: string, group?: string, colour?: string, sub?: string, disabled?: boolean }>} [props.options]
 * @param {any[]} [props.value] – chosen values, in the order they were chosen
 * @param {(values: any[]) => void} [props.onChange]
 * @param {string} [props.placeholder='Choose…']
 * @param {boolean} [props.searchable=true]
 * @param {string} [props.itemNoun='carer'] – "3 carers selected"
 * @param {string} [props.itemNounPlural] – defaults to itemNoun + 's'
 * @param {string} [props.emptyText] – shown when nothing matches the search
 * @param {string} [props.id] – id of the trigger (inside a <Field>, give the id to the Field instead)
 * @param {number} [props.maxChips=3] – chips shown on the trigger before "+N more"
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.defaultOpen] – start with the panel open (used by the gallery)
 * @param {string} [props.ariaLabel] – name of the control when there is no surrounding Field
 * @param {string} [props.class]
 */
export function MultiSelect({ options = [], value = [], onChange, placeholder = 'Choose…', searchable = true, itemNoun = 'carer', itemNounPlural, emptyText, id, maxChips = 3, disabled = false, defaultOpen = false, ariaLabel, class: cls = '' }) {
  const generated = useId();
  const field = useContext(FieldContext);
  const baseId = id || field?.id || `ms-${generated}`;
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  const selected = useMemo(() => new Set(value), [value]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const chosen = useMemo(() => value.map((v) => byValue.get(v)).filter(Boolean), [value, byValue]);
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => options.filter((o) => matches(o, q)), [options, q]);
  const { hasGroups, groups } = useMemo(() => groupOptions(visible), [visible]);

  const plural = itemNounPlural || `${itemNoun}s`;
  const count = chosen.length;
  const summary = count === 0 ? `No ${plural} selected` : `${pluralise(count, itemNoun, plural)} selected`;

  const emit = (next) => onChange?.(next);
  const toggleOne = (v) => emit(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  const toggleGroup = (items) => {
    const enabled = items.filter((o) => !o.disabled);
    const all = enabled.length > 0 && enabled.every((o) => selected.has(o.value));
    if (all) emit(value.filter((v) => !enabled.some((o) => o.value === v)));
    else emit([...value, ...enabled.filter((o) => !selected.has(o.value)).map((o) => o.value)]);
  };
  const selectableVisible = visible.filter((o) => !o.disabled && !selected.has(o.value));
  const selectAll = () => emit([...value, ...selectableVisible.map((o) => o.value)]);
  const clear = () => emit([]);

  const close = (refocus = false) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  };
  const openPanel = () => { if (!disabled) setOpen(true); };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    if (!searchable) rootRef.current?.querySelector('.ms-list input:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const onRootKey = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const inputs = [...(rootRef.current?.querySelectorAll('.ms-list input:not(:disabled)') || [])];
      if (!inputs.length) return;
      const i = inputs.indexOf(document.activeElement);
      const next = i === -1 ? (e.key === 'ArrowDown' ? 0 : inputs.length - 1) : Math.min(inputs.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
      e.preventDefault();
      inputs[next].focus();
    }
  };
  const onTriggerKey = (e) => {
    if (e.target !== e.currentTarget || disabled) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open ? close() : openPanel(); }
    else if (e.key === 'ArrowDown' && !open) { e.preventDefault(); openPanel(); }
  };
  const onFocusOut = (e) => {
    if (open && e.relatedTarget && rootRef.current && !rootRef.current.contains(e.relatedTarget)) close();
  };

  const shownChips = chosen.slice(0, Math.max(0, maxChips));
  const more = chosen.length - shownChips.length;

  return (
    <div class={`multiselect ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${cls}`.trim()} ref={rootRef} onKeyDown={onRootKey} onFocusOut={onFocusOut}>
      <div
        ref={triggerRef}
        id={baseId}
        class="multiselect-trigger"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-panel` : undefined}
        aria-disabled={disabled || undefined}
        aria-labelledby={field?.labelId ? `${field.labelId} ${baseId}-summary` : undefined}
        aria-label={field?.labelId ? undefined : (ariaLabel ? `${ariaLabel}: ${summary}` : summary)}
        aria-describedby={field ? [field.errorId, field.hintId].filter(Boolean).join(' ') || undefined : undefined}
        aria-invalid={field?.invalid ? 'true' : undefined}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onTriggerKey}
      >
        <span id={`${baseId}-summary`} class="visually-hidden">{summary}</span>
        {shownChips.map((o) => (
          <Chip key={String(o.value)} label={o.label} colour={o.colour} small onRemove={disabled ? undefined : () => toggleOne(o.value)} removeLabel={`Remove ${o.label}`} />
        ))}
        {more > 0 ? <span class="multiselect-more">+{more} more</span> : null}
        {count === 0 ? <span class="multiselect-placeholder">{placeholder}</span> : null}
        <Icon name="chevron-down" className="multiselect-chevron" />
      </div>
      {open ? (
        // The inputs inside the panel must not inherit the surrounding Field's id, label or error.
        <FieldContext.Provider value={null}>
        <div class="multiselect-panel" id={`${baseId}-panel`} role="dialog" aria-label={ariaLabel || `Choose ${plural}`}>
          {searchable ? (
            <div class="ms-search">
              <SearchBox value={query} onChange={setQuery} placeholder={`Search ${plural}…`} ariaLabel={`Search ${plural}`} autoFocus />
            </div>
          ) : null}
          <div class="ms-tools">
            <span class="ms-count" aria-live="polite">{summary}</span>
            <span class="spacer" />
            <button type="button" class="btn btn-link btn-sm" onClick={selectAll} disabled={selectableVisible.length === 0}>Select all</button>
            <button type="button" class="btn btn-link btn-sm" onClick={clear} disabled={value.length === 0}>Clear</button>
          </div>
          <div class="ms-list" role="group" aria-label={plural}>
            {visible.length === 0 ? (
              <div class="ms-empty">{emptyText || (q ? `No ${plural} match “${query.trim()}”` : `No ${plural} to choose from`)}</div>
            ) : groups.map((g) => (
              <div class="ms-group" key={g.name || '_'}>
                {hasGroups ? <GroupHead name={g.name || 'Other'} items={g.items} selected={selected} onToggle={() => toggleGroup(g.items)} /> : null}
                {g.items.map((o) => <Row key={String(o.value)} option={o} selected={selected.has(o.value)} onToggle={() => toggleOne(o.value)} />)}
              </div>
            ))}
          </div>
        </div>
        </FieldContext.Provider>
      ) : null}
    </div>
  );
}
