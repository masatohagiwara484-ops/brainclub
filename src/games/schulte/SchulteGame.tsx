import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const AXES = getGame('schulte')?.axes ?? {};
const SIZE: Record<string, number> = { easy: 3, medium: 4, hard: 5, expert: 6 };
// A good per-cell pace (seconds). Beating it = strong focus/scan.
const PAR_PER_CELL: Record<string, number> = { easy: 1.6, medium: 1.4, hard: 1.2, expert: 1.0 };

// A shuffled permutation of 1..n² (pure; mirrored in verify).
export function makeBoard(n: number, rng: () => number): number[] {
  const a = Array.from({ length: n * n }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SchulteGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const n = SIZE[difficulty];
  const total = n * n;
  const bestKey = `schulte.best.${difficulty}`;

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const board = useMemo(() => makeBoard(n, makeRng(seed)), [n, seed]);
  const [next, setNext] = useState(1);
  const [wrongKey, setWrongKey] = useState(0);
  const [startAt, setStartAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const startRef = useRef(startAt);

  const restart = useCallback(() => {
    setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setNext(1);
    setDone(false);
    setIsBest(false);
    setLevelUp(null);
    const now = Date.now();
    startRef.current = now;
    setStartAt(now);
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
    return () => window.clearInterval(id);
  }, [done, startAt]);

  const tap = (value: number) => {
    if (done) return;
    if (value === next) {
      if (next === total) {
        const secs = (Date.now() - startRef.current) / 1000;
        setElapsed(secs);
        setDone(true);
        // Celebration (chime + themed confetti) is owned by GameResultScreen.
        const prev = getSetting<number>(bestKey, 0);
        const better = prev === 0 || secs < prev;
        if (better) {
          setBest(Math.round(secs * 10) / 10);
          setSetting(bestKey, Math.round(secs * 10) / 10);
          setIsBest(true);
        }
        const par = PAR_PER_CELL[difficulty] * total;
        const perf = clamp01(par / Math.max(0.1, secs)); // faster than par → >0.5
        const res = recordPlay({ gameId: 'schulte', axes: AXES, quality: clamp01(0.3 + 0.6 * perf), weight: XP_WEIGHT[difficulty] });
        setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
      } else {
        fx.correct({ streak: next });
        setNext(next + 1);
      }
    } else {
      fx.wrong();
      setWrongKey((k) => k + 1);
    }
  };

  return (
    <GameShell
      difficulty={difficulty}
      stat={
        <>
          {t('schulte.find')} <span className="text-accent-cyan">{next <= total ? next : total}</span>
        </>
      }
      action={<span className="text-xs font-semibold tabular-nums text-white/60">⏱ {elapsed.toFixed(1)}s</span>}
    >
      <div className="flex flex-1 items-center justify-center">
        <div
          key={wrongKey ? `w${wrongKey}` : 'g'}
          className={`grid gap-1.5 ${wrongKey ? 'fx-shake-sm' : ''}`}
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, width: 'min(86vw, 380px)' }}
        >
          {board.map((v) => {
            const cleared = v < next;
            return (
              <button
                key={v}
                onClick={() => tap(v)}
                className={`aspect-square rounded-xl text-lg font-bold tabular-nums shadow-sm transition active:scale-95 ${
                  cleared ? 'bg-primary/15 text-white/30' : 'bg-white/[0.08] text-white ring-1 ring-white/10'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>

      {done && (
        <GameResultScreen
          gameId="schulte"
          emoji="🧭"
          title={isBest ? t('schulte.newBest') : t('schulte.solved')}
          isNewBest={isBest}
          celebrate
          levelUp={levelUp}
          stats={[
            { value: `${elapsed.toFixed(1)}s`, label: '⏱' },
            { value: `${best || elapsed.toFixed(1)}s`, label: '🏆' },
            { value: `${n}×${n}`, label: t('difficulty.label') },
          ]}
          onPlayAgain={restart}
          playAgainLabel={t('schulte.again')}
          onShare={() =>
            doShare(`BrainClub · ${t('games.schulte.name')} (${t(difficultyKey(difficulty))})\n🧭 ${elapsed.toFixed(1)}s\n${window.location.origin}`)
          }
          shareLabel={t('schulte.share')}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
