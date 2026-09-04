// The Care Empire engine: pure functions over a plain state object. No DOM, no timers.
// The view calls tick() many times a second and the other functions when the player acts.
//
// How the money works, in one paragraph. Two sides have to grow together: WORK (how much care is
// wanted) and TEAM (how much care you can deliver). Visits come from combining them, so the side
// that is behind is worth more per pound – but buying either side always earns you more, never
// less. Each thing you own gets better every tenth you buy. Upgrades then multiply particular
// things, particular sides, or everything, and a few only apply while the board is in a certain
// state. Everything below is derived from the state; nothing important is ever stored twice.

import {
  BUILDINGS, BUILDINGS_BY_ID, beyondBuilding, BEYOND_PER_LEVEL, UPGRADES, UPGRADES_BY_ID, upgradesFor, upgradeById,
  BRANCHES, BRANCH_OPTIONS, BRANCHES_BY_SLOT,
  ACHIEVEMENTS, PERKS, PRISMATIC_EFFECTS, CARD_EFFECTS, COST_GROWTH, MILESTONES, RATINGS,
  RATING_WEIGHTS, RATING_UPGRADE_POINTS, DAY_PARTS, levelInfo, FALLBACK_NAMES, legacyPerk,
} from './data.js';

import { fmtMoney } from './format.js';

export const SAVE_VERSION = 2;
const OFFLINE_CAP_SECONDS = 8 * 3600;
const OFFLINE_CAP_ONCALL = 12 * 3600;
const ADMIN_COLLECT_EVERY = 5;
const SPAWN_LIFETIME = 13;
const PRISMATIC_CHANCE_PER_SECOND = 1 / 210;
const CARD_CHANCE_PER_SECOND = 1 / 70;
export const HOUSE_COOLDOWN_MS = 900; // a door you have just knocked on needs a moment

const PERKS_BY_ID = new Map(PERKS.map((p) => [p.id, p]));
const STAGE_BONUS = 1.6;          // what reaching a stage is worth, for ever
const COST_EASE_AT = 1000;        // after this many, prices climb more gently so they stay finite
const COST_GROWTH_LATE = 1.04;
const CLICK_SHARE_CAP = 0.15;     // one visit of your own is never worth more than this much of a second
export const MILESTONES_BEYOND = 4;   // how many more doublings there are past the printed table

/** A brand-new game. Every field the maths reads is set here, so nothing can ever be undefined. */
export function newGame(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    startedAt: now,
    runStartedAt: now,
    lastSeen: now,
    funds: 0,
    invoices: 0,
    runEarned: 0,
    lifetimeEarned: 0,
    visits: 0,
    clicks: 0,
    collections: 0,
    buildings: { client: 3 },   // three front doors to be going on with; you do the visits yourself at first
    upgrades: [],
    branches: {},               // slot -> option id, chosen once per run
    achievements: [],
    level: 0,
    starsEarned: 0,
    starsSpent: 0,
    perks: [],
    effects: [],                // { id, name, emoji, until, prodMult?, clickMult? }
    spawn: null,                // { type: 'prismatic'|'card', name, x, y, until, born }
    spawnsThisRun: 0,
    cooldowns: {},              // door index -> timestamp it can be knocked on again
    prismaticHires: [],
    prismaticsMet: 0,
    cardsOpened: 0,
    offlineReturns: 0,
    playedLate: false,
    adminTimer: 0,
    bestRun: 0,                 // the most any single run has earned, so each hand-over has to beat it
    runPeak: 0,                 // the best steady rate this run has reached
    lastPeak: 0,                // and the best the run before it reached
    runTarget: runTargetFor(0, 0, 0),   // what this run has to earn, fixed when it started
    log: [],                    // newest first: { at, emoji, text }
  };
}

// ---------- Loading and migrating ----------

/** Old ids from the first version of the game, mapped onto the rebuilt street. */
const OLD_BUILDINGS = { home: 'client', carer: 'carer', car: 'car', rota: 'coordinator', office: 'office', academy: 'academy', hub: 'supervisor', network: 'framework', sensors: 'tech', franchise: 'group', satellite: 'orbit', lunar: 'orbit', starship: 'starship' };

/** Bring a save from the older game onto the new street, losing nothing that mattered. */
export function migrate(saved) {
  if (!saved || typeof saved !== 'object') return saved;
  if ((saved.version || 1) >= SAVE_VERSION) return saved;
  const buildings = {};
  for (const [oldId, count] of Object.entries(saved.buildings || {})) {
    const id = OLD_BUILDINGS[oldId] || (BUILDINGS_BY_ID.has(oldId) ? oldId : null);
    if (id && Number.isFinite(count) && count > 0) buildings[id] = (buildings[id] || 0) + Math.floor(count);
  }
  if (!buildings.client) buildings.client = 1;
  const upgrades = (saved.upgrades || []).filter((id) => !!upgradeById(id) && !BRANCH_OPTIONS.some((o) => o.id === id));
  const perks = (saved.perks || []).map((id) => (id === 'admin' ? 'perk-admin' : id)).filter((id) => PERKS.some((p) => p.id === id));
  return {
    ...saved,
    version: SAVE_VERSION,
    buildings,
    upgrades,
    branches: {},
    perks,
    achievements: (saved.achievements || []).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)),
    migratedFrom: saved.version || 1,
  };
}

