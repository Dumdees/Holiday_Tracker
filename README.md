# Monteith Personal Care · Holiday Manager

A calm, peach-coloured holiday manager for the carers at **Monteith Personal Care**.
It keeps track of every carer's annual leave entitlement, shows who is off on a calendar,
lets you add or remove holidays in bulk with simple dropdowns, warns you about clashes,
and gives you clear reports and charts – all without anything to install.

It runs as **one file** that opens in Microsoft Edge or Google Chrome. Everything is saved
on the computer it runs on. Nothing is sent over the internet.

## Getting it onto a Windows computer

1. On this page click the green **Code** button, then **Download ZIP**.
2. Open the downloaded ZIP and copy the folder called **`Monteith Holiday Manager`** somewhere
   handy (your Desktop or Documents folder is ideal).
3. Open that folder and double-click **`Monteith Holiday Manager`** (the file with the browser icon).

That's it. The first time, a short welcome screen asks for your holiday year and teams.
You can start with sample data to explore, and clear it later from *Settings → Advanced*.

Prefer a tidy window without the browser bar? Double-click **`Open Monteith Holiday Manager`**
instead (if Windows asks whether you're sure, click *Run*). Full instructions are in
`READ ME FIRST.txt` inside the folder.

> **Keep it in one browser.** Your data lives inside the browser you use to open the app,
> so always open it the same way. Use *Settings → Backup* to save a backup file every week
> – the Home screen reminds you.

## What it does

- **Home** – who's off today and this week, what's coming up, and anything needing attention
  (clashes, holidays awaiting approval, carers running low, backup reminders).
- **Calendar** – month view with colour-coded chips per carer, a year overview heat map and a
  week list. Filter by team or leave type. Click any day to see who's off and add a holiday.
- **Carers** – an instantly searchable list of carers with their remaining days at a glance.
  Each profile shows their entitlement breakdown, pro-rata for starters and leavers,
  carry-over adjustments, working pattern and every holiday they've had.
- **Holidays** – add holidays for many carers at once from dropdowns, with a live preview
  that flags clashes in plain English before you confirm. Remove holidays in bulk. See and
  search every holiday ever recorded. Approve or decline requests.
- **Reports** – entitlement usage per carer, leave by month and by type, team capacity heat
  map, sickness, unused-leave warnings, and printable summaries. Export to a spreadsheet.
- **Settings** – company name, holiday year start, teams, leave types, UK bank holidays
  (Scotland, England & Wales or Northern Ireland), staffing rules, backups. Technical
  options are tucked away under *Advanced*.
- **Undo** on every change, half days, bank-holiday-aware day counting, and a friendly first-run
  welcome.

## For the technically minded

Source lives in `src/` (Preact + signals, plain CSS). `npm install`, then:

| Command | What it does |
| --- | --- |
| `npm run build` | Bundle everything into `Monteith Holiday Manager/Monteith Holiday Manager.html` |
| `npm test` | Unit tests for the calculation logic (`tests/unit`) |
| `npm run test:e2e` | Playwright tests that open the built file over `file://` (`tests/e2e`) |
| `npm run check` | All of the above |

See `CLAUDE.md` and `docs/SPEC.md` for the architecture, data model and product spec.
The built file is committed so the download-ZIP route always works.
