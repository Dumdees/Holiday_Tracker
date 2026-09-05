// Everything Care Empire is made of: what you can take on, what you can buy, how far you can grow.
//
// The shape of the game: two sides that need each other. WORK is how much care is wanted (people on
// your books, packages, contracts). TEAM is how much care you can deliver (carers, key safes, cars,
// coordinators, offices). Visits come from both, so whichever side is behind is worth more to buy –
// and buying either side always helps. Every tenth of anything doubles it, so "three more carers to
// the ten" is a real pull. Nothing here may be bought without something changing on the street.
//
// House rules for the writing: warm, plain British English. The joke is the printer, the rota, the
// kettle or the weather – never the person being looked after and never the carer. No compliance
// content (checks, spot checks, supervisions, sickness) is ever attached to a real colleague's name.

/** Each purchase costs this much more than the last. */
export const COST_GROWTH = 1.15;

/** Owning this many of something doubles what each one does. "The tenth" and onwards. */
export const MILESTONES = [10, 25, 50, 75, 100, 140, 180, 230, 300, 400];

/** The two sides of the business. */
export const SIDES = {
  work: { id: 'work', name: 'Work', label: 'people to look after', emoji: '🏠', hint: 'How much care is wanted.' },
  team: { id: 'team', name: 'Team', label: 'people and kit', emoji: '👥', hint: 'How much care you can deliver.' },
};

/**
 * Things you can buy. `side` says which half of the business it feeds, `rate` is visits per second
 * each, `level` is the stage that unlocks it. Costs rise 15% each time you buy one.
 */
export const BUILDINGS = [
  { id: 'carer', side: 'team', name: 'Carer', plural: 'Carers', emoji: '👩‍⚕️', baseCost: 15, rate: 0.8, level: 0, blurb: 'A kind pair of hands, a lanyard and a good pair of shoes.' , visual: 'A carer walks out of the office and starts a round.'},
  { id: 'client', side: 'work', name: 'Someone to look after', plural: 'People you look after', emoji: '🏠', baseCost: 120, rate: 3.2, level: 0, blurb: 'A front door, a kettle and somebody pleased to see you.' , visual: 'Another front door on the street, with the light on.'},
  { id: 'keysafe', side: 'team', name: 'Key safe', plural: 'Key safes', emoji: '🔑', baseCost: 960, rate: 12.8, level: 0, blurb: 'No more waiting on the step. The little box by the door.' , visual: 'A little key box goes up beside a door.'},
  { id: 'package', side: 'work', name: 'Care package', plural: 'Care packages', emoji: '📋', baseCost: 7680, rate: 51.2, level: 0, blurb: 'Agreed hours, written down, four calls a day.' , visual: 'A care folder appears on the doorstep.'},
  { id: 'car', side: 'team', name: 'Care car', plural: 'Care cars', emoji: '🚗', baseCost: 61440, rate: 204.8, level: 1, blurb: 'Door to door in the rain, with a magnetic sign on the side.' , visual: 'A liveried car joins the road.'},
  { id: 'directpay', side: 'work', name: 'Direct payment', plural: 'Direct payments', emoji: '💷', baseCost: 491520, rate: 819.2, level: 1, blurb: 'They hold the budget and they choose you.' , visual: 'A signed form in the window, and a nicer front garden.'},
  { id: 'coordinator', side: 'team', name: 'Care coordinator', plural: 'Care coordinators', emoji: '🗂️', baseCost: 3.93216e6, rate: 3276.8, level: 2, blurb: 'Builds the rota, holds the on-call phone, knows everything.' , visual: 'Somebody at the office window with the whiteboard rota.'},
  { id: 'council', side: 'work', name: 'Council contract', plural: 'Council contracts', emoji: '🏛️', baseCost: 3.14573e7, rate: 13107.2, level: 2, blurb: 'On the approved list at last. Volume, and a lot of forms.' , visual: 'A council crest goes up on the office window.'},
  { id: 'supervisor', side: 'team', name: 'Field supervisor', plural: 'Field supervisors', emoji: '🦺', baseCost: 2.51658e8, rate: 52428.8, level: 3, blurb: 'Out on the patch, keeping the whole thing steady.' , visual: 'A supervisor in hi-vis walks the patch.'},
  { id: 'discharge', side: 'work', name: 'Hospital discharge team', plural: 'Hospital discharge teams', emoji: '🏥', baseCost: 2.01327e9, rate: 209715, level: 3, blurb: 'Home by teatime, with the heating on and the bed made.' , visual: 'An ambulance drops somebody home and waits while they settle.'},
  { id: 'office', side: 'team', name: 'Branch office', plural: 'Branch offices', emoji: '🏢', baseCost: 1.61061e10, rate: 838861, level: 4, blurb: 'A registered manager, a whiteboard and a decent kettle.' , visual: 'A branch office rises on the horizon.'},
  { id: 'framework', side: 'work', name: 'Framework place', plural: 'Framework places', emoji: '📜', baseCost: 1.28849e11, rate: 3.35544e6, level: 4, blurb: 'A named place on the county list. The work comes to you.' , visual: 'A county noticeboard on the horizon with your name on it.'},
  { id: 'academy', side: 'team', name: 'Training academy', plural: 'Training academies', emoji: '🎓', baseCost: 1.03079e12, rate: 1.34218e7, level: 5, blurb: 'Where good carers are made, one hoist at a time.' , visual: 'A training academy, lit up late.'},
  { id: 'chc', side: 'work', name: 'NHS-funded care', plural: 'NHS-funded packages', emoji: '🩺', baseCost: 8.24634e12, rate: 5.36871e7, level: 5, blurb: 'Continuing healthcare. The hardest work and the best rates.' , visual: 'NHS-blue trim around the doors you look after.'},
  { id: 'nurse', side: 'team', name: 'Nurse-led team', plural: 'Nurse-led teams', emoji: '🧑‍⚕️', baseCost: 6.59707e13, rate: 2.14748e8, level: 6, blurb: 'Clinical leads who can do the things nobody else can.' , visual: 'A nurse in blue joins the round.'},
  { id: 'group', side: 'work', name: 'Care group', plural: 'Care groups', emoji: '🏬', baseCost: 5.27766e14, rate: 8.58993e8, level: 6, blurb: 'Other agencies ask to join you, and you say yes.' , visual: 'Another agency’s office joins your skyline.'},
  { id: 'tech', side: 'team', name: 'Assistive tech team', plural: 'Assistive tech teams', emoji: '🤖', baseCost: 4.22212e15, rate: 3.43597e9, level: 7, blurb: 'Sensors, pendants and a kettle that tells you all is well.' , visual: 'Sensor lights blink gently above the doors.'},
  { id: 'world', side: 'work', name: 'Worldwide care', plural: 'Worldwide care networks', emoji: '🌐', baseCost: 3.3777e16, rate: 1.37439e10, level: 7, blurb: 'Every country, every doorstep, the same warm hello.' , visual: 'A globe turns slowly over the rooftops.'},
  { id: 'orbit', side: 'work', name: 'Orbit care station', plural: 'Orbit care stations', emoji: '🛰️', baseCost: 2.70216e17, rate: 5.49756e10, level: 8, blurb: 'Someone has to check the kettle up there too.' , visual: 'A care station crosses the sky.'},
  { id: 'starship', side: 'team', name: 'Care starship', plural: 'Care starships', emoji: '🚀', baseCost: 2.16173e18, rate: 2.19902e11, level: 9, blurb: 'Tea, dignity and a good chat, at any distance.' , visual: 'A starship lifts off from behind the houses.'},
];

/**
 * The ladder never ends. Past the starship, another rung appears at every stage, so there is always
 * something new that is worth buying and the late game never runs out of road.
 */
// These alternate: the odd ones are places with front doors (the work side), the even ones are
// people who do the visits (the team side). A name has to match the side it is on, or a thing with
// a little team symbol beside it is called a round.
const BEYOND_NAMES = ['Ring station', 'Orbit crew', 'Colony ward', 'Flight nurse', 'Long-haul round', 'Live-in carer'];
/** Each time round the same six names come back, further out, rather than with a number after them. */
const FURTHER_OUT = ['', 'further out', 'further out still', 'right out at the edge', 'past the edge', 'further than the maps go', 'further than anybody has been'];
const BEYOND_BLURBS = [
  'A whole ring of front doors, and a warden who knows every one of them.',
  'They work a shift out in orbit and are home in time for their tea.',
  'A ward with windows, where the light comes on when you knock.',
  'They go where they are needed and stay until they are not.',
  'Three weeks between calls, and the kettle already on when you arrive.',
  'They move in for a while. Not a facility – a home, with the good biscuits in the tin.',
];
/** Two new rungs at every stage past the printed ladder, the same as the stages in the table. */
export const BEYOND_PER_LEVEL = 2;
export function beyondBuilding(n) {
  const last = BUILDINGS[BUILDINGS.length - 1];
  const base = BEYOND_NAMES[(n - 1) % BEYOND_NAMES.length];
  const lap = Math.ceil(n / BEYOND_NAMES.length) - 1;
  const where = FURTHER_OUT[Math.min(lap, FURTHER_OUT.length - 1)];
  const name = lap ? `${base}, ${where}` : base;
  const plural = lap ? `${base}s, ${where}` : `${base}s`;
  return {
    id: `beyond-${n}`, side: n % 2 ? 'work' : 'team', name, plural, emoji: n % 2 ? '🪐' : '✨',
    baseCost: last.baseCost * Math.pow(8, n), rate: last.rate * Math.pow(4, n),
    level: 9 + Math.ceil(n / BEYOND_PER_LEVEL),
    blurb: BEYOND_BLURBS[(n - 1) % BEYOND_BLURBS.length],
    visual: `Another ${base.toLowerCase()} joins the lights on the horizon.`,
  };
}

export const BUILDINGS_BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

/** Growth stages. Reaching `threshold` (earned this run) lets you hand over and start again bigger. */
export const LEVELS = [
  { level: 0, name: 'One street', emoji: '🏠', threshold: 0, tagline: 'It starts with one carer and one front door.' },
  { level: 1, name: 'The village', emoji: '🏘️', threshold: 1.2e5, tagline: 'Everyone in the village knows the car.' },
  { level: 2, name: 'The town', emoji: '🏙️', threshold: 3e7, tagline: 'A proper office, a proper rota and a proper kettle.' },
  { level: 3, name: 'The county', emoji: '🗺️', threshold: 6e9, tagline: 'Supervisors out on the patch every day.' },
  { level: 4, name: 'The nation', emoji: '🏛️', threshold: 1e12, tagline: 'Branches from one coast to the other.' },
  { level: 5, name: 'Across the water', emoji: '🌍', threshold: 2e14, tagline: 'The same warm hello, in another language.' },
  { level: 6, name: 'The whole world', emoji: '🌐', threshold: 4e16, tagline: 'Nobody, anywhere, waiting on their own.' },
  { level: 7, name: 'Orbit', emoji: '🛰️', threshold: 8e18, tagline: 'Care with a rather good view.' },
  { level: 8, name: 'The Moon', emoji: '🌙', threshold: 1.6e21, tagline: 'One small step, and a cup of tea after it.' },
  { level: 9, name: 'Mars', emoji: '🔴', threshold: 3e23, tagline: 'Red planet. Warm hearts. Excellent biscuits.' },
];