/** Load a saved game (any version) and apply the time away. Returns { state, offline }. */
export function loadGame(saved, now = Date.now()) {
  const fresh = newGame(now);
  if (!saved || typeof saved !== 'object') return { state: fresh, offline: null };
  const from = migrate(saved);
  const state = {
    ...fresh,
    ...from,
    buildings: { ...(from.buildings || {}) },
    upgrades: [...(from.upgrades || [])],
    branches: { ...(from.branches || {}) },
    achievements: [...(from.achievements || [])],
    perks: [...(from.perks || [])],
    effects: [...(from.effects || [])].filter((e) => e && e.until > now),
    spawn: null,
    cooldowns: {},
    prismaticHires: [...(from.prismaticHires || [])],
    log: [...(from.log || [])].slice(0, 12),
  };
  state.version = SAVE_VERSION;
  // A game saved before the finish line was kept starts its next run with one worked out now.
  if (!(from.runTarget > 0)) state.runTarget = runTargetFor(state.level, state.lastPeak, 0);
  const offline = applyOffline(state, now);
  state.lastSeen = now;
  // Somebody who has been away half a day comes back to a card on the mat.
  if (offline && offline.seconds >= 4 * 3600) state.spawn = { type: 'card', name: pickName([], null, Math.random), x: 40, y: 30, until: now + 120000, born: now };
  return { state, offline };
}

/** Earn while the game was closed: half speed, or 80% with the on-call phone. */
export function applyOffline(state, now) {
  const oncall = state.upgrades.includes('oncall');
  const cap = oncall ? OFFLINE_CAP_ONCALL : (state.perks.includes('nightshift') ? OFFLINE_CAP_ONCALL : OFFLINE_CAP_SECONDS);
  const seconds = Math.min(cap, Math.max(0, (now - (state.lastSeen || now)) / 1000));
  if (seconds < 30) return null;
  const rate = productionPerSecond(state, now);
  if (rate <= 0) return null;
  const efficiency = state.perks.includes('nightshift') ? 1 : oncall ? 0.8 : 0.5;
  const earned = rate * seconds * efficiency;
  const visits = visitsPerSecond(state) * seconds * efficiency;
  state.visits += visits;
  if (collectionMode(state) === 'instant') credit(state, earned); else state.invoices += earned;
  state.offlineReturns += 1;
  return { seconds, earned, visits, efficiency, needsCollect: collectionMode(state) !== 'instant' };
}

// ---------- The maths ----------

export function collectionMode(state) {
  if (state.upgrades.includes('direct-debit')) return 'instant';
  if (state.upgrades.includes('admin')) return 'admin';
  return 'manual';
}

/**
 * Everything you own, whether bought or chosen as a branch. The list is worked out many times a
 * second, so the last answer is kept and handed back while the same things are owned.
 */
let ownedCache = { upgrades: null, branches: null, n: -1, list: [] };
function ownedUpgrades(state) {
  const branches = state.branches || null;
  const n = state.upgrades.length + (branches ? Object.keys(branches).length : 0);
  if (ownedCache.upgrades === state.upgrades && ownedCache.branches === branches && ownedCache.n === n) return ownedCache.list;
  const out = [];
  for (const id of state.upgrades) { const u = upgradeById(id); if (u) out.push(u); }
  for (const id of Object.values(branches || {})) { const u = upgradeById(id); if (u) out.push(u); }
  ownedCache = { upgrades: state.upgrades, branches, n, list: out };
  return out;
}

/** How much a milestone is worth: every tenth doubles, or more once you have paid for it. */
export function milestoneFactor(state) {
  if (state.upgrades.includes('mile-2')) return 2.5;
  if (state.upgrades.includes('mile-1')) return 2.2;
  return 2;
}

/** How many milestones a count has passed, and what that is worth. */
export function milestonesPassed(count) {
  let n = 0;
  for (const m of MILESTONES) if (count >= m) n++;
  // Past the table, every time you double again counts as another one – but only four times over.
  // Without that stop, owning ten thousand of something runs away with the whole game.
  const last = MILESTONES[MILESTONES.length - 1];
  if (count > last) n += Math.min(MILESTONES_BEYOND, Math.floor(Math.log2(count / last)));
  return n;
}

/** The next milestone for a count: { at, remaining } or null when they are all passed. */
export function nextMilestone(count) {
  for (const m of MILESTONES) if (count < m) return { at: m, remaining: m - count };
  const last = MILESTONES[MILESTONES.length - 1];
  const passed = Math.floor(Math.log2(count / last));
  if (passed >= MILESTONES_BEYOND) return null;      // they all stop eventually
  const at = last * Math.pow(2, passed + 1);
  return { at, remaining: at - count };
}

/** What one of a thing delivers a second, after its own upgrades, milestones and synergies. */
export function buildingRate(state, id) {
  const b = buildingDef(state, id);
  if (!b || !b.rate) return 0;
  const count = state.buildings[id] || 0;
  let mult = Math.pow(milestoneFactor(state), milestonesPassed(count));
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'building' && u.building === id) mult *= u.mult || 2;
    if (u.kind === 'side' && u.side === b.side) mult *= 1 + u.flat;
    if (u.kind === 'synergy') {
      const applies = u.to === id || (u.to === '*') || (u.to === '*team' && b.side === 'team') || (u.to === '*work' && b.side === 'work');
      if (applies) mult *= 1 + Math.min(u.cap, u.per * (state.buildings[u.from] || 0));
    }
  }
  return b.rate * mult;
}

