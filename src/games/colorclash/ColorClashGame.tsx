import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { monet } from '../../lib/monetization';
import { submitScore } from '../../lib/leaderboard';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell from '../../components/GameShell';
import { colorById, makeRound, TUNING, windowForScore, type ColorId, type Round } from './colorClash';

const AXES = getGame('colorclash')?.axes ?? {};
// Score that reads as a strong run. Lower at higher difficulty (the timer is
// tighter), so reaching it reflects more reflex skill.
const SCORE_TARGET: Record<string, number> = { easy: 25, medium: 18, hard: 13, expert: 9 };
const AD_MS = 1600; // mock "ad" length (free tier); premium continues instantly.

export default function ColorClashGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const tuning = TUNING[difficulty];
  const bestKey = `colorclash.best.${difficulty}`;

  const [phase, setPhase] = useState<'idle' | 'playing' | 'revive' | 'reviving' | 'over'>('idle');
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [progress, setProgress] = useState(1); // 1 → 0 over the round window
  const [roundSeq, setRoundSeq] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [revived, setRevived] = useState(false); // one revive per run
  const [adProgress, setAdProgress] = useState(0);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const rngRef = useRef<() => number>(() => Math.random());
  const scoreRef = useRef(0);
  const bestRef = useRef(best);
  const revivedRef = useRef(false);
  const deadlineRef = useRef(0);

  const nextRound = useCallback(() => {
    setRound(makeRound(rngRef.current, tuning));
    setRoundSeq((s) => s + 1);
  }, [tuning]);

  const start = useCallback(() => {
    rngRef.current = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    scoreRef.current = 0;
    revivedRef.current = false;
    setScore(0);
    setRevived(false);
    setNewBest(false);
    setLevelUp(null);
    setPhase('playing');
    nextRound();
  }, [nextRound]);

  // Finalize the run for real: bank the best + log a Synapse play. Called once
  // when the run truly ends (no revive, or revive already spent).
  const finalize = useCallback(() => {
    const finalScore = scoreRef.current;
    const isBest = finalScore > bestRef.current;
    if (isBest) {
      bestRef.current = finalScore;
      setBest(finalScore);
      setSetting(bestKey, finalScore);
      setNewBest(true);
    } else {
      setNewBest(false);
    }
    void submitScore('colorclash', difficulty, finalScore, { score: finalScore });
    const quality = clamp01(0.15 + 0.8 * clamp01(finalScore / SCORE_TARGET[difficulty]));
    const res = recordPlay({ gameId: 'colorclash', axes: AXES, quality, weight: XP_WEIGHT[difficulty] });
    setLevelUp(isBest && finalScore > 0 && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    setPhase('over');
  }, [bestKey, difficulty, t]);

  // A miss/timeout. Offer a one-time revive (continue the same run) if the
  // player has a score to protect; otherwise end the run immediately.
  const die = useCallback(() => {
    if (!revivedRef.current && scoreRef.current > 0) setPhase('revive');
    else finalize();
  }, [finalize]);

  // Watch the (mock) ad, then resume the SAME run with the score intact.
  const revive = useCallback(() => {
    setPhase('reviving');
    setAdProgress(0);
    const adMs = monet.showAds() ? AD_MS : 300; // premium skips the ad
    const startT = Date.now();
    const iv = window.setInterval(() => setAdProgress(Math.min(1, (Date.now() - startT) / adMs)), 60);
    window.setTimeout(() => {
      window.clearInterval(iv);
      revivedRef.current = true;
      setRevived(true);
      setPhase('playing');
      nextRound();
    }, adMs);
  }, [nextRound]);

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
        die();
      }
    },
    [phase, round, nextRound, die],
  );

  // Per-round countdown (rAF). The window shrinks as the score climbs (shuttle
  // run); running out ends the round.
  useEffect(() => {
    if (phase !== 'playing') return;
    const windowMs = windowForScore(tuning, scoreRef.current);
    deadlineRef.current = Date.now() + windowMs;
    setProgress(1);
    let raf = 0;
    const tick = () => {
      const remain = deadlineRef.current - Date.now();
      setProgress(Math.max(0, remain / windowMs));
      if (remain <= 0) {
        fx.wrong();
        die();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [roundSeq, phase, tuning, die]);

  // Keyboard: number keys pick a choice while playing; Enter/Space (re)starts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'playing' && round) {
        const n = Number(e.key);
        if (n >= 1 && n <= round.options.length) answer(round.options[n - 1]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (phase === 'idle' || phase === 'over') start();
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
    <GameShell
      difficulty={difficulty}
      stat={<>⚡ {score}</>}
      action={<span className="text-xs font-semibold text-white/60">🏆 {best}</span>}
    >
      {phase === 'idle' ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-5xl">🎨</div>
          <h2 className="font-cyber mt-3 text-2xl">{t('games.colorclash.name')}</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">{t('colorclash.howto')}</p>
          <button
            onClick={start}
            className="mt-6 rounded-2xl bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta px-8 py-3 text-lg font-bold text-white shadow-premium active:scale-95"
          >
            {t('colorclash.start')}
          </button>
        </div>
      ) : (
        <>
          {/* Timer bar */}
          <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, backgroundColor: barColor }}
            />
          </div>

          {/* The Stroop word */}
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
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
                    className="flex items-center gap-2 rounded-2xl border-2 border-white/15 bg-white/[0.08] px-3 py-3 text-left shadow-sm transition active:scale-95"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
                      style={{ backgroundColor: c.hex }}
                    >
                      {c.symbol}
                    </span>
                    <span className="min-w-0 truncate font-semibold text-white">
                      {t(`colorclash.colors.${id}`)}
                    </span>
                    <span className="ml-auto text-xs text-white/30">{i + 1}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Revive offer — continue the same run (free: watch a mock ad). */}
      {phase === 'revive' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-xl">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1a2238] to-[#0c1322] p-6 text-center ring-1 ring-white/10">
            <div className="text-4xl">🎬</div>
            <h3 className="font-display mt-2 text-2xl uppercase tracking-tight text-white">{t('colorclash.reviveTitle')}</h3>
            <p className="mt-1 text-sm text-white/60">{t('colorclash.reviveSub')}</p>
            <p className="mt-3 text-4xl font-black tabular-nums text-accent-cyan">{score}</p>
            <button
              onClick={revive}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta py-3.5 font-bold uppercase tracking-wide text-white shadow-premium active:scale-95"
            >
              ▶ {monet.showAds() ? t('colorclash.revive') : t('colorclash.continueFree')}
            </button>
            <button onClick={finalize} className="mt-3 text-sm font-semibold text-white/50 underline underline-offset-2">
              {t('colorclash.endRun')}
            </button>
          </div>
        </div>
      )}

      {/* Mock ad overlay (placeholder until real ads are wired up). */}
      {phase === 'reviving' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
            {t('colorclash.adLabel')}
          </span>
          <div className="mt-6 grid h-40 w-full max-w-sm place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent-pink/20 ring-1 ring-white/10">
            <span className="font-display text-xl uppercase tracking-wide text-white/70">{t('colorclash.adNote')}</span>
          </div>
          <div className="mt-5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent-cyan transition-[width]" style={{ width: `${adProgress * 100}%` }} />
          </div>
        </div>
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
          {revived && <p className="mt-1 text-xs text-white/40">{t('colorclash.revivedNote')}</p>}
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
    </GameShell>
  );
}
