import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sampleDb, sampleCarerCsv, SAMPLE_CARERS, SAMPLE_TEAMS } from '../../src/store/sample.js';
import { PALETTE, defaultLeaveTypes } from '../../src/store/defaults.js';
import { addDays, addMonths, addYears, eachDay, isValidISO, isoWeekday, parseLooseDate, rangesOverlap } from '../../src/core/dates.js';
import { yearBoundsFor, employedFractionOfYear } from '../../src/core/holidayYear.js';

const TODAY = '2026-06-17'; // a Wednesday
// A spread of "todays": mid-year, the first days of a holiday year, its last day,
// Christmas Day, a Saturday, a Sunday, a bank holiday Monday and a late-March day.
const TODAYS = ['2026-06-17', '2026-04-01', '2026-04-02', '2027-03-31', '2026-12-25', '2026-08-15', '2026-08-16', '2026-05-04', '2026-03-10'];
const LEAVE_TYPE_IDS = new Set(defaultLeaveTypes().map((t) => t.id));

const byId = (db) => new Map(db.carers.map((c) => [c.id, c]));
const isWorking = (iso, carer) => carer.workingDays.includes(isoWeekday(iso));
const workingDays = (h, carer) => eachDay(h.start, h.end).filter((d) => isWorking(d, carer)).length;
const covers = (h, iso) => h.start <= iso && h.end >= iso;
const approvedAnnual = (h) => h.typeId === 'lt_annual' && h.status === 'approved';

/** Approximate annual-leave usage for the current holiday year as a fraction of the allowance. */
function usageRatio(db, carer, today) {
  const year = yearBoundsFor(today, db.settings);
  const fraction = employedFractionOfYear(year, carer.startDate, carer.endDate);
  const adjustments = carer.adjustments.filter((a) => a.yearKey === year.key).reduce((n, a) => n + a.days, 0);
  const total = Math.round(carer.entitlementDays * fraction * 2) / 2 + adjustments;
  if (total <= 0) return null;
  let used = 0;
  for (const h of db.holidays) {
    if (h.carerId !== carer.id || h.typeId !== 'lt_annual' || h.status === 'declined') continue;
    for (const d of eachDay(h.start, h.end)) {
      if (d >= year.start && d <= year.end && isWorking(d, carer)) used += h.halfDay ? 0.5 : 1;
    }
  }
  return used / total;
}

