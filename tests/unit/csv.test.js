import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeCsvField, toCsv, parseCsv, parseCsvRows, parseWorkingDays, formatWorkingDays,
  carersToCsv, holidaysToCsv, parseCarersCsv,
} from '../../src/core/csv.js';
import { createEmptyDb } from '../../src/store/defaults.js';

const BOM = '\uFEFF';

test('escapeCsvField quotes only when needed', () => {
  assert.equal(escapeCsvField('plain'), 'plain');
  assert.equal(escapeCsvField('a, b'), '"a, b"');
  assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvField('one\ntwo'), '"one\ntwo"');
  assert.equal(escapeCsvField('one\r\ntwo'), '"one\r\ntwo"');
  assert.equal(escapeCsvField(' padded '), '" padded "');
  assert.equal(escapeCsvField(null), '');
  assert.equal(escapeCsvField(undefined), '');
  assert.equal(escapeCsvField(0), '0');
  assert.equal(escapeCsvField(1.5), '1.5');
});

test('toCsv builds a BOM-prefixed CRLF file with a header row', () => {
  const columns = [
    { key: 'a', label: 'Name' },
    { key: 'b', label: 'Quote, please' },
    { key: 'c', label: 'Lines' },
    { key: 'd', label: 'Padded' },
    { key: 'e', label: 'Empty' },
    { key: 'f', label: 'Number' },
    { key: 'g', label: 'Computed', get: (row) => row.f * 2 },
  ];
  const rows = [{ a: 'x, y', b: 'say "hi"', c: 'line1\nline2', d: ' padded ', e: null, f: 3 }];
  const csv = toCsv(rows, columns);
  assert.equal(csv, `${BOM}Name,"Quote, please",Lines,Padded,Empty,Number,Computed\r\n"x, y","say ""hi""","line1\nline2"," padded ",,3,6\r\n`);
  assert.equal(toCsv([], columns), `${BOM}Name,"Quote, please",Lines,Padded,Empty,Number,Computed\r\n`);
  assert.equal(toCsv([{ a: 'only' }], [{ key: 'a' }]), `${BOM}a\r\nonly\r\n`, 'label falls back to key');
});

test('CSV round trip keeps commas, quotes, newlines, spaces and accents', () => {
  const columns = [{ key: 'name', label: 'Name' }, { key: 'notes', label: 'Notes' }, { key: 'n', label: 'N' }];
  const rows = [
    { name: 'Zoë O’Brien', notes: 'Likes "tea", biscuits\r\nand cake', n: 1.5 },
    { name: ' leading and trailing ', notes: '', n: 0 },
    { name: 'Comma, Name', notes: 'plain', n: null },
  ];
  const back = parseCsv(toCsv(rows, columns));
  assert.deepEqual(back, [
    { Name: 'Zoë O’Brien', Notes: 'Likes "tea", biscuits\r\nand cake', N: '1.5' },
    { Name: ' leading and trailing ', Notes: '', N: '0' },
    { Name: 'Comma, Name', Notes: 'plain', N: '' },
  ]);
});

test('parseCsvRows handles quoting and every line ending', () => {
  assert.deepEqual(parseCsvRows('a,b\r\n1,2\n3,4\r5,6'), [['a', 'b'], ['1', '2'], ['3', '4'], ['5', '6']]);
  assert.deepEqual(parseCsvRows('"a,1","b""2"\n"multi\nline",x'), [['a,1', 'b"2'], ['multi\nline', 'x']]);
  assert.deepEqual(parseCsvRows(`${BOM}a,b\n`), [['a', 'b']], 'BOM stripped, trailing newline adds no row');
  assert.deepEqual(parseCsvRows('a,"",c'), [['a', '', 'c']]);
  assert.deepEqual(parseCsvRows('a,'), [['a', '']]);
  assert.deepEqual(parseCsvRows('5\' 10",x'), [['5\' 10"', 'x']], 'a quote mid-field is literal');
  assert.deepEqual(parseCsvRows('"unterminated,x'), [['unterminated,x']]);
  assert.deepEqual(parseCsvRows(''), []);
  assert.deepEqual(parseCsvRows(null), []);
});

