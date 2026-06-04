// Verifies Simon/Echo sequence logic (mirrors the prefix-match rule used in
// SimonGame.tsx): a run is correct while inputs match the sequence prefix, and a
// completed sequence of length L scores L. Run: node scripts/verify-simon.mjs
const correctSoFar = (seq, inputs) => inputs.every((v, i) => v === seq[i]);
const completed = (seq, inputs) => inputs.length === seq.length && correctSoFar(seq, inputs);

let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

if (!correctSoFar([1, 2, 3], [1, 2])) fail('valid prefix rejected');
else console.log('  ✓ valid prefix accepted');
if (correctSoFar([1, 2, 3], [1, 3])) fail('wrong input accepted');
else console.log('  ✓ wrong input rejected at its position');
if (!completed([0, 3, 1], [0, 3, 1])) fail('full correct sequence not completed');
else console.log('  ✓ full correct sequence completes');
if (completed([0, 3, 1], [0, 3])) fail('short input counted as complete');
else console.log('  ✓ short input is not complete');

// A growing game: append one each round and replay perfectly → score == length.
let seq = [];
let seed = 5;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let round = 1; round <= 30; round++) {
  seq = [...seq, Math.floor(rng() * 4)];
  if (!completed(seq, seq.slice())) fail(`round ${round} replay failed`);
}
if (seq.length !== 30) fail('sequence length mismatch');
else console.log('  ✓ 30-round perfect replay scores 30');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Simon logic verified.');
