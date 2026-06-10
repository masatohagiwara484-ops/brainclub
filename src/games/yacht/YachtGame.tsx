import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng, dailySeed } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { haptics } from '../../lib/haptics';
import { recordPlay, clamp01 } from '../../lib/synapse';
import { getGame } from '../registry';
import { submitScore } from '../../lib/leaderboard';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell, { ShellButton } from '../../components/GameShell';
import { useShareMsg } from '../shareHook';
import {
  LOWER,
  UPPER,
  UPPER_BONUS_THRESHOLD,
  YAHTZEE_BONUS,
  allFilled,
  grandTotal,
  isYahtzee,
  scoreFor,
  upperBonus,
  upperSubtotal,
  type Category,
  type Scores,
} from './yachtScore';

const AXES = getGame('yacht')?.axes ?? {};
const BEST_KEY = 'yacht.best';
const PAR = 230; // a strong game — used to shape the Synapse quality curve

type Mode = 'daily' | 'practice';
type Phase = 'choose' | 'play' | 'over';

// Pip layout for a die face (1..6) on a 3×3 grid.
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function DieFace({ value, held, dim, onClick }: { value: number; held: boolean; dim: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`grid h-12 w-12 place-items-center rounded-xl bg-white shadow-elevated transition active:scale-95 sm:h-14 sm:w-14 ${
        held ? '-translate-y-1 ring-4 ring-accent-cyan' : 'ring-1 ring-black/10'
      } ${dim ? 'opacity-40' : ''}`}
      aria-label={`die ${value}${held ? ' held' : ''}`}
    >
      <div className="grid h-8 w-8 grid-cols-3 grid-rows-3 gap-0.5 sm:h-9 sm:w-9">
        {Array.from({ length: 9 }).map((_, i) => {
          const on = PIPS[value].some(([px, py]) => px === i % 3 && py === Math.floor(i / 3));
          return <span key={i} className={`m-auto h-2 w-2 rounded-full ${on ? 'bg-slate-900' : 'bg-transparent'}`} />;
        })}
      </div>
    </button>
  );
}

