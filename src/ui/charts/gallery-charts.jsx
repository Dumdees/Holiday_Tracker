// Dev-only chart gallery. Bundled by scripts/charts-shot.mjs into .playwright-out/charts.html
// so every chart can be checked by eye at desktop and phone widths. NOT part of the app –
// src/main.jsx never imports it.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { BarChart, DonutChart, Heatmap, LineChart, Sparkline, fmtDays } from './index.js';
import { MONTHS_SHORT, eachDay, isWeekend, formatShort } from '../../core/dates.js';

const TODAY = '2026-09-01';
const YEAR_START = '2026-04-01';
const YEAR_END = '2027-03-31';

/** Small deterministic random generator so screenshots never change between runs. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const half = (n) => Math.round(n * 2) / 2;

const NAMES = ['Priya Sharma', 'Sam Okafor', 'Morag McLeod', 'Fiona Grant', 'Callum Reid', 'Aisha Khan', 'Dominika Nowak', 'Ewan Fraser', 'Grace Adeyemi', 'Hamish Boyd', 'Isla Munro', 'Jakub Wozniak', 'Kirsty Doyle', 'Liam Murphy', 'Nadia Hussain', 'Oliver Chen', 'Rosie Campbell', 'Tomasz Kowalski', 'Una Gallagher', 'Vikram Patel'];
const TEAMS = ['Day team', 'Night team', 'Weekend team'];
const MONTH_LABELS = [...MONTHS_SHORT.slice(3), ...MONTHS_SHORT.slice(0, 3)]; // Apr … Mar

const USAGE_SERIES = [
  { key: 'taken', label: 'Taken', colour: '#F7915E' },
  { key: 'booked', label: 'Booked', colour: '#5F9BD1' },
  { key: 'pending', label: 'Awaiting approval', colour: '#E39A2E' },
  { key: 'remaining', label: 'Remaining', colour: '#FFDFCB' },
];

const TYPE_SERIES = [
  { key: 'annual', label: 'Annual leave', colour: '#F58F5B' },
  { key: 'sick', label: 'Sick leave', colour: '#9B7BBF' },
  { key: 'training', label: 'Training', colour: '#6FA8DC' },
  { key: 'compassionate', label: 'Compassionate leave', colour: '#4FB3A9' },
];

const YEAR_SERIES = [
  { key: 'last', label: '2025/26', colour: '#FFC8A8' },
  { key: 'this', label: '2026/27', colour: '#F7915E' },
];

const LINE_SERIES = [
  { key: 'day', label: 'Day team', colour: '#F7915E' },
  { key: 'night', label: 'Night team', colour: '#5F9BD1' },
];

const DONUT = [
  { label: 'Annual leave', value: 212, colour: '#F58F5B' },
  { label: 'Sick leave', value: 48.5, colour: '#9B7BBF' },
  { label: 'Training', value: 22, colour: '#6FA8DC' },
  { label: 'Time off in lieu', value: 14, colour: '#8FA83A' },
  { label: 'Compassionate leave', value: 9, colour: '#4FB3A9' },
];

const BANK_HOLIDAYS = ['2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-03', '2026-11-30', '2026-12-25', '2026-12-28', '2027-01-01', '2027-01-04'];

function usageData(count) {
  const rnd = seeded(7);
  return NAMES.slice(0, count).map((name, i) => {
    const entitlement = i === 3 || i === 12 ? 30 : i === 9 ? 16.5 : 28;
    const taken = half(rnd() * entitlement * 0.6);
    const booked = half(rnd() * 8);
    const pending = rnd() < 0.3 ? half(1 + rnd() * 4) : 0;
    const remaining = Math.max(0, entitlement - taken - booked - pending);
    return { label: name, sub: TEAMS[i % 3], values: { taken, booked, pending, remaining }, meta: { id: `c${i}`, entitlement } };
  });
}

function monthlyData() {
  const rnd = seeded(11);
  return MONTH_LABELS.map((label, i) => {
    const summer = i >= 3 && i <= 5 ? 1.6 : i === 8 ? 1.4 : 1;
    return {
      label,
      values: {
        annual: half(12 + rnd() * 22 * summer),
        sick: half(rnd() * 9 + (i >= 7 && i <= 10 ? 4 : 0)),
        training: half(rnd() * 5),
        compassionate: rnd() < 0.4 ? half(rnd() * 3) : 0,
      },
    };
  });
}

function yearOnYearData() {
  const rnd = seeded(31);
  return MONTH_LABELS.map((label, i) => {
    const summer = i >= 3 && i <= 5 ? 1.5 : 1;
    return { label, values: { last: half(10 + rnd() * 18 * summer), this: half(12 + rnd() * 20 * summer) } };
  });
}

function takenPerCarer() {
  const rnd = seeded(17);
  return NAMES.map((name) => ({ label: name, values: { taken: half(2 + rnd() * 20) } }));
}

function heatValues() {
  const rnd = seeded(23);
  const values = new Map();
  const dim = new Set(BANK_HOLIDAYS);
  for (const iso of eachDay(YEAR_START, YEAR_END)) {
    if (isWeekend(iso)) { dim.add(iso); continue; }
    const m = Number(iso.slice(5, 7));
    const busy = (m >= 6 && m <= 8) || m === 12 ? 0.65 : 0.38;
    if (rnd() < busy) values.set(iso, 1 + Math.floor(rnd() * (busy > 0.5 ? 5 : 3)));
  }
  return { values, dim };
}

function lineData() {
  const rnd = seeded(5);
  return MONTH_LABELS.map((label, i) => {
    const winter = i >= 7 && i <= 10 ? 5 : 0;
    return { label, values: { day: half(2 + rnd() * 6 + winter), night: half(1 + rnd() * 4 + winter * 0.6) } };
  });
}

const USAGE = usageData(14);
const MONTHLY = monthlyData();
const YEAR_ON_YEAR = yearOnYearData();
const TAKEN = takenPerCarer();
const HEAT = heatValues();
const LINE = lineData();
const SPARKS = [
  { label: 'Off this week', value: '4', values: [2, 3, 1, 4, 3, 5, 4, 6, 4] },
  { label: 'Awaiting approval', value: '3', values: [6, 5, 5, 4, 2, 3, 2, 3], colour: '#E39A2E' },
  { label: 'Sick days this month', value: '7.5', values: [3, 2, 4, 6, 5, 8, 7.5], colour: '#9576B8' },
];

function ChartCard({ title, sub, full = false, shot, children }) {
  return (
    <div class={`card ${full ? 'cg-full' : ''}`.trim()} data-shot={shot}>
      <div class="card-head">
        <div class="card-head-text">
          <h3 class="card-title">{title}</h3>
          {sub ? <p class="card-subtitle">{sub}</p> : null}
        </div>
      </div>
      <div class="card-body">{children}</div>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <section class="g-section">
      <h2>{title}</h2>
      {desc ? <p class="g-desc">{desc}</p> : null}
      <div class="cg-grid">{children}</div>
    </section>
  );
}

function UsageCard() {
  const [chosen, setChosen] = useState(null);
  return (
    <ChartCard title="Entitlement usage per carer" sub={`Holiday year 2026/27 · ${chosen ? `You chose ${chosen.label} (${chosen.sub})` : 'Click a bar to open the carer'}`} full shot="usage">
      <BarChart
        horizontal
        series={USAGE_SERIES}
        data={USAGE}
        referenceLine={{ value: 28, label: 'Full entitlement' }}
        onBarClick={(item) => setChosen(item)}
        ariaLabel="Entitlement usage per carer for 2026/27"
      />
    </ChartCard>
  );
}

function HeatCard() {
  const [picked, setPicked] = useState(null);
  return (
    <ChartCard title="Team capacity" sub={picked ? `You chose ${formatShort(picked)}` : 'How many carers are off each day · click a day to see who'} full shot="heatmap">
      <Heatmap
        start={YEAR_START}
        end={YEAR_END}
        values={HEAT.values}
        max={5}
        dimDays={HEAT.dim}
        today={TODAY}
        onDayClick={setPicked}
        tooltip={(iso, v) => `${formatShort(iso)} · ${v === 1 ? '1 carer off' : `${v} carers off`}`}
      />
    </ChartCard>
  );
}

function Gallery() {
  return (
    <div class="gallery">
      <header>
        <h1>Chart gallery</h1>
        <p class="soft">Every chart in the Monteith Holiday Manager, with realistic data, at 1280px and 390px. Development only.</p>
      </header>

      <Section title="Reports" desc="The charts on the Reports screen: usage per carer, leave by month, leave by type, capacity, sickness.">
        <UsageCard />
        <ChartCard title="Leave by month" sub="Days of leave in 2026/27, by type" shot="monthly">
          <BarChart series={TYPE_SERIES} data={MONTHLY} showValues height={280} />
        </ChartCard>
        <ChartCard title="Leave by type" sub="Days in 2026/27" shot="donut">
          <DonutChart segments={DONUT} centreSub="days" />
        </ChartCard>
        <HeatCard />
        <ChartCard title="Sickness by month" sub="Sick days per team in 2026/27" full shot="line">
          <LineChart series={LINE_SERIES} data={LINE} />
        </ChartCard>
      </Section>

      <Section title="Small stats" desc="Sparklines sit inside stat tiles on the Home screen.">
        <div class="cg-full cg-tiles">
          {SPARKS.map((s) => (
            <div class="card cg-tile" key={s.label}>
              <div class="cg-tile-text">
                <div class="cg-tile-value">{s.value}</div>
                <div class="cg-tile-label">{s.label}</div>
              </div>
              <Sparkline values={s.values} colour={s.colour} />
            </div>
          ))}
          <div class="card cg-tile">
            <div class="cg-tile-text">
              <div class="cg-tile-value">0</div>
              <div class="cg-tile-label">No history yet</div>
            </div>
            <Sparkline values={[]} />
          </div>
        </div>
      </Section>

      <Section title="More bar shapes" desc="Crowded labels rotate and skip; grouped bars sit side by side; long names truncate with the full name on hover.">
        <ChartCard title="Days taken per carer" sub="Twenty carers – labels rotate to fit" full shot="crowded">
          <BarChart series={[{ key: 'taken', label: 'Taken', colour: '#F7915E' }]} data={TAKEN} height={300} />
        </ChartCard>
        <ChartCard title="This year against last year" sub="Days of leave per month, side by side" shot="grouped">
          <BarChart series={YEAR_SERIES} data={YEAR_ON_YEAR} stacked={false} height={260} />
        </ChartCard>
        <ChartCard title="Top five by days remaining" sub="Values at the tip, one carer highlighted" shot="top5">
          <BarChart
            horizontal
            showValues
            highlightIndex={1}
            series={[{ key: 'remaining', label: 'Remaining', colour: '#F7915E' }]}
            data={[
              { label: 'Dominika Nowak-Wiśniewska', values: { remaining: 21.5 } },
              { label: 'Grace Adeyemi', values: { remaining: 19 } },
              { label: 'Hamish Boyd', values: { remaining: 16.5 } },
              { label: 'Tomasz Kowalski', values: { remaining: 14 } },
              { label: 'Isla Munro', values: { remaining: 12.5 } },
            ]}
            maxValue={28}
          />
        </ChartCard>
        <ChartCard title="Day-of-week pattern" sub="Which weekdays leave falls on" shot="dow">
          <BarChart
            series={[{ key: 'days', label: 'Days', colour: '#F7915E' }]}
            data={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, values: { days: [64, 41, 38, 45, 82, 6, 4][i] } }))}
            showValues
            height={220}
          />
        </ChartCard>
        <ChartCard title="Half days only" sub="Small values still get a sensible axis" shot="small">
          <BarChart series={[{ key: 'd', label: 'Days', colour: '#F7915E' }]} data={[{ label: 'Priya', values: { d: 0.5 } }, { label: 'Sam', values: { d: 1.5 } }, { label: 'Morag', values: { d: 1 } }]} height={200} showValues />
        </ChartCard>
      </Section>

      <Section title="Empty states" desc="Every chart says something friendly when there is nothing to draw.">
        <ChartCard title="Entitlement usage per carer" sub="No carers yet">
          <BarChart horizontal series={USAGE_SERIES} data={[]} emptyText="Add a carer to see their holidays here" />
        </ChartCard>
        <ChartCard title="Leave by type" sub="No holidays yet">
          <DonutChart segments={DONUT.map((s) => ({ ...s, value: 0 }))} centreSub="days" emptyText="No holidays in this year yet" />
        </ChartCard>
        <ChartCard title="Sickness by month" sub="No data">
          <LineChart series={LINE_SERIES} data={[]} emptyText="No sick days recorded yet" />
        </ChartCard>
        <ChartCard title="Leave by month" sub="All zeros">
          <BarChart series={TYPE_SERIES} data={MONTH_LABELS.map((label) => ({ label, values: {} }))} />
        </ChartCard>
        <ChartCard title="Team capacity" sub="A quiet quarter – nobody off" full>
          <Heatmap start="2026-04-01" end="2026-06-30" values={new Map()} dimDays={HEAT.dim} today={TODAY} />
        </ChartCard>
      </Section>

      <p class="soft">Formatting check: {[12, 12.5, 0.5, -1.5, 12.0, 1234.25].map(fmtDays).join(' · ')}</p>
    </div>
  );
}

render(<Gallery />, document.getElementById('app'));
