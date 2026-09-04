// The living world of Care Empire, drawn on a canvas: houses, carers walking to visits, cars,
// residents waving at the door, particles, day and night, weather, and scenery that grows with the
// business. Pure drawing – the game engine stays in src/core/game. createScene() returns handles
// the view calls each tick. All positions inside are "logical" pixels; the scene scales itself down
// on narrow screens so the same street fits on a phone.

import { BUILDINGS, UPGRADE_ICONS } from '../../core/game/data.js';

/** Things drawn on the horizon behind the street, biggest last. */
const HORIZON = ['council', 'office', 'academy', 'framework', 'discharge', 'group', 'world', 'orbit', 'starship'];
/** Things drawn on the doors themselves, one per door, in the order the doors run. */
const DOOR_MARKS = ['keysafe', 'package', 'directpay', 'chc', 'tech'];
/** People who walk the street besides the carers. */
const STREET_FOLK = ['coordinator', 'supervisor', 'nurse'];
/**
 * What the street shows for each thing you can buy. Kit upgrades change the look of the rung they
 * belong to; everything else pins its own icon on the office noticeboard. A unit test checks that
 * every upgrade in the game is covered by one of these two routes.
 */
export const MARKS = new Set(Object.keys(UPGRADE_ICONS));

const SIGN_COLOURS = { 'buyer-private': '#E5734A', 'buyer-council': '#4C7A4C', 'buyer-nhs': '#2A5EA8' };

const HOUSE_COLOURS = ['#FFD9C7', '#FCE7A6', '#CDE7D8', '#D6E4F7', '#EAD9F5', '#FFE0E6', '#E8EFC9', '#FFEBC2'];
const SKIN = ['#F6D2B6', '#E8B58E', '#C68C5B', '#8D5A3A', '#F1C9A5'];
const HAIR = ['#3B2A24', '#7A4A2A', '#C97D3B', '#D9C07A', '#1E1E28', '#8E8E8E'];
const CAR_COLOURS = ['#e5734a', '#5f9bd1', '#6fa582', '#e39a2e', '#9576b8'];
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const UI_FONT = '"Segoe UI", system-ui, sans-serif';
const TWO_PI = Math.PI * 2;
const MAX_AGENTS = 14;

