// beacons.js — the 7 beacons and the Beacon Chain of Ember Reef.
// A beacon lights when the Keeper's score reaches its threshold. Lighting
// beacons in a row without a miss builds the Beacon Chain: each chained
// beacon pays a growing bonus of light and score. One missed shard breaks
// the chain (the beacons stay lit — only the chain resets).
export const BEACON_COUNT = 7;

// beaconThresholds are the score marks that light each beacon, in order.
// Spaced for a two-to-three-minute run: a good catch earns tens of points,
// so the seventh beacon takes sustained play, not one hot streak.
export function beaconThresholds() {
  return [150, 350, 600, 900, 1250, 1650, 2100];
}

// nextBeaconAt returns the score needed for the next unlit beacon, or null
// once all seven burn.
export function nextBeaconAt(beaconsLit) {
  const marks = beaconThresholds();
  if (beaconsLit >= BEACON_COUNT) return null;
  return marks[beaconsLit];
}

// beaconPositions lays the seven beacons across the reef floor.
export function beaconPositions(width, floorY) {
  const spots = [];
  for (let i = 0; i < BEACON_COUNT; i++) {
    spots.push({ x: 90 + (i * (width - 180)) / (BEACON_COUNT - 1), y: floorY });
  }
  return spots;
}

// checkBeaconLit looks at the world after a score change and lights every
// beacon whose mark the score has reached. The live nextBeaconAt field is
// the threshold for the next beacon (it normally equals the next mark in
// beaconThresholds); after lighting, it advances to the following mark.
// The chain bonus is judged on the score the catch itself earned, so a
// bonus can never cascade into lighting the next beacon on its own: the
// chain rewards steady play, it does not win the run by itself. It applies
// the chain bonus for each beacon lit while the chain is unbroken and
// reports what happened so the game can flash, chime and celebrate.
// Returns a list of events.
export function checkBeaconLit(world) {
  const events = [];
  const marks = beaconThresholds();
  const baseScore = world.score;
  let bonusScore = 0;
  let bonusLight = 0;
  while (world.beaconsLit < BEACON_COUNT) {
    const mark =
      typeof world.nextBeaconAt === 'number' && Number.isFinite(world.nextBeaconAt)
        ? world.nextBeaconAt
        : marks[world.beaconsLit];
    if (baseScore < mark) break;
    world.beaconsLit += 1;
    world.chain += 1;
    bonusScore += 15 * world.chain;
    bonusLight += 3 * world.chain;
    world.nextBeaconAt =
      world.beaconsLit < BEACON_COUNT ? marks[world.beaconsLit] : null;
    events.push({
      index: world.beaconsLit - 1,
      chain: world.chain,
      bonusScore: 15 * world.chain,
      bonusLight: 3 * world.chain,
    });
  }
  world.score += bonusScore;
  world.light = Math.min(100, world.light + bonusLight);
  if (world.beaconsLit >= BEACON_COUNT) world.victoryPending = true;
  return events;
}

// breakBeaconChain is called on a miss: the chain resets to zero.
export function breakBeaconChain(world) {
  world.chain = 0;
}
