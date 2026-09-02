import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sampleDb, sampleCarerCsv, SAMPLE_CARERS, SAMPLE_TEAMS } from '../../src/store/sample.js';
import { PALETTE, defaultLeaveTypes } from '../../src/store/defaults.js';
import { addDays, addMonths, addYears, diffDays, eachDay, isValidISO, isoWeekday, parseLooseDate, rangesOverlap } from '../../src/core/dates.js';
import { yearBounds, yearBoundsFor } from '../../src/core/holidayYear.js';
import { buildContext } from '../../src/core/context.js';
import { countLeaveDays } from '../../src/core/leaveDays.js';
import { usageForAll } from '../../src/core/entitlement.js';
import { existingProblems, findClashes } from '../../src/core/clashes.js';
import { currentlyOff, upcoming, pendingApprovals, overdrawnAlerts } from '../../src/core/stats.js';

const TODAY = '2026-06-17'; // a Wednesday

// One "today" in every month of a year, then the awkward ones: the first two days of a
// holiday year, its last day, Christmas Day, a Sunday, and days whose deliberate clash
// would land on a bank holiday if the generator didn't know about them (Early May, 2 Jan).
const MONTHLY = ['2026-01-15', '2026-02-10', '2026-03-10', '2026-04-01', '2026-05-04', '2026-06-17', '2026-07-20', '2026-08-15', '2026-09-02', '2026-10-30', '2026-11-11', '2026-12-25'];
const AWKWARD = ['2026-04-02', '2027-03-31', '2026-08-16', '2026-04-06', '2026-04-07', '2026-12-07'];
const TODAYS = [...MONTHLY, ...AWKWARD];
const LEAVE_TYPE_IDS = new Set(defaultLeaveTypes().map((t) => t.id));

const byId = (db) => new Map(db.carers.map((c) => [c.id, c]));
const covers = (h, iso) => h.start <= iso && h.end >= iso;
const distinctCarers = (entries) => new Set(entries.map((e) => e.carer.id)).size;

/** The sample with everything the app would compute from it for `today`. */
function open(today, settings) {
  const db = sampleDb({ today, settings });
  const ctx = buildContext(db, { today });
  return { db, ctx, carers: byId(db), year: yearBoundsFor(today, db.settings), H: db.holidays };
}

/** Problems the Home screen would show: the next two months from today. */
const homeProblems = (db, ctx, today) => existingProblems(db, ctx, { start: today, end: addDays(today, 60) });

describe('sampleDb – determinism and shape', () => {
  test('is identical for the same today', () => {
    assert.equal(JSON.stringify(sampleDb({ today: TODAY })), JSON.stringify(sampleDb({ today: TODAY })));
  });

  test('changes with today (dates are relative)', () => {
    assert.notEqual(JSON.stringify(sampleDb({ today: TODAY })), JSON.stringify(sampleDb({ today: '2026-06-18' })));
  });

  test('never throws and stays deterministic for the first of every month across a year', () => {
    for (let m = 1; m <= 12; m++) {
      const today = `2026-${String(m).padStart(2, '0')}-01`;
      const a = sampleDb({ today });
      assert.equal(a.carers.length, 18, `${today}: 18 carers`);
      assert.ok(a.holidays.length >= 120, `${today}: plenty of holidays`);
      assert.equal(JSON.stringify(a), JSON.stringify(sampleDb({ today })), `${today}: same document twice`);
    }
  });

  test('defaults today to the real date when nothing is passed', () => {
    const db = sampleDb();
    assert.ok(Array.isArray(db.carers) && db.carers.length === 18);
  });

  test('has the full document shape with fixed settings', () => {
    const db = sampleDb({ today: TODAY });
    assert.equal(db.schemaVersion, 1);
    assert.deepEqual(db.bankHolidayOverrides, { added: [], removed: [] });
    assert.equal(db.leaveTypes.length, defaultLeaveTypes().length);
    assert.equal(db.settings.onboardingComplete, true);
    assert.deepEqual(db.settings.holidayYearStart, { month: 4, day: 1 });
    assert.equal(db.settings.bankHolidayRegion, 'scotland');
    assert.equal(db.settings.lastBackupAt, null);
    assert.equal(db.settings.companyName, 'Monteith Personal Care');
  });

  test('merges the settings argument but keeps the sample-critical values', () => {
    const db = sampleDb({ today: TODAY, settings: { companyName: 'Test Care Ltd', holidayYearStart: { month: 1, day: 1 }, onboardingComplete: false } });
    assert.equal(db.settings.companyName, 'Test Care Ltd');
    assert.deepEqual(db.settings.holidayYearStart, { month: 4, day: 1 });
    assert.equal(db.settings.onboardingComplete, true);
  });

  test('teams replace the defaults', () => {
    const db = sampleDb({ today: TODAY });
    assert.deepEqual(db.teams.map((t) => t.id), ['team_day', 'team_night', 'team_weekend']);
    assert.deepEqual(db.teams.map((t) => t.maxOffPerDay), [2, 1, null]);
    assert.deepEqual(db.teams, SAMPLE_TEAMS);
    assert.notEqual(db.teams[0], SAMPLE_TEAMS[0], 'teams are copies, not the shared constants');
  });

  test('is comfortably small', () => {
    assert.ok(JSON.stringify(sampleDb({ today: TODAY })).length < 400 * 1024);
  });
});

