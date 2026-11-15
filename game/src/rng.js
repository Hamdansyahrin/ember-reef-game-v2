// rng.js — seeded random numbers for Ember Reef.
// Every random choice in the game flows through one mulberry32 stream so a
// given seed always plays the same reef: same shard order, same sway, same
// sparkle. No Math.random anywhere in gameplay code.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// makeRng builds the game's single stream from a seed taken from the URL
// (?seed=) or the default. Seeds arrive as strings; hash them first.
export function makeRng(seedValue) {
  let seed = 1;
  if (typeof seedValue === 'number' && Number.isFinite(seedValue)) {
    seed = Math.floor(seedValue);
  } else if (typeof seedValue === 'string' && seedValue.length > 0) {
    let h = 2166136261;
    for (let i = 0; i < seedValue.length; i++) {
      h ^= seedValue.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    seed = h;
  }
  return mulberry32(seed);
}

// range returns a float in [min, max) from the stream.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// rangeInt returns an integer in [min, max] from the stream.
export function rangeInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// pick returns one element of a non-empty array, uniformly.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// chance rolls true with probability p (0..1).
export function chance(rng, p) {
  return rng() < p;
}
