// Calendar: month grid with a chip per person off, a year heat view and a week list.
import { useState, useMemo, useEffect } from 'preact/hooks';
import { navigate } from '../../app/router.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { SelectField, Toggle } from '../components/Field.jsx';
import { Badge } from '../components/Badge.jsx';
import { Drawer } from '../components/Drawer.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icon.jsx';
import { db, carers, holidays, teams, teamsById, leaveTypes, leaveTypesById, carersById, settings, carerName } from '../../store/store.js';
import { countLeaveDays } from '../../core/leaveDays.js';
import { formatDays } from '../../core/entitlement.js';
import { monthGrid, weekdayHeaders, parts, makeISO, addMonths, addDays, startOfWeek, formatLong, formatShort, formatRange, monthName, MONTHS, daysInMonth, eachDay, isWeekend, rangesOverlap, formatMonthYear, relativeDay } from '../../core/dates.js';
import { yearBounds } from '../../core/holidayYear.js';
import { ctx } from '../shared/context.js';
import { today } from '../shared/today.js';
import { teamOptions, leaveTypeOptions } from '../shared/options.js';
import { CarerName, LeaveTypeTag, daysLabel, halfDayLabel } from '../shared/bits.jsx';
import { openHolidayDialog } from '../dialogs/HolidayDialog.jsx';

const VIEWS = [
  { id: 'month', label: 'Month', icon: 'grid' },
  { id: 'year', label: 'Year', icon: 'calendar' },
  { id: 'week', label: 'Week list', icon: 'list' },
];
const MAX_CHIPS = 4;

/** Map<iso, [{ holiday, carer, leaveType }]> for every day in [start, end] with someone off. */
function absencesByDay(start, end, { teamId, typeId, includePending }) {
  const map = new Map();
  for (const h of holidays.value) {
    if (h.status === 'declined') continue;
    if (!includePending && h.status === 'pending') continue;
    if (typeId && h.typeId !== typeId) continue;
    if (!rangesOverlap(h.start, h.end, start, end)) continue;
    const carer = carersById.value.get(h.carerId);
    if (!carer) continue;
    if (teamId && carer.teamId !== teamId) continue;
    const leaveType = leaveTypesById.value.get(h.typeId);
    const from = h.start > start ? h.start : start;
    const to = h.end < end ? h.end : end;
    for (const d of eachDay(from, to)) {
      if (!map.has(d)) map.set(d, []);
      map.get(d).push({ holiday: h, carer, leaveType });
    }
  }
  for (const list of map.values()) list.sort((a, b) => `${a.carer.lastName} ${a.carer.firstName}`.localeCompare(`${b.carer.lastName} ${b.carer.firstName}`));
  return map;
}

function useFilters(params) {
  const [teamId, setTeamId] = useState(params.team || '');
  const [typeId, setTypeId] = useState('');
  const [includePending, setIncludePending] = useState(true);
  return { teamId, setTeamId, typeId, setTypeId, includePending, setIncludePending };
}

