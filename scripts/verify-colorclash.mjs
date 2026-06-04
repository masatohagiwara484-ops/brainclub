// Verifies ColorClash round generation without a TS runtime:
//   1. Every round's options INCLUDE the correct ink color and the tempting
//      word color, are unique, and have the expected length.
//   2. The displayed word never matches its ink (interference always present).
//   3. The correct-answer (ink) distribution is roughly uniform — no color is
//      systematically easier/harder to land on.
// Mirrors mulberry32 + makeRound (no TS import, per repo convention).
// Run: node scripts/verify-colorclash.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/games/colorclash/colorClash.ts'), 'utf8');

// --- mirror of makeRng() from lib/daily.ts ---
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRound(rng, count, ids) {
  const n = Math.min(count, ids.length);
  const shuffled = shuffle(ids, rng);
  const ink = shuffled[0];
  const word = shuffled[1];
  const chosen = new Set([ink, word]);
  let i = 2;
  while (chosen.size < n && i < shuffled.length) chosen.add(shuffled[i++]);
  return { word, ink, options: shuffle([...chosen], rng) };
}

// --- pull the palette ids and option counts straight from source ---
const colorsBlock = src.slice(src.indexOf('COLORS:'), src.indexOf('export function colorById'));
const ids = [...colorsBlock.matchAll(/id:\s*'(\w+)'/g)].map((m) => m[1]);
const optionCounts = [...src.matchAll(/optionCount:\s*(\d+)/g)].map((m) => Number(m[1]));

let failures = 0;
const fail = (msg) => {
  console.error('  ✗ ' + msg);
  failures++;
};

if (ids.length < 4) fail(`expected ≥4 colors, found ${ids.length}`);
else console.log(`  ✓ palette: ${ids.length} colors [${ids.join(', ')}]`);
if (!optionCounts.length) fail('no optionCount values found in TUNING');

// 1 + 2. Structural invariants across all difficulties and many seeds.
const tally = Object.fromEntries(ids.map((id) => [id, 0]));
const ROUNDS = 6000;
for (const count of optionCounts) {
  const expectLen = Math.min(count, ids.length);
  let ok = 0;
  for (let s = 0; s < ROUNDS; s++) {
    const rng = makeRng((s * 2654435761) >>> 0);
    const r = makeRound(rng, count, ids);
    const uniq = new Set(r.options);
    const valid =
      r.word !== r.ink &&
      r.options.includes(r.ink) &&
      r.options.includes(r.word) &&
      uniq.size === r.options.length &&
      r.options.length === expectLen &&
      r.options.every((id) => ids.includes(id));
    if (valid) ok++;
    if (count === ids.length) tally[r.ink]++;
  }
  if (ok !== ROUNDS) fail(`optionCount=${count}: ${ROUNDS - ok}/${ROUNDS} rounds violated invariants`);
  else console.log(`  ✓ optionCount=${count}: ${ROUNDS} rounds valid (len=${expectLen})`);
}

// 3. Ink distribution roughly uniform (at full palette).
const exp = ROUNDS / ids.length;
const tol = exp * 0.25;
const skew = Object.entries(tally).filter(([, n]) => Math.abs(n - exp) > tol);
if (skew.length) fail(`ink distribution skewed: ${skew.map(([k, n]) => `${k}=${n}`).join(', ')} (expected ~${Math.round(exp)})`);
else console.log(`  ✓ ink distribution uniform (~${Math.round(exp)} each, ±25%)`);

if (failures) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: ColorClash logic verified.');
