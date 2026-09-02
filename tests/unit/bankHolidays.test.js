import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGIONS,
  easterSunday,
  bankHolidaysForYear,
  bankHolidayMap,
  bankHolidaysBetween,
  isBankHoliday,
  bankHolidayName,
} from '../../src/core/bankHolidays.js';
import { isValidISO, isWeekend } from '../../src/core/dates.js';

const EW = 'england-and-wales';
const SCOT = 'scotland';
const NI = 'northern-ireland';

const dates = (list) => list.map((x) => x.date);
const inYear = (year, monthDays) => monthDays.map((md) => `${year}-${md}`);
const nameOf = (list, date) => list.find((x) => x.date === date)?.name;

function assertYear(region, year, monthDays) {
  assert.deepEqual(dates(bankHolidaysForYear(year, region)), inYear(year, monthDays));
}

describe('REGIONS', () => {
  test('lists the four supported regions in order', () => {
    assert.deepEqual(REGIONS, ['england-and-wales', 'scotland', 'northern-ireland', 'none']);
  });
});

describe('easterSunday', () => {
  test('matches known Easter dates', () => {
    assert.equal(easterSunday(1818), '1818-03-22'); // earliest possible
    assert.equal(easterSunday(1943), '1943-04-25'); // latest possible
    assert.equal(easterSunday(2000), '2000-04-23');
    assert.equal(easterSunday(2024), '2024-03-31');
    assert.equal(easterSunday(2025), '2025-04-20');
    assert.equal(easterSunday(2026), '2026-04-05');
    assert.equal(easterSunday(2027), '2027-03-28');
    assert.equal(easterSunday(2038), '2038-04-25');
  });

  test('is always a valid Sunday between 22 March and 25 April', () => {
    for (let y = 1900; y <= 2100; y++) {
      const iso = easterSunday(y);
      assert.ok(isValidISO(iso), iso);
      assert.ok(iso >= `${y}-03-22` && iso <= `${y}-04-25`, iso);
      assert.equal(new Date(iso + 'T12:00:00').getDay(), 0, `${iso} should be a Sunday`);
    }
  });
});

describe('bankHolidaysForYear – England & Wales', () => {
  test('2024', () => assertYear(EW, 2024, ['01-01', '03-29', '04-01', '05-06', '05-27', '08-26', '12-25', '12-26']));
  test('2025', () => assertYear(EW, 2025, ['01-01', '04-18', '04-21', '05-05', '05-26', '08-25', '12-25', '12-26']));
  test('2026', () => assertYear(EW, 2026, ['01-01', '04-03', '04-06', '05-04', '05-25', '08-31', '12-25', '12-28']));
  test('2027', () => assertYear(EW, 2027, ['01-01', '03-26', '03-29', '05-03', '05-31', '08-30', '12-27', '12-28']));

  test('names follow gov.uk', () => {
    const list = bankHolidaysForYear(2024, EW);
    assert.equal(nameOf(list, '2024-01-01'), "New Year's Day");
    assert.equal(nameOf(list, '2024-03-29'), 'Good Friday');
    assert.equal(nameOf(list, '2024-04-01'), 'Easter Monday');
    assert.equal(nameOf(list, '2024-05-06'), 'Early May bank holiday');
    assert.equal(nameOf(list, '2024-05-27'), 'Spring bank holiday');
    assert.equal(nameOf(list, '2024-08-26'), 'Summer bank holiday');
    assert.equal(nameOf(list, '2024-12-25'), 'Christmas Day');
    assert.equal(nameOf(list, '2024-12-26'), 'Boxing Day');
  });
});

describe('bankHolidaysForYear – Scotland', () => {
  test('2024', () => assertYear(SCOT, 2024, ['01-01', '01-02', '03-29', '05-06', '05-27', '08-05', '12-02', '12-25', '12-26']));
  test('2025', () => assertYear(SCOT, 2025, ['01-01', '01-02', '04-18', '05-05', '05-26', '08-04', '12-01', '12-25', '12-26']));
  test('2026', () => assertYear(SCOT, 2026, ['01-01', '01-02', '04-03', '05-04', '05-25', '08-03', '11-30', '12-25', '12-28']));
  test('2027', () => assertYear(SCOT, 2027, ['01-01', '01-04', '03-26', '05-03', '05-31', '08-02', '11-30', '12-27', '12-28']));

  test('has no Easter Monday', () => {
    assert.ok(!bankHolidaysForYear(2026, SCOT).some((x) => x.name === 'Easter Monday'));
  });

  test('2022: 1 Jan (Sat) and 2 Jan (Sun) become Mon 3 and Tue 4', () => {
    const list = bankHolidaysForYear(2022, SCOT);
    assert.equal(nameOf(list, '2022-01-03'), "New Year's Day (substitute day)");
    assert.equal(nameOf(list, '2022-01-04'), '2 January (substitute day)');
  });

  test('2023: 2 Jan is a Monday and stays put; New Year\'s Day moves past it to Tue 3', () => {
    const list = bankHolidaysForYear(2023, SCOT);
    assert.equal(nameOf(list, '2023-01-02'), '2 January');
    assert.equal(nameOf(list, '2023-01-03'), "New Year's Day (substitute day)");
    assert.equal(nameOf(list, '2023-01-01'), undefined);
  });
});