describe('sampleDb – determinism and shape', () => {
  test('is identical for the same today', () => {
    assert.equal(JSON.stringify(sampleDb({ today: TODAY })), JSON.stringify(sampleDb({ today: TODAY })));
  });

  test('changes with today (dates are relative)', () => {
    assert.notEqual(JSON.stringify(sampleDb({ today: TODAY })), JSON.stringify(sampleDb({ today: '2026-06-18' })));
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

describe('sampleDb – holidays (for several values of today)', () => {
  for (const today of TODAYS) {
    describe(`today = ${today}`, () => {
      const db = sampleDb({ today });
      const carers = byId(db);
      const year = yearBoundsFor(today, db.settings);
      const H = db.holidays;

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

      test('every holiday has at least one of the carer’s working days', () => {
        for (const h of H) assert.ok(workingDays(h, carers.get(h.carerId)) >= 1, `${h.id} ${h.start}..${h.end}`);
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

      test('mostly approved annual leave, some pending in the future, a few declined', () => {
        const annual = H.filter((h) => h.typeId === 'lt_annual');
        assert.ok(annual.length >= H.length * 0.6, 'annual leave is the majority');
        assert.ok(annual.filter((h) => h.status === 'approved').length >= annual.length * 0.7);
        const pending = H.filter((h) => h.status === 'pending');
        assert.ok(pending.length >= 5 && pending.length <= 12, `${pending.length} pending`);
        for (const h of pending) assert.ok(h.start > today, `${h.id} pending is in the future`);
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

      test('at least two active carers are off today, one on a holiday spanning today', () => {
        const off = H.filter((h) => h.status === 'approved' && covers(h, today) && carers.get(h.carerId).active);
        assert.ok(new Set(off.map((h) => h.carerId)).size >= 2, 'two carers off today');
        assert.ok(off.some((h) => h.start < today && h.end > today), 'a holiday spans today');
        assert.ok(off.some((h) => isWorking(today, carers.get(h.carerId))), 'someone who works today is off');
      });

      test('one holiday spans the start of the current holiday year', () => {
        const spanning = H.filter((h) => h.start < year.start && h.end >= year.start);
        // In the first week of the holiday year the "off today" holidays straddle the boundary as well.
        if (today >= addDays(year.start, 7)) assert.equal(spanning.length, 1);
        else assert.ok(spanning.length >= 1 && spanning.length <= 4, `${spanning.length} spanning`);
        assert.ok(spanning.some((h) => h.carerId === 'carer_s01' && h.typeId === 'lt_annual' && h.status === 'approved'));
      });

      test('3–4 holidays start in the next 14 days', () => {
        const upcoming = H.filter((h) => h.start > today && h.start <= addDays(today, 14));
        assert.ok(upcoming.length >= 3 && upcoming.length <= 4, `${upcoming.length} upcoming`);
      });

      test('one deliberate staffing clash in the Day team 3–5 weeks ahead', () => {
        const clashDays = [];
        for (const day of eachDay(addDays(today, 21), addDays(today, 35))) {
          const off = new Set(H.filter((h) => approvedAnnual(h) && covers(h, day) && carers.get(h.carerId).teamId === 'team_day').map((h) => h.carerId));
          if (off.size >= 3) clashDays.push(day);
        }
        assert.ok(clashDays.length >= 1, 'a day with three Day-team carers off');
        assert.ok(clashDays.length <= 3, 'the clash is a single day or two, not a week');
        assert.ok(clashDays.every((d) => isoWeekday(d) <= 5), 'on a working day');
      });

      test('no other day exceeds a team’s max off per day', () => {
        const capOf = (teamId) => db.teams.find((t) => t.id === teamId).maxOffPerDay ?? db.settings.defaultMaxOffPerDay;
        const overs = [];
        for (const day of eachDay(addYears(today, -2), addYears(today, 2))) {
          for (const team of db.teams) {
            const off = new Set(H.filter((h) => h.status !== 'declined' && covers(h, day) && carers.get(h.carerId).teamId === team.id).map((h) => h.carerId));
            if (off.size > capOf(team.id)) overs.push(day);
          }
        }
        assert.ok(overs.length >= 1 && overs.length <= 3, `only the deliberate clash breaks a limit (${overs.join(', ')})`);
        assert.ok(overs.every((d) => d >= addDays(today, 21) && d <= addDays(today, 35)));
      });

      test('one pairing clash between Callum and Ewan 2–4 weeks ahead', () => {
        const days = eachDay(addDays(today, 14), addDays(today, 28)).filter((day) =>
          H.some((h) => h.carerId === 'carer_s03' && approvedAnnual(h) && covers(h, day)) &&
          H.some((h) => h.carerId === 'carer_s05' && approvedAnnual(h) && covers(h, day)));
        assert.ok(days.length >= 1, 'both off on the same day');
        const others = eachDay(addYears(today, -2), addYears(today, 2)).filter((day) =>
          !days.includes(day) &&
          H.some((h) => h.carerId === 'carer_s03' && h.status !== 'declined' && covers(h, day)) &&
          H.some((h) => h.carerId === 'carer_s05' && h.status !== 'declined' && covers(h, day)));
        assert.deepEqual(others, [], 'no accidental pairing clashes');
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

      test('annual leave used this year is 20–95% of each active carer’s allowance', () => {
        for (const c of db.carers) {
          if (!c.active) continue;
          const ratio = usageRatio(db, c, today);
          if (ratio === null) continue;
          assert.ok(ratio >= 0.2 && ratio <= 0.95, `${c.id} uses ${(ratio * 100).toFixed(0)}%`);
        }
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
