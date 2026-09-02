import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseText, tokenise, initialsOf, compareCarerNames, carerMatches, searchCarers,
  holidayMatches, searchHolidays, highlight, groupBy,
} from '../../src/core/search.js';

const teams = [
  { id: 'team_day', name: 'Day team', colour: '#F58F5B', maxOffPerDay: null },
  { id: 'team_night', name: 'Night team', colour: '#6FA8DC', maxOffPerDay: null },
];
const leaveTypes = [
  { id: 'lt_annual', name: 'Annual leave', deductsEntitlement: true },
  { id: 'lt_sick', name: 'Sick leave', deductsEntitlement: false },
  { id: 'lt_training', name: 'Training', deductsEntitlement: false },
];

const carer = (patch) => ({
  role: 'Carer', teamId: null, startDate: null, endDate: null, workingDays: [1, 2, 3, 4, 5],
  entitlementDays: 28, phone: '', email: '', notes: '', active: true, mustNotBeOffWith: [], adjustments: [],
  ...patch,
});

const c1 = carer({ id: 'c1', firstName: 'Priya', lastName: 'Patel', role: 'Senior carer', teamId: 'team_day', startDate: '2020-05-01', phone: '07700 900123', email: 'priya.patel@example.com', notes: 'Speaks Punjabi' });
const c2 = carer({ id: 'c2', firstName: 'Zoë', lastName: 'O’Brien', teamId: 'team_night', startDate: '2023-01-15' });
const c3 = carer({ id: 'c3', firstName: 'Sam', lastName: 'Ahmed', teamId: 'team_day', active: false });
const c4 = carer({ id: 'c4', firstName: 'Mary-Jane', lastName: 'Smith', role: 'Team leader', startDate: '2019-03-01' });
const c5 = carer({ id: 'c5', firstName: 'José', lastName: 'García', role: 'Care coordinator', teamId: 'team_night', startDate: '2021-09-01', notes: 'Drives' });
const carers = [c1, c2, c3, c4, c5];

const lookups = {
  teamsById: new Map(teams.map((t) => [t.id, t])),
  carersById: new Map(carers.map((c) => [c.id, c])),
  leaveTypesById: new Map(leaveTypes.map((t) => [t.id, t])),
};

const holiday = (patch) => ({ typeId: 'lt_annual', status: 'approved', halfDay: null, notes: '', ...patch });
const h1 = holiday({ id: 'h1', carerId: 'c1', start: '2026-04-06', end: '2026-04-10', notes: 'Spain' });
const h2 = holiday({ id: 'h2', carerId: 'c2', start: '2026-04-08', end: '2026-04-08', typeId: 'lt_sick', status: 'pending' });
const h3 = holiday({ id: 'h3', carerId: 'c1', start: '2026-05-01', end: '2026-05-01', status: 'declined', halfDay: 'am' });
const h4 = holiday({ id: 'h4', carerId: 'c5', start: '2026-04-06', end: '2026-04-07', typeId: 'lt_training' });
const holidays = [h1, h2, h3, h4];

const ids = (list) => list.map((x) => x.id);

test('normaliseText strips accents, case and extra spaces', () => {
  assert.equal(normaliseText('  Zoë   O’BRIEN '), "zoe o'brien");
  assert.equal(normaliseText('José García'), 'jose garcia');
  assert.equal(normaliseText(null), '');
  assert.equal(normaliseText(undefined), '');
  assert.equal(normaliseText(42), '42');
  assert.deepEqual(tokenise('  Priya   PATEL '), ['priya', 'patel']);
  assert.deepEqual(tokenise(''), []);
});

test('initials and name comparison', () => {
  assert.equal(initialsOf(c1), 'pp');
  assert.equal(initialsOf(c4), 'ms');
  assert.equal(compareCarerNames(c3, c1) < 0, true); // Ahmed before Patel
  assert.equal(compareCarerNames(c5, c2) < 0, true); // García before O’Brien (accent-insensitive)
  assert.equal(compareCarerNames(c1, c1), 0);
});