/** Stages beyond the table keep going forever, and each one is 200 times the last – the same
 * step up as the stages in the table, so the pace never suddenly quickens at the end. */
/** Names and lines for the stages past the printed table, so the far game still sounds like a place. */
const FAR_STAGES = [
  { name: 'The asteroid run', emoji: '☄️', tagline: 'Nine hundred rocks, and somebody on every one of them.' },
  { name: 'The quiet arm', emoji: '🌌', tagline: 'Out where the post takes a fortnight and the tea still gets there.' },
  { name: 'The long orbit', emoji: '🪐', tagline: 'A year to go round once, and a call four times a day.' },
  { name: 'The deep round', emoji: '🌑', tagline: 'Nobody out here has ever waited on their own.' },
  { name: 'The far shore', emoji: '🌠', tagline: 'The furthest doorstep anyone has ever knocked on. So far.' },
  { name: 'The old light', emoji: '💫', tagline: 'Care that set off before the office had a kettle.' },
  { name: 'The wide dark', emoji: '🌃', tagline: 'Every light out there is somebody you look after.' },
  { name: 'The slow turn', emoji: '🌀', tagline: 'Long rounds, long lives, and a very long shopping list.' },
];
export function levelInfo(level) {
  if (level < LEVELS.length) return LEVELS[level];
  const n = level - LEVELS.length + 1;
  const far = FAR_STAGES[(n - 1) % FAR_STAGES.length];
  const lap = Math.ceil(n / FAR_STAGES.length);
  return {
    level, emoji: far.emoji, tagline: far.tagline,
    name: lap > 1 ? `${far.name}, ${FURTHER_OUT[Math.min(lap - 1, FURTHER_OUT.length - 1)]}` : far.name,
    threshold: LEVELS[LEVELS.length - 1].threshold * Math.pow(200, n),
  };
}

/** How good the service is judged to be. Derived from what you invest in, never from luck. */
export const RATINGS = [
  { id: 'new', name: 'Newly registered', emoji: '🆕', mult: 1, score: 0, blurb: 'Registered and ready. The rating comes with the work.' },
  { id: 'good', name: 'Good', emoji: '✅', mult: 1.2, score: 6, blurb: 'Safe, caring, well led. Everything earns a fifth more.' },
  { id: 'great', name: 'Outstanding', emoji: '🌟', mult: 1.6, score: 40, blurb: 'Outstanding in one of the five questions. Everything earns half as much again.' },
  { id: 'best', name: 'Outstanding, every question', emoji: '🏆', mult: 2.4, score: 400, blurb: 'Outstanding across the board. Everything earns nearly two and a half times as much.' },
  { id: 'flagship', name: 'A service others visit', emoji: '🎖️', mult: 3, score: 5000, blurb: 'Other agencies come to see how you do it. Everything earns three times as much.' },
  { id: 'national', name: 'Talked about nationally', emoji: '🏅', mult: 3.8, score: 40000, blurb: 'Your way of working is written up and taught. Everything earns nearly four times as much.' },
];

/** What counts towards the rating: the things a real service invests in to be well led. */
export const RATING_WEIGHTS = { keysafe: 0.05, package: 0.2, coordinator: 1, supervisor: 3, academy: 8, nurse: 12, office: 2 };
export const RATING_UPGRADE_POINTS = 6; // each quality upgrade owned

/** Permanent perks bought with Legacy Stars. */
export const PERKS = [
  { id: 'perk-admin', name: 'Head office', emoji: '🏛️', cost: 2, blurb: 'Every new run starts with the payments collected for you.' },
  { id: 'alumni', name: 'Alumni network', emoji: '🎓', cost: 5, blurb: 'Start each run with 5 carers and 5 people to look after.' },
  { id: 'magnet', name: 'Prismatic magnet', emoji: '🌈', cost: 9, blurb: 'Prismatic carers appear twice as often.' },
  { id: 'cards', name: 'Card collector', emoji: '💌', cost: 9, blurb: 'Thank-you cards appear twice as often.' },
  { id: 'playbook', name: 'Franchise playbook', emoji: '📘', cost: 18, blurb: 'Everything costs a tenth less.' },
  // Three pairs at the same price, so there is a real "which of these first?" rather than a list
  // you work down in the order it is printed.
  { id: 'nightshift', name: 'Night team', emoji: '🌙', cost: 34, blurb: 'Earn at full speed while the game is closed, instead of half.' },
  { id: 'legend', name: 'Living legend', emoji: '🏆', cost: 34, blurb: 'Your own visits are ten times stronger.' },
  { id: 'momentum', name: 'Momentum', emoji: '⚡', cost: 85, blurb: 'Start each run with 25 carers, 25 people to look after and 5 cars.' },
  { id: 'warmwelcome', name: 'A name people know', emoji: '💛', cost: 85, blurb: 'Every new run starts already rated Good.' },
  { id: 'founders', name: 'Founder’s share', emoji: '🕰️', cost: 200, blurb: 'Every hand-over is worth a quarter more Legacy Stars.' },
];

/**
 * And then it keeps going. Each one of these costs twice the last, so there is always something
 * left to save Stars for, however many hand-overs you have behind you.
 */
export function legacyPerk(n) {
  return {
    id: `legacy-${n}`, emoji: '🌟', cost: 350 * Math.pow(2, n - 1), endless: true,
    name: n === 1 ? 'The name goes further' : `The name goes further (${n})`,
    blurb: 'Everything earns a third more, for ever.',
  };
}

// ---------- Upgrades ----------
// Every upgrade has a `kind` the engine knows how to fold in, and a `question` – the one line that
// says why you might buy this one before the others.

const TIER_AT = [8, 40, 160];           // how many you must own for each tier to appear
const TIER_COST = [10, 250, 5000];      // times the building's base cost
const TIER_MULT = [2, 2.5, 3];          // each tier is a bigger step than the last
const TIER_WHERE = {
  carer: 'on every carer', client: 'at every door you look after', keysafe: 'on every key safe',
  package: 'on every care folder', car: 'on every car', directpay: 'in every window',
  coordinator: 'on the office whiteboard', council: 'on the council crest', supervisor: 'on the supervisor’s jacket',
  discharge: 'at the ambulance bay', office: 'on the branch office', framework: 'on the county board',
  academy: 'at the academy', chc: 'on the NHS-blue doors', nurse: 'on the nurse’s bag',
  group: 'across the group’s offices', tech: 'on the sensor lights', world: 'around the globe',
  orbit: 'on the care station', starship: 'on the starship',
};
const TIER_NAMES = {
  carer: ['Comfy shoes', 'Fob watches', 'Long-service badges'],
  client: ['Care plans', 'Life story books', 'Photos on the mantelpiece'],
  keysafe: ['Bigger key safes', 'Bulk fitting', 'Coded fobs'],
  package: ['Weekly reviews', 'Longer calls', 'Two-week rotas'],
  car: ['Sat navs', 'Magnetic door signs', 'An electric fleet'],
  directpay: ['Simple invoices', 'Standing orders', 'A family portal'],
  coordinator: ['The whiteboard rota', 'A rota app', 'Smart matching'],
  council: ['Electronic call monitoring', 'Framework paperwork', 'An uplift, at last'],
  supervisor: ['Hi-vis and a clipboard', 'Competency sign-off', 'Practice leads'],
  discharge: ['Home-first team', 'Same-day starts', 'A desk on the ward'],
  office: ['A decent kettle', 'Cake Fridays', 'The good biscuits'],
  framework: ['Preferred provider', 'Block hours', 'County-wide'],
  academy: ['The Care Certificate', 'A moving and handling suite', 'A simulation room'],
  chc: ['Complex care training', 'Clinical supervision', 'Delegated healthcare'],
  nurse: ['Clinical leads', 'An on-call clinician', 'Specialist pathways'],
  group: ['A shared back office', 'One group brand', 'A board of trustees'],
  tech: ['Fall detectors', 'Kettle sensors', 'Friendly robots'],
  world: ['A translation team', 'One global rota', 'A care embassy'],
  orbit: ['Solar panels', 'An orbital relay', 'A constellation'],
  starship: ['Warp rotas', 'Cosy cabins', 'Infinite kindness'],
};

/** The plain "twice as good" upgrades: the baseline everything else has to beat. */
const TIERS = [];
for (const b of BUILDINGS) {
  TIER_AT.forEach((count, i) => {
    TIERS.push({
      id: `${b.id}-t${i + 1}`, name: TIER_NAMES[b.id][i], emoji: b.emoji, kind: 'building', building: b.id,
      cost: b.baseCost * TIER_COST[i], archetype: 'kit', mult: TIER_MULT[i],
      blurb: `Every one of your ${b.plural.toLowerCase()} brings in ${TIER_MULT[i] === 2 ? 'twice' : `${TIER_MULT[i]} times`} as much.`,
      visual: `${TIER_NAMES[b.id][i]} ${TIER_WHERE[b.id]}.`,
      question: `Only worth buying if you already have plenty of ${b.plural.toLowerCase()}.`,
      unlock: (s) => (s.buildings[b.id] || 0) >= count,
    });
  });
}

