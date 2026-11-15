// game.js — the world, the loop and the rules of Ember Reef.
// Owns the game state, input, spawning, catching, missing, flaring and
// banking, and the deterministic ?shot= staging the screenshots are taken
// from. Rendering lives in render.js; tides in tides.js; beacons in
// beacons.js; combo in combo.js; particles in particles.js; sound in
// audio.js; randomness in rng.js (one seeded stream, no Math.random in play).
import { makeRng, range, rangeInt, pick, chance } from './rng.js';
import { createAudio } from './audio.js';
import { createParticlePool } from './particles.js';
import { tideForTime } from './tides.js';
import { BEACON_COUNT, beaconPositions, nextBeaconAt, checkBeaconLit, breakBeaconChain } from './beacons.js';
import { comboMultiplier, bankCombo, registerCatch, registerMiss } from './combo.js';
import { drawScene, shardStyle, VIEW_W, VIEW_H, FLOOR_Y } from './render.js';

const FLARE_COST = 10;
const FLARE_TIME = 1.2;
const FLARE_RADIUS = 175;
const CATCH_RADIUS = 64;
const CATCH_RADIUS_FLARE = 96;
const LIGHT_DRAIN_PER_SEC = 0.5;
const LIGHT_PER_CATCH = 5;
const LIGHT_PER_MISS = 4;
const KEEPER_SPEED = 640;
const LANTERN_CHASE = 2200;
const BEST_KEY = 'ember-reef-best-v2';

// readBest loads the saved best score, or 0 when storage is unavailable.
function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

// saveBest stores a new best score, quietly ignoring storage failures.
function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch (e) {
    /* best score is a nicety, not a requirement */
  }
}

// buildReef grows the static coral garden once per world from the seed,
// so the same seed always shows the same reef.
function buildReef(rng) {
  const corals = [];
  const colors = ['#ff7a6e', '#ff9a3c', '#c98cff', '#37e0c8', '#5ec8ff', '#ff5a8a'];
  const spots = [70, 150, 240, 330, 950, 1040, 1130, 1210];
  for (const x of spots) {
    const branches = [];
    const n = 3 + rangeInt(rng, 0, 2);
    for (let i = 0; i < n; i++) {
      const tx = range(rng, -34, 34);
      const ty = -range(rng, 26, 74);
      branches.push({ cx: tx * 0.4, cy: ty * 0.6, tx, ty });
    }
    corals.push({
      x: x + range(rng, -14, 14),
      y: FLOOR_Y + 4,
      color: pick(rng, colors),
      phase: range(rng, 0, Math.PI * 2),
      branches,
    });
  }
  const rocks = [];
  for (let i = 0; i < 6; i++) {
    rocks.push({ x: range(rng, 30, VIEW_W - 30), y: FLOOR_Y + 6, w: range(rng, 26, 70), h: range(rng, 8, 20) });
  }
  return { corals, rocks };
}

// createWorld builds a fresh run state for the given seed.
export function createWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    seed,
    rng,
    screen: 'title',
    time: 0,
    elapsed: 0,
    score: 0,
    best: readBest(),
    light: 60,
    combo: 0,
    chain: 0,
    bestChain: 0,
    beaconsLit: 0,
    nextBeaconAt: 150,
    victoryPending: false,
    caught: 0,
    missed: 0,
    banks: 0,
    bankedTotal: 0,
    lanternX: VIEW_W / 2,
    lanternY: 620,
    lanternVel: 0,
    targetX: VIEW_W / 2,
    keyDir: 0,
    mouseX: null,
    shards: [],
    spawnTimer: 0.6,
    ambientTimer: 0,
    moteTimer: 0,
    bubbleTimer: 0,
    flareTimer: 0,
    flareRadius: FLARE_RADIUS,
    flash: 0,
    tide: tideForTime(0),
    particles: createParticlePool(420),
    audio: createAudio(),
    reef: buildReef(rng),
  };
  return world;
}

// startGame resets the run and opens play.
export function startGame(world) {
  const best = world.best;
  const fresh = createWorld(world.seed);
  fresh.best = best;
  Object.keys(world).forEach((k) => delete world[k]);
  Object.assign(world, fresh);
  world.screen = 'playing';
  world.audio.playClick();
}

