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

test('parseCsvRows works out semicolon and tab delimiters from the first line', () => {
  assert.deepEqual(parseCsvRows('First name;Last name\r\nPriya;Patel\r\n'), [['First name', 'Last name'], ['Priya', 'Patel']]);
  assert.deepEqual(parseCsvRows('First name\tLast name\nPriya\tPatel'), [['First name', 'Last name'], ['Priya', 'Patel']]);
  assert.deepEqual(parseCsvRows('"Name, in full";Team\n"Patel, Priya";Day'), [['Name, in full', 'Team'], ['Patel, Priya', 'Day']], 'commas inside quotes do not count');
  assert.deepEqual(parseCsvRows('a,b;c\n1,2;3'), [['a', 'b;c'], ['1', '2;3']], 'commas win when the first line has any');
  assert.deepEqual(parseCsvRows('a;b\n"x, y";z'), [['a', 'b'], ['x, y', 'z']]);
  assert.deepEqual(parseCsvRows('sep=;\nFirst name;Last name\nPriya;Patel'), [['First name', 'Last name'], ['Priya', 'Patel']], "Excel's 'sep=' line");
  assert.deepEqual(parseCsvRows(`${BOM}sep=,\r\na,b\r\n1,2\r\n`), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsvRows('a;b,c', ';'), [['a', 'b,c']], 'an explicit delimiter is respected');
  assert.deepEqual(parseCsvRows('a;b,c', ','), [['a;b', 'c']]);
  assert.deepEqual(parseCsvRows('Name\nPriya Patel'), [['Name'], ['Priya Patel']], 'a single column defaults to commas');
  assert.deepEqual(parseCsv('First name;Last name;Notes\nPriya;Patel;"Likes ""tea""; biscuits"'), [{ 'First name': 'Priya', 'Last name': 'Patel', Notes: 'Likes "tea"; biscuits' }]);
});

test('parseCsvRows forgives spaces around quoted fields and keeps CRLF inside them', () => {
  assert.deepEqual(parseCsvRows('a, "b,c" ,d'), [['a', 'b,c', 'd']]);
  assert.deepEqual(parseCsvRows('"a"b,c'), [['ab', 'c']]);
  assert.deepEqual(parseCsvRows('"x\r\ny",z\r\n'), [['x\r\ny', 'z']]);
  assert.deepEqual(parseCsvRows('a,b\r\n1,2\r\n\r\n\r\n'), [['a', 'b'], ['1', '2'], [''], ['']], 'trailing blank lines are rows for parseCsvRows…');
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n\r\n\r\n'), [{ a: '1', b: '2' }], '…and skipped by parseCsv');
  assert.deepEqual(parseCsv(`${BOM}"a","b"\r\n"1","2"\r\n`), [{ a: '1', b: '2' }], 'BOM before a quoted header');
  assert.deepEqual(parseCsvRows(undefined), []);
});

