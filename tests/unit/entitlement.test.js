import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { yearBounds } from '../../src/core/holidayYear.js';
import {
  roundTo, entitlementForYear, usageForYear, usageForAll, summarise, formatDays,
} from '../../src/core/entitlement.js';

// Holiday year starts 1 April. 2026/27 runs 2026-04-01 .. 2027-03-31 (365 days).
const settings = {
  holidayYearStart: { month: 4, day: 1 },
  bankHolidaysAreDaysOff: true,
  proRataStartersAndLeavers: true,
  roundEntitlementTo: 0.5,
};
const yb2025 = yearBounds(2025, settings);
const yb2026 = yearBounds(2026, settings);
const leaveTypesById = new Map([
  ['lt_annual', { id: 'lt_annual', name: 'Annual leave', deductsEntitlement: true }],
  ['lt_sick', { id: 'lt_sick', name: 'Sick leave', deductsEntitlement: false }],
]);
const bankHolidayMap = new Map([
  ['2026-05-04', 'Early May bank holiday'],
  ['2026-05-25', 'Spring bank holiday'],
  ['2026-12-25', 'Christmas Day'],
]);
// Today is Wednesday 17 June 2026.
const TODAY = '2026-06-17';
const ctx = { settings, today: TODAY, bankHolidayMap, leaveTypesById };
const ctxFor = (patch) => ({ ...ctx, settings: { ...settings, ...patch } });

const carer = (patch = {}) => ({
  id: 'c1', firstName: 'Priya', lastName: 'Shah', workingDays: [1, 2, 3, 4, 5], entitlementDays: 28,
  startDate: '2020-01-06', endDate: null, adjustments: [], ...patch,
});
let seq = 0;
const holiday = (patch) => ({
  id: `h${++seq}`, carerId: 'c1', typeId: 'lt_annual', status: 'approved', halfDay: null, notes: '', ...patch,
});

describe('roundTo', () => {
  test('rounds to the nearest half by default, halves up', () => {
    assert.equal(roundTo(13.96), 14);
    assert.equal(roundTo(13.74), 13.5);
    assert.equal(roundTo(13.75), 14);
    assert.equal(roundTo(13.25), 13.5);
    assert.equal(roundTo(13.24), 13);
    assert.equal(roundTo(14), 14);
    assert.equal(roundTo(0), 0);
  });
  test('supports other steps', () => {
    assert.equal(roundTo(13.3, 1), 13);
    assert.equal(roundTo(13.5, 1), 14);
    assert.equal(roundTo(13.62, 0.25), 13.5);
    assert.equal(roundTo(13.63, 0.25), 13.75);
    assert.equal(roundTo(0.3, 0.1), 0.3); // no float noise
  });
  test('falsy step means no rounding', () => {
    assert.equal(roundTo(13.7, 0), 13.7);
    assert.equal(roundTo(13.7, null), 13.7);
    assert.equal(roundTo(13.7, undefined), 13.5); // undefined takes the default step
  });
  test('non-numbers become 0', () => {
    assert.equal(roundTo(undefined), 0);
    assert.equal(roundTo('abc'), 0);
    assert.equal(roundTo('13.8'), 14);
  });
});