/** Synergies: one thing quietly making another thing better. Capped, so nothing runs away. */
const SYNERGIES = [
  { id: 'syn-keysafe-carer', name: 'Keys in the box', emoji: '🔑', from: 'keysafe', to: '*team', per: 0.012, cap: 1.5, cost: 3000, unlock: (s) => (s.buildings.keysafe || 0) >= 5, blurb: 'The more key safes you have, the more your whole team gets done – every one of them adds a little, and a lot of them adds a lot.', question: 'Pays off if you keep fitting key safes – dead weight if you do not.' },
  { id: 'syn-car-carer', name: 'Wheels under everyone', emoji: '🚗', from: 'car', to: '*team', per: 0.015, cap: 2, cost: 90000, unlock: (s) => (s.buildings.car || 0) >= 5, blurb: 'The more care cars you have, the more your whole team gets done – every one of them adds a little, and a lot of them adds a lot.', question: 'Turns a fleet into a workforce boost – only if the fleet keeps growing.' },
  { id: 'syn-package-client', name: 'Everything written down', emoji: '📋', from: 'package', to: '*work', per: 0.015, cap: 2, cost: 40000, unlock: (s) => (s.buildings.package || 0) >= 5, blurb: 'The more care packages you have, the more all of your work brings in – every one of them adds a little, and a lot of them adds a lot.', question: 'The same deal for the work side. Which half are you growing?' },
  { id: 'syn-coord-carer', name: 'Somebody holding the rota', emoji: '🗂️', from: 'coordinator', to: '*team', per: 0.025, cap: 3, cost: 2.4e6, unlock: (s) => (s.buildings.coordinator || 0) >= 3, blurb: 'The more coordinators you have, the more your whole team gets done – every one of them adds a little, and a lot of them adds a lot.', question: 'The strongest team boost in the game, if you can afford coordinators.' },
  { id: 'syn-council-package', name: 'Volume from the council', emoji: '🏛️', from: 'council', to: '*work', per: 0.03, cap: 3, cost: 9e6, unlock: (s) => (s.buildings.council || 0) >= 3, blurb: 'The more council contracts you have, the more all of your work brings in – every one of them adds a little, and a lot of them adds a lot.', question: 'Rewards going wide on contracts rather than deep on people.' },
  { id: 'syn-super-team', name: 'Steady hands everywhere', emoji: '🦺', from: 'supervisor', to: '*team', per: 0.01, cap: 1.5, cost: 6e7, unlock: (s) => (s.buildings.supervisor || 0) >= 3, blurb: 'The more field supervisors you have, the more your whole team gets done – every one of them adds a little, and a lot of them adds a lot.', question: 'Lifts everybody on your team at once, not just one sort of person.' },
  { id: 'syn-office-all', name: 'A branch behind you', emoji: '🏢', from: 'office', to: '*', per: 0.008, cap: 1.2, cost: 2.4e9, unlock: (s) => (s.buildings.office || 0) >= 3, blurb: 'The more branch offices you have, the better everything you own does – every one of them adds a little, and a lot of them adds a lot.', question: 'Small per office, but it touches every single thing you own.' },
  { id: 'syn-academy-team', name: 'Everyone trained properly', emoji: '🎓', from: 'academy', to: '*team', per: 0.02, cap: 3, cost: 9e10, unlock: (s) => (s.buildings.academy || 0) >= 3, blurb: 'The more training academies you have, the more your whole team gets done – every one of them adds a little, and a lot of them adds a lot.', question: 'The late-game team engine. Needs academies to be worth anything.' },
  { id: 'syn-chc-nurse', name: 'Clinical confidence', emoji: '🩺', from: 'chc', to: '*work', per: 0.02, cap: 3, cost: 3.4e12, unlock: (s) => (s.buildings.chc || 0) >= 5, blurb: 'The more NHS-funded packages you have, the more all of your work brings in – every one of them adds a little, and a lot of them adds a lot.', question: 'Lifts the whole work side at once, if you have gone down the NHS road.' },
];

/** How many bits of kit are out on the patch, and how many make the patch feel looked after. */
export const KIT_FOR_TIDY = 12;
const kitCount = (s) => s.upgrades.filter((id) => /-t\d+$/.test(id)).length;

/** Bonuses that only apply while the board is in a certain state. Keep an eye on them. */
const CONDITIONALS = [
  // `share` returns 0..1: how much of the bonus is paying. It slides rather than switching off, so
  // taking on more work can never make you poorer, only dilute a bonus you were holding.
  { id: 'cond-covered', name: 'Nobody is rushed', emoji: '🫶', mult: 1.3, cost: 12000, archetype: 'conditional', share: (s, m) => (m.work > 0 ? Math.min(1, Math.sqrt(m.team / m.work)) : 1), label: 'the more of the work your team can cover', blurb: 'Everything earns up to a third more, in full once your team can cover the work.', question: 'Choose one of these two: this one, or the one called A full round. Take this if you like having enough carers for the work.', unlock: (s) => s.runEarned >= 6000 && !s.upgrades.includes('cond-busy') },
  { id: 'cond-continuity', name: 'The same carer, every time', emoji: '🤝', mult: 1.45, cost: 3e6, archetype: 'conditional', side: 'team', sideDiscount: 0.75, share: (s, m) => (m.work > 0 ? Math.min(1, Math.sqrt(m.team / (m.work * 1.8))) : 1), label: 'the further your team is ahead of the work', blurb: 'Everything earns up to half as much again, in full once your team is nearly twice the work – and everything on the team side costs a quarter less, for good.', question: 'Choose one of these two: this one, or the one called People ask for you first. Keep more carers than you need and it pays.', unlock: (s) => (s.upgrades.includes('cond-covered') || s.level >= 8) && !s.upgrades.includes('cond-waiting') },
  { id: 'cond-busy', name: 'A full round', emoji: '🚶', mult: 1.3, cost: 12000, archetype: 'conditional', share: (s, m) => (m.team > 0 ? Math.min(1, Math.sqrt(m.work / m.team)) : 1), label: 'the fuller the rounds are', blurb: 'Everything earns up to a third more, in full once there is a full round of work for everybody.', question: 'Choose one of these two: this one, or the one called Nobody is rushed. Take this if you like taking work on and hiring after.', unlock: (s) => s.runEarned >= 6000 && !s.upgrades.includes('cond-covered') },
  { id: 'cond-waiting', name: 'People ask for you first', emoji: '📖', mult: 1.45, cost: 3e6, archetype: 'conditional', side: 'work', sideDiscount: 0.75, clickBoost: 2, share: (s, m) => (m.team > 0 ? Math.min(1, Math.sqrt(m.work / (m.team * 1.8))) : 1), label: 'the more people are asking for you than you can take on yet', blurb: 'Everything earns up to half as much again, in full once there is nearly twice the work your team can carry – taking work on costs a quarter less, and your own visits are worth twice as much.', question: 'Choose one of these two: this one, or the one called The same carer, every time. Take more work than you can do and it pays.', unlock: (s) => (s.upgrades.includes('cond-busy') || s.level >= 8) && !s.upgrades.includes('cond-continuity') },
  { id: 'cond-tidy', name: 'A tidy patch', emoji: '🧰', mult: 1.25, cost: 250000, archetype: 'conditional', share: (s) => Math.min(1, kitCount(s) / KIT_FOR_TIDY), label: 'the more of your kit is out on the patch', blurb: 'Everything earns up to a quarter more, in full once you have twelve bits of kit out on the patch.', question: 'Every little bit of kit you buy counts twice – once on its own, and once for the whole patch.', unlock: (s) => (s.buildings.keysafe || 0) >= 10 },
  { id: 'cond-wellled', name: 'Well led', emoji: '🌟', mult: 1.35, cost: 4e8, archetype: 'conditional', share: (s, m) => Math.min(1, Math.max(0, m.ratingIndex - 1) / 3), label: 'the higher your rating climbs', blurb: 'Everything earns up to a third more, in full once your service is talked about nationally.', question: 'Turns the rating from a nice badge into a reason to keep training people.', unlock: (s) => (s.buildings.academy || 0) >= 1 },
];

/** The tenth of anything doubles it. These make that step bigger still. */
const MILESTONE_UPS = [
  { id: 'mile-1', name: 'We mark the tenth', emoji: '🎉', add: 0.2, cost: 1.5e6, archetype: 'milestone', blurb: 'Every ten of anything you own is worth a bit more than it was.', question: 'Every ten you have ever bought is worth more, and so is every ten still to come.', unlock: (s) => Object.values(s.buildings).some((n) => n >= 25) },
  { id: 'mile-2', name: 'Long service all round', emoji: '🎖️', add: 0.3, cost: 2e10, archetype: 'milestone', blurb: 'Every tenth of anything is worth 2.5 times instead of 2.2.', question: 'The single biggest number in the game if you own a lot of everything.', unlock: (s) => s.upgrades.includes('mile-1') && Object.values(s.buildings).some((n) => n >= 100) },
];

/** What a visit is worth: who is paying, and what you are trusted to do. */
const VALUES = [
  { id: 'val-private', name: 'Private clients', emoji: '💷', mult: 1.6, cost: 9000, blurb: 'Every visit is worth half as much again.', question: 'A flat, dependable boost – the safe pick when nothing else is close.', unlock: (s) => s.runEarned >= 4000 },
  { id: 'val-fair', name: 'A fair hourly rate', emoji: '⚖️', mult: 1.5, cost: 4e5, blurb: 'Every visit is worth half as much again.', question: 'Negotiated, not squeezed. Boring, reliable, always fine to buy.', unlock: (s) => s.runEarned >= 2e5 },
  { id: 'val-specialist', name: 'Specialist care', emoji: '🧠', mult: 1.7, cost: 3e7, blurb: 'Every visit is worth two thirds more.', question: 'Big, and it never needs anything else. Weigh it against a bonus you would have to keep buying for.', unlock: (s) => s.runEarned >= 1.5e7 },
  { id: 'val-nhs', name: 'NHS rates', emoji: '🩺', mult: 1.8, cost: 5e9, blurb: 'Every visit is worth nearly twice as much.', question: 'The biggest simple lift in the middle of the game.', unlock: (s) => s.runEarned >= 2e9 },
  { id: 'val-reputation', name: 'A reputation worth paying for', emoji: '💖', mult: 1.9, cost: 8e11, blurb: 'Every visit is worth nearly twice as much.', question: 'Late, expensive and unconditional.', unlock: (s) => s.runEarned >= 4e11 },
  { id: 'val-national', name: 'A national agreement', emoji: '🏛️', mult: 2, cost: 2e14, blurb: 'Every visit is worth twice as much.', question: 'The last of the flat ones, and the largest.', unlock: (s) => s.runEarned >= 1e14 },
];

/** Your own visits, done by hand. */
const CLICKS = [
  { id: 'click-1', name: 'A cup of tea and a chat', emoji: '☕', kind: 'click', pct: 0.001, cost: 25, blurb: 'Your own visits are worth twice as much, and keep earning a trickle of their own even while you are not tapping.', question: 'Cheap, and it doubles the one thing you earn with your own hands.', unlock: (s) => s.clicks >= 5 },
  { id: 'click-2', name: 'Your own little round', emoji: '🚶', kind: 'click', pct: 0.002, cost: 1200, blurb: 'Your own visits are worth twice as much, and keep earning a little of their own even while you are not tapping.', question: 'Only worth it if you actually enjoy tapping doors.', unlock: (s) => s.clicks >= 50 },
  { id: 'click-3', name: 'Hands on', emoji: '🤲', kind: 'clickpct', cost: 30000, blurb: 'Your own visits keep earning on their own, even while you are not tapping.', question: 'Turns your tapping into a share of the whole business.', unlock: (s) => s.clicks >= 150 },
  { id: 'click-4', name: 'Everyone knows you', emoji: '🌟', kind: 'click', pct: 0.005, mult: 3, cost: 2e6, blurb: 'Your own visits are worth three times as much, and they keep earning a little on their own even while you are not tapping.', question: 'The last of the early ones for hand visits, and the first that really shows.', unlock: (s) => s.clicks >= 400 },
  { id: 'click-5', name: 'The founder still visits', emoji: '💐', kind: 'clickpct', pct: 0.03, cost: 4e8, blurb: 'Your own visits keep earning a little on their own, even while you are not tapping.', question: 'Later on, a few taps a second is a real part of what you earn.', unlock: (s) => s.clicks >= 900 },
  { id: 'click-6', name: 'They still ask for you', emoji: '💌', kind: 'clickpct', pct: 0.05, cost: 6e11, blurb: 'Your own visits keep earning a little on their own, even while you are not tapping.', question: 'Turns tapping doors into a strategy of its own, however big you get.', unlock: (s) => s.clicks >= 2500 },
];