export default function YachtGame(_: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();

  const [phase, setPhase] = useState<Phase>('choose');
  const [mode, setMode] = useState<Mode>('daily');
  const [dice, setDice] = useState<number[]>([1, 1, 1, 1, 1]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [rolled, setRolled] = useState(false); // rolled at least once this turn
  const [rollsLeft, setRollsLeft] = useState(3);
  const [scores, setScores] = useState<Scores>({});
  const [yahtzeeBonus, setYahtzeeBonus] = useState(0);
  const [best, setBest] = useState(() => getSetting<number>(BEST_KEY, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const rngRef = useRef<() => number>(() => Math.random());

  const start = useCallback((m: Mode) => {
    rngRef.current = makeRng(m === 'daily' ? dailySeed('yacht') : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setMode(m);
    setScores({});
    setYahtzeeBonus(0);
    setDice([1, 1, 1, 1, 1]);
    setHeld([false, false, false, false, false]);
    setRolled(false);
    setRollsLeft(3);
    setIsBest(false);
    setLevelUp(null);
    setPhase('play');
  }, []);

  const roll = () => {
    if (rollsLeft <= 0) return;
    const rng = rngRef.current;
    setDice((prev) => prev.map((d, i) => (rolled && held[i] ? d : 1 + Math.floor(rng() * 6))));
    setRolled(true);
    setRollsLeft((n) => n - 1);
    haptics.tick();
    fx.tick();
  };

  const toggleHold = (i: number) => {
    if (!rolled) return;
    setHeld((prev) => prev.map((h, j) => (j === i ? !h : h)));
    haptics.tick();
  };

  const finish = useCallback(
    (finalScores: Scores, finalBonus: number) => {
      const tot = grandTotal(finalScores, finalBonus);
      const prev = getSetting<number>(BEST_KEY, 0);
      const better = tot > prev;
      if (better) {
        setBest(tot);
        setSetting(BEST_KEY, tot);
      }
      setIsBest(better);
      // Daily games feed the shared leaderboard (everyone rolls the same seed).
      if (mode === 'daily') void submitScore('yacht', '', tot, { total: tot });
      const res = recordPlay({
        gameId: 'yacht',
        axes: AXES,
        quality: clamp01(0.2 + 0.6 * clamp01(tot / PAR)),
        weight: 1.3,
      });
      setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
      setPhase('over');
    },
    [mode, t],
  );

  const commit = (cat: Category) => {
    if (!rolled || scores[cat] !== undefined) return;
    const pts = scoreFor(cat, dice);
    // A second (or later) Yahtzee, once the Yahtzee box already holds 50, is a bonus.
    const bonusGain = isYahtzee(dice) && scores.yahtzee === 50 ? YAHTZEE_BONUS : 0;
    const nextScores: Scores = { ...scores, [cat]: pts };
    const nextBonus = yahtzeeBonus + bonusGain;
    setScores(nextScores);
    if (bonusGain) setYahtzeeBonus(nextBonus);
    if (pts > 0 || bonusGain) fx.correct({ streak: 2 });
    else haptics.tick();

    if (allFilled(nextScores)) {
      finish(nextScores, nextBonus);
      return;
    }
    // Next turn.
    setDice([1, 1, 1, 1, 1]);
    setHeld([false, false, false, false, false]);
    setRolled(false);
    setRollsLeft(3);
  };

  const runningTotal = grandTotal(scores, yahtzeeBonus);
  const upSub = upperSubtotal(scores);

  // ---- choose screen ----
  if (phase === 'choose') {
    return (
      <GameShell stat={<>🎲 {t('games.yacht.name')}</>}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-5xl">🎲</div>
          <p className="max-w-xs text-sm leading-relaxed text-white/65">{t('yacht.help')}</p>
          <button
            onClick={() => start('daily')}
            className="w-64 rounded-2xl bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta px-6 py-4 text-lg font-bold text-white shadow-premium active:scale-95"
          >
            {t('yacht.daily')}
            <span className="mt-0.5 block text-xs font-medium text-white/80">{t('yacht.dailySub')}</span>
          </button>
          <button
            onClick={() => start('practice')}
            className="w-64 rounded-2xl bg-white/[0.08] px-6 py-4 text-lg font-bold text-white ring-1 ring-white/12 active:scale-95"
          >
            {t('yacht.practice')}
            <span className="mt-0.5 block text-xs font-medium text-white/55">{t('yacht.practiceSub')}</span>
          </button>
        </div>
      </GameShell>
    );
  }

  const ScoreRow = ({ cat }: { cat: Category }) => {
    const committed = scores[cat];
    const potential = rolled ? scoreFor(cat, dice) : null;
    const open = committed === undefined;
    return (
      <button
        onClick={() => commit(cat)}
        disabled={!open || !rolled}
        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ring-1 transition ${
          open
            ? rolled
              ? 'bg-white/[0.06] ring-white/12 hover:bg-primary/25 active:scale-[0.98]'
              : 'bg-white/[0.03] ring-white/8'
            : 'bg-primary/15 ring-primary/30'
        }`}
      >
        <span className={open ? 'text-white/80' : 'text-white/55'}>{t(`yacht.cat.${cat}`)}</span>
        <span
          className={`tabular-nums ${
            committed !== undefined
              ? 'font-bold text-white'
              : potential && potential > 0
                ? 'font-semibold text-accent-cyan'
                : 'text-white/30'
          }`}
        >
          {committed !== undefined ? committed : rolled ? potential : '·'}
        </span>
      </button>
    );
  };

  return (
    <GameShell
      left={
        <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white/80">
          {mode === 'daily' ? t('yacht.daily') : t('yacht.practice')}
        </span>
      }
      stat={<>🎲 {runningTotal}</>}
      action={<ShellButton onClick={() => setPhase('choose')}>{t('yacht.newGame')}</ShellButton>}
    >
      {/* Dice + roll */}
      <div className="mt-2 flex flex-col items-center gap-3">
        <div className="flex gap-2">
          {dice.map((d, i) => (
            <DieFace key={i} value={d} held={held[i]} dim={!rolled} onClick={() => toggleHold(i)} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={roll}
            disabled={rollsLeft <= 0}
            className={`rounded-2xl px-7 py-3 text-base font-bold shadow-premium transition active:scale-95 ${
              rollsLeft > 0
                ? 'bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta text-white'
                : 'cursor-not-allowed bg-white/[0.06] text-white/40'
            }`}
          >
            {rolled ? t('yacht.reroll') : t('yacht.rollStart')}
          </button>
          <span className="text-xs font-semibold text-white/60">{t('yacht.rollsLeft', { n: rollsLeft })}</span>
        </div>
        {rolled && <p className="text-[11px] text-white/45">{t('yacht.holdHint')}</p>}
      </div>

      {/* Scorecard */}
      <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-x-3 gap-y-1.5">
        <div className="flex flex-col gap-1.5">
          {UPPER.map((cat) => (
            <ScoreRow key={cat} cat={cat} />
          ))}
          <div className="mt-0.5 flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs">
            <span className="text-white/50">{t('yacht.bonus')}</span>
            <span className="tabular-nums text-white/70">
              {upSub}/{UPPER_BONUS_THRESHOLD}
              {upperBonus(scores) > 0 && <span className="ml-1 text-accent-cyan">+35</span>}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {LOWER.map((cat) => (
            <ScoreRow key={cat} cat={cat} />
          ))}
          {yahtzeeBonus > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-xs ring-1 ring-amber-300/30">
              <span className="text-amber-200/90">{t('yacht.yahtzeeBonus')}</span>
              <span className="font-bold tabular-nums text-amber-300">+{yahtzeeBonus}</span>
            </div>
          )}
        </div>
      </div>

      {phase === 'over' && (
        <GameResultScreen
          gameId="yacht"
          emoji={isBest ? '🏆' : '🎲'}
          title={isBest ? t('yacht.newBest') : t('yacht.done')}
          isNewBest={isBest}
          celebrate
          levelUp={levelUp}
          stats={[
            { value: runningTotal, label: t('yacht.total') },
            { value: best || runningTotal, label: '🏆' },
            { value: mode === 'daily' ? t('yacht.daily') : t('yacht.practice'), label: t('yacht.mode') },
          ]}
          actions={[
            { label: t('yacht.again'), onClick: () => start(mode), variant: 'primary' },
            {
              label: t('yacht.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.yacht.name')}\n🎲 ${runningTotal}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