describe('sampleDb – carers', () => {
  const db = sampleDb({ today: TODAY });
  const carers = byId(db);

  test('18 carers with sequential ids matching SAMPLE_CARERS', () => {
    assert.equal(SAMPLE_CARERS.length, 18);
    assert.deepEqual(db.carers.map((c) => c.id), SAMPLE_CARERS.map((c) => c.id));
    assert.deepEqual(db.carers.map((c) => c.id), Array.from({ length: 18 }, (_, i) => `carer_s${String(i + 1).padStart(2, '0')}`));
    for (const c of db.carers) assert.ok(c.firstName && c.lastName, `${c.id} has a name`);
    assert.equal(new Set(db.carers.map((c) => `${c.firstName} ${c.lastName}`)).size, 18, 'names are unique');
  });

  test('team sizes 8 / 5 / 5 and roles from the settings list', () => {
    const count = (teamId) => db.carers.filter((c) => c.teamId === teamId).length;
    assert.equal(count('team_day'), 8);
    assert.equal(count('team_night'), 5);
    assert.equal(count('team_weekend'), 5);
    const roles = db.carers.map((c) => c.role);
    for (const r of roles) assert.ok(db.settings.roles.includes(r), `${r} is a known role`);
    assert.equal(roles.filter((r) => r === 'Senior carer').length, 2);
    assert.equal(roles.filter((r) => r === 'Care coordinator').length, 1);
    assert.equal(roles.filter((r) => r === 'Team leader').length, 1);
    assert.equal(roles.filter((r) => r === 'Carer').length, 14);
  });

  test('working patterns, entitlements and colours', () => {
    for (const c of db.carers) {
      assert.ok(c.workingDays.length >= 3 && c.workingDays.length <= 5, `${c.id} works 3–5 days`);
      for (const d of c.workingDays) assert.ok(d >= 1 && d <= 7);
      assert.ok(PALETTE.includes(c.colour), `${c.id} colour is from the palette`);
      if (c.workingDays.length === 3) assert.ok(c.entitlementDays >= 16 && c.entitlementDays <= 18, `${c.id} part-time entitlement`);
      else assert.ok(c.entitlementDays >= 20 && c.entitlementDays <= 30, `${c.id} full-time entitlement`);
    }
    assert.equal(db.carers.filter((c) => c.workingDays.length === 3).length, 5);
    const weekend = db.carers.filter((c) => c.teamId === 'team_weekend');
    assert.ok(weekend.some((c) => c.workingDays.includes(6)) && weekend.some((c) => c.workingDays.includes(7)));
    assert.ok(db.carers.filter((c) => c.workingDays.join() === '1,2,3,4,5').length >= 10, 'most are Mon–Fri');
  });

  test('start dates are spread from 2014 to two months ago (except the starter)', () => {
    const latest = addMonths(TODAY, -2);
    for (const c of db.carers) {
      assert.ok(isValidISO(c.startDate), `${c.id} has a start date`);
      if (c.id === 'carer_s08') continue;
      assert.ok(c.startDate >= '2014-01-01' && c.startDate <= latest, `${c.id} start ${c.startDate}`);
    }
    const years = new Set(db.carers.map((c) => c.startDate.slice(0, 4)));
    assert.ok(years.size >= 5, 'start dates span several years');
  });

  test('one pro-rata starter, one leaver, one archived carer', () => {
    const year = yearBoundsFor(TODAY, db.settings);
    const starter = carers.get('carer_s08');
    assert.equal(starter.startDate, addMonths(year.start, 2));
    assert.equal(starter.endDate, null);
    assert.equal(starter.active, true);

    const leavers = db.carers.filter((c) => c.active && c.endDate);
    assert.equal(leavers.length, 1);
    assert.equal(leavers[0].endDate, addDays(TODAY, 42));

    const archived = db.carers.filter((c) => !c.active);
    assert.equal(archived.length, 1);
    assert.equal(archived[0].endDate, addMonths(TODAY, -4));
    assert.ok(archived[0].startDate < archived[0].endDate);
  });

  test('contact details for about half, all clearly fake', () => {
    const withContact = db.carers.filter((c) => c.phone || c.email);
    assert.ok(withContact.length >= 7 && withContact.length <= 12, `${withContact.length} carers have contact details`);
    for (const c of db.carers) {
      if (c.phone) assert.match(c.phone, /^07700 900\d{3}$/);
      if (c.email) assert.match(c.email, /@example\.com$/);
    }
    assert.ok(db.carers.some((c) => c.notes));
  });

  test('pairing rule is set in both directions and nowhere else', () => {
    assert.deepEqual(carers.get('carer_s03').mustNotBeOffWith, ['carer_s05']);
    assert.deepEqual(carers.get('carer_s05').mustNotBeOffWith, ['carer_s03']);
    for (const c of db.carers) {
      if (c.id === 'carer_s03' || c.id === 'carer_s05') continue;
      assert.deepEqual(c.mustNotBeOffWith, []);
    }
  });

  test('adjustments for the current year', () => {
    const year = yearBoundsFor(TODAY, db.settings);
    const a2 = carers.get('carer_s02').adjustments;
    assert.equal(a2.length, 1);
    assert.equal(a2[0].days, 3);
    assert.equal(a2[0].yearKey, year.key);
    assert.equal(a2[0].reason, 'Carried over from last year');
    assert.ok(a2[0].id && a2[0].createdAt);
    const a7 = carers.get('carer_s07').adjustments;
    assert.equal(a7.length, 1);
    assert.equal(a7[0].days, 1);
    assert.equal(a7[0].reason, 'Long service');
    assert.equal(db.carers.filter((c) => c.adjustments.length).length, 2);
  });

  test('record timestamps are deterministic strings', () => {
    for (const c of db.carers) {
      assert.match(c.createdAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(c.createdAt, c.updatedAt);
    }
    assert.match(db.createdAt, /^2026-06-17T/);
  });
});

describe('sampleDb – holidays, checked the way the app checks them, for many values of today', () => {
  for (const today of TODAYS) {
    describe(`today = ${today}`, () => {
      const { db, ctx, carers, year, H } = open(today);

      test('120–200 holidays with sequential ids and valid records', () => {
        assert.ok(H.length >= 120 && H.length <= 200, `${H.length} holidays`);
        assert.deepEqual(H.map((h) => h.id), H.map((_, i) => `hol_s${String(i + 1).padStart(3, '0')}`));
        for (const h of H) {
          assert.ok(carers.has(h.carerId), `${h.id} carer exists`);
          assert.ok(isValidISO(h.start) && isValidISO(h.end), `${h.id} valid dates`);
          assert.ok(h.start <= h.end, `${h.id} start before end`);
          assert.ok(h.start >= addYears(today, -2) && h.end <= addYears(today, 2), `${h.id} within two years of today`);
          assert.ok(LEAVE_TYPE_IDS.has(h.typeId), `${h.id} known type`);
          assert.ok(['approved', 'pending', 'declined'].includes(h.status));
          assert.ok(h.halfDay === null || ((h.halfDay === 'am' || h.halfDay === 'pm') && h.start === h.end), `${h.id} half day only on a single day`);
          assert.equal(h.batchId, null);
          assert.equal(typeof h.notes, 'string');
          assert.match(h.createdAt, /^\d{4}-\d{2}-\d{2}T/);
          assert.ok(h.createdAt.slice(0, 10) <= today, `${h.id} was created no later than today`);
        }
      });

      test('holidays are sorted by start date', () => {
        for (let i = 1; i < H.length; i++) assert.ok(H[i - 1].start <= H[i].start);
      });

      test('every holiday uses at least half a day once weekends and bank holidays are taken out', () => {
        for (const h of H) {
          const days = countLeaveDays(h, carers.get(h.carerId), ctx);
          assert.ok(days >= 0.5, `${h.id} ${h.carerId} ${h.start}..${h.end} counts ${days} days`);
          if (h.halfDay) assert.equal(days, 0.5, `${h.id} is a half day`);
        }
      });

      test('no carer has overlapping holidays', () => {
        const groups = new Map();
        for (const h of H) groups.set(h.carerId, [...(groups.get(h.carerId) || []), h]);
        for (const [carerId, list] of groups) {
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              assert.ok(!rangesOverlap(list[i].start, list[i].end, list[j].start, list[j].end), `${carerId}: ${list[i].id} overlaps ${list[j].id}`);
            }
          }
        }
      });

      test('holidays stay within each carer’s employment', () => {
        for (const h of H) {
          const c = carers.get(h.carerId);
          assert.ok(h.start >= c.startDate, `${h.id} after ${c.id} started`);
          if (c.endDate) assert.ok(h.end <= c.endDate, `${h.id} before ${c.id} leaves`);
        }
      });

      test('editing any holiday would raise no warning beyond the deliberate clashes (and the archived carer)', () => {
        const archived = db.carers.find((c) => !c.active);
        for (const h of H) {
          for (const clash of findClashes(h, db, ctx, { ignoreHolidayIds: [h.id], today })) {
            assert.ok(['staffing', 'pairing', 'inactive'].includes(clash.kind), `${h.id} ${h.carerId} ${h.start}..${h.end}: ${clash.message}`);
            if (clash.kind === 'inactive') assert.equal(h.carerId, archived.id, `${h.id}: ${clash.message}`);
          }
        }
      });

      test('mostly approved annual leave, about ten requests awaiting approval, a few declined', () => {
        const annual = H.filter((h) => h.typeId === 'lt_annual');
        assert.ok(annual.length >= H.length * 0.6, 'annual leave is the majority');
        assert.ok(annual.filter((h) => h.status === 'approved').length >= annual.length * 0.7);
        const pending = pendingApprovals(db, ctx);
        assert.ok(pending.length >= 8 && pending.length <= 12, `${pending.length} pending`);
        for (const p of pending) {
          assert.ok(p.holiday.start > addDays(today, 14), `${p.holiday.id} pending is beyond the next fortnight`);
          assert.ok(p.carer.active, `${p.holiday.id} pending is for someone still here`);
          assert.ok(p.days >= 0.5, `${p.holiday.id} pending uses real days`);
        }
        assert.ok(H.some((h) => h.status === 'declined'));
      });

      test('sick leave in the past (1–3 days) and a few other types', () => {
        const sick = H.filter((h) => h.typeId === 'lt_sick');
        assert.ok(sick.length >= 8 && sick.length <= 12, `${sick.length} sick`);
        for (const h of sick) {
          assert.ok(h.end < today, `${h.id} sick leave is in the past`);
          assert.ok(eachDay(h.start, h.end).length <= 3, `${h.id} is 1–3 days`);
        }
        for (const type of ['lt_training', 'lt_compassionate', 'lt_unpaid', 'lt_toil']) {
          assert.ok(H.some((h) => h.typeId === type), `has ${type}`);
        }
      });

      test('four half days', () => {
        const halves = H.filter((h) => h.halfDay);
        assert.equal(halves.length, 4);
        assert.ok(halves.some((h) => h.halfDay === 'am') && halves.some((h) => h.halfDay === 'pm'));
        assert.ok(halves.some((h) => h.start < today) && halves.some((h) => h.start > today));
      });

      test('two or three carers are off today, one on a holiday spanning today', () => {
        const off = currentlyOff(db, today, ctx);
        const active = off.filter((a) => a.carer.active);
        assert.ok(distinctCarers(active) >= 2 && distinctCarers(active) <= 3, `${distinctCarers(active)} carers off today`);
        assert.ok(off.some((a) => a.holiday.start < today && a.holiday.end > today), 'a holiday spans today');
        if (!ctx.bankHolidayMap.has(today)) {
          assert.ok(off.some((a) => countLeaveDays({ start: today, end: today }, a.carer, ctx) === 1), 'someone who would have worked today is off');
        }
      });

      test('one holiday spans the start of the current holiday year', () => {
        const spanning = H.filter((h) => h.start < year.start && h.end >= year.start);
        // In the first week of the holiday year the "off today" holidays straddle the boundary as well.
        if (today >= addDays(year.start, 7)) assert.equal(spanning.length, 1);
        else assert.ok(spanning.length >= 1 && spanning.length <= 4, `${spanning.length} spanning`);
        assert.ok(spanning.some((h) => h.carerId === 'carer_s01' && h.typeId === 'lt_annual' && h.status === 'approved'));
      });

      test('three or four holidays start in the next 14 days', () => {
        const next = upcoming(db, today, 14, ctx);
        assert.ok(next.length >= 3 && next.length <= 4, `${next.length} upcoming`);
        for (const a of next) assert.ok(a.days >= 0.5, `${a.holiday.id} upcoming uses real days`);
      });

      test('the Home screen sees exactly one staffing clash and one pairing clash, 2–6 weeks ahead', () => {
        const problems = homeProblems(db, ctx, today);
        assert.deepEqual(problems.map((p) => p.kind).sort(), ['pairing', 'staffing'], problems.map((p) => p.message).join(' | '));
        for (const p of problems) {
          const ahead = diffDays(today, p.dates[0]);
          assert.ok(ahead >= 14 && ahead <= 42, `${p.kind} clash is ${ahead} days ahead`);
          for (const d of p.dates) assert.ok(isoWeekday(d) <= 5 && !ctx.bankHolidayMap.has(d), `${p.kind} clash on ${d} is a real working day`);
        }
        const staffing = problems.find((p) => p.kind === 'staffing');
        assert.ok(staffing.dates.length <= 2, 'the staffing clash is a day or two, not a week');
        assert.equal(staffing.carerIds.length, 3);
        for (const id of staffing.carerIds) assert.equal(carers.get(id).teamId, 'team_day');
        const pairing = problems.find((p) => p.kind === 'pairing');
        assert.deepEqual([...pairing.carerIds].sort(), ['carer_s03', 'carer_s05']);
      });

      test('no other clash anywhere in the four years the sample covers', () => {
        const all = existingProblems(db, ctx, { start: addYears(today, -2), end: addYears(today, 2) });
        assert.deepEqual(all.map((p) => `${p.kind} ${p.dates[0]}`), homeProblems(db, ctx, today).map((p) => `${p.kind} ${p.dates[0]}`));
      });

      test('nobody is over their entitlement in the previous, current or next holiday year', () => {
        for (const offset of [-1, 0, 1]) {
          const yb = yearBounds(Number(year.key) + offset, db.settings);
          for (const [id, u] of usageForAll(db.carers, yb, H, ctx, today)) {
            assert.ok(u.remaining >= 0, `${id} in ${yb.label}: ${u.remaining} left of ${u.entitlement.total}`);
            assert.ok(u.remaining <= u.entitlement.total, `${id} in ${yb.label}: ${u.remaining} left of ${u.entitlement.total}`);
            assert.ok(u.remainingAfterPending >= 0, `${id} in ${yb.label}: ${u.remainingAfterPending} left after pending`);
          }
        }
        assert.deepEqual(overdrawnAlerts(db, year, ctx, today), []);
      });

      test('annual leave used or requested this year is 20–95% of each active carer’s allowance', () => {
        for (const [id, u] of usageForAll(db.carers.filter((c) => c.active), year, H, ctx, today)) {
          if (u.entitlement.total <= 0) continue;
          const ratio = (u.taken + u.booked + u.pending) / u.entitlement.total;
          assert.ok(ratio >= 0.2 && ratio <= 0.95, `${id} uses ${(ratio * 100).toFixed(0)}%`);
        }
      });

      test('the archived carer only has past holidays', () => {
        const archived = db.carers.find((c) => !c.active);
        const theirs = H.filter((h) => h.carerId === archived.id);
        assert.ok(theirs.length >= 1);
        for (const h of theirs) assert.ok(h.end <= archived.endDate && h.end < today);
      });

      test('the starter and the leaver have holidays', () => {
        assert.ok(H.some((h) => h.carerId === 'carer_s08'));
        const leaver = db.carers.find((c) => c.active && c.endDate);
        assert.ok(H.some((h) => h.carerId === leaver.id));
      });

      test('holidays fall in the previous, current and next holiday years', () => {
        const keys = new Set();
        for (const h of H) { keys.add(h.start < year.start ? 'prev' : h.start > year.end ? 'next' : 'cur'); }
        assert.deepEqual([...keys].sort(), ['cur', 'next', 'prev']);
      });

      test('some holidays carry notes', () => {
        const notes = H.filter((h) => h.notes).map((h) => h.notes);
        assert.ok(notes.length >= 5);
        assert.ok(notes.includes('Wedding') && notes.includes('Dentist'));
      });
    });
  }
});