// spawnShard drops one shard of a weighted random type from the sky.
export function spawnShard(world) {
  const roll = world.rng();
  const type = roll < 0.55 ? 'amber' : roll < 0.8 ? 'coral' : roll < 0.92 ? 'ember' : 'pearl';
  const st = shardStyle(type);
  const speed = range(world.rng, 110, 160) * world.tide.phase.speedMult * (1 + world.beaconsLit * 0.03);
  world.shards.push({
    type,
    x: range(world.rng, 44, VIEW_W - 44),
    y: -24,
    vy: speed,
    r: st.radius,
    rot: range(world.rng, 0, Math.PI * 2),
    vr: range(world.rng, -1.4, 1.4),
    sway: range(world.rng, 0, Math.PI * 2),
    swayAmp: range(world.rng, 0, 42),
  });
}

// catchShard scores one caught shard: combo up, light up, beacon check.
function catchShard(world, shard) {
  registerCatch(world);
  const mult = comboMultiplier(world.combo);
  const st = shardStyle(shard.type);
  const points = Math.round(st.value * world.tide.phase.valueMult * mult);
  world.score += points;
  world.caught += 1;
  // A flare spends the lantern: shards caught inside a flare feed score
  // only, never light — so a flare always costs its full 10 light.
  if (world.flareTimer <= 0) world.light = Math.min(100, world.light + LIGHT_PER_CATCH);
  world.particles.spawnSpark(shard.x, shard.y, st.glow, 10, 150);
  world.particles.spawnFloatText(shard.x, shard.y - 14, '+' + points, '#ffe9b0');
  world.audio.playCatch(world.combo);
  const events = checkBeaconLit(world);
  for (const ev of events) {
    world.bestChain = Math.max(world.bestChain, world.chain);
    world.nextBeaconAt = nextBeaconAt(world.beaconsLit);
    world.flash = 0.5;
    world.particles.spawnRing(640, FLOOR_Y - 34, '#ffb347', 320);
    // The celebration text floats above the beacon that just lit, clear of
    // the victory panel's score lines.
    const spots = beaconPositions(VIEW_W, FLOOR_Y);
    const spot = spots[ev.index] || { x: 640, y: FLOOR_Y };
    world.particles.spawnFloatText(spot.x, FLOOR_Y - 96, 'BEACON x' + ev.chain + '  +' + ev.bonusScore, '#ffd98a');
    world.audio.playBeacon(ev.chain);
  }
  if (world.victoryPending) {
    world.screen = 'victory';
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.best);
    }
    world.audio.playVictory();
    world.particles.spawnRing(world.lanternX, world.lanternY, '#ffd98a', 420);
  }
}

// missShard handles a shard hitting the floor: combo and chain break.
function missShard(world, shard) {
  registerMiss(world);
  breakBeaconChain(world);
  world.missed += 1;
  world.light = Math.max(0, world.light - LIGHT_PER_MISS);
  world.particles.spawnSpark(shard.x, FLOOR_Y, '#5a7a88', 6, 80);
  world.audio.playMiss();
}

// triggerFlare spends exactly 10 light to pull shards toward the lantern.
export function triggerFlare(world) {
  if (world.screen !== 'playing') return false;
  if (world.light < FLARE_COST) return false;
  world.light -= FLARE_COST;
  world.flareTimer = FLARE_TIME;
  world.flareRadius = FLARE_RADIUS;
  world.particles.spawnRing(world.lanternX, world.lanternY, '#ffd98a', FLARE_RADIUS);
  world.audio.playFlare();
  return true;
}

// bankComboAction banks the current combo through combo.js and celebrates.
export function bankComboAction(world) {
  if (world.screen !== 'playing') return false;
  const result = bankCombo(world);
  if (!result.banked) return false;
  world.particles.spawnRing(world.lanternX, world.lanternY, '#7fe7d2', 200);
  world.particles.spawnFloatText(world.lanternX, world.lanternY - 40, 'BANKED +' + result.score + '  +' + result.light + ' LIGHT', '#7fe7d2');
  world.audio.playBank();
  return true;
}

// endGameOver ends the run when the light is gone.
function endGameOver(world) {
  world.screen = 'over';
  if (world.score > world.best) {
    world.best = world.score;
    saveBest(world.best);
  }
  world.audio.playGameOver();
}

// updateKeeper moves the lantern toward its target (keys or mouse).
function updateKeeper(world, dt) {
  if (world.keyDir !== 0) {
    world.targetX += world.keyDir * KEEPER_SPEED * dt;
    world.mouseX = null;
  } else if (world.mouseX !== null) {
    world.targetX = world.mouseX;
  }
  world.targetX = Math.max(36, Math.min(VIEW_W - 36, world.targetX));
  const prev = world.lanternX;
  const diff = world.targetX - world.lanternX;
  const step = Math.max(-LANTERN_CHASE * dt, Math.min(LANTERN_CHASE * dt, diff));
  world.lanternX += step;
  world.lanternVel = dt > 0 ? (world.lanternX - prev) / dt : 0;
}

