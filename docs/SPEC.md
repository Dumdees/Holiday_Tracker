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

### Care Empire (optional game, `settings.gameEnabled`)
A Cookie-Clicker-style idle game in the menu, kept entirely separate from holiday data (saved under
`localStorage['mhm:game']`, save version 2, older saves migrated by `migrate()`). Pure engine in
`src/core/game/` (`data.js` content, `engine.js` maths, `format.js` numbers), screen in
`src/ui/views/Game.jsx`, animated street in `src/ui/game/scene.js`, state in `src/ui/game/gameStore.js`.

**The economy is two sides.** WORK is how much care is wanted (people you look after, care packages,
direct payments, council contracts, hospital discharge teams, framework places, NHS-funded care, care
groups, worldwide care, orbit stations). TEAM is how much you can deliver (carers, key safes, care
cars, coordinators, field supervisors, branch offices, training academies, nurse-led teams, assistive
tech, care starships). `visits/s = (work + team + sqrt(work × team)) / 3` – the two sides averaged
with a bonus for keeping them level – so the side that is behind is worth more per pound (the shop
says which, in a sentence) and buying either side always earns more, never less. A grid probe of
19,000 purchases across 980 boards finds none that lowers income, and a unit test holds that line.
Income = visits × visit value × global multiplier. Each purchase costs 15% more than the last; owning
10/25/50/100/200/400… of something doubles what each one does. Each rung of the ladder costs eight
times the last and delivers four, so the cheap rungs stay worth buying long after you have left them.

**Upgrades** (100, plus 9 branch options, plus an endless line) come in kinds the engine folds in
separately: `building` (kit for one rung, ×2 at ten owned, ×2.5 at sixty, ×3 at three hundred),
`synergy` (one thing lifts a whole side per unit owned, capped), `conditional` (a sliding share of
its bonus, never an on/off cliff, and never diluted by anything you buy), `milestone` (raises the
every-tenth step to 2.2× then 2.5×), `value` (what a visit is worth), `click`/`clickpct` (your own
visits, worth up to 8% of the whole business each), `collect` (office admin, direct debit), `offline`
(the on-call phone), `discount` (cheaper of one thing), and quality upgrades that also raise the
rating. Measured over an hour of play, every upgrade that earns anything moves income by at least 2%
the moment it is offered. `upgradesFor(level)` adds three rungs of kit, a doubling of visit value, a
click share and a ×1.8 for every far rung, so the shop never runs out. Three one-off `BRANCHES` per
run — who you work for, how you grow, what you are known for — reset when you hand over, and each
option in a slot is a different shape (a bonus, a discount, a flat rate) rather than a different
number; the tests judge them on what half an hour of takings buys, not on the number on the tin.

**The rating** (`RATINGS`, Newly registered → Good → Outstanding → Outstanding on every question) is
derived from coordinators, supervisors, academies, nurse-led teams, offices and quality upgrades, and
multiplies all income. Never stored, never random, never punitive.

**Handing over** (prestige) resets the run but keeps badges, Legacy Stars (`6 × log10(1 + lifetime /
1e4)`, +3% each) and perks, and leaves a starting round (`startingKit`) so a new run is never dead. A
hand-over needs the stage's figure or three times your best run ever, whichever is more. Every stage
reached is worth ×1.6 for ever, and stages past the printed ten bring two new rungs each and cost 200
times the last – so the measured curve is 8m, 4m, 2m, 1m30, then lengthening a little every stage:
6m, 7m, 7m20, 8m, 8m40, 9m30, with no wall in it. Ten perks, and then an endless one that adds 30%
to everything and costs twice the last, so Stars always have somewhere to go.

**Deciding what to buy** is legible without a wiki: `buildingOffer`/`upgradeOffer` return the exact
extra income and `paybackSeconds`, the shop prints "pays for itself in about a minute", every upgrade
tile carries one figure on its face ("+40%", "−20% to buy", "×3 a tap"), the best row is chipped, and
the milestone pip counts down to the next doubling. Upgrades that only save you a job are ranked by
how long they take to afford so they never sink out of sight. For the first couple of minutes one
line under the street says what to do next, and then stops for good.

**Nothing may be bought unless something changes on the street.** Every building and upgrade carries a
`visual` string naming the change, `scene.js` exports a `DRAWS` table covering every building, and a
unit test fails if either is missing. Key safes appear on doors, care folders on steps, sensor lights
above them, tablets in carers' hands, livery on the cars, coordinators and supervisors and nurses
walking the patch, branches on the skyline, and the office wears its sign colour, rating sticker,
star board, certificate, noticeboard and bunting.

