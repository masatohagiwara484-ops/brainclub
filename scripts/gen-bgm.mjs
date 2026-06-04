// Generates the two looping BGM tracks as WAV files into public/bgm/:
//   • menu.wav  — a slow, warm chord-pad loop for the menus
//   • game.wav  — a calmer, sparser drone+arpeggio loop for in-game
// Both are seamless (equal-power crossfade across the loop seam) and fully
// synthesized here, so no copyrighted audio is bundled. Drop your own
// public/bgm/menu.wav / game.wav to replace them — the app just loads the files.
//
// The pure helpers (midiToFreq / wavPCM16 / crossfadeLoop) are exported so
// scripts/verify-sound.mjs can assert them. Run: node scripts/gen-bgm.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Equal-power seamless loop: input has N+fade samples; returns N with the
 *  overlap region (the natural continuation) blended onto the head, so out[N-1]
 *  flows into out[0] without a click. */
export function crossfadeLoop(samples, n, fade) {
  const out = samples.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    const wHead = Math.sin(0.5 * Math.PI * t); // 0 → 1
    const wTail = Math.cos(0.5 * Math.PI * t); // 1 → 0
    out[i] = samples[i] * wHead + samples[n + i] * wTail;
  }
  return out;
}

/** Encode mono Float32 (-1..1) as a 16-bit PCM WAV (44-byte header + data). */
export function wavPCM16(float32, sampleRate) {
  const n = float32.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits/sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    buf.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, 44 + i * 2);
  }
  return buf;
}

// ---- track synthesis ----------------------------------------------------------

const SR = 22050;

// A soft sine voice with a slow bell-ish envelope over its note window.
function addNote(out, sr, startT, durT, freq, gain) {
  const a = 0.18 * durT; // attack
  const r = 0.5 * durT; // release tail
  const i0 = Math.floor(startT * sr);
  const i1 = Math.min(out.length, Math.floor((startT + durT + r) * sr));
  for (let i = i0; i < i1; i++) {
    const t = i / sr - startT;
    let env;
    if (t < a) env = t / a;
    else env = Math.max(0, 1 - (t - a) / (durT - a + r));
    // gentle 0.15 Hz tremolo for movement
    const trem = 0.9 + 0.1 * Math.sin(2 * Math.PI * 0.15 * (i / sr));
    out[i] += gain * env * trem * Math.sin(2 * Math.PI * freq * (i / sr));
  }
}

function normalize(out, peak = 0.7) {
  let max = 1e-9;
  for (const v of out) max = Math.max(max, Math.abs(v));
  const k = peak / max;
  for (let i = 0; i < out.length; i++) out[i] *= k;
}

// chords as MIDI sets; one chord per `chordDur` seconds, looped.
function renderPadLoop({ chords, loopDur, chordDur, fade, octave = 0, voiceGain = 0.5 }) {
  const total = loopDur + fade;
  const out = new Float32Array(Math.ceil(total * SR));
  let t = 0;
  let ci = 0;
  while (t < total) {
    const chord = chords[ci % chords.length];
    for (const m of chord) addNote(out, SR, t, chordDur, midiToFreq(m + 12 * octave), voiceGain / chord.length);
    t += chordDur;
    ci++;
  }
  normalize(out, 0.6);
  return crossfadeLoop(out, Math.round(loopDur * SR), Math.round(fade * SR));
}

function buildMenu() {
  // Cmaj7 → Am7 → Fmaj7 → G — warm and slow.
  return renderPadLoop({
    chords: [
      [48, 52, 55, 59],
      [45, 52, 57, 60],
      [41, 48, 53, 57],
      [43, 50, 55, 59],
    ],
    loopDur: 12,
    chordDur: 3,
    fade: 0.6,
  });
}

function buildGame() {
  // Sparser A-minor drone with a slow pentatonic arpeggio woven in.
  const loopDur = 12;
  const fade = 0.6;
  const out = new Float32Array(Math.ceil((loopDur + fade) * SR));
  // sustained low drone (A2 + E3)
  for (const m of [45, 52]) addNote(out, SR, 0, loopDur + fade, midiToFreq(m), 0.18);
  // slow arpeggio, one note every 1.5s
  const arp = [57, 60, 64, 67, 64, 60, 69, 64];
  for (let i = 0; i < arp.length; i++) addNote(out, SR, i * 1.5, 1.4, midiToFreq(arp[i]), 0.32);
  normalize(out, 0.55);
  return crossfadeLoop(out, Math.round(loopDur * SR), Math.round(fade * SR));
}

// Run directly → write the files.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'bgm');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'menu.wav'), wavPCM16(buildMenu(), SR));
  writeFileSync(join(dir, 'game.wav'), wavPCM16(buildGame(), SR));
  console.log('Wrote public/bgm/menu.wav and public/bgm/game.wav');
}
