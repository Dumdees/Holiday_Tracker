import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../src/core/game/engine.js';
import { BUILDINGS, UPGRADES, BRANCH_OPTIONS, BRANCHES, ACHIEVEMENTS, PERKS, LEVELS, MILESTONES, RATINGS, levelInfo, upgradesFor, upgradeIcon, beyondBuilding } from '../../src/core/game/data.js';
import { DRAWS, MARKS } from '../../src/ui/game/scene.js';
import { fmtMoney, fmtNum, fmtSeconds } from '../../src/core/game/format.js';

const T0 = Date.UTC(2026, 8, 2, 9, 0, 0);
/** A board with sensible amounts of everything, for probing the maths. */
const board = (extra = {}) => ({ ...g.newGame(T0), level: 9, buildings: { carer: 40, client: 40, keysafe: 20, package: 10, ...extra } });

test('a new game starts with a few front doors and no carers', () => {
  const s = g.newGame(T0);
  assert.deepEqual(s.buildings, { client: 5 });
  assert.equal(s.funds, 0);
  assert.equal(g.productionPerSecond(s, T0), 0, 'nobody to do the visits yet');
  assert.equal(g.clickValue(s, T0), 1);
  assert.equal(g.click(s, T0), 1);
  assert.equal(s.funds, 1);
  assert.equal(g.click(s, T0 + 500), 0, 'the same door cannot be knocked on again straight away');
  assert.equal(g.click(s, T0 + 500, 1), 1, 'another door is fine');
  assert.equal(g.collectionMode(s), 'manual');
});

describe('the two sides', () => {
  test('both sides are needed, and either one always helps', () => {
    const s = g.newGame(T0);
    s.funds = 1e6;
    g.buyBuilding(s, 'carer', 1);
    assert.ok(g.productionPerSecond(s, T0) > 0, 'one carer and one person is a working business');
    const m = g.boardMetrics(s);
    assert.ok(Math.abs(m.work - 16) < 1e-9, 'five front doors');
    assert.ok(Math.abs(m.team - 0.8) < 1e-9, 'one carer');
    assert.ok(Math.abs(m.visits - (m.work + m.team + Math.sqrt(m.work * m.team)) / 3) < 1e-9, 'the two sides averaged, with a bonus for keeping them level');
    assert.equal(g.combineSides(0, 0), 0);
    assert.equal(g.combineSides(4, 0), 0, 'nobody to do the visits means no visits');
    assert.equal(g.combineSides(0, 4), 0, 'and nobody to visit means the same');
    assert.equal(g.combineSides(4, 4), 4, 'a level board is worth one side');
    assert.ok(g.combineSides(6, 6) > g.combineSides(2, 10), 'level beats lopsided for the same total');
    assert.ok(g.combineSides(6, 6) > g.combineSides(2, 10), 'level beats lopsided for the same total');
  });

  test('nothing you can buy ever earns you less, on any board', () => {
    const shapes = [
      { carer: 1, client: 1 }, { carer: 60, client: 4 }, { carer: 4, client: 60 },
      { carer: 200, client: 200, keysafe: 90, car: 40 },
      { carer: 900, client: 120, keysafe: 400, car: 200, coordinator: 40, package: 60 },
      { carer: 1200, client: 1200, keysafe: 600, car: 300, coordinator: 120, supervisor: 60, office: 25, academy: 12, nurse: 6, framework: 40, chc: 12, group: 4, tech: 3, world: 2, orbit: 1, starship: 1, package: 200, directpay: 90, council: 30, discharge: 20 },
    ];
    // Every bonus that slides with the shape of the board is held at once: this is the board where a
    // purchase would be most likely to dilute something you are already being paid for.
    const held = UPGRADES.filter((u) => u.archetype === 'conditional').map((u) => u.id);
    const kit = UPGRADES.filter((u) => u.archetype === 'kit').slice(0, 14).map((u) => u.id);
    for (const shape of shapes) {
      for (const upgrades of [[], held, [...held, ...kit]]) {
        for (const b of BUILDINGS) {
          const s = board(shape);
          s.buildings = { ...shape };
          s.upgrades = [...upgrades];
          const gain = g.buildingGain(s, b.id, 1, T0);
          assert.ok(gain > 0, `buying a ${b.id} on ${JSON.stringify(shape)} with ${upgrades.length} bought should earn more, got ${gain}`);
        }
        for (const u of UPGRADES) {
          if (upgrades.includes(u.id)) continue;
          const s = board(shape);
          s.buildings = { ...shape };
          s.upgrades = [...upgrades];
          if (u.unlock && !u.unlock(s)) continue;
          const gain = g.upgradeGain(s, u.id, T0);
          assert.ok(gain >= 0, `buying ${u.id} on ${JSON.stringify(shape)} should never earn less, got ${gain}`);
        }
      }
    }
  });

  test('the shop says which side a minute of takings is better spent on', () => {
    const only = (b) => ({ ...board(), buildings: b });
    assert.equal(g.bottleneck(only({ carer: 4, client: 80 })).side, 'team', 'far more work than team: buy hands');
    assert.equal(g.bottleneck(only({ carer: 80, client: 4 })).side, 'work', 'far more team than work: take work on');
    assert.ok(['balanced', 'work', 'team'].includes(g.bottleneck(only({ carer: 48, client: 40 })).side));
    // The advice names the bonus the board is costing you, so the axis is never invisible.
    const held = { ...only({ carer: 400, client: 30 }), upgrades: ['cond-busy', 'cond-waiting'] };
    assert.match(g.bottleneck(held).advice, /A full round|People ask for you first/);
  });
});

