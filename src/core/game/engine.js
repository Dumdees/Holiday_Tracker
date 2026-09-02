// The Care Empire game engine: pure functions over a plain state object. No DOM, no timers.
// The view calls tick() many times a second and the other functions when the player acts.
import { BUILDINGS, UPGRADES, UPGRADES_BY_ID, ACHIEVEMENTS, PERKS, PRISMATIC_EFFECTS, CARD_EFFECTS, COST_GROWTH, levelInfo, FALLBACK_NAMES } from './data.js';

export const SAVE_VERSION = 1;
const OFFLINE_CAP_SECONDS = 8 * 3600;
const ADMIN_COLLECT_EVERY = 5;
const SPAWN_LIFETIME = 13;
const PRISMATIC_CHANCE_PER_SECOND = 1 / 210;
const CARD_CHANCE_PER_SECOND = 1 / 70;

const BUILDINGS_BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));
const PERKS_BY_ID = new Map(PERKS.map((p) => [p.id, p]));

/** A brand-new game. `now` is a millisecond timestamp. */
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
    buildings: {},
    upgrades: [],
    achievements: [],
    level: 0,
    starsEarned: 0,
    starsSpent: 0,
    perks: [],
    effects: [],            // { id, name, emoji, until, prodMult?, clickMult? }
    spawn: null,            // { type: 'prismatic'|'card', name, x, y, until }
    spawnsThisRun: 0,
    prismaticHires: [],     // names of permanent prismatic carers this run
    prismaticsMet: 0,
    cardsOpened: 0,
    offlineReturns: 0,
    playedLate: false,
    adminTimer: 0,
    log: [],                // last few events, newest first: { at, text, emoji }
  };
}

/** Apply the starting bonuses from perks to a fresh run. */
function applyStartPerks(state) {
  if (state.perks.includes('admin') && !state.upgrades.includes('admin')) state.upgrades.push('admin');
  if (state.perks.includes('alumni')) state.buildings.carer = Math.max(state.buildings.carer || 0, 5);
  if (state.perks.includes('momentum')) {
    state.buildings.carer = Math.max(state.buildings.carer || 0, 25);
    state.buildings.car = Math.max(state.buildings.car || 0, 5);
  }
}

/** Load a saved game (any version) and apply time away. Returns { state, offline }. */
export function loadGame(saved, now = Date.now()) {
  const fresh = newGame(now);
  if (!saved || typeof saved !== 'object') return { state: fresh, offline: null };
  const state = { ...fresh, ...saved, buildings: { ...(saved.buildings || {}) }, upgrades: [...(saved.upgrades || [])], achievements: [...(saved.achievements || [])], perks: [...(saved.perks || [])], effects: [], spawn: null, prismaticHires: [...(saved.prismaticHires || [])], log: [...(saved.log || [])].slice(0, 12) };
  state.version = SAVE_VERSION;
  const offline = applyOffline(state, now);
  state.lastSeen = now;
  // A thank-you card waits for anyone who has been away half a day or more – a little reason to come back.
  if (offline && offline.seconds >= 4 * 3600) state.spawn = { type: 'card', name: pickName([], null, Math.random), x: 40, y: 30, until: now + 120000, born: now };
  return { state, offline };
}

/** Earn while the game was closed (half speed, or full with the Night shift perk), up to 8 hours. */
export function applyOffline(state, now) {
  const seconds = Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (now - (state.lastSeen || now)) / 1000));
  if (seconds < 30) return null;
  const rate = productionPerSecond(state);
  if (rate <= 0) return null;
  const efficiency = state.perks.includes('nightshift') ? 1 : 0.5;
  const earned = rate * seconds * efficiency;
  const visits = visitsPerSecond(state) * seconds * efficiency;
  state.visits += visits;
  if (collectionMode(state) === 'instant') credit(state, earned); else { state.invoices += earned; }
  state.offlineReturns += 1;
  return { seconds, earned, visits, efficiency, needsCollect: collectionMode(state) !== 'instant' };
}

// ---------- Numbers ----------
export function collectionMode(state) {
  if (state.upgrades.includes('direct-debit')) return 'instant';
  if (state.upgrades.includes('admin')) return 'admin';
  return 'manual';
}

export function buildingRate(state, id) {
  const b = BUILDINGS_BY_ID.get(id);
  if (!b) return 0;
  let mult = 1;
  for (const u of state.upgrades) { const def = UPGRADES_BY_ID.get(u); if (def && def.kind === 'building' && def.building === id) mult *= 2; }
  return b.rate * mult;
}

export function visitValue(state) {
  let v = 1;
  for (const u of state.upgrades) { const def = UPGRADES_BY_ID.get(u); if (def && def.kind === 'value') v *= 2; }
  return v;
}

