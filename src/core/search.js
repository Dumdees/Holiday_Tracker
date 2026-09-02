// Instant search, filtering and sorting for carers and holidays.
// Pure functions – no DOM, no signals. Everything is case- and accent-insensitive
// so 'zoe' finds 'Zoë' and 'obrien' finds "O'Brien".
import { HOLIDAY_STATUSES } from '../store/defaults.js';

/**
 * Normalise text for comparison: lowercase, accents stripped (NFD then diacritics
 * removed), curly apostrophes straightened, whitespace collapsed and trimmed.
 * @param {unknown} text – anything; null/undefined become ''.
 * @returns {string}
 */
export function normaliseText(text) {
  if (text == null) return '';
  return foldText(String(text))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a query into normalised, non-empty tokens. Punctuation wrapped around a token
 * is dropped ('Patel,' → 'patel', '"priya"' → 'priya') so a pasted "Surname, First"
 * still finds people; punctuation inside a token ("o'brien", 'priya.patel') is kept.
 * @param {string} query
 * @returns {string[]}
 */
export function tokenise(query) {
  const q = normaliseText(query);
  if (!q) return [];
  return q.split(' ').map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '') || t);
}

/**
 * Initials of a carer's name, one letter per whitespace-separated word ('pp' for Priya Patel).
 * @param {{ firstName?: string, lastName?: string }} carer
 * @returns {string}
 */
export function initialsOf(carer) {
  return initialsFrom(nameOf(carer), /\s+/);
}

/**
 * Sort comparator: last name, then first name, then id – case and accent insensitive.
 * @param {{ firstName?: string, lastName?: string, id?: string }} a
 * @param {{ firstName?: string, lastName?: string, id?: string }} b
 * @returns {number}
 */
export function compareCarerNames(a, b) {
  return compareStrings(surnameKey(a), surnameKey(b))
    || compareStrings(normaliseText(a?.firstName), normaliseText(b?.firstName))
    || compareStrings(a?.id ?? '', b?.id ?? '');
}

/** Sort key for a surname; someone known by one name ('Madonna') sorts by that name. */
function surnameKey(carer) {
  return normaliseText(carer?.lastName) || normaliseText(carer?.firstName);
}

/**
 * Does a carer match a free-text query?
 * Every whitespace token must match the start of a word in the first name, last name,
 * role, team name, notes, phone (digits-only too) or email; OR the whole query is a
 * substring of the full name; OR the query is the carer's initials (2–4 letters).
 * An empty query matches everyone.
 * @param {object} carer
 * @param {string} query
 * @param {{ teamsById?: Map<string, object> }} [lookups]
 * @returns {boolean}
 */
export function carerMatches(carer, query, lookups = {}) {
  if (!carer) return false;
  const tokens = tokenise(query);
  if (!tokens.length) return true;
  return tokensMatch(tokens, carerWords(carer, lookups ?? {})) || nameMatches(carer, tokens);
}

/**
 * Filter and sort carers for the Carers list.
 * @param {object[]} carers
 * @param {string} query – free text (see carerMatches)
 * @param {object} [options]
 * @param {string|null} [options.teamId] – team id to keep; null = all; 'none' = carers with no team
 * @param {string|null} [options.role] – role to keep (case-insensitive); null = all
 * @param {'active'|'archived'|'all'} [options.active='active']
 * @param {'name'|'first'|'team'|'role'|'remaining'|'start'} [options.sort='name']
 * @param {Map<string, { remaining: number }>|null} [options.usages] – per-carer usage, needed for sort 'remaining'
 * @param {{ teamsById?: Map<string, object> }} [lookups]
 * @returns {object[]} a new array, filtered and sorted
 */
export function searchCarers(carers, query, options = {}, lookups = {}) {
  const { teamId = null, role = null, active = 'active', sort = 'name', usages = null } = options ?? {};
  const maps = lookups ?? {};
  const wantedRole = role ? normaliseText(role) : null;
  const kept = (carers ?? []).filter((c) =>
    c
    && matchesActive(c, active)
    && matchesTeam(c, teamId)
    && (!wantedRole || normaliseText(c.role) === wantedRole)
    && carerMatches(c, query, maps));
  return kept.sort(carerComparator(sort, usages, maps));
}