/** Things that do a job for you. */
const AUTOMATION = [
  { id: 'admin', name: 'Office admin', emoji: '🗃️', kind: 'collect', cost: 120, blurb: 'The payments are collected for you every few seconds.', question: 'Stops you chasing invoices. Buy it early and forget it.', unlock: (s) => s.runEarned >= 40 },
  { id: 'ecm', name: 'Electronic call monitoring', emoji: '📲', kind: 'global', mult: 1.25, cost: 55000, blurb: 'Calls log themselves in and out. Everything earns a quarter more.', question: 'Simple and early. You will have to choose between this and the bonuses that grow.', unlock: (s) => (s.buildings.package || 0) >= 5 },
  { id: 'direct-debit', name: 'Direct debit', emoji: '🏦', kind: 'collect', cost: 9000, blurb: 'Payments arrive the moment the visit is done.', question: 'No more waiting for the office admin’s five seconds.', unlock: (s) => s.upgrades.includes('admin') },
  { id: 'oncall', name: 'The on-call phone', emoji: '📞', kind: 'offline', cost: 1.2e7, blurb: 'While the game is closed the team keeps going at nearly full speed, for up to twelve hours.', question: 'Worth more the longer you leave the game alone.', unlock: (s) => s.offlineReturns >= 1 },
];

/** Cheaper things. Priced at about one and a half of the next one you would buy. */
const DISCOUNTS = [
  { id: 'disc-recruit', name: 'Refer a friend', emoji: '🫂', kind: 'discount', building: 'carer', factor: 0.85, cost: 9000, blurb: 'Carers cost a bit less, for good.', question: 'Only pays back if you are going to keep hiring.', unlock: (s) => (s.buildings.carer || 0) >= 40 },
  { id: 'disc-safes', name: 'Key safes by the box', emoji: '📦', kind: 'discount', building: 'keysafe', factor: 0.8, cost: 260000, blurb: 'Key safes cost a fifth less, for good.', question: 'Key safes stay worth buying long after their own income has faded.', unlock: (s) => (s.buildings.keysafe || 0) >= 30 },
  { id: 'disc-mileage', name: 'Mileage sorted properly', emoji: '⛽', kind: 'discount', building: 'car', factor: 0.8, cost: 5.5e6, blurb: 'Care cars cost a fifth less, for good.', question: 'Cars are the priciest thing you buy in bulk early on.', unlock: (s) => (s.buildings.car || 0) >= 25 },
  { id: 'disc-homes', name: 'Word gets round', emoji: '🗣️', kind: 'discount', building: 'client', factor: 0.85, cost: 12000, blurb: 'Taking somebody new on costs a bit less, for good.', question: 'The same idea for the work side as Refer a friend is for the team.', unlock: (s) => (s.buildings.client || 0) >= 40 },
];

/** Quality investments. These also push the rating up. */
const QUALITY = [
  { id: 'qual-cert', name: 'The Care Certificate', emoji: '📜', kind: 'global', mult: 1.15, quality: true, cost: 8000, blurb: 'Everyone is trained properly. Everything earns a bit more, and your rating goes up.', question: 'Cheap now, and it counts towards Outstanding later.', unlock: (s) => (s.buildings.carer || 0) >= 10 },
  { id: 'qual-plans', name: 'Person-centred care plans', emoji: '📗', kind: 'global', mult: 1.2, quality: true, cost: 300000, blurb: 'Everything earns a fifth more, and the rating goes up.', question: 'A rating point and a flat boost in one.', unlock: (s) => (s.buildings.client || 0) >= 25 },
  { id: 'qual-nomeds', name: 'No fifteen-minute calls', emoji: '⏱️', kind: 'global', mult: 1.3, quality: true, cost: 2.5e7, blurb: 'You turn down calls too short to do properly. Everything earns a third more, and the rating goes up.', question: 'Costs you volume in the story and pays you back in reputation.', unlock: (s) => (s.buildings.package || 0) >= 25 },
  { id: 'qual-hours', name: 'Guaranteed hours', emoji: '🗓️', kind: 'global', mult: 1.35, quality: true, cost: 1.5e9, blurb: 'No zero-hours contracts. Everything earns a third more, and the rating goes up.', question: 'The retention upgrade: pay for certainty, keep your people.', unlock: (s) => (s.buildings.carer || 0) >= 100 },
  { id: 'qual-reviews', name: 'Reviews on the website', emoji: '⭐', kind: 'global', mult: 1.4, quality: true, cost: 4e11, blurb: 'Families leave reviews. Everything earns two fifths more, and the rating goes up.', question: 'Late, large, and the last push to Outstanding on every question.', unlock: (s) => (s.buildings.supervisor || 0) >= 25 },
];

/**
 * One-off choices. You pick one from each slot per run, and picking is permanent until you hand over.
 * The three options in a slot are deliberately close in value at the moment you choose, and pull
 * apart depending on how you play.
 */
export const BRANCHES = [
  {
    slot: 'buyer', name: 'Who do you work for?', emoji: '🤝', level: 1,
    blurb: 'Most of your work is going to come from one place. Which?',
    options: [
      { id: 'buyer-private', name: 'Private clients', emoji: '💷', kind: 'global', mult: 1.55, blurb: 'Everything earns half as much again.', question: 'Flat, simple, and the most you can earn in the first few minutes of a run.' },
      { id: 'buyer-council', name: 'The council framework', emoji: '🏛️', kind: 'branch-council', mult: 1.45, discount: 0.45, blurb: 'Everything earns half as much again, and taking on work costs about half as much.', question: 'Cheaper work means more of it – best if you buy in bulk.' },
      { id: 'buyer-nhs', name: 'NHS packages', emoji: '🩺', kind: 'branch-scaling', mult: 1.5, per: 0.012, from: ['package', 'chc'], cap: 6, blurb: 'Everything earns half as much again, and more again for every care package you run – NHS-funded ones count too. It builds up over your first minute or two on a patch.', question: 'Least of the three for the first few minutes, most of them by the end of a long run.' },
    ],
  },
  {
    slot: 'growth', name: 'How do you grow?', emoji: '🌱', level: 3,
    blurb: 'Everybody grows differently. What is your way?',
    options: [
      { id: 'grow-people', name: 'More hands', emoji: '👥', kind: 'branch-scaling', mult: 1.15, per: 0.02, from: 'carer', cap: 5, blurb: 'Everything earns a bit more, and more again for every carer you have. It builds up over your first minute or two on a patch.', question: 'Slow to start and nothing beats it late. Best when you mean to stay on this patch a while.' },
      { id: 'grow-kit', name: 'Better kit', emoji: '🧰', kind: 'branch-council', discountSide: 'team', mult: 1.8, discount: 0.3, blurb: 'Everything earns nearly twice as much, and carers, key safes, cars and offices all cost about a third of the price.', question: 'Not a bonus but a discount: everything on the team side costs 70% less, for ever.' },
      { id: 'grow-rates', name: 'Better rates', emoji: '📈', kind: 'value', mult: 2.4, clickBoost: 3, blurb: 'Every visit is worth nearly two and a half times as much, and your own visits are worth three times as much again.', question: 'Flat, immediate, and the only one that rewards tapping doors yourself.' },
    ],
  },
  {
    slot: 'known', name: 'What are you known for?', emoji: '🏅', level: 5,
    blurb: 'Every good agency is known for something.',
    options: [
      { id: 'known-dementia', name: 'Dementia care', emoji: '🧠', kind: 'branch-scaling', mult: 1.35, per: 0.02, from: 'client', cap: 5, blurb: 'Everything earns a third more, and more again for everybody you look after. It builds up over your first minute or two on a patch.', question: 'Rewards a long client list and life story work – the longer the better.' },
      { id: 'known-reablement', name: 'Reablement', emoji: '🌤️', kind: 'branch-council', mult: 1.7, discount: 0.6, blurb: 'Everything earns two thirds more, and taking on work costs a good bit less.', question: 'Short, intensive, and people leave you better than they arrived. Best on a quick run.' },
      { id: 'known-complex', name: 'Complex care', emoji: '🧑‍⚕️', kind: 'branch-scaling', mult: 1.6, per: 0.09, from: ['chc', 'nurse'], cap: 6, blurb: 'Everything earns half as much again, and more again for every NHS package and nurse-led team you have. It builds up over your first minute or two on a patch.', question: 'The hardest work, and nothing else climbs as high.' },
    ],
  },
];

export const BRANCH_OPTIONS = BRANCHES.flatMap((b) => b.options.map((o) => ({ ...o, slot: b.slot, archetype: 'branch' })));
export const BRANCHES_BY_SLOT = new Map(BRANCHES.map((b) => [b.slot, b]));

/** Everything you can buy with money, in one list. */
export const UPGRADES = [
  ...TIERS,
  ...SYNERGIES.map((u) => ({ ...u, kind: 'synergy', archetype: 'synergy' })),
  ...CONDITIONALS.map((u) => ({ ...u, kind: 'conditional' })),
  ...MILESTONE_UPS.map((u) => ({ ...u, kind: 'milestone' })),
  ...VALUES.map((u) => ({ ...u, kind: 'value', archetype: 'rate' })),
  ...CLICKS.map((u) => ({ ...u, archetype: 'click' })),
  ...AUTOMATION.map((u) => ({ ...u, archetype: 'automation' })),
  ...DISCOUNTS.map((u) => ({ ...u, archetype: 'discount' })),
  ...QUALITY.map((u) => ({ ...u, archetype: 'quality' })),
];
/**
 * The rule the game is built on: nothing may be bought unless something changes on the street.
 * Every upgrade below names the change. Anything without one fails a test.
 */
