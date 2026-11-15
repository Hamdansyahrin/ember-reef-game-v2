// render.js — every pixel of Ember Reef.
// Canvas 2D, no image assets: the reef, the keeper, the shards and the HUD
// are all drawn in code. Palette: deep teal/violet water against ember
// orange, with bioluminescent coral glow. The HUD is drawn big and bold so
// it stays readable when the screenshot is shrunk to a contact sheet.
import { TIDE_PHASES } from './tides.js';
import { beaconPositions } from './beacons.js';
import { comboMultiplier, bankPotential } from './combo.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const FLOOR_Y = 668;

// drawScene is the single entry point: background, beacons, shards, keeper,
// particles, HUD, then the screen overlay for title/pause/end states.
export function drawScene(ctx, world) {
  drawWater(ctx, world);
  drawParallaxReef(ctx, world);
  drawCoralGarden(ctx, world);
  drawBeacons(ctx, world);
  drawShards(ctx, world);
  drawKeeper(ctx, world);
  world.particles.draw(ctx);
  if (world.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.35, world.flash);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
  drawHud(ctx, world);
  if (world.screen === 'title') drawTitleScreen(ctx, world);
  else if (world.screen === 'paused') drawPausedScreen(ctx, world);
  else if (world.screen === 'over') drawGameOverScreen(ctx, world);
  else if (world.screen === 'victory') drawVictoryScreen(ctx, world);
}

