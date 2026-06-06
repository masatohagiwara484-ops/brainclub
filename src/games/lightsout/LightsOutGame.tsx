import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell from '../../components/GameShell';
import { useShareMsg } from '../shareHook';

const AXES = getGame('lightsout')?.axes ?? {};
const SIZE: Record<string, number> = { easy: 3, medium: 4, hard: 5, expert: 5 };
const SCRAMBLE: Record<string, number> = { easy: 4, medium: 7, hard: 12, expert: 18 };

// Toggle a cell and its orthogonal neighbors (pure; mirrored in verify).
export function press(grid: boolean[], idx: number, n: number): boolean[] {
  const g = grid.slice();
  const r = Math.floor(idx / n);
  const c = idx % n;
  const flip = (rr: number, cc: number) => {
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) g[rr * n + cc] = !g[rr * n + cc];
  };
  flip(r, c);
  flip(r - 1, c);
  flip(r + 1, c);
  flip(r, c - 1);
  flip(r, c + 1);
  return g;
}

// Scramble from all-off by random presses → always solvable.
export function scramble(n: number, count: number, rng: () => number): boolean[] {
  let g = Array<boolean>(n * n).fill(false);
  for (let i = 0; i < count; i++) g = press(g, Math.floor(rng() * n * n), n);
  return g;
}

export default function LightsOutGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const n = SIZE[difficulty];
  const par = SCRAMBLE[difficulty];
  const bestKey = `lightsout.best.${difficulty}`;

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const initial = useMemo(() => scramble(n, par, makeRng(seed)), [n, par, seed]);
  const [grid, setGrid] = useState<boolean[]>(initial);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  useEffect(() => {
    setGrid(initial);
    setMoves(0);
    setIsBest(false);
    setLevelUp(null);
  }, [initial]);

  const restart = useCallback(() => setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0), []);

  const won = grid.length > 0 && grid.every((v) => !v) && moves > 0;

  useEffect(() => {
    if (!won) return;
    // Celebration (chime + themed confetti) is owned by GameResultScreen.
    const prev = getSetting<number>(bestKey, 0);
    const better = prev === 0 || moves < prev;
    if (better) {
      setBest(moves);
      setSetting(bestKey, moves);
    }
    setIsBest(better);
    const perf = clamp01(par / Math.max(1, moves)); // solving near the scramble count is excellent
    const res = recordPlay({ gameId: 'lightsout', axes: AXES, quality: clamp01(0.3 + 0.6 * perf), weight: XP_WEIGHT[difficulty] });
    setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const tap = (i: number) => {
    if (won) return;
    setGrid((g) => press(g, i, n));
    setMoves((m) => m + 1);
    fx.tick();
  };

  const onCount = grid.filter((v) => v).length;

  return (
    <GameShell
      difficulty={difficulty}
      stat={
        <>
          {moves} {t('lightsout.moves')}
        </>
      }
      action={<span className="text-xs font-semibold tabular-nums text-white/60">💡 {onCount}</span>}
    >
      <p className="mt-1 text-xs text-white/50">{t('lightsout.goal')}</p>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, width: 'min(82vw, 340px)' }}>
          {grid.map((on, i) => (
            <button
              key={i}
              onClick={() => tap(i)}
              className={`aspect-square rounded-2xl transition active:scale-95 ${
                on
                  ? 'bg-amber-300 shadow-[0_0_18px] shadow-amber-300/70 ring-1 ring-amber-400'
                  : 'bg-white/10 ring-1 ring-white/15'
              }`}
            />
          ))}
        </div>
      </div>

      {won && (
        <GameResultScreen
          gameId="lightsout"
          emoji="💡"
          title={isBest ? t('lightsout.newBest') : t('lightsout.solved')}
          isNewBest={isBest}
          celebrate
          levelUp={levelUp}
          stats={[
            { value: moves, label: t('lightsout.moves') },
            { value: best || moves, label: '🏆' },
            { value: `${n}×${n}`, label: t('difficulty.label') },
          ]}
          onPlayAgain={restart}
          playAgainLabel={t('lightsout.again')}
          onShare={() =>
            doShare(`BrainClub · ${t('games.lightsout.name')} (${t(difficultyKey(difficulty))})\n💡 ${moves} ${t('lightsout.moves')}\n${window.location.origin}`)
          }
          shareLabel={t('lightsout.share')}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