test('parseWorkingDays: more of the ways people write patterns', () => {
  assert.deepEqual(parseWorkingDays('Mon, Tues, Weds, Thurs, Fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Weds'), [3]);
  assert.deepEqual(parseWorkingDays('Sats & Suns'), [6, 7]);
  assert.deepEqual(parseWorkingDays('Mon/Wed/Fri'), [1, 3, 5]);
  assert.deepEqual(parseWorkingDays('Mon;Wed;Fri'), [1, 3, 5]);
  assert.deepEqual(parseWorkingDays('Monday-Friday'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Mon - Fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Mon through Fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Full time'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('5 days a week'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Weekdays only'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Weekends only'), [6, 7]);
  assert.deepEqual(parseWorkingDays('All week'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(parseWorkingDays('7 days a week'), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(parseWorkingDays('M T W T F'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkingDays('Mon Tue Wed Thu Fri Sat Sun'), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(parseWorkingDays('Part time'), null, 'no way to know which days');
  assert.equal(parseWorkingDays('3 days'), null);
  assert.equal(parseWorkingDays(undefined), null);
  assert.equal(parseWorkingDays(42), null);
});

test('parseCarersCsv reads a semicolon-delimited file from Excel', () => {
  const db = createEmptyDb();
  const text = `${BOM}First name;Last name;Team;Entitlement;Working days\r\nPriya;Patel;Day team;"25,5";Mon-Fri\r\nSam;Ahmed;Night team;28;"Mon, Wed"\r\n`;
  const { carers, errors } = parseCarersCsv(text, db);
  assert.deepEqual(errors, []);
  assert.deepEqual(carers.map((c) => [c.firstName, c.lastName, c.teamId, c.entitlementDays, c.workingDays]), [
    ['Priya', 'Patel', 'team_day', 25.5, [1, 2, 3, 4, 5]],
    ['Sam', 'Ahmed', 'team_night', 28, [1, 3]],
  ]);
  const tabbed = parseCarersCsv('Name\tTeam\nPriya Patel\tDay team', db);
  assert.deepEqual(tabbed.carers.map((c) => [c.firstName, c.lastName, c.teamId]), [['Priya', 'Patel', 'team_day']]);
});

test('parseCarersCsv understands Excel-style dates and rejects ones that do not exist', () => {
  const db = createEmptyDb();
  const read = (value) => {
    const { carers, errors } = parseCarersCsv(`Name,Start\nA B,${value}`, db);
    return [carers[0].startDate, errors.map((e) => e.message)];
  };
  assert.deepEqual(read('01/05/2020'), ['2020-05-01', []], 'day first');
  assert.deepEqual(read('1/5/20'), ['2020-05-01', []]);
  assert.deepEqual(read('01.05.2020'), ['2020-05-01', []]);
  assert.deepEqual(read('01-05-2020'), ['2020-05-01', []]);
  assert.deepEqual(read('01/05/2020 00:00'), ['2020-05-01', []], 'a time of day from Excel is ignored, not read as US');
  assert.deepEqual(read('01/05/2020 00:00:00'), ['2020-05-01', []]);
  assert.deepEqual(read('"1 May 2020, 9:30am"'), ['2020-05-01', []]);
  assert.deepEqual(read('2020-05-01T00:00:00.000Z'), ['2020-05-01', []]);
  assert.deepEqual(read('2020-5-1'), ['2020-05-01', []]);
  assert.deepEqual(read('2020/05/01'), ['2020-05-01', []]);
  assert.deepEqual(read('1st May 2020'), ['2020-05-01', []]);
  assert.deepEqual(read('22nd Aug 2019'), ['2019-08-22', []]);
  assert.deepEqual(read('Monday 4 May 2020'), ['2020-05-04', []]);
  assert.deepEqual(read('"Fri, 1 May 2020"'), ['2020-05-01', []]);
  assert.deepEqual(read('"May 1, 2020"'), ['2020-05-01', []]);
  assert.deepEqual(read('43952'), ['2020-05-01', []], 'an Excel serial number');
  assert.deepEqual(read('36526'), ['2000-01-01', []]);
  assert.equal(read('2026-02-31')[0], null, 'not 3 March');
  assert.match(read('2026-02-31')[1][0], /2026-02-31/);
  assert.equal(read('31/02/2026')[0], null);
  assert.equal(read('1 May')[0], null, 'no year, no guess');
  assert.equal(read('yesterday')[0], null);
  assert.equal(read('99999')[0], null);
  assert.equal(read('01/05/1850')[0], null);
  const us = read('05/13/2020');
  assert.equal(us[0], '2020-05-13', 'month/day/year is read when it is the only way it makes sense');
  assert.equal(us[1].length, 1);
  assert.match(us[1][0], /13\/05\/2020/);
  assert.doesNotMatch(us[1][0], /US|ISO|undefined/i);
});

test('parseCarersCsv: entitlement in days or weeks, Name column variants, loose team names, statuses', () => {
  const db = createEmptyDb();
  const first = (text) => parseCarersCsv(text, db);
  const ent = (value, extra = '') => first(`Name,Entitlement,Working days\nA B,${value},${extra}`);
  assert.equal(ent('25.5').carers[0].entitlementDays, 25.5);
  assert.equal(ent('"25,5"').carers[0].entitlementDays, 25.5);
  assert.equal(ent('25 days').carers[0].entitlementDays, 25);
  assert.equal(ent('28 Days').carers[0].entitlementDays, 28);
  assert.equal(ent('28d').carers[0].entitlementDays, 28);
  assert.equal(ent('28.').carers[0].entitlementDays, 28);
  assert.equal(ent('28 days per year').carers[0].entitlementDays, 28);
  assert.equal(ent('28 p.a.').carers[0].entitlementDays, 28);
  assert.equal(ent('0').carers[0].entitlementDays, 0);
  assert.equal(ent('5.6 weeks').carers[0].entitlementDays, 28, 'weeks × working days (Mon–Fri by default)');
  assert.equal(ent('5.6 weeks', 'MWF').carers[0].entitlementDays, 16.8);
  assert.equal(ent('4 wks', 'Sat & Sun').carers[0].entitlementDays, 8);
  const tooMany = ent('500');
  assert.equal(tooMany.carers[0].entitlementDays, db.settings.defaultEntitlementDays);
  assert.equal(tooMany.errors.length, 1);
  assert.ok(tooMany.errors[0].warning);
  const words = ent('twenty');
  assert.equal(words.carers[0].entitlementDays, db.settings.defaultEntitlementDays);
  assert.match(words.errors[0].message, /twenty/);

  const names = first('Name\n"Patel, Priya"\nPriya  Patel\n  Anne   Marie   Smith \nMadonna\n"Smith, "');
  assert.deepEqual(names.carers.map((c) => [c.firstName, c.lastName]), [['Priya', 'Patel'], ['Priya', 'Patel'], ['Anne Marie', 'Smith'], ['Madonna', ''], ['Smith', '']]);
  assert.equal(names.errors.length, 1, 'the second Priya Patel is flagged as a duplicate within the file');
  assert.ok(names.errors[0].warning);
  assert.equal(names.errors[0].row, 2);
  assert.match(names.errors[0].message, /row 1/);
  assert.match(names.errors[0].message, /Priya Patel/);

  const teams = first('Name,Team\nA B,Day\nC D,NIGHT TEAM\nE F,day-team\nG H,Weekend');
  assert.deepEqual(teams.carers.map((c) => c.teamId), ['team_day', 'team_night', 'team_day', null]);
  assert.deepEqual(teams.errors.map((e) => [e.row, e.warning]), [[4, true]]);
  assert.match(teams.errors[0].message, /Weekend/);

  const status = (v) => first(`Name,Active\nA B,${v}`).carers[0].active;
  assert.deepEqual(['N', 'no', 'No', 'left', 'Leaver', 'former', 'Not active', 'FALSE', '0'].map(status), [false, false, false, false, false, false, false, false, false]);
  assert.deepEqual(['Y', 'yes', 'x', 'TRUE', '1', 'Active', 'current', ''].map(status), [true, true, true, true, true, true, true, true]);
});

test('parseCarersCsv: bracketed hints on headings, more heading names and a null db', () => {
  const text = 'Full name,Start date (dd/mm/yyyy),Date left [optional],Tel no,Holiday allowance,Job title,Email address,Comments,Days worked\nPriya Patel,01/05/2020,,07700 900123,30,Senior Carer,priya@example.com,Hi,Mon-Wed';
  const { carers, errors } = parseCarersCsv(text, null);
  assert.deepEqual(errors, []);
  assert.deepEqual(carers[0], {
    firstName: 'Priya', lastName: 'Patel', role: 'Senior carer', teamId: null, startDate: '2020-05-01', endDate: null,
    workingDays: [1, 2, 3], entitlementDays: 30, phone: '07700 900123', email: 'priya@example.com', notes: 'Hi', active: true,
  });
  assert.deepEqual(parseCarersCsv(null), { carers: [], errors: [] });
  assert.deepEqual(parseCarersCsv(undefined, undefined), { carers: [], errors: [] });
  const swapped = parseCarersCsv('Name,Start,End\nA B,01/05/2020,01/01/2020');
  assert.equal(swapped.carers[0].endDate, '2020-01-01', 'kept, but flagged');
  assert.equal(swapped.errors.length, 1);
  assert.ok(swapped.errors[0].warning);
  assert.match(swapped.errors[0].message, /before the start date/);
  for (const e of [...errors, ...swapped.errors]) assert.doesNotMatch(e.message, /undefined|null|NaN|\bid\b|database|schema/i);
});

test('exported cells never start with a character a spreadsheet would run as a formula', () => {
  const csv = toCsv([{ notes: '=1+1' }, { notes: '+44 7700 900123' }, { notes: '-agreed with Jo' }, { notes: '@jo' }, { notes: 'plain' }], [{ key: 'notes', label: 'Notes' }]);
  const cells = csv.split('\r\n').slice(1).filter(Boolean).map((l) => l.replace(/^"/, ''));
  for (const c of cells) assert.ok(!/^[=+\-@]/.test(c), `cell must not start with a formula character: ${c}`);
  const back = parseCsv(csv);
  assert.equal(back[0].Notes.trim(), '=1+1', 'the original text survives a round trip once trimmed');
  assert.equal(back[4].Notes, 'plain', 'ordinary text is untouched');
});

test('shift patterns round-trip through the carers spreadsheet', async () => {
  const { carersToCsv, parseCarersCsv, formatWorkingPattern, parseShiftPattern } = await import('../../src/core/csv.js');
  const carer = { firstName: 'Fiona', lastName: 'Campbell', teamId: null, role: 'Carer', startDate: null, endDate: null, workingDays: [1, 2, 3, 4, 5], shiftPattern: { weeks: [[1, 2, 3, 4, 5], [3, 4, 5, 6, 7]], anchor: '2026-09-02' }, entitlementDays: 28, phone: '', email: '', notes: '', active: true };
  assert.equal(formatWorkingPattern(carer), 'Week 1: Mon, Tue, Wed, Thu, Fri / Week 2: Wed, Thu, Fri, Sat, Sun (week 1 from 31/08/2026)');
  const csv = carersToCsv([carer], { teams: [] });
  const { carers, errors } = parseCarersCsv(csv, { teams: [] });
  assert.equal(errors.length, 0);
  assert.deepEqual(carers[0].shiftPattern, { weeks: [[1, 2, 3, 4, 5], [3, 4, 5, 6, 7]], anchor: '2026-08-31' });
  assert.deepEqual(carers[0].workingDays, [1, 2, 3, 4, 5]);
  assert.deepEqual(parseShiftPattern('Mon-Fri; Wed-Sun'), { weeks: [[1, 2, 3, 4, 5], [3, 4, 5, 6, 7]], anchor: null });
  assert.deepEqual(parseShiftPattern('week 1: mon-fri | week 2: off | week 3: sat, sun'), { weeks: [[1, 2, 3, 4, 5], [], [6, 7]], anchor: null });
  assert.equal(parseShiftPattern('Mon-Fri'), null, 'a single week is not a pattern');
  assert.equal(parseShiftPattern('Mon-Fri / Blursday'), null);
  const r = parseCarersCsv('First name,Last name,Working days\nSam,Ahmed,Mon-Fri / Wed-Sun', { teams: [] });
  assert.ok(r.errors.some((e) => e.warning && /week 1/.test(e.message)), 'warns when no week-1 date is given');
  assert.equal(r.carers[0].shiftPattern.weeks.length, 2);
});
