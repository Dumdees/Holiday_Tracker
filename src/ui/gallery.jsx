// Dev-only component gallery. Bundled by scripts/gallery.mjs into .playwright-out/gallery.html
// so every shared component can be checked by eye. NOT part of the app (main.jsx never imports it).
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  Icon, BrandMark, toast, ToastHost, openModal, ModalHost,
  Button, IconButton, Card, CardSection, PageHeader,
  Field, TextField, NumberField, TextArea, DateField, SelectField, Toggle, Checkbox, RadioCards, WeekdayPicker, ColourPicker, SearchBox,
  MultiSelect, Avatar, Badge, Chip, StatusBadge, Tabs, TabPanel, EmptyState, ProgressBar, ProgressRing, StatTile,
  Table, Drawer, Collapsible, Banner, HelpTip, Pagination, YearPicker,
} from './components/index.js';
import { defaultSettings, PALETTE } from '../store/defaults.js';
import { formatRange } from '../core/dates.js';

const TODAY = '2026-09-01';
const SETTINGS = defaultSettings();

const TEAMS = [
  { id: 't1', name: 'Day team', colour: '#F58F5B' },
  { id: 't2', name: 'Night team', colour: '#6FA8DC' },
  { id: 't3', name: 'Weekend team', colour: '#7BAF8E' },
];
const NAMES = ['Priya Sharma', 'Sam Okafor', 'Morag McLeod', 'Fiona Grant', 'Callum Reid', 'Aisha Khan', 'Dominika Nowak', 'Ewan Fraser', 'Grace Adeyemi', 'Hamish Boyd', 'Isla Munro', 'Jakub Wozniak', 'Kirsty Doyle', 'Liam Murphy', 'Nadia Hussain', 'Oliver Chen', 'Rosie Campbell', 'Tomasz Kowalski'];
const ROLES = ['Carer', 'Senior carer', 'Care coordinator', 'Team leader'];
const STATUSES = ['approved', 'approved', 'pending', 'approved', 'declined'];
const CARERS = NAMES.map((name, i) => ({
  id: `c${i + 1}`,
  name,
  team: TEAMS[i % 3],
  role: ROLES[i % 4],
  colour: PALETTE[i % PALETTE.length],
  entitlement: 28,
  taken: (i * 3) % 20,
  booked: (i * 2) % 7,
  pending: i % 3 === 0 ? 2 : 0,
}));
const CARER_OPTIONS = CARERS.map((c) => ({ value: c.id, label: c.name, group: c.team.name, colour: c.colour, sub: c.role }));
const HOLIDAYS = Array.from({ length: 30 }, (_, i) => {
  const carer = CARERS[i % CARERS.length];
  const day = 1 + ((i * 7) % 26);
  const month = 9 + Math.floor(i / 12);
  const start = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const len = i % 4;
  const end = `2026-${String(month).padStart(2, '0')}-${String(day + len).padStart(2, '0')}`;
  return { id: `h${i + 1}`, carer, start, end, days: len + 1 - (i % 5 === 0 ? 0.5 : 0), type: i % 6 === 0 ? 'Sick leave' : 'Annual leave', status: STATUSES[i % STATUSES.length], notes: i % 7 === 0 ? 'Family wedding' : '' };
});

function Section({ title, desc, children }) {
  return (
    <section class="g-section">
      <h2>{title}</h2>
      {desc ? <p class="g-desc">{desc}</p> : null}
      {children}
    </section>
  );
}

function noop() {}

