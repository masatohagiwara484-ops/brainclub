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

const AXES = getGame('whack')?.axes ?? {};
const HOLES = 9;
const DURATION = 30; // seconds
const BEST_KEY = 'whack.best';

// Pick a hole different from the current one (pure; mirrored in verify).
export function nextHole(current: number, holes: number, rnd: () => number = Math.random): number {
  let h = current;
  while (h === current) h = Math.floor(rnd() * holes);
  return h;
}

type Phase = 'idle' | 'playing' | 'over';

export default function WhackGame(_: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mole, setMole] = useState(-1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [best, setBest] = useState(() => getSetting<number>(BEST_KEY, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const scoreRef = useRef(0);
  const moveTimer = useRef<number | undefined>(undefined);
  const tickTimer = useRef<number | undefined>(undefined);
  const endAt = useRef(0);

  const clearAll = () => {
    window.clearTimeout(moveTimer.current);
    window.clearInterval(tickTimer.current);
  };

  const scheduleMove = useCallback(() => {
    // Speeds up as time runs out: 900ms → 450ms.
    const remain = Math.max(0, endAt.current - Date.now());
    const gap = 450 + (remain / (DURATION * 1000)) * 450;
    setMole((m) => nextHole(m, HOLES));
    moveTimer.current = window.setTimeout(scheduleMove, gap);
  }, []);

  const end = useCallback(() => {
    clearAll();
    setMole(-1);
    setPhase('over');
    const final = scoreRef.current;
    const prev = getSetting<number>(BEST_KEY, 0);
    const better = final > prev;
    if (better) {
      setBest(final);
      setSetting(BEST_KEY, final);
    }
    setIsBest(better);
    const res = recordPlay({ gameId: 'whack', axes: AXES, quality: clamp01(final / 40), weight: 1.3 });
    setLevelUp(better && final > 0 && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [t]);

  const start = useCallback(() => {
    clearAll();
    scoreRef.current = 0;
    setScore(0);
    setIsBest(false);
    setLevelUp(null);
    setTimeLeft(DURATION);
    setPhase('playing');
    endAt.current = Date.now() + DURATION * 1000;
    scheduleMove();
    tickTimer.current = window.setInterval(() => {
      const remain = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setTimeLeft(remain);
      if (remain <= 0) end();
    }, 200);
  }, [scheduleMove, end]);

  const hit = (i: number) => {
    if (phase !== 'playing' || i !== mole) return;
    scoreRef.current += 1;
    setScore(scoreRef.current);
    fx.correct({ streak: scoreRef.current });
    setMole((m) => nextHole(m, HOLES));
  };

  useEffect(() => () => clearAll(), []);

  return (
    <GameShell
      left={<span className="font-semibold tabular-nums text-white/85">⭐ {score}</span>}
      stat={<>⏱ {timeLeft}s</>}
      action={<span className="text-xs font-semibold tabular-nums text-white/60">🏆 {best}</span>}
    >
      {phase === 'idle' ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-5xl">🐹</div>
          <h2 className="font-cyber mt-3 text-2xl">{t('games.whack.name')}</h2>
          <p className="mt-2 max-w-xs text-sm text-white/60">{t('whack.howto')}</p>
          <button onClick={start} className="mt-6 rounded-2xl bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta px-8 py-3 text-lg font-bold text-white shadow-premium active:scale-95">
            {t('whack.start')}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="grid grid-cols-3 gap-3" style={{ width: 'min(86vw, 360px)' }}>
            {Array.from({ length: HOLES }, (_, i) => (
              <button
                key={i}
                onClick={() => hit(i)}
                className="grid aspect-square place-items-center rounded-full bg-amber-950/50 text-4xl ring-2 ring-amber-800/40 active:scale-95"
              >
                <span className={`transition-transform duration-100 ${mole === i ? 'scale-100' : 'scale-0'}`}>🐹</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'over' && (
        <GameResultScreen
          emoji={isBest ? '🏆' : '🐹'}
          title={isBest ? t('whack.newBest') : t('whack.gameOver')}
          celebrate={isBest}
          isNewBest={isBest}
          levelUp={levelUp}
          stats={[
            { value: score, label: '⭐' },
            { value: best, label: '🏆' },
          ]}
          actions={[
            { label: t('whack.again'), onClick: start, variant: 'primary' },
            {
              label: t('whack.share'),
              onClick: () => doShare(`BrainClub · ${t('games.whack.name')}\n🐹 ${score}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
