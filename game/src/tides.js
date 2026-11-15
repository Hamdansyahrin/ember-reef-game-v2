// tides.js — the Tide Phase system of Ember Reef.
// The reef breathes in three phases that cycle as the run goes on. Each
// phase changes how fast shards fall, how often they spawn, what they are
// worth, and the mood of the water itself (palette + waterline height).
// The HUD shows the phase name and the seconds until the next shift.
export const TIDE_PHASES = [
  {
    name: 'Calm',
    length: 20,
    speedMult: 1.0,
    spawnInterval: 0.95,
    valueMult: 1.0,
    waterline: 96,
    deep: '#062a33',
    mid: '#0a3d47',
    glow: '#37e0c8',
    label: 'Calm waters — learn the drift',
  },
  {
    name: 'Surge',
    length: 25,
    speedMult: 1.35,
    spawnInterval: 0.68,
    valueMult: 1.25,
    waterline: 150,
    deep: '#0a2438',
    mid: '#0e3a5c',
    glow: '#5ec8ff',
    label: 'Surge — faster falls, richer shards',
  },
  {
    name: 'Flood',
    length: 30,
    speedMult: 1.7,
    spawnInterval: 0.5,
    valueMult: 1.5,
    waterline: 216,
    deep: '#160b38',
    mid: '#2a1258',
    glow: '#c98cff',
    label: 'Flood — hold on, everything is worth more',
  },
];

// tideCycleLength is the full Calm -> Surge -> Flood loop in seconds.
export function tideCycleLength() {
  return TIDE_PHASES.reduce((sum, p) => sum + p.length, 0);
}

// tideForTime maps elapsed play seconds onto the current phase plus how
// long until the next phase begins. Pure: same time, same tide, always.
export function tideForTime(elapsed) {
  const cycle = tideCycleLength();
  let t = ((elapsed % cycle) + cycle) % cycle;
  for (let i = 0; i < TIDE_PHASES.length; i++) {
    const phase = TIDE_PHASES[i];
    if (t < phase.length) {
      return {
        index: i,
        phase,
        elapsedInPhase: t,
        endsIn: phase.length - t,
        nextName: TIDE_PHASES[(i + 1) % TIDE_PHASES.length].name,
      };
    }
    t -= phase.length;
  }
  return { index: 0, phase: TIDE_PHASES[0], elapsedInPhase: 0, endsIn: TIDE_PHASES[0].length, nextName: TIDE_PHASES[1].name };
}

// tideProgress returns 0..1 through the current phase for HUD bars.
export function tideProgress(elapsed) {
  const info = tideForTime(elapsed);
  return info.elapsedInPhase / info.phase.length;
}
