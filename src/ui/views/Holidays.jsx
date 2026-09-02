// Holidays: add many at once with dropdowns, remove in bulk, and browse every holiday recorded.
import { useState, useMemo, useEffect } from 'preact/hooks';
import { navigate } from '../../app/router.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/Button.jsx';
import { Field, DateField, SelectField, TextArea, RadioCards, SearchBox, Checkbox } from '../components/Field.jsx';
import { MultiSelect } from '../components/MultiSelect.jsx';
import { YearPicker } from '../components/YearPicker.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Badge } from '../components/Badge.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Banner } from '../components/Banner.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Table } from '../components/Table.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { StatTile } from '../components/StatTile.jsx';
import { confirm } from '../components/Modal.jsx';
import { toast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { db, carers, holidays, teams, leaveTypes, teamsById, leaveTypesById, carersById, settings, carerName, addHolidays, removeHolidays, setHolidayStatus } from '../../store/store.js';
import { checkBatch } from '../../core/clashes.js';
import { countLeaveDays } from '../../core/leaveDays.js';
import { searchHolidays } from '../../core/search.js';
import { formatDays } from '../../core/entitlement.js';
import { holidaysToCsv } from '../../core/csv.js';
import { formatRange, formatShort, isValidISO, rangesOverlap, addDays } from '../../core/dates.js';
import { yearBounds } from '../../core/holidayYear.js';
import { ctx, currentYear } from '../shared/context.js';
import { today } from '../shared/today.js';
import { remainingAfter } from '../shared/usage.js';
import { carerOptions, teamOptions, leaveTypeOptions, statusOptions, statusLabel } from '../shared/options.js';
import { CarerName, LeaveTypeTag, daysLabel, halfDayLabel } from '../shared/bits.jsx';
import { downloadText, datedFilename } from '../shared/download.js';
import { openHolidayDialog } from '../dialogs/HolidayDialog.jsx';

const TABS = [
  { id: 'add', label: 'Add holidays', icon: 'calendar-plus' },
  { id: 'remove', label: 'Remove holidays', icon: 'calendar-x' },
  { id: 'all', label: 'All holidays', icon: 'list' },
];

export function Holidays({ params }) {
  const tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'add';
  return (
    <div class="page holidays-page">
      <PageHeader title="Holidays" lede="Add holidays for one carer or many at once, tidy up mistakes, and see everything that’s booked.">
        <Tabs tabs={TABS} value={tab} onChange={(id) => navigate('holidays', { tab: id })} variant="segmented" ariaLabel="Holiday tools" />
      </PageHeader>
      {tab === 'add' ? <AddTab params={params} /> : null}
      {tab === 'remove' ? <RemoveTab params={params} /> : null}
      {tab === 'all' ? <AllTab params={params} /> : null}
    </div>
  );
}

function rowFor(h) {
  const carer = carersById.value.get(h.carerId);
  return {
    id: h.id,
    holiday: h,
    carer,
    leaveType: leaveTypesById.value.get(h.typeId),
    teamName: carer?.teamId ? teamsById.value.get(carer.teamId)?.name || '' : '',
    days: carer ? countLeaveDays(h, carer, ctx.value) : 0,
  };
}

const STATUS_CHOICES = [
  { value: 'approved', label: 'Approved', description: 'Confirmed and counted.', icon: 'check-circle' },
  { value: 'pending', label: 'Awaiting approval', description: 'Requested, not yet agreed.', icon: 'clock' },
];
const HALF_OPTIONS = [
  { value: '', label: 'Whole day' },
  { value: 'am', label: 'Morning only' },
  { value: 'pm', label: 'Afternoon only' },
];

// ---------- Add (bulk) ----------
function AddTab({ params }) {
  const [carerIds, setCarerIds] = useState(() => (params.carer ? [params.carer] : []));
  const [start, setStart] = useState(params.start || '');
  const [end, setEnd] = useState(params.end || params.start || '');
  const [halfDay, setHalfDay] = useState('');
  const [typeId, setTypeId] = useState(params.type || 'lt_annual');
  const [status, setStatus] = useState(params.status === 'pending' ? 'pending' : 'approved');
  const [notes, setNotes] = useState('');
  const [added, setAdded] = useState(null);

  const options = carerOptions(carers.value, teams.value);
  const typeOpts = leaveTypeOptions(leaveTypes.value);
  const ready = carerIds.length > 0 && isValidISO(start) && isValidISO(end) && end >= start;

  const preview = useMemo(() => {
    if (!ready) return null;
    const proposals = carerIds.map((carerId) => ({ carerId, start, end, typeId, status, halfDay: start === end ? halfDay || null : null, notes: notes.trim() }));
    const checked = checkBatch(proposals, db.value, ctx.value, { today: today.value });
    return checked.map((r) => {
      const carer = carersById.value.get(r.proposal.carerId);
      const after = carer ? remainingAfter(carer, r.proposal) : [];
      return { ...r, carer, after };
    });
  }, [ready, carerIds, start, end, typeId, status, halfDay, notes, db.value, today.value]);

  const okRows = preview?.filter((r) => !r.blocked) || [];
  const blockedRows = preview?.filter((r) => r.blocked) || [];
  const warnRows = okRows.filter((r) => r.clashes.length);
  const totalDays = okRows.reduce((n, r) => n + r.days, 0);

  function add() {
    if (!okRows.length) return;
    const ids = addHolidays(okRows.map((r) => r.proposal), okRows.length === 1 ? 'Added holiday' : `Added ${okRows.length} holidays`);
    setAdded({ count: ids.length, start, end, skipped: blockedRows.length });
    toast(okRows.length === 1 ? `Holiday added for ${carerName(okRows[0].carer)}` : `${okRows.length} holidays added`);
    setCarerIds([]);
    setNotes('');
  }

  function onStart(v) { setStart(v); if (v && (!end || end < v)) setEnd(v); }
  function onEnd(v) { setEnd(v); if (v && start && v < start) setStart(v); }

  return (
    <div class="stack">
      {added ? (
        <Banner tone="success" icon="check-circle" title={`${added.count} ${added.count === 1 ? 'holiday' : 'holidays'} added for ${formatRange(added.start, added.end)}`} action={{ label: 'See on the calendar', onClick: () => navigate('calendar', { month: added.start.slice(0, 7), day: added.start }) }} onDismiss={() => setAdded(null)}>
          {added.skipped ? `${added.skipped} ${added.skipped === 1 ? 'carer was' : 'carers were'} skipped because of a clash.` : 'You can undo this from the message at the bottom of the screen.'}
        </Banner>
      ) : null}
      <div class="grid bulk-grid">
        <Card title="1. Who is off?" icon="users">
          {options.length ? (
            <Field hint="Pick one person, a few, or a whole team.">
              <MultiSelect options={options} value={carerIds} onChange={setCarerIds} placeholder="Choose carers…" itemNoun="carer" />
            </Field>
          ) : (
            <EmptyState compact icon="users" title="No carers yet" message="Add carers first, then come back to book holidays." action={{ label: 'Add a carer', onClick: () => navigate('carers', { new: '1' }), icon: 'user-plus' }} />
          )}
        </Card>
        <Card title="2. When?" icon="calendar">
          <div class="grid grid-2">
            <Field label="First day"><DateField value={start} onChange={onStart} /></Field>
            <Field label="Last day" hint="Same day for a single day off."><DateField value={end} onChange={onEnd} min={start || undefined} /></Field>
          </div>
          {start && start === end ? (
            <Field label="How much of the day?"><SelectField options={HALF_OPTIONS} value={halfDay} onChange={setHalfDay} /></Field>
          ) : null}
        </Card>
        <Card title="3. What kind?" icon="sun" class="bulk-kind">
          <div class="grid bulk-kind-grid">
            <Field label="Type of leave"><SelectField options={typeOpts} value={typeId} onChange={setTypeId} /></Field>
            <Field label="Status"><RadioCards options={STATUS_CHOICES} value={status} onChange={setStatus} columns={2} /></Field>
            <Field label="Notes (optional)"><TextArea value={notes} onChange={setNotes} rows={2} placeholder="e.g. Christmas cover agreed" /></Field>
          </div>
        </Card>
      </div>

      <Card title="4. Check and add" icon="check-circle" padded={false} class="bulk-preview" actions={preview ? <span class="muted">{okRows.length} to add · {daysLabel(totalDays)} in total{blockedRows.length ? ` · ${blockedRows.length} can’t be added` : ''}</span> : null}>
        {!preview ? (
          <EmptyState compact icon="calendar-plus" title="Nothing to check yet" message={carerIds.length ? 'Choose the dates to see a preview.' : 'Choose who is off and when to see a preview here.'} />
        ) : (
          <>
            <ul class="preview-list">
              {preview.map((r) => (
                <li key={r.proposal.carerId} class={`preview-row ${r.blocked ? 'is-blocked' : r.clashes.length ? 'is-warn' : 'is-ok'}`}>
                  <div class="preview-who">
                    <Avatar name={carerName(r.carer)} colour={r.carer?.colour} size={36} />
                    <div class="stack-sm">
                      <strong>{carerName(r.carer)}</strong>
                      <span class="muted">
                        {daysLabel(r.days)}
                        {r.after.map((a) => <span key={a.key}> · {formatDays(a.after)} left in {a.label} afterwards</span>)}
                      </span>
                    </div>
                  </div>
                  <div class="preview-clashes">
                    {r.blocked ? <Badge tone="rose" icon="x">Can’t add</Badge> : r.clashes.length ? <Badge tone="amber" icon="alert">Check</Badge> : <Badge tone="sage" icon="check">Fine</Badge>}
                    {r.clashes.map((c, i) => <div key={i} class={`clash-line ${c.severity}`}>{c.message}{c.details ? <span class="muted"> – {c.details}</span> : null}</div>)}
                  </div>
                </li>
              ))}
            </ul>
            <div class="bulk-actions">
              {warnRows.length ? <span class="soft"><Icon name="alert" size={18} /> {warnRows.length === 1 ? 'One holiday has something to check' : `${warnRows.length} holidays have something to check`} – you can still add them.</span> : <span class="spacer" />}
              <Button variant="primary" size="lg" icon="check" onClick={add} disabled={!okRows.length}>
                {okRows.length === 1 ? 'Add holiday' : `Add ${okRows.length} holidays`}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ---------- Remove (bulk) ----------
function RemoveTab() {
  const [carerIds, setCarerIds] = useState([]);
  const [start, setStart] = useState(today.value);
  const [end, setEnd] = useState('');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(new Set());
  const options = carerOptions(carers.value, teams.value, { includeArchived: true });

  const rows = useMemo(() => {
    const filters = { carerIds, typeIds: typeId ? [typeId] : [], statuses: status ? [status] : [], start: start || undefined, end: end || undefined };
    return searchHolidays(holidays.value, '', filters, { carersById: carersById.value, teamsById: teamsById.value, leaveTypesById: leaveTypesById.value })
      .map(rowFor).filter((r) => r.carer);
  }, [carerIds, start, end, typeId, status, holidays.value]);

  useEffect(() => { setSelected((sel) => new Set([...sel].filter((id) => rows.some((r) => r.id === id)))); }, [rows]);

  async function removeSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await confirm({ title: `Remove ${ids.length} ${ids.length === 1 ? 'holiday' : 'holidays'}?`, message: 'They’ll disappear from the calendar and the days go back to each carer. You can undo straight afterwards.', confirmLabel: `Remove ${ids.length === 1 ? 'holiday' : ids.length + ' holidays'}`, danger: true, icon: 'trash' });
    if (!ok) return;
    removeHolidays(ids);
    toast(`${ids.length} ${ids.length === 1 ? 'holiday' : 'holidays'} removed`);
    setSelected(new Set());
  }

  const columns = [
    { key: 'carer', label: 'Carer', render: (r) => <CarerName carer={r.carer} avatar link={false} />, sortValue: (r) => `${r.carer.lastName} ${r.carer.firstName}` },
    { key: 'dates', label: 'Dates', render: (r) => <>{formatRange(r.holiday.start, r.holiday.end)}{r.holiday.halfDay ? <span class="muted"> · {halfDayLabel(r.holiday.halfDay)}</span> : null}</>, sortValue: (r) => r.holiday.start, sortable: true },
    { key: 'days', label: 'Days', align: 'right', render: (r) => formatDays(r.days), sortValue: (r) => r.days, sortable: true },
    { key: 'type', label: 'Type', render: (r) => <LeaveTypeTag typeId={r.holiday.typeId} />, sortValue: (r) => r.leaveType?.name || '' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.holiday.status} /> },
    { key: 'notes', label: 'Notes', render: (r) => <span class="muted">{r.holiday.notes}</span>, hideOnMobile: true },
  ];

  return (
    <div class="stack">
      <Card title="Find the holidays to remove" icon="filter">
        <div class="grid grid-2">
          <Field label="Whose holidays?" hint="Leave empty for everyone.">
            <MultiSelect options={options} value={carerIds} onChange={setCarerIds} placeholder="Everyone" itemNoun="carer" />
          </Field>
          <div class="grid grid-2">
            <Field label="From"><DateField value={start} onChange={setStart} /></Field>
            <Field label="To" hint="Leave empty for no end."><DateField value={end} onChange={setEnd} min={start || undefined} /></Field>
          </div>
          <Field label="Type of leave"><SelectField options={leaveTypeOptions(leaveTypes.value, { includeAll: true, includeArchived: true })} value={typeId} onChange={setTypeId} /></Field>
          <Field label="Status"><SelectField options={statusOptions({ includeAll: true })} value={status} onChange={setStatus} /></Field>
        </div>
      </Card>
      <Card title={`${rows.length} ${rows.length === 1 ? 'holiday' : 'holidays'} found`} icon="list" padded={false}
        actions={<Button variant="danger" icon="trash" onClick={removeSelected} disabled={!selected.size}>{selected.size ? `Remove ${selected.size} selected` : 'Remove selected'}</Button>}>
        <Table columns={columns} rows={rows} rowKey="id" selectable selected={selected} onSelectedChange={setSelected} sort={{ key: 'dates', dir: 'asc' }}
          emptyState={<EmptyState compact icon="calendar-x" title="No holidays match" message="Try widening the dates or clearing the filters." />} ariaLabel="Holidays to remove" />
      </Card>
    </div>
  );
}

// ---------- All ----------
const PAGE_SIZE = 25;

function AllTab({ params }) {
  const [query, setQuery] = useState(params.q || '');
  const [teamId, setTeamId] = useState('');
  const [typeId, setTypeId] = useState(params.type || '');
  const [status, setStatus] = useState(params.status || '');
  const [yearKey, setYearKey] = useState(params.year || currentYear.value.key);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'dates', dir: 'desc' });
  const yb = yearKey === 'all' ? null : yearBounds(yearKey, settings.value);

  const rows = useMemo(() => {
    const filters = { teamId: teamId || undefined, typeIds: typeId ? [typeId] : [], statuses: status ? [status] : ['approved', 'pending', 'declined'], start: yb?.start, end: yb?.end };
    return searchHolidays(holidays.value, query, filters, { carersById: carersById.value, teamsById: teamsById.value, leaveTypesById: leaveTypesById.value })
      .map(rowFor).filter((r) => r.carer);
  }, [query, teamId, typeId, status, yearKey, holidays.value]);

  useEffect(() => { setPage(1); }, [query, teamId, typeId, status, yearKey]);

  const pending = rows.filter((r) => r.holiday.status === 'pending').length;
  const totalDays = rows.filter((r) => r.holiday.status !== 'declined').reduce((n, r) => n + r.days, 0);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    downloadText(datedFilename(`Holidays ${yb ? yb.label.replace('/', '-') : 'all'}`, 'csv', today.value), holidaysToCsv(rows), 'text/csv');
    toast('Holidays saved as a spreadsheet file');
  }

  const columns = [
    { key: 'carer', label: 'Carer', render: (r) => <CarerName carer={r.carer} avatar />, sortValue: (r) => `${r.carer.lastName} ${r.carer.firstName}`, sortable: true },
    { key: 'team', label: 'Team', render: (r) => <span class="muted">{r.teamName || '—'}</span>, sortValue: (r) => r.teamName, hideOnMobile: true, sortable: true },
    { key: 'dates', label: 'Dates', render: (r) => <>{formatRange(r.holiday.start, r.holiday.end)}{r.holiday.halfDay ? <span class="muted"> · {halfDayLabel(r.holiday.halfDay)}</span> : null}</>, sortValue: (r) => r.holiday.start, sortable: true },
    { key: 'days', label: 'Days', align: 'right', render: (r) => formatDays(r.days), sortValue: (r) => r.days, sortable: true },
    { key: 'type', label: 'Type', render: (r) => <LeaveTypeTag typeId={r.holiday.typeId} />, sortValue: (r) => r.leaveType?.name || '', sortable: true },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.holiday.status} />, sortValue: (r) => r.holiday.status, sortable: true },
    { key: 'notes', label: 'Notes', render: (r) => <span class="muted">{r.holiday.notes}</span>, hideOnMobile: true },
    { key: 'actions', label: '', align: 'right', render: (r) => (
      <span class="row nowrap">
        {r.holiday.status === 'pending' ? <>
          <Button size="sm" variant="soft" icon="check" onClick={(e) => { e.stopPropagation(); setHolidayStatus(r.id, 'approved'); toast(`Approved for ${carerName(r.carer)}`); }}>Approve</Button>
          <Button size="sm" variant="ghost" icon="x" onClick={(e) => { e.stopPropagation(); setHolidayStatus(r.id, 'declined'); toast(`Declined for ${carerName(r.carer)}`); }}>Decline</Button>
        </> : null}
        <Button size="sm" icon="edit" onClick={(e) => { e.stopPropagation(); openHolidayDialog({ holidayId: r.id }); }}>Edit</Button>
      </span>
    ) },
  ];

  return (
    <div class="stack">
      <div class="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search by name, type or note" />
        <SelectField ariaLabel="Team" options={teamOptions(teams.value)} value={teamId} onChange={setTeamId} />
        <SelectField ariaLabel="Type" options={leaveTypeOptions(leaveTypes.value, { includeAll: true, includeArchived: true })} value={typeId} onChange={setTypeId} />
        <SelectField ariaLabel="Status" options={statusOptions({ includeAll: true })} value={status} onChange={setStatus} />
        <YearPicker value={yearKey === 'all' ? currentYear.value.key : yearKey} onChange={setYearKey} settings={settings.value} extraDates={holidays.value.flatMap((h) => [h.start, h.end])} today={today.value} />
        <Button icon="download" onClick={exportCsv} disabled={!rows.length}>Save as spreadsheet</Button>
      </div>
      <div class="grid grid-3">
        <StatTile small label="Holidays" value={rows.length} hint={yb ? `in ${yb.label}` : 'all years'} icon="sun" tone="peach" />
        <StatTile small label="Days" value={formatDays(totalDays)} hint="not counting declined" icon="calendar" tone="sky" />
        <StatTile small label="Awaiting approval" value={pending} hint={pending ? 'click to show only these' : 'nothing waiting'} icon="clock" tone={pending ? 'amber' : 'default'} onClick={() => setStatus(status === 'pending' ? '' : 'pending')} />
      </div>
      <Card padded={false}>
        <Table columns={columns} rows={pageRows} rowKey="id" sort={sort} onSortChange={setSort} onRowClick={(r) => openHolidayDialog({ holidayId: r.id })}
          emptyState={<EmptyState compact icon="sun" title="No holidays here" message={query || teamId || typeId || status ? 'Try clearing the search or filters.' : 'Nothing recorded for this year yet.'} action={{ label: 'Add holidays', onClick: () => navigate('holidays', { tab: 'add' }), icon: 'plus' }} />} ariaLabel="All holidays" />
        {rows.length > PAGE_SIZE ? <div class="table-foot"><Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} /></div> : null}
      </Card>
    </div>
  );
}
