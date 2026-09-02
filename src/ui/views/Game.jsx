// Care Empire – a light-hearted clicker game. Start with one carer and one street; end up caring for the galaxy.
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
import { BUILDINGS, TICKER, levelInfo } from '../../core/game/data.js';
import { fmtMoney, fmtNum, fmtRate, fmtSeconds, fmtPercent } from '../../core/game/format.js';
import { game, offlineReport, startGame, saveGame, scheduleSave, mutate, resetGame } from '../game/gameStore.js';

const TICK_MS = 100;

function initialsOf(name) {
  return String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
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
  const [pressed, setPressed] = useState(false);
  const [buyQty, setBuyQty] = useState(1);
  const [rightTab, setRightTab] = useState('grow');
  const areaRef = useRef(null);
  const lastTick = useRef(Date.now());
  const [tickerIndex, setTickerIndex] = useState(() => Math.floor(Math.random() * TICKER.length));
  const [confetti, setConfetti] = useState(0);
  const celebrate = () => setConfetti((c) => c + 1);
  useEffect(() => {
    const id = setInterval(() => setTickerIndex((i) => (i + 1 + Math.floor(Math.random() * 3)) % TICKER.length), 11000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    startGame();
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      mutate((s) => {
        if (dt > 30) {
          const away = G.applyOffline(s, now);
          if (away) offlineReport.value = away;
          s.lastSeen = now;
          return;
        }
        const events = G.tick(s, dt, now, Math.random, names);
        for (const e of events) {
          if (e.kind === 'achievement') { toast(`${e.achievement.emoji} Achievement: ${e.achievement.name} – +1% to everything`, { kind: 'success', duration: 5000 }); setConfetti((c) => c + 1); }
          if (e.kind === 'spawn' && e.spawn.type === 'prismatic') toast(`🌈 A prismatic ${e.spawn.name} has appeared – click them quickly!`, { kind: 'info', duration: 6000 });
        }
      });
      scheduleSave();
    }, TICK_MS);
    const onHide = () => saveGame();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => { clearInterval(id); saveGame(); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', onHide); };
  }, [names]);

  const s = game.value;
  if (!s) return <div class="page"><PageHeader title="Care Empire" /></div>;

  const now = Date.now();
  const rate = G.productionPerSecond(s, now);
  const perClick = G.clickValue(s, now);
  const mode = G.collectionMode(s);
  const level = levelInfo(s.level);
  const next = G.nextLevel(s);
  const starName = names[0] || 'Sam';
  const team = G.teamNames(s, names);
  const activeEffects = s.effects.filter((e) => e.until > now);

  function addFloater(text, x, y, cls = '') {
    const id = Math.random();
    setFloaters((f) => [...f.slice(-14), { id, text, x, y, cls }]);
    setTimeout(() => setFloaters((f) => f.filter((z) => z.id !== id)), 900);
  }

  function onClickCarer(e) {
    const earned = mutate((st) => G.click(st, Date.now()));
    const rect = areaRef.current?.getBoundingClientRect();
    const x = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 50;
    const y = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 40;
    addFloater(`+${fmtMoney(earned)}`, x, y);
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
    scheduleSave();
  }

  function onCollect() {
    const amount = mutate((st) => G.collect(st));
    if (amount > 0) addFloater(`+${fmtMoney(amount)}`, 50, 75, 'big');
    scheduleSave();
  }

  function onSpawnClick() {
    const r = mutate((st) => G.clickSpawn(st, Date.now(), Math.random));
    if (!r) return;
    addFloater(`${r.effect.emoji} ${r.effect.name}!`, 50, 30, 'big');
    if (r.type === 'prismatic') celebrate();
    toast(`${r.effect.emoji} ${r.message}${r.amount ? ` +${fmtMoney(r.amount)}` : ''}`, { kind: r.type === 'prismatic' ? 'success' : 'info', duration: 7000 });
    saveGame();
  }

  function onBuy(id) {
    const r = mutate((st) => G.buyBuilding(st, id, buyQty));
    if (r.bought) scheduleSave();
  }

  function onUpgrade(u) {
    if (mutate((st) => G.buyUpgrade(st, u.id))) { toast(`${u.emoji} ${u.name} – ${u.blurb}`, { kind: 'success' }); scheduleSave(); }
  }

  async function onExpand() {
    const gained = G.starsOnExpand(s);
    const ok = await confirm({
      title: `Expand to ${next.name.toLowerCase()} ${next.emoji}?`,
      message: `Your carers, buildings, upgrades and money start again from scratch – but you keep every achievement and gain ${gained} Legacy ${gained === 1 ? 'Star' : 'Stars'} (each one adds 2% to everything, forever). New buildings unlock at this level.`,
      confirmLabel: `Expand to ${next.name.toLowerCase()}`, icon: 'trending-up',
    });
    if (!ok) return;
    const r = mutate((st) => G.expand(st, Date.now()));
    if (r) { toast(`${levelInfo(r.level).emoji} Welcome to ${levelInfo(r.level).name.toLowerCase()}! +${r.gained} Legacy ${r.gained === 1 ? 'Star' : 'Stars'}`, { kind: 'success', duration: 7000 }); celebrate(); saveGame(); }
  }

  function onPerk(p) {
    if (mutate((st) => G.buyPerk(st, p.id))) { toast(`${p.emoji} ${p.name} – ${p.blurb}`, { kind: 'success' }); saveGame(); }
  }

  async function onReset() {
    const ok = await confirm({ title: 'Start the game over?', message: 'Everything in the game goes back to the very beginning, including Legacy Stars. Your real holiday records are not affected.', confirmLabel: 'Start over', danger: true, icon: 'refresh' });
    if (ok) { resetGame(); toast('Back to the beginning. Good luck!'); }
  }

  const away = offlineReport.value;
  useEffect(() => {
    if (!away) return;
    offlineReport.value = null;
    openModal(({ close }) => (
      <div class="confirm">
        <div class="confirm-icon"><Icon name="sun" size={28} /></div>
        <h2>Welcome back!</h2>
        <p class="soft">Your team kept going while you were away for {fmtSeconds(away.seconds)}: <strong>{fmtNum(Math.floor(away.visits))} visits</strong> worth <strong>{fmtMoney(away.earned)}</strong>{away.efficiency < 1 ? ' (at half speed – the Night shift perk makes it full speed)' : ''}.{away.needsCollect ? ' The payments are waiting to be collected.' : ''}</p>
        <div class="modal-actions"><Button variant="primary" onClick={() => close()}>Lovely</Button></div>
      </div>
    ), { size: 'sm', ariaLabel: 'Welcome back' });
  }, [away]);

  const upgrades = G.availableUpgrades(s).slice(0, 12);
  const progress = G.expandProgress(s);
  const nextLocked = G.nextLockedBuilding(s);

  return (
    <div class="page game-page">
      <PageHeader title={<span class="row">Care Empire <Badge tone="peach" size="md">{level.emoji} {level.name}</Badge></span>} lede={level.tagline}
        actions={<div class="game-funds"><div class="game-funds-main">{fmtMoney(s.funds)}</div><div class="muted">{fmtRate(rate)} · {fmtMoney(perClick)} per visit</div></div>} />

      <div class="game-grid">
        {/* ---------- Left: the clicker ---------- */}
        <div class="game-left">
          <div class={`play-area ${s.spawn ? 'has-spawn' : ''}`} ref={areaRef}>
            <div class="play-sky" data-level={Math.min(s.level, 9)} />
            {activeEffects.length ? (
              <div class="effects">
                {activeEffects.map((e) => <span key={e.id} class={`effect-chip effect-${e.id}`}>{e.emoji} {e.name} · {fmtSeconds((e.until - now) / 1000)}</span>)}
              </div>
            ) : null}
            <button type="button" class={`clicker ${pressed ? 'pressed' : ''} ${activeEffects.some((e) => e.clickMult) ? 'frenzy' : ''}`} onClick={onClickCarer} aria-label={`Do a visit with ${starName}`} data-test="clicker">
              <span class="clicker-initials">{initialsOf(starName)}</span>
              <span class="clicker-hat">{s.level >= 6 ? '👑' : s.level >= 3 ? '🎩' : '🧢'}</span>
            </button>
            <div class="clicker-caption"><strong>{starName}</strong> is on shift – click to do a visit</div>
            <div class="ticker" key={tickerIndex} aria-live="off">📰 {TICKER[tickerIndex].replace(/\{n\}/g, team[Math.floor((tickerIndex * 7) % Math.max(1, team.length))] || starName).replace(/\{co\}/g, settings.value?.companyName || 'Monteith')}</div>
            {confetti ? <Confetti key={confetti} /> : null}
            {floaters.map((f) => <span key={f.id} class={`floater ${f.cls}`} style={{ left: f.x + '%', top: f.y + '%' }}>{f.text}</span>)}
            {s.spawn ? (
              <button type="button" class={`spawn spawn-${s.spawn.type}`} style={{ left: s.spawn.x + '%', top: s.spawn.y + '%' }} onClick={onSpawnClick} data-test="spawn" aria-label={s.spawn.type === 'prismatic' ? `Prismatic ${s.spawn.name}` : 'Thank-you card'}>
                {s.spawn.type === 'prismatic' ? <><span class="spawn-ring" /><span class="spawn-initials">{initialsOf(s.spawn.name)}</span><span class="spawn-label">✨ Prismatic {s.spawn.name}</span></> : <><span class="spawn-card">💌</span><span class="spawn-label">Thank-you card</span></>}
                <span class="spawn-timer" style={{ width: Math.max(0, ((s.spawn.until - now) / 13000) * 100) + '%' }} />
              </button>
            ) : null}
          </div>

          {mode === 'manual' ? (
            <button type="button" class={`collect-btn ${s.invoices > 0 ? 'ready' : ''}`} onClick={onCollect} disabled={s.invoices <= 0} data-test="collect">
              <span class="collect-label">💷 Collect payments</span>
              <span class="collect-amount">{fmtMoney(s.invoices)}</span>
            </button>
          ) : mode === 'admin' ? (
            <div class="collect-auto"><span>🗂️ The office admin collects payments every few seconds</span><strong>{fmtMoney(s.invoices)} waiting</strong></div>
          ) : (
            <div class="collect-auto"><span>🏦 Payments arrive instantly by direct debit</span></div>
          )}

          <Card title="Your team" icon="users" class="team-card" subtitle={team.length ? `${fmtNum(team.length)} ${team.length === 1 ? 'carer' : 'carers'}${s.prismaticHires.length ? ` · ${s.prismaticHires.length} prismatic` : ''}` : 'Hire your first carer from the shop'}>
            <div class="team-strip">
              {s.prismaticHires.map((n, i) => <span key={'p' + i} class="team-avatar prismatic" title={`Prismatic ${n}`}>{initialsOf(n)}</span>)}
              {team.slice(0, 18).map((n, i) => <span key={i} class="team-avatar" style={{ '--hue': (i * 47) % 360 }} title={n}>{initialsOf(n)}</span>)}
              {team.length > 18 ? <span class="team-more">+{fmtNum(team.length - 18)}</span> : null}
            </div>
            {s.log.length ? <ul class="game-log">{s.log.slice(0, 4).map((l, i) => <li key={i}><span>{l.emoji}</span> {l.text}</li>)}</ul> : null}
          </Card>
        </div>

        {/* ---------- Middle: the shop ---------- */}
        <div class="game-mid">
          <Card title="Upgrades" icon="zap" padded={false} class="upgrade-card" subtitle={upgrades.length ? 'Hover for details. Click to buy.' : 'Keep going – upgrades appear as you grow.'}>
            <div class="upgrade-row">
              {upgrades.map((u) => (
                <button key={u.id} type="button" class={`upgrade-tile ${s.funds >= u.cost ? 'affordable' : ''}`} onClick={() => onUpgrade(u)} disabled={s.funds < u.cost} title={`${u.name} – ${u.blurb} (${fmtMoney(u.cost)})`} data-test={`upgrade-${u.id}`}>
                  <span class="upgrade-emoji">{u.emoji}</span>
                  <span class="upgrade-cost">{fmtNum(u.cost, { short: true })}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Shop" icon="briefcase" padded={false} actions={
            <div class="qty-picker" role="group" aria-label="How many to buy">
              {[1, 10, 'max'].map((q) => <button key={q} type="button" class={`qty ${buyQty === q ? 'active' : ''}`} onClick={() => setBuyQty(q)}>{q === 'max' ? 'Max' : `×${q}`}</button>)}
            </div>}>
            <ul class="building-list">
              {G.unlockedBuildings(s).map((b) => {
                const owned = s.buildings[b.id] || 0;
                const qty = buyQty === 'max' ? Math.max(1, G.maxAffordable(s, b.id)) : buyQty;
                const cost = G.buildingCost(s, b.id, qty);
                const each = G.buildingRate(s, b.id) * G.visitValue(s) * G.globalMultiplier(s, now);
                const can = s.funds >= cost;
                return (
                  <li key={b.id}>
                    <button type="button" class={`building-row ${can ? 'affordable' : ''}`} onClick={() => onBuy(b.id)} disabled={!can} title={b.blurb} data-test={`buy-${b.id}`}>
                      <span class="building-emoji">{b.emoji}</span>
                      <span class="building-main">
                        <span class="building-name">{b.name}{owned ? <span class="building-owned">{fmtNum(owned)}</span> : null}</span>
                        <span class="building-sub muted">{fmtRate(each)} each{owned ? ` · ${fmtRate(each * owned)} total` : ''}</span>
                      </span>
                      <span class="building-buy"><span class="building-cost">{fmtMoney(cost)}</span><span class="muted small">buy {qty === 1 ? '1' : qty}</span></span>
                    </button>
                  </li>
                );
              })}
              {nextLocked ? (
                <li class="building-locked">🔒 <strong>{nextLocked.name}</strong> unlocks when you expand to {levelInfo(nextLocked.level).name.toLowerCase()} {levelInfo(nextLocked.level).emoji}</li>
              ) : null}
            </ul>
          </Card>
        </div>

        {/* ---------- Right: growth, legacy, achievements ---------- */}
        <div class="game-right">
          <Tabs tabs={[{ id: 'grow', label: 'Grow', icon: 'trending-up' }, { id: 'stars', label: 'Stars', icon: 'star', count: G.starsAvailable(s) || undefined }, { id: 'badges', label: 'Badges', icon: 'heart', count: s.achievements.length }, { id: 'stats', label: 'Stats', icon: 'chart' }]} value={rightTab} onChange={setRightTab} variant="segmented" ariaLabel="Game panels" />

          {rightTab === 'grow' ? (
            <Card title={`Next: ${next.name} ${next.emoji}`} icon="trending-up" class={`expand-card ${G.canExpand(s) ? 'ready' : ''}`}>
              <p class="soft">Earn {fmtMoney(next.threshold)} in this run to expand. Expanding starts the run again but keeps your Legacy Stars and unlocks bigger things to buy.</p>
              <div class="expand-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(1, progress * 100)}%` }} /></div>
              <div class="row-between"><span class="muted">{fmtMoney(s.runEarned)} earned this run</span><strong>{Math.floor(progress * 100)}%</strong></div>
              <Button variant="primary" full size="lg" icon="trending-up" onClick={onExpand} disabled={!G.canExpand(s)} class="mt" data-test="expand">
                {G.canExpand(s) ? `Expand to ${next.name.toLowerCase()} · +${G.starsOnExpand(s)} ⭐` : 'Keep growing…'}
              </Button>
              {s.level > 0 ? <p class="muted small mt">Level {s.level}: {level.name} {level.emoji}. Total earned ever: {fmtMoney(s.lifetimeEarned)}.</p> : null}
            </Card>
          ) : null}

          {rightTab === 'stars' ? (
            <Card title="Legacy Stars" icon="star" subtitle={`${s.starsEarned} earned · ${G.starsAvailable(s)} to spend · everything ${fmtPercent(1 + 0.02 * s.starsEarned)} forever`}>
              <ul class="perk-list">
                {G.perkList(s).map((p) => (
                  <li key={p.id} class={`perk ${p.owned ? 'owned' : p.affordable ? 'affordable' : ''}`}>
                    <span class="perk-emoji">{p.emoji}</span>
                    <span class="perk-main"><strong>{p.name}</strong><span class="muted">{p.blurb}</span></span>
                    {p.owned ? <Badge tone="sage" icon="check">Owned</Badge> : <Button size="sm" variant={p.affordable ? 'primary' : 'secondary'} disabled={!p.affordable} onClick={() => onPerk(p)}>{p.cost} ⭐</Button>}
                  </li>
                ))}
              </ul>
              <p class="muted small mt">Stars come from expanding: the more you have earned over all time, the more you get.</p>
            </Card>
          ) : null}

          {rightTab === 'badges' ? (
            <Card title="Achievements" icon="heart" subtitle={`${s.achievements.length} of ${G.achievementList(s).length} · each one adds 1% to everything`}>
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
