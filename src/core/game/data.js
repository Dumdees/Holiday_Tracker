// Everything the Care Empire game is made of: what you can buy, what you can unlock, how far you can grow.
// Numbers are deliberately Cookie-Clicker-ish: each purchase costs 15% more than the last.

export const COST_GROWTH = 1.15;

/** Things that deliver visits on their own. `rate` = visits per second each. `level` = expansion level needed. */
export const BUILDINGS = [
  { id: 'home', name: 'Client home', plural: 'Client homes', emoji: '🏠', baseCost: 10, rate: 0, level: 0, blurb: 'Someone who needs care. Every carer needs a home to visit, and a home takes one carer at a time.' },
  { id: 'carer', name: 'Carer', plural: 'Carers', emoji: '👩‍⚕️', baseCost: 15, rate: 0.2, level: 0, blurb: 'A kind pair of hands doing visits on foot.' },
  { id: 'car', name: 'Care car', plural: 'Care cars', emoji: '🚗', baseCost: 100, rate: 1, level: 0, blurb: 'Gets the team from door to door.' },
  { id: 'rota', name: 'Rota app', plural: 'Rota apps', emoji: '📱', baseCost: 1100, rate: 8, level: 0, blurb: 'No more double-booked Tuesdays.' },
  { id: 'office', name: 'Local office', plural: 'Local offices', emoji: '🏢', baseCost: 12000, rate: 47, level: 1, blurb: 'Somewhere for the kettle and the paperwork.' },
  { id: 'academy', name: 'Training academy', plural: 'Training academies', emoji: '🎓', baseCost: 130000, rate: 260, level: 1, blurb: 'Turns good carers into great ones.' },
  { id: 'hub', name: 'Regional hub', plural: 'Regional hubs', emoji: '🏥', baseCost: 1.4e6, rate: 1400, level: 2, blurb: 'Coordinates care across a whole county.' },
  { id: 'network', name: 'National network', plural: 'National networks', emoji: '🗺️', baseCost: 2e7, rate: 7800, level: 3, blurb: 'Care from Land’s End to John o’ Groats.' },
  { id: 'sensors', name: 'Smart home sensors', plural: 'Smart home sensor sets', emoji: '🤖', baseCost: 3.3e8, rate: 44000, level: 4, blurb: 'Kettle boiled at 8am? All is well.' },
  { id: 'franchise', name: 'International franchise', plural: 'International franchises', emoji: '🌍', baseCost: 5.1e9, rate: 260000, level: 5, blurb: 'Monteith-style care in every country.' },
  { id: 'satellite', name: 'Care satellite', plural: 'Care satellites', emoji: '🛰️', baseCost: 7.5e10, rate: 1.6e6, level: 6, blurb: 'Beams rotas down from orbit.' },
  { id: 'lunar', name: 'Lunar care base', plural: 'Lunar care bases', emoji: '🌙', baseCost: 1e12, rate: 1e7, level: 7, blurb: 'Low gravity, high standards.' },
  { id: 'starship', name: 'Care starship', plural: 'Care starships', emoji: '🚀', baseCost: 1.4e13, rate: 6.5e7, level: 8, blurb: 'Boldly caring where no one has cared before.' },
];

/** Growth stages. Reaching `threshold` (earned this run) lets you expand: the run resets, Legacy Stars are kept. */
export const LEVELS = [
  { level: 0, name: 'One street', emoji: '🏠', threshold: 0, tagline: 'It all starts with one carer and one street.' },
  { level: 1, name: 'The village', emoji: '🏘️', threshold: 5e4, tagline: 'Everyone in the village knows your name.' },
  { level: 2, name: 'The town', emoji: '🏙️', threshold: 5e6, tagline: 'A proper office, and a proper kettle.' },
  { level: 3, name: 'The region', emoji: '🗺️', threshold: 5e8, tagline: 'Hubs in every county.' },
  { level: 4, name: 'The nation', emoji: '🏛️', threshold: 5e10, tagline: 'Care from coast to coast.' },
  { level: 5, name: 'The continent', emoji: '🌍', threshold: 5e12, tagline: 'Passports at the ready.' },
  { level: 6, name: 'The whole world', emoji: '🌐', threshold: 5e14, tagline: 'Everyone, everywhere, looked after.' },
  { level: 7, name: 'Orbit', emoji: '🛰️', threshold: 5e16, tagline: 'Care with a view.' },
  { level: 8, name: 'The Moon', emoji: '🌙', threshold: 5e18, tagline: 'One small step for care.' },
  { level: 9, name: 'Mars', emoji: '🔴', threshold: 5e20, tagline: 'Red planet, warm hearts.' },
];