describe('what makes things better', () => {
  test('every tenth doubles, and the upgrades make the tenth worth more', () => {
    assert.equal(g.milestonesPassed(9), 0);
    assert.equal(g.milestonesPassed(10), 1);
    assert.equal(g.milestonesPassed(25), 2);
    assert.deepEqual(g.nextMilestone(7), { at: 10, remaining: 3 });
    assert.equal(g.nextMilestone(1e9), null, 'they run out eventually, so the rungs matter more than the pile');
    const s = board({ carer: 10, client: 40 });
    const one = g.buildingRate(s, 'carer');
    const nine = g.buildingRate({ ...s, buildings: { ...s.buildings, carer: 9 } }, 'carer');
    assert.ok(Math.abs(one / nine - 2) < 1e-9, 'the tenth carer doubles every carer');
    const past = MILESTONES[MILESTONES.length - 1] * 2;
    assert.equal(g.milestonesPassed(past), MILESTONES.length + 1, 'they carry on past the table');
    assert.ok(g.nextMilestone(past).at > past, 'and there is another one coming');
    assert.equal(g.milestonesPassed(1e9), MILESTONES.length + g.MILESTONES_BEYOND, 'but they do stop');
    assert.equal(g.milestoneFactor(s), 2);
    assert.equal(g.milestoneFactor({ ...s, upgrades: ['mile-1'] }), 2.2);
    assert.equal(g.milestoneFactor({ ...s, upgrades: ['mile-1', 'mile-2'] }), 2.5);
  });

  test('kit upgrades double one thing; synergies lift another and are capped', () => {
    const s = board();
    const plain = g.buildingRate(s, 'carer');
    assert.equal(g.buildingRate({ ...s, upgrades: ['carer-t1'] }, 'carer'), plain * 2);
    const syn = UPGRADES.find((u) => u.id === 'syn-keysafe-carer');
    const withSyn = g.buildingRate({ ...s, upgrades: [syn.id] }, 'carer');
    assert.ok(Math.abs(withSyn / plain - (1 + syn.per * 20)) < 1e-9, 'twenty key safes lift the whole team by twenty times the per-safe figure');
    const capped = g.buildingRate({ ...board({ keysafe: 5000 }), upgrades: [syn.id] }, 'carer');
    assert.ok(Math.abs(capped / plain - (1 + syn.cap)) < 1e-9, 'and the synergy stops at its cap');
  });

  test('conditional bonuses slide with the board rather than snapping off', () => {
    const covered = { ...board({ carer: 900, client: 10 }), upgrades: ['cond-covered'] };
    const half = { ...board({ carer: 40, client: 40 }), upgrades: ['cond-covered'] };
    const stretched = { ...board({ carer: 4, client: 300 }), upgrades: ['cond-covered'] };
    const paying = (s) => g.globalMultiplier(s, T0) / g.globalMultiplier({ ...s, upgrades: [] }, T0);
    assert.ok(Math.abs(paying(covered) - 1.3) < 1e-9, 'it pays all 30% while the team can cover the work');
    assert.ok(paying(half) > 1 && paying(half) < 1.3, 'part of it pays while the team is catching up');
    assert.ok(paying(stretched) > 1 && paying(stretched) < paying(half), 'and less again when the work has run away');
    const shares = g.activeConditionals({ ...board({ carer: 40, client: 40 }), upgrades: ['cond-covered'] });
    assert.equal(shares.length, 1);
    assert.ok(shares[0].share > 0 && shares[0].share < 1, 'the card can say how much of it is paying');
  });

  test('a tidy patch counts the kit you have out, so it never falls when you take on more work', () => {
    const kitted = { ...board(), upgrades: ['cond-tidy', 'carer-t1', 'client-t1', 'keysafe-t1'] };
    const paying = (s) => g.globalMultiplier(s, T0) / g.globalMultiplier({ ...s, upgrades: s.upgrades.filter((id) => id !== 'cond-tidy') }, T0);
    const before = paying(kitted);
    assert.ok(before > 1 && before < 1.25, 'three bits of kit pay a quarter of it');
    const busier = { ...kitted, buildings: { ...kitted.buildings, client: 400 } };
    assert.ok(Math.abs(paying(busier) - before) < 1e-12, 'taking on four hundred more doors changes nothing about it');
    const full = { ...kitted, upgrades: [...kitted.upgrades, ...UPGRADES.filter((u) => u.archetype === 'kit').slice(0, 12).map((u) => u.id)] };
    assert.ok(Math.abs(paying(full) - 1.25) < 1e-9, 'twelve bits of kit pay all of it');
  });

  test('the rating is worked out from what you invest in, and never from luck', () => {
    assert.equal(g.ratingIndex(g.newGame(T0)), 0);
    assert.equal(g.ratingIndex(board({ coordinator: 6 })), 1, 'Good');
    assert.equal(g.ratingIndex(board({ academy: 20 })), 2, 'Outstanding');
    assert.equal(g.ratingIndex(board({ academy: 300 })), 3);
    // The key safes and care folders on the board count a little too: a well-run service is not
    // only its managers. The two quality upgrades add six each on top.
    const plain = g.ratingScore(board());
    assert.equal(g.ratingScore({ ...board(), upgrades: ['qual-cert', 'qual-plans'] }), plain + 12, 'quality upgrades count');
    assert.ok(plain > 0, 'the everyday things count for something');
    const info = g.ratingInfo(board({ coordinator: 6 }));
    assert.equal(info.name, 'Good');
    assert.equal(info.next.name, 'Outstanding');
    assert.ok(g.globalMultiplier(board({ coordinator: 6 }), T0) > g.globalMultiplier(board(), T0));
  });

  test('what a visit is worth, and what your own visits are worth', () => {
    const s = board();
    assert.equal(g.visitValue({ ...s, upgrades: ['val-private'] }), 1.6);
    assert.equal(g.visitValue({ ...s, upgrades: ['val-private', 'val-fair'] }), 1.6 * 1.5);
    assert.ok(g.clickValue({ ...s, upgrades: ['click-1'] }, T0) > g.clickValue(s, T0));
    assert.ok(g.clickValue({ ...s, perks: ['legend'] }, T0) > g.clickValue(s, T0) * 9);
  });
});

