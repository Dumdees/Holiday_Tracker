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
export const MILESTONES = [10, 25, 50, 100, 200, 400, 700, 1000, 1500, 2500];

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
const BEYOND_NAMES = ['Ring station', 'Deep space round', 'Colony ward', 'Wandering hospice', 'Long-haul round', 'Home from home'];
/** Two new rungs at every stage past the printed ladder, the same as the stages in the table. */
export const BEYOND_PER_LEVEL = 2;
export function beyondBuilding(n) {
  const last = BUILDINGS[BUILDINGS.length - 1];
  const name = `${BEYOND_NAMES[(n - 1) % BEYOND_NAMES.length]}${n > BEYOND_NAMES.length ? ` ${Math.ceil(n / BEYOND_NAMES.length)}` : ''}`;
  return {
    id: `beyond-${n}`, side: n % 2 ? 'work' : 'team', name, plural: `${name}s`, emoji: n % 2 ? '🪐' : '✨',
    baseCost: last.baseCost * Math.pow(8, n), rate: last.rate * Math.pow(4, n),
    level: 9 + Math.ceil(n / BEYOND_PER_LEVEL),
    blurb: 'Further out than anyone has taken a hot meal, and still on time.',
    visual: 'Another light joins the ones on the horizon.',
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
export function levelInfo(level) {
  if (level < LEVELS.length) return LEVELS[level];
  const n = level - LEVELS.length + 1;
  return { level, name: `Star system ${n}`, emoji: '✨', threshold: LEVELS[LEVELS.length - 1].threshold * Math.pow(200, n), tagline: 'Further than anyone has ever brought a hot meal.' };
}

/** How good the service is judged to be. Derived from what you invest in, never from luck. */
export const RATINGS = [
  { id: 'new', name: 'Newly registered', emoji: '🆕', mult: 1, score: 0, blurb: 'Registered and ready. The rating comes with the work.' },
  { id: 'good', name: 'Good', emoji: '✅', mult: 1.2, score: 6, blurb: 'Safe, caring, well led. Everything earns 20% more.' },
  { id: 'great', name: 'Outstanding', emoji: '🌟', mult: 1.6, score: 120, blurb: 'Outstanding in one of the five questions. Everything earns 60% more.' },
  { id: 'best', name: 'Outstanding, every question', emoji: '🏆', mult: 2.4, score: 2000, blurb: 'Outstanding across the board. Everything earns 140% more.' },
];

/** What counts towards the rating: the things a real service invests in to be well led. */
export const RATING_WEIGHTS = { coordinator: 1, supervisor: 3, academy: 8, nurse: 12, office: 2 };
export const RATING_UPGRADE_POINTS = 6; // each quality upgrade owned

/** Permanent perks bought with Legacy Stars. */
export const PERKS = [
  { id: 'perk-admin', name: 'Head office', emoji: '🏛️', cost: 2, blurb: 'Every new run starts with the payments collected for you.' },
  { id: 'alumni', name: 'Alumni network', emoji: '🎓', cost: 5, blurb: 'Start each run with 5 carers and 5 people to look after.' },
  { id: 'magnet', name: 'Prismatic magnet', emoji: '🌈', cost: 9, blurb: 'Prismatic carers appear twice as often.' },
  { id: 'cards', name: 'Card collector', emoji: '💌', cost: 12, blurb: 'Thank-you cards appear twice as often.' },
  { id: 'playbook', name: 'Franchise playbook', emoji: '📘', cost: 18, blurb: 'Everything costs 10% less.' },
  { id: 'nightshift', name: 'Night team', emoji: '🌙', cost: 26, blurb: 'Earn at full speed while the game is closed, instead of half.' },
  { id: 'legend', name: 'Living legend', emoji: '🏆', cost: 38, blurb: 'Your own visits are ten times stronger.' },
  { id: 'momentum', name: 'Momentum', emoji: '⚡', cost: 55, blurb: 'Start each run with 25 carers, 25 people to look after and 5 cars.' },
  { id: 'warmwelcome', name: 'A name people know', emoji: '💛', cost: 80, blurb: 'Every new run starts already rated Good.' },
  { id: 'founders', name: 'Founder’s share', emoji: '🕰️', cost: 120, blurb: 'Every hand-over is worth a quarter more Legacy Stars.' },
];

/**
 * And then it keeps going. Each one of these costs twice the last, so there is always something
 * left to save Stars for, however many hand-overs you have behind you.
 */
export function legacyPerk(n) {
  return {
    id: `legacy-${n}`, emoji: '🌟', cost: 200 * Math.pow(2, n - 1), endless: true,
    name: n === 1 ? 'The name goes further' : `The name goes further (${n})`,
    blurb: 'Everything earns 30% more, for ever.',
  };
}

// ---------- Upgrades ----------
// Every upgrade has a `kind` the engine knows how to fold in, and a `question` – the one line that
// says why you might buy this one before the others.

const TIER_AT = [10, 60, 300];          // how many you must own for each tier to appear
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
      blurb: `${b.plural} are ${TIER_MULT[i] === 2 ? 'twice' : `${TIER_MULT[i]} times`} as good.`,
      visual: `${TIER_NAMES[b.id][i]} ${TIER_WHERE[b.id]}.`,
      question: `Doubles a rung you already own – worth it only if you own a lot of ${b.plural.toLowerCase()}.`,
      unlock: (s) => (s.buildings[b.id] || 0) >= count,
    });
  });
}

