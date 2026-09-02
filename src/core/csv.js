// CSV export and import. Plain text in, plain objects out – no DOM.
// Exports open cleanly in Excel (UTF-8 BOM, CRLF, quoted fields); imports are
// forgiving about headings, dates and working-day patterns typed by hand.
import { formatNumeric, parseLooseDate, WEEKDAYS_LONG, WEEKDAYS_SHORT } from './dates.js';
import { HOLIDAY_STATUSES, defaultSettings } from '../store/defaults.js';
import { normaliseText } from './search.js';

const BOM = '\uFEFF';
const CRLF = '\r\n';

// ---------- Generic CSV ----------

/**
 * Quote a single CSV field when it needs it (comma, quote, line break, leading/trailing space).
 * @param {unknown} value – null/undefined become ''
 * @returns {string}
 */
export function escapeCsvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s) || s !== s.trim()) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Build CSV text from rows. Header row from column labels, CRLF line endings,
 * a UTF-8 BOM prefix so Excel opens it correctly, and a trailing line break.
 * @param {object[]} rows
 * @param {{ key: string, label: string, get?: (row: object) => unknown }[]} columns
 * @returns {string}
 */
export function toCsv(rows, columns) {
  const lines = [columns.map((c) => escapeCsvField(c.label ?? c.key)).join(',')];
  for (const row of rows ?? []) {
    lines.push(columns.map((c) => escapeCsvField(c.get ? c.get(row) : row?.[c.key])).join(','));
  }
  return BOM + lines.join(CRLF) + CRLF;
}

/**
 * Parse CSV text into rows of raw string fields (no header handling, blank rows kept).
 * Handles a BOM, quoted fields containing commas/line breaks/doubled quotes, CRLF, CR and LF.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRows(text) {
  const src = String(text ?? '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let quotedField = false;
  for (let i = src.charCodeAt(0) === 0xfeff ? 1 : 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (src[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = false;
      continue;
    }
    if (ch === '"' && field === '' && !quotedField) { inQuotes = true; quotedField = true; continue; }
    if (ch === ',') { row.push(field); field = ''; quotedField = false; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      quotedField = false;
      continue;
    }
    field += ch;
  }
  if (field !== '' || quotedField || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Parse CSV text into objects keyed by the trimmed header row. Blank lines are skipped;
 * values are NOT trimmed (so quoted spaces survive a round trip). Empty text → [].
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const rows = parseCsvRows(text).filter((r) => r.some((f) => f.trim() !== ''));
  if (!rows.length) return [];
  const keys = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    keys.forEach((k, i) => { if (k) obj[k] = r[i] ?? ''; });
    return obj;
  });
}

// ---------- Working days ----------

const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7];
const SHORTHAND = 'mtwtfss'; // positional letters Mon..Sun
const SINGLE_LETTER = { m: 1, w: 3, f: 5 }; // 't' and 's' are ambiguous on their own

/**
 * Parse a working-days pattern typed by a person into ISO weekday numbers (1 = Mon … 7 = Sun).
 * Accepts 'Mon-Fri', 'Mon to Fri', 'Mon, Wed, Fri', 'Monday Wednesday', 'MTWTF', 'MWF',
 * 'weekdays', 'weekend', 'every day', '1,2,3', '1-5'. Empty or unrecognised → null.
 * @param {string} text
 * @returns {number[]|null} sorted, unique
 */
export function parseWorkingDays(text) {
  const t = normaliseText(text).replace(/[–—]/g, '-').replace(/\b(to|through|thru|until)\b/g, '-');
  if (!t) return null;
  if (/^(every ?day|all( days)?|daily|full ?week|7 days|seven days|any ?day)$/.test(t)) return [...DAY_NUMBERS];
  if (/^(week ?days|working ?days|mon ?- ?fri)$/.test(t)) return [1, 2, 3, 4, 5];
  if (/^week ?ends?$/.test(t)) return [6, 7];
  const letterRange = t.match(/^([mtwfs]) ?- ?([mtwfs])$/);
  if (letterRange) return tidyDays(rangeFromLetters(letterRange[1], letterRange[2]));
  return tidyDays(parseNumericDays(t) ?? parseShorthand(t) ?? parseNamedDays(t));
}

