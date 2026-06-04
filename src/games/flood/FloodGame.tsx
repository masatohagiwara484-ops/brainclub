import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import ProgressResultModal from '../../components/ProgressResultModal';
import { useShareMsg } from '../shareHook';

const AXES = getGame('flood')?.axes ?? {};
const PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
type Cfg = { n: number; colors: number; limit: number };
const CFG: Record<string, Cfg> = {
  easy: { n: 8, colors: 4, limit: 18 },
  medium: { n: 10, colors: 5, limit: 24 },
  hard: { n: 12, colors: 6, limit: 30 },
  expert: { n: 14, colors: 6, limit: 34 },
};

// Recolor the origin-connected region (4-neighbour, sharing origin's colour) to
// `target`. Pure — mirrored in verify.
export function floodFill(board: number[], n: number, target: number): number[] {
  const origin = board[0];
  if (origin === target) return board.slice();
  const g = board.slice();
  const stack = [0];
  const seen = new Set<number>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (g[cur] !== origin) continue;
    g[cur] = target;
    const r = Math.floor(cur / n);
    const c = cur % n;
    if (r > 0) stack.push(cur - n);
    if (r < n - 1) stack.push(cur + n);
    if (c > 0) stack.push(cur - 1);
    if (c < n - 1) stack.push(cur + 1);
  }
  return g;
}
export function isOneColor(board: number[]): boolean {
  return board.every((v) => v === board[0]);
}
export function makeBoard(n: number, colors: number, rng: () => number): number[] {
  return Array.from({ length: n * n }, () => Math.floor(rng() * colors));
}

export default function FloodGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const cfg = CFG[difficulty];

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const initial = useMemo(() => makeBoard(cfg.n, cfg.colors, makeRng(seed)), [cfg, seed]);
  const [board, setBoard] = useState<number[]>(initial);
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<'play' | 'won' | 'lost'>('play');
  const [levelUp, setLevelUp] = useState<string | null>(null);

  useEffect(() => {
    setBoard(initial);
    setMoves(0);
    setStatus('play');
    setLevelUp(null);
  }, [initial]);

  const restart = useCallback(() => setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0), []);

  const pick = (color: number) => {
    if (status !== 'play' || color === board[0]) return;
    const nb = floodFill(board, cfg.n, color);
    const nm = moves + 1;
    setBoard(nb);
    setMoves(nm);
    if (isOneColor(nb)) {
      setStatus('won');
      fx.win();
      const perf = clamp01((cfg.limit - nm) / cfg.limit + 0.4);
      const res = recordPlay({ gameId: 'flood', axes: AXES, quality: clamp01(0.35 + 0.55 * perf), weight: XP_WEIGHT[difficulty] });
      setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    } else if (nm >= cfg.limit) {
      setStatus('lost');
      fx.wrong();
      recordPlay({ gameId: 'flood', axes: AXES, quality: 0.2, weight: XP_WEIGHT[difficulty] });
    } else {
      fx.correct({ streak: 1 });
    }
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
          {moves}/{cfg.limit}
        </span>
        <span className="text-xs font-semibold text-slate-400">🌊 {t('flood.fill')}</span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid gap-0.5 overflow-hidden rounded-xl" style={{ gridTemplateColumns: `repeat(${cfg.n}, minmax(0,1fr))`, width: 'min(90vw, 380px)' }}>
          {board.map((v, i) => (
            <div key={i} className="aspect-square" style={{ backgroundColor: PALETTE[v] }} />
          ))}
        </div>
      </div>

      <div className="mb-1 flex justify-center gap-2.5">
        {PALETTE.slice(0, cfg.colors).map((hex, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className={`h-11 w-11 rounded-full shadow active:scale-90 ${board[0] === i ? 'ring-2 ring-slate-800 ring-offset-2' : ''}`}
            style={{ backgroundColor: hex }}
            aria-label={`color ${i + 1}`}
          />
        ))}
      </div>

      {status !== 'play' && (
        <ProgressResultModal
          emoji={status === 'won' ? '🌊' : '🫧'}
          title={status === 'won' ? t('flood.won') : t('flood.lost')}
          celebrate={status === 'won'}
          levelUp={levelUp}
          stats={[
            { value: moves, label: t('flood.moves') },
            { value: cfg.limit, label: t('flood.limit') },
            { value: `${cfg.n}×${cfg.n}`, label: t('difficulty.label') },
          ]}
          actions={[
            { label: t('flood.again'), onClick: restart, variant: 'primary' },
            {
              label: t('flood.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.flood.name')} (${t(difficultyKey(difficulty))})\n🌊 ${status === 'won' ? `${moves}/${cfg.limit}` : 'X'}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
