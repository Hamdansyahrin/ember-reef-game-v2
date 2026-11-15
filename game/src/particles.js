// particles.js — the sparkle layer of Ember Reef.
// One small pool holds every transient effect: catch sparks, flare rings,
// rising bubbles, drifting motes and floating score text. The pool caps
// itself so a wild flare can never grow memory without bound.
export function createParticlePool(maxParticles) {
  const cap = maxParticles || 420;
  const particles = [];

  // spawnSpark bursts a few glowing embers from a catch or a flare.
  function spawnSpark(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      if (particles.length >= cap) return;
      const a = Math.random() * Math.PI * 2;
      const v = (speed || 140) * (0.3 + Math.random() * 0.7);
      particles.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: 0.55 + Math.random() * 0.35,
        age: 0,
        size: 2 + Math.random() * 3.5,
        color,
      });
    }
  }

  // spawnRing draws an expanding halo, used by flares and beacon lights.
  function spawnRing(x, y, color, maxRadius) {
    if (particles.length >= cap) return;
    particles.push({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.7,
      age: 0,
      size: 6,
      maxRadius: maxRadius || 150,
      color,
    });
  }

  // spawnBubble releases a slow wobbling bubble from the reef floor.
  function spawnBubble(x, y) {
    if (particles.length >= cap) return;
    particles.push({
      kind: 'bubble',
      x,
      y,
      vx: (Math.random() - 0.5) * 12,
      vy: -26 - Math.random() * 26,
      life: 3 + Math.random() * 2,
      age: 0,
      size: 3 + Math.random() * 6,
      color: '#9fe8ff',
    });
  }

  // spawnMote seeds one ambient plankton mote that drifts for seconds.
  function spawnMote(x, y, color) {
    if (particles.length >= cap) return;
    particles.push({
      kind: 'mote',
      x,
      y,
      vx: (Math.random() - 0.5) * 14,
      vy: -8 - Math.random() * 12,
      life: 4 + Math.random() * 4,
      age: 0,
      size: 1 + Math.random() * 2,
      color: color || '#7fe7d2',
    });
  }

  // spawnFloatText floats a "+120" style label up from a catch.
  function spawnFloatText(x, y, text, color) {
    if (particles.length >= cap) return;
    particles.push({
      kind: 'text',
      x,
      y,
      vx: 0,
      vy: -52,
      life: 0.9,
      age: 0,
      size: 20,
      color: color || '#ffe9b0',
      text,
    });
  }

  // update advances every particle and drops the dead ones.
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') {
        p.vy += 260 * dt;
        p.vx *= 1 - 1.6 * dt;
      }
      if (p.kind === 'bubble') {
        p.x += Math.sin(p.age * 3 + p.size) * 12 * dt;
      }
    }
  }

  // draw paints the pool with additive glow where the browser allows it.
  function draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const t = 1 - p.age / p.life;
      if (p.kind === 'spark') {
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t + 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        const r = p.size + (p.maxRadius - p.size) * (1 - t * t);
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 + 3 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'bubble') {
        ctx.globalAlpha = 0.25 + 0.35 * t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'mote') {
        ctx.globalAlpha = 0.25 + 0.45 * t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'text') {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = p.color;
        ctx.font = 'bold 20px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.restore();
  }

  function count() {
    return particles.length;
  }

  return { spawnSpark, spawnRing, spawnBubble, spawnMote, spawnFloatText, update, draw, count };
}