// drawWater paints the vertical gradient and the tide's glowing waterline.
function drawWater(ctx, world) {
  const tide = world.tide;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, tide.phase.deep);
  g.addColorStop(0.55, tide.phase.mid);
  g.addColorStop(1, '#03141c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // God rays from the surface.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#bff7ff';
  for (let i = 0; i < 5; i++) {
    const x = 120 + i * 240 + Math.sin(world.time * 0.11 + i * 1.7) * 26;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 90, 0);
    ctx.lineTo(x + 210, VIEW_H);
    ctx.lineTo(x + 40, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Tide waterline: a glowing band whose height follows the phase.
  const wl = tide.phase.waterline;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = tide.phase.glow;
  ctx.fillRect(0, wl - 3, VIEW_W, 6);
  ctx.globalAlpha = 0.05;
  ctx.fillRect(0, 0, VIEW_W, wl);
  ctx.restore();
}

// drawParallaxReef paints two layers of distant reef silhouettes.
function drawParallaxReef(ctx, world) {
  drawRidge(ctx, world, 0.25, '#08222e', 150);
  drawRidge(ctx, world, 0.5, '#0a2e3c', 90);
}

// drawRidge paints one wavy silhouette ridge across the scene.
function drawRidge(ctx, world, parallax, color, baseY) {
  const offset = (world.lanternX - VIEW_W / 2) * parallax * 0.08;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, VIEW_H);
  for (let x = -20; x <= VIEW_W + 20; x += 40) {
    const y = VIEW_H - baseY - 60 + Math.sin((x + offset) * 0.008 + world.time * 0.05) * 34
      + Math.sin((x + offset) * 0.021) * 18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W + 20, VIEW_H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// drawCoralGarden paints the glowing coral fans rooted on the floor.
function drawCoralGarden(ctx, world) {
  for (const c of world.reef.corals) {
    drawCoralFan(ctx, c, world.time);
  }
  for (const r of world.reef.rocks) {
    ctx.save();
    ctx.fillStyle = '#0d2f3a';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.w, r.h, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// drawCoralFan paints one branching coral with a pulsing glow tip.
function drawCoralFan(ctx, coral, time) {
  const pulse = 0.55 + 0.45 * Math.sin(time * 1.6 + coral.phase);
  ctx.save();
  ctx.strokeStyle = coral.color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const b of coral.branches) {
    ctx.beginPath();
    ctx.moveTo(coral.x, coral.y);
    ctx.quadraticCurveTo(coral.x + b.cx, coral.y + b.cy, coral.x + b.tx, coral.y + b.ty);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.25 + 0.55 * pulse;
  ctx.fillStyle = coral.color;
  for (const b of coral.branches) {
    ctx.beginPath();
    ctx.arc(coral.x + b.tx, coral.y + b.ty, 3.5 + 2 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// drawBeacons paints the seven beacons along the floor: lit ones blaze,
// the next one pulses as the target, unlit ones are dim stone.
function drawBeacons(ctx, world) {
  const spots = beaconPositions(VIEW_W, FLOOR_Y);
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const lit = i < world.beaconsLit;
    const isNext = i === world.beaconsLit;
    ctx.save();
    // Stone plinth.
    ctx.fillStyle = lit ? '#274b5c' : '#16242e';
    ctx.beginPath();
    ctx.moveTo(s.x - 16, s.y + 4);
    ctx.lineTo(s.x - 10, s.y - 26);
    ctx.lineTo(s.x + 10, s.y - 26);
    ctx.lineTo(s.x + 16, s.y + 4);
    ctx.closePath();
    ctx.fill();
    if (lit) {
      const flicker = 0.75 + 0.25 * Math.sin(world.time * 3 + i * 1.3);
      ctx.globalAlpha = 0.3 * flicker;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 34, 30 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 34, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = isNext ? 0.5 + 0.4 * Math.sin(world.time * 4) : 0.35;
      ctx.strokeStyle = '#7fe7d2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 34, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// shardStyle maps a shard type to its color, value and glow.
export function shardStyle(type) {
  if (type === 'pearl') return { color: '#eaf6ff', glow: '#bfe9ff', value: 25, radius: 15 };
  if (type === 'coral') return { color: '#ff7a6e', glow: '#ff9a8a', value: 15, radius: 13 };
  if (type === 'ember') return { color: '#ff5a1f', glow: '#ff8a3c', value: 20, radius: 12 };
  return { color: '#ffb347', glow: '#ffd98a', value: 10, radius: 13 };
}

// drawShards paints every falling shard as a glowing ember crystal.
function drawShards(ctx, world) {
  for (const s of world.shards) {
    const st = shardStyle(s.type);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = st.glow;
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.moveTo(0, -s.r);
    ctx.lineTo(s.r * 0.72, 0);
    ctx.lineTo(0, s.r);
    ctx.lineTo(-s.r * 0.72, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(-s.r * 0.2, -s.r * 0.25, s.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Flare attraction ring while a flare is live.
  if (world.flareTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, world.flareTimer);
    ctx.strokeStyle = '#ffd98a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(world.lanternX, world.lanternY, world.flareRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// drawKeeper paints the Lantern Keeper: a hooded keeper holding a glowing
// lantern that swings as it moves, with a catch halo when it is hot.
function drawKeeper(ctx, world) {
  const x = world.lanternX;
  const y = world.lanternY;
  const swing = Math.sin(world.time * 2.2) * 3 + world.lanternVel * 0.02;
  ctx.save();
  // Lantern glow.
  const glowR = 70 + Math.min(60, world.light * 0.5) + (world.flareTimer > 0 ? 60 : 0);
  const g = ctx.createRadialGradient(x, y, 8, x, y, glowR);
  g.addColorStop(0, 'rgba(255, 214, 130, 0.55)');
  g.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();
  // Keeper body: a small hooded figure on the reef floor.
  const bx = x;
  const by = FLOOR_Y + 2;
  ctx.fillStyle = '#1d4b5e';
  ctx.beginPath();
  ctx.moveTo(bx - 16, by);
  ctx.lineTo(bx - 10, by - 34);
  ctx.quadraticCurveTo(bx, by - 44, bx + 10, by - 34);
  ctx.lineTo(bx + 16, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(bx, by - 40, 9, 0, Math.PI * 2);
  ctx.fill();
  // Lantern arm + lantern, swinging with motion.
  ctx.strokeStyle = '#c98a4b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bx, by - 30);
  ctx.lineTo(x + swing, y + 14);
  ctx.stroke();
  ctx.fillStyle = '#2a1c10';
  ctx.strokeStyle = '#ffcf7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 11 + swing, y - 12, 22, 26, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(x + swing, y + 1, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Catch halo while the combo is hot.
  if (comboMultiplier(world.combo) >= 4) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(world.time * 6);
    ctx.strokeStyle = '#ffd98a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 58, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// drawHud paints the whole status bar: score, combo + bank, light meter,
// beacons, tide phase and chain meter — all big enough to read shrunk.
function drawHud(ctx, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 18, 26, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, 86);
  ctx.fillStyle = 'rgba(127, 231, 210, 0.25)';
  ctx.fillRect(0, 86, VIEW_W, 2);

  drawHudText(ctx, 'SCORE', 24, 26, 13, '#7fe7d2');
  drawHudText(ctx, String(world.score), 24, 52, 30, '#ffffff');
  drawHudText(ctx, 'BEST ' + world.best, 24, 78, 12, '#9fb8c4');

  const mult = comboMultiplier(world.combo);
  const comboColor = mult >= 6 ? '#ffb347' : mult >= 3 ? '#ffe9b0' : '#ffffff';
  drawHudText(ctx, 'COMBO', 250, 26, 13, '#7fe7d2');
  drawHudText(ctx, 'x' + mult, 250, 52, 30, comboColor);
  const bank = bankPotential(world.combo);
  const bankLabel = bank.score > 0 ? 'BANK +' + bank.score + '  [B]' : 'BANK  [B]';
  ctx.fillStyle = bank.score > 0 ? '#ffb347' : '#3a5a68';
  ctx.strokeStyle = bank.score > 0 ? '#ffd98a' : '#5a7a88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(380, 22, 168, 46, 8);
  ctx.fill();
  ctx.stroke();
  drawHudText(ctx, bankLabel, 396, 52, 19, bank.score > 0 ? '#1d2b33' : '#cfe8ef');

  // Light meter.
  drawHudText(ctx, 'LIGHT', 590, 26, 13, '#7fe7d2');
  drawLightMeter(ctx, 590, 36, 170, 20, world.light, world.time);
  drawHudText(ctx, Math.round(world.light) + '', 768, 52, 18, '#ffe9b0');

  // Beacons 0/7.
  drawHudText(ctx, 'BEACONS ' + world.beaconsLit + '/7', 830, 26, 13, '#7fe7d2');
  for (let i = 0; i < 7; i++) {
    ctx.save();
    ctx.fillStyle = i < world.beaconsLit ? '#ffb347' : '#23414f';
    ctx.strokeStyle = i < world.beaconsLit ? '#ffd98a' : '#4a6a78';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(842 + i * 26, 56, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Tide phase + chain meter, right side.
  const tide = world.tide;
  drawHudText(ctx, 'TIDE: ' + tide.phase.name.toUpperCase(), 1050, 26, 13, tide.phase.glow);
  drawHudText(ctx, 'next ' + tide.nextName + ' in ' + Math.ceil(tide.endsIn) + 's', 1050, 44, 12, '#9fb8c4');
  drawHudText(ctx, 'CHAIN x' + world.chain, 1050, 68, 15, world.chain > 0 ? '#c98cff' : '#7a94a2');
  ctx.restore();

  // Controls hint along the bottom while playing.
  if (world.screen === 'playing') {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#d7eef5';
    ctx.font = '15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('← → / A D or mouse — move    SPACE / click — Flare (10 light)    B — Bank combo    P — pause    M — mute', VIEW_W / 2, VIEW_H - 12);
    ctx.restore();
  }
}

// drawHudText is the HUD's left-aligned label helper.
function drawHudText(ctx, text, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = 'bold ' + size + 'px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// drawLightMeter paints the light bar with a low-light warning pulse.
function drawLightMeter(ctx, x, y, w, h, light, time) {
  ctx.save();
  ctx.fillStyle = '#0b2531';
  ctx.strokeStyle = '#4a6a78';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.stroke();
  const frac = Math.max(0, Math.min(1, light / 100));
  const low = light < 25;
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, low ? '#ff5a3c' : '#ff9a2a');
  g.addColorStop(1, low ? '#ffb347' : '#ffe9b0');
  ctx.globalAlpha = low ? 0.65 + 0.35 * Math.sin(time * 8) : 1;
  ctx.fillStyle = g;
  if (frac > 0.01) {
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, (w - 4) * frac, h - 4, 4);
    ctx.fill();
  }
  ctx.restore();
}

// drawCenterPanel paints a dimmed full-screen panel behind end screens.
function drawCenterPanel(ctx, title, titleColor) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 14, 22, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 190);
  ctx.restore();
}

// drawTitleScreen paints the start screen: title, story, rules, best score.
function drawTitleScreen(ctx, world) {
  drawCenterPanel(ctx, 'EMBER REEF', '#ffd98a');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7fe7d2';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('You are the Lantern Keeper of a bioluminescent reef.', VIEW_W / 2, 240);
  ctx.fillStyle = '#e8f6fa';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Catch falling ember shards in your lantern. Chain catches to grow your combo —', VIEW_W / 2, 292);
  ctx.fillText('then BANK it with B before a miss wipes it out. Light all 7 beacons to win.', VIEW_W / 2, 320);
  ctx.fillText('Riding the tides: Calm → Surge → Flood. Faster falls, richer shards.', VIEW_W / 2, 348);
  ctx.fillStyle = '#ffe9b0';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText('← → / A D or mouse to move   •   SPACE / click: Flare (10 light)', VIEW_W / 2, 402);
  ctx.fillText('B: Bank combo   •   P: pause   •   M: mute', VIEW_W / 2, 430);
  ctx.fillStyle = '#9fb8c4';
  ctx.font = '18px Georgia, serif';
  ctx.fillText('Missing a shard breaks your combo and your beacon chain. If your light runs out, the reef goes dark.', VIEW_W / 2, 472);
  if (world.best > 0) {
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('Best score: ' + world.best, VIEW_W / 2, 512);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Georgia, serif';
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText('Press ENTER or click to begin', VIEW_W / 2, 580);
  ctx.restore();
}

// drawPausedScreen paints the pause overlay.
function drawPausedScreen(ctx, world) {
  drawCenterPanel(ctx, 'PAUSED', '#7fe7d2');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8f6fa';
  ctx.font = '22px Georgia, serif';
  ctx.fillText('Score ' + world.score + '  •  Beacons ' + world.beaconsLit + '/7  •  Combo x' + comboMultiplier(world.combo), VIEW_W / 2, 250);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('Press P to keep playing', VIEW_W / 2, 320);
  ctx.restore();
}

// drawGameOverScreen paints the loss screen with stats and restart.
function drawGameOverScreen(ctx, world) {
  drawCenterPanel(ctx, 'THE REEF WENT DARK', '#ff7a6e');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8f6fa';
  ctx.font = '24px Georgia, serif';
  ctx.fillText('Your lantern ran out of light with ' + world.beaconsLit + ' of 7 beacons lit.', VIEW_W / 2, 250);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('Score: ' + world.score + '    Best: ' + world.best, VIEW_W / 2, 310);
  ctx.fillStyle = '#9fb8c4';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Caught ' + world.caught + ' shards  •  Missed ' + world.missed + '  •  Banked ' + world.banks + ' combos (+' + world.bankedTotal + ')', VIEW_W / 2, 352);
  ctx.fillStyle = '#ffd98a';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Tip: bank your combo with B before the Flood makes you drop one.', VIEW_W / 2, 392);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Georgia, serif';
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText('Press ENTER to try again', VIEW_W / 2, 470);
  ctx.restore();
}

// drawVictoryScreen paints the win screen: 7/7 beacons, stats, restart.
function drawVictoryScreen(ctx, world) {
  drawCenterPanel(ctx, 'ALL 7 BEACONS LIT!', '#ffd98a');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7fe7d2';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('The reef blazes again — the Lantern Keeper prevails.', VIEW_W / 2, 246);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText('Score: ' + world.score + '    Best: ' + world.best, VIEW_W / 2, 306);
  ctx.fillStyle = '#e8f6fa';
  ctx.font = '20px Georgia, serif';
  const secs = Math.round(world.elapsed);
  ctx.fillText('Finished in ' + Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0') + '  •  Caught ' + world.caught + ' shards  •  Missed ' + world.missed, VIEW_W / 2, 348);
  ctx.fillText('Banked ' + world.banks + ' combos (+' + world.bankedTotal + ' pts)  •  Best chain x' + world.bestChain, VIEW_W / 2, 376);
  ctx.fillStyle = '#ffd98a';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('The tides will turn again — can you beat this score?', VIEW_W / 2, 420);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Georgia, serif';
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText('Press ENTER to play again', VIEW_W / 2, 492);
  ctx.restore();
}