describe('bankHolidaysForYear – Northern Ireland', () => {
  test('2024', () => assertYear(NI, 2024, ['01-01', '03-18', '03-29', '04-01', '05-06', '05-27', '07-12', '08-26', '12-25', '12-26']));
  test('2025', () => assertYear(NI, 2025, ['01-01', '03-17', '04-18', '04-21', '05-05', '05-26', '07-14', '08-25', '12-25', '12-26']));
  test('2026', () => assertYear(NI, 2026, ['01-01', '03-17', '04-03', '04-06', '05-04', '05-25', '07-13', '08-31', '12-25', '12-28']));

  test('substitute names for St Patrick\'s Day and Battle of the Boyne', () => {
    assert.equal(nameOf(bankHolidaysForYear(2024, NI), '2024-03-18'), "St Patrick's Day (substitute day)");
    assert.equal(nameOf(bankHolidaysForYear(2025, NI), '2025-07-14'), 'Battle of the Boyne (substitute day)');
  });
});

describe('bankHolidaysForYear – one-off days', () => {
  test('2022: Platinum Jubilee moves the Spring bank holiday and adds a day; State Funeral added', () => {
    const list = dates(bankHolidaysForYear(2022, EW));
    assert.ok(list.includes('2022-06-02'));
    assert.ok(list.includes('2022-06-03'));
    assert.ok(list.includes('2022-09-19'));
    assert.ok(!list.includes('2022-05-30'));
  });

  test('2022 applies to every region', () => {
    for (const region of [EW, SCOT, NI]) {
      const list = dates(bankHolidaysForYear(2022, region));
      assert.ok(list.includes('2022-06-02'), region);
      assert.ok(list.includes('2022-06-03'), region);
      assert.ok(list.includes('2022-09-19'), region);
      assert.ok(!list.includes('2022-05-30'), region);
    }
  });

  test('2022: Christmas Day (Sun) moves past Boxing Day (Mon) to Tue 27', () => {
    const list = bankHolidaysForYear(2022, EW);
    assert.equal(nameOf(list, '2022-12-26'), 'Boxing Day');
    assert.equal(nameOf(list, '2022-12-27'), 'Christmas Day (substitute day)');
  });

  test('2023 includes the Coronation on 8 May', () => {
    const list = dates(bankHolidaysForYear(2023, EW));
    assert.ok(list.includes('2023-05-08'));
    assert.ok(list.includes('2023-05-01'));
  });

  test('2020: Early May bank holiday moved to Friday 8 May (VE Day)', () => {
    const list = dates(bankHolidaysForYear(2020, EW));
    assert.ok(list.includes('2020-05-08'));
    assert.ok(!list.includes('2020-05-04'));
  });
});

