import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { getSetting, setSetting } from '../../lib/storage';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01 } from '../../lib/synapse';
import { getGame } from '../registry';
import ProgressResultModal from '../../components/ProgressResultModal';
import { useShareMsg } from '../shareHook';

const AXES = getGame('2048')?.axes ?? {};
const N = 4;
const BEST_KEY = '2048.best';
type Dir = 'left' | 'right' | 'up' | 'down';

// Compress + merge a single line toward the start (pure; mirrored in verify).
export function compress(line: number[]): { line: number[]; gained: number } {
  const nz = line.filter((x) => x !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nz.length; i++) {
    if (i + 1 < nz.length && nz[i] === nz[i + 1]) {
      out.push(nz[i] * 2);
      gained += nz[i] * 2;
      i++; // each tile merges at most once
    } else out.push(nz[i]);
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}

function lineIndices(n: number, dir: Dir): number[][] {
  const lines: number[][] = [];
  for (let i = 0; i < n; i++) {
    const line: number[] = [];
    for (let j = 0; j < n; j++) {
      if (dir === 'left') line.push(i * n + j);
      else if (dir === 'right') line.push(i * n + (n - 1 - j));
      else if (dir === 'up') line.push(j * n + i);
      else line.push((n - 1 - j) * n + i);
    }
    lines.push(line);
  }
  return lines;
}

export function applyMove(board: number[], n: number, dir: Dir): { board: number[]; gained: number; moved: boolean } {
  const g = board.slice();
  let gained = 0;
  let moved = false;
  for (const line of lineIndices(n, dir)) {
    const vals = line.map((ix) => g[ix]);
    const { line: nl, gained: ga } = compress(vals);
    gained += ga;
    for (let k = 0; k < line.length; k++) {
      if (g[line[k]] !== nl[k]) moved = true;
      g[line[k]] = nl[k];
    }
  }
  return { board: g, gained, moved };
}

export function hasMoves(board: number[], n: number): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    if (c + 1 < n && board[i] === board[i + 1]) return true;
    if (r + 1 < n && board[i] === board[i + n]) return true;
  }
  return false;
}

function spawn(board: number[]): number[] {
  const empty = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (!empty.length) return board;
  const g = board.slice();
  g[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
  return g;
}

const TILE: Record<number, string> = {
  0: 'bg-slate-100',
  2: 'bg-[#eee4da] text-[#776e65]',
  4: 'bg-[#ede0c8] text-[#776e65]',
  8: 'bg-[#f2b179] text-white',
  16: 'bg-[#f59563] text-white',
  32: 'bg-[#f67c5f] text-white',
  64: 'bg-[#f65e3b] text-white',
  128: 'bg-[#edcf72] text-white',
  256: 'bg-[#edcc61] text-white',
  512: 'bg-[#edc850] text-white',
  1024: 'bg-[#edc53f] text-white',
  2048: 'bg-[#edc22e] text-white',
};

export default function Game2048(_: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const [board, setBoard] = useState<number[]>(() => spawn(spawn(Array<number>(N * N).fill(0))));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => getSetting<number>(BEST_KEY, 0));
  const [over, setOver] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const scoreRef = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  const newGame = useCallback(() => {
    setBoard(spawn(spawn(Array<number>(N * N).fill(0))));
    scoreRef.current = 0;
    setScore(0);
    setOver(false);
    setLevelUp(null);
  }, []);

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      setBoard((b) => {
        const { board: nb, gained, moved } = applyMove(b, N, dir);
        if (!moved) return b;
        const withSpawn = spawn(nb);
        if (gained > 0) fx.correct({ streak: Math.floor(gained / 16) });
        else fx.tick();
        scoreRef.current += gained;
        setScore(scoreRef.current);
        if (!hasMoves(withSpawn, N)) {
          setOver(true);
          fx.win();
          const final = scoreRef.current;
          if (final > getSetting<number>(BEST_KEY, 0)) {
            setBest(final);
            setSetting(BEST_KEY, final);
          }
          const maxTile = Math.max(...withSpawn);
          const res = recordPlay({
            gameId: '2048',
            axes: AXES,
            quality: clamp01(Math.log2(Math.max(2, maxTile)) / 11),
            weight: 1.4,
          });
          setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
        }
        return withSpawn;
      });
    },
    [over, t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        doMove(d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove]);

  const onUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
    else doMove(dy > 0 ? 'down' : 'up');
  };

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <button onClick={newGame} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {t('g2048.newGame')}
        </button>
        <span className="font-semibold tabular-nums text-slate-700">⭐ {score}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-400">🏆 {best}</span>
      </div>

      <p className="mt-2 text-xs text-slate-400">{t('g2048.howto')}</p>

      <div className="flex flex-1 items-center justify-center">
        <div
          onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={onUp}
          className="grid touch-none gap-2 rounded-2xl bg-slate-200 p-2"
          style={{ gridTemplateColumns: `repeat(${N}, minmax(0,1fr))`, width: 'min(88vw, 360px)' }}
        >
          {board.map((v, i) => (
            <div
              key={i}
              className={`grid aspect-square place-items-center rounded-lg font-bold tabular-nums ${TILE[v] ?? 'bg-[#edc22e] text-white'} ${
                v >= 1024 ? 'text-lg' : 'text-2xl'
              }`}
            >
              {v || ''}
            </div>
          ))}
        </div>
      </div>

      {over && (
        <ProgressResultModal
          emoji="🔢"
          title={t('g2048.gameOver')}
          subtitle={`${t('g2048.score')} ${score}`}
          celebrate={score >= best && score > 0}
          levelUp={levelUp}
          stats={[
            { value: score, label: t('g2048.score') },
            { value: best, label: '🏆' },
            { value: Math.max(...board), label: t('g2048.best') },
          ]}
          actions={[
            { label: t('g2048.again'), onClick: newGame, variant: 'primary' },
            {
              label: t('g2048.share'),
              onClick: () => doShare(`BrainClub · ${t('games.2048.name')}\n🔢 ${score}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