/** Total visits a second wanted (work) or deliverable (team). */
export function sideRate(state, side) {
  let total = 0;
  for (const id of Object.keys(state.buildings)) {
    const b = buildingDef(state, id);
    if (b && b.side === side) total += (state.buildings[id] || 0) * buildingRate(state, id);
  }
  return total;
}

/**
 * Put the two sides together: the two averaged, with a bonus for keeping them level. Written out,
 * `(work + team + sqrt(work × team)) / 3`, which comes to exactly one side's worth when they match.
 *  - an upgrade to one side is worth its full share of the total, so things do what they say;
 *  - for the same total visits, a level board is worth up to half as much again as a badly lopsided
 *    one – which is not the same as saying level is always the best way to spend a pound, because
 *    the two sides cost different amounts;
 *  - buying either side always earns more, never less, whatever the board looks like;
 *  - and neither side alone delivers a single visit.
 */
export function combineSides(work, team) {
  if (work <= 0 || team <= 0) return 0;   // it takes both: somebody who wants a visit and somebody to do it
  return (work + team + Math.sqrt(work * team)) / 3;
}

/** How well the service is judged to be run. Derived, never stored. */
export function ratingScore(state) {
  let score = 0;
  for (const [id, weight] of Object.entries(RATING_WEIGHTS)) score += (state.buildings[id] || 0) * weight;
  for (const u of ownedUpgrades(state)) if (u.quality) score += RATING_UPGRADE_POINTS;
  if (state.perks && state.perks.includes('warmwelcome')) score += 6;   // a name people already know
  return score;
}

export function ratingIndex(state) {
  const score = ratingScore(state);
  let i = 0;
  RATINGS.forEach((r, n) => { if (score >= r.score) i = n; });
  return i;
}

export function ratingInfo(state) {
  const i = ratingIndex(state);
  const next = RATINGS[i + 1] || null;
  return { ...RATINGS[i], index: i, score: ratingScore(state), next };
}

/** Everything about the board that the multipliers need, worked out once. */
export function boardMetrics(state) {
  const work = sideRate(state, 'work');
  const team = sideRate(state, 'team');
  return { work, team, visits: combineSides(work, team), ratingIndex: ratingIndex(state), ratingScore: ratingScore(state) };
}

export function visitsPerSecond(state, m = boardMetrics(state)) {
  return m.visits;
}

/** What one visit is worth before the multipliers. */
export function visitValue(state) {
  let v = 1;
  for (const u of ownedUpgrades(state)) if (u.kind === 'value') v *= u.mult;
  return v;
}

/** How much of a sliding bonus is paying, 0 to 1. */
export function conditionShare(u, state, m) {
  const share = u.share ? u.share(state, m) : (u.test && u.test(state, m) ? 1 : 0);
  return Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
}

/** How much of the total a scaling branch is worth right now. */
function scalingBonus(state, u) {
  const froms = Array.isArray(u.from) ? u.from : [u.from];
  let count = 0;
  for (const f of froms) count += state.buildings[f] || 0;
  return Math.min(u.cap, u.per * count);
}

/** Everything that multiplies all income: upgrades, conditions, rating, morale, stars, effects. */
export function globalMultiplier(state, now = Date.now(), m = boardMetrics(state)) {
  let mult = 1;
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'global') mult *= u.mult;
    else if (u.kind === 'conditional') mult *= 1 + (u.mult - 1) * conditionShare(u, state, m);
    else if (u.kind === 'branch-council') mult *= u.mult;
    else if (u.kind === 'branch-scaling') mult *= u.mult * (1 + scalingBonus(state, u));
  }
  mult *= RATINGS[m.ratingIndex].mult;
  mult *= Math.pow(STAGE_BONUS, state.level);   // every stage you have reached, for ever
  mult *= 1 + 0.01 * state.achievements.length;
  mult *= starBonus(state.starsEarned);
  mult *= Math.pow(1.3, legacyPerks(state));
  mult *= 1 + 0.03 * (state.prismaticHires ? state.prismaticHires.length : 0);
  for (const e of state.effects) if (e.prodMult && e.until > now) mult *= e.prodMult;
  return mult;
}

export function productionPerSecond(state, now = Date.now()) {
  const m = boardMetrics(state);
  return m.visits * visitValue(state) * globalMultiplier(state, now, m);
}

export function clickValue(state, now = Date.now()) {
  let v = visitValue(state);
  let pct = 0;
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'click') { v *= u.mult || 2; pct += u.pct || 0; }
    if (u.clickBoost) v *= u.clickBoost;
    if (u.kind === 'clickpct') pct += u.pct || 0.01;
  }
  if (state.perks.includes('legend')) v *= 10;
  let value = v * globalMultiplier(state, now) + Math.min(CLICK_SHARE_CAP, pct) * productionPerSecond(state, now);
  for (const e of state.effects) if (e.clickMult && e.until > now) value *= e.clickMult;
  return value;
}

// ---------- Prices ----------