/**
 * 'Mon, Tue, Wed, Thu, Fri' for [1, 2, 3, 4, 5]. Unknown numbers are ignored; empty → ''.
 * @param {number[]|null|undefined} days – ISO weekday numbers
 * @returns {string}
 */
export function formatWorkingDays(days) {
  return (tidyDays(days) ?? []).map((n) => WEEKDAYS_SHORT[n - 1]).join(', ');
}

function tidyDays(days) {
  if (!days) return null;
  const set = new Set(days.map(Number).filter((n) => n >= 1 && n <= 7));
  return set.size ? [...set].sort((a, b) => a - b) : null;
}

/** '1,2,3', '1-5', '1 3 5' */
function parseNumericDays(t) {
  if (!/^[1-7]([\s,;/&+-]+[1-7])*$/.test(t)) return null;
  const out = [];
  for (const part of t.split(/[\s,;/&+]+/)) {
    const range = part.match(/^([1-7])-([1-7])$/);
    if (range) out.push(...daysBetween(Number(range[1]), Number(range[2])));
    else out.push(Number(part));
  }
  return out;
}

/** 'M-F': two single letters with a range marker; 't' and 's' are too ambiguous to guess. */
function rangeFromLetters(fromLetter, toLetter) {
  const from = SINGLE_LETTER[fromLetter];
  const to = SINGLE_LETTER[toLetter];
  return from && to ? daysBetween(from, to) : null;
}

/** 'MTWTF', 'MWF', 'TT': letters read left to right in weekday order. */
function parseShorthand(t) {
  const letters = t.replace(/[^a-z]/g, '');
  if (!/^[mtwfs]{1,7}$/.test(letters) || letters.length !== t.replace(/[^a-z0-9]/g, '').length) return null;
  const out = [];
  let pos = 0;
  for (const letter of letters) {
    const next = SHORTHAND.indexOf(letter, pos);
    if (next === -1) return null;
    out.push(next + 1);
    pos = next + 1;
  }
  return out;
}

/** 'Mon, Wed, Fri', 'Monday Wednesday', 'Mon-Fri', 'Fri - Mon', 'Tues & Thurs'. */
function parseNamedDays(t) {
  const cleaned = t.replace(/[^a-z\s,;/&+-]/g, ' ').replace(/\s*-\s*/g, '-');
  const parts = cleaned.split(/[\s,;/&+]+/).filter((p) => p && p !== 'and');
  if (!parts.length) return null;
  const out = [];
  for (const part of parts) {
    const range = part.split('-').filter(Boolean);
    if (range.length === 2) {
      const from = dayNumber(range[0]);
      const to = dayNumber(range[1]);
      if (!from || !to) return null;
      out.push(...daysBetween(from, to));
    } else if (range.length === 1) {
      const n = dayNumber(range[0]);
      if (!n) return null;
      out.push(n);
    } else return null;
  }
  return out;
}

function dayNumber(word) {
  if (word.length === 1) return SINGLE_LETTER[word] ?? null;
  if (word.length < 2) return null;
  const idx = WEEKDAYS_LONG.findIndex((name) => {
    const long = name.toLowerCase();
    return long.startsWith(word) || word.startsWith(long);
  });
  return idx === -1 ? null : idx + 1;
}

/** Inclusive run of weekday numbers, wrapping past Sunday ('Fri-Mon' → 5, 6, 7, 1). */
function daysBetween(from, to) {
  const out = [from];
  let cur = from;
  while (cur !== to) { cur = (cur % 7) + 1; out.push(cur); }
  return out;
}

// ---------- Export ----------

function statusLabel(status) {
  return HOLIDAY_STATUSES.find((s) => s.id === status)?.label ?? '';
}

function fullName(carer) {
  return `${carer?.firstName ?? ''} ${carer?.lastName ?? ''}`.trim();
}

/**
 * CSV of carers: First name, Last name, Team, Role, Start date, End date, Working days,
 * Entitlement days, Phone, Email, Notes, Status. Dates are dd/mm/yyyy.
 * @param {object[]} carers
 * @param {{ teamsById?: Map<string, object> }} [lookups]
 * @returns {string}
 */
