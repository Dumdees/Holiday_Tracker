// An accessible data table that turns into stacked cards on narrow screens.
//   <Table columns={[{ key: 'name', label: 'Name', sortable: true }]} rows={carers} onRowClick={open} />
import { Icon } from './Icon.jsx';
import { Checkbox, SelectField } from './Field.jsx';
import { Button } from './Button.jsx';
import { EmptyState } from './EmptyState.jsx';

const INTERACTIVE = 'a, button, input, select, textarea, label, [data-no-row-click]';

function keyOf(row, rowKey, index) {
  if (typeof rowKey === 'function') return rowKey(row);
  if (typeof rowKey === 'string') return row?.[rowKey] ?? index;
  return row?.id ?? index;
}

function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'en-GB', { numeric: true, sensitivity: 'base' });
}

/**
 * Sort rows by a column (stable; empty values last).
 * @param {object[]} rows
 * @param {Array<{ key: string, sortValue?: (row: object) => any }>} columns
 * @param {{ key: string, dir: 'asc'|'desc' } | null | undefined} sort
 * @returns {object[]}
 */
export function sortRows(rows, columns, sort) {
  if (!sort?.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const get = col.sortValue || ((r) => r?.[col.key]);
  const dir = sort.dir === 'desc' ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i, v: get(r) }))
    .sort((a, b) => compare(a.v, b.v) * dir || a.i - b.i)
    .map((x) => x.r);
}

/**
 * Table
 * @param {object} props
 * @param {Array<{ key: string, label: any, render?: (row: object) => any, align?: 'left'|'right'|'center', width?: string|number, sortable?: boolean, sortValue?: (row: object) => any, hideOnMobile?: boolean, class?: string }>} props.columns
 * @param {object[]} props.rows
 * @param {string|((row: object) => any)} [props.rowKey='id']
 * @param {(row: object) => void} [props.onRowClick] – rows become clickable and keyboard focusable
 * @param {boolean} [props.selectable] – tick box per row plus a select-all box in the header
 * @param {Set<any>} [props.selected] – keys of selected rows
 * @param {(selected: Set<any>) => void} [props.onSelectedChange]
 * @param {{ key: string, dir: 'asc'|'desc' }} [props.sort]
 * @param {(sort: { key: string, dir: 'asc'|'desc' }) => void} [props.onSortChange]
 * @param {boolean} [props.sortRows=true] – false when the rows are already sorted by the caller
 * @param {any} [props.emptyState] – shown instead of rows when there are none
 * @param {boolean} [props.stickyHeader]
 * @param {boolean} [props.dense]
 * @param {(row: object) => string} [props.rowClass]
 * @param {string} [props.caption] – hidden caption for screen readers
 * @param {string} [props.ariaLabel]
 * @param {(row: object) => string} [props.rowLabel] – plain name of a row ("Priya Sharma") used to name its tick box;
 *   defaults to the first column's value when that is text
 * @param {string} [props.class]
 */