describe('prices and what is worth buying', () => {
  test('each one costs 15% more, and the discounts apply', () => {
    // Prices are the printed ones on the first street, and climb by exactly what a stage is worth.
    const first = { ...g.newGame(T0), level: 0 };
    assert.equal(g.buildingCost(first, 'carer', 1), 15);
    const later = { ...first, level: 3 };
    assert.equal(g.buildingCost(later, 'carer', 1), Math.ceil(15 * Math.pow(1.6, 3)));
    const s = { ...g.newGame(T0), level: 0 };
    assert.equal(g.buildingCost(s, 'carer', 1), 15);
    assert.equal(g.buildingCost(s, 'carer', 2), Math.ceil(15 + 15 * 1.15));
    const cheap = { ...s, upgrades: ['disc-recruit'] };
    assert.equal(g.buildingCost(cheap, 'carer', 1), Math.ceil(15 * 0.85));
    const council = { ...s, buildings: {}, branches: { buyer: 'buyer-council' } };
    const councilOff = BRANCH_OPTIONS.find((o) => o.id === 'buyer-council').discount;
    assert.equal(g.buildingCost(council, 'client', 1), Math.ceil(120 * councilOff), 'council work makes the work side cheaper');
    assert.equal(g.buildingCost(council, 'carer', 1), 15, 'but not the team side');
    const rich = { ...s, funds: 500 };
    const n = g.maxAffordable(rich, 'carer');
    assert.ok(n >= 10 && n < 30);
    assert.equal(g.buyBuilding({ ...rich }, 'carer', 'max').bought, n);
  });

  test('every shop row can say what it costs and when it pays for itself', () => {
    const s = board();
    for (const b of g.unlockedBuildings(s)) {
      const o = g.buildingOffer(s, b.id, 1, T0);
      assert.ok(o.cost > 0 && Number.isFinite(o.cost), `${b.id} has a price`);
      assert.ok(o.gain > 0, `${b.id} earns something`);
      assert.ok(Number.isFinite(o.payback) && o.payback > 0, `${b.id} has a payback time`);
    }
    assert.equal(g.paybackSeconds(100, 0), Infinity, 'something that earns nothing never pays for itself');
    assert.equal(g.paybackSeconds(100, 5), 20);
  });

  test('the upgrade shop puts the best value first', () => {
    const s = { ...board(), funds: 1e9, clicks: 200 };
    const shop = g.upgradeShop(s, T0, 12);
    assert.ok(shop.length > 3);
    // Anything that pays for itself inside two seconds is as good as free, so those come first and
    // are sorted by how big they are; everything else that earns is sorted by payback.
    const free = shop.filter((u) => u.gain > 0 && u.payback < 2);
    for (let i = 1; i < free.length; i++) assert.ok(free[i].gain <= free[i - 1].gain, 'the as-good-as-free ones are sorted biggest first');
    assert.deepEqual(shop.slice(0, free.length).map((u) => u.id), free.map((u) => u.id), 'and they are at the front');
    const earning = shop.filter((u) => Number.isFinite(u.payback) && !(u.gain > 0 && u.payback < 2));
    for (let i = 1; i < earning.length; i++) assert.ok(earning[i].payback >= earning[i - 1].payback, 'the rest that earn are sorted by payback');
    assert.ok(shop.every((u) => u.visual), 'every upgrade says what it changes on the street');
    // Things that only save you a job still have to be findable.
    const early = { ...g.newGame(T0), funds: 500, runEarned: 200, clicks: 20 };
    g.buyBuilding(early, 'carer', 3);
    const ids = g.upgradeShop(early, T0, 12).map((u) => u.id);
    assert.ok(ids.includes('admin'), 'the office admin is on the first page of the shop');
  });

  test('there is more than one sensible thing to buy at once', () => {
    // Boards a real player actually reaches, not synthetic ones.
    for (const shape of [{ carer: 12, client: 12 }, { carer: 60, client: 55, keysafe: 20 }, { carer: 90, client: 80, keysafe: 45, car: 18, package: 30 }]) {
      const s = { ...board(shape), buildings: shape, level: 2, funds: 1e9 };
      const paybacks = g.unlockedBuildings(s).map((b) => g.buildingOffer(s, b.id, 1, T0).payback).sort((a, b) => a - b);
      const close = paybacks.filter((p) => p <= paybacks[0] * 3).length;
      const nearby = paybacks.filter((p) => p <= paybacks[0] * 8).length;
      assert.ok(close >= 2, `on ${JSON.stringify(shape)} only ${close} option(s) are near the best`);
      assert.ok(nearby >= 3, `on ${JSON.stringify(shape)} only ${nearby} option(s) are in the running`);
    }
  });
});

