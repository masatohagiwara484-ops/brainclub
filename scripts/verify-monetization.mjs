// Verifies the pure monetization ownership/skin rules without a TS runtime:
//   1. 'default' is always owned (free), even with an empty owned list.
//   2. Buying a skin unlocks it (idempotent, order-stable).
//   3. A non-owned, non-premium skin cannot be applied.
//   4. Premium implies every skin is owned/applicable.
//   5. Premium-only skins are locked for free users until bought, applicable once premium.
// Mirrors the core of src/lib/monetization.ts (no TS import, per repo convention).
// Run: node scripts/verify-monetization.mjs

const SKIN_IDS = ['default', 'sunset', 'ocean', 'forest', 'aurora', 'mono'];
const PREMIUM_ONLY = ['aurora', 'mono'];
const DEFAULT_OWNED = ['default'];

function effectiveOwned(owned, premium) {
  if (premium) return [...SKIN_IDS];
  const set = new Set([...DEFAULT_OWNED, ...owned]);
  return SKIN_IDS.filter((id) => set.has(id));
}
function canApply(skin, owned, premium) {
  return effectiveOwned(owned, premium).includes(skin);
}
function nextOwned(owned, skin) {
  return owned.includes(skin) ? owned : [...owned, skin];
}

let failures = 0;
const fail = (msg) => {
  console.error('  ✗ ' + msg);
  failures++;
};
const eqArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// 1. default always owned.
if (!canApply('default', [], false)) fail('default not owned for a fresh free user');
else console.log('  ✓ default skin is always owned (free)');

// 2. Buying unlocks; idempotent + order-stable.
let owned = [...DEFAULT_OWNED];
owned = nextOwned(owned, 'ocean');
if (!owned.includes('ocean')) fail('buying ocean did not add it');
else console.log('  ✓ buying a skin adds it to owned');
const again = nextOwned(owned, 'ocean');
if (!eqArr(again, owned)) fail('buying the same skin twice changed the list');
else console.log('  ✓ buying is idempotent and order-stable');
if (!canApply('ocean', owned, false)) fail('bought skin not applicable');
else console.log('  ✓ a bought skin is applicable');

// 3. Non-owned, non-premium skin cannot be applied.
if (canApply('sunset', DEFAULT_OWNED, false)) fail('un-bought skin was applicable');
else console.log('  ✓ un-bought skin cannot be applied (free)');

// 4. Premium owns everything.
const all = effectiveOwned([], true);
if (!eqArr(all, SKIN_IDS)) fail('premium did not unlock every skin');
else console.log('  ✓ premium unlocks every skin');
let allApplicable = true;
for (const id of SKIN_IDS) if (!canApply(id, [], true)) allApplicable = false;
if (!allApplicable) fail('premium user could not apply some skin');
else console.log('  ✓ premium user can apply any skin');

// 5. Premium-only skins are gated for free users, open once premium.
let gated = true;
for (const id of PREMIUM_ONLY) if (canApply(id, DEFAULT_OWNED, false)) gated = false;
if (!gated) fail('premium-only skin applicable to a free user');
else console.log('  ✓ premium-only skins are gated for free users');
for (const id of PREMIUM_ONLY) if (!canApply(id, [], true)) fail(`premium-only ${id} not applicable when premium`);

if (failures) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: Monetization rules verified.');