test('parseCsv keys rows by trimmed headers, skips blank lines, pads short rows', () => {
  const text = `${BOM} First name , Surname \r\n\r\nPriya,Patel\n\n  \nZoë\r\n`;
  assert.deepEqual(parseCsv(text), [
    { 'First name': 'Priya', Surname: 'Patel' },
    { 'First name': 'Zoë', Surname: '' },
  ]);
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('\n\n  \n'), []);
  assert.deepEqual(parseCsv('Only,Header'), [], 'header with no data');
  assert.deepEqual(parseCsv('a,,c\n1,2,3'), [{ a: '1', c: '3' }], 'empty headers are ignored');
  assert.deepEqual(parseCsv('a,b\n1,2,3'), [{ a: '1', b: '2' }], 'extra fields are ignored');
  assert.deepEqual(parseCsv('a\n" keep "'), [{ a: ' keep ' }], 'values are not trimmed');
});

test('parseWorkingDays understands the ways people write patterns', () => {
  assert.deepEqual(parseWorkingDays('Mon-Fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Mon – Fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Mon to Fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Monday to Friday'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Mon, Wed, Fri'), [1, 3, 5]);
  assert.deepEqual(parseWorkingDays('Monday Wednesday'), [1, 3]);
  assert.deepEqual(parseWorkingDays('Tues, Thurs'), [2, 4]);
  assert.deepEqual(parseWorkingDays('Sat & Sun'), [6, 7]);
  assert.deepEqual(parseWorkingDays('Mon, Tue and Wed'), [1, 2, 3]);
  assert.deepEqual(parseWorkingDays('Mondays and Fridays'), [1, 5]);
  assert.deepEqual(parseWorkingDays('Fri-Mon'), [1, 5, 6, 7], 'ranges wrap past Sunday');
  assert.deepEqual(parseWorkingDays('Mon-Wed, Fri'), [1, 2, 3, 5]);
  assert.deepEqual(parseWorkingDays('MTWTF'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('mtwtfss'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(parseWorkingDays('MWF'), [1, 3, 5]);
  assert.deepEqual(parseWorkingDays('M W F'), [1, 3, 5]);
  assert.deepEqual(parseWorkingDays('TT'), [2, 4]);
  assert.deepEqual(parseWorkingDays('SS'), [6, 7]);
  assert.deepEqual(parseWorkingDays('M-F'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('weekdays'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Week days'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('weekends'), [6, 7]);
  assert.deepEqual(parseWorkingDays('every day'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(parseWorkingDays('Everyday'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(parseWorkingDays('1,2,3'), [1, 2, 3]);
  assert.deepEqual(parseWorkingDays('1-5'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('5 3 1 1'), [1, 3, 5], 'sorted and de-duplicated');
  assert.equal(parseWorkingDays(''), null);
  assert.equal(parseWorkingDays('   '), null);
  assert.equal(parseWorkingDays(null), null);
  assert.equal(parseWorkingDays('sometimes'), null);
  assert.equal(parseWorkingDays('Mon, Blursday'), null);
  assert.equal(parseWorkingDays('8'), null);
  assert.equal(parseWorkingDays('T-S'), null, 'ambiguous single letters');
  assert.equal(parseWorkingDays('WM'), null, 'shorthand letters must be in week order');
});

test('formatWorkingDays', () => {
  assert.equal(formatWorkingDays([1, 2, 3, 4, 5]), 'Mon, Tue, Wed, Thu, Fri');
  assert.equal(formatWorkingDays([5, 1, 3, 3]), 'Mon, Wed, Fri');
  assert.equal(formatWorkingDays([6, 7]), 'Sat, Sun');
  assert.equal(formatWorkingDays([]), '');
  assert.equal(formatWorkingDays(null), '');
  assert.equal(formatWorkingDays([0, 9]), '');
  assert.deepEqual(parseWorkingDays(formatWorkingDays([2, 4, 6])), [2, 4, 6], 'round trip');
});

test('carersToCsv', () => {
  const teamsById = new Map([['team_day', { id: 'team_day', name: 'Day team' }]]);
  const carers = [
    { firstName: 'Priya', lastName: 'Patel', teamId: 'team_day', role: 'Senior carer', startDate: '2020-05-01', endDate: null, workingDays: [1, 2, 3, 4, 5], entitlementDays: 28, phone: '07700 900123', email: 'priya@example.com', notes: 'Speaks Punjabi, Hindi', active: true },
    { firstName: 'Sam', lastName: 'Ahmed', teamId: 'team_gone', role: 'Carer', startDate: null, endDate: '2025-12-31', workingDays: [6, 7], entitlementDays: 11.5, phone: '', email: '', notes: '', active: false },
  ];
  const lines = carersToCsv(carers, { teamsById }).split('\r\n');
  assert.equal(lines[0], `${BOM}First name,Last name,Team,Role,Start date,End date,Working days,Entitlement days,Phone,Email,Notes,Status`);
  assert.equal(lines[1], 'Priya,Patel,Day team,Senior carer,01/05/2020,,"Mon, Tue, Wed, Thu, Fri",28,07700 900123,priya@example.com,"Speaks Punjabi, Hindi",Active');
  assert.equal(lines[2], 'Sam,Ahmed,,Carer,,31/12/2025,"Sat, Sun",11.5,,,,Archived');
  assert.equal(lines[3], '');
  assert.equal(carersToCsv(carers).split('\r\n')[1].split(',')[2], '', 'no lookups → blank team');
});

test('holidaysToCsv', () => {
  const carer = { firstName: 'Priya', lastName: 'Patel' };
  const items = [
    { holiday: { start: '2026-04-06', end: '2026-04-10', status: 'approved', halfDay: null, notes: 'Spain, with family' }, carer, leaveType: { name: 'Annual leave' }, days: 5, teamName: 'Day team' },
    { holiday: { start: '2026-05-01', end: '2026-05-01', status: 'pending', halfDay: 'am', notes: '' }, carer, leaveType: { name: 'Annual leave' }, days: 0.5, teamName: 'Day team' },
    { holiday: { start: '2026-05-02', end: '2026-05-02', status: 'declined', halfDay: 'pm', notes: '' }, carer: null, leaveType: null, days: 1, teamName: '' },
  ];
  const lines = holidaysToCsv(items).split('\r\n');
  assert.equal(lines[0], `${BOM}Carer,Team,From,To,Days,Type,Status,Half day,Notes`);
  assert.equal(lines[1], 'Priya Patel,Day team,06/04/2026,10/04/2026,5,Annual leave,Approved,,"Spain, with family"');
  assert.equal(lines[2], 'Priya Patel,Day team,01/05/2026,01/05/2026,0.5,Annual leave,Awaiting approval,Morning,');
  assert.equal(lines[3], 'Unknown carer,,02/05/2026,02/05/2026,1,,Declined,Afternoon,');
});

test('parseCarersCsv with messy headers, unknown team, bad entitlement and a nameless row', () => {
  const db = createEmptyDb();
  const text = [
    ' First Name , SURNAME,Team,Role,Started,Entitlement Days,Works,Mobile,E-mail,Notes',
    'Priya,Patel,day team,senior carer,01/05/2020,28,Mon-Fri,07700 900123,priya@example.com,"Speaks Punjabi, Hindi"',
    'Zoë,O’Brien,Weekend team,Carer,2023-01-15,lots,MTWTF,,,',
    '',
    ',,Day team,,,,,,,',
    ' Sam , Ahmed ,Night team,,3 Feb 2024,22.5 days,"Sat, Sun",,,',
  ].join('\r\n');
  const { carers, errors } = parseCarersCsv(text, db);

  assert.equal(carers.length, 3);
  assert.deepEqual(carers[0], {
    firstName: 'Priya', lastName: 'Patel', role: 'Senior carer', teamId: 'team_day', startDate: '2020-05-01', endDate: null,
    workingDays: [1, 2, 3, 4, 5], entitlementDays: 28, phone: '07700 900123', email: 'priya@example.com', notes: 'Speaks Punjabi, Hindi', active: true,
  });
  assert.equal(carers[1].firstName, 'Zoë');
  assert.equal(carers[1].teamId, null);
  assert.equal(carers[1].entitlementDays, db.settings.defaultEntitlementDays);
  assert.deepEqual(carers[1].workingDays, [1, 2, 3, 4, 5]);
  assert.equal(carers[1].startDate, '2023-01-15');
  assert.deepEqual(carers[2], {
    firstName: 'Sam', lastName: 'Ahmed', role: 'Carer', teamId: 'team_night', startDate: '2024-02-03', endDate: null,
    workingDays: [6, 7], entitlementDays: 22.5, phone: '', email: '', notes: '', active: true,
  });

  assert.deepEqual(errors.map((e) => [e.row, e.warning]), [[2, true], [2, true], [3, false]]);
  assert.match(errors[0].message, /Weekend team/);
  assert.match(errors[1].message, /lots/);
  assert.match(errors[2].message, /skipped/);
  for (const e of errors) assert.doesNotMatch(e.message, /undefined|null|\bid\b/i);
});

test('parseCarersCsv splits a single Name column and warns about dates and working days', () => {
  const db = createEmptyDb();
  db.carers.push({ firstName: 'Priya', lastName: 'Patel' });
  const text = 'Name,Start date,End date,Working days,Status\nPriya Patel,31/02/2026,,Blursday,Archived\nMadonna,,not a date,weekends,Active\nAnne Marie Smith,,,,';
  const { carers, errors } = parseCarersCsv(text, db);
  assert.deepEqual(carers.map((c) => [c.firstName, c.lastName]), [['Priya', 'Patel'], ['Madonna', ''], ['Anne Marie', 'Smith']]);
  assert.equal(carers[0].startDate, null);
  assert.equal(carers[0].active, false);
  assert.deepEqual(carers[0].workingDays, db.settings.defaultWorkingDays);
  assert.equal(carers[1].endDate, null);
  assert.deepEqual(carers[1].workingDays, [6, 7]);
  assert.equal(carers[1].active, true);
  assert.equal(carers[2].active, true, 'blank status means active');
  const messages = errors.map((e) => `${e.row}:${e.message}`);
  assert.equal(errors.length, 4);
  assert.ok(errors.every((e) => e.warning));
  assert.ok(messages.some((m) => m.startsWith('1:') && /already a carer called Priya Patel/.test(m)));
  assert.ok(messages.some((m) => m.startsWith('1:') && /31\/02\/2026/.test(m)));
  assert.ok(messages.some((m) => m.startsWith('1:') && /Blursday/.test(m)));
  assert.ok(messages.some((m) => m.startsWith('2:') && /not a date/.test(m)));
});

test('parseCarersCsv with no usable name column or no rows', () => {
  const db = createEmptyDb();
  assert.deepEqual(parseCarersCsv('', db), { carers: [], errors: [] });
  assert.deepEqual(parseCarersCsv('Team,Role', db), { carers: [], errors: [] }, 'header only');
  const { carers, errors } = parseCarersCsv('Team,Role\nDay team,Carer', db);
  assert.deepEqual(carers, []);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].row, 0);
  assert.equal(errors[0].warning, false);
  assert.match(errors[0].message, /name column/);
  assert.equal(parseCarersCsv('Forename,Family name\nA,B').carers.length, 1, 'db is optional');
});

test('parseCarersCsv round-trips our own export', () => {
  const db = createEmptyDb();
  const teamsById = new Map(db.teams.map((t) => [t.id, t]));
  const original = [
    { firstName: 'Priya', lastName: 'Patel', teamId: 'team_day', role: 'Senior carer', startDate: '2020-05-01', endDate: null, workingDays: [1, 2, 3, 4, 5], entitlementDays: 28, phone: '07700 900123', email: 'priya@example.com', notes: 'Notes, with "quotes"\nand a new line', active: true },
    { firstName: 'Sam', lastName: 'Ahmed', teamId: 'team_night', role: 'Carer', startDate: null, endDate: '2025-12-31', workingDays: [6, 7], entitlementDays: 11.5, phone: '', email: '', notes: '', active: false },
  ];
  const { carers, errors } = parseCarersCsv(carersToCsv(original, { teamsById }), db);
  assert.deepEqual(errors, []);
  assert.deepEqual(carers, original);
});
