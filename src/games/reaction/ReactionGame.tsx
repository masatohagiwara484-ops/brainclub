import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { getSetting, setSetting } from '../../lib/storage';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01 } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import { useShareMsg } from '../shareHook';

const AXES = getGame('reaction')?.axes ?? {};
const TRIALS = 5;
const BEST_KEY = 'reaction.best'; // lowest average ms

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
  const [best, setBest] = useState(() => getSetting<number>(BEST_KEY, 0));
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
      const prevBest = getSetting<number>(BEST_KEY, 0);
      const isBest = prevBest === 0 || avg < prevBest;
      if (isBest) {
        setBest(avg);
        setSetting(BEST_KEY, avg);
      }
      const res = recordPlay({ gameId: 'reaction', axes: AXES, quality: reactionQuality(avg), weight: 1.3 });
      setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    },
    [t],
  );

  const onTap = useCallback(() => {
    if (phase === 'idle' || phase === 'over' || phase === 'result') {
      setTimes([]);
      setLast(null);
      setLevelUp(null);
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
    phase === 'go' ? 'bg-green-500' : phase === 'waiting' ? 'bg-red-500' : phase === 'early' ? 'bg-amber-500' : 'bg-slate-100';
  const fgWhite = phase === 'go' || phase === 'waiting' || phase === 'early';

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span className="font-semibold tabular-nums text-slate-700">
          {times.length}/{TRIALS}
        </span>
        <span className="text-xs font-semibold text-slate-400">🏆 {best ? `${best}ms` : '—'}</span>
      </div>

      <button
        onClick={onTap}
        className={`mt-3 flex w-full max-w-md flex-1 select-none flex-col items-center justify-center rounded-3xl text-center transition-colors ${bg} ${
          fgWhite ? 'text-white' : 'text-slate-700'
        }`}
      >
        {phase === 'idle' && (
          <>
            <div className="text-5xl">⚡</div>
            <h2 className="font-cyber mt-3 text-2xl text-slate-800">{t('games.reaction.name')}</h2>
            <p className="mt-2 max-w-xs px-6 text-sm text-slate-500">{t('reaction.howto')}</p>
            <span className="mt-5 rounded-2xl bg-brand px-8 py-3 text-lg font-bold text-white">{t('reaction.start')}</span>
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
            <div className="text-5xl font-black tabular-nums text-slate-800">{last}ms</div>
            <p className="mt-2 text-sm text-slate-500">{t('reaction.again')}</p>
          </>
        )}
      </button>

      {phase === 'over' && (
        <GameResultScreen
          emoji="⚡"
          title={t('reaction.done')}
          subtitle={t('reaction.avg')}
          celebrate
          levelUp={levelUp}
          stats={[
            { value: `${avg}ms`, label: t('reaction.avg') },
            { value: `${Math.min(...times)}ms`, label: t('reaction.best') },
            { value: best ? `${best}ms` : '—', label: '🏆' },
          ]}
          actions={[
            { label: t('reaction.again'), onClick: onTap, variant: 'primary' },
            {
              label: t('reaction.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.reaction.name')}\n⚡ ${avg}ms\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
