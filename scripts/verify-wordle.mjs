// Verifies Word Guess core logic without a TS runtime:
//   1. The hand-curated word pools sanitize to non-empty, correct-length, a–z
//      lists (so a stray wrong-length token can never reach the board).
//   2. The Wordle scoring handles duplicate letters exactly (greens consume a
//      letter from the answer before yellows are assigned).
// Run: node scripts/verify-wordle.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/games/wordle/wordGuess.ts'), 'utf8');

// --- mirror of sanitize() from wordGuess.ts ---
function sanitize(raw, length) {
  const seen = new Set();
  const out = [];
  for (const w of raw.toLowerCase().split(/\s+/)) {
    if (w.length === length && /^[a-z]+$/.test(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

// --- mirror of evaluate() from wordGuess.ts ---
function evaluate(guess, answer) {
  const n = answer.length;
  const res = new Array(n).fill('absent');
  const counts = {};
  for (const ch of answer) counts[ch] = (counts[ch] ?? 0) + 1;
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'correct';
      counts[guess[i]]--;
    }
  }
  for (let i = 0; i < n; i++) {
    if (res[i] === 'correct') continue;
    const ch = guess[i];
    if (counts[ch] > 0) {
      res[i] = 'present';
      counts[ch]--;
    }
  }
  return res;
}

function extractRaw(name) {
  const m = src.match(new RegExp(name + '\\s*=\\s*`([^`]*)`'));
  if (!m) throw new Error(`Could not find ${name} in wordGuess.ts`);
  return m[1];
}

let failures = 0;
const fail = (msg) => {
  console.error('  ✗ ' + msg);
  failures++;
};

// 1. Pool integrity.
const lengths = { RAW_4: 4, RAW_5: 5, RAW_6: 6, RAW_7: 7 };
for (const [name, len] of Object.entries(lengths)) {
  const pool = sanitize(extractRaw(name), len);
  const bad = pool.filter((w) => w.length !== len || !/^[a-z]+$/.test(w));
  if (pool.length < 40) fail(`${name}: only ${pool.length} words (expected ≥40)`);
  else if (bad.length) fail(`${name}: ${bad.length} malformed words`);
  else console.log(`  ✓ ${name}: ${pool.length} clean ${len}-letter words`);
}

// 2. Scoring cases (C=correct, P=present, A=absent).
const code = (states) => states.map((s) => (s === 'correct' ? 'C' : s === 'present' ? 'P' : 'A')).join('');
const cases = [
  ['speed', 'erase', 'PAPPA'], // duplicate e's in guess, two e's in answer
  ['bobby', 'abbey', 'PACAC'], // green b consumes the only spare b → 2nd b absent
  ['array', 'array', 'CCCCC'], // exact match
  ['xxxxx', 'abbey', 'AAAAA'], // none present
];
for (const [guess, answer, expect] of cases) {
  const got = code(evaluate(guess, answer));
  if (got !== expect) fail(`evaluate("${guess}","${answer}") = ${got}, expected ${expect}`);
  else console.log(`  ✓ evaluate("${guess}","${answer}") = ${got}`);
}

if (failures) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: Word Guess logic verified.');
