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
import { fmtMoney, fmtNum, fmtRate, fmtSeconds, fmtPercent } from '../../core/game/format.js';
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
  return 'takes a very long time to come good';
}

/** Why something shows no payback time – never "saves a job" unless it really does. */
function noPaybackReason(u, active) {
  if (u.kind === 'conditional') return active ? 'no extra income just now' : `only pays ${u.label}`;
  if (u.kind === 'click' || u.kind === 'clickpct') return 'makes your own visits worth more';
  if (u.kind === 'discount') return 'makes them cheaper, not faster';
  if (u.kind === 'collect' || u.kind === 'offline') return 'saves you a job';
  return 'no extra income just now';
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
  const [rightTab, setRightTab] = useState('grow');
  const [tickerIndex, setTickerIndex] = useState(() => Math.floor(Math.random() * TICKER.length));
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
    const id = setInterval(() => setTickerIndex((i) => (i + 1 + Math.floor(Math.random() * 3)) % TICKER.length), 11000);
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
        if (badges.length === 1) toast(`${badges[0].emoji} Badge earned: ${badges[0].name} – everything earns 1% more`, { kind: 'success', duration: 5000 });
        else if (badges.length > 1) toast(`🎉 ${badges.length} badges at once: ${badges.map((b) => b.name).join(', ')} – everything earns ${badges.length}% more`, { kind: 'success', duration: 6000 });
        if (badges.length) { setConfetti((c) => c + 1); sceneRef.current?.celebrate('achievement'); }
        for (const e of events) {
          if (e.kind === 'spawn' && e.spawn.type === 'prismatic') toast(`🌈 ${e.spawn.name} is having a brilliant shift – go and say hello!`, { kind: 'info', duration: 6000 });
          if (e.kind === 'spawn' && e.spawn.type === 'card') toast('💌 A thank-you card is floating down – click it!', { kind: 'info', duration: 5000 });
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
        <p class="soft">Your team kept going while you were away for {fmtSeconds(away.seconds)}: <strong>{fmtNum(Math.floor(away.visits))} visits</strong> worth <strong>{fmtMoney(away.earned)}</strong>{away.efficiency < 1 ? ' (at half speed – the on-call phone makes it faster)' : ''}.{away.needsCollect ? ' The payments are waiting to be collected.' : ''}</p>
        <div class="modal-actions"><Button variant="primary" onClick={() => close()}>Lovely</Button></div>
      </div>
    ), { size: 'sm', ariaLabel: 'Welcome back' });
  }, [away]);

  if (!s) return <div class="page"><PageHeader title="Care Empire" /></div>;

  const now = Date.now();
  const metrics = G.boardMetrics(s);
  const rate = G.productionPerSecond(s, now);
  const perClick = G.clickValue(s, now);
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
  const nextBadge = G.achievementList(s).find((a) => !a.done);
  const upgrades = G.upgradeShop(s, now, 12);
  const firstRender = firstSeen.current.size === 0;
  for (const u of upgrades) if (!firstSeen.current.has(u.id)) firstSeen.current.set(u.id, firstRender ? 0 : now);
  const shop = G.unlockedBuildings(s).map((b) => G.buildingOffer(s, b.id, buyQty === 'max' ? Math.max(1, G.maxAffordable(s, b.id)) : buyQty, now));
  const bestBuy = shop.reduce((a, b) => (b.payback < (a ? a.payback : Infinity) ? b : a), null);
  const pending = G.pendingBranch(s);
  const progress = G.expandProgress(s);
  const nextLocked = G.nextLockedBuilding(s);
  const workShare = metrics.work + metrics.team > 0 ? (metrics.work / (metrics.work + metrics.team)) * 100 : 50;
  const tickerText = TICKER[tickerIndex].replace(/\{n\}/g, team[Math.floor((tickerIndex * 7) % Math.max(1, team.length))] || starName).replace(/\{co\}/g, settings.value?.companyName || 'Monteith');

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
    const index = house !== null ? house : (scene ? scene.houseAt(x) : 0);
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
        ? `${offer.emoji} That is ${fmtNum(r.milestone)} ${offer.plural.toLowerCase()} – a proper round now, and it all runs ${offer.milestoneFactor} times smoother.`
        : `${offer.emoji} That is ${fmtNum(r.milestone)} ${offer.plural.toLowerCase()} – they work ${offer.milestoneFactor} times better together.`;
      toast(line, { kind: 'success', duration: 6000 });
      setConfetti((c) => c + 1);
      sceneRef.current?.celebrate('achievement');
    }
    scheduleSave();
  }

  function onUpgrade(u) {
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
    const ok = await confirm({
      title: `Hand over and grow to ${next.name.toLowerCase()} ${next.emoji}?`,
      message: `Your people, your kit and your money start again – but you keep every badge, gain ${gained} Legacy ${gained === 1 ? 'Star' : 'Stars'} (each one adds 2% to everything, forever) and begin with ${kit.carer} carers and ${kit.client} people to look after. Bigger things unlock at the next stage.`,
      confirmLabel: `Hand over`, icon: 'trending-up',
    });
    if (!ok) return;
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
            <div class="game-funds-main">{fmtMoney(s.funds)}</div>
            <div class="world-rate">{fmtRate(rate)} · {fmtMoney(perClick)} per visit</div>
          </div>
          <div class="world-level">{rating.emoji} {rating.name}{s.prismaticHires.length ? ` · ${s.prismaticHires.length} 🌈` : ''}</div>
          {activeEffects.length ? (
            <div class="world-effects">
              {activeEffects.map((e) => <span key={e.id} class={`effect-chip effect-${e.id}`}>{e.emoji} {e.name} · {fmtSeconds((e.until - now) / 1000)}</span>)}
            </div>
          ) : null}
          {s.clicks < 8 ? <div class="world-hint">👆 Tap a door to do a visit yourself</div> : null}
          {confetti ? <Confetti key={confetti} /> : null}
          {floaters.map((f) => <span key={f.id} class={`floater ${f.cls}`} style={{ left: f.x + '%', top: f.y + '%' }}>{f.text}</span>)}
          {spawnBox ? (
            <button type="button" class={`spawn-hit spawn-${spawnBox.type}`} style={{ left: spawnBox.x + 'px', top: spawnBox.y + 'px', width: spawnBox.r * 2 + 'px', height: spawnBox.r * 2 + 'px' }}
              onClick={(e) => { e.stopPropagation(); onSpawnClick(); }} data-test="spawn" aria-label={s.spawn.type === 'prismatic' ? `Say hello to ${s.spawn.name}` : 'Open the thank-you card'} />
          ) : null}
        </div>

        {/* The one number that drives every decision: which side is behind. */}
        <div class="balance-strip" data-test="balance">
          <span class="balance-label">🏠 {fmtNum(metrics.work)} wanted</span>
          <span class="balance-bar" role="img" aria-label={`Work ${Math.round(workShare)} per cent, team ${100 - Math.round(workShare)} per cent`}>
            <span class="balance-work" style={{ width: `${workShare}%` }} />
            <span class="balance-team" style={{ width: `${100 - workShare}%` }} />
          </span>
          <span class="balance-label">👥 {fmtNum(metrics.team)} deliverable</span>
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
            <button type="button" class={`collect-btn ${s.invoices > 0 ? 'ready' : ''}`} onClick={onCollect} disabled={s.invoices <= 0} data-test="collect">
              <span class="collect-label">💷 Collect payments</span>
              <span class="collect-amount">{fmtMoney(s.invoices)}</span>
            </button>
          ) : mode === 'admin' ? (
            <div class="collect-auto"><span>🗃️ The office admin collects the payments every few seconds</span><strong>{fmtMoney(s.invoices)} waiting</strong></div>
          ) : (
            <div class="collect-auto"><span>🏦 Payments arrive the moment the visit is done</span></div>
          )}

          <Card title="Your team" icon="users" class="team-card" subtitle={team.length ? `${fmtNum(team.length)} ${team.length === 1 ? 'carer' : 'carers'}${s.prismaticHires.length ? ` · ${s.prismaticHires.length} prismatic` : ''}` : 'Take on your first carer from the shop'}>
            <div class="team-strip">
              {s.prismaticHires.map((n, i) => <span key={'p' + i} class="team-avatar prismatic" title={`Prismatic ${n}`}>{initialsOf(n)}</span>)}
              {team.slice(0, 18).map((n, i) => <span key={i} class="team-avatar" style={{ '--hue': (i * 47) % 360 }} title={n}>{initialsOf(n)}</span>)}
              {team.length > 18 ? <span class="team-more">+{fmtNum(team.length - 18)}</span> : null}
            </div>
            {s.log.length ? <ul class="game-log">{s.log.slice(0, 4).map((l, i) => <li key={i}><span>{l.emoji}</span> {l.text}</li>)}</ul> : null}
          </Card>

          <Card title="How you are rated" icon="star" class="rating-card" subtitle={rating.blurb}>
              <div class="rating-row"><span class="rating-emoji">{rating.emoji}</span><strong>{rating.name}</strong></div>
            {G.activeConditionals(s, metrics).length ? (
              <ul class="cond-list">
                {G.activeConditionals(s, metrics).map((c) => <li key={c.id} class={c.on ? 'on' : 'off'}>{c.on ? '✅' : '⚪'} {c.name} <span class="muted small">{c.on ? 'is paying now' : `pays ${c.label}`}</span></li>)}
              </ul>
            ) : null}
            {rating.next ? (
              <p class="muted small">Coordinators, supervisors, academies and the quality upgrades all count towards the next one. {fmtNum(rating.next.score - rating.score)} more to {rating.next.name}.</p>
            ) : <p class="muted small">There is nothing above this. Everybody knows it.</p>}
          </Card>
        </div>

        {/* ---------- Middle: what to buy ---------- */}
        <div class="game-mid">
          <Card title="Upgrades" icon="zap" padded={false} class="upgrade-card" subtitle={upgrades.length ? 'Best value first. Hover for what it does.' : 'Keep going – upgrades appear as you grow.'}>
            <div class="upgrade-row">
              {upgrades.map((u) => (
                <button key={u.id} type="button" class={`upgrade-tile ${u.affordable ? 'affordable' : ''} ${now - firstSeen.current.get(u.id) < 12000 ? 'new' : ''}`} onClick={() => onUpgrade(u)} disabled={!u.affordable}
                  title={`${u.name} – ${u.blurb}\n${u.question}\nYou will see: ${u.visual}\n${fmtPayback(u.payback, null) || noPaybackReason(u, u.kind === 'conditional' && u.test(s, metrics))}`} data-test={`upgrade-${u.id}`}>
                  <span class="upgrade-emoji">{u.emoji}</span>
                  <span class="upgrade-name">{u.name}</span>
                  <span class="upgrade-cost">{fmtMoney(u.cost, { short: true })}</span>
                  <span class="upgrade-pay">{Number.isFinite(u.payback) ? fmtSeconds(u.payback) : (u.kind === 'conditional' ? 'when it fits' : u.kind === 'discount' ? 'cheaper' : u.kind === 'click' || u.kind === 'clickpct' ? 'your visits' : 'saves a job')}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Shop" icon="briefcase" padded={false} subtitle="Whichever side is behind is worth more." actions={
            <div class="qty-picker" role="group" aria-label="How many to buy">
              {[1, 10, 'max'].map((q) => <button key={q} type="button" class={`qty ${buyQty === q ? 'active' : ''}`} onClick={() => setBuyQty(q)}>{q === 'max' ? 'Max' : `×${q}`}</button>)}
            </div>}>
            <ul class="building-list">
              {shop.map((b) => (
                <li key={b.id}>
                  <button type="button" class={`building-row ${b.affordable ? 'affordable' : ''} ${bestBuy && bestBuy.id === b.id ? 'best' : ''}`} onClick={() => onBuy(b)} disabled={!b.affordable}
                    title={`${b.name} – ${b.blurb}\nYou will see: ${b.visual}`} data-test={`buy-${b.id}`}>
                    <span class="building-emoji">{b.emoji}</span>
                    <span class="building-main">
                      <span class="building-name">
                        <span class={`side-dot side-${b.side}`} title={SIDES[b.side].hint}>{SIDES[b.side].emoji}</span>
                        {b.name}{b.count ? <span class="building-owned">{fmtNum(b.count)}</span> : null}
                        {bestBuy && bestBuy.id === b.id ? <span class="best-chip">Best value</span> : null}
                      </span>
                      <span class="building-sub muted">
                        {fmtPayback(b.payback, b.side) || 'earns nothing extra just now'}
                        {b.milestone ? <span class="milestone-pip"> · {fmtNum(b.milestone.remaining)} more and every one is {b.milestoneFactor}× better</span> : null}
                      </span>
                    </span>
                    <span class="building-buy"><span class="building-cost">{fmtMoney(b.cost)}</span><span class="muted small">+{fmtRate(b.gain)}</span></span>
                  </button>
                </li>
              ))}
              {nextLocked ? (
                <li class="building-locked">🔒 <strong>{nextLocked.name}</strong> unlocks when you hand over and reach {levelInfo(nextLocked.level).name.toLowerCase()} {levelInfo(nextLocked.level).emoji}</li>
              ) : null}
            </ul>
          </Card>
        </div>

        {/* ---------- Right: growing, legacy, badges ---------- */}
        <div class="game-right">
          <Tabs tabs={[{ id: 'grow', label: 'Grow', icon: 'trending-up' }, { id: 'stars', label: 'Stars', icon: 'star', count: G.starsAvailable(s) || undefined }, { id: 'badges', label: 'Badges', icon: 'heart', count: s.achievements.length }, { id: 'stats', label: 'Stats', icon: 'chart' }]} value={rightTab} onChange={setRightTab} variant="segmented" ariaLabel="Game panels" />

          {rightTab === 'grow' ? (
            <Card title={`Next: ${next.name} ${next.emoji}`} icon="trending-up" class={`expand-card ${G.canExpand(s) ? 'ready' : ''}`}>
              <p class="soft">Earn {fmtMoney(G.expandRequirement(s))} in this run to hand the patch over. You start again with a small round, keep every badge, and unlock bigger things to buy.</p>
              <div class="expand-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(1, progress * 100)}%` }} /></div>
              <div class="row-between"><span class="muted">{fmtMoney(s.runEarned)} earned this run</span><strong>{Math.floor(progress * 100)}%</strong></div>
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
            <Card title="Legacy Stars" icon="star" subtitle={`${s.starsEarned} earned · ${G.starsAvailable(s)} to spend · everything ${fmtPercent(G.starBonus(s.starsEarned))} forever`}>
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
            <Card title="Badges" icon="heart" subtitle={`${s.achievements.length} of ${G.achievementList(s).length} · each one adds 1% to everything`}>
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
                <div><dt>Work wanted</dt><dd>{fmtNum(metrics.work)}/s</dd></div>
                <div><dt>Care you can deliver</dt><dd>{fmtNum(metrics.team)}/s</dd></div>
                <div><dt>Earned this run</dt><dd>{fmtMoney(s.runEarned)}</dd></div>
                <div><dt>Earned ever</dt><dd>{fmtMoney(s.lifetimeEarned)}</dd></div>
                <div><dt>Per second</dt><dd>{fmtRate(rate)}</dd></div>
                <div><dt>Prismatic carers met</dt><dd>{s.prismaticsMet}</dd></div>
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
