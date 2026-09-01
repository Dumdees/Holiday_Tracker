// Builders for dropdown options so every view lists carers, teams and leave types the same way.
import { HOLIDAY_STATUSES } from '../../store/defaults.js';

function byName(a, b) {
  const la = `${a.lastName} ${a.firstName}`.toLowerCase();
  const lb = `${b.lastName} ${b.firstName}`.toLowerCase();
  return la < lb ? -1 : la > lb ? 1 : 0;
}

/** MultiSelect options for carers, grouped by team (teams in their saved order, "No team" last). */
export function carerOptions(carers, teams, { includeArchived = false } = {}) {
  const teamOrder = new Map(teams.map((t, i) => [t.id, i]));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const list = carers.filter((c) => includeArchived || c.active).sort((a, b) => {
    const ta = a.teamId && teamOrder.has(a.teamId) ? teamOrder.get(a.teamId) : 999;
    const tb = b.teamId && teamOrder.has(b.teamId) ? teamOrder.get(b.teamId) : 999;
    return ta - tb || byName(a, b);
  });
  return list.map((c) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`.trim(),
    group: (c.teamId && teamName.get(c.teamId)) || 'No team',
    colour: c.colour,
    sub: [c.role, c.active ? null : 'Archived'].filter(Boolean).join(' · '),
  }));
}

/** Select options for teams. */
export function teamOptions(teams, { allLabel = 'All teams', includeAll = true, includeNone = false } = {}) {
  const out = [];
  if (includeAll) out.push({ value: '', label: allLabel });
  for (const t of teams) out.push({ value: t.id, label: t.name });
  if (includeNone) out.push({ value: 'none', label: 'No team' });
  return out;
}

/** Select options for leave types (archived ones hidden unless requested). */
export function leaveTypeOptions(leaveTypes, { includeArchived = false, includeAll = false, allLabel = 'All types' } = {}) {
  const out = [];
  if (includeAll) out.push({ value: '', label: allLabel });
  for (const t of leaveTypes) if (includeArchived || !t.archived) out.push({ value: t.id, label: t.name });
  return out;
}

export function statusOptions({ includeAll = false, allLabel = 'Any status', includeDeclined = true } = {}) {
  const out = [];
  if (includeAll) out.push({ value: '', label: allLabel });
  for (const s of HOLIDAY_STATUSES) if (includeDeclined || s.id !== 'declined') out.push({ value: s.id, label: s.label });
  return out;
}

export function statusLabel(status) {
  return HOLIDAY_STATUSES.find((s) => s.id === status)?.label || status;
}

/** Role options from settings.roles plus any roles already in use. */
export function roleOptions(settings, carers = []) {
  const set = new Set(settings.roles || []);
  for (const c of carers) if (c.role) set.add(c.role);
  return [...set].map((r) => ({ value: r, label: r }));
}
