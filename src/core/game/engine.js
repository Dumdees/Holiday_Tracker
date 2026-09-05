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
const OFFLINE_CAP_SECONDS = 16 * 3600;
const OFFLINE_CAP_ONCALL = 24 * 3600;
const OFFLINE_HANDOVERS = 3;      // how many patches the team may hand over while you are away
const OFFLINE_HANDOVERS_ONCALL = 5;
const OFFLINE_HANDOVERS_NIGHT = 8;
const OFFLINE_STAR_SHARE = 0.6;   // and what share of the stars a hand-over you were not there for pays
const OFFLINE_PACE = 1.1;         // how many runs an hour away is worth, before the halving
const OFFLINE_REACH = 0.8;        // and never further than this, so there is always something left to do
const ADMIN_COLLECT_EVERY = 5;
const SPAWN_LIFETIME = 13;
const PRISMATIC_CHANCE_PER_SECOND = 1 / 210;
const CARD_CHANCE_PER_SECOND = 1 / 70;
export const HOUSE_COOLDOWN_MS = 900; // a door you have just knocked on needs a moment

const PERKS_BY_ID = new Map(PERKS.map((p) => [p.id, p]));
const STAGE_BONUS = 1.6;          // what reaching a stage is worth, for ever
const COST_EASE_AT = 1000;        // after this many, prices climb more gently so they stay finite
const COST_GROWTH_LATE = 1.04;
/** One visit of your own is never worth more than this much of a second's takings. */
export function clickShareCap(level) { return Math.min(0.9, 0.1 + 0.05 * level); }
export const PENNY_BARS = [0.05, 0.01, 0.005];   // shares of your income an upgrade has to clear
export const KEEP_UNDER = 30;      // seconds: nothing that pays back this fast is ever folded away
export const SHELF_KEEP = 6;       // how many earning tiles a shelf should keep if it can
export const CARRY_SECONDS = 25;   // how much of the new round's income a hand-over may carry over
export const STAY_KEEPS = 0.03;    // what every ten times over the line is worth, for ever
export const STAY_KEEPS_MAX = 0.5;   // and the most one run can add
export const STAY_KEEPS_TOTAL = 1;   // and the most it ever comes to, so it cannot run away
export const STAY_BONUS = 0.3;    // extra stars for every ten times over the finish line you go
export const STAY_BONUS_MAX = 2; // and never more than twelve times, however long you stay
export const STAY_LIFTS = 0.15;   // and a long stay lifts the next figure by this much of where you got to
export const KEEPS_ITS_SYSTEMS = new Set(['admin', 'direct-debit', 'oncall']);
export const CHIP_QTY = 10;        // the quantity the shop's Best value chip is judged at
export const BRANCH_RETHINK = 3;   // how often a hand-over reopens what you are known for
export const TAPS_A_SECOND = 2;    // what a brisk round of door-knocking looks like, for scoring

/** What your own visits are worth a second if you keep knocking. */
export function tapIncome(state, now = Date.now()) { return clickValue(state, now) * TAPS_A_SECOND; }