describe('sampleDb – when bank holidays are ordinary working days', () => {
  const { db, ctx, carers, H } = open(TODAY, { bankHolidaysAreDaysOff: false });

  test('the setting is kept and the sample still checks out', () => {
    assert.equal(db.settings.bankHolidaysAreDaysOff, false);
    for (const h of H) assert.ok(countLeaveDays(h, carers.get(h.carerId), ctx) >= 0.5, `${h.id} uses real days`);
    assert.deepEqual(homeProblems(db, ctx, TODAY).map((p) => p.kind).sort(), ['pairing', 'staffing']);
    assert.ok(distinctCarers(currentlyOff(db, TODAY, ctx)) >= 2);
  });
});

/** Minimal RFC 4180 line parser for checking the example CSV. */
function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

describe('sampleCarerCsv', () => {
  test('is a small CSV with the expected header and five carers', () => {
    const text = sampleCarerCsv();
    const lines = text.trim().split('\n');
    assert.equal(lines[0], 'First name,Last name,Team,Role,Start date,Working days,Entitlement days,Phone,Email,Notes');
    assert.equal(lines.length, 6);
    for (const line of lines.slice(1)) {
      const cells = parseCsvLine(line);
      assert.equal(cells.length, 10, `row has 10 cells: ${line}`);
      assert.ok(cells[0] && cells[1], 'has a name');
      assert.ok(['Day team', 'Night team', 'Weekend & respite'].includes(cells[2]));
      assert.match(cells[4], /^\d{2}\/\d{2}\/\d{4}$/, `start date is dd/mm/yyyy: ${cells[4]}`);
      assert.ok(isValidISO(parseLooseDate(cells[4])), `start date parses: ${cells[4]}`);
      assert.match(cells[5], /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(, (Mon|Tue|Wed|Thu|Fri|Sat|Sun))*$/);
      assert.ok(Number(cells[6]) >= 16 && Number(cells[6]) <= 30);
      if (cells[8]) assert.match(cells[8], /@example\.com$/);
    }
    assert.equal(sampleCarerCsv(), text, 'deterministic');
  });
});