describe('the big choices', () => {
  test('one per slot per run, and only when you are big enough', () => {
    const s = g.newGame(T0);
    assert.equal(g.pendingBranch(s), null, 'nothing to choose on day one');
    s.level = 1;
    const pending = g.pendingBranch(s);
    assert.equal(pending.slot, 'buyer');
    assert.equal(g.pickBranch(s, 'buyer', 'nonsense'), false);
    assert.ok(g.pickBranch(s, 'buyer', 'buyer-private'));
    assert.equal(g.pickBranch(s, 'buyer', 'buyer-council'), false, 'no changing your mind');
    assert.equal(g.pendingBranch(s), null);
    assert.ok(g.globalMultiplier(s, T0) > 1.4);
  });

  test('no option is the right answer on every board', () => {
    // Which one wins has to depend on how you have played, or it is not a choice. Options are judged
    // on what the next half hour of takings buys you, not on the number on the tin – a choice that
    // makes everything cheaper is worth exactly as much as one that makes everything earn more.
    const spend = (base, slot, id) => {
      const s = { ...base, branches: { [slot]: id }, buildings: { ...base.buildings } };
      s.funds = g.productionPerSecond(s, T0) * 1800;
      for (let i = 0; i < 500; i++) {
        const inc = g.productionPerSecond(s, T0);
        let pick = null;
        for (const b of g.unlockedBuildings(s)) {
          const o = g.buildingOffer(s, b.id, 1, T0, inc);
          if (o.affordable && o.gain > 0 && (!pick || o.payback < pick.payback)) pick = { id: b.id, payback: o.payback };
        }
        if (!pick) break;
        g.buyBuilding(s, pick.id, 1);
      }
      return g.productionPerSecond(s, T0);
    };
    const boards = [
      board({ carer: 25, client: 22, keysafe: 8, car: 4 }),
      board({ carer: 500, client: 460, keysafe: 300, car: 140, chc: 2, nurse: 1 }),
      board({ carer: 120, client: 90, keysafe: 40, car: 20, chc: 60, nurse: 40 }),
    ];
    for (const group of BRANCHES) {
      const winners = new Set();
      for (const base of boards) {
        const scored = group.options.map((o) => ({ id: o.id, income: spend(base, group.slot, o.id) }));
        scored.sort((a, b) => b.income - a.income);
        winners.add(scored[0].id);
        const spread = scored[0].income / scored[scored.length - 1].income;
        // Deliberately board-dependent: a different one wins on each board, and the gap between
        // them is worth caring about – but never so wide that picking the wrong one ends the run.
        assert.ok(spread <= 12, `${group.slot} options are ${spread.toFixed(2)}x apart on one board`);
      }
      if (group.slot !== 'buyer') assert.ok(winners.size > 1, `${group.slot} always has the same right answer`);
    }
  });

  test('what you are known for stays with you, and is reopened every third hand-over', () => {
    const s = g.newGame(T0);
    s.level = 1; s.runEarned = 1e9; s.lifetimeEarned = 1e9;
    g.pickBranch(s, 'buyer', 'buyer-private');
    g.expand(s, T0 + 1000);
    assert.deepEqual(s.branches, { buyer: 'buyer-private' }, 'the agency is still known for the same thing');
    s.runEarned = s.runTarget; s.lifetimeEarned = 1e12;
    g.expand(s, T0 + 2000);      // now at level 3
    assert.equal(s.level % g.BRANCH_RETHINK, 0, 'the third hand-over');
    assert.deepEqual(s.branches, {}, 'a bigger patch, a fresh decision');
  });
});