export function costDiscount(state, id) {
  let f = state.perks.includes('playbook') ? 0.9 : 1;
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'discount' && u.building === id) f *= u.factor;
    if (u.kind === 'branch-council') { const b = buildingDef(state, id); if (b && b.side === (u.discountSide || 'work')) f *= u.discount; }
  }
  return f;
}

/** What the nth one of something costs. Growth eases off past a thousand so prices stay real. */
function unitCost(base, n) {
  const steep = Math.min(n, COST_EASE_AT);
  const rest = Math.max(0, n - COST_EASE_AT);
  return base * Math.pow(COST_GROWTH, steep) * Math.pow(COST_GROWTH_LATE, rest);
}

export function buildingCost(state, id, qty = 1) {
  const b = buildingDef(state, id);
  if (!b) return Infinity;
  const owned = state.buildings[id] || 0;
  let total = 0;
  for (let i = 0; i < qty; i++) total += unitCost(b.baseCost, owned + i);
  return Math.ceil(total * costDiscount(state, id));
}

/**
 * How many you could buy right now, up to a sensible armful. The running total is carried along so
 * this stays quick: working out the price from scratch for every number in turn is the difference
 * between a thousand sums and a million on a big board.
 */
/** How many of something a given purse would buy, up to a sensible armful. */
function maxAffordableFor(state, id, funds) {
  const b = buildingDef(state, id);
  if (!b) return 0;
  const owned = state.buildings[id] || 0;
  const discount = costDiscount(state, id);
  let n = 0, total = 0;
  while (n < 2000) {
    const next = total + unitCost(b.baseCost, owned + n);
    if (!(Math.ceil(next * discount) <= funds)) break;
    total = next;
    n++;
  }
  return n;
}

export function maxAffordable(state, id) {
  return maxAffordableFor(state, id, state.funds);
}

export function upgradeCost(state, id) {
  const def = upgradeById(id);
  if (!def) return Infinity;
  const f = state.perks.includes('playbook') ? 0.9 : 1;
  // A stage's own shelf is priced as a share of what this run has to earn, so it is worth the same
  // effort at every stage: a minute's takings for the first, most of the run for the last.
  // A stage's own shelf is priced as a share of what this run has to earn. The printed list keeps its
  // printed prices, lifted as the runs get bigger – otherwise the whole of it is pocket money by the
  // third stage and every run afterwards is over in ninety seconds.
  const target = expandRequirement(state);
  const base = def.costShare
    ? def.costShare * target
    : def.cost * Math.pow(Math.max(1, target / FIRST_TARGET), PRICE_CLIMB);
  return Math.ceil(base * f);
}

// ---------- What is worth buying ----------

/** Income if the board were slightly different. Used for "what would this be worth?". */
function incomeWith(state, changes, now) {
  const probe = { ...state, ...changes };
  return productionPerSecond(probe, now);
}

/** Extra income a second from buying `qty` more of a thing. Always zero or more. */
export function buildingGain(state, id, qty = 1, now = Date.now(), income = null) {
  const before = income === null ? productionPerSecond(state, now) : income;
  const after = incomeWith(state, { buildings: { ...state.buildings, [id]: (state.buildings[id] || 0) + qty } }, now);
  return after - before;
}

/** Extra income a second from owning an upgrade. */
export function upgradeGain(state, id, now = Date.now(), income = null) {
  const before = income === null ? productionPerSecond(state, now) : income;
  const after = incomeWith(state, { upgrades: [...state.upgrades, id] }, now);
  return after - before;
}

/** Seconds for something to pay for itself. Infinity when it earns nothing extra. */
export function paybackSeconds(cost, gain) {
  if (!(gain > 0)) return Infinity;
  return cost / gain;
}

/** Everything about a shop row, worked out once for the view. */
export function buildingOffer(state, id, qty = 1, now = Date.now(), income = null) {
  const b = buildingDef(state, id);
  const count = state.buildings[id] || 0;
  const cost = buildingCost(state, id, qty);
  if (income === null) income = productionPerSecond(state, now);
  const gain = buildingGain(state, id, qty, now, income);
  return {
    ...b, count, cost, gain, income,
    payback: paybackSeconds(cost, gain),
    each: buildingRate(state, id) * visitValue(state) * globalMultiplier(state, now),
    affordable: state.funds >= cost,
    milestone: nextMilestone(count),
    milestoneFactor: milestoneFactor(state),
  };
}

export function upgradeOffer(state, u, now = Date.now(), income = null) {
  const cost = upgradeCost(state, u.id);
  if (income === null) income = productionPerSecond(state, now);
  const gain = upgradeGain(state, u.id, now, income);
  return { ...u, cost, gain, income, payback: paybackSeconds(cost, gain), affordable: state.funds >= cost };
}

/** Every rung you can buy at this stage, including the endless ones past the starship. */
export function unlockedBuildings(state) {
  const out = BUILDINGS.filter((b) => b.level <= state.level);
  for (let n = 1; n <= (state.level - 9) * BEYOND_PER_LEVEL; n++) out.push(beyondBuilding(n));
  return out;
}

/** Look a building up whether it is on the printed ladder or one of the endless ones. */
function buildingDef(state, id) {
  const known = BUILDINGS_BY_ID.get(id);
  if (known) return known;
  const n = /^beyond-(\d+)$/.exec(id);
  return n ? beyondBuilding(Number(n[1])) : null;
}

