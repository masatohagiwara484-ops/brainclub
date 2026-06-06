import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { getSetting, setSetting } from '../../lib/storage';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01 } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import { useShareMsg } from '../shareHook';

const AXES = getGame('memorygrid')?.axes ?? {};
const GRID = 5; // 5×5
const CELLS = GRID * GRID;
const START_LIT = 3;
const BEST_KEY = 'memorygrid.best'; // highest level reached

// Pick `k` distinct cell indices in [0, total) (pure; mirrored in verify).
export function pickCells(total: number, k: number, rnd: () => number = Math.random): number[] {
  const pool = Array.from({ length: total }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k).sort((a, b) => a - b);
}

type Phase = 'idle' | 'show' | 'input' | 'over';

export default function MemoryGridGame(_: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(1);
  const [pattern, setPattern] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [best, setBest] = useState(() => getSetting<number>(BEST_KEY, 0));
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const lit = START_LIT + (level - 1); // 3, 4, 5, …

  const showLevel = useCallback((lv: number) => {
    const k = Math.min(START_LIT + (lv - 1), CELLS - 2);
    const p = pickCells(CELLS, k);
    setPattern(p);
    setPicked([]);
    setPhase('show');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase('input'), 700 + k * 250);
  }, []);

  const start = useCallback(() => {
    setLevel(1);
    setLevelUp(null);
    showLevel(1);
  }, [showLevel]);

  const end = useCallback(
    (reached: number) => {
      setPhase('over');
      const prev = getSetting<number>(BEST_KEY, 0);
      if (reached > prev) {
        setBest(reached);
        setSetting(BEST_KEY, reached);
      }
      // Quality grows with how deep you got (level 1→~0.2, level 10→~0.95).
      const res = recordPlay({ gameId: 'memorygrid', axes: AXES, quality: clamp01(0.1 + reached * 0.09), weight: 1.2 });
      setLevelUp(reached > prev && reached > 1 && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    },
    [t],
  );

  const tap = (i: number) => {
    if (phase !== 'input' || picked.includes(i)) return;
    if (pattern.includes(i)) {
      const np = [...picked, i];
      setPicked(np);
      fx.correct({ streak: np.length });
      if (np.length === pattern.length) {
        // Cleared the level → advance.
        const nextLv = level + 1;
        setLevel(nextLv);
        window.setTimeout(() => showLevel(nextLv), 450);
      }
    } else {
      fx.wrong();
      end(level - 1); // you reached the previous completed level
    }
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const reached = Math.max(0, level - 1);

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span className="font-semibold tabular-nums text-slate-700">
          {t('memorygrid.level')} {level}
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-400">🏆 {best}</span>
      </div>

      {phase === 'idle' ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-5xl">🧠</div>
          <h2 className="font-cyber mt-3 text-2xl">{t('games.memorygrid.name')}</h2>
          <p className="mt-2 max-w-xs text-sm text-slate-500">{t('memorygrid.howto')}</p>
          <button onClick={start} className="mt-6 rounded-2xl bg-brand px-8 py-3 text-lg font-bold text-white shadow-lg active:scale-95">
            {t('memorygrid.start')}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="mb-3 text-sm font-semibold text-slate-400">
            {phase === 'show' ? t('memorygrid.memorize') : `${picked.length}/${pattern.length}`}
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0,1fr))`, width: 'min(86vw, 360px)' }}>
            {Array.from({ length: CELLS }, (_, i) => {
              const showLit = phase === 'show' && pattern.includes(i);
              const hit = picked.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => tap(i)}
                  className={`aspect-square rounded-xl transition active:scale-95 ${
                    showLit || hit ? 'bg-brand shadow-[0_0_14px] shadow-brand/50' : 'bg-slate-100 ring-1 ring-slate-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {phase === 'over' && (
        <GameResultScreen
          emoji="🧠"
          title={t('memorygrid.gameOver')}
          subtitle={`${t('memorygrid.reached')} ${t('memorygrid.level')} ${reached}`}
          celebrate={reached >= best && reached > 0}
          levelUp={levelUp}
          stats={[
            { value: reached, label: t('memorygrid.level') },
            { value: best, label: '🏆' },
            { value: lit - 1, label: t('memorygrid.cells') },
          ]}
          actions={[
            { label: t('memorygrid.again'), onClick: start, variant: 'primary' },
            {
              label: t('memorygrid.share'),
              onClick: () => doShare(`BrainClub · ${t('games.memorygrid.name')}\n🧠 ${t('memorygrid.level')} ${reached}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
