import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion, animate, type Variants, type Transition } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import { gameColors } from '../lib/gamePalette';
import { sound } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { useSynapse, synapseScore, AXES, type Axis } from '../lib/synapse';
import { tierProgress } from '../lib/tiers';

// ============================================================================
// GameResultScreen — the universal, Cygames-grade "reward" screen every game
// shows when a round ends. Deep premium surface, game-themed confetti + accent
// gradient, an animated Synapse score count-up, a tier-progress visualization,
// and large satisfying actions. Descriptor-driven so games stay declarative.
//
// Three signature (subtle, not overdone) motion beats power the "earned it"
// feeling, all reduced-motion aware:
//   1. The card LIFTS IN on a spring, its contents revealing in a soft stagger.
//   2. The Synapse score COUNTS UP from zero (framer-motion `animate`).
//   3. The tier bar + axis meters FILL on a spring as the eye lands on them.
// Plus game-themed confetti and the optional "New Personal Best" badge pop.
//
// canvas-confetti + framer-motion live here, but every game is lazy-routed, so
// this never touches the main bundle.
// ============================================================================

export type ResultStat = { value: ReactNode; label: ReactNode };

type Props = {
  /** Drives the themed confetti + accent gradient (lib/gamePalette). */
  gameId: string;
  /** The big headline, e.g. "SOLVED" / "EXCELLENT". */
  title: ReactNode;
  subtitle?: ReactNode;
  /** A glowing badge glyph above the title (usually the game emoji). */
  emoji?: ReactNode;
  /** Fire the celebration (themed confetti + chime) once on open. Default true. */
  celebrate?: boolean;
  /** Level-up text (from recordPlay); upgrades the chime to the fanfare. */
  levelUp?: ReactNode;
  /** Show the "New Personal Best" badge with its entrance pop. */
  isNewBest?: boolean;
  stats?: ResultStat[];
  /** Show the animated Synapse score + tier + axis meters. Default true. */
  synapse?: boolean;
  onPlayAgain: () => void;
  playAgainLabel?: ReactNode;
  onShare?: () => void;
  shareLabel?: ReactNode;
  /** Ephemeral "Shared!/Copied!" toast text. */
  shareMsg?: string | null;
  onClose?: () => void;
  closeLabel?: ReactNode;
};

const COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

// Distinct accent per Synapse axis for the mini-meters.
const AXIS_COLOR: Record<Axis, string> = { memory: '#f472b6', logic: '#818cf8', reflex: '#67e8f9' };

function fireConfetti(colors: string[]) {
  const opts = { colors, disableForReducedMotion: true, zIndex: 100, scalar: 1.05 } as const;
  // A central burst, then two lower side-cannons for a layered, premium pop.
  confetti({ ...opts, particleCount: 84, spread: 78, startVelocity: 48, origin: { x: 0.5, y: 0.42 } });
  window.setTimeout(() => confetti({ ...opts, particleCount: 46, angle: 60, spread: 72, origin: { x: 0, y: 0.66 } }), 160);
  window.setTimeout(() => confetti({ ...opts, particleCount: 46, angle: 120, spread: 72, origin: { x: 1, y: 0.66 } }), 160);
}