describe('doing the visits yourself', () => {
  test('a tap always finds a door that is ready', () => {
    const s = g.newGame(T0);
    s.buildings = { client: 6, carer: 2 };
    assert.equal(g.nearestReadyHouse(s, 6, 3, T0), 3, 'the door you tapped, when it is ready');
    g.click(s, T0, 3);
    assert.equal(g.nearestReadyHouse(s, 6, 3, T0 + 100), 2, 'the next one along when it is not');
    g.click(s, T0, 2);
    assert.equal(g.nearestReadyHouse(s, 6, 3, T0 + 100), 4, 'and the other side after that');
    for (let i = 0; i < 6; i++) g.click(s, T0, i);
    assert.equal(g.nearestReadyHouse(s, 6, 3, T0 + 100), 3, 'when the whole street has just been seen, the tap is refused where you tapped');
  });

  test('your own visits keep a share of the business, however big it gets', () => {
    const rich = { ...board({ carer: 900, client: 900, keysafe: 400 }), upgrades: [] };
    const plain = g.clickValue(rich, T0);
    const withShare = g.clickValue({ ...rich, upgrades: ['click-3', 'click-5', 'click-6'] }, T0);
    const income = g.productionPerSecond(rich, T0);
    assert.ok(withShare - plain > income * 0.085, 'the three shares come to at least 8.5% of everything, per visit');
    assert.ok(g.clickValue({ ...rich, branches: { growth: 'grow-rates' } }, T0) > plain * 3, 'and better rates trebles your own visits on top');
  });
});

describe('legacy perks', () => {
  test('there is always one more to save for, and each costs twice the last', () => {
    const s = g.newGame(T0);
    s.starsEarned = 2000;
    const first = g.perkList(s).find((p) => p.id.startsWith('legacy-'));
    assert.equal(first.id, 'legacy-1');
    assert.equal(first.cost, 350);
    assert.ok(g.buyPerk(s, 'legacy-1'));
    const before = g.globalMultiplier({ ...board(), perks: [] }, T0);
    const after = g.globalMultiplier({ ...board(), perks: ['legacy-1', 'legacy-2'] }, T0);
    assert.ok(Math.abs(after / before - 1.69) < 1e-9, 'two of them is 30% twice over');
    const next = g.perkList(s).find((p) => p.id.startsWith('legacy-') && !p.owned);
    assert.equal(next.id, 'legacy-2');
    assert.equal(next.cost, 700);
    assert.equal(g.perkList(s).filter((p) => p.id.startsWith('legacy-') && !p.owned).length, 1, 'only ever the next one is offered');
  });

  test('a name people know starts a run rated Good, and a founder’s share is worth a quarter more', () => {
    const fresh = { ...g.newGame(T0), perks: ['warmwelcome'] };
    assert.equal(g.ratingIndex(fresh), 1, 'Good from the first minute');
    const s = { ...g.newGame(T0), lifetimeEarned: 1e9 };
    const plain = g.starsOnExpand(s);
    const founder = g.starsOnExpand({ ...s, perks: ['founders'] });
    assert.equal(founder, Math.floor(plain * 1.25));
  });
});

describe('handing over', () => {
  test('the run resets to a small round but the legacy stays', () => {
    const s = g.newGame(T0);
    s.funds = 2e5; s.runEarned = 8e4; s.lifetimeEarned = 2e6;
    s.buildings = { carer: 30, client: 30, keysafe: 10 };
    s.upgrades = ['carer-t1'];
    assert.ok(!g.canExpand(s), 'the first hand-over waits for the stage figure');
    s.runEarned = 6e5;
    assert.ok(g.canExpand(s));
    assert.ok(g.expandRequirement(s) >= LEVELS[1].threshold);
    // The finish line is worked out when the run starts and never moves again, so the bar cannot go
    // backwards and a lucky rainbow cannot push it away.
    assert.equal(g.runTargetFor(12, 0, 1e12), 1e12 * g.RUN_BEAT, 'six times what the last run was asked for');
    assert.ok(g.runTargetFor(3, 0, 1e12) > 1e12 * g.RUN_BEAT, 'and rather more while the stages are still short');
    assert.ok(g.runTargetFor(3, 0, 1e12) < g.runTargetFor(0, 0, 1e12), 'easing back as the stages go up');
    assert.equal(g.runTargetFor(3, 1e10, 0), 1e10 * g.RUN_SECONDS, 'or two minutes at the last run’s best rate');
    assert.equal(g.runTargetFor(0, 0, 0), LEVELS[1].threshold, 'or the stage figure, at the very start');
    const mid = { ...g.newGame(T0), level: 3, runTarget: 5e9, runEarned: 1e9 };
    const lucky = { ...mid, effects: [{ id: 'x', until: T0 + 60000, prodMult: 7 }] };
    assert.equal(g.expandRequirement(lucky), g.expandRequirement(mid), 'a lucky spell never moves the finish line');
    assert.ok(g.expandOutlook({ ...mid, runEarned: 2e9 }, T0).fraction > g.expandOutlook(mid, T0).fraction, 'and the bar only goes forwards');
    const gained = g.starsOnExpand(s);
    // The run went five times past its figure, so it is worth more stars than the bare count.
    assert.ok(g.stayingBonus(s) > 1, 'staying on past the line pays');
    assert.equal(gained, Math.floor(g.starsForLifetime(2e6) * g.stayingBonus(s)));
    assert.equal(g.starsOnExpand({ ...s, runEarned: g.expandRequirement(s) }), g.starsForLifetime(2e6));
    assert.ok(gained >= 1 && gained <= 30, `a first hand-over should be worth a handful of stars, got ${gained}`);
    assert.ok(g.starsForLifetime(1e20) < 120, 'and the count can never run away');
    assert.ok(g.starBonus(0) === 1 && g.starBonus(50) > 1.5);
    const r = g.expand(s, T0 + 1000);
    assert.equal(r.level, 1);
    // What the run earned beyond its figure comes with you, but only a minute and a half of what
    // the new round earns – any more and the old patch's money buys the whole ladder at once.
    assert.ok(s.funds > 0 && s.funds <= g.CARRY_SECONDS * g.steadyIncome(s) + 1e-6, `carried ${s.funds}`);
    assert.ok(s.funds <= 6e5 - 1.2e5, 'and never more than the run actually overshot by');
    assert.deepEqual(s.upgrades, []);
    assert.deepEqual(s.buildings, g.startingKit(1), 'you keep a little round to start again with');
    assert.ok(g.productionPerSecond(s, T0 + 1000) > 0, 'a new run is never dead');
    assert.equal(s.lifetimeEarned, 2e6);
    assert.equal(s.starsEarned, gained);
    assert.ok(g.unlockedBuildings(s).some((b) => b.id === 'car'), 'cars unlock at the village');
    for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].threshold > LEVELS[i - 1].threshold);
    assert.ok(levelInfo(12).threshold > LEVELS[LEVELS.length - 1].threshold, 'stages carry on forever');
  });

  test('perks cost stars and change how a run starts', () => {
    const s = g.newGame(T0);
    s.starsEarned = 20;
    assert.ok(g.buyPerk(s, 'alumni'));
    assert.equal(g.starsAvailable(s), 20 - 5);
    assert.equal(s.buildings.carer, 5);
    assert.equal(s.buildings.client, 5);
    assert.ok(!g.buyPerk(s, 'alumni'), 'no buying it twice');
    assert.ok(!g.buyPerk(s, 'legend'), 'too expensive');
    assert.ok(g.buyPerk(s, 'perk-admin'));
    assert.equal(g.collectionMode(s), 'admin');
    for (const p of PERKS) assert.ok(p.cost > 0 && p.blurb);
  });
});

