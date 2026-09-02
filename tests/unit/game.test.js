import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../src/core/game/engine.js';
import { BUILDINGS, LEVELS, UPGRADES, ACHIEVEMENTS, PERKS, levelInfo } from '../../src/core/game/data.js';
import { fmtMoney, fmtNum, fmtSeconds } from '../../src/core/game/format.js';

const T0 = Date.UTC(2026, 8, 2, 12, 0, 0);
const rngOf = (values) => { let i = 0; return () => values[i++ % values.length]; };

test('a new game starts with nothing and the player must click', () => {
  const s = g.newGame(T0);
  assert.equal(s.funds, 0);
  assert.equal(g.productionPerSecond(s, T0), 0);
  assert.equal(g.clickValue(s, T0), 1);
  const earned = g.click(s, T0);
  assert.equal(earned, 1);
  assert.equal(s.funds, 1);
  assert.equal(s.visits, 1);
  assert.equal(g.collectionMode(s), 'manual');
});

test('buildings cost 15% more each time and produce into invoices until collected', () => {
  const s = g.newGame(T0);
  s.funds = 1000;
  assert.equal(g.buildingCost(s, 'carer', 1), 15);
  assert.equal(g.buildingCost(s, 'carer', 2), Math.ceil(15 + 15 * 1.15));
  assert.deepEqual(g.buyBuilding(s, 'carer', 1), { bought: 1, spent: 15 });
  assert.equal(s.buildings.carer, 1);
  assert.equal(g.buildingCost(s, 'carer', 1), Math.ceil(15 * 1.15));
  const before = s.funds;
  g.tick(s, 5, T0 + 5000, () => 0.99);
  g.tick(s, 5, T0 + 10000, () => 0.99);
  assert.equal(s.funds, before, 'nothing lands in funds without collecting');
  assert.ok(s.invoices > 1.95 && s.invoices < 2.1, `10s of 0.2 visits/s = ~£2 owed (${s.invoices})`);
  const got = g.collect(s);
  assert.ok(got > 1.99);
  assert.equal(s.invoices, 0);
  assert.equal(s.collections, 1);
});

test('office admin collects every 5 seconds; direct debit is instant', () => {
  const s = g.newGame(T0);
  s.funds = 1e6; s.runEarned = 1e6; s.clicks = 1000;
  g.buyBuilding(s, 'car', 10);
  assert.ok(g.buyUpgrade(s, 'admin'));
  assert.equal(g.collectionMode(s), 'admin');
  let events = [];
  for (let i = 1; i <= 6; i++) events = events.concat(g.tick(s, 1, T0 + i * 1000, () => 0.99));
  assert.ok(events.some((e) => e.kind === 'collected'), 'admin collected once within 6s');
  assert.ok(g.buyUpgrade(s, 'direct-debit'));
  assert.equal(g.collectionMode(s), 'instant');
  const f = s.funds;
  g.tick(s, 1, T0 + 7000, () => 0.99);
  assert.ok(s.funds > f);
  assert.equal(s.invoices, 0);
});

test('upgrades unlock in sensible order and multiply the right things', () => {
  const s = g.newGame(T0);
  s.funds = 1e9; s.runEarned = 1e9;
  assert.ok(!g.availableUpgrades(s).some((u) => u.id === 'carer-t1'), 'no carer upgrade before owning a carer');
  g.buyBuilding(s, 'carer', 5);
  const ids = g.availableUpgrades(s).map((u) => u.id);
  assert.ok(ids.includes('carer-t1') && ids.includes('carer-t2') && !ids.includes('carer-t3'));
  const base = g.productionPerSecond(s, T0);
  assert.ok(g.buyUpgrade(s, 'carer-t1'));
  assert.ok(Math.abs(g.productionPerSecond(s, T0) - base * 2) < 1e-9, 'building upgrade doubles that building');
  assert.ok(g.buyUpgrade(s, 'value-1'));
  assert.ok(Math.abs(g.productionPerSecond(s, T0) - base * 4) < 1e-9, 'visit value doubles all income');
  s.clicks = 10;
  assert.ok(g.buyUpgrade(s, 'click-1'));
  assert.equal(g.clickValue(s, T0), 2 * 2 * g.globalMultiplier(s, T0));
  assert.ok(!g.buyUpgrade(s, 'click-1'), 'cannot buy twice');
  for (const u of UPGRADES) assert.ok(u.cost > 0 && u.name && u.blurb && typeof u.unlock === 'function');
});

