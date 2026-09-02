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

// ---------- Extra edge cases added in review ----------

describe('bankHolidaysForYear – awkward years', () => {
  test('null, empty, boolean, zero and out-of-range years give an empty list (never "0-01-01")', () => {
    for (const bad of [null, '', 0, false, true, 50, 999, 10000, NaN, Infinity, -2026, '  ']) {
      assert.deepEqual(bankHolidaysForYear(bad, EW), [], String(bad));
    }
  });

  test('a fractional year is treated as its whole year', () => {
    assert.deepEqual(bankHolidaysForYear(2026.7, EW), bankHolidaysForYear(2026, EW));
    assert.deepEqual(bankHolidaysForYear(' 2026 ', SCOT), bankHolidaysForYear(2026, SCOT));
  });

  test('leap years: 29 February never appears and Easter rules still hold', () => {
    for (const y of [2024, 2028, 2032, 2036, 2040, 2000]) {
      for (const region of [EW, SCOT, NI]) {
        const list = bankHolidaysForYear(y, region);
        assert.ok(!list.some((x) => x.date.endsWith('-02-29')));
        assert.ok(list.some((x) => x.name === 'Good Friday'));
      }
    }
  });

  test('substitute days never spill into another calendar year (checked over 200 years)', () => {
    for (const region of [EW, SCOT, NI]) {
      for (let y = 1990; y <= 2190; y++) {
        for (const { date } of bankHolidaysForYear(y, region)) {
          assert.ok(date.startsWith(`${y}-`), `${region} ${y}: ${date}`);
        }
      }
    }
  });

  test('Christmas on a Saturday: Mon 27 and Tue 28 (2021)', () => {
    const list = bankHolidaysForYear(2021, EW);
    assert.equal(nameOf(list, '2021-12-27'), 'Christmas Day (substitute day)');
    assert.equal(nameOf(list, '2021-12-28'), 'Boxing Day (substitute day)');
    assert.equal(nameOf(list, '2021-12-24'), undefined);
  });

  test('Christmas on a Sunday: Boxing Day Mon 26 stays, Christmas moves to Tue 27 (2033)', () => {
    const list = bankHolidaysForYear(2033, EW);
    assert.equal(nameOf(list, '2033-12-26'), 'Boxing Day');
    assert.equal(nameOf(list, '2033-12-27'), 'Christmas Day (substitute day)');
  });

  test('Scotland 2021: 2 January on a Saturday moves to Monday 4', () => {
    const list = bankHolidaysForYear(2021, SCOT);
    assert.equal(nameOf(list, '2021-01-01'), "New Year's Day");
    assert.equal(nameOf(list, '2021-01-04'), '2 January (substitute day)');
    assert.equal(nameOf(list, '2021-01-02'), undefined);
  });

  test('Scotland 2025: St Andrew\'s Day on a Sunday moves to Monday 1 December', () => {
    assert.equal(nameOf(bankHolidaysForYear(2025, SCOT), '2025-12-01'), "St Andrew's Day (substitute day)");
  });

  test('Northern Ireland 2020: Battle of the Boyne on a Sunday moves to Monday 13 July', () => {
    assert.equal(nameOf(bankHolidaysForYear(2020, NI), '2020-07-13'), 'Battle of the Boyne (substitute day)');
  });

  test('Scotland summer bank holiday is the first Monday of August', () => {
    assert.equal(nameOf(bankHolidaysForYear(2026, SCOT), '2026-08-03'), 'Summer bank holiday');
    assert.equal(nameOf(bankHolidaysForYear(2026, SCOT), '2026-08-31'), undefined);
  });

  test('older one-off days: Millennium, Golden Jubilee, Royal wedding, Diamond Jubilee', () => {
    for (const region of [EW, SCOT, NI]) {
      assert.equal(nameOf(bankHolidaysForYear(1999, region), '1999-12-31'), 'Millennium bank holiday', region);
      const y2002 = bankHolidaysForYear(2002, region);
      assert.equal(nameOf(y2002, '2002-06-03'), 'Golden Jubilee bank holiday', region);
      assert.equal(nameOf(y2002, '2002-06-04'), 'Spring bank holiday', region);
      assert.equal(nameOf(y2002, '2002-05-27'), undefined, region);
      assert.equal(nameOf(bankHolidaysForYear(2011, region), '2011-04-29'), 'Royal wedding bank holiday', region);
      const y2012 = bankHolidaysForYear(2012, region);
      assert.equal(nameOf(y2012, '2012-06-04'), 'Spring bank holiday', region);
      assert.equal(nameOf(y2012, '2012-06-05'), 'Diamond Jubilee bank holiday', region);
      assert.equal(nameOf(y2012, '2012-05-28'), undefined, region);
    }
  });

  test('2020 VE Day move applies to every region and keeps the weekday count sane', () => {
    for (const region of [EW, SCOT, NI]) {
      const list = bankHolidaysForYear(2020, region);
      assert.equal(nameOf(list, '2020-05-08'), 'Early May bank holiday (VE Day)', region);
      assert.equal(nameOf(list, '2020-05-04'), undefined, region);
    }
  });

  test('names are plain British English with no ids or jargon', () => {
    for (const region of [EW, SCOT, NI]) {
      for (let y = 1999; y <= 2040; y++) {
        for (const { name } of bankHolidaysForYear(y, region)) {
          assert.ok(!/[_{}\[\]]|\bid\b|schema|database|sync|cache/i.test(name), name);
        }
      }
    }
  });
});