/** Synergies: one thing quietly making another thing better. Capped, so nothing runs away. */
const SYNERGIES = [
  { id: 'syn-keysafe-carer', name: 'Keys in the box', emoji: '🔑', from: 'keysafe', to: '*team', per: 0.012, cap: 1.5, cost: 3000, unlock: (s) => (s.buildings.keysafe || 0) >= 5, blurb: 'Every key safe makes the whole team 1.2% better, up to +150%.', question: 'Pays off if you keep fitting key safes – dead weight if you do not.' },
  { id: 'syn-car-carer', name: 'Wheels under everyone', emoji: '🚗', from: 'car', to: '*team', per: 0.015, cap: 2, cost: 90000, unlock: (s) => (s.buildings.car || 0) >= 5, blurb: 'Every care car makes the whole team 1.5% better, up to +200%.', question: 'Turns a fleet into a workforce boost – only if the fleet keeps growing.' },
  { id: 'syn-package-client', name: 'Everything written down', emoji: '📋', from: 'package', to: '*work', per: 0.015, cap: 2, cost: 40000, unlock: (s) => (s.buildings.package || 0) >= 5, blurb: 'Every care package makes all of your work 1.5% better, up to +200%.', question: 'The work-side twin of the key safe deal: which side are you growing?' },
  { id: 'syn-coord-carer', name: 'Somebody holding the rota', emoji: '🗂️', from: 'coordinator', to: '*team', per: 0.025, cap: 3, cost: 2.4e6, unlock: (s) => (s.buildings.coordinator || 0) >= 3, blurb: 'Every coordinator makes the whole team 2.5% better, up to +300%.', question: 'The strongest team boost in the game, if you can afford coordinators.' },
  { id: 'syn-council-package', name: 'Volume from the council', emoji: '🏛️', from: 'council', to: '*work', per: 0.03, cap: 3, cost: 9e6, unlock: (s) => (s.buildings.council || 0) >= 3, blurb: 'Every council contract makes all of your work 3% better, up to +300%.', question: 'Rewards going wide on contracts rather than deep on people.' },
  { id: 'syn-super-team', name: 'Steady hands everywhere', emoji: '🦺', from: 'supervisor', to: '*team', per: 0.01, cap: 1.5, cost: 6e7, unlock: (s) => (s.buildings.supervisor || 0) >= 3, blurb: 'Every field supervisor makes the whole team 1% better, up to +150%.', question: 'Lifts every team rung at once – the first true stacking upgrade.' },
  { id: 'syn-office-all', name: 'A branch behind you', emoji: '🏢', from: 'office', to: '*', per: 0.008, cap: 1.2, cost: 2.4e9, unlock: (s) => (s.buildings.office || 0) >= 3, blurb: 'Every branch office makes everything 0.8% better, up to +120%.', question: 'Small per office, but it touches every single thing you own.' },
  { id: 'syn-academy-team', name: 'Everyone trained properly', emoji: '🎓', from: 'academy', to: '*team', per: 0.02, cap: 3, cost: 9e10, unlock: (s) => (s.buildings.academy || 0) >= 3, blurb: 'Every training academy makes the whole team 2% better, up to +300%.', question: 'The late-game team engine. Needs academies to be worth anything.' },
  { id: 'syn-chc-nurse', name: 'Clinical confidence', emoji: '🩺', from: 'chc', to: '*work', per: 0.02, cap: 3, cost: 3.4e12, unlock: (s) => (s.buildings.chc || 0) >= 5, blurb: 'Every NHS-funded package makes all of your work 2% better, up to +300%.', question: 'Lifts the whole work side at once, if you have gone down the NHS road.' },
];

