// Verifies Mastermind peg scoring (mirrors scoreGuess in MastermindGame.tsx),
// including the tricky duplicate-colour cases. Run: node scripts/verify-mastermind.mjs
function scoreGuess(secret, guess) {
  let exact = 0;
  const sRem = [];
  const gRem = [];
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else {
      sRem.push(secret[i]);
      gRem.push(guess[i]);
    }
  }
  const freq = {};
  for (const v of sRem) freq[v] = (freq[v] ?? 0) + 1;
  let color = 0;
  for (const v of gRem) {
    if (freq[v] > 0) {
      color++;
      freq[v]--;
    }
  }
  return { exact, color };
}
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const chk = (s, g, e, c) => {
  const r = scoreGuess(s, g);
  if (r.exact !== e || r.color !== c) fail(`[${s}] vs [${g}] → ${r.exact}/${r.color}, expected ${e}/${c}`);
};

chk([0, 1, 2, 3], [0, 1, 2, 3], 4, 0);
chk([0, 1, 2, 3], [3, 2, 1, 0], 0, 4);
chk([0, 1, 2, 3], [4, 5, 4, 5], 0, 0);
chk([0, 0, 1, 2], [0, 1, 0, 0], 1, 2); // duplicates don't double-count
chk([0, 0, 0, 0], [0, 0, 1, 1], 2, 0); // extra guess dupes find no home
chk([1, 2, 1, 2], [2, 1, 2, 1], 0, 4);
if (!failures) console.log('  ✓ exact/colour scoring correct incl. duplicate colours');

// exact == length ⇒ a full win, always
let winOk = true;
for (let t = 0; t < 100; t++) {
  const code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6));
  if (scoreGuess(code, code).exact !== 4) winOk = false;
}
if (!winOk) fail('identical guess not scored as 4 exact');
else console.log('  ✓ identical guess always scores all-exact');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Mastermind scoring verified.');
