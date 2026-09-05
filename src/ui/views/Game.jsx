// Care Empire – a light-hearted clicker game about growing a home-care service.
// The street itself is a living canvas scene (src/ui/game/scene.js); this view owns the game loop,
// the HUD, the shop and the choices. Everything the player is asked to decide is shown in pounds
// and seconds, so nobody needs a wiki to know what to buy next.
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { navigate } from '../../app/router.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/Button.jsx';
import { Badge } from '../components/Badge.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { Collapsible } from '../components/Collapsible.jsx';
import { openModal, confirm } from '../components/Modal.jsx';
import { toast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { carers, settings } from '../../store/store.js';
import * as G from '../../core/game/engine.js';
import { TICKER, SIDES, levelInfo } from '../../core/game/data.js';
import { fmtMoney, fmtNum, fmtRate, fmtSeconds, fmtPercent, fmtTimes, fmtPrice } from '../../core/game/format.js';
import { game, offlineReport, startGame, saveGame, scheduleSave, mutate, resetGame } from '../game/gameStore.js';
import { createScene } from '../game/scene.js';

const TICK_MS = 100;

function initialsOf(name) {
  return String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/**
 * How long something takes to pay for itself, in words. The work side is phrased about the visits
 * rather than the person: nobody in this game is an investment that pays back.
 */
function fmtPayback(seconds, side) {
  const lead = side === 'work' ? 'the visits cover it in' : 'pays for itself in';
  return fmtPaybackAs(seconds, lead);
}

function fmtPaybackAs(seconds, lead) {
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 90) { const n = Math.max(1, Math.round(seconds)); return `${lead} ${n} second${n === 1 ? '' : 's'}`; }
  if (seconds < 5400) return `${lead} about ${Math.round(seconds / 60)} minutes`;
  if (seconds < 60 * 3600) return `${lead} about ${Math.round(seconds / 3600)} hours`;
  return 'too dear for now – save up for it';
}

/** Why something shows no payback time – never "saves a job" unless it really does. */
function noPaybackReason(u, share) {
  if (u.kind === 'conditional') return share >= 0.999 ? 'no extra income just now' : `pays more ${u.label}`;
  if (u.kind === 'click' || u.kind === 'clickpct') return 'makes your own visits worth more';
  if (u.kind === 'discount') return 'makes them cheaper, not faster';
  if (u.kind === 'collect' || u.kind === 'offline') return 'saves you a job';
  return 'no extra income just now';
}

/**
 * The one line under the street in the first few minutes: what to do next, in order. It stops for
 * good once there is a team and something bought, so it never nags an experienced player.
 */
function nextStep(s, shop) {
  const carers = s.buildings.carer || 0;
  const carer = shop.find((b) => b.id === 'carer');
  if (s.clicks < 8) return '👆 Tap a door to do a visit yourself';
  if (!carers && carer && !carer.affordable) return `👆 Keep tapping – a carer costs ${fmtMoney(carer.cost)}`;
  if (!carers && carer) return '👥 You can afford a carer now – take one on in the shop below';
  if (carers && s.invoices > 0 && G.collectionMode(s) === 'manual') return '💷 Collect the payments – the money is waiting at the office';
  if (carers < 3) return '👥 More carers, more visits. Keep an eye on which side is behind';
  if (!s.upgrades.length && carers >= 3) return '⚡ Something in Upgrades is worth having now';
  return '';
}

/** "Priya, Morag and Callum" – a list of names the way a person would say it. */
function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * How far through a stage you are, in words. A run's takings multiply rather than add up, so the
 * bar counts how many times they have doubled – but "37% of the doublings" is not something anybody
 * can picture, so it says it the way you would say it out loud.
 */
function howFar(outlook) {
  if (outlook.fraction >= 1) return 'you have done it';
  // Counted in how many times the takings still have to double, not as a share of the money. A share
  // of the money reads as "nearly there" when you have six thousand pounds of a hundred and twenty
  // thousand, because the last double is most of the money – and that is a lie to anybody reading
  // the figure printed next to it.
  const earned = Math.max(outlook.earned, 1);
  const jumps = Math.max(0, Math.ceil(Math.log2(outlook.target / earned)));
  if (jumps <= 1) return 'one more big jump';
  if (jumps <= 2) return 'two more big jumps';
  if (jumps <= 3) return 'three more big jumps';
  if (jumps <= 6) return `${jumps} more big jumps`;
  if (jumps <= 12) return 'a good few big jumps to go';
  return 'a long way to go yet';
}

/** How much more a row would bring in, said the way a person would say it. */
function gainWords(share) {
  if (share >= 12) return 'far more than you earn now';
  if (share >= 4) return `${Math.round(share)} times what you earn now`;
  if (share >= 0.9) return 'about twice what you earn now';
  if (share >= 0.55) return 'about half as much again';
  if (share >= 0.25) return 'about a third as much again';
  if (share >= 0.12) return 'a good bit more coming in';
  if (share >= 0.04) return 'a bit more coming in';
  if (share >= 0.005) return 'a little more coming in';
  return 'barely anything, but it all counts';
}

/** True on a phone-sized screen, so the big figures can be shortened rather than clipped. */
function usePhoneWidth() {
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' && window.innerWidth <= 760);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth <= 760);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return narrow;
}

/**
 * The one figure on the face of an upgrade tile. Things that earn more say how much more; things
 * that do something else say what they do, in the same shape, so tiles can be compared at a glance.
 */
function gainPct(u) {
  if (u.gain > 0 && u.income > 0) return gainWords(u.gain / u.income);
  if (u.kind === 'discount') {
    const off = 1 - (u.factor || u.sideDiscount || 1);
    return off >= 0.45 ? 'about half price' : off >= 0.3 ? 'about a third off' : off >= 0.2 ? 'about a quarter off' : 'a bit cheaper';
  }
  if (u.kind === 'clickpct') { const add = u.clickAdd || 0; return add > 0 ? 'your own visits pay more' : 'nothing more, you are at the limit'; }
  if (u.kind === 'click' || u.clickBoost) {
    const m = u.clickBoost || u.mult || 2;
    return m >= 3 ? 'your own visits pay a lot more' : 'your own visits pay double';
  }
  return '';
}

/**
 * How much more you would earn, for the top of a tooltip or the buy dialog. The same words the tile
 * face uses – a percentage was the last thing anybody read before spending their money, and it was
 * the one line on the whole panel that told them nothing.
 */
function gainLine(u) {
  if (!(u.gain > 0) || !(u.income > 0)) return '';
  return `${gainWords(u.gain / u.income)}. `;
}

/** Restart a CSS animation on an element without going through state. */
function pulse(el) {
  if (!el) return;
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function useCarerNames() {
  return useMemo(() => {
    const seen = new Set();
    const names = [];
    for (const c of carers.value.filter((x) => x.active)) {
      const n = (c.firstName || '').trim();
      if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); names.push(n); }
    }
    return names;
  }, [carers.value]);
}