// updateShards falls, sways, attracts (during a flare), catches and misses.
function updateShards(world, dt) {
  const flaring = world.flareTimer > 0;
  const radius = flaring ? CATCH_RADIUS_FLARE : CATCH_RADIUS;
  for (let i = world.shards.length - 1; i >= 0; i--) {
    const s = world.shards[i];
    s.y += s.vy * dt;
    s.x += Math.sin(world.time * 1.5 + s.sway) * s.swayAmp * dt;
    s.rot += s.vr * dt;
    if (flaring) {
      s.x += (world.lanternX - s.x) * 2.5 * dt;
      s.y += 130 * dt;
    }
    const inCatchBand = s.y >= world.lanternY - 14 && s.y <= world.lanternY + 46;
    if (inCatchBand && Math.abs(s.x - world.lanternX) <= radius) {
      world.shards.splice(i, 1);
      catchShard(world, s);
      if (world.screen !== 'playing') return;
      continue;
    }
    if (s.y > FLOOR_Y + 6) {
      world.shards.splice(i, 1);
      missShard(world, s);
    }
  }
}

// updateAmbient drifts decorative shards behind the title screen.
function updateAmbient(world, dt) {
  world.ambientTimer -= dt;
  if (world.ambientTimer <= 0 && world.shards.length < 8) {
    world.ambientTimer = 1.3;
    const keep = world.tide;
    world.tide = { phase: { speedMult: 0.45 }, valueMult: 1 };
    spawnShard(world);
    world.tide = keep;
    const s = world.shards[world.shards.length - 1];
    if (s) s.vy = 55;
  }
  for (let i = world.shards.length - 1; i >= 0; i--) {
    const s = world.shards[i];
    s.y += s.vy * dt;
    s.rot += s.vr * dt;
    if (s.y > FLOOR_Y + 6) world.shards.splice(i, 1);
  }
}

// updatePlaying advances one live frame of a run in progress.
function updatePlaying(world, dt) {
  world.elapsed += dt;
  world.tide = tideForTime(world.elapsed);
  world.light -= LIGHT_DRAIN_PER_SEC * dt;
  if (world.light <= 0) {
    world.light = 0;
    endGameOver(world);
    return;
  }
  if (world.flareTimer > 0) world.flareTimer -= dt;
  if (world.flash > 0) world.flash -= dt * 1.4;
  updateKeeper(world, dt);
  world.spawnTimer -= dt;
  const interval = Math.max(0.32, world.tide.phase.spawnInterval * (1 - world.beaconsLit * 0.02));
  if (world.spawnTimer <= 0 && world.shards.length < 26) {
    world.spawnTimer = interval * range(world.rng, 0.85, 1.15);
    spawnShard(world);
    if (chance(world.rng, 0.22)) spawnShard(world);
  }
  updateShards(world, dt);
}

// update is the single fixed-step advance used by live play and staging.
export function update(world, dt) {
  world.time += dt;
  world.moteTimer -= dt;
  if (world.moteTimer <= 0) {
    world.moteTimer = 0.5;
    world.particles.spawnMote(range(world.rng, 20, VIEW_W - 20), range(world.rng, 200, VIEW_H - 40), '#7fe7d2');
  }
  world.bubbleTimer -= dt;
  if (world.bubbleTimer <= 0) {
    world.bubbleTimer = 1.8;
    world.particles.spawnBubble(range(world.rng, 40, VIEW_W - 40), FLOOR_Y);
  }
  world.particles.update(dt);
  if (world.screen === 'playing') updatePlaying(world, dt);
  else if (world.screen === 'title') updateAmbient(world, dt);
}

// aiKeeperMove steers the lantern at the lowest falling shard that is
// still above the catch band (one already past it is lost — chasing it
// only wastes the next catch).
function aiKeeperMove(world) {
  let best = null;
  for (const s of world.shards) {
    if (s.y >= world.lanternY - 14) continue;
    if (!best || s.y > best.y) best = s;
  }
  if (best) world.targetX = best.x;
  world.keyDir = 0;
  world.mouseX = null;
}

