// combo.js — the combo multiplier and Combo Banking of Ember Reef.
// Consecutive catches grow the multiplier (x1 up to x8); one miss wipes it
// back to x1. Banking is the risk/reward valve: press B (or the BANK button)
// to cash the multiplier in for permanent light plus a score bonus, then
// the multiplier restarts at x1. Hold for a bigger payout, or bank before
// a fast Flood shard ends the streak.
export const COMBO_MAX = 8;

// comboMultiplier turns a consecutive-catch count into the xN multiplier.
export function comboMultiplier(combo) {
  if (combo <= 0) return 1;
  return Math.min(combo, COMBO_MAX);
}

// bankPotential previews what banking right now would pay, for the HUD.
export function bankPotential(combo) {
  const mult = comboMultiplier(combo);
  if (mult <= 1) return { score: 0, light: 0, mult: 1 };
  return { score: 25 * (mult - 1), light: 4 * (mult - 1), mult };
}

// bankCombo cashes the multiplier in: score bonus + light, multiplier reset.
// Returns what was paid (zeros when there is nothing worth banking).
export function bankCombo(world) {
  const preview = bankPotential(world.combo);
  if (preview.score <= 0) return { banked: false, score: 0, light: 0, mult: 1 };
  world.score += preview.score;
  world.light = Math.min(100, world.light + preview.light);
  world.combo = 0;
  world.banks += 1;
  world.bankedTotal += preview.score;
  return { banked: true, score: preview.score, light: preview.light, mult: preview.mult };
}

// registerCatch grows the streak by one after a caught shard.
export function registerCatch(world) {
  world.combo += 1;
}

// registerMiss wipes the streak after a dropped shard.
export function registerMiss(world) {
  world.combo = 0;
}
