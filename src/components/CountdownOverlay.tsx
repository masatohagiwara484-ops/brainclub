import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { sound } from '../lib/sound';
import { haptics } from '../lib/haptics';
import { prefersReducedMotion } from '../lib/fx';

// ============================================================================
// CountdownOverlay — a universal, Nintendo-grade "3 · 2 · 1 · GO!" launch
// sequence shown before every game starts (wired in GamePage). Each number pops
// in on a springy framer-motion scale + color ramp (emerald → amber → rose →
// brand indigo) and fires a pitch-escalating beep in the SAME callback that
// flips the visual, so sound and motion are frame-locked. After GO! the overlay
// fades out and hands off to the freshly-mounted game.
//
// It is lazy-loaded by GamePage so framer-motion stays out of the main bundle;
// GamePage paints an identical instant dark-blur backdrop as the Suspense
// fallback, so the launch reads as instantaneous even on the very first play.
// ============================================================================

type Step = 3 | 2 | 1 | 'go';
const SEQUENCE: Step[] = [3, 2, 1, 'go'];

// Per-step accent + glow, escalating warm → brand to match the rising beeps.
const STYLE: Record<string, { color: string; glow: string }> = {
  '3': { color: '#34d399', glow: 'rgba(52,211,153,0.55)' }, // emerald
  '2': { color: '#fbbf24', glow: 'rgba(251,191,36,0.55)' }, // amber
  '1': { color: '#fb7185', glow: 'rgba(251,113,133,0.6)' }, // rose
  go: { color: '#818cf8', glow: 'rgba(129,140,248,0.75)' }, // brand indigo
};

const STEP_MS = 720; // how long each number is held on screen
const GO_HOLD_MS = 540; // GO! lingers a beat before the reveal
const FADE_MS = 360; // overlay cross-fade to the game

export default function CountdownOverlay({
  onGo,
  onComplete,
}: {
  /** Fires the instant GO! appears — GamePage mounts the real game behind us. */
  onGo?: () => void;
  /** Fires after the overlay has fully faded out — safe to unmount. */
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const reduced = useRef(prefersReducedMotion()).current;
  const [idx, setIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    const timers: number[] = [];

    SEQUENCE.forEach((step, i) => {
      timers.push(
        window.setTimeout(() => {
          if (!active) return;
          setIdx(i);
          if (step === 'go') {
            sound.playCountdownGo();
            haptics.success();
            onGo?.();
          } else {
            // step 3→0, 2→1, 1→2 so the beep climbs in lock-step with the visual.
            sound.playCountdownTick(3 - step);
            haptics.tick();
          }
        }, i * STEP_MS),
      );
    });

    const goAt = (SEQUENCE.length - 1) * STEP_MS;
    timers.push(window.setTimeout(() => active && setLeaving(true), goAt + GO_HOLD_MS));
    timers.push(window.setTimeout(() => active && onComplete(), goAt + GO_HOLD_MS + FADE_MS));

    return () => {
      active = false;
      timers.forEach(window.clearTimeout);
    };
    // Runs exactly once on mount — the sequence drives itself to completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = SEQUENCE[idx];
  const key = String(step);
  const { color, glow } = STYLE[key];
  const isGo = step === 'go';
  const label = isGo ? t('countdown.go') : String(step);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-space-0/75 backdrop-blur-xl"
      initial={{ opacity: reduced ? 1 : 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: leaving ? FADE_MS / 1000 : 0.18, ease: 'easeOut' }}
      aria-live="assertive"
      role="status"
    >
      {/* popLayout (not "wait") so each number pops in the instant its beep
          fires — the entering glyph never waits for the previous spring to
          exit, keeping audio and motion frame-locked. */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={key}
          className="relative flex items-center justify-center"
          initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { scale: 1.6, opacity: 0 }}
          transition={
            reduced
              ? { duration: 0.15 }
              : { type: 'spring', stiffness: 520, damping: isGo ? 14 : 16, mass: 0.7 }
          }
        >
          {/* Soft glow halo behind the glyph. */}
          {!reduced && (
            <motion.span
              aria-hidden
              className="absolute h-48 w-48 rounded-full"
              style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }}
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: isGo ? 2.2 : 1.7, opacity: 0 }}
              transition={{ duration: STEP_MS / 1000, ease: 'easeOut' }}
            />
          )}
          <span
            className="select-none font-display leading-none"
            style={{
              color,
              fontSize: isGo ? 'clamp(4.5rem, 22vw, 9rem)' : 'clamp(6rem, 34vw, 14rem)',
              letterSpacing: isGo ? '0.04em' : '-0.02em',
              textShadow: `0 0 36px ${glow}, 0 8px 30px rgba(0,0,0,0.45)`,
            }}
          >
            {label}
          </span>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
