import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, type Difficulty } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell from '../../components/GameShell';
import { useShareMsg } from '../shareHook';
import { submitScore } from '../../lib/leaderboard';

const AXES = getGame('schulte')?.axes ?? {};
const SIZE: Record<string, number> = { easy: 3, medium: 4, hard: 5, expert: 6 };
// Boards-cleared target per difficulty (for the Synapse quality curve).
const TARGET: Record<string, number> = { easy: 8, medium: 6, hard: 5, expert: 4 };

// Time-bomb shuttle run: each board gives LESS time than the last. `start` is
// the fuse for board 1, shrinking by `step` each cleared board down to `min`.
type Tune = { start: number; step: number; min: number };
const TUNE: Record<Difficulty, Tune> = {
  easy: { start: 10, step: 0.6, min: 4 },
  medium: { start: 16, step: 0.9, min: 6 },
  hard: { start: 24, step: 1.2, min: 8 },
  expert: { start: 32, step: 1.5, min: 10 },
};
function limitFor(difficulty: Difficulty, roundsCleared: number): number {
  const tune = TUNE[difficulty];
  return Math.max(tune.min, tune.start - roundsCleared * tune.step);
}

// A shuffled permutation of 1..n² (pure; mirrored in verify).
export function makeBoard(n: number, rng: () => number): number[] {
  const a = Array.from({ length: n * n }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A bomb with a burning fuse + a fuse bar + the seconds left. Goes red and
// shakes when time is nearly out.
function BombTimer({ remaining, limit }: { remaining: number; limit: number }) {
  const ratio = clamp01(remaining / limit);
  const danger = remaining <= Math.max(2.5, limit * 0.28);
  const barColor = danger ? '#ef4444' : ratio > 0.5 ? '#22c55e' : '#eab308';
  return (
    <div className={`flex w-full max-w-md items-center gap-3 ${danger ? 'bomb-danger' : ''}`}>
      <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0" aria-hidden="true">
        {/* body */}
        <circle cx="21" cy="31" r="13" fill="#1f2937" stroke="#0e1226" strokeWidth="2" />
        <circle cx="16" cy="26" r="3.5" fill="#374151" />
        {/* cap + fuse */}
        <rect x="25" y="14" width="6" height="6" rx="1.5" transform="rotate(40 28 17)" fill="#475569" />
        <path d="M30 15 C35 10 33 6 38 5" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
        {/* spark */}
        <circle className={danger ? 'bomb-spark' : ''} cx="38" cy="5" r="3.2" fill={danger ? '#fb7185' : '#fbbf24'} />
        <circle className={danger ? 'bomb-spark' : ''} cx="38" cy="5" r="1.4" fill="#fff" />
      </svg>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${ratio * 100}%`, background: barColor }} />
      </div>
      <div className={`w-12 text-right text-xl font-black tabular-nums ${danger ? 'text-rose-400' : 'text-white'}`}>
        {remaining.toFixed(1)}
      </div>
    </div>
  );
}

export default function SchulteGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const n = SIZE[difficulty];
  const total = n * n;
  const bestKey = `schulte.boards.${difficulty}`; // most boards cleared in one run

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const board = useMemo(() => makeBoard(n, makeRng(seed)), [n, seed]);
  const [next, setNext] = useState(1);
  const [rounds, setRounds] = useState(0); // boards cleared this run = the score
  const [limit, setLimit] = useState(() => limitFor(difficulty, 0));
  const [remaining, setRemaining] = useState(() => limitFor(difficulty, 0));
  const [roundSeq, setRoundSeq] = useState(0);
  const [wrongKey, setWrongKey] = useState(0);
  const [defuseKey, setDefuseKey] = useState(0);
  const [phase, setPhase] = useState<'play' | 'over'>('play');
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const deadlineRef = useRef(0);
  const roundsRef = useRef(0);

  // Arm a board: set its fuse and the absolute deadline, then (re)start the clock.
  const arm = useCallback(
    (roundsCleared: number) => {
      const lim = limitFor(difficulty, roundsCleared);
      setLimit(lim);
      setRemaining(lim);
      deadlineRef.current = Date.now() + lim * 1000;
      setRoundSeq((s) => s + 1);
    },
    [difficulty],
  );

  const restart = useCallback(() => {
    roundsRef.current = 0;
    setRounds(0);
    setNext(1);
    setIsBest(false);
    setLevelUp(null);
    setPhase('play');
    setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    arm(0);
  }, [arm]);

  const explode = useCallback(() => {
    setPhase('over');
    fx.wrong(); // the boom
    const cleared = roundsRef.current;
    const prev = getSetting<number>(bestKey, 0);
    const better = cleared > prev;
    if (better) {
      setBest(cleared);
      setSetting(bestKey, cleared);
      setIsBest(true);
    }
    void submitScore('schulte', difficulty, cleared, { boards: cleared }); // boards cleared = score
    const perf = clamp01(cleared / TARGET[difficulty]);
    const res = recordPlay({ gameId: 'schulte', axes: AXES, quality: clamp01(0.2 + 0.7 * perf), weight: XP_WEIGHT[difficulty] });
    setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [bestKey, difficulty, t]);

  // Arm the first board exactly when the game mounts. This component isn't
  // mounted until GO! (the universal 3·2·1 countdown gates it), so the fuse
  // starts the instant the countdown finishes — and never before it's armed,
  // which previously made the very first play detonate immediately.
  useEffect(() => {
    arm(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count the fuse down; reaching zero detonates.
  useEffect(() => {
    if (phase !== 'play') return;
    const id = window.setInterval(() => {
      if (deadlineRef.current === 0) return; // not armed yet — never explode
      const remain = (deadlineRef.current - Date.now()) / 1000;
      if (remain <= 0) {
        setRemaining(0);
        explode();
        return;
      }
      setRemaining(remain);
    }, 100);
    return () => window.clearInterval(id);
  }, [roundSeq, phase, explode]);

  const tap = (value: number) => {
    if (phase !== 'play') return;
    if (value !== next) {
      fx.wrong();
      setWrongKey((k) => k + 1);
      return;
    }
    if (next === total) {
      // Board defused — bank it and arm a tighter next board.
      roundsRef.current += 1;
      setRounds(roundsRef.current);
      fx.correct({ streak: roundsRef.current + 4 }); // satisfying rising chime
      setDefuseKey((k) => k + 1);
      setNext(1);
      setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
      arm(roundsRef.current);
    } else {
      fx.correct({ streak: next });
      setNext(next + 1);
    }
  };

  return (
    <GameShell
      difficulty={difficulty}
      stat={<>🧨 {rounds}</>}
      action={<span className="text-xs font-semibold tabular-nums text-white/60">🏆 {best}</span>}
    >
      {/* Bomb fuse timer */}
      <div className="mt-3 flex w-full justify-center">
        <BombTimer remaining={remaining} limit={limit} />
      </div>

      {/* Which number to find next + a transient "defused" flash. */}
      <div className="relative mt-2 text-center">
        <p className="text-sm text-white/60">
          {t('schulte.find')} <span className="text-2xl font-black text-accent-cyan tabular-nums">{next <= total ? next : total}</span>
        </p>
        {defuseKey > 0 && (
          <span key={defuseKey} className="combo-pop absolute left-1/2 top-0 -translate-x-1/2 font-display text-2xl uppercase tracking-tight text-emerald-400">
            {t('schulte.defused')}
          </span>
        )}
      </div>

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

      {phase === 'over' && (
        <GameResultScreen
          gameId="schulte"
          emoji="💥"
          title={isBest ? t('schulte.newBest') : t('schulte.boom')}
          isNewBest={isBest}
          celebrate={isBest}
          levelUp={levelUp}
          stats={[
            { value: rounds, label: t('schulte.boards') },
            { value: best || rounds, label: '🏆' },
            { value: `${n}×${n}`, label: t('difficulty.label') },
          ]}
          onPlayAgain={restart}
          playAgainLabel={t('schulte.again')}
          onShare={() =>
            doShare(`BrainClub · ${t('games.schulte.name')} (${t(difficultyKey(difficulty))})\n🧨 ${rounds} ${t('schulte.boards')}\n${window.location.origin}`)
          }
          shareLabel={t('schulte.share')}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