/** The next thing that needs a bigger business, for a "coming soon" line. */
export function nextLockedBuilding(state) {
  return BUILDINGS.find((b) => b.level > state.level) || null;
}

export function availableUpgrades(state) {
  return upgradesFor(state.level).filter((u) => !state.upgrades.includes(u.id) && u.unlock(state));
}

/**
 * The upgrades to show, best value first. Things that earn nothing but save you a job (the office
 * admin, direct debit) have no payback time, so they are ranked by how long it takes to afford
 * them – otherwise they would sit at the bottom for ever and nobody would find them.
 */
export function upgradeShop(state, now = Date.now(), limit = 12) {
  const earning = productionPerSecond(state, now);
  const income = Math.max(earning, 1e-9);
  // Things that earn come first, then the ones that only save you a job, then anything that would
  // actually cost you – which is ranked last and says so on the tile.
  const rank = (u) => (u.gain > 0 ? u.payback : u.gain < 0 ? 1e12 : (u.cost / income) * 1.5 + 1e6);
  // Anything that pays for itself in a couple of seconds is as good as free, and then the only
  // question is which one is biggest – otherwise a late shop fills up with pennies that happen to
  // pay back instantly and the useful ones are pushed off the shelf.
  const free = (u) => u.gain > 0 && u.payback < 2;
  return availableUpgrades(state)
    .map((u) => upgradeOffer(state, u, now, earning))
    .sort((a, b) => {
      const fa = free(a), fb = free(b);
      if (fa && fb) return b.gain - a.gain;
      if (fa !== fb) return fa ? -1 : 1;
      return (rank(a) - rank(b)) || (a.cost - b.cost);
    })
    .slice(0, limit);
}

/**
 * Which side is worth buying, in words. Worked out from the same payback numbers the shop shows,
 * so the advice and the Best value chip can never disagree.
 */
export function bottleneck(state, m = boardMetrics(state), now = Date.now()) {
  if (m.work <= 0) return { side: 'work', ratio: 0, advice: 'Take somebody on – there is nobody to visit yet.' };
  if (m.team <= 0) return { side: 'team', ratio: 0, advice: 'You need a carer before anybody gets a visit.' };
  // Judged on what a minute's takings actually buys on each side, not on one unit's payback: with
  // bonuses that swing on the shape of the board, one unit is far too short a view.
  const income = productionPerSecond(state, now);
  const budget = Math.max(income * 60, 1);
  const worth = { work: 0, team: 0 };
  for (const b of unlockedBuildings(state)) {
    const qty = maxAffordableFor(state, b.id, budget);
    if (!qty) continue;                       // only what a minute's takings would really buy
    const gain = buildingGain(state, b.id, qty, now, income);
    if (gain > worth[b.side]) worth[b.side] = gain;
  }
  const ratio = m.team / m.work;
  const state_ = ratio > 1.1 ? 'The team can cover the work.' : ratio < 0.9 ? 'There is more work than the team can cover.' : 'The two sides are level.';
  // Name the bonus that is furthest from paying in full: that is the one the board is costing you.
  const live = activeConditionals(state, m);
  const behind = live.filter((c) => c.share < 0.98).sort((a, b) => a.share - b.share)[0];
  const holding = behind
    ? ` ${behind.name} would pay ${Math.round((1 - behind.share) * (behind.mult - 1) * 100)}% more ${behind.label}.`
    : (live.length ? ` ${live[0].name} is paying in full.` : '');
  if (!worth.work && !worth.team) return { side: 'balanced', ratio, advice: `${state_}${holding}` };
  const gap = worth.work / Math.max(worth.team, 1e-9);
  const side = gap > 1.25 ? 'work' : gap < 0.8 ? 'team' : 'balanced';
  const tip = side === 'work' ? ' A minute of takings buys more by taking work on.'
    : side === 'team' ? ' A minute of takings buys more by putting it into the team.'
      : ' A minute of takings is worth about the same on either side.';
  return { side, ratio, advice: `${state_}${holding}${tip}` };
}

/** The little round you always keep when you hand over, so a new run is never dead. */
export function startingKit(level) {
  const n = Math.min(20, 2 + level * 2);
  return { client: n, carer: n };
}

// ---------- Doing things ----------

function credit(state, amount) {
  state.funds += amount;
  state.runEarned += amount;
  state.lifetimeEarned += amount;
}

function addLog(state, emoji, text, now) {
  state.log = [{ at: now, emoji, text }, ...(state.log || [])].slice(0, 12);
}

/** Seconds before door `index` can be knocked on again (0 = ready). */
export function houseCooldown(state, index, now = Date.now()) {
  const until = state.cooldowns ? state.cooldowns[index] || 0 : 0;
  return Math.max(0, (until - now) / 1000);
}

/** The first of `count` doors that is ready, or -1 if they are all resting. */
export function readyHouse(state, count, now = Date.now()) {
  for (let i = 0; i < count; i++) if (houseCooldown(state, i, now) <= 0) return i;
  return -1;
}

/**
 * The nearest door to `from` that is ready for a knock. Tapping the street should always find you
 * somebody to visit, the way pressing the key does – so a tap near a door that has just been seen
 * moves along to the next one instead of doing nothing.
 */
