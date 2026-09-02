// First-run welcome: three friendly steps, then start fresh or explore with sample data.
import { useState } from 'preact/hooks';
import { BrandMark, Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';
import { Field, TextField, NumberField, SelectField, RadioCards } from '../components/Field.jsx';
import { Chip } from '../components/Badge.jsx';
import { toast } from '../components/Toast.jsx';
import { settings, teams, updateSettings, setTeams, replaceDb } from '../../store/store.js';
import { BANK_HOLIDAY_REGIONS } from '../../store/defaults.js';
import { sampleDb } from '../../store/sample.js';
import { MONTHS, daysInMonth } from '../../core/dates.js';
import { today } from '../shared/today.js';

const YEAR_START_OPTIONS = [
  { value: '1-1', label: '1 January', description: 'Runs with the calendar year.', icon: 'calendar' },
  { value: '4-1', label: '1 April', description: 'The most common choice in the UK.', icon: 'sun' },
  { value: 'other', label: 'Another date', description: 'Pick any month and day.', icon: 'sliders' },
];

export function Onboarding() {
  const s = settings.value;
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState(s.companyName || 'Monteith Personal Care');
  const [startChoice, setStartChoice] = useState(s.holidayYearStart.month === 1 && s.holidayYearStart.day === 1 ? '1-1' : s.holidayYearStart.month === 4 && s.holidayYearStart.day === 1 ? '4-1' : 'other');
  const [month, setMonth] = useState(s.holidayYearStart.month);
  const [day, setDay] = useState(s.holidayYearStart.day);
  const [region, setRegion] = useState(s.bankHolidayRegion || 'scotland');
  const [teamNames, setTeamNames] = useState(teams.value.map((t) => t.name));
  const [newTeam, setNewTeam] = useState('');
  const [entitlement, setEntitlement] = useState(s.defaultEntitlementDays);
  const [busy, setBusy] = useState(false);

  const yearStart = startChoice === '1-1' ? { month: 1, day: 1 } : startChoice === '4-1' ? { month: 4, day: 1 } : { month, day: Math.min(day, daysInMonth(2026, month)) };

  function addTeam() {
    const name = newTeam.trim();
    if (!name) return;
    if (!teamNames.some((t) => t.toLowerCase() === name.toLowerCase())) setTeamNames([...teamNames, name]);
    setNewTeam('');
  }

  function applySettings() {
    updateSettings({ companyName: company.trim() || 'Monteith Personal Care', holidayYearStart: yearStart, bankHolidayRegion: region, defaultEntitlementDays: Number(entitlement) || 28 }, 'Welcome settings saved');
    setTeams(teamNames);
  }

  function finishFresh() {
    setBusy(true);
    applySettings();
    updateSettings({ onboardingComplete: true }, 'Welcome complete');
    toast(`Welcome! Start by adding your carers.`);
  }

  function finishSample() {
    setBusy(true);
    const doc = sampleDb({ today: today.value, settings: { companyName: company.trim() || 'Monteith Personal Care', defaultEntitlementDays: Number(entitlement) || 28 } });
    replaceDb(doc, 'Loaded sample data');
    toast('Sample data loaded – have a look around. Clear it from Settings › Advanced when you’re ready.', { duration: 8000 });
  }

  const steps = ['Welcome', 'Holiday year', 'Teams', 'Ready'];

  return (
    <div class="onboarding">
      <div class="onboarding-card">
        <div class="onboarding-brand">
          <div class="brand-mark"><BrandMark /></div>
          <div>
            <div class="brand-name">{company || 'Monteith Personal Care'}</div>
            <div class="brand-sub">Holiday Manager</div>
          </div>
        </div>
        <ol class="onboarding-steps" aria-label="Setup progress">
          {steps.map((label, i) => (
            <li key={label} class={i === step ? 'current' : i < step ? 'done' : ''}>
              <span class="step-dot">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
              <span class="step-label">{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div class="onboarding-body stack">
            <h1>Welcome to your holiday manager</h1>
            <p class="soft">Keep track of every carer’s holidays, spot clashes before they happen, and see who’s off at a glance. Everything stays on this computer – nothing is sent anywhere.</p>
            <Field label="Your organisation’s name" hint="Shown at the top of every screen.">
              <TextField value={company} onChange={setCompany} autoFocus onEnter={() => setStep(1)} />
            </Field>
            <div class="onboarding-actions">
              <Button variant="link" onClick={finishFresh} disabled={busy}>Skip setup for now</Button>
              <span class="spacer" />
              <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => setStep(1)}>Let’s get set up</Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div class="onboarding-body stack">
            <h1>Your holiday year</h1>
            <p class="soft">Holiday entitlement is measured over a 12-month “holiday year”. When does yours start?</p>
            <RadioCards options={YEAR_START_OPTIONS} value={startChoice} onChange={setStartChoice} columns={3} />
            {startChoice === 'other' ? (
              <div class="grid grid-2">
                <Field label="Month">
                  <SelectField options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} value={month} onChange={(v) => setMonth(Number(v))} />
                </Field>
                <Field label="Day">
                  <SelectField options={Array.from({ length: daysInMonth(2026, month) }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} value={Math.min(day, daysInMonth(2026, month))} onChange={(v) => setDay(Number(v))} />
                </Field>
              </div>
            ) : null}
            <Field label="Which bank holidays apply?" hint="We’ll show them on the calendar. You can add your own closure days later.">
              <RadioCards options={BANK_HOLIDAY_REGIONS.map((r) => ({ value: r.id, label: r.label }))} value={region} onChange={setRegion} columns={2} />
            </Field>
            <div class="onboarding-actions">
              <Button variant="ghost" icon="arrow-left" onClick={() => setStep(0)}>Back</Button>
              <span class="spacer" />
              <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => setStep(2)}>Next</Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div class="onboarding-body stack">
            <h1>Your teams</h1>
            <p class="soft">Teams help you see cover at a glance and get a warning when too many people from one team are off together. Add as many as you like – you can change them any time.</p>
            <div class="row">
              {teamNames.map((t) => <Chip key={t} label={t} onRemove={() => setTeamNames(teamNames.filter((x) => x !== t))} />)}
              {!teamNames.length ? <span class="muted">No teams yet – that’s fine too.</span> : null}
            </div>
            <div class="row onboarding-add-team">
              <TextField value={newTeam} onChange={setNewTeam} placeholder="e.g. Day team" onEnter={addTeam} />
              <Button icon="plus" onClick={addTeam}>Add team</Button>
            </div>
            <Field label="How many days’ holiday do most carers get a year?" hint="You can set a different number for each carer.">
              <NumberField value={entitlement} onChange={setEntitlement} min={0} max={365} step={0.5} suffix="days" />
            </Field>
            <div class="onboarding-actions">
              <Button variant="ghost" icon="arrow-left" onClick={() => setStep(1)}>Back</Button>
              <span class="spacer" />
              <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div class="onboarding-body stack">
            <h1>You’re all set</h1>
            <p class="soft">How would you like to begin?</p>
            <div class="grid grid-2 onboarding-choices">
              <button type="button" class="choice-card" onClick={finishFresh} disabled={busy} data-choice="fresh">
                <div class="choice-icon"><Icon name="user-plus" size={28} /></div>
                <h3>Start fresh</h3>
                <p class="soft">Begin with an empty app and add your carers.</p>
              </button>
              <button type="button" class="choice-card" onClick={finishSample} disabled={busy} data-choice="sample">
                <div class="choice-icon"><Icon name="sparkle" size={28} /></div>
                <h3>Explore with sample data</h3>
                <p class="soft">See how everything works with made-up carers and holidays. Uses a 1 April holiday year and Scottish bank holidays. Clear it later from Settings › Advanced.</p>
              </button>
            </div>
            <div class="onboarding-actions">
              <Button variant="ghost" icon="arrow-left" onClick={() => setStep(2)}>Back</Button>
            </div>
          </div>
        ) : null}
      </div>
      <p class="onboarding-foot muted">Made for Monteith Personal Care · Your information stays on this computer</p>
    </div>
  );
}