**Flavour rules**: warm plain British English; the joke is the printer, the rota, the kettle or the
weather, never the person being looked after and never the carer; no compliance content (checks,
supervisions, sickness) is ever attached to a real colleague's name.

## 3. Behaviour rules
- **Holiday year**: starts on `settings.holidayYearStart` (default 1 April). Year key = start year,
  label "2026/27" (or "2026" for January starts). A holiday spanning the boundary is split, each piece
  counted in its own year.
- **Days used by a holiday** = number of the carer's working days (per `carer.workingDays`, ISO
  1=Mon…7=Sun, or the matching week of their `shiftPattern`) between start and end inclusive, minus bank holidays if
  `settings.bankHolidaysAreDaysOff` is true. Single-day with `halfDay` = 0.5. Leave types with
  `deductsEntitlement=false` (sick etc.) are tracked but don't reduce remaining.
- **Shift patterns**: a carer may work a repeating cycle of 2–4 weeks (`carer.shiftPattern`), e.g.
  alternate weekends (Mon–Fri, then Wed–Sun). Weeks run Monday to Sunday; `anchor` is any date in a
  week 1 and the cycle repeats forever in both directions. Every rule that asks "would they be at
  work that day" (leave counting, staffing, pairing, no-working-days, the profile calendar) uses the
  week that applies. `workingDays` is kept as the first working week for exports and defaults. The
  carer form asks which week the current week is and works the anchor out from that.
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
          shiftPattern: null | { weeks: [[1..7], …] (2–4 weeks), anchor: 'YYYY-MM-DD' (a Monday starting a week 1) },
          entitlementDays, phone, email, notes, colour, active, mustNotBeOffWith[], adjustments[{id,yearKey,days,reason,createdAt}] }
