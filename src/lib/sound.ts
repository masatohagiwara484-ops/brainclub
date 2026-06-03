// Tiny WebAudio sound engine — ZERO assets, all tones are synthesized at
// runtime so there is no network cost and nothing to bundle.
//
// Design notes:
// - The AudioContext is created lazily INSIDE a user gesture (browsers block
//   audio that starts without one). Call `sound.unlock()` from the first
//   pointer/key event (FxLayer does this globally).
// - iOS Safari needs `webkitAudioContext` and tends to suspend the context;
//   we `resume()` before every sound.
// - Mute state is persisted under `setting.sound` (true = ON, the default) so
//   the choice survives reloads. iOS still plays audio fine (only haptics are
//   unsupported there).

import { getSetting, setSetting } from './storage';

type AnyAudioContext = typeof AudioContext;

let ctx: AudioContext | null = null;
let enabled = getSetting<boolean>('sound', true);

function ensureCtx(): AudioContext | null {
  if (!enabled) return null;
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC: AnyAudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AnyAudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A single enveloped beep. `when` is an offset (seconds) from now. */
function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  when = 0,
  vol = 0.18,
): void {
  const ac = ensureCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  // Quick attack, smooth exponential release — a soft "blip", never harsh.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** An ascending/descending arpeggio built from `tone()`. */
function arp(freqs: number[], step: number, type: OscillatorType = 'triangle'): void {
  freqs.forEach((f, i) => tone(f, Math.max(step * 1.6, 0.12), type, i * step, 0.16));
}

const C5 = 523.25;

export const sound = {
  setEnabled(v: boolean) {
    enabled = v;
    setSetting('sound', v);
    if (!v && ctx) void ctx.suspend();
    if (v && ctx && ctx.state === 'suspended') void ctx.resume();
  },
  isEnabled() {
    return enabled;
  },
  /** Arm audio from within a user gesture (browsers require this once). */
  unlock() {
    ensureCtx();
  },
  /** Light UI tick. */
  playTick() {
    tone(660, 0.04, 'square', 0, 0.1);
  },
  /** Correct answer — pitch rises with the streak for a dopamine ramp. */
  playCorrect(streak = 0) {
    const semis = Math.min(Math.max(streak, 0), 12);
    tone(C5 * Math.pow(2, semis / 12), 0.1, 'triangle', 0, 0.16);
  },
  /** Wrong / invalid — a soft low buzz, never punishing. */
  playWrong() {
    tone(180, 0.18, 'sawtooth', 0, 0.14);
    tone(120, 0.22, 'sawtooth', 0.04, 0.1);
  },
  /** Win — a bright major arpeggio. */
  playWin() {
    arp([523.25, 659.25, 783.99, 1046.5], 0.09, 'triangle');
  },
  /** Level up — a longer rising flourish. */
  playLevelUp() {
    arp([392, 523.25, 659.25, 783.99, 1046.5], 0.07, 'square');
  },
};