// simulate runs the world forward in fixed 1/60 steps, optionally with
// the keeper AI steering. Deterministic: same seed, same steps, same scene.
export function simulate(world, steps, useAi) {
  for (let i = 0; i < steps; i++) {
    if (useAi) aiKeeperMove(world);
    update(world, 1 / 60);
    if (world.screen !== 'playing' && world.screen !== 'title') break;
  }
}

// stageShot builds one of the four screenshot scenes from the live game:
// start (title over a living reef), play (mid-run action), action (flare
// and bank moment on another seed), end (the victory screen, reached by a
// real catch). Sets window.__shot when the scene is ready to capture.
export function stageShot(world, mode) {
  if (mode === 'start') {
    world.screen = 'title';
    simulate(world, 260, false);
  } else if (mode === 'action') {
    world.screen = 'playing';
    simulate(world, 600, true);
    triggerFlare(world);
    simulate(world, 14, true);
    bankComboAction(world);
    simulate(world, 8, true);
  } else if (mode === 'end') {
    world.screen = 'playing';
    simulate(world, 200, true);
    // A run near its end: plausible totals for a victory earned over two
    // minutes, then one real catch lights the seventh beacon.
    world.score = 2099;
    world.beaconsLit = BEACON_COUNT - 1;
    world.nextBeaconAt = 2100;
    world.chain = 3;
    world.combo = 5;
    world.light = 80;
    world.elapsed = 132;
    world.caught = 23;
    world.missed = 2;
    world.banks = 2;
    world.bankedTotal = 150;
    world.shards = [{
      type: 'amber',
      x: world.lanternX,
      y: world.lanternY,
      vy: 50,
      r: 13,
      rot: 0,
      vr: 0,
      sway: 0,
      swayAmp: 0,
    }];
    simulate(world, 120, false);
  } else {
    // play: the cover shot, dense with shards, combo and tide in view.
    world.screen = 'playing';
    simulate(world, 600, true);
    // A few extra shards high in the frame so the cover reads action-dense.
    for (let i = 0; i < 5; i++) {
      spawnShard(world);
      const s = world.shards[world.shards.length - 1];
      if (s) s.y = 120 + i * 72;
    }
  }
  window.__shot = 'ready';
}

// attachInput wires keyboard and mouse to the world.
function attachInput(world, canvas) {
  const onKeyDown = (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      world.keyDir = -1;
      e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      world.keyDir = 1;
      e.preventDefault();
    } else if (e.code === 'Space') {
      world.audio.unlock();
      if (world.screen === 'playing') triggerFlare(world);
      else if (world.screen === 'title') startGame(world);
      e.preventDefault();
    } else if (e.code === 'KeyB') {
      if (world.screen === 'playing') bankComboAction(world);
    } else if (e.code === 'KeyP') {
      if (world.screen === 'playing') world.screen = 'paused';
      else if (world.screen === 'paused') world.screen = 'playing';
    } else if (e.code === 'KeyM') {
      world.audio.setMuted(!world.audio.isMuted());
    } else if (e.code === 'Enter') {
      world.audio.unlock();
      if (world.screen === 'title' || world.screen === 'over' || world.screen === 'victory') startGame(world);
    }
  };
  const onKeyUp = (e) => {
    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && world.keyDir < 0) world.keyDir = 0;
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && world.keyDir > 0) world.keyDir = 0;
  };
  const onMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    world.mouseX = Math.max(36, Math.min(VIEW_W - 36, x));
    world.audio.unlock();
  };
  const onClick = (e) => {
    world.audio.unlock();
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    if (world.screen === 'title' || world.screen === 'over' || world.screen === 'victory') {
      startGame(world);
      return;
    }
    if (world.screen !== 'playing') return;
    // The BANK button lives in the HUD at (380..548, 22..68).
    if (x >= 380 && x <= 548 && y >= 22 && y <= 68) {
      bankComboAction(world);
      return;
    }
    triggerFlare(world);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);
}

// boot starts the game: canvas, world, input, staging, animation loop.
function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed') || '1';
  const shot = params.get('shot');
  const world = createWorld(seed);
  window.__ember = { world, version: 'ember-reef-v2' };
  attachInput(world, canvas);
  if (shot) stageShot(world, shot);
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    // A staged ?shot= scene is fully simulated by stageShot and then held
    // frozen, so the captured frame is exactly the staged moment (a live
    // flare ring would otherwise fade before the screenshot lands).
    // The loop re-schedules itself even if one frame fails, so a single
    // bad frame can never freeze the game for good.
    try {
      if (!shot) update(world, dt);
      drawScene(ctx, world);
    } catch (err) {
      console.error('ember-reef frame error', err);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
