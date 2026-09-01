# Monteith Holiday Manager – product & technical spec

## 1. Who it's for
Office staff at Monteith Personal Care (a home-care agency) who plan carers' holidays. They are
NOT technical. They want to open one thing, click big obvious buttons, and never see code, ids, or
jargon. British English. Dates like "Mon 3 Mar 2026". Money never appears. Days are the unit
(half days allowed).

## 2. Sections (each is its own screen, chosen from the left sidebar)
1. **Home** – today at a glance: who's off today / this week, upcoming holidays (next 14 days),
   things needing attention (clashes, awaiting approval, backup reminder, carers running low or with
   lots unused near year end), quick actions (Add holiday, Add carer, Backup now), small stats.
2. **Calendar** – month view (default) with chips per carer per day (colour = leave type, team filter,
   leave-type filter, show/hide pending), bank holidays marked, today highlighted; click a day → side
   panel listing who's off with "Add holiday on this day". Also a **Year overview** (12 mini months,
   heat-shaded by how many are off) and a **Week list** ("This week" list of absences). Prev/next/today
   navigation, jump to month/year via dropdowns.
3. **Carers** – searchable, filterable list (instant search box, team/role/active filters, sort by
   name/team/remaining). Each row/card shows avatar (initials, colour), name, team, role, a ring or bar
   of used/booked/remaining for the selected holiday year. Click → **Carer profile**: details, contact,
   working pattern, entitlement breakdown for the chosen holiday year (base, pro-rata, adjustments,
   total, taken, booked, awaiting approval, remaining), a list of their holidays (edit/remove), a
   12-month mini calendar of their absences, "Adjust entitlement" (carry-over, bonus days, with a
   reason), edit, archive (leaver) and remove (with confirm). **Add carer** form (first/last name, team,
   role, start date, working days as 7 toggles, entitlement days, phone, email, notes, "must not be off
   at the same time as…").
4. **Holidays** – three tabs:
   - **Add holidays** (bulk): dropdown pick carers (multi-select with search, "select all",
     "whole team"), From/To dates, leave type, status (Approved/Awaiting approval), half day (single
     day only), notes → live **preview** list: one line per carer with computed days, remaining after,
     and any clash warnings (blocking ones stop that line) → "Add N holidays" button. Clash warnings are
     plain English ("Priya is already off 3–5 Mar", "3 people in Day team would be off on Wed 4 Mar –
     the limit is 2", "Only 2.5 days left – this would take Sam to −1.5").
   - **Remove holidays** (bulk): filter by carers / date range / type / status → table with tick boxes
     and "select all" → "Remove selected" (confirm; undoable).
   - **All holidays** list: searchable/filterable table of every holiday (carer, dates, days, type,
     status, notes) with inline actions (approve, decline, edit, remove). Export to CSV.
5. **Reports** – choose holiday year and team. Visualisations: entitlement usage per carer (stacked
   bar: taken / booked / pending / remaining), leave by month (bars, by type), leave by type (donut),
   team capacity heat map (days when many are off), day-of-week pattern, sickness days per carer,
   unused leave league table, top stats tiles. Print button (print stylesheet) and CSV export.
6. **Settings** – friendly tabs: **General** (company name, app name, holiday year start, week starts
   on), **Teams** (add/rename/colour/max off per day), **Leave types** (add/rename/colour/counts
   towards entitlement), **Bank holidays** (region dropdown, treat-as-day-off toggle, list for the
   year with remove/restore, add custom closure day), **Staffing rules** (default max off per day,
   pro-rata on/off, rounding, unused-leave warning threshold), **Backup** (Save a backup file, Restore
   from a backup file, reminder frequency, last backup date, big reassuring copy), **Advanced**
   (collapsed by default: where data lives (plain words: "in this browser on this computer"),
   storage size, CSV import of carers, CSV export of everything, load sample data, clear all data
   (double confirm, type the word DELETE), app version, "for IT people" note).
7. **Welcome (first run only)** – 3-step wizard: (1) welcome + company name, (2) holiday year start +
   bank holiday region, (3) add your teams (chips) → "Start with sample data to explore" or "Start
   fresh". Skippable. Sets `settings.onboardingComplete`.

## 3. Behaviour rules
- **Holiday year**: starts on `settings.holidayYearStart` (default 1 April). Year key = start year,
  label "2026/27" (or "2026" for January starts). A holiday spanning the boundary is split, each piece
  counted in its own year.
- **Days used by a holiday** = number of the carer's working days (per `carer.workingDays`, ISO
  1=Mon…7=Sun) between start and end inclusive, minus bank holidays if
  `settings.bankHolidaysAreDaysOff` is true. Single-day with `halfDay` = 0.5. Leave types with
  `deductsEntitlement=false` (sick etc.) are tracked but don't reduce remaining.
- **Entitlement for a year** = `carer.entitlementDays` × pro-rata fraction (if
  `settings.proRataStartersAndLeavers` and start/end date falls inside the year), rounded to
  `settings.roundEntitlementTo` (0.5), plus the sum of `carer.adjustments` for that year key.
- **Taken** = deducting days on or before today; **Booked** = deducting days after today (approved
  only); **Awaiting approval** = pending; **Remaining** = total − taken − booked. Declined never
  counts.
- **Clashes** when proposing/editing a holiday (`src/core/clashes.js`):
  - `overlap` (block): same carer already has a non-declined holiday overlapping.
  - `staffing` (warn): on any day, number of carers in the same team who are off (approved or
    pending, any type) would exceed the team's `maxOffPerDay` (or `settings.defaultMaxOffPerDay`).
    `maxOffPerDay: null` on a team = use the default; `0` = no limit.
  - `pairing` (warn): a carer in `mustNotBeOffWith` (either direction) is off on any of those days.
  - `entitlement` (warn): remaining would go below 0 (deducting types only).
  - `no-working-days` (warn): the range contains none of the carer's working days.
  - `outside-employment` (warn): before start date or after end date.
  - `inactive` (warn): carer is archived.
- **Undo**: every add/remove/edit shows a toast with Undo (already wired in `App.jsx`).
- **Backup**: "Save a backup" downloads `Monteith Holiday Manager backup YYYY-MM-DD.json`. Home shows a
  gentle reminder when the last backup is older than `settings.backupReminderDays`.
- **Nothing leaves the computer**. No network calls at all.

## 4. Data model (see `src/store/defaults.js`)
```
db = { schemaVersion, settings, leaveTypes[], teams[], carers[], holidays[], bankHolidayOverrides{added[],removed[]} }
carer = { id, firstName, lastName, role, teamId|null, startDate|null, endDate|null, workingDays[1..7],
          entitlementDays, phone, email, notes, colour, active, mustNotBeOffWith[], adjustments[{id,yearKey,days,reason,createdAt}] }
holiday = { id, carerId, start, end (inclusive), typeId, status: approved|pending|declined, halfDay: null|'am'|'pm', notes, batchId }
team = { id, name, colour, maxOffPerDay|null }
leaveType = { id, name, colour, deductsEntitlement, builtIn, archived }
```

## 5. Core module APIs (pure, unit-tested, in `src/core/`)
Already written: `dates.js`, `holidayYear.js`. To implement:

- `bankHolidays.js`
  - `bankHolidaysForYear(year, region)` → `[{ date, name }]` sorted. Rule-based UK bank holidays with
    substitute days (regions: `'england-and-wales' | 'scotland' | 'northern-ireland' | 'none'`).
  - `bankHolidayMap({ region, overrides, fromYear, toYear })` → `Map<iso, name>` applying
    `overrides.added` / `overrides.removed`.
  - `bankHolidaysBetween(start, end, map)` → `[{ date, name }]`.
- `leaveDays.js`
  - `isWorkingDay(iso, carer, ctx)`; `countLeaveDays(holidayLike, carer, ctx)` → number;
    `leaveDaysBreakdown(holidayLike, carer, ctx)` → `{ days, countedDays: [iso], skipped: [{ date, reason }] }`.
  - `ctx = { settings, bankHolidayMap, leaveTypesById }` built by `buildContext(db)` in `context.js`.
- `entitlement.js`
  - `entitlementForYear(carer, yearBounds, settings)` → `{ base, proRataFraction, proRated, adjustments, adjustmentTotal, total }`
  - `usageForYear(carer, yearBounds, holidays, ctx, today)` → `{ entitlement, taken, booked, pending, remaining, remainingAfterPending, byType: Map<typeId, days>, items: [{ holiday, days, start, end }] }`
  - `usageForAll(carers, yearBounds, holidays, ctx, today)` → `Map<carerId, usage>`
- `clashes.js`
  - `findClashes(proposed, db, ctx, { ignoreHolidayIds, today })` → `[{ kind, severity: 'block'|'warn', message, dates, relatedCarerIds, relatedHolidayIds }]`
  - `offOnDay(iso, db, ctx, { teamId, includePending })` → `[{ carer, holiday }]`
  - `existingProblems(db, ctx, { start, end })` → clashes already in the data (for Home).
- `stats.js` – `whoIsOff(db, iso, ctx)`, `absencesBetween(db, start, end, ctx)`, `upcoming(db, today, days, ctx)`,
  `capacityByDay(db, start, end, ctx, { teamId })` → `Map<iso, count>`, `monthlyLeave(db, yearBounds, ctx, { teamId })`,
  `leaveByType(...)`, `dayOfWeekPattern(...)`, `teamSummary(db, yearBounds, ctx, today)`, `unusedLeaveAlerts(db, yearBounds, ctx, today)`,
  `lowRemainingAlerts(...)`, `pendingApprovals(db)`, `sicknessByCarer(...)`.
- `search.js` – `searchCarers(carers, query, { teamId, role, active, sort }, lookups)`; `searchHolidays(holidays, query, filters, lookups)`.
- `csv.js` – `toCsv(rows, columns)`, `parseCsv(text)`, `carersToCsv`, `holidaysToCsv`, `parseCarersCsv(text, db)` → `{ carers, errors }`.
- `src/store/sample.js` – `sampleDb({ today })` deterministic fictional data (≈18 carers, 3 teams, ≈150 holidays over 2 years incl. some pending, sick, a couple of staffing clashes and adjustments).

## 6. Design language ("peach, soft, calm")
- Tokens in `src/styles/tokens.css`. Background peach-50, cards white with 16px radius and soft shadow,
  primary buttons peach-500 → peach-600 on hover, text warm dark brown. Success sage, warning amber,
  danger rose, info sky, sick plum.
- Big friendly headings, generous whitespace, 15.5px body, 44px minimum tap targets.
- Empty states have an icon, one sentence and a button. Forms have labels ABOVE fields and hints below.
- Native `<input type="date">` (styled) for dates; native `<select>` (styled) for simple dropdowns; a
  custom `MultiSelect` for picking carers.
- Never show raw ids, JSON, or technical words. Errors are sentences a person would say.

## 7. Windows deployment
Folder `Monteith Holiday Manager/` contains the built HTML, a `.bat` launcher that opens it in Edge as
an app-style window, and a plain-English `READ ME FIRST.txt`. README.md at repo root explains download
(Code → Download ZIP), unzip, double-click.