function rand(a, b) { return a + Math.random() * (b - a); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(c1, c2, t) { const a = hexToRgb(c1), b = hexToRgb(c2); t = clamp(t, 0, 1); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; }
function hueColour(i) { return `hsl(${(i * 47) % 360} 60% 52%)`; }

/** Sky, ground and building style for each expansion level. */
export function theme(level) {
  if (level >= 9) return { day: ['#f6c9a8', '#e08a5a'], night: ['#2a0e12', '#6b2c2a'], ground: '#c9663c', road: '#8a4a30', kind: 'mars', space: true };
  if (level >= 8) return { day: ['#0b0b1a', '#3a3a55'], night: ['#05050c', '#2b2b40'], ground: '#b9b9c2', road: '#8c8c96', kind: 'moon', space: true };
  if (level >= 7) return { day: ['#0f1030', '#2a2c6a'], night: ['#05061a', '#1a1c4a'], ground: '#6f7bb8', road: '#4f579a', kind: 'orbit', space: true };
  if (level >= 6) return { day: ['#bfe3ff', '#eef8ff'], night: ['#1c2350', '#4a4f8a'], ground: '#9fd39a', road: '#7d8291', kind: 'world', space: false };
  if (level >= 4) return { day: ['#c8e6ff', '#fff4e8'], night: ['#232852', '#5b4f7d'], ground: '#a9d7a0', road: '#7d8291', kind: 'nation', space: false };
  if (level >= 2) return { day: ['#cfe8ff', '#fff3ea'], night: ['#26294f', '#6a4f7a'], ground: '#b5dca7', road: '#7d8291', kind: 'town', space: false };
  return { day: ['#d6ebff', '#fff6ee'], night: ['#2b2450', '#7a5077'], ground: '#bfe0a8', road: '#858a99', kind: 'village', space: false };
}

/**
 * Which part of the street each thing you can buy shows up in. A unit test checks that every
 * building in the game has an entry, so nothing can be added to the shop without a pixel.
 */
export const DRAWS = {
  carer: 'drawAgent', client: 'drawHouse', keysafe: 'drawDoorMark', package: 'drawDoorMark',
  car: 'drawCar', directpay: 'drawDoorMark', coordinator: 'drawFolk', council: 'drawHorizon',
  supervisor: 'drawFolk', discharge: 'drawHorizon', office: 'drawHorizon', framework: 'drawHorizon',
  academy: 'drawHorizon', chc: 'drawDoorMark', nurse: 'drawFolk', group: 'drawHorizon',
  tech: 'drawDoorMark', world: 'drawHorizon', orbit: 'drawHorizon', starship: 'drawHorizon',
};

export function createScene(canvas, { onCoin } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 820, H = 380, k = 1, dpr = 1; // W, H are logical; k scales logical → CSS pixels
  const world = {
    level: 0, homes: 1, cooldowns: {}, houses: [], agents: [], cars: [], clouds: [], particles: [], coins: [], birds: [], lamps: [],
    prismatic: null, card: null, buildings: {}, effects: [], mode: 'manual', invoices: 0, teamSize: 0,
    names: [], starName: 'Sam', t: 0, now: Date.now(), lastFrame: 0, synced: false,
    counts: {}, tiers: {}, owned: new Set(), rating: 0, sign: '#E5734A', coinSize: 6, folk: [], badges: [],
    shake: 0, flashUntil: 0, expandFlash: 0, rocket: null, satelliteAngle: 0, rain: 0, rainCooldown: rand(60, 120),
  };
  let raf = 0;

  const pavementY = () => H * 0.70;
  const roadY = () => H * 0.82;
  const officeX = () => 62;
  const hudTarget = () => ({ x: 74 / k, y: 30 / k }); // where coins fly: under the funds display
  const th = () => theme(world.level);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(240, rect.width), cssH = Math.max(180, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    k = clamp(Math.min(cssW / 820, cssH / 300), 0.8, 1.35); // fewer, bigger houses on a phone so the kit on the doors can be seen
    W = cssW / k; H = cssH / k;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    layoutHouses();
  }

  function layoutHouses() {
    const maxByWidth = Math.max(3, Math.floor((W - 180) / 58));
    const count = clamp(Math.min(world.homes, maxByWidth), 1, 9);
    const left = 135, right = W - 26;
    const gap = (right - left) / count;
    const w = Math.min(56, gap * 0.82);
    const old = world.houses;
    world.houses = Array.from({ length: count }, (_, i) => ({
      x: left + gap * i + gap / 2, w, colour: HOUSE_COLOURS[(i + world.level) % HOUSE_COLOURS.length], roof: i % 2 ? '#c96b4d' : '#8b6b5a', tall: i % 3 === 1,
      glow: old[i] ? old[i].glow : 0, pop: old[i] ? old[i].pop : (world.synced ? 0 : 1), busy: old[i] ? old[i].busy : -1, shake: 0,
    }));
    if (world.synced && count > old.length) { const h = world.houses[count - 1]; burst(h.x, pavementY() - 40, 'sparkle', 10); floatText('New client! 🏠', h.x, pavementY() - 70); }
    world.lamps = count > 1 ? world.houses.slice(0, -1).map((h) => h.x + gap / 2) : [W * 0.55];
    if (!world.clouds.length) world.clouds = Array.from({ length: 5 }, () => ({ x: rand(0, W), y: rand(14, H * 0.28), w: rand(50, 110), speed: rand(4, 10) }));
    for (const a of world.agents) { if (a.house >= count) { a.house = -1; a.state = 'idle'; a.timer = 0.2; } else if (a.house >= 0 && a.state === 'walk') a.targetX = world.houses[a.house].x; }
  }

  function makeAgent(i, name) {
    return { id: i, name, colour: hueColour(i), skin: SKIN[i % SKIN.length], hair: HAIR[(i * 5) % HAIR.length], x: officeX() + rand(-12, 12), targetX: officeX(), state: 'idle', timer: rand(0.2, 2), speed: rand(34, 48), dir: 1, phase: rand(0, TWO_PI), house: -1, pop: 0, dash: 0, waiting: false };
  }

  /** Keep the scene in step with the game state. Cheap; called every tick. */
  function sync(state, names, now) {
    world.now = now; world.names = names; world.starName = names[0] || 'Sam';
    world.cooldowns = state.cooldowns || {};
    const homes = Math.max(1, state.buildings.client || 0);
    if (world.homes !== homes) { world.homes = homes; layoutHouses(); }
    if (world.level !== state.level) {
      world.level = state.level; layoutHouses();
      for (const h of world.houses) h.pop = 0;
      for (const a of world.agents) { a.x = officeX() + rand(-12, 12); a.house = -1; a.state = 'idle'; a.timer = rand(0.1, 1.2); }
    }
    const carers = state.buildings.carer || 0;
    world.teamSize = carers;
    // One figure for you, then a carer for each door we can draw.
    const wanted = 1 + Math.min(carers, world.houses.length, MAX_AGENTS - 1);
    while (world.agents.length < wanted) {
      const i = world.agents.length;
      const a = makeAgent(i, i === 0 ? world.starName : (names[(i - 1) % Math.max(1, names.length)] || `Carer ${i}`));
      world.agents.push(a);
      if (world.synced && i > 0) { burst(a.x, pavementY() - 30, 'sparkle', 8); floatText('Hello! 👋', a.x, pavementY() - 52); }
    }
    while (world.agents.length > wanted) { const gone = world.agents.pop(); if (gone.house >= 0 && world.houses[gone.house]) world.houses[gone.house].busy = -1; }
    world.agents[0].name = world.starName;
    const cars = clamp(state.buildings.car || 0, 0, 5);
    while (world.cars.length < cars) {
      const c = { x: world.synced ? -60 : rand(0, W), dir: 1, speed: rand(45, 70), colour: CAR_COLOURS[world.cars.length % CAR_COLOURS.length], laneOffset: world.cars.length % 2 ? 8 : -4, honk: world.synced ? 1.2 : 0 };
      if (!world.synced && Math.random() < 0.5) c.dir = -1;
      world.cars.push(c);
    }
    while (world.cars.length > cars) world.cars.pop();
    world.buildings = state.buildings;
    world.counts = state.buildings;
    world.owned = new Set([...(state.upgrades || []), ...Object.values(state.branches || {})]);
    world.tiers = {};
    for (const b of BUILDINGS) {
      let n = 0;
      for (let i = 1; i <= 3; i++) if (world.owned.has(`${b.id}-t${i}`)) n = i;
      world.tiers[b.id] = n;
    }
    world.rating = ratingOf(state);
    for (const [id, colour] of Object.entries(SIGN_COLOURS)) if (world.owned.has(id)) world.sign = colour;
    world.coinSize = 6 + Math.min(6, Math.log10(1 + valueOf(state)) * 3);
    world.badges = [...world.owned].map((id) => UPGRADE_ICONS[id]).filter(Boolean).slice(0, 16);
    syncFolk();
    world.effects = state.effects.filter((e) => e.until > now);
    world.mode = state.upgrades.includes('direct-debit') ? 'instant' : state.upgrades.includes('admin') ? 'admin' : 'manual';
    world.invoices = state.invoices;
    if (state.spawn && state.spawn.type === 'prismatic') {
      if (!world.prismatic || world.prismatic.born !== state.spawn.born) world.prismatic = { born: state.spawn.born, until: state.spawn.until, name: state.spawn.name, x: -40, phase: 0 };
    } else world.prismatic = null;
    if (state.spawn && state.spawn.type === 'card') {
      if (!world.card || world.card.born !== state.spawn.born) world.card = { born: state.spawn.born, until: state.spawn.until, x: lerp(Math.min(300, W * 0.45), W - 70, state.spawn.x / 100), y: -30, targetY: H * 0.2 + (state.spawn.y / 100) * H * 0.2, phase: 0 };
    } else world.card = null;
    if ((state.buildings.starship || 0) > 0 && !world.rocket && Math.random() < 0.004) world.rocket = { x: -60, y: H * 0.35, t: 0 };
    world.synced = true;
  }

  /** How many quality points the service has, mirrored from the engine's rating rungs. */
  function ratingOf(state) {
    const w = { coordinator: 1, supervisor: 3, academy: 8, nurse: 12, office: 2 };
    let score = 0;
    for (const [id, weight] of Object.entries(w)) score += (state.buildings[id] || 0) * weight;
    for (const id of world.owned) if (String(id).startsWith('qual-')) score += 6;
    return score >= 2000 ? 3 : score >= 120 ? 2 : score >= 6 ? 1 : 0;
  }

  /** Roughly what a visit is worth, used only to draw bigger coins as you grow. */
  function valueOf(state) {
    let v = 1;
    for (const id of world.owned) if (String(id).startsWith('val-') || id === 'grow-rates') v *= 1.7;
    return v;
  }

  /** Coordinators, supervisors and nurses who walk the street alongside the carers. */
  function syncFolk() {
    const wanted = [];
    for (const id of STREET_FOLK) {
      const n = Math.min(2, world.counts[id] || 0);
      for (let i = 0; i < n; i++) wanted.push(id);
    }
    while (world.folk.length > wanted.length) world.folk.pop();
    while (world.folk.length < wanted.length) world.folk.push({ role: wanted[world.folk.length], x: rand(90, Math.max(120, W - 40)), dir: 1, phase: rand(0, TWO_PI), speed: rand(16, 26) });
    world.folk.forEach((f, i) => { f.role = wanted[i]; });
  }

  // ---------- Effects helpers ----------
  function burst(x, y, type, n = 6) {
    for (let i = 0; i < n; i++) world.particles.push({ x, y, vx: rand(-40, 40), vy: rand(-90, -30), life: rand(0.6, 1.1), age: 0, type, size: rand(8, 14) });
    trimParticles();
  }
  function floatText(text, x, y) { world.particles.push({ x, y, vx: 0, vy: -22, life: 1.6, age: 0, type: 'text', size: 12, text }); }
  function firework(x, y) {
    const hue = rand(0, 360);
    for (let i = 0; i < 28; i++) { const a = rand(0, TWO_PI), sp = rand(40, 140); world.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.7, 1.4), age: 0, type: 'spark', size: rand(2, 4), hue }); }
    world.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, age: 0, type: 'ring', size: 6 });
    trimParticles();
  }
  function trimParticles() { if (world.particles.length > 320) world.particles.splice(0, world.particles.length - 320); }
  function launchCoin(x, y) {
    world.coins.push({ sx: x, sy: y, t: 0, dur: rand(0.6, 0.9), arc: rand(40, 90) });
    if (world.coins.length > 60) world.coins.shift();
  }
  function nearestHouse(x) {
    let best = 0, dist = Infinity;
    world.houses.forEach((h, i) => { const d = Math.abs(h.x - x); if (d < dist) { dist = d; best = i; } });
    return best;
  }

  /** The player tapped the world at CSS pixel (x, y): the star carer dashes to the nearest house. */
  function houseAt(cssX) { return nearestHouse(cssX / k); }
  function houseCount() { return world.houses.length; }

  /** The player tapped a home that is still cooling down: a wobble and a word. */
  function refuse(index) {
    const h = world.houses[index]; if (!h) return;
    h.shake = 0.4;
    if (world.t - (h.refusedAt || -9) > 1.2) { h.refusedAt = world.t; floatText('Just visited – give them a minute', h.x, pavementY() - 80); }
  }

  function playerVisit(cssX, cssY, hearts = 3, index = -1) {
    const x = cssX / k, y = cssY / k;
    const a = world.agents[0];
    const hi = index >= 0 && world.houses[index] ? index : nearestHouse(x);
    const house = world.houses[hi];
    a.house = hi; a.targetX = house.x + rand(-10, 10); a.state = 'walk'; a.dash = 1;
    house.glow = 1;
    burst(house.x, pavementY() - 46, 'heart', hearts);
    launchCoin(house.x, pavementY() - 40);
    world.particles.push({ x, y, vx: 0, vy: 0, life: 0.4, age: 0, type: 'ring', size: 8 });
  }

  /** What did a click at CSS pixel (x, y) hit? 'prismatic' | 'card' | null */
  function hitTest(cssX, cssY) {
    const x = cssX / k, y = cssY / k;
    if (world.prismatic && Math.hypot(world.prismatic.x - x, pavementY() - 18 - y) < 36) return 'prismatic';
    if (world.card && Math.hypot(world.card.x - x, world.card.y - y) < 32) return 'card';
    return null;
  }

  /** Where the catchable thing is, in CSS pixels, for the overlay button. */
  function spawnPos() {
    if (world.prismatic) return { x: world.prismatic.x * k, y: (pavementY() - 20) * k, r: 36 * k, type: 'prismatic' };
    if (world.card) return { x: world.card.x * k, y: world.card.y * k, r: 32 * k, type: 'card' };
    return null;
  }

  function celebrate(kind) {
    if (kind === 'prismatic') {
      for (let i = 0; i < 40; i++) world.particles.push({ x: rand(0, W), y: rand(0, H * 0.6), vx: rand(-30, 30), vy: rand(-60, 20), life: rand(0.8, 1.6), age: 0, type: 'sparkle', size: rand(10, 18) });
      firework(W * 0.3, H * 0.25); firework(W * 0.7, H * 0.2);
      world.flashUntil = performance.now() + 220;
    }
    if (kind === 'card') { const c = world.card; burst(c ? c.x : W / 2, c ? c.y : H / 3, 'heart', 14); }
    if (kind === 'collect') { for (let i = 0; i < 14; i++) launchCoin(officeX() + rand(-20, 20), pavementY() - rand(0, 30)); }
    if (kind === 'achievement') { for (let i = 0; i < 3; i++) firework(rand(W * 0.15, W * 0.85), rand(H * 0.12, H * 0.4)); }
    if (kind === 'expand') {
      world.expandFlash = 1.6;
      for (let i = 0; i < 60; i++) world.particles.push({ x: rand(0, W), y: rand(H * 0.2, H * 0.7), vx: rand(-80, 80), vy: rand(-160, -40), life: rand(1, 2), age: 0, type: i % 2 ? 'sparkle' : 'heart', size: rand(10, 20) });
      for (let i = 0; i < 5; i++) firework(rand(W * 0.1, W * 0.9), rand(H * 0.1, H * 0.45));
    }
    if (kind === 'buy') burst(officeX(), pavementY() - 40, 'sparkle', 6);
    if (kind === 'upgrade') { burst(officeX(), pavementY() - 60, 'sparkle', 16); floatText('Upgraded! ⚡', officeX() + 10, pavementY() - 80); }
  }

  // ---------- Simulation ----------
  function step(dt, now) {
    world.t += dt;
    const rush = world.effects.some((e) => e.id === 'rainbow-rush') ? 2.6 : world.effects.some((e) => e.id === 'double-time') ? 1.5 : 1;
    for (const a of world.agents) {
      a.pop = Math.min(1, a.pop + dt * 3);
      a.dash = Math.max(0, a.dash - dt * 0.7);
      if (a.state === 'idle') {
        a.timer -= dt;
        if (a.timer <= 0) {
          const free = world.houses.map((h, i) => (h.busy < 0 ? i : -1)).filter((i) => i >= 0);
          if (free.length) { a.house = free[Math.floor(Math.random() * free.length)]; world.houses[a.house].busy = a.id; a.targetX = world.houses[a.house].x + rand(-14, 14); a.state = 'walk'; }
          else a.timer = rand(0.3, 0.8);
        }
      } else if (a.state === 'walk') {
        const dx = a.targetX - a.x; a.dir = dx >= 0 ? 1 : -1;
        const stepX = a.speed * rush * dt * (a.id === 0 ? 1.15 + a.dash * 1.8 : 1);
        if (Math.abs(dx) <= stepX) {
          const quick = world.owned.has('syn-keysafe-carer') ? 0.6 : 1; // keys in the box: straight in
          a.x = a.targetX; a.state = 'visit'; a.timer = a.house >= 0 ? rand(1.2, 2.2) * quick / rush : rand(0.4, 1.5);
          if (a.house >= 0) {
            world.houses[a.house].glow = 1;
            burst(a.x, pavementY() - 34, 'heart', 2);
            if (world.owned.has('ecm')) world.houses[a.house].tick = 1.1; // calls log themselves in
          }
        } else a.x += Math.sign(dx) * stepX;
        a.phase += dt * 9 * rush * (1 + a.dash);
      } else if (a.state === 'visit') {
        a.timer -= dt;
        if (a.timer <= 0) {
          if (a.house >= 0) { launchCoin(a.x, pavementY() - 34); if (world.houses[a.house]) world.houses[a.house].busy = -1; }
          a.house = -1; a.targetX = officeX() + rand(-12, 12); a.state = 'walk';
        }
      }
    }
    for (const f of world.folk) {
      f.x += f.dir * f.speed * dt; f.phase += dt * 6;
      if (f.x > W - 30) f.dir = -1; if (f.x < 80) f.dir = 1;
    }
    for (const h of world.houses) { h.glow = Math.max(0, h.glow - dt * 0.8); h.pop = Math.min(1, h.pop + dt * 1.8); h.shake = Math.max(0, h.shake - dt); h.tick = Math.max(0, (h.tick || 0) - dt); }
    for (const c of world.cars) { c.x += c.dir * c.speed * rush * dt; c.honk = Math.max(0, c.honk - dt); if (c.x > W + 60) c.x = -60; if (c.x < -60) c.x = W + 60; }
    for (const c of world.clouds) { c.x += c.speed * dt; if (c.x - c.w > W) c.x = -c.w; }
    for (const p of world.particles) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'spark') { p.vy += 70 * dt; p.vx *= 1 - dt; }
      else if (p.type === 'sparkle') p.vy += 10 * dt;
      else if (p.type === 'heart') p.vy -= 20 * dt;
    }
    world.particles = world.particles.filter((p) => p.age < p.life);
    for (const c of world.coins) c.t += dt / c.dur;
    const arrived = world.coins.filter((c) => c.t >= 1).length;
    world.coins = world.coins.filter((c) => c.t < 1);
    if (arrived && onCoin) onCoin(arrived);
    if (world.prismatic) {
      const p = world.prismatic; const life = Math.max(1, (p.until - p.born) / 1000); const age = (now - p.born) / 1000;
      p.x = lerp(-40, W + 40, clamp(age / life, 0, 1)); p.phase += dt * 10;
      if (Math.random() < 0.5) world.particles.push({ x: p.x + rand(-10, 10), y: pavementY() - rand(0, 34), vx: rand(-10, 10), vy: rand(-30, -5), life: rand(0.4, 0.9), age: 0, type: 'sparkle', size: rand(6, 12) });
    }
    if (world.card) { const c = world.card; c.phase += dt; if (c.y < c.targetY) c.y = Math.min(c.targetY, c.y + 70 * dt); }
    if (world.rocket) { world.rocket.t += dt; world.rocket.x += 90 * dt; world.rocket.y -= 12 * dt; if (world.rocket.x > W + 80) world.rocket = null; }
    world.satelliteAngle += dt * 0.25;
    world.shake = world.effects.some((e) => e.id === 'click-frenzy') ? 2 : 0;
    world.expandFlash = Math.max(0, world.expandFlash - dt);
    if (Math.random() < 0.004 && world.birds.length < 3 && !th().space) world.birds.push({ x: -20, y: rand(20, H * 0.3), t: 0 });
    for (const b of world.birds) { b.x += 40 * dt; b.t += dt; }
    world.birds = world.birds.filter((b) => b.x < W + 20);
    if (world.rain > 0) world.rain -= dt;
    else { world.rainCooldown -= dt; if (world.rainCooldown <= 0) { world.rainCooldown = rand(100, 220); if (Math.random() < 0.6) world.rain = rand(12, 25); } }
    const night = dayFactor() < 0.45;
    if (night && !th().space && Math.random() < 0.06) { const h = world.houses[Math.floor(Math.random() * world.houses.length)]; world.particles.push({ x: h.x + h.w * 0.3, y: pavementY() - (h.tall ? 78 : 66), vx: rand(-4, 4), vy: -14, life: 1.6, age: 0, type: 'smoke', size: 5 }); }
  }

  // ---------- Drawing ----------
  function dayFactor() { const c = (world.t / 240) % 1; return 0.5 + 0.5 * Math.cos(c * TWO_PI); } // 1 = noon, 0 = midnight, 4-minute day

  function drawSky(t, day) {
    const top = mix(t.night[0], t.day[0], day), bottom = mix(t.night[1], t.day[1], day);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (day < 0.6 || t.space) {
      const alpha = t.space ? 0.9 : (0.6 - day);
      for (let i = 0; i < 46; i++) { const x = (i * 97) % W, y = ((i * 53) % Math.floor(H * 0.55)); ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(world.t * 2 + i)); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2, 2); }
      ctx.globalAlpha = 1;
    }
    const cx = W * 0.82, cy = H * 0.18;
    if (t.space) {
      const planet = t.kind === 'moon' ? ['#5fa0e0', '#3c7fc0'] : t.kind === 'mars' ? ['#e9c8a0', '#c9a26c'] : ['#7fc0ff', '#2f7fd0'];
      const pg = ctx.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 34); pg.addColorStop(0, planet[0]); pg.addColorStop(1, planet[1]);
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TWO_PI); ctx.fill();
      if (t.kind !== 'mars') { ctx.fillStyle = 'rgba(120,200,120,.7)'; ctx.beginPath(); ctx.ellipse(cx - 8, cy - 4, 14, 9, 0.4, 0, TWO_PI); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + 12, cy + 10, 9, 6, -0.3, 0, TWO_PI); ctx.fill(); }
    } else if (day > 0.35) {
      const sy = cy + (1 - day) * 40;
      ctx.fillStyle = `rgba(255, 240, 180, ${0.25 * day})`; ctx.beginPath(); ctx.arc(cx, sy, 34, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = `rgba(255, 214, 102, ${day})`; ctx.beginPath(); ctx.arc(cx, sy, 22, 0, TWO_PI); ctx.fill();
    } else {
      ctx.fillStyle = `rgba(245, 240, 220, ${1 - day})`; ctx.beginPath(); ctx.arc(cx - 40, cy, 16, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = mix(t.night[0], t.day[0], day); ctx.beginPath(); ctx.arc(cx - 34, cy - 4, 13, 0, TWO_PI); ctx.fill();
    }
    ctx.textAlign = 'center';
    if ((world.counts.orbit || 0) > 0) { const sx = W * 0.5 + Math.cos(world.satelliteAngle) * W * 0.4, sy = H * 0.12 + Math.sin(world.satelliteAngle * 2) * 8; ctx.font = `20px ${EMOJI_FONT}`; ctx.fillText('🛰️', sx, sy); }
    if (world.rocket) { ctx.font = `26px ${EMOJI_FONT}`; ctx.save(); ctx.translate(world.rocket.x, world.rocket.y); ctx.rotate(0.6); ctx.fillText('🚀', 0, 0); ctx.restore(); }
    for (const b of world.birds) { ctx.strokeStyle = 'rgba(60,50,60,.6)'; ctx.lineWidth = 1.5; const f = Math.sin(b.t * 12) * 3; ctx.beginPath(); ctx.moveTo(b.x - 6, b.y); ctx.quadraticCurveTo(b.x - 3, b.y - 3 - f, b.x, b.y); ctx.quadraticCurveTo(b.x + 3, b.y - 3 - f, b.x + 6, b.y); ctx.stroke(); }
  }

  function drawClouds(day, t) {
    if (t.space) return;
    ctx.fillStyle = world.rain > 0 ? `rgba(150,160,180,${0.6 + 0.3 * day})` : `rgba(255,255,255,${0.55 + 0.35 * day})`;
    for (const c of world.clouds) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w / 2, c.w / 5, 0, 0, TWO_PI); ctx.ellipse(c.x - c.w / 4, c.y + 4, c.w / 3.2, c.w / 6, 0, 0, TWO_PI); ctx.ellipse(c.x + c.w / 4, c.y + 3, c.w / 3.4, c.w / 6.5, 0, 0, TWO_PI); ctx.fill(); }
  }

  function drawBackdrop(t, day) {
    const gy = pavementY() + 10;
    if (t.kind === 'village' || t.kind === 'nation' || t.kind === 'world') {
      ctx.fillStyle = mix('#2f4a3a', '#9cc98c', day); ctx.beginPath(); ctx.moveTo(0, gy);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, gy - 40 - Math.sin(x / 90) * 22 - Math.cos(x / 37) * 8);
      ctx.lineTo(W, gy); ctx.fill();
      ctx.fillStyle = mix('#3a5a46', '#b7dba3', day); ctx.beginPath(); ctx.moveTo(0, gy);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, gy - 22 - Math.sin(x / 60 + 2) * 12);
      ctx.lineTo(W, gy); ctx.fill();
    }
    if (t.kind === 'town' || t.kind === 'nation' || t.kind === 'world') {
      for (let i = 0; i < 14; i++) {
        const bx = (i * 73) % W, bw = 26 + (i % 3) * 10, bh = 40 + ((i * 37) % 60);
        ctx.fillStyle = mix('#2a2d45', '#c7cfe0', day); ctx.fillRect(bx, gy - 12 - bh, bw, bh + 12);
        ctx.fillStyle = `rgba(255, 230, 150, ${0.8 - day * 0.7})`;
        for (let wy = gy - bh; wy < gy - 16; wy += 12) for (let wx = bx + 5; wx < bx + bw - 6; wx += 9) if ((wx * 7 + wy) % 5 < 3) ctx.fillRect(wx, wy, 4, 5);
      }
    }
    if (t.kind === 'orbit') { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, gy - 20 - i * 30); ctx.lineTo(W, gy - 26 - i * 30); ctx.stroke(); } }
    if (t.kind === 'world') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, gy + 900, 960, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
    ctx.fillStyle = mix('#2c3a2a', t.ground, day * 0.8 + 0.2); ctx.fillRect(0, gy, W, H - gy);
    if (t.kind === 'moon' || t.kind === 'mars') { ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse((i * 131) % W, gy + 14 + (i * 17) % 40, 14 + (i % 3) * 8, 5 + (i % 2) * 3, 0, 0, TWO_PI); ctx.fill(); } }
    const ry = roadY(); ctx.fillStyle = mix('#3a3a44', t.road, day * 0.7 + 0.3); ctx.fillRect(0, ry - 12, W, 30);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([14, 12]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ry + 3); ctx.lineTo(W, ry + 3); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawRain(day) {
    if (world.rain <= 0 || th().space) return;
    ctx.fillStyle = `rgba(90,100,130,${0.16 * Math.min(1, world.rain / 3)})`; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(190,210,240,${0.5 + 0.2 * day})`; ctx.lineWidth = 1; ctx.beginPath();
    const off = (world.t * 420) % H;
    for (let i = 0; i < 100; i++) { const x = (i * 131 + i * i * 7) % W; const y = (i * 71 + off) % H; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); }
    ctx.stroke();
  }

  function drawLamps(day) {
    if (th().space) return;
    const y = pavementY() + 2, night = 1 - day;
    for (const x of world.lamps) {
      ctx.strokeStyle = '#4a4a55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 40); ctx.stroke();
      ctx.fillStyle = night > 0.45 ? '#ffe9a8' : '#c8c8d0'; ctx.beginPath(); ctx.roundRect(x - 4, y - 46, 8, 7, 2); ctx.fill();
      if (night > 0.45) { const g = ctx.createRadialGradient(x, y - 42, 2, x, y - 30, 34); g.addColorStop(0, `rgba(255,230,150,${(night - 0.45) * 0.7})`); g.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 30, 34, 0, TWO_PI); ctx.fill(); }
    }
  }

  function drawOffice(day) {
    const x = officeX(), base = pavementY() + 4;
    ctx.fillStyle = mix('#8a5a4a', '#FFB88C', day); ctx.fillRect(x - 36, base - 66, 72, 66);
    ctx.fillStyle = `rgba(255, 236, 170, ${1 - day * 0.5})`; ctx.fillRect(x - 28, base - 38, 14, 12); ctx.fillRect(x + 14, base - 38, 14, 12);
    ctx.fillStyle = '#6b3a2a'; ctx.fillRect(x - 10, base - 20, 20, 20);
    if (world.mode === 'manual' && world.invoices > 0) {
      const n = clamp(Math.ceil(Math.log10(world.invoices + 1) * 3), 1, 12);
      for (let i = 0; i < n; i++) { ctx.fillStyle = '#F5C542'; ctx.beginPath(); ctx.ellipse(x + 30 + (i % 4) * 7, base - 3 - Math.floor(i / 4) * 5, 5, 2.5, 0, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#c99a1e'; ctx.stroke(); }
      const bob = Math.sin(world.t * 4) * 3;
      ctx.font = `700 11px ${UI_FONT}`; ctx.fillStyle = '#fff'; const label = '💷 Payments to collect'; const tw = ctx.measureText(label).width + 14;
      ctx.beginPath(); ctx.roundRect(x + 12 - tw / 2, base - 100 + bob, tw, 18, 9); ctx.fill(); ctx.fillStyle = '#2f6b45'; ctx.fillText(label, x + 12, base - 87 + bob);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 8, base - 82 + bob); ctx.lineTo(x + 16, base - 82 + bob); ctx.lineTo(x + 12, base - 76 + bob); ctx.fill();
    }
    drawOfficeExtras(day, x, base);
  }

  /** Everything the office wears: the sign, the rating, the star board and the noticeboard. */
  function drawOfficeExtras(day, x, base) {
    // the sign over the door takes the colour of whoever you work for
    ctx.fillStyle = world.sign; ctx.fillRect(x - 40, base - 72, 80, 10);
    ctx.fillStyle = '#fff'; ctx.font = `700 11px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('MONTEITH', x, base - 63.5);
    // the rating sticker in the window
    if (world.rating > 0) {
      const stick = ['', '#4C7A4C', '#E5A93B', '#B06BFF'][world.rating];
      const glow = world.owned.has('cond-wellled') ? 0.35 + 0.25 * Math.sin(world.t * 3) : 0;
      if (glow) { ctx.fillStyle = `rgba(255,220,120,${glow})`; ctx.beginPath(); ctx.arc(x + 21, base - 32, 14, 0, TWO_PI); ctx.fill(); }
      ctx.fillStyle = stick; ctx.beginPath(); ctx.arc(x + 21, base - 32, 7, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `700 8px ${UI_FONT}`; ctx.fillText(['', 'G', 'O', 'O'][world.rating], x + 21, base - 29);
    }
    // a star board outside once families are leaving reviews
    if (world.owned.has('qual-reviews')) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x + 44, base - 30, 26, 16, 3); ctx.fill();
      ctx.font = `9px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('⭐⭐', x + 57, base - 19);
    }
    // a certificate when everyone has done the Care Certificate
    if (world.owned.has('qual-cert')) { ctx.fillStyle = '#fdf6e3'; ctx.fillRect(x - 26, base - 36, 10, 8); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 1; ctx.strokeRect(x - 26, base - 36, 10, 8); }
    // bunting once you started marking the tenth of everything
    if (world.owned.has('mile-1')) {
      const n = world.owned.has('mile-2') ? 10 : 6;
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 40, base - 86); ctx.quadraticCurveTo(x, base - 78, x + 40, base - 86); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), fx = lerp(x - 40, x + 40, t), fy = base - 86 + Math.sin(Math.PI * t) * 7;
        ctx.fillStyle = `hsl(${(i * 57) % 360} 75% 62%)`;
        ctx.beginPath(); ctx.moveTo(fx - 3, fy); ctx.lineTo(fx + 3, fy); ctx.lineTo(fx, fy + 6); ctx.closePath(); ctx.fill();
      }
    }
    // a hiring board, a box of key safes, a minibus – the things you have paid for
    if (world.owned.has('disc-recruit')) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - 26, base - 18, 20, 14, 2); ctx.fill(); ctx.fillStyle = '#3a2a24'; ctx.font = `600 6px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('HIRING', x - 16, base - 9); }
    if (world.owned.has('disc-safes')) { ctx.fillStyle = '#c8a06a'; ctx.fillRect(x + 34, base - 10, 14, 10); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; ctx.strokeRect(x + 34, base - 10, 14, 10); }
    if (world.owned.has('syn-academy-team')) { const bx = x + 78; ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.roundRect(bx, base - 20, 30, 14, 3); ctx.fill(); ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(bx + 8, base - 5, 3.5, 0, TWO_PI); ctx.arc(bx + 22, base - 5, 3.5, 0, TWO_PI); ctx.fill(); ctx.fillStyle = '#3a2a24'; ctx.font = `600 6px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('TRAINING', bx + 15, base - 11); }
    // the office noticeboard: one small icon for every upgrade you have bought
    if (world.badges.length) {
      const cols = 4, bx = x - 33, by = base - 50;
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      const rows = Math.ceil(world.badges.length / cols);
      ctx.beginPath(); ctx.roundRect(bx - 3, by - 8, cols * 9 + 6, rows * 9 + 4, 3); ctx.fill();
      ctx.font = `7px ${EMOJI_FONT}`; ctx.textAlign = 'center';
      world.badges.forEach((e, i) => ctx.fillText(e, bx + (i % cols) * 9 + 3, by + Math.floor(i / cols) * 9));
    }
    // one window that never goes dark, once somebody carries the on-call phone
    if (world.owned.has('oncall')) { ctx.fillStyle = `rgba(255,236,170,${0.55 + 0.35 * Math.sin(world.t * 1.3)})`; ctx.fillRect(x + 14, base - 38, 14, 12); }
    drawHorizon(day);
  }

  /**
   * The kit on the doors. Each thing you own appears on that many doors, so buying a key safe
   * really does put a key safe on a door you can point at.
   */
  function drawDoorMark(h, i, day) {
    const space = th().space;
    const y = pavementY() + 2, hh = space ? h.w / 2 + 10 : (h.tall ? 58 : 46), w = h.w;
    if ((world.counts.keysafe || 0) > i) {
      const kx = h.x + 11, ky = y - 26;
      ctx.fillStyle = world.tiers.keysafe >= 2 ? '#8a8f99' : '#6b7078';
      ctx.beginPath(); ctx.roundRect(kx, ky, 7, 9, 2); ctx.fill();
      ctx.fillStyle = world.tiers.keysafe >= 1 ? '#ffd76a' : '#c9ced6'; ctx.fillRect(kx + 1.5, ky + 2, 4, 2.5);
    }
    if ((world.counts.package || 0) > i) {
      ctx.fillStyle = '#e8ddc8'; ctx.beginPath(); ctx.roundRect(h.x - 17, y - 8, 8, 10, 1); ctx.fill();
      ctx.fillStyle = '#c26a4a'; ctx.fillRect(h.x - 17, y - 8, 8, 2.5);
    }
    if ((world.counts.directpay || 0) > i) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(h.x - w * 0.36, y - hh + 12, 8, 7, 1); ctx.fill();
      ctx.strokeStyle = '#5a6cae'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(h.x - w * 0.34, y - hh + 17); ctx.lineTo(h.x - w * 0.30, y - hh + 15); ctx.stroke();
    }
    if ((world.counts.chc || 0) > i) {
      ctx.strokeStyle = '#2A5EA8'; ctx.lineWidth = 2.5; ctx.strokeRect(h.x - 8, y - 22, 16, 22);
    }
    if ((world.counts.tech || 0) > i) {
      const on = 0.4 + 0.6 * Math.abs(Math.sin(world.t * 1.6 + i));
      ctx.fillStyle = `rgba(90,200,255,${on})`; ctx.beginPath(); ctx.arc(h.x - 13, y - 27, 2.6, 0, TWO_PI); ctx.fill();
    }
    if (world.owned.has('syn-package-client')) {
      ctx.fillStyle = '#d9c9a8'; ctx.beginPath(); ctx.roundRect(h.x + 8, y - 6, 7, 6, 1); ctx.fill();
    }
    if (world.owned.has('known-dementia')) {
      ctx.fillStyle = '#fff'; ctx.fillRect(h.x + w * 0.16, y - hh + 12, 7, 6);
      ctx.fillStyle = '#8b6b5a'; ctx.fillRect(h.x + w * 0.17, y - hh + 13, 5, 4);
    }
    if (h.tick > 0) {
      ctx.strokeStyle = `rgba(60,170,90,${Math.min(1, h.tick)})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const ty = y - hh - 14;
      ctx.beginPath(); ctx.moveTo(h.x - 5, ty); ctx.lineTo(h.x - 1, ty + 4); ctx.lineTo(h.x + 6, ty - 5); ctx.stroke();
    }
  }

  /** Coordinators, supervisors and nurses, so the people you pay for are people you can see. */
  function drawFolk(f) {
    const y = pavementY() - 2, swing = Math.sin(f.phase) * 4;
    const kit = { coordinator: { body: '#6a5acd', hat: '📋' }, supervisor: { body: '#e8b52a', hat: '🦺' }, nurse: { body: '#2A5EA8', hat: '🩺' } }[f.role] || { body: '#888' };
    ctx.save(); ctx.translate(f.x, y); ctx.scale(f.dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, 2, 9, 3, 0, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-3 + swing, 0); ctx.moveTo(3, -9); ctx.lineTo(3 - swing, 0); ctx.stroke();
    ctx.fillStyle = kit.body; ctx.beginPath(); ctx.roundRect(-7, -25, 14, 18, 5); ctx.fill();
    if (f.role === 'supervisor') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-7, -19, 14, 3); }
    ctx.fillStyle = '#F1C9A5'; ctx.beginPath(); ctx.arc(0, -31, 6, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#3B2A24'; ctx.beginPath(); ctx.arc(0, -33, 6, Math.PI, TWO_PI); ctx.fill();
    ctx.restore();
    if (kit.hat) { ctx.font = `11px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.fillText(kit.hat, f.x + 9 * f.dir, y - 26); }
  }

  /** The big things you own, on the horizon behind the street, with how many of each. */
  function drawHorizon(day) {
    const owned = HORIZON.filter((id) => (world.counts[id] || 0) > 0);
    if (!owned.length) return;
    const shown = owned.slice(-9);
    const gy = pavementY() - 96;          // a skyline band well above the doors
    const left = 118, right = W - 20;
    const gap = Math.min(46, (right - left) / Math.max(1, shown.length));
    shown.forEach((id, i) => {
      const b = BUILDINGS.find((x) => x.id === id);
      const x = right - i * gap;
      if (x < left) return;
      const n = world.counts[id] || 0;
      const bob = Math.sin(world.t * 0.6 + i) * 1.5;
      ctx.font = `22px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 0.9; ctx.fillText(b.emoji, x, gy + bob); ctx.globalAlpha = 1;
      ctx.font = `700 9px ${UI_FONT}`;
      ctx.fillStyle = day > 0.5 ? 'rgba(58,42,36,.75)' : 'rgba(255,255,255,.85)';
      ctx.fillText(n > 999 ? `${Math.round(n / 1000)}k` : String(n), x, gy + bob + 10);
      const tier = world.tiers[id] || 0;      // kit upgrades show as pips under the building
      for (let p = 0; p < tier; p++) { ctx.fillStyle = ['#E5A93B', '#B06BFF', '#4FB3A9'][p]; ctx.beginPath(); ctx.arc(x - 6 + p * 6, gy + bob + 15, 2, 0, TWO_PI); ctx.fill(); }
    });
  }

  function drawResident(x, y) {
    const wave = Math.sin(world.t * 8) * 4;
    ctx.fillStyle = '#5a6cae'; ctx.beginPath(); ctx.roundRect(x - 5, y - 15, 10, 13, 3); ctx.fill();
    ctx.strokeStyle = '#5a6cae'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 5, y - 12); ctx.lineTo(x + 10, y - 20 + wave); ctx.stroke();
    ctx.fillStyle = '#F1C9A5'; ctx.beginPath(); ctx.arc(x, y - 20, 5, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#e4e4e4'; ctx.beginPath(); ctx.arc(x, y - 21.5, 5, Math.PI, TWO_PI); ctx.fill();
  }

  function drawHouse(h, i, day) {
    const y = pavementY() + 2, w = h.w, hh = h.tall ? 58 : 46;
    const visited = world.agents.some((a) => a.state === 'visit' && a.house === i);
    const s = h.pop < 1 ? 0.2 + 0.8 * h.pop : 1;
    const cool = Math.max(0, ((world.cooldowns[i] || 0) - world.now) / 1000);
    ctx.save(); ctx.translate(h.x + (h.shake > 0 ? Math.sin(world.t * 60) * 3 * h.shake : 0), y); ctx.scale(s, s); ctx.translate(-h.x, -y);
    if (th().space) {
      const r = w / 2 + 6;
      const g = ctx.createRadialGradient(h.x - r * 0.3, y - r * 0.8, 2, h.x, y - r * 0.3, r); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, h.colour);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, y, r, Math.PI, TWO_PI); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = h.glow > 0 ? `rgba(255, 200, 80, ${0.5 + h.glow * 0.5})` : '#3a4a6a'; ctx.beginPath(); ctx.roundRect(h.x - 6, y - 18, 12, 18, [6, 6, 0, 0]); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(h.x, y - r); ctx.lineTo(h.x, y - r - 12); ctx.stroke();
      ctx.fillStyle = `rgba(255,80,80,${0.5 + 0.5 * Math.sin(world.t * 4 + h.x)})`; ctx.beginPath(); ctx.arc(h.x, y - r - 13, 2.5, 0, TWO_PI); ctx.fill();
    } else {
      ctx.fillStyle = h.colour; ctx.fillRect(h.x - w / 2, y - hh, w, hh);
      ctx.fillStyle = h.roof; ctx.beginPath(); ctx.moveTo(h.x - w / 2 - 6, y - hh); ctx.lineTo(h.x, y - hh - 22); ctx.lineTo(h.x + w / 2 + 6, y - hh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a5a4a'; ctx.fillRect(h.x + w * 0.22, y - hh - 18, 7, 12);
      const lit = day < 0.5 || h.glow > 0;
      ctx.fillStyle = lit ? `rgba(255, 224, 130, ${0.6 + 0.4 * Math.max(h.glow, 1 - day)})` : 'rgba(120, 150, 190, .7)';
      ctx.fillRect(h.x - w * 0.36, y - hh + 10, w * 0.22, 11); ctx.fillRect(h.x + w * 0.14, y - hh + 10, w * 0.22, 11);
      const doorColour = ['#6b4a3a', '#7a5240', '#2f5d46', '#3a4a78'][world.tiers.client || 0];
      ctx.fillStyle = visited ? '#f3e2c8' : h.glow > 0 ? `rgba(255, 200, 80, ${h.glow})` : doorColour; ctx.fillRect(h.x - 6, y - 20, 12, 20);
      if ((world.tiers.client || 0) >= 2) { ctx.fillStyle = '#6fa582'; ctx.beginPath(); ctx.arc(h.x - w * 0.34, y - 3, 3.5, 0, TWO_PI); ctx.arc(h.x + w * 0.34, y - 3, 3.5, 0, TWO_PI); ctx.fill(); }
      if ((world.tiers.client || 0) >= 3) { ctx.fillStyle = '#E5A93B'; ctx.fillRect(h.x - 3, y - 24, 6, 3); }
      if (visited) drawResident(h.x, y);
      if (h.glow > 0.05) { ctx.fillStyle = `rgba(255, 210, 90, ${h.glow * 0.35})`; ctx.beginPath(); ctx.arc(h.x, y - 10, 22, 0, TWO_PI); ctx.fill(); }
      if ((world.counts.tech || 0) > i) { ctx.strokeStyle = `rgba(80, 160, 230, ${0.4 + 0.3 * Math.sin(world.t * 3 + h.x)})`; ctx.lineWidth = 1.5; for (let r = 5; r <= 13; r += 4) { ctx.beginPath(); ctx.arc(h.x + w / 2 - 4, y - hh - 6, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); } }
      if ((world.counts.group || 0) > 0) { ctx.fillStyle = CAR_COLOURS[i % 3]; ctx.fillRect(h.x - w / 2 - 2, y - hh - 30, 2, 22); ctx.beginPath(); ctx.moveTo(h.x - w / 2, y - hh - 30); ctx.lineTo(h.x - w / 2 + 12, y - hh - 26); ctx.lineTo(h.x - w / 2, y - hh - 22); ctx.fill(); }
    }
    drawDoorMark(h, i, day);
    if (cool > 0) {
      const top = y - (th().space ? w / 2 + 22 : hh + 30);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(h.x, top, 9, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#E5734A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, top, 7, -Math.PI / 2, -Math.PI / 2 + TWO_PI * Math.min(1, cool / 1.5)); ctx.stroke();
    }
    ctx.restore();
  }

  function drawAgent(a, isStar, prismatic = false) {
    const s = a.pop < 1 ? 0.5 + 0.5 * a.pop : 1;
    const x = a.x, y = pavementY() + (prismatic ? Math.sin(world.t * 6) * 2 : 0);
    const walking = a.state === 'walk' || prismatic;
    const swing = walking ? Math.sin(a.phase) * 5 : 0;
    const bounce = walking ? Math.abs(Math.sin(a.phase)) * 2 : 0;
    const space = th().space;
    if (a.dash > 0.2 && walking) { ctx.strokeStyle = `rgba(255,255,255,${a.dash * 0.8})`; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - a.dir * (14 + i * 6), y - 26 + i * 7); ctx.lineTo(x - a.dir * (26 + i * 8), y - 26 + i * 7); ctx.stroke(); } }
    ctx.save(); ctx.translate(x, y - bounce); ctx.scale(a.dir * s, s);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, 2 + bounce, 10, 3, 0, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = space ? '#e8e8f0' : '#3a2a24'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(-3 + swing, 0); ctx.moveTo(3, -10); ctx.lineTo(3 - swing, 0); ctx.stroke();
    let body = a.colour;
    if (prismatic) { const g = ctx.createLinearGradient(-8, -28, 8, -8); const h0 = (world.t * 120) % 360; g.addColorStop(0, `hsl(${h0} 90% 60%)`); g.addColorStop(0.5, `hsl(${(h0 + 120) % 360} 90% 60%)`); g.addColorStop(1, `hsl(${(h0 + 240) % 360} 90% 60%)`); body = g; }
    else if (space) body = '#f4f4f8';
    ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(-8, -28, 16, 20, 6); ctx.fill();
    if (space && !prismatic) { ctx.fillStyle = a.colour; ctx.fillRect(-8, -22, 16, 4); }
    ctx.fillStyle = prismatic ? '#fff' : '#f0e6da'; ctx.fillRect(6, -18, 6, 8);
    ctx.fillStyle = '#e5734a'; ctx.fillRect(8, -16, 2, 4); ctx.fillRect(7, -15, 4, 2);
    if (world.owned.has('syn-coord-carer')) { // the rota app, in everybody's hand
      ctx.fillStyle = '#2f3a46'; ctx.beginPath(); ctx.roundRect(-13, -22, 6, 8, 1); ctx.fill();
      ctx.fillStyle = `rgba(140,220,255,${0.6 + 0.4 * Math.sin(world.t * 4 + a.id)})`; ctx.fillRect(-12.2, -21.2, 4.4, 6.4);
    }
    if (world.tiers.carer >= 1 && !prismatic) { ctx.fillStyle = '#3a4a6a'; ctx.fillRect(-5, -1.5, 10, 2.5); } // comfy shoes
    if (world.tiers.carer >= 2 && !prismatic) { ctx.fillStyle = '#d9c07a'; ctx.beginPath(); ctx.arc(-4, -20, 1.8, 0, TWO_PI); ctx.fill(); } // fob watch
    if (world.tiers.carer >= 3 && !prismatic) { ctx.fillStyle = '#b06bff'; ctx.fillRect(2, -26, 4, 2); } // long-service badge
    ctx.strokeStyle = body; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-9 - swing * 0.6, -14); ctx.stroke();
    ctx.fillStyle = a.skin; ctx.beginPath(); ctx.arc(0, -35, 7, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = prismatic ? '#fff' : a.hair; ctx.beginPath(); ctx.arc(0, -37, 7, Math.PI, TWO_PI); ctx.fill();
    ctx.fillStyle = '#3a2a24'; ctx.fillRect(2, -36, 1.5, 1.5);
    if (space) { ctx.fillStyle = 'rgba(200,230,255,.35)'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -35, 10, 0, TWO_PI); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    ctx.textAlign = 'center';
    if (isStar) {
      ctx.font = `700 11px ${UI_FONT}`; ctx.fillStyle = '#fff'; const tw = ctx.measureText(a.name).width + 10;
      ctx.beginPath(); ctx.roundRect(x - tw / 2, y + 6, tw, 15, 7); ctx.fill(); ctx.fillStyle = '#3a2a24'; ctx.fillText(a.name, x, y + 17);
      ctx.font = `16px ${EMOJI_FONT}`; ctx.fillText(world.level >= 6 ? '👑' : world.level >= 3 ? '🎩' : '🧢', x + 8 * (a.dir || 1), y - 46 - bounce);
    }
    if (prismatic) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.1)'; ctx.font = `700 11px ${UI_FONT}`;
      const label = `✨ Prismatic ${a.name} – click me!`; const tw = ctx.measureText(label).width + 14; const lx = clamp(x, tw / 2 + 4, W - tw / 2 - 4);
      ctx.beginPath(); ctx.roundRect(lx - tw / 2, y - 68, tw, 18, 9); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#55397A'; ctx.fillText(label, lx, y - 55);
      const left = clamp((a.until - world.now) / 13000, 0, 1); ctx.fillStyle = '#b06bff'; ctx.fillRect(lx - 20, y - 48, 40 * left, 3);
    }
  }

  function drawCar(c, day) {
    const y = roadY() + c.laneOffset;
    ctx.save(); ctx.translate(c.x, y); ctx.scale(c.dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, 8, 22, 4, 0, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = c.colour; ctx.beginPath(); ctx.roundRect(-20, -8, 40, 14, 4); ctx.fill(); ctx.beginPath(); ctx.roundRect(-11, -16, 22, 10, 4); ctx.fill();
    ctx.fillStyle = 'rgba(200,230,255,.9)'; ctx.fillRect(-8, -14, 7, 6); ctx.fillRect(2, -14, 7, 6);
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(-12, 7, 4, 0, TWO_PI); ctx.arc(12, 7, 4, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 7px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('CARE', 0, 2);
    if (world.tiers.car >= 1) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-16, -6, 12, 5, 1); ctx.fill(); ctx.fillStyle = world.sign; ctx.font = `700 4px ${UI_FONT}`; ctx.fillText('MONTEITH', -10, -2.2); }
    if (world.owned.has('disc-mileage')) { ctx.fillStyle = '#5ac8a0'; ctx.fillRect(4, -13, 4, 3); }
    if (day < 0.5) { ctx.fillStyle = `rgba(255, 240, 180, ${(0.5 - day) * 1.6})`; ctx.beginPath(); ctx.moveTo(20, -4); ctx.lineTo(48, -12); ctx.lineTo(48, 4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    if (c.honk > 0) { ctx.font = `700 11px ${UI_FONT}`; ctx.fillStyle = `rgba(58,42,36,${Math.min(1, c.honk)})`; ctx.textAlign = 'center'; ctx.fillText('beep beep!', c.x, y - 24); }
  }

  function heart(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x - s * 0.6, y - s * 0.3, x - s * 0.2, y - s * 0.7, x, y - s * 0.3); ctx.bezierCurveTo(x + s * 0.2, y - s * 0.7, x + s * 0.6, y - s * 0.3, x, y + s * 0.3); ctx.fill(); }
  function star(x, y, s) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.2 : s * 0.5; const a = i * Math.PI / 4 + world.t; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }

  function drawParticles() {
    for (const p of world.particles) {
      const life = 1 - p.age / p.life; ctx.globalAlpha = clamp(life, 0, 1);
      if (p.type === 'heart') { ctx.fillStyle = '#ff6b8a'; heart(p.x, p.y, p.size * (0.7 + 0.3 * life)); }
      else if (p.type === 'sparkle') { ctx.fillStyle = `hsl(${(p.x * 3 + world.t * 200) % 360} 90% 65%)`; star(p.x, p.y, p.size * life); }
      else if (p.type === 'spark') { ctx.fillStyle = `hsl(${p.hue} 95% ${55 + 30 * (1 - life)}%)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TWO_PI); ctx.fill(); }
      else if (p.type === 'smoke') { ctx.fillStyle = 'rgba(220,220,230,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.5 - life), 0, TWO_PI); ctx.fill(); }
      else if (p.type === 'ring') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3 * life; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + p.age * 110, 0, TWO_PI); ctx.stroke(); }
      else if (p.type === 'text') { ctx.font = `800 ${p.size}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = '#3a2a24'; ctx.fillText(p.text, p.x, p.y); }
    }
    ctx.globalAlpha = 1;
    const target = hudTarget();
    for (const c of world.coins) {
      const t = c.t;
      const x = lerp(c.sx, target.x, t), y = lerp(c.sy, target.y, t) - Math.sin(t * Math.PI) * c.arc;
      const cr = world.coinSize;
      ctx.fillStyle = '#F5C542'; ctx.beginPath(); ctx.arc(x, y, cr, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#c99a1e'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#8a6a10'; ctx.font = `700 ${Math.round(cr * 1.3)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('£', x, y + 0.5); ctx.textBaseline = 'alphabetic';
    }
  }

  function drawCard() {
    const c = world.card; if (!c) return;
    const bob = Math.sin(c.phase * 3) * 4, rot = Math.sin(c.phase * 2) * 0.15;
    ctx.save(); ctx.translate(c.x, c.y + bob); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = `hsla(${(world.t * 90) % 360} 80% 60% / .8)`; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = `34px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💌', 0, 2); ctx.textBaseline = 'alphabetic';
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = `700 11px ${UI_FONT}`; ctx.textAlign = 'center'; const label = 'Thank-you card – click!'; const tw = ctx.measureText(label).width + 14;
    ctx.beginPath(); ctx.roundRect(c.x - tw / 2, c.y + bob + 30, tw, 18, 9); ctx.fill(); ctx.fillStyle = '#8A5A0C'; ctx.fillText(label, c.x, c.y + bob + 43);
    const left = clamp((c.until - world.now) / 13000, 0, 1);
    ctx.fillStyle = '#E39A2E'; ctx.fillRect(c.x - 20, c.y + bob + 52, 40 * left, 3);
  }

  function draw(frameNow) {
    const t = th(), day = dayFactor();
    ctx.save();
    if (world.shake) ctx.translate(rand(-world.shake, world.shake), rand(-world.shake, world.shake));
    drawSky(t, day); drawClouds(day, t); drawBackdrop(t, day);
    if (world.effects.some((e) => e.id === 'rainbow-rush')) { const g = ctx.createLinearGradient(0, 0, W, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsla(${(i * 60 + world.t * 60) % 360} 90% 65% / .28)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    drawOffice(day); drawLamps(day);
    world.houses.forEach((h, i) => drawHouse(h, i, day));
    for (const f of world.folk) drawFolk(f);
    const agents = [...world.agents].sort((a, b) => a.x - b.x);
    for (const a of agents) drawAgent(a, a.id === 0);
    if (world.prismatic) drawAgent({ ...world.prismatic, dir: 1, skin: '#F6D2B6', hair: '#fff', pop: 1, state: 'walk', colour: '#fff', dash: 0 }, false, true);
    for (const c of world.cars) drawCar(c, day);
    drawRain(day);
    drawCard();
    drawParticles();
    if (world.expandFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, world.expandFlash * 0.6)})`; ctx.fillRect(0, 0, W, H); }
    if (world.flashUntil > frameNow) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function frame(frameNow) {
    const dt = Math.min(0.05, world.lastFrame ? (frameNow - world.lastFrame) / 1000 : 0.016);
    world.lastFrame = frameNow;
    if (document.visibilityState !== 'hidden') { step(dt, Date.now()); draw(frameNow); }
    raf = requestAnimationFrame(frame);
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(canvas);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    sync, playerVisit, hitTest, spawnPos, celebrate, houseAt, houseCount, refuse,
    destroy() { cancelAnimationFrame(raf); ro?.disconnect(); },
  };
}