test('breakpoints gate buildings and expanding resets the run but keeps legacy', () => {
  const s = g.newGame(T0);
  assert.equal(g.buyBuilding({ ...s, funds: 1e12 }, 'office', 1).bought, 0, 'offices need level 1');
  assert.ok(!g.canExpand(s));
  s.funds = 6e4; s.runEarned = 6e4; s.lifetimeEarned = 6e4;
  g.buyBuilding(s, 'carer', 3);
  assert.ok(g.canExpand(s));
  assert.equal(g.nextLevel(s).name, 'The village');
  const gained = g.starsOnExpand(s);
  assert.equal(gained, Math.floor(Math.cbrt(60)));
  const r = g.expand(s, T0 + 1000);
  assert.deepEqual(r, { gained, level: 1 });
  assert.equal(s.funds, 0);
  assert.deepEqual(s.buildings, {});
  assert.equal(s.runEarned, 0);
  assert.equal(s.lifetimeEarned, 6e4, 'lifetime kept');
  assert.equal(s.starsEarned, gained);
  assert.ok(g.globalMultiplier(s, T0) > 1, 'stars boost everything');
  assert.ok(g.unlockedBuildings(s).some((b) => b.id === 'office'), 'offices unlocked at the village');
  assert.equal(levelInfo(12).threshold, LEVELS[LEVELS.length - 1].threshold * 100 ** 3, 'levels continue forever');
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].threshold > LEVELS[i - 1].threshold);
});

test('perks cost stars and change fresh runs', () => {
  const s = g.newGame(T0);
  s.starsEarned = 20;
  assert.ok(g.buyPerk(s, 'alumni'));
  assert.equal(g.starsAvailable(s), 12);
  assert.equal(s.buildings.carer, 5, 'alumni applies immediately');
  assert.ok(!g.buyPerk(s, 'alumni'), 'no double buy');
  assert.ok(!g.buyPerk(s, 'legend'), 'too expensive');
  assert.ok(g.buyPerk(s, 'admin'));
  assert.equal(g.collectionMode(s), 'admin');
  for (const p of PERKS) assert.ok(p.cost > 0 && p.blurb);
});

test('prismatic carers and thank-you cards spawn, expire, and do fun things', () => {
  const s = g.newGame(T0);
  s.funds = 1000; s.runEarned = 1000;
  g.buyBuilding(s, 'carer', 5);
  const events = g.tick(s, 1, T0, () => 0.0001, ['Morag Sinclair', 'Priya Patel']);
  assert.ok(events.some((e) => e.kind === 'spawn'), 'a very lucky roll spawns something');
  assert.equal(s.spawn.type, 'prismatic');
  assert.ok(['Morag Sinclair', 'Priya Patel'].includes(s.spawn.name), 'uses a real carer name');
  // Expire it
  g.tick(s, 1, T0 + 20000, () => 0.99);
  assert.equal(s.spawn, null);
  // Spawn again and click it: rng picks the first effect (rainbow rush)
  g.tick(s, 1, T0 + 21000, () => 0.0001, ['Morag Sinclair']);
  const r = g.clickSpawn(s, T0 + 22000, () => 0.01);
  assert.equal(r.effect.id, 'rainbow-rush');
  assert.match(r.message, /Morag Sinclair/);
  assert.ok(g.globalMultiplier(s, T0 + 23000) >= 7);
  assert.ok(g.globalMultiplier(s, T0 + 60000) < 7, 'wears off');
  assert.equal(s.prismaticsMet, 1);
  // Card: rng between prismatic and card chance
  g.tick(s, 1, T0 + 61000, () => 0.006, ['Priya Patel']);
  assert.equal(s.spawn && s.spawn.type, 'card');
  const before = s.funds;
  const c = g.clickSpawn(s, T0 + 62000, () => 0.1);
  assert.equal(c.effect.id, 'card-cash');
  assert.ok(s.funds > before);
  assert.equal(s.cardsOpened, 1);
  // Lucky hire is permanent
  g.tick(s, 1, T0 + 70000, () => 0.0001, ['Ewan MacLeod']);
  const h = g.clickSpawn(s, T0 + 71000, () => 0.99);
  assert.equal(h.effect.id, 'lucky-hire');
  assert.deepEqual(s.prismaticHires, ['Ewan MacLeod']);
});