/** How many bits of kit are out on the patch, and how many make the patch feel looked after. */
export const KIT_FOR_TIDY = 12;
const kitCount = (s) => s.upgrades.filter((id) => /-t\d+$/.test(id)).length;

/** Bonuses that only apply while the board is in a certain state. Keep an eye on them. */
const CONDITIONALS = [
  // `share` returns 0..1: how much of the bonus is paying. It slides rather than switching off, so
  // taking on more work can never make you poorer, only dilute a bonus you were holding.
  { id: 'cond-covered', name: 'Nobody is rushed', emoji: '🫶', mult: 1.3, cost: 12000, archetype: 'conditional', share: (s, m) => (m.work > 0 ? Math.min(1, Math.sqrt(m.team / m.work)) : 1), label: 'the more of the work your team can cover', blurb: 'Everything earns up to 30% more, in full once your team can cover the work.', question: 'Rewards staffing ahead of the work – the opposite of chasing volume.', unlock: (s) => s.runEarned >= 6000 },
  { id: 'cond-continuity', name: 'The same carer, every time', emoji: '🤝', mult: 1.4, cost: 3e6, archetype: 'conditional', share: (s, m) => (m.work > 0 ? Math.min(1, Math.sqrt(m.team / (m.work * 1.25))) : 1), label: 'in full once your team is a quarter bigger than the work', blurb: 'Everything earns up to 40% more, in full once your team is 25% bigger than the work.', question: 'Deliberate slack: expensive to hold, and the biggest steady bonus there is.', unlock: (s) => s.upgrades.includes('cond-covered') },
  { id: 'cond-tidy', name: 'A tidy patch', emoji: '🧰', mult: 1.25, cost: 250000, archetype: 'conditional', share: (s) => Math.min(1, kitCount(s) / KIT_FOR_TIDY), label: 'the more of your kit is out on the patch', blurb: 'Everything earns up to 25% more, in full once you have twelve bits of kit out on the patch.', question: 'Makes every small bit of kit count twice: once for its own rung, and once for the whole patch.', unlock: (s) => (s.buildings.keysafe || 0) >= 10 },
  { id: 'cond-wellled', name: 'Well led', emoji: '🌟', mult: 1.35, cost: 4e8, archetype: 'conditional', share: (s, m) => (m.ratingIndex >= 2 ? 1 : 0), label: 'while you are rated Outstanding', blurb: 'While your rating is Outstanding, everything earns 35% more.', question: 'Turns the rating from a nice badge into a reason to keep training people.', unlock: (s) => (s.buildings.academy || 0) >= 1 },
];

/** The tenth of anything doubles it. These make that step bigger still. */
const MILESTONE_UPS = [
  { id: 'mile-1', name: 'We mark the tenth', emoji: '🎉', factor: 2.2, cost: 1.5e6, archetype: 'milestone', blurb: 'Every tenth of anything is worth 2.2 times instead of twice.', question: 'Multiplies every milestone you have ever passed, and every one to come.', unlock: (s) => Object.values(s.buildings).some((n) => n >= 25) },
  { id: 'mile-2', name: 'Long service all round', emoji: '🎖️', factor: 2.5, cost: 2e10, archetype: 'milestone', blurb: 'Every tenth of anything is worth 2.5 times instead of 2.2.', question: 'The single biggest number in the game if you own a lot of everything.', unlock: (s) => s.upgrades.includes('mile-1') && Object.values(s.buildings).some((n) => n >= 100) },
];

