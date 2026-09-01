# Monteith Holiday Manager – working notes for contributors

A holiday (leave) manager for carers at **Monteith Personal Care**. It ships as ONE
self-contained HTML file that runs offline by double-clicking it. Nothing to install.

Read `docs/SPEC.md` for the product spec (features, data model, core APIs, design language).

## Stack
- Preact + `@preact/signals` (state), bundled with esbuild into `Monteith Holiday Manager/Monteith Holiday Manager.html`.
- Plain CSS in `src/styles/` (design tokens in `tokens.css`). No CSS framework, no runtime CDN – everything is inlined.
- Data: one JSON document held in the `db` signal (`src/store/store.js`), persisted to IndexedDB (localStorage mirror).
- Dates are ISO strings `YYYY-MM-DD` everywhere. Use helpers in `src/core/dates.js`. Never use `Date` maths directly in views.

## Commands
- `npm run build` – build the single file (`--dev` for unminified).
- `npm test` – unit tests (`tests/unit/*.test.js`, Node's built-in runner).
- `npm run test:e2e` – Playwright tests against the BUILT file over `file://` (`tests/e2e/*.test.js`). Run `npm run build` first.
- `npm run check` – all of the above.

## Conventions
- Views live in `src/ui/views/<Name>.jsx` and export a component named `<Name>` taking `{ params }`.
- Shared UI in `src/ui/components/`. Charts in `src/ui/charts/`. Pure logic in `src/core/` (no DOM, fully unit-tested).
- Every change to data goes through an action in `src/store/store.js` (they save + support undo). Never mutate `db.value` directly.
- Navigation: `navigate(view, params)` from `src/app/router.js`. Read current `route.value`.
- Toasts: `toast('Saved')`, `toast.error(...)` from `components/Toast.jsx`. Dialogs: `openModal`, `confirm`, `alert` from `components/Modal.jsx`.
- Language shown to users: plain, warm, British English, no jargon ("holiday", "carer", "team", "backup"). Never show ids, JSON, stack traces or words like "database", "sync", "cache", "schema".
- Every clickable thing is at least 44px tall. Buttons say what they do ("Add holiday", not "Submit").
- Tests: put unit tests for `src/core/x.js` in `tests/unit/x.test.js`. E2E tests use `openApp()` from `tests/e2e/helpers.js`.
- Keep the built file committed and up to date (`npm run build` before committing).
