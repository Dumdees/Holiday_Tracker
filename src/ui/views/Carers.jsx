// Carers: a searchable list of everyone, and a profile page for each person.
import { useState, useEffect, useMemo } from 'preact/hooks';
import { navigate } from '../../app/router.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card } from '../components/Card.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Field, SelectField, SearchBox } from '../components/Field.jsx';
import { YearPicker } from '../components/YearPicker.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Badge } from '../components/Badge.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ProgressBar, ProgressRing } from '../components/Progress.jsx';
import { StatTile } from '../components/StatTile.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Table } from '../components/Table.jsx';
import { HelpTip } from '../components/HelpTip.jsx';
import { Banner } from '../components/Banner.jsx';
import { confirm } from '../components/Modal.jsx';
import { toast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { carers, holidays, teams, teamsById, leaveTypesById, settings, carersById, carerName, setCarerActive, removeCarer, removeAdjustment } from '../../store/store.js';
import { searchCarers } from '../../core/search.js';
import { formatDays } from '../../core/entitlement.js';
import { describeWorkingPattern, describePatternWeek, countLeaveDays, classifyDay } from '../../core/leaveDays.js';
import { formatShort, formatRange, formatLong, rangesOverlap, monthGrid, parts, addMonths, monthName, weekdayHeaders, relativeDay } from '../../core/dates.js';
import { yearBounds } from '../../core/holidayYear.js';
import { usageMap, usageFor } from '../shared/usage.js';
import { ctx, currentYear } from '../shared/context.js';
import { today } from '../shared/today.js';
import { teamOptions } from '../shared/options.js';
import { CarerName, LeaveTypeTag, daysLabel, halfDayLabel } from '../shared/bits.jsx';
import { openCarerDialog } from '../dialogs/CarerDialog.jsx';
import { openHolidayDialog } from '../dialogs/HolidayDialog.jsx';
import { openAdjustmentDialog } from '../dialogs/AdjustmentDialog.jsx';

export function Carers({ params }) {
  useEffect(() => {
    if (params.new === '1') {
      navigate('carers');
      openCarerDialog().then((id) => { if (id) navigate('carers', { id }); });
    }
  }, [params.new]);
  if (params.id) return <CarerProfile id={params.id} />;
  return <CarerList params={params} />;
}

// ---------- List ----------
const SORTS = [
  { value: 'name', label: 'Last name' },
  { value: 'first', label: 'First name' },
  { value: 'team', label: 'Team' },
  { value: 'remaining', label: 'Most days left' },
  { value: 'start', label: 'Longest serving' },
];

function CarerList({ params }) {
  const [query, setQuery] = useState(params.q || '');
  const [teamId, setTeamId] = useState('');
  const [show, setShow] = useState('active');
  const [sort, setSort] = useState('name');
  const [yearKey, setYearKey] = useState(currentYear.value.key);
  const usages = usageMap(yearKey);
  const yb = yearBounds(yearKey, settings.value);

  const list = searchCarers(carers.value, query, { teamId: teamId || null, active: show, sort, usages }, { teamsById: teamsById.value });
  const totalCarers = carers.value.filter((c) => c.active).length;
  const totals = list.reduce((acc, c) => {
    const u = usages.get(c.id);
    if (!u) return acc;
    acc.remaining += u.remaining; acc.pending += u.pending; acc.entitlement += u.entitlement.total; acc.used += u.taken + u.booked;
    return acc;
  }, { remaining: 0, pending: 0, entitlement: 0, used: 0 });

  async function addCarer() {
    const id = await openCarerDialog();
    if (id) navigate('carers', { id });
  }

  return (
    <div class="page carers-page">
      <PageHeader title="Carers" lede="Everyone on the team, and how much holiday they have left." actions={<Button variant="primary" icon="user-plus" onClick={addCarer}>Add carer</Button>}>
        <div class="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Search by name, team or role" autoFocus={!!params.q} />
          <SelectField ariaLabel="Team" options={teamOptions(teams.value)} value={teamId} onChange={setTeamId} />
          <SelectField ariaLabel="Show" options={[{ value: 'active', label: 'Current carers' }, { value: 'archived', label: 'Archived carers' }, { value: 'all', label: 'Everyone' }]} value={show} onChange={setShow} />
          <SelectField ariaLabel="Sort by" options={SORTS.map((s) => ({ ...s, label: `Sort: ${s.label}` }))} value={sort} onChange={setSort} />
          <YearPicker value={yearKey} onChange={setYearKey} settings={settings.value} today={today.value} />
        </div>
      </PageHeader>

      {totalCarers === 0 && show === 'active' && !query ? (
        <EmptyState icon="users" title="No carers yet" message="Add your first carer to start planning holidays. Or import a whole list from a spreadsheet under Settings › Advanced." action={{ label: 'Add carer', onClick: addCarer, icon: 'user-plus' }} />
      ) : (
        <>
          <div class="grid grid-4 mb">
            <StatTile label={show === 'archived' ? 'Archived carers' : 'Carers'} value={list.length} hint={query || teamId ? 'matching your search' : show === 'active' ? 'currently working' : ''} icon="users" tone="peach" small />
            <StatTile label="Days left" value={formatDays(totals.remaining)} hint={`of ${formatDays(totals.entitlement)} in ${yb.label}`} icon="sun" tone="sage" small />
            <StatTile label="Days used or booked" value={formatDays(totals.used)} hint={yb.label} icon="check-circle" tone="sky" small />
            <StatTile label="Awaiting approval" value={formatDays(totals.pending)} hint="days requested" icon="clock" tone="amber" small onClick={() => navigate('holidays', { tab: 'all', status: 'pending' })} />
          </div>
          {list.length ? (
            <div class="carer-grid">
              {list.map((c) => <CarerCard key={c.id} carer={c} usage={usages.get(c.id)} today={today.value} />)}
            </div>
          ) : (
            <EmptyState icon="search" title="Nobody matches" message="Try a different name, or clear the filters." action={{ label: 'Clear search', onClick: () => { setQuery(''); setTeamId(''); setShow('active'); } }} />
          )}
        </>
      )}
    </div>
  );
}

function carerFlags(carer, todayIso) {
  const flags = [];
  if (!carer.active) flags.push({ tone: 'neutral', text: 'Archived' });
  if (carer.startDate && carer.startDate > todayIso) flags.push({ tone: 'sky', text: `Starts ${formatShort(carer.startDate, { year: false })}` });
  if (carer.endDate && carer.endDate >= todayIso) flags.push({ tone: 'amber', text: `Leaves ${formatShort(carer.endDate, { year: false })}` });
  if (carer.endDate && carer.endDate < todayIso && carer.active) flags.push({ tone: 'neutral', text: 'Left' });
  return flags;
}

function CarerCard({ carer, usage, today: todayIso }) {
  const team = carer.teamId ? teamsById.value.get(carer.teamId) : null;
  const total = usage?.entitlement.total ?? 0;
  const remaining = usage?.remaining ?? 0;
  const flags = carerFlags(carer, todayIso);
  const low = carer.active && total > 0 && remaining <= 2;
  return (
    <button type="button" class="carer-card" onClick={() => navigate('carers', { id: carer.id })} data-carer={carer.id}>
      <div class="carer-card-head">
        <Avatar name={carerName(carer)} colour={carer.colour} size={44} />
        <div class="carer-card-name">
          <strong>{carerName(carer)}</strong>
          <span class="muted">{carer.role}{team ? ` · ${team.name}` : ''}</span>
        </div>
        <span class={`carer-card-left ${remaining < 0 ? 'negative' : low ? 'low' : ''}`}>
          <strong>{formatDays(remaining)}</strong>
          <span class="muted">left</span>
        </span>
      </div>
      <ProgressBar
        total={total || 1}
        height={8}
        ariaLabel={`${formatDays(usage?.taken || 0)} taken, ${formatDays(usage?.booked || 0)} booked, ${formatDays(usage?.pending || 0)} awaiting approval of ${formatDays(total)}`}
        segments={[
          { value: usage?.taken || 0, colour: 'var(--peach-600)', label: 'Taken' },
          { value: usage?.booked || 0, colour: 'var(--peach-300)', label: 'Booked' },
          { value: usage?.pending || 0, colour: 'var(--amber)', label: 'Awaiting approval' },
        ]}
      />
      <div class="carer-card-foot">
        <span class="muted">{formatDays((usage?.taken || 0) + (usage?.booked || 0))} of {formatDays(total)} used{usage?.pending ? ` · ${formatDays(usage.pending)} awaiting approval` : ''}</span>
        {flags.map((f) => <Badge key={f.text} tone={f.tone} size="sm">{f.text}</Badge>)}
      </div>
    </button>
  );
}

// ---------- Profile ----------
function CarerProfile({ id }) {
  const carer = carersById.value.get(id);
  const [yearKey, setYearKey] = useState(currentYear.value.key);
  if (!carer) {
    return (
      <div class="page">
        <PageHeader title="Carer not found" back={{ label: 'All carers', onClick: () => navigate('carers') }} />
        <EmptyState icon="users" title="We couldn’t find that carer" message="They may have been removed." action={{ label: 'Back to carers', onClick: () => navigate('carers') }} />
      </div>
    );
  }
  const s = settings.value;
  const yb = yearBounds(yearKey, s);
  const usage = usageFor(carer.id, yearKey);
  const team = carer.teamId ? teamsById.value.get(carer.teamId) : null;
  const todayIso = today.value;
  const flags = carerFlags(carer, todayIso);
  const yearHolidays = holidays.value
    .filter((h) => h.carerId === carer.id && rangesOverlap(h.start, h.end, yb.start, yb.end))
    .sort((a, b) => b.start.localeCompare(a.start));
  const allDates = holidays.value.filter((h) => h.carerId === carer.id).flatMap((h) => [h.start, h.end]);
  const pairs = (carer.mustNotBeOffWith || []).map((pid) => carersById.value.get(pid)).filter(Boolean);
  const ent = usage.entitlement;

  async function edit() { await openCarerDialog({ carerId: carer.id }); }
  async function addHoliday() { await openHolidayDialog({ carerId: carer.id }); }
  async function adjust() { await openAdjustmentDialog({ carerId: carer.id, yearKey }); }
  async function archive() {
    if (carer.active) {
      const ok = await confirm({ title: `Archive ${carer.firstName}?`, message: 'Archived carers are hidden from lists and dropdowns but their holiday history is kept. You can bring them back any time.', confirmLabel: 'Archive', icon: 'log-out' });
      if (ok) { setCarerActive(carer.id, false); toast(`${carerName(carer)} archived`); }
    } else {
      setCarerActive(carer.id, true);
      toast(`${carerName(carer)} is back`);
    }
  }
  async function remove() {
    const n = holidays.value.filter((h) => h.carerId === carer.id).length;
    const ok = await confirm({ title: `Remove ${carerName(carer)} completely?`, message: n ? `This also removes their ${n} ${n === 1 ? 'holiday' : 'holidays'}. If they’ve simply left, archiving keeps the history. You can undo straight afterwards.` : 'You can undo straight afterwards.', confirmLabel: 'Remove carer', danger: true, icon: 'trash' });
    if (!ok) return;
    removeCarer(carer.id);
    toast(`${carerName(carer)} removed`);
    navigate('carers');
  }

  const columns = [
    { key: 'dates', label: 'Dates', render: (r) => <span class="nowrap-sm">{formatRange(r.holiday.start, r.holiday.end)}{r.holiday.halfDay ? <span class="muted"> · {halfDayLabel(r.holiday.halfDay)}</span> : null}</span>, sortValue: (r) => r.holiday.start },
    { key: 'days', label: 'Days', align: 'right', render: (r) => formatDays(r.days), sortValue: (r) => r.days },
    { key: 'type', label: 'Type', render: (r) => <LeaveTypeTag typeId={r.holiday.typeId} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.holiday.status} /> },
    { key: 'notes', label: 'Notes', render: (r) => <span class="muted">{r.holiday.notes}</span>, hideOnMobile: true },
    { key: 'edit', label: '', align: 'right', render: (r) => <Button size="sm" icon="edit" onClick={(e) => { e.stopPropagation(); openHolidayDialog({ holidayId: r.holiday.id }); }}>Edit</Button> },
  ];
  const rows = yearHolidays.map((h) => ({ id: h.id, holiday: h, days: countLeaveDays(h, carer, ctx.value) }));

  return (
    <div class="page carer-profile">
      <PageHeader
        back={{ label: 'All carers', onClick: () => navigate('carers') }}
        title={<span class="row"><Avatar name={carerName(carer)} colour={carer.colour} size={52} /> <span>{carerName(carer)}</span></span>}
        lede={<>{carer.role}{team ? ` · ${team.name}` : ' · No team'} · Works {describeWorkingPattern(carer)}{flags.map((f) => <Badge key={f.text} tone={f.tone} size="sm" class="ml">{f.text}</Badge>)}</>}
        actions={<>
          <Button variant="primary" icon="calendar-plus" onClick={addHoliday} disabled={!carer.active}>Add holiday</Button>
          <Button icon="edit" onClick={edit}>Edit details</Button>
        </>}
      />
      {!carer.active ? <Banner tone="info" icon="info" title="This carer is archived" action={{ label: 'Bring them back', onClick: archive }}>They don’t appear in lists or dropdowns, but their history is kept.</Banner> : null}

      <div class="grid profile-grid">
        <Card title={`Holiday in ${yb.label}`} icon="sun" actions={<YearPicker value={yearKey} onChange={setYearKey} settings={s} extraDates={allDates} today={todayIso} />}>
          <div class="entitlement-summary">
            <ProgressRing value={Math.max(0, usage.remaining)} total={Math.max(ent.total, 0.0001)} size={120} stroke={12} colour={usage.remaining < 0 ? 'var(--rose)' : 'var(--peach-500)'} label={formatDays(usage.remaining)} sublabel={usage.remaining === 1 ? 'day left' : 'days left'} />
            <dl class="entitlement-lines">
              <div><dt>Entitlement</dt><dd>{formatDays(ent.proRated)}{ent.proRataFraction < 1 ? <span class="muted"> (share of {formatDays(ent.base)} for the part of the year they work <HelpTip text={`${carer.firstName} is only with us for part of this holiday year, so they get ${Math.round(ent.proRataFraction * 100)}% of their full ${formatDays(ent.base)} days.`} />)</span> : null}</dd></div>
              {ent.adjustments.map((a) => (
                <div key={a.id} class="adjustment-line">
                  <dt>{a.reason || 'Adjustment'}</dt>
                  <dd>{a.days > 0 ? '+' : ''}{formatDays(a.days)} <IconButton icon="x" label={`Remove adjustment: ${a.reason}`} size="sm" onClick={async () => { const ok = await confirm({ title: 'Remove this adjustment?', message: `${a.reason || 'Adjustment'}: ${a.days > 0 ? '+' : ''}${formatDays(a.days)} days.`, confirmLabel: 'Remove', danger: true }); if (ok) { removeAdjustment(carer.id, a.id); toast('Adjustment removed'); } }} /></dd>
                </div>
              ))}
              <div class="total-line"><dt>Total this year</dt><dd>{formatDays(ent.total)}</dd></div>
              <div><dt>Taken so far</dt><dd>{formatDays(usage.taken)}</dd></div>
              <div><dt>Booked for later</dt><dd>{formatDays(usage.booked)}</dd></div>
              {usage.pending ? <div><dt>Awaiting approval</dt><dd>{formatDays(usage.pending)}</dd></div> : null}
              <div class="total-line"><dt>Left to book</dt><dd class={usage.remaining < 0 ? 'negative' : ''}>{formatDays(usage.remaining)}{usage.pending ? <span class="muted"> ({formatDays(usage.remainingAfterPending)} if requests are approved)</span> : null}</dd></div>
            </dl>
          </div>
          <div class="row mt">
            <Button icon="plus" onClick={adjust}>Adjust entitlement</Button>
            {[...usage.byType.entries()].filter(([t]) => !leaveTypesById.value.get(t)?.deductsEntitlement).map(([t, d]) => (
              <Badge key={t} tone="plum" size="sm">{formatDays(d)} {d === 1 ? 'day' : 'days'} {leaveTypesById.value.get(t)?.name?.toLowerCase() || 'other leave'}</Badge>
            ))}
          </div>
        </Card>

        <Card title="Details" icon="info" actions={<Button size="sm" icon="edit" onClick={edit}>Edit</Button>}>
          <dl class="detail-lines">
            <div><dt>Team</dt><dd>{team?.name || 'No team'}</dd></div>
            <div><dt>Role</dt><dd>{carer.role || '—'}</dd></div>
            <div><dt>Working days</dt><dd>{describeWorkingPattern(carer)}{carer.shiftPattern ? <div class="muted small">This week: {describePatternWeek(todayIso, carer)}</div> : null}</dd></div>
            <div><dt>Full-year entitlement</dt><dd>{formatDays(carer.entitlementDays)} days</dd></div>
            <div><dt>Started</dt><dd>{carer.startDate ? formatLong(carer.startDate) : 'Not recorded'}</dd></div>
            {carer.endDate ? <div><dt>Leaving</dt><dd>{formatLong(carer.endDate)}</dd></div> : null}
            {carer.phone ? <div><dt>Phone</dt><dd><a href={`tel:${carer.phone}`}>{carer.phone}</a></dd></div> : null}
            {carer.email ? <div><dt>Email</dt><dd><a href={`mailto:${carer.email}`}>{carer.email}</a></dd></div> : null}
            {pairs.length ? <div><dt>Not off with</dt><dd class="row">{pairs.map((p) => <CarerName key={p.id} carer={p} />)}</dd></div> : null}
            {carer.notes ? <div><dt>Notes</dt><dd class="soft">{carer.notes}</dd></div> : null}
          </dl>
          <div class="row mt profile-danger">
            <Button variant="ghost" icon={carer.active ? 'log-out' : 'refresh'} onClick={archive}>{carer.active ? 'Archive (has left)' : 'Bring back'}</Button>
            <Button variant="ghost" icon="trash" class="btn-danger-ghost" onClick={remove}>Remove completely</Button>
          </div>
        </Card>
      </div>

      <Card title={`${yb.label} at a glance`} icon="grid" class="mt" subtitle="Each coloured day is a holiday or other absence. Grey days are non-working days.">
        <MiniYear carer={carer} yb={yb} items={yearHolidays} todayIso={todayIso} />
      </Card>

      <Card title={`Holidays in ${yb.label}`} icon="list" class="mt" padded={false} actions={<Button size="sm" variant="primary" icon="plus" onClick={addHoliday} disabled={!carer.active}>Add holiday</Button>}>
        <Table columns={columns} rows={rows} rowKey="id" onRowClick={(r) => openHolidayDialog({ holidayId: r.holiday.id })} sort={{ key: 'dates', dir: 'desc' }} emptyState={<EmptyState compact icon="sun" title="No holidays this year" message={`Nothing recorded for ${carer.firstName} in ${yb.label} yet.`} action={carer.active ? { label: 'Add holiday', onClick: addHoliday, icon: 'plus' } : null} />} ariaLabel={`Holidays for ${carerName(carer)}`} />
      </Card>
    </div>
  );
}