describe('bankHolidaysForYear – general properties', () => {
  test("region 'none' or unknown gives an empty list", () => {
    assert.deepEqual(bankHolidaysForYear(2026, 'none'), []);
    assert.deepEqual(bankHolidaysForYear(2026, 'mars'), []);
    assert.deepEqual(bankHolidaysForYear(2026, undefined), []);
    assert.deepEqual(bankHolidaysForYear(2026, null), []);
  });

  test('a nonsense year gives an empty list', () => {
    assert.deepEqual(bankHolidaysForYear('soon', EW), []);
    assert.deepEqual(bankHolidaysForYear(undefined, EW), []);
  });

  test('accepts the year as a string', () => {
    assert.deepEqual(bankHolidaysForYear('2026', EW), bankHolidaysForYear(2026, EW));
  });

  test('every date is valid, in-year, a weekday, sorted, unique, and named', () => {
    for (const region of [EW, SCOT, NI]) {
      for (let y = 2000; y <= 2040; y++) {
        const list = bankHolidaysForYear(y, region);
        assert.ok(list.length >= 8, `${region} ${y} has ${list.length}`);
        const seen = new Set();
        let prev = '';
        for (const { date, name } of list) {
          assert.ok(isValidISO(date), `${region} ${y}: ${date}`);
          assert.ok(date.startsWith(`${y}-`), `${region} ${y}: ${date} outside year`);
          assert.ok(!isWeekend(date), `${region} ${y}: ${date} is a weekend`);
          assert.ok(date > prev, `${region} ${y}: ${date} not after ${prev}`);
          assert.ok(!seen.has(date), `${region} ${y}: duplicate ${date}`);
          assert.equal(typeof name, 'string');
          assert.ok(name.length > 0);
          seen.add(date);
          prev = date;
        }
      }
    }
  });

  test('substitute days are labelled and only fixed-date holidays get them', () => {
    const list = bankHolidaysForYear(2027, EW);
    assert.equal(nameOf(list, '2027-12-27'), 'Christmas Day (substitute day)');
    assert.equal(nameOf(list, '2027-12-28'), 'Boxing Day (substitute day)');
    assert.equal(nameOf(bankHolidaysForYear(2026, EW), '2026-12-28'), 'Boxing Day (substitute day)');
    assert.equal(nameOf(bankHolidaysForYear(2027, SCOT), '2027-01-04'), '2 January (substitute day)');
    assert.equal(nameOf(bankHolidaysForYear(2024, SCOT), '2024-12-02'), "St Andrew's Day (substitute day)");
    for (const { date, name } of list) {
      if (name.includes('(substitute day)')) continue;
      assert.ok(!name.includes('substitute'), `${date} ${name}`);
    }
    // A fixed date that lands on a weekday is not a substitute.
    assert.equal(nameOf(bankHolidaysForYear(2024, EW), '2024-12-25'), 'Christmas Day');
  });

  test('returns a fresh array each call', () => {
    const a = bankHolidaysForYear(2026, EW);
    const b = bankHolidaysForYear(2026, EW);
    assert.notEqual(a, b);
    assert.deepEqual(a, b);
  });
});

describe('bankHolidayMap', () => {
  test('covers every year from fromYear to toYear inclusive', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2024, toYear: 2026 });
    const expected = [2024, 2025, 2026].flatMap((y) => bankHolidaysForYear(y, EW));
    assert.deepEqual([...map].map(([date, name]) => ({ date, name })), expected);
    assert.equal(map.size, 24);
  });

  test('iterates in ascending date order even after overrides', () => {
    const map = bankHolidayMap({
      region: SCOT,
      fromYear: 2025,
      toYear: 2026,
      overrides: { added: [{ date: '2026-07-15', name: 'Office closed' }, { date: '2025-02-14' }], removed: [] },
    });
    const keys = [...map.keys()];
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i] > keys[i - 1], `${keys[i - 1]} before ${keys[i]}`);
    assert.ok(keys.includes('2025-02-14'));
    assert.ok(keys.includes('2026-07-15'));
  });

  test('added days are set, with a default name of "Bank holiday"', () => {
    const map = bankHolidayMap({
      region: EW,
      fromYear: 2026,
      toYear: 2026,
      overrides: { added: [{ date: '2026-07-15', name: 'Company day' }, { date: '2026-07-16' }, { date: '2026-07-17', name: '   ' }], removed: [] },
    });
    assert.equal(map.get('2026-07-15'), 'Company day');
    assert.equal(map.get('2026-07-16'), 'Bank holiday');
    assert.equal(map.get('2026-07-17'), 'Bank holiday');
  });

  test('an added day can rename an existing bank holiday', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: { added: [{ date: '2026-12-25', name: 'Christmas' }], removed: [] } });
    assert.equal(map.get('2026-12-25'), 'Christmas');
    assert.equal(map.size, 8);
  });

  test('removed days are deleted; removing an unknown day is harmless', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: { added: [], removed: ['2026-08-31', '2026-02-02'] } });
    assert.equal(map.has('2026-08-31'), false);
    assert.equal(map.size, 7);
  });

  test('removed wins over added for the same date', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: { added: [{ date: '2026-07-15' }], removed: ['2026-07-15'] } });
    assert.equal(map.has('2026-07-15'), false);
  });

  test('added days outside the year range and with region "none" still appear', () => {
    const map = bankHolidayMap({ region: 'none', fromYear: 2026, toYear: 2026, overrides: { added: [{ date: '2030-01-10', name: 'Closure' }], removed: [] } });
    assert.deepEqual([...map], [['2030-01-10', 'Closure']]);
  });

  test('ignores added entries with invalid dates', () => {
    const map = bankHolidayMap({ region: 'none', fromYear: 2026, toYear: 2026, overrides: { added: [{ date: '2026-02-30' }, { date: 'tomorrow' }, null, {}], removed: [] } });
    assert.equal(map.size, 0);
  });

  test('overrides are optional and may be partial', () => {
    assert.equal(bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026 }).size, 8);
    assert.equal(bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: {} }).size, 8);
    assert.equal(bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: { removed: ['2026-01-01'] } }).size, 7);
    assert.equal(bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: null }).size, 8);
  });

  test("region 'none' gives an empty map", () => {
    const map = bankHolidayMap({ region: 'none', fromYear: 2024, toYear: 2027 });
    assert.equal(map.size, 0);
    assert.ok(map instanceof Map);
  });

  test('when years are omitted it covers two years either side of today', () => {
    const map = bankHolidayMap({ region: EW, today: '2026-09-01' });
    const years = new Set([...map.keys()].map((d) => d.slice(0, 4)));
    assert.deepEqual([...years], ['2024', '2025', '2026', '2027', '2028']);
  });

  test('fromYear after toYear gives only overrides', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2027, toYear: 2026, overrides: { added: [{ date: '2026-05-01' }] } });
    assert.deepEqual([...map.keys()], ['2026-05-01']);
  });

  test('every key is a valid ISO date', () => {
    const map = bankHolidayMap({ region: NI, fromYear: 2020, toYear: 2030 });
    for (const key of map.keys()) assert.ok(isValidISO(key), key);
  });
});

