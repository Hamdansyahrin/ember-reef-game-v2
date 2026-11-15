// audio.js — WebAudio synth sounds for Ember Reef.
// No audio files: every sound is a small oscillator/envelope patch built at
// play time, so the game ships zero sound assets and makes no network call.
// The context is created lazily on the first user gesture; every call is
// guarded so a headless or muted browser never throws.
export function createAudio() {
  const state = { ctx: null, muted: false, master: null };

  function ensureContext() {
    if (state.ctx) return state.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      state.ctx = new AC();
      state.master = state.ctx.createGain();
      state.master.gain.value = 0.22;
      state.master.connect(state.ctx.destination);
    } catch (e) {
      state.ctx = null;
    }
    return state.ctx;
  }

  // unlock resumes a suspended context after a real gesture.
  function unlock() {
    const ctx = ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // tone plays one oscillator note with a decaying envelope.
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (state.muted) return;
    const ctx = ensureContext();
    if (!ctx || !state.master) return;
    try {
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(state.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) {
      /* sound is decoration; never break the game */
    }
  }

  // playCatch rises in pitch with the combo so streaks feel rewarding.
  function playCatch(combo) {
    const step = Math.min(combo || 1, 12);
    tone(520 + step * 42, 0.14, 'sine', 0.55);
    tone(780 + step * 42, 0.1, 'triangle', 0.25, null, 0.02);
  }

  // playMiss is a low dull thud: the streak just broke.
  function playMiss() {
    tone(180, 0.22, 'sawtooth', 0.28, 70);
  }

  // playFlare sweeps upward like a lantern being thrown open.
  function playFlare() {
    tone(240, 0.45, 'sine', 0.5, 980);
    tone(120, 0.4, 'triangle', 0.3, 480, 0.03);
  }

  // playBank is a bright two-coin clink when a combo is banked.
  function playBank() {
    tone(880, 0.12, 'square', 0.22);
    tone(1318, 0.2, 'square', 0.22, null, 0.09);
  }

  // playBeacon chimes a rising arpeggio; higher chain, higher top note.
  function playBeacon(chain) {
    const base = 523.25;
    const lift = Math.min(chain || 0, 6) * 40;
    tone(base, 0.3, 'sine', 0.5);
    tone(base * 1.25, 0.3, 'sine', 0.45, null, 0.09);
    tone(base * 1.5 + lift, 0.45, 'sine', 0.5, null, 0.18);
  }

  // playVictory runs a short major arpeggio for lighting all 7 beacons.
  function playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => tone(f, 0.5, 'triangle', 0.4, null, i * 0.12));
  }

  // playGameOver sinks down as the reef goes dark.
  function playGameOver() {
    tone(392, 0.5, 'sine', 0.4, 196);
    tone(262, 0.8, 'sine', 0.35, 98, 0.25);
  }

  // playClick is the soft tick for menus and buttons.
  function playClick() {
    tone(700, 0.06, 'square', 0.15);
  }

  function setMuted(muted) {
    state.muted = !!muted;
  }

  function isMuted() {
    return state.muted;
  }

  return {
    unlock,
    playCatch,
    playMiss,
    playFlare,
    playBank,
    playBeacon,
    playVictory,
    playGameOver,
    playClick,
    setMuted,
    isMuted,
  };
}