describe('entitlementForYear', () => {
  test('full entitlement for someone employed all year', () => {
    const e = entitlementForYear(carer(), yb2026, settings);
    assert.deepEqual(e, { base: 28, proRataFraction: 1, proRated: 28, adjustments: [], adjustmentTotal: 0, total: 28 });
  });
  test('missing entitlement or adjustments are treated as zero / none', () => {
    const e = entitlementForYear({ id: 'x' }, yb2026, settings);
    assert.equal(e.base, 0);
    assert.equal(e.total, 0);
    assert.deepEqual(e.adjustments, []);
  });
  test('starter part-way through the year is pro-rated and rounded to 0.5', () => {
    // 1 Oct 2026 .. 31 Mar 2027 = 182 of 365 days: 28 × 182/365 = 13.96 → 14
    const e = entitlementForYear(carer({ startDate: '2026-10-01' }), yb2026, settings);
    assert.ok(Math.abs(e.proRataFraction - 182 / 365) < 1e-9);
    assert.equal(e.proRated, 14);
    assert.equal(e.total, 14);
    assert.equal(e.base, 28);
  });
  test('rounding step comes from settings', () => {
    const starter = carer({ startDate: '2026-10-01' });
    assert.equal(entitlementForYear(starter, yb2026, { ...settings, roundEntitlementTo: 1 }).proRated, 14);
    const unrounded = entitlementForYear(starter, yb2026, { ...settings, roundEntitlementTo: 0 }).proRated;
    assert.ok(Math.abs(unrounded - 28 * 182 / 365) < 1e-9);
    // 1 Aug 2026 start: 243/365 × 28 = 18.64 → 18.5 at 0.5, 19 at 1, 18.75 at 0.25
    const aug = carer({ startDate: '2026-08-01' });
    assert.equal(entitlementForYear(aug, yb2026, settings).proRated, 18.5);
    assert.equal(entitlementForYear(aug, yb2026, { ...settings, roundEntitlementTo: 1 }).proRated, 19);
    assert.equal(entitlementForYear(aug, yb2026, { ...settings, roundEntitlementTo: 0.25 }).proRated, 18.75);
  });
  test('leaver part-way through the year is pro-rated', () => {
    // 1 Apr .. 31 Aug 2026 = 153 of 365 days: 28 × 153/365 = 11.74 → 11.5
    const e = entitlementForYear(carer({ endDate: '2026-08-31' }), yb2026, settings);
    assert.ok(Math.abs(e.proRataFraction - 153 / 365) < 1e-9);
    assert.equal(e.proRated, 11.5);
  });
  test('starter and leaver in the same year', () => {
    // 1 Jul .. 30 Sep 2026 = 92 days: 28 × 92/365 = 7.06 → 7
    const e = entitlementForYear(carer({ startDate: '2026-07-01', endDate: '2026-09-30' }), yb2026, settings);
    assert.ok(Math.abs(e.proRataFraction - 92 / 365) < 1e-9);
    assert.equal(e.proRated, 7);
  });
  test('pro-rata switched off gives the full amount to starters and leavers', () => {
    const off = { ...settings, proRataStartersAndLeavers: false };
    assert.equal(entitlementForYear(carer({ startDate: '2026-10-01' }), yb2026, off).proRataFraction, 1);
    assert.equal(entitlementForYear(carer({ startDate: '2026-10-01' }), yb2026, off).total, 28);
    assert.equal(entitlementForYear(carer({ endDate: '2026-08-31' }), yb2026, off).total, 28);
  });
  test('start date before the year and no end date gives the full amount', () => {
    assert.equal(entitlementForYear(carer({ startDate: '2019-05-01' }), yb2026, settings).proRataFraction, 1);
    assert.equal(entitlementForYear(carer({ startDate: null }), yb2026, settings).proRataFraction, 1);
  });
  test('start date on the first day of the year gives the full amount', () => {
    const e = entitlementForYear(carer({ startDate: '2026-04-01' }), yb2026, settings);
    assert.equal(e.proRataFraction, 1);
    assert.equal(e.proRated, 28);
  });
  test('employment entirely outside the year gives nothing, whatever the pro-rata setting', () => {
    const off = { ...settings, proRataStartersAndLeavers: false };
    for (const s of [settings, off]) {
      assert.equal(entitlementForYear(carer({ startDate: '2027-06-01' }), yb2026, s).proRataFraction, 0);
      assert.equal(entitlementForYear(carer({ startDate: '2027-06-01' }), yb2026, s).total, 0);
      assert.equal(entitlementForYear(carer({ endDate: '2025-12-31' }), yb2026, s).proRataFraction, 0);
      assert.equal(entitlementForYear(carer({ endDate: '2025-12-31' }), yb2026, s).total, 0);
    }
  });
  test('adjustments count only for the matching year key (string or number)', () => {
    const c = carer({
      adjustments: [
        { id: 'a1', yearKey: '2026', days: 2, reason: 'Carried over' },
        { id: 'a2', yearKey: 2026, days: 1.5, reason: 'Bonus' },
        { id: 'a3', yearKey: '2025', days: 5, reason: 'Other year' },
        { id: 'a4', yearKey: '2026', days: -1, reason: 'Correction' },
      ],
    });
    const e = entitlementForYear(c, yb2026, settings);
    assert.deepEqual(e.adjustments.map((a) => a.id), ['a1', 'a2', 'a4']);
    assert.equal(e.adjustmentTotal, 2.5);
    assert.equal(e.total, 30.5);
    const prev = entitlementForYear(c, yb2025, settings);
    assert.deepEqual(prev.adjustments.map((a) => a.id), ['a3']);
    assert.equal(prev.total, 33);
  });
  test('adjustments apply on top of a pro-rated amount', () => {
    const c = carer({ startDate: '2026-10-01', adjustments: [{ id: 'a1', yearKey: '2026', days: 3 }] });
    const e = entitlementForYear(c, yb2026, settings);
    assert.equal(e.proRated, 14);
    assert.equal(e.adjustmentTotal, 3);
    assert.equal(e.total, 17);
  });
});