export function Calendar({ params }) {
  const t = today.value;
  const view = VIEWS.some((v) => v.id === params.view) ? params.view : 'month';
  const month = /^\d{4}-\d{2}$/.test(params.month || '') ? params.month : t.slice(0, 7);
  const [selectedDay, setSelectedDay] = useState(params.day || null);
  useEffect(() => { if (params.day) setSelectedDay(params.day); }, [params.day]);
  const filters = useFilters(params);
  const s = settings.value;

  const go = (patch) => navigate('calendar', { view, month, team: filters.teamId, ...patch, day: undefined });
  const { y, m } = parts(month + '-01');
  // In the year view the dropdown lists holiday years ("2026/27"), matching what the grid shows.
  const hys = s.holidayYearStart;
  const hyStartYear = m >= hys.month ? y : y - 1;
  const yearSelect = view === 'year'
    ? { value: hyStartYear, options: Array.from({ length: 7 }, (_, i) => parts(t).y - 3 + i).map((yy) => ({ value: yy, label: yearBounds(String(yy), s).label })), onChange: (v) => go({ month: makeISO(Number(v), hys.month, 1).slice(0, 7) }) }
    : { value: y, options: Array.from({ length: 7 }, (_, i) => parts(t).y - 3 + i).map((yy) => ({ value: yy, label: String(yy) })), onChange: (v) => go({ month: makeISO(Number(v), m, 1).slice(0, 7) }) };

  return (
    <div class="page calendar-page">
      <PageHeader title="Calendar" lede="Who’s off, at a glance. Click any day to see details or add a holiday."
        actions={<Button variant="primary" icon="calendar-plus" onClick={() => openHolidayDialog({ start: selectedDay || t, end: selectedDay || t })}>Add holiday</Button>}>
        <div class="calendar-toolbar">
          <div class="row calendar-nav">
            <IconButton icon="chevron-left" label={view === 'year' ? 'Previous year' : 'Previous month'} onClick={() => go({ month: view === 'year' ? makeISO(y - 1, m, 1).slice(0, 7) : addMonths(month + '-01', -1).slice(0, 7) })} />
            <Button variant="soft" onClick={() => go({ month: t.slice(0, 7) })}>Today</Button>
            <IconButton icon="chevron-right" label={view === 'year' ? 'Next year' : 'Next month'} onClick={() => go({ month: view === 'year' ? makeISO(y + 1, m, 1).slice(0, 7) : addMonths(month + '-01', 1).slice(0, 7) })} />
            {view !== 'year' ? <SelectField ariaLabel="Month" options={MONTHS.map((name, i) => ({ value: i + 1, label: name }))} value={m} onChange={(v) => go({ month: makeISO(y, Number(v), 1).slice(0, 7) })} /> : null}
            <SelectField ariaLabel={view === 'year' ? 'Holiday year' : 'Year'} options={yearSelect.options} value={yearSelect.value} onChange={yearSelect.onChange} />
          </div>
          <Tabs tabs={VIEWS} value={view} onChange={(v) => go({ view: v })} variant="segmented" ariaLabel="Calendar view" />
          <div class="row calendar-filters">
            <SelectField ariaLabel="Team" options={teamOptions(teams.value)} value={filters.teamId} onChange={filters.setTeamId} />
            <SelectField ariaLabel="Type of leave" options={leaveTypeOptions(leaveTypes.value, { includeAll: true, includeArchived: true })} value={filters.typeId} onChange={filters.setTypeId} />
            <Toggle checked={filters.includePending} onChange={filters.setIncludePending} label="Show requests awaiting approval" />
          </div>
        </div>
      </PageHeader>

      {view === 'month' ? <MonthView y={y} m={m} filters={filters} onPick={setSelectedDay} todayIso={t} /> : null}
      {view === 'year' ? <YearView y={y} m={m} filters={filters} onPick={(iso) => { navigate('calendar', { view: 'month', month: iso.slice(0, 7), day: iso, team: filters.teamId }); }} todayIso={t} /> : null}
      {view === 'week' ? <WeekView anchor={selectedDay || (month === t.slice(0, 7) ? t : month + '-01')} filters={filters} onPick={setSelectedDay} todayIso={t} onMove={(iso) => { setSelectedDay(iso); if (iso.slice(0, 7) !== month) go({ month: iso.slice(0, 7) }); }} /> : null}

      <DayDrawer iso={selectedDay} onClose={() => setSelectedDay(null)} filters={filters} todayIso={t} />
      <div class="calendar-legend">
        {leaveTypes.value.filter((lt) => !lt.archived).map((lt) => <span key={lt.id} class="legend-item"><span class="type-dot" style={{ background: lt.colour }} />{lt.name}</span>)}
        <span class="legend-item"><span class="chip-sample pending" />Awaiting approval</span>
        <span class="legend-item"><span class="bank-sample" />Bank holiday</span>
      </div>
    </div>
  );
}