describe('time passing', () => {
  test('money piles up as invoices until somebody collects it', () => {
    const s = g.newGame(T0);
    s.funds = 1000;
    g.buyBuilding(s, 'carer', 4);
    g.buyBuilding(s, 'client', 4);
    const before = s.funds;
    g.tick(s, 5, T0 + 5000, () => 0.99);
    assert.equal(s.funds, before, 'nothing lands in the bank without collecting');
    assert.ok(s.invoices > 0);
    const got = g.collect(s);
    assert.ok(got > 0);
    assert.equal(s.invoices, 0);
    assert.equal(s.collections, 1);
  });

  test('the office admin collects every five seconds; direct debit is instant', () => {
    const s = g.newGame(T0);
    s.funds = 1e5;
    g.buyBuilding(s, 'carer', 10);
    g.buyBuilding(s, 'client', 10);
    s.upgrades.push('admin');
    s.funds = 0;
    g.tick(s, 4, T0 + 4000, () => 0.99);
    assert.equal(s.funds, 0, 'not yet');
    const events = g.tick(s, 2, T0 + 6000, () => 0.99);
    assert.ok(s.funds > 0);
    assert.ok(events.some((e) => e.kind === 'collected'));
    s.upgrades.push('direct-debit');
    const funds = s.funds;
    g.tick(s, 1, T0 + 7000, () => 0.99);
    assert.ok(s.funds > funds);
    assert.equal(s.invoices, 0);
  });

  test('badges unlock, and each one lifts everything', () => {
    const s = g.newGame(T0);
    s.funds = 1e6;
    g.buyBuilding(s, 'carer', 1);
    const before = g.globalMultiplier(s, T0);
    g.tick(s, 1, T0 + 1000, () => 0.99, ['Morag']);
    assert.ok(s.achievements.includes('first-hire'));
    assert.ok(g.globalMultiplier(s, T0) > before);
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length, 'no duplicate badges');
    for (const a of ACHIEVEMENTS) assert.ok(a.name && a.blurb && a.emoji);
  });

  test('time away pays out, faster with the on-call phone, and is capped', () => {
    const make = () => {
      const s = g.newGame(T0);
      s.funds = 1e6;
      g.buyBuilding(s, 'carer', 20);
      g.buyBuilding(s, 'client', 20);
      s.upgrades.push('direct-debit');
      s.funds = 0;
      return s;
    };
    const a = make();
    assert.equal(g.applyOffline(a, T0 + 10000), null, 'ten seconds is not time away');
    const b = make();
    const half = g.applyOffline(b, T0 + 3600 * 1000);
    assert.equal(half.efficiency, 0.5);
    assert.ok(b.funds > 0);
    const c = make();
    c.upgrades.push('oncall');
    const better = g.applyOffline(c, T0 + 3600 * 1000);
    assert.equal(better.efficiency, 0.8);
    assert.ok(c.funds > b.funds);
    const d = make();
    const capped = g.applyOffline(d, T0 + 40 * 3600 * 1000);
    assert.equal(capped.seconds, 8 * 3600);
  });

  test('a boost that is still running survives closing and reopening the game', () => {
    const now = Date.now();
    const s = g.newGame(now);
    s.effects.push({ id: 'double-time', name: 'Double time', emoji: '⏩', until: now + 30000, prodMult: 2 });
    s.effects.push({ id: 'old', name: 'Old', emoji: 'x', until: now - 1, prodMult: 9 });
    const { state } = g.loadGame(JSON.parse(JSON.stringify(g.serialise(s))), now + 1000);
    assert.deepEqual(state.effects.map((e) => e.id), ['double-time']);
  });
});