/** The share of everything coming in that your own visits would account for at that pace. */
export function tapShare(state, now = Date.now()) {
  const tap = tapIncome(state, now);
  const all = productionPerSecond(state, now) + tap;
  return all > 0 ? tap / all : 0;
}
export const MILESTONES_BEYOND = 6;   // how many more doublings there are past the printed table

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
    peakAtTarget: 0,           // what you were earning when the finish line was crossed
    stayBonus: 0,              // what carrying runs on past their figure has been worth, for ever
    runStartIncome: 0,         // what you were earning when this run began
    bestRating: 0,             // the best the agency has ever been rated
    pace: [],                   // a short trail of (seconds into the run, earned so far)
    lifetimeEarned: 0,
    visits: 0,
    clicks: 0,
    collections: 0,
    buildings: { client: 5 },   // a few front doors to be going on with; you do the visits yourself at first
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
  // A game saved before the finish line was kept gets one worked out from how it is doing now,
  // rather than the figure the very first run was asked for.
  if (!(from.runTarget > 0)) {
    state.runTarget = runTargetFor(state.level, Math.max(state.lastPeak || 0, steadyIncome(state)), 0);
  }
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
  // A round grows by multiplying, so how far through a run you are is a matter of how many times
  // the takings have doubled, not of how much money is on the table. Time away is measured in whole
  // runs: it carries the one in progress along, and then the team hands the patch over without you.
  let budget = (seconds / 3600) * OFFLINE_PACE * efficiency;
  const step = Math.min(budget, OFFLINE_REACH);
  const logTarget = Math.log10(1 + expandRequirement(state));
  const logEarned = Math.log10(1 + Math.max(0, state.runEarned || 0));
  const wanted = Math.pow(10, logEarned + step * Math.max(0, logTarget - logEarned)) - 1;
  const earned = Math.max(rate * seconds * efficiency, wanted - (state.runEarned || 0), 0);
  const visits = visitsPerSecond(state) * seconds * efficiency;
  state.visits += visits;
  credit(state, earned);
  state.offlineReturns += 1;
  budget -= step;
  // If there was time for whole runs on top, the team saw them through – at a share of the stars,
  // and only so many, so there is still a patch to come back to.
  const most = state.perks.includes('nightshift') ? OFFLINE_HANDOVERS_NIGHT : oncall ? OFFLINE_HANDOVERS_ONCALL : OFFLINE_HANDOVERS;
  let handovers = 0, stars = 0;
  while (budget >= 1 && handovers < most) {
    const need = expandRequirement(state) - state.runEarned;
    if (need > 0) credit(state, need);
    const due = Math.max(1, Math.floor(starsOnExpand(state) * OFFLINE_STAR_SHARE));
    const before = state.starsEarned;
    if (!expand(state, now)) break;
    state.starsEarned = before + due;      // a share of what you would have earned yourself
    stars += due;
    handovers += 1;
    budget -= 1;
  }
  // The hours away are not part of the run, and nothing was measured during them.
  state.runStartedAt = now;
  state.pace = [];
  return { seconds, earned, visits, efficiency, reach: step, handovers, stars };
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
  let f = 2;
  for (const u of ownedUpgrades(state)) if (u.kind === 'milestone') f += u.add || 0.2;
  return Math.min(5, f);      // every tenth is worth this much, and it stops at five
}

/** How many milestones a count has passed, and what that is worth. */
/** How much sooner the milestones come round, from anything on the shelf that says they do. */
export function milestonePace(state) {
  let f = 1;
  for (const u of ownedUpgrades(state)) if (u.milestoneEvery) f *= u.milestoneEvery;
  return f;
}

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

/**
 * How many things a synergy is counting. A named rung counts itself; `fromSide` counts whatever you
 * own most of on that side, so a stage's own synergy is never worth nothing because you happen to
 * own none of the rung it was named after.
 */
function synergyCount(state, u) {
  if (u.from) return state.buildings[u.from] || 0;
  let best = 0;
  for (const [id, n] of Object.entries(state.buildings)) {
    const def = buildingDef(state, id);
    if (def && def.side === u.fromSide && n > best) best = n;
  }
  return best;
}

/** What one of a thing delivers a second, after its own upgrades, milestones and synergies. */
export function buildingRate(state, id) {
  const b = buildingDef(state, id);
  if (!b || !b.rate) return 0;
  const count = state.buildings[id] || 0;
  let mult = Math.pow(milestoneFactor(state), milestonesPassed(count * milestonePace(state)));
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'building' && u.building === id) mult *= u.mult || 2;
    if (u.kind === 'side' && u.side === b.side) mult *= 1 + u.flat;
    if (u.kind === 'synergy') {
      const applies = u.to === id || (u.to === '*') || (u.to === '*team' && b.side === 'team') || (u.to === '*work' && b.side === 'work');
      if (applies) mult *= 1 + Math.min(u.cap, u.per * synergyCount(state, u));
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
  // A reputation does not vanish because you took a bigger patch on. Whatever the agency has been
  // rated before, it never drops more than one rung below it while the new round finds its feet.
  const floor = Math.max(0, (state.bestRating || 0) - 1);
  return Math.max(i, floor);
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
  // Anything that says the thinner side is covered lifts it towards the fuller one before the two
  // are put together, so a lopsided round still gets most of its visits done.
  let f = 0;
  for (const u of ownedUpgrades(state)) if (u.sideFloor) f = Math.max(f, u.sideFloor);
  const w = f > 0 ? Math.max(work, team * f) : work;
  const t = f > 0 ? Math.max(team, work * f) : team;
  return { work, team, visits: combineSides(w, t), ratingIndex: ratingIndex(state), ratingScore: ratingScore(state) };
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
export const SETTLE_IN = 90;       // how long a patch takes to get to know you, in seconds
export const SETTLE_FROM = 0.6;    // and what the scaling choices pay before it does

/**
 * What a scaling choice is worth: the more of the thing you own, and the longer you have stayed on
 * this patch. Reputation takes time to build, so these reward seeing a run through where the flat
 * choices pay everything they are going to pay in the first minute.
 */
function scalingBonus(state, u, now = Date.now()) {
  const froms = Array.isArray(u.from) ? u.from : [u.from];
  let count = 0;
  for (const f of froms) count += state.buildings[f] || 0;
  const settled = Math.max(0, (now - (state.runStartedAt || now)) / 1000) / SETTLE_IN;
  const ramp = SETTLE_FROM + (1 - SETTLE_FROM) * Math.min(1, settled);
  return Math.min(u.cap, u.per * count) * ramp;
}

/** Everything that multiplies all income: upgrades, conditions, rating, morale, stars, effects. */
export function globalMultiplier(state, now = Date.now(), m = boardMetrics(state)) {
  let mult = 1;
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'global') mult *= u.mult;
    else if (u.kind === 'conditional') mult *= 1 + (u.mult - 1) * conditionShare(u, state, m);
    else if (u.kind === 'branch-council') mult *= u.mult;
    else if (u.kind === 'branch-scaling') mult *= u.mult * (1 + scalingBonus(state, u, now));
  }
  mult *= RATINGS[m.ratingIndex].mult;
  mult *= Math.pow(STAGE_BONUS, state.level);   // every stage you have reached, for ever
  mult *= 1 + (state.stayBonus || 0);          // and every run you carried on with past its figure
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