export function Game() {
  const names = useCarerNames();
  const [floaters, setFloaters] = useState([]);
  const [buyQty, setBuyQty] = useState(1);
  const chosenQty = useRef(false);   // ×10 is the sensible default, but not for the first purchase
  const [showOld, setShowOld] = useState(false);
  const [showAllUpgrades, setShowAllUpgrades] = useState(false);
  const [rightTab, setRightTab] = useState('grow');
  const [tickerIndex, setTickerIndex] = useState(() => Math.floor(Math.random() * 32));
  const [confetti, setConfetti] = useState(0);
  const worldRef = useRef(null);
  const canvasRef = useRef(null);
  const hudRef = useRef(null);
  const sceneRef = useRef(null);
  const lastTick = useRef(Date.now());
  const firstSeen = useRef(new Map());
  const prevEffects = useRef('');
  const effectMeta = useRef(new Map());
  const seenBranch = useRef(new Set());
  const s = game.value;
  const hasGame = !!s;
  const away = offlineReport.value;

  useEffect(() => {
    document.body.classList.add('game-open');
    return () => document.body.classList.remove('game-open');
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTickerIndex((i) => i + 1 + Math.floor(Math.random() * 3)), 11000);
    return () => clearInterval(id);
  }, []);

  // The game loop: ten ticks a second, saving every few seconds.
  useEffect(() => {
    startGame();
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      mutate((st) => {
        if (dt > 30) {
          const report = G.applyOffline(st, now);
          if (report) offlineReport.value = report;
          st.lastSeen = now;
          return;
        }
        const events = G.tick(st, dt, now, Math.random, names);
        const badges = events.filter((e) => e.kind === 'achievement').map((e) => e.achievement);
        if (badges.length === 1) toast(`${badges[0].emoji} Badge earned: ${badges[0].name}. Everything earns a bit more.`, { kind: 'success', duration: 5000 });
        else if (badges.length > 1) toast(`🎉 ${badges.length} badges at once! Everything earns a bit more.`, { kind: 'success', duration: 5000 });
        if (badges.length) { setConfetti((c) => c + 1); sceneRef.current?.celebrate('achievement'); }
        for (const e of events) {
          if (e.kind === 'spawn' && e.spawn.type === 'prismatic') toast(`🌈 ${e.spawn.name} is having a brilliant shift – go and say hello!`, { kind: 'info', duration: 6000 });
          if (e.kind === 'spawn' && e.spawn.type === 'card') toast('💌 A thank-you card is floating down – click it!', { kind: 'info', duration: 5000 });
          if (e.kind === 'collected' && e.byOffice) toast(`📥 The office sent the invoices off for you – ${fmtMoney(e.amount)} in. Press Collect payments yourself to keep it moving.`, { kind: 'info', duration: 7000 });
        }
      });
      scheduleSave();
    }, TICK_MS);
    const onHide = () => saveGame();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => { clearInterval(id); saveGame(); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', onHide); };
  }, [names]);

  // The animated street lives for as long as the canvas does.
  useEffect(() => {
    if (!hasGame || !canvasRef.current) return undefined;
    const scene = createScene(canvasRef.current, { onCoin: () => pulse(hudRef.current) });
    sceneRef.current = scene;
    return () => { scene.destroy(); sceneRef.current = null; };
  }, [hasGame]);

  useEffect(() => { if (s) sceneRef.current?.sync(s, names, Date.now()); });

  // Say when a boost runs out, so the chip does not just vanish.
  const effectKey = s ? s.effects.filter((e) => e.until > Date.now()).map((e) => e.id).join(',') : '';
  useEffect(() => {
    if (s) for (const e of s.effects) effectMeta.current.set(e.id, e);
    const before = prevEffects.current ? prevEffects.current.split(',') : [];
    const nowIds = effectKey ? effectKey.split(',') : [];
    prevEffects.current = effectKey;
    for (const id of before) if (!nowIds.includes(id)) {
      const e = effectMeta.current.get(id);
      toast(`${e ? `${e.emoji} ${e.name}` : 'The boost'} is over – back to normal speed`, { kind: 'info', duration: 3500 });
    }
  }, [effectKey]);

  useEffect(() => {
    if (!away) return;
    offlineReport.value = null;
    openModal(({ close }) => (
      <div class="confirm">
        <div class="confirm-icon"><Icon name="sun" size={28} /></div>
        <h2>Welcome back!</h2>
        <p class="soft">Your team kept going while you were away for {fmtSeconds(away.seconds)}: <strong>{fmtNum(Math.floor(away.visits))} visits</strong> worth <strong>{fmtMoney(away.earned)}</strong>{away.efficiency < 1 ? ' (at half speed – the on-call phone makes it faster)' : ''}. It is already in the bank.</p>
        {away.handovers ? (
          <p class="soft">The team handed the patch over <strong>{away.handovers === 1 ? 'once' : `${away.handovers} times`}</strong> while you were away, and earned <strong>{away.stars} Legacy {away.stars === 1 ? 'Star' : 'Stars'}</strong>. You are on {levelInfo(game.value.level).name.toLowerCase()} now.</p>
        ) : away.reach >= 0.15 ? <p class="soft">That is <strong>{away.reach >= 0.75 ? 'most of the way' : away.reach >= 0.55 ? 'about halfway' : away.reach >= 0.35 ? 'about a third of the way' : 'a good start'}</strong> to {G.nextLevel(game.value).name}.</p> : null}
        <div class="modal-actions"><Button variant="primary" onClick={() => close()}>Lovely</Button></div>
      </div>
    ), { size: 'sm', ariaLabel: 'Welcome back' });
  }, [away]);

  if (!s) return <div class="page"><PageHeader title="Care Empire" /></div>;

  const now = Date.now();
  const metrics = G.boardMetrics(s);
  const rate = G.productionPerSecond(s, now);
  const perClick = G.clickValue(s, now);
  const tapShare = G.tapShare(s, now);
  const narrow = usePhoneWidth();
  const mode = G.collectionMode(s);
  const level = levelInfo(s.level);
  const next = G.nextLevel(s);
  const starName = names[0] || 'Sam';
  const team = G.teamNames(s, names);
  const rating = G.ratingInfo(s);
  const balance = G.bottleneck(s, metrics);
  const activeEffects = s.effects.filter((e) => e.until > now);
  const frenzy = activeEffects.some((e) => e.clickMult);
  const spawnBox = s.spawn ? sceneRef.current?.spawnPos() : null;
  const nextBadge = G.nextGoal(s, now);
  const upgrades = G.upgradeShop(s, now, showAllUpgrades ? 40 : 12);
  const firstRender = firstSeen.current.size === 0;
  for (const u of upgrades) if (!firstSeen.current.has(u.id)) firstSeen.current.set(u.id, firstRender ? 0 : now);
  // Worked out once for the whole shop: every row asks how much more it would bring in.
  const earning = G.productionPerSecond(s, now);
  const shop = G.unlockedBuildings(s).map((b) => G.buildingOffer(s, b.id, buyQty === 'max' ? Math.max(1, G.maxAffordable(s, b.id)) : buyQty, now, earning));
  const bestBuy = shop.reduce((a, b) => (b.payback < (a ? a.payback : Infinity) ? b : a), null);
  // Rungs you have left far behind are folded away: at the far stages there are dozens of them and
  // every one reads "earns nothing extra just now".
  // ...and so are the ones you could not afford in ten minutes of takings, which at the far stages
  // is most of the list and every one of them reads the same.
  const outgrown = shop.filter((b) => b !== bestBuy && earning > 0 && b.count > 0 && b.gain < earning * 0.001);
  // ...and the ones you have never owned and could not afford in ten minutes are a different thing
  // again: not left behind, just too dear for now.
  const tooDear = shop.filter((b) => b !== bestBuy && earning > 0 && !outgrown.includes(b)
    && b.count === 0 && b.cost > earning * 600 && shop.indexOf(b) > 2);
  // When everything on the shelf pays for itself in a second, payback stops telling you anything,
  // so the row that moves you furthest is named as well.
  const biggestStep = shop.reduce((a, b) => (b.affordable && b.gain > (a ? a.gain : 0) ? b : a), null);
  const folded = [...outgrown, ...tooDear];
  const rows = showOld ? shop : shop.filter((b) => !folded.includes(b));
  const hint = nextStep(s, shop);
  // Ten at a time is the sensible way to shop – but only once ten of something is twenty seconds
  // of takings. Before that it turns the opening into a long wait with nothing to press.
  const goingConcern = rate > 0 && shop.length > 0 && Math.min(...shop.map((b) => G.buildingCost(s, b.id, 10))) <= rate * 20;
  useEffect(() => { if (!chosenQty.current && goingConcern) setBuyQty(10); }, [goingConcern]);
  const pending = G.pendingBranch(s);
  const outlook = G.expandOutlook(s, now);
  const nextLocked = G.nextLockedBuilding(s);
  const workShare = metrics.work + metrics.team > 0 ? (metrics.work / (metrics.work + metrics.team)) * 100 : 50;
  // The news only carries lines that make sense for the business you have actually built.
  const lines = TICKER.filter((l) => typeof l === 'string' || l.when(s)).map((l) => (typeof l === 'string' ? l : l.text));
  const tickerText = lines[tickerIndex % lines.length]
    .replace(/\{n\}/g, team[Math.floor((tickerIndex * 7) % Math.max(1, team.length))] || starName)
    .replace(/\{co\}/g, settings.value?.companyName || 'Monteith');

  // Announce a big choice the first time it becomes available.
  if (pending && !seenBranch.current.has(pending.slot)) {
    seenBranch.current.add(pending.slot);
    setTimeout(() => toast(`${pending.emoji} A decision to make: ${pending.name}`, { kind: 'info', duration: 7000 }), 0);
  }

  function addFloater(text, x, y, cls = '') {
    const id = Math.random();
    setFloaters((f) => [...f.slice(-14), { id, text, x, y, cls }]);
    setTimeout(() => setFloaters((f) => f.filter((z) => z.id !== id)), 900);
  }

  function doVisit(x, y, rect, house = null) {
    const scene = sceneRef.current;
    const count = scene ? scene.houseCount() : 1;
    // Tapping the street finds the nearest door that is ready, so a tap is never wasted. Only when
    // every door on the street has just been seen does anybody get a "give them a minute".
    const index = house !== null ? house : G.nearestReadyHouse(s, count, scene ? scene.houseAt(x) : 0, Date.now());
    const earned = mutate((st) => G.click(st, Date.now(), index));
    if (!earned) { scene?.refuse(index); return; }
    scene?.playerVisit(x, y, frenzy ? 6 : 3, index);
    addFloater(`+${fmtMoney(earned)}`, (x / rect.width) * 100, (y / rect.height) * 100, frenzy ? 'big' : '');
    scheduleSave();
  }

  function onWorldClick(e) {
    const rect = worldRef.current.getBoundingClientRect();
    const fromKeyboard = !e.clientX && !e.clientY;
    const x = fromKeyboard ? rect.width * 0.5 : e.clientX - rect.left;
    const y = fromKeyboard ? rect.height * 0.6 : e.clientY - rect.top;
    if (!fromKeyboard && sceneRef.current?.hitTest(x, y)) { onSpawnClick(); return; }
    doVisit(x, y, rect);
  }

  function onWorldKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const rect = worldRef.current.getBoundingClientRect();
    const count = sceneRef.current ? sceneRef.current.houseCount() : 1;
    const house = G.readyHouse(s, count, Date.now());
    if (house < 0) return;
    doVisit(rect.width * 0.5, rect.height * 0.6, rect, house);
  }

  function onCollect() {
    const amount = mutate((st) => G.collect(st));
    if (amount > 0) { addFloater(`+${fmtMoney(amount)}`, 14, 40, 'big'); sceneRef.current?.celebrate('collect'); }
    scheduleSave();
  }

  function onSpawnClick() {
    const r = mutate((st) => G.clickSpawn(st, Date.now(), Math.random));
    if (!r) return;
    addFloater(`${r.effect.emoji} ${r.effect.name}!`, 50, 30, 'big');
    sceneRef.current?.celebrate(r.type);
    if (r.type === 'prismatic') setConfetti((c) => c + 1);
    toast(`${r.effect.emoji} ${r.message}${r.amount ? ` +${fmtMoney(r.amount)}` : ''}`, { kind: r.type === 'prismatic' ? 'success' : 'info', duration: 7000 });
    saveGame();
  }

  function onBuy(offer) {
    const r = mutate((st) => G.buyBuilding(st, offer.id, buyQty));
    if (!r.bought) return;
    sceneRef.current?.celebrate('buy');
    if (r.milestone) {
      const line = offer.side === 'work'
        ? `${offer.emoji} That is ${fmtNum(r.milestone)} ${offer.plural.toLowerCase()} – a proper round now, and it all runs ${fmtTimes(offer.milestoneFactor)}.`
        : `${offer.emoji} That is ${fmtNum(r.milestone)} ${offer.plural.toLowerCase()} – they all get ${fmtTimes(offer.milestoneFactor)} together.`;
      toast(line, { kind: 'success', duration: 6000 });
      setConfetti((c) => c + 1);
      sceneRef.current?.celebrate('achievement');
    }
    scheduleSave();
  }

  // On a phone there is nothing to hover over, so a tap opens what the tile does and asks first.
  async function onUpgrade(u) {
    if (narrow) {
      const ok = await confirm({
        title: `${u.emoji} ${u.name}`,
        message: (
          <>
            {u.blurb}<br /><br />
            {u.question}<br /><br />
            <span class="muted">You will see: {u.visual}</span><br /><br />
            <strong>{gainLine(u)}{fmtPayback(u.payback, null) || noPaybackReason(u, u.kind === 'conditional' ? G.conditionShare(u, s, metrics) : 0)}</strong>
          </>
        ),
        confirmLabel: `Buy for ${fmtMoney(u.cost, { short: true })}`, icon: 'zap',
      });
      if (!ok) return;
    }
    buyUpgradeNow(u);
  }

  function buyUpgradeNow(u) {
    if (mutate((st) => G.buyUpgrade(st, u.id))) {
      toast(`${u.emoji} ${u.name} – ${u.visual || u.blurb}`, { kind: 'success', duration: 5000 });
      sceneRef.current?.celebrate('upgrade');
      scheduleSave();
    }
  }

  function onPickBranch(slot, option) {
    if (mutate((st) => G.pickBranch(st, slot, option.id))) {
      toast(`${option.emoji} ${option.name} – ${option.visual || option.blurb}`, { kind: 'success', duration: 6000 });
      setConfetti((c) => c + 1);
      sceneRef.current?.celebrate('expand');
      saveGame();
    }
  }

  async function onExpand() {
    const gained = G.starsOnExpand(s);
    const kit = G.startingKit(s.level + 1);
    // The first few hand-overs are explained; after that the button says what it does and asking
    // again every three minutes is just something in the way.
    if (s.level < 3) {
      const ok = await confirm({
        title: `Hand over and grow to ${next.name.toLowerCase()} ${next.emoji}?`,
        message: (
          <>
            You lose your carers, your kit and your money.<br /><br />
            You keep every badge. You get <strong>{gained} Legacy {gained === 1 ? 'Star' : 'Stars'}</strong> – they
            make everything you ever earn a little better, for good.<br /><br />
            You start again with {kit.carer} carers and {kit.client} people to look after, and bigger things to buy.
          </>
        ),
        confirmLabel: `Hand over`, icon: 'trending-up',
      });
      if (!ok) return;
    }
    const r = mutate((st) => G.expand(st, Date.now()));
    if (r) {
      toast(`${levelInfo(r.level).emoji} ${levelInfo(r.level).name}! +${r.gained} Legacy ${r.gained === 1 ? 'Star' : 'Stars'}`, { kind: 'success', duration: 7000 });
      setConfetti((c) => c + 1);
      sceneRef.current?.celebrate('expand');
      seenBranch.current = new Set();
      saveGame();
    }
  }

  function onPerk(p) {
    if (mutate((st) => G.buyPerk(st, p.id))) { toast(`${p.emoji} ${p.name} – ${p.blurb}`, { kind: 'success' }); saveGame(); }
  }

  async function onReset() {
    const ok = await confirm({ title: 'Start the game over?', message: 'Everything in the game goes back to the very beginning, including Legacy Stars. Your real holiday records are not affected.', confirmLabel: 'Start over', danger: true, icon: 'refresh' });
    if (ok) { resetGame(); seenBranch.current = new Set(); firstSeen.current = new Map(); toast('Back to the beginning. Good luck!'); }
  }

  return (
    <div class="page game-page">
      <PageHeader title={<span class="row">Care Empire <Badge tone="peach" size="md">{level.emoji} {level.name}</Badge></span>} lede={level.tagline} />

      {/* ---------- The street ---------- */}
      <div class="world-frame">
        <div class={`world ${frenzy ? 'frenzy' : ''}`} ref={worldRef} role="button" tabIndex={0} aria-label={`Do a visit with ${starName}`} data-test="clicker" onClick={onWorldClick} onKeyDown={onWorldKey}>
          <canvas ref={canvasRef} aria-hidden="true" />
          <div class="world-hud" ref={hudRef}>
            <div class="game-funds-main">{fmtMoney(s.funds, { short: narrow })}</div>
            <div class="world-rate">{fmtRate(rate, { short: narrow })} · {fmtMoney(perClick, { short: narrow })} per visit</div>
            {rate > 0 ? <div class="world-taps">Your own visits: {tapShare >= 0.005 ? tapShare >= 0.5 ? 'more than half of what you earn' : tapShare >= 0.25 ? 'a good part of what you earn' : tapShare >= 0.08 ? 'a fair bit of what you earn' : 'a small part of what you earn' : 'worth little yet – knocking upgrades change that'}</div> : null}
          </div>
          <div class="world-level">{rating.emoji} {rating.name}{s.prismaticHires.length ? ` · ${s.prismaticHires.length} 🌈` : ''}</div>
          {activeEffects.length ? (
            <div class="world-effects">
              {activeEffects.map((e) => <span key={e.id} class={`effect-chip effect-${e.id}`}>{e.emoji} {e.name} · {fmtSeconds((e.until - now) / 1000)}</span>)}
            </div>
          ) : null}
          {hint ? <div class="world-hint">{hint}</div> : null}
          {confetti ? <Confetti key={confetti} /> : null}
          {floaters.map((f) => <span key={f.id} class={`floater ${f.cls}`} style={{ left: f.x + '%', top: f.y + '%' }}>{f.text}</span>)}
          {spawnBox ? (
            <button type="button" class={`spawn-hit spawn-${spawnBox.type}`} style={{ left: spawnBox.x + 'px', top: spawnBox.y + 'px', width: spawnBox.r * 2 + 'px', height: spawnBox.r * 2 + 'px' }}
              onClick={(e) => { e.stopPropagation(); onSpawnClick(); }} data-test="spawn" aria-label={s.spawn.type === 'prismatic' ? `Say hello to ${s.spawn.name}` : 'Open the thank-you card'} />
          ) : null}
        </div>

        {/* The one number that drives every decision: which side is behind. */}
        <div class="balance-strip" data-test="balance">
          <span class="balance-label">🏠 {fmtNum(metrics.work)} visits wanted</span>
          <span class="balance-bar" role="img" aria-label={`Work ${Math.round(workShare)} per cent, team ${100 - Math.round(workShare)} per cent`}>
            <span class="balance-work" style={{ width: `${workShare}%` }} />
            <span class="balance-team" style={{ width: `${100 - workShare}%` }} />
          </span>
          <span class="balance-label">👥 your team can do {fmtNum(metrics.team)}</span>
          <span class={`balance-advice side-${balance.side}`}>{balance.advice}</span>
        </div>

        <div class="ticker-bar" aria-live="off"><span>📰</span><span class="ticker-text" key={tickerIndex}>{tickerText}</span></div>
      </div>

      {/* ---------- A big choice, when there is one ---------- */}
      {pending ? (
        <Card title={`${pending.emoji} ${pending.name}`} icon="help" class="branch-card" subtitle={`${pending.blurb} You choose once, and it lasts until you hand over.`}>
          <div class="branch-grid">
            {pending.options.map((o) => (
              <button key={o.id} type="button" class="branch-option" onClick={() => onPickBranch(pending.slot, o)} data-test={`branch-${o.id}`}>
                <span class="branch-emoji">{o.emoji}</span>
                <strong>{o.name}</strong>
                <span class="muted small">{o.blurb}</span>
                <span class="branch-question">{o.question}</span>
                <span class="branch-visual">You will see: {o.visual}</span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <div class="game-grid">
        {/* ---------- Left: money in, and the team ---------- */}
        <div class="game-left">
          {mode === 'manual' ? (
            <button type="button" class={`collect-btn collect-first ${s.invoices > 0 ? 'ready' : ''}`} onClick={onCollect} disabled={s.invoices <= 0} data-test="collect">
              <span class="collect-label">💷 Collect payments</span>
              <span class="collect-amount">{fmtMoney(s.invoices)}</span>
            </button>
          ) : mode === 'admin' ? (
            <div class="collect-auto"><span>🗃️ The office admin collects the payments every few seconds</span><strong>{fmtMoney(s.invoices)} waiting</strong></div>
          ) : (
            <div class="collect-auto"><span>🏦 Payments arrive the moment the visit is done</span></div>
          )}

          <Card title="Your team" icon="users" class="team-card" subtitle={team.length ? `${fmtNum(team.length)} ${team.length === 1 ? 'carer' : 'carers'}` : 'Take on your first carer from the shop'}>
            <div class="team-strip">
              {team.slice(0, 18).map((n, i) => <span key={i} class="team-avatar" style={{ '--hue': (i * 47) % 360 }} title={n}>{initialsOf(n)}</span>)}
              {team.length > 18 ? <span class="team-more">+{fmtNum(team.length - 18)}</span> : null}
            </div>
            {s.prismaticHires.length ? (
              <p class="team-shifts">🌈 Shifts the team still talks about: {listNames(s.prismaticHires)}. Everybody picked something up
                {' '}– everything earns {fmtPercent(1 + 0.03 * s.prismaticHires.length)} because of them.</p>
            ) : null}
            {s.log.length ? <ul class="game-log">{s.log.slice(0, 4).map((l, i) => <li key={i}><span>{l.emoji}</span> {l.text}</li>)}</ul> : null}
          </Card>

          <Card title="How you are rated" icon="star" class="rating-card" subtitle={rating.blurb}>
              <div class="rating-row"><span class="rating-emoji">{rating.emoji}</span><strong>{rating.name}</strong></div>
            {G.activeConditionals(s, metrics).length ? (
              <ul class="cond-list">
                {G.activeConditionals(s, metrics).map((c) => (
                  <li key={c.id} class={c.on ? 'on' : c.share >= 0.25 ? 'part' : 'off'}>
                    {c.on ? '✅' : c.share >= 0.25 ? '🟡' : '⚪'} <strong>{c.name}</strong>
                    <span class="muted small"> — {c.on ? 'paying in full.' : c.share >= 0.25 ? 'paying some of what it can.' : 'not paying yet.'} It pays more {c.label}.</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {rating.next ? (
              <p class="muted small">Coordinators, supervisors, academies and the quality upgrades all count towards your rating. Buy {fmtNum(rating.next.score - rating.score)} points' worth more to be rated {rating.next.name.toLowerCase()}.</p>
            ) : <p class="muted small">There is nothing above this. Everybody knows it.</p>}
          </Card>
        </div>

        {/* ---------- Middle: what to buy ---------- */}
        <div class="game-mid">
          <Card title="Upgrades" icon="zap" padded={false} class="upgrade-card" subtitle={upgrades.length ? (narrow ? 'Best thing first. Tap one to see what it does.' : 'Best thing first. Point at one to see what it does.')
              : s.upgrades.length > 3 ? 'Nothing here is worth much next to what you already earn – keep growing and more will be.'
              : 'Tap a few doors – the first upgrade is only a few pounds away.'}>
            <div class="upgrade-row">
              {upgrades.map((u) => (
                <button key={u.id} type="button" class={`upgrade-tile ${u.affordable ? 'affordable' : ''} ${now - firstSeen.current.get(u.id) < 12000 && now - (s.runStartedAt || 0) > 15000 ? 'new' : ''}`} onClick={() => onUpgrade(u)} disabled={!u.affordable}
                  title={`${u.name} – ${u.blurb}\n${u.question}\nYou will see: ${u.visual}\n${gainLine(u)}${fmtPayback(u.payback, null) || noPaybackReason(u, u.kind === 'conditional' ? G.conditionShare(u, s, metrics) : 0)}`} data-test={`upgrade-${u.id}`}>
                  <span class="upgrade-emoji">{u.emoji}</span>
                  <span class="upgrade-name">{u.name}</span>
                  <span class="upgrade-cost">{fmtPrice(u.cost, earning)}</span>
                  <span class="upgrade-pay">{gainPct(u) || (u.kind === 'conditional' ? 'when it fits' : 'saves a job')}</span>
                </button>
              ))}
            </div>
            {upgrades.total > upgrades.length || showAllUpgrades ? (
              <button type="button" class="shop-more" onClick={() => setShowAllUpgrades((v) => !v)}>
                {showAllUpgrades ? 'Just the best twelve' : `Show ${fmtNum(upgrades.total - upgrades.length)} more upgrades`}
              </button>
            ) : null}
          </Card>

          <Card title="Shop" icon="briefcase" class="shop-card" padded={false} subtitle="The best thing to spend your money on is at the top." actions={
            <div class="qty-picker" role="group" aria-label="How many to buy">
              {[1, 10, 'max'].map((q) => <button key={q} type="button" class={`qty ${buyQty === q ? 'active' : ''}`} onClick={() => { chosenQty.current = true; setBuyQty(q); }}>{q === 'max' ? 'Max' : `×${q}`}</button>)}
            </div>}>
            <ul class="building-list">
              {rows.map((b) => (
                <li key={b.id}>
                  <button type="button" class={`building-row ${b.affordable ? 'affordable' : ''} ${bestBuy && bestBuy.id === b.id ? 'best' : ''}`} onClick={() => onBuy(b)} disabled={!b.affordable}
                    title={`${b.name} – ${b.blurb}\nYou will see: ${b.visual}`} data-test={`buy-${b.id}`}>
                    <span class="building-emoji">{b.emoji}</span>
                    <span class="building-main">
                      <span class="building-name">
                        <span class={`side-dot side-${b.side}`} title={SIDES[b.side].hint}>{SIDES[b.side].emoji}</span>
                        {b.name}{b.count ? <span class="building-owned">{fmtNum(b.count)}</span> : null}
                        {bestBuy && bestBuy.id === b.id && b.gain / b.income >= 0.005 ? <span class="best-chip">Best buy</span> : null}
                        {biggestStep && biggestStep.id === b.id && (!bestBuy || bestBuy.id !== b.id) ? <span class="best-chip step-chip">Biggest jump</span> : null}
                      </span>
                      <span class="building-sub muted">
                        {b.gain > 0 && b.income > 0
                          ? <>{gainWords(b.gain / b.income)}<span class="muted"> · {fmtPayback(b.payback, b.side)}</span></>
                          : (metrics.team <= 0 && b.side === 'work' ? 'nobody to do the visits yet – take on a carer first'
                            : metrics.work <= 0 && b.side === 'team' ? 'nobody to visit yet – take somebody on first'
                            : b.side === 'team' ? 'gets the visits started' : 'earns nothing extra just now')}
                        {b.milestone ? <span class="milestone-pip"> · buy {fmtNum(b.milestone.remaining)} more and they all get {fmtTimes(b.milestoneFactor)}</span> : null}
                      </span>
                    </span>
                    <span class="building-buy"><span class="building-cost">{fmtPrice(b.cost, earning)}</span></span>
                  </button>
                </li>
              ))}
              {nextLocked ? (
                <li class="building-locked">🔒 <strong>{nextLocked.name}</strong> unlocks when you hand over and reach {levelInfo(nextLocked.level).name.toLowerCase()} {levelInfo(nextLocked.level).emoji}</li>
              ) : null}
            </ul>
            {folded.length ? (
              <button type="button" class="shop-more" onClick={() => setShowOld((v) => !v)}>
                {showOld ? 'Hide the rest'
                  : folded.length === 1 ? 'Show 1 more thing to buy' : `Show ${fmtNum(folded.length)} more things to buy`}
              </button>
            ) : null}
          </Card>
        </div>

        {/* ---------- Right: growing, legacy, badges ---------- */}
        <div class="game-right">
          <Tabs tabs={[{ id: 'grow', label: 'Grow', icon: 'trending-up' }, { id: 'stars', label: 'Stars', icon: 'star', count: G.starsAvailable(s) || undefined }, { id: 'badges', label: 'Badges', icon: 'heart', count: s.achievements.length }, { id: 'stats', label: 'Stats', icon: 'chart' }]} value={rightTab} onChange={setRightTab} variant="segmented" ariaLabel="Game panels" />

          {rightTab === 'grow' ? (
            <Card title={`Next: ${next.name} ${next.emoji}`} icon="trending-up" class={`expand-card ${G.canExpand(s) ? 'ready' : ''}`}>
              <p class="soft">{outlook.fraction >= 1
                ? 'You have earned enough to hand this patch over whenever you like. You start again with a small round, keep every badge, and unlock bigger things to buy.'
                : `Earn ${fmtMoney(G.expandRequirement(s))} in this run to hand the patch over. You start again with a small round, keep every badge, and unlock bigger things to buy.`}</p>
              <div class="expand-bar" role="progressbar" aria-valuenow={Math.round(outlook.progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(1, outlook.progress * 100)}%` }} /></div>
              <div class="row-between">
                <span class="muted" title={`${fmtMoney(outlook.earned)} of ${fmtMoney(outlook.target)}`}>{fmtMoney(outlook.earned)} earned so far</span>
                <strong>{howFar(outlook)}</strong>
              </div>
              {outlook.fraction >= 1 ? (
                <p class="small mt expand-slow">
                  You have done it. Hand over now, or stay on a while – the longer you leave it, the more
                  Legacy Stars you get, and everything you earn from now on goes up a little too.
                  {s.stayBonus > 0 ? <> Staying on has earned you <strong>{fmtPercent(1 + s.stayBonus)} on everything, for good</strong>.</> : null}
                </p>
              ) : (
                <p class={`small mt ${outlook.seconds > 1800 ? 'expand-slow' : 'muted'}`}>
                  {outlook.seconds === null
                    ? s.invoices > 0 && outlook.earned <= 0
                      ? 'Nothing counts towards this until the payments are collected – there is money waiting.'
                      : 'Just getting going – give it a minute and it will say how long this run should take.'
                    : Number.isFinite(outlook.seconds)
                      ? `About ${fmtSeconds(outlook.seconds)} at the rate you are growing.${outlook.seconds > 1800 ? ' Something bigger is worth buying.' : ''}`
                      : 'Nothing is coming in yet – take somebody on.'}
                </p>
              )}
              <Button variant="primary" full size="lg" icon="trending-up" onClick={onExpand} disabled={!G.canExpand(s)} class="mt" data-test="expand">
                {G.canExpand(s) ? `Hand over · +${G.starsOnExpand(s)} ⭐` : 'Keep growing…'}
              </Button>
              {nextBadge ? <p class="small mt next-goal">🎯 <strong>Next badge:</strong> {nextBadge.emoji} {nextBadge.name} – {nextBadge.blurb}</p> : null}
              {G.branchChoices(s).filter((b) => b.chosen).length ? (
                <p class="muted small mt">You are known for: {G.branchChoices(s).filter((b) => b.chosen).map((b) => b.options.find((o) => o.picked).name).join(', ')}.</p>
              ) : null}
            </Card>
          ) : null}

          {rightTab === 'stars' ? (
            <Card title="Legacy Stars" icon="star" subtitle={`${s.starsEarned} earned · ${G.starsAvailable(s)} to spend · they make everything ${fmtTimes(G.starBonus(s.starsEarned))}, for good`}>
              <ul class="perk-list">
                {G.perkList(s).map((p) => (
                  <li key={p.id} class={`perk ${p.owned ? 'owned' : p.affordable ? 'affordable' : ''}`}>
                    <span class="perk-emoji">{p.emoji}</span>
                    <span class="perk-main"><strong>{p.name}</strong><span class="muted">{p.blurb}</span></span>
                    {p.owned ? <Badge tone="sage" icon="check">Owned</Badge> : <Button size="sm" variant={p.affordable ? 'primary' : 'secondary'} disabled={!p.affordable} onClick={() => onPerk(p)}>{p.cost} ⭐</Button>}
                  </li>
                ))}
              </ul>
              <p class="muted small mt">Stars come from handing over: the more you have earned over all time, the more you get.</p>
            </Card>
          ) : null}

          {rightTab === 'badges' ? (
            <Card title="Badges" icon="heart" subtitle={`${s.achievements.length} of ${G.achievementList(s).length} · every badge makes everything a little better`}>
              <div class="badge-grid">
                {G.achievementList(s).map((a) => <span key={a.id} class={`badge-tile ${a.done ? 'done' : ''}`} title={`${a.name} – ${a.blurb}`}>{a.done ? a.emoji : '🔒'}<span class="badge-name">{a.done ? a.name : '???'}</span></span>)}
              </div>
            </Card>
          ) : null}

          {rightTab === 'stats' ? (
            <Card title="Statistics" icon="chart">
              <dl class="game-stats">
                <div><dt>Visits done by you</dt><dd>{fmtNum(s.clicks)}</dd></div>
                <div><dt>Visits altogether</dt><dd>{fmtNum(Math.floor(s.visits))}</dd></div>
                <div><dt>Visits wanted</dt><dd>{fmtNum(metrics.work)} a second</dd></div>
                <div><dt>Visits your team can do</dt><dd>{fmtNum(metrics.team)} a second</dd></div>
                <div><dt>Earned this run</dt><dd>{fmtMoney(s.runEarned)}</dd></div>
                <div><dt>Earned ever</dt><dd>{fmtMoney(s.lifetimeEarned)}</dd></div>
                <div><dt>Coming in</dt><dd>{fmtRate(rate)}</dd></div>
                <div><dt>Brilliant shifts you saw</dt><dd>{s.prismaticsMet}</dd></div>
                <div><dt>Thank-you cards opened</dt><dd>{s.cardsOpened}</dd></div>
                <div><dt>Payments chased by hand</dt><dd>{s.collections}</dd></div>
                <div><dt>Playing since</dt><dd>{new Date(s.startedAt).toLocaleDateString('en-GB')}</dd></div>
              </dl>
              <Collapsible title="Options" icon="settings" class="mt">
                <p class="muted small">Progress saves itself. The game is separate from your real holiday records.</p>
                <div class="row">
                  <Button variant="ghost" icon="refresh" onClick={onReset}>Start the game over</Button>
                  <Button variant="ghost" icon="eye-off" onClick={() => navigate('settings', { tab: 'general' })}>Hide the game</Button>
                </div>
              </Collapsible>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A short burst of confetti. Re-mount (change key) to fire again. */
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ i, x: 50 + (Math.random() - 0.5) * 60, dx: (Math.random() - 0.5) * 60, rot: Math.random() * 360, hue: Math.floor(Math.random() * 360), delay: Math.random() * 0.2, size: 6 + Math.random() * 8 })), []);
  return (
    <div class="confetti" aria-hidden="true">
      {pieces.map((p) => <span key={p.i} style={{ left: p.x + '%', '--dx': p.dx + 'vw', '--rot': p.rot + 'deg', '--h': p.hue, animationDelay: p.delay + 's', width: p.size + 'px', height: p.size * 0.6 + 'px' }} />)}
    </div>
  );
}