/** Levels beyond the table keep going forever, 100× harder each time. */
export function levelInfo(level) {
  if (level < LEVELS.length) return LEVELS[level];
  const n = level - LEVELS.length + 1;
  return { level, name: `Star system ${n}`, emoji: '✨', threshold: LEVELS[LEVELS.length - 1].threshold * Math.pow(100, n), tagline: 'Further than anyone has cared before.' };
}

/** Permanent perks bought with Legacy Stars. */
export const PERKS = [
  { id: 'admin', name: 'Head office', emoji: '🏛️', cost: 2, blurb: 'Every new run starts with payments collected automatically.' },
  { id: 'alumni', name: 'Alumni network', emoji: '🎓', cost: 8, blurb: 'Start each run with 5 carers and 5 client homes.' },
  { id: 'magnet', name: 'Prismatic magnet', emoji: '🌈', cost: 15, blurb: 'Prismatic carers appear twice as often.' },
  { id: 'cards', name: 'Card collector', emoji: '💌', cost: 20, blurb: 'Thank-you cards appear twice as often.' },
  { id: 'playbook', name: 'Franchise playbook', emoji: '📘', cost: 40, blurb: 'Everything costs 10% less.' },
  { id: 'nightshift', name: 'Night shift', emoji: '🌙', cost: 60, blurb: 'Earn at full speed while the game is closed, instead of half.' },
  { id: 'legend', name: 'Living legend', emoji: '🏆', cost: 120, blurb: 'Your clicks are 10 times stronger.' },
  { id: 'momentum', name: 'Momentum', emoji: '⚡', cost: 250, blurb: 'Start each run with 25 carers, 25 client homes and 5 care cars.' },
];

const TIER_COUNTS = [1, 5, 25, 50, 100, 200];
const TIER_COST_MULT = [10, 50, 500, 5000, 50000, 500000];
const TIER_NAMES = {
  carer: ['Comfy shoes', 'Tea rounds', 'Best friends', 'Care superstars', 'Local legends', 'Care royalty'],
  car: ['Sat navs', 'Electric cars', 'Blue-light training', 'Heated seats', 'Self-driving fleet', 'Hover cars'],
  rota: ['Push alerts', 'Smart matching', 'Traffic-aware routes', 'Predictive rotas', 'AI planner', 'Quantum rota'],
  office: ['Decent kettle', 'Cake Fridays', 'Standing desks', 'Roof garden', 'Office dog', 'Office llama'],
  academy: ['Guest lecturers', 'Simulation suite', 'Mentoring scheme', 'Degree programme', 'Research wing', 'Nobel prize'],
  hub: ['Night desk', 'Rapid response', 'Hub helicopter', 'County command', 'Crisis team', 'Hub of hubs'],
  network: ['Shared records', 'National hotline', 'Rail passes', 'Care bus fleet', 'Skyway', 'Teleporters'],
  sensors: ['Kettle sensors', 'Fall detectors', 'Friendly robots', 'Smart pillboxes', 'Mind-reading mugs', 'Holographic visits'],
  franchise: ['Local partners', 'Translation team', 'Global rota', 'World summit', 'Care embassy', 'Planet-wide brand'],
  satellite: ['Solar panels', 'Orbital relay', 'Laser uplink', 'Second satellite', 'Constellation', 'Dyson sphere'],
  lunar: ['Moon buggies', 'Crater canteen', 'Low-g physio', 'Moon garden', 'Lunar shuttle', 'Moon festival'],
  starship: ['Warp rotas', 'Cosy cabins', 'Stellar navigation', 'Galactic hotline', 'Wormhole routes', 'Infinite kindness'],
};