/**
 * Does a holiday match a free-text query? Tokens are matched against the carer's
 * name, the leave type name, the notes and the status label ('approved',
 * 'awaiting approval', 'pending', 'declined'), with the same full-name and
 * initials shortcuts as carerMatches.
 * @param {object} holiday
 * @param {string} query
 * @param {{ carersById?: Map, leaveTypesById?: Map }} [lookups]
 * @returns {boolean}
 */
export function holidayMatches(holiday, query, lookups = {}) {
  if (!holiday) return false;
  const maps = lookups ?? {};
  return holidayMatchesTokens(holiday, tokenise(query), maps, lookup(maps.carersById, holiday.carerId));
}

/**
 * Filter and sort holidays for the All holidays / Remove holidays tables.
 * Sorted by start date (newest first), then carer name.
 * @param {object[]} holidays
 * @param {string} query – free text (see holidayMatches)
 * @param {object} [filters]
 * @param {string[]} [filters.carerIds] – keep only these carers (empty = all)
 * @param {string[]} [filters.typeIds] – keep only these leave types (empty = all)
 * @param {string[]} [filters.statuses] – keep only these statuses (empty = all)
 * @param {string} [filters.start] – keep holidays overlapping [start, end] (either end optional)
 * @param {string} [filters.end]
 * @param {string|null} [filters.teamId] – via the carer's team; 'none' = carers with no team
 * @param {{ carersById?: Map, teamsById?: Map, leaveTypesById?: Map }} [lookups]
 * @returns {object[]} a new array, filtered and sorted
 */
export function searchHolidays(holidays, query, filters = {}, lookups = {}) {
  const { carerIds, typeIds, statuses, start, end, teamId = null } = filters ?? {};
  const maps = lookups ?? {};
  const carerSet = toSet(carerIds);
  const typeSet = toSet(typeIds);
  const statusSet = toSet(statuses);
  const tokens = tokenise(query);
  const carerOf = (h) => lookup(maps.carersById, h.carerId);

  const kept = (holidays ?? []).filter((h) => {
    if (!h) return false;
    if (carerSet && !carerSet.has(h.carerId)) return false;
    if (typeSet && !typeSet.has(h.typeId)) return false;
    if (statusSet && !statusSet.has(h.status)) return false;
    const hStart = h.start ?? '';
    const hEnd = h.end || hStart; // a one-day holiday may have no end recorded
    if ((start || end) && !hStart) return false; // no dates → can't overlap a range
    if (start && hEnd < start) return false;
    if (end && hStart > end) return false;
    const carer = carerOf(h);
    if (teamId != null && !matchesTeam(carer ?? {}, teamId)) return false;
    return holidayMatchesTokens(h, tokens, maps, carer);
  });

  return kept.sort((a, b) =>
    compareStrings(b.start ?? '', a.start ?? '')
    || compareCarerNames(carerOf(a) ?? {}, carerOf(b) ?? {})
    || compareStrings(b.end ?? '', a.end ?? '')
    || compareStrings(a.id ?? '', b.id ?? ''));
}

/**
 * Split text into segments for bold rendering of search matches. Each query token is
 * marked wherever it matches the start of a word (accent-insensitively); a multi-word
 * query is also marked wherever it appears as a whole.
 * @param {unknown} text
 * @param {string} query
 * @returns {{ text: string, match: boolean }[]} – empty for empty text
 */
export function highlight(text, query) {
  const str = text == null ? '' : String(text);
  if (!str) return [];
  const tokens = tokenise(query);
  if (!tokens.length) return [{ text: str, match: false }];

  const { folded, starts, ends } = foldWithPositions(str);
  const marked = new Uint8Array(str.length);
  const mark = (from, to) => { for (let k = starts[from]; k < ends[to - 1]; k++) marked[k] = 1; };
  const markAll = (needle, wordStartOnly) => {
    for (let i = folded.indexOf(needle); i !== -1; i = folded.indexOf(needle, i + 1)) {
      if (!wordStartOnly || isWordStart(folded, i)) mark(i, i + needle.length);
    }
  };
  for (const t of tokens) markAll(t, true);
  if (tokens.length > 1) markAll(tokens.join(' '), false);
  return segmentsFrom(str, marked);
}