describe('usageForYear', () => {
  const holidays = [
    holiday({ id: 'past-week', start: '2026-05-11', end: '2026-05-15' }), // Mon–Fri, all before today → 5 taken
    holiday({ id: 'spans-today', start: '2026-06-15', end: '2026-06-19' }), // Mon–Fri around Wed 17 → 3 taken, 2 booked
    holiday({ id: 'future-week', start: '2026-08-03', end: '2026-08-07' }), // Mon–Fri → 5 booked
    holiday({ id: 'pending', start: '2026-09-07', end: '2026-09-08', status: 'pending' }), // Mon–Tue → 2 pending
    holiday({ id: 'declined', start: '2026-07-06', end: '2026-07-10', status: 'declined' }), // Mon–Fri → 5 declined
    holiday({ id: 'sick', start: '2026-04-13', end: '2026-04-14', typeId: 'lt_sick' }), // Mon–Tue → 2 sick
    holiday({ id: 'boundary', start: '2026-03-30', end: '2026-04-03' }), // Mon 30 Mar – Fri 3 Apr → 2 + 3 across years
    holiday({ id: 'someone-else', carerId: 'c2', start: '2026-05-11', end: '2026-05-15' }),
    holiday({ id: 'other-year', start: '2025-06-02', end: '2025-06-06' }),
  ];

  test('splits taken, booked, pending and declined correctly', () => {
    const u = usageForYear(carer(), yb2026, holidays, ctx, TODAY);
    assert.equal(u.yearKey, '2026');
    assert.equal(u.yearBounds, yb2026);
    assert.equal(u.entitlement.total, 28);
    assert.equal(u.taken, 5 + 3 + 3);
    assert.equal(u.booked, 2 + 5);
    assert.equal(u.pending, 2);
    assert.equal(u.declinedDays, 5);
    assert.equal(u.remaining, 28 - 11 - 7);
    assert.equal(u.remainingAfterPending, 28 - 11 - 7 - 2);
  });
  test('non-deducting types are in byType but never affect remaining', () => {
    const u = usageForYear(carer(), yb2026, holidays, ctx, TODAY);
    assert.equal(u.byType.get('lt_sick'), 2);
    assert.equal(u.byType.get('lt_annual'), 5 + 5 + 5 + 2 + 3);
    assert.equal(u.byType.has('lt_annual:declined'), false);
    assert.equal(u.byTypeStatus.get('lt_annual:approved'), 18);
    assert.equal(u.byTypeStatus.get('lt_annual:pending'), 2);
    assert.equal(u.byTypeStatus.get('lt_annual:declined'), 5);
    assert.equal(u.byTypeStatus.get('lt_sick:approved'), 2);
    const sickItem = u.items.find((i) => i.holiday.id === 'sick');
    assert.equal(sickItem.deducts, false);
    assert.equal(sickItem.days, 2);
  });
  test('items list only this carer’s holidays in the year, clipped, sorted, with past flag', () => {
    const u = usageForYear(carer(), yb2026, holidays, ctx, TODAY);
    assert.deepEqual(u.items.map((i) => i.holiday.id), ['boundary', 'sick', 'past-week', 'spans-today', 'declined', 'future-week', 'pending']);
    const boundary = u.items.find((i) => i.holiday.id === 'boundary');
    assert.equal(boundary.start, '2026-04-01');
    assert.equal(boundary.end, '2026-04-03');
    assert.equal(boundary.days, 3);
    assert.equal(boundary.past, true);
    assert.equal(boundary.holiday.start, '2026-03-30'); // original untouched
    const spans = u.items.find((i) => i.holiday.id === 'spans-today');
    assert.equal(spans.past, false);
    assert.equal(spans.status, 'approved');
    assert.equal(spans.deducts, true);
    assert.equal(u.items.find((i) => i.holiday.id === 'past-week').past, true);
    assert.equal(u.items.find((i) => i.holiday.id === 'declined').status, 'declined');
  });
  test('a holiday over the year boundary is counted in each year separately', () => {
    const c = carer();
    const prev = usageForYear(c, yb2025, holidays, ctx, TODAY);
    const prevItem = prev.items.find((i) => i.holiday.id === 'boundary');
    assert.equal(prevItem.start, '2026-03-30');
    assert.equal(prevItem.end, '2026-03-31');
    assert.equal(prevItem.days, 2);
    assert.equal(prev.taken, 2 + 5); // boundary piece + 'other-year'
    const next = usageForYear(c, yb2026, holidays, ctx, TODAY);
    assert.equal(next.items.find((i) => i.holiday.id === 'boundary').days, 3);
  });
  test('a holiday ending today is all taken; one starting tomorrow is all booked', () => {
    const list = [
      holiday({ id: 'ends-today', start: '2026-06-15', end: '2026-06-17' }),
      holiday({ id: 'starts-tomorrow', start: '2026-06-18', end: '2026-06-19' }),
    ];
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.taken, 3);
    assert.equal(u.booked, 2);
    assert.equal(u.items.find((i) => i.holiday.id === 'ends-today').past, true);
    assert.equal(u.items.find((i) => i.holiday.id === 'starts-tomorrow').past, false);
  });
  test('splitting around today works when today is a weekend', () => {
    const list = [holiday({ start: '2026-06-15', end: '2026-06-26' })]; // two Mon–Fri weeks
    const u = usageForYear(carer(), yb2026, list, ctx, '2026-06-20'); // Saturday
    assert.equal(u.taken, 5);
    assert.equal(u.booked, 5);
  });
  test('half days count 0.5 as taken, booked or pending', () => {
    const list = [
      holiday({ id: 'half-today', start: '2026-06-17', end: '2026-06-17', halfDay: 'am' }),
      holiday({ id: 'half-tomorrow', start: '2026-06-18', end: '2026-06-18', halfDay: 'pm' }),
      holiday({ id: 'half-pending', start: '2026-06-24', end: '2026-06-24', halfDay: 'pm', status: 'pending' }),
    ];
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.taken, 0.5);
    assert.equal(u.booked, 0.5);
    assert.equal(u.pending, 0.5);
    assert.equal(u.remaining, 27);
    assert.equal(u.remainingAfterPending, 26.5);
    assert.equal(u.items.find((i) => i.holiday.id === 'half-today').past, true);
  });
  test('bank holidays and non-working days are not used up', () => {
    const list = [holiday({ start: '2026-05-04', end: '2026-05-08' })]; // Mon 4 May is a bank holiday
    assert.equal(usageForYear(carer(), yb2026, list, ctx, TODAY).taken, 4);
    assert.equal(usageForYear(carer(), yb2026, list, ctxFor({ bankHolidaysAreDaysOff: false }), TODAY).taken, 5);
    assert.equal(usageForYear(carer({ workingDays: [1, 3, 5] }), yb2026, list, ctx, TODAY).taken, 2);
  });
  test('pending holidays reduce remainingAfterPending but not remaining', () => {
    const list = [holiday({ start: '2026-09-07', end: '2026-09-11', status: 'pending' })];
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.pending, 5);
    assert.equal(u.taken, 0);
    assert.equal(u.booked, 0);
    assert.equal(u.remaining, 28);
    assert.equal(u.remainingAfterPending, 23);
  });
  test('declined holidays never reduce anything', () => {
    const list = [holiday({ start: '2026-05-11', end: '2026-05-15', status: 'declined' })];
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.taken, 0);
    assert.equal(u.booked, 0);
    assert.equal(u.pending, 0);
    assert.equal(u.declinedDays, 5);
    assert.equal(u.remaining, 28);
    assert.equal(u.byType.has('lt_annual'), false);
    assert.equal(u.items.length, 1);
  });
  test('pending sick leave is neither pending entitlement nor deducting', () => {
    const list = [holiday({ start: '2026-09-07', end: '2026-09-08', typeId: 'lt_sick', status: 'pending' })];
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.pending, 0);
    assert.equal(u.byType.get('lt_sick'), 2);
    assert.equal(u.byTypeStatus.get('lt_sick:pending'), 2);
  });
  test('unknown leave types do not deduct', () => {
    const list = [holiday({ start: '2026-05-11', end: '2026-05-15', typeId: 'lt_gone' })];
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.taken, 0);
    assert.equal(u.byType.get('lt_gone'), 5);
    assert.equal(u.items[0].deducts, false);
  });
  test('remaining can go negative', () => {
    const list = [holiday({ start: '2026-04-06', end: '2026-05-22' })]; // 7 Mon–Fri weeks minus 1 bank holiday = 34
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.taken, 34);
    assert.equal(u.remaining, -6);
  });
  test('uses the entitlement for the year, including pro-rata and adjustments', () => {
    const c = carer({ startDate: '2026-10-01', adjustments: [{ id: 'a1', yearKey: '2026', days: 2 }] });
    const list = [holiday({ start: '2026-11-02', end: '2026-11-06' })]; // Mon–Fri
    const u = usageForYear(c, yb2026, list, ctx, TODAY);
    assert.equal(u.entitlement.total, 16);
    assert.equal(u.booked, 5);
    assert.equal(u.remaining, 11);
  });
  test('today defaults to ctx.today', () => {
    const u = usageForYear(carer(), yb2026, holidays, ctx);
    assert.deepEqual([u.taken, u.booked], [11, 7]);
    const later = usageForYear(carer(), yb2026, holidays, { ...ctx, today: '2026-12-31' });
    assert.deepEqual([later.taken, later.booked], [18, 0]);
  });
  test('no holidays gives zeros and full remaining', () => {
    const u = usageForYear(carer(), yb2026, [], ctx, TODAY);
    assert.deepEqual(
      [u.taken, u.booked, u.pending, u.remaining, u.remainingAfterPending, u.declinedDays, u.items.length, u.byType.size],
      [0, 0, 0, 28, 28, 0, 0, 0],
    );
  });
  test('sums of half days come out clean', () => {
    const list = [];
    for (let i = 0; i < 6; i++) {
      const day = `2026-06-${String(22 + i).padStart(2, '0')}`; // Mon 22 .. Sat 27 June
      list.push(holiday({ start: day, end: day, halfDay: 'am' }));
    }
    const u = usageForYear(carer(), yb2026, list, ctx, TODAY);
    assert.equal(u.booked, 2.5); // Sat is not a working day
    assert.equal(u.remaining, 25.5);
  });
});