/** Upgrades bought with money. `unlock(state)` decides when they appear. */
export const UPGRADES = [];
for (const b of BUILDINGS) {
  if (!b.rate) continue; // homes are capacity, not production
  TIER_COUNTS.forEach((count, i) => {
    UPGRADES.push({
      id: `${b.id}-t${i + 1}`, name: TIER_NAMES[b.id][i], emoji: b.emoji, kind: 'building', building: b.id,
      cost: b.baseCost * TIER_COST_MULT[i], blurb: `${b.plural} deliver twice as many visits.`,
      unlock: (s) => (s.buildings[b.id] || 0) >= count,
    });
  });
}
UPGRADES.push(
  { id: 'click-1', name: 'Warm smile', emoji: '😊', kind: 'click', cost: 50, blurb: 'Each of your visits is worth twice as much.', unlock: (s) => s.clicks >= 10 },
  { id: 'click-2', name: 'Comfy uniform', emoji: '🧥', kind: 'click', cost: 800, blurb: 'Each of your visits is worth twice as much.', unlock: (s) => s.clicks >= 60 },
  { id: 'click-3', name: 'Helping hands', emoji: '🤝', kind: 'clickpct', cost: 12000, blurb: 'Each of your visits also earns 1% of what your team makes per second.', unlock: (s) => s.clicks >= 200 },
  { id: 'click-4', name: 'Legendary hugs', emoji: '🫂', kind: 'click', cost: 400000, blurb: 'Each of your visits is worth twice as much.', unlock: (s) => s.clicks >= 600 },
  { id: 'click-5', name: 'Golden touch', emoji: '✨', kind: 'clickpct', cost: 5e7, blurb: 'Each of your visits also earns another 1% of your per-second income.', unlock: (s) => s.clicks >= 1500 },
  { id: 'admin', name: 'Office admin', emoji: '🗂️', kind: 'collect', cost: 150, blurb: 'Payments are collected for you every few seconds.', unlock: (s) => s.runEarned >= 60 },
  { id: 'direct-debit', name: 'Direct debit', emoji: '🏦', kind: 'collect', cost: 6000, blurb: 'Payments arrive instantly. No more chasing invoices.', unlock: (s) => s.upgrades.includes('admin') },
  { id: 'value-1', name: 'Private clients', emoji: '💷', kind: 'value', cost: 10000, blurb: 'Every visit pays twice as much.', unlock: (s) => s.runEarned >= 5000 },
  { id: 'value-2', name: 'Council contract', emoji: '📜', kind: 'value', cost: 1e6, blurb: 'Every visit pays twice as much.', unlock: (s) => s.runEarned >= 3e5 },
  { id: 'value-3', name: 'Health service partnership', emoji: '🩺', kind: 'value', cost: 1.5e8, blurb: 'Every visit pays twice as much.', unlock: (s) => s.runEarned >= 4e7 },
  { id: 'value-4', name: 'Royal warrant', emoji: '👑', kind: 'value', cost: 2e10, blurb: 'Every visit pays twice as much.', unlock: (s) => s.runEarned >= 6e9 },
  { id: 'global-1', name: '“Good” inspection', emoji: '📋', kind: 'global', mult: 1.1, cost: 25000, blurb: 'Everything earns 10% more.', unlock: (s) => s.runEarned >= 10000 },
  { id: 'global-2', name: '“Outstanding” inspection', emoji: '🌟', kind: 'global', mult: 1.2, cost: 2.5e6, blurb: 'Everything earns 20% more.', unlock: (s) => s.runEarned >= 1e6 },
  { id: 'global-3', name: 'Word of mouth', emoji: '🗣️', kind: 'global', mult: 1.25, cost: 3e8, blurb: 'Everything earns 25% more.', unlock: (s) => s.runEarned >= 1e8 },
  { id: 'global-4', name: 'Care of the year award', emoji: '🏆', kind: 'global', mult: 1.5, cost: 4e10, blurb: 'Everything earns 50% more.', unlock: (s) => s.runEarned >= 1e10 },
  { id: 'global-5', name: 'Beloved everywhere', emoji: '💖', kind: 'global', mult: 2, cost: 5e12, blurb: 'Everything earns twice as much.', unlock: (s) => s.runEarned >= 1e12 },
);
export const UPGRADES_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