/** What a visit is worth: who is paying, and what you are trusted to do. */
const VALUES = [
  { id: 'val-private', name: 'Private clients', emoji: '💷', mult: 1.6, cost: 9000, blurb: 'Every visit is worth 60% more.', question: 'A flat, dependable boost – the safe pick when nothing else is close.', unlock: (s) => s.runEarned >= 4000 },
  { id: 'val-fair', name: 'A fair hourly rate', emoji: '⚖️', mult: 1.5, cost: 4e5, blurb: 'Every visit is worth 50% more.', question: 'Negotiated, not squeezed. Boring, reliable, always fine to buy.', unlock: (s) => s.runEarned >= 2e5 },
  { id: 'val-specialist', name: 'Specialist care', emoji: '🧠', mult: 1.7, cost: 3e7, blurb: 'Every visit is worth 70% more.', question: 'Big and flat. Compare it against a synergy you would have to keep feeding.', unlock: (s) => s.runEarned >= 1.5e7 },
  { id: 'val-nhs', name: 'NHS rates', emoji: '🩺', mult: 1.8, cost: 5e9, blurb: 'Every visit is worth 80% more.', question: 'The best flat multiplier of the mid game.', unlock: (s) => s.runEarned >= 2e9 },
  { id: 'val-reputation', name: 'A reputation worth paying for', emoji: '💖', mult: 1.9, cost: 8e11, blurb: 'Every visit is worth 90% more.', question: 'Late, expensive and unconditional.', unlock: (s) => s.runEarned >= 4e11 },
  { id: 'val-national', name: 'A national agreement', emoji: '🏛️', mult: 2, cost: 2e14, blurb: 'Every visit is worth twice as much.', question: 'The last of the flat ones, and the largest.', unlock: (s) => s.runEarned >= 1e14 },
];

/** Your own visits, done by hand. */
const CLICKS = [
  { id: 'click-1', name: 'A cup of tea and a chat', emoji: '☕', kind: 'click', cost: 25, blurb: 'Your own visits are worth twice as much.', question: 'Cheap, and doubles the only income you control directly.', unlock: (s) => s.clicks >= 5 },
  { id: 'click-2', name: 'Your own little round', emoji: '🚶', kind: 'click', cost: 1200, blurb: 'Your own visits are worth twice as much.', question: 'Only worth it if you actually enjoy tapping doors.', unlock: (s) => s.clicks >= 50 },
  { id: 'click-3', name: 'Hands on', emoji: '🤲', kind: 'clickpct', cost: 30000, blurb: 'Your own visits also earn 1% of what the team makes every second.', question: 'Turns your tapping into a share of the whole business.', unlock: (s) => s.clicks >= 150 },
  { id: 'click-4', name: 'Everyone knows you', emoji: '🌟', kind: 'click', mult: 3, cost: 2e6, blurb: 'Your own visits are worth three times as much.', question: 'The last big one for hand visits.', unlock: (s) => s.clicks >= 400 },
  { id: 'click-5', name: 'The founder still visits', emoji: '💐', kind: 'clickpct', pct: 0.03, cost: 4e8, blurb: 'Your own visits earn another 3% of the team’s income every second.', question: 'Late game: a few taps a second is a real share of the business.', unlock: (s) => s.clicks >= 900 },
  { id: 'click-6', name: 'They still ask for you', emoji: '💌', kind: 'clickpct', pct: 0.05, cost: 6e11, blurb: 'Your own visits earn another 5% of the team’s income every second.', question: 'Turns tapping doors into a strategy of its own, however big you get.', unlock: (s) => s.clicks >= 2500 },
];

/** Things that do a job for you. */
const AUTOMATION = [
  { id: 'admin', name: 'Office admin', emoji: '🗃️', kind: 'collect', cost: 120, blurb: 'The payments are collected for you every few seconds.', question: 'Stops you chasing invoices. Buy it early and forget it.', unlock: (s) => s.runEarned >= 40 },
  { id: 'ecm', name: 'Electronic call monitoring', emoji: '📲', kind: 'global', mult: 1.25, cost: 55000, blurb: 'Calls log themselves in and out. Everything earns 25% more.', question: 'Flat and early. Competes with your first synergy.', unlock: (s) => (s.buildings.package || 0) >= 5 },
  { id: 'direct-debit', name: 'Direct debit', emoji: '🏦', kind: 'collect', cost: 9000, blurb: 'Payments arrive the moment the visit is done.', question: 'No more waiting for the office admin’s five seconds.', unlock: (s) => s.upgrades.includes('admin') },
  { id: 'oncall', name: 'The on-call phone', emoji: '📞', kind: 'offline', cost: 1.2e7, blurb: 'While the game is closed you earn 80% of normal, for up to 12 hours.', question: 'Worth more the longer you leave the game alone.', unlock: (s) => s.offlineReturns >= 1 },
];