describe('usageForAll', () => {
  const carers = [
    carer(),
    carer({ id: 'c2', firstName: 'Sam', workingDays: [1, 3, 5], entitlementDays: 20 }),
    carer({ id: 'c3', firstName: 'Jo', entitlementDays: 25 }),
  ];
  const holidays = [
    holiday({ carerId: 'c1', start: '2026-05-11', end: '2026-05-15' }), // 5 taken
    holiday({ carerId: 'c1', start: '2026-08-03', end: '2026-08-07' }), // 5 booked
    holiday({ carerId: 'c2', start: '2026-05-11', end: '2026-05-15' }), // Mon/Wed/Fri → 3 taken
    holiday({ carerId: 'c2', start: '2026-09-07', end: '2026-09-11', status: 'pending' }), // 3 pending
    holiday({ carerId: 'c2', start: '2026-04-13', end: '2026-04-14', typeId: 'lt_sick' }), // 1 sick (Mon only)
    holiday({ carerId: 'c-unknown', start: '2026-05-11', end: '2026-05-15' }),
  ];

  test('returns a usage per carer keyed by id', () => {
    const all = usageForAll(carers, yb2026, holidays, ctx, TODAY);
    assert.deepEqual([...all.keys()], ['c1', 'c2', 'c3']);
    assert.deepEqual([all.get('c1').taken, all.get('c1').booked, all.get('c1').remaining], [5, 5, 18]);
    assert.deepEqual([all.get('c2').taken, all.get('c2').pending, all.get('c2').remaining, all.get('c2').remainingAfterPending], [3, 3, 17, 14]);
    assert.equal(all.get('c2').byType.get('lt_sick'), 1);
    assert.deepEqual([all.get('c3').taken, all.get('c3').remaining, all.get('c3').items.length], [0, 25, 0]);
  });
  test('matches usageForYear for each carer', () => {
    const all = usageForAll(carers, yb2026, holidays, ctx, TODAY);
    for (const c of carers) {
      const single = usageForYear(c, yb2026, holidays, ctx, TODAY);
      assert.deepEqual(all.get(c.id).items.map((i) => i.holiday.id), single.items.map((i) => i.holiday.id));
      assert.equal(all.get(c.id).remaining, single.remaining);
    }
  });
  test('today defaults to ctx.today and empty inputs are fine', () => {
    const all = usageForAll(carers, yb2026, holidays, ctx);
    assert.equal(all.get('c1').booked, 5);
    assert.equal(usageForAll([], yb2026, holidays, ctx, TODAY).size, 0);
    assert.equal(usageForAll(carers, yb2026, [], ctx, TODAY).get('c1').remaining, 28);
  });

  describe('summarise', () => {
    test('totals over a Map of usages', () => {
      const s = summarise(usageForAll(carers, yb2026, holidays, ctx, TODAY));
      assert.deepEqual(s, { carerCount: 3, entitlement: 73, taken: 8, booked: 5, pending: 3, remaining: 60 });
    });
    test('totals over an array of usages', () => {
      const all = usageForAll(carers, yb2026, holidays, ctx, TODAY);
      assert.deepEqual(summarise([...all.values()]), summarise(all));
      assert.deepEqual(summarise(all.values()), summarise(all));
    });
    test('empty input gives zeros', () => {
      assert.deepEqual(summarise([]), { carerCount: 0, entitlement: 0, taken: 0, booked: 0, pending: 0, remaining: 0 });
      assert.deepEqual(summarise(new Map()), { carerCount: 0, entitlement: 0, taken: 0, booked: 0, pending: 0, remaining: 0 });
    });
    test('half days add up cleanly', () => {
      const list = [
        holiday({ carerId: 'c1', start: '2026-06-15', end: '2026-06-15', halfDay: 'am' }),
        holiday({ carerId: 'c3', start: '2026-06-16', end: '2026-06-16', halfDay: 'pm' }),
      ];
      const s = summarise(usageForAll(carers, yb2026, list, ctx, TODAY));
      assert.equal(s.taken, 1);
      assert.equal(s.remaining, 72);
    });
  });
});

describe('formatDays', () => {
  test('whole numbers have no decimals, halves keep one', () => {
    assert.equal(formatDays(12), '12');
    assert.equal(formatDays(12.0), '12');
    assert.equal(formatDays(12.5), '12.5');
    assert.equal(formatDays(0.5), '0.5');
    assert.equal(formatDays(-1.5), '-1.5');
    assert.equal(formatDays(0), '0');
    assert.equal(formatDays(-0), '0');
  });
  test('float noise is tidied and non-numbers show as 0', () => {
    assert.equal(formatDays(0.1 + 0.2), '0.3');
    assert.equal(formatDays(28 - 11 - 7 - 2.5), '7.5');
    assert.equal(formatDays(14.25), '14.25');
    assert.equal(formatDays(undefined), '0');
    assert.equal(formatDays(null), '0');
    assert.equal(formatDays('3.5'), '3.5');
  });
});