/** Achievements. Each one earned adds 1% to everything ("morale"). */
export const ACHIEVEMENTS = [
  { id: 'first-visit', name: 'First footsteps', emoji: '👣', blurb: 'Do your first visit.', test: (s) => s.visits >= 1 },
  { id: 'tea-round', name: 'Tea round', emoji: '☕', blurb: 'Do 100 visits yourself.', test: (s) => s.clicks >= 100 },
  { id: 'busy-bee', name: 'Busy bee', emoji: '🐝', blurb: 'Do 1,000 visits yourself.', test: (s) => s.clicks >= 1000 },
  { id: 'click-hero', name: 'Hands of steel', emoji: '💪', blurb: 'Do 10,000 visits yourself.', test: (s) => s.clicks >= 10000 },
  { id: 'first-hire', name: 'Welcome aboard', emoji: '🎉', blurb: 'Hire your first carer.', test: (s) => (s.buildings.carer || 0) >= 1 },
  { id: 'street', name: 'Whole street', emoji: '🏘️', blurb: 'Care for 10 client homes.', test: (s) => (s.buildings.home || 0) >= 10 },
  { id: 'neighbourhood', name: 'Neighbourhood', emoji: '🏙️', blurb: 'Care for 100 client homes.', test: (s) => (s.buildings.home || 0) >= 100 },
  { id: 'team-10', name: 'Proper team', emoji: '👥', blurb: 'Have 10 carers.', test: (s) => (s.buildings.carer || 0) >= 10 },
  { id: 'team-50', name: 'Big family', emoji: '🏡', blurb: 'Have 50 carers.', test: (s) => (s.buildings.carer || 0) >= 50 },
  { id: 'team-100', name: 'Care army', emoji: '🛡️', blurb: 'Have 100 carers.', test: (s) => (s.buildings.carer || 0) >= 100 },
  { id: 'fleet', name: 'Fleet manager', emoji: '🚗', blurb: 'Own 25 care cars.', test: (s) => (s.buildings.car || 0) >= 25 },
  { id: 'office', name: 'Open for business', emoji: '🏢', blurb: 'Open a local office.', test: (s) => (s.buildings.office || 0) >= 1 },
  { id: 'hub', name: 'Regional power', emoji: '🏥', blurb: 'Open a regional hub.', test: (s) => (s.buildings.hub || 0) >= 1 },
  { id: 'world', name: 'Around the world', emoji: '🌍', blurb: 'Open an international franchise.', test: (s) => (s.buildings.franchise || 0) >= 1 },
  { id: 'space', name: 'To infinity', emoji: '🚀', blurb: 'Launch a care starship.', test: (s) => (s.buildings.starship || 0) >= 1 },
  { id: 'earn-1k', name: 'First thousand', emoji: '💷', blurb: 'Earn £1,000 in one run.', test: (s) => s.runEarned >= 1e3 },
  { id: 'earn-1m', name: 'Millionaire', emoji: '💰', blurb: 'Earn £1 million in one run.', test: (s) => s.runEarned >= 1e6 },
  { id: 'earn-1b', name: 'Billionaire', emoji: '🏦', blurb: 'Earn £1 billion in one run.', test: (s) => s.runEarned >= 1e9 },
  { id: 'earn-1t', name: 'Trillionaire', emoji: '🪙', blurb: 'Earn £1 trillion in one run.', test: (s) => s.runEarned >= 1e12 },
  { id: 'collector', name: 'Chasing invoices', emoji: '🧾', blurb: 'Collect payments by hand 25 times.', test: (s) => s.collections >= 25 },
  { id: 'prismatic-1', name: 'Over the rainbow', emoji: '🌈', blurb: 'Meet a prismatic carer.', test: (s) => s.prismaticsMet >= 1 },
  { id: 'prismatic-7', name: 'Rainbow collector', emoji: '🦄', blurb: 'Meet 7 prismatic carers.', test: (s) => s.prismaticsMet >= 7 },
  { id: 'cards-5', name: 'Fridge full of cards', emoji: '💌', blurb: 'Open 5 thank-you cards.', test: (s) => s.cardsOpened >= 5 },
  { id: 'cards-25', name: 'Local treasure', emoji: '🏅', blurb: 'Open 25 thank-you cards.', test: (s) => s.cardsOpened >= 25 },
  { id: 'expand-1', name: 'Growing up', emoji: '🏘️', blurb: 'Expand for the first time.', test: (s) => s.level >= 1 },
  { id: 'expand-3', name: 'Regional champion', emoji: '🗺️', blurb: 'Reach the region.', test: (s) => s.level >= 3 },
  { id: 'expand-6', name: 'World of care', emoji: '🌐', blurb: 'Care for the whole world.', test: (s) => s.level >= 6 },
  { id: 'stars-10', name: 'Starry-eyed', emoji: '⭐', blurb: 'Earn 10 Legacy Stars.', test: (s) => s.starsEarned >= 10 },
  { id: 'stars-100', name: 'Constellation', emoji: '🌌', blurb: 'Earn 100 Legacy Stars.', test: (s) => s.starsEarned >= 100 },
  { id: 'all-upgrades', name: 'Fully kitted', emoji: '🧰', blurb: 'Own 20 upgrades in one run.', test: (s) => s.upgrades.length >= 20 },
  { id: 'welcome-back', name: 'Welcome back', emoji: '🛏️', blurb: 'Come back to find your team has been busy.', test: (s) => s.offlineReturns >= 1 },
  { id: 'night-owl', name: 'Night owl', emoji: '🦉', blurb: 'Play after 10 at night.', test: (s) => s.playedLate },
];
export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** What clicking a prismatic carer can do. Weights are relative. */
export const PRISMATIC_EFFECTS = [
  { id: 'rainbow-rush', weight: 30, name: 'Rainbow rush', emoji: '🌈', seconds: 30, prodMult: 7, describe: (n) => `${n} is on fire – everything earns 7× for 30 seconds!` },
  { id: 'click-frenzy', weight: 22, name: 'Click frenzy', emoji: '⚡', seconds: 15, clickMult: 77, describe: (n) => `${n} says: get clicking! Your visits are worth 77× for 15 seconds!` },
  { id: 'care-burst', weight: 28, name: 'Care burst', emoji: '💝', instant: true, describe: (n) => `${n} brought a cake in – bonus payment!` },
  { id: 'lucky-hire', weight: 20, name: 'Lucky hire', emoji: '🦄', permanent: true, describe: (n) => `${n} joins the team permanently as a prismatic carer – +3% to everything, forever!` },
];

