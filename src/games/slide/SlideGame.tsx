import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import ProgressResultModal from '../../components/ProgressResultModal';
import { useShareMsg } from '../shareHook';

const AXES = getGame('slide')?.axes ?? {};
const SIZE: Record<string, number> = { easy: 3, medium: 3, hard: 4, expert: 5 };
const SCRAMBLE: Record<string, number> = { easy: 40, medium: 80, hard: 140, expert: 220 };

// 0 represents the blank. Solved board = [1,2,…,n²-1,0]. Pure (mirrored in verify).
export function solvedBoard(n: number): number[] {
  return Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
}
export function isSolved(b: number[]): boolean {
  return b.every((v, i) => v === (i + 1) % b.length);
}
// Tiles orthogonally adjacent to the blank — the cells you may slide.
export function legalMoves(b: number[], n: number): number[] {
  const z = b.indexOf(0);
  const r = Math.floor(z / n);
  const c = z % n;
  const out: number[] = [];
  if (r > 0) out.push(z - n);
  if (r < n - 1) out.push(z + n);
  if (c > 0) out.push(z - 1);
  if (c < n - 1) out.push(z + 1);
  return out;
}
export function move(b: number[], idx: number, n: number): number[] {
  if (!legalMoves(b, n).includes(idx)) return b;
  const z = b.indexOf(0);
  const g = b.slice();
  [g[z], g[idx]] = [g[idx], g[z]];
  return g;
}
// Shuffle by random legal moves from solved → always solvable.
export function shuffleBoard(n: number, steps: number, rng: () => number): number[] {
  let b = solvedBoard(n);
  let last = -1;
  for (let i = 0; i < steps; i++) {
    const opts = legalMoves(b, n).filter((m) => m !== last);
    const pick = opts[Math.floor(rng() * opts.length)];
    last = b.indexOf(0);
    b = move(b, pick, n);
  }
  return isSolved(b) ? shuffleBoard(n, steps + 1, rng) : b;
}

export default function SlideGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const n = SIZE[difficulty];
  const bestKey = `slide.best.${difficulty}`;

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const initial = useMemo(() => shuffleBoard(n, SCRAMBLE[difficulty], makeRng(seed)), [n, difficulty, seed]);
  const [board, setBoard] = useState<number[]>(initial);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  useEffect(() => {
    setBoard(initial);
    setMoves(0);
    setIsBest(false);
    setLevelUp(null);
  }, [initial]);

  const restart = useCallback(() => setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0), []);
  const won = moves > 0 && isSolved(board);

  useEffect(() => {
    if (!won) return;
    fx.win();
    const prev = getSetting<number>(bestKey, 0);
    const better = prev === 0 || moves < prev;
    if (better) {
      setBest(moves);
      setSetting(bestKey, moves);
    }
    setIsBest(better);
    const perf = clamp01((SCRAMBLE[difficulty] * 0.6) / Math.max(1, moves));
    const res = recordPlay({ gameId: 'slide', axes: AXES, quality: clamp01(0.3 + 0.6 * perf), weight: XP_WEIGHT[difficulty] });
    setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const movable = useMemo(() => new Set(legalMoves(board, n)), [board, n]);
  const tap = (i: number) => {
    if (won || !movable.has(i)) return;
    setBoard((b) => move(b, i, n));
    setMoves((m) => m + 1);
    fx.tick();
  };

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">
          {moves} {t('slide.moves')}
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-400">🏆 {best || '—'}</span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, width: 'min(86vw, 360px)' }}>
          {board.map((v, i) =>
            v === 0 ? (
              <div key={i} className="aspect-square rounded-xl bg-slate-100" />
            ) : (
              <button
                key={i}
                onClick={() => tap(i)}
                className={`aspect-square rounded-xl text-xl font-bold tabular-nums shadow-sm transition active:scale-95 ${
                  movable.has(i) ? 'bg-brand text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                }`}
              >
                {v}
              </button>
            ),
          )}
        </div>
      </div>

      {won && (
        <ProgressResultModal
          emoji={isBest ? '🏆' : '🔢'}
          title={isBest ? t('slide.newBest') : t('slide.solved')}
          celebrate
          levelUp={levelUp}
          stats={[
            { value: moves, label: t('slide.moves') },
            { value: best || moves, label: '🏆' },
            { value: `${n}×${n}`, label: t('difficulty.label') },
          ]}
          actions={[
            { label: t('slide.again'), onClick: restart, variant: 'primary' },
            {
              label: t('slide.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.slide.name')} (${t(difficultyKey(difficulty))})\n🔢 ${moves} ${t('slide.moves')}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