test('carerMatches: prefix tokens across fields', () => {
  assert.ok(carerMatches(c1, '', lookups));
  assert.ok(carerMatches(c1, '   ', lookups));
  assert.ok(carerMatches(c1, 'pri', lookups));
  assert.ok(carerMatches(c1, 'PATEL priya', lookups));
  assert.ok(carerMatches(c1, 'sen car', lookups)); // role: Senior carer
  assert.ok(!carerMatches(c2, 'sen car', lookups));
  assert.ok(carerMatches(c1, 'day', lookups)); // team name
  assert.ok(!carerMatches(c2, 'day', lookups));
  assert.ok(carerMatches(c1, 'punjabi', lookups)); // notes
  assert.ok(carerMatches(c1, 'example.com', lookups)); // email domain
  assert.ok(carerMatches(c1, 'priya.patel', lookups));
  assert.ok(carerMatches(c1, 'riya', lookups), 'substring of full name still matches');
  assert.ok(!carerMatches(c1, 'nothing', lookups));
  assert.ok(!carerMatches(c1, 'priya nothing', lookups), 'every token must match');
  assert.ok(carerMatches(c1, 'priya', {}), 'works without lookups');
});

test('carerMatches: phone digits, accents, apostrophes, full-name substring and initials', () => {
  assert.ok(carerMatches(c1, '0770', lookups));
  assert.ok(carerMatches(c1, '07700900', lookups), 'digits-only comparison ignores the space');
  assert.ok(carerMatches(c1, '900123', lookups));
  assert.ok(!carerMatches(c1, '9001234', lookups));
  assert.ok(carerMatches(c2, 'zoe', lookups));
  assert.ok(carerMatches(c2, 'zoë', lookups));
  assert.ok(carerMatches(c2, 'ZOË', lookups));
  assert.ok(carerMatches(c2, "o'brien", lookups));
  assert.ok(carerMatches(c2, 'obrien', lookups));
  assert.ok(carerMatches(c2, 'brien', lookups));
  assert.ok(carerMatches(c5, 'garcia', lookups));
  assert.ok(carerMatches(c1, 'ya pat', lookups), 'whole query is a substring of the full name');
  assert.ok(carerMatches(c1, 'pp', lookups), 'initials');
  assert.ok(carerMatches(c5, 'jg', lookups));
  assert.ok(carerMatches(c4, 'ms', lookups));
  assert.ok(carerMatches(c4, 'mjs', lookups), 'hyphenated names contribute an initial too');
  assert.ok(!carerMatches(c2, 'pp', lookups));
  assert.ok(carerMatches(c1, 'p p', lookups), 'split initials still match as word prefixes');
  assert.ok(!carerMatches(c1, 'pq', lookups), 'neither initials nor a prefix');
});

test('searchCarers: active filter', () => {
  assert.deepEqual(ids(searchCarers(carers, '', {}, lookups)), ['c5', 'c2', 'c1', 'c4']);
  assert.deepEqual(ids(searchCarers(carers, '', { active: 'archived' }, lookups)), ['c3']);
  assert.equal(searchCarers(carers, '', { active: 'all' }, lookups).length, 5);
});

test('searchCarers: team, role and query filters', () => {
  assert.deepEqual(ids(searchCarers(carers, '', { teamId: 'team_day' }, lookups)), ['c1']);
  assert.deepEqual(ids(searchCarers(carers, '', { teamId: 'team_day', active: 'all' }, lookups)), ['c3', 'c1']);
  assert.deepEqual(ids(searchCarers(carers, '', { teamId: 'none', active: 'all' }, lookups)), ['c4']);
  assert.deepEqual(ids(searchCarers(carers, '', { role: 'carer', active: 'all' }, lookups)), ['c3', 'c2']);
  assert.deepEqual(ids(searchCarers(carers, '', { role: 'CARER' }, lookups)), ['c2']);
  assert.deepEqual(ids(searchCarers(carers, 'night', {}, lookups)), ['c5', 'c2']);
  assert.deepEqual(ids(searchCarers(carers, 'night', { role: 'Carer' }, lookups)), ['c2']);
  assert.deepEqual(ids(searchCarers(carers, 'zzz', {}, lookups)), []);
  assert.deepEqual(searchCarers(undefined, 'x', {}, lookups), []);
});