/** Twelve mini months showing this carer's absences. */
function MiniYear({ carer, yb, items, todayIso }) {
  const s = settings.value;
  const byDay = useMemo(() => {
    const map = new Map();
    for (const h of items) {
      if (h.status === 'declined') continue;
      const t = leaveTypesById.value.get(h.typeId);
      let d = h.start;
      let guard = 0;
      while (d <= h.end && guard++ < 800) {
        map.set(d, { colour: t?.colour || '#9C8A82', pending: h.status === 'pending', id: h.id, name: t?.name || 'Leave', half: h.halfDay });
        const dt = parts(d);
        const next = new Date(dt.y, dt.m - 1, dt.d + 1);
        d = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      }
    }
    return map;
  }, [items]);
  const months = [];
  let cur = yb.start.slice(0, 7) + '-01';
  for (let i = 0; i < 12; i++) { months.push(cur); cur = addMonths(cur, 1); }
  const headers = weekdayHeaders(s.weekStartsOn || 1);
  return (
    <div class="mini-year">
      {months.map((m) => {
        const { y, m: mo } = parts(m);
        const grid = monthGrid(y, mo, s.weekStartsOn || 1);
        return (
          <div key={m} class="mini-month">
            <div class="mini-month-title">{monthName(mo, true)} {String(y).slice(2)}</div>
            <div class="mini-month-grid">
              {headers.map((h) => <span key={h} class="mini-dow">{h[0]}</span>)}
              {grid.flat().map((cell) => {
                if (!cell.inMonth) return <span key={cell.iso} class="mini-day empty" />;
                const abs = byDay.get(cell.iso);
                const kind = classifyDay(cell.iso, carer, ctx.value);
                const cls = ['mini-day', kind !== 'working' ? 'off' : '', abs ? 'abs' : '', abs?.pending ? 'pending' : '', cell.iso === todayIso ? 'today' : ''].join(' ');
                const title = abs ? `${formatShort(cell.iso)} – ${abs.name}${abs.pending ? ' (awaiting approval)' : ''}` : kind === 'bank-holiday' ? `${formatShort(cell.iso)} – bank holiday` : formatShort(cell.iso);
                return (
                  <button key={cell.iso} type="button" class={cls} style={abs ? { background: abs.colour } : undefined} title={title}
                    onClick={() => abs ? openHolidayDialog({ holidayId: abs.id }) : carer.active && openHolidayDialog({ carerId: carer.id, start: cell.iso, end: cell.iso })}>
                    {cell.iso.slice(8).replace(/^0/, '')}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