test('a boost that is still running survives closing and reopening the game', () => {
  const now = Date.now();
  const s = g.newGame(now);
  s.effects.push({ id: 'double-time', name: 'Double time', emoji: '⏩', until: now + 30000, prodMult: 2 });
  s.effects.push({ id: 'old', name: 'Old', emoji: 'x', until: now - 1, prodMult: 9 });
  const { state } = g.loadGame(JSON.parse(JSON.stringify(g.serialise(s))), now + 1000);
  assert.deepEqual(state.effects.map((e) => e.id), ['double-time']);
});

test('achievements unlock and boost income; team names come from the real carers', () => {
  const s = g.newGame(T0);
  g.click(s, T0);
  const ev = g.tick(s, 0.1, T0 + 100, () => 0.99);
  assert.ok(ev.some((e) => e.kind === 'achievement' && e.achievement.id === 'first-visit'));
  assert.ok(g.globalMultiplier(s, T0) > 1);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  s.buildings.carer = 4;
  assert.deepEqual(g.teamNames(s, ['Morag', 'Priya']), ['Morag', 'Priya', 'Morag 2', 'Priya 2']);
  assert.equal(g.teamNames(s, []).length, 4);
});

test('offline progress pays half speed (full with Night shift) and is capped at 8 hours', () => {
  const s = g.newGame(T0);
  s.funds = 1e6; s.runEarned = 1e6; s.clicks = 100;
  g.buyBuilding(s, 'car', 10);
  g.buyUpgrade(s, 'admin'); g.buyUpgrade(s, 'direct-debit');
  const rate = g.productionPerSecond(s, T0);
  s.lastSeen = T0;
  const saved = JSON.parse(JSON.stringify(g.serialise(s)));
  const { state, offline } = g.loadGame(saved, T0 + 3600 * 1000);
  assert.equal(offline.seconds, 3600);
  assert.ok(Math.abs(offline.earned - rate * 3600 * 0.5) < 1e-6);
  assert.equal(state.offlineReturns, 1);
  const { offline: long } = g.loadGame(saved, T0 + 48 * 3600 * 1000);
  assert.equal(long.seconds, 8 * 3600);
  saved.perks = ['nightshift'];
  const { offline: night } = g.loadGame(saved, T0 + 3600 * 1000);
  assert.ok(Math.abs(night.earned - rate * 3600) < 1e-6);
  assert.equal(g.loadGame(null, T0).offline, null);
  assert.equal(g.loadGame({ ...saved, lastSeen: T0 - 10000 }, T0).offline, null, 'under 30s away: nothing');
});

test('buying max and formatting', () => {
  const s = g.newGame(T0);
  s.funds = 500;
  const n = g.maxAffordable(s, 'carer');
  assert.ok(n >= 10 && n < 20);
  assert.equal(g.buyBuilding(s, 'carer', 'max').bought, n);
  assert.ok(s.funds < g.buildingCost(s, 'carer', 1));
  assert.equal(fmtMoney(0), '£0');
  assert.equal(fmtMoney(1234), '£1,234');
  assert.equal(fmtMoney(1.5e6), '£1.50 million');
  assert.equal(fmtMoney(4.5e15), '£4.50 quadrillion');
  assert.equal(fmtNum(2.5), '2.5');
  assert.equal(fmtSeconds(75), '1m 15s');
  assert.equal(fmtSeconds(3600 * 5), '5h');
  for (const b of BUILDINGS) assert.ok(b.rate > 0 && b.baseCost > 0);
  for (let i = 1; i < BUILDINGS.length; i++) assert.ok(BUILDINGS[i].baseCost > BUILDINGS[i - 1].baseCost && BUILDINGS[i].rate > BUILDINGS[i - 1].rate);
});