/** Everything that multiplies all income: upgrades, achievements, stars, prismatic hires, active effects. */
export function globalMultiplier(state, now = Date.now()) {
  let m = 1;
  for (const u of state.upgrades) { const def = UPGRADES_BY_ID.get(u); if (def && def.kind === 'global') m *= def.mult; }
  m *= 1 + 0.01 * state.achievements.length;
  m *= 1 + 0.02 * state.starsEarned;
  m *= 1 + 0.03 * (state.prismaticHires ? state.prismaticHires.length : 0);
  for (const e of state.effects) if (e.prodMult && e.until > now) m *= e.prodMult;
  return m;
}

export function visitsPerSecond(state) {
  let total = 0;
  for (const b of BUILDINGS) total += (state.buildings[b.id] || 0) * buildingRate(state, b.id);
  return total;
}

export function productionPerSecond(state, now = Date.now()) {
  return visitsPerSecond(state) * visitValue(state) * globalMultiplier(state, now);
}

export function clickValue(state, now = Date.now()) {
  let v = visitValue(state);
  let pct = 0;
  for (const u of state.upgrades) {
    const def = UPGRADES_BY_ID.get(u);
    if (def && def.kind === 'click') v *= 2;
    if (def && def.kind === 'clickpct') pct += 0.01;
  }
  if (state.perks.includes('legend')) v *= 10;
  let value = v * globalMultiplier(state, now) + pct * productionPerSecond(state, now);
  for (const e of state.effects) if (e.clickMult && e.until > now) value *= e.clickMult;
  return value;
}

export function costDiscount(state) {
  return state.perks.includes('playbook') ? 0.9 : 1;
}

export function buildingCost(state, id, qty = 1) {
  const b = BUILDINGS_BY_ID.get(id);
  if (!b) return Infinity;
  const owned = state.buildings[id] || 0;
  let total = 0;
  for (let i = 0; i < qty; i++) total += b.baseCost * Math.pow(COST_GROWTH, owned + i);
  return Math.ceil(total * costDiscount(state));
}

export function maxAffordable(state, id) {
  let n = 0;
  while (n < 1000 && buildingCost(state, id, n + 1) <= state.funds) n++;
  return n;
}

export function upgradeCost(state, id) {
  const def = UPGRADES_BY_ID.get(id);
  return def ? Math.ceil(def.cost * costDiscount(state)) : Infinity;
}

export function unlockedBuildings(state) {
  return BUILDINGS.filter((b) => b.level <= state.level);
}

/** The next building the player can't buy yet, for a "coming soon" hint. */
export function nextLockedBuilding(state) {
  return BUILDINGS.find((b) => b.level > state.level) || null;
}

export function availableUpgrades(state) {
  return UPGRADES.filter((u) => !state.upgrades.includes(u.id) && u.unlock(state)).map((u) => ({ ...u, cost: upgradeCost(state, u.id) })).sort((a, b) => a.cost - b.cost);
}

// ---------- Actions ----------
function credit(state, amount) {
  state.funds += amount;
  state.runEarned += amount;
  state.lifetimeEarned += amount;
}

function addLog(state, emoji, text, now) {
  state.log = [{ at: now, emoji, text }, ...(state.log || [])].slice(0, 12);
}

/** The player does a visit themselves. */
export function click(state, now = Date.now()) {
  const earned = clickValue(state, now);
  state.clicks += 1;
  state.visits += 1;
  credit(state, earned);
  return earned;
}

/** Collect unpaid invoices by hand. */
export function collect(state) {
  const amount = state.invoices;
  if (amount <= 0) return 0;
  state.invoices = 0;
  state.collections += 1;
  credit(state, amount);
  return amount;
}

export function buyBuilding(state, id, qty = 1) {
  if (!BUILDINGS_BY_ID.get(id) || BUILDINGS_BY_ID.get(id).level > state.level) return { bought: 0, spent: 0 };
  const n = qty === 'max' ? maxAffordable(state, id) : qty;
  if (n <= 0) return { bought: 0, spent: 0 };
  const cost = buildingCost(state, id, n);
  if (cost > state.funds) return { bought: 0, spent: 0 };
  state.funds -= cost;
  state.buildings[id] = (state.buildings[id] || 0) + n;
  return { bought: n, spent: cost };
}

export function buyUpgrade(state, id) {
  const def = UPGRADES_BY_ID.get(id);
  if (!def || state.upgrades.includes(id) || !def.unlock(state)) return false;
  const cost = upgradeCost(state, id);
  if (cost > state.funds) return false;
  state.funds -= cost;
  state.upgrades.push(id);
  if (id === 'direct-debit') collect(state);
  return true;
}

// ---------- Legacy (prestige) ----------
export function starsForLifetime(lifetimeEarned) {
  return Math.floor(Math.cbrt(Math.max(0, lifetimeEarned) / 1e3));
}

export function starsAvailable(state) {
  return state.starsEarned - state.starsSpent;
}

export function nextLevel(state) {
  return levelInfo(state.level + 1);
}

/** How far through this run, 0..1. Log-scaled so the bar keeps moving through the long middle. */
export function expandProgress(state) {
  const next = nextLevel(state);
  const floor = next.threshold / 100;
  const earned = Math.max(0, state.runEarned);
  if (earned <= floor) return (earned / floor) * 0.15;
  return Math.min(1, 0.15 + 0.85 * (Math.log(earned / floor) / Math.log(100)));
}