/**
 * Group a list into a Map of key → items, keeping first-seen key order.
 * @template T, K
 * @param {T[]} list
 * @param {(item: T) => K} keyFn
 * @returns {Map<K, T[]>}
 */
export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list ?? []) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

// ---------- Matching helpers ----------

const NON_ALNUM = /[^a-z0-9]+/;

/** Words a value can be matched on: the whole value, a punctuation-free copy and each part. */
function wordsOf(value) {
  const n = normaliseText(value);
  if (!n) return [];
  const words = [n];
  const bare = n.replace(/[^a-z0-9 ]+/g, '');
  if (bare && bare !== n) words.push(bare);
  for (const part of n.split(NON_ALNUM)) if (part) words.push(part);
  return words;
}

/** Phone words: the text, its digits, and for '+44 (0)7700…' the plain '07700…' form too. */
function phoneWords(phone) {
  const words = wordsOf(phone);
  const raw = String(phone ?? '');
  const digits = raw.replace(/\D/g, '');
  if (digits) words.push(digits);
  const national = raw.replace(/\(0\)/g, '').replace(/\D/g, '');
  if (national && national !== digits) words.push(national);
  if (national.startsWith('44') && national.length > 10) words.push('0' + national.slice(2));
  return words;
}

function emailWords(email) {
  const words = wordsOf(email);
  const domain = normaliseText(email).split('@')[1];
  if (domain) words.push(domain);
  return words;
}

function statusWords(status) {
  const label = HOLIDAY_STATUSES.find((s) => s.id === status)?.label ?? status;
  return [...wordsOf(label), ...wordsOf(status)];
}

function carerWords(carer, lookups) {
  const team = lookup(lookups.teamsById, carer.teamId);
  return [
    ...wordsOf(carer.firstName),
    ...wordsOf(carer.lastName),
    ...wordsOf(carer.role),
    ...wordsOf(team?.name),
    ...wordsOf(carer.notes),
    ...phoneWords(carer.phone),
    ...emailWords(carer.email),
  ];
}

const HALF_DAY_WORDS = { am: ['half day', 'half', 'day', 'morning'], pm: ['half day', 'half', 'day', 'afternoon'] };

function holidayWords(holiday, lookups, carer) {
  const type = lookup(lookups.leaveTypesById, holiday.typeId);
  const team = lookup(lookups.teamsById, carer?.teamId);
  return [
    ...wordsOf(carer?.firstName),
    ...wordsOf(carer?.lastName),
    ...wordsOf(type?.name),
    ...wordsOf(team?.name),
    ...wordsOf(holiday.notes),
    ...statusWords(holiday.status),
    ...(HALF_DAY_WORDS[holiday.halfDay] ?? []),
  ];
}

function holidayMatchesTokens(holiday, tokens, lookups, carer) {
  if (!tokens.length) return true;
  return tokensMatch(tokens, holidayWords(holiday, lookups, carer)) || (!!carer && nameMatches(carer, tokens));
}

/** Every token must be a prefix of some word (or, for tokens with digits, of a word's digits). */
function tokensMatch(tokens, words) {
  return tokens.every((token) => {
    const digits = token.replace(/\D/g, '');
    return words.some((w) => w.startsWith(token) || (digits && digits !== token && w.startsWith(digits)));
  });
}

/** Whole-query substring of the full name, or the query is the carer's initials. */
function nameMatches(carer, tokens) {
  const q = tokens.join(' ');
  const name = nameOf(carer);
  if (name.includes(q) || name.replace(/[^a-z0-9 ]+/g, '').includes(q)) return true;
  if (tokens.length !== 1) return false;
  const letters = q.replace(/\./g, ''); // 'p.p.' asks for the same initials as 'pp'
  if (!/^[a-z]{2,4}$/.test(letters)) return false;
  return initialsFrom(name, /\s+/) === letters || initialsFrom(name, /[\s-]+/) === letters;
}