/** How much of a second's takings your own visit is worth, after the cap for this stage. */
export function clickShare(state) {
  let pct = 0;
  let mult = 1;
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'click') { pct += u.pct || 0; mult *= u.mult || 2; }
    if (u.kind === 'clickpct') pct += u.pct || 0.01;
    if (u.clickBoost) mult *= u.clickBoost;
  }
  if (state.perks.includes('legend')) mult *= 10;
  // Everything that says it makes your own visits stronger multiplies the share as well as the
  // flat part, so none of them is quietly worthless. The cap still has the last word.
  return Math.min(clickShareCap(state.level), pct * mult);
}

/** What another share would really add, once the cap has had its say. */
export function clickShareGain(state, u) {
  const before = clickShare(state);
  const after = clickShare({ ...state, upgrades: [...state.upgrades, u.id] });
  return after - before;
}

export function clickValue(state, now = Date.now()) {
  let v = visitValue(state);
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'click') v *= u.mult || 2;
    if (u.clickBoost) v *= u.clickBoost;
  }
  if (state.perks.includes('legend')) v *= 10;
  let value = v * globalMultiplier(state, now) + clickShare(state) * productionPerSecond(state, now);
  for (const e of state.effects) if (e.clickMult && e.until > now) value *= e.clickMult;
  return value;
}

// ---------- Prices ----------

export function costDiscount(state, id) {
  let f = state.perks.includes('playbook') ? 0.9 : 1;
  for (const u of ownedUpgrades(state)) {
    if (u.kind === 'discount' && u.building === id) f *= u.factor;
    if (u.kind === 'branch-council') { const b = buildingDef(state, id); if (b && b.side === (u.discountSide || 'work')) f *= u.discount; }
    if (u.sideDiscount) { const b = buildingDef(state, id); if (b && b.side === u.side) f *= u.sideDiscount; }
  }
  return f;
}

/** What the nth one of something costs. Growth eases off past a thousand so prices stay real. */
function unitCost(base, n) {
  const steep = Math.min(n, COST_EASE_AT);
  const rest = Math.max(0, n - COST_EASE_AT);
  return base * Math.pow(COST_GROWTH, steep) * Math.pow(COST_GROWTH_LATE, rest);
}

/**
 * What a rung costs at this stage. The printed prices are for the very first run, and every stage
 * you have reached makes everything earn more, so the rungs climb by exactly that much – no more.
 * Tying them to the finish line instead compounds: the line grows twenty-fold a stage while the
 * income a run *starts* with grows about twice, and by the eighth stage nothing is affordable.
 */
export function rungPrice(state, b) {
  return b.baseCost * Math.pow(STAGE_BONUS, state.level);
}

/** How many of a rung are priced as though you did not own them yet. */
export function bulkAllowance(state) {
  let n = 0;
  for (const u of ownedUpgrades(state)) n += u.bulkPrice || 0;
  return n;
}

export function buildingCost(state, id, qty = 1) {
  const b = buildingDef(state, id);
  if (!b) return Infinity;
  const owned = Math.max(0, (state.buildings[id] || 0) - bulkAllowance(state));
  const base = rungPrice(state, b);
  let total = 0;
  for (let i = 0; i < qty; i++) total += unitCost(base, owned + i);
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
  const owned = Math.max(0, (state.buildings[id] || 0) - bulkAllowance(state));
  const discount = costDiscount(state, id);
  const base = rungPrice(state, b);
  let n = 0, total = 0;
  while (n < 2000) {
    const next = total + unitCost(base, owned + n);
    if (!(Math.ceil(next * discount) <= funds)) break;
    total = next;
    n++;
  }
  return n;
}

