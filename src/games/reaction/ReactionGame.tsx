import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { getSetting, setSetting } from '../../lib/storage';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01 } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell from '../../components/GameShell';
import { useShareMsg } from '../shareHook';
import { submitScore } from '../../lib/leaderboard';

const AXES = getGame('reaction')?.axes ?? {};
const TRIALS = 5;
const BEST_KEY = 'reaction.best'; // lowest average ms (across the 5 rounds)
const BEST_FAST_KEY = 'reaction.bestSingle'; // fastest single tap ever

// Faster is better: 450ms → 0 quality, 180ms → 1. Pure (mirrored in verify).
export function reactionQuality(avgMs: number): number {
  return clamp01((450 - avgMs) / 270);
}

type Phase = 'idle' | 'waiting' | 'go' | 'early' | 'result' | 'over';

export default function ReactionGame(_: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const [phase, setPhase] = useState<Phase>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [bestFast, setBestFast] = useState(() => getSetting<number>(BEST_FAST_KEY, 0));
  const [newFast, setNewFast] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const goAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const arm = useCallback(() => {
    setPhase('waiting');
    const delay = 1000 + Math.random() * 2500;
    timer.current = window.setTimeout(() => {
      goAt.current = performance.now();
      setPhase('go');
    }, delay);
  }, []);

  const finish = useCallback(
    (all: number[]) => {
      setPhase('over');
      const avg = Math.round(all.reduce((s, x) => s + x, 0) / all.length);
      const fastest = Math.min(...all);
      // All-time fastest SINGLE tap — the headline personal best.
      const prevFast = getSetting<number>(BEST_FAST_KEY, 0);
      const isFast = prevFast === 0 || fastest < prevFast;
      if (isFast) {
        setBestFast(fastest);
        setSetting(BEST_FAST_KEY, fastest);
      }
      setNewFast(isFast);
      // Submit to today's leaderboard (faster tap → higher score; server keeps best).
      void submitScore('reaction', '', Math.max(1, 1_000_000 - fastest), { ms: fastest });
      // Also keep the best 5-round average (secondary record, persisted only).
      const prevBest = getSetting<number>(BEST_KEY, 0);
      if (prevBest === 0 || avg < prevBest) setSetting(BEST_KEY, avg);
      const res = recordPlay({ gameId: 'reaction', axes: AXES, quality: reactionQuality(avg), weight: 1.3 });
      setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    },
    [t],
  );

  const onTap = useCallback(() => {
    if (phase === 'idle' || phase === 'over' || phase === 'result') {
      // Start a fresh 5-round session (but don't wipe the in-progress strip
      // when simply continuing to the next round from a 'result' pause).
      if (phase !== 'result') {
        setTimes([]);
        setLast(null);
        setNewFast(false);
        setLevelUp(null);
      }
      arm();
    } else if (phase === 'waiting') {
      // Tapped before green — a false start. Re-arm this trial.
      window.clearTimeout(timer.current);
      fx.wrong();
      setPhase('early');
    } else if (phase === 'early') {
      arm();
    } else if (phase === 'go') {
      const ms = Math.round(performance.now() - goAt.current);
      setLast(ms);
      fx.tick();
      const all = [...times, ms];
      setTimes(all);
      if (all.length >= TRIALS) finish(all);
      else setPhase('result');
    }
  }, [phase, times, arm, finish]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const avg = times.length ? Math.round(times.reduce((s, x) => s + x, 0) / times.length) : 0;

  const bg =
    phase === 'go' ? 'bg-green-500' : phase === 'waiting' ? 'bg-red-500' : phase === 'early' ? 'bg-amber-500' : 'bg-white/[0.06] ring-1 ring-white/10';

  return (
    <GameShell
      stat={
        <>
          {times.length}/{TRIALS}
        </>
      }
      action={<span className="text-xs font-semibold tabular-nums text-white/60">🏆 {bestFast ? `${bestFast}ms` : '—'}</span>}
    >
      <button
        onClick={onTap}
        className={`mt-3 flex w-full max-w-md flex-1 select-none flex-col items-center justify-center rounded-3xl text-center text-white transition-colors ${bg}`}
      >
        {phase === 'idle' && (
          <>
            <div className="text-5xl">⚡</div>
            <h2 className="font-cyber mt-3 text-2xl">{t('games.reaction.name')}</h2>
            <p className="mt-2 max-w-xs px-6 text-sm text-white/60">{t('reaction.howto')}</p>
            <span className="mt-5 rounded-2xl bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta px-8 py-3 text-lg font-bold text-white shadow-premium">{t('reaction.start')}</span>
          </>
        )}
        {phase === 'waiting' && <div className="text-2xl font-bold">{t('reaction.wait')}</div>}
        {phase === 'go' && <div className="text-4xl font-black">{t('reaction.tap')}</div>}
        {phase === 'early' && (
          <>
            <div className="text-3xl font-black">{t('reaction.tooSoon')}</div>
            <p className="mt-2 text-sm opacity-90">{t('reaction.retry')}</p>
          </>
        )}
        {phase === 'result' && (
          <>
            <div className="text-5xl font-black tabular-nums">{last}ms</div>
            <p className="mt-2 text-sm text-white/60">
              {t('reaction.roundOf', { n: times.length, total: TRIALS })}
            </p>
          </>
        )}
      </button>

      {/* Live 5-chance strip: each round's time fills in as you go. */}
      {phase !== 'idle' && (
        <div className="mt-3 flex w-full max-w-md justify-center gap-1.5">
          {Array.from({ length: TRIALS }).map((_, i) => {
            const v = times[i];
            const pending = i === times.length && (phase === 'waiting' || phase === 'go' || phase === 'early');
            return (
              <div
                key={i}
                className={`flex h-9 flex-1 items-center justify-center rounded-xl text-xs font-bold tabular-nums ring-1 ${
                  v != null
                    ? 'bg-white/[0.08] text-white ring-white/15'
                    : pending
                      ? 'bg-accent-cyan/15 text-accent-cyan ring-accent-cyan/40'
                      : 'bg-white/[0.03] text-white/25 ring-white/10'
                }`}
              >
                {v != null ? v : i + 1}
              </div>
            );
          })}
        </div>
      )}

      {phase === 'over' && (
        <GameResultScreen
          emoji="⚡"
          title={t('reaction.done')}
          subtitle={`${t('reaction.avg')} ${avg}ms`}
          celebrate
          isNewBest={newFast}
          levelUp={levelUp}
          stats={[
            { value: `${avg}ms`, label: t('reaction.avg') },
            { value: `${times.length ? Math.min(...times) : 0}ms`, label: t('reaction.best') },
            { value: bestFast ? `${bestFast}ms` : '—', label: '🏆' },
          ]}
          actions={[
            { label: t('reaction.again'), onClick: onTap, variant: 'primary' },
            {
              label: t('reaction.share'),
              onClick: () =>
                doShare(
                  `BrainClub · ${t('games.reaction.name')}\n⚡ ${t('reaction.best')} ${
                    times.length ? Math.min(...times) : 0
                  }ms (avg ${avg}ms)\n${window.location.origin}`,
                ),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        >
          {/* Per-round breakdown — the fastest tap is highlighted. */}
          <div className="mt-3 flex justify-center gap-1.5">
            {times.map((v, i) => {
              const isMin = v === Math.min(...times);
              return (
                <div
                  key={i}
                  className={`flex h-9 w-11 items-center justify-center rounded-xl text-xs font-bold tabular-nums ring-1 ${
                    isMin ? 'bg-accent-cyan/20 text-accent-cyan ring-accent-cyan/40' : 'bg-white/[0.06] text-white/80 ring-white/10'
                  }`}
                >
                  {v}
                </div>
              );
            })}
          </div>
        </GameResultScreen>
      )}
    </GameShell>
  );
}
