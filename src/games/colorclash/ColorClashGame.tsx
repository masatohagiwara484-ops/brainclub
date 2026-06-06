import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import { colorById, makeRound, TUNING, type ColorId, type Round } from './colorClash';

const AXES = getGame('colorclash')?.axes ?? {};
// Score that reads as a strong run. Lower at higher difficulty (the timer is
// tighter), so reaching it reflects more reflex skill.
const SCORE_TARGET: Record<string, number> = { easy: 25, medium: 18, hard: 13, expert: 9 };

export default function ColorClashGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const tuning = TUNING[difficulty];
  const bestKey = `colorclash.best.${difficulty}`;

  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [progress, setProgress] = useState(1); // 1 → 0 over the round window
  const [roundSeq, setRoundSeq] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const rngRef = useRef<() => number>(() => Math.random());
  const scoreRef = useRef(0);
  const bestRef = useRef(best);
  const deadlineRef = useRef(0);

  const nextRound = useCallback(() => {
    setRound(makeRound(rngRef.current, tuning));
    setRoundSeq((s) => s + 1);
  }, [tuning]);

  const start = useCallback(() => {
    rngRef.current = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    scoreRef.current = 0;
    setScore(0);
    setNewBest(false);
    setLevelUp(null);
    setPhase('playing');
    nextRound();
  }, [nextRound]);

  const endGame = useCallback(() => {
    setPhase('over');
    const finalScore = scoreRef.current;
    const isBest = finalScore > bestRef.current;
    if (isBest) {
      bestRef.current = finalScore;
      setBest(finalScore);
      setSetting(bestKey, finalScore);
      setNewBest(true);
      // Celebrate ONLY a new best — never the failure itself (non-exploitative).
      // The celebration is fired centrally by the result modal (celebrate={newBest}).
    } else {
      setNewBest(false);
    }
    // Log a Synapse play every game: quality scales with the run, anchored by
    // difficulty. A level-up is only surfaced on a new best (never a loss).
    const quality = clamp01(0.15 + 0.8 * clamp01(finalScore / SCORE_TARGET[difficulty]));
    const res = recordPlay({ gameId: 'colorclash', axes: AXES, quality, weight: XP_WEIGHT[difficulty] });
    setLevelUp(isBest && finalScore > 0 && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [bestKey, difficulty, t]);

  const answer = useCallback(
    (choice: ColorId) => {
      if (phase !== 'playing' || !round) return;
      if (choice === round.ink) {
        const ns = scoreRef.current + 1;
        scoreRef.current = ns;
        setScore(ns);
        fx.correct({ streak: ns }); // pitch rises with the run
        nextRound();
      } else {
        fx.wrong();
        endGame();
      }
    },
    [phase, round, nextRound, endGame],
  );

  // Per-round countdown (rAF). Resets every round; running out ends the game.
  useEffect(() => {
    if (phase !== 'playing') return;
    deadlineRef.current = Date.now() + tuning.windowMs;
    setProgress(1);
    let raf = 0;
    const tick = () => {
      const remain = deadlineRef.current - Date.now();
      setProgress(Math.max(0, remain / tuning.windowMs));
      if (remain <= 0) {
        fx.wrong();
        endGame();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [roundSeq, phase, tuning.windowMs, endGame]);

  // Keyboard: number keys pick a choice while playing; Enter/Space (re)starts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'playing' && round) {
        const n = Number(e.key);
        if (n >= 1 && n <= round.options.length) answer(round.options[n - 1]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, round, answer, start]);

  const onShare = async () => {
    const text = `BrainClub · ${t('games.colorclash.name')} (${t(difficultyKey(difficulty))})\n⚡ ${t(
      'colorclash.score',
    )} ${scoreRef.current}\n${window.location.origin}`;
    let res: 'shared' | 'copied' | 'failed' = 'failed';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BrainClub', text });
        res = 'shared';
      } else {
        await navigator.clipboard.writeText(text);
        res = 'copied';
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        res = 'copied';
      } catch {
        res = 'failed';
      }
    }
    setShareMsg(res === 'shared' ? t('share.shared') : res === 'copied' ? t('share.copied') : t('share.failed'));
    setTimeout(() => setShareMsg(null), 2500);
  };

  const barColor = progress > 0.5 ? '#22c55e' : progress > 0.25 ? '#eab308' : '#ef4444';
  const optCols = round && round.options.length === 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      {/* Status bar */}
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">⚡ {score}</span>
        <span className="text-xs font-semibold text-slate-400">🏆 {best}</span>
      </div>

      {phase === 'idle' ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-5xl">🎨</div>
          <h2 className="font-cyber mt-3 text-2xl">{t('games.colorclash.name')}</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{t('colorclash.howto')}</p>
          <button
            onClick={start}
            className="mt-6 rounded-2xl bg-brand px-8 py-3 text-lg font-bold text-white shadow-lg active:scale-95"
          >
            {t('colorclash.start')}
          </button>
        </div>
      ) : (
        <>
          {/* Timer bar */}
          <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, backgroundColor: barColor }}
            />
          </div>

          {/* The Stroop word */}
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('colorclash.prompt')}
            </p>
          </div>
          {round && (
            <div
              className="-mt-16 mb-6 select-none text-center font-cyber text-6xl font-black sm:text-7xl"
              style={{ color: colorById(round.ink).hex }}
            >
              {t(`colorclash.colors.${round.word}`).toUpperCase()}
            </div>
          )}

          {/* Answer choices: swatch + symbol + name (accessible, not color-only) */}
          {round && (
            <div className={`mb-2 grid w-full max-w-md gap-2 ${optCols}`}>
              {round.options.map((id, i) => {
                const c = colorById(id);
                return (
                  <button
                    key={id}
                    onClick={() => answer(id)}
                    className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition active:scale-95"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
                      style={{ backgroundColor: c.hex }}
                    >
                      {c.symbol}
                    </span>
                    <span className="min-w-0 truncate font-semibold text-slate-800">
                      {t(`colorclash.colors.${id}`)}
                    </span>
                    <span className="ml-auto text-xs text-slate-300">{i + 1}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Game over */}
      {phase === 'over' && (
        <GameResultScreen
          emoji={newBest ? '🏆' : '🎨'}
          title={newBest ? t('colorclash.newBest') : t('colorclash.gameOver')}
          celebrate={newBest}
          isNewBest={newBest}
          levelUp={levelUp}
          actions={[
            { label: t('colorclash.again'), onClick: start, variant: 'primary' },
            { label: t('colorclash.share'), onClick: onShare, variant: 'secondary' },
          ]}
          shareMsg={shareMsg}
        >
          <p className="mt-2 text-3xl font-black tabular-nums text-white">{score}</p>
          <p className="mt-1 text-sm text-white/60">
            {t('colorclash.best')}: {best}
          </p>
          {round && (
            <p className="mt-2 text-xs text-white/50">
              {t('colorclash.answerWas')}{' '}
              <span className="font-bold" style={{ color: colorById(round.ink).hex }}>
                {t(`colorclash.colors.${round.ink}`)}
              </span>
            </p>
          )}
        </GameResultScreen>
      )}
    </div>
  );
}