function nameOf(carer) {
  return normaliseText(`${carer?.firstName ?? ''} ${carer?.lastName ?? ''}`);
}

function initialsFrom(normalisedName, splitter) {
  return normalisedName.split(splitter).filter(Boolean).map((w) => w[0]).join('');
}

function lookup(map, id) {
  if (!map || id == null) return undefined;
  return typeof map.get === 'function' ? map.get(id) : map[id];
}

function toSet(list) {
  return Array.isArray(list) && list.length ? new Set(list) : null;
}

function matchesActive(carer, active) {
  if (active === 'active') return carer.active !== false;
  if (active === 'archived') return carer.active === false;
  return true;
}

function matchesTeam(carer, teamId) {
  if (teamId == null || teamId === '') return true;
  if (teamId === 'none') return !carer.teamId;
  return carer.teamId === teamId;
}

// ---------- Sorting helpers ----------

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Compare two values, putting missing ones (null/undefined/''/NaN) last whichever direction. */
function compareValues(a, b, desc = false) {
  const aMissing = a == null || a === '' || Number.isNaN(a);
  const bMissing = b == null || b === '' || Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const r = a < b ? -1 : a > b ? 1 : 0;
  return desc ? -r : r;
}

function carerComparator(sort, usages, lookups) {
  const teamName = (c) => normaliseText(lookup(lookups.teamsById, c.teamId)?.name) || null;
  const remaining = (c) => lookup(usages, c.id)?.remaining ?? null;
  switch (sort) {
    case 'first':
      return (a, b) => compareValues(normaliseText(a.firstName) || null, normaliseText(b.firstName) || null) || compareCarerNames(a, b);
    case 'team':
      return (a, b) => compareValues(teamName(a), teamName(b)) || compareCarerNames(a, b);
    case 'role':
      return (a, b) => compareValues(normaliseText(a.role) || null, normaliseText(b.role) || null) || compareCarerNames(a, b);
    case 'remaining':
      return (a, b) => compareValues(remaining(a), remaining(b), true) || compareCarerNames(a, b);
    case 'start':
      return (a, b) => compareValues(a.startDate, b.startDate) || compareCarerNames(a, b);
    default:
      return compareCarerNames;
  }
}

// ---------- Folding helpers ----------

// Letters NFD cannot split into a base letter and an accent, folded by hand so
// 'soren' finds Søren, 'lukasz' finds Łukasz and 'strasse' finds Straße.
const FOLD_LETTERS = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i', ĸ: 'k', ŧ: 't', ħ: 'h' };
const FOLD_RE = /[øæœßłđðþıĸŧħ]/g;

/** Fold one string: accents stripped, curly apostrophes straightened, lowercased, special letters mapped. */
function foldText(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019`]/g, "'")
    .toLowerCase()
    .replace(FOLD_RE, (ch) => FOLD_LETTERS[ch]);
}

// ---------- Highlight helpers ----------

/**
 * Fold text the way normaliseText does (minus whitespace collapsing) while remembering,
 * for every folded character, which original code units it came from.
 */
function foldWithPositions(str) {
  let folded = '';
  const starts = [];
  const ends = [];
  let pos = 0;
  for (const ch of str) {
    const f = foldText(ch);
    if (!f && ends.length) ends[ends.length - 1] = pos + ch.length; // a lone combining mark stays with its base letter
    for (let i = 0; i < f.length; i++) {
      folded += f[i];
      starts.push(pos);
      ends.push(pos + ch.length);
    }
    pos += ch.length;
  }
  return { folded, starts, ends };
}

function isWordStart(folded, i) {
  return i === 0 || !/[a-z0-9]/.test(folded[i - 1]);
}

function segmentsFrom(str, marked) {
  const out = [];
  let from = 0;
  for (let i = 1; i <= str.length; i++) {
    if (i === str.length || marked[i] !== marked[from]) {
      out.push({ text: str.slice(from, i), match: marked[from] === 1 });
      from = i;
    }
  }
  return out;
}