export function Table({ columns = [], rows = [], rowKey = 'id', onRowClick, selectable = false, selected, onSelectedChange, sort, onSortChange, sortRows: doSort = true, emptyState, stickyHeader = false, dense = false, rowClass, caption, ariaLabel, rowLabel, class: cls = '' }) {
  const sel = selected instanceof Set ? selected : new Set(selected || []);
  const list = doSort ? sortRows(rows, columns, sort) : rows;
  const keys = list.map((r, i) => keyOf(r, rowKey, i));
  const allSelected = keys.length > 0 && keys.every((k) => sel.has(k));
  const someSelected = !allSelected && keys.some((k) => sel.has(k));
  const colCount = columns.length + (selectable ? 1 : 0);

  const toggleAll = (checked) => {
    const next = new Set(sel);
    for (const k of keys) { if (checked) next.add(k); else next.delete(k); }
    onSelectedChange?.(next);
  };
  const toggleOne = (k, checked) => {
    const next = new Set(sel);
    if (checked) next.add(k); else next.delete(k);
    onSelectedChange?.(next);
  };
  const headerClick = (col) => {
    const dir = sort?.key === col.key && sort?.dir === 'asc' ? 'desc' : 'asc';
    onSortChange?.({ key: col.key, dir });
  };
  const cellClass = (col, extra = '') => [col.align ? `al-${col.align}` : '', col.hideOnMobile ? 'col-mobile-hide' : '', col.class || '', extra].filter(Boolean).join(' ') || undefined;
  const rowClick = (e, row) => {
    if (e.target !== e.currentTarget && e.target.closest?.(INTERACTIVE)) return;
    onRowClick(row);
  };
  const nameOf = (row) => {
    if (typeof rowLabel === 'function') return rowLabel(row);
    const first = columns[0] ? row?.[columns[0].key] : null;
    return typeof first === 'string' || typeof first === 'number' ? String(first) : '';
  };
  const rowKeyDown = (e, row) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row); }
  };

  // Phones hide the header row (rows become cards), so its select-all box and sort buttons move to a small bar.
  const sortable = onSortChange ? columns.filter((c) => c.sortable) : [];
  const sortOptions = sortable.flatMap((c) => [
    { value: `${c.key}:asc`, label: typeof c.label === 'string' ? c.label : c.key },
    { value: `${c.key}:desc`, label: `${typeof c.label === 'string' ? c.label : c.key} (reversed)` },
  ]);
  const showBar = list.length > 0 && (selectable || sortOptions.length > 0);
  const selectedCount = keys.filter((k) => sel.has(k)).length;

  return (
    <div class={`table-wrap ${stickyHeader ? 'is-sticky' : ''} ${cls}`.trim()}>
      {showBar ? (
        <div class="table-mobile-bar">
          {selectable ? (
            <Button size="sm" variant="ghost" icon={allSelected ? 'x' : 'check'} onClick={() => toggleAll(!allSelected)}>
              {allSelected ? 'Clear selection' : keys.length === 1 ? 'Select it' : `Select all ${keys.length}`}
            </Button>
          ) : null}
          {selectable && selectedCount && !allSelected ? <span class="muted">{selectedCount} selected</span> : null}
          {sortOptions.length ? (
            <label class="table-sort">
              <span>Sort by</span>
              <SelectField options={sortOptions} placeholder="Choose…" value={sort?.key ? `${sort.key}:${sort.dir === 'desc' ? 'desc' : 'asc'}` : ''} ariaLabel="Sort by" onChange={(v) => { const [key, dir] = String(v).split(':'); if (key) onSortChange({ key, dir: dir === 'desc' ? 'desc' : 'asc' }); }} />
            </label>
          ) : null}
        </div>
      ) : null}
      <table class={`table ${dense ? 'table-dense' : ''} ${stickyHeader ? 'table-sticky' : ''}`.trim()} aria-label={ariaLabel}>
        {caption ? <caption class="visually-hidden">{caption}</caption> : null}
        <thead>
          <tr>
            {selectable ? (
              <th class="th-select" scope="col">
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} ariaLabel={allSelected ? 'Unselect all' : 'Select all'} />
              </th>
            ) : null}
            {columns.map((col) => {
              const sorted = sort?.key === col.key;
              const ariaSort = col.sortable ? (sorted ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none') : undefined;
              return (
                <th key={col.key} scope="col" class={cellClass(col)} style={col.width ? { width: col.width } : undefined} aria-sort={ariaSort}>
                  {col.sortable ? (
                    <button type="button" class="th-sort" onClick={() => headerClick(col)}>
                      <span>{col.label}</span>
                      <Icon name={sorted && sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'} />
                    </button>
                  ) : <span>{col.label}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td class="table-empty" colSpan={colCount}>
                {emptyState ?? <EmptyState compact icon="search" title="Nothing to show" />}
              </td>
            </tr>
          ) : list.map((row, i) => {
            const k = keys[i];
            const isSelected = sel.has(k);
            const classes = [isSelected ? 'is-selected' : '', onRowClick ? 'is-clickable' : '', selectable ? 'has-select' : '', rowClass?.(row) || ''].filter(Boolean).join(' ') || undefined;
            return (
              <tr
                key={k}
                class={classes}
                onClick={onRowClick ? (e) => rowClick(e, row) : undefined}
                onKeyDown={onRowClick ? (e) => rowKeyDown(e, row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {selectable ? (
                  <td class="td-select">
                    <Checkbox checked={isSelected} onChange={(c) => toggleOne(k, c)} ariaLabel={`${isSelected ? 'Unselect' : 'Select'} ${nameOf(row) || 'this row'}`} />
                  </td>
                ) : null}
                {columns.map((col, ci) => (
                  <td key={col.key} class={cellClass(col, ci === 0 ? 'td-primary' : '')} data-label={typeof col.label === 'string' ? col.label : undefined}>
                    {col.render ? col.render(row) : row?.[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
