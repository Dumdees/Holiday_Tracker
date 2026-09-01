// Upgrades documents saved by older versions so nothing is ever lost.
import { SCHEMA_VERSION, createEmptyDb, defaultSettings, newCarerRecord, newHolidayRecord } from './defaults.js';

/**
 * Takes anything that was saved (or imported from a backup file) and returns a
 * document in the current shape. Throws if it clearly isn't one of our backups.
 */
export function migrate(input) {
  if (!input || typeof input !== 'object') throw new Error('This file isn’t a Holiday Manager backup.');
  if (!Array.isArray(input.carers) || !Array.isArray(input.holidays)) {
    throw new Error('This file isn’t a Holiday Manager backup.');
  }
  let doc = structuredClone(input);
  if (typeof doc.schemaVersion !== 'number') doc.schemaVersion = 1;

  // Future: if (doc.schemaVersion < 2) { ...; doc.schemaVersion = 2; }

  return normalise(doc);
}

/** Fills in any missing fields with sensible defaults. Safe to run repeatedly. */
export function normalise(doc) {
  const fresh = createEmptyDb();
  const out = { ...fresh, ...doc, schemaVersion: SCHEMA_VERSION };
  out.settings = { ...defaultSettings(), ...(doc.settings || {}) };
  if (!out.settings.holidayYearStart || !out.settings.holidayYearStart.month) {
    out.settings.holidayYearStart = { month: 4, day: 1 };
  }
  out.leaveTypes = Array.isArray(doc.leaveTypes) && doc.leaveTypes.length ? doc.leaveTypes : fresh.leaveTypes;
  out.teams = Array.isArray(doc.teams) ? doc.teams : fresh.teams;
  out.bankHolidayOverrides = {
    added: Array.isArray(doc.bankHolidayOverrides?.added) ? doc.bankHolidayOverrides.added : [],
    removed: Array.isArray(doc.bankHolidayOverrides?.removed) ? doc.bankHolidayOverrides.removed : [],
  };
  out.carers = (doc.carers || []).map((c) => newCarerRecord(c, out.settings));
  out.holidays = (doc.holidays || []).map((h) => newHolidayRecord(h));
  return out;
}
