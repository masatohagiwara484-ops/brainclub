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

// ---- Plan tiers (F3) — mirrors PLAN_RANK / FEATURE_MIN_RANK in monetization.ts.
const PLAN_RANK = { free: 0, plus: 1, pro: 2 };
const FEATURE_MIN_RANK = {
  noAds: 1,
  allSkins: 1,
  themes: 1,
  proStats: 2,
  exclusiveThemes: 2,
  earlyAccess: 2,
};
const planHas = (plan, f) => PLAN_RANK[plan] >= FEATURE_MIN_RANK[f];
const isPaid = (plan) => PLAN_RANK[plan] > 0;
const FEATURES = Object.keys(FEATURE_MIN_RANK);

// Free unlocks nothing and is not paid.
if (isPaid('free')) fail('free should not be a paid tier');
if (FEATURES.some((f) => planHas('free', f))) fail('free tier unlocked a paid feature');
else console.log('  ✓ free tier unlocks nothing and is unpaid');

// Plus = the rank-1 features only; Pro = everything; both paid.
if (!isPaid('plus') || !isPaid('pro')) fail('plus/pro should be paid tiers');
const plusOk = planHas('plus', 'noAds') && planHas('plus', 'allSkins') && planHas('plus', 'themes');
const plusNot = !planHas('plus', 'proStats') && !planHas('plus', 'earlyAccess');
if (!plusOk || !plusNot) fail('plus tier feature set is wrong');
else console.log('  ✓ Plus unlocks ads/skins/themes but not Pro-only features');
if (!FEATURES.every((f) => planHas('pro', f))) fail('pro tier missing a feature');
else console.log('  ✓ Pro unlocks every feature');

// Tiers are nested: anything Plus grants, Pro grants too.
if (!FEATURES.every((f) => !planHas('plus', f) || planHas('pro', f)))
  fail('Pro is not a superset of Plus');
else console.log('  ✓ Pro ⊇ Plus (nested tiers)');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: Monetization rules verified.');
