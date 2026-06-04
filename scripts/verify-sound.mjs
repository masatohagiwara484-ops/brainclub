// Verifies the pure audio helpers behind the BGM generator (gen-bgm.mjs):
// note→frequency math, the WAV PCM-16 header, and the seamless loop crossfade.
// Run: node scripts/verify-sound.mjs
import { midiToFreq, wavPCM16, crossfadeLoop } from './gen-bgm.mjs';

let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// A4 = 440, and an octave up doubles the frequency.
if (!near(midiToFreq(69), 440)) fail(`midiToFreq(69) = ${midiToFreq(69)}, expected 440`);
if (!near(midiToFreq(81), 880, 1e-6)) fail(`midiToFreq(81) = ${midiToFreq(81)}, expected 880`);
if (!near(midiToFreq(57), 220, 1e-6)) fail(`midiToFreq(57) = ${midiToFreq(57)}, expected 220`);
if (!failures) console.log('  ✓ midiToFreq: A4=440 and octaves double');

// WAV header: 44-byte preamble, RIFF/WAVE/fmt /data tags, PCM mono 16-bit.
const wav = wavPCM16(new Float32Array([0, 0.5, -0.5, 1, -1]), 22050);
if (wav.length !== 44 + 5 * 2) fail(`wav length ${wav.length}, expected ${44 + 10}`);
if (wav.toString('ascii', 0, 4) !== 'RIFF') fail('missing RIFF tag');
if (wav.toString('ascii', 8, 12) !== 'WAVE') fail('missing WAVE tag');
if (wav.toString('ascii', 12, 16) !== 'fmt ') fail('missing fmt chunk');
if (wav.toString('ascii', 36, 40) !== 'data') fail('missing data chunk');
if (wav.readUInt16LE(20) !== 1) fail('format is not PCM');
if (wav.readUInt16LE(22) !== 1) fail('not mono');
if (wav.readUInt16LE(34) !== 16) fail('not 16-bit');
if (wav.readUInt32LE(24) !== 22050) fail('wrong sample rate');
if (wav.readUInt32LE(40) !== 5 * 2) fail('wrong data size');
if (wav.readInt16LE(44 + 3 * 2) !== 0x7fff) fail('full-scale +1 sample not clamped to 0x7fff');
if (!failures) console.log('  ✓ wavPCM16: valid 44-byte PCM mono/16-bit header');

// crossfadeLoop on a ramp of length n+fade → length n, seam is continuous:
// out[0] should equal the natural continuation (samples[n]) so out[n-1]→out[0]
// has the same step as everywhere else (no click).
const n = 100;
const fade = 20;
const ramp = new Float32Array(n + fade);
for (let i = 0; i < ramp.length; i++) ramp[i] = i / (n + fade); // smooth rising
const looped = crossfadeLoop(ramp, n, fade);
if (looped.length !== n) fail(`crossfadeLoop length ${looped.length}, expected ${n}`);
if (!near(looped[0], ramp[n], 1e-9)) fail('seam head does not equal the natural continuation');
const interiorStep = looped[50] - looped[49];
const seamStep = looped[0] - looped[n - 1]; // the step taken when the loop wraps
// The wrap step should match a normal step (continuous), not a big jump/click.
if (Math.abs(seamStep - interiorStep) > 1e-9)
  fail(`seam is discontinuous (seamStep≈${seamStep.toFixed(5)} vs ${interiorStep.toFixed(5)})`);
if (!failures) console.log('  ✓ crossfadeLoop: length trimmed and the loop seam is continuous');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: audio helpers verified.');