const VISUALS = {
  'syn-keysafe-carer': 'Carers let themselves in instead of waiting on the step.',
  'syn-car-carer': 'Carers arrive by car, and get round the street faster.',
  'syn-package-client': 'A care folder on every doorstep.',
  'syn-coord-carer': 'Everybody is carrying a tablet with the rota on it.',
  'syn-council-package': 'The council crest goes up in the office window.',
  'syn-super-team': 'A supervisor in hi-vis walking the street all day.',
  'syn-office-all': 'Your branch office gains another floor.',
  'syn-academy-team': 'A training minibus parked outside the office.',
  'syn-chc-nurse': 'Nurse-led visits, in NHS blue.',
  'cond-covered': 'A green tick over the office whenever it is switched on.',
  'cond-busy': 'Every carer on the street has somewhere to be.',
  'cond-waiting': 'More front doors with the light on than there are carers to knock.',
  'cond-continuity': 'Carers keep going back to the same doors, and the minibus is always out.',
  'cond-tidy': 'The green tick over the office counts your kit in.',
  'cond-wellled': 'The rating sticker in the office window glows.',
  'mile-1': 'Bunting goes up along the office.',
  'mile-2': 'More bunting, and a long-service banner.',
  'val-private': 'The coins coming in get bigger.',
  'val-fair': 'The coins coming in get bigger.',
  'val-specialist': 'The coins coming in get bigger.',
  'val-nhs': 'The coins coming in get bigger.',
  'val-reputation': 'The coins coming in get bigger.',
  'val-national': 'The coins coming in get bigger.',
  'click-1': 'You get a mug on your round.',
  'click-2': 'You get your own name badge.',
  'click-3': 'Your visits leave a trail of hearts.',
  'click-4': 'Everybody waves at you first.',
  'click-5': 'Flowers on the doorstep wherever you have been.',
  'click-6': 'A card in the window of every door you visit yourself.',
  admin: 'The pile of invoices outside the office disappears.',
  ecm: 'A green tick pops over each door as the carer arrives.',
  'direct-debit': 'A card reader sign in the office window.',
  oncall: 'One office window stays lit all night.',
  'disc-recruit': 'A "we are hiring" board outside the office.',
  'disc-safes': 'A box of key safes by the office door.',
  'disc-mileage': 'A fuel card on every dashboard.',
  'disc-homes': 'A neighbour waves you over from the next garden.',
  'qual-cert': 'A framed certificate in the office window.',
  'qual-plans': 'Care folders on every sideboard.',
  'qual-nomeds': 'The clock above the office door turns green.',
  'qual-hours': 'A rota on the wall with everybody’s name on it.',
  'qual-reviews': 'A star board goes up outside the office.',
  'buyer-private': 'The office sign turns Monteith peach, and a price list goes up in the window.',
  'buyer-council': 'The office sign turns council green.',
  'buyer-nhs': 'The office sign turns NHS blue, with a clinical badge beside the door.',
  'grow-people': 'More carers on the street than you can count.',
  'grow-kit': 'A kit crate by the office door, and everything for the team at well under half price.',
  'grow-rates': 'The coins coming in get bigger, and so does every visit you do yourself.',
  'known-dementia': 'A photograph in every window.',
  'known-reablement': 'A door opens and somebody waves you off, doing fine.',
  'known-complex': 'Clinical blue on the doors that need it.',
};
/** The icon each upgrade puts on the office noticeboard. Every non-kit upgrade has one. */
export const UPGRADE_ICONS = {
  'syn-keysafe-carer': '🔑', 'syn-car-carer': '🚗', 'syn-package-client': '📋', 'syn-coord-carer': '📱',
  'syn-council-package': '🏛️', 'syn-super-team': '🦺', 'syn-office-all': '🏢', 'syn-academy-team': '🎓', 'syn-chc-nurse': '🩺',
  'cond-covered': '🫶', 'cond-continuity': '🤝', 'cond-tidy': '🧰', 'cond-wellled': '🌟', 'cond-busy': '🚶', 'cond-waiting': '📖',
  'mile-1': '🎉', 'mile-2': '🎖️',
  'val-private': '💷', 'val-fair': '⚖️', 'val-specialist': '🧠', 'val-nhs': '🩺', 'val-reputation': '💖', 'val-national': '🏛️',
  'click-1': '☕', 'click-2': '🚶', 'click-3': '🤲', 'click-4': '🌟', 'click-5': '💐', 'click-6': '💌',
  admin: '🗃️', ecm: '📲', 'direct-debit': '🏦', oncall: '📞',
  'disc-recruit': '🫂', 'disc-safes': '📦', 'disc-mileage': '⛽', 'disc-homes': '🗣️',
  'qual-cert': '📜', 'qual-plans': '📗', 'qual-nomeds': '⏱️', 'qual-hours': '🗓️', 'qual-reviews': '⭐',
  'buyer-private': '💷', 'buyer-council': '🏛️', 'buyer-nhs': '🩺',
  'grow-people': '👥', 'grow-kit': '🧰', 'grow-rates': '📈',
  'known-dementia': '🧠', 'known-reablement': '🌤️', 'known-complex': '🧑‍⚕️',
};

// Branch options are shared objects: give the originals their words too, not just the flat copies.
for (const group of BRANCHES) for (const o of group.options) { if (!o.visual) o.visual = VISUALS[o.id] || ''; if (!o.icon) o.icon = UPGRADE_ICONS[o.id]; }
for (const u of [...UPGRADES, ...BRANCH_OPTIONS]) {
  if (!u.visual) u.visual = VISUALS[u.id] || '';
  if (!u.icon && UPGRADE_ICONS[u.id]) u.icon = UPGRADE_ICONS[u.id];
}

export const UPGRADES_BY_ID = new Map([...UPGRADES, ...BRANCH_OPTIONS].map((u) => [u.id, u]));

/**
 * The shop never runs out, and it never empties in the middle of a run either. Every stage from the
 * village onwards brings its own shelf, priced as a share of what that stage asks you to earn – so
 * the first is affordable early, the last is something to save the whole run for, and the ladder
 * carries on the same way for ever. Stages past the printed table also bring kit for their two new
 * rungs.
 */
const STAGE_CACHE = new Map();

/** What this run has to earn, as the shelf sees it. Kept here so the unlock rules can read it too. */
const runTargetOf = (s) => (s.runTarget > 0 ? s.runTarget : levelInfo(s.level + 1).threshold);
/** How many rungs are on offer at this stage: the printed ladder plus the far ones. */
const unlockedRungs = (s) => BUILDINGS.filter((b) => b.level <= s.level).length + Math.max(0, (s.level - 9) * BEYOND_PER_LEVEL);
const FAR_KIT = ['Warm boxes', 'Quiet engines', 'Deep-space kettles'];

/**
 * The order the twelve arrive in at a given stage: the same four bands of three every time, with
 * the three inside each band rotated by the stage number. Cheap things still come early and dear
 * things late, so the pricing holds, but no two stages in a row read the same way.
 */
function shelfOrder(level) {
  const out = [];
  for (let band = 0; band < 4; band++) {
    const turn = (level + band) % 3;
    for (let i = 0; i < 3; i++) out.push(band * 3 + ((i + turn) % 3));
  }
  return out;
}