test('searchCarers: every sort option', () => {
  const all = { active: 'all' };
  const usages = new Map([['c1', { remaining: 10 }], ['c2', { remaining: 3.5 }], ['c4', { remaining: 20 }]]);
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'name' }, lookups)), ['c3', 'c5', 'c2', 'c1', 'c4']);
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'first' }, lookups)), ['c5', 'c4', 'c1', 'c3', 'c2']);
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'team' }, lookups)), ['c3', 'c1', 'c5', 'c2', 'c4'], 'team name, then name; no team last');
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'role' }, lookups)), ['c5', 'c3', 'c2', 'c1', 'c4']);
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'remaining', usages }, lookups)), ['c4', 'c1', 'c2', 'c3', 'c5'], 'remaining descending, missing last');
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'remaining' }, lookups)), ['c3', 'c5', 'c2', 'c1', 'c4'], 'no usages → name order');
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'start' }, lookups)), ['c4', 'c1', 'c5', 'c2', 'c3'], 'start date ascending, missing last');
  assert.deepEqual(ids(searchCarers(carers, '', { ...all, sort: 'unknown' }, lookups)), ['c3', 'c5', 'c2', 'c1', 'c4']);
});

test('searchCarers does not mutate its input', () => {
  const input = [c1, c2];
  searchCarers(input, '', { active: 'all', sort: 'first' }, lookups);
  assert.deepEqual(ids(input), ['c1', 'c2']);
});

test('searchHolidays: default sort is start desc then carer name', () => {
  assert.deepEqual(ids(searchHolidays(holidays, '', {}, lookups)), ['h3', 'h2', 'h4', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, '', undefined, lookups)), ['h3', 'h2', 'h4', 'h1']);
});

test('searchHolidays: filters', () => {
  assert.deepEqual(ids(searchHolidays(holidays, '', { carerIds: ['c1'] }, lookups)), ['h3', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { carerIds: [] }, lookups)), ['h3', 'h2', 'h4', 'h1'], 'empty list = all');
  assert.deepEqual(ids(searchHolidays(holidays, '', { typeIds: ['lt_sick'] }, lookups)), ['h2']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { typeIds: ['lt_sick', 'lt_training'] }, lookups)), ['h2', 'h4']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { statuses: ['approved'] }, lookups)), ['h4', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { statuses: ['pending', 'declined'] }, lookups)), ['h3', 'h2']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { start: '2026-04-09', end: '2026-04-30' }, lookups)), ['h1'], 'overlap, not containment');
  assert.deepEqual(ids(searchHolidays(holidays, '', { start: '2026-04-07', end: '2026-04-08' }, lookups)), ['h2', 'h4', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { start: '2026-04-11' }, lookups)), ['h3'], 'start only');
  assert.deepEqual(ids(searchHolidays(holidays, '', { end: '2026-04-06' }, lookups)), ['h4', 'h1'], 'end only');
  assert.deepEqual(ids(searchHolidays(holidays, '', { teamId: 'team_night' }, lookups)), ['h2', 'h4']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { teamId: 'team_day' }, lookups)), ['h3', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { teamId: 'team_day', statuses: ['approved'] }, lookups)), ['h1']);
  assert.deepEqual(ids(searchHolidays(holidays, '', { teamId: 'none' }, lookups)), []);
});