export default function GameResultScreen({
  gameId,
  title,
  subtitle,
  emoji,
  celebrate = true,
  levelUp,
  isNewBest = false,
  stats,
  synapse = true,
  onPlayAgain,
  playAgainLabel,
  onShare,
  shareLabel,
  shareMsg,
  onClose,
  closeLabel,
}: Props) {
  const { t } = useTranslation();
  const reduced = useReducedMotion() ?? false;
  const [base, accent, glow] = gameColors(gameId);
  const profile = useSynapse();
  const hasSynapse = synapse && profile.plays > 0;
  const score = synapseScore(profile);
  const { tier, next, frac, toNext } = tierProgress(score);

  // ---- Beat 2: Synapse score count-up. ----
  const [shownScore, setShownScore] = useState(reduced ? score : 0);
  useEffect(() => {
    if (!hasSynapse) return;
    if (reduced) {
      setShownScore(score);
      return;
    }
    const controls = animate(0, score, {
      duration: 1,
      delay: 0.35,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShownScore(Math.round(v)),
    });
    return () => controls.stop();
  }, [score, hasSynapse, reduced]);

  // ---- Celebration (themed confetti + chime), fired exactly once. ----
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !celebrate) return;
    fired.current = true;
    if (levelUp != null) sound.playLevelUp();
    else sound.playWin();
    haptics.success();
    if (!reduced) fireConfetti([base, accent, glow, '#ffffff']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared motion vocabulary for the staggered content reveal (beat 1).
  const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } };
  const item: Variants = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 440, damping: 32 } },
      };

  const fillTransition = (delay: number): Transition =>
    reduced ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 20, delay };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-5 backdrop-blur-xl">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 24 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        transition={reduced ? { duration: 0.18 } : { type: 'spring', stiffness: 360, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] p-6 text-center text-white ring-1 ring-white/10"
        style={{
          background: 'linear-gradient(180deg, #1a2238 0%, #0d1322 60%, #080c16 100%)',
          boxShadow: `0 30px 80px -20px ${glow}66, 0 8px 24px -8px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Themed top glow wash behind the headline. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: `radial-gradient(120% 100% at 50% 0%, ${glow}33 0%, transparent 70%)` }}
        />

        <motion.div variants={container} initial="hidden" animate="show" className="relative">
          {/* New Personal Best — pops in with an extra-springy entrance. */}
          <AnimatePresence>
            {isNewBest && (
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
                transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 500, damping: 14, delay: 0.45 }}
                className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-amber-950 shadow-lg"
              >
                ✨ {t('result.newBest', { defaultValue: 'New Personal Best!' })}
              </motion.div>
            )}
          </AnimatePresence>

          {emoji != null && (
            <motion.div variants={item} className="mb-2 flex justify-center">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-4xl"
                style={{ background: `${base}22`, boxShadow: `inset 0 0 0 1px ${glow}40, 0 0 28px ${glow}40` }}
              >
                {emoji}
              </span>
            </motion.div>
          )}

          {celebrate && (
            <motion.div
              variants={item}
              className="text-[11px] font-bold uppercase tracking-[0.35em]"
              style={{ color: glow }}
            >
              {t('result.brainBoosted', { defaultValue: 'BRAIN BOOSTED!' })}
            </motion.div>
          )}

          {/* Headline — large, with a game-themed gradient. */}
          <motion.h2
            variants={item}
            className="mt-1 font-display text-4xl uppercase leading-tight tracking-tight"
            style={{
              background: `linear-gradient(100deg, ${base}, ${glow})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              textShadow: `0 4px 30px ${glow}40`,
            }}
          >
            {title}
          </motion.h2>

          {subtitle != null && (
            <motion.p variants={item} className="mt-1 text-sm text-white/60">
              {subtitle}
            </motion.p>
          )}

          {levelUp != null && (
            <motion.div
              variants={item}
              className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/15"
            >
              ⚡ {levelUp}
            </motion.div>
          )}

          {/* Game stat chips. */}
          {stats && stats.length > 0 && (
            <motion.div variants={item} className={`mt-5 grid gap-2 ${COLS[stats.length] ?? 'grid-cols-3'}`}>
              {stats.map((s, i) => (
                <div key={i} className="rounded-2xl bg-white/[0.06] px-2 py-3 ring-1 ring-white/10">
                  <div className="text-xl font-extrabold tabular-nums text-white">{s.value}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-white/50">{s.label}</div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Synapse reward — score count-up + tier progress + axis meters. */}
          {hasSynapse && (
            <motion.div variants={item} className="mt-5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                {t('result.synapseScore', { defaultValue: 'Synapse Score' })}
              </div>
              <div
                className="font-display text-5xl leading-none tabular-nums"
                style={{
                  background: `linear-gradient(100deg, ${accent}, ${glow})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {shownScore}
              </div>

              {/* Tier progress bar. */}
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tier.gradient} ${tier.text}`}
                >
                  {t(tier.nameKey)}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${base}, ${glow})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(frac * 100)}%` }}
                    transition={fillTransition(0.45)}
                  />
                </div>
              </div>
              <div className="mt-1.5 text-right text-[10px] text-white/40">
                {next
                  ? t('result.toNext', {
                      n: toNext,
                      tier: t(next.nameKey),
                      defaultValue: `${toNext} to ${t(next.nameKey)}`,
                    })
                  : t('result.maxTier', { defaultValue: 'Peak tier reached' })}
              </div>

              {/* Axis meters — a compact, dark-friendly Synapse profile. */}
              <div className="mt-3 space-y-1.5">
                {AXES.map((a, i) => (
                  <div key={a} className="flex items-center gap-2">
                    <span className="w-12 text-left text-[10px] font-semibold uppercase tracking-wide text-white/50">
                      {t(`synapse.${a}`)}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: AXIS_COLOR[a] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(Math.max(0, Math.min(100, profile[a])))}%` }}
                        transition={fillTransition(0.55 + i * 0.08)}
                      />
                    </div>
                    <span className="w-6 text-right text-[10px] tabular-nums text-white/50">
                      {Math.round(profile[a])}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Actions — large, satisfying, spring-pressed. */}
          <motion.div variants={item} className="mt-6 flex flex-col gap-2.5">
            <motion.button
              onClick={onPlayAgain}
              whileTap={reduced ? undefined : { scale: 0.96 }}
              whileHover={reduced ? undefined : { scale: 1.015 }}
              transition={{ type: 'spring', stiffness: 480, damping: 26 }}
              className="flex h-14 w-full items-center justify-center rounded-2xl font-display text-lg uppercase tracking-wide text-white"
              style={{ background: `linear-gradient(100deg, ${base}, ${accent})`, boxShadow: `0 12px 30px -10px ${glow}99` }}
            >
              {playAgainLabel ?? t('result.playAgain', { defaultValue: 'Play Again' })}
            </motion.button>
            {onShare && (
              <motion.button
                onClick={onShare}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                whileHover={reduced ? undefined : { scale: 1.015 }}
                transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.07] font-display text-lg uppercase tracking-wide text-white ring-1 ring-white/15"
              >
                <span aria-hidden>↗</span>
                {shareLabel ?? t('result.share', { defaultValue: 'Share Result' })}
              </motion.button>
            )}
          </motion.div>

          <AnimatePresence>
            {shareMsg && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-sm font-semibold"
                style={{ color: glow }}
              >
                {shareMsg}
              </motion.p>
            )}
          </AnimatePresence>

          {onClose && (
            <button onClick={onClose} className="mt-4 text-xs text-white/40 underline underline-offset-2">
              {closeLabel}
            </button>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