/** What a thank-you card can do. */
export const CARD_EFFECTS = [
  { id: 'card-cash', weight: 60, name: 'Thank-you card', emoji: '💌', instant: true, describe: () => 'A lovely thank-you card with a little something inside.' },
  { id: 'double-time', weight: 40, name: 'Double time', emoji: '⏩', seconds: 45, prodMult: 2, describe: () => 'Everyone is buzzing – everything earns 2× for 45 seconds!' },
];

/** Fallback names when the program has no carers yet. */
export const FALLBACK_NAMES = ['Sam', 'Alex', 'Jo', 'Robin', 'Charlie', 'Ash', 'Morgan', 'Jamie', 'Frankie', 'Riley', 'Casey', 'Drew'];

/** News ticker lines. {n} = a random carer name, {co} = the company name. */
export const TICKER = [
  '{n} has been offered a fourth cup of tea today and is considering it.',
  'Local news: {co} carer spotted parallel parking perfectly on the first go.',
  'The rota app has learned to say “no” to Mondays.',
  '{n} found the good biscuits. Morale is up 12%.',
  'A client’s cat has appointed {n} as its official chair-warmer.',
  'Breaking: nobody at {co} has lost the office keys this week.',
  '{n} is teaching the smart home sensors to boil the kettle at 8am sharp.',
  'Weather update: it is raining. {n} brought spare socks for everyone.',
  'The care cars now have heated seats. Productivity is somehow up.',
  '{n} completed a visit, a crossword and a jigsaw before lunch.',
  'Rumour has it a prismatic carer was seen shimmering near the tea trolley.',
  'Thank-you cards now cover the entire fridge door. A second fridge has been ordered.',
  '{n} has been voted “most likely to remember everyone’s birthday”.',
  'The training academy graduated its first class. Cake was involved.',
  'Regional hub reports: 100% of kettles operational.',
  '{n} says the secret to good care is listening. And biscuits.',
  'A client on the Moon has requested {n} by name.',
  'The satellite rota is running 0.3 seconds ahead of schedule. Show-offs.',
  '{co} is now a household name in households it has never heard of.',
  '{n} has started a book club. Attendance: everyone.',
  'Office dog update: still a very good dog.',
  'Direct debit means nobody has to chase invoices any more. {n} is delighted.',
  'Someone left a lovely review. Everyone read it twice.',
  '{n} would like it known that the printer is, in fact, working now.',
];