describe('surprises', () => {
  test('prismatic carers and thank-you cards appear, expire and do something good', () => {
    const s = g.newGame(T0);
    s.funds = 1e6;
    g.buyBuilding(s, 'carer', 30);
    g.buyBuilding(s, 'client', 30);
    s.upgrades.push('direct-debit');
    const events = g.tick(s, 1, T0 + 1000, () => 0.0001, ['Morag']);
    assert.ok(s.spawn, 'something turned up');
    assert.ok(events.some((e) => e.kind === 'spawn'));
    const r = g.clickSpawn(s, T0 + 2000, () => 0.0001);
    assert.ok(r && r.effect && r.message);
    assert.equal(s.spawn, null);
    s.spawn = { type: 'card', name: 'Morag', x: 5, y: 5, until: T0 + 1, born: T0 };
    assert.equal(g.clickSpawn(s, T0 + 5000), null, 'too late');
  });

  test('a prismatic hire lifts everything for the rest of the run', () => {
    const s = board();
    const before = g.globalMultiplier(s, T0);
    s.prismaticHires = ['Priya', 'Callum'];
    assert.ok(Math.abs(g.globalMultiplier(s, T0) / before - 1.06) < 1e-9);
  });
});

describe('saves', () => {
  test('a save from the first version of the game is brought across', () => {
    const old = {
      version: 1, funds: 900, lifetimeEarned: 5e6, starsEarned: 7, starsSpent: 2, level: 2,
      buildings: { home: 30, carer: 25, rota: 4, hub: 2, franchise: 1, nonsense: 9 },
      upgrades: ['carer-t1', 'admin', 'value-1', 'global-3'],
      achievements: ['first-visit', 'made-up'], perks: ['alumni'], clicks: 40, visits: 900,
    };
    const { state } = g.loadGame(old, Date.now());
    assert.equal(state.version, 2);
    assert.equal(state.buildings.client, 30, 'homes became the people you look after');
    assert.equal(state.buildings.coordinator, 4, 'the rota app became a coordinator');
    assert.equal(state.buildings.supervisor, 2);
    assert.equal(state.buildings.group, 1);
    assert.equal(state.buildings.nonsense, undefined, 'unknown things are dropped');
    assert.deepEqual(state.upgrades, ['carer-t1', 'admin'], 'upgrades that no longer exist are dropped');
    assert.deepEqual(state.achievements, ['first-visit']);
    assert.equal(state.funds, 900);
    assert.equal(state.starsEarned, 7);
    assert.deepEqual(state.perks, ['alumni']);
    assert.ok(Number.isFinite(g.productionPerSecond(state, Date.now())));
  });

  test('nothing anywhere produces a number that is not a number', () => {
    const states = [g.newGame(T0), board(), { ...board(), upgrades: UPGRADES.map((u) => u.id) }, g.loadGame({}, T0).state, g.loadGame(null, T0).state];
    for (const s of states) {
      assert.ok(Number.isFinite(g.productionPerSecond(s, T0)), 'income is a number');
      assert.ok(Number.isFinite(g.clickValue(s, T0)), 'a click is worth a number');
      assert.ok(Number.isFinite(g.globalMultiplier(s, T0)));
      assert.ok(Number.isFinite(g.ratingScore(s)));
    }
  });

  test('what gets saved is plain data', () => {
    const s = board();
    s.spawn = { type: 'card' };
    const saved = g.serialise(s);
    assert.equal(saved.spawn, undefined);
    assert.equal(saved.cooldowns, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(saved)).buildings, s.buildings);
  });
});