function ButtonsSection() {
  return (
    <Section title="Buttons" desc="Every variant, size and state. Icon buttons always carry a label.">
      <div class="g-label">Variants</div>
      <div class="g-row">
        <Button variant="primary" icon="plus">Add holiday</Button>
        <Button variant="secondary" icon="user-plus">Add carer</Button>
        <Button variant="soft" icon="download">Save a backup</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger" icon="trash">Remove carer</Button>
        <Button variant="link">Show all holidays</Button>
      </div>
      <div class="g-label">Sizes</div>
      <div class="g-row">
        <Button variant="primary" size="sm" icon="plus">Small</Button>
        <Button variant="primary" icon="plus">Medium</Button>
        <Button variant="primary" size="lg" icon="plus">Large</Button>
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
      </div>
      <div class="g-label">States</div>
      <div class="g-row">
        <Button variant="primary" loading>Saving</Button>
        <Button loading>Loading</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button disabled>Disabled</Button>
        <Button variant="danger" disabled>Disabled</Button>
        <Button iconRight="arrow-right">Next step</Button>
      </div>
      <div class="g-box"><Button variant="primary" full size="lg" icon="check">Add 4 holidays</Button></div>
      <div class="g-label">Icon buttons</div>
      <div class="g-row">
        <IconButton icon="edit" label="Edit" />
        <IconButton icon="trash" label="Remove" variant="danger" />
        <IconButton icon="x" label="Close" variant="secondary" />
        <IconButton icon="plus" label="Add" variant="primary" />
        <IconButton icon="filter" label="Filter" variant="soft" />
        <IconButton icon="chevron-left" label="Previous month" size="sm" variant="secondary" />
        <IconButton icon="chevron-right" label="Next month" size="lg" variant="secondary" />
        <IconButton icon="print" label="Print" disabled />
      </div>
    </Section>
  );
}

function BadgesSection() {
  const [chips, setChips] = useState(CARERS.slice(0, 4));
  return (
    <Section title="Badges, chips and avatars">
      <div class="g-label">Badges</div>
      <div class="g-row">
        <Badge tone="peach" dot>Annual leave</Badge>
        <Badge tone="sage" dot>Approved</Badge>
        <Badge tone="sky" icon="info">Training</Badge>
        <Badge tone="amber" dot>Awaiting approval</Badge>
        <Badge tone="rose">2 clashes</Badge>
        <Badge tone="plum" dot>Sick leave</Badge>
        <Badge>Archived</Badge>
        <Badge tone="sage" size="sm">Small</Badge>
        <Badge tone="peach" size="lg" icon="star">Large</Badge>
      </div>
      <div class="g-label">Status badges</div>
      <div class="g-row">
        <StatusBadge status="approved" />
        <StatusBadge status="pending" />
        <StatusBadge status="declined" />
        <StatusBadge status="approved" size="sm" />
      </div>
      <div class="g-label">Chips</div>
      <div class="g-row">
        {chips.map((c) => <Chip key={c.id} label={c.name} colour={c.colour} onRemove={() => setChips(chips.filter((x) => x.id !== c.id))} />)}
        <Chip label="Day team" colour="#F58F5B" onClick={noop} />
        <Chip label="Bank holiday" icon="calendar" small />
        <Chip label="Small removable" small colour="#6FA8DC" onRemove={noop} />
        {chips.length < 4 ? <Button variant="link" size="sm" onClick={() => setChips(CARERS.slice(0, 4))}>Put them back</Button> : null}
      </div>
      <div class="g-label">Avatars</div>
      <div class="g-row">
        <Avatar name="Priya Sharma" colour="#F58F5B" size={28} />
        <Avatar name="Sam Okafor" colour="#7BAF8E" />
        <Avatar name="Morag McLeod" colour="#6FA8DC" size={48} />
        <Avatar name="Fiona Grant" colour="#9B7BBF" size={64} />
        <Avatar name="Unknown carer" />
        <Avatar name="" size={36} />
        <span class="row"><Avatar name="Callum Reid" colour="#E9A23B" size={32} /> <strong>Callum Reid</strong> <span class="muted">Night team</span></span>
      </div>
    </Section>
  );
}