describe('bankHolidayMap – awkward inputs', () => {
  test('only fromYear given: covers just that year', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2030, today: '2026-09-02' });
    assert.equal(map.size, bankHolidaysForYear(2030, EW).length);
    assert.ok([...map.keys()].every((d) => d.startsWith('2030-')));
  });

  test('only toYear given: covers just that year', () => {
    const map = bankHolidayMap({ region: EW, toYear: 2019, today: '2026-09-02' });
    assert.ok(map.size > 0);
    assert.ok([...map.keys()].every((d) => d.startsWith('2019-')));
  });

  test('accepts years as strings or fractions', () => {
    assert.equal(bankHolidayMap({ region: EW, fromYear: '2026', toYear: '2026' }).size, 8);
    assert.equal(bankHolidayMap({ region: EW, fromYear: 2026.5, toYear: 2026.9 }).size, 8);
  });

  test('nonsense years fall back to today', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 'soon', toYear: null, today: '2026-09-02' });
    const years = new Set([...map.keys()].map((d) => d.slice(0, 4)));
    assert.deepEqual([...years], ['2024', '2025', '2026', '2027', '2028']);
  });

  test('today at a year boundary picks years around that year', () => {
    const map = bankHolidayMap({ region: EW, today: '2027-01-01' });
    const years = new Set([...map.keys()].map((d) => d.slice(0, 4)));
    assert.deepEqual([...years], ['2025', '2026', '2027', '2028', '2029']);
  });

  test('no arguments at all still returns a Map', () => {
    const map = bankHolidayMap();
    assert.ok(map instanceof Map);
    assert.equal(map.size, 0);
  });

  test('override lists that are not arrays are ignored rather than crashing', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: { added: {}, removed: 'no' } });
    assert.equal(map.size, 8);
    assert.equal(bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: 'oops' }).size, 8);
  });

  test('odd entries in removed are harmless', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2026, toYear: 2026, overrides: { removed: [null, 5, { date: '2026-01-01' }, ''] } });
    assert.equal(map.size, 8);
  });

  test('a very long range is complete and still sorted', () => {
    const map = bankHolidayMap({ region: SCOT, fromYear: 1990, toYear: 2100 });
    assert.equal(map.size, [...Array(111).keys()].reduce((n, i) => n + bankHolidaysForYear(1990 + i, SCOT).length, 0));
    const keys = [...map.keys()];
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i] > keys[i - 1]);
  });

  test('the same input always gives the same map (no hidden "today")', () => {
    const a = bankHolidayMap({ region: NI, fromYear: 2025, toYear: 2027, overrides: { added: [{ date: '2026-03-02' }] } });
    const b = bankHolidayMap({ region: NI, fromYear: 2025, toYear: 2027, overrides: { added: [{ date: '2026-03-02' }] } });
    assert.deepEqual([...a], [...b]);
  });
});

describe('lookups with something that is not a Map', () => {
  test('isBankHoliday, bankHolidayName and bankHolidaysBetween never throw', () => {
    for (const notAMap of [{}, [], 'map', 42, undefined]) {
      assert.equal(isBankHoliday('2026-12-25', notAMap), false);
      assert.equal(bankHolidayName('2026-12-25', notAMap), null);
      assert.deepEqual(bankHolidaysBetween('2026-01-01', '2026-12-31', notAMap), []);
    }
  });

  test('bankHolidaysBetween over a very long range returns every holiday', () => {
    const map = bankHolidayMap({ region: EW, fromYear: 2000, toYear: 2040 });
    assert.equal(bankHolidaysBetween('1990-01-01', '2050-12-31', map).length, map.size);
    assert.equal(bankHolidaysBetween('2041-01-01', '2050-12-31', map).length, 0);
  });
});