describe('the rule that everything you buy changes the street', () => {
  test('every building is drawn somewhere', () => {
    for (const b of BUILDINGS) {
      assert.ok(DRAWS[b.id], `${b.id} is not drawn anywhere`);
      assert.ok(b.visual && b.visual.length > 10, `${b.id} does not say what it looks like`);
    }
    assert.equal(Object.keys(DRAWS).length, BUILDINGS.length, 'no drawings for things that do not exist');
  });

  test('every upgrade really is drawn, not just described', () => {
    // Everything in the table, plus three stages' worth of the endless rungs past it.
    for (const u of [...upgradesFor(LEVELS.length + 2), ...BRANCH_OPTIONS]) {
      assert.ok(u.visual && u.visual.length > 10, `${u.id} does not say what it changes`);
      assert.ok(u.name && u.emoji && u.blurb, `${u.id} is missing its words`);
      assert.ok(typeof u.cost === 'number' || typeof u.costSeconds === 'number' || u.slot, `${u.id} has no price`);
      // Kit upgrades change the look of the rung they belong to; everything else pins an icon on
      // the office noticeboard. Anything covered by neither is a promise the street cannot keep.
      const kitOf = /^(.*)-t[123]$/.exec(u.id);
      const covered = kitOf
        ? !!DRAWS[kitOf[1]] || kitOf[1].startsWith('beyond-')   // the far rungs are counted on the horizon
        : MARKS.has(u.id) || !!upgradeIcon(u.id);
      assert.ok(covered, `${u.id} claims a change to the street that nothing draws`);
    }
  });

  test('every stage brings its own shelf, priced in seconds of what you are earning', () => {
    for (const level of [1, 4, 9, 12, 18]) {
      const shelf = upgradesFor(level).filter((u) => u.id.startsWith(`stage-${level}-`));
      assert.equal(shelf.length, 12, `stage ${level} has a shelf of twelve`);
      const s = { ...board(), level, runTarget: 1e12 };
      const income = g.steadyIncome(s);
      const costs = shelf.map((u) => g.upgradeCost(s, u.id));
      assert.ok(Math.abs(Math.min(...costs) / income - 2) < 0.5, 'the first is a couple of seconds of takings');
      assert.ok(Math.abs(Math.max(...costs) / income - 60) < 2, 'and the last is a minute of them');
      // They appear a fixed way along the run, measured by how far the takings have climbed.
      const along = (u) => {
        for (let f = 0; f <= 1.0001; f += 0.02) {
          const probe = { ...s, runEarned: Math.pow(10, Math.log10(1 + s.runTarget) * f) };
          if (u.unlock(probe)) return f;
        }
        return 1;
      };
      const points = shelf.map(along);
      // Within each band of three the order is rotated by the stage, so a new stage does not read
      // like the last one – but the bands themselves still arrive in order across the run.
      for (let b = 3; b < points.length; b += 3) {
        const before = Math.max(...points.slice(b - 3, b));
        const after = Math.min(...points.slice(b, b + 3));
        assert.ok(after >= before - 1e-9, 'the bands arrive in order');
      }
      assert.ok(Math.min(...points) <= 0.2 && Math.max(...points) >= 0.85, 'spread across the whole run');
      for (const u of shelf) assert.ok(u.visual && u.name && u.blurb && u.icon, `${u.id} is fully written`);
    }
    const far = { ...board(), level: LEVELS.length + 3, buildings: { carer: 400, client: 400, 'beyond-1': 200, 'beyond-2': 60, 'beyond-3': 20, 'beyond-4': 5 } };
    const ids = new Set(upgradesFor(far.level).map((u) => u.id));
    for (const n of [1, 2, 3, 4]) assert.ok(ids.has(`beyond-${n}-t1`), `far rung ${n} brings its own kit`);
    const shop = g.upgradeShop(far, T0);
    assert.ok(shop.length >= 5, 'there is always a shelf full');
    assert.ok(shop.some((u) => u.gain > 0), 'and at least one of them earns you more');
    const b = beyondBuilding(6);
    assert.ok(b.baseCost > 0 && Number.isFinite(b.baseCost), 'the far rungs still have a price');
  });

  test('the choices in a branch carry their words through to the screen', () => {
    for (const group of BRANCHES) {
      for (const o of group.options) {
        assert.ok(o.visual && o.visual.length > 10, `${o.id} would show an empty "You will see"`);
        assert.ok(o.icon, `${o.id} has no icon for the noticeboard`);
      }
    }
  });

  test('the shop is a proper size and nothing is named twice', () => {
    assert.ok(UPGRADES.length >= 90, `only ${UPGRADES.length} upgrades`);
    assert.ok(BUILDINGS.length >= 18);
    assert.ok(ACHIEVEMENTS.length >= 35);
    const ids = [...BUILDINGS, ...UPGRADES, ...BRANCH_OPTIONS, ...ACHIEVEMENTS, ...PERKS].map((x) => x.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], 'every id is unique');
    for (const b of BUILDINGS) assert.ok(b.side === 'work' || b.side === 'team', `${b.id} needs a side`);
    for (let i = 1; i < BUILDINGS.length; i++) assert.ok(BUILDINGS[i].baseCost > BUILDINGS[i - 1].baseCost, 'the ladder gets dearer');
    assert.ok(MILESTONES.every((m, i) => i === 0 || m > MILESTONES[i - 1]));
    assert.ok(RATINGS.every((r, i) => i === 0 || r.mult > RATINGS[i - 1].mult));
  });
});

test('friendly numbers', () => {
  assert.equal(fmtMoney(0), '£0');
  assert.equal(fmtMoney(1234), '£1,234');
  assert.equal(fmtMoney(1.5e6), '£1.50 million');
  assert.equal(fmtNum(2.5), '2.5');
  assert.equal(fmtSeconds(75), '1m 15s');
  assert.equal(fmtSeconds(3600 * 5), '5h');
});

test('the team is named after the real carers on the books', () => {
  const s = g.newGame(T0);
  s.buildings.carer = 4;
  assert.deepEqual(g.teamNames(s, ['Morag', 'Priya']), ['Morag', 'Priya', 'Morag 2', 'Priya 2']);
  assert.equal(g.pickName(['Morag'], 0), 'Morag');
  assert.ok(g.pickName([], null, () => 0.5));
});
