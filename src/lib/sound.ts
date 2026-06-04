// WebAudio sound engine.
//
// • SFX (ticks / wins / clicks) are synthesized at runtime — zero assets.
// • BGM is two looping WAV files in public/bgm/ (menu.wav, game.wav), loaded on
//   demand and crossfaded when the route changes between menus and gameplay.
//   They are fully synthesized by scripts/gen-bgm.mjs (no copyrighted audio);
//   drop your own files at those paths to replace them.
//
// Routing of the graph:  sfx tones ─┐
//                                   ├─> master gain (volume) ─> destination
//                      bgm source ─ bgmGain ┘
//
// Design notes:
// - The AudioContext is created lazily inside a user gesture. Call unlock() from
//   the first pointer/key event (FxLayer does this globally).
// - iOS needs webkitAudioContext and tends to suspend; we resume() as needed.
// - SFX on/off  → setting.sound (default ON).  BGM on/off → setting.bgm (default
//   OFF). Master volume → setting.volume (0..1). The two toggles are independent
//   so BGM can play with SFX muted and vice-versa.

import { getSetting, setSetting } from './storage';

type AnyAudioContext = typeof AudioContext;
export type BgmTrack = 'menu' | 'game';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = getSetting<boolean>('sound', true); // SFX
let bgmEnabled = getSetting<boolean>('bgm', false);
let volume = clamp01(getSetting<number>('volume', 0.7));

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function ensureCtx(): AudioContext | null {
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
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A single enveloped beep, routed through the master gain. */
function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  when = 0,
  vol = 0.18,
): void {
  if (!enabled) return;
  const ac = ensureCtx();
  if (!ac || !master) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** An ascending/descending arpeggio built from `tone()`. */
function arp(freqs: number[], step: number, type: OscillatorType = 'triangle'): void {
  freqs.forEach((f, i) => tone(f, Math.max(step * 1.6, 0.12), type, i * step, 0.16));
}

const C5 = 523.25;

// ---- BGM (looping files, crossfaded) ------------------------------------------

const BGM_LEVEL = 0.5; // BGM sits below SFX
const bgmBuffers = new Map<BgmTrack, AudioBuffer>();
let bgmCur: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let bgmTrack: BgmTrack | null = null;

async function loadBuffer(track: BgmTrack, ac: AudioContext): Promise<AudioBuffer | null> {
  const cached = bgmBuffers.get(track);
  if (cached) return cached;
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}bgm/${track}.wav`);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = await ac.decodeAudioData(arr);
    bgmBuffers.set(track, buf);
    return buf;
  } catch {
    return null;
  }
}

function fadeOut(node: { src: AudioBufferSourceNode; gain: GainNode }, ac: AudioContext, secs: number) {
  const now = ac.currentTime;
  node.gain.gain.cancelScheduledValues(now);
  node.gain.gain.setValueAtTime(Math.max(0.0001, node.gain.gain.value), now);
  node.gain.gain.exponentialRampToValueAtTime(0.0001, now + secs);
  const s = node.src;
  window.setTimeout(() => {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  }, secs * 1000 + 80);
}

async function startBgm(track: BgmTrack): Promise<void> {
  if (!bgmEnabled) return;
  const ac = ensureCtx();
  if (!ac || !master) return;
  if (bgmTrack === track && bgmCur) return; // already on this track
  bgmTrack = track;
  const buf = await loadBuffer(track, ac);
  if (!buf || !master || bgmTrack !== track || !bgmEnabled) return; // raced / disabled
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(BGM_LEVEL, ac.currentTime + 1.2);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gain).connect(master);
  src.start();
  if (bgmCur) fadeOut(bgmCur, ac, 1.2);
  bgmCur = { src, gain };
}

function stopBgm(): void {
  bgmTrack = null;
  const cur = bgmCur;
  bgmCur = null;
  if (cur && ctx) fadeOut(cur, ctx, 0.4);
}

export const sound = {
  // ---- SFX toggle ----
  setEnabled(v: boolean) {
    enabled = v;
    setSetting('sound', v);
  },
  isEnabled() {
    return enabled;
  },

  // ---- Master volume (affects SFX + BGM) ----
  setVolume(v: number) {
    volume = clamp01(v);
    setSetting('volume', volume);
    if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  },
  getVolume() {
    return volume;
  },

  // ---- BGM ----
  isBgm() {
    return bgmEnabled;
  },
  setBgm(v: boolean) {
    bgmEnabled = v;
    setSetting('bgm', v);
    if (!v) stopBgm();
    // turning on is handled by the route-aware controller calling playBgm()
  },
  /** Switch BGM to the track for the current screen (menu vs game). */
  playBgm(track: BgmTrack) {
    void startBgm(track);
  },
  stopBgm() {
    stopBgm();
  },

  /** Arm audio from within a user gesture (browsers require this once). */
  unlock() {
    ensureCtx();
  },
  /** Pause/resume the whole graph (used when the tab is hidden). */
  setSuspended(suspended: boolean) {
    if (!ctx) return;
    if (suspended && ctx.state === 'running') void ctx.suspend();
    if (!suspended && ctx.state === 'suspended') void ctx.resume();
  },

  // ---- SFX ----
  /** Light UI tick. */
  playTick() {
    tone(660, 0.04, 'square', 0, 0.1);
  },
  /** Selecting a game from the grid — a bright two-step rise. */
  playSelectGame() {
    tone(523.25, 0.06, 'triangle', 0, 0.14);
    tone(783.99, 0.09, 'triangle', 0.06, 0.14);
  },
  /** Selecting a difficulty — a firmer, lower confirm. */
  playSelectDifficulty() {
    tone(392, 0.07, 'square', 0, 0.12);
    tone(587.33, 0.12, 'triangle', 0.05, 0.14);
  },
  /** Switching bottom-nav tabs — a soft, short high tick. */
  playTab() {
    tone(880, 0.035, 'sine', 0, 0.09);
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
  /** A single sustained pad tone at a given frequency (used by Simon). */
  playNote(freq: number, dur = 0.18) {
    tone(freq, dur, 'triangle', 0, 0.16);
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