export function stageUpgrades(level) {
  if (STAGE_CACHE.has(level)) return STAGE_CACHE.get(level);
  const info = levelInfo(level);
  const where = info.name;
  // The rung this stage brings with it: what the stage's own synergy and discount are about.
  const own = (level >= LEVELS.length
    ? beyondBuilding((level - LEVELS.length + 1) * BEYOND_PER_LEVEL - 1)
    : BUILDINGS.filter((b) => b.level === level).slice(-1)[0]) || BUILDINGS[0];
  const side = own.side === 'team' ? 'team' : 'work';
  // The synergy and the discount both lean on the rung you got the hang of last stage: you own
  // plenty of those and you are still buying them, so a discount on them is worth having. A
  // discount on the rung this stage brings is worth nothing until you can afford the first one.
  const settled = (level > LEVELS.length + 1
    ? beyondBuilding(Math.max(1, (level - LEVELS.length - 1) * BEYOND_PER_LEVEL - 1))
    : BUILDINGS.filter((b) => b.level === Math.max(0, level - 2)).slice(-1)[0]) || BUILDINGS[0];

  /**
   * A shelf of twelve, in the order you will meet them. Each one is priced in seconds of what you
   * are earning right now, and each appears a fixed way along the run – measured by how far the
   * takings have climbed rather than by a share of the total, because the takings climb by orders of
   * magnitude and a share of the total would put the whole shelf in the last minute.
   */
  /**
   * The pool a stage draws its shelf from: four bands of seven, three taken from each. Which three
   * depends on the stage, so no two stages in a row bring the same twelve things. The bands hold the
   * price and the moment in the run, so the shape of a run is the same whichever way the draw falls.
   */
  const bands = [
    // Cheap and immediate: the first thing you buy on a new patch.
    [
      { key: 'rate1', seconds: 2, name: 'Better rates all round', emoji: '💷', kind: 'value', archetype: 'rate', mult: 2,
        blurb: `${where}: every visit is worth twice as much.`, question: 'The first thing worth having here, and it is never wasted.',
        visual: 'The coins coming into the office get bigger.' },
      { key: 'hands', seconds: 3.5, name: 'Still on the round yourself', emoji: '🤲', kind: 'clickpct', pct: 0.01, archetype: 'click',
        blurb: 'Your own visits keep earning a little on their own, even while you are not tapping.', question: 'Cheap, and it keeps your own tapping worth doing.',
        visual: 'Your own carer keeps walking the round with everybody else.' },
      { key: 'syn', seconds: 5.5, name: 'Whatever you have most of', emoji: settled.emoji, kind: 'synergy', archetype: 'synergy',
        fromSide: side, to: `*${side}`, per: 0.01, cap: 2,
        blurb: `Whichever part of your ${side} you have most of makes all the rest better – the more of them you have, the bigger the lift.`,
        question: `It grows with whatever you have most of, so it keeps paying more all the way through a run.`,
        visual: 'The thing you have the most of, everywhere you look.' },
      { key: 'handover', seconds: 3, name: 'A proper handover', emoji: '📒', kind: 'side', archetype: 'synergy', side: 'team', flat: 0.35,
        blurb: `${where}: your whole team gets a third more done.`, question: 'Ten minutes at the end of a shift that saves an hour the next morning.',
        visual: 'Two carers stop on the pavement to swap notes.' },
      { key: 'answered', seconds: 4, name: 'Every door answered', emoji: '🔔', kind: 'side', archetype: 'synergy', side: 'work', flat: 0.35,
        blurb: `${where}: all of your work brings in a third more.`, question: 'Nobody rings twice. The cheap one for the work side.',
        visual: 'A light goes on behind every door as the round starts.' },
      { key: 'yearly', seconds: 4.5, name: 'Rates agreed for the year', emoji: '📅', kind: 'value', archetype: 'rate', mult: 1.8,
        blurb: `${where}: every visit is worth nearly twice as much.`, question: 'Not the biggest, but it is signed and it does not move.',
        visual: 'A calendar goes up in the office window.' },
      { key: 'rota', seconds: 5, name: 'The rota app learns your round', emoji: '📱', kind: 'clickpct', pct: 0.015, archetype: 'click',
        blurb: 'Your own visits keep earning a little on their own, even while you are not tapping.', question: 'The cheapest good one if you like doing the visits yourself.',
        visual: 'Every carer on the street is holding a phone.' },
    ],
    // A minute or so of saving: the first real decision of a run.
    [
      { key: 'team', seconds: 8, name: 'The whole team lifts', emoji: '👥', kind: 'side', archetype: 'synergy', side: 'team', flat: 0.6,
        blurb: `${where}: your whole team gets half as much again done.`, question: 'Lifts every pair of hands you own at once.',
        visual: 'Everybody on the street works a little quicker.' },
      { key: 'all1', seconds: 11, name: 'Everybody pulls together', emoji: '✨', kind: 'global', archetype: 'rate', mult: 1.8,
        blurb: `${where}: everything you own earns nearly twice as much.`, question: 'Touches every single thing you own, whichever way you have played.',
        visual: 'The whole street lifts, and the office noticeboard fills up.' },
      { key: 'disc', seconds: 15, name: side === 'team' ? 'Bought in bulk' : 'Signed off in one go', emoji: '📦', kind: 'discount', archetype: 'discount', side, sideDiscount: 0.75,
        blurb: `Everything on the ${side} side costs a quarter less for the rest of this run.`,
        question: 'Not more income – more of everything, sooner. It pays for itself the more you buy.',
        visual: side === 'team' ? 'A delivery van unloading outside the office.' : 'A stack of signed contracts on the office desk.' },
      { key: 'mileage', seconds: 12, name: side === 'team' ? 'Contracts by the bundle' : 'Mileage paid properly', emoji: '🧾', kind: 'discount', archetype: 'discount',
        side: side === 'team' ? 'work' : 'team', sideDiscount: 0.75,
        blurb: `Everything on the ${side === 'team' ? 'work' : 'team'} side costs a quarter less for the rest of this run.`,
        question: 'The other side’s discount. Whichever side you are feeding, one of these is for you.',
        visual: 'A fuel card and a folder of receipts on the office desk.' },
      { key: 'eighth', seconds: 14, name: 'The rota holds', emoji: '🗓️', kind: 'milestone', archetype: 'milestone', milestoneEvery: 1.25,
        blurb: 'Every ten you buy comes round a quarter sooner, for everything you own.',
        question: 'It does not make the tens worth more – it brings them round sooner. Best when you buy in armfuls.',
        visual: 'The bunting over the office goes up earlier than it used to.' },
      { key: 'word', seconds: 10, name: 'Word gets round', emoji: '🗣️', kind: 'global', archetype: 'rate', mult: 1.6,
        blurb: `${where}: everything you own earns half as much again.`, question: 'Cheaper than the big lift and it arrives sooner.',
        visual: 'Neighbours stop to talk at the gate.' },
      { key: 'full', seconds: 13, name: 'Nobody drives across town', emoji: '🚶', kind: 'conditional', archetype: 'conditional', mult: 1.5,
        share: (s, m) => (m.team > 0 ? Math.min(1, Math.sqrt(m.work / m.team)) : 1), label: 'the fuller the rounds are',
        blurb: 'Everything earns up to half as much again, in full once there is a round’s worth of work for everybody.',
        question: 'Pays for taking the work on before you hire for it.',
        visual: 'The carers on the street stop walking between streets.' },
    ],
    // Half a run of saving: the things you plan for.
    [
      { key: 'work', seconds: 20, name: 'Every door on the books', emoji: '🏠', kind: 'side', archetype: 'synergy', side: 'work', flat: 0.6,
        blurb: `${where}: all of your work brings in half as much again.`, question: 'The work-side twin. Which side are you feeding?',
        visual: 'The lights come on behind every door at once.' },
      { key: 'rate2', seconds: 26, name: 'Paid what the work is worth', emoji: '💷', kind: 'value', archetype: 'rate', mult: 2,
        blurb: `${where}: every visit is worth twice as much again.`, question: 'Doubles the value of everything a second time. Save for it.',
        visual: 'The coins coming into the office get bigger again.' },
      { key: 'mile', seconds: 34, name: 'Every tenth counts for more', emoji: '🎖️', kind: 'milestone', archetype: 'milestone', add: 0.25,
        blurb: 'Every ten of anything you own is worth a quarter more again.', question: 'Every ten you have ever bought is worth more, and so is every ten still to come.',
        visual: 'More bunting over the office than last time.' },
      { key: 'gaps', seconds: 24, name: 'Cover the gaps', emoji: '🫱', kind: 'conditional', archetype: 'conditional', sideFloor: 0.8, mult: 1,
        share: () => 1, label: 'whatever shape the round is in',
        blurb: 'Your thinner side counts for nearly as much as your fuller one. An uneven round still gets its visits done.',
        question: 'The only thing in the game that forgives an uneven round. Worth most when you have gone all one way.',
        visual: 'Carers walk from the full end of the street to the empty end.' },
      { key: 'syn2', seconds: 30, name: `And the other half of it`, emoji: '🔗', kind: 'synergy', archetype: 'synergy',
        fromSide: side === 'team' ? 'work' : 'team', to: side === 'team' ? '*work' : '*team', per: 0.01, cap: 2,
        blurb: `Whichever part of your ${side === 'team' ? 'work' : 'team'} you have most of makes all the rest better – the more of them you have, the bigger the lift.`,
        question: 'The same deal for the side the stage did not bring.',
        visual: 'The other half of the street fills up to match.' },
      { key: 'allday', seconds: 22, name: 'Out on the round all day', emoji: '🥾', kind: 'click', archetype: 'click', mult: 3, pct: 0.005,
        blurb: 'Your own visits are worth three times as much, and they keep earning a little on their own even while you are not tapping.',
        question: 'The big one for anybody who actually taps. Wasted if you do not.',
        visual: 'Your own carer never goes back to the office.' },
      { key: 'level', seconds: 28, name: 'A round that fits', emoji: '⚖️', kind: 'conditional', archetype: 'conditional', mult: 1.7,
        share: (s, m) => (m.work > 0 && m.team > 0 ? Math.min(1, Math.min(m.work, m.team) / Math.max(m.work, m.team)) : 0),
        label: 'the closer your two sides are to level',
        blurb: 'Everything earns up to two thirds more, in full when the work and the team match each other.',
        question: 'The opposite of everything else on this shelf: it pays for keeping the two sides even.',
        visual: 'The balance strip in the office sits dead level.' },
    ],
    // The top of the shelf: reached on a run you carry on with.
    [
      { key: 'work2', seconds: 43, name: 'The books keep filling', emoji: '📗', kind: 'side', archetype: 'synergy', side: 'work', flat: 0.7,
        blurb: `${where}: all of your work brings in two thirds more.`, question: 'The second big lift for the work side. You will not afford both of them and the shop below.',
        visual: 'Another light behind every door on the street.' },
      { key: 'broad', seconds: 51, name: 'A bit of everything', emoji: '🧩', kind: 'conditional', archetype: 'conditional', mult: 1.6,
        share: (s) => Math.min(1, Object.values(s.buildings).filter((n) => n >= 25).length / Math.max(6, Math.round(unlockedRungs(s) * 0.55))),
        label: 'the more different things you own twenty-five of',
        wants: (s) => Math.max(6, Math.round(unlockedRungs(s) * 0.55)),
        blurb: 'Everything earns up to half as much again, in full once you own twenty-five each of more than half the rungs you have.',
        question: 'Pays for going broad rather than deep. Nothing else in the game asks for that.',
        visual: 'A little of everything on the street at once.' },
      { key: 'all2', seconds: 60, name: 'The whole patch lifts again', emoji: '🌟', kind: 'global', archetype: 'rate', mult: 1.8,
        blurb: `${where}: everything you own earns nearly twice as much again.`, question: 'The last thing on the shelf here, and the biggest.',
        visual: 'Every light on the horizon burns a little brighter.' },
      { key: 'books', seconds: 47, name: 'On the books already', emoji: '📚', kind: 'discount', archetype: 'discount', bulkPrice: 25,
        blurb: 'Everything is priced as though you owned twenty-five fewer of it, for the rest of this run.',
        question: 'The dearer the thing, the more this saves you. It never stops paying.',
        visual: 'The office filing cabinet gains a drawer.' },
      { key: 'team2', seconds: 45, name: 'Everybody trained up', emoji: '🎓', kind: 'side', archetype: 'synergy', side: 'team', flat: 0.7,
        blurb: `${where}: your whole team gets two thirds more done.`, question: 'The team side’s second lift, and the dearer of the pair.',
        visual: 'Certificates go up along the office wall.' },
      { key: 'rate3', seconds: 55, name: 'An agreement of your own', emoji: '🏛️', kind: 'value', archetype: 'rate', mult: 2.2,
        blurb: `${where}: every visit is worth more than twice as much.`, question: 'The biggest single lift a stage ever offers. Save the run for it.',
        visual: 'A framed agreement hangs behind the office desk.' },
      { key: 'milebig', seconds: 58, name: 'Every tenth is a milestone', emoji: '🏅', kind: 'milestone', archetype: 'milestone', add: 0.35,
        blurb: 'Every ten of anything you own is worth a third more again.',
        question: 'The biggest milestone lift there is, and it touches everything you will ever buy.',
        visual: 'Bunting from the office all the way down the street.' },
    ],
  ];

  // Three from each band, chosen by the stage, so the twelve differ from one stage to the next.
  const shelf = bands.flatMap((band, b) => {
    const turn = (level * 2 + b * 3) % band.length;
    return [0, 1, 2].map((k) => band[(turn + k) % band.length]).sort((x, y) => x.seconds - y.seconds);
  });

  const out = shelf.map((item, i) => {
    const { key, seconds, ...rest } = item;
    // Which of the twelve turns up when is shuffled a little from stage to stage, within bands of
    // three so the price and the moment still match, so a new stage does not arrive in exactly the
    // order the last one did.
    const along = 0.02 + (0.92 - 0.02) * (shelfOrder(level)[i] / (shelf.length - 1));
    return {
      ...rest,
      id: `stage-${level}-${key}`,
      icon: rest.icon || rest.emoji,
      costSeconds: seconds,
      along,                      // how far along the run it turns up, which is also what it costs
      // How far the takings have to have climbed before this one is on the shelf.
      unlock: (s) => Math.log10(1 + Math.max(0, s.runEarned)) >= Math.log10(1 + runTargetOf(s)) * along,
    };
  });

  // Past the printed table, the two new rungs of the stage bring their own kit.
  if (level >= LEVELS.length) {
    const first = (level - LEVELS.length + 1) * BEYOND_PER_LEVEL - 1;
    for (let r = 0; r < BEYOND_PER_LEVEL; r++) {
      const b = beyondBuilding(first + r);
      FAR_KIT.forEach((name, i) => {
        out.push({
          id: `${b.id}-t${i + 1}`, name: `${name} ${first + r}`, emoji: b.emoji, kind: 'building', building: b.id,
          costSeconds: [5, 18, 55][i] * (r + 1), archetype: 'kit', icon: b.emoji, mult: TIER_MULT[i],
          blurb: `${b.plural} are ${TIER_MULT[i] === 2 ? 'twice' : `${TIER_MULT[i]} times`} as good.`,
          visual: `${name} on every ${b.name.toLowerCase()}, counted on the horizon.`,
          question: `Worth it once you own a lot of ${b.plural.toLowerCase()}.`,
          unlock: (s) => (s.buildings[b.id] || 0) >= TIER_AT[i],
        });
      });
    }
  }
  STAGE_CACHE.set(level, out);
  return out;
}

/**
 * Everything buyable at a stage: the printed list, the shelf belonging to THIS stage, and the kit
 * for every far rung you can buy. Only one shelf is ever open at a time – a run that could sweep up
 * six stages' worth of shelves would multiply its own income by more than the stage ever asked for.
 */
export function upgradesFor(level) {
  // Past the sixth stage the first rungs' kit, the first two rounds of your own, and the first
  // rate rise are things a patch this size has long outgrown. Buying them again every single run
  // made the first minute of every run identical for ever.
  const out = UPGRADES.filter((u) => level < 6 || !OUTGROWN.has(u.id));
  if (level >= 1) out.push(...stageUpgrades(level).filter((u) => !isFarKit(u)));
  for (let l = LEVELS.length; l <= level; l++) out.push(...stageUpgrades(l).filter(isFarKit));
  return out;
}
const OUTGROWN = new Set(['client-t1', 'carer-t1', 'keysafe-t1', 'package-t1', 'car-t1', 'click-1', 'click-2', 'val-private']);
const isFarKit = (u) => u.archetype === 'kit' && u.id.startsWith('beyond-');