describe('bankHolidaysBetween', () => {
  const map = bankHolidayMap({ region: SCOT, fromYear: 2026, toYear: 2027 });

  test('crosses a year boundary and includes both ends', () => {
    assert.deepEqual(bankHolidaysBetween('2026-12-20', '2027-01-05', map), [
      { date: '2026-12-25', name: 'Christmas Day' },
      { date: '2026-12-28', name: 'Boxing Day (substitute day)' },
      { date: '2027-01-01', name: "New Year's Day" },
      { date: '2027-01-04', name: '2 January (substitute day)' },
    ]);
    assert.deepEqual(dates(bankHolidaysBetween('2026-12-25', '2027-01-04', map)), ['2026-12-25', '2026-12-28', '2027-01-01', '2027-01-04']);
    assert.deepEqual(dates(bankHolidaysBetween('2026-12-26', '2027-01-03', map)), ['2026-12-28', '2027-01-01']);
  });

  test('a single day', () => {
    assert.deepEqual(bankHolidaysBetween('2026-12-25', '2026-12-25', map), [{ date: '2026-12-25', name: 'Christmas Day' }]);
    assert.deepEqual(bankHolidaysBetween('2026-12-24', '2026-12-24', map), []);
  });

  test('empty when the range is backwards, missing, or the map is missing', () => {
    assert.deepEqual(bankHolidaysBetween('2027-01-05', '2026-12-20', map), []);
    assert.deepEqual(bankHolidaysBetween(null, '2026-12-20', map), []);
    assert.deepEqual(bankHolidaysBetween('2026-12-20', null, map), []);
    assert.deepEqual(bankHolidaysBetween('2026-12-20', '2027-01-05', null), []);
    assert.deepEqual(bankHolidaysBetween('2026-12-20', '2027-01-05', new Map()), []);
  });

  test('results are sorted even when the map is not', () => {
    const messy = new Map([['2026-12-28', 'B'], ['2026-12-25', 'A']]);
    assert.deepEqual(dates(bankHolidaysBetween('2026-12-01', '2026-12-31', messy)), ['2026-12-25', '2026-12-28']);
  });
});

describe('isBankHoliday and bankHolidayName', () => {
  const map = bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: { added: [{ date: '2026-07-15' }], removed: ['2026-08-31'] } });

  test('isBankHoliday', () => {
    assert.equal(isBankHoliday('2026-12-25', map), true);
    assert.equal(isBankHoliday('2026-07-15', map), true);
    assert.equal(isBankHoliday('2026-08-31', map), false);
    assert.equal(isBankHoliday('2026-12-24', map), false);
    assert.equal(isBankHoliday('2026-12-25', null), false);
    assert.equal(isBankHoliday(undefined, map), false);
  });

  test('bankHolidayName', () => {
    assert.equal(bankHolidayName('2026-12-25', map), 'Christmas Day');
    assert.equal(bankHolidayName('2026-12-28', map), 'Boxing Day (substitute day)');
    assert.equal(bankHolidayName('2026-07-15', map), 'Bank holiday');
    assert.equal(bankHolidayName('2026-08-31', map), null);
    assert.equal(bankHolidayName('2026-12-24', map), null);
    assert.equal(bankHolidayName('2026-12-25', null), null);
  });
});