function CardsSection() {
  return (
    <Section title="Page header, cards and stat tiles">
      <PageHeader
        title="Priya Sharma"
        lede="Senior carer · Day team · started Mon 3 Mar 2025"
        back={{ label: 'All carers', onClick: noop }}
        actions={<><Button icon="edit">Edit</Button><Button variant="primary" icon="calendar-plus">Add holiday</Button></>}
      />
      <div class="grid grid-4 mb">
        <StatTile label="Off today" value="3" hint="of 18 carers" icon="sun" tone="peach" onClick={noop} />
        <StatTile label="Awaiting approval" value="5" icon="clock" tone="amber" />
        <StatTile label="Clashes this month" value="2" hint="Day team, Wed 4 Mar" icon="alert" tone="rose" />
        <StatTile label="Days left (team average)" value="11.5" icon="umbrella" tone="sage" />
      </div>
      <div class="g-row">
        <StatTile small label="Taken" value="12" tone="peach" />
        <StatTile small label="Booked" value="6.5" icon="calendar" tone="sky" />
        <StatTile small label="Remaining" value="9.5" icon="check-circle" tone="sage" />
        <StatTile small label="Sick days" value="2" icon="heart" tone="plum" />
      </div>
      <div class="grid grid-3 mt">
        <Card title="Who's off today" subtitle="Tue 1 Sep 2026" icon="sun" actions={<Button size="sm" variant="link">See calendar</Button>} footer={<span class="muted">3 of 18 carers are off</span>}>
          <div class="stack-sm">
            {CARERS.slice(0, 3).map((c) => <span key={c.id} class="row"><Avatar name={c.name} colour={c.colour} size={32} /><strong>{c.name}</strong><Badge tone="peach" size="sm">Annual leave</Badge></span>)}
          </div>
        </Card>
        <Card title="Backup reminder" icon="shield" tone="amber" subtitle="Last backup 9 days ago">
          <p>A backup is a copy of everything in one small file. Keeping one somewhere safe means nothing is lost if this computer breaks.</p>
          <Button variant="primary" icon="download" class="mt">Save a backup</Button>
        </Card>
        <Card title="Clickable card" subtitle="Whole card is a button" onClick={() => toast('Card clicked')} tone="sky" icon="users">
          <p>Hover or focus it. Press Enter to activate.</p>
        </Card>
      </div>
      <div class="grid grid-3 mt">
        <Card tone="peach" title="Peach"><p class="soft">Soft peach tint.</p></Card>
        <Card tone="sage" title="Sage"><p class="soft">Success and remaining days.</p></Card>
        <Card tone="rose" title="Rose"><p class="soft">Something needs attention.</p></Card>
      </div>
      <div class="grid grid-2 mt">
        <Card title="Flush card with sections" padded={false} icon="file-text">
          <CardSection title="Contact"><div class="stack-sm"><span>07700 900123</span><span>priya@example.com</span></div></CardSection>
          <CardSection title="Working pattern"><WeekdayPicker value={[1, 2, 3, 4, 5]} onChange={noop} /></CardSection>
          <CardSection title="Notes"><p class="soft">Prefers not to work bank holidays.</p></CardSection>
        </Card>
        <Card tone="plum" title="Plum" subtitle="Sick leave and other absence"><p class="soft">Nothing to do here.</p></Card>
      </div>
    </Section>
  );
}