export function nearestReadyHouse(state, count, from = 0, now = Date.now()) {
  if (houseCooldown(state, from, now) <= 0) return from;
  for (let d = 1; d < count; d++) {
    for (const i of [from - d, from + d]) {
      if (i >= 0 && i < count && houseCooldown(state, i, now) <= 0) return i;
    }
  }
  return from;
}

/** You do a visit yourself. */
export function click(state, now = Date.now(), house = 0) {
  if (houseCooldown(state, house, now) > 0) return 0;
  if (!state.cooldowns) state.cooldowns = {};
  state.cooldowns[house] = now + HOUSE_COOLDOWN_MS;
  const earned = clickValue(state, now);
  state.clicks += 1;
  state.visits += 1;
  credit(state, earned);
  return earned;
}

/** Collect the unpaid invoices by hand. */
export function collect(state) {
  const amount = state.invoices;
  if (amount <= 0) return 0;
  state.invoices = 0;
  state.collections += 1;
  credit(state, amount);
  return amount;
}

export function buyBuilding(state, id, qty = 1) {
  const b = buildingDef(state, id);
  if (!b || b.level > state.level) return { bought: 0, spent: 0 };
  const n = qty === 'max' ? maxAffordable(state, id) : qty;
  if (n <= 0) return { bought: 0, spent: 0 };
  const cost = buildingCost(state, id, n);
  if (cost > state.funds) return { bought: 0, spent: 0 };
  const before = milestonesPassed(state.buildings[id] || 0);
  state.funds -= cost;
  state.buildings[id] = (state.buildings[id] || 0) + n;
  const after = milestonesPassed(state.buildings[id]);
  return { bought: n, spent: cost, milestone: after > before ? MILESTONES[after - 1] : 0 };
}

export function buyUpgrade(state, id) {
  const def = upgradeById(id);
  if (!def || state.upgrades.includes(id) || !def.unlock || !def.unlock(state)) return false;
  const cost = upgradeCost(state, id);
  if (cost > state.funds) return false;
  state.funds -= cost;
  state.upgrades.push(id);
  if (id === 'direct-debit') collect(state);
  return true;
}

/** The big either/or choices. One per slot per run, free, and permanent until you hand over. */
export function branchChoices(state) {
  return BRANCHES.filter((b) => b.level <= state.level).map((b) => ({
    ...b,
    chosen: (state.branches || {})[b.slot] || null,
    options: b.options.map((o) => ({ ...o, picked: (state.branches || {})[b.slot] === o.id })),
  }));
}

/** A slot the player can choose right now but has not, or null. */
export function pendingBranch(state) {
  return branchChoices(state).find((b) => !b.chosen) || null;
}

export function pickBranch(state, slot, optionId) {
  const group = BRANCHES_BY_SLOT.get(slot);
  if (!group || group.level > state.level) return false;
  if ((state.branches || {})[slot]) return false;
  if (!group.options.some((o) => o.id === optionId)) return false;
  state.branches = { ...(state.branches || {}), [slot]: optionId };
  return true;
}

// ---------- Legacy (handing over and starting again) ----------

/**
 * Legacy Stars from everything you have ever earned. The fourth root keeps the reward real without
 * letting a fast run turn into billions of stars, and the bonus each one gives eases off after the
 * first hundred so it can never run away.
 */
export function starsForLifetime(lifetimeEarned) {
  return Math.floor(6 * Math.log10(1 + Math.max(0, lifetimeEarned) / 1e4));
}

/** What the stars are worth: 3% each, on a count that only ever grows slowly. */
export function starBonus(stars) {
  return 1 + 0.03 * Math.max(0, stars);
}

export function starsAvailable(state) {
  return state.starsEarned - state.starsSpent;
}

export function nextLevel(state) {
  return levelInfo(state.level + 1);
}

/** A run has to be worth this many seconds at the best rate the run before it reached... */
export const RUN_SECONDS = 120;
/** ...and this many times what the last run had to earn, which is what makes the stages lengthen. */
export const RUN_BEAT = 400;
/** How hard the printed prices climb as the runs get bigger. 1 keeps them exactly in step. */
export const PRICE_CLIMB = 0.4;
const FIRST_TARGET = 1.2e5;

/**
 * What a run at `level` has to earn to be worth handing over: the stage's own figure, three times
 * the best run ever, or five minutes at the best rate the last run reached – whichever is most. It
 * is worked out once, when the run starts, and never moves again, so the bar only ever goes
 * forwards, a lucky rainbow cannot push the finish line away, and the shelf can be priced against it.
 */
export function runTargetFor(level, lastPeak, lastTarget) {
  return Math.max(levelInfo(level + 1).threshold, (lastTarget || 0) * RUN_BEAT, (lastPeak || 0) * RUN_SECONDS);
}

/** Income a second with the temporary luck taken out: what the pacing is measured against. */
export function steadyIncome(state) {
  return productionPerSecond(state, Number.MAX_SAFE_INTEGER);
}

export function expandRequirement(state) {
  if (state.runTarget > 0) return state.runTarget;
  return runTargetFor(state.level, state.lastPeak, 0);   // a save from before this was kept
}

