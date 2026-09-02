// Settings: friendly tabs for everyday choices, with technical things tucked under "Advanced".
import { useState, useEffect } from 'preact/hooks';
import { route, navigate } from '../../app/router.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { Card } from '../components/Card.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Field, TextField, NumberField, SelectField, Toggle, RadioCards, WeekdayPicker, ColourPicker, DateField } from '../components/Field.jsx';
import { Badge, Chip } from '../components/Badge.jsx';
import { Banner } from '../components/Banner.jsx';
import { Collapsible } from '../components/Collapsible.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { HelpTip } from '../components/HelpTip.jsx';
import { openModal, confirm, alert } from '../components/Modal.jsx';
import { toast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import {
  db, settings, teams, leaveTypes, carers, holidays, teamsById, leaveTypesById,
  updateSettings, addTeam, updateTeam, removeTeam, addLeaveType, updateLeaveType, removeLeaveType,
  addCustomBankHoliday, removeBankHoliday, restoreBankHoliday, exportJson, importJson, markBackedUp,
  resetAll, replaceDb, addCarers, storageInfo, whenSaved,
} from '../../store/store.js';
import { BANK_HOLIDAY_REGIONS, PALETTE } from '../../store/defaults.js';
import { sampleDb, sampleCarerCsv } from '../../store/sample.js';
import { bankHolidaysForYear } from '../../core/bankHolidays.js';
import { carersToCsv, holidaysToCsv, parseCarersCsv } from '../../core/csv.js';
import { countLeaveDays } from '../../core/leaveDays.js';
import { MONTHS, daysInMonth, formatShort, formatLong, parts, diffDays } from '../../core/dates.js';
import { downloadText, pickFile, readFileText, datedFilename } from '../shared/download.js';
import { ctx } from '../shared/context.js';
import { today } from '../shared/today.js';
import { isDesktopApp } from '../shared/host.js';

const TABS = [
  { id: 'general', label: 'General', icon: 'sliders' },
  { id: 'teams', label: 'Teams', icon: 'users' },
  { id: 'types', label: 'Leave types', icon: 'layers' },
  { id: 'bank', label: 'Bank holidays', icon: 'calendar' },
  { id: 'rules', label: 'Staffing rules', icon: 'shield' },
  { id: 'backup', label: 'Backup', icon: 'save' },
  { id: 'advanced', label: 'Advanced', icon: 'settings' },
];

export function Settings({ params }) {
  const tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'general';
  const setTab = (id) => navigate('settings', { tab: id });
  return (
    <div class="page settings-page">
      <PageHeader title="Settings" lede="Holiday year, teams, leave types, bank holidays and backups.">
        <Tabs tabs={TABS} value={tab} onChange={setTab} variant="underline" ariaLabel="Settings sections" />
      </PageHeader>
      {tab === 'general' ? <GeneralTab /> : null}
      {tab === 'teams' ? <TeamsTab /> : null}
      {tab === 'types' ? <LeaveTypesTab /> : null}
      {tab === 'bank' ? <BankHolidaysTab /> : null}
      {tab === 'rules' ? <RulesTab /> : null}
      {tab === 'backup' ? <BackupTab /> : null}
      {tab === 'advanced' ? <AdvancedTab /> : null}
    </div>
  );
}

// ---------- General ----------
function GeneralTab() {
  const s = settings.value;
  const [company, setCompany] = useState(s.companyName);
  const [appName, setAppName] = useState(s.appName);
  const [month, setMonth] = useState(s.holidayYearStart.month);
  const [day, setDay] = useState(s.holidayYearStart.day);
  const [weekStart, setWeekStart] = useState(String(s.weekStartsOn || 1));
  const dirty = company !== s.companyName || appName !== s.appName || month !== s.holidayYearStart.month || day !== s.holidayYearStart.day || Number(weekStart) !== s.weekStartsOn;

  function save() {
    if (!company.trim()) { toast.error('Please enter your organisation’s name.'); return; }
    updateSettings({ companyName: company.trim(), appName: appName.trim() || 'Holiday Manager', holidayYearStart: { month, day: Math.min(day, daysInMonth(2026, month)) }, weekStartsOn: Number(weekStart) });
    toast('Settings saved');
  }

  return (
    <div class="stack">
      <Card title="Your organisation" icon="heart">
        <div class="grid grid-2">
          <Field label="Organisation name" hint="Shown at the top of every screen and on printouts.">
            <TextField value={company} onChange={setCompany} />
          </Field>
          <Field label="App name">
            <TextField value={appName} onChange={setAppName} />
          </Field>
        </div>
      </Card>
      <Card title="Holiday year" icon="calendar" subtitle="Entitlement is measured over the 12 months starting on this day.">
        <div class="grid grid-2">
          <Field label="Starts in">
            <SelectField options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} value={month} onChange={(v) => setMonth(Number(v))} />
          </Field>
          <Field label="On day">
            <SelectField options={Array.from({ length: daysInMonth(2026, month) }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} value={Math.min(day, daysInMonth(2026, month))} onChange={(v) => setDay(Number(v))} />
          </Field>
        </div>
        {(month !== s.holidayYearStart.month || day !== s.holidayYearStart.day) ? (
          <Banner tone="info" icon="info">Changing the holiday year re-calculates everyone’s entitlement and remaining days. Nothing is deleted.</Banner>
        ) : null}
      </Card>
      <Card title="Calendar" icon="grid">
        <Field label="Weeks start on">
          <RadioCards options={[{ value: '1', label: 'Monday' }, { value: '7', label: 'Sunday' }]} value={weekStart} onChange={setWeekStart} columns={2} />
        </Field>
      </Card>
      <div class="settings-save-bar">
        <Button variant="primary" icon="check" onClick={save} disabled={!dirty}>Save changes</Button>
        {!dirty ? <span class="muted">Everything is saved</span> : null}
      </div>
    </div>
  );
}

// ---------- Teams ----------
function TeamsTab() {
  const list = teams.value;
  const counts = new Map();
  for (const c of carers.value) if (c.active) counts.set(c.teamId, (counts.get(c.teamId) || 0) + 1);
  const s = settings.value;

  async function edit(team) {
    const result = await openModal(({ close }) => <TeamForm team={team} close={close} />, { size: 'sm', title: team ? 'Edit team' : 'Add a team' });
    if (result) toast(team ? 'Team updated' : 'Team added');
  }

  async function remove(team) {
    const n = counts.get(team.id) || 0;
    const ok = await confirm({ title: `Remove ${team.name}?`, message: n ? `${n} ${n === 1 ? 'carer' : 'carers'} in this team will be left without a team. Their holidays are kept.` : 'The team has no carers in it.', confirmLabel: 'Remove team', danger: true, icon: 'trash' });
    if (ok) { removeTeam(team.id); toast(`${team.name} removed`); }
  }

  return (
    <div class="stack">
      <Card title="Teams" icon="users" actions={<Button variant="primary" icon="plus" onClick={() => edit(null)}>Add team</Button>} padded={false}>
        {list.length ? (
          <ul class="settings-list">
            {list.map((t) => (
              <li key={t.id} class="settings-row">
                <span class="colour-dot" style={{ background: t.colour }} />
                <div class="settings-row-main">
                  <strong>{t.name}</strong>
                  <span class="muted">{counts.get(t.id) || 0} {counts.get(t.id) === 1 ? 'carer' : 'carers'} · {t.maxOffPerDay == null ? `up to ${s.defaultMaxOffPerDay || 'any number'} off at once (general rule)` : t.maxOffPerDay === 0 ? 'no limit on how many are off at once' : `up to ${t.maxOffPerDay} off at once`}</span>
                </div>
                <div class="row">
                  <Button size="sm" icon="edit" onClick={() => edit(t)}>Edit</Button>
                  <IconButton icon="trash" label={`Remove ${t.name}`} onClick={() => remove(t)} />
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState compact icon="users" title="No teams yet" message="Teams help you see cover at a glance." action={{ label: 'Add a team', onClick: () => edit(null), icon: 'plus' }} />}
      </Card>
      {counts.get(null) ? <p class="muted">{counts.get(null)} {counts.get(null) === 1 ? 'carer is' : 'carers are'} not in any team.</p> : null}
    </div>
  );
}

function TeamForm({ team, close }) {
  const [name, setName] = useState(team?.name || '');
  const [colour, setColour] = useState(team?.colour || PALETTE[teams.value.length % PALETTE.length]);
  const [limit, setLimit] = useState(team?.maxOffPerDay ?? null);
  const [error, setError] = useState('');
  function save() {
    if (!name.trim()) { setError('Please give the team a name.'); return; }
    if (teams.value.some((t) => t.id !== team?.id && t.name.toLowerCase() === name.trim().toLowerCase())) { setError('There is already a team with that name.'); return; }
    if (team) updateTeam(team.id, { name: name.trim(), colour, maxOffPerDay: limit });
    else addTeam({ name: name.trim(), colour, maxOffPerDay: limit });
    close(true);
  }
  return (
    <div class="stack">
      <Field label="Team name" required error={error}>
        <TextField value={name} onChange={(v) => { setName(v); setError(''); }} autoFocus onEnter={save} placeholder="e.g. Day team" />
      </Field>
      <Field label="Colour">
        <ColourPicker value={colour} onChange={setColour} />
      </Field>
      <Field label="How many can be off at once?" hint="Leave empty to use the general rule from Staffing rules. Enter 0 for no limit.">
        <NumberField value={limit} onChange={setLimit} min={0} max={99} placeholder="General rule" />
      </Field>
      <div class="modal-actions">
        <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save}>{team ? 'Save changes' : 'Add team'}</Button>
      </div>
    </div>
  );
}

// ---------- Leave types ----------
function LeaveTypesTab() {
  const list = leaveTypes.value;
  const used = new Map();
  for (const h of holidays.value) used.set(h.typeId, (used.get(h.typeId) || 0) + 1);
  const active = list.filter((t) => !t.archived);
  const archived = list.filter((t) => t.archived);

  async function edit(type) {
    const r = await openModal(({ close }) => <LeaveTypeForm type={type} close={close} />, { size: 'sm', title: type ? 'Edit leave type' : 'Add a leave type' });
    if (r) toast(type ? 'Leave type updated' : 'Leave type added');
  }
  async function remove(type) {
    const n = used.get(type.id) || 0;
    const ok = await confirm({ title: `Remove “${type.name}”?`, message: n ? `${n} ${n === 1 ? 'holiday uses' : 'holidays use'} this type, so it will be hidden from the dropdowns rather than deleted. You can bring it back later.` : 'It isn’t used by any holidays, so it will be deleted.', confirmLabel: n ? 'Hide it' : 'Delete it', danger: !n, icon: 'trash' });
    if (!ok) return;
    const result = removeLeaveType(type.id);
    toast(result === 'archived' ? `${type.name} hidden` : `${type.name} deleted`);
  }

  return (
    <div class="stack">
      <Card title="Leave types" icon="layers" subtitle="Only types that “use up holiday” reduce a carer’s remaining days." actions={<Button variant="primary" icon="plus" onClick={() => edit(null)}>Add leave type</Button>} padded={false}>
        <ul class="settings-list">
          {active.map((t) => (
            <li key={t.id} class="settings-row">
              <span class="colour-dot" style={{ background: t.colour }} />
              <div class="settings-row-main">
                <strong>{t.name}</strong>
                <span class="muted">{t.deductsEntitlement ? 'Uses up holiday entitlement' : 'Doesn’t use up entitlement'} · {used.get(t.id) || 0} {used.get(t.id) === 1 ? 'holiday' : 'holidays'}</span>
              </div>
              <div class="row">
                {t.deductsEntitlement ? <Badge tone="peach">Counts</Badge> : <Badge tone="neutral">Tracked only</Badge>}
                <Button size="sm" icon="edit" onClick={() => edit(t)}>Edit</Button>
                <IconButton icon="trash" label={`Remove ${t.name}`} onClick={() => remove(t)} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {archived.length ? (
        <Collapsible title="Hidden leave types" summary={`${archived.length}`} icon="eye-off">
          <ul class="settings-list">
            {archived.map((t) => (
              <li key={t.id} class="settings-row">
                <span class="colour-dot" style={{ background: t.colour }} />
                <div class="settings-row-main"><strong>{t.name}</strong><span class="muted">Hidden from dropdowns · {used.get(t.id) || 0} holidays</span></div>
                <Button size="sm" icon="eye" onClick={() => { updateLeaveType(t.id, { archived: false }); toast(`${t.name} shown again`); }}>Show again</Button>
              </li>
            ))}
          </ul>
        </Collapsible>
      ) : null}
    </div>
  );
}

function LeaveTypeForm({ type, close }) {
  const [name, setName] = useState(type?.name || '');
  const [colour, setColour] = useState(type?.colour || PALETTE[(leaveTypes.value.length + 3) % PALETTE.length]);
  const [deducts, setDeducts] = useState(type?.deductsEntitlement ?? false);
  const [error, setError] = useState('');
  function save() {
    if (!name.trim()) { setError('Please give the leave type a name.'); return; }
    if (type) updateLeaveType(type.id, { name: name.trim(), colour, deductsEntitlement: deducts });
    else addLeaveType({ name: name.trim(), colour, deductsEntitlement: deducts });
    close(true);
  }
  return (
    <div class="stack">
      <Field label="Name" required error={error}>
        <TextField value={name} onChange={(v) => { setName(v); setError(''); }} autoFocus onEnter={save} placeholder="e.g. Jury service" />
      </Field>
      <Field label="Colour"><ColourPicker value={colour} onChange={setColour} /></Field>
      <Toggle checked={deducts} onChange={setDeducts} label="Uses up holiday entitlement" description="Turn on for annual leave and anything else that should reduce a carer’s remaining days." />
      <div class="modal-actions">
        <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save}>{type ? 'Save changes' : 'Add leave type'}</Button>
      </div>
    </div>
  );
}

// ---------- Bank holidays ----------
function BankHolidaysTab() {
  const s = settings.value;
  const overrides = db.value.bankHolidayOverrides;
  const thisYear = parts(today.value).y;
  const [year, setYear] = useState(thisYear);
  const [customDate, setCustomDate] = useState('');
  const [customName, setCustomName] = useState('');

  const base = bankHolidaysForYear(year, s.bankHolidayRegion);
  const removed = new Set(overrides.removed);
  const custom = overrides.added.filter((b) => b.date.startsWith(String(year)));
  const rows = [
    ...base.map((b) => ({ ...b, custom: false, removed: removed.has(b.date) })),
    ...custom.filter((c) => !base.some((b) => b.date === c.date)).map((c) => ({ ...c, custom: true, removed: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  function addCustom() {
    if (!customDate) { toast.error('Choose a date first.'); return; }
    addCustomBankHoliday({ date: customDate, name: customName.trim() || 'Closure day' });
    toast(`${customName.trim() || 'Closure day'} added on ${formatShort(customDate)}`);
    setCustomDate(''); setCustomName('');
    setYear(parts(customDate).y);
  }

  return (
    <div class="stack">
      <Card title="Which bank holidays apply?" icon="calendar">
        <RadioCards options={BANK_HOLIDAY_REGIONS.map((r) => ({ value: r.id, label: r.label }))} value={s.bankHolidayRegion} onChange={(v) => { updateSettings({ bankHolidayRegion: v }); toast('Bank holidays updated'); }} columns={2} />
        <div class="mt">
          <Toggle checked={!!s.bankHolidaysAreDaysOff} onChange={(v) => { updateSettings({ bankHolidaysAreDaysOff: v }); toast('Saved'); }} label="Bank holidays are days off" description="When on, a bank holiday inside a booked holiday doesn’t use up any entitlement. Turn off if your carers work bank holidays as normal days." />
        </div>
      </Card>
      {s.bankHolidayRegion !== 'none' || custom.length ? (
        <Card title="Bank holidays and closure days" icon="list" actions={
          <SelectField ariaLabel="Year" options={[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => ({ value: y, label: String(y) }))} value={year} onChange={(v) => setYear(Number(v))} />
        } padded={false}>
          {rows.length ? (
            <ul class="settings-list">
              {rows.map((r) => (
                <li key={r.date} class={`settings-row ${r.removed ? 'is-removed' : ''}`}>
                  <div class="settings-row-main">
                    <strong>{r.name}</strong>
                    <span class="muted">{formatLong(r.date)}{r.custom ? ' · Added by you' : ''}{r.removed ? ' · Removed' : ''}</span>
                  </div>
                  {r.removed
                    ? <Button size="sm" icon="refresh" onClick={() => { restoreBankHoliday(r.date); toast(`${r.name} restored`); }}>Put back</Button>
                    : <Button size="sm" variant="ghost" icon="x" onClick={() => { removeBankHoliday(r.date); toast(`${r.name} removed`); }}>Remove</Button>}
                </li>
              ))}
            </ul>
          ) : <EmptyState compact icon="calendar" title="No bank holidays" message="None for this year with the current choice." />}
        </Card>
      ) : null}
      <Card title="Add a closure day" icon="calendar-plus" subtitle="A day the whole organisation treats like a bank holiday – for example a Christmas closure.">
        <div class="grid grid-2">
          <Field label="Date"><DateField value={customDate} onChange={setCustomDate} /></Field>
          <Field label="What is it?"><TextField value={customName} onChange={setCustomName} placeholder="e.g. Christmas closure" onEnter={addCustom} /></Field>
        </div>
        <div class="mt"><Button variant="primary" icon="plus" onClick={addCustom}>Add closure day</Button></div>
      </Card>
    </div>
  );
}

// ---------- Staffing rules ----------
function RulesTab() {
  const s = settings.value;
  const [roles, setRoles] = useState(s.roles || []);
  const [newRole, setNewRole] = useState('');
  const save = (patch, msg = 'Saved') => { updateSettings(patch); toast(msg); };

  function addRole() {
    const r = newRole.trim();
    if (!r) return;
    if (!roles.some((x) => x.toLowerCase() === r.toLowerCase())) { const next = [...roles, r]; setRoles(next); save({ roles: next }, 'Role added'); }
    setNewRole('');
  }

  return (
    <div class="stack">
      <Card title="Cover" icon="shield" subtitle="We warn you before too many people from the same team are off together.">
        <Field label="How many people from one team can be off on the same day?" hint="Enter 0 for no limit. You can set a different number for each team under Teams.">
          <NumberField value={s.defaultMaxOffPerDay} onChange={(v) => save({ defaultMaxOffPerDay: Math.max(0, Number(v) || 0) })} min={0} max={99} />
        </Field>
      </Card>
      <Card title="Entitlement" icon="sun">
        <div class="grid grid-2">
          <Field label="Usual entitlement for a new carer">
            <NumberField value={s.defaultEntitlementDays} onChange={(v) => save({ defaultEntitlementDays: Math.max(0, Number(v) || 0) })} min={0} max={365} step={0.5} suffix="days" />
          </Field>
          <Field label="Round entitlement to the nearest">
            <SelectField options={[{ value: 0.5, label: 'Half day' }, { value: 1, label: 'Whole day' }, { value: 0, label: 'Don’t round' }]} value={s.roundEntitlementTo ?? 0.5} onChange={(v) => save({ roundEntitlementTo: Number(v) })} />
          </Field>
        </div>
        <Field label="Usual working days for a new carer">
          <WeekdayPicker value={s.defaultWorkingDays} onChange={(v) => v.length && save({ defaultWorkingDays: v })} />
        </Field>
        <Toggle checked={!!s.proRataStartersAndLeavers} onChange={(v) => save({ proRataStartersAndLeavers: v })} label="Work out a fair share for starters and leavers" description="Someone who joins half-way through the year gets half their entitlement for that year, based on their start date." />
      </Card>
      <Card title="Reminders" icon="alert" subtitle="Shown on the Home screen.">
        <div class="grid grid-2">
          <Field label="Warn about unused holiday when a carer still has at least">
            <NumberField value={s.unusedLeaveWarningDays} onChange={(v) => save({ unusedLeaveWarningDays: Math.max(0, Number(v) || 0) })} min={0} max={100} step={0.5} suffix="days" />
          </Field>
          <Field label="…with this many weeks of the holiday year left">
            <NumberField value={s.unusedLeaveWarningWeeks} onChange={(v) => save({ unusedLeaveWarningWeeks: Math.max(1, Number(v) || 1) })} min={1} max={52} />
          </Field>
        </div>
      </Card>
      <Card title="Roles" icon="briefcase" subtitle="Offered when you add a carer.">
        <div class="row mb">
          {roles.map((r) => <Chip key={r} label={r} onRemove={() => { const next = roles.filter((x) => x !== r); setRoles(next); save({ roles: next }, 'Role removed'); }} />)}
        </div>
        <div class="row">
          <TextField value={newRole} onChange={setNewRole} placeholder="e.g. Driver" onEnter={addRole} />
          <Button icon="plus" onClick={addRole}>Add role</Button>
        </div>
      </Card>
    </div>
  );
}

// ---------- Backup ----------
function backupInfo(s, todayIso) {
  if (!s.lastBackupAt) return { text: 'You haven’t saved a backup yet.', due: true };
  const iso = s.lastBackupAt.slice(0, 10);
  const days = diffDays(iso, todayIso);
  const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return { text: `Last backup: ${formatLong(iso)} (${when}).`, due: s.backupReminderDays > 0 && days >= s.backupReminderDays };
}

export async function saveBackupFile() {
  await whenSaved();
  const name = datedFilename('Monteith Holiday Manager backup', 'json', today.value);
  downloadText(name, exportJson(), 'application/json');
  markBackedUp();
  toast('Backup file saved to your Downloads folder');
}

export async function restoreBackupFile() {
  const file = await pickFile({ accept: '.json,application/json' });
  if (!file) return false;
  let text;
  try { text = await readFileText(file); } catch { toast.error('That file couldn’t be read.'); return false; }
  const ok = await confirm({ title: 'Restore this backup?', message: 'Everything currently in the app will be replaced with what’s in the backup file. You can undo this straight afterwards if you change your mind.', confirmLabel: 'Restore backup', danger: true, icon: 'upload' });
  if (!ok) return false;
  try {
    importJson(text);
    toast('Backup restored');
    return true;
  } catch (err) {
    await alert({ title: 'That didn’t work', message: err?.message || 'The file doesn’t look like a backup from this app.', icon: 'alert' });
    return false;
  }
}

function BackupTab() {
  const s = settings.value;
  const info = backupInfo(s, today.value);
  return (
    <div class="stack">
      <Card title="Save a backup" icon="save" tone="peach">
        <p>{isDesktopApp() ? 'Your holiday records live on this computer.' : 'Your holiday records live inside this web browser on this computer.'} A backup is a single file you can keep somewhere safe – OneDrive, a memory stick or an email to yourself – and restore later if the computer is replaced{isDesktopApp() ? '' : ' or the browser is cleared'}.</p>
        <p class={info.due ? 'backup-due' : 'soft'}>{info.text}</p>
        <div class="row mt">
          <Button variant="primary" size="lg" icon="download" onClick={saveBackupFile}>Save a backup file</Button>
        </div>
      </Card>
      <Card title="Restore from a backup" icon="upload">
        <p class="soft">Choose a backup file saved by this app. Everything currently here will be replaced with what’s in the file.</p>
        <Button icon="upload" onClick={restoreBackupFile}>Restore from a backup file</Button>
      </Card>
      <Card title="Reminders" icon="clock">
        <Field label="Remind me to save a backup">
          <SelectField options={[{ value: 7, label: 'Every week' }, { value: 14, label: 'Every two weeks' }, { value: 30, label: 'Every month' }, { value: 0, label: 'Never' }]} value={s.backupReminderDays ?? 7} onChange={(v) => { updateSettings({ backupReminderDays: Number(v) }); toast('Saved'); }} />
        </Field>
      </Card>
    </div>
  );
}

// ---------- Advanced ----------
function browserName() {
  try {
    const brands = navigator.userAgentData?.brands?.map((b) => b.brand) || [];
    if (brands.some((b) => /Edge/i.test(b))) return 'Microsoft Edge';
    if (brands.some((b) => /Google Chrome/i.test(b))) return 'Google Chrome';
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'Microsoft Edge';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua)) return 'Google Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
  } catch { /* ignore */ }
  return 'this web browser';
}

function AdvancedTab() {
  const info = storageInfo();
  const kb = Math.max(1, Math.round(info.sizeBytes / 1024));
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  function exportCarers() {
    const rows = carers.value;
    downloadText(datedFilename('Carers', 'csv', today.value), carersToCsv(rows, { teamsById: teamsById.value }), 'text/csv');
    toast('Carers saved as a spreadsheet file');
  }
  function exportHolidays() {
    const items = holidays.value.map((h) => {
      const carer = carers.value.find((c) => c.id === h.carerId);
      return { holiday: h, carer, leaveType: leaveTypesById.value.get(h.typeId), days: carer ? countLeaveDays(h, carer, ctx.value) : 0, teamName: carer?.teamId ? teamsById.value.get(carer.teamId)?.name || '' : '' };
    }).filter((i) => i.carer).sort((a, b) => a.holiday.start.localeCompare(b.holiday.start));
    downloadText(datedFilename('Holidays', 'csv', today.value), holidaysToCsv(items), 'text/csv');
    toast('Holidays saved as a spreadsheet file');
  }
  async function importCarers() {
    const file = await pickFile({ accept: '.csv,text/csv' });
    if (!file) return;
    let text;
    try { text = await readFileText(file); } catch { toast.error('That file couldn’t be read.'); return; }
    const { carers: list, errors } = parseCarersCsv(text, db.value);
    const problems = errors.filter((e) => !e.warning);
    const warnings = errors.filter((e) => e.warning);
    const ok = await openModal(({ close }) => (
      <div class="stack">
        <h2>{list.length ? `Add ${list.length} ${list.length === 1 ? 'carer' : 'carers'}?` : 'No carers found'}</h2>
        {list.length ? <p class="soft">{list.slice(0, 8).map((c) => `${c.firstName} ${c.lastName}`).join(', ')}{list.length > 8 ? ` and ${list.length - 8} more` : ''}.</p> : <p class="soft">Check the file has a “First name” and “Last name” column. Download the example file to see the layout.</p>}
        {warnings.length ? <Banner tone="warning" title="Some details couldn’t be matched"><ul class="clash-list">{warnings.slice(0, 6).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul></Banner> : null}
        {problems.length ? <Banner tone="danger" title={`${problems.length} ${problems.length === 1 ? 'row was' : 'rows were'} skipped`}><ul class="clash-list">{problems.slice(0, 6).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul></Banner> : null}
        <div class="modal-actions">
          <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          {list.length ? <Button variant="primary" icon="user-plus" onClick={() => close(true)}>Add {list.length} {list.length === 1 ? 'carer' : 'carers'}</Button> : null}
        </div>
      </div>
    ), { size: 'sm' });
    if (!ok) return;
    addCarers(list);
    toast(`${list.length} ${list.length === 1 ? 'carer' : 'carers'} added`);
    navigate('carers');
  }
  async function loadSample() {
    const ok = await confirm({ title: 'Load sample data?', message: 'This replaces everything currently in the app with made-up carers and holidays so you can explore. Save a backup first if you have real records here. You can undo straight afterwards.', confirmLabel: 'Load sample data', danger: carers.value.length > 0, icon: 'sparkle' });
    if (!ok) return;
    replaceDb(sampleDb({ today: today.value, settings: { companyName: settings.value.companyName } }), 'Loaded sample data');
    toast('Sample data loaded');
    navigate('home');
  }
  async function clearAll() {
    const typed = await openModal(({ close }) => <ClearAllForm close={close} />, { size: 'sm', title: 'Clear all data' });
    if (!typed) return;
    await resetAll();
    toast('Everything has been cleared');
  }

  return (
    <div class="stack">
      <Banner tone="info" icon="info" title="For the technically curious">Most people never need this section. Everything here is safe to look at.</Banner>
      <Card title="Where your information is kept" icon="database">
        {isDesktopApp()
          ? <p>Everything is stored by the <strong>Monteith Holiday Manager</strong> program on this computer, in your own Windows account – nothing is sent over the internet. It stays put if the program is updated or reinstalled, so save backups regularly all the same.</p>
          : <p>Everything is stored inside <strong>{browserName()}</strong> on this computer – nothing is sent over the internet. Always open the app in the same browser, and save backups regularly.</p>}
        <p class="muted">Your records currently take up about {kb} KB{info.engine === 'localStorage' ? ' (using the browser’s simple storage)' : ''}.</p>
      </Card>
      <Card title="Spreadsheets" icon="file-text" subtitle="Files that open in Excel.">
        <div class="row">
          <Button icon="download" onClick={exportCarers}>Save carers as a spreadsheet</Button>
          <Button icon="download" onClick={exportHolidays}>Save holidays as a spreadsheet</Button>
        </div>
        <hr class="settings-hr" />
        <p class="soft">Already have a list of carers in a spreadsheet? Save it as a CSV file with columns like the example, then import it.</p>
        <div class="row">
          <Button variant="primary" icon="upload" onClick={importCarers}>Import carers from a spreadsheet</Button>
          <Button variant="link" icon="download" onClick={() => { downloadText('Example carers.csv', sampleCarerCsv(), 'text/csv'); }}>Download an example file</Button>
        </div>
      </Card>
      <Card title="Sample data" icon="sparkle">
        <p class="soft">Fill the app with made-up carers and holidays to explore how everything works.</p>
        <Button icon="sparkle" onClick={loadSample}>Load sample data</Button>
      </Card>
      <Card title="Start again" icon="trash" tone="rose">
        <p class="soft">Removes every carer, holiday and setting from this computer. Save a backup first – this can’t be undone.</p>
        <Button variant="danger" icon="trash" onClick={clearAll}>Clear all data</Button>
      </Card>
      <p class="muted center">Monteith Holiday Manager · version {version}</p>
    </div>
  );
}

function ClearAllForm({ close }) {
  const [typed, setTyped] = useState('');
  const ok = typed.trim().toUpperCase() === 'DELETE';
  return (
    <div class="stack">
      <p>This removes <strong>everything</strong> – every carer, every holiday and all your settings. It cannot be undone.</p>
      <Field label="Type DELETE to confirm">
        <TextField value={typed} onChange={setTyped} autoFocus placeholder="DELETE" onEnter={() => ok && close(true)} />
      </Field>
      <div class="modal-actions">
        <Button variant="ghost" onClick={() => close(false)}>Keep my data</Button>
        <Button variant="danger" icon="trash" disabled={!ok} onClick={() => close(true)}>Clear everything</Button>
      </div>
    </div>
  );
}