export function canExpand(state) {
  return state.runEarned >= nextLevel(state).threshold;
}

/** Stars the player would gain by expanding now. */
export function starsOnExpand(state) {
  return Math.max(0, starsForLifetime(state.lifetimeEarned) - state.starsEarned);
}

/** Grow to the next stage: the run resets, stars and perks stay. */
export function expand(state, now = Date.now()) {
  if (!canExpand(state)) return null;
  const gained = starsOnExpand(state);
  const keep = { startedAt: state.startedAt, lifetimeEarned: state.lifetimeEarned, achievements: state.achievements, level: state.level + 1, starsEarned: state.starsEarned + gained, starsSpent: state.starsSpent, perks: state.perks, prismaticHires: state.prismaticHires, prismaticsMet: state.prismaticsMet, cardsOpened: state.cardsOpened, offlineReturns: state.offlineReturns, playedLate: state.playedLate, clicks: state.clicks, visits: state.visits, collections: state.collections, log: state.log };
  const fresh = newGame(now);
  Object.assign(state, fresh, keep, { runStartedAt: now, lastSeen: now });
  applyStartPerks(state);
  addLog(state, levelInfo(state.level).emoji, `Expanded to ${levelInfo(state.level).name.toLowerCase()} – ${gained} Legacy ${gained === 1 ? 'Star' : 'Stars'} earned`, now);
  return { gained, level: state.level };
}

export function buyPerk(state, id) {
  const def = PERKS_BY_ID.get(id);
  if (!def || state.perks.includes(id) || starsAvailable(state) < def.cost) return false;
  state.starsSpent += def.cost;
  state.perks.push(id);
  applyStartPerks(state);
  return true;
}

// ---------- Random events ----------
function pickWeighted(list, rng) {
  const total = list.reduce((n, e) => n + e.weight, 0);
  let r = rng() * total;
  for (const e of list) { r -= e.weight; if (r <= 0) return e; }
  return list[list.length - 1];
}

/** A name for a prismatic carer or a hire, drawn from the real team when there is one. */
export function pickName(names, index, rng) {
  const pool = names && names.length ? names : FALLBACK_NAMES;
  if (typeof index === 'number') return pool[index % pool.length];
  return pool[Math.floor(rng() * pool.length)];
}

/** Click the floating prismatic carer or thank-you card. Returns what happened, or null. */
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
  addLog(state, effect.emoji, message + (amount ? ` (+£${Math.floor(amount).toLocaleString('en-GB')})` : ''), now);
  return { type: spawn.type, effect, amount, name: spawn.name, message };
}

// ---------- Time ----------
/**
 * Advance the game by dt seconds. Returns an array of things the view might want to announce:
 * { kind: 'achievement', achievement } | { kind: 'spawn', spawn } | { kind: 'collected', amount }
 */
export function tick(state, dt, now = Date.now(), rng = Math.random, names = []) {
  const events = [];
  dt = Math.max(0, Math.min(dt, 5));
  const rate = productionPerSecond(state, now);
  const visits = visitsPerSecond(state) * dt;
  state.visits += visits;
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
    // Nobody should wait long for their first surprise of a run: after 40 seconds without one, cards come thick and fast.
    const firstSurprise = state.spawnsThisRun === 0 && now - state.runStartedAt > 40000 ? 12 : 1;
    const cChance = CARD_CHANCE_PER_SECOND * (state.perks.includes('cards') ? 2 : 1) * firstSurprise * dt;
    const r = rng();
    if (r < pChance) state.spawn = { type: 'prismatic', name: pickName(names, null, rng), x: 22 + rng() * 56, y: 18 + rng() * 50, until: now + SPAWN_LIFETIME * 1000, born: now };
    else if (r < pChance + cChance) state.spawn = { type: 'card', name: pickName(names, null, rng), x: 22 + rng() * 56, y: 18 + rng() * 50, until: now + SPAWN_LIFETIME * 1000, born: now };
    if (state.spawn) { state.spawnsThisRun = (state.spawnsThisRun || 0) + 1; events.push({ kind: 'spawn', spawn: state.spawn }); }
  }
  const hour = new Date(now).getHours();
  if (hour >= 22 || hour < 5) state.playedLate = true;
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.test(state)) {
      state.achievements.push(a.id);
      addLog(state, a.emoji, `Achievement: ${a.name}`, now);
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

export function achievementList(state) {
  return ACHIEVEMENTS.map((a) => ({ ...a, done: state.achievements.includes(a.id) }));
}

export function perkList(state) {
  return PERKS.map((p) => ({ ...p, owned: state.perks.includes(p.id), affordable: starsAvailable(state) >= p.cost }));
}

/** Plain data for saving. */
export function serialise(state) {
  const { spawn, effects, ...rest } = state;
  return { ...rest, effects: effects.filter((e) => e.until > Date.now()) };
}
