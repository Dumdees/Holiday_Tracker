// Home: today at a glance – who's off, what's coming, and anything that needs attention.
import { navigate } from '../../app/router.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/Button.jsx';
import { StatTile } from '../components/StatTile.jsx';
import { Banner } from '../components/Banner.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Badge } from '../components/Badge.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ProgressBar } from '../components/Progress.jsx';
import { Icon } from '../components/Icon.jsx';
import { toast } from '../components/Toast.jsx';
import { db, carers, holidays, settings, activeCarers, carerName, setHolidayStatus } from '../../store/store.js';
import { currentlyOff, upcoming, absencesBetween, pendingApprovals, backupStatus, unusedLeaveAlerts, lowRemainingAlerts, overdrawnAlerts } from '../../core/stats.js';
import { existingProblems } from '../../core/clashes.js';
import { summarise, formatDays } from '../../core/entitlement.js';
import { formatLong, formatRange, formatShort, addDays, startOfWeek, endOfWeek, relativeDay, diffDays } from '../../core/dates.js';
import { ctx, currentYear } from '../shared/context.js';
import { today } from '../shared/today.js';
import { usageMap } from '../shared/usage.js';
import { CarerName, LeaveTypeTag, daysLabel, halfDayLabel } from '../shared/bits.jsx';
import { openHolidayDialog } from '../dialogs/HolidayDialog.jsx';
import { openCarerDialog } from '../dialogs/CarerDialog.jsx';
import { saveBackupFile } from './Settings.jsx';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const t = today.value;
  const s = settings.value;
  const c = ctx.value;
  const yb = currentYear.value;
  const doc = db.value;
  const people = activeCarers.value;

  if (!carers.value.length) {
    return (
      <div class="page home-page">
        <PageHeader title={`${greeting()}`} lede={formatLong(t)} />
        <EmptyState icon="sparkle" title="Let’s add your carers" message="Once your carers are in, this screen shows who’s off today, what’s coming up and anything that needs your attention." action={{ label: 'Add a carer', onClick: () => openCarerDialog().then((id) => id && navigate('carers', { id })), icon: 'user-plus' }}>
          <div class="row mt">
            <Button variant="link" onClick={() => navigate('settings', { tab: 'advanced' })}>Import a list from a spreadsheet</Button>
            <Button variant="link" onClick={() => navigate('settings', { tab: 'advanced' })}>Explore with sample data</Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const offToday = currentlyOff(doc, t, c);
  const weekStart = startOfWeek(t, s.weekStartsOn || 1);
  const weekEnd = endOfWeek(t, s.weekStartsOn || 1);
  const offThisWeek = absencesBetween(doc, weekStart, weekEnd, c);
  const next = upcoming(doc, t, 14, c);
  const pending = pendingApprovals(doc, c);
  const backup = backupStatus(s, t);
  const problems = existingProblems(doc, c, { start: t, end: addDays(t, 60) });
  const unused = unusedLeaveAlerts(doc, yb, c, t);
  const low = lowRemainingAlerts(doc, yb, c, t);
  const overdrawn = overdrawnAlerts(doc, yb, c, t);
  const totals = summarise(usageMap(yb.key).values());
  const used = totals.taken + totals.booked;
  const daysLeftInYear = diffDays(t, yb.end);

  const attention = [];
  if (problems.length) attention.push({ tone: 'warning', icon: 'alert', title: problems.length === 1 ? 'A clash in the next two months' : `${problems.length} clashes in the next two months`, body: problems.slice(0, 3).map((p) => p.message).join(' · ') + (problems.length > 3 ? ' · and more' : ''), action: { label: 'See calendar', onClick: () => navigate('calendar', { month: (problems[0].dates?.[0] || t).slice(0, 7), day: problems[0].dates?.[0] }) } });
  if (pending.length) attention.push({ tone: 'info', icon: 'clock', title: pending.length === 1 ? 'One holiday request is waiting for a decision' : `${pending.length} holiday requests are waiting for a decision`, body: pending.slice(0, 3).map((p) => `${p.carer.firstName} · ${formatRange(p.holiday.start, p.holiday.end)}`).join(' · '), action: { label: 'Review requests', onClick: () => navigate('holidays', { tab: 'all', status: 'pending' }) } });
  if (overdrawn.length) attention.push({ tone: 'danger', icon: 'alert-circle', title: overdrawn.length === 1 ? `${carerName(overdrawn[0].carer)} has gone over their entitlement` : `${overdrawn.length} carers have gone over their entitlement`, body: overdrawn.slice(0, 4).map((o) => `${o.carer.firstName} (${formatDays(o.remaining)})`).join(' · '), action: { label: 'See carers', onClick: () => navigate('carers') } });
  if (unused.length) attention.push({ tone: 'warning', icon: 'sun', title: `${unused.length === 1 ? 'One carer still has' : `${unused.length} carers still have`} a lot of holiday to use before ${formatShort(yb.end)}`, body: unused.slice(0, 4).map((u) => `${u.carer.firstName} (${formatDays(u.remaining)} left)`).join(' · '), action: { label: 'See reports', onClick: () => navigate('reports') } });
  if (low.length) attention.push({ tone: 'info', icon: 'info', title: `${low.length === 1 ? 'One carer is' : `${low.length} carers are`} nearly out of holiday for ${yb.label}`, body: low.slice(0, 4).map((l) => `${l.carer.firstName} (${formatDays(l.remaining)} left)`).join(' · '), action: { label: 'See carers', onClick: () => navigate('carers') } });
  if (backup.due && s.backupReminderDays > 0) attention.push({ tone: 'info', icon: 'save', title: backup.lastBackupAt ? `It’s been ${backup.daysSince} days since your last backup` : 'You haven’t saved a backup yet', body: 'A backup is a single file you can keep somewhere safe. It takes a few seconds.', action: { label: 'Save a backup now', onClick: saveBackupFile } });

  const byDate = new Map();
  for (const a of next) { if (!byDate.has(a.holiday.start)) byDate.set(a.holiday.start, []); byDate.get(a.holiday.start).push(a); }

  return (
    <div class="page home-page">
      <PageHeader title={`${greeting()}`} lede={<>{formatLong(t)} · {yb.label} holiday year · {daysLeftInYear} days until it ends</>}
        actions={<>
          <Button variant="primary" icon="calendar-plus" onClick={() => openHolidayDialog({ start: t, end: t })}>Add holiday</Button>
          <Button icon="users" onClick={() => navigate('holidays', { tab: 'add' })}>Add for several carers</Button>
        </>} />

      <div class="grid grid-4 mb">
        <StatTile label="Off today" value={offToday.length} hint={offToday.length ? offToday.slice(0, 3).map((a) => a.carer.firstName).join(', ') + (offToday.length > 3 ? '…' : '') : 'Everyone’s in'} icon="sun" tone="peach" onClick={() => navigate('calendar', { day: t })} />
        <StatTile label="Off this week" value={offThisWeek.length} hint={formatRange(weekStart, weekEnd)} icon="calendar" tone="sky" onClick={() => navigate('calendar', { view: 'week', day: t })} />
        <StatTile label="Awaiting approval" value={pending.length} hint={pending.length ? 'requests to decide on' : 'nothing waiting'} icon="clock" tone={pending.length ? 'amber' : 'default'} onClick={() => navigate('holidays', { tab: 'all', status: 'pending' })} />
        <StatTile label="Carers" value={people.length} hint={`${formatDays(totals.remaining)} days left between them`} icon="users" tone="sage" onClick={() => navigate('carers')} />
      </div>

      <div class="grid home-grid">
        <div class="stack">
          <Card title="Needs your attention" icon="alert" tone={attention.length ? 'default' : 'sage'}>
            {attention.length ? (
              <div class="stack">
                {attention.map((a, i) => <Banner key={i} tone={a.tone} icon={a.icon} title={a.title} action={a.action}>{a.body}</Banner>)}
              </div>
            ) : (
              <div class="row"><Icon name="check-circle" size={22} /> <span>Nothing needs your attention right now.</span></div>
            )}
          </Card>

          <Card title="Coming up in the next two weeks" icon="calendar" padded={false} actions={<Button size="sm" variant="ghost" onClick={() => navigate('calendar')}>Calendar</Button>}>
            {next.length ? (
              <ul class="home-list">
                {[...byDate.entries()].map(([date, items]) => (
                  <li key={date} class="home-date-group">
                    <div class="home-date"><strong>{formatShort(date)}</strong> <span class="muted">{relativeDay(date, t)}</span></div>
                    <ul>
                      {items.map((a) => (
                        <li key={a.holiday.id} class="home-item">
                          <Avatar name={carerName(a.carer)} colour={a.carer.colour} size={30} />
                          <CarerName carer={a.carer} />
                          <LeaveTypeTag typeId={a.holiday.typeId} small />
                          <span class="muted">{formatRange(a.holiday.start, a.holiday.end)} · {daysLabel(a.days)}</span>
                          {a.holiday.status === 'pending' ? <StatusBadge status="pending" /> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact icon="calendar" title="Nothing booked in the next two weeks" message="A quiet fortnight ahead." />}
          </Card>
        </div>

        <div class="stack">
          <Card title="Off today" icon="sun" padded={false}>
            {offToday.length ? (
              <ul class="home-list">
                {offToday.map((a) => (
                  <li key={a.holiday.id} class="home-item">
                    <Avatar name={carerName(a.carer)} colour={a.carer.colour} size={30} />
                    <div class="stack-sm">
                      <CarerName carer={a.carer} />
                      <span class="muted"><LeaveTypeTag typeId={a.holiday.typeId} small /> · back {formatShort(addDays(a.holiday.end, 1), { year: false })}{a.holiday.halfDay ? ` · ${halfDayLabel(a.holiday.halfDay)}` : ''}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact icon="check-circle" title="Everyone’s in today" />}
          </Card>

          {pending.length ? (
            <Card title="Waiting for a decision" icon="clock" padded={false} actions={<Button size="sm" variant="ghost" onClick={() => navigate('holidays', { tab: 'all', status: 'pending' })}>See all</Button>}>
              <ul class="home-list">
                {pending.slice(0, 5).map((p) => (
                  <li key={p.holiday.id} class="home-item">
                    <div class="stack-sm" style={{ flex: 1 }}>
                      <CarerName carer={p.carer} />
                      <span class="muted">{formatRange(p.holiday.start, p.holiday.end)} · {daysLabel(p.days)} · <LeaveTypeTag typeId={p.holiday.typeId} small /></span>
                    </div>
                    <span class="home-item-actions">
                      <Button size="sm" variant="soft" icon="check" onClick={() => { setHolidayStatus(p.holiday.id, 'approved'); toast(`Approved for ${carerName(p.carer)}`); }}>Approve</Button>
                      <Button size="sm" variant="ghost" icon="eye" onClick={() => openHolidayDialog({ holidayId: p.holiday.id })}>Look</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title={`${yb.label} so far`} icon="chart" actions={<Button size="sm" variant="ghost" onClick={() => navigate('reports')}>Reports</Button>}>
            <ProgressBar total={totals.entitlement || 1} height={12} showLegend segments={[
              { value: totals.taken, colour: 'var(--peach-600)', label: `Taken ${formatDays(totals.taken)}` },
              { value: totals.booked, colour: 'var(--peach-300)', label: `Booked ${formatDays(totals.booked)}` },
              { value: totals.pending, colour: 'var(--amber)', label: `Awaiting ${formatDays(totals.pending)}` },
            ]} ariaLabel="Team holiday used this year" />
            <p class="muted mt">{formatDays(used)} of {formatDays(totals.entitlement)} days used or booked across {people.length} carers · {formatDays(totals.remaining)} still to take.</p>
          </Card>

          <Card title="Quick actions" icon="zap">
            <div class="quick-actions">
              <Button icon="calendar-plus" onClick={() => navigate('holidays', { tab: 'add' })}>Add holidays</Button>
              <Button icon="user-plus" onClick={() => openCarerDialog().then((id) => id && navigate('carers', { id }))}>Add a carer</Button>
              <Button icon="calendar" onClick={() => navigate('calendar')}>Open calendar</Button>
              <Button icon="save" onClick={saveBackupFile}>Save a backup</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