/** Cheaper things. Priced at about one and a half of the next one you would buy. */
const DISCOUNTS = [
  { id: 'disc-recruit', name: 'Refer a friend', emoji: '🫂', kind: 'discount', building: 'carer', factor: 0.85, cost: 9000, blurb: 'Carers cost 15% less, for good.', question: 'Only pays back if you are going to keep hiring.', unlock: (s) => (s.buildings.carer || 0) >= 40 },
  { id: 'disc-safes', name: 'Key safes by the box', emoji: '📦', kind: 'discount', building: 'keysafe', factor: 0.8, cost: 260000, blurb: 'Key safes cost 20% less, for good.', question: 'Key safes stay worth buying long after their own income has faded.', unlock: (s) => (s.buildings.keysafe || 0) >= 30 },
  { id: 'disc-mileage', name: 'Mileage sorted properly', emoji: '⛽', kind: 'discount', building: 'car', factor: 0.8, cost: 5.5e6, blurb: 'Care cars cost 20% less, for good.', question: 'Cars are the priciest thing you buy in bulk early on.', unlock: (s) => (s.buildings.car || 0) >= 25 },
  { id: 'disc-homes', name: 'Word gets round', emoji: '🗣️', kind: 'discount', building: 'client', factor: 0.85, cost: 12000, blurb: 'Taking on someone new costs 15% less, for good.', question: 'The work-side answer to Refer a friend.', unlock: (s) => (s.buildings.client || 0) >= 40 },
];