function MonthView({ y, m, filters, onPick, todayIso }) {
  const s = settings.value;
  const grid = monthGrid(y, m, s.weekStartsOn || 1);
  const start = grid[0][0].iso, end = grid[5][6].iso;
  const byDay = useMemo(() => absencesByDay(start, end, filters), [start, end, filters.teamId, filters.typeId, filters.includePending, holidays.value, carers.value]);
  const bank = ctx.value.bankHolidayMap;
  const headers = weekdayHeaders(s.weekStartsOn || 1);
  return (
    <div class="month-view" role="grid" aria-label={`${monthName(m)} ${y}`}>
      <div class="month-head" role="row">{headers.map((h) => <div key={h} class="month-dow" role="columnheader">{h}</div>)}</div>
      {grid.map((row, ri) => (
        <div key={ri} class="month-row" role="row">
          {row.map((cell) => {
            const list = byDay.get(cell.iso) || [];
            const bh = bank.get(cell.iso);
            const cls = ['month-cell', cell.inMonth ? '' : 'outside', isWeekend(cell.iso) ? 'weekend' : '', cell.iso === todayIso ? 'today' : '', bh ? 'bank' : ''].join(' ');
            return (
              <div key={cell.iso} class={cls} role="gridcell" tabIndex={0} onClick={() => onPick(cell.iso)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(cell.iso); } }} aria-label={`${formatLong(cell.iso)}${list.length ? `, ${list.length} off` : ''}${bh ? `, ${bh}` : ''}`}>
                <div class="month-cell-head">
                  <span class="day-num">{cell.iso.slice(8).replace(/^0/, '')}</span>
                  {bh ? <span class="bank-tag" title={bh}>Bank hol.</span> : null}
                </div>
                <div class="chips">
                  {list.slice(0, MAX_CHIPS).map((a) => (
                    <button key={a.holiday.id + a.carer.id} type="button" class={`abs-chip ${a.holiday.status === 'pending' ? 'pending' : ''}`} style={{ '--chip': a.leaveType?.colour || '#9C8A82' }} title={`${carerName(a.carer)} – ${a.leaveType?.name || 'Leave'} · ${formatRange(a.holiday.start, a.holiday.end)}${a.holiday.status === 'pending' ? ' (awaiting approval)' : ''}`}
                      onClick={(e) => { e.stopPropagation(); openHolidayDialog({ holidayId: a.holiday.id }); }}>
                      {a.carer.firstName}
                    </button>
                  ))}
                  {list.length > MAX_CHIPS ? <span class="more-chip">+{list.length - MAX_CHIPS} more</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function heatClass(n) {
  if (!n) return 'h0';
  if (n === 1) return 'h1';
  if (n === 2) return 'h2';
  if (n <= 4) return 'h3';
  return 'h4';
}

function YearView({ y, m, filters, onPick, todayIso }) {
  const s = settings.value;
  const hys = s.holidayYearStart;
  // Show the holiday year that contains the chosen month, so the view matches entitlement.
  const startYear = (m > hys.month || (m === hys.month)) ? y : y - 1;
  const first = makeISO(startYear, hys.month, 1);
  const months = [];
  let cur = first;
  for (let i = 0; i < 12; i++) { months.push(cur); cur = addMonths(cur, 1); }
  const last = addDays(addMonths(first, 12), -1);
  const byDay = useMemo(() => absencesByDay(first, last, filters), [first, last, filters.teamId, filters.typeId, filters.includePending, holidays.value, carers.value]);
  const bank = ctx.value.bankHolidayMap;
  const headers = weekdayHeaders(s.weekStartsOn || 1);
  const busiest = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 1)[0];
  return (
    <div class="year-view">
      <p class="soft">Darker days have more people off{filters.teamId ? ' in this team' : ''}. {busiest ? <>Busiest day: <strong>{formatShort(busiest[0])}</strong> with {busiest[1].length} off.</> : 'Nobody is off in this period.'}</p>
      <div class="year-grid">
        {months.map((mIso) => {
          const p = parts(mIso);
          const grid = monthGrid(p.y, p.m, s.weekStartsOn || 1);
          return (
            <div key={mIso} class="year-month">
              <button type="button" class="year-month-title" onClick={() => navigate('calendar', { view: 'month', month: mIso.slice(0, 7), team: filters.teamId })}>{monthName(p.m)} {p.y}</button>
              <div class="year-month-grid">
                {headers.map((h) => <span key={h} class="mini-dow">{h[0]}</span>)}
                {grid.flat().map((cell) => {
                  if (!cell.inMonth) return <span key={cell.iso} class="year-day empty" />;
                  const n = (byDay.get(cell.iso) || []).length;
                  return (
                    <button key={cell.iso} type="button" class={`year-day ${heatClass(n)} ${cell.iso === todayIso ? 'today' : ''} ${bank.has(cell.iso) ? 'bank' : ''}`} title={`${formatShort(cell.iso)}: ${n ? `${n} off` : 'nobody off'}${bank.has(cell.iso) ? ` · ${bank.get(cell.iso)}` : ''}`} onClick={() => onPick(cell.iso)}>
                      {cell.iso.slice(8).replace(/^0/, '')}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div class="heat-legend"><span>Fewer</span>{['h0', 'h1', 'h2', 'h3', 'h4'].map((c) => <span key={c} class={`year-day ${c} sample`} />)}<span>More off</span></div>
    </div>
  );
}

function WeekView({ anchor, filters, onPick, todayIso, onMove }) {
  const s = settings.value;
  const start = startOfWeek(anchor, s.weekStartsOn || 1);
  const end = addDays(start, 6);
  const byDay = useMemo(() => absencesByDay(start, end, filters), [start, end, filters.teamId, filters.typeId, filters.includePending, holidays.value, carers.value]);
  const bank = ctx.value.bankHolidayMap;
  return (
    <div class="week-view">
      <div class="row-between mb">
        <Button variant="ghost" icon="chevron-left" onClick={() => onMove(addDays(start, -7))}>Previous week</Button>
        <h2>{formatRange(start, end)}</h2>
        <Button variant="ghost" iconRight="chevron-right" onClick={() => onMove(addDays(start, 7))}>Next week</Button>
      </div>
      <div class="week-list">
        {eachDay(start, end).map((iso) => {
          const list = byDay.get(iso) || [];
          return (
            <div key={iso} class={`week-day ${iso === todayIso ? 'today' : ''} ${isWeekend(iso) ? 'weekend' : ''}`}>
              <button type="button" class="week-day-head" onClick={() => onPick(iso)}>
                <span class="week-day-name">{formatLong(iso)}</span>
                {iso === todayIso ? <Badge tone="peach" size="sm">Today</Badge> : null}
                {bank.get(iso) ? <Badge tone="amber" size="sm">{bank.get(iso)}</Badge> : null}
                <span class="muted">{list.length ? `${list.length} off` : 'Everyone’s in'}</span>
              </button>
              {list.length ? (
                <ul class="week-day-list">
                  {list.map((a) => (
                    <li key={a.holiday.id}>
                      <CarerName carer={a.carer} avatar size={26} />
                      <LeaveTypeTag typeId={a.holiday.typeId} small />
                      <span class="muted">{formatRange(a.holiday.start, a.holiday.end)}{a.holiday.halfDay ? ` · ${halfDayLabel(a.holiday.halfDay)}` : ''}</span>
                      {a.holiday.status === 'pending' ? <StatusBadge status="pending" /> : null}
                      <Button size="sm" variant="ghost" icon="edit" onClick={() => openHolidayDialog({ holidayId: a.holiday.id })}>Edit</Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayDrawer({ iso, onClose, filters, todayIso }) {
  const open = !!iso;
  const list = useMemo(() => (iso ? absencesByDay(iso, iso, { ...filters, teamId: '' }).get(iso) || [] : []), [iso, filters.typeId, filters.includePending, holidays.value, carers.value]);
  const bank = iso ? ctx.value.bankHolidayMap.get(iso) : null;
  const s = settings.value;
  // Staffing summary per team
  const byTeam = new Map();
  for (const a of list) {
    const key = a.carer.teamId || null;
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key).push(a);
  }
  return (
    <Drawer open={open} onClose={onClose} title={iso ? formatLong(iso) : ''} width={440}
      footer={iso ? <Button variant="primary" icon="calendar-plus" full onClick={() => { openHolidayDialog({ start: iso, end: iso }); }}>Add a holiday on this day</Button> : null}>
      {iso ? (
        <div class="stack">
          <div class="row">
            <Badge tone="neutral">{relativeDay(iso, todayIso)}</Badge>
            {bank ? <Badge tone="amber" icon="star">{bank}</Badge> : null}
          </div>
          {list.length ? (
            <>
              <div class="row">
                {[...byTeam.entries()].map(([teamId, items]) => {
                  const team = teamId ? teamsById.value.get(teamId) : null;
                  const limit = team ? (team.maxOffPerDay ?? s.defaultMaxOffPerDay) : null;
                  const over = limit && items.length > limit;
                  return <Badge key={teamId || 'none'} tone={over ? 'rose' : 'sage'} dot>{team?.name || 'No team'}: {items.length} off{limit ? ` (limit ${limit})` : ''}</Badge>;
                })}
              </div>
              <ul class="day-list">
                {list.map((a) => (
                  <li key={a.holiday.id} class="day-item">
                    <Avatar name={carerName(a.carer)} colour={a.carer.colour} size={36} />
                    <div class="stack-sm day-item-main">
                      <CarerName carer={a.carer} />
                      <span class="muted"><LeaveTypeTag typeId={a.holiday.typeId} small /> · {formatRange(a.holiday.start, a.holiday.end)}{a.holiday.halfDay ? ` · ${halfDayLabel(a.holiday.halfDay)}` : ''} · {daysLabel(countLeaveDays(a.holiday, a.carer, ctx.value))}</span>
                      {a.holiday.status === 'pending' ? <StatusBadge status="pending" /> : null}
                      {a.holiday.notes ? <span class="muted small">{a.holiday.notes}</span> : null}
                    </div>
                    <IconButton icon="edit" label="Edit this holiday" onClick={() => openHolidayDialog({ holidayId: a.holiday.id })} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState compact icon="check-circle" title="Everyone’s in" message="Nobody is off on this day." />
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