/** Look up any upgrade by id, including the endless ones that are worked out on demand. */
export function upgradeById(id) {
  const known = UPGRADES_BY_ID.get(id);
  if (known) return known;
  const stage = /^stage-(\d+)-/.exec(id);
  if (stage) return stageUpgrades(Number(stage[1])).find((u) => u.id === id);
  const far = /^beyond-(\d+)-t\d$/.exec(id);
  if (!far) return undefined;
  const n = Number(far[1]);
  return stageUpgrades(LEVELS.length + Math.ceil(n / BEYOND_PER_LEVEL) - 1).find((u) => u.id === id);
}

/** The little icon an upgrade pins on the office noticeboard. */
export function upgradeIcon(id) {
  const u = upgradeById(id);
  return UPGRADE_ICONS[id] || (u && u.icon) || null;
}

/** Achievements. Each one earned adds 1% to everything – the team's morale. */
export const ACHIEVEMENTS = [
  // Six for the second half of a session, where there used to be an eighteen-minute gap with
  // nothing to earn.
  { id: 'even-round', name: 'A tidy round', emoji: '🧮', blurb: 'Own twenty-five of every single thing you have unlocked.', test: (s) => Object.keys(s.buildings).length >= 6 && Object.values(s.buildings).every((n) => n >= 25) },
  { id: 'own-quarter', name: 'A quarter of it yourself', emoji: '🚶‍♀️', blurb: 'Earn a quarter of your income from your own visits.', test: (s) => s.clicks >= 500 && s.upgrades.filter((id) => /^click-|-hands$/.test(id)).length >= 4 },
  { id: 'all-paying', name: 'Everything lines up', emoji: '🎯', blurb: 'Own five bonuses that pay more the better your round is set up.', test: (s) => s.upgrades.filter((id) => id.startsWith('cond-')).length >= 5 },
  { id: 'ten-overs', name: 'Ten patches on', emoji: '🔁', blurb: 'Hand the patch over ten times.', test: (s) => s.level >= 10 },
  { id: 'full-shelf', name: 'A shelf cleared', emoji: '🛒', blurb: 'Own forty upgrades at once.', test: (s) => s.upgrades.length >= 40 },
  { id: 'stayed-on', name: 'In no hurry', emoji: '🪑', blurb: 'Earn a hundred times what a stage asked for before handing over.', test: (s) => s.runTarget > 0 && s.runEarned >= s.runTarget * 100 },
  // Another twelve for the middle of a session, where an hour used to go by with nothing to earn.
  { id: 'shelf-six', name: 'Six off one shelf', emoji: '🗂️', blurb: 'Own six things a single stage brought with it.', test: (s) => s.upgrades.filter((id) => id.startsWith(`stage-${s.level}-`)).length >= 6 },
  { id: 'no-hands', name: 'It runs itself', emoji: '🖐️', blurb: 'Have the payments coming in on their own.', test: (s) => s.upgrades.includes('direct-debit') && s.level >= 6 },
  { id: 'past-mars', name: 'Past the red planet', emoji: '🪐', blurb: 'Reach the fifteenth stage.', test: (s) => s.level >= 15 },
  { id: 'level-pair', name: 'Evenly matched', emoji: '⚖️', blurb: 'Own the same number of carers as people to look after, past a hundred each.', test: (s) => (s.buildings.carer || 0) >= 100 && s.buildings.carer === s.buildings.client },
  { id: 'fifty-up', name: 'Fifty upgrades', emoji: '📦', blurb: 'Own fifty upgrades in one run.', test: (s) => s.upgrades.length >= 50 },
  { id: 'stars-fifty', name: 'Fifty stars', emoji: '✨', blurb: 'Earn fifty Legacy Stars.', test: (s) => s.starsEarned >= 50 },
  { id: 'stars-two', name: 'Two hundred stars', emoji: '💫', blurb: 'Earn two hundred Legacy Stars.', test: (s) => s.starsEarned >= 200 },
  { id: 'twenty-over', name: 'Twenty patches on', emoji: '🔂', blurb: 'Hand the patch over twenty times.', test: (s) => s.level >= 20 },
  { id: 'both-sides', name: 'Both ends of the street', emoji: '🏘️', blurb: 'Own a hundred each of four different things.', test: (s) => Object.values(s.buildings).filter((n) => n >= 100).length >= 4 },
  { id: 'first-visit', name: 'First footsteps', emoji: '👣', blurb: 'Do your first visit.', test: (s) => s.visits >= 1 },
  { id: 'tea-round', name: 'Tea round', emoji: '☕', blurb: 'Do 100 visits yourself.', test: (s) => s.clicks >= 100 },
  { id: 'busy-bee', name: 'Busy bee', emoji: '🐝', blurb: 'Do 1,000 visits yourself.', test: (s) => s.clicks >= 1000 },
  { id: 'click-hero', name: 'Hands of steel', emoji: '💪', blurb: 'Do 10,000 visits yourself.', test: (s) => s.clicks >= 10000 },
  { id: 'first-hire', name: 'Welcome aboard', emoji: '🎉', blurb: 'Take on your first carer.', test: (s) => (s.buildings.carer || 0) >= 1 },
  { id: 'first-client', name: 'The first front door', emoji: '🚪', blurb: 'Look after your first person.', test: (s) => (s.buildings.client || 0) >= 1 },
  { id: 'first-safe', name: 'Every door has a key box', emoji: '🔑', blurb: 'Fit your first key safe.', test: (s) => (s.buildings.keysafe || 0) >= 1 },
  { id: 'street', name: 'The whole street', emoji: '🏘️', blurb: 'Look after 10 people.', test: (s) => (s.buildings.client || 0) >= 10 },
  { id: 'neighbourhood', name: 'The neighbourhood', emoji: '🏙️', blurb: 'Look after 100 people.', test: (s) => (s.buildings.client || 0) >= 100 },
  { id: 'team-10', name: 'A proper team', emoji: '👥', blurb: 'Have 10 carers.', test: (s) => (s.buildings.carer || 0) >= 10 },
  { id: 'team-50', name: 'A big family', emoji: '🏡', blurb: 'Have 50 carers.', test: (s) => (s.buildings.carer || 0) >= 50 },
  { id: 'team-100', name: 'A hundred hands', emoji: '🙌', blurb: 'Have 100 carers.', test: (s) => (s.buildings.carer || 0) >= 100 },
  { id: 'balanced', name: 'Nicely balanced', emoji: '⚖️', blurb: 'Have exactly as many carers as people to look after.', test: (s) => (s.buildings.carer || 0) > 0 && (s.buildings.carer || 0) === (s.buildings.client || 0) },
  { id: 'fleet', name: 'Fleet manager', emoji: '🚗', blurb: 'Own 25 care cars.', test: (s) => (s.buildings.car || 0) >= 25 },
  { id: 'badge-coordinator', name: 'Somebody holds the rota', emoji: '🗂️', blurb: 'Take on a care coordinator.', test: (s) => (s.buildings.coordinator || 0) >= 1 },
  { id: 'badge-office', name: 'Open for business', emoji: '🏢', blurb: 'Open a branch office.', test: (s) => (s.buildings.office || 0) >= 1 },
  { id: 'badge-framework', name: 'On the list', emoji: '📜', blurb: 'Win a place on the county framework.', test: (s) => (s.buildings.framework || 0) >= 1 },
  { id: 'badge-nurse', name: 'Nurses on the round', emoji: '🧑‍⚕️', blurb: 'Start a nurse-led team.', test: (s) => (s.buildings.nurse || 0) >= 1 },
  { id: 'badge-world', name: 'Around the world', emoji: '🌐', blurb: 'Take care worldwide.', test: (s) => (s.buildings.world || 0) >= 1 },
  { id: 'space', name: 'To infinity', emoji: '🚀', blurb: 'Launch a care starship.', test: (s) => (s.buildings.starship || 0) >= 1 },
  { id: 'good', name: 'Rated Good', emoji: '✅', blurb: 'Be rated Good.', test: (s, m) => m.ratingIndex >= 1 },
  { id: 'outstanding', name: 'Outstanding', emoji: '🌟', blurb: 'Be rated Outstanding.', test: (s, m) => m.ratingIndex >= 2 },
  { id: 'every-question', name: 'Every question', emoji: '🏆', blurb: 'Be rated Outstanding on every question.', test: (s, m) => m.ratingIndex >= 3 },
  { id: 'tenth', name: 'Ten of something', emoji: '🎂', blurb: 'Own ten of anything.', test: (s) => Object.values(s.buildings).some((n) => n >= 10) },
  { id: 'hundredth', name: 'A hundred of something', emoji: '💯', blurb: 'Own a hundred of anything.', test: (s) => Object.values(s.buildings).some((n) => n >= 100) },
  { id: 'earn-1k', name: 'The first thousand', emoji: '💷', blurb: 'Earn £1,000 in one run.', test: (s) => s.runEarned >= 1e3 },
  { id: 'earn-1m', name: 'A million pounds of care', emoji: '💰', blurb: 'Earn £1 million in one run.', test: (s) => s.runEarned >= 1e6 },
  { id: 'earn-1b', name: 'A billion', emoji: '🏦', blurb: 'Earn £1 billion in one run.', test: (s) => s.runEarned >= 1e9 },
  { id: 'earn-1t', name: 'A trillion', emoji: '🪙', blurb: 'Earn £1 trillion in one run.', test: (s) => s.runEarned >= 1e12 },
  { id: 'collector', name: 'Chasing invoices', emoji: '🧾', blurb: 'Collect the payments by hand 25 times.', test: (s) => s.collections >= 25 },
  { id: 'prismatic-1', name: 'Over the rainbow', emoji: '🌈', blurb: 'Meet a prismatic carer.', test: (s) => s.prismaticsMet >= 1 },
  { id: 'prismatic-7', name: 'Rainbow collector', emoji: '🦄', blurb: 'Meet 7 prismatic carers.', test: (s) => s.prismaticsMet >= 7 },
  { id: 'cards-5', name: 'A fridge full of cards', emoji: '💌', blurb: 'Open 5 thank-you cards.', test: (s) => s.cardsOpened >= 5 },
  { id: 'cards-25', name: 'A local treasure', emoji: '🏅', blurb: 'Open 25 thank-you cards.', test: (s) => s.cardsOpened >= 25 },
  { id: 'branch-1', name: 'Made your mind up', emoji: '🤝', blurb: 'Choose who you work for.', test: (s) => !!(s.branches && s.branches.buyer) },
  { id: 'branch-all', name: 'Known for something', emoji: '🏅', blurb: 'Make all three big choices in one run.', test: (s) => !!(s.branches && s.branches.buyer && s.branches.growth && s.branches.known) },
  { id: 'expand-1', name: 'Growing up', emoji: '🏘️', blurb: 'Hand over and start again bigger.', test: (s) => s.level >= 1 },
  { id: 'expand-3', name: 'County champion', emoji: '🗺️', blurb: 'Reach the county.', test: (s) => s.level >= 3 },
  { id: 'expand-6', name: 'A world of care', emoji: '🌐', blurb: 'Care for the whole world.', test: (s) => s.level >= 6 },
  { id: 'stars-10', name: 'Starry-eyed', emoji: '⭐', blurb: 'Earn 10 Legacy Stars.', test: (s) => s.starsEarned >= 10 },
  { id: 'stars-100', name: 'A skyful of stars', emoji: '🌌', blurb: 'Earn 100 Legacy Stars.', test: (s) => s.starsEarned >= 100 },
  { id: 'all-upgrades', name: 'Fully kitted', emoji: '🧰', blurb: 'Own 25 upgrades in one run.', test: (s) => s.upgrades.length >= 25 },
  { id: 'welcome-back', name: 'Welcome back', emoji: '🛏️', blurb: 'Come back to find the team has been busy.', test: (s) => s.offlineReturns >= 1 },
  { id: 'night-owl', name: 'Night owl', emoji: '🦉', blurb: 'Play after ten at night.', test: (s) => s.playedLate },
  { id: 'team-500', name: 'Five hundred hands', emoji: '🖐️', blurb: 'Have 500 carers.', test: (s) => (s.buildings.carer || 0) >= 500 },
  { id: 'street-1000', name: 'A thousand front doors', emoji: '🏙️', blurb: 'Look after 1,000 people.', test: (s) => (s.buildings.client || 0) >= 1000 },
  { id: 'safes-500', name: 'Keys for everybody', emoji: '🗝️', blurb: 'Fit 500 key safes.', test: (s) => (s.buildings.keysafe || 0) >= 500 },
  { id: 'kit-full', name: 'Everything upgraded', emoji: '🧰', blurb: 'Own 60 upgrades in one run.', test: (s) => s.upgrades.length >= 60 },
  { id: 'earn-1qa', name: 'A thousand billion billion', emoji: '💫', blurb: 'Earn a thousand billion billion pounds in one run.', test: (s) => s.runEarned >= 1e15 },
  { id: 'earn-1sx', name: 'A trillion billion', emoji: '🌠', blurb: 'Earn a trillion billion pounds in one run.', test: (s) => s.runEarned >= 1e21 },
  { id: 'expand-9', name: 'Red planet', emoji: '🔴', blurb: 'Reach Mars.', test: (s) => s.level >= 9 },
  { id: 'expand-12', name: 'Further still', emoji: '✨', blurb: 'Go three stages past Mars.', test: (s) => s.level >= 12 },
  { id: 'stars-250', name: 'A whole sky', emoji: '🌌', blurb: 'Earn 250 Legacy Stars.', test: (s) => s.starsEarned >= 250 },
  { id: 'perks-all', name: 'Every last perk', emoji: '🎁', blurb: 'Own all ten Legacy perks.', test: (s) => s.perks.filter((id) => !/^legacy-/.test(id)).length >= 10 },
  { id: 'legacy-3', name: 'The name goes further', emoji: '🌟', blurb: 'Buy three of the endless Legacy perks.', test: (s) => s.perks.filter((id) => /^legacy-/.test(id)).length >= 3 },
  { id: 'expand-16', name: 'Out past the last light', emoji: '🌌', blurb: 'Reach the seventh stage past Mars.', test: (s) => s.level >= 16 },
  { id: 'expand-20', name: 'No end to it', emoji: '♾️', blurb: 'Reach the eleventh stage past Mars.', test: (s) => s.level >= 20 },
  { id: 'earn-1no', name: 'A billion billion billion', emoji: '🪐', blurb: 'Earn a billion billion billion pounds in one run.', test: (s) => s.runEarned >= 1e30 },
  { id: 'clicks-25k', name: 'Still on the round', emoji: '🤲', blurb: 'Do 25,000 visits yourself.', test: (s) => s.clicks >= 25000 },
  { id: 'far-kit', name: 'Kitted out past Mars', emoji: '✨', blurb: 'Buy kit for four of the things out past the starship.', test: (s) => s.upgrades.filter((id) => /^beyond-\d+-t/.test(id)).length >= 4 },
  { id: 'stars-500', name: 'Half a thousand stars', emoji: '⭐', blurb: 'Earn 500 Legacy Stars.', test: (s) => s.starsEarned >= 500 },
  { id: 'long-haul', name: 'Twelve hours in', emoji: '🕰️', blurb: 'Keep the same business going for twelve hours.', test: (s, m, now = Date.now()) => now - s.startedAt >= 12 * 3600e3 },
  { id: 'beyond', name: 'Past the starship', emoji: '🪐', blurb: 'Buy something past the care starship.', test: (s) => Object.keys(s.buildings).some((id) => id.startsWith('beyond-')) },
];
export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** What clicking a prismatic carer can do. Weights are relative. */
export const PRISMATIC_EFFECTS = [
  { id: 'rainbow-rush', weight: 30, name: 'Rainbow rush', emoji: '🌈', seconds: 30, prodMult: 7, describe: (n) => `${n} is flying today – everything earns 7 times as much for 30 seconds!` },
  { id: 'click-frenzy', weight: 22, name: 'Everyone is in', emoji: '⚡', seconds: 15, clickMult: 77, describe: (n) => `${n} says the kettle is on at every house – your own visits are worth 77 times as much for 15 seconds!` },
  { id: 'care-burst', weight: 28, name: 'A good week', emoji: '💝', instant: true, describe: (n) => `${n}’s round went so well the council released extra hours – paid in full.` },
  { id: 'lucky-hire', weight: 20, name: 'Something worth keeping', emoji: '🦄', permanent: true, describe: (n) => `Everyone picked something up from ${n}’s shift, and it stuck – everything earns 3% more, for good.` },
];