export function expandProgress(state) {
  const target = expandRequirement(state);
  const floor = target / 100;
  const earned = Math.max(0, state.runEarned);
  if (earned <= floor) return (earned / floor) * 0.15;
  return Math.min(1, 0.15 + 0.85 * (Math.log(earned / floor) / Math.log(100)));
}

export function canExpand(state) {
  return state.runEarned >= expandRequirement(state);
}

export function starsOnExpand(state) {
  const share = state.perks && state.perks.includes('founders') ? 1.25 : 1;
  return Math.max(0, Math.floor((starsForLifetime(state.lifetimeEarned) - state.starsEarned) * share));
}

/** Apply the starting bonuses from perks to a fresh run. */
function applyStartPerks(state) {
  if (state.perks.includes('perk-admin') && !state.upgrades.includes('admin')) state.upgrades.push('admin');
  if (state.perks.includes('alumni')) { state.buildings.carer = Math.max(state.buildings.carer || 0, 5); state.buildings.client = Math.max(state.buildings.client || 0, 5); }
  if (state.perks.includes('momentum')) {
    state.buildings.carer = Math.max(state.buildings.carer || 0, 25);
    state.buildings.client = Math.max(state.buildings.client || 0, 25);
    state.buildings.car = Math.max(state.buildings.car || 0, 5);
  }
}

/** Hand the patch over and start again bigger. Stars, perks and badges stay. */
export function expand(state, now = Date.now()) {
  if (!canExpand(state)) return null;
  const gained = starsOnExpand(state);
  const peak = Math.max(state.runPeak || 0, steadyIncome(state));
  const bestRun = Math.max(state.bestRun || 0, state.runEarned);
  const level = state.level + 1;
  const keep = {
    startedAt: state.startedAt, lifetimeEarned: state.lifetimeEarned, achievements: state.achievements,
    bestRun, level, starsEarned: state.starsEarned + gained, starsSpent: state.starsSpent,
    perks: state.perks, prismaticHires: state.prismaticHires, prismaticsMet: state.prismaticsMet,
    cardsOpened: state.cardsOpened, offlineReturns: state.offlineReturns, playedLate: state.playedLate,
    clicks: state.clicks, visits: state.visits, collections: state.collections, log: state.log,
    // The next run's finish line, worked out now and left alone until it is crossed.
    lastPeak: peak, runPeak: 0, runTarget: runTargetFor(level, peak, expandRequirement(state)),
  };
  const fresh = newGame(now);
  Object.assign(state, fresh, keep, { runStartedAt: now, lastSeen: now });
  const kit = startingKit(state.level);
  state.buildings = { ...state.buildings, ...kit };
  applyStartPerks(state);
  addLog(state, levelInfo(state.level).emoji, `Handed over and grew to ${levelInfo(state.level).name.toLowerCase()} – ${gained} Legacy ${gained === 1 ? 'Star' : 'Stars'} earned`, now);
  return { gained, level: state.level, kit };
}

/** How many of the endless "the name goes further" perks are paid for. */
function legacyPerks(state) {
  return (state.perks || []).filter((id) => /^legacy-\d+$/.test(id)).length;
}

/** Any perk by id, including the endless ones worked out on demand. */
export function perkById(id) {
  const known = PERKS_BY_ID.get(id);
  if (known) return known;
  const m = /^legacy-(\d+)$/.exec(id);
  return m ? legacyPerk(Number(m[1])) : undefined;
}

export function buyPerk(state, id) {
  const def = perkById(id);
  if (!def || state.perks.includes(id) || starsAvailable(state) < def.cost) return false;
  state.starsSpent += def.cost;
  state.perks.push(id);
  applyStartPerks(state);
  return true;
}

// ---------- Surprises ----------

function pickWeighted(list, rng) {
  const total = list.reduce((n, e) => n + e.weight, 0);
  let r = rng() * total;
  for (const e of list) { r -= e.weight; if (r <= 0) return e; }
  return list[list.length - 1];
}

/** A name for a prismatic carer or a new hire, from the real team when there is one. */
export function pickName(names, index, rng) {
  const pool = names && names.length ? names : FALLBACK_NAMES;
  if (typeof index === 'number') return pool[index % pool.length];
  return pool[Math.floor(rng() * pool.length)];
}

/** Catch the prismatic carer or the thank-you card. Returns what happened, or null. */
export function clickSpawn(state, now = Date.now(), rng = Math.random) {
  const spawn = state.spawn;
  if (!spawn || spawn.until < now) { state.spawn = null; return null; }
  state.spawn = null;
  const prod = productionPerSecond(state, now);
  let effect, amount = 0;
  if (spawn.type === 'prismatic') {
    state.prismaticsMet += 1;
    effect = pickWeighted(PRISMATIC_EFFECTS, rng);
    if (effect.id === 'care-burst') amount = Math.max(25, Math.min(prod * 900, Math.max(state.funds * 0.15, prod * 120)));
    if (effect.id === 'lucky-hire') state.prismaticHires = [...(state.prismaticHires || []), spawn.name];
  } else {
    state.cardsOpened += 1;
    effect = pickWeighted(CARD_EFFECTS, rng);
    if (effect.id === 'card-cash') amount = Math.max(10, Math.min(prod * (60 + Math.floor(rng() * 240)), Math.max(state.funds * 0.1, prod * 60)));
  }
  if (amount > 0) credit(state, amount);
  if (effect.seconds) {
    state.effects = state.effects.filter((e) => e.id !== effect.id);
    state.effects.push({ id: effect.id, name: effect.name, emoji: effect.emoji, until: now + effect.seconds * 1000, prodMult: effect.prodMult, clickMult: effect.clickMult });
  }
  const message = effect.describe(spawn.name);
  addLog(state, effect.emoji, message + (amount ? ` (+${fmtMoney(amount)})` : ''), now);
  return { type: spawn.type, effect, amount, name: spawn.name, message };
}