function FormsSection() {
  const [form, setForm] = useState({
    firstName: '', lastName: 'Sharma', team: '', role: 'Senior carer', start: '2025-03-03', end: '', entitlement: 28, days: [1, 2, 3, 4, 5], colour: '#F58F5B',
    notes: '', phone: '07700 900123', proRata: true, bankHols: false, status: 'approved', halfDay: 'am', search: 'Pri', year: '2026', big: null,
  });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Section title="Forms" desc="Labels above, hints below, errors as sentences. Everything is 44px tall.">
      <Card title="Add carer" icon="user-plus">
        <div class="form-grid">
          <Field label="First name" required error="Please enter their first name.">
            <TextField value={form.firstName} onChange={set('firstName')} placeholder="e.g. Priya" />
          </Field>
          <Field label="Last name" required hint="As it appears on their contract.">
            <TextField value={form.lastName} onChange={set('lastName')} />
          </Field>
          <Field label="Team" hint="You can change this later.">
            <SelectField value={form.team} onChange={set('team')} placeholder="Choose a team…" options={TEAMS.map((t) => ({ value: t.id, label: t.name }))} />
          </Field>
          <Field label="Role">
            <SelectField value={form.role} onChange={set('role')} options={[{ group: 'Care', options: [{ value: 'Carer', label: 'Carer' }, { value: 'Senior carer', label: 'Senior carer' }] }, { group: 'Office', options: [{ value: 'Care coordinator', label: 'Care coordinator' }, { value: 'Team leader', label: 'Team leader' }, { value: 'Office', label: 'Office', disabled: true }] }]} />
          </Field>
          <Field label="Start date" hint="Used to work out a fair share of holiday for the first year.">
            <DateField value={form.start} onChange={set('start')} max={TODAY} />
          </Field>
          <Field label="End date" error="The end date can’t be before the start date.">
            <DateField value={form.end} onChange={set('end')} min={form.start} />
          </Field>
          <Field label="Holiday entitlement" hint="Per full holiday year, before any adjustments.">
            <NumberField value={form.entitlement} onChange={set('entitlement')} min={0} max={60} step={0.5} suffix="days" />
          </Field>
          <Field label="Adjustment" hint="Empty means none.">
            <NumberField value={form.big} onChange={set('big')} min={-10} max={10} step={0.5} placeholder="0" />
          </Field>
          <Field label="Working days" hint="Tap the days they usually work." class="span-2">
            <WeekdayPicker value={form.days} onChange={set('days')} />
          </Field>
          <Field label="Colour" hint="Shown on the calendar and next to their name." class="span-2">
            <ColourPicker value={form.colour} onChange={set('colour')} />
          </Field>
          <Field label="Notes" class="span-2">
            <TextArea value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering…" />
          </Field>
          <Field label="Phone" inline>
            <TextField type="tel" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Holiday year" inline>
            <YearPicker value={form.year} onChange={set('year')} settings={SETTINGS} today={TODAY} extraDates={['2023-06-01']} />
          </Field>
          <Field label="Disabled field" hint="Can’t be changed here.">
            <TextField value="Read only" disabled />
          </Field>
          <Field label="Search">
            <SearchBox value={form.search} onChange={set('search')} placeholder="Search carers…" />
          </Field>
          <Field label="Status" class="span-2">
            <RadioCards value={form.status} onChange={set('status')} options={[
              { value: 'approved', label: 'Approved', description: 'Counts towards their entitlement straight away.', icon: 'check-circle' },
              { value: 'pending', label: 'Awaiting approval', description: 'Shown on the calendar with a question mark until you decide.', icon: 'clock' },
            ]} />
          </Field>
          <Field label="Half day" class="span-2">
            <RadioCards columns={3} value={form.halfDay} onChange={set('halfDay')} options={[
              { value: null, label: 'Whole day' },
              { value: 'am', label: 'Morning only' },
              { value: 'pm', label: 'Afternoon only' },
            ]} />
          </Field>
          <div class="stack-sm">
            <Toggle checked={form.proRata} onChange={set('proRata')} label="Work out a fair share for starters and leavers" description="Someone starting half way through the year gets half the days." />
            <Toggle checked={form.bankHols} onChange={set('bankHols')} label="Bank holidays are days off" />
            <Toggle checked disabled label="Disabled toggle" />
          </div>
          <div class="stack-sm">
            <Checkbox checked label="Send a reminder to back up every week" onChange={noop} />
            <Checkbox label="Include archived carers" onChange={noop} />
            <Checkbox indeterminate label="Some of the Day team" onChange={noop} />
            <Checkbox checked disabled label="Can’t change this" onChange={noop} />
          </div>
        </div>
        <div class="form-actions">
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary" icon="check">Add carer</Button>
        </div>
      </Card>
    </Section>
  );
}

function MultiSelectSection() {
  const [openValue, setOpenValue] = useState(['c1', 'c2', 'c4', 'c7']);
  const [closedValue, setClosedValue] = useState(['c3', 'c5']);
  const [plain, setPlain] = useState([]);
  return (
    <Section title="MultiSelect" desc="Picking carers. Open with groups, closed with chips, a plain list, and disabled.">
      <div class="grid grid-2">
        <div style="min-height: 420px">
          <Field label="Carers (open)" hint="Grouped by team. Tick a whole team at once.">
            <MultiSelect id="ms-open" options={CARER_OPTIONS} value={openValue} onChange={setOpenValue} defaultOpen />
          </Field>
        </div>
        <div class="stack">
          <Field label="Carers (closed)">
            <MultiSelect id="ms-closed" options={CARER_OPTIONS} value={closedValue} onChange={setClosedValue} maxChips={2} />
          </Field>
          <Field label="Nothing chosen yet">
            <MultiSelect options={CARER_OPTIONS} value={[]} onChange={noop} placeholder="Choose carers…" />
          </Field>
          <Field label="Leave types (no groups, no search)">
            <MultiSelect options={[{ value: 'a', label: 'Annual leave', colour: '#F58F5B' }, { value: 's', label: 'Sick leave', colour: '#9B7BBF' }, { value: 't', label: 'Training', colour: '#6FA8DC' }]} value={plain} onChange={setPlain} itemNoun="leave type" searchable={false} />
          </Field>
          <Field label="Disabled">
            <MultiSelect options={CARER_OPTIONS} value={['c1']} onChange={noop} disabled />
          </Field>
        </div>
      </div>
    </Section>
  );
}

