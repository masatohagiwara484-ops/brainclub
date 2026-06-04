// Verifies the pure cloud-sync reconcile (mirrors mergeProgress in
// src/lib/storage.ts). The merge must never lose a record when signing in on a
// second device: best-of-each. Run: node scripts/verify-cloud.mjs

// --- mirror of mergeProgress ---------------------------------------------------
function mergeProgress(a, b) {
  const ax = a.synapse?.xp ?? -1;
  const bx = b.synapse?.xp ?? -1;
  const synapse = bx > ax ? b.synapse : a.synapse;

  let streak;
  if (a.streak.lastDay === b.streak.lastDay) {
    streak = { lastDay: a.streak.lastDay, count: Math.max(a.streak.count, b.streak.count) };
  } else {
    streak = a.streak.lastDay > b.streak.lastDay ? a.streak : b.streak;
  }

  const bests = { ...a.bests };
  for (const [k, rec] of Object.entries(b.bests || {})) {
    if (!bests[k] || rec.seconds < bests[k].seconds) bests[k] = rec;
  }

  return { synapse, streak, bests, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
}

let failures = 0;
const check = (cond, msg) => {
  if (!cond) {
    console.error('  ✗ ' + msg);
    failures++;
  }
};

const P = (synapse, streak, bests, updatedAt = 0) => ({ synapse, streak, bests, updatedAt });

// Synapse: the higher-XP profile wins (it has more history).
{
  const local = P({ xp: 100, plays: 3 }, { lastDay: '2026-06-01', count: 1 }, {});
  const cloud = P({ xp: 500, plays: 12 }, { lastDay: '2026-06-01', count: 1 }, {});
  check(mergeProgress(local, cloud).synapse.xp === 500, 'synapse: higher xp should win (cloud)');
  check(mergeProgress(cloud, local).synapse.xp === 500, 'synapse: higher xp should win (local)');
}

// Synapse: a null side never overwrites a real profile.
{
  const real = P({ xp: 80 }, { lastDay: '', count: 0 }, {});
  const none = P(null, { lastDay: '', count: 0 }, {});
  check(mergeProgress(none, real).synapse?.xp === 80, 'synapse: real beats null');
  check(mergeProgress(real, none).synapse?.xp === 80, 'synapse: null does not clobber real');
}

// Streak: later day wins; same day keeps the higher count.
{
  const older = P(null, { lastDay: '2026-06-01', count: 9 }, {});
  const newer = P(null, { lastDay: '2026-06-03', count: 2 }, {});
  check(mergeProgress(older, newer).streak.lastDay === '2026-06-03', 'streak: later day wins');
  check(mergeProgress(older, newer).streak.count === 2, 'streak: later day carries its count');

  const sameA = P(null, { lastDay: '2026-06-03', count: 4 }, {});
  const sameB = P(null, { lastDay: '2026-06-03', count: 7 }, {});
  check(mergeProgress(sameA, sameB).streak.count === 7, 'streak: same day keeps higher count');
}

// Bests: union, keeping the fastest per key; unique keys from both survive.
{
  const a = P(null, { lastDay: '', count: 0 }, {
    'cube.3': { seconds: 40, moves: 80, at: 1 },
    'sudoku.easy': { seconds: 200, moves: 0, at: 1 },
  });
  const b = P(null, { lastDay: '', count: 0 }, {
    'cube.3': { seconds: 25, moves: 60, at: 2 }, // faster → should win
    'wordle.5': { seconds: 90, moves: 4, at: 2 }, // only in b → should survive
  });
  const m = mergeProgress(a, b).bests;
  check(m['cube.3'].seconds === 25, 'bests: keeps the faster time');
  check(m['sudoku.easy'].seconds === 200, 'bests: a-only key survives');
  check(m['wordle.5'].seconds === 90, 'bests: b-only key survives');
  check(Object.keys(m).length === 3, 'bests: union has all unique keys');
}

// updatedAt is the max of both.
check(
  mergeProgress(P(null, { lastDay: '', count: 0 }, {}, 5), P(null, { lastDay: '', count: 0 }, {}, 9)).updatedAt === 9,
  'updatedAt: takes the max',
);

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('  ✓ synapse / streak / bests / updatedAt reconcile correctly');
console.log('\nPASS: cloud merge verified.');