/** Which part of the round the street is in. Scenery and flavour only. */
export function dayPart(fraction) {
  let part = DAY_PARTS[0];
  for (const p of DAY_PARTS) if (fraction >= p.from) part = p;
  return part;
}

// ---------- Time ----------

/**
 * Advance the game by dt seconds. Returns things the view might announce:
 * { kind: 'achievement', achievement } | { kind: 'spawn', spawn } | { kind: 'collected', amount }
 */
export function tick(state, dt, now = Date.now(), rng = Math.random, names = []) {
  const events = [];
  dt = Math.max(0, Math.min(dt, 5));
  const m = boardMetrics(state);
  const rate = m.visits * visitValue(state) * globalMultiplier(state, now, m);
  const steady = m.visits * visitValue(state) * globalMultiplier(state, Number.MAX_SAFE_INTEGER, m);
  if (steady > (state.runPeak || 0)) state.runPeak = steady;   // the run's own best rate, luck excluded
  state.visits += m.visits * dt;
  const mode = collectionMode(state);
  if (mode === 'instant') credit(state, rate * dt);
  else {
    state.invoices += rate * dt;
    if (mode === 'admin') {
      state.adminTimer += dt;
      if (state.adminTimer >= ADMIN_COLLECT_EVERY && state.invoices > 0) {
        state.adminTimer = 0;
        const amount = state.invoices;
        state.invoices = 0;
        credit(state, amount);
        events.push({ kind: 'collected', amount });
      }
    }
  }
  state.effects = state.effects.filter((e) => e.until > now);
  if (state.spawn && state.spawn.until < now) state.spawn = null;
  if (!state.spawn && dt > 0) {
    const pChance = PRISMATIC_CHANCE_PER_SECOND * (state.perks.includes('magnet') ? 2 : 1) * dt;
    // Nobody waits long for their first surprise of a run.
    const firstSurprise = state.spawnsThisRun === 0 && now - state.runStartedAt > 40000 ? 12 : 1;
    const cChance = CARD_CHANCE_PER_SECOND * (state.perks.includes('cards') ? 2 : 1) * firstSurprise * dt;
    const r = rng();
    if (r < pChance) state.spawn = { type: 'prismatic', name: pickName(names, null, rng), x: 22 + rng() * 56, y: 18 + rng() * 50, until: now + SPAWN_LIFETIME * 1000, born: now };
    else if (r < pChance + cChance) state.spawn = { type: 'card', name: pickName(names, null, rng), x: 22 + rng() * 56, y: 18 + rng() * 50, until: now + SPAWN_LIFETIME * 1000, born: now };
    if (state.spawn) { state.spawnsThisRun = (state.spawnsThisRun || 0) + 1; events.push({ kind: 'spawn', spawn: state.spawn }); }
  }
  const hour = new Date(now).getHours();
  if (hour >= 22 || hour < 5) state.playedLate = true;
  const after = boardMetrics(state);
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.test(state, after, now)) {
      state.achievements.push(a.id);
      addLog(state, a.emoji, `Badge earned: ${a.name}`, now);
      events.push({ kind: 'achievement', achievement: a });
    }
  }
  state.lastSeen = now;
  return events;
}

/** Names of the carers on the team this run (real names first, then fallbacks, then numbered). */
export function teamNames(state, names) {
  const count = state.buildings.carer || 0;
  const pool = names && names.length ? names : FALLBACK_NAMES;
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = pool[i % pool.length];
    out.push(i < pool.length ? base : `${base} ${Math.floor(i / pool.length) + 1}`);
  }
  return out;
}

export function achievementList(state, now = Date.now()) {
  const m = boardMetrics(state);
  return ACHIEVEMENTS.map((a) => ({ ...a, done: state.achievements.includes(a.id), close: !state.achievements.includes(a.id) && a.test(state, m, now) }));
}

export function perkList(state) {
  const next = legacyPerk(legacyPerks(state) + 1);      // only the next endless one is ever offered
  return [...PERKS, next].map((p) => ({ ...p, owned: state.perks.includes(p.id), affordable: starsAvailable(state) >= p.cost }));
}

/** The conditional bonuses you own, and whether each is switched on right now. */
export function activeConditionals(state, m = boardMetrics(state)) {
  return ownedUpgrades(state)
    .filter((u) => u.kind === 'conditional')
    .map((u) => {
      const share = conditionShare(u, state, m);
      return { id: u.id, name: u.name, emoji: u.emoji, label: u.label, mult: u.mult, share, on: share >= 0.999, paying: 1 + (u.mult - 1) * share };
    });
}

/** Plain data for saving. */
export function serialise(state) {
  const { spawn, effects, cooldowns, ...rest } = state;
  return { ...rest, effects: effects.filter((e) => e.until > Date.now()) };
}
