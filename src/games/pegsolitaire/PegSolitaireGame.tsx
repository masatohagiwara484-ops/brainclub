import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01 } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell, { ShellButton } from '../../components/GameShell';
import { useShareMsg } from '../shareHook';

const AXES = getGame('pegsolitaire')?.axes ?? {};
const W = 7; // English cross board on a 7×7 grid
const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// -1 = off-board, 0 = empty hole, 1 = peg.
export function isCell(idx: number): boolean {
  const r = Math.floor(idx / W);
  const c = idx % W;
  return (r >= 2 && r <= 4) || (c >= 2 && c <= 4);
}
export function initialBoard(): number[] {
  return Array.from({ length: W * W }, (_, i) => (!isCell(i) ? -1 : i === 3 * W + 3 ? 0 : 1));
}
export type Jump = { from: number; over: number; to: number };
export function jumpsFrom(board: number[], idx: number): Jump[] {
  if (board[idx] !== 1) return [];
  const r = Math.floor(idx / W);
  const c = idx % W;
  const out: Jump[] = [];
  for (const [dr, dc] of DIRS) {
    const tr = r + 2 * dr;
    const tc = c + 2 * dc;
    if (tr < 0 || tr >= W || tc < 0 || tc >= W) continue;
    const over = (r + dr) * W + (c + dc);
    const to = tr * W + tc;
    if (board[over] === 1 && board[to] === 0) out.push({ from: idx, over, to });
  }
  return out;
}
export function validJumps(board: number[]): Jump[] {
  const all: Jump[] = [];
  for (let i = 0; i < board.length; i++) all.push(...jumpsFrom(board, i));
  return all;
}
export function applyJump(board: number[], j: Jump): number[] {
  const g = board.slice();
  g[j.from] = 0;
  g[j.over] = 0;
  g[j.to] = 1;
  return g;
}
export function pegCount(board: number[]): number {
  return board.filter((v) => v === 1).length;
}

export default function PegSolitaireGame(_: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const [board, setBoard] = useState<number[]>(() => initialBoard());
  const [sel, setSel] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const restart = useCallback(() => {
    setBoard(initialBoard());
    setSel(null);
    setOver(false);
    setLevelUp(null);
  }, []);

  const dests = useMemo(() => (sel == null ? new Map<number, Jump>() : new Map(jumpsFrom(board, sel).map((j) => [j.to, j]))), [board, sel]);
  const pegs = pegCount(board);

  const endIfStuck = (b: number[]) => {
    if (validJumps(b).length > 0) return;
    setOver(true);
    const left = pegCount(b);
    // Fewer pegs left = better. 1 peg → ~1.0; the full board never reaches here.
    const quality = clamp01(1 - (left - 1) / 12);
    const res = recordPlay({ gameId: 'pegsolitaire', axes: AXES, quality, weight: 1.6 });
    setLevelUp(left <= 2 && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  };

  const tap = (i: number) => {
    if (over || board[i] === -1) return;
    if (board[i] === 1) {
      setSel(i === sel ? null : i);
      fx.tick();
      return;
    }
    // empty cell — perform the jump if it's a legal destination for the selection
    const j = dests.get(i);
    if (j) {
      const nb = applyJump(board, j);
      setBoard(nb);
      setSel(null);
      fx.correct({ streak: 1 });
      endIfStuck(nb);
    }
  };

  return (
    <GameShell
      left={<ShellButton onClick={restart}>{t('pegsolitaire.newGame')}</ShellButton>}
      stat={
        <>
          {pegs} {t('pegsolitaire.pegs')}
        </>
      }
      action={<span className="text-xs font-semibold text-white/60">🎯 1</span>}
    >
      <p className="mt-1 text-xs text-white/50">{t('pegsolitaire.goal')}</p>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid gap-1.5 rounded-2xl bg-amber-950/40 p-3 ring-1 ring-white/10" style={{ gridTemplateColumns: `repeat(${W}, minmax(0,1fr))`, width: 'min(90vw, 360px)' }}>
          {board.map((v, i) => {
            if (v === -1) return <div key={i} className="aspect-square" />;
            const isDest = dests.has(i);
            return (
              <button
                key={i}
                onClick={() => tap(i)}
                className={`grid aspect-square place-items-center rounded-full transition active:scale-90 ${
                  v === 1 ? '' : 'bg-black/30'
                } ${isDest ? 'ring-2 ring-accent-cyan' : ''}`}
              >
                {v === 1 && (
                  <span
                    className={`h-[78%] w-[78%] rounded-full shadow-inner ${
                      sel === i ? 'bg-accent-cyan ring-2 ring-accent-cyan/40' : 'bg-amber-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {over && (
        <GameResultScreen
          emoji={pegs === 1 ? '🏆' : '🪵'}
          title={pegs === 1 ? t('pegsolitaire.perfect') : t('pegsolitaire.stuck')}
          celebrate={pegs === 1}
          levelUp={levelUp}
          stats={[{ value: pegs, label: t('pegsolitaire.pegs') }]}
          actions={[
            { label: t('pegsolitaire.again'), onClick: restart, variant: 'primary' },
            {
              label: t('pegsolitaire.share'),
              onClick: () => doShare(`BrainClub · ${t('games.pegsolitaire.name')}\n🪵 ${pegs} ${t('pegsolitaire.pegs')}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
