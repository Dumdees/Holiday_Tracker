// Reports: usage per carer, leave by month and type, capacity heat map, sickness and unused leave.
import { useState, useMemo } from 'preact/hooks';
import { navigate } from '../../app/router.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/Button.jsx';
import { SelectField } from '../components/Field.jsx';
import { YearPicker } from '../components/YearPicker.jsx';
import { StatTile } from '../components/StatTile.jsx';
import { Table } from '../components/Table.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Badge } from '../components/Badge.jsx';
import { toast } from '../components/Toast.jsx';
import { BarChart, DonutChart, Heatmap, LineChart } from '../charts/index.js';
import { db, carers, holidays, teams, teamsById, leaveTypes, leaveTypesById, settings, carerName } from '../../store/store.js';
import { monthlyLeave, leaveByType, dayOfWeekPattern, capacityByDay, teamSummary, sicknessByCarer, usageLeagueTable } from '../../core/stats.js';
import { summarise, formatDays } from '../../core/entitlement.js';
import { holidaysToCsv } from '../../core/csv.js';
import { countLeaveDays } from '../../core/leaveDays.js';
import { yearBounds } from '../../core/holidayYear.js';
import { eachDay, isWeekend, formatShort, formatLong, rangesOverlap } from '../../core/dates.js';
import { ctx, currentYear } from '../shared/context.js';
import { today } from '../shared/today.js';
import { usageMap } from '../shared/usage.js';
import { teamOptions } from '../shared/options.js';
import { CarerName } from '../shared/bits.jsx';
import { downloadText, datedFilename } from '../shared/download.js';