function TabsSection() {
  const [tab, setTab] = useState('add');
  const [tab2, setTab2] = useState('month');
  const [page, setPage] = useState(3);
  const [banner, setBanner] = useState(true);
  const TABS = [{ id: 'add', label: 'Add holidays', icon: 'calendar-plus' }, { id: 'remove', label: 'Remove holidays', icon: 'calendar-x' }, { id: 'all', label: 'All holidays', icon: 'list', count: 132 }];
  return (
    <Section title="Tabs, pagination, collapsible, banners, help tips">
      <div class="g-label">Segmented tabs</div>
      <Tabs id="hol" tabs={TABS} value={tab} onChange={setTab} />
      <TabPanel tabsId="hol" id={tab}><p class="soft">Showing the “{TABS.find((t) => t.id === tab).label}” tab.</p></TabPanel>
      <div class="g-label">Underline tabs</div>
      <Tabs variant="underline" tabs={[{ id: 'month', label: 'Month', icon: 'calendar' }, { id: 'year', label: 'Year overview', icon: 'grid' }, { id: 'week', label: 'This week', icon: 'list', count: 4 }]} value={tab2} onChange={setTab2} />
      <div class="g-label">Pagination</div>
      <div class="g-col">
        <Pagination page={page} pageSize={25} total={132} onPageChange={setPage} />
        <Pagination page={1} pageSize={25} total={8} />
        <Pagination page={1} pageSize={25} total={0} noun="holidays" />
      </div>
      <div class="g-label">Collapsible</div>
      <div class="g-col">
        <Collapsible title="Advanced" summary="For IT people" icon="settings" open>
          <p class="soft">Your data lives in this browser on this computer. Nothing is sent anywhere.</p>
          <Button variant="secondary" icon="upload" size="sm">Import carers from a spreadsheet</Button>
        </Collapsible>
        <Collapsible title="Entitlement breakdown" summary="28 days">
          <p>Hidden until opened.</p>
        </Collapsible>
      </div>
      <div class="g-label">Banners</div>
      <div class="g-col">
        {banner ? <Banner tone="info" title="Nothing leaves this computer" onDismiss={() => setBanner(false)}>Everything is saved in this browser. Save a backup file now and again to be safe.</Banner> : <Button variant="link" onClick={() => setBanner(true)}>Show the info banner again</Button>}
        <Banner tone="warning" title="It’s been 9 days since your last backup" action={{ label: 'Back up now', onClick: noop, icon: 'download' }}>Backups take a second and keep everything safe.</Banner>
        <Banner tone="danger" title="3 people in Day team would be off on Wed 4 Mar" action={{ label: 'See the calendar', onClick: noop }} onDismiss={noop}>The limit for Day team is 2 at a time.</Banner>
        <Banner tone="success">4 holidays added for Priya, Sam, Morag and Fiona.</Banner>
      </div>
      <div class="g-label">Help tips</div>
      <div class="g-row" style="padding-top: 70px">
        <span>Pro-rata entitlement<HelpTip text="Someone who starts or leaves part way through the holiday year gets a fair share of the days, worked out from how much of the year they were employed." defaultOpen /></span>
        <span style="margin-left: 200px">Carry-over<HelpTip text="Days left at the end of the year that you have agreed can be used next year." /></span>
      </div>
    </Section>
  );
}

