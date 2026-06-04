// Verifies the Synapse profile math without a TS runtime:
//   1. Level ↔ XP are consistent inverses, and level never decreases as XP grows.
//   2. Axis values always stay within [0, 100].
//   3. An axis converges toward 100·quality when a game taps it repeatedly.
//   4. Axis updates respect the weights (a .8 axis moves 4× a .2 axis).
//   5. synapseScore is the mean of the three axes.
//   6. Untapped axes stay at 0; plays/xp accumulate.
// Mirrors the core of src/lib/synapse.ts (no TS import, per repo convention).
// Run: node scripts/verify-synapse.mjs

const ALPHA = 0.3;
const XP_BASE = 40;
const XP_QUALITY = 60;
const AXES = ['memory', 'logic', 'reflex'];

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const clamp100 = (x) => (x < 0 ? 0 : x > 100 ? 100 : x);

function xpForLevel(level) {
  return 50 * level * (level - 1);
}
function levelForXp(xp) {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));
}
function synapseScore(p) {
  return Math.round((p.memory + p.logic + p.reflex) / 3);
}
function normalizeWeights(axes) {
  const total = AXES.reduce((s, a) => s + Math.max(0, axes[a] ?? 0), 0);
  const out = { memory: 0, logic: 0, reflex: 0 };
  if (total <= 0) return out;
  for (const a of AXES) out[a] = Math.max(0, axes[a] ?? 0) / total;
  return out;
}
function emptyProfile() {
  return { memory: 0, logic: 0, reflex: 0, plays: 0, xp: 0, level: 1, updatedAt: 0 };
}
function applyPlay(profile, axes, quality, weight = 1) {
  const q = clamp01(quality);
  const w = normalizeWeights(axes);
  const target = 100 * q;
  const next = { ...profile };
  for (const a of AXES) next[a] = clamp100(profile[a] + ALPHA * w[a] * (target - profile[a]));
  next.plays = profile.plays + 1;
  next.xp = profile.xp + Math.round((XP_BASE + XP_QUALITY * q) * Math.max(0, weight));
  next.level = levelForXp(next.xp);
  return next;
}

let failures = 0;
const fail = (msg) => {
  console.error('  ✗ ' + msg);
  failures++;
};
const approx = (a, b, tol) => Math.abs(a - b) <= tol;

// 1. Level ↔ XP inverses + monotonicity.
let levelOk = true;
for (let L = 1; L <= 60; L++) {
  if (levelForXp(xpForLevel(L)) !== L) levelOk = false;
  if (L > 1 && levelForXp(xpForLevel(L) - 1) !== L - 1) levelOk = false;
}
if (!levelOk) fail('level ↔ xp are not consistent inverses');
else console.log('  ✓ level ↔ xp consistent for levels 1–60');

let prevLevel = 1;
let mono = true;
for (let xp = 0; xp <= 200000; xp += 37) {
  const L = levelForXp(xp);
  if (L < prevLevel) mono = false;
  prevLevel = L;
}
if (!mono) fail('level decreased as xp increased');
else console.log('  ✓ level is monotonic in xp');

// 2. Axes stay in range over a long random run.
let p = emptyProfile();
let inRange = true;
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const SAMPLE = [
  { memory: 0.4, logic: 0.5, reflex: 0.1 },
  { logic: 0.8, memory: 0.2 },
  { reflex: 0.8, logic: 0.2 },
  { memory: 0.3, logic: 0.4, reflex: 0.3 },
];
for (let i = 0; i < 5000; i++) {
  p = applyPlay(p, SAMPLE[i % SAMPLE.length], rnd() * 1.3 - 0.15, rnd() * 2);
  for (const a of AXES) if (p[a] < 0 || p[a] > 100) inRange = false;
}
if (!inRange) fail('an axis left the [0,100] range');
else console.log('  ✓ axes stay within [0,100] over 5000 mixed plays');
if (p.plays !== 5000) fail(`plays miscounted: ${p.plays}`);
else if (p.xp <= 0) fail('xp did not accumulate');
else console.log(`  ✓ accumulation: plays=${p.plays}, xp=${p.xp}, level=${p.level}`);

// 3. Convergence: a logic-only game at q=0.9 drives logic → ~90, others stay 0.
let c = emptyProfile();
for (let i = 0; i < 200; i++) c = applyPlay(c, { logic: 1 }, 0.9, 1);
if (!approx(c.logic, 90, 1)) fail(`logic did not converge to 90 (got ${c.logic.toFixed(2)})`);
else console.log(`  ✓ logic converges to ~90 (${c.logic.toFixed(2)})`);
if (c.memory !== 0 || c.reflex !== 0) fail('untapped axes drifted from 0');
else console.log('  ✓ untapped axes stay at 0');

// 4. Weights respected: from zero, a single play's deltas track the ratio .8/.2.
const one = applyPlay(emptyProfile(), { logic: 0.8, memory: 0.2 }, 1, 1);
const ratio = one.logic / one.memory;
if (!approx(ratio, 4, 0.05)) fail(`weight ratio off: logic/memory = ${ratio.toFixed(3)} (expected ~4)`);
else console.log(`  ✓ axis deltas track weights (logic/memory = ${ratio.toFixed(2)})`);

// 5. synapseScore is the mean.
const mp = { memory: 30, logic: 60, reflex: 90, plays: 1, xp: 0, level: 1, updatedAt: 0 };
if (synapseScore(mp) !== 60) fail(`synapseScore != mean (got ${synapseScore(mp)})`);
else console.log('  ✓ synapseScore is the mean of the three axes');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: Synapse logic verified.');
