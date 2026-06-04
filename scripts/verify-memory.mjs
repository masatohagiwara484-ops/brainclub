// Verifies Memory Match deck building (mirrors makeDeck in MemoryGame.tsx):
// every face appears exactly twice. Run: node scripts/verify-memory.mjs
function makeDeck(pairs, rng) {
  const deck = [];
  for (let i = 0; i < pairs; i++) deck.push(i, i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
let seed = 42;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

let ok = true;
for (const pairs of [6, 8, 10, 12]) {
  for (let t = 0; t < 200; t++) {
    const deck = makeDeck(pairs, rng);
    if (deck.length !== pairs * 2) ok = false;
    const counts = {};
    for (const v of deck) counts[v] = (counts[v] ?? 0) + 1;
    for (let i = 0; i < pairs; i++) if (counts[i] !== 2) ok = false;
  }
}
if (!ok) fail('a face did not appear exactly twice');
else console.log('  ✓ every face appears exactly twice (6/8/10/12 pairs)');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Memory Match deck verified.');