export function Reports({ params }) {
  const [yearKey, setYearKey] = useState(params.year || currentYear.value.key);
  const [teamId, setTeamId] = useState(params.team || '');
  const s = settings.value;
  const c = ctx.value;
  const t = today.value;
  const doc = db.value;
  const yb = yearBounds(yearKey, s);
  const opts = { teamId: teamId || undefined };
  const teamName = teamId ? teamsById.value.get(teamId)?.name : 'All teams';

  const people = carers.value.filter((x) => x.active && (!teamId || x.teamId === teamId));
  const usages = usageMap(yearKey);
  const totals = summarise(people.map((p) => usages.get(p.id)).filter(Boolean));
  const league = usageLeagueTable(doc, yb, c, t, opts);
  const monthly = monthlyLeave(doc, yb, c, opts);
  const byType = leaveByType(doc, yb, c, opts);
  const dow = dayOfWeekPattern(doc, yb, c, opts);
  const capacity = capacityByDay(doc, yb.start, yb.end, c, { teamId: teamId || undefined, includePending: true });
  const teamRows = teamSummary(doc, yb, c, t);
  const sick = sicknessByCarer(doc, yb, c).filter((r) => !teamId || r.carer.teamId === teamId);
  const sickDays = sick.reduce((n, r) => n + r.days, 0);
  const hasData = people.length > 0;

  const dimDays = useMemo(() => new Set(eachDay(yb.start, yb.end).filter((d) => isWeekend(d) || c.bankHolidayMap.has(d))), [yb.start, yb.end, c]);
  const usageData = league.map((r) => ({ label: carerName(r.carer), values: { taken: r.usage.taken, booked: r.usage.booked, pending: r.usage.pending, remaining: Math.max(0, r.usage.remaining) }, meta: r.carer }));
  const usageSeries = [
    { key: 'taken', label: 'Taken', colour: '#E5734A' },
    { key: 'booked', label: 'Booked', colour: '#FFC8A8' },
    { key: 'pending', label: 'Awaiting approval', colour: '#E39A2E' },
    { key: 'remaining', label: 'Still to take', colour: '#EDE3DD' },
  ];
  const typeSeries = leaveTypes.value.filter((lt) => byType.some((b) => b.typeId === lt.id && b.days > 0)).map((lt) => ({ key: lt.id, label: lt.name, colour: lt.colour }));
  const monthData = monthly.map((m) => ({ label: m.label.split(' ')[0], values: Object.fromEntries(typeSeries.map((ts) => [ts.key, m.byType.get(ts.key) || 0])) }));
  const sickMonthly = monthly.map((m) => ({ label: m.label.split(' ')[0], values: { sick: [...m.byType.entries()].filter(([id]) => id === 'lt_sick' || /sick/i.test(leaveTypesById.value.get(id)?.name || '')).reduce((n, [, d]) => n + d, 0) } }));

  function exportCsv() {
    const items = holidays.value.filter((h) => rangesOverlap(h.start, h.end, yb.start, yb.end)).map((h) => {
      const carer = carers.value.find((x) => x.id === h.carerId);
      return carer && (!teamId || carer.teamId === teamId) ? { holiday: h, carer, leaveType: leaveTypesById.value.get(h.typeId), days: countLeaveDays(h, carer, c), teamName: carer.teamId ? teamsById.value.get(carer.teamId)?.name || '' : '' } : null;
    }).filter(Boolean).sort((a, b) => a.holiday.start.localeCompare(b.holiday.start));
    downloadText(datedFilename(`Holidays ${yb.label.replace('/', '-')}`, 'csv', t), holidaysToCsv(items), 'text/csv');
    toast('Saved as a spreadsheet file');
  }

  const leagueColumns = [
    { key: 'carer', label: 'Carer', render: (r) => <CarerName carer={r.carer} avatar />, sortValue: (r) => `${r.carer.lastName} ${r.carer.firstName}`, sortable: true },
    { key: 'team', label: 'Team', render: (r) => <span class="muted">{r.carer.teamId ? teamsById.value.get(r.carer.teamId)?.name : '—'}</span>, hideOnMobile: true },
    { key: 'entitlement', label: 'Entitlement', align: 'right', render: (r) => formatDays(r.usage.entitlement.total), sortValue: (r) => r.usage.entitlement.total, sortable: true },
    { key: 'taken', label: 'Taken', align: 'right', render: (r) => formatDays(r.usage.taken), sortValue: (r) => r.usage.taken, sortable: true },
    { key: 'booked', label: 'Booked', align: 'right', render: (r) => formatDays(r.usage.booked), sortValue: (r) => r.usage.booked, sortable: true },
    { key: 'pending', label: 'Awaiting', align: 'right', render: (r) => formatDays(r.usage.pending), sortValue: (r) => r.usage.pending, sortable: true, hideOnMobile: true },
    { key: 'remaining', label: 'Left', align: 'right', render: (r) => <strong class={r.usage.remaining < 0 ? 'text-rose' : ''}>{formatDays(r.usage.remaining)}</strong>, sortValue: (r) => r.usage.remaining, sortable: true },
    { key: 'pct', label: 'Used', align: 'right', render: (r) => <Badge tone={r.percentUsed >= 90 ? 'rose' : r.percentUsed >= 60 ? 'peach' : 'sage'} size="sm">{Math.round(r.percentUsed)}%</Badge>, sortValue: (r) => r.percentUsed, sortable: true },
  ];
  const teamColumns = [
    { key: 'team', label: 'Team', render: (r) => <span class="row"><span class="type-dot" style={{ background: r.team.colour }} />{r.team.name}</span> },
    { key: 'carers', label: 'Carers', align: 'right', render: (r) => r.carerCount },
    { key: 'entitlement', label: 'Entitlement', align: 'right', render: (r) => formatDays(r.entitlement) },
    { key: 'taken', label: 'Taken', align: 'right', render: (r) => formatDays(r.taken) },
    { key: 'booked', label: 'Booked', align: 'right', render: (r) => formatDays(r.booked) },
    { key: 'remaining', label: 'Left', align: 'right', render: (r) => <strong>{formatDays(r.remaining)}</strong> },
    { key: 'sick', label: 'Sick days', align: 'right', render: (r) => formatDays(r.sickDays), hideOnMobile: true },
  ];
  const sickColumns = [
    { key: 'carer', label: 'Carer', render: (r) => <CarerName carer={r.carer} avatar /> },
    { key: 'days', label: 'Days', align: 'right', render: (r) => formatDays(r.days) },
    { key: 'occ', label: 'Times off sick', align: 'right', render: (r) => r.occurrences },
  ];

  return (
    <div class="page reports-page">
      <PageHeader title="Reports" lede={`How holiday is being used in ${yb.label} · ${teamName}`}
        actions={<>
          <Button icon="print" onClick={() => window.print()}>Print</Button>
          <Button icon="download" onClick={exportCsv}>Save as spreadsheet</Button>
        </>}>
        <div class="toolbar">
          <YearPicker value={yearKey} onChange={setYearKey} settings={s} extraDates={holidays.value.flatMap((h) => [h.start, h.end])} today={t} />
          <SelectField ariaLabel="Team" options={teamOptions(teams.value)} value={teamId} onChange={setTeamId} />
        </div>
      </PageHeader>
      <div class="print-only report-print-head"><h1>{s.companyName} · Holiday report {yb.label}</h1><p>{teamName} · printed {formatLong(t)}</p></div>

      {!hasData ? (
        <EmptyState icon="chart" title="Nothing to report yet" message="Add carers and holidays and this page fills up with charts." action={{ label: 'Add carers', onClick: () => navigate('carers'), icon: 'user-plus' }} />
      ) : (
        <>
          <div class="grid grid-4 mb report-tiles">
            <StatTile small label="Entitlement" value={formatDays(totals.entitlement)} hint={`${people.length} carers`} icon="sun" tone="peach" />
            <StatTile small label="Taken so far" value={formatDays(totals.taken)} hint={`${totals.entitlement ? Math.round((totals.taken / totals.entitlement) * 100) : 0}% of entitlement`} icon="check-circle" tone="sky" />
            <StatTile small label="Booked ahead" value={formatDays(totals.booked)} hint={totals.pending ? `plus ${formatDays(totals.pending)} awaiting approval` : 'approved, in the future'} icon="calendar" tone="sage" />
            <StatTile small label="Still to take" value={formatDays(totals.remaining)} hint={`before ${formatShort(yb.end)}`} icon="trending-up" tone={totals.remaining > totals.entitlement * 0.5 ? 'amber' : 'default'} />
          </div>

          <Card title="Holiday used per carer" icon="users" subtitle="Everyone’s year at a glance – people with the most still to take are at the top." class="mb">
            <BarChart series={usageSeries} data={usageData} horizontal stacked showLegend valueFormat={formatDays} ariaLabel={`Holiday used per carer in ${yb.label}`} onBarClick={(item) => item?.meta && navigate('carers', { id: item.meta.id })} emptyText="No carers to show" />
          </Card>

          <div class="grid grid-2 mb">
            <Card title="Leave by month" icon="chart" subtitle="Days off in each month, by type of leave.">
              <BarChart series={typeSeries} data={monthData} stacked height={260} valueFormat={formatDays} ariaLabel={`Leave by month in ${yb.label}`} emptyText="No leave recorded this year" />
            </Card>
            <Card title="Leave by type" icon="pie">
              <DonutChart segments={byType.filter((b) => b.days > 0).map((b) => ({ label: b.name, value: b.days, colour: b.colour }))} centreLabel={formatDays(byType.reduce((n, b) => n + b.days, 0))} centreSub="days" valueFormat={formatDays} ariaLabel={`Leave by type in ${yb.label}`} />
            </Card>
          </div>

          <Card title="When people are off" icon="grid" subtitle="Darker days have more people off. Click a day to open it on the calendar." class="mb">
            <Heatmap start={yb.start} end={yb.end} values={capacity} weekStartsOn={s.weekStartsOn || 1} dimDays={dimDays} onDayClick={(iso) => navigate('calendar', { month: iso.slice(0, 7), day: iso, team: teamId })} tooltip={(iso, v) => `${formatShort(iso)}: ${v ? `${v} off` : 'nobody off'}`} />
          </Card>

          <div class="grid grid-2 mb">
            <Card title="Which days of the week" icon="calendar" subtitle="Total days off by weekday.">
              <BarChart series={[{ key: 'days', label: 'Days off', colour: '#F7915E' }]} data={dow.map((d) => ({ label: d.label, values: { days: d.days } }))} height={220} showLegend={false} showValues valueFormat={formatDays} ariaLabel="Days off by weekday" />
            </Card>
            <Card title="Sickness" icon="activity" subtitle={sickDays ? `${formatDays(sickDays)} sick days across ${sick.length} ${sick.length === 1 ? 'carer' : 'carers'}` : 'No sickness recorded this year'} padded={false}>
              {sick.length ? (
                <>
                  <div class="card-inner"><LineChart series={[{ key: 'sick', label: 'Sick days', colour: '#9576B8' }]} data={sickMonthly} height={160} showLegend={false} valueFormat={formatDays} ariaLabel="Sick days by month" /></div>
                  <Table columns={sickColumns} rows={sick.slice(0, 8)} rowKey={(r) => r.carer.id} dense ariaLabel="Sickness by carer" />
                </>
              ) : <EmptyState compact icon="heart" title="No sickness recorded" />}
            </Card>
          </div>

          {!teamId && teamRows.length > 1 ? (
            <Card title="By team" icon="users" class="mb" padded={false}>
              <Table columns={teamColumns} rows={teamRows.filter((r) => r.carerCount > 0)} rowKey={(r) => r.team.id || 'none'} ariaLabel="Team summary" />
            </Card>
          ) : null}

          <Card title="Everyone in detail" icon="list" subtitle="Sorted by days left – click a name to open their profile." padded={false}>
            <Table columns={leagueColumns} rows={league} rowKey={(r) => r.carer.id} sort={{ key: 'remaining', dir: 'desc' }} onRowClick={(r) => navigate('carers', { id: r.carer.id })} ariaLabel="Usage by carer" />
          </Card>
        </>
      )}
    </div>
  );
}