function ProgressSection() {
  return (
    <Section title="Progress bars, rings and empty states">
      <div class="grid grid-2">
        <Card title="Entitlement this year" subtitle="Priya Sharma · 28 days">
          <ProgressBar total={28} showLegend segments={[
            { value: 12, colour: 'var(--peach-500)', label: 'Taken' },
            { value: 6.5, colour: 'var(--sky)', label: 'Booked' },
            { value: 2, colour: 'var(--amber)', label: 'Awaiting approval' },
            { value: 7.5, colour: 'var(--sage-soft)', label: 'Remaining' },
          ]} />
          <div class="g-label">Over the limit (clamped)</div>
          <ProgressBar total={20} height={8} segments={[{ value: 18, colour: 'var(--peach-500)', label: 'Taken' }, { value: 6, colour: 'var(--rose)', label: 'Booked' }]} />
          <div class="g-label">Thin, single segment</div>
          <ProgressBar total={28} height={6} segments={[{ value: 9, label: 'Taken' }]} />
        </Card>
        <Card title="Rings">
          <div class="g-row">
            <ProgressRing value={9.5} total={28} sublabel="left" />
            <ProgressRing value={20} total={28} size={96} stroke={10} colour="var(--sage)" label="20" sublabel="taken" />
            <ProgressRing value={28} total={28} size={56} stroke={6} colour="var(--rose)" />
            <ProgressRing value={0} total={28} size={56} stroke={6} />
            <ProgressRing value={3} total={5} size={120} stroke={12} colour="var(--sky)" label="3 of 5" sublabel="Day team off" />
          </div>
        </Card>
      </div>
      <div class="grid grid-2 mt">
        <Card padded={false}>
          <EmptyState icon="calendar" title="No holidays yet" message="When you add a holiday it will show up here, on the calendar and in reports." action={{ label: 'Add a holiday', onClick: noop, icon: 'plus' }} />
        </Card>
        <Card padded={false}>
          <EmptyState compact icon="search" title="No carers match “Zed”" message="Try a shorter name or clear the filters." action={{ label: 'Clear search', onClick: noop }} />
        </Card>
      </div>
    </Section>
  );
}

function TableSection() {
  const [selected, setSelected] = useState(new Set(['h2', 'h5', 'h9']));
  const [sort, setSort] = useState({ key: 'start', dir: 'asc' });
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const rows = HOLIDAYS.slice((page - 1) * pageSize, page * pageSize);
  const columns = [
    { key: 'carer', label: 'Carer', sortable: true, sortValue: (r) => r.carer.name, render: (r) => <span class="row nowrap"><Avatar name={r.carer.name} colour={r.carer.colour} size={30} /><span>{r.carer.name}</span></span> },
    { key: 'team', label: 'Team', hideOnMobile: true, render: (r) => <Badge size="sm" tone={r.carer.team.id === 't1' ? 'peach' : r.carer.team.id === 't2' ? 'sky' : 'sage'}>{r.carer.team.name}</Badge> },
    { key: 'start', label: 'Dates', sortable: true, render: (r) => formatRange(r.start, r.end) },
    { key: 'days', label: 'Days', align: 'right', sortable: true, width: '80px' },
    { key: 'type', label: 'Type', hideOnMobile: true },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} size="sm" /> },
    { key: 'actions', label: '', align: 'right', width: '96px', render: (r) => <span class="table-cell-actions"><IconButton icon="edit" label={`Edit ${r.carer.name}'s holiday`} size="sm" onClick={() => toast(`Editing ${r.carer.name}`)} /><IconButton icon="trash" label="Remove" size="sm" variant="danger" onClick={() => toast.error('Removed (not really)')} /></span> },
  ];
  return (
    <Section title="Table" desc="Sortable, selectable, clickable rows. Below 700px each row becomes a card.">
      <Card padded={false} title="All holidays" subtitle={`${selected.size} selected`} icon="list" actions={<><Button size="sm" variant="danger" icon="trash" disabled={selected.size === 0}>Remove selected</Button><Button size="sm" icon="download">Export</Button></>}>
        <Table
          columns={columns}
          rows={rows}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(r) => toast.info(`Opened ${r.carer.name}`)}
          stickyHeader
          caption="All holidays"
          rowClass={(r) => (r.status === 'declined' ? 'muted' : '')}
        />
        <div style="padding: 0 22px 12px"><Pagination page={page} pageSize={pageSize} total={HOLIDAYS.length} onPageChange={setPage} /></div>
      </Card>
      <div class="grid grid-2 mt">
        <Card padded={false} title="Dense, no selection">
          <Table dense columns={[{ key: 'name', label: 'Carer' }, { key: 'left', label: 'Days left', align: 'right' }]} rows={CARERS.slice(0, 5).map((c) => ({ id: c.id, name: c.name, left: c.entitlement - c.taken - c.booked }))} />
        </Card>
        <Card padded={false} title="Empty table">
          <Table columns={columns.slice(0, 4)} rows={[]} emptyState={<EmptyState compact icon="calendar-x" title="No holidays match" message="Try widening the date range." />} />
        </Card>
      </div>
    </Section>
  );
}