export function carersToCsv(carers, lookups = {}) {
  const teamName = (c) => lookups.teamsById?.get?.(c.teamId)?.name ?? '';
  return toCsv(carers, [
    { key: 'firstName', label: 'First name' },
    { key: 'lastName', label: 'Last name' },
    { key: 'team', label: 'Team', get: teamName },
    { key: 'role', label: 'Role' },
    { key: 'startDate', label: 'Start date', get: (c) => formatNumeric(c.startDate) },
    { key: 'endDate', label: 'End date', get: (c) => formatNumeric(c.endDate) },
    { key: 'workingDays', label: 'Working days', get: (c) => formatWorkingDays(c.workingDays) },
    { key: 'entitlementDays', label: 'Entitlement days' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'notes', label: 'Notes' },
    { key: 'status', label: 'Status', get: (c) => (c.active === false ? 'Archived' : 'Active') },
  ]);
}

/**
 * CSV of holidays: Carer, Team, From, To, Days, Type, Status, Half day, Notes.
 * @param {{ holiday: object, carer?: object, leaveType?: object, days?: number, teamName?: string }[]} items
 * @returns {string}
 */
export function holidaysToCsv(items) {
  const halfDay = { am: 'Morning', pm: 'Afternoon' };
  return toCsv(items, [
    { key: 'carer', label: 'Carer', get: (it) => fullName(it.carer) || 'Unknown carer' },
    { key: 'team', label: 'Team', get: (it) => it.teamName ?? '' },
    { key: 'from', label: 'From', get: (it) => formatNumeric(it.holiday?.start) },
    { key: 'to', label: 'To', get: (it) => formatNumeric(it.holiday?.end) },
    { key: 'days', label: 'Days', get: (it) => it.days ?? '' },
    { key: 'type', label: 'Type', get: (it) => it.leaveType?.name ?? '' },
    { key: 'status', label: 'Status', get: (it) => statusLabel(it.holiday?.status) },
    { key: 'halfDay', label: 'Half day', get: (it) => halfDay[it.holiday?.halfDay] ?? '' },
    { key: 'notes', label: 'Notes', get: (it) => it.holiday?.notes ?? '' },
  ]);
}

// ---------- Import ----------

// Header aliases, compared after lowercasing and removing everything but letters and digits.
const HEADER_ALIASES = {
  firstName: ['firstname', 'forename', 'forenames', 'first', 'givenname', 'givennames', 'firstnames'],
  lastName: ['lastname', 'surname', 'last', 'familyname'],
  name: ['name', 'fullname', 'carer', 'carername'],
  team: ['team', 'teamname'],
  role: ['role', 'jobtitle', 'job', 'position'],
  startDate: ['startdate', 'start', 'started', 'joined', 'datejoined', 'joindate', 'startedon'],
  endDate: ['enddate', 'end', 'left', 'leftdate', 'leavingdate', 'dateleft', 'finished', 'ended'],
  entitlement: ['entitlement', 'entitlementdays', 'days', 'annualleave', 'annualleavedays', 'holidaydays', 'holidayentitlement', 'holidays', 'leavedays'],
  workingDays: ['workingdays', 'daysworked', 'pattern', 'works', 'workingpattern', 'workdays', 'workingweek'],
  phone: ['phone', 'mobile', 'telephone', 'phonenumber', 'mobilenumber', 'tel', 'contactnumber'],
  email: ['email', 'emailaddress'],
  notes: ['notes', 'note', 'comments', 'comment'],
  status: ['status', 'active'],
};

const headerKey = (h) => normaliseText(h).replace(/[^a-z0-9]/g, '');

/** Map each recognised field to the actual header it was found under. */
function matchHeaders(headers) {
  const found = {};
  for (const header of headers) {
    const key = headerKey(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!(field in found) && aliases.includes(key)) found[field] = header;
    }
  }
  return found;
}

function splitName(name) {
  const idx = name.lastIndexOf(' ');
  return idx === -1 ? { first: name, last: '' } : { first: name.slice(0, idx), last: name.slice(idx + 1) };
}

function parseEntitlement(value) {
  const m = value.match(/^(\d+(?:[.,]\d+)?)\s*(?:days?)?$/i);
  return m ? Number(m[1].replace(',', '.')) : null;
}

const INACTIVE = /^(archived|inactive|left|leaver|no|false|0)$/;

