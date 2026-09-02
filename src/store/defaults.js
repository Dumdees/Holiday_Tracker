// The shape of everything we save. ONE document, saved as a whole.
// Bump SCHEMA_VERSION and add a step in migrate.js whenever the shape changes.
export const SCHEMA_VERSION = 1;

export const COMPANY_NAME = 'Monteith Personal Care';

// ISO weekday numbers: 1 = Monday … 7 = Sunday
export const WEEKDAYS = [
  { n: 1, short: 'Mon', long: 'Monday' },
  { n: 2, short: 'Tue', long: 'Tuesday' },
  { n: 3, short: 'Wed', long: 'Wednesday' },
  { n: 4, short: 'Thu', long: 'Thursday' },
  { n: 5, short: 'Fri', long: 'Friday' },
  { n: 6, short: 'Sat', long: 'Saturday' },
  { n: 7, short: 'Sun', long: 'Sunday' },
];

export const BANK_HOLIDAY_REGIONS = [
  { id: 'scotland', label: 'Scotland' },
  { id: 'england-and-wales', label: 'England & Wales' },
  { id: 'northern-ireland', label: 'Northern Ireland' },
  { id: 'none', label: 'Don’t use bank holidays' },
];

export const HOLIDAY_STATUSES = [
  { id: 'approved', label: 'Approved', colour: '#7BAF8E' },
  { id: 'pending', label: 'Awaiting approval', colour: '#E9A23B' },
  { id: 'declined', label: 'Declined', colour: '#9A857C' },
];

// A palette of friendly colours used for teams, leave types and carer avatars.
export const PALETTE = [
  '#F58F5B', '#7BAF8E', '#6FA8DC', '#9B7BBF', '#E9A23B', '#D97C9A',
  '#4FB3A9', '#C25A36', '#8FA83A', '#5C7CC4', '#B8860B', '#C46A8C',
];

export function defaultLeaveTypes() {
  return [
    { id: 'lt_annual', name: 'Annual leave', colour: '#F58F5B', deductsEntitlement: true, builtIn: true, archived: false },
    { id: 'lt_sick', name: 'Sick leave', colour: '#9B7BBF', deductsEntitlement: false, builtIn: true, archived: false },
    { id: 'lt_unpaid', name: 'Unpaid leave', colour: '#9A857C', deductsEntitlement: false, builtIn: true, archived: false },
    { id: 'lt_compassionate', name: 'Compassionate leave', colour: '#4FB3A9', deductsEntitlement: false, builtIn: true, archived: false },
    { id: 'lt_training', name: 'Training', colour: '#6FA8DC', deductsEntitlement: false, builtIn: true, archived: false },
    { id: 'lt_parental', name: 'Maternity / paternity', colour: '#D97C9A', deductsEntitlement: false, builtIn: true, archived: false },
    { id: 'lt_toil', name: 'Time off in lieu', colour: '#8FA83A', deductsEntitlement: false, builtIn: true, archived: false },
  ];
}

export function defaultTeams() {
  return [
    { id: 'team_day', name: 'Day team', colour: '#F58F5B', maxOffPerDay: null },
    { id: 'team_night', name: 'Night team', colour: '#6FA8DC', maxOffPerDay: null },
  ];
}

export function defaultSettings() {
  return {
    companyName: COMPANY_NAME,
    appName: 'Holiday Manager',
    // Holiday year starts on this day each year (month 1–12, day 1–31)
    holidayYearStart: { month: 4, day: 1 },
    bankHolidayRegion: 'scotland',
    // true = a bank holiday inside a booked holiday does NOT use up entitlement
    bankHolidaysAreDaysOff: true,
    defaultEntitlementDays: 28,
    defaultWorkingDays: [1, 2, 3, 4, 5],
    weekStartsOn: 1,
    // Staffing rule: warn when more than this many carers in a team are off on the same day
    defaultMaxOffPerDay: 2,
    proRataStartersAndLeavers: true,
    roundEntitlementTo: 0.5,
    backupReminderDays: 7,
    lastBackupAt: null,
    onboardingComplete: false,
    gameEnabled: true, // show the Care Empire game in the menu
    roles: ['Carer', 'Senior carer', 'Care coordinator', 'Team leader', 'Office'],
    unusedLeaveWarningDays: 5, // warn when a carer has this many (or more) days unused near year end
    unusedLeaveWarningWeeks: 12, // ... in the last N weeks of the holiday year
  };
}

export function createEmptyDb() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    settings: defaultSettings(),
    leaveTypes: defaultLeaveTypes(),
    teams: defaultTeams(),
    carers: [],
    holidays: [],
    bankHolidayOverrides: { added: [], removed: [] },
  };
}

/** A carer record. Fields with `?` may be empty. */
export function newCarerRecord(patch = {}, settings = defaultSettings()) {
  return {
    id: '',
    firstName: '',
    lastName: '',
    role: 'Carer',
    teamId: null,
    startDate: null,     // 'YYYY-MM-DD' | null
    endDate: null,       // 'YYYY-MM-DD' | null (leavers)
    workingDays: [...settings.defaultWorkingDays],
    entitlementDays: settings.defaultEntitlementDays,
    phone: '',
    email: '',
    notes: '',
    colour: null,
    active: true,
    mustNotBeOffWith: [], // carer ids who cannot be off at the same time
    adjustments: [],      // { id, yearKey, days, reason, createdAt }
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

/** A holiday (any kind of absence) record. */
export function newHolidayRecord(patch = {}) {
  return {
    id: '',
    carerId: '',
    start: '',           // 'YYYY-MM-DD'
    end: '',             // 'YYYY-MM-DD' (inclusive)
    typeId: 'lt_annual',
    status: 'approved',  // approved | pending | declined
    halfDay: null,       // null | 'am' | 'pm'  (only meaningful when start === end)
    notes: '',
    batchId: null,       // set when added in bulk, so a whole batch can be undone/removed together
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}
