// "Showing 1–25 of 132" with Previous / Next.
import { Button } from './Button.jsx';

/**
 * Page maths shared by the component and its callers.
 * @param {number} page – 1-based
 * @param {number} pageSize
 * @param {number} total
 * @returns {{ page: number, pages: number, from: number, to: number }}
 */
export function pageInfo(page, pageSize, total) {
  const size = Math.max(1, Number(pageSize) || 1);
  const count = Math.max(0, Number(total) || 0);
  const pages = Math.max(1, Math.ceil(count / size));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const from = count === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(count, current * size);
  return { page: current, pages, from, to };
}

/**
 * Pagination
 * @param {object} props
 * @param {number} props.page – 1-based
 * @param {number} props.pageSize
 * @param {number} props.total
 * @param {(page: number) => void} [props.onPageChange]
 * @param {string} [props.noun='items'] – for the "No items" wording when the list is empty
 * @param {string} [props.class]
 */
export function Pagination({ page = 1, pageSize = 25, total = 0, onPageChange, noun = 'items', class: cls = '' }) {
  const info = pageInfo(page, pageSize, total);
  return (
    <nav class={`pagination ${cls}`.trim()} aria-label="Pages">
      <span class="pagination-info" aria-live="polite">{total === 0 ? `No ${noun}` : `Showing ${info.from}–${info.to} of ${total}`}</span>
      {info.pages > 1 ? (
        <div class="pagination-btns">
          <Button size="sm" icon="chevron-left" disabled={info.page <= 1} onClick={() => onPageChange?.(info.page - 1)}>Previous</Button>
          <span class="pagination-page">Page {info.page} of {info.pages}</span>
          <Button size="sm" iconRight="chevron-right" disabled={info.page >= info.pages} onClick={() => onPageChange?.(info.page + 1)}>Next</Button>
        </div>
      ) : null}
    </nav>
  );
}