/**
 * Read carers from CSV text typed or exported by a person. Headings are matched loosely
 * ('First name', 'Forename', 'Surname', 'Started', 'Mobile'…); a single 'Name' column is split
 * on its last space. Dates try dd/mm/yyyy first. Unknown teams, unreadable dates, non-numeric
 * entitlement and unrecognised working days fall back to defaults with a warning; a row with
 * no name at all is skipped with an error.
 * @param {string} text
 * @param {{ settings?: object, teams?: object[], carers?: object[] }} db
 * @returns {{ carers: object[], errors: { row: number, message: string, warning: boolean }[] }}
 *   carers are patches ready for addCarers(); row numbers are 1-based data rows (0 = the file as a whole)
 */
export function parseCarersCsv(text, db = {}) {
  const settings = { ...defaultSettings(), ...(db.settings ?? {}) };
  const rows = parseCsv(text);
  const carers = [];
  const errors = [];
  if (!rows.length) return { carers, errors };

  const cols = matchHeaders(Object.keys(rows[0]));
  if (!cols.firstName && !cols.lastName && !cols.name) {
    errors.push({ row: 0, message: 'We couldn’t find a name column. The first row should have headings such as “First name” and “Last name”.', warning: false });
    return { carers, errors };
  }

  const teamsByName = new Map((db.teams ?? []).map((t) => [normaliseText(t.name), t.id]));
  const rolesByName = new Map((settings.roles ?? []).map((r) => [normaliseText(r), r]));
  const existingNames = new Set((db.carers ?? []).map((c) => normaliseText(fullName(c))));
  const defaultDays = formatWorkingDays(settings.defaultWorkingDays);

  rows.forEach((raw, i) => {
    const row = i + 1;
    const cell = (field) => (cols[field] ? String(raw[cols[field]] ?? '').trim() : '');
    const warn = (message) => errors.push({ row, message, warning: true });

    let firstName = cell('firstName');
    let lastName = cell('lastName');
    if ((!firstName || !lastName) && cell('name')) {
      const split = splitName(cell('name'));
      firstName = firstName || split.first;
      lastName = lastName || split.last;
    }
    if (!firstName && !lastName) {
      errors.push({ row, message: 'No name was given, so this row was skipped.', warning: false });
      return;
    }
    const name = `${firstName} ${lastName}`.trim();
    if (existingNames.has(normaliseText(name))) warn(`There is already a carer called ${name} – check for duplicates after importing.`);

    let teamId = null;
    const teamText = cell('team');
    if (teamText) {
      teamId = teamsByName.get(normaliseText(teamText)) ?? null;
      if (!teamId) warn(`We couldn’t find a team called “${teamText}”, so ${name} has been left with no team.`);
    }

    const roleText = cell('role');
    const role = rolesByName.get(normaliseText(roleText)) ?? roleText ?? '';

    const readDate = (field, label) => {
      const value = cell(field);
      if (!value) return null;
      const iso = parseLooseDate(value);
      if (!iso) warn(`The ${label} “${value}” wasn’t understood, so it has been left blank.`);
      return iso;
    };
    const startDate = readDate('startDate', 'start date');
    const endDate = readDate('endDate', 'end date');

    let entitlementDays = settings.defaultEntitlementDays;
    const entitlementText = cell('entitlement');
    if (entitlementText) {
      const parsed = parseEntitlement(entitlementText);
      if (parsed == null) warn(`The entitlement “${entitlementText}” isn’t a number, so ${settings.defaultEntitlementDays} days has been used.`);
      else entitlementDays = parsed;
    }

    let workingDays = [...settings.defaultWorkingDays];
    const daysText = cell('workingDays');
    if (daysText) {
      const parsed = parseWorkingDays(daysText);
      if (parsed) workingDays = parsed;
      else warn(`The working days “${daysText}” weren’t understood, so ${defaultDays} has been used.`);
    }

    const statusText = normaliseText(cell('status'));
    carers.push({
      firstName,
      lastName,
      role: role || settings.roles?.[0] || 'Carer',
      teamId,
      startDate,
      endDate,
      workingDays,
      entitlementDays,
      phone: cell('phone'),
      email: cell('email'),
      notes: cell('notes'),
      active: !INACTIVE.test(statusText),
    });
  });

  return { carers, errors };
}