export function maxAffordable(state, id) {
  return maxAffordableFor(state, id, state.funds);
}

/**
 * What a shelf item is priced against: the rate you are earning at the moment it appears. The run
 * has to have earned a set share of the way to the finish line before the item is on the shelf, and
 * a round that is doubling steadily is earning about that much divided by the doubling rate – so
 * this is a fixed figure for the run rather than something that runs away from the player.
 */
export function shelfReference(state, def) {
  const target = expandRequirement(state);
  const at = Math.pow(10, Math.log10(1 + target) * (def.along || 0)) - 1;   // takings when it appears
  // Floored on what the run opened with, or the first few would be free the moment they appeared.
  return Math.max(1, at * RUN_DOUBLING, (state.runStartIncome || 0) * SHELF_FLOOR);
}

export function upgradeCost(state, id) {
  const def = upgradeById(id);
  if (!def) return Infinity;
  const f = state.perks.includes('playbook') ? 0.9 : 1;
  // A stage's own shelf is priced in seconds of what you are earning when it turns up – worked out
  // from the finish line, not read live. A run's takings double every half minute or so, so a price
  // that followed them was a treadmill: anything costing more than about half a minute of income
  // could never be saved for, and nine of the twelve were never once affordable.
  if (def.costSeconds) return Math.ceil(def.costSeconds * shelfReference(state, def) * f);
  const climbed = def.cost * Math.pow(Math.max(1, expandRequirement(state) / FIRST_TARGET), PRICE_CLIMB);
  return Math.ceil(climbed * f);
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

/**
 * Extra income a second from owning an upgrade. A discount earns nothing by itself, so it is judged
 * on what the saving buys: how many more of that rung the same money now reaches.
 */
export function upgradeGain(state, id, now = Date.now(), income = null) {
  const before = income === null ? productionPerSecond(state, now) : income;
  const def = upgradeById(id);
  if (def && def.kind === 'discount' && def.sideDiscount) {
    // The same question asked of a whole side: what does an armful buy now that it is cheaper?
    const with_ = { ...state, upgrades: [...state.upgrades, id] };
    const budget = Math.max(before * 60, state.funds);
    let plainBest = 0, cheapBest = 0;
    for (const rung of unlockedBuildings(state)) {
      if (rung.side !== def.side) continue;
      const n1 = maxAffordableFor(state, rung.id, budget);
      const n2 = maxAffordableFor(with_, rung.id, budget);
      if (n1 >= 1) plainBest = Math.max(plainBest, buildingGain(state, rung.id, n1, now, before));
      if (n2 >= 1) cheapBest = Math.max(cheapBest, buildingGain(with_, rung.id, n2, now, before));
    }
    return Math.max(0, cheapBest - plainBest);
  }
  if (def && def.kind === 'discount' && def.building) {
    // A discount earns nothing by itself, so it is judged on what it adds to an armful: the money
    // that would have bought ten of the rung buys several more once it is cheaper.
    // A discount earns nothing by itself, so it is judged on what a minute's takings buys with it
    // against what the same minute buys without. A discount on something a minute cannot reach is
    // worth nothing today, however grand the rung.
    // A discount earns nothing by itself, so it is judged on what it adds to an armful: the money
    // that would have bought so many of the rung buys more once it is cheaper. A discount on
    // something a minute's takings cannot reach is worth nothing today, however grand the rung.
    const budget = Math.max(before * 60, state.funds);
    const plain = maxAffordableFor(state, def.building, budget);
    if (plain < 1) return 0;
    const cheaper = maxAffordableFor({ ...state, upgrades: [...state.upgrades, id] }, def.building, budget);
    if (cheaper <= plain) return 0;
    return buildingGain(state, def.building, cheaper, now, before) - buildingGain(state, def.building, plain, now, before);
  }
  if (def && (def.kind === 'click' || def.kind === 'clickpct' || def.clickBoost)) {
    // Your own visits earn nothing unless you make them, so these were scored at nothing and sank
    // to the bottom of the shop – which quietly steered everybody away from the strongest way to
    // play. Judge them on what a brisk round of knocking would really bring in.
    const with_ = { ...state, upgrades: [...state.upgrades, id] };
    const add = (clickValue(with_, now) - clickValue(state, now)) * TAPS_A_SECOND;
    if (def.kind === 'clickpct' || def.kind === 'click') return Math.max(0, add);
    return Math.max(0, add) + (incomeWith(state, { upgrades: [...state.upgrades, id] }, now) - before);
  }
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
  const offer = { ...u, cost, gain, income, payback: paybackSeconds(cost, gain), affordable: state.funds >= cost };
  if (u.kind === 'clickpct' || u.kind === 'click') offer.clickAdd = clickShareGain(state, u);
  return offer;
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
  return upgradesFor(state.level).filter((u) => {
    if (state.upgrades.includes(u.id) || !u.unlock(state)) return false;
    // A bigger share of your own visits is worth nothing once the share is at its limit for this
    // stage, so it is not put on the shelf pretending otherwise.
    if (u.kind === 'clickpct' && !(clickShareGain(state, u) > 0)) return false;
    return true;
  });
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
  const order = (a, b) => {
    const fa = free(a), fb = free(b);
    if (fa && fb) return b.gain - a.gain;
    if (fa !== fb) return fa ? -1 : 1;
    return (rank(a) - rank(b)) || (a.cost - b.cost);
  };
  const all = availableUpgrades(state).map((u) => upgradeOffer(state, u, now, earning)).sort(order);
  // Two places are kept for the things that do a job rather than earn – the office admin, the
  // on-call phone, a share of your own visits – so a whole kind of upgrade is never pushed off the
  // shelf by things with a payback time.
  const quiet = all.filter((u) => !(u.gain > 0) && u.kind !== 'discount').slice(0, 2);
  let rest = all.filter((u) => !quiet.includes(u));
  // Pennies are folded away with the outgrown rungs. A shelf half full of things worth a hundredth
  // of a percent reads as a shelf with nothing on it, however cheap they are. The bar is raised as
  // far as it will go while there is still a proper shelf to shop from.
  let folded = null;
  for (const bar of PENNY_BARS) {
    // Anything that pays for itself in half a minute is free money whatever share of your income it
    // is, so it is never folded away – that emptied the shelf at the end of a long run.
    const worthwhile = rest.filter((u) => !(u.gain > 0) || u.gain >= income * bar || u.payback < KEEP_UNDER);
    folded = worthwhile;
    if (worthwhile.length >= Math.min(rest.length, SHELF_KEEP)) break;
  }
  // Even when nothing clears the lowest bar, the pennies are still folded away: a shelf of twelve
  // tiles all reading the same thing is worse than a short shelf that means something.
  rest = folded || rest;
  const shown = [...rest.slice(0, Math.max(0, limit - quiet.length)), ...quiet].sort(order);
  return Object.assign(shown, { total: all.length });
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
  // The row the shop puts its Best value chip on, so the advice can never point the other way.
  let chip = null;
  for (const b of unlockedBuildings(state)) {
    const offer = buildingOffer(state, b.id, CHIP_QTY, now, income);
    if (offer.gain > 0 && offer.gain >= income * 0.005 && (!chip || offer.payback < chip.payback)) chip = { side: b.side, payback: offer.payback };
    const qty = maxAffordableFor(state, b.id, budget);
    if (!qty) continue;                       // only what a minute's takings would really buy
    const gain = buildingGain(state, b.id, qty, now, income);
    if (gain > worth[b.side]) worth[b.side] = gain;
  }
  // Where a minute's takings and the chip disagree, say nothing rather than argue with the shop.
  if (chip && worth.work > 0 && worth.team > 0) {
    const byBudget = worth.team > worth.work ? 'team' : 'work';
    if (byBudget !== chip.side) { worth.work = 0; worth.team = 0; }
  }
  const ratio = m.team / m.work;
  // A plain description of the board, with no direction in it. The advice below is the only thing
  // that points anywhere, so the two halves of the strip can never argue with each other.
  // Short. The two figures either side of this strip already say how far apart the sides are, and on
  // a phone every extra clause is another line of red text over the picture.
  const state_ = ratio > 1.1 ? 'Your team is ahead of the work.'
    : ratio < 0.9 ? 'There is more work than your team can cover.'
    : 'The two sides are level.';
  // Name the bonus that is furthest from paying in full: that is the one the board is costing you.
  const live = activeConditionals(state, m);
  const behind = live.filter((c) => c.share < 0.98).sort((a, b) => a.share - b.share)[0];
  const gap = worth.work / Math.max(worth.team, 1e-9);
  const side = (!worth.work && !worth.team) ? 'balanced' : gap > 1.25 ? 'work' : gap < 0.8 ? 'team' : 'balanced';
  // Where the side that is already ahead is also the cheaper pound, say why, or the strip reads as
  // nonsense: "your team could cover three times the work – put it into the team".
  const ahead = ratio > 1.1 ? 'team' : ratio < 0.9 ? 'work' : 'balanced';
  const odd = side !== 'balanced' && side === ahead;   // the cheaper pound is on the fuller side
  const tip = side === 'work'
    ? (odd ? ' Even so, front doors are cheap just now – keep taking work on.' : ' Spend the next minute taking work on.')
    : side === 'team'
      ? (odd ? ' Even so, carers are cheap just now – keep hiring.' : ' Spend the next minute on the team.')
      : ' Either side is worth about the same just now.';
  // Only mention a bonus that pulls the same way as the advice, or the strip argues with itself.
  const pulls = (c) => (/team|rushed|same carer|tidy|led/i.test(`${c.name} ${c.label}`) ? 'team' : 'work');
  const agrees = behind && (side === 'balanced' || pulls(behind) === side) ? behind : null;
  // Said the way the rating card says it: the name, then a finished sentence. "Nobody is rushed is
  // paying in full" reads like a word is missing.
  const full = live.find((c) => c.share >= 0.999);
  const holding = agrees
    ? ` Your bonus "${agrees.name}" is not paying in full yet.`
    : (full ? ` Your bonus "${full.name}" is paying in full.` : '');
  // Two clauses at most. On a phone this is four lines of red text under the picture, and the third
  // sentence – which the rating card already says, word for word – was the one that got skipped.
  if (!worth.work && !worth.team) return { side: 'balanced', ratio, advice: `${state_}${holding}` };
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
export const RUN_SECONDS = 420;
/** ...and this many times what the last run was asked for, so the stages lengthen a little each time. */
export const RUN_BEAT = 6;
/** What the earliest stages ask for instead, easing back to the figure above by stage eight. */
export const RUN_BEAT_EARLY = 9;
/** ...and never more than this many times, however far a lucky run overshot. */
export const RUN_BEAT_MAX = 60;
/** How hard the printed prices climb as the runs get bigger. 1 keeps them exactly in step. */
export const PRICE_CLIMB = 0.4;
const FIRST_TARGET = 1.2e5;

/**
 * What a run has to earn to be worth handing over: seven minutes at the best rate the last run
 * reached, or six times what the last run was asked for, whichever is more – and the printed figure
 * for the first stage, before there is a last run to go on. It is worked out once, when the run
 * starts, and never moves again, so the bar only ever goes forwards, a lucky rainbow cannot push the
 * finish line away, and the whole shop can be priced against it.
 */
/**
 * The least a stage may ask for, as a multiple of the last one. The early stages ask for more,
 * easing back as the runs get long enough on their own, so a new player is not wiping the board
 * every ninety seconds before they know what any of it does.
 */
export function beatFor(level) {
  return Math.max(RUN_BEAT, RUN_BEAT_EARLY - level * 0.4);
}

export function runTargetFor(level, lastPeak, lastTarget) {
  const first = lastTarget || lastPeak ? 0 : levelInfo(1).threshold;   // only the very first run
  const beat = beatFor(level);
  const byTarget = (lastTarget || 0) * beat;
  const byPeak = (lastPeak || 0) * RUN_SECONDS;
  // A run that overshoots hugely would otherwise set the next one an impossible figure, so the
  // step up is held between six and sixty times what the last run was asked for.
  const held = lastTarget ? Math.min(byPeak, lastTarget * RUN_BEAT_MAX) : byPeak;
  return Math.max(first, byTarget, held);
}

/** Income a second with the temporary luck taken out: what the pacing is measured against. */
export function steadyIncome(state) {
  return productionPerSecond(state, Number.MAX_SAFE_INTEGER);
}

export function expandRequirement(state) {
  if (state.runTarget > 0) return state.runTarget;
  return runTargetFor(state.level, state.lastPeak, 0);   // a save from before this was kept
}

/** The plain fraction of the way there, and how long the rest looks like taking. */
export const SHELF_FLOOR = 0.5;     // no shelf item costs less than this many seconds of the opening rate
export const RUN_DOUBLING = 0.3;    // how fast a run's takings grow, per second
export const PACE_EVERY = 5;       // how often the trail takes a reading, in seconds
export const PACE_TRAIL = 40;      // how far back it looks
export const PACE_SETTLE = 20;     // no forecast until a run has had this long to get going

/**
 * Keep a short trail of how much this run has earned, so the finish line can be worked out from
 * how fast the money is growing rather than from what is coming in this second. A round grows by
 * multiplying, not by adding, so "what is left divided by the rate" is wrong by orders of
 * magnitude for most of a run.
 */
export function notePace(state, now = Date.now()) {
  const t = Math.max(0, (now - (state.runStartedAt || now)) / 1000);
  const trail = state.pace || (state.pace = []);
  const last = trail[trail.length - 1];
  if (last && t - last.t < PACE_EVERY) return;
  if (last && t < last.t) trail.length = 0;          // the clock went backwards; start again
  trail.push({ t, e: Math.max(0, state.runEarned) });
  while (trail.length > 2 && t - trail[0].t > PACE_TRAIL) trail.shift();
}

/**
 * How long the rest of the run is likely to take. Measured from the trail: if the run has been
 * doubling its takings every so often, it will keep doing that, so the answer is how many of those
 * doublings are left. Falls back to the flat sum when there is nothing to measure yet.
 */
export function paceGrowth(state, now = Date.now()) {
  const t = Math.max(0, (now - (state.runStartedAt || now)) / 1000);
  const earned = Math.max(0, state.runEarned || 0);
  const old = (state.pace || []).filter((p) => t - p.t >= PACE_SETTLE * 0.6 && p.e > 0)[0];
  if (!old || !(earned > old.e) || !(t > old.t)) return 0;
  const g = Math.log(earned / old.e) / (t - old.t);
  return g > 1e-4 ? g : 0;
}

export function forecastSeconds(state, target, earned, rate, now = Date.now()) {
  const left = Math.max(0, target - earned);
  if (left <= 0) return 0;
  if (!(rate > 0)) return Infinity;                 // nothing coming in at all
  const flat = left / rate;
  const growth = paceGrowth(state, now);
  if (growth > 0 && earned > 0) return Math.min(flat, Math.max(0, Math.log(target / earned) / growth));
  // Nothing measured yet. Better to say so than to quote a number that is wrong by a mile.
  return flat > 1800 ? null : flat;
}

export function expandOutlook(state, now = Date.now()) {
  const target = expandRequirement(state);
  const earned = Math.max(0, state.runEarned);
  const rate = productionPerSecond(state, now);
  // A run's takings multiply rather than add up, so a bar drawn on the money sits on nothing for
  // most of the run and then jumps. Counting doublings instead tracks how far through you really
  // are, which is what the bar is for.
  const progress = target > 0 ? Math.min(1, Math.log10(1 + earned) / Math.log10(1 + target)) : 0;
  return {
    target,
    earned,
    fraction: target > 0 ? Math.min(1, earned / target) : 0,
    progress,
    seconds: forecastSeconds(state, target, earned, rate, now),
  };
}

export function canExpand(state) {
  return state.runEarned >= expandRequirement(state);
}

/** How much a run being carried on past its finish line is worth in stars. */
export function stayingBonus(state) {
  const want = expandRequirement(state);
  if (!(want > 0) || !(state.runEarned > want)) return 1;
  return Math.min(STAY_BONUS_MAX, 1 + STAY_BONUS * Math.log10(state.runEarned / want));
}

export function starsOnExpand(state) {
  const share = state.perks && state.perks.includes('founders') ? 1.25 : 1;
  const due = (starsForLifetime(state.lifetimeEarned) - state.starsEarned) * share * stayingBonus(state);
  // Never nothing. A hand-over that pays no star at all is a promise broken, and the arrears can be
  // empty simply because the last one already banked the decade.
  return Math.max(1, Math.floor(due));
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
  // The next figure is set from what you were earning when the line was crossed, so overshooting
  // does not raise it in proportion – but a long stay does lift it a little, so staying on is a
  // trade rather than something for nothing.
  const crossed = state.peakAtTarget || Math.max(state.runPeak || 0, steadyIncome(state));
  const peak = Math.max(crossed, STAY_LIFTS * steadyIncome(state));

  const bestRun = Math.max(state.bestRun || 0, state.runEarned);
  const level = state.level + 1;
  const overshoot = Math.max(0, state.runEarned - expandRequirement(state));
  // Carrying a run on past its figure is worth something that lasts, and worth it in the same
  // currency as a stage: stars are only three per cent each and could never bridge the gap.
  const overBy = overshoot > 0 ? Math.log10(state.runEarned / expandRequirement(state)) : 0;
  const stayBonus = Math.min(STAY_KEEPS_TOTAL, (state.stayBonus || 0) + Math.min(STAY_KEEPS_MAX, STAY_KEEPS * overBy));
  const keep = {
    startedAt: state.startedAt, lifetimeEarned: state.lifetimeEarned, achievements: state.achievements,
    bestRun, level, starsEarned: state.starsEarned + gained, starsSpent: state.starsSpent,
    perks: state.perks, prismaticHires: state.prismaticHires, prismaticsMet: state.prismaticsMet,
    cardsOpened: state.cardsOpened, offlineReturns: state.offlineReturns, playedLate: state.playedLate,
    bestRating: state.bestRating || 0, stayBonus,
    // The office does not forget how to run its own payroll because the patch got bigger.
    upgrades: state.upgrades.filter((id) => KEEPS_ITS_SYSTEMS.has(id)),
    clicks: state.clicks, visits: state.visits, collections: state.collections, log: state.log,
    // The next run's finish line, worked out now and left alone until it is crossed.
    lastPeak: peak, runPeak: 0, peakAtTarget: 0, pace: [],
    runTarget: runTargetFor(level, peak, expandRequirement(state)),
    // What you are known for is a decision about the agency, not about one round, so it stays with
    // you. Every third hand-over it is opened up again, in case you want to be known for something
    // else now the patch is bigger.
    branches: level % BRANCH_RETHINK === 0 ? {} : { ...(state.branches || {}) },
  };
  const fresh = newGame(now);
  Object.assign(state, fresh, keep, { runStartedAt: now, lastSeen: now });
  const kit = startingKit(state.level);
  state.buildings = { ...state.buildings, ...kit };
  applyStartPerks(state);
  state.runStartIncome = steadyIncome(state);
  // Anything the run earned beyond what it was asked for comes with you – but only a minute and a
  // half of what the new round earns. Any more and the money from the old patch buys the whole
  // ladder in the first few seconds, and the new patch is over before it has started.
  state.funds = Math.min(overshoot, CARRY_SECONDS * steadyIncome(state));
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
    const early = (state.spawnsThisRun || 0) <= 2 && state.level === 0;   // the first two are gentle
    // Held against what this run has to earn as well as against the rate, so a lucky week is a
    // lovely moment rather than the thing that decides how far you get.
    if (effect.id === 'care-burst') amount = Math.max(25, Math.min(prod * (early ? 90 : 900), Math.max(state.funds * 0.15, prod * 120), expandRequirement(state) * 0.05));
    if (effect.id === 'lucky-hire') state.prismaticHires = [...(state.prismaticHires || []), spawn.name];
  } else {
    state.cardsOpened += 1;
    effect = pickWeighted(CARD_EFFECTS, rng);
    const early = (state.cardsOpened || 0) <= 1 && state.level === 0;
    if (effect.id === 'card-cash') amount = Math.max(10, Math.min(prod * (early ? 45 : 60 + Math.floor(rng() * 240)), Math.max(state.funds * 0.1, prod * 60), expandRequirement(state) * 0.02));
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
  // The rate at the moment the finish line was crossed. The next stage's figure is set from this,
  // not from where the run finally got to, so staying on a patch is a choice and not a punishment.
  if (!state.peakAtTarget && state.runEarned >= expandRequirement(state)) state.peakAtTarget = steady;
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
  notePace(state, now);
  if (m.ratingIndex > (state.bestRating || 0)) state.bestRating = m.ratingIndex;
  // A run that has earned nothing at all after a minute is one where nobody has found the collect
  // button yet. The office does it once, rather than letting the whole run go to waste.
  if (state.runEarned <= 0 && state.invoices > 0 && now - (state.runStartedAt || now) > 60000) {
    const amount = state.invoices;
    state.invoices = 0;
    state.collections += 1;
    credit(state, amount);
    events.push({ kind: 'collected', amount, byOffice: true });
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

/**
 * The badge to put on screen as the next thing to aim for: the one that would come first if the
 * business grew a little. Without this the same far-off badge sits there for hours.
 */
export function nextGoal(state, now = Date.now()) {
  const undone = ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id));
  if (!undone.length) return null;
  for (const k of [1.05, 1.2, 1.5, 2, 3, 5, 10, 50]) {
    const probe = {
      ...state,
      buildings: Object.fromEntries(Object.entries(state.buildings).map(([id, n]) => [id, Math.ceil(n * k)])),
      clicks: Math.ceil(state.clicks * k),
      visits: state.visits * k,
      runEarned: state.runEarned * k,
      lifetimeEarned: state.lifetimeEarned * k,
      starsEarned: Math.ceil(state.starsEarned * k),
    };
    const m = boardMetrics(probe);
    for (const a of undone) if (a.test(probe, m, now)) return a;
  }
  return undone[0];
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