holiday = { id, carerId, start, end (inclusive), typeId, status: approved|pending|declined, halfDay: null|'am'|'pm', notes, batchId }
team = { id, name, colour, maxOffPerDay|null }
leaveType = { id, name, colour, deductsEntitlement, builtIn, archived }
```

## 5. Core module APIs (pure, unit-tested, in `src/core/`)
All implemented. Optional trailing arguments are shown in `{ }` with their defaults; every signature
below is stable – add optional parameters rather than changing or removing any of these.

- `bankHolidays.js`
  - `bankHolidaysForYear(year, region)` → `[{ date, name }]` sorted. Rule-based UK bank holidays with
    substitute days (regions: `'england-and-wales' | 'scotland' | 'northern-ireland' | 'none'`).
  - `bankHolidayMap({ region, overrides, fromYear, toYear, today })` → `Map<iso, name>` applying
    `overrides.added` / `overrides.removed` (`fromYear`/`toYear` default to a few years around `today`).
  - `bankHolidaysBetween(start, end, map)` → `[{ date, name }]`; `isBankHoliday(iso, map)`, `bankHolidayName(iso, map)`.
- `leaveDays.js`
  - `shiftPatternOf(carer)` → `{ weeks, anchor }|null`; `workingDaysOn(iso, carer)` → the days that apply that week;
    `patternWeekIndex(iso, pattern)`; `describePatternWeek(iso, carer)` ('Week 2 of 2 – Wed to Sun'); `workingDaysPerWeek(carer)`.
  - `isWorkingDay(iso, carer, ctx)`; `countLeaveDays(holidayLike, carer, ctx)` → number;
    `leaveDaysBreakdown(holidayLike, carer, ctx)` → `{ days, countedDays: [iso], skipped: [{ date, reason }] }`.
  - `ctx = { settings, bankHolidayMap, leaveTypesById, today, … }` built by `buildContext(db, { today })` in
    `context.js`. The bank-holiday map covers every recorded holiday (capped at ±50 years around today).
- `entitlement.js`
  - `entitlementForYear(carer, yearBounds, settings)` → `{ base, proRataFraction, proRated, adjustments, adjustmentTotal, total }`
  - `usageForYear(carer, yearBounds, holidays, ctx, today = ctx.today)` → `{ entitlement, taken, booked, pending, remaining, remainingAfterPending, byType: Map<typeId, days>, items: [{ holiday, days, start, end }] }`
  - `usageForAll(carers, yearBounds, holidays, ctx, today = ctx.today)` → `Map<carerId, usage>`
- `clashes.js`
  - `findClashes(proposed, db, ctx, { ignoreHolidayIds, today = ctx.today })` → `[{ kind, severity: 'block'|'warn', message, dates, relatedCarerIds, relatedHolidayIds }]`
  - `checkBatch(proposals, db, ctx, options)` → the same for several proposals at once (used by bulk add).
  - `offOnDay(iso, db, ctx, { teamId, includePending, ignoreHolidayIds, excludeCarerId })` → `[{ carer, holiday }]` –
    everyone whose holiday covers the day, whether or not they would have been working.
  - `existingProblems(db, ctx, { start, end, includePending })` → staffing/pairing/overlap problems already in the
    data, clipped to the window (for Home). A run of days over the limit is reported as one problem.
  - Staffing and pairing checks only count a carer on days they would actually be at work and on the books:
    archived carers, days before their start or after their end date, their non-working weekdays and
    bank holidays (when those are days off) are ignored. A morning half day and an afternoon half day on the
    same day do not overlap.
- `stats.js` – `whoIsOff(db, iso, ctx, { teamId, includePending })`, `absencesBetween(db, start, end, ctx, { teamId, typeIds, statuses, carerIds })`,
  `upcoming(db, today, days, ctx, opts)`, `currentlyOff(db, today, ctx, opts)`,
  `capacityByDay(db, start, end, ctx, { teamId, includePending })` → `Map<iso, count>`,
  `monthlyLeave(db, yearBounds, ctx, { teamId })` → 12 months (13 when the holiday year starts part-way through
  a month, so the short final month is not lost), `leaveByType(...)`, `dayOfWeekPattern(...)`,
  `teamSummary(db, yearBounds, ctx, today)`, `unusedLeaveAlerts(db, yearBounds, ctx, today)`,
  `lowRemainingAlerts(db, yearBounds, ctx, today, threshold = 2)`, `overdrawnAlerts(...)`, `pendingApprovals(db, ctx)`,
  `sicknessByCarer(db, yearBounds, ctx)`, `usageLeagueTable(db, yearBounds, ctx, today, { teamId })`,
  `backupStatus(settings, today)` → `{ lastBackupAt, daysSince, due }` (`daysSince` is null, never NaN, when there is no readable backup date).
- `search.js` – `searchCarers(carers, query, { teamId, role, active, sort }, lookups)`; `searchHolidays(holidays, query, filters, lookups)`;
  also `carerMatches`, `holidayMatches`, `highlight(text, query)`, `normaliseText`, `tokenise`, `groupBy`. Accents and
  letters like ø/ł/ß are folded, punctuation around a search word is ignored, and phone numbers match with or without
  the +44 prefix. Null options, lookups or list items never throw.
- `csv.js` – `toCsv(rows, columns)`, `parseCsv(text)`, `parseCsvRows(text, delimiter?)` (delimiter is detected from the
  header row – comma, semicolon or tab, plus Excel's `sep=;` line – when not given), `carersToCsv(carers, lookups)`,
  `holidaysToCsv(items)`, `parseCarersCsv(text, db)` → `{ carers, errors }`. Dates are read as UK day/month/year
  (also ISO, Excel serials and "1st May 2020"); an unambiguous month/day/year value is accepted with a warning.
- `src/store/sample.js` – `sampleDb({ today, settings })` deterministic fictional data (≈18 carers, 3 teams, ≈150 holidays
  over 2 years incl. some pending, sick, adjustments, exactly one staffing clash and one pairing clash 2–6 weeks
  ahead of `today`, 2–3 people off today). Working days respect the real bank-holiday map; `sampleCarerCsv()` gives a
  matching CSV for trying the import.

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
`installer/host` is a small .NET Framework 4.8 WinForms program hosting the single file in a WebView2
window (virtual host `monteith-holiday-manager.app`, data under `%LocalAppData%\Monteith Holiday Manager\Data`).
`scripts/windows-package.mjs` builds it, assembles `dist/Monteith Holiday Manager/` (program + HTML +
read-me), runs the program's `--smoke-test`, zips the folder and builds
`Monteith-Holiday-Manager-Setup-<version>.exe` with Inno Setup (`installer/MonteithHolidayManager.iss`:
per-user install, Desktop and Start menu icons, WebView2 runtime bootstrapped if missing). The Release
workflow runs all of this on a Windows runner and attaches both files to the GitHub release. The
`Monteith Holiday Manager/` folder in the repo keeps the plain HTML route working (double-click the file).