function OverlaysSection() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  useEffect(() => {
    toast.success('Holiday added for Priya Sharma', { duration: 0 });
    toast.error('That backup file couldn’t be read. Please choose a file saved by this app.', { duration: 0 });
    toast.info('Removed 3 holidays', { duration: 0, action: { label: 'Undo', onClick: noop } });
    toast.warn('Only 2.5 days left – this would take Sam to −1.5', { duration: 0 });
    openModal(({ close }) => (
      <div class="stack">
        <Field label="Reason" hint="Shown in the carer’s history.">
          <TextField value="Carried over from last year" onChange={noop} />
        </Field>
        <Field label="Days">
          <NumberField value={2.5} onChange={noop} min={-20} max={20} step={0.5} suffix="days" />
        </Field>
        <div class="modal-actions">
          <Button variant="ghost" onClick={() => close()}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={() => close(true)}>Adjust entitlement</Button>
        </div>
      </div>
    ), { title: 'Adjust entitlement', size: 'sm' });
  }, []);
  return (
    <Section title="Drawer, modal, toasts and loading" desc="Overlays are rendered inside dashed boxes here; in the app they cover the whole window.">
      <div class="grid grid-2">
        <div class="g-stage" style="height: 520px">
          {drawerOpen ? null : <div class="empty-state"><Button variant="primary" onClick={() => setDrawerOpen(true)}>Open the drawer</Button></div>}
          <Drawer open={drawerOpen} title="Wed 4 Mar 2026" onClose={() => setDrawerOpen(false)} footer={<><Button variant="ghost" onClick={() => setDrawerOpen(false)}>Close</Button><Button variant="primary" icon="calendar-plus">Add holiday on this day</Button></>}>
            <div class="stack">
              <Banner tone="warning">3 people in Day team are off – the limit is 2.</Banner>
              {CARERS.slice(0, 5).map((c) => (
                <span key={c.id} class="row-between">
                  <span class="row"><Avatar name={c.name} colour={c.colour} size={32} /><span><strong>{c.name}</strong><br /><span class="muted">{c.team.name}</span></span></span>
                  <StatusBadge status={c.pending ? 'pending' : 'approved'} size="sm" />
                </span>
              ))}
            </div>
          </Drawer>
        </div>
        <div class="g-stage" style="height: 520px"><ModalHost /></div>
      </div>
      <div class="grid grid-2 mt">
        <div class="g-stage" style="height: 320px"><ToastHost /></div>
        <div class="g-stage" style="height: 320px">
          <div class="loading-screen"><div class="brand-mark"><BrandMark /></div><p>Opening your holiday manager…</p></div>
        </div>
      </div>
      <div class="g-row mt">
        <Button variant="primary" onClick={() => openModal(({ close }) => <div class="stack"><p>A larger dialog with a title and close button.</p><div class="modal-actions"><Button variant="primary" onClick={() => close()}>Done</Button></div></div>, { title: 'Large dialog', size: 'lg' })}>Open a large dialog</Button>
        <Button onClick={() => toast('Saved')}>Fire a toast</Button>
      </div>
    </Section>
  );
}

function Gallery() {
  return (
    <div class="gallery">
      <header>
        <div class="row" style="margin-bottom: 10px"><div class="brand-mark"><BrandMark /></div><div><div class="brand-name">Monteith Holiday Manager</div><div class="brand-sub">Component gallery (development only)</div></div></div>
        <p class="soft">Every shared component in one place, at 1280px and 390px. Icons available: {Icon ? 'yes' : 'no'}.</p>
      </header>
      <ButtonsSection />
      <BadgesSection />
      <CardsSection />
      <FormsSection />
      <MultiSelectSection />
      <TabsSection />
      <ProgressSection />
      <TableSection />
      <OverlaysSection />
    </div>
  );
}

render(<Gallery />, document.getElementById('app'));