/** Quality investments. These also push the rating up. */
const QUALITY = [
  { id: 'qual-cert', name: 'The Care Certificate', emoji: '📜', kind: 'global', mult: 1.15, quality: true, cost: 8000, blurb: 'Everyone is trained properly. Everything earns 15% more, and the rating goes up.', question: 'Cheap now, and it counts towards Outstanding later.', unlock: (s) => (s.buildings.carer || 0) >= 10 },
  { id: 'qual-plans', name: 'Person-centred care plans', emoji: '📗', kind: 'global', mult: 1.2, quality: true, cost: 300000, blurb: 'Everything earns 20% more, and the rating goes up.', question: 'A rating point and a flat boost in one.', unlock: (s) => (s.buildings.client || 0) >= 25 },
  { id: 'qual-nomeds', name: 'No fifteen-minute calls', emoji: '⏱️', kind: 'global', mult: 1.3, quality: true, cost: 2.5e7, blurb: 'You turn down calls too short to do properly. Everything earns 30% more, and the rating goes up.', question: 'Costs you volume in the story and pays you back in reputation.', unlock: (s) => (s.buildings.package || 0) >= 25 },
  { id: 'qual-hours', name: 'Guaranteed hours', emoji: '🗓️', kind: 'global', mult: 1.35, quality: true, cost: 1.5e9, blurb: 'No zero-hours contracts. Everything earns 35% more, and the rating goes up.', question: 'The retention upgrade: pay for certainty, keep your people.', unlock: (s) => (s.buildings.carer || 0) >= 100 },
  { id: 'qual-reviews', name: 'Reviews on the website', emoji: '⭐', kind: 'global', mult: 1.4, quality: true, cost: 4e11, blurb: 'Families leave reviews. Everything earns 40% more, and the rating goes up.', question: 'Late, large, and the last push to Outstanding on every question.', unlock: (s) => (s.buildings.supervisor || 0) >= 25 },
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
      { id: 'buyer-private', name: 'Private clients', emoji: '💷', kind: 'global', mult: 1.5, blurb: 'Everything earns 50% more.', question: 'Flat, simple and never wrong.' },
      { id: 'buyer-council', name: 'The council framework', emoji: '🏛️', kind: 'branch-council', mult: 1.25, discount: 0.75, blurb: 'Everything earns 25% more, and work costs 25% less.', question: 'Cheaper work means more of it – best if you buy in bulk.' },
      { id: 'buyer-nhs', name: 'NHS packages', emoji: '🩺', kind: 'branch-scaling', mult: 1.25, per: 0.01, from: 'chc', cap: 1.5, blurb: 'Everything earns 25% more, plus 1% for every NHS-funded package, up to +150%.', question: 'Weakest now, strongest later – if you get to NHS work.' },
    ],
  },
  {
    slot: 'growth', name: 'How do you grow?', emoji: '🌱', level: 3,
    blurb: 'Everybody grows differently. What is your way?',
    options: [
      { id: 'grow-people', name: 'More hands', emoji: '👥', kind: 'branch-scaling', mult: 1.1, per: 0.015, from: 'carer', cap: 1.6, blurb: 'Everything earns 10% more, plus 1.5% for every carer, up to +160%.', question: 'Grows with the team and nothing else. The biggest ceiling if you keep hiring.' },
      { id: 'grow-kit', name: 'Better kit', emoji: '🧰', kind: 'branch-council', discountSide: 'team', mult: 1.35, discount: 0.5, blurb: 'Everything earns 35% more, and carers, key safes, cars and offices all cost half as much.', question: 'Not a bonus but a discount: everything on the team side is a third cheaper, for ever.' },
      { id: 'grow-rates', name: 'Better rates', emoji: '📈', kind: 'value', mult: 1.8, clickBoost: 3, blurb: 'Every visit is worth 80% more, and your own visits are worth three times as much again.', question: 'Flat, immediate, and the only one that rewards tapping doors yourself.' },
    ],
  },
  {
    slot: 'known', name: 'What are you known for?', emoji: '🏅', level: 5,
    blurb: 'Every good agency is known for something.',
    options: [
      { id: 'known-dementia', name: 'Dementia care', emoji: '🧠', kind: 'branch-scaling', mult: 1.3, per: 0.002, from: 'client', cap: 1.2, blurb: 'Everything earns 30% more, plus a little for everybody you look after, up to +120%.', question: 'Rewards a long client list and life story work.' },
      { id: 'known-reablement', name: 'Reablement', emoji: '🌤️', kind: 'branch-council', mult: 1.8, discount: 0.72, blurb: 'Everything earns 80% more, and taking on work costs 28% less.', question: 'Short, intensive, and people leave you better than they arrived.' },
      { id: 'known-complex', name: 'Complex care', emoji: '🧑‍⚕️', kind: 'branch-scaling', mult: 1.3, per: 0.035, from: ['chc', 'nurse'], cap: 1.4, blurb: 'Everything earns 30% more, plus 3.5% for every NHS package and nurse-led team, up to +140%.', question: 'The hardest work, the highest ceiling.' },
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
  'cond-continuity': 'Carers keep going back to the same doors.',
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
  'grow-kit': 'A kit crate by the office door, and everything for the team a third cheaper.',
  'grow-rates': 'The coins coming in get bigger, and so does every visit you do yourself.',
  'known-dementia': 'A photograph in every window.',
  'known-reablement': 'A door opens and somebody waves you off, doing fine.',
  'known-complex': 'Clinical blue on the doors that need it.',
};
/** The icon each upgrade puts on the office noticeboard. Every non-kit upgrade has one. */
export const UPGRADE_ICONS = {
  'syn-keysafe-carer': '🔑', 'syn-car-carer': '🚗', 'syn-package-client': '📋', 'syn-coord-carer': '📱',
  'syn-council-package': '🏛️', 'syn-super-team': '🦺', 'syn-office-all': '🏢', 'syn-academy-team': '🎓', 'syn-chc-nurse': '🩺',
  'cond-covered': '🫶', 'cond-continuity': '🤝', 'cond-tidy': '🧰', 'cond-wellled': '🌟',
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
 * The shop never runs out. Every stage past the table brings its own rung of kit, a better rate and
 * a lift for everything, worked out from the same shape as the ones in the table – so however far
 * you go there is always something worth saving up for.
 */
const FAR_KIT = ['Warm boxes', 'Quiet engines', 'Deep-space kettles'];
const FAR_CACHE = new Map();
export function farUpgrades(n) {
  if (FAR_CACHE.has(n)) return FAR_CACHE.get(n);
  const b = beyondBuilding(n);
  const out = [];
  FAR_KIT.forEach((name, i) => {
    out.push({
      id: `${b.id}-t${i + 1}`, name: `${name} ${n}`, emoji: b.emoji, kind: 'building', building: b.id,
      cost: b.baseCost * TIER_COST[i], archetype: 'kit', icon: b.emoji, mult: TIER_MULT[i],
      blurb: `${b.plural} are ${TIER_MULT[i] === 2 ? 'twice' : `${TIER_MULT[i]} times`} as good.`,
      visual: `${name} on every ${b.name.toLowerCase()}, counted on the horizon.`,
      question: `Doubles a rung you already own – worth it only if you own a lot of ${b.plural.toLowerCase()}.`,
      unlock: (s) => (s.buildings[b.id] || 0) >= TIER_AT[i],
    });
  });
  out.push({
    id: `far-value-${n}`, name: n === 1 ? 'A fairer rate again' : `A fairer rate again (${n})`, emoji: '💷', kind: 'value', archetype: 'rate', mult: 2,
    cost: b.baseCost * 40, icon: '💷', blurb: 'Every visit is worth twice as much.',
    visual: 'The coins coming into the office get bigger again.',
    question: 'A flat doubling of everything a visit is worth. Never a wasted pound.',
    unlock: (s) => (s.buildings[b.id] || 0) >= 5,
  });
  out.push({
    id: `far-hands-${n}`, name: n === 1 ? 'Still on the round' : `Still on the round (${n})`, emoji: '🤲', kind: 'clickpct', pct: 0.01, archetype: 'click',
    cost: b.baseCost * 12, icon: '🤲', blurb: 'Your own visits earn another 1% of the team’s income every second.',
    visual: 'Your own carer keeps walking the round with everybody else.',
    question: 'Keeps your own tapping worth doing however far out you go.',
    unlock: (s) => (s.buildings[b.id] || 0) >= 20,
  });
  out.push({
    id: `far-all-${n}`, name: `${b.name}s, everywhere`, emoji: '✨', kind: 'global', archetype: 'rate', mult: 1.8,
    cost: b.baseCost * 300, icon: '✨', blurb: 'Everything you own earns 80% more.',
    visual: 'Another light joins the ones on the horizon, and the office noticeboard fills up.',
    question: 'The biggest single number this far out, and it needs the rung underneath it.',
    unlock: (s) => s.upgrades.includes(`far-value-${n}`),
  });
  FAR_CACHE.set(n, out);
  return out;
}

/** Everything buyable at a stage: the table, plus the endless rungs past it. */
export function upgradesFor(level) {
  if (level < LEVELS.length) return UPGRADES;
  const out = [...UPGRADES];
  for (let n = 1; n <= (level - LEVELS.length + 1) * BEYOND_PER_LEVEL; n++) out.push(...farUpgrades(n));
  return out;
}

/** Look up any upgrade by id, including the endless ones that are worked out on demand. */
export function upgradeById(id) {
  const known = UPGRADES_BY_ID.get(id);
  if (known) return known;
  const far = /^beyond-(\d+)-t\d$|^far-(?:value|all|hands)-(\d+)$/.exec(id);
  if (!far) return undefined;
  return farUpgrades(Number(far[1] || far[2])).find((u) => u.id === id);
}

/** The little icon an upgrade pins on the office noticeboard. */
export function upgradeIcon(id) {
  const u = upgradeById(id);
  return UPGRADE_ICONS[id] || (u && u.icon) || null;
}

/** Achievements. Each one earned adds 1% to everything – the team's morale. */
export const ACHIEVEMENTS = [
  { id: 'first-visit', name: 'First footsteps', emoji: '👣', blurb: 'Do your first visit.', test: (s) => s.visits >= 1 },
  { id: 'tea-round', name: 'Tea round', emoji: '☕', blurb: 'Do 100 visits yourself.', test: (s) => s.clicks >= 100 },
  { id: 'busy-bee', name: 'Busy bee', emoji: '🐝', blurb: 'Do 1,000 visits yourself.', test: (s) => s.clicks >= 1000 },
  { id: 'click-hero', name: 'Hands of steel', emoji: '💪', blurb: 'Do 10,000 visits yourself.', test: (s) => s.clicks >= 10000 },
  { id: 'first-hire', name: 'Welcome aboard', emoji: '🎉', blurb: 'Take on your first carer.', test: (s) => (s.buildings.carer || 0) >= 1 },
  { id: 'first-client', name: 'The first front door', emoji: '🚪', blurb: 'Look after your first person.', test: (s) => (s.buildings.client || 0) >= 1 },
  { id: 'first-safe', name: 'Keys in the box', emoji: '🔑', blurb: 'Fit your first key safe.', test: (s) => (s.buildings.keysafe || 0) >= 1 },
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
  { id: 'badge-nurse', name: 'Clinical confidence', emoji: '🧑‍⚕️', blurb: 'Start a nurse-led team.', test: (s) => (s.buildings.nurse || 0) >= 1 },
  { id: 'badge-world', name: 'Around the world', emoji: '🌐', blurb: 'Take care worldwide.', test: (s) => (s.buildings.world || 0) >= 1 },
  { id: 'space', name: 'To infinity', emoji: '🚀', blurb: 'Launch a care starship.', test: (s) => (s.buildings.starship || 0) >= 1 },
  { id: 'good', name: 'Rated Good', emoji: '✅', blurb: 'Be rated Good.', test: (s, m) => m.ratingIndex >= 1 },
  { id: 'outstanding', name: 'Outstanding', emoji: '🌟', blurb: 'Be rated Outstanding.', test: (s, m) => m.ratingIndex >= 2 },
  { id: 'every-question', name: 'Every question', emoji: '🏆', blurb: 'Be rated Outstanding on every question.', test: (s, m) => m.ratingIndex >= 3 },
  { id: 'tenth', name: 'We mark the tenth', emoji: '🎂', blurb: 'Own ten of anything.', test: (s) => Object.values(s.buildings).some((n) => n >= 10) },
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
  { id: 'stars-100', name: 'A constellation', emoji: '🌌', blurb: 'Earn 100 Legacy Stars.', test: (s) => s.starsEarned >= 100 },
  { id: 'all-upgrades', name: 'Fully kitted', emoji: '🧰', blurb: 'Own 25 upgrades in one run.', test: (s) => s.upgrades.length >= 25 },
  { id: 'welcome-back', name: 'Welcome back', emoji: '🛏️', blurb: 'Come back to find the team has been busy.', test: (s) => s.offlineReturns >= 1 },
  { id: 'night-owl', name: 'Night owl', emoji: '🦉', blurb: 'Play after ten at night.', test: (s) => s.playedLate },
  { id: 'team-500', name: 'Five hundred hands', emoji: '🖐️', blurb: 'Have 500 carers.', test: (s) => (s.buildings.carer || 0) >= 500 },
  { id: 'street-1000', name: 'A thousand front doors', emoji: '🏙️', blurb: 'Look after 1,000 people.', test: (s) => (s.buildings.client || 0) >= 1000 },
  { id: 'safes-500', name: 'Keys for everybody', emoji: '🗝️', blurb: 'Fit 500 key safes.', test: (s) => (s.buildings.keysafe || 0) >= 500 },
  { id: 'kit-full', name: 'Everything upgraded', emoji: '🧰', blurb: 'Own 60 upgrades in one run.', test: (s) => s.upgrades.length >= 60 },
  { id: 'earn-1qa', name: 'A quadrillion', emoji: '💫', blurb: 'Earn £1 quadrillion in one run.', test: (s) => s.runEarned >= 1e15 },
  { id: 'earn-1sx', name: 'A sextillion', emoji: '🌠', blurb: 'Earn £1 sextillion in one run.', test: (s) => s.runEarned >= 1e21 },
  { id: 'expand-9', name: 'Red planet', emoji: '🔴', blurb: 'Reach Mars.', test: (s) => s.level >= 9 },
  { id: 'expand-12', name: 'Further still', emoji: '✨', blurb: 'Go three stages past Mars.', test: (s) => s.level >= 12 },
  { id: 'stars-250', name: 'A whole sky', emoji: '🌌', blurb: 'Earn 250 Legacy Stars.', test: (s) => s.starsEarned >= 250 },
  { id: 'perks-all', name: 'Every last perk', emoji: '🎁', blurb: 'Own all ten Legacy perks.', test: (s) => s.perks.filter((id) => !/^legacy-/.test(id)).length >= 10 },
  { id: 'legacy-3', name: 'The name goes further', emoji: '🌟', blurb: 'Buy three of the endless Legacy perks.', test: (s) => s.perks.filter((id) => /^legacy-/.test(id)).length >= 3 },
  { id: 'expand-16', name: 'Out past the last light', emoji: '🌌', blurb: 'Reach the seventh stage past Mars.', test: (s) => s.level >= 16 },
  { id: 'expand-20', name: 'No end to it', emoji: '♾️', blurb: 'Reach the eleventh stage past Mars.', test: (s) => s.level >= 20 },
  { id: 'earn-1no', name: 'A nonillion', emoji: '🪐', blurb: 'Earn £1 nonillion in one run.', test: (s) => s.runEarned >= 1e30 },
  { id: 'clicks-25k', name: 'Still on the round', emoji: '🤲', blurb: 'Do 25,000 visits yourself.', test: (s) => s.clicks >= 25000 },
  { id: 'far-kit', name: 'Kitted out past Mars', emoji: '✨', blurb: 'Buy kit for four of the far rungs.', test: (s) => s.upgrades.filter((id) => /^beyond-\d+-t/.test(id)).length >= 4 },
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
  '{n} found the good biscuits. Morale is up 12%.',
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
];