test('searchHolidays: query matches carer, type, notes and status label', () => {
  assert.deepEqual(ids(searchHolidays(holidays, 'spain', {}, lookups)), ['h1']);
  assert.deepEqual(ids(searchHolidays(holidays, 'priya', {}, lookups)), ['h3', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, 'pp', {}, lookups)), ['h3', 'h1'], 'initials');
  assert.deepEqual(ids(searchHolidays(holidays, 'ya pat', {}, lookups)), ['h3', 'h1'], 'full-name substring');
  assert.deepEqual(ids(searchHolidays(holidays, 'zoe', {}, lookups)), ['h2']);
  assert.deepEqual(ids(searchHolidays(holidays, 'sick', {}, lookups)), ['h2']);
  assert.deepEqual(ids(searchHolidays(holidays, 'train', {}, lookups)), ['h4']);
  assert.deepEqual(ids(searchHolidays(holidays, 'pending', {}, lookups)), ['h2']);
  assert.deepEqual(ids(searchHolidays(holidays, 'awaiting approval', {}, lookups)), ['h2']);
  assert.deepEqual(ids(searchHolidays(holidays, 'approved', {}, lookups)), ['h4', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, 'declined', {}, lookups)), ['h3']);
  assert.deepEqual(ids(searchHolidays(holidays, 'priya annual', {}, lookups)), ['h3', 'h1']);
  assert.deepEqual(ids(searchHolidays(holidays, 'priya sick', {}, lookups)), []);
  assert.deepEqual(ids(searchHolidays(holidays, 'priya', { statuses: ['approved'] }, lookups)), ['h1']);
  assert.ok(holidayMatches(h2, 'awaiting', lookups));
  assert.ok(holidayMatches(h2, 'awaiting', {}), 'a status label still matches without lookups');
  assert.ok(holidayMatches(h2, 'pending', {}));
  assert.deepEqual(ids(searchHolidays([{ id: 'x', carerId: 'ghost', start: '2026-01-01', end: '2026-01-01', status: 'approved' }], 'ghost', {}, lookups)), [], 'unknown carer does not crash');
});

test('highlight marks prefix matches at word starts', () => {
  assert.deepEqual(highlight('Priya Patel', 'pat'), [
    { text: 'Priya ', match: false }, { text: 'Pat', match: true }, { text: 'el', match: false },
  ]);
  assert.deepEqual(highlight('Priya Patel', 'p'), [
    { text: 'P', match: true }, { text: 'riya ', match: false }, { text: 'P', match: true }, { text: 'atel', match: false },
  ]);
  assert.deepEqual(highlight('Priya Patel', 'riya'), [{ text: 'Priya Patel', match: false }], 'not at a word start');
  assert.deepEqual(highlight('Priya Patel', 'ya pat'), [
    { text: 'Pri', match: false }, { text: 'ya Pat', match: true }, { text: 'el', match: false },
  ], 'a multi-word query is marked as a whole');
  assert.deepEqual(highlight('Priya Patel', 'patel priya'), [
    { text: 'Priya', match: true }, { text: ' ', match: false }, { text: 'Patel', match: true },
  ], 'each token marked; not contiguous so no whole-query run');
  assert.deepEqual(highlight('Priya Patel', ''), [{ text: 'Priya Patel', match: false }]);
  assert.deepEqual(highlight('', 'x'), []);
  assert.deepEqual(highlight(null, 'x'), []);
});

test('highlight is accent-insensitive and keeps the original text', () => {
  assert.deepEqual(highlight('Zoë O’Brien', 'zoe'), [{ text: 'Zoë', match: true }, { text: ' O’Brien', match: false }]);
  assert.deepEqual(highlight('Zoë O’Brien', 'brien'), [{ text: 'Zoë O’', match: false }, { text: 'Brien', match: true }]);
  assert.deepEqual(highlight('José', 'josé'), [{ text: 'José', match: true }]);
  const decomposed = 'Zoe\u0308'; // 'e' followed by a combining diaeresis
  assert.deepEqual(highlight(decomposed, 'zoe'), [{ text: decomposed, match: true }]);
  assert.deepEqual(highlight('07700 900123', '0770'), [{ text: '0770', match: true }, { text: '0 900123', match: false }]);
});

test('groupBy keeps first-seen key order', () => {
  const map = groupBy([c1, c2, c3, c4, c5], (c) => c.teamId);
  assert.deepEqual([...map.keys()], ['team_day', 'team_night', null]);
  assert.deepEqual(ids(map.get('team_day')), ['c1', 'c3']);
  assert.deepEqual(ids(map.get(null)), ['c4']);
  assert.equal(groupBy([], (x) => x).size, 0);
  assert.equal(groupBy(undefined, (x) => x).size, 0);
});
