import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import { useShareMsg } from '../shareHook';

const AXES = getGame('minesweeper')?.axes ?? {};
type Cfg = { w: number; h: number; mines: number };
const CFG: Record<string, Cfg> = {
  easy: { w: 8, h: 8, mines: 10 },
  medium: { w: 9, h: 9, mines: 16 },
  hard: { w: 10, h: 12, mines: 26 },
  expert: { w: 12, h: 14, mines: 40 },
};

// ---- pure helpers (mirrored in verify) ----
export function neighbors(idx: number, w: number, h: number): number[] {
  const r = Math.floor(idx / w);
  const c = idx % w;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(rr * w + cc);
    }
  return out;
}
export function placeMines(total: number, count: number, safe: Set<number>, rng: () => number): Set<number> {
  const set = new Set<number>();
  let guard = 0;
  while (set.size < count && guard++ < total * 50) {
    const i = Math.floor(rng() * total);
    if (safe.has(i) || set.has(i)) continue;
    set.add(i);
  }
  return set;
}
export function computeCounts(mines: Set<number>, w: number, h: number): number[] {
  return Array.from({ length: w * h }, (_, i) =>
    mines.has(i) ? -1 : neighbors(i, w, h).filter((n) => mines.has(n)).length,
  );
}
export function flood(idx: number, revealed: Set<number>, counts: number[], mines: Set<number>, w: number, h: number): Set<number> {
  const stack = [idx];
  while (stack.length) {
    const cur = stack.pop()!;
    if (revealed.has(cur) || mines.has(cur)) continue;
    revealed.add(cur);
    if (counts[cur] === 0) for (const n of neighbors(cur, w, h)) if (!revealed.has(n)) stack.push(n);
  }
  return revealed;
}

const NUM_COLOR = ['', 'text-blue-600', 'text-green-600', 'text-red-600', 'text-indigo-700', 'text-amber-700', 'text-teal-600', 'text-slate-700', 'text-slate-900'];

export default function MinesweeperGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const cfg = CFG[difficulty];
  const total = cfg.w * cfg.h;

  const [mines, setMines] = useState<Set<number>>(new Set());
  const [counts, setCounts] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'play' | 'won' | 'lost'>('play');
  const [flagMode, setFlagMode] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const startRef = useRef(0);

  const restart = useCallback(() => {
    setMines(new Set());
    setCounts([]);
    setRevealed(new Set());
    setFlags(new Set());
    setStatus('play');
    setStarted(false);
    setElapsed(0);
    setLevelUp(null);
  }, []);

  useEffect(() => {
    restart();
  }, [difficulty, restart]);

  useEffect(() => {
    if (!started || status !== 'play') return;
    const id = window.setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 200);
    return () => window.clearInterval(id);
  }, [started, status]);

  const finish = (win: boolean, secs: number) => {
    setStatus(win ? 'won' : 'lost');
    if (win) {
      const par = total * 0.6;
      const res = recordPlay({ gameId: 'minesweeper', axes: AXES, quality: clamp01(0.4 + 0.4 * clamp01(par / Math.max(1, secs))), weight: XP_WEIGHT[difficulty] });
      setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    } else {
      fx.wrong();
      recordPlay({ gameId: 'minesweeper', axes: AXES, quality: 0.2, weight: XP_WEIGHT[difficulty] });
    }
  };

  const tap = (i: number) => {
    if (status !== 'play' || revealed.has(i)) return;
    if (flagMode) {
      const f = new Set(flags);
      f.has(i) ? f.delete(i) : f.add(i);
      setFlags(f);
      fx.tick();
      return;
    }
    if (flags.has(i)) return;

    let m = mines;
    let cnt = counts;
    if (!started) {
      const safe = new Set<number>([i, ...neighbors(i, cfg.w, cfg.h)]);
      m = placeMines(total, cfg.mines, safe, makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
      cnt = computeCounts(m, cfg.w, cfg.h);
      setMines(m);
      setCounts(cnt);
      setStarted(true);
      startRef.current = Date.now();
    }

    if (m.has(i)) {
      setRevealed(new Set([...revealed, ...m]));
      finish(false, (Date.now() - startRef.current) / 1000);
      return;
    }

    const rev = flood(i, new Set(revealed), cnt, m, cfg.w, cfg.h);
    setRevealed(rev);
    fx.correct({ streak: 1 });
    if (rev.size === total - cfg.mines) {
      const secs = (Date.now() - startRef.current) / 1000;
      setElapsed(secs);
      finish(true, secs);
    }
  };

  const showMine = (i: number) => status === 'lost' && mines.has(i);

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">💣 {cfg.mines - flags.size}</span>
        <button
          onClick={() => setFlagMode((v) => !v)}
          className={`rounded-lg px-2 py-1 text-xs font-semibold ${flagMode ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          🚩 {flagMode ? t('minesweeper.flagOn') : t('minesweeper.flagOff')}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cfg.w}, minmax(0,1fr))`, width: `min(94vw, ${cfg.w * 34}px)` }}>
          {Array.from({ length: total }, (_, i) => {
            const isRev = revealed.has(i);
            const c = counts[i] ?? 0;
            return (
              <button
                key={i}
                onClick={() => tap(i)}
                className={`grid aspect-square place-items-center rounded text-xs font-bold tabular-nums ${
                  isRev || showMine(i) ? 'bg-slate-100' : 'bg-slate-300 active:bg-slate-200'
                } ${isRev && c > 0 ? NUM_COLOR[c] : ''}`}
              >
                {showMine(i) ? '💣' : flags.has(i) ? '🚩' : isRev && c > 0 ? c : ''}
              </button>
            );
          })}
        </div>
      </div>

      {status !== 'play' && (
        <GameResultScreen
          emoji={status === 'won' ? '🏁' : '💥'}
          title={status === 'won' ? t('minesweeper.won') : t('minesweeper.lost')}
          celebrate={status === 'won'}
          levelUp={levelUp}
          stats={[
            { value: `${elapsed.toFixed(0)}s`, label: '⏱' },
            { value: cfg.mines, label: '💣' },
            { value: `${cfg.w}×${cfg.h}`, label: t('difficulty.label') },
          ]}
          actions={[
            { label: t('minesweeper.again'), onClick: restart, variant: 'primary' },
            {
              label: t('minesweeper.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.minesweeper.name')} (${t(difficultyKey(difficulty))})\n${status === 'won' ? `🏁 ${elapsed.toFixed(0)}s` : '💥'}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