/** What a thank-you card can do. */
export const CARD_EFFECTS = [
  { id: 'card-cash', weight: 60, name: 'A thank-you card', emoji: '💌', instant: true, describe: () => 'A card with lovely handwriting. It went straight up on the wall, and two neighbours rang the same afternoon.' },
  { id: 'double-time', weight: 40, name: 'Everyone is buzzing', emoji: '⏩', seconds: 45, prodMult: 2, describe: () => 'That card went up on the wall. Everything earns twice as much for 45 seconds!' },
];

/** Fallback names when the program has no carers on its books yet. */
export const FALLBACK_NAMES = ['Sam', 'Alex', 'Jo', 'Robin', 'Charlie', 'Ash', 'Morgan', 'Jamie', 'Frankie', 'Riley', 'Casey', 'Drew'];

/** The part of the day the street is in. Flavour and scenery only – it never changes the money. */
export const DAY_PARTS = [
  { id: 'morning', name: 'Morning calls', emoji: '🌅', from: 0.0 },
  { id: 'lunch', name: 'Lunch calls', emoji: '🍲', from: 0.3 },
  { id: 'tea', name: 'Tea calls', emoji: '🫖', from: 0.55 },
  { id: 'bed', name: 'Bed calls', emoji: '🌙', from: 0.75 },
  { id: 'night', name: 'Night sits', emoji: '🌜', from: 0.9 },
];

/** News ticker. {n} = a carer's name, {co} = the company name. The joke is never a person. */
export const TICKER = [
  'The printer has been fixed. Nobody is sure who by.',
  '{n} has been offered a fourth cup of tea today and is considering it.',
  'The rota app has learned to say "no" to Mondays.',
  '{n} found the good biscuits. Everybody is in a better mood.',
  'A cat has appointed {n} as its official chair-warmer.',
  'Breaking: nobody at {co} has lost the office keys this week.',
  'The kettle in the office has been descaled. There was applause.',
  'Weather update: it is raining sideways. {n} brought spare socks for everyone.',
  'The care cars have had their signs put on straight. Finally.',
  '{n} completed a round, a crossword and a jigsaw before lunch.',
  'Rumour has it a prismatic carer was seen shimmering near the tea trolley.',
  'Thank-you cards now cover the whole fridge door. A second fridge has been ordered.',
  '{n} has been voted most likely to remember everybody’s birthday.',
  'The training academy graduated its first class. Cake was involved.',
  'All key safes on the patch are reporting for duty.',
  '{n} says the secret to good care is listening. And biscuits.',
  'Someone has labelled the office milk. The investigation continues.',
  'The whiteboard rota has been colour-coded. It is beautiful.',
  '{co} is now a household name in households it has never visited.',
  '{n} has started a book club. Attendance: everyone.',
  'Office dog update: still a very good dog.',
  'The on-call phone rang once last night, and it was a wrong number.',
  'Somebody left a lovely review. Everyone read it twice.',
  '{n} would like it known that the printer is, in fact, working now.',
  'The new lanyards have arrived and they are the good stretchy kind.',
  'A family dropped in a tin of shortbread. It lasted eleven minutes.',
  'The county inspector said the care plans were the best they had seen.',
  'Somebody put a plant in the office window. It is thriving.',
  '{n} reversed the car into exactly the right spot, first go, in the dark.',
  'The stationery cupboard has been reorganised. It will not last.',
  'Nobody has mentioned the fifteen-minute call since we stopped doing them.',
  '{n} has learned every gate latch on the estate by feel.',
  // Lines that only make sense once you have the thing they are about. `when` is checked by the view.
  { when: (s) => (s.buildings.keysafe || 0) >= 25, text: 'Nobody has stood on a doorstep in the rain this week. The key safes are earning their keep.' },
  { when: (s) => (s.buildings.package || 0) >= 20, text: 'Every care plan on the patch has been reviewed and signed. {n} did the last twelve.' },
  { when: (s) => (s.buildings.directpay || 0) >= 10, text: 'A family rang to say they chose {co} themselves, and would do it again.' },
  { when: (s) => (s.buildings.council || 0) >= 5, text: 'The council uplift came through. It only took four emails and a phone call.' },
  { when: (s) => (s.buildings.discharge || 0) >= 3, text: 'Somebody came home from the ward at teatime. The heating was already on.' },
  { when: (s) => (s.buildings.coordinator || 0) >= 10, text: 'The rota went out on Thursday for once, and nobody had to swap a single call.' },
  { when: (s) => (s.buildings.supervisor || 0) >= 5, text: '{n} did a spot check and came back saying they would want that carer for their own mum.' },
  { when: (s) => (s.buildings.academy || 0) >= 3, text: 'Six people passed their moving and handling today. Two of them were terrified of the hoist last month.' },
  { when: (s) => (s.buildings.chc || 0) >= 3, text: 'The clinical lead signed off a delegated healthcare task. It went perfectly.' },
  { when: (s) => (s.buildings.nurse || 0) >= 2, text: 'The nurse-led team took a call at 3am, and everybody slept fine afterwards.' },
  { when: (s) => (s.buildings.tech || 0) >= 3, text: 'A kettle sensor said all was well at 7:04, as it has every morning for a year.' },
  { when: (s) => s.upgrades.includes('ecm'), text: 'Every call logged itself in and out today. Not one paper timesheet.' },
  { when: (s) => s.upgrades.includes('qual-hours'), text: 'The guaranteed hours went live. Three people have booked a holiday already.' },
  { when: (s) => s.level >= 5, text: '{co} has been asked to speak at a conference. {n} is writing the slides on the bus.' },
  { when: (s) => s.level >= 7, text: 'Mission control confirms the tea was brewed at the correct altitude.' },
  { when: (s) => s.level >= 9, text: 'The Martian shortbread experiment is going better than anyone hoped.' },
];
